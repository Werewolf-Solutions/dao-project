// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface ITreasury {
    error InvalidInitialization();
    error NotInitializing();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);

    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RewardsDistributed(address indexed caller, uint256 amount);

    function addAllowedToken(address _token) external;
    function allowedTokens(address) external view returns (bool);
    function distributeRewards() external;
    function initialize(address _owner) external;
    function isAboveThreshold() external view returns (bool);
    function isTokenAllowed(address _token) external view returns (bool);
    function owner() external view returns (address);
    function renounceOwnership() external;
    function setStakingContract(address _stakingAddress) external;
    function setThresholdPercentage(uint256 _percentage) external;
    function setWerewolfToken(address _token) external;
    function stakingContract() external view returns (address);
    function thresholdPercentage() external view returns (uint256);
    function transferOwnership(address newOwner) external;
}
