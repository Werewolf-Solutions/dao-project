// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

//When adding anything please follow the contract layout
/* Contract layout:
 Data types: structs, enums, and type declarations
 State Variables
 Events
 Function Modifiers
 Constructor/Initialize
 Fallback and Receive function
 External functions
 Public functions
 Internal functions
 Private Functions
*/

interface ICompaniesHousePayroll {
    struct PayrollPreviewItem {
        address employeeAddress;
        string  name;
        uint256 grossUSDT;
        uint256 fee;
        uint256 netUSDT;
    }

    function isAuthorized(address caller, uint96 companyId) external view returns (bool);
    function canPayEmployee(address caller, address employee, uint96 companyId) external view returns (bool);
    function calcEmployeeGross(address employee, uint96 companyId) external view returns (uint256);
    function checkCanPay(uint96 companyId, uint256 amount) external view returns (bool);
    function previewPayroll(uint96 companyId) external view returns (
        PayrollPreviewItem[] memory items,
        uint256 totalGross,
        uint256 totalFee,
        uint256 totalNet
    );
    function executeQueuedPayment(
        uint96 companyId,
        address employee,
        uint256 grossUSDT,
        uint256 snapshotTimestamp
    ) external;
    function executeTokenPayment(
        uint96 companyId,
        address employee,
        uint256 usdtAmount,
        address wlfToken,
        uint256 wlfAmount,
        uint256 payTimestamp
    ) external;
    function companyBrief(uint96 companyId) external view returns (address owner, uint96 index);
}

/**
 * @title PayrollExecutor
 * @notice Handles all payroll execution for CompaniesHouseV1. Provides two modes:
 *
 *         Immediate: payEmployee / payEmployees / payEmployeesBatch / payEmployeeWithTokens —
 *         single-transaction pay at current block.timestamp (migrated from CompaniesHouseV1).
 *
 *         Queue: queuePayroll (snapshot amounts) → executeQueue / executeQueueBatch (execute
 *         in chunks). Amounts are locked at snapshot time so the UI can show an exact preview
 *         before any tokens move. Large companies can execute in batches across multiple blocks.
 *
 * @dev Auth for company operations is delegated back to CompaniesHouseV1 via view calls
 *      (canPayEmployee, isAuthorized). State mutations go through executeQueuedPayment /
 *      executeTokenPayment on CompaniesHouseV1, which is the sole holder of all funds.
 *
 *      Follows the same deployment pattern as CompanyDeFiV1:
 *        1. Deploy PayrollExecutor implementation
 *        2. Wrap in TransparentUpgradeableProxy
 *        3. Call companiesHouse.setPayrollExecutor(address(proxy))
 *        4. At governance bootstrap, call setAdmin(address(timelock))
 */
