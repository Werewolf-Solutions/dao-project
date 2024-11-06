// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Staking is Ownable {
    IERC20 public stakingToken;
    uint256 public stakedBalance;
    uint256 public stakingRewards;

    struct StakeInfo {
        uint256 amount;
        uint256 lastStakeTime;
        uint256 endStakeTime;
    }

    mapping(address => StakeInfo) public stakes;

    event TokensStaked(
        address indexed staker,
        uint256 amount,
        uint256 duration
    );
    event TokensWithdrawn(
        address indexed staker,
        uint256 amount,
        uint256 reward
    );
    event RewardsAdded(uint256 amount);

    constructor(address _stakingToken, address timelock) Ownable(timelock) {
        stakingToken = IERC20(_stakingToken);
    }

    // Stake tokens with a fixed duration, which sets a lock period
    function stakeFixedDuration(
        address _owner,
        uint256 _amount,
        uint256 _duration
    ) external {
        _stake(_owner, _amount, _duration, true);
    }

    // Stake tokens with a flexible duration, allowing withdrawals anytime
    function stakeFlexibleDuration(address _owner, uint256 _amount) external {
        _stake(_owner, _amount, 0, false);
    }

    // Internal function for staking logic
    function _stake(
        address _owner,
        uint256 _amount,
        uint256 _duration,
        bool isFixed
    ) internal {
        require(_amount > 0, "Staking amount must be greater than zero");
        require(
            stakingToken.allowance(_owner, address(this)) >= _amount,
            "Insufficient token allowance"
        );

        require(
            stakingToken.transferFrom(msg.sender, address(this), _amount),
            "Token transfer failed"
        );

        StakeInfo storage stake = stakes[msg.sender];
        if (stake.amount == 0) {
            stake.lastStakeTime = block.timestamp;
        }

        stake.amount += _amount;
        stakedBalance += _amount;

        // Set the end stake time if it is a fixed-duration stake
        if (isFixed) {
            stake.endStakeTime = block.timestamp + _duration;
        } else {
            stake.endStakeTime = 0; // No lock period for flexible staking
        }

        emit TokensStaked(msg.sender, _amount, _duration);
    }

    // Withdraw staked tokens after the staking period and collect rewards
    function withdrawTokens() external {
        StakeInfo storage stake = stakes[msg.sender];
        uint256 stakedAmount = stake.amount;

        require(stakedAmount > 0, "No tokens staked");

        // If a fixed duration is set, ensure the lock period has passed
        if (stake.endStakeTime > 0) {
            require(
                block.timestamp >= stake.endStakeTime,
                "Tokens are still locked"
            );
        }

        uint256 reward = _collectRewards(msg.sender);
        stake.amount = 0;
        stake.endStakeTime = 0;
        stakedBalance -= stakedAmount;

        require(
            stakingToken.transfer(msg.sender, stakedAmount + reward),
            "Token transfer failed"
        );

        emit TokensWithdrawn(msg.sender, stakedAmount, reward);
    }

    // Internal reward collection, called only within withdrawal functions
    function _collectRewards(address _staker) internal returns (uint256) {
        StakeInfo storage stake = stakes[_staker];
        uint256 reward = calculateReward(_staker);

        stakingRewards -= reward;
        stake.lastStakeTime = block.timestamp; // Reset to the current timestamp

        return reward;
    }

    // Calculate staking rewards based on staking time
    function calculateReward(address _staker) public view returns (uint256) {
        StakeInfo storage stake = stakes[_staker];
        uint256 stakedAmount = stake.amount;

        if (stakedAmount == 0) {
            return 0;
        }

        uint256 stakingTime = block.timestamp - stake.lastStakeTime;
        uint256 rewardRate = 10; // Example reward rate, adjust as needed
        uint256 reward = (stakedAmount * stakingTime * rewardRate) / 1 days; // Reward is proportional to time

        return reward;
    }

    // Add more tokens to the staking rewards pool
    function addStakingRewards(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Reward amount must be greater than zero");
        require(
            stakingToken.transferFrom(msg.sender, address(this), _amount),
            "Token transfer failed"
        );

        stakingRewards += _amount;
        emit RewardsAdded(_amount);
    }

    // Get the total staked tokens for a user
    function getStakedTokens(address _user) external view returns (uint256) {
        return stakes[_user].amount;
    }

    // Get the last stake time for a user
    function getLastStakeTime(address _user) external view returns (uint256) {
        return stakes[_user].lastStakeTime;
    }

    // Get the end stake time for a user
    function getEndStakeTime(address _user) external view returns (uint256) {
        return stakes[_user].endStakeTime;
    }
}
