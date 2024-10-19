// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./Treasury.sol";
import "./WerewolfTokenV1.sol";

contract CompanyHouseV1 is AccessControl {
    WerewolfTokenV1 private werewolfToken;
    // CompanyV1 creator;
    // address owner;
    // string name;

    bytes32 public constant STAFF_ROLE = keccak256("STAFF_ROLE");

    uint256 public index = 0; // Number of companies
    uint256 public employeesIndex = 0; // Number of employees in company
    uint256 public amountToPay = 10 * 10 ** 18; // Amount to pay to create a business
    uint256 public fee = 10;

    // Company Struct
    struct CompanyStruct {
        uint256 companyId;
        uint256 number;
        address owner;
        string industry;
        string name;
        uint256 createdAt;
        bool active;
        address[] employees;
    }

    CompanyStruct public company;
    CompanyStruct[] public companies;

    mapping(uint256 => CompanyStruct[]) public companiesByOwner;

    event CompanyCreated(CompanyStruct company); // Event
    event CompanyDeleted(CompanyStruct company); // Event

    struct Employee {
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

    mapping(address => Employee) private _employees;
    address private _treasuryAddress;
    address private _owner;

    event EmployeeHired(address indexed employee, uint256 salary);
    event EmployeeFired(address indexed employee);
    event EmployeePaid(address indexed employee, uint256 amount);

    constructor(address _token, address treasuryAddress) {
        werewolfToken = _token;
        _treasuryAddress = treasuryAddress;
        // _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // _setupRole(STAFF_ROLE, msg.sender);
    }

    function pay() public payable {
        require(msg.value == 0, "This function only accepts ERC20 tokens.");
        require(
            werewolfToken.transferFrom(msg.sender, address(this), amountToPay),
            "Transfer failed."
        );
    }

    function createCompany(
        string memory _name,
        string memory _industry
    ) public payable {
        require(
            werewolfToken.balanceOf(msg.sender) >= amountToPay + fee,
            "Token balance must be more than amount to pay."
        );
        // uint256 amountToSend = msg.value - fee;
        // _to.transfer(amountToSend);
        // owner.transfer(fee);
        // owner = msg.sender;

        // // We perform an explicit type conversion from `address`
        // // to `TokenCreator` and assume that the type of
        // // the calling contract is `TokenCreator`, there is
        // // no real way to verify that.
        // // This does not create a new contract.
        // creator = CompanyV1(msg.sender);
        // name = _name;
        address[] memory employees;
        CompanyStruct memory newCompany = CompanyStruct({
            companyId: index,
            number: index,
            owner: msg.sender,
            industry: _industry,
            name: _name,
            createdAt: block.timestamp,
            active: true,
            employees: employees
        });
        companies.push(newCompany);
        emit CompanyCreated(newCompany); // Triggering event
        index += 1;
        require(
            werewolfToken.transferFrom(msg.sender, address(this), amountToPay),
            "Transfer failed."
        );
    }

    function deleteCompany(uint256 _number) public {
        require(msg.sender == companies[_number].owner);
        delete companies[_number];
        emit CompanyDeleted(companies[_number]); // Triggering event
    }

    function retrieveCompany(
        uint256 _companyId
    ) public view returns (CompanyStruct memory) {
        return companies[_companyId];
    }

    function hireEmployee(
        address employeeAddress,
        string memory _name,
        string memory _role,
        uint256 _companyId,
        uint256 salary,
        string memory _currency
    ) public onlyRole(STAFF_ROLE) {
        Employee storage employee = _employees[employeeAddress];
        employee.salary = salary;
        employee.lastPayDate = block.timestamp;
        employee.employeeId = employeesIndex;
        employee.payableAddress = employeeAddress;
        employee.name = _name;
        employee.companyId = _companyId;
        employee.role = _role;
        employee.hiredAt = block.timestamp;
        employee.active = true;
        employee.currency = _currency;

        emit EmployeeHired(employeeAddress, salary);
        companies[_companyId].employees.push(employeeAddress);
        employeesIndex += 1;
    }

    function fireEmployee(
        address employeeAddress,
        // uint256 _employeeId,
        uint256 _companyId
    ) public onlyRole(STAFF_ROLE) {
        delete _employees[employeeAddress];

        emit EmployeeFired(employeeAddress);
        // remove employee from employees list
        // delete _employees[_employeeId];
        // Shift all elements to the left starting from index+1
        for (
            uint256 i = index;
            i < companies[_companyId].employees.length - 1;
            i++
        ) {
            companies[_companyId].employees[i] = companies[_companyId]
                .employees[i + 1];
        }

        // Remove the last element of the array
        companies[_companyId].employees.pop();
    }

    function payEmployee(address employeeAddress) public {
        Employee storage employee = _employees[employeeAddress];
        require(employee.salary > 0, "Employee not found");

        uint256 payPeriod = block.timestamp - employee.lastPayDate;
        uint256 payAmount = payPeriod * employee.salary;
        require(payAmount > 0, "Not enough time has passed to pay employee");

        Treasury treasury = Treasury(_treasuryAddress);
        //treasury.transferFunds(employeeAddress, payAmount);
        werewolfToken.payEmployee(employeeAddress, payAmount);

        employee.lastPayDate = block.timestamp;

        emit EmployeePaid(employeeAddress, payAmount);
    }

    function payEmployees(address[] memory employeesAddress) public {
        Treasury treasury = Treasury(_treasuryAddress);
        for (uint256 i = 0; i < _employees.length; i++) {
            Employee storage employee = _employees[i];
            require(employee.salary > 0, "Employee not found");

            uint256 payPeriod = block.timestamp - _employees[i].lastPayDate;
            uint256 payAmount = payPeriod * _employees[i].salary;
            require(
                werewolfToken.balanceOf(_treasuryAddress) > payAmount,
                "Treasury has not enough liquidity to pay employees."
            );
            require(_employees[i].salary > 0, "Employee not found");
            require(
                payAmount > 0,
                "Not enough time has passed to pay employee"
            );

            treasury.transferFunds(_employees[i].employeeAddress, payAmount);

            _employees[i].lastPayDate = block.timestamp;

            emit EmployeePaid(_employees[i].employeeAddress, payAmount);
        }
    }

    function hireContractor(address _contractor) public onlyRole(STAFF_ROLE) {
        // hire contractor
    }

    function setCompanyRole(address _employee) public onlyRole(STAFF_ROLE) {
        // set company role
    }

    function addCompanyRole(string memory _role) public onlyRole(STAFF_ROLE) {
        // add company role
    }
}
