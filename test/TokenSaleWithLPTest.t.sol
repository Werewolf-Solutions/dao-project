// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {WerewolfTokenV1} from "../src/WerewolfTokenV1.sol";
import {Treasury} from "../src/Treasury.sol";
import {TokenSale} from "../src/TokenSale.sol";
import {LPStaking} from "../src/LPStaking.sol";
import {DAO} from "../src/DAO.sol";
import {UniswapHelper} from "../src/UniswapHelper.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";

/**
 * @dev A UniswapHelper mock that actually transfers tokens from the caller.
 *      This makes balance-snapshot accounting in _endSale() work correctly in tests.
 */
contract MockConsumeUniswapHelper {
    address public positionManager;

    constructor(address _pm) {
        positionManager = _pm;
    }

    function addLiquidity(
        address token0,
        address token1,
        uint24,
        int24,
        int24,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint16
    ) external returns (uint256 tokenId) {
        IERC20(token0).transferFrom(msg.sender, address(this), amount0Desired);
        IERC20(token1).transferFrom(msg.sender, address(this), amount1Desired);
        tokenId = uint256(keccak256(abi.encodePacked(block.timestamp, amount0Desired)));
    }
}

/**
 * @title TokenSaleWithLPTest
 * @notice Integration tests for the complete TokenSale → LP creation → Staking flow
 */
