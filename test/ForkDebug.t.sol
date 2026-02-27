// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Minimal interface — only functions we need for diagnosis.
interface ITokenSaleDebug {
    function endSale() external;
    function saleActive() external view returns (bool);
    function saleIdCounter() external view returns (uint256);
    function saleWLFCollected(uint256) external view returns (uint256);
    function saleUSDTCollected(uint256) external view returns (uint256);
    function saleETHCollected(uint256) external view returns (uint256);
    function saleLPCreated(uint256) external view returns (bool);
    function saleLPETHCreated(uint256) external view returns (bool);
    function owner() external view returns (address);
    function uniswapHelper() external view returns (address);
    function tickLower() external view returns (int24);
    function tickUpper() external view returns (int24);
    function poolFee() external view returns (uint24);
}

interface IUniswapHelperDebug {
    function positionManager() external view returns (address);
}

interface ILPStakingDebug {
    function tokenSaleContract() external view returns (address);
    function positionManager() external view returns (address);
}

/**
 * @title ForkDebugTest
 * @notice Forks Sepolia and simulates endSale() with full -vvvv trace to identify the revert.
 *
 * Run with:
 *   make fork-debug
 * or:
 *   forge test --match-path test/ForkDebug.t.sol --fork-url $SEPOLIA_RPC_URL -vvvv
 */
contract ForkDebugTest is Test {
    // ── Deployed Sepolia addresses (from script/output/deployed-addresses.txt) ──
    address constant TOKEN_SALE = 0x1A99D391f1Ea2fC1E5AB5B0a2dee4652d566EBE1;
    address constant WLF_TOKEN  = 0x02dB67Dd0Df94dCdF0D0Ae7263e8668e0971DD18;
    address constant USDT_ADDR  = 0xDd8e0F46DCd75D068C3ebA8a9B5A72f07B27CC15;
    address constant LP_STAKING = 0x2DD8dBE5323B11BdDc3CE16c9Fc9347651a64734;

    ITokenSaleDebug tokenSale;
    ILPStakingDebug lpStaking;

    function setUp() public {
        vm.createSelectFork(vm.envString("SEPOLIA_RPC_URL"));
        tokenSale = ITokenSaleDebug(TOKEN_SALE);
        lpStaking = ILPStakingDebug(LP_STAKING);
    }

    /// @notice Logs on-chain state and attempts endSale() — run with -vvvv to see the full trace.
    function test_diagnoseSepolia() public {
        uint256 saleId = tokenSale.saleIdCounter();

        console.log("=== TokenSale State ===");
        console.log("saleActive     :", tokenSale.saleActive());
        console.log("saleId         :", saleId);
        console.log("wlfCollected   :", tokenSale.saleWLFCollected(saleId));
        console.log("usdtCollected  :", tokenSale.saleUSDTCollected(saleId));
        console.log("ethCollected   :", tokenSale.saleETHCollected(saleId));
        console.log("lpCreated      :", tokenSale.saleLPCreated(saleId));
        console.log("lpETHCreated   :", tokenSale.saleLPETHCreated(saleId));
        console.log("tickLower      :", tokenSale.tickLower());
        console.log("tickUpper      :", tokenSale.tickUpper());
        console.log("poolFee        :", tokenSale.poolFee());
        console.log("owner          :", tokenSale.owner());

        address uniHelper = tokenSale.uniswapHelper();
        console.log("uniswapHelper  :", uniHelper);
        console.log("positionMgr    :", IUniswapHelperDebug(uniHelper).positionManager());

        console.log("=== LPStaking State ===");
        console.log("tokenSaleContract:", lpStaking.tokenSaleContract());
        console.log("positionMgr      :", lpStaking.positionManager());

        console.log("=== Token Balances ===");
        console.log("WLF in TokenSale :", IERC20(WLF_TOKEN).balanceOf(TOKEN_SALE));
        console.log("USDT in TokenSale:", IERC20(USDT_ADDR).balanceOf(TOKEN_SALE));
        console.log("ETH  in TokenSale:", TOKEN_SALE.balance);

        console.log("=== Calling endSale() ===");

        address caller;
        if (tokenSale.saleActive()) {
            // Sale still active — must call as owner (Timelock)
            caller = tokenSale.owner();
            console.log("Sale ACTIVE - pranking as owner:", caller);
        } else {
            // Sale closed - anyone can call
            caller = address(0xBEEF);
            console.log("Sale CLOSED - pranking as anonymous:", caller);
        }

        vm.prank(caller);
        tokenSale.endSale();   // <— This will show the full revert trace in -vvvv

        console.log("=== endSale() succeeded! ===");
    }
}
