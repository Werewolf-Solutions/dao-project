// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./interfaces/IPaymentEngine.sol";
import "./interfaces/CompaniesHouseV1.sol";

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

/**
 * @title PaymentEngine
 * @notice General-purpose payment graph engine. Models payment relationships as directed
 *         edges between addresses, supporting multiple payment types:
 *
 *           PAYROLL       — time-accrual; delegates to CompaniesHouseV1.executeEdgePayment.
 *           SUBSCRIPTION  — time-accrual; calls CH.executeEdgePayment for vendor/recurring payments.
 *           COMMISSION    — event-driven; settled via triggerCommission (oracle-gated).
 *           REVENUE_SHARE — splits a computed amount among configured recipients.
 *
 *         Designed to extend PayrollExecutor without replacing it. PAYROLL edges handle
 *         ad-hoc scheduled payments; PayrollExecutor's queue system remains the primary
 *         path for full company payroll runs.
 *
 * @dev Auth: admin controls edge CRUD and config. Anyone can call settleEdges (same
 *      philosophy as payEmployees — public trigger, gated by time). Oracle triggers commissions.
 *
 *      Deployment pattern (same as PayrollExecutor):
 *        1. Deploy PaymentEngine implementation
 *        2. Wrap in TransparentUpgradeableProxy
 *        3. Call companiesHouse.setPaymentEngine(address(proxy))
 *        4. At governance bootstrap, call setAdmin(address(timelock))
 */
