// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/LPStaking.sol";
import "../src/WerewolfTokenV1.sol";
import "../src/Treasury.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";

/**
 * @title LPStakingTest
 * @notice Unit tests for LPStaking contract functionality
 */
contract LPStakingTest is Test {
    LPStaking public lpStaking;
    WerewolfTokenV1 public wlfToken;
    MockUSDT public usdtToken;
    Treasury public treasury;

    address public owner;
    address public tokenSale;
    address public user1;
    address public user2;
    address public multiSig;
    address public positionManager;

    uint256 constant SALE_ID_1 = 1;
    uint256 constant TOKEN_ID_1 = 100;
    uint256 constant WLF_AMOUNT = 1_000_000 ether;
    uint256 constant USDT_AMOUNT = 1000e6; // 1000 USDT (6 decimals)

    event LPPositionInitialized(uint256 indexed saleId, uint256 indexed tokenId, uint256 wlf, uint256 usdt);
    event SharesClaimed(address indexed user, uint256 indexed saleId, uint256 shares, bool fixedDuration);
    event SharesWithdrawn(address indexed user, uint256 shares, uint256 wlfAmount, uint256 usdtAmount);
    event FeesCollected(uint256 indexed saleId, uint256 wlf, uint256 usdt);
    event RewardsDistributed(address indexed user, uint256 amount);

    function setUp() public {
        owner = makeAddr("owner");
        tokenSale = makeAddr("tokenSale");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        multiSig = makeAddr("multiSig");
        positionManager = makeAddr("positionManager");

        // Deploy WLF Token
        vm.startPrank(owner);
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
        usdtToken = new MockUSDT(1_000_000e6);

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

        // Set TokenSale contract
        lpStaking.setTokenSaleContract(tokenSale);

        vm.stopPrank();
    }

    function test_Initialization() public {
        assertEq(address(lpStaking.wlfToken()), address(wlfToken));
        assertEq(address(lpStaking.usdtToken()), address(usdtToken));
        assertEq(address(lpStaking.treasury()), address(treasury));
        assertEq(address(lpStaking.positionManager()), positionManager);
        assertEq(lpStaking.tokenSaleContract(), tokenSale);
        assertEq(lpStaking.owner(), owner);
    }

    function test_InitializeLPPosition() public {
        // Mock the position manager to return this contract as owner
        vm.mockCall(
            positionManager,
            abi.encodeWithSelector(
                bytes4(keccak256("ownerOf(uint256)")),
                TOKEN_ID_1
            ),
            abi.encode(address(lpStaking))
        );

        // Mock positions() to return liquidity
        uint128 liquidity = 1000000;
        vm.mockCall(
            positionManager,
            abi.encodeWithSelector(
                bytes4(keccak256("positions(uint256)")),
                TOKEN_ID_1
            ),
            abi.encode(
                uint96(0), // nonce
                address(0), // operator
                address(wlfToken), // token0
                address(usdtToken), // token1
                uint24(500), // fee
                int24(-887272), // tickLower
                int24(887272), // tickUpper
                liquidity, // liquidity
                uint256(0), // feeGrowthInside0LastX128
                uint256(0), // feeGrowthInside1LastX128
                uint128(0), // tokensOwed0
                uint128(0)  // tokensOwed1
            )
        );

        vm.prank(tokenSale);
        vm.expectEmit(true, true, false, true);
        emit LPPositionInitialized(SALE_ID_1, TOKEN_ID_1, WLF_AMOUNT, USDT_AMOUNT);

        lpStaking.initializeLPPosition(SALE_ID_1, TOKEN_ID_1, WLF_AMOUNT, USDT_AMOUNT, WLF_AMOUNT);

        (uint256 tokenId, uint256 totalWLF, uint256 totalUSDT, uint128 liq, bool initialized) =
            lpStaking.lpPositions(SALE_ID_1);

        assertEq(tokenId, TOKEN_ID_1);
        assertEq(totalWLF, WLF_AMOUNT);
        assertEq(totalUSDT, USDT_AMOUNT);
        assertEq(liq, liquidity);
        assertTrue(initialized);
    }

    function test_InitializeLPPosition_OnlyTokenSale() public {
        vm.expectRevert("LPStaking: Only TokenSale can call");
        lpStaking.initializeLPPosition(SALE_ID_1, TOKEN_ID_1, WLF_AMOUNT, USDT_AMOUNT, WLF_AMOUNT);
    }

    function test_InitializeLPPosition_AlreadyInitialized() public {
        // Setup position
        _setupLPPosition(SALE_ID_1, TOKEN_ID_1, WLF_AMOUNT, USDT_AMOUNT);

        // Try to initialize again
        vm.prank(tokenSale);
        vm.expectRevert("LPStaking: Position already initialized");
        lpStaking.initializeLPPosition(SALE_ID_1, TOKEN_ID_1, WLF_AMOUNT, USDT_AMOUNT, WLF_AMOUNT);
    }

    function test_ClaimShares_FlexibleDuration() public {
        _setupLPPosition(SALE_ID_1, TOKEN_ID_1, WLF_AMOUNT, USDT_AMOUNT);

        uint256 purchaseAmount = 500_000 ether; // 50% of total
        bool fixedDuration = false;

        vm.prank(tokenSale);
        lpStaking.claimShares(user1, SALE_ID_1, purchaseAmount, fixedDuration);

        uint256 userBalance = lpStaking.balanceOf(user1);
        assertGt(userBalance, 0, "User should have shares");

        // Check that shares are proportional (50% of total)
        uint256 totalShares = lpStaking.saleShares(SALE_ID_1);
        assertEq(userBalance, totalShares, "User should have all shares for this sale");
    }

    function test_ClaimShares_FixedDuration() public {
        _setupLPPosition(SALE_ID_1, TOKEN_ID_1, WLF_AMOUNT, USDT_AMOUNT);

        uint256 purchaseAmount = 500_000 ether;
        bool fixedDuration = true;

        vm.prank(tokenSale);
        lpStaking.claimShares(user1, SALE_ID_1, purchaseAmount, fixedDuration);

        uint256 userBalance = lpStaking.balanceOf(user1);
        assertGt(userBalance, 0, "User should have shares");

        // Check that user has 5-year hard lock set
        uint256 unlockTime = lpStaking.fixedLockUnlockTime(user1);
        assertApproxEqAbs(unlockTime, block.timestamp + 5 * 365 days, 5, "5-year lock should be set");
    }

    function test_ClaimShares_MultipleUsers() public {
        _setupLPPosition(SALE_ID_1, TOKEN_ID_1, WLF_AMOUNT, USDT_AMOUNT);

        uint256 user1Purchase = 300_000 ether; // 30%
        uint256 user2Purchase = 700_000 ether; // 70%

        vm.prank(tokenSale);
        lpStaking.claimShares(user1, SALE_ID_1, user1Purchase, false);

        vm.prank(tokenSale);
        lpStaking.claimShares(user2, SALE_ID_1, user2Purchase, false);

        uint256 user1Balance = lpStaking.balanceOf(user1);
        uint256 user2Balance = lpStaking.balanceOf(user2);

        // User 2 should have more shares (70% vs 30%)
        assertGt(user2Balance, user1Balance, "User2 should have more shares");

        // Ratio should be approximately 70:30
        uint256 ratio = (user2Balance * 100) / user1Balance;
        assertApproxEqAbs(ratio, 233, 5, "Ratio should be approximately 2.33 (70/30)");
    }

    function test_CalculateAPY() public {
        uint256 apy = lpStaking.calculateAPY();

        // APY should be between MIN_APY and MAX_APY
        assertGe(apy, lpStaking.MIN_APY(), "APY should be >= MIN_APY");
        assertLe(apy, lpStaking.MAX_APY(), "APY should be <= MAX_APY");
    }

    function test_GetPositionValue() public {
        _setupLPPosition(SALE_ID_1, TOKEN_ID_1, WLF_AMOUNT, USDT_AMOUNT);

        (uint256 wlf, uint256 usdt) = lpStaking.getPositionValue(SALE_ID_1);

        assertEq(wlf, WLF_AMOUNT, "WLF amount should match");
        assertEq(usdt, USDT_AMOUNT, "USDT amount should match");
    }

    function test_GetPositionValue_NotInitialized() public {
        vm.expectRevert("LPStaking: Position not initialized");
        lpStaking.getPositionValue(999);
    }

    function test_SetTokenSaleContract_OnlyOnce() public {
        // Already set in setUp, try to set again
        vm.prank(owner);
        vm.expectRevert("LPStaking: TokenSale already set");
        lpStaking.setTokenSaleContract(makeAddr("newTokenSale"));
    }

    function test_SetTokenSaleContract_OnlyOwner() public {
        // Deploy fresh LPStaking without TokenSale set
        vm.startPrank(owner);
        LPStaking freshLPStaking = new LPStaking();
        bytes memory initData = abi.encodeWithSelector(
            LPStaking.initialize.selector,
            address(wlfToken),
            address(usdtToken),
            owner,
            address(treasury),
            positionManager
        );
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(freshLPStaking),
            multiSig,
            initData
        );
        LPStaking fresh = LPStaking(address(proxy));
        vm.stopPrank();

        // Try to set from non-owner
        vm.prank(user1);
        vm.expectRevert();
        fresh.setTokenSaleContract(tokenSale);
    }

    function test_Constants() public {
        assertEq(lpStaking.MIN_APY(), 8_000, "MIN_APY should be 8%");
        assertEq(lpStaking.MAX_APY(), 100_000, "MAX_APY should be 100%");
        assertEq(lpStaking.LOCKED_STAKE_BONUS_APY(), 5_000, "Bonus APY should be 5%");
        assertEq(lpStaking.EPOCH_DURATION(), 30 days, "Epoch should be 30 days");
    }

    function test_OnERC721Received() public {
        bytes4 selector = lpStaking.onERC721Received(address(0), address(0), 0, "");
        assertEq(selector, bytes4(keccak256("onERC721Received(address,address,uint256,bytes)")));
    }

    // Helper function to setup LP position
    function _setupLPPosition(uint256 saleId, uint256 tokenId, uint256 wlf, uint256 usdt) internal {
        // Mock position manager
        vm.mockCall(
            positionManager,
            abi.encodeWithSelector(bytes4(keccak256("ownerOf(uint256)")), tokenId),
            abi.encode(address(lpStaking))
        );

        uint128 liquidity = 1000000;
        vm.mockCall(
            positionManager,
            abi.encodeWithSelector(bytes4(keccak256("positions(uint256)")), tokenId),
            abi.encode(
                uint96(0), address(0), address(wlfToken), address(usdtToken),
                uint24(500), int24(-887272), int24(887272), liquidity,
                uint256(0), uint256(0), uint128(0), uint128(0)
            )
        );

        vm.prank(tokenSale);
        lpStaking.initializeLPPosition(saleId, tokenId, wlf, usdt, wlf);
    }
}
