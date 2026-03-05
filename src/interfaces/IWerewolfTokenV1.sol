// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface IWerewolfTokenV1 {
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);
    error ERC20InvalidApprover(address approver);
    error ERC20InvalidReceiver(address receiver);
    error ERC20InvalidSender(address sender);
    error ERC20InvalidSpender(address spender);
    error InvalidInitialization();
    error NotInitializing();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Transfer(address indexed from, address indexed to, uint256 value);

    function _authorizeCaller(address _caller) external;
    function _deauthorizeCaller(address _caller) external;
    function airdrop(address to, uint256 amount) external;
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function authorizedCallers(address) external view returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function checkpoints(address, uint32) external view returns (uint32 fromBlock, uint96 votes);
    function decimals() external view returns (uint8);
    function getPriorVotes(address account, uint256 blockNumber) external view returns (uint96);
    function initialize(address _owner, address _treasury, address _timelock, address _addr1, address _addr2)
        external;
    function mint(uint256 amount) external;
    function name() external view returns (string memory);
    function numCheckpoints(address) external view returns (uint32);
    function owner() external view returns (address);
    function payEmployee(address to, uint256 amount) external;
    function renounceOwnership() external;
    function setTreasury(address _treasury) external;
    function symbol() external view returns (string memory);
    function timelock() external view returns (address);
    function totalSupply() external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transferOwnership(address newOwner) external;
    function treasury() external view returns (address);
}
