// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/IWerewolfTokenV1.sol";
import "./interfaces/IDAO.sol";
import "./interfaces/ITokenSale.sol";

interface ICompanyVault {
    function withdraw(address token, uint256 amount, address to) external;
}

interface IV3SwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut);
}

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

contract CompaniesHouseV1 is AccessControlUpgradeable, PausableUpgradeable {
    ///////////////////////////////////////
    //           Data Types              //
    ///////////////////////////////////////

    /**
     * @notice Categorises how an employee's pay is calculated and triggered.
     * @dev    SALARY      — continuous hourly accrual (default, value 0 for backward-compat).
     *         OVERTIME    — discrete amount submitted per pay period by an authorised party.
     *         BONUS       — discrete one-time amount.
     *         COMMISSION  — discrete amount, percentage pre-calculated off-chain.
     *         REIMBURSEMENT — discrete expense amount.
     */
    enum EarningsType { SALARY, OVERTIME, BONUS, COMMISSION, REIMBURSEMENT }

    /**
     * @notice A single continuous salary stream within an employee's compensation package.
     * @dev Salary is denominated in USDT with 6 decimal places (e.g., $500/month
     *      ≈ 684_931 USDT-wei per hour). USDT is sent directly from the company's
     *      internal balance at pay time.
     *      earningsType labels the stream; existing entries default to SALARY (0).
     */
    struct SalaryItem {
        string role;
        EarningsType earningsType; // labels the continuous stream type
        uint256 salaryPerHour;     // USDT 6-decimal wei per hour
        uint256 lastPayDate;
    }

    /**
     * @notice A discrete (one-time) earning queued by an authorised party and paid at next pay run.
     * @dev    Used for overtime, bonuses, commissions, and reimbursements. Drained to zero on payment.
     */
    struct PendingEarning {
        EarningsType earningsType;
        string description;
        uint256 amount;      // USDT 6-decimal wei
        uint256 submittedAt;
    }

    /**
     * @notice Defines a named role and its authorization level.
     * @dev    Level 1 is reserved for the company owner (hardcoded, not assignable).
     *         Assignable roles start at level 2 (highest non-owner authority).
     *         Higher numbers = lower authority (e.g. 2=CEO, 3=Manager, 4=Engineer).
     */
    struct RoleDefinition {
        string name;
        uint8  level; // 2 = highest non-owner, increasing = lower authority
    }

    /**
     * @dev Per-operation authorization rule for same-level callers.
     *      STRICT  — callerLevel must be strictly less than targetLevel (fire, update, addRole)
     *      LENIENT — callerLevel must be <= targetLevel (pay, submitEarning)
     */
    enum AuthRule { STRICT, LENIENT }

    struct CreateCompany {
        string name;
        string industry;
        string domain;
        RoleDefinition[] roles;
        address operatorAddress; // address authorized to operate the company (call payEmployee, hire, etc.) — not a fund holder
        string ownerRole;      // role assigned to the creator (auto-added to roles[] if missing)
        uint8  ownerRoleLevel; // level for the ownerRole if it must be auto-added
        uint256 ownerSalaryPerHour; // USDT 6-dec wei per hour for the creator's first salary stream
        string ownerName;
    }

    struct UpdateCompany {
        string name;
        string industry;
        string domain;
        RoleDefinition[] roles;
        address operatorAddress;
    }

    struct UpdateEmployee {
        string name;
        address payableAddress;
        SalaryItem[] salaryItems; // role + salaryPerHour; lastPayDate is ignored (preserved)
    }

    struct HireEmployee {
        address employeeAddress;
        string name;
        uint96 companyId;
        SalaryItem[] salaryItems;
    }

    struct CompanyStruct {
        uint96 companyId;     // slot 0
        address owner;        // slot 0
        address operatorAddress;// slot 1
        string industry;      // slot 2
        string name;          // slot 3
        uint256 createdAt;    // slot 4
        bool active;          // slot 5
        Employee[] employees; // slot 6
        string domain;            // slot 7
        RoleDefinition[] roles;   // slot 8 — replaces string[] roles + powerRoles
    }

    struct Employee {
        address employeeId;
        address payableAddress;
        string name;
        uint256 companyId;
        uint256 hiredAt;
        bool active;
        SalaryItem[] salaryItems;          // continuous pay streams (one per role held)
        PendingEarning[] pendingEarnings;  // discrete triggered earnings (drained on pay)
    }

    struct CompanyBrief {
        address owner;
        uint96 index;
    }

    struct EmployeeBrief {
        bool isMember;
        uint96 employeeIndex;
    }

    /**
     * @notice Per-employee payroll preview returned by previewPayroll().
     * @dev Amounts are in USDT with 6 decimal places. fee is 0 for the DAO company.
     */
    struct PayrollPreviewItem {
        address employeeAddress;
        string  name;
        uint256 grossUSDT;  // accrued salary + queued pending earnings
        uint256 fee;        // protocol fee deducted at payment
        uint256 netUSDT;    // what the employee actually receives
    }

    ///////////////////////////////////////
    //           Custom Errors           //
    ///////////////////////////////////////

    error CompanyNotFound();
    error NotAuthorized();
    error BelowReserve();
    error InsufficientFee();
    error TransferFailed();
    error NothingToPay();
    error InvalidSalaryIndex();
    error RoleNotFound();
    error InsufficientWLF();
    error BeaconNotSet();
    error VaultAlreadyExists();
    error FeeTooHigh();
    error BatchIndexInvalid();


    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////

    mapping(uint96 companyId => CompanyBrief) public companyBrief;
    mapping(address ownerAddress => CompanyStruct[]) public ownerToCompanies;
    mapping(address employee => mapping(uint96 companyId => EmployeeBrief))
        public employeeBrief;

    /// @notice Per-company ERC20 token balances held inside this contract
    mapping(uint96 companyId => mapping(address token => uint256)) public companyTokenBalances;

    IWerewolfTokenV1 private werewolfToken;
    ITokenSale public tokenSale;
    IDAO public dao;
    ITreasury public treasury;
    address public usdtAddress;
    bytes32 public constant STAFF_ROLE = keccak256("CEO");
    uint96 public currentCompanyIndex;
    uint96 public deletedCompanies;
    uint256 public creationFee;
    address public treasuryAddress;

    /// @notice Months of payroll USDT the company must always keep in reserve (default: 60 = 5 years)
    uint256 public minReserveMonths;
    /// @notice Privileged admin address — set to Timelock on deploy so DAO can manage via proposals
    address public admin;
    /// @notice Uniswap V3 SwapRouter address used to buy WLF when company has no WLF balance
    address public swapRouter;

    uint256 public wlfFeeBps    = 50;   // 0.5% on WLF payments
    uint256 public nonWlfFeeBps = 500;  // 5%   on USDT / other payments

    /// @notice Company ID of the canonical WLF DAO company (set by admin after creation)
    uint96 public daoCompanyId;

    /// @notice CompanyDeFiV1 proxy address — authorized to pull/credit company funds for DeFi ops
    address public companyDefi;

    /// @notice UpgradeableBeacon address — all CompanyVault BeaconProxies read their implementation from this.
    address public beacon;

    /// @notice Maps companyId → address of that company's CompanyVault clone (address(0) if not created)
    mapping(uint96 companyId => address) public companyVault;

    /// @notice Optional USDC address — counted alongside USDT in reserve balance checks when set.
    address public usdcAddress;

    /// @notice Per-company minimum reserve months override. 0 = fall back to global minReserveMonths.
    mapping(uint96 => uint256) public companyReserveMonths;

    /// @notice PayrollExecutor proxy — authorized to call executeQueuedPayment and executeTokenPayment
    address public payrollExecutor;

    /// @notice PaymentEngine proxy — authorized to call executeEdgePayment
    address public paymentEngine;

    uint256[23] private __gap;

    ///////////////////////////////////////
    //           Events                  //
    ///////////////////////////////////////
    event EmployeeHired(address indexed employee);
    event EmployeeUpdated(address indexed employee, uint96 indexed companyId);
    event EmployeeFired(address indexed employee);
    /// @param usdtAmount USDT (6 dec) transferred to the employee
    event EmployeePaid(address indexed employee, uint256 usdtAmount);
    event RoleAdded(address indexed employee, uint96 indexed companyId, string role);
    event CompanyCreated(address indexed owner, uint96 indexed companyId);
    event CompanyUpdated(address indexed owner, uint96 indexed companyId);
    event CompanyDeleted(address indexed owner, uint96 indexed companyId);
    /// @param companyId The company whose treasury was funded
    /// @param token ERC20 token address deposited
    /// @param amount Amount deposited (token decimals)
    event CompanyFunded(uint96 indexed companyId, address indexed token, uint256 amount);
    event VaultCreated(uint96 indexed companyId, address indexed vault);
    event VaultBeaconSet(address indexed beacon);
    /// @param companyId  Company that paid the fee
    /// @param token      Token the fee was taken in
    /// @param feeAmount  Fee sent to treasury
    event ProtocolFeePaid(uint96 indexed companyId, address indexed token, uint256 feeAmount);
    event CompanyReserveMonthsSet(uint96 indexed companyId, uint256 months);
    /// @param earningsType The type of discrete earning submitted
    /// @param amount       USDT (6 dec) queued for payment
    /// @param description  Free-text reason (e.g. "Q1 bonus", "10hrs overtime week 12")
    event EarningSubmitted(address indexed employee, uint96 indexed companyId, EarningsType earningsType, uint256 amount, string description);
    /// @param companyId       Company whose balance was debited
    /// @param recipient       Address that received the net USDT
    /// @param usdtAmount      Gross USDT (6 dec) debited from company balance
    /// @param enginePaymentId PaymentEdge.id from PaymentEngine
    event EdgePaymentExecuted(uint96 indexed companyId, address indexed recipient, uint256 usdtAmount, uint256 enginePaymentId);

    ///////////////////////////////////////
    //           Modifiers               //
    ///////////////////////////////////////

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAuthorized();
        _;
    }

    modifier onlyCompanyDefi() {
        if (msg.sender != companyDefi) revert NotAuthorized();
        _;
    }

    modifier onlyPayrollExecutor() {
        if (msg.sender != payrollExecutor) revert NotAuthorized();
        _;
    }

    modifier onlyPaymentEngine() {
        if (msg.sender != paymentEngine) revert NotAuthorized();
        _;
    }


    ///////////////////////////////////////
    //      Constructor/Initializer      //
    ///////////////////////////////////////

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the proxy's storage
     * @param _token address of the Werewolf token
     * @param _treasuryAddress address where all fees are sent
     * @param _daoAddress DAO contract address
     * @param tokenSaleAddress TokenSale contract address
     * @param _admin privileged admin address (set to Timelock so DAO controls admin functions)
     * @param _usdtAddress USDT token contract address
     * @param _swapRouter Uniswap V3 SwapRouter address (address(0) on local chain)
     * @param _minReserveMonths months of payroll USDT the company must keep in reserve (e.g. 3 for testnet, 60 for mainnet)
     */
    function initialize(
        address _token,
        address _treasuryAddress,
        address _daoAddress,
        address tokenSaleAddress,
        address _admin,
        address _usdtAddress,
        address _swapRouter,
        uint256 _minReserveMonths
    ) public initializer {
        __Pausable_init();
        werewolfToken = IWerewolfTokenV1(_token);
        dao = IDAO(_daoAddress);
        tokenSale = ITokenSale(tokenSaleAddress);
        treasuryAddress = _treasuryAddress;
        treasury = ITreasury(_treasuryAddress);
        usdtAddress = _usdtAddress;
        admin = _admin;
        swapRouter = _swapRouter;
        minReserveMonths = _minReserveMonths;
        creationFee = 10e18;
        currentCompanyIndex = 1;
        wlfFeeBps    = 50;   // 0.5%
        nonWlfFeeBps = 500;  // 5%
    }

    ///////////////////////////////////////
    //         External Functions        //
    ///////////////////////////////////////

    /**
     * @notice Deposits ERC20 tokens into a company's internal treasury.
     * @dev Anyone can fund a company. Pulls tokens from msg.sender via transferFrom.
     *      Requires prior ERC20 approval from msg.sender to this contract.
     * @param companyId The company to fund
     * @param token The ERC20 token to deposit
     * @param amount Amount to deposit (token decimals)
     */
    function depositToCompany(uint96 companyId, address token, uint256 amount) external {
        _requireCompanyExists(companyId);
        address v = companyVault[companyId];
        if (v != address(0)) {
            IERC20(token).transferFrom(msg.sender, v, amount);
        } else {
            IERC20(token).transferFrom(msg.sender, address(this), amount);
            companyTokenBalances[companyId][token] += amount;
        }
        emit CompanyFunded(companyId, token, amount);
    }

    /**
     * @notice Migrates legacy companyTokenBalances into the company's vault.
     * @dev Call after createVault() to physically move pre-vault deposits into isolation.
     *      Only the company owner can sweep. Skips zero-balance tokens silently.
     * @param companyId The company whose balances to sweep
     * @param tokens    List of ERC20 token addresses to sweep (e.g. [usdtAddress])
     */
    function sweepToVault(uint96 companyId, address[] calldata tokens) external {
        if (companyBrief[companyId].owner != msg.sender) revert NotAuthorized();
        address v = companyVault[companyId];
        if (v == address(0)) revert BeaconNotSet();
        for (uint256 i; i < tokens.length; i++) {
            uint256 bal = companyTokenBalances[companyId][tokens[i]];
            if (bal == 0) continue;
            companyTokenBalances[companyId][tokens[i]] = 0;
            IERC20(tokens[i]).transfer(v, bal);
        }
    }

    /**
     * @notice Credits tokens already sent directly to this contract into a company's balance.
     * @dev onlyAdmin (= Timelock). Used by DAO airdrop proposals:
     *      step 1 — treasury.withdrawToken(usdt, X, address(companiesHouse))
     *      step 2 — companiesHouse.creditToCompany(companyId, usdt, X)
     *      No token transfer happens here — tokens must already be in this contract.
     * @param companyId The company to credit
     * @param token The ERC20 token to credit
     * @param amount Amount to credit (token decimals)
     */
    function creditToCompany(uint96 companyId, address token, uint256 amount) external onlyAdmin {
        _requireCompanyExists(companyId);
        companyTokenBalances[companyId][token] += amount;
        emit CompanyFunded(companyId, token, amount);
    }

    /**
     * @notice Updates the minimum reserve duration companies must maintain.
     * @dev onlyAdmin. DAO can adjust this via governance proposal through Timelock.
     * @param months Number of months of payroll USDT that must remain after any payment
     */
    function setMinReserveMonths(uint256 months) external onlyAdmin {
        minReserveMonths = months;
    }

    /**
     * @notice Set the USDC token address to include in reserve balance calculations.
     * @dev onlyAdmin. Pass address(0) to disable USDC reserve counting.
     */
    function setUsdcAddress(address _usdc) external onlyAdmin {
        usdcAddress = _usdc;
    }

    /**
     * @notice Override the minimum reserve months for a specific company.
     * @dev Callable by admin (Timelock) or the company owner. 0 = revert to global minReserveMonths.
     * @param _companyId Company to configure
     * @param _months    Required months of payroll to keep in reserve (0 = use global)
     */
    function setCompanyReserveMonths(uint96 _companyId, uint256 _months) external {
        if (msg.sender != admin && companyBrief[_companyId].owner != msg.sender) revert NotAuthorized();
        companyReserveMonths[_companyId] = _months;
        emit CompanyReserveMonthsSet(_companyId, _months);
    }

    /**
     * @notice Transfers the admin role to a new address.
     * @dev onlyAdmin. Used to hand off control (e.g., founder → Timelock → new Timelock).
     */
    function setAdmin(address _admin) external onlyAdmin {
        admin = _admin;
    }

    /**
     * @notice Sets the Uniswap V3 SwapRouter address used to buy WLF for employee payments.
     * @dev onlyAdmin. Required before payEmployee can fall back to the Uniswap swap path.
     */
    function setSwapRouter(address _swapRouter) external onlyAdmin {
        swapRouter = _swapRouter;
    }

    /**
     * @notice Sets the CompanyDeFiV1 contract address.
     * @dev onlyAdmin. Must be called after deploying CompanyDeFiV1 to enable DeFi operations.
     *      CompanyDeFiV1 is then authorized to call withdrawForDeFi and creditFromDeFi.
     */
    function setCompanyDefi(address _companyDefi) external onlyAdmin {
        companyDefi = _companyDefi;
    }

    /**
     * @notice Sets the UpgradeableBeacon address for CompanyVault BeaconProxies.
     * @dev onlyAdmin. Must be called before createVault() will work.
     *      The beacon owner (Timelock) controls future vault implementation upgrades.
     */
    function setBeacon(address _beacon) external onlyAdmin {
        beacon = _beacon;
        emit VaultBeaconSet(_beacon);
    }

    /**
     * @notice Deploys a CompanyVault BeaconProxy for `_companyId` and initializes it.
     * @dev All vaults share one UpgradeableBeacon — governance can upgrade all vaults
     *      at once by calling beacon.upgradeTo(newImpl) through the Timelock.
     *      Caller must be the company owner or operator.
     *      Emits VaultCreated.
     * @param _companyId    Company to create the vault for
     * @param _aavePool     Aave v3 Pool proxy address (address(0) if not applicable)
     * @param _allowedToken Initial whitelisted token for Aave ops (address(0) to skip)
     */
    function createVault(
        uint96 _companyId,
        address _aavePool,
        address _allowedToken
    ) external returns (address vault) {
        if (beacon == address(0)) revert BeaconNotSet();
        _requireCompanyExists(_companyId);
        if (_getLevel(msg.sender, _companyId) != 1) revert NotAuthorized(); // owner only
        if (companyVault[_companyId] != address(0)) revert VaultAlreadyExists();

        bytes memory initData = abi.encodeWithSignature(
            "initialize(uint96,address,address,address,address)",
            _companyId,
            address(this),
            _aavePool,
            admin,
            _allowedToken
        );
        vault = address(new BeaconProxy(beacon, initData));

        companyVault[_companyId] = vault;
        emit VaultCreated(_companyId, vault);
    }

    /**
     * @notice Transfers `amount` of `token` from this contract to CompanyDeFiV1 for Aave supply.
     * @dev onlyCompanyDefi. Deducts from the company's internal balance and transfers the tokens.
     *      Called by CompanyDeFiV1.supplyToAave and CompanyDeFiV1.repayToAave.
     * @param companyId The company whose treasury balance is reduced
     * @param token     ERC20 token to transfer
     * @param amount    Amount to transfer (token decimals)
     */
    function withdrawForDeFi(uint96 companyId, address token, uint256 amount) external onlyCompanyDefi {
        _requireCompanyExists(companyId);
        if (companyTokenBalances[companyId][token] < amount) revert InsufficientWLF();
        companyTokenBalances[companyId][token] -= amount;
        IERC20(token).transfer(msg.sender, amount);
    }

    /**
     * @notice Credits tokens already transferred to this contract back from CompanyDeFiV1.
     * @dev onlyCompanyDefi. Pulls tokens from CompanyDeFiV1 (caller must have approved this contract)
     *      and adds them to the company's internal balance.
     *      Called by CompanyDeFiV1.withdrawFromAave and CompanyDeFiV1.borrowFromAave.
     * @param companyId The company whose treasury balance is increased
     * @param token     ERC20 token to credit
     * @param amount    Amount to credit (token decimals)
     */
    function creditFromDeFi(uint96 companyId, address token, uint256 amount) external onlyCompanyDefi {
        _requireCompanyExists(companyId);
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        companyTokenBalances[companyId][token] += amount;
        emit CompanyFunded(companyId, token, amount);
    }

    /**
     * @notice Update protocol fee rates for employee payments.
     * @dev onlyAdmin. DAO can adjust via governance proposal through Timelock.
     * @param _wlfFeeBps    Fee in basis points for WLF payments  (e.g. 50 = 0.5%)
     * @param _nonWlfFeeBps Fee in basis points for non-WLF payments (e.g. 500 = 5%)
     */
    function setFees(uint256 _wlfFeeBps, uint256 _nonWlfFeeBps) external onlyAdmin {
        if (_wlfFeeBps > 1_000 || _nonWlfFeeBps > 1_000) revert FeeTooHigh();
        wlfFeeBps    = _wlfFeeBps;
        nonWlfFeeBps = _nonWlfFeeBps;
    }

    /**
     * @notice Set the canonical WLF DAO company ID so the protocol can identify
     *         which CompaniesHouse entry represents the DAO itself.
     * @param _id Company ID of the Werewolf DAO company (must exist).
     */
    function setDaoCompanyId(uint96 _id) external onlyAdmin {
        if (_id >= currentCompanyIndex) revert CompanyNotFound();
        daoCompanyId = _id;
    }

    /**
     * @notice Sets the PayrollExecutor contract address.
     * @dev onlyAdmin. Must be called after deploying PayrollExecutor to enable payroll operations.
     *      PayrollExecutor is then authorized to call executeQueuedPayment and executeTokenPayment.
     */
    function setPayrollExecutor(address _payrollExecutor) external onlyAdmin {
        payrollExecutor = _payrollExecutor;
    }

    /**
     * @notice Sets the PaymentEngine contract address.
     * @dev onlyAdmin. Must be called after deploying PaymentEngine.
     *      PaymentEngine is then authorised to call executeEdgePayment.
     */
    function setPaymentEngine(address _paymentEngine) external onlyAdmin {
        paymentEngine = _paymentEngine;
    }

    /**
     * @notice Settles a non-payroll payment edge — deducts USDT from company balance,
     *         applies protocol fee, and transfers net USDT to `recipient`.
     * @dev onlyPaymentEngine + whenNotPaused. Mirrors fee logic in executeQueuedPayment.
     *      DAO companies pay zero fee (daoCompanyId match).
     * @param companyId       Company whose balance is debited.
     * @param recipient       USDT recipient.
     * @param usdtAmount      Gross USDT (6 dec) to transfer.
     * @param enginePaymentId PaymentEdge.id from PaymentEngine (emitted for indexing).
     */
    function executeEdgePayment(
        uint96 companyId,
        address recipient,
        uint256 usdtAmount,
        uint256 enginePaymentId
    ) external onlyPaymentEngine whenNotPaused {
        _requireCompanyExists(companyId);
        if (usdtAmount == 0) revert NothingToPay();
        _debitCompany(companyId, usdtAddress, usdtAmount);
        _disburseUSDT(companyId, recipient, usdtAmount);
        emit EdgePaymentExecuted(companyId, recipient, usdtAmount, enginePaymentId);
    }

    /**
     * @notice Returns whether `caller` is authorized to trigger payment for `employee` in `companyId`.
     * @dev Wraps the LENIENT auth rule. Used by PayrollExecutor before executing payments.
     * @return true if caller has LENIENT authority over employee in the company
     */
    function canPayEmployee(
        address caller,
        address employee,
        uint96 companyId
    ) external view returns (bool) {
        return _canOperateOn(caller, employee, companyId, AuthRule.LENIENT);
    }

    /**
     * @notice Returns the total USDT gross owed to one employee right now.
     * @dev Used by PayrollExecutor for immediate-pay flows. Returns 0 if employee is not a member.
     * @param employee  Employee address
     * @param companyId Company the employee belongs to
     * @return gross Total USDT (6 dec) owed: accrued salary + all pending earnings
     */
    function calcEmployeeGross(
        address employee,
        uint96 companyId
    ) external view returns (uint256 gross) {
        EmployeeBrief memory empBrief = employeeBrief[employee][companyId];
        if (!empBrief.isMember) return 0;
        Employee storage emp = _getCompany(companyId).employees[empBrief.employeeIndex];
        if (!emp.active) return 0;
        return _calcEmployeeGross(emp);
    }

    /**
     * @notice Returns whether the company can afford to pay `amount` USDT while maintaining reserve.
     * @dev PayrollExecutor uses this before queuePayroll to avoid queuing unpayable payrolls.
     * @return true if stableBalance >= amount + requiredReserve
     */
    function checkCanPay(uint96 companyId, uint256 amount) external view returns (bool) {
        return _stableBalance(companyId) >= amount + getRequiredReserveUSDT(companyId);
    }

    /**
     * @notice Executes a single queued payment — transfers USDT to employee, fees to treasury.
     * @dev onlyPayrollExecutor. Sets lastPayDate to snapshotTimestamp (not block.timestamp) to
     *      honor the locked snapshot. Drains pendingEarnings submitted at or before snapshotTimestamp,
     *      preserving newer entries for the next pay cycle.
     * @param companyId         Company running payroll
     * @param employee          Employee address (resolved via employeeBrief)
     * @param grossUSDT         Amount locked at snapshot time (from previewPayroll)
     * @param snapshotTimestamp block.timestamp when queuePayroll() was called
     */
    function executeQueuedPayment(
        uint96 companyId,
        address employee,
        uint256 grossUSDT,
        uint256 snapshotTimestamp
    ) external onlyPayrollExecutor {
        _requireCompanyExists(companyId);
        if (grossUSDT == 0) revert NothingToPay();

        Employee storage s_emp = _loadEmployee(employee, companyId);

        // Set lastPayDate to snapshotTimestamp across all salary streams
        for (uint256 i = 0; i < s_emp.salaryItems.length; i++) {
            s_emp.salaryItems[i].lastPayDate = snapshotTimestamp;
        }

        // Drain pendingEarnings submitted at or before snapshotTimestamp; preserve newer ones
        uint256 writeIdx;
        uint256 originalLen = s_emp.pendingEarnings.length;
        for (uint256 i = 0; i < originalLen; i++) {
            if (s_emp.pendingEarnings[i].submittedAt > snapshotTimestamp) {
                if (writeIdx != i) s_emp.pendingEarnings[writeIdx] = s_emp.pendingEarnings[i];
                writeIdx++;
            }
        }
        for (uint256 i = writeIdx; i < originalLen; i++) {
            s_emp.pendingEarnings.pop();
        }

        _debitCompany(companyId, usdtAddress, grossUSDT);
        uint256 netPay = _disburseUSDT(companyId, s_emp.payableAddress, grossUSDT);
        emit EmployeePaid(s_emp.employeeId, netPay);
    }

    /**
     * @notice Executes a mixed USDT + WLF payment for an employee.
     * @dev onlyPayrollExecutor. Sets lastPayDate to payTimestamp. Either amount may be zero.
     *      The USDT portion is subject to the minimum reserve check (checked by PayrollExecutor before calling).
     * @param companyId   Company running payroll
     * @param employee    Employee address
     * @param usdtAmount  USDT (6 dec) to pay from company balance
     * @param wlfToken    WLF token address (ignored when wlfAmount == 0)
     * @param wlfAmount   WLF (18 dec) to pay from company balance
     * @param payTimestamp block.timestamp at time of PayrollExecutor call
     */
    function executeTokenPayment(
        uint96 companyId,
        address employee,
        uint256 usdtAmount,
        address wlfToken,
        uint256 wlfAmount,
        uint256 payTimestamp
    ) external onlyPayrollExecutor {
        if (usdtAmount == 0 && wlfAmount == 0) revert NothingToPay();

        Employee storage s_emp = _loadEmployee(employee, companyId);
        if (!s_emp.active) revert NotAuthorized();

        for (uint256 i = 0; i < s_emp.salaryItems.length; i++) {
            s_emp.salaryItems[i].lastPayDate = payTimestamp;
        }

        if (usdtAmount > 0) _debitCompany(companyId, usdtAddress, usdtAmount);
        if (wlfAmount  > 0) _debitCompany(companyId, wlfToken, wlfAmount);
        uint256 usdtNet = usdtAmount > 0 ? _disburseUSDT(companyId, s_emp.payableAddress, usdtAmount) : 0;
        uint256 wlfFee  = wlfAmount > 0 ? wlfAmount * wlfFeeBps / 10_000 : 0;
        uint256 wlfNet  = wlfAmount - wlfFee;

        if (wlfFee > 0) IERC20(wlfToken).transfer(treasuryAddress, wlfFee);
        if (wlfNet > 0) IERC20(wlfToken).transfer(s_emp.payableAddress, wlfNet);

        emit EmployeePaid(employee, usdtNet);
        if (wlfFee > 0) emit ProtocolFeePaid(companyId, wlfToken, wlfFee);
    }

    /**
     * @notice Emergency pause — halts employee hiring, payments, and company creation.
     * @dev Callable by admin.
     */
    function pause() external onlyAdmin {
        _pause();
    }

    /**
     * @notice Resume normal operation.
     * @dev Callable by admin.
     */
    function unpause() external onlyAdmin {
        _unpause();
    }

    ///////////////////////////////////////
    //           Public Functions        //
    ///////////////////////////////////////

    /**
     * @notice Creates a new company and hires the caller as the first employee.
     * @dev Charges creationFee WLF. The ownerRole is auto-added to roles[] if missing.
     *      Company wallet is a separate EOA the user controls — store the private key securely.
     * @param _params CreateCompany struct with all company details
     */
    function createCompany(CreateCompany memory _params) public whenNotPaused {
        if (werewolfToken.balanceOf(msg.sender) < creationFee) revert InsufficientFee();
        if (!werewolfToken.transferFrom(msg.sender, treasuryAddress, creationFee)) revert TransferFailed();

        // Bug 2 fix: push empty slot first, then get the index
        ownerToCompanies[msg.sender].push();
        uint256 nextCompIndex = ownerToCompanies[msg.sender].length - 1;
        CompanyStruct storage compPtr = ownerToCompanies[msg.sender][nextCompIndex];

        compPtr.companyId = currentCompanyIndex;
        compPtr.owner = msg.sender;
        compPtr.operatorAddress = _params.operatorAddress;
        compPtr.industry = _params.industry;
        compPtr.name = _params.name;
        compPtr.createdAt = block.timestamp;
        compPtr.active = true;
        compPtr.domain = _params.domain;

        // Copy roles and auto-add ownerRole if missing
        bool ownerRoleFound;
        for (uint256 i = 0; i < _params.roles.length; i++) {
            compPtr.roles.push(_params.roles[i]);
            if (keccak256(abi.encodePacked(_params.roles[i].name)) == keccak256(abi.encodePacked(_params.ownerRole))) {
                ownerRoleFound = true;
            }
        }
        if (!ownerRoleFound) {
            compPtr.roles.push(RoleDefinition({ name: _params.ownerRole, level: _params.ownerRoleLevel }));
        }

        companyBrief[currentCompanyIndex] = CompanyBrief(msg.sender, uint96(nextCompIndex));

        // Hire the creator as the first employee
        SalaryItem[] memory ownerSalary = new SalaryItem[](1);
        ownerSalary[0] = SalaryItem({
            role: _params.ownerRole,
            earningsType: EarningsType.SALARY,
            salaryPerHour: _params.ownerSalaryPerHour,
            lastPayDate: block.timestamp
        });

        _hireEmployeeInternal(
            msg.sender,
            _params.ownerName,
            currentCompanyIndex,
            ownerSalary
        );

        emit CompanyCreated(msg.sender, currentCompanyIndex);
        currentCompanyIndex += 1;
    }

    /**
     * @notice Soft-deletes a company (marks it inactive, clears the brief lookup).
     * @dev Uses soft delete to avoid storage issues with nested dynamic arrays.
     */
    function deleteCompany(uint96 _companyId) external {
        if (companyBrief[_companyId].owner != msg.sender) revert NotAuthorized();
        uint96 companyIndex = companyBrief[_companyId].index;
        ownerToCompanies[msg.sender][companyIndex].active = false;
        delete companyBrief[_companyId];
        deletedCompanies++;
        emit CompanyDeleted(msg.sender, _companyId);
    }

    /**
     * @notice Updates mutable company metadata.
     * @dev Only the company owner may call this. Replaces roles[] and powerRoles[] entirely.
     * @param _companyId ID of the company to update
     * @param _params New values for name, industry, domain, roles, powerRoles, operatorAddress
     */
    function updateCompany(uint96 _companyId, UpdateCompany calldata _params) external {
        if (companyBrief[_companyId].owner != msg.sender) revert NotAuthorized();
        uint96 idx = companyBrief[_companyId].index;
        CompanyStruct storage compPtr = ownerToCompanies[msg.sender][idx];
        if (!compPtr.active) revert NotAuthorized();

        compPtr.name = _params.name;
        compPtr.industry = _params.industry;
        compPtr.domain = _params.domain;
        compPtr.operatorAddress = _params.operatorAddress;

        delete compPtr.roles;
        for (uint256 i = 0; i < _params.roles.length; i++) {
            compPtr.roles.push(_params.roles[i]);
        }

        emit CompanyUpdated(msg.sender, _companyId);
    }

    /**
     * @notice Updates an existing employee's name, payable address, and salary streams.
     * @dev Salary items are matched by index — existing slots preserve lastPayDate,
     *      new slots get block.timestamp, and excess old slots are removed with pop().
     */
    function updateEmployee(
        address _employeeAddress,
        uint96 _companyId,
        UpdateEmployee calldata _params
    ) external {
        if (!_canOperateOn(msg.sender, _employeeAddress, _companyId, AuthRule.STRICT)) revert NotAuthorized();

        Employee storage emp = _loadEmployee(_employeeAddress, _companyId);
        if (!emp.active) revert NotAuthorized();
        CompanyStruct storage s_company = _getCompany(_companyId);

        for (uint256 i = 0; i < _params.salaryItems.length; i++) {
            if (_findRoleLevel(_params.salaryItems[i].role, s_company.roles) == 0) revert RoleNotFound();
        }

        emp.name = _params.name;
        emp.payableAddress = _params.payableAddress;

        uint256 oldLen = emp.salaryItems.length;
        uint256 newLen = _params.salaryItems.length;
        uint256 updateLen = oldLen < newLen ? oldLen : newLen;

        for (uint256 i = 0; i < updateLen; i++) {
            emp.salaryItems[i].role = _params.salaryItems[i].role;
            emp.salaryItems[i].salaryPerHour = _params.salaryItems[i].salaryPerHour;
            // lastPayDate intentionally preserved
        }
        for (uint256 i = oldLen; i < newLen; i++) {
            emp.salaryItems.push(SalaryItem({
                role: _params.salaryItems[i].role,
                earningsType: _params.salaryItems[i].earningsType,
                salaryPerHour: _params.salaryItems[i].salaryPerHour,
                lastPayDate: block.timestamp
            }));
        }
        for (uint256 i = oldLen; i > newLen; i--) {
            emp.salaryItems.pop();
        }

        emit EmployeeUpdated(_employeeAddress, _companyId);
    }

    /**
     * @notice Hires a new employee into a company.
     * @dev All roles in salaryItems must exist in the company's roles[]. Each salary
     *      item represents a separate role + pay stream (e.g., CTO at $300/mo, HR at $200/mo).
     */
    function hireEmployee(HireEmployee memory _hireParams) public whenNotPaused {
        uint8 callerLevel = _getLevel(msg.sender, _hireParams.companyId);
        if (callerLevel == 0) revert NotAuthorized();

        CompanyStruct storage compPtr = _getCompany(_hireParams.companyId);

        // Validate roles exist; non-owners must also outrank every role being assigned
        for (uint256 i = 0; i < _hireParams.salaryItems.length; i++) {
            uint8 roleLevel = _findRoleLevel(_hireParams.salaryItems[i].role, compPtr.roles);
            if (roleLevel == 0) revert RoleNotFound();
            if (callerLevel != 1 && callerLevel >= roleLevel) revert NotAuthorized();
        }

        _hireEmployeeInternal(
            _hireParams.employeeAddress,
            _hireParams.name,
            _hireParams.companyId,
            _hireParams.salaryItems
        );
    }

    /**
     * @notice Adds an additional role+salary stream to an existing employee.
     * @dev Use this to give the founder CEO, CTO, HR roles at different salaries
     *      without firing and re-hiring.
     */
    function addRoleToEmployee(
        address _employeeAddress,
        uint96 _companyId,
        SalaryItem memory _item
    ) external {
        if (!_canOperateOn(msg.sender, _employeeAddress, _companyId, AuthRule.STRICT)) revert NotAuthorized();

        Employee storage emp = _loadEmployee(_employeeAddress, _companyId);
        if (_findRoleLevel(_item.role, _getCompany(_companyId).roles) == 0) revert RoleNotFound();

        emp.salaryItems.push(SalaryItem({
            role: _item.role,
            earningsType: _item.earningsType,
            salaryPerHour: _item.salaryPerHour,
            lastPayDate: block.timestamp
        }));

        emit RoleAdded(_employeeAddress, _companyId, _item.role);
    }

    /**
     * @notice Submit a discrete (one-time) earning for an employee — the "trigger" for overtime,
     *         bonuses, commissions, and reimbursements.
     * @dev    The amount is queued in the employee's pendingEarnings[] and paid out at the next
     *         payEmployee / payEmployees call. Calculation of the amount (e.g. hours × rate × 1.5
     *         for overtime) is done off-chain by the caller.
     *         SALARY type is rejected — use addRoleToEmployee for continuous streams.
     * @param _employeeAddress  The employee receiving the earning
     * @param _companyId        Company the employee belongs to
     * @param _earningsType     Must be OVERTIME, BONUS, COMMISSION, or REIMBURSEMENT
     * @param _amount           USDT 6-decimal wei to queue
     * @param _description      Free-text reason (e.g. "10 hrs overtime week 12", "Q1 bonus")
     */
    function submitEarning(
        address _employeeAddress,
        uint96 _companyId,
        EarningsType _earningsType,
        uint256 _amount,
        string calldata _description
    ) external whenNotPaused {
        if (!_canOperateOn(msg.sender, _employeeAddress, _companyId, AuthRule.LENIENT)) revert NotAuthorized();
        if (_earningsType == EarningsType.SALARY) revert InvalidSalaryIndex();
        if (_amount == 0) revert NothingToPay();

        Employee storage emp = _loadEmployee(_employeeAddress, _companyId);
        if (!emp.active) revert NotAuthorized();

        emp.pendingEarnings.push(PendingEarning({
            earningsType: _earningsType,
            description: _description,
            amount: _amount,
            submittedAt: block.timestamp
        }));

        emit EarningSubmitted(_employeeAddress, _companyId, _earningsType, _amount, _description);
    }

    /**
     * @notice Soft-fires an employee (marks them inactive, clears their brief).
     */
    function fireEmployee(address _employeeAddress, uint96 _companyId) external {
        if (!_canOperateOn(msg.sender, _employeeAddress, _companyId, AuthRule.STRICT)) revert NotAuthorized();

        Employee storage emp = _loadEmployee(_employeeAddress, _companyId);
        emp.active = false;
        delete employeeBrief[_employeeAddress][_companyId];

        emit EmployeeFired(_employeeAddress);
    }

    /**
     * @notice Updates the role string on a specific salary stream of an employee.
     * @param _salaryItemIndex index into the employee's salaryItems[] array
     */
    function setCompanyRole(
        address _employeeAddress,
        uint256 _salaryItemIndex,
        string memory _newRole,
        uint96 _companyId
    ) external {
        if (!_canOperateOn(msg.sender, _employeeAddress, _companyId, AuthRule.STRICT)) revert NotAuthorized();

        Employee storage emp = _loadEmployee(_employeeAddress, _companyId);
        if (_findRoleLevel(_newRole, _getCompany(_companyId).roles) == 0) revert RoleNotFound();
        if (_salaryItemIndex >= emp.salaryItems.length) revert InvalidSalaryIndex();
        emp.salaryItems[_salaryItemIndex].role = _newRole;
    }

    /**
     * @notice Returns true if `_caller` has any authority level in the given company.
     * @dev Exposes the level check so CompanyDeFiV1 can delegate auth without duplicating logic.
     */
    function isAuthorized(address _caller, uint96 _companyId) external view returns (bool) {
        return _getLevel(_caller, _companyId) > 0;
    }

    function retrieveCompany(uint96 _companyId) external view returns (CompanyStruct memory) {
        _requireCompanyExists(_companyId);
        return _getCompany(_companyId);
    }

    function retrieveEmployee(
        uint96 _companyId,
        address _employeeAddress
    ) external view returns (Employee memory) {
        return _loadEmployee(_employeeAddress, _companyId);
    }

    /**
     * @notice Returns total monthly USDT payroll across all active employees.
     * @dev Assumes 730 hours per month (365 * 24 / 12).
     */
    function getMonthlyBurnUSDT(uint96 _companyId) public view returns (uint256 usdtPerMonth) {
        Employee[] storage employees = _getCompany(_companyId).employees;
        uint256 totalPerHour;
        for (uint256 i = 0; i < employees.length; i++) {
            if (!employees[i].active) continue;
            for (uint256 j = 0; j < employees[i].salaryItems.length; j++) {
                totalPerHour += employees[i].salaryItems[j].salaryPerHour;
            }
        }
        usdtPerMonth = totalPerHour * 730;
    }

    /**
     * @notice Returns the minimum stable reserve the company must always maintain.
     * @dev Uses per-company override if set, otherwise global minReserveMonths.
     */
    function getRequiredReserveUSDT(uint96 _companyId) public view returns (uint256) {
        return getMonthlyBurnUSDT(_companyId) * _effectiveReserveMonths(_companyId);
    }

    /**
     * @notice Calculates what each active employee would receive if payEmployees() ran now.
     * @dev    Pure calculation — no state changes. Mirrors _payEmployeeUSDT logic exactly.
     *         Use this to show a confirmation preview in the UI before the user signs the tx.
     * @param _companyId The company to preview payroll for.
     * @return items       Per-employee breakdown (only active employees with amount > 0).
     * @return totalGross  Sum of all grossUSDT across employees.
     * @return totalFee    Sum of all protocol fees.
     * @return totalNet    Sum of all netUSDT employees will receive.
     */
    function previewPayroll(uint96 _companyId)
        external
        view
        returns (
            PayrollPreviewItem[] memory items,
            uint256 totalGross,
            uint256 totalFee,
            uint256 totalNet
        )
    {
        Employee[] storage employees = _getCompany(_companyId).employees;
        bool isDao = daoCompanyId > 0 && _companyId == daoCompanyId;

        // Single pass: fill into max-size buffer, then trim
        PayrollPreviewItem[] memory tmp = new PayrollPreviewItem[](employees.length);
        uint256 idx;
        for (uint256 i; i < employees.length; i++) {
            if (!employees[i].active) continue;
            uint256 gross = _calcEmployeeGross(employees[i]);
            if (gross == 0) continue;
            uint256 fee = isDao ? 0 : gross * nonWlfFeeBps / 10_000;
            uint256 net = gross - fee;
            tmp[idx++] = PayrollPreviewItem({
                employeeAddress: employees[i].employeeId,
                name:            employees[i].name,
                grossUSDT:       gross,
                fee:             fee,
                netUSDT:         net
            });
            totalGross += gross;
            totalFee   += fee;
            totalNet   += net;
        }
        items = new PayrollPreviewItem[](idx);
        for (uint256 i; i < idx; i++) items[i] = tmp[i];
    }

    ///////////////////////////////////////
    //         Internal Functions        //
    ///////////////////////////////////////

    /**
     * @dev Transfers `gross` USDT to `recipient` after deducting the protocol fee.
     *      DAO companies pay zero fee. Emits ProtocolFeePaid when a fee is taken.
     * @return net Amount received by the recipient after fee deduction.
     */
    function _disburseUSDT(uint96 companyId, address recipient, uint256 gross) private returns (uint256 net) {
        bool isDao = daoCompanyId > 0 && companyId == daoCompanyId;
        if (isDao) {
            IERC20(usdtAddress).transfer(recipient, gross);
            return gross;
        }
        uint256 fee = gross * nonWlfFeeBps / 10_000;
        net = gross - fee;
        if (fee > 0) IERC20(usdtAddress).transfer(treasuryAddress, fee);
        IERC20(usdtAddress).transfer(recipient, net);
        if (fee > 0) emit ProtocolFeePaid(companyId, usdtAddress, fee);
    }

    /// @dev Resolves employee storage from address + companyId, reverting if not a member.
    function _loadEmployee(address _employeeAddress, uint96 _companyId) internal view returns (Employee storage) {
        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        if (!empBrief.isMember) revert NotAuthorized();
        CompanyBrief memory compBrief = companyBrief[_companyId];
        return ownerToCompanies[compBrief.owner][compBrief.index].employees[empBrief.employeeIndex];
    }

    /// @dev Returns the total USDT gross owed to one employee right now (salary accrual + pending earnings).
    function _calcEmployeeGross(Employee storage emp) internal view returns (uint256 gross) {
        for (uint256 j; j < emp.salaryItems.length; j++) {
            gross += ((block.timestamp - emp.salaryItems[j].lastPayDate) * emp.salaryItems[j].salaryPerHour) / 1 hours;
        }
        for (uint256 j; j < emp.pendingEarnings.length; j++) {
            gross += emp.pendingEarnings[j].amount;
        }
    }

    function _hireEmployeeInternal(
        address _employeeAddress,
        string memory _name,
        uint96 _companyId,
        SalaryItem[] memory _salaryItems
    ) internal {
        CompanyStruct storage compPtr = _getCompany(_companyId);

        compPtr.employees.push();
        uint256 newEmpIdx = compPtr.employees.length - 1;
        Employee storage newEmp = compPtr.employees[newEmpIdx];

        newEmp.employeeId = _employeeAddress;
        newEmp.payableAddress = _employeeAddress;
        newEmp.name = _name;
        newEmp.companyId = _companyId;
        newEmp.hiredAt = block.timestamp;
        newEmp.active = true;

        for (uint256 i = 0; i < _salaryItems.length; i++) {
            newEmp.salaryItems.push(SalaryItem({
                role: _salaryItems[i].role,
                earningsType: _salaryItems[i].earningsType,
                salaryPerHour: _salaryItems[i].salaryPerHour,
                lastPayDate: block.timestamp
            }));
        }

        employeeBrief[_employeeAddress][_companyId] = EmployeeBrief(true, uint96(newEmpIdx));
        emit EmployeeHired(_employeeAddress);
    }

    /// @dev Returns the level of `_role` in `_roles`, or 0 if not found.
    function _findRoleLevel(string memory _role, RoleDefinition[] storage _roles) internal view returns (uint8) {
        bytes32 h = keccak256(abi.encodePacked(_role));
        for (uint256 i = 0; i < _roles.length; i++) {
            if (keccak256(abi.encodePacked(_roles[i].name)) == h) return _roles[i].level;
        }
        return 0;
    }

    /**
     * @dev Returns the effective authority level for `_caller` in `_companyId`.
     *      1 = owner (highest), 2 = operator, role-level for active employees, 0 = none.
     */
    function _getLevel(address _caller, uint96 _companyId) internal view returns (uint8) {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        if (_caller == compBrief.owner) return 1;

        CompanyStruct storage s_company = ownerToCompanies[compBrief.owner][compBrief.index];
        if (_caller == s_company.operatorAddress) return 2;

        EmployeeBrief memory empBrief = employeeBrief[_caller][_companyId];
        if (!empBrief.isMember) return 0;

        Employee storage emp = s_company.employees[empBrief.employeeIndex];
        if (!emp.active) return 0;

        // Minimum role level across all salary streams (lower number = higher authority)
        uint8 minLevel = type(uint8).max;
        for (uint256 i = 0; i < emp.salaryItems.length; i++) {
            uint8 lvl = _findRoleLevel(emp.salaryItems[i].role, s_company.roles);
            if (lvl > 0 && lvl < minLevel) minLevel = lvl;
        }
        return minLevel == type(uint8).max ? 0 : minLevel;
    }

    /**
     * @dev Checks whether `_caller` may perform an operation on `_target` in `_companyId`.
     *      STRICT:  callerLevel < targetLevel  (fire, update, addRole — must outrank target)
     *      LENIENT: callerLevel <= targetLevel (pay, submitEarning — same level is ok)
     *      Owner (level 1) can always operate on anyone.
     */
    function _canOperateOn(
        address _caller,
        address _target,
        uint96 _companyId,
        AuthRule _rule
    ) internal view returns (bool) {
        uint8 callerLevel = _getLevel(_caller, _companyId);
        if (callerLevel == 0) return false;
        if (callerLevel == 1) return true;

        uint8 targetLevel = _getLevel(_target, _companyId);
        return _rule == AuthRule.STRICT
            ? callerLevel < targetLevel
            : callerLevel <= targetLevel;
    }

    /// @dev Returns the effective reserve months for a company: per-company override or global fallback.
    function _effectiveReserveMonths(uint96 _companyId) internal view returns (uint256) {
        uint256 perCompany = companyReserveMonths[_companyId];
        return perCompany > 0 ? perCompany : minReserveMonths;
    }

    /// @dev Returns combined USDT + USDC balance (vault or mapping) for reserve checks.
    function _stableBalance(uint96 _companyId) internal view returns (uint256 total) {
        address v = companyVault[_companyId];
        if (v != address(0)) return IERC20(usdtAddress).balanceOf(v);
        total = companyTokenBalances[_companyId][usdtAddress];
        if (usdcAddress != address(0)) total += companyTokenBalances[_companyId][usdcAddress];
    }

    /// @dev Pulls `amount` of `token` from company funds (vault or mapping) into this contract.
    function _debitCompany(uint96 companyId, address token, uint256 amount) private {
        address v = companyVault[companyId];
        if (v != address(0)) { ICompanyVault(v).withdraw(token, amount, address(this)); return; }
        if (companyTokenBalances[companyId][token] < amount) revert BelowReserve();
        companyTokenBalances[companyId][token] -= amount;
    }

    /// @dev Reverts with CompanyNotFound if companyId is not registered.
    function _requireCompanyExists(uint96 companyId) private view {
        if (companyBrief[companyId].owner == address(0)) revert CompanyNotFound();
    }

    /// @dev Returns a storage pointer to the CompanyStruct for `companyId`. No existence check.
    function _getCompany(uint96 companyId) private view returns (CompanyStruct storage) {
        CompanyBrief memory b = companyBrief[companyId];
        return ownerToCompanies[b.owner][b.index];
    }


}


