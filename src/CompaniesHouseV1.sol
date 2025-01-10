// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

//for future use
import "./interfaces/ITreasury.sol";
import "./interfaces/IWerewolfTokenV1.sol";
import "./interfaces/IDAO.sol";
import "./interfaces/ITokenSale.sol";

import "./Treasury.sol";
import "./WerewolfTokenV1.sol";
import "./DAO.sol";
import "./TokenSale.sol";

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

    struct CreateCompany {
        string name;
        string industry;
        string domain;
        string[] roles;
        string[] powerRoles;
        string ownerName;
        uint256 ownerSalary;
        string ownerCurrency;
    }

    struct HireEmployee {
        address employeeAddress;
        string name;
        string role;
        uint96 companyId;
        uint256 salary;
        string currency;
    }

    struct CompanyStruct {
        //relative storage locations:
        uint96 companyId; //slot0
        address owner; // slot0
        string industry; //slot1
        string name; //slot2
        uint256 createdAt; //slot3
        bool active; //slot4
        Employee[] employees; //slot5
        string domain; //slot6
        string[] roles; //slot7 TODO combine roles and powerRoles
        string[] powerRoles; //slot7
    }

    struct Employee {
        uint256 salary;
        uint256 lastPayDate;
        address employeeId;
        address payableAddress;
        string name;
        uint256 companyId;
        string role;
        uint256 hiredAt;
        bool active;
        string currency;
    }

    struct CompanyBrief {
        address owner;
        uint96 index;
    }

    struct EmployeeBrief {
        // leaving space in slot for future updates
        bool isMember;
        uint96 employeeIndex;
    }

    mapping(uint96 companyId => CompanyBrief) public companyBrief;
    mapping(address ownerAddress => CompanyStruct[]) public ownerToCompanies;
    mapping(address employee => mapping(uint96 companyId => EmployeeBrief)) public employeeBrief;

    //currently unused
    struct InventoryItem {
        uint256 salary;
        uint256 lastPayDate;
        uint256 employeeId;
        address payableAddress;
        string name;
        uint256 companyId;
        string role;
        uint256 hiredAt;
        bool active;
        string currency;
    }
    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////
    // TODO check to see if switching to interfaces saves gas

    WerewolfTokenV1 private werewolfToken;
    TokenSale public tokenSale;
    DAO public dao;
    Treasury public treasury;
    // CompanyV1 creator;
    // address owner;
    // string name;
    bytes32 public constant STAFF_ROLE = keccak256("CEO");
    uint96 public currentCompanyIndex; //index Number of companies
    uint96 public deletedCompanies;
    //uint256 public employeesIndex; // Number of employees in company <--- note remove this
    uint256 public creationFee; // Fee to create a business

    address public treasuryAddress;

    ///////////////////////////////////////
    //           Events                  //
    ///////////////////////////////////////
    event EmployeeHired(address indexed employee, uint256 salary);
    event EmployeeFired(address indexed employee);
    event EmployeePaid(address indexed employee, uint256 amount);
    event CompanyCreated(CompanyStruct company);
    event CompanyDeleted(CompanyStruct company);

    ///////////////////////////////////////
    //           Modifiers               //
    ///////////////////////////////////////
    modifier onlyRoleWithPower(uint96 _companyId) {
        // Ensure the caller is a member of the company
        EmployeeBrief memory empBrief = employeeBrief[msg.sender][_companyId];
        require(empBrief.isMember, "Not an employee of this company");

        CompanyBrief memory compBrief = companyBrief[_companyId];
        CompanyStruct storage s_companyPtr = ownerToCompanies[compBrief.owner][compBrief.index];
        // Check if the employee's role is in the powerRoles list
        uint256 cachedLength = s_companyPtr.powerRoles.length;
        string memory employeeRoleCached = s_companyPtr.employees[empBrief.employeeIndex].role;
        bool hasPower;
        for (uint256 i = 0; i < cachedLength; i++) {
            if (
                keccak256(abi.encodePacked(s_companyPtr.powerRoles[i])) //mh need to make sure no company has id of 0
                    == keccak256(abi.encodePacked(employeeRoleCached))
            ) {
                hasPower = true;
                break;
            }
        }
        require(hasPower, "You do not have a power role in this company.");
        _;
    }
    ///////////////////////////////////////
    //      Constructor/Initializer      //
    ///////////////////////////////////////

    constructor() {
        //disable the implementation contracts initializer
        _disableInitializers();
    }

    /**
     * @notice Initializes the proxy's storage
     * @dev
     * @param _token address of the Wereworlf token
     * @param _treasuryAddress address where all the funds and fees will be stored
     * @param _daoAddress privileged address
     * @param tokenSaleAddress the address that will handle the token sale
     */
    function initialize(address _token, address _treasuryAddress, address _daoAddress, address tokenSaleAddress)
        public
        initializer
    {
        werewolfToken = WerewolfTokenV1(_token);
        dao = DAO(_daoAddress);
        tokenSale = TokenSale(tokenSaleAddress);
        treasury = Treasury(treasuryAddress);
        treasuryAddress = _treasuryAddress;

        creationFee = 10e18;
        // the index and id for the next newly created company
        currentCompanyIndex = 1; //initalizing it to 1 to avoid bugs and exploits

        //TODO
        //setup roles logic
        // _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // _setupRole(STAFF_ROLE, msg.sender);
    }

    ///////////////////////////////////////
    //           Public Functions        //
    ///////////////////////////////////////

    /**
     * @notice Allow users to create a business
     * @param _creationParams is a CreateCompany struct with company creation details
     */
    function createCompany(CreateCompany memory _creationParams) public {
        require(werewolfToken.balanceOf(msg.sender) >= creationFee, "Token balance must be more than amount to pay.");
        require(werewolfToken.transferFrom(msg.sender, address(this), creationFee), "Transfer failed."); // question Should the fee be transfer to this address??
        //note probably need to add some checks on the params
        //uint96 ownerCurrentCompanyIndex = uint96(ownerToCompanies[msg.sender].length);

        //trying to avoid compiling via-ir
        uint256 ownedCompLength = ownerToCompanies[msg.sender].length; //this can be zero
        uint256 nextCompIndex;
        if (ownedCompLength == 0) {
            //do nothing and leave nextCompIndex = 0
        } else {
            nextCompIndex = ownerToCompanies[msg.sender].length - 1;
        }
        CompanyStruct storage compPtr = ownerToCompanies[msg.sender][nextCompIndex];

        {
            compPtr.companyId = currentCompanyIndex;
            compPtr.owner = msg.sender;
            compPtr.industry = _creationParams.industry;
            compPtr.name = _creationParams.name;
            compPtr.createdAt = block.timestamp;
            compPtr.active = true;
            compPtr.domain = _creationParams.domain;
            compPtr.roles = _creationParams.roles;
            compPtr.powerRoles = _creationParams.powerRoles;
        }

        //The below logic requires compiling via-ir
        /*   Employee[] memory employeesArray;
        ownerToCompanies[msg.sender].push(
            CompanyStruct(
                currentCompanyIndex,
                msg.sender,
                _creationParams.industry,
                _creationParams.name,
                block.timestamp,
                true,
                employeesArray,
                _creationParams.domain,
                _creationParams.roles,
                _creationParams.powerRoles
            )
        ); */

        companyBrief[currentCompanyIndex] = CompanyBrief(msg.sender, uint96(nextCompIndex));

        //now add the owner as an employee of the company
        /*TODO
        Call the hire employee function to hire the owner as an employee 
        */

        //increment the number of created companies
        currentCompanyIndex += 1;

        //emit CompanyCreated(newCompany); // Triggering event
    }

    function deleteCompany(uint96 _number) public {
        require(companyBrief[_number].owner == msg.sender, "CompaniesHouse::deleteCompany not owner");
        uint96 companyIndex = companyBrief[_number].index;
        uint256 companyLength = ownerToCompanies[msg.sender].length;
        if ((companyLength - 1) == (uint256(companyIndex))) {
            ownerToCompanies[msg.sender].pop();
        } else {
            //get the id of the last company in the array
            uint96 lastCompanyId = ownerToCompanies[msg.sender][companyLength - 1].companyId;
            // overwrite the deleted company with the last company in the array
            ownerToCompanies[msg.sender][_number] = ownerToCompanies[msg.sender][companyLength - 1];
            // delete company brief
            delete companyBrief[_number];
            //update the companyBrief of the
            companyBrief[lastCompanyId].index = _number;
        }
        //update the deleted companies to keep a count on the active companies
        deletedCompanies++;
        //emit CompanyDeleted(companies[_number]);
    }

    function hireEmployee(HireEmployee memory _hireParams) public /* onlyRoleWithPower(_companyId) */ {
        CompanyBrief memory compBrief = companyBrief[_hireParams.companyId]; //cache the owner and index
        require(msg.sender == compBrief.owner, "Only owner of the company can hire employee");
        bool roleExists; // Flag to check if role exists

        CompanyStruct storage compPtr = ownerToCompanies[compBrief.owner][compBrief.index];
        uint256 cachedLength = compPtr.roles.length; //caching the length to avoid SLOAD's
        //note might change the roles from an array to a mapping to avoid looping through an array and wasting gas
        //See if the new employee's role exists within the company
        for (uint256 i = 0; i < cachedLength; i++) {
            if (
                keccak256(abi.encodePacked(compPtr.roles[i])) //question might need []
                    == keccak256(abi.encodePacked(_hireParams.role))
            ) {
                roleExists = true;
                break;
            }
        }

        require(roleExists, "Role is not present in company's roles.");
        compPtr.employees.push(
            Employee(
                _hireParams.salary,
                block.timestamp,
                _hireParams.employeeAddress,
                _hireParams.employeeAddress,
                _hireParams.name,
                _hireParams.companyId,
                _hireParams.role,
                block.timestamp,
                true,
                _hireParams.currency
            )
        );
        uint96 currentNumEmployees = uint96(compPtr.employees.length - 1);
        //update employee quick access storage
        employeeBrief[_hireParams.employeeAddress][_hireParams.companyId] = EmployeeBrief(true, currentNumEmployees);

        emit EmployeeHired(_hireParams.employeeAddress, _hireParams.salary);
    }
    /**
     * @notice This removes an employee from a company
     * @dev The employeeAddreess is used as an ID, but the payable address can be different than their ID
     */

    function fireEmployee(address _employeeAddress, uint96 _companyId) public {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        require(compBrief.owner == msg.sender, "CompaniesHouse:fireEmployee not owner");
        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        require(empBrief.isMember, "CompaniesHouse:fireEmployee not a member");

        Employee[] storage s_employeesPtr = ownerToCompanies[compBrief.owner][compBrief.index].employees;

        uint96 numEmployees = uint96(s_employeesPtr.length - 1);

        address lastEmployee;
        if (empBrief.employeeIndex == numEmployees) {
            s_employeesPtr.pop();
        } else {
            lastEmployee = s_employeesPtr[numEmployees].employeeId;
            s_employeesPtr[empBrief.employeeIndex] = s_employeesPtr[numEmployees];
            s_employeesPtr.pop();

            //update the employeeBrief mapping for the last employee
            employeeBrief[lastEmployee][_companyId].employeeIndex = empBrief.employeeIndex;
        }

        //delete the employeeBrief mapping for the fired employee
        delete employeeBrief[_employeeAddress][_companyId];

        emit EmployeeFired(_employeeAddress);
    }

    function payEmployee(address _employeeAddress, uint96 _companyId) public {
        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        require(empBrief.isMember, "CompaniesHouse:payEmployee Employee not found");

        CompanyBrief memory compBrief = companyBrief[_companyId];

        Employee storage s_employee =
            ownerToCompanies[compBrief.owner][compBrief.index].employees[empBrief.employeeIndex];

        uint256 payPeriod = block.timestamp - s_employee.lastPayDate;
        uint256 payAmount = payPeriod * s_employee.salary;
        require(payAmount > 0, "Not enough time has passed to pay employee");

        werewolfToken.payEmployee(_employeeAddress, payAmount);

        s_employee.lastPayDate = block.timestamp;

        emit EmployeePaid(_employeeAddress, payAmount);
    }

    /*    function payEmployees(uint256 _companyId) public {
        CompanyStruct storage _company = companies[_companyId];
        // Treasury treasury = Treasury(_treasuryAddress);

        // Check if treasury has enough balance to pay all employees
        uint256 totalPayAmount = 0;
        for (uint256 i = 0; i < _company.employees.length; i++) {
            address employeeAddress = _company.employees[i];
            Employee storage employee = _employees[employeeAddress];

            require(employee.salary > 0, "Employee not found");
            require(employee.active, "Employee not active");

            uint256 payPeriod = block.timestamp - employee.lastPayDate;

            uint256 price = tokenSale.price();
            require(price > 0, "Price cannot be zero");

            // Scale up the result by 1e18 for precision, assuming price and salary are compatible with this scale
            uint256 payAmount = (payPeriod * employee.salary * 1e18) / price;
            totalPayAmount += payAmount;
        }

        uint256 threshold = ((werewolfToken.balanceOf(_treasuryAddress) * treasury.thresholdPercentage()) / 100);

        uint256 treasuryBalance = werewolfToken.balanceOf(_treasuryAddress);

        require(totalPayAmount < threshold, "Treasury has insufficient liquidity to pay employees.");

        require(treasuryBalance > threshold, "Treasury has insufficient liquidity to pay employees.");

        // require(
        //     treasury.isAboveThreshold(),
        //     "Treasury has insufficient liquidity to pay employees."
        // );

        for (uint256 i = 0; i < _company.employees.length; i++) {
            address employeeAddress = _company.employees[i];
            Employee storage employee = _employees[employeeAddress];

            require(employee.salary > 0, "Employee not found");
            require(employee.active, "Employee not active");

            uint256 payPeriod = block.timestamp - employee.lastPayDate;

            uint256 price = tokenSale.price();
            require(price > 0, "Price cannot be zero");

            // Scale up the result by 1e18 for precision, assuming price and salary are compatible with this scale
            uint256 payAmount = (payPeriod * employee.salary * 1e18) / price;

            require(payAmount > 0, "Pay amount must be more then 0.");

            require(payPeriod > 0, "Not enough time has passed to pay employee");

            // Call the payEmployee function through the DAO contract
            werewolfToken.payEmployee(employeeAddress, payAmount);
            // Update the employee's last pay date
            employee.lastPayDate = block.timestamp;

            // Emit the EmployeePaid event
            emit EmployeePaid(employeeAddress, payAmount);
        }
    } */

    function setCompanyRole(address _employeeAddress, string memory _newRole, uint96 _companyId) public {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        require(compBrief.owner == msg.sender, "CompaniesHouse:SetCompantRole not owner");
        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        require(empBrief.isMember, "COmpaniesHouse:setCompanyRole not member");

        CompanyStruct storage s_companyPtr = ownerToCompanies[compBrief.owner][compBrief.index];
        uint256 rolesLength = s_companyPtr.roles.length; //cache length to avoid SLOAD's
        bool roleExists; // Flag to check if role exists
        for (uint256 i = 0; i < rolesLength; i++) {
            if (keccak256(abi.encodePacked(s_companyPtr.roles[i])) == keccak256(abi.encodePacked(_newRole))) {
                roleExists = true;
                break;
            }
        }
        require(roleExists, "CompaniesHouse:setCompanyRole role does not exist");
        s_companyPtr.employees[empBrief.employeeIndex].role = _newRole;
        //TODO emit an event for updateed role
    }

    /* function addCompanyRole(uint256 _companyId, string memory _newRole) public onlyRoleWithPower(_companyId) {
        companies[_companyId].roles.push(_newRole);
    } */

    function retrieveCompany(uint96 _companyId) public view returns (CompanyStruct memory) {
        CompanyBrief memory compBrief = companyBrief[_companyId];
        require(compBrief.owner != address(0), "CompaniesHouse:retrieveCompany company not found");
        return ownerToCompanies[compBrief.owner][compBrief.index];
    }

    function retrieveEmployee(uint96 _companyId, address _employeeAddress) public view returns (Employee memory) {
        // Ensure that only the owner of the company can retrieve employee details
        CompanyBrief memory compBrief = companyBrief[_companyId];
        //require(compOwner == msg.sender, "CompaniesHouse:retrieveEmployee not owner");
        EmployeeBrief memory empBrief = employeeBrief[_employeeAddress][_companyId];
        require(empBrief.isMember, "CompaniesHouse:retrieveEmployee not member");

        return ownerToCompanies[compBrief.owner][compBrief.index].employees[empBrief.employeeIndex];
    }
}
