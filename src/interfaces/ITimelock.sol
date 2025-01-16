// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface ITimelock {
    error InvalidInitialization();
    error NotInitializing();

    event CancelTransaction(bytes32 indexed txHash, address indexed target, string signature, bytes data, uint256 eta);
    event ExecuteTransaction(bytes32 indexed txHash, address indexed target, string signature, bytes data, uint256 eta);
    event Initialized(uint64 version);
    event NewAdmin(address indexed newAdmin);
    event NewDelay(uint256 indexed newDelay);
    event NewPendingAdmin(address indexed newPendingAdmin);
    event QueueTransaction(bytes32 indexed txHash, address indexed target, string signature, bytes data, uint256 eta);

    function GRACE_PERIOD() external view returns (uint256);
    function MAXIMUM_DELAY() external view returns (uint256);
    function MINIMUM_DELAY() external view returns (uint256);
    function acceptAdmin() external;
    function admin() external view returns (address);
    function cancelTransaction(address target, string memory signature, bytes memory data, uint256 eta) external;
    function delay() external view returns (uint256);
    function executeTransaction(address target, string memory signature, bytes memory data, uint256 eta)
        external
        payable
        returns (bytes memory);
    function initialize(address _admin, uint256 _delay) external;
    function pendingAdmin() external view returns (address);
    function queueTransaction(address target, string memory signature, bytes memory data, uint256 eta)
        external
        returns (bytes32);
    function queuedTransactions(bytes32) external view returns (bool);
    function setDelay(uint256 delay_) external;
    function setPendingAdmin(address pendingAdmin_) external;
}
