// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {HelperConfig} from "./helpers/HelperConfig.s.sol";
import {Timelock} from "../src/Timelock.sol";
import {DAO} from "../src/DAO.sol";

/**
 * @notice Second-step script for transferring the Timelock admin to the DAO.
 *
 * Run this AFTER the timelock delay (2 days) has passed since `Deploy.s.sol` was run.
 *
 * Required env vars (copy values from script/output/deployed-addresses.txt):
 *   TIMELOCK_ADDRESS  — proxy address of Timelock
 *   DAO_ADDRESS       — proxy address of DAO
 *   ADMIN_ETA         — the eta value printed during deploy (uint256 unix timestamp)
 *
 * Usage:
 *   Local:   make accept-admin-local
 *   Sepolia: make accept-admin-sepolia
 */
contract AcceptTimelockAdmin is Script {
    function run() external {
        HelperConfig helperConfig = new HelperConfig();
        HelperConfig.NetworkConfig memory netConfig = helperConfig.getConfig();

        address timelockAddress = vm.envAddress("TIMELOCK_ADDRESS");
        address daoAddress      = vm.envAddress("DAO_ADDRESS");
        uint256 eta             = vm.envUint("ADMIN_ETA");

        Timelock timelock = Timelock(timelockAddress);
        DAO dao           = DAO(daoAddress);

        bytes memory callData = abi.encode(daoAddress);

        vm.startBroadcast(netConfig.deployerPrivateKey);

        // Step 1: execute the queued setPendingAdmin transaction
        timelock.executeTransaction(
            timelockAddress,
            "setPendingAdmin(address)",
            callData,
            eta
        );

        // Step 2: DAO guardian accepts admin on behalf of DAO
        // dao.__acceptAdmin() calls timelock.acceptAdmin() where msg.sender = address(dao)
        dao.__acceptAdmin();

        vm.stopBroadcast();

        require(
            timelock.admin() == daoAddress,
            "AcceptTimelockAdmin: admin transfer failed"
        );

        console.log("Timelock admin successfully transferred to DAO:", daoAddress);
    }
}
