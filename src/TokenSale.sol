// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./WerewolfTokenV1.sol";
import "./Treasury.sol";
import "./Staking.sol";
import "./interfaces/ILPStaking.sol";

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

// Uniswap v3 NFT interface for transferring LP tokens
interface INonfungiblePositionManager {
    function transferFrom(address from, address to, uint256 tokenId) external;
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
    mapping(uint256 saleId => uint256 lpTokenId) public saleLPTokenId;
    mapping(uint256 saleId => bool lpCreated) public saleLPCreated;

    // Uniswap parameters
    int24 public tickLower = -887272;  // Near full range
    int24 public tickUpper = 887272;
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
        address _uniswapHelper
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
        // Set floor price for token sales
        price = 0.001 * 10 ** 18;
    }

    function setUsdtTokenAddress(address _usdtTokenAddress) external onlyOwner {
        require(_usdtTokenAddress != address(0), "USDT address cannot be zero");
        usdtTokenAddress = _usdtTokenAddress;
        usdtToken = IERC20(_usdtTokenAddress);
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
        currentSale.tokensAvailable -= _amount;

        // Track purchase for later LP share claiming
        purchases[saleIdCounter][msg.sender] += tokenAmount;
        saleWLFCollected[saleIdCounter] += tokenAmount;
        saleUSDTCollected[saleIdCounter] += usdtRequired;

        emit TokensPurchased(msg.sender, _amount, saleIdCounter);

        // End the sale if no tokens are left
        if (currentSale.tokensAvailable == 0) {
            _endSale();
        }
    }

    function _endSale() internal {
        require(saleActive, "Sale is not active");

        uint256 currentSale = saleIdCounter;
        Sale storage sale = sales[currentSale];

        // Mark sale as inactive
        sale.active = false;
        saleActive = false;

        // Get aggregated amounts
        uint256 totalWLF = saleWLFCollected[currentSale];
        uint256 totalUSDT = saleUSDTCollected[currentSale];

        // Handle case where no purchases were made
        if (totalWLF == 0 || totalUSDT == 0) {
            emit SaleEnded(currentSale);
            return;
        }

        // Approve UniswapHelper to spend tokens
        werewolfToken.approve(address(uniswapHelper), totalWLF);
        usdtToken.approve(address(uniswapHelper), totalUSDT);

        // Create LP position
        uint256 tokenId = uniswapHelper.addLiquidity(
            address(werewolfToken),
            address(usdtToken),
            poolFee,
            tickLower,
            tickUpper,
            totalWLF,
            totalUSDT
        );

        // Transfer LP NFT to LPStaking
        address positionManagerAddr = uniswapHelper.positionManager();
        INonfungiblePositionManager(positionManagerAddr).transferFrom(
            address(this),
            address(lpStaking),
            tokenId
        );

        // Initialize LP position in staking contract
        lpStaking.initializeLPPosition(
            currentSale,
            tokenId,
            totalWLF,
            totalUSDT
        );

        saleLPTokenId[currentSale] = tokenId;
        saleLPCreated[currentSale] = true;

        emit SaleEnded(currentSale);
        emit LPCreated(currentSale, tokenId, totalWLF, totalUSDT);
    }

    function endSale() external onlyOwner {
        _endSale();
    }

    /**
     * @notice Claim LP shares after sale ends
     * @param saleId The sale to claim from
     * @param fixedDuration True for 5-year lock with bonus APY
     */
    function claimLPShares(uint256 saleId, bool fixedDuration) external {
        require(!sales[saleId].active, "Sale still active");
        require(saleLPCreated[saleId], "LP not created yet");

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
