// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

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
    //           Constants               //
    ///////////////////////////////////////
    uint256 public constant PERCENTAGE_SCALE = 1e5;     // 100_000 = 100%
    uint256 public constant SCALE            = 1e18;
    uint256 public constant YEAR_IN_TIME     = 365 days;

    // Valid fixed-duration lock periods (immutable — define the allowed set)
    uint256 public constant DURATION_30D  = 30 days;
    uint256 public constant DURATION_3MO  = 90 days;
    uint256 public constant DURATION_6MO  = 180 days;
    uint256 public constant DURATION_1YR  = 365 days;
    uint256 public constant DURATION_2YR  = 730 days;
    uint256 public constant DURATION_5YR  = 1825 days;
    uint256 public constant DURATION_10YR = 3650 days;

    ///////////////////////////////////////
    //           Data Types              //
    ///////////////////////////////////////

    struct StakePosition {
        uint256 shares;    // sWLF shares allocated to this position
        uint256 assets;    // WLF deposited (informational, not used in math)
        uint256 stakedAt;  // block.timestamp when created
        uint256 unlockAt;  // 0 = flexible; future timestamp for fixed
        uint256 bonusApy;  // extra APY (PERCENTAGE_SCALE units); 0 for flexible
        bool    active;    // false once fully withdrawn
    }

    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////
    IERC20  public stakingToken;
    uint256 public stakedBalance;   // total WLF held (including accrued rewards)
    uint256 public stakingRewards;  // reserve added by owner
    uint256 public lastUpdateTime;

    mapping(address => StakePosition[]) public stakePositions;

    // Governance-adjustable APY parameters (set in initialize; changeable via DAO)
    uint256 public minApy;  // floor APY in PERCENTAGE_SCALE units (e.g. 6_000 = 6%)
    uint256 public maxApy;  // ceiling APY in PERCENTAGE_SCALE units (e.g. 80_000 = 80%)

    // Bonus APY per fixed lock duration (duration seconds → PERCENTAGE_SCALE units)
    mapping(uint256 => uint256) public durationBonus;

    // Treasury address — used to compute circulating supply for APY decay curve
    address public treasury;

    // Cached result of calculateApy() — updated on every _updateRewardPerToken() call.
    // Read this directly from the frontend instead of calling calculateApy().
    uint256 public currentApy;

    ///////////////////////////////////////
    //           Events                  //
    ///////////////////////////////////////
    event TokensStaked(
        address indexed staker,
        uint256 positionIndex,
        uint256 assets,
        uint256 shares,
        bool    isFixed,
        uint256 unlockAt,
        uint256 bonusApy
    );
    event TokensWithdrawn(
        address indexed staker,
        uint256 positionIndex,
        uint256 assetsWithdrawn,
        uint256 sharesBurned
    );
    event RewardsAdded(uint256 amount);
    event ApyBoundsUpdated(uint256 minApy, uint256 maxApy);
    event DurationBonusUpdated(uint256 duration, uint256 bonus);
    event TreasuryUpdated(address treasury);

    ///////////////////////////////////////
    //      Constructor/Initializer      //
    ///////////////////////////////////////

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the staking contract
     * @param _stakingToken WLF token address
     * @param _timelock     Timelock / owner address
     */
    function initialize(address _stakingToken, address _timelock) public initializer {
        stakingToken = IERC20(_stakingToken);
        __ERC4626_init(stakingToken);
        __Ownable_init(_timelock);

        // Default APY bounds
        minApy = 6_000;   // 6%
        maxApy = 80_000;  // 80%

        // Default duration bonuses
        durationBonus[DURATION_30D]  = 5_000;   // 1.05x
        durationBonus[DURATION_3MO]  = 10_000;  // 1.1x
        durationBonus[DURATION_6MO]  = 15_000;  // 1.2x (approx)
        durationBonus[DURATION_1YR]  = 25_000;  // 1.5x
        durationBonus[DURATION_2YR]  = 40_000;  // 2x
        durationBonus[DURATION_5YR]  = 60_000;  // 2.5x
        durationBonus[DURATION_10YR] = 80_000;  // 3x

        // Seed the cache: nothing staked yet → maxApy
        currentApy = maxApy;
    }

    ///////////////////////////////////////
    //           External Functions      //
    ///////////////////////////////////////

    /**
     * @notice Stake WLF with no lock (flexible).
     * @param _amount WLF amount to stake
     */
    function stakeFlexible(uint256 _amount) external {
        _createPosition(msg.sender, _amount, 0, 0);
    }

    /**
     * @notice Stake WLF for a fixed lock duration.
     * @param _amount   WLF amount to stake
     * @param _duration One of the DURATION_* constants (seconds)
     */
    function stakeFixed(uint256 _amount, uint256 _duration) external {
        uint256 bonus = _bonusApyForDuration(_duration);
        require(bonus > 0, "Staking: invalid duration");
        _createPosition(msg.sender, _amount, block.timestamp + _duration, bonus);
    }

    // ── Backward-compat aliases (called by LPStaking.claimAndStakeRewards) ──

    /**
     * @notice Stake tokens for a fixed 30-day duration (legacy interface).
     * @dev msg.sender supplies the tokens; _owner receives the position.
     */
    function stakeFixedDuration(address _owner, uint256 _amount) external {
        _createPosition(_owner, _amount, block.timestamp + DURATION_30D, durationBonus[DURATION_30D]);
    }

    /**
     * @notice Stake tokens with no lock (legacy interface).
     * @dev msg.sender supplies the tokens; _owner receives the position.
     */
    function stakeFlexibleDuration(address _owner, uint256 _amount) external {
        _createPosition(_owner, _amount, 0, 0);
    }

    /**
     * @notice Withdraw an entire position (must be unlocked).
     * @param _index Index in stakePositions[msg.sender]
     */
    function withdrawPosition(uint256 _index) external returns (uint256 withdrawn) {
        StakePosition storage pos = stakePositions[msg.sender][_index];
        require(pos.active, "Staking: position withdrawn");
        require(pos.unlockAt == 0 || block.timestamp >= pos.unlockAt, "Staking: still locked");
        withdrawn = _withdrawFromPosition(msg.sender, _index, pos.shares);
    }

    /**
     * @notice Withdraw a partial asset amount from a position (must be unlocked).
     * @param _index       Position index
     * @param _assetAmount WLF amount to withdraw
     */
    function withdrawAmountFromPosition(uint256 _index, uint256 _assetAmount) external returns (uint256 withdrawn) {
        StakePosition storage pos = stakePositions[msg.sender][_index];
        require(pos.active, "Staking: position withdrawn");
        require(pos.unlockAt == 0 || block.timestamp >= pos.unlockAt, "Staking: still locked");
        uint256 sharesToBurn = _convertToShares(_assetAmount, Math.Rounding.Ceil);
        require(sharesToBurn <= pos.shares, "Staking: exceeds position");
        withdrawn = _withdrawFromPosition(msg.sender, _index, sharesToBurn);
    }

    /**
     * @notice Withdraw all unlocked positions in one transaction.
     */
    function withdrawAll() external {
        StakePosition[] storage positions = stakePositions[msg.sender];
        bool found;
        for (uint256 i = 0; i < positions.length; i++) {
            if (!positions[i].active) continue;
            if (positions[i].unlockAt > 0 && block.timestamp < positions[i].unlockAt) continue;
            _withdrawFromPosition(msg.sender, i, positions[i].shares);
            found = true;
        }
        require(found, "Staking: no unlocked positions");
    }

    /**
     * @notice ERC4626-compatible withdraw (withdraws from unlocked positions, oldest first).
     */
    function withdraw(uint256 _assetAmount, address _receiver, address _owner)
        public
        virtual
        override
        returns (uint256 sharesBurned)
    {
        require(_assetAmount > 0, "Staking: amount must be > 0");
        require(_owner == msg.sender, "Staking: only owner");
        require(_receiver != address(0), "Staking: zero receiver");
        _updateRewardPerToken();
        uint256 remaining = _convertToShares(_assetAmount, Math.Rounding.Ceil);
        sharesBurned = remaining;
        StakePosition[] storage positions = stakePositions[_owner];
        for (uint256 i = 0; i < positions.length && remaining > 0; i++) {
            if (!positions[i].active) continue;
            if (positions[i].unlockAt > 0 && block.timestamp < positions[i].unlockAt) continue;
            uint256 toTake = remaining < positions[i].shares ? remaining : positions[i].shares;
            positions[i].shares -= toTake;
            if (positions[i].shares == 0) positions[i].active = false;
            remaining -= toTake;
        }
        require(remaining == 0, "Staking: insufficient unlocked");
        stakedBalance -= _assetAmount;
        _burn(_owner, sharesBurned);
        require(stakingToken.transfer(_receiver, _assetAmount), "Staking: transfer failed");
        emit TokensWithdrawn(_owner, type(uint256).max, _assetAmount, sharesBurned);
    }

    /**
     * @notice Return all positions for a user (including withdrawn ones).
     */
    function getPositions(address _user) external view returns (StakePosition[] memory) {
        return stakePositions[_user];
    }

    /**
     * @notice Number of positions (including withdrawn) for a user.
     */
    function getPositionCount(address _user) external view returns (uint256) {
        return stakePositions[_user].length;
    }

    /**
     * @notice Add WLF to the staking rewards reserve.
     */
    function addStakingRewards(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Staking: amount must be > 0");
        require(stakingToken.transferFrom(msg.sender, address(this), _amount), "Staking: transfer failed");
        stakingRewards += _amount;
        emit RewardsAdded(_amount);
    }

    /**
     * @notice Update the minimum and maximum base APY bounds.
     * @dev Callable by the Timelock (owner), which is governed by DAO proposals.
     * @param _minApy New minimum APY in PERCENTAGE_SCALE units (e.g. 6_000 = 6%)
     * @param _maxApy New maximum APY in PERCENTAGE_SCALE units (e.g. 80_000 = 80%)
     */
    function setApyBounds(uint256 _minApy, uint256 _maxApy) external onlyOwner {
        require(_minApy < _maxApy, "Staking: min >= max");
        require(_maxApy <= PERCENTAGE_SCALE, "Staking: max > 100%");
        minApy = _minApy;
        maxApy = _maxApy;
        emit ApyBoundsUpdated(_minApy, _maxApy);
    }

    /**
     * @notice Set the bonus APY for a specific lock duration.
     * @dev Callable by the Timelock (owner), which is governed by DAO proposals.
     *      Setting a duration's bonus to 0 effectively disables that lock option.
     * @param _duration Lock duration in seconds (should be one of the DURATION_* constants)
     * @param _bonus    Bonus APY in PERCENTAGE_SCALE units (e.g. 25_000 = 25%)
     */
    function setBonusForDuration(uint256 _duration, uint256 _bonus) external onlyOwner {
        require(_bonus <= PERCENTAGE_SCALE, "Staking: bonus > 100%");
        durationBonus[_duration] = _bonus;
        emit DurationBonusUpdated(_duration, _bonus);
    }

    /**
     * @notice Set the treasury address used to compute circulating supply in the APY curve.
     * @dev Call this once after deployment. Callable by Timelock (owner) if it needs to change.
     * @param _treasury Treasury contract address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Staking: zero treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    ///////////////////////////////////////
    //           Public Functions        //
    ///////////////////////////////////////

    function convertToShares(uint256 _asset) public view override returns (uint256) {
        return super._convertToShares(_asset, Math.Rounding.Floor);
    }

    function convertToAssets(uint256 _shares) public view override returns (uint256) {
        return super._convertToAssets(_shares, Math.Rounding.Floor);
    }

    function maxWithdraw(address _owner) public view override returns (uint256) {
        return _convertToAssets(balanceOf(_owner), Math.Rounding.Floor);
    }

    function maxRedeem(address _owner) public view override returns (uint256) {
        return balanceOf(_owner);
    }

    function previewDeposit(uint256 _assets) public view override returns (uint256) {
        return _convertToShares(_assets, Math.Rounding.Floor);
    }

    /**
     * @notice Current base APY (half-life decay based on staking ratio).
     * @return APY in PERCENTAGE_SCALE units (80_000 = 80%)
     */
    /**
     * @notice Current base APY using circulating supply (total supply minus treasury) as denominator.
     * @dev Matches the frontend staking ratio display: ratio = staked / (totalSupply - treasury).
     * @return APY in PERCENTAGE_SCALE units (e.g. 80_000 = 80%)
     */
    function calculateApy() public view returns (uint256) {
        if (stakedBalance == 0) return maxApy;
        uint256 tokenTotalSupply = stakingToken.totalSupply();
        if (tokenTotalSupply == 0) return maxApy;

        // Circulating supply excludes treasury holdings (not yet distributed to the market)
        uint256 treasuryBalance = treasury != address(0) ? stakingToken.balanceOf(treasury) : 0;
        uint256 circulatingSupply = tokenTotalSupply > treasuryBalance
            ? tokenTotalSupply - treasuryBalance
            : tokenTotalSupply;
        if (circulatingSupply == 0) return maxApy;

        uint256 stakingRatio = (stakedBalance * SCALE) / circulatingSupply;
        uint256 exponent = stakingRatio / 1e17;
        uint256 apyValue = SCALE * minApy + ((maxApy - minApy) * SCALE) / (2 ** exponent);
        return apyValue / SCALE;
    }

    ///////////////////////////////////////
    //           Internal Functions      //
    ///////////////////////////////////////

    /**
     * @dev Core staking logic: transfers tokens, mints shares, records the position.
     *      msg.sender supplies the tokens; _receiver owns the position.
     */
    function _createPosition(
        address _receiver,
        uint256 _amount,
        uint256 _unlockAt,
        uint256 _bonusApy
    ) internal {
        require(_amount > 0, "Staking: amount must be > 0");
        require(stakingToken.transferFrom(msg.sender, address(this), _amount), "Staking: transfer failed");

        _updateRewardPerToken();

        uint256 sharesToMint = _convertToShares(_amount, Math.Rounding.Floor);
        stakedBalance += _amount;

        uint256 idx = stakePositions[_receiver].length;
        stakePositions[_receiver].push(StakePosition({
            shares:   sharesToMint,
            assets:   _amount,
            stakedAt: block.timestamp,
            unlockAt: _unlockAt,
            bonusApy: _bonusApy,
            active:   true
        }));

        _mint(_receiver, sharesToMint);
        emit TokensStaked(_receiver, idx, _amount, sharesToMint, _unlockAt > 0, _unlockAt, _bonusApy);
    }

    /**
     * @dev Burns _sharesToBurn from position[_index] and sends the corresponding assets to _user.
     */
    function _withdrawFromPosition(
        address _user,
        uint256 _index,
        uint256 _sharesToBurn
    ) internal returns (uint256 assets) {
        _updateRewardPerToken();
        StakePosition storage pos = stakePositions[_user][_index];
        assets = _convertToAssets(_sharesToBurn, Math.Rounding.Floor);
        pos.shares -= _sharesToBurn;
        if (pos.shares == 0) pos.active = false;
        stakedBalance -= assets;
        _burn(_user, _sharesToBurn);
        require(stakingToken.transfer(_user, assets), "Staking: transfer failed");
        emit TokensWithdrawn(_user, _index, assets, _sharesToBurn);
    }

    /**
     * @dev Returns bonus APY for a given lock duration, or 0 if not a valid option.
     */
    function _bonusApyForDuration(uint256 _duration) internal view returns (uint256) {
        return durationBonus[_duration];
    }

    /**
     * @dev Accrues rewards into stakedBalance based on APY and elapsed time.
     */
    function _updateRewardPerToken() internal {
        if (block.timestamp == lastUpdateTime) return;
        if (lastUpdateTime == 0) {
            lastUpdateTime = block.timestamp;
            return;
        }
        uint256 elapsed = block.timestamp - lastUpdateTime;
        uint256 rewardPerSecond = (stakedBalance * calculateApy()) / YEAR_IN_TIME / PERCENTAGE_SCALE;
        stakedBalance += rewardPerSecond * elapsed;
        lastUpdateTime = block.timestamp;
        currentApy = calculateApy();  // cache the new APY after stakedBalance changed
    }

    function _convertToAssets(uint256 _shares, Math.Rounding rounding) internal view override returns (uint256) {
        return super._convertToAssets(_shares, rounding);
    }

    function totalAssets() public view override returns (uint256) {
        return stakedBalance;
    }

    function _convertToShares(uint256 _amount, Math.Rounding rounding) internal view override returns (uint256) {
        if (totalSupply() == 0) return _amount;
        return super._convertToShares(_amount, rounding);
    }

    /**
     * @dev Allow mint/burn through super; block direct sWLF token-to-contract transfers.
     */
    function _update(address _from, address _to, uint256 _value) internal override {
        // Mint and burn go straight through
        if (_from == address(0) || _to == address(0)) {
            super._update(_from, _to, _value);
            return;
        }
        // sWLF sent directly to this contract is not a valid withdrawal path
        require(_to != address(this), "Staking: use withdrawPosition");
        super._update(_from, _to, _value);
    }

    // ── Deprecated stubs kept for ABI compat ──────────────────────────────

    function getStakedTokens(address) external pure returns (uint256) { return 0; }
    function getLastStakeTime(address) external pure returns (uint256) { return 0; }
    function getEndStakeTime(address) external pure returns (uint256)  { return 0; }
}