contract PaymentEngine is Initializable, PausableUpgradeable {

    ///////////////////////////////////////
    //           Data Types              //
    ///////////////////////////////////////

    /**
     * @notice Full edge record with the companyId needed for CH callbacks.
     * @dev `edge` is the public-facing struct from IPaymentEngine. `companyId` is stored
     *      separately so we can call CH.executeEdgePayment without storing it in the interface struct.
     */
    struct EdgeData {
        IPaymentEngine.PaymentEdge edge;
        uint96 companyId;
    }

    /**
     * @notice A single revenue-share recipient with their basis-point allocation.
     */
    struct RevenueRecipient {
        address recipient;
        uint16  bps;        // out of 10_000
    }

    ///////////////////////////////////////
    //           Custom Errors           //
    ///////////////////////////////////////

    error NotAdmin();
    error NotOracle();
    error EdgeNotFound();
    error NotActive();
    error PeriodNotElapsed();
    error WrongPaymentType();
    error ZeroAmount();
    error RecipientsLengthMismatch();
    error TotalBpsExceeds10000();

    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////

    /// @notice CompaniesHouseV1 proxy — all fund transfers go through here.
    ICompaniesHouseV1 public companiesHouse;

    /// @notice PayrollExecutor proxy address (stored for reference; PAYROLL edges use CH directly).
    address public payrollExecutor;

    /// @notice Address authorised to call triggerCommission.
    address public oracle;

    /// @notice Privileged admin address. Set to Timelock so DAO controls admin functions.
    address public admin;

    /// @notice USDT token address (6 dec) — passed through to CH calls.
    address public usdtAddress;

    /// @notice Auto-incrementing edge ID counter. Starts at 1 (0 = unset sentinel).
    uint256 public edgeCounter;

    /// @notice Full edge data keyed by edge ID.
    mapping(uint256 edgeId => EdgeData) private _edges;

    /// @notice Edge IDs grouped by payer address (from field).
    mapping(address from => uint256[]) private _orgEdges;

    /// @notice Revenue-share recipients per REVENUE_SHARE edge.
    mapping(uint256 edgeId => RevenueRecipient[]) private _revenueRecipients;

    uint256[44] private __gap;

    ///////////////////////////////////////
    //           Events                  //
    ///////////////////////////////////////

    event EdgeAdded(
        uint256 indexed id,
        address indexed from,
        address indexed to,
        IPaymentEngine.PaymentType pType,
        uint96 companyId
    );
    event EdgeRemoved(uint256 indexed id);
    event EdgeSettled(uint256 indexed id, uint256 amount, uint48 asOf);
    event CommissionTriggered(uint256 indexed id, uint256 saleAmount, uint256 commission);
    event RevenueRecipientsSet(uint256 indexed id, uint256 recipientCount);

    ///////////////////////////////////////
    //           Modifiers               //
    ///////////////////////////////////////

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    ///////////////////////////////////////
    //      Constructor/Initializer      //
    ///////////////////////////////////////

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialises the PaymentEngine.
     * @param _companiesHouse CompaniesHouseV1 proxy address.
     * @param _payrollExecutor PayrollExecutor proxy address (stored for reference).
     * @param _oracle          Address authorised to trigger commission payments.
     * @param _admin           Initial admin (founder → transferred to Timelock).
     * @param _usdtAddress     USDT token address.
     */
    function initialize(
        address _companiesHouse,
        address _payrollExecutor,
        address _oracle,
        address _admin,
        address _usdtAddress
    ) public initializer {
        __Pausable_init();
        companiesHouse  = ICompaniesHouseV1(_companiesHouse);
        payrollExecutor = _payrollExecutor;
        oracle          = _oracle;
        admin           = _admin;
        usdtAddress     = _usdtAddress;
        edgeCounter     = 0;
    }

    ///////////////////////////////////////
    //       External Functions          //
    ///////////////////////////////////////

    /**
     * @notice Adds a new payment edge.
     * @dev onlyAdmin. Edge ID is auto-assigned (edgeCounter + 1, 1-based).
     * @param from      Payer address (org identifier for CH lookup).
     * @param to        Payee address.
     * @param pType     Payment type.
     * @param rateUSDT  USDT (6 dec) per `period` seconds; bps for COMMISSION.
     * @param period    Seconds between settlements (0 = trigger-only for COMMISSION).
     * @param companyId CompaniesHouseV1 company ID — required for CH callbacks.
     * @return id       The assigned edge ID.
     */
    function addEdge(
        address from,
        address to,
        IPaymentEngine.PaymentType pType,
        uint96 rateUSDT,
        uint48 period,
        uint96 companyId
    ) external onlyAdmin returns (uint256 id) {
        edgeCounter++;
        id = edgeCounter;

        _edges[id] = EdgeData({
            edge: IPaymentEngine.PaymentEdge({
                id:          id,
                from:        from,
                to:          to,
                pType:       pType,
                rateUSDT:    rateUSDT,
                lastSettled: uint48(block.timestamp),
                period:      period,
                active:      true
            }),
            companyId: companyId
        });

        _orgEdges[from].push(id);

        emit EdgeAdded(id, from, to, pType, companyId);
    }

    /**
     * @notice Soft-deletes a payment edge (sets active = false).
     * @dev onlyAdmin. The edge record is preserved for historical lookup.
     */
    function removeEdge(uint256 edgeId) external onlyAdmin {
        EdgeData storage d = _edges[edgeId];
        if (d.edge.id == 0) revert EdgeNotFound();
        d.edge.active = false;
        emit EdgeRemoved(edgeId);
    }

    /**
     * @notice Settles a batch of edges as of `asOf` timestamp.
     * @dev Public — anyone can trigger settlement (same philosophy as payEmployees).
     *      COMMISSION edges are skipped; use triggerCommission for those.
     *      Failed individual settlements are caught and skipped silently.
     * @param edgeIds Array of edge IDs to attempt settlement.
     * @param asOf    Settlement timestamp (pass block.timestamp cast to uint48).
     */
    function settleEdges(uint256[] calldata edgeIds, uint48 asOf) external whenNotPaused {
        for (uint256 i = 0; i < edgeIds.length; i++) {
            EdgeData storage d = _edges[edgeIds[i]];
            if (d.edge.id == 0 || !d.edge.active) continue;
            if (d.edge.pType == IPaymentEngine.PaymentType.COMMISSION) continue;

            uint256 owed = _compute(d, asOf);
            if (owed == 0) continue;

            try this._executeSettlement(d.edge.id, asOf, owed) {} catch {}
        }
    }

    /**
     * @notice Triggers a commission payment for a COMMISSION-type edge.
     * @dev onlyOracle. `rateUSDT` is treated as basis points of `saleAmount`.
     * @param edgeId     COMMISSION edge to settle.
     * @param saleAmount Gross sale amount in USDT (6 dec).
     */
    function triggerCommission(uint256 edgeId, uint256 saleAmount) external onlyOracle whenNotPaused {
        EdgeData storage d = _edges[edgeId];
        if (d.edge.id == 0 || !d.edge.active) revert NotActive();
        if (d.edge.pType != IPaymentEngine.PaymentType.COMMISSION) revert WrongPaymentType();
        if (saleAmount == 0) revert ZeroAmount();

        uint256 commission = (saleAmount * uint256(d.edge.rateUSDT)) / 10_000;
        if (commission == 0) revert ZeroAmount();

        companiesHouse.executeEdgePayment(d.companyId, d.edge.to, commission, edgeId);
        d.edge.lastSettled = uint48(block.timestamp);

        emit CommissionTriggered(edgeId, saleAmount, commission);
    }

    /**
     * @notice Sets the revenue-share recipients for a REVENUE_SHARE edge.
     * @dev onlyAdmin. Total bps must be <= 10_000. Overwrites any existing recipients.
     * @param edgeId     REVENUE_SHARE edge to configure.
     * @param recipients Array of recipient addresses.
     * @param bps        Basis-point allocations (parallel array to recipients).
     */
    function setRevenueRecipients(
        uint256 edgeId,
        address[] calldata recipients,
        uint16[]  calldata bps
    ) external onlyAdmin {
        if (recipients.length != bps.length) revert RecipientsLengthMismatch();

        uint256 total;
        for (uint256 i = 0; i < bps.length; i++) total += bps[i];
        if (total > 10_000) revert TotalBpsExceeds10000();

        delete _revenueRecipients[edgeId];
        for (uint256 i = 0; i < recipients.length; i++) {
            _revenueRecipients[edgeId].push(RevenueRecipient(recipients[i], bps[i]));
        }

        emit RevenueRecipientsSet(edgeId, recipients.length);
    }

    // ── Admin config ──────────────────────────────────────────────────────────

    function setOracle(address _oracle) external onlyAdmin {
        oracle = _oracle;
    }

    function setAdmin(address _admin) external onlyAdmin {
        admin = _admin;
    }

    function setPayrollExecutor(address _payrollExecutor) external onlyAdmin {
        payrollExecutor = _payrollExecutor;
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    // ── View functions ────────────────────────────────────────────────────────

    /**
     * @notice Returns the full EdgeData for a given edge ID.
     * @dev Returns a zero-struct if the edge does not exist (edge.id == 0).
     */
    function getEdge(uint256 edgeId) external view returns (EdgeData memory) {
        return _edges[edgeId];
    }

    /**
     * @notice Returns all edge IDs associated with a payer address.
     */
    function getOrgEdgeIds(address from) external view returns (uint256[] memory) {
        return _orgEdges[from];
    }

    /**
     * @notice Returns the revenue-share recipient list for an edge.
     */
    function getRevenueRecipients(uint256 edgeId) external view returns (RevenueRecipient[] memory) {
        return _revenueRecipients[edgeId];
    }

    /**
     * @notice Returns all edges (as EdgeData) for a payer address in one call.
     * @dev Use for dapp pagination. Inactive edges are included — filter client-side.
     * @param from    Payer address.
     * @param fromIdx Start index into orgEdges[from] (inclusive).
     * @param toIdx   End index (exclusive). Pass type(uint256).max for all.
     */
    function getEdgesBatch(
        address from,
        uint256 fromIdx,
        uint256 toIdx
    ) external view returns (EdgeData[] memory result) {
        uint256[] storage ids = _orgEdges[from];
        if (toIdx > ids.length) toIdx = ids.length;
        if (fromIdx >= toIdx) return result;

        result = new EdgeData[](toIdx - fromIdx);
        for (uint256 i = fromIdx; i < toIdx; i++) {
            result[i - fromIdx] = _edges[ids[i]];
        }
    }

    ///////////////////////////////////////
    //       External (self-call)        //
    ///////////////////////////////////////

    /**
     * @notice Called via try/catch from settleEdges to isolate per-edge failures.
     * @dev Only callable by this contract (self-call via `this`). Executes the settlement
     *      and updates lastSettled. The try/catch in settleEdges ensures one failed edge
     *      does not block the rest of the batch.
     */
    function _executeSettlement(uint256 edgeId, uint48 asOf, uint256 owed) external {
        require(msg.sender == address(this), "PaymentEngine: internal");

        EdgeData storage d = _edges[edgeId];

        if (d.edge.pType == IPaymentEngine.PaymentType.REVENUE_SHARE) {
            RevenueRecipient[] storage recs = _revenueRecipients[edgeId];
            for (uint256 i = 0; i < recs.length; i++) {
                uint256 share = (owed * recs[i].bps) / 10_000;
                if (share == 0) continue;
                companiesHouse.executeEdgePayment(d.companyId, recs[i].recipient, share, edgeId);
            }
        } else {
            // PAYROLL and SUBSCRIPTION both go through executeEdgePayment
            companiesHouse.executeEdgePayment(d.companyId, d.edge.to, owed, edgeId);
        }

        d.edge.lastSettled = asOf;
        emit EdgeSettled(edgeId, owed, asOf);
    }

    ///////////////////////////////////////
    //       Internal Functions          //
    ///////////////////////////////////////

    /**
     * @notice Calculates the amount owed for an edge as of `asOf`.
     * @dev Returns 0 if the period has not elapsed yet (prevents negative or zero settlements).
     *      COMMISSION edges always return 0 here (triggered separately).
     */
    function _compute(EdgeData storage d, uint48 asOf) internal view returns (uint256) {
        if (d.edge.period == 0) return 0; // trigger-only (COMMISSION)
        if (asOf <= d.edge.lastSettled) return 0;

        uint256 elapsed = asOf - d.edge.lastSettled;
        if (elapsed < d.edge.period) return 0;

        return (uint256(d.edge.rateUSDT) * elapsed) / uint256(d.edge.period);
    }
}
