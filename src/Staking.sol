// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

//Debugging
import {console} from "forge-std/Test.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";

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
contract Staking is ERC4626Upgradeable, OwnableUpgradeable {
    ///////////////////////////////////////
    //           Constants              //
    ///////////////////////////////////////
    uint256 public constant MIN_APY = 6_000;
    uint256 public constant MAX_APY = 80_000;
    uint256 public constant LOCKED_STAKE_BONUS_APY = 5_000;
    uint256 public constant PERCENTAGE_SCALE = 1e5;
    uint256 public constant SCALE = 1e18;
    uint256 public constant YEAR_IN_TIME = 365 days;
    uint256 public constant EPOCH_DURATION = 30 days;

    ///////////////////////////////////////
    //           Data Types              //
    ///////////////////////////////////////
    struct StakeInfo {
        uint256 amount;
        uint256 lockedAmount;
        uint256 lockedAtTime;
        uint256 lastStakeTime;
        uint256 endStakeTime;
    }

    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////
    IERC20 public stakingToken;
    uint256 public stakedBalance;
    uint256 public stakingRewards;
    // shares per token
    uint256 public sharesPerToken;
    uint256 public lastUpdateTime;
    uint256 public currentEpoch;

    mapping(address => StakeInfo) public stakes;
    //contract total locked amount
    mapping(uint256 epoch => uint256) public epochToLockedAmount;
    mapping(uint256 epoch => mapping(address => uint256)) public lockedStakes;
    mapping(address => uint256[]) public userToLockedEpochs;
    ///////////////////////////////////////
    //           Events                  //
    ///////////////////////////////////////

    event TokensStaked(address indexed staker, uint256 indexed amount, uint256 indexed epoch, bool isFixed);
    event TokensWithdrawn(address indexed staker, uint256 amountWithdrawn, uint256 sharesBurned);
    event RewardsAdded(uint256 amount);
    event LockedStakesUpdated(address indexed staker, uint256 amount);

    ///////////////////////////////////////
    //      Constructor/Initializer      //
    ///////////////////////////////////////

    constructor() {
        _disableInitializers();
    }

    function initialize(address _stakingToken, address _timelock) public initializer {
        //staked token which will be WLF
        stakingToken = IERC20(_stakingToken);

        // decimals will be the same as the staking token thus 18
        __ERC4626_init(stakingToken); //Staked Werewolf Token
        // Time lock contract which will handle the governance
        __Ownable_init(_timelock);
    }

    ///////////////////////////////////////
    //           External Functions      //
    ///////////////////////////////////////

    /**
     * @notice Stake tokens for a fixed duration
     * @param _owner The address that will receive the staked shares
     * @param _amount The amount of tokens to stake
     */
    function stakeFixedDuration(address _owner, uint256 _amount) external {
        // todo verify the duration time <--- maybe not needed
        // Todo add a bonus apy for the lock period
        _stake(_owner, _amount, true);
    }

    /**
     * @notice Stake tokens for a flexible duration
     * @param _owner The address that will receive the staked shares
     * @param _amount The amount of tokens to stake
     */
    function stakeFlexibleDuration(address _owner, uint256 _amount) external {
        _stake(_owner, _amount, false);
    }

    /**
     * @dev Will revert if the caller does not have enough token balance to mint
     * the specified amount of shares
     * @notice Needed to be compliant with the ERC4626 interface
     * @notice Mint shares for the specified amount of tokens
     * @param _shares The amount of shares to mint
     * @param _receiver The address that will receive the minted shares
     */
    function mint(uint256 _shares, address _receiver) public override returns (uint256) {
        //Round up to increase the deposited amount
        uint256 assetAmount = _convertToAssets(_shares, Math.Rounding.Ceil);
        _stake(_receiver, assetAmount, false);
    }

    /**
     * @dev _stakes the specified amount of tokens for the specified duration
     * @param _receiver The address that will receive the staked shares
     * @param _amount The amount of tokens to stake
     * @param _isFixed A boolean indicating if the stake is fixed or flexible
     */
    function _stake(address _receiver, uint256 _amount, bool _isFixed) internal {
        require(_amount > 0, "Staking:_stake Amount must be greater than zero");
        require(stakingToken.transferFrom(msg.sender, address(this), _amount), "Staking:_stake Token transfer failed");

        // update the reward per token, increasing share value
        _updateRewardPerToken();

        uint256 sharesToMint = _convertToShares(_amount, Math.Rounding.Floor);

        StakeInfo storage stake = stakes[_receiver];

        stake.amount += _amount;

        // stakedBalance is use as the totalAssets amount
        stakedBalance += _amount;

        // Set the end stake time if it is a fixed-duration stake
        if (_isFixed) {
            //check if the stake duration is greater than the previous stake duration
            // user cannot decrease their stake time
            if (stake.endStakeTime > (block.timestamp)) {
                revert("Staking:_stake Stake duration is less than the previous stake duration");
            }
            // calculate bonus rewards as if the deposited amount was locked at the beginning
            // of the staked period, note the debt is only for bonus rewards
            //stake.rewardsDebt = _lockStakeBonusRewards(_amount, stake.lockedAtTime);
            stake.endStakeTime = block.timestamp;

            userToLockedEpochs[_receiver].push(currentEpoch);

            //epoch staked amount
            epochToLockedAmount[currentEpoch] += sharesToMint;
        } else {
            //stake.endStakeTime = 0; // No lock period for flexible staking
            //do nothing, waste of gas to assign 0 value
        }

        // The will increase the totalSuppply of shares
        _mint(_receiver, sharesToMint);

        emit TokensStaked(_receiver, _amount, currentEpoch, _isFixed);
    }

    function _updateLockedStakes(address _user) internal {
        uint256 reward;
        //we will mint bonus shares for locking the tokens
        uint256 sharesToMint;
        //bitmap to store the indeces to remove
        uint256 indecesToRemoveBitMap;

        //update the locked stakes
        for (uint256 i = 0; i < userToLockedEpochs[_user].length; i++) {
            if (userToLockedEpochs[_user][i] >= (currentEpoch - 1)) {
                continue;
            }
            indecesToRemoveBitMap = indecesToRemoveBitMap | (1 << i);
            uint256 epoch = userToLockedEpochs[_user][i];
            uint256 lockedAmount = lockedStakes[epoch][_user];
            //reward can be considered as asset amount
            reward += _lockStakeBonusRewards(lockedAmount);
        }

        // if there are no epochs to remove, return
        if (indecesToRemoveBitMap == 0) {
            return;
        }

        // determine the most significant bit
        // we will iterate through the bitmap to remove the epochs
        uint256 mostSigbit = mostSignificantBit(indecesToRemoveBitMap);
        for (uint256 i = 0; i < mostSigbit; i++) {
            // a bit will signify that the epoch is to be removed
            if (indecesToRemoveBitMap & (1 << i) == 1) {
                _removeEpochFromUser(_user, i);
            }
        }

        emit LockedStakesUpdated(_user, reward);
        _stake(_user, reward, false);

        /* stakedBalance += reward;
        sharesToMint = _convertToShares(reward, Math.Rounding.Floor);
        mint(sharesToMint, _user); */
    }

    function _removeEpochFromUser(address _user, uint256 _index) internal {
        uint256 lastEpoch = userToLockedEpochs[_user].length - 1;
        userToLockedEpochs[_user][_index] = userToLockedEpochs[_user][lastEpoch];
        userToLockedEpochs[_user].pop();
    }

    function mostSignificantBit(uint256 x) internal pure returns (uint256 msb) {
        assembly {
            let f := shl(7, gt(x, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF))
            x := shr(f, x)
            // or can be replaced with add
            msb := or(msb, f)
        }
        assembly {
            let f := shl(6, gt(x, 0xFFFFFFFFFFFFFFFF))
            x := shr(f, x)
            msb := or(msb, f)
        }
        assembly {
            let f := shl(5, gt(x, 0xFFFFFFFF))
            x := shr(f, x)
            msb := or(msb, f)
        }
        assembly {
            let f := shl(4, gt(x, 0xFFFF))
            x := shr(f, x)
            msb := or(msb, f)
        }
        assembly {
            let f := shl(3, gt(x, 0xFF))
            x := shr(f, x)
            msb := or(msb, f)
        }
        assembly {
            let f := shl(2, gt(x, 0xF))
            x := shr(f, x)
            msb := or(msb, f)
        }
        assembly {
            let f := shl(1, gt(x, 0x3))
            x := shr(f, x)
            msb := or(msb, f)
        }
        assembly {
            let f := gt(x, 0x1)
            msb := or(msb, f)
        }
    }

    /**
     * @dev Transfer function to move locked tokens to another address
     * @notice Transfer locked staked tokens to another address
     * @param _receiver The address that will receive the locked staked tokens
     * @param _amount The amount of locked staked tokens to transfer
     */
    function transferLockedStake(address _receiver, uint256 _amount) external {
        uint256 currentEpochBalance = lockedStakes[currentEpoch][msg.sender];
        uint256 prevEpochBalance = lockedStakes[currentEpoch - 1][msg.sender];
        //TODO have a function to transfer locked staked tokens
        require(
            currentEpochBalance + prevEpochBalance >= _amount, "Staking:transferLockedStake Insufficient locked balance"
        );
        //update the locked stakes
        if (prevEpochBalance >= _amount) {
            lockedStakes[currentEpoch - 1][msg.sender] -= _amount;
            lockedStakes[currentEpoch - 1][_receiver] += _amount;
        } else {
            _amount -= prevEpochBalance;
            lockedStakes[currentEpoch - 1][msg.sender] = 0;
            lockedStakes[currentEpoch][msg.sender] -= _amount;
            //update the receiver balance
            lockedStakes[currentEpoch - 1][_receiver] += prevEpochBalance;
            lockedStakes[currentEpoch][_receiver] += _amount;
        }
        lockedStakes[currentEpoch][msg.sender] -= _amount;
        transfer(_receiver, _amount);
    }

    //Todo overwrite the balance function to include the locked stakes

    //TODO have a function to transfer locked staked tokens

    function _lockStakeBonusRewards(uint256 _amount) internal returns (uint256) {
        //todo check the precision loss
        uint256 rewardAmount = (_amount * LOCKED_STAKE_BONUS_APY * EPOCH_DURATION) / (YEAR_IN_TIME * PERCENTAGE_SCALE);
    }

    function _convertToAssets(uint256 _shares, Math.Rounding rounding) internal view override returns (uint256) {
        //Before converting the asset we need to settle outstanding rewards
        uint256 assetAmount = super._convertToAssets(_shares, rounding);
    }

    function totalAssets() public view override returns (uint256) {
        //prevent direct transfer of tokens to modify the staked balance
        stakedBalance;
    }

    /**
     * @notice We can prevent a vault inflation attack since the staked token _transfer will trigger
     * the stake function if this contract
     * @dev Convert the staked amount to shares
     * @param _amount The amount to convert
     * @param rounding The rounding method to use
     */
    function _convertToShares(uint256 _amount, Math.Rounding rounding) internal view override returns (uint256) {
        //Total supply of the staking token
        if (totalSupply() == 0) {
            // Initial conversion 1:1
            return _amount;
        } else {
            super._convertToShares(_amount, rounding);
        }
    }

    /**
     * @dev Update the reward per token based on the current staking balance and APY
     * This function is called internally to update the reward per token
     */
    function _updateRewardPerToken() internal {
        if (block.timestamp == lastUpdateTime) {
            return;
        } else if (lastUpdateTime == 0) {
            lastUpdateTime = block.timestamp;
            return;
        }
        uint256 timeSinceLastUpdate = block.timestamp - lastUpdateTime;
        //TODO check for precision loss
        uint256 rewardPerSecond = (stakedBalance * calculateApy()) / YEAR_IN_TIME / PERCENTAGE_SCALE;
        stakedBalance += rewardPerSecond * timeSinceLastUpdate;
        lastUpdateTime = block.timestamp;
    }

    // Withdraw staked tokens after the staking period and collect rewards
    function withdrawTokens() external {
        _updateRewardPerToken();
        _updateLockedStakes(msg.sender);

        uint256 lockedBalance = lockedStakes[currentEpoch][msg.sender] + lockedStakes[currentEpoch - 1][msg.sender];

        uint256 unlockedShares = balanceOf(msg.sender) - lockedBalance;

        require(unlockedShares > 0, "Staking:withdrawTokens No unlocked shares to withdraw");

        uint256 withdrawAmount = _convertToAssets(unlockedShares, Math.Rounding.Floor);

        require(transferFrom(msg.sender, address(this), unlockedShares), "Staking:withdrawTokens Token transfer failed");
        stakedBalance -= withdrawAmount;

        require(stakingToken.transfer(msg.sender, withdrawAmount), "Staking:withdrawTokens Token transfer failed");

        emit TokensWithdrawn(msg.sender, withdrawAmount, unlockedShares);
    }

    /*  // Internal reward collection, called only within withdrawal functions
    function _collectRewards(StakeInfo storage s_stakerPtr) internal returns (uint256) {
        uint256 reward = _calculateReward(s_stakerPtr);
        //decrease global rewards
        stakingRewards -= reward;
        s_stakerPtr.lastStakeTime = block.timestamp; // Reset to the current timestamp

        return reward;
    }

    function _calculateReward(StakeInfo storage s_stakePtr) internal returns (uint256) {
        uint256 totalStakingTime = block.timestamp - s_stakePtr.lastStakeTime;
        uint256 calculatedApy = calculateApy();
        uint256 reward = (s_stakePtr.amount * calculatedApy) / (YEAR_IN_TIME * PERCENTAGE_SCALE);
        reward = reward * totalStakingTime;
        return reward;
    } */

    function calculateApy() public view returns (uint256) {
        /* APY calculation
        * The apy calculation is following a halflife decay, meaning that the APY
        * will be halfed at each life which is a 0.1 change in the ratio of staked tokens
        * to the total supply. The APY will start at MAX_APY and decay to MIN_APY
        */
        uint256 tokenTotalSupply = stakingToken.totalSupply();
        uint256 stakingRatio = (stakedBalance * SCALE) / tokenTotalSupply;
        //halflife exp
        //@invariant wexponent <= 10
        uint256 exponent = stakingRatio / 1e17; //leaving 1 decimal precision

        uint256 currentApy = SCALE * MIN_APY + ((MAX_APY - MIN_APY) * SCALE) / (2 ** exponent);

        return currentApy / SCALE;
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
        require(stakingToken.transferFrom(msg.sender, address(this), _amount), "Token transfer failed");

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
