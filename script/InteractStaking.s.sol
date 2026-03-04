// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Staking} from "../src/Staking.sol";

/**
 * @notice Creates 3 staking positions to establish on-chain state before an upgrade.
 *
 * Pre-conditions:
 *   - make deploy-sepolia has already run
 *   - Deployer (PRIVATE_KEY) holds ≥ 600 WLF (founder receives 1000 WLF at deployment)
 *
 * Positions created:
 *   0 — 100 WLF flexible  (no lock,   bonusApy = 0)
 *   1 — 200 WLF 30-day    (locked,    bonusApy = 5_000)
 *   2 — 300 WLF 1-year    (locked,    bonusApy = 25_000)
 *
 * Usage:
 *   make stake-sepolia
 */
contract InteractStaking is Script {
    function run() external {
        uint256 pk      = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address wlfAddr  = vm.envAddress("WLF_PROXY");
        address stakingAddr = vm.envAddress("STAKING_PROXY");

        Staking  staking = Staking(stakingAddr);
        IERC20   wlf     = IERC20(wlfAddr);

        console.log("=== InteractStaking ===");
        console.log("Deployer:    ", deployer);
        console.log("WLF balance: ", wlf.balanceOf(deployer) / 1e18, "WLF");

        vm.startBroadcast(pk);

        // Approve 600 WLF to staking contract (100 + 200 + 300)
        wlf.approve(stakingAddr, 600e18);

        // Position 0: 100 WLF flexible (no lock)
        staking.stakeFlexible(100e18);

        // Position 1: 200 WLF fixed 30-day (+5% bonus APY)
        staking.stakeFixed(200e18, staking.DURATION_30D());

        // Position 2: 300 WLF fixed 1-year (+25% bonus APY)
        staking.stakeFixed(300e18, staking.DURATION_1YR());

        vm.stopBroadcast();

        // Log all positions for verification
        Staking.StakePosition[] memory positions = staking.getPositions(deployer);
        console.log("Positions created:", positions.length);
        for (uint256 i = 0; i < positions.length; i++) {
            Staking.StakePosition memory p = positions[i];
            console.log("--- Position", i, "---");
            console.log("  assets (WLF):", p.assets / 1e18);
            console.log("  shares:      ", p.shares / 1e18);
            console.log("  stakedAt:    ", p.stakedAt);
            console.log("  unlockAt:    ", p.unlockAt);
            console.log("  bonusApy:    ", p.bonusApy);
            console.log("  active:      ", p.active);
        }
    }
}
