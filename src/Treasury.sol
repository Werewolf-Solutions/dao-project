// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./WerewolfTokenV1.sol";
import "./Staking.sol";
import "./interfaces/ILPStaking.sol";

contract Treasury is OwnableUpgradeable {
    // address public werewolfToken;
    WerewolfTokenV1 private werewolfToken;
    Staking public stakingContract;
    ILPStaking public lpStakingContract;

    // Percentage threshold, e.g., 20 for 20%
    uint256 public thresholdPercentage = 20;

    // Mapping to track allowed tokens (werewolfToken address => allowed)
    mapping(address => bool) public allowedTokens;

    // Mapping to track reward allocations for different staking contracts
    mapping(address => uint256) public stakingRewardAllocations;

    event RewardsDistributed(address indexed stakingContract, uint256 amount);

    constructor( /* address _token */ ) {
        /*       require(_token != address(0), "WerewolfTokenV1 address cannot be zero");
        // werewolfToken = _token;
        werewolfToken = WerewolfTokenV1(_token);
        allowedTokens[_token] = true; // Set initial werewolfToken as allowed */

        //disable initializer
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        require(_owner != address(0), "WerewolfTokenV1 address cannot be zero");
        //initialize the owner of the contract
        __Ownable_init(_owner);
    }

    function setWerewolfToken(address _token) public onlyOwner {
        require(address(werewolfToken) == address(0), "Teasury token address already set");
        require(_token != address(0), "WerewolfTokenV1 address cannot be zero");
        allowedTokens[_token] = true; // Set initial werewolfToken as allowed
        werewolfToken = WerewolfTokenV1(_token);
    }

    function setStakingContract(address _stakingAddress) external onlyOwner {
        stakingContract = Staking(_stakingAddress);
    }

    function setLPStakingContract(address _lpStaking) external onlyOwner {
        require(_lpStaking != address(0), "Invalid LP staking address");
        lpStakingContract = ILPStaking(_lpStaking);
    }

    function setStakingRewardAllocation(address _stakingContract, uint256 _amount)
        external
        onlyOwner
    {
        require(_stakingContract != address(0), "Invalid staking contract address");
        stakingRewardAllocations[_stakingContract] = _amount;
    }

    // Function to add allowed tokens, can only be called by the DAO
    function addAllowedToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid werewolfToken address");
        allowedTokens[_token] = true;
    }

    // Function to check if a werewolfToken is allowed by the DAO
    function isTokenAllowed(address _token) external view returns (bool) {
        return allowedTokens[_token];
    }

    // Set the percentage threshold (only by owner)
    function setThresholdPercentage(uint256 _percentage) public onlyOwner {
        require(_percentage <= 100, "Percentage cannot exceed 100");
        thresholdPercentage = _percentage;
    }

    // Check if the treasury balance is above the threshold
    function isAboveThreshold() public view returns (bool) {
        uint256 treasuryBalance = werewolfToken.balanceOf(address(this));
        uint256 threshold = (treasuryBalance * thresholdPercentage) / 100;
        return treasuryBalance > threshold; //note the threshold will never be false
    }

    // Distributes rewards to the staking contract from the treasury
    function distributeRewards() external {
        require(
            werewolfToken.balanceOf(address(this)) >= stakingContract.stakingRewards(),
            "Insufficient reward balance in Treasury"
        );

        // Transfer rewards to the staking contract
        require(
            werewolfToken.transfer(address(stakingContract), stakingContract.stakingRewards()), "Reward transfer failed"
        );

        emit RewardsDistributed(address(stakingContract), stakingContract.stakingRewards());
    }

    /**
     * @notice Distribute rewards to LP staking contract
     */
    function distributeRewardsToLP() external {
        require(address(lpStakingContract) != address(0), "LP staking not set");
        uint256 allocation = stakingRewardAllocations[address(lpStakingContract)];
        require(allocation > 0, "No allocation set for LP staking");
        require(
            werewolfToken.balanceOf(address(this)) >= allocation,
            "Insufficient rewards"
        );

        require(
            werewolfToken.transfer(address(lpStakingContract), allocation),
            "Reward transfer failed"
        );

        emit RewardsDistributed(address(lpStakingContract), allocation);
    }
}
