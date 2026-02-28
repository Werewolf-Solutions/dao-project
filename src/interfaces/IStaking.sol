// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface IStaking {
    error InvalidInitialization();
    error NotInitializing();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);

    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RewardsAdded(uint256 amount);
    event TokensStaked(address indexed staker, uint256 amount, uint256 duration);
    event TokensWithdrawn(address indexed staker, uint256 amount, uint256 reward);

    function addStakingRewards(uint256 _amount) external;
    function calculateReward(address _staker) external view returns (uint256);
    function getEndStakeTime(address _user) external view returns (uint256);
    function getLastStakeTime(address _user) external view returns (uint256);
    function getStakedTokens(address _user) external view returns (uint256);
    function initialize(address _stakingToken, address _timelock) external;
    function owner() external view returns (address);
    function renounceOwnership() external;
    function stakeFixedDuration(address _owner, uint256 _amount, uint256 _duration) external;
    function stakeFlexibleDuration(address _owner, uint256 _amount) external;
    function stakedBalance() external view returns (uint256);
    function getStakedWLF(address user) external view returns (uint256);
    function stakes(address) external view returns (uint256 amount, uint256 lastStakeTime, uint256 endStakeTime);
    function stakingRewards() external view returns (uint256);
    function stakingToken() external view returns (address);
    function transferOwnership(address newOwner) external;
    function withdrawTokens() external;
}
