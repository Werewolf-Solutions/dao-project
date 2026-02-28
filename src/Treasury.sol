// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./WerewolfTokenV1.sol";
import "./Staking.sol";
import "./interfaces/ILPStaking.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

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

    // Buyback configuration
    address public swapRouter;
    address public usdtToken;
    uint24 public buybackPoolFee;

    event RewardsDistributed(address indexed stakingContract, uint256 amount);
    event WLFBuyback(uint256 usdtSpent, uint256 wlfReceived);

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

    /**
     * @notice Configure the Uniswap v3 swap router used for WLF buybacks.
     *         Called by owner (Timelock/DAO) to set or update the router.
     * @param _router  Uniswap v3 SwapRouter address
     * @param _usdt    USDT token address held by treasury
     * @param _fee     Pool fee tier (e.g. 500 for 0.05%)
     */
    function setSwapRouter(address _router, address _usdt, uint24 _fee) external onlyOwner {
        require(_router != address(0), "Invalid router");
        require(_usdt   != address(0), "Invalid USDT");
        swapRouter    = _router;
        usdtToken     = _usdt;
        buybackPoolFee = _fee;
    }

    /**
     * @notice Use treasury USDT to buy back WLF from the Uniswap pool.
     *         Purchased WLF stays in the treasury. Callable by owner (DAO proposal).
     * @param usdtAmount  USDT to spend (6-decimal units)
     * @param minWLFOut   Minimum WLF to receive (slippage guard; 0 = no minimum)
     * @return wlfReceived  Actual WLF received and now held by treasury
     */
    function buybackWLF(uint256 usdtAmount, uint256 minWLFOut) external onlyOwner returns (uint256 wlfReceived) {
        require(swapRouter != address(0), "Swap router not set");
        require(usdtAmount > 0, "Amount must be > 0");
        require(IERC20(usdtToken).balanceOf(address(this)) >= usdtAmount, "Insufficient USDT");

        IERC20(usdtToken).approve(swapRouter, usdtAmount);

        wlfReceived = ISwapRouter(swapRouter).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn:           usdtToken,
                tokenOut:          address(werewolfToken),
                fee:               buybackPoolFee,
                recipient:         address(this),
                deadline:          block.timestamp + 30 minutes,
                amountIn:          usdtAmount,
                amountOutMinimum:  minWLFOut,
                sqrtPriceLimitX96: 0
            })
        );

        emit WLFBuyback(usdtAmount, wlfReceived);
    }
}
