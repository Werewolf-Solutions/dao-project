// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./Treasury.sol";
import "./WerewolfTokenV1.sol";
import "./DAO.sol";
import "./TokenSale.sol";

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

//for future use
import "./interfaces/ITreasury.sol";
import "./interfaces/IWerewolfTokenV1.sol";
import "./interfaces/IDAO.sol";
import "./interfaces/ITokenSale.sol";

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
     * @notice A single salary stream within an employee's compensation package.
     * @dev Salary is denominated in USDT with 6 decimal places (e.g., $500/month
     *      ≈ 684_931 USDT-wei per hour). USDT is sent directly from the company's
     *      internal balance at pay time.
     */
    struct SalaryItem {
        string role;
        uint256 salaryPerHour; // USDT 6-decimal wei per hour
        uint256 lastPayDate;
    }

    struct CreateCompany {
        string name;
        string industry;
        string domain;
        string[] roles;
        string[] powerRoles;
        address companyWallet; // dedicated ETH wallet the user controls (store private key separately)
        string ownerRole;      // role assigned to the creator (auto-added to roles[] if missing)
        uint256 ownerSalaryPerHour; // USDT 6-dec wei per hour for the creator's first salary stream
        string ownerName;
    }

    struct UpdateCompany {
        string name;
        string industry;
        string domain;
        string[] roles;
        string[] powerRoles;
        address companyWallet;
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
        address companyWallet;// slot 1
        string industry;      // slot 2
        string name;          // slot 3
        uint256 createdAt;    // slot 4
        bool active;          // slot 5
        Employee[] employees; // slot 6
        string domain;        // slot 7
        string[] roles;       // slot 8
        string[] powerRoles;  // slot 9
    }

    struct Employee {
        address employeeId;
        address payableAddress;
        string name;
        uint256 companyId;
        uint256 hiredAt;
        bool active;
        SalaryItem[] salaryItems; // all salary streams (one per role held)
    }

    struct CompanyBrief {
        address owner;
        uint96 index;
    }

    struct EmployeeBrief {
        bool isMember;
        uint96 employeeIndex;
    }

    ///////////////////////////////////////
    //           Custom Errors           //
    ///////////////////////////////////////

    error NotAdmin();
    error NotEmployee();
    error NoPowerRole();
    error CompanyNotFound();
    error NotOwner();
    error CompanyNotActive();
    error NotAuthorized();
    error NotMember();
    error EmployeeNotActive();
    error BelowReserve();
    error InsufficientFee();
    error TransferFailed();
    error NothingToPay();
    error InvalidSalaryIndex();
    error RoleNotFound();
    error InsufficientWLF();

    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////

    mapping(uint96 companyId => CompanyBrief) public companyBrief;
    mapping(address ownerAddress => CompanyStruct[]) public ownerToCompanies;
    mapping(address employee => mapping(uint96 companyId => EmployeeBrief))
        public employeeBrief;

    /// @notice Per-company ERC20 token balances held inside this contract
    mapping(uint96 companyId => mapping(address token => uint256)) public companyTokenBalances;

    WerewolfTokenV1 private werewolfToken;
    TokenSale public tokenSale;
    DAO public dao;
    Treasury public treasury;
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

    uint256[33] private __gap;

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

    ///////////////////////////////////////
    //           Modifiers               //
    ///////////////////////////////////////

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyRoleWithPower(uint96 _companyId) {
        EmployeeBrief memory empBrief = employeeBrief[msg.sender][_companyId];
        if (!empBrief.isMember) revert NotEmployee();

        CompanyBrief memory compBrief = companyBrief[_companyId];
        CompanyStruct storage s_company = ownerToCompanies[compBrief.owner][compBrief.index];
        SalaryItem[] storage items = s_company.employees[empBrief.employeeIndex].salaryItems;

        bool hasPower;
        uint256 powerRolesLen = s_company.powerRoles.length;
        for (uint256 i = 0; i < items.length && !hasPower; i++) {
            bytes32 roleHash = keccak256(abi.encodePacked(items[i].role));
            for (uint256 j = 0; j < powerRolesLen && !hasPower; j++) {
                if (keccak256(abi.encodePacked(s_company.powerRoles[j])) == roleHash) {
                    hasPower = true;
                }
            }
        }
        if (!hasPower) revert NoPowerRole();
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
        werewolfToken = WerewolfTokenV1(_token);
        dao = DAO(_daoAddress);
        tokenSale = TokenSale(payable(tokenSaleAddress));
        treasuryAddress = _treasuryAddress;
        treasury = Treasury(_treasuryAddress);
        usdtAddress = _usdtAddress;
        admin = _admin;
        swapRouter = _swapRouter;
        minReserveMonths = _minReserveMonths;
        creationFee = 10e18;
        currentCompanyIndex = 1;
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
        if (companyBrief[companyId].owner == address(0)) revert CompanyNotFound();
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        companyTokenBalances[companyId][token] += amount;
        emit CompanyFunded(companyId, token, amount);
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
        if (companyBrief[companyId].owner == address(0)) revert CompanyNotFound();
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

    /**
     * @notice Pays all active employees in a company in one transaction.
     * @dev Performs a single reserve check against the total batch amount before paying
     *      anyone, so the balance drawdown from earlier payments does not block later ones.
     */
    function payEmployees(uint96 _companyId) external whenNotPaused {
        if (companyBrief[_companyId].owner == address(0)) revert CompanyNotFound();
        CompanyBrief memory compBrief = companyBrief[_companyId];
        if (!_isAuthorized(msg.sender, _companyId)) revert NotAuthorized();

        Employee[] storage employees = ownerToCompanies[compBrief.owner][compBrief.index].employees;

        // ── 1. Sum total USDT owed across all active employees ───────────────
        uint256 totalUSDTAll;
        for (uint256 i = 0; i < employees.length; i++) {
            if (!employees[i].active) continue;
            for (uint256 j = 0; j < employees[i].salaryItems.length; j++) {
                uint256 payPeriod = block.timestamp - employees[i].salaryItems[j].lastPayDate;
                totalUSDTAll += (payPeriod * employees[i].salaryItems[j].salaryPerHour) / 1 hours;
            }
        }
        if (totalUSDTAll == 0) return;

        // ── 2. Single reserve check for the whole batch ──────────────────────
        uint256 minReserve = getMonthlyBurnUSDT(_companyId) * minReserveMonths;
        if (companyTokenBalances[_companyId][usdtAddress] < totalUSDTAll + minReserve) revert BelowReserve();

        // ── 3. Pay each employee (no per-employee reserve re-check) ─────────
        for (uint256 i = 0; i < employees.length; i++) {
            if (employees[i].active && _hasPendingPay(employees[i])) {
                _payEmployeeUSDT(employees[i], _companyId);
            }
        }
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
        compPtr.companyWallet = _params.companyWallet;
        compPtr.industry = _params.industry;
        compPtr.name = _params.name;
        compPtr.createdAt = block.timestamp;
        compPtr.active = true;
        compPtr.domain = _params.domain;
        compPtr.roles = _params.roles;
        compPtr.powerRoles = _params.powerRoles;

        // Auto-add ownerRole to roles[] if not already present
        bool ownerRoleFound;
        for (uint256 i = 0; i < _params.roles.length; i++) {
            if (keccak256(abi.encodePacked(_params.roles[i])) == keccak256(abi.encodePacked(_params.ownerRole))) {
                ownerRoleFound = true;
                break;
            }
        }
        if (!ownerRoleFound) {
            compPtr.roles.push(_params.ownerRole);
        }

        companyBrief[currentCompanyIndex] = CompanyBrief(msg.sender, uint96(nextCompIndex));

        // Hire the creator as the first employee
        SalaryItem[] memory ownerSalary = new SalaryItem[](1);
        ownerSalary[0] = SalaryItem({
            role: _params.ownerRole,
            salaryPerHour: _params.ownerSalaryPerHour,
            lastPayDate: block.timestamp
        });

        _hireEmployeeInternal(
            msg.sender,
            _params.ownerName,
            currentCompanyIndex,
            ownerSalary,
            uint96(nextCompIndex)
        );

        emit CompanyCreated(msg.sender, currentCompanyIndex);
        currentCompanyIndex += 1;
    }

    /**
     * @notice Soft-deletes a company (marks it inactive, clears the brief lookup).
     * @dev Uses soft delete to avoid storage issues with nested dynamic arrays.
     */
    function deleteCompany(uint96 _companyId) public {
        if (companyBrief[_companyId].owner != msg.sender) revert NotOwner();
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
     * @param _params New values for name, industry, domain, roles, powerRoles, companyWallet
     */
    function updateCompany(uint96 _companyId, UpdateCompany memory _params) public {
        if (companyBrief[_companyId].owner != msg.sender) revert NotOwner();
        uint96 idx = companyBrief[_companyId].index;
        CompanyStruct storage compPtr = ownerToCompanies[msg.sender][idx];
        if (!compPtr.active) revert CompanyNotActive();

        compPtr.name = _params.name;
        compPtr.industry = _params.industry;
        compPtr.domain = _params.domain;
        compPtr.companyWallet = _params.companyWallet;

        delete compPtr.roles;
        for (uint256 i = 0; i < _params.roles.length; i++) {
            compPtr.roles.push(_params.roles[i]);
        }

        delete compPtr.powerRoles;
        for (uint256 i = 0; i < _params.powerRoles.length; i++) {
            compPtr.powerRoles.push(_params.powerRoles[i]);
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
        UpdateEmployee memory _params
    ) public {
        if (!_isAuthorized(msg.sender, _companyId)) revert NotAuthorized();

        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        if (!empBrief.isMember) revert NotMember();

        CompanyBrief memory compBrief = companyBrief[_companyId];
        CompanyStruct storage s_company = ownerToCompanies[compBrief.owner][compBrief.index];
        Employee storage emp = s_company.employees[empBrief.employeeIndex];
        if (!emp.active) revert EmployeeNotActive();

        _validateSalaryItemRoles(_params.salaryItems, s_company.roles);

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
        CompanyBrief memory compBrief = companyBrief[_hireParams.companyId];
        if (!_isAuthorized(msg.sender, _hireParams.companyId)) revert NotAuthorized();

        CompanyStruct storage compPtr = ownerToCompanies[compBrief.owner][compBrief.index];
        _validateSalaryItemRoles(_hireParams.salaryItems, compPtr.roles);

        _hireEmployeeInternal(
            _hireParams.employeeAddress,
            _hireParams.name,
            _hireParams.companyId,
            _hireParams.salaryItems,
            compBrief.index
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
    ) public {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        if (!_isAuthorized(msg.sender, _companyId)) revert NotAuthorized();

        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        if (!empBrief.isMember) revert NotMember();

        CompanyStruct storage compPtr = ownerToCompanies[compBrief.owner][compBrief.index];
        _requireRoleExists(_item.role, compPtr.roles);

        Employee storage emp = compPtr.employees[empBrief.employeeIndex];
        emp.salaryItems.push(SalaryItem({
            role: _item.role,
            salaryPerHour: _item.salaryPerHour,
            lastPayDate: block.timestamp
        }));

        emit RoleAdded(_employeeAddress, _companyId, _item.role);
    }

    /**
     * @notice Soft-fires an employee (marks them inactive, clears their brief).
     */
    function fireEmployee(address _employeeAddress, uint96 _companyId) public {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        if (!_isAuthorized(msg.sender, _companyId)) revert NotAuthorized();

        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        if (!empBrief.isMember) revert NotMember();

        ownerToCompanies[compBrief.owner][compBrief.index].employees[empBrief.employeeIndex].active = false;
        delete employeeBrief[_employeeAddress][_companyId];

        emit EmployeeFired(_employeeAddress);
    }

    /**
     * @notice Pays all pending salary to an employee directly in USDT.
     * @dev The company must hold at least totalUSDT + (monthlyBurn × minReserveMonths) USDT
     *      after the payment. Salary is transferred directly from the company's internal
     *      USDT balance to the employee's payable address.
     *
     *      WLF payment option (direct or via Uniswap swap) is planned for a future version.
     *
     * @param _employeeAddress the employee to pay
     * @param _companyId company the employee belongs to
     */
    function payEmployee(address _employeeAddress, uint96 _companyId) public whenNotPaused {
        if (!_isAuthorized(msg.sender, _companyId)) revert NotAuthorized();

        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        if (!empBrief.isMember) revert NotMember();

        CompanyBrief memory compBrief = companyBrief[_companyId];
        Employee storage s_emp = ownerToCompanies[compBrief.owner][compBrief.index].employees[empBrief.employeeIndex];
        if (!s_emp.active) revert EmployeeNotActive();

        // ── 1. Checks ────────────────────────────────────────────────────────

        uint256 totalUSDT;
        for (uint256 i = 0; i < s_emp.salaryItems.length; i++) {
            uint256 payPeriod = block.timestamp - s_emp.salaryItems[i].lastPayDate;
            totalUSDT += (payPeriod * s_emp.salaryItems[i].salaryPerHour) / 1 hours;
        }
        if (totalUSDT == 0) revert NothingToPay();

        uint256 minReserve = getMonthlyBurnUSDT(_companyId) * minReserveMonths;
        if (companyTokenBalances[_companyId][usdtAddress] < totalUSDT + minReserve) revert BelowReserve();

        // ── 2+3. Effects + Interactions ───────────────────────────────────────

        _payEmployeeUSDT(s_emp, _companyId);
    }

    /**
     * @notice Pays an employee with a split of USDT and/or WLF from the company's internal balances.
     * @dev Either amount may be zero (pay entirely in one token). The USDT portion is subject to the
     *      minimum reserve check; the WLF portion only requires sufficient company WLF balance.
     *      Updates lastPayDate across all salary streams (same as payEmployee).
     * @param _employeeAddress the employee to pay
     * @param _companyId company the employee belongs to
     * @param _usdtAmount USDT (6 dec) to pay from company balance
     * @param _wlfToken WLF token address (ignored when _wlfAmount == 0)
     * @param _wlfAmount WLF (18 dec) to pay from company balance
     */
    function payEmployeeWithTokens(
        address _employeeAddress,
        uint96 _companyId,
        uint256 _usdtAmount,
        address _wlfToken,
        uint256 _wlfAmount
    ) public {
        if (!_isAuthorized(msg.sender, _companyId)) revert NotAuthorized();

        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        if (!empBrief.isMember) revert NotMember();

        CompanyBrief memory compBrief = companyBrief[_companyId];
        Employee storage s_emp = ownerToCompanies[compBrief.owner][compBrief.index].employees[empBrief.employeeIndex];
        if (!s_emp.active) revert EmployeeNotActive();
        if (_usdtAmount == 0 && _wlfAmount == 0) revert NothingToPay();

        // ── 1. Checks ────────────────────────────────────────────────────────
        if (_usdtAmount > 0) {
            uint256 minReserve = getMonthlyBurnUSDT(_companyId) * minReserveMonths;
            uint256 companyUsdtBal = companyTokenBalances[_companyId][usdtAddress];
            if (companyUsdtBal < _usdtAmount + minReserve) revert BelowReserve();
        }
        if (_wlfAmount > 0) {
            if (companyTokenBalances[_companyId][_wlfToken] < _wlfAmount) revert InsufficientWLF();
        }

        // ── 2. Effects ────────────────────────────────────────────────────────
        uint256 payTimestamp = block.timestamp;
        for (uint256 i = 0; i < s_emp.salaryItems.length; i++) {
            s_emp.salaryItems[i].lastPayDate = payTimestamp;
        }
        if (_usdtAmount > 0) companyTokenBalances[_companyId][usdtAddress] -= _usdtAmount;
        if (_wlfAmount > 0) companyTokenBalances[_companyId][_wlfToken] -= _wlfAmount;

        // ── 3. Interactions ───────────────────────────────────────────────────
        if (_usdtAmount > 0) IERC20(usdtAddress).transfer(s_emp.payableAddress, _usdtAmount);
        if (_wlfAmount > 0) IERC20(_wlfToken).transfer(s_emp.payableAddress, _wlfAmount);

        emit EmployeePaid(_employeeAddress, _usdtAmount);
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
    ) public {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        if (!_isAuthorized(msg.sender, _companyId)) revert NotAuthorized();

        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        if (!empBrief.isMember) revert NotMember();

        CompanyStruct storage s_company = ownerToCompanies[compBrief.owner][compBrief.index];
        _requireRoleExists(_newRole, s_company.roles);

        Employee storage emp = s_company.employees[empBrief.employeeIndex];
        if (_salaryItemIndex >= emp.salaryItems.length) revert InvalidSalaryIndex();
        emp.salaryItems[_salaryItemIndex].role = _newRole;
    }

    /**
     * @notice Returns all active company IDs owned by the given address.
     * @dev Use this to enumerate the caller's companies in the frontend.
     */
    function getOwnerCompanyIds(address _owner) public view returns (uint96[] memory) {
        CompanyStruct[] storage companies = ownerToCompanies[_owner];
        uint256 count;
        for (uint256 i = 0; i < companies.length; i++) {
            if (companies[i].active) count++;
        }
        uint96[] memory ids = new uint96[](count);
        uint256 idx;
        for (uint256 i = 0; i < companies.length; i++) {
            if (companies[i].active) ids[idx++] = companies[i].companyId;
        }
        return ids;
    }

    function retrieveCompany(uint96 _companyId) public view returns (CompanyStruct memory) {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        if (compBrief.owner == address(0)) revert CompanyNotFound();
        return ownerToCompanies[compBrief.owner][compBrief.index];
    }

    function retrieveEmployee(
        uint96 _companyId,
        address _employeeAddress
    ) public view returns (Employee memory) {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        if (!empBrief.isMember) revert NotMember();
        return ownerToCompanies[compBrief.owner][compBrief.index].employees[empBrief.employeeIndex];
    }

    /**
     * @notice Returns total USDT (6 dec) owed to all active employees right now.
     */
    function getTotalPendingUSDT(uint96 _companyId) public view returns (uint256 totalUSDT) {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        Employee[] storage employees = ownerToCompanies[compBrief.owner][compBrief.index].employees;
        for (uint256 i = 0; i < employees.length; i++) {
            if (!employees[i].active) continue;
            for (uint256 j = 0; j < employees[i].salaryItems.length; j++) {
                SalaryItem storage item = employees[i].salaryItems[j];
                totalUSDT += ((block.timestamp - item.lastPayDate) * item.salaryPerHour) / 1 hours;
            }
        }
    }

    /**
     * @notice Returns total monthly USDT payroll across all active employees.
     * @dev Assumes 730 hours per month (365 * 24 / 12).
     */
    function getMonthlyBurnUSDT(uint96 _companyId) public view returns (uint256 usdtPerMonth) {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        Employee[] storage employees = ownerToCompanies[compBrief.owner][compBrief.index].employees;
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
     * @notice Returns the minimum USDT reserve the company must always maintain.
     * @dev = monthlyBurn × minReserveMonths. Company balance must exceed this after every payment.
     */
    function getRequiredReserveUSDT(uint96 _companyId) public view returns (uint256) {
        return getMonthlyBurnUSDT(_companyId) * minReserveMonths;
    }

    ///////////////////////////////////////
    //         Internal Functions        //
    ///////////////////////////////////////

    function _hireEmployeeInternal(
        address _employeeAddress,
        string memory _name,
        uint96 _companyId,
        SalaryItem[] memory _salaryItems,
        uint96 _companyArrayIndex
    ) internal {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        CompanyStruct storage compPtr = ownerToCompanies[compBrief.owner][_companyArrayIndex];

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
                salaryPerHour: _salaryItems[i].salaryPerHour,
                lastPayDate: block.timestamp
            }));
        }

        employeeBrief[_employeeAddress][_companyId] = EmployeeBrief(true, uint96(newEmpIdx));
        emit EmployeeHired(_employeeAddress);
    }

    function _validateSalaryItemRoles(
        SalaryItem[] memory _items,
        string[] storage _roles
    ) internal view {
        for (uint256 si = 0; si < _items.length; si++) {
            _requireRoleExists(_items[si].role, _roles);
        }
    }

    function _requireRoleExists(string memory _role, string[] storage _roles) internal view {
        bool found;
        bytes32 roleHash = keccak256(abi.encodePacked(_role));
        for (uint256 i = 0; i < _roles.length; i++) {
            if (keccak256(abi.encodePacked(_roles[i])) == roleHash) {
                found = true;
                break;
            }
        }
        if (!found) revert RoleNotFound();
    }

    /**
     * @dev Transfers all pending USDT to an employee. No auth or reserve checks —
     *      callers are responsible for ensuring those invariants hold before calling.
     */
    function _payEmployeeUSDT(Employee storage s_emp, uint96 _companyId) internal {
        uint256 totalUSDT;
        uint256 payTimestamp = block.timestamp;
        for (uint256 i = 0; i < s_emp.salaryItems.length; i++) {
            totalUSDT += ((payTimestamp - s_emp.salaryItems[i].lastPayDate) * s_emp.salaryItems[i].salaryPerHour) / 1 hours;
            s_emp.salaryItems[i].lastPayDate = payTimestamp;
        }
        if (totalUSDT == 0) return;
        companyTokenBalances[_companyId][usdtAddress] -= totalUSDT;
        IERC20(usdtAddress).transfer(s_emp.payableAddress, totalUSDT);
        emit EmployeePaid(s_emp.employeeId, totalUSDT);
    }

    function _hasPendingPay(Employee storage _emp) internal view returns (bool) {
        for (uint256 i = 0; i < _emp.salaryItems.length; i++) {
            if (block.timestamp - _emp.salaryItems[i].lastPayDate >= 1 hours) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Returns true if _caller is authorized to manage the given company.
     * @dev Authorized callers: company owner, company wallet, or any active employee
     *      whose role is listed in the company's powerRoles[].
     */
    function _isAuthorized(address _caller, uint96 _companyId) internal view returns (bool) {
        CompanyBrief memory compBrief = companyBrief[_companyId];

        // Owner always authorized
        if (_caller == compBrief.owner) return true;

        CompanyStruct storage s_company = ownerToCompanies[compBrief.owner][compBrief.index];

        // Company wallet authorized (e.g., automated scripts using its private key)
        if (_caller == s_company.companyWallet) return true;

        // Active employee with a power role
        EmployeeBrief memory empBrief = employeeBrief[_caller][_companyId];
        if (!empBrief.isMember) return false;

        Employee storage emp = s_company.employees[empBrief.employeeIndex];
        if (!emp.active) return false;

        uint256 powerRolesLen = s_company.powerRoles.length;
        for (uint256 i = 0; i < emp.salaryItems.length; i++) {
            bytes32 roleHash = keccak256(abi.encodePacked(emp.salaryItems[i].role));
            for (uint256 j = 0; j < powerRolesLen; j++) {
                if (keccak256(abi.encodePacked(s_company.powerRoles[j])) == roleHash) {
                    return true;
                }
            }
        }
        return false;
    }
}
