// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./Treasury.sol";
import "./WerewolfTokenV1.sol";
import "./DAO.sol";
import "./TokenSale.sol";

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

contract CompaniesHouseV1 is AccessControlUpgradeable {
    ///////////////////////////////////////
    //           Data Types              //
    ///////////////////////////////////////

    /**
     * @notice A single salary stream within an employee's compensation package.
     * @dev Salary is denominated in USDT with 6 decimal places (e.g., $500/month
     *      ≈ 684_931 USDT-wei per hour). WLF amount is computed at pay time using
     *      the TokenSale price, so the WLF payout automatically adjusts as price moves.
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
    //           State Variables         //
    ///////////////////////////////////////

    mapping(uint96 companyId => CompanyBrief) public companyBrief;
    mapping(address ownerAddress => CompanyStruct[]) public ownerToCompanies;
    mapping(address employee => mapping(uint96 companyId => EmployeeBrief))
        public employeeBrief;

    WerewolfTokenV1 private werewolfToken;
    TokenSale public tokenSale;
    DAO public dao;
    Treasury public treasury;
    bytes32 public constant STAFF_ROLE = keccak256("CEO");
    uint96 public currentCompanyIndex;
    uint96 public deletedCompanies;
    uint256 public creationFee;
    address public treasuryAddress;

    ///////////////////////////////////////
    //           Events                  //
    ///////////////////////////////////////
    event EmployeeHired(address indexed employee);
    event EmployeeFired(address indexed employee);
    event EmployeePaid(address indexed employee, uint256 wlfAmount);
    event RoleAdded(address indexed employee, uint96 indexed companyId, string role);
    event CompanyCreated(address indexed owner, uint96 indexed companyId);
    event CompanyDeleted(address indexed owner, uint96 indexed companyId);

    ///////////////////////////////////////
    //           Modifiers               //
    ///////////////////////////////////////
    modifier onlyRoleWithPower(uint96 _companyId) {
        EmployeeBrief memory empBrief = employeeBrief[msg.sender][_companyId];
        require(empBrief.isMember, "Not an employee of this company");

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
        require(hasPower, "You do not have a power role in this company.");
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
     */
    function initialize(
        address _token,
        address _treasuryAddress,
        address _daoAddress,
        address tokenSaleAddress
    ) public initializer {
        werewolfToken = WerewolfTokenV1(_token);
        dao = DAO(_daoAddress);
        tokenSale = TokenSale(payable(tokenSaleAddress));
        treasuryAddress = _treasuryAddress;      // assign first (Bug 1 fix)
        treasury = Treasury(_treasuryAddress);   // then use the assigned value

        creationFee = 10e18;
        currentCompanyIndex = 1;
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
    function createCompany(CreateCompany memory _params) public {
        require(
            werewolfToken.balanceOf(msg.sender) >= creationFee,
            "Token balance must be more than creation fee."
        );
        require(
            werewolfToken.transferFrom(msg.sender, treasuryAddress, creationFee),
            "Transfer failed."
        );

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
        require(
            companyBrief[_companyId].owner == msg.sender,
            "CompaniesHouse::deleteCompany not owner"
        );
        uint96 companyIndex = companyBrief[_companyId].index;
        ownerToCompanies[msg.sender][companyIndex].active = false;
        delete companyBrief[_companyId];
        deletedCompanies++;
        emit CompanyDeleted(msg.sender, _companyId);
    }

    /**
     * @notice Hires a new employee into a company.
     * @dev All roles in salaryItems must exist in the company's roles[]. Each salary
     *      item represents a separate role + pay stream (e.g., CTO at $300/mo, HR at $200/mo).
     */
    function hireEmployee(HireEmployee memory _hireParams) public {
        CompanyBrief memory compBrief = companyBrief[_hireParams.companyId];
        require(msg.sender == compBrief.owner, "Only owner of the company can hire employee");

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
        require(compBrief.owner == msg.sender, "CompaniesHouse:addRoleToEmployee not owner");

        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        require(empBrief.isMember, "CompaniesHouse:addRoleToEmployee not a member");

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
        require(compBrief.owner == msg.sender, "CompaniesHouse:fireEmployee not owner");

        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        require(empBrief.isMember, "CompaniesHouse:fireEmployee not a member");

        ownerToCompanies[compBrief.owner][compBrief.index].employees[empBrief.employeeIndex].active = false;
        delete employeeBrief[_employeeAddress][_companyId];

        emit EmployeeFired(_employeeAddress);
    }

    /**
     * @notice Pays all pending salary to an employee across all their salary streams.
     * @dev Salary is denominated in USDT; WLF amount is calculated at pay time using
     *      tokenSale.price(). Formula: wlf = usdt_6dec * 10^30 / price_18dec.
     *      Anyone can trigger payment — the WLF goes to the employee's payableAddress.
     */
    function payEmployee(address _employeeAddress, uint96 _companyId) public {
        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        require(empBrief.isMember, "CompaniesHouse:payEmployee Employee not found");

        CompanyBrief memory compBrief = companyBrief[_companyId];
        Employee storage s_emp = ownerToCompanies[compBrief.owner][compBrief.index].employees[empBrief.employeeIndex];
        require(s_emp.active, "CompaniesHouse:payEmployee Employee not active");

        uint256 wlfPrice = tokenSale.price();
        require(wlfPrice > 0, "WLF price is zero");

        uint256 totalWLF;
        for (uint256 i = 0; i < s_emp.salaryItems.length; i++) {
            SalaryItem storage item = s_emp.salaryItems[i];
            uint256 payPeriod = block.timestamp - item.lastPayDate;
            uint256 usdtAmount = (payPeriod * item.salaryPerHour) / 1 hours;
            if (usdtAmount > 0) {
                // Convert USDT (6 dec) to WLF (18 dec):
                // wlf_18dec = usdt_6dec * 10^30 / price_18dec
                // where price_18dec = actual_usdt_per_wlf * 10^18
                totalWLF += (usdtAmount * 10 ** 30) / wlfPrice;
                item.lastPayDate = block.timestamp;
            }
        }

        require(totalWLF > 0, "Nothing to pay yet");
        werewolfToken.payEmployee(s_emp.payableAddress, totalWLF);
        emit EmployeePaid(_employeeAddress, totalWLF);
    }

    /**
     * @notice Pays all active employees in a company in one transaction.
     */
    function payEmployees(uint96 _companyId) external {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        require(compBrief.owner == msg.sender, "CompaniesHouse:payEmployees not owner");

        Employee[] storage employees = ownerToCompanies[compBrief.owner][compBrief.index].employees;
        for (uint256 i = 0; i < employees.length; i++) {
            if (employees[i].active) {
                // Skip if nothing owed (avoids revert in payEmployee)
                bool hasBalance = _hasPendingPay(employees[i]);
                if (hasBalance) {
                    payEmployee(employees[i].employeeId, _companyId);
                }
            }
        }
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
        require(compBrief.owner == msg.sender, "CompaniesHouse:setCompanyRole not owner");

        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        require(empBrief.isMember, "CompaniesHouse:setCompanyRole not member");

        CompanyStruct storage s_company = ownerToCompanies[compBrief.owner][compBrief.index];
        _requireRoleExists(_newRole, s_company.roles);

        Employee storage emp = s_company.employees[empBrief.employeeIndex];
        require(_salaryItemIndex < emp.salaryItems.length, "Invalid salary item index");
        emp.salaryItems[_salaryItemIndex].role = _newRole;
    }

    function retrieveCompany(uint96 _companyId) public view returns (CompanyStruct memory) {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        require(compBrief.owner != address(0), "CompaniesHouse:retrieveCompany company not found");
        return ownerToCompanies[compBrief.owner][compBrief.index];
    }

    function retrieveEmployee(
        uint96 _companyId,
        address _employeeAddress
    ) public view returns (Employee memory) {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        require(empBrief.isMember, "CompaniesHouse:retrieveEmployee not member");
        return ownerToCompanies[compBrief.owner][compBrief.index].employees[empBrief.employeeIndex];
    }

    /**
     * @notice Returns total WLF owed to all active employees right now.
     * @dev Used by the frontend "Safe to Sell" feature to estimate pool price impact.
     */
    function getTotalPendingPay(uint96 _companyId) public view returns (uint256 totalWLF) {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        Employee[] storage employees = ownerToCompanies[compBrief.owner][compBrief.index].employees;
        uint256 wlfPrice = tokenSale.price();
        if (wlfPrice == 0) return 0;

        for (uint256 i = 0; i < employees.length; i++) {
            if (!employees[i].active) continue;
            for (uint256 j = 0; j < employees[i].salaryItems.length; j++) {
                SalaryItem storage item = employees[i].salaryItems[j];
                uint256 usdtAmount = ((block.timestamp - item.lastPayDate) * item.salaryPerHour) / 1 hours;
                if (usdtAmount > 0) {
                    totalWLF += (usdtAmount * 10 ** 30) / wlfPrice;
                }
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
     * @notice Returns WLF needed in treasury to sustain 5 years of payroll at current WLF price.
     * @dev As WLF price increases, fewer tokens are needed. Use as a minimum treasury target.
     */
    function getRequiredFor5Years(uint96 _companyId) public view returns (uint256 wlfRequired) {
        uint256 usdtNeeded = getMonthlyBurnUSDT(_companyId) * 60; // 60 months
        uint256 wlfPrice = tokenSale.price();
        if (wlfPrice == 0 || usdtNeeded == 0) return 0;
        wlfRequired = (usdtNeeded * 10 ** 30) / wlfPrice;
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
        require(found, "Role is not present in company's roles.");
    }

    function _hasPendingPay(Employee storage _emp) internal view returns (bool) {
        for (uint256 i = 0; i < _emp.salaryItems.length; i++) {
            if (block.timestamp - _emp.salaryItems[i].lastPayDate >= 1 hours) {
                return true;
            }
        }
        return false;
    }
}
