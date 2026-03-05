// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

library CompaniesHouseV1 {
    struct CompanyStruct {
        uint96 companyId;
        address owner;
        string industry;
        string name;
        uint256 createdAt;
        bool active;
        Employee[] employees;
        string domain;
        string[] roles;
        string[] powerRoles;
    }

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

    struct HireEmployee {
        address employeeAddress;
        string name;
        string role;
        uint96 companyId;
        uint256 salary;
        string currency;
    }
}

interface ICompaniesHouseV1 {
    error AccessControlBadConfirmation();
    error AccessControlUnauthorizedAccount(address account, bytes32 neededRole);
    error InvalidInitialization();
    error NotInitializing();

    event CompanyCreated(address indexed owner, uint96 indexed companyIndex);
    event CompanyDeleted(address indexed owner, uint96 indexed companyIndex);
    event EmployeeFired(address indexed employee);
    event EmployeeHired(address indexed employee, uint256 salary);
    event EmployeePaid(address indexed employee, uint256 amount);
    event Initialized(uint64 version);
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
    function STAFF_ROLE() external view returns (bytes32);
    function companyBrief(uint96 companyId) external view returns (address owner, uint96 index);
    function createCompany(CompaniesHouseV1.CreateCompany memory _creationParams) external;
    function creationFee() external view returns (uint256);
    function currentCompanyIndex() external view returns (uint96);
    function dao() external view returns (address);
    function deleteCompany(uint96 _number) external;
    function deletedCompanies() external view returns (uint96);
    function employeeBrief(address employee, uint96 companyId)
        external
        view
        returns (bool isMember, uint96 employeeIndex);
    function fireEmployee(address _employeeAddress, uint96 _companyId) external;
    function getRoleAdmin(bytes32 role) external view returns (bytes32);
    function grantRole(bytes32 role, address account) external;
    function hasRole(bytes32 role, address account) external view returns (bool);
    function hireEmployee(CompaniesHouseV1.HireEmployee memory _hireParams) external;
    function initialize(address _token, address _treasuryAddress, address _daoAddress, address tokenSaleAddress)
        external;
    function ownerToCompanies(address ownerAddress, uint256)
        external
        view
        returns (
            uint96 companyId,
            address owner,
            string memory industry,
            string memory name,
            uint256 createdAt,
            bool active,
            string memory domain
        );
    function payEmployee(address _employeeAddress, uint96 _companyId) external;
    function renounceRole(bytes32 role, address callerConfirmation) external;
    function retrieveCompany(uint96 _companyId) external view returns (CompaniesHouseV1.CompanyStruct memory);
    function retrieveEmployee(uint96 _companyId, address _employeeAddress)
        external
        view
        returns (CompaniesHouseV1.Employee memory);
    function revokeRole(bytes32 role, address account) external;
    function setCompanyRole(address _employeeAddress, string memory _newRole, uint96 _companyId) external;
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
    function tokenSale() external view returns (address);
    function treasury() external view returns (address);
    function treasuryAddress() external view returns (address);
}
