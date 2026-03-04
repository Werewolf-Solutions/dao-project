// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Staking} from "../src/Staking.sol";

/**
 * @notice Verifies that on-chain state survived the upgrade and the new implementation is live.
 *
 * Checks performed:
 *   1. staking.version() == "2.0.0"  -- proves new bytecode is running
 *   2. 3 positions exist for deployer -- state survived the proxy upgrade
 *   3. Position 0: 100 WLF flexible  (assets == 100e18, bonusApy == 0)
 *   4. Position 1: 200 WLF 30-day    (assets == 200e18, bonusApy == 5_000)
 *   5. Position 2: 300 WLF 1-year    (assets == 300e18, bonusApy == 25_000)
 *
 * Usage (run AFTER make upgrade-sepolia):
 *   make verify-upgrade-sepolia
 */
contract VerifyUpgrade is Script {
    function run() external {
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        Staking  staking = Staking(vm.envAddress("STAKING_PROXY"));

        console.log("=== VerifyUpgrade ===");
        console.log("Deployer: ", deployer);

        // 1. version()
        string memory ver = staking.version();
        bool versionOk = keccak256(bytes(ver)) == keccak256(bytes("2.0.0"));
        console.log("version():", ver);
        _assert(versionOk, "version() != '2.0.0'");

        // 2. Position count
        Staking.StakePosition[] memory positions = staking.getPositions(deployer);
        _assert(positions.length == 3, "expected 3 positions");
        console.log("Position count: 3 OK");

        // 3. Position 0: 100 WLF flexible
        Staking.StakePosition memory p0 = positions[0];
        console.log("Position 0 - assets:", p0.assets / 1e18, "WLF | bonusApy:", p0.bonusApy);
        _assert(p0.active,              "position 0 not active");
        _assert(p0.assets == 100e18,    "position 0 assets != 100 WLF");
        _assert(p0.unlockAt == 0,       "position 0 should be flexible");
        _assert(p0.bonusApy == 0,       "position 0 bonusApy != 0");
        console.log("Position 0 OK");

        // 4. Position 1: 200 WLF 30-day
        Staking.StakePosition memory p1 = positions[1];
        console.log("Position 1 - assets:", p1.assets / 1e18, "WLF | bonusApy:", p1.bonusApy);
        _assert(p1.active,              "position 1 not active");
        _assert(p1.assets == 200e18,    "position 1 assets != 200 WLF");
        _assert(p1.unlockAt > 0,        "position 1 should be locked");
        _assert(p1.bonusApy == 5_000,   "position 1 bonusApy != 5_000");
        console.log("Position 1 OK");

        // 5. Position 2: 300 WLF 1-year
        Staking.StakePosition memory p2 = positions[2];
        console.log("Position 2 - assets:", p2.assets / 1e18, "WLF | bonusApy:", p2.bonusApy);
        _assert(p2.active,              "position 2 not active");
        _assert(p2.assets == 300e18,    "position 2 assets != 300 WLF");
        _assert(p2.unlockAt > 0,        "position 2 should be locked");
        _assert(p2.bonusApy == 25_000,  "position 2 bonusApy != 25_000");
        console.log("Position 2 OK");

        console.log("=== ALL ASSERTIONS PASSED ===");
    }

    function _assert(bool condition, string memory message) internal pure {
        require(condition, string.concat("FAIL: ", message));
    }
}
