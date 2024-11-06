// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

import "./WerewolfTokenV1.sol";
import "./Treasury.sol";
import "./Staking.sol";

contract TokenSale is Ownable {
    WerewolfTokenV1 private werewolfToken;
    Treasury private treasury;
    address public usdtTokenAddress;
    IERC20 public usdtToken;
    Staking public stakingContract;
    IUniswapV3Pool public uniswapRouter;
    uint256 public price;
    uint256 public saleIdCounter;
    bool public saleActive;

    INonfungiblePositionManager public positionManager;
    ISwapRouter public swapRouter;

    struct Sale {
        uint256 saleId;
        uint256 tokensAvailable;
        uint256 price;
        bool active;
    }

    mapping(uint256 => Sale) public sales;

    event SaleStarted(uint256 saleId, uint256 tokensAvailable, uint256 price);
    event SaleEnded(uint256 saleId);
    event TokensPurchased(
        address indexed buyer,
        uint256 amount,
        uint256 saleId
    );

    constructor(
        address _token,
        address _treasury,
        address _timelock,
        address _usdtTokenAddress,
        address _stakingAddress,
        address _uniswapRouter,
        address _positionManager,
        address _swapRouter
    ) Ownable(msg.sender) {
        require(_usdtTokenAddress != address(0), "USDT address cannot be zero");
        usdtTokenAddress = _usdtTokenAddress;
        usdtToken = IERC20(_usdtTokenAddress);
        werewolfToken = WerewolfTokenV1(_token);
        stakingContract = Staking(_stakingAddress);
        treasury = Treasury(_treasury);
        uniswapRouter = IUniswapV3Pool(_uniswapRouter);
        positionManager = INonfungiblePositionManager(_positionManager);
        swapRouter = ISwapRouter(_swapRouter);
        // Hard code first price
        price = 0.001 * 10 ** 18;
    }

    function setUniswapRouter(address _uniswapRouter) external onlyOwner {
        uniswapRouter = IUniswapV3Pool(_uniswapRouter);
    }

    function setUsdtTokenAddress(address _usdtTokenAddress) external onlyOwner {
        require(_usdtTokenAddress != address(0), "USDT address cannot be zero");
        usdtTokenAddress = _usdtTokenAddress;
        usdtToken = IERC20(_usdtTokenAddress);
    }

    function _addLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        int24 tickLower,
        int24 tickUpper
    )
        internal
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        // Transfer tokens from the caller to the contract for liquidity provision
        IERC20(werewolfToken).transferFrom(
            msg.sender,
            address(this),
            amount0Desired
        );
        IERC20(usdtToken).transferFrom(
            msg.sender,
            address(this),
            amount1Desired
        );

        // Approve the position manager to spend the tokens
        IERC20(werewolfToken).approve(address(positionManager), amount0Desired);
        IERC20(usdtToken).approve(address(positionManager), amount1Desired);

        // Define the mint parameters
        INonfungiblePositionManager.MintParams
            memory params = INonfungiblePositionManager.MintParams({
                werewolfToken: werewolfToken,
                usdtToken: usdtToken,
                fee: 3000, // Pool fee (0.3%)
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                recipient: msg.sender,
                deadline: block.timestamp + 15
            });

        // Mint the position, which creates an NFT representing the liquidity position
        (tokenId, liquidity, amount0, amount1) = positionManager.mint(params);
    }

    function startSale(uint256 _amount, uint256 _price) external onlyOwner {
        require(!saleActive, "Sale is already active.");
        require(_amount > 0, "Amount must be greater than zero.");
        require(
            _price >= price,
            "Price must be greater or equal to prev price."
        );
        require(
            werewolfToken.balanceOf(address(this)) >= _amount,
            "Not enough tokens for sale."
        );

        saleIdCounter++;
        sales[saleIdCounter] = Sale(saleIdCounter, _amount, _price, true);
        price = _price;
        saleActive = true;

        emit SaleStarted(saleIdCounter, _amount, _price);
    }

    function buyTokens(uint256 _amount) external {
        require(saleActive, "Sale is not active");
        Sale storage currentSale = sales[saleIdCounter];
        require(
            currentSale.tokensAvailable >= _amount,
            "Not enough tokens available for sale"
        );

        uint256 tokenAmount = _amount * 10 ** werewolfToken.decimals();
        uint256 usdtRequired = _amount * currentSale.price;

        // Transfer USDT from buyer to this contract
        require(
            usdtToken.transferFrom(msg.sender, address(this), usdtRequired),
            "USDT transfer failed"
        );

        // Transfer tokens to staking contract
        currentSale.tokensAvailable -= _amount;
        require(
            werewolfToken.transfer(address(stakingContract), tokenAmount),
            "Token transfer to staking contract failed"
        );

        // Stake tokens in staking contract for msg.sender with a 10-year lock
        stakingContract.stakeFixedDuration(
            msg.sender,
            tokenAmount,
            10 * 365 days
        );

        // Add liquidity to Uniswap pool
        require(
            usdtToken.approve(address(uniswapRouter), usdtRequired),
            "Approval of USDT for liquidity failed"
        );
        require(
            werewolfToken.approve(address(uniswapRouter), tokenAmount),
            "Approval of tokens for liquidity failed"
        );

        _addLiquidity(
            address(usdtToken),
            address(werewolfToken),
            usdtRequired,
            tokenAmount,
            0, // Minimum amount of USDT for slippage tolerance
            0, // Minimum amount of tokens for slippage tolerance
            treasury, // Send liquidity tokens to the treasury
            block.timestamp + 300 // Transaction deadline of 5 minutes
        );

        emit TokensPurchased(msg.sender, _amount, saleIdCounter);

        // End the sale if no tokens are left
        if (currentSale.tokensAvailable == 0) {
            _endSale();
        }
    }

    function _endSale() internal onlyOwner {
        require(saleActive, "Sale is not active");
        sales[saleIdCounter].active = false;
        saleActive = false;

        emit SaleEnded(saleIdCounter);
    }

    function endSale() external onlyOwner {
        _endSale();
    }
}
