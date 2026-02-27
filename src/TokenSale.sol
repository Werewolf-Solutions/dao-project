// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./WerewolfTokenV1.sol";
import "./Treasury.sol";
import "./Staking.sol";
import "./interfaces/ILPStaking.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

interface IWETH9 {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}

// Define an interface for UniswapHelper to interact with it
interface ILiquidityExamples {
    function addLiquidity(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external returns (uint256 tokenId);
}

interface IUniswapHelper {
    function addLiquidity(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external returns (uint256 tokenId);

    function positionManager() external view returns (address);
}

contract TokenSale is OwnableUpgradeable {
    WerewolfTokenV1 private werewolfToken;
    Treasury private treasury;
    address public usdtTokenAddress;
    IERC20 public usdtToken;
    Staking public stakingContract;
    ILiquidityExamples public liquidityExamplesContract;
    ILPStaking public lpStaking;
    IUniswapHelper public uniswapHelper;

    uint256 public price;
    uint256 public saleIdCounter = 0;
    bool public saleActive;

    // Purchase tracking for LP aggregation
    mapping(uint256 saleId => mapping(address buyer => uint256 wlfAmount)) public purchases;
    mapping(uint256 saleId => uint256 totalWLFCollected) public saleWLFCollected;
    mapping(uint256 saleId => uint256 totalUSDTCollected) public saleUSDTCollected;
    mapping(uint256 saleId => uint256 totalETHCollected) public saleETHCollected;
    mapping(uint256 saleId => uint256 wlfFromUSDT) public saleUSDTWLFCollected; // WLF paired with USDT
    mapping(uint256 saleId => uint256 lpTokenId) public saleLPTokenId;
    mapping(uint256 saleId => bool lpCreated) public saleLPCreated;
    mapping(uint256 saleId => uint256 lpTokenId) public saleLPTokenIdETH;  // ETH/WLF LP NFT
    mapping(uint256 saleId => bool lpCreated) public saleLPETHCreated;

    // WETH address for ETH/WLF LP creation
    address public wethAddress;

    // Uniswap parameters
    int24 public tickLower = -887270;  // Full range for fee 500 (tickSpacing=10): must be multiple of 10
    int24 public tickUpper = 887270;
    uint24 public poolFee = 500;       // 0.05% fee tier

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
    event LPCreated(uint256 indexed saleId, uint256 tokenId, uint256 wlf, uint256 usdt);
    event LPSharesClaimed(address indexed user, uint256 indexed saleId, uint256 amount, bool fixedDuration);

    // BUG: remove address _uniswapHelper
    constructor()
    /* address _token,
        address _treasury,
        address _timelock,
        address _usdtTokenAddress,
        address _stakingAddress,
        address _uniswapHelper */
    {
        /*      require(_usdtTokenAddress != address(0), "USDT address cannot be zero");
        usdtTokenAddress = _usdtTokenAddress;
        usdtToken = IERC20(_usdtTokenAddress);
        werewolfToken = WerewolfTokenV1(_token);
        stakingContract = Staking(_stakingAddress);
        treasury = Treasury(_treasury);
        uniswapHelper = IUniswapHelper(_uniswapHelper);
        // Set floor price for token sales
        price = 0.001 * 10 ** 18; */

        //disable initializer
        _disableInitializers();
    }

    function initialize(
        address newOwner,
        address _token,
        address _treasury,
        address _timelock,
        address _usdtTokenAddress,
        address _stakingAddress,
        address _lpStakingAddress,
        address _uniswapHelper,
        address _wethAddress
    ) public initializer {
        __Ownable_init(newOwner); //we do not want the msg.sender to be the owner since that will be the proxyAdmin
        require(_usdtTokenAddress != address(0), "USDT address cannot be zero");
        usdtTokenAddress = _usdtTokenAddress;
        usdtToken = IERC20(_usdtTokenAddress);
        werewolfToken = WerewolfTokenV1(_token);
        stakingContract = Staking(_stakingAddress);
        treasury = Treasury(_treasury);
        lpStaking = ILPStaking(_lpStakingAddress);
        uniswapHelper = IUniswapHelper(_uniswapHelper);
        wethAddress = _wethAddress;
        // Set floor price for token sales
        price = 0.001 * 10 ** 18;
        // Set Uniswap LP parameters in proxy storage
        // (declaration-time defaults don't apply to proxy storage in upgradeable contracts)
        tickLower = -887270;  // full-range for fee 500 (tickSpacing = 10)
        tickUpper =  887270;
        poolFee   =  500;     // 0.05% fee tier
    }

    function setUsdtTokenAddress(address _usdtTokenAddress) external onlyOwner {
        require(_usdtTokenAddress != address(0), "USDT address cannot be zero");
        usdtTokenAddress = _usdtTokenAddress;
        usdtToken = IERC20(_usdtTokenAddress);
    }

    function setUniswapHelper(address _uniswapHelper) external onlyOwner {
        require(_uniswapHelper != address(0), "UniswapHelper address cannot be zero");
        uniswapHelper = IUniswapHelper(_uniswapHelper);
    }

    function setTicks(int24 _tickLower, int24 _tickUpper) external onlyOwner {
        tickLower = _tickLower;
        tickUpper = _tickUpper;
    }

    function setPoolFee(uint24 _poolFee) external onlyOwner {
        poolFee = _poolFee;
    }

    function startSaleZero(uint256 _amount, uint256 _price) external onlyOwner {
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

        sales[saleIdCounter] = Sale(saleIdCounter, _amount, _price, true);
        price = _price;
        saleActive = true;

        emit SaleStarted(saleIdCounter, _amount, _price);
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

    function buyTokens(
        uint256 _amount,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external {
        require(saleActive, "Sale is not active");
        Sale storage currentSale = sales[saleIdCounter];
        require(
            currentSale.tokensAvailable >= _amount,
            "Not enough tokens available for sale"
        );

        uint256 tokenAmount = amount0Desired; //_amount * 10 ** werewolfToken.decimals();
        uint256 usdtRequired = amount1Desired; //_amount * currentSale.price;

        // Transfer USDT from buyer to THIS contract (will be used for LP at sale end)
        require(
            usdtToken.transferFrom(
                msg.sender,
                address(this),
                usdtRequired
            ),
            "USDT transfer failed"
        );

        // Tokens are already in this contract, just track the sale
        currentSale.tokensAvailable -= tokenAmount;

        // Track purchase for later LP share claiming
        purchases[saleIdCounter][msg.sender] += tokenAmount;
        saleWLFCollected[saleIdCounter] += tokenAmount;
        saleUSDTWLFCollected[saleIdCounter] += tokenAmount;
        saleUSDTCollected[saleIdCounter] += usdtRequired;

        emit TokensPurchased(msg.sender, _amount, saleIdCounter);

        // Auto-close sale when last token is sold (LP creation is a separate tx via endSale())
        if (currentSale.tokensAvailable == 0) {
            currentSale.active = false;
            saleActive = false;
            emit SaleEnded(saleIdCounter);
        }
    }

    function buyTokensWithEth(uint256 _amount) external payable {
        require(saleActive, "Sale is not active");
        Sale storage currentSale = sales[saleIdCounter];
        require(currentSale.tokensAvailable >= _amount, "Not enough tokens available for sale");

        uint256 ethRequired = (_amount * price) / 10 ** 18;
        require(msg.value >= ethRequired, "Insufficient ETH sent");

        // Refund excess ETH
        if (msg.value > ethRequired) {
            payable(msg.sender).transfer(msg.value - ethRequired);
        }

        currentSale.tokensAvailable -= _amount;
        purchases[saleIdCounter][msg.sender] += _amount;
        saleWLFCollected[saleIdCounter] += _amount;
        saleETHCollected[saleIdCounter] += ethRequired;

        emit TokensPurchased(msg.sender, _amount, saleIdCounter);

        // Auto-close sale when last token is sold (LP creation is a separate tx via endSale())
        if (currentSale.tokensAvailable == 0) {
            currentSale.active = false;
            saleActive = false;
            emit SaleEnded(saleIdCounter);
        }
    }

    function withdrawETH(address payable to, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient ETH balance");
        to.transfer(amount);
    }

    receive() external payable {}

    function _endSale() internal {
        uint256 currentSale = saleIdCounter;
        Sale storage sale = sales[currentSale];

        // Close the sale if the owner is force-ending early; sold-out auto-close handles the normal case
        if (sale.active) {
            sale.active = false;
            saleActive = false;
            emit SaleEnded(currentSale);
        }

        uint256 totalWLFSold = saleWLFCollected[currentSale];
        uint256 wlfForUSDT   = saleUSDTWLFCollected[currentSale];
        uint256 wlfForETH    = totalWLFSold - wlfForUSDT;
        uint256 totalUSDT    = saleUSDTCollected[currentSale];
        uint256 totalETH     = saleETHCollected[currentSale];

        // Handle case where no purchases were made
        if (totalWLFSold == 0) return;

        // Prevent double LP creation if endSale() is called more than once
        require(!saleLPCreated[currentSale], "LP already created for this sale");

        address positionManagerAddr = uniswapHelper.positionManager();

        // ── USDT/WLF LP ──
        if (wlfForUSDT > 0 && totalUSDT > 0) {
            werewolfToken.approve(address(uniswapHelper), wlfForUSDT);
            usdtToken.approve(address(uniswapHelper), totalUSDT);

            uint256 usdtTokenId = uniswapHelper.addLiquidity(
                address(werewolfToken),
                address(usdtToken),
                poolFee,
                tickLower,
                tickUpper,
                wlfForUSDT,
                totalUSDT
            );

            INonfungiblePositionManager(positionManagerAddr).transferFrom(
                address(this),
                address(lpStaking),
                usdtTokenId
            );

            lpStaking.initializeLPPosition(
                currentSale,
                usdtTokenId,
                wlfForUSDT,
                totalUSDT,
                totalWLFSold
            );

            saleLPTokenId[currentSale] = usdtTokenId;
            saleLPCreated[currentSale] = true;
            emit LPCreated(currentSale, usdtTokenId, wlfForUSDT, totalUSDT);
        }

        // ── ETH/WLF LP ──
        if (wlfForETH > 0 && totalETH > 0) {
            // Wrap ETH → WETH
            IWETH9(wethAddress).deposit{value: totalETH}();

            werewolfToken.approve(address(uniswapHelper), wlfForETH);
            IERC20(wethAddress).approve(address(uniswapHelper), totalETH);

            uint256 ethTokenId = uniswapHelper.addLiquidity(
                address(werewolfToken),
                wethAddress,
                poolFee,
                tickLower,
                tickUpper,
                wlfForETH,
                totalETH
            );

            INonfungiblePositionManager(positionManagerAddr).transferFrom(
                address(this),
                address(lpStaking),
                ethTokenId
            );

            lpStaking.initializeETHLPPosition(
                currentSale,
                ethTokenId,
                wlfForETH,
                totalETH,
                totalWLFSold
            );

            saleLPTokenIdETH[currentSale] = ethTokenId;
            saleLPETHCreated[currentSale] = true;
            emit LPCreated(currentSale, ethTokenId, wlfForETH, totalETH);
        }
    }

    function endSale() external {
        // Owner can force-end at any time; anyone can create LP after sale auto-closes
        require(!saleActive || msg.sender == owner(), "Only owner can end an active sale");
        _endSale();
    }

    /**
     * @notice Claim LP shares after sale ends
     * @param saleId The sale to claim from
     * @param fixedDuration True for 5-year lock with bonus APY
     */
    function claimLPShares(uint256 saleId, bool fixedDuration) external {
        require(!sales[saleId].active, "Sale still active");
        require(saleLPCreated[saleId] || saleLPETHCreated[saleId], "LP not created yet");

        uint256 purchaseAmount = purchases[saleId][msg.sender];
        require(purchaseAmount > 0, "No purchase to claim");

        // Clear purchase to prevent double claiming
        purchases[saleId][msg.sender] = 0;

        // LPStaking mints shares proportional to purchase
        lpStaking.claimShares(
            msg.sender,
            saleId,
            purchaseAmount,
            fixedDuration
        );

        emit LPSharesClaimed(msg.sender, saleId, purchaseAmount, fixedDuration);
    }
}
