// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import "./WerewolfTokenV1.sol";
import "./Treasury.sol";
import "./Staking.sol";

contract TokenSale is Ownable {
    WerewolfTokenV1 private werewolfToken;
    Treasury private treasury;
    address public usdtTokenAddress;
    IERC20 public usdtToken;
    Staking public stakingContract;
    IUniswapV2Router02 public uniswapRouter;
    uint256 public price;
    uint256 public saleIdCounter;
    bool public saleActive;

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
        address _uniswapRouter
    ) Ownable(msg.sender) {
        require(_usdtTokenAddress != address(0), "USDT address cannot be zero");
        usdtTokenAddress = _usdtTokenAddress;
        usdtToken = IERC20(_usdtTokenAddress);
        werewolfToken = WerewolfTokenV1(_token);
        stakingContract = Staking(_stakingAddress);
        treasury = Treasury(_treasury);
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        // Hard code first price
        price = 0.001 * 10 ** 18;
    }

    function setUniswapRouter(address _uniswapRouter) external onlyOwner {
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
    }

    function setUsdtTokenAddress(address _usdtTokenAddress) external onlyOwner {
        require(_usdtTokenAddress != address(0), "USDT address cannot be zero");
        usdtTokenAddress = _usdtTokenAddress;
        usdtToken = IERC20(_usdtTokenAddress);
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
        stakingContract.stakeFor(msg.sender, tokenAmount, 10 * 365 days);

        // Add liquidity to Uniswap pool
        require(
            usdtToken.approve(uniswapRouter, usdtRequired),
            "Approval of USDT for liquidity failed"
        );
        require(
            werewolfToken.approve(uniswapRouter, tokenAmount),
            "Approval of tokens for liquidity failed"
        );

        uniswapRouter.addLiquidity(
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
