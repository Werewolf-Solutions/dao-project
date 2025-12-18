// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "./interfaces/IWerewolfTokenV1.sol";
import "./interfaces/ITreasury.sol";

// Uniswap v3 interfaces
interface IPositionManager {
    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct Position {
        uint96 nonce;
        address operator;
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    function positions(uint256 tokenId) external view returns (
        uint96 nonce,
        address operator,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    );

    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);

    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1);

    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

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

/**
 * @title LPStaking
 * @notice Manages staking of Uniswap v3 LP positions (NFTs) and issues
 *         fungible ERC20 shares representing fractional ownership
 * @dev Combines ERC20 share tokens with Uniswap v3 LP NFT custody
 */
contract LPStaking is ERC20Upgradeable, OwnableUpgradeable, IERC721Receiver {
    ///////////////////////////////////////
    //           Constants              //
    ///////////////////////////////////////
    uint256 public constant MIN_APY = 8_000;           // 8% (higher due to IL risk)
    uint256 public constant MAX_APY = 100_000;         // 100%
    uint256 public constant LOCKED_STAKE_BONUS_APY = 5_000; // 5%
    uint256 public constant PERCENTAGE_SCALE = 1e5;
    uint256 public constant SCALE = 1e18;
    uint256 public constant YEAR_IN_TIME = 365 days;
    uint256 public constant EPOCH_DURATION = 30 days;

    ///////////////////////////////////////
    //           Data Types              //
    ///////////////////////////////////////

    /**
     * @dev Stores information about a Uniswap v3 LP position from a token sale
     */
    struct LPPosition {
        uint256 tokenId;      // Uniswap NFT token ID
        uint256 totalWLF;     // Initial WLF amount in position
        uint256 totalUSDT;    // Initial USDT amount in position
        uint128 liquidity;    // Current liquidity in position
        bool initialized;     // Whether position has been initialized
    }

    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////

    // Core contracts
    IPositionManager public positionManager;
    IWerewolfTokenV1 public wlfToken;
    IERC20 public usdtToken;
    ITreasury public treasury;
    address public tokenSaleContract;

    // LP Position tracking per sale
    mapping(uint256 saleId => LPPosition) public lpPositions;
    mapping(uint256 saleId => uint256 totalShares) public saleShares;

    // Epoch and fixed-duration tracking (copied from Staking.sol pattern)
    mapping(uint256 epoch => uint256 lockedAmount) public epochToLockedAmount;
    mapping(address => uint256[]) public userToLockedEpochs;
    mapping(uint256 epoch => mapping(address => uint256)) public lockedStakes;
    uint256 public currentEpoch;
    uint256 public lastEpochUpdate;

    // Reward tracking
    uint256 public totalStakedValue;      // Total value of all staked LP shares
    uint256 public lastUpdateTime;
    uint256 public rewardPerShareStored;
    mapping(address => uint256) public userRewardPerSharePaid;
    mapping(address => uint256) public rewards;

    ///////////////////////////////////////
    //           Events                  //
    ///////////////////////////////////////

    event LPPositionInitialized(uint256 indexed saleId, uint256 indexed tokenId, uint256 wlf, uint256 usdt);
    event SharesClaimed(address indexed user, uint256 indexed saleId, uint256 shares, bool fixedDuration);
    event SharesWithdrawn(address indexed user, uint256 shares, uint256 wlfAmount, uint256 usdtAmount);
    event FeesCollected(uint256 indexed saleId, uint256 wlf, uint256 usdt);
    event RewardsDistributed(address indexed user, uint256 amount);
    event LockedStakesUpdated(address indexed staker, uint256 amount);

    ///////////////////////////////////////
    //           Modifiers               //
    ///////////////////////////////////////

    modifier onlyTokenSale() {
        require(msg.sender == tokenSaleContract, "LPStaking: Only TokenSale can call");
        _;
    }

    modifier updateReward(address account) {
        _updateRewardPerShare();
        if (account != address(0)) {
            rewards[account] = _earned(account);
            userRewardPerSharePaid[account] = rewardPerShareStored;
        }
        _;
    }

    ///////////////////////////////////////
    //      Constructor/Initializer      //
    ///////////////////////////////////////

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the LP staking contract
     * @param _wlfToken The WLF token address
     * @param _usdtToken The USDT token address
     * @param _owner The contract owner (should be Timelock)
     * @param _treasury The treasury contract for rewards
     * @param _positionManager The Uniswap v3 NonfungiblePositionManager
     */
    function initialize(
        address _wlfToken,
        address _usdtToken,
        address _owner,
        address _treasury,
        address _positionManager
    ) public initializer {
        require(_wlfToken != address(0), "LPStaking: Invalid WLF address");
        require(_usdtToken != address(0), "LPStaking: Invalid USDT address");
        require(_treasury != address(0), "LPStaking: Invalid treasury address");
        require(_positionManager != address(0), "LPStaking: Invalid position manager");

        __ERC20_init("Staked WLF-USDT LP", "sWLF-USDT-LP");
        __Ownable_init(_owner);

        wlfToken = IWerewolfTokenV1(_wlfToken);
        usdtToken = IERC20(_usdtToken);
        treasury = ITreasury(_treasury);
        positionManager = IPositionManager(_positionManager);

        lastUpdateTime = block.timestamp;
        lastEpochUpdate = block.timestamp;
    }

    ///////////////////////////////////////
    //           External Functions      //
    ///////////////////////////////////////

    /**
     * @notice Set the TokenSale contract address (can only be set once)
     * @param _tokenSale The TokenSale contract address
     */
    function setTokenSaleContract(address _tokenSale) external onlyOwner {
        require(tokenSaleContract == address(0), "LPStaking: TokenSale already set");
        require(_tokenSale != address(0), "LPStaking: Invalid TokenSale address");
        tokenSaleContract = _tokenSale;
    }

    /**
     * @notice Initialize an LP position from a token sale
     * @param saleId The sale identifier
     * @param tokenId The Uniswap v3 NFT token ID
     * @param wlf Initial WLF amount in position
     * @param usdt Initial USDT amount in position
     */
    function initializeLPPosition(
        uint256 saleId,
        uint256 tokenId,
        uint256 wlf,
        uint256 usdt
    ) external onlyTokenSale {
        require(!lpPositions[saleId].initialized, "LPStaking: Position already initialized");
        require(tokenId > 0, "LPStaking: Invalid token ID");

        // Verify we own the NFT
        require(
            positionManager.ownerOf(tokenId) == address(this),
            "LPStaking: Contract doesn't own NFT"
        );

        // Get position details from Uniswap
        // positions() returns: (nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1)
        (,,,,,,,uint128 liquidity,,,,) = positionManager.positions(tokenId);

        lpPositions[saleId] = LPPosition({
            tokenId: tokenId,
            totalWLF: wlf,
            totalUSDT: usdt,
            liquidity: liquidity,
            initialized: true
        });

        emit LPPositionInitialized(saleId, tokenId, wlf, usdt);
    }

    /**
     * @notice Claim LP shares after a token sale ends
     * @param user The user claiming shares
     * @param saleId The sale to claim from
     * @param purchaseAmount The amount of WLF the user purchased
     * @param fixedDuration True to lock for 30 days with bonus APY
     */
    function claimShares(
        address user,
        uint256 saleId,
        uint256 purchaseAmount,
        bool fixedDuration
    ) external onlyTokenSale updateReward(user) {
        require(lpPositions[saleId].initialized, "LPStaking: Position not initialized");
        require(purchaseAmount > 0, "LPStaking: Invalid purchase amount");

        LPPosition storage position = lpPositions[saleId];

        // Calculate proportional shares based on purchase amount
        // shares = (purchaseAmount / totalWLF) * total position value
        uint256 sharesToMint = (purchaseAmount * SCALE) / position.totalWLF;

        // Mint shares to user
        _mint(user, sharesToMint);

        // Track total shares for this sale
        saleShares[saleId] += sharesToMint;

        // Update total staked value
        totalStakedValue += sharesToMint;

        // If fixed duration, lock shares for current epoch
        if (fixedDuration) {
            _updateEpoch();
            userToLockedEpochs[user].push(currentEpoch);
            lockedStakes[currentEpoch][user] += sharesToMint;
            epochToLockedAmount[currentEpoch] += sharesToMint;
        }

        emit SharesClaimed(user, saleId, sharesToMint, fixedDuration);
    }

    /**
     * @notice Withdraw staked LP shares and receive proportional tokens
     * @param shares Amount of shares to burn
     */
    function withdraw(uint256 shares) external updateReward(msg.sender) {
        require(shares > 0, "LPStaking: Amount must be greater than zero");

        _updateLockedStakes(msg.sender);

        // Check if user has enough unlocked shares
        uint256 lockedBalance = lockedStakes[currentEpoch][msg.sender] +
                                lockedStakes[currentEpoch - 1][msg.sender];
        uint256 unlockedShares = balanceOf(msg.sender) - lockedBalance;
        require(unlockedShares >= shares, "LPStaking: Insufficient unlocked balance");

        // Burn shares
        _burn(msg.sender, shares);
        totalStakedValue -= shares;

        // Calculate proportional withdrawal (simplified - in production would decrease liquidity)
        // For now, we'll revert as this requires complex Uniswap position management
        revert("LPStaking: Withdrawal not yet implemented - positions are locked");

        emit SharesWithdrawn(msg.sender, shares, 0, 0);
    }

    /**
     * @notice Collect trading fees from a specific LP position
     * @param saleId The sale ID whose position to collect from
     */
    function collectFees(uint256 saleId) external {
        require(lpPositions[saleId].initialized, "LPStaking: Position not initialized");

        LPPosition storage position = lpPositions[saleId];

        // Collect all available fees
        IPositionManager.CollectParams memory params =
            IPositionManager.CollectParams({
                tokenId: position.tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        (uint256 amount0, uint256 amount1) = positionManager.collect(params);

        // Fees collected are reinvested into the position or distributed
        // For now, we'll keep them in the contract

        emit FeesCollected(saleId, amount0, amount1);
    }

    /**
     * @notice Claim accumulated rewards
     */
    function claimRewards() external updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            require(
                wlfToken.transfer(msg.sender, reward),
                "LPStaking: Reward transfer failed"
            );
            emit RewardsDistributed(msg.sender, reward);
        }
    }

    ///////////////////////////////////////
    //           Public Functions        //
    ///////////////////////////////////////

    /**
     * @notice Calculate current APY based on staking ratio
     * @return Current APY in basis points (scaled by PERCENTAGE_SCALE)
     */
    function calculateAPY() public view returns (uint256) {
        uint256 wlfTotalSupply = wlfToken.totalSupply();
        if (wlfTotalSupply == 0 || totalStakedValue == 0) {
            return MIN_APY;
        }

        // Calculate staking ratio (total staked value / total supply)
        uint256 stakingRatio = (totalStakedValue * SCALE) / wlfTotalSupply;

        // Halflife decay: APY halves every 0.1 (10%) change in ratio
        uint256 exponent = stakingRatio / 1e17; // leaving 1 decimal precision

        uint256 currentApy = SCALE * MIN_APY + ((MAX_APY - MIN_APY) * SCALE) / (2 ** exponent);

        return currentApy / SCALE;
    }

    /**
     * @notice Get the value of an LP position
     * @param saleId The sale ID to query
     * @return wlf WLF amount in position
     * @return usdt USDT amount in position
     */
    function getPositionValue(uint256 saleId)
        public
        view
        returns (uint256 wlf, uint256 usdt)
    {
        require(lpPositions[saleId].initialized, "LPStaking: Position not initialized");

        LPPosition storage position = lpPositions[saleId];

        // In production, this would query actual liquidity amounts from Uniswap
        // For now, return stored values
        return (position.totalWLF, position.totalUSDT);
    }

    /**
     * @notice Required by IERC721Receiver to accept NFT transfers
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    ///////////////////////////////////////
    //           Internal Functions      //
    ///////////////////////////////////////

    /**
     * @notice Update epoch if duration has passed
     */
    function _updateEpoch() internal {
        if (block.timestamp >= lastEpochUpdate + EPOCH_DURATION) {
            currentEpoch++;
            lastEpochUpdate = block.timestamp;
        }
    }

    /**
     * @notice Update reward per share based on APY
     */
    function _updateRewardPerShare() internal {
        if (totalStakedValue == 0) {
            lastUpdateTime = block.timestamp;
            return;
        }

        if (block.timestamp == lastUpdateTime) {
            return;
        }

        uint256 timeSinceLastUpdate = block.timestamp - lastUpdateTime;
        uint256 apy = calculateAPY();

        // Calculate rewards accrued: (totalStaked * APY * time) / year
        uint256 rewardPerSecond = (totalStakedValue * apy) / YEAR_IN_TIME / PERCENTAGE_SCALE;
        uint256 reward = rewardPerSecond * timeSinceLastUpdate;

        if (totalSupply() > 0) {
            rewardPerShareStored += (reward * SCALE) / totalSupply();
        }

        lastUpdateTime = block.timestamp;
    }

    /**
     * @notice Calculate earned rewards for an account
     */
    function _earned(address account) internal view returns (uint256) {
        return
            (balanceOf(account) * (rewardPerShareStored - userRewardPerSharePaid[account])) /
            SCALE +
            rewards[account];
    }

    /**
     * @notice Update locked stakes for a user (copied from Staking.sol)
     * @param _user The address of the user to update
     */
    function _updateLockedStakes(address _user) internal {
        uint256 reward;
        uint256 indecesToRemoveBitMap;

        _updateEpoch();

        for (uint256 i = 0; i < userToLockedEpochs[_user].length; i++) {
            if (userToLockedEpochs[_user][i] >= (currentEpoch - 1)) {
                continue;
            }
            indecesToRemoveBitMap = indecesToRemoveBitMap | (1 << i);
            uint256 epoch = userToLockedEpochs[_user][i];
            uint256 lockedAmount = lockedStakes[epoch][_user];
            reward += _lockStakeBonusRewards(lockedAmount);
        }

        if (indecesToRemoveBitMap == 0) {
            return;
        }

        uint256 mostSigbit = _mostSignificantBit(indecesToRemoveBitMap);
        for (uint256 i = 0; i <= mostSigbit; i++) {
            if ((indecesToRemoveBitMap & (1 << i)) != 0) {
                _removeEpochFromUser(_user, i);
            }
        }

        if (reward > 0) {
            rewards[_user] += reward;
            emit LockedStakesUpdated(_user, reward);
        }
    }

    /**
     * @notice Calculate bonus rewards for locked stakes
     */
    function _lockStakeBonusRewards(uint256 _amount) internal pure returns (uint256) {
        return (_amount * LOCKED_STAKE_BONUS_APY * EPOCH_DURATION) /
               (YEAR_IN_TIME * PERCENTAGE_SCALE);
    }

    /**
     * @notice Remove an epoch from a user's locked epochs array
     */
    function _removeEpochFromUser(address _user, uint256 _index) internal {
        uint256 lastEpoch = userToLockedEpochs[_user].length - 1;
        userToLockedEpochs[_user][_index] = userToLockedEpochs[_user][lastEpoch];
        userToLockedEpochs[_user].pop();
    }

    /**
     * @notice Find the most significant bit (copied from Staking.sol)
     */
    function _mostSignificantBit(uint256 x) internal pure returns (uint256 msb) {
        assembly {
            let f := shl(7, gt(x, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF))
            x := shr(f, x)
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
}
