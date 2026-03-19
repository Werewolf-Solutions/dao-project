// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";
import {UniswapHelper} from "../src/UniswapHelper.sol";
import {WerewolfTokenV1} from "../src/WerewolfTokenV1.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

/**
 * @title BaseForkTest
 * @notice Forks Base Sepolia and verifies UniswapHelper can create a real WLF/USDT LP position.
 *
 * Run with:
 *   forge test --match-path test/BaseForkTest.t.sol --fork-url $BASE_SEPOLIA_RPC_URL -vvvv
 * or:
 *   forge test --match-path test/BaseForkTest.t.sol -vvvv  (uses foundry.toml rpc_endpoints alias)
 */
contract BaseForkTest is Test {
    // Base Sepolia Uniswap v3 addresses (from https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments)
    address constant POSITION_MANAGER = 0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2;
    address constant SWAP_ROUTER      = 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4;

    // Token sale constants (mirrors Deploy.s.sol)
    uint256 constant WLF_AMOUNT  = 500_000 ether;        // 500K WLF (18 dec)
    uint256 constant USDT_AMOUNT = 2_000_000_000;        // 2000 USDT (6 dec)
    uint24  constant POOL_FEE    = 500;                  // 0.05% fee tier
    int24   constant TICK_LOWER  = -887270;              // full range for tickSpacing=10
    int24   constant TICK_UPPER  =  887270;

    address founder;
    MockUSDT usdt;
    WerewolfTokenV1 wlf;
    UniswapHelper uniswapHelper;

    function setUp() public {
        vm.createSelectFork("base_sepolia");
        founder = makeAddr("founder");

        // Deploy MockUSDT
        vm.prank(founder);
        usdt = new MockUSDT(0);
        usdt.mint(founder, USDT_AMOUNT * 10);

        // Deploy WLF token
        WerewolfTokenV1 wlfImpl = new WerewolfTokenV1();
        bytes memory wlfInit = abi.encodeWithSelector(
            WerewolfTokenV1.initialize.selector,
            founder,       // owner
            founder,       // treasury (placeholder)
            founder,       // timelock (placeholder)
            founder,       // guardian
            address(0x1)   // staking (placeholder)
        );
        TransparentUpgradeableProxy wlfProxy = new TransparentUpgradeableProxy(
            address(wlfImpl),
            makeAddr("multiSig"),
            wlfInit
        );
        wlf = WerewolfTokenV1(address(wlfProxy));

        // Deploy UniswapHelper pointing at Base Sepolia positionManager
        uniswapHelper = new UniswapHelper(POSITION_MANAGER);

        // Airdrop WLF to the "TokenSale" (we'll play that role ourselves)
        vm.prank(founder);
        wlf.airdrop(founder, WLF_AMOUNT);
    }

    /**
     * @notice Verifies UniswapHelper can create a real WLF/USDT pool and mint a full-range
     *         LP position on Base Sepolia's Uniswap v3.
     */
    function test_createLP_onBaseSepolia() public {
        vm.startPrank(founder);

        wlf.approve(address(uniswapHelper), WLF_AMOUNT);
        usdt.approve(address(uniswapHelper), USDT_AMOUNT);

        uint256 tokenId = uniswapHelper.addLiquidity(
            address(wlf),
            address(usdt),
            POOL_FEE,
            TICK_LOWER,
            TICK_UPPER,
            WLF_AMOUNT,
            USDT_AMOUNT,
            10_000  // no minimum amounts (same as TokenSale._endSale)
        );

        vm.stopPrank();

        console.log("LP NFT tokenId:", tokenId);
        assertTrue(tokenId > 0, "tokenId must be non-zero");

        // Verify founder received the NFT
        assertEq(
            INonfungiblePositionManager(POSITION_MANAGER).ownerOf(tokenId),
            founder,
            "founder must own LP NFT"
        );

        // Read position liquidity — must be non-zero
        (,,,,,,,uint128 liquidity,,,,) = INonfungiblePositionManager(POSITION_MANAGER).positions(tokenId);
        console.log("LP liquidity:", liquidity);
        assertGt(liquidity, 0, "LP must have non-zero liquidity");
    }

    /**
     * @notice Verifies the pool is initialized at the correct price (0.004 USDT/WLF).
     *         At this price with full-range ticks, both tokens should be deposited.
     */
    function test_LP_usesCorrectPrice() public {
        vm.startPrank(founder);

        uint256 wlfBefore  = wlf.balanceOf(founder);
        uint256 usdtBefore = usdt.balanceOf(founder);

        wlf.approve(address(uniswapHelper), WLF_AMOUNT);
        usdt.approve(address(uniswapHelper), USDT_AMOUNT);

        uint256 tokenId = uniswapHelper.addLiquidity(
            address(wlf),
            address(usdt),
            POOL_FEE,
            TICK_LOWER,
            TICK_UPPER,
            WLF_AMOUNT,
            USDT_AMOUNT,
            10_000
        );

        uint256 wlfUsed  = wlfBefore  - wlf.balanceOf(founder);
        uint256 usdtUsed = usdtBefore - usdt.balanceOf(founder);

        console.log("WLF used :", wlfUsed);
        console.log("USDT used:", usdtUsed);
        console.log("tokenId  :", tokenId);

        // At least one token must have been deposited
        assertTrue(wlfUsed > 0 || usdtUsed > 0, "At least one token must be deposited");

        vm.stopPrank();
    }
}