contract TokenSaleWithLPTest is Test {
    WerewolfTokenV1 public wlfToken;
    Treasury public treasury;
    TokenSale public tokenSale;
    LPStaking public lpStaking;
    DAO public dao;
    MockUSDT public usdtToken;
    UniswapHelper public uniswapHelper;
    MockConsumeUniswapHelper public mockHelper;

    address public owner;
    address public timelock;
    address public multiSig;
    address public user1;
    address public user2;
    address public user3;
    address public positionManager;

    uint256 constant TOKENS_FOR_SALE = 10_000_000 ether; // 10M WLF
    uint256 constant TOKEN_PRICE = 0.004 ether; // Price per WLF in USDT (18 decimals)

    event SaleStarted(uint256 saleId, uint256 tokensAvailable, uint256 price);
    event SaleEnded(uint256 saleId);
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 saleId);
    event LPCreated(uint256 indexed saleId, uint256 tokenId, uint256 wlf, uint256 usdt);
    event LPSharesClaimed(address indexed user, uint256 indexed saleId, uint256 amount, bool fixedDuration);
    event SharesClaimed(address indexed user, uint256 indexed saleId, uint256 shares, bool fixedDuration);

    function setUp() public {
        owner = makeAddr("owner");
        timelock = makeAddr("timelock");
        multiSig = makeAddr("multiSig");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        positionManager = makeAddr("positionManager");

        vm.startPrank(owner);

        // Deploy WLF Token
        WerewolfTokenV1 wlfImpl = new WerewolfTokenV1();
        bytes memory wlfInitData = abi.encodeWithSelector(
            WerewolfTokenV1.initialize.selector,
            owner,
            owner, // treasury placeholder
            owner, // timelock placeholder
            owner,
            address(0x1)
        );
        TransparentUpgradeableProxy wlfProxy = new TransparentUpgradeableProxy(
            address(wlfImpl),
            multiSig,
            wlfInitData
        );
        wlfToken = WerewolfTokenV1(address(wlfProxy));

        // Deploy USDT
        usdtToken = new MockUSDT(1_000_000_000e6); // 1B USDT

        // Deploy Treasury
        Treasury treasuryImpl = new Treasury();
        bytes memory treasuryInitData = abi.encodeWithSelector(
            Treasury.initialize.selector,
            owner
        );
        TransparentUpgradeableProxy treasuryProxy = new TransparentUpgradeableProxy(
            address(treasuryImpl),
            multiSig,
            treasuryInitData
        );
        treasury = Treasury(address(treasuryProxy));
        treasury.setWerewolfToken(address(wlfToken));

        // Deploy UniswapHelper (not upgradeable)
        uniswapHelper = new UniswapHelper(positionManager);

        // Deploy consuming mock so balance snapshots in _endSale() work correctly
        mockHelper = new MockConsumeUniswapHelper(positionManager);

        // Deploy LPStaking
        LPStaking lpStakingImpl = new LPStaking();
        bytes memory lpStakingInitData = abi.encodeWithSelector(
            LPStaking.initialize.selector,
            address(wlfToken),
            address(usdtToken),
            owner,
            address(treasury),
            positionManager
        );
        TransparentUpgradeableProxy lpStakingProxy = new TransparentUpgradeableProxy(
            address(lpStakingImpl),
            multiSig,
            lpStakingInitData
        );
        lpStaking = LPStaking(address(lpStakingProxy));

        // Deploy TokenSale
        TokenSale tokenSaleImpl = new TokenSale();
        bytes memory tokenSaleInitData = abi.encodeWithSelector(
            TokenSale.initialize.selector,
            owner,
            address(wlfToken),
            address(treasury),
            timelock,
            address(usdtToken),
            address(0), // staking contract (old system)
            address(lpStaking),
            address(uniswapHelper)
        );
        TransparentUpgradeableProxy tokenSaleProxy = new TransparentUpgradeableProxy(
            address(tokenSaleImpl),
            multiSig,
            tokenSaleInitData
        );
        tokenSale = TokenSale(payable(address(tokenSaleProxy)));

        // Wire the consuming mock helper into tokenSale so balance snapshots work
        tokenSale.setUniswapHelper(address(mockHelper));

        // Configure LPStaking
        lpStaking.setTokenSaleContract(address(tokenSale));

        // Configure Treasury
        treasury.setLPStakingContract(address(lpStaking));

        // Deploy DAO (timelock is a plain address — no timelock calls in delegation tests)
        DAO daoImpl = new DAO();
        bytes memory daoInitData = abi.encodeWithSelector(
            DAO.initialize.selector,
            address(wlfToken),
            address(treasury),
            timelock,
            owner // guardian
        );
        TransparentUpgradeableProxy daoProxy = new TransparentUpgradeableProxy(
            address(daoImpl),
            multiSig,
            daoInitData
        );
        dao = DAO(address(daoProxy));

        // Connect DAO <-> TokenSale for auto-delegation on sales #0 and #1
        dao.setTokenSaleContract(address(tokenSale));
        tokenSale.setDaoContract(address(dao));
        // Register LPStaking so DAO can query LP voting power
        dao.setStakingContracts(address(0), address(lpStaking));

        // Airdrop tokens to TokenSale
        wlfToken.airdrop(address(tokenSale), TOKENS_FOR_SALE);

        // Fund users with USDT
        usdtToken.mint(user1, 10_000e6); // 10k USDT
        usdtToken.mint(user2, 20_000e6); // 20k USDT
        usdtToken.mint(user3, 30_000e6); // 30k USDT

        vm.stopPrank();
    }

    function test_FullLPStakingFlow() public {
        // 1. Start sale
        vm.prank(owner);
        tokenSale.startSaleZero(TOKENS_FOR_SALE, TOKEN_PRICE);

        // 2-3. Make partial purchases
        _makePurchase(user1, 3_000_000 ether, 3_000e6);
        _makePurchase(user2, 4_000_000 ether, 4_000e6);

        // 4. Buy last batch (auto-closes sale), then create LP + auto-distribute shares
        uint256 totalWLF = 10_000_000 ether;
        uint256 totalUSDT = 10_000e6;
        _mockUniswapForEndSale(totalWLF, totalUSDT);
        _makePurchase(user3, 3_000_000 ether, 3_000e6);
        tokenSale.endSale(); // creates LP and auto-distributes shares to all buyers

        // Verify proportional distribution happened automatically (no claimLPShares needed)
        _verifyProportionalShares();
    }

    function _makePurchase(address user, uint256 wlfAmount, uint256 usdtAmount) internal {
        vm.startPrank(user);
        usdtToken.approve(address(tokenSale), usdtAmount);
        tokenSale.buyTokens(wlfAmount / 1e18, wlfAmount, usdtAmount);
        vm.stopPrank();
    }

    function _verifyProportionalShares() internal {
        uint256 shares1 = lpStaking.balanceOf(user1);
        uint256 shares2 = lpStaking.balanceOf(user2);
        uint256 shares3 = lpStaking.balanceOf(user3);

        assertGt(shares1, 0, "User1 should have shares");
        assertGt(shares2, 0, "User2 should have shares");
        assertGt(shares3, 0, "User3 should have shares");

        // User2 bought 33% more than User1 (4M vs 3M)
        uint256 ratio = (shares2 * 100) / shares1;
        assertApproxEqAbs(ratio, 133, 5, "User2 should have ~33% more shares than User1");

        // User1 and User3 bought same amount
        assertEq(shares1, shares3, "User1 and User3 should have equal shares");
    }

    function test_CannotClaimBeforeSaleEnds() public {
        // Start sale and make purchase
        vm.prank(owner);
        tokenSale.startSaleZero(TOKENS_FOR_SALE, TOKEN_PRICE);

        uint256 purchaseAmount = 1_000_000 ether;
        uint256 usdtAmount = 1_000e6;

        vm.startPrank(user1);
        usdtToken.approve(address(tokenSale), usdtAmount);
        tokenSale.buyTokens(purchaseAmount / 1e18, purchaseAmount, usdtAmount);
        vm.stopPrank();

        // Try to claim before sale ends
        vm.prank(user1);
        vm.expectRevert("Sale still active");
        tokenSale.claimLPShares(0, false);
    }

    function test_CannotClaimTwice() public {
        // Setup and complete a full sale
        vm.prank(owner);
        tokenSale.startSaleZero(1_000_000 ether, TOKEN_PRICE);

        uint256 purchaseAmount = 1_000_000 ether;
        uint256 usdtAmount = 1_000e6;

        _mockUniswapForEndSale(purchaseAmount, usdtAmount);

        vm.startPrank(user1);
        usdtToken.approve(address(tokenSale), usdtAmount);
        tokenSale.buyTokens(purchaseAmount / 1e18, purchaseAmount, usdtAmount);
        vm.stopPrank();

        // endSale auto-distributes shares to all buyers (purchases zeroed)
        tokenSale.endSale();

        // User should already have shares
        assertGt(lpStaking.balanceOf(user1), 0, "User should have shares after endSale");

        // Attempting to claim again should fail (purchases already zeroed by endSale)
        vm.prank(user1);
        vm.expectRevert("No purchase to claim");
        tokenSale.claimLPShares(0, false);
    }

    function test_EmptySaleHandling() public {
        // Start sale but don't make any purchases
        vm.prank(owner);
        tokenSale.startSaleZero(TOKENS_FOR_SALE, TOKEN_PRICE);

        // End sale without purchases
        vm.prank(owner);
        tokenSale.endSale();

        // Verify no LP was created
        assertFalse(tokenSale.saleLPCreated(0), "LP should not be created for empty sale");
        assertEq(tokenSale.saleLPTokenId(0), 0, "LP token ID should be 0");
    }

    function test_PartialSaleCompletion() public {
        // Start sale for 10M tokens
        vm.prank(owner);
        tokenSale.startSaleZero(TOKENS_FOR_SALE, TOKEN_PRICE);

        // Only sell 5M tokens (50% of sale)
        uint256 purchaseAmount = 5_000_000 ether;
        uint256 usdtAmount = 5_000e6;

        vm.startPrank(user1);
        usdtToken.approve(address(tokenSale), usdtAmount);
        tokenSale.buyTokens(purchaseAmount / 1e18, purchaseAmount, usdtAmount);
        vm.stopPrank();

        // Mock Uniswap for endSale
        _mockUniswapForEndSale(purchaseAmount, usdtAmount);

        // Owner manually ends sale
        vm.prank(owner);
        tokenSale.endSale();

        // Verify LP was created with sold amounts (not total available)
        assertTrue(tokenSale.saleLPCreated(0), "LP should be created");
        (,uint256 lpWLF, uint256 lpUSDT,,) = lpStaking.lpPositions(0);
        assertEq(lpWLF, purchaseAmount, "LP should have sold WLF amount");
        assertEq(lpUSDT, usdtAmount, "LP should have collected USDT amount");

        // Shares auto-distributed by endSale — verify user has received them
        assertGt(lpStaking.balanceOf(user1), 0, "User should receive shares from auto-distribution");
    }

    function test_MultipleSequentialSales() public {
        // Sale #0
        vm.prank(owner);
        tokenSale.startSaleZero(1_000_000 ether, TOKEN_PRICE);

        _mockUniswapForEndSale(1_000_000 ether, 1_000e6);

        vm.startPrank(user1);
        usdtToken.approve(address(tokenSale), 1_000e6);
        tokenSale.buyTokens(1_000_000, 1_000_000 ether, 1_000e6);
        vm.stopPrank();

        tokenSale.endSale(); // create LP in separate tx

        // Airdrop more tokens for Sale #1
        vm.prank(owner);
        wlfToken.airdrop(address(tokenSale), 2_000_000 ether);

        // Sale #1
        vm.prank(owner);
        tokenSale.startSale(2_000_000 ether, TOKEN_PRICE);

        _mockUniswapForEndSale(2_000_000 ether, 2_000e6);

        vm.startPrank(user2);
        usdtToken.approve(address(tokenSale), 2_000e6);
        tokenSale.buyTokens(2_000_000, 2_000_000 ether, 2_000e6);
        vm.stopPrank();

        tokenSale.endSale(); // create LP in separate tx

        // Verify both sales created separate LP positions
        assertTrue(tokenSale.saleLPCreated(0), "Sale 0 LP should exist");
        assertTrue(tokenSale.saleLPCreated(1), "Sale 1 LP should exist");
        assertNotEq(tokenSale.saleLPTokenId(0), tokenSale.saleLPTokenId(1), "Different token IDs");

        // Both users' shares are auto-distributed by endSale — verify
        assertGt(lpStaking.balanceOf(user1), 0, "User1 should have shares from sale 0 auto-distribution");
        assertGt(lpStaking.balanceOf(user2), 0, "User2 should have shares from sale 1 auto-distribution");
    }

    // ── Delegation tests ────────────────────────────────────────────────────────

    function test_sale0_auto_delegates_to_owner() public {
        vm.prank(owner);
        tokenSale.startSaleZero(TOKENS_FOR_SALE, TOKEN_PRICE);

        // Complete the sale: endSale auto-delegates each buyer's voting power to owner
        _mockUniswapForEndSale(5_000_000 ether, 5_000e6);
        _makePurchase(user1, 5_000_000 ether, 5_000e6);
        vm.prank(owner);
        tokenSale.endSale();

        // user1's entire WLF voting power is delegated to owner via DAO
        assertEq(dao.voteDelegate(user1), owner, "user1 should delegate to owner");
        // user1 forfeits their own voting power while delegating
        assertEq(dao.getVotingPower(user1), 0, "user1 own voting power should be 0 (delegated away)");
        // owner's total voting power includes user1's delegated LP power (computed live)
        assertGt(dao.getVotingPower(owner), 0, "owner voting power should include user1's delegation");
    }

    function test_delegation_lock_prevents_user_change() public {
        // Start sale, buy, end sale → delegation locked for 2 years
        vm.prank(owner);
        tokenSale.startSaleZero(TOKENS_FOR_SALE, TOKEN_PRICE);

        _mockUniswapForEndSale(5_000_000 ether, 5_000e6);
        _makePurchase(user1, 5_000_000 ether, 5_000e6);
        vm.prank(owner);
        tokenSale.endSale();

        // user1 tries to undelegate — should revert because lock has not expired
        vm.prank(user1);
        vm.expectRevert("DAO: delegation locked");
        dao.undelegate();
    }

    function test_delegation_lock_expired_allows_change() public {
        // Start sale, buy, end sale → delegation locked for 2 years
        vm.prank(owner);
        tokenSale.startSaleZero(TOKENS_FOR_SALE, TOKEN_PRICE);

        _mockUniswapForEndSale(5_000_000 ether, 5_000e6);
        _makePurchase(user1, 5_000_000 ether, 5_000e6);
        vm.prank(owner);
        tokenSale.endSale();

        // Advance time past the 2-year lock
        uint256 lockExpiry = dao.voteDelegateLockExpiry(user1);
        vm.warp(lockExpiry + 1);

        // user1 can now undelegate and reclaim their own voting power
        vm.prank(user1);
        dao.undelegate();

        assertEq(dao.voteDelegate(user1), address(0), "user1 should have no delegate");
        // user1's power no longer flows to owner (live computation skips since voteDelegate[user1] != owner)
        // user1's own voting power is restored
        assertGt(dao.getVotingPower(user1), 0, "user1 should have voting power after undelegating");
    }

    // Helper function to mock Uniswap position-manager interactions for endSale.
    // addLiquidity/positionManager() are handled by MockConsumeUniswapHelper (which
    // actually transfers tokens so balance snapshots in _endSale() work correctly).
    function _mockUniswapForEndSale(uint256 wlfAmount, uint256 usdtAmount) internal {
        // tokenId the consuming mock will return (must match the mock's formula)
        uint256 mockTokenId = uint256(keccak256(abi.encodePacked(block.timestamp, wlfAmount)));
        uint128 mockLiquidity = uint128(wlfAmount / 1e12);

        // positionManager.transferFrom is called by _endSale() to move the NFT to lpStaking
        vm.mockCall(
            positionManager,
            abi.encodeWithSelector(bytes4(keccak256("transferFrom(address,address,uint256)"))),
            abi.encode()
        );

        // LPStaking.initializeLPPosition() verifies it owns the NFT
        vm.mockCall(
            positionManager,
            abi.encodeWithSelector(bytes4(keccak256("ownerOf(uint256)")), mockTokenId),
            abi.encode(address(lpStaking))
        );

        // LPStaking.initializeLPPosition() reads liquidity from the position
        vm.mockCall(
            positionManager,
            abi.encodeWithSelector(bytes4(keccak256("positions(uint256)")), mockTokenId),
            abi.encode(
                uint96(0), address(0), address(wlfToken), address(usdtToken),
                uint24(500), int24(-887272), int24(887272), mockLiquidity,
                uint256(0), uint256(0), uint128(0), uint128(0)
            )
        );

        // Suppress unused-param warning
        usdtAmount;
    }
}
