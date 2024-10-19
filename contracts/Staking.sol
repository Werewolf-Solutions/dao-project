// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Staking {
    address public owner;
    uint256 public stakedBalance;
    uint256 public stakingRewards;
    uint256 public stakingDuration;
    uint256 public stakingStart;
    IERC20 public stakingToken;
    mapping(address => uint256) public stakedTokens;
    mapping(address => uint256) public lastStakeTime;

    constructor(address _stakingToken, uint256 _stakingDuration) {
        owner = msg.sender;
        stakingToken = IERC20(_stakingToken);
        stakingDuration = _stakingDuration;
    }

    function stakeTokens(uint256 _amount) external {
        require(
            stakingToken.allowance(msg.sender, address(this)) >= _amount,
            "Allowance not sufficient"
        );
        require(
            stakingToken.transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );
        if (stakedTokens[msg.sender] == 0) {
            lastStakeTime[msg.sender] = block.timestamp;
        }
        stakedTokens[msg.sender] += _amount;
        stakedBalance += _amount;
    }

    function withdrawTokens() external {
        uint256 stakedAmount = stakedTokens[msg.sender];
        require(stakedAmount > 0, "No tokens staked");
        require(
            block.timestamp >= lastStakeTime[msg.sender] + stakingDuration,
            "Tokens are still locked"
        );
        uint256 reward = calculateReward(msg.sender);
        stakingRewards -= reward;
        stakedTokens[msg.sender] = 0;
        stakedBalance -= stakedAmount;
        require(
            stakingToken.transfer(msg.sender, stakedAmount + reward),
            "Transfer failed"
        );
    }

    function calculateReward(address _staker) public view returns (uint256) {
        uint256 stakedAmount = stakedTokens[_staker];
        uint256 reward = (stakedAmount *
            (block.timestamp - lastStakeTime[_staker]) *
            10) / stakingDuration;
        return reward;
    }

    function collectRewards() external {
        uint256 reward = calculateReward(msg.sender);
        stakingRewards -= reward;
        require(stakingToken.transfer(msg.sender, reward), "Transfer failed");
    }

    function setStakingDuration(uint256 _stakingDuration) external {
        require(msg.sender == owner, "Not authorized");
        stakingDuration = _stakingDuration;
    }

    function addStakingRewards(uint256 _amount) external {
        require(msg.sender == owner, "Not authorized");
        require(
            stakingToken.allowance(msg.sender, address(this)) >= _amount,
            "Allowance not sufficient"
        );
        require(
            stakingToken.transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );
        stakingRewards += _amount;
    }

    function getStakedTokens() external view returns (uint256) {
        return stakedTokens[msg.sender];
    }

    function getLastStakeTime() external view returns (uint256) {
        return lastStakeTime[msg.sender];
    }
}
