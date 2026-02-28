// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./WerewolfTokenV1.sol";
import "./Treasury.sol";
import "./Staking.sol";
import "./interfaces/ILPStaking.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

interface IDAODelegation {
    function autoDelegate(address user, address delegatee) external;
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
    address public daoContract;
    address public founder; // deployer address — persists after ownership transfer to Timelock

    uint256 public price;
    uint256 public saleIdCounter = 0;
    bool public saleActive;

    // Purchase tracking for LP aggregation
    mapping(uint256 saleId => mapping(address buyer => uint256 wlfAmount)) public purchases;
    mapping(uint256 saleId => uint256 totalWLFCollected) public saleWLFCollected;
    mapping(uint256 saleId => uint256 totalUSDTCollected) public saleUSDTCollected;
    mapping(uint256 saleId => uint256 wlfFromUSDT) public saleUSDTWLFCollected; // WLF paired with USDT
    mapping(uint256 saleId => uint256 lpTokenId) public saleLPTokenId;
    mapping(uint256 saleId => bool lpCreated) public saleLPCreated;

    // Buyer tracking for auto-distribution in endSale()
    mapping(uint256 saleId => address[]) public saleBuyers;
    mapping(uint256 saleId => mapping(address => bool)) private _buyerTracked;

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

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address newOwner,
        address _token,
        address _treasury,
        address /* _timelock */,
        address _usdtTokenAddress,
        address _stakingAddress,
        address _lpStakingAddress,
        address _uniswapHelper
    ) public initializer {
        __Ownable_init(newOwner); //we do not want the msg.sender to be the owner since that will be the proxyAdmin
        founder = newOwner; // persists after ownership is transferred to Timelock
        require(_usdtTokenAddress != address(0), "USDT address cannot be zero");
        usdtTokenAddress = _usdtTokenAddress;
        usdtToken = IERC20(_usdtTokenAddress);
        werewolfToken = WerewolfTokenV1(_token);
        stakingContract = Staking(_stakingAddress);
        treasury = Treasury(_treasury);
        lpStaking = ILPStaking(_lpStakingAddress);
        uniswapHelper = IUniswapHelper(_uniswapHelper);
        // Set floor price for token sales (Sale #0 price)
        price = 0.0004 * 10 ** 18;
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

    function setDaoContract(address _dao) external onlyOwner {
        daoContract = _dao;
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

        // Track unique buyers for auto-distribution in endSale()
        if (!_buyerTracked[saleIdCounter][msg.sender]) {
            _buyerTracked[saleIdCounter][msg.sender] = true;
            saleBuyers[saleIdCounter].push(msg.sender);
        }

        emit TokensPurchased(msg.sender, _amount, saleIdCounter);

        // Auto-close sale when last token is sold (LP creation is a separate tx via endSale())
        if (currentSale.tokensAvailable == 0) {
            currentSale.active = false;
            saleActive = false;
            emit SaleEnded(saleIdCounter);
        }
    }

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
        uint256 totalUSDT    = saleUSDTCollected[currentSale];

        // Handle case where no purchases were made
        if (totalWLFSold == 0) return;

        // Prevent double LP creation if endSale() is called more than once
        require(!saleLPCreated[currentSale], "LP already created for this sale");

        address positionManagerAddr = uniswapHelper.positionManager();

        // ── USDT/WLF LP ──
        if (wlfForUSDT > 0 && totalUSDT > 0) {
            // Snapshot balances before LP creation so we know the actual amounts used.
            // UniswapHelper deposits tokens at the CURRENT POOL PRICE ratio and returns
            // any excess back to this contract — so desired amounts may not all be used.
            uint256 wlfBefore  = werewolfToken.balanceOf(address(this));
            uint256 usdtBefore = usdtToken.balanceOf(address(this));

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

            // Actual amounts consumed by Uniswap (desired minus what was returned as excess)
            uint256 wlfUsed  = wlfBefore  - werewolfToken.balanceOf(address(this));
            uint256 usdtUsed = usdtBefore - usdtToken.balanceOf(address(this));

            INonfungiblePositionManager(positionManagerAddr).transferFrom(
                address(this),
                address(lpStaking),
                usdtTokenId
            );

            // Record actual amounts — not desired — so position value is accurate
            lpStaking.initializeLPPosition(
                currentSale,
                usdtTokenId,
                wlfUsed,
                usdtUsed,
                totalWLFSold
            );

            saleLPTokenId[currentSale] = usdtTokenId;
            saleLPCreated[currentSale] = true;
            emit LPCreated(currentSale, usdtTokenId, wlfUsed, usdtUsed);

            // Forward any excess tokens (caused by price mismatch between sales) to treasury.
            // At sale #1 the pool price may still reflect sale #0's lower price; Uniswap
            // accepts fewer tokens than desired and returns the remainder here.
            uint256 excessWlf  = wlfForUSDT - wlfUsed;
            uint256 excessUsdt = totalUSDT  - usdtUsed;
            if (excessWlf  > 0) werewolfToken.transfer(address(treasury), excessWlf);
            if (excessUsdt > 0) usdtToken.transfer(address(treasury), excessUsdt);
        }

        // ── Auto-distribute LP shares to all buyers (5-year lock) ──
        address[] storage buyers = saleBuyers[currentSale];
        for (uint256 i = 0; i < buyers.length; i++) {
            address buyer = buyers[i];
            uint256 amt = purchases[currentSale][buyer];
            if (amt == 0) continue;
            purchases[currentSale][buyer] = 0;
            lpStaking.claimShares(buyer, currentSale, amt, true);
            // Auto-delegate ALL voting power from early sales (#0, #1) to founder for 2 years
            if (daoContract != address(0) && currentSale <= 1) {
                IDAODelegation(daoContract).autoDelegate(buyer, founder);
            }
            emit LPSharesClaimed(buyer, currentSale, amt, true);
        }
    }

    function endSale() external {
        // Owner can force-end at any time; anyone can create LP after sale auto-closes
        require(!saleActive || msg.sender == owner(), "Only owner can end an active sale");
        _endSale();
    }

    /**
     * @notice Apply voting delegations to the founder for all buyers in an early sale (#0 or #1).
     *         Callable by anyone — useful if daoContract was set after endSale() ran, or to
     *         re-apply delegations for buyers who were missed.
     * @param saleId The sale to apply delegations for (must be <= 1)
     */
    function applyDelegations(uint256 saleId) external {
        require(saleId <= 1, "Only early sales #0 and #1 require delegation");
        require(!sales[saleId].active, "Sale still active");
        require(saleLPCreated[saleId], "LP not created yet, call endSale() first");
        require(daoContract != address(0), "DAO contract not set");

        address[] storage buyers = saleBuyers[saleId];
        for (uint256 i = 0; i < buyers.length; i++) {
            IDAODelegation(daoContract).autoDelegate(buyers[i], founder);
        }
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