contract PayrollExecutor is Initializable, PausableUpgradeable {
    ///////////////////////////////////////
    //           Data Types              //
    ///////////////////////////////////////

    /**
     * @notice A single employee's locked payment amounts at snapshot time.
     * @dev feeUSDT and netUSDT are informational — CompaniesHouseV1 recomputes the fee
     *      using its current nonWlfFeeBps when executeQueuedPayment is called.
     */
    struct QueuedPayment {
        address employee;   // employeeId (resolved by CH.employeeBrief)
        uint256 grossUSDT;  // locked at queuePayroll() time
        uint256 feeUSDT;    // protocol fee at snapshot (informational)
        uint256 netUSDT;    // net to employee (informational)
    }

    /**
     * @notice Per-company payroll snapshot waiting for execution.
     * @dev executedCount tracks batch progress so executeQueueBatch can be called in
     *      multiple transactions without re-executing already-paid employees.
     */
    struct CompanyQueue {
        QueuedPayment[] payments;
        uint256 snapshotTimestamp;
        uint256 executedCount;
        bool    active;
    }

    ///////////////////////////////////////
    //           Custom Errors           //
    ///////////////////////////////////////

    error NotAdmin();
    error NotAuthorized();
    error NothingToPay();
    error ReserveTooLow();
    error QueueAlreadyActive();
    error NoActiveQueue();
    error BatchIndexInvalid();

    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////

    /// @notice CompaniesHouseV1 proxy — all auth checks and state mutations go through here.
    ICompaniesHousePayroll public companiesHouse;

    /// @notice Privileged admin address. Set to Timelock so DAO controls admin functions.
    address public admin;

    /// @notice Per-company queued payroll snapshots.
    mapping(uint96 => CompanyQueue) public companyQueues;

    uint256[47] private __gap;

    ///////////////////////////////////////
    //           Events                  //
    ///////////////////////////////////////

    /// @param totalGross Sum of all grossUSDT for all queued employees
    event PayrollQueued(uint96 indexed companyId, uint256 snapshotTimestamp, uint256 employeeCount, uint256 totalGross);
    /// @param executedCount Number of payments executed in this call
    /// @param totalNet Sum of net USDT received by employees (informational from snapshot)
    event PayrollExecuted(uint96 indexed companyId, uint256 executedCount, uint256 totalNet);
    event PayrollQueueCancelled(uint96 indexed companyId);
    /// @param employee Employee whose payment was skipped (fired between queue and execute)
    event PaymentSkipped(uint96 indexed companyId, address indexed employee);

    ///////////////////////////////////////
    //           Modifiers               //
    ///////////////////////////////////////

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    ///////////////////////////////////////
    //      Constructor/Initializer      //
    ///////////////////////////////////////

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the proxy's storage.
     * @param _companiesHouse Address of the CompaniesHouseV1 proxy
     * @param _admin          Privileged admin (starts as founder, transferred to Timelock)
     */
    function initialize(address _companiesHouse, address _admin) public initializer {
        __Pausable_init();
        companiesHouse = ICompaniesHousePayroll(_companiesHouse);
        admin = _admin;
    }

    ///////////////////////////////////////
    //         External Functions        //
    ///////////////////////////////////////

    // ── Admin ────────────────────────────────────────────────────────────────

    /**
     * @notice Transfers the admin role to a new address.
     * @dev Used to hand off control from founder to Timelock at bootstrap.
     */
    function setAdmin(address _admin) external onlyAdmin {
        admin = _admin;
    }

    /**
     * @notice Emergency pause — halts all pay and queue operations.
     */
    function pause() external onlyAdmin {
        _pause();
    }

    /**
     * @notice Resumes normal operation.
     */
    function unpause() external onlyAdmin {
        _unpause();
    }

    // ── Immediate pay (migrated from CompaniesHouseV1) ───────────────────────

    /**
     * @notice Pays all pending salary to a single employee directly in USDT.
     * @dev Requires LENIENT auth (caller must be able to pay this employee).
     *      Checks reserve before payment. Sets lastPayDate to block.timestamp in CH.
     * @param employee  The employee to pay
     * @param companyId Company the employee belongs to
     */
    function payEmployee(address employee, uint96 companyId) external whenNotPaused {
        if (!companiesHouse.canPayEmployee(msg.sender, employee, companyId)) revert NotAuthorized();

        uint256 gross = companiesHouse.calcEmployeeGross(employee, companyId);
        if (gross == 0) revert NothingToPay();
        if (!companiesHouse.checkCanPay(companyId, gross)) revert ReserveTooLow();

        companiesHouse.executeQueuedPayment(companyId, employee, gross, block.timestamp);
    }

    /**
     * @notice Pays all active employees in a company in one transaction.
     * @dev Anyone can call (no auth check — same behavior as original CH.payEmployees).
     *      Silently returns if nothing is owed (no revert).
     * @param companyId The company to run payroll for
     */
    function payEmployees(uint96 companyId) external whenNotPaused {
        (
            ICompaniesHousePayroll.PayrollPreviewItem[] memory items,
            uint256 totalGross,,
        ) = companiesHouse.previewPayroll(companyId);

        if (totalGross == 0) return;
        if (!companiesHouse.checkCanPay(companyId, totalGross)) revert ReserveTooLow();

        uint256 ts = block.timestamp;
        for (uint256 i = 0; i < items.length; i++) {
            try companiesHouse.executeQueuedPayment(companyId, items[i].employeeAddress, items[i].grossUSDT, ts) {}
            catch { emit PaymentSkipped(companyId, items[i].employeeAddress); }
        }
    }

    /**
     * @notice Pays a contiguous slice of employees in a single transaction.
     * @dev Useful for companies with large employee counts that exceed block gas limits.
     *      Indices are into the items array returned by previewPayroll (active employees only).
     * @param companyId The company to run payroll for
     * @param fromIndex First item index to include (inclusive)
     * @param toIndex   Last item index to include (exclusive)
     */
    function payEmployeesBatch(uint96 companyId, uint256 fromIndex, uint256 toIndex) external whenNotPaused {
        if (fromIndex >= toIndex) revert BatchIndexInvalid();

        (
            ICompaniesHousePayroll.PayrollPreviewItem[] memory items,
            ,
            ,
        ) = companiesHouse.previewPayroll(companyId);

        if (toIndex > items.length) revert BatchIndexInvalid();

        uint256 batchGross;
        for (uint256 i = fromIndex; i < toIndex; i++) {
            batchGross += items[i].grossUSDT;
        }
        if (batchGross == 0) return;
        if (!companiesHouse.checkCanPay(companyId, batchGross)) revert ReserveTooLow();

        uint256 ts = block.timestamp;
        for (uint256 i = fromIndex; i < toIndex; i++) {
            try companiesHouse.executeQueuedPayment(companyId, items[i].employeeAddress, items[i].grossUSDT, ts) {}
            catch { emit PaymentSkipped(companyId, items[i].employeeAddress); }
        }
    }

    /**
     * @notice Pays an employee with a split of USDT and/or WLF from the company's internal balances.
     * @dev Either amount may be zero (pay entirely in one token). Reserve check for USDT portion
     *      is enforced inside CH.executeTokenPayment.
     * @param employee   The employee to pay
     * @param companyId  Company the employee belongs to
     * @param usdtAmount USDT (6 dec) to pay from company balance
     * @param wlfToken   WLF token address (ignored when wlfAmount == 0)
     * @param wlfAmount  WLF (18 dec) to pay from company balance
     */
    function payEmployeeWithTokens(
        address employee,
        uint96 companyId,
        uint256 usdtAmount,
        address wlfToken,
        uint256 wlfAmount
    ) external whenNotPaused {
        if (!companiesHouse.canPayEmployee(msg.sender, employee, companyId)) revert NotAuthorized();
        if (usdtAmount == 0 && wlfAmount == 0) revert NothingToPay();

        companiesHouse.executeTokenPayment(companyId, employee, usdtAmount, wlfToken, wlfAmount, block.timestamp);
    }

    // ── Queue system ─────────────────────────────────────────────────────────

    /**
     * @notice Snapshots current payroll amounts into a queue for later batched execution.
     * @dev Caller must be authorized in the company. Reverts if a queue is already active.
     *      Amounts are locked at this block.timestamp — subsequent salary accrual is NOT
     *      included until after the queue is executed (lastPayDate is set to snapshotTimestamp).
     *      Reserve is checked now; if balance drops before execution, executeQueue will revert.
     * @param companyId The company to queue payroll for
     */
    function queuePayroll(uint96 companyId) external whenNotPaused {
        if (!companiesHouse.isAuthorized(msg.sender, companyId)) revert NotAuthorized();
        if (companyQueues[companyId].active) revert QueueAlreadyActive();

        (
            ICompaniesHousePayroll.PayrollPreviewItem[] memory items,
            uint256 totalGross,
            ,
        ) = companiesHouse.previewPayroll(companyId);

        if (totalGross == 0) revert NothingToPay();
        if (!companiesHouse.checkCanPay(companyId, totalGross)) revert ReserveTooLow();

        CompanyQueue storage q = companyQueues[companyId];
        // Clear any stale data (shouldn't exist, but defensive)
        delete companyQueues[companyId];

        q.snapshotTimestamp = block.timestamp;
        q.executedCount = 0;
        q.active = true;

        for (uint256 i = 0; i < items.length; i++) {
            q.payments.push(QueuedPayment({
                employee:  items[i].employeeAddress,
                grossUSDT: items[i].grossUSDT,
                feeUSDT:   items[i].fee,
                netUSDT:   items[i].netUSDT
            }));
        }

        emit PayrollQueued(companyId, block.timestamp, items.length, totalGross);
    }

    /**
     * @notice Executes all queued payments for a company in a single transaction.
     * @dev Suitable for small companies. For large companies use executeQueueBatch.
     *      Each payment is attempted individually — a fired employee causes PaymentSkipped
     *      rather than reverting the entire batch.
     * @param companyId The company to execute payroll for
     */
    function executeQueue(uint96 companyId) external whenNotPaused {
        CompanyQueue storage q = companyQueues[companyId];
        if (!q.active) revert NoActiveQueue();

        uint256 snapshotTs = q.snapshotTimestamp;
        uint256 count      = q.payments.length;
        uint256 totalNet;

        for (uint256 i = 0; i < count; i++) {
            QueuedPayment storage p = q.payments[i];
            try companiesHouse.executeQueuedPayment(companyId, p.employee, p.grossUSDT, snapshotTs) {
                totalNet += p.netUSDT;
            } catch {
                emit PaymentSkipped(companyId, p.employee);
            }
        }

        q.active = false;
        q.executedCount = count;
        emit PayrollExecuted(companyId, count, totalNet);
    }

    /**
     * @notice Executes a contiguous slice of queued payments.
     * @dev Allows splitting execution across multiple transactions for gas management.
     *      Tracks executedCount so subsequent calls can pick up where the previous left off.
     *      Queue is marked inactive once all payments have been attempted.
     * @param companyId The company to execute payroll for
     * @param fromIndex First payment index to execute (inclusive)
     * @param toIndex   Last payment index to execute (exclusive)
     */
    function executeQueueBatch(uint96 companyId, uint256 fromIndex, uint256 toIndex) external whenNotPaused {
        CompanyQueue storage q = companyQueues[companyId];
        if (!q.active) revert NoActiveQueue();
        if (fromIndex >= toIndex || toIndex > q.payments.length) revert BatchIndexInvalid();

        uint256 snapshotTs = q.snapshotTimestamp;
        uint256 totalNet;

        for (uint256 i = fromIndex; i < toIndex; i++) {
            QueuedPayment storage p = q.payments[i];
            try companiesHouse.executeQueuedPayment(companyId, p.employee, p.grossUSDT, snapshotTs) {
                totalNet += p.netUSDT;
            } catch {
                emit PaymentSkipped(companyId, p.employee);
            }
        }

        q.executedCount += (toIndex - fromIndex);
        if (q.executedCount >= q.payments.length) {
            q.active = false;
        }

        emit PayrollExecuted(companyId, toIndex - fromIndex, totalNet);
    }

    /**
     * @notice Cancels a pending payroll queue without executing any payments.
     * @dev Caller must be authorized in the company. The queue is deleted; a fresh
     *      queuePayroll call can be made immediately after.
     * @param companyId The company whose queue to cancel
     */
    function cancelQueue(uint96 companyId) external {
        if (!companiesHouse.isAuthorized(msg.sender, companyId)) revert NotAuthorized();
        if (!companyQueues[companyId].active) revert NoActiveQueue();
        delete companyQueues[companyId];
        emit PayrollQueueCancelled(companyId);
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the current queue snapshot for a company.
     * @dev Returns an empty struct with active == false if no queue exists.
     */
    function getQueue(uint96 companyId) external view returns (CompanyQueue memory) {
        return companyQueues[companyId];
    }

    /**
     * @notice Returns true if a payroll queue is currently active for the company.
     */
    function hasActiveQueue(uint96 companyId) external view returns (bool) {
        return companyQueues[companyId].active;
    }
}
