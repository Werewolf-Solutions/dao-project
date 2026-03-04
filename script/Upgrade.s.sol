// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from
    "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import {Treasury} from "../src/Treasury.sol";
import {Timelock} from "../src/Timelock.sol";
import {WerewolfTokenV1} from "../src/WerewolfTokenV1.sol";
import {Staking} from "../src/Staking.sol";
import {LPStaking} from "../src/LPStaking.sol";
import {DAO} from "../src/DAO.sol";
import {TokenSale} from "../src/TokenSale.sol";
import {CompaniesHouseV1} from "../src/CompaniesHouseV1.sol";

contract Upgrade is Script {
    // EIP-1967 slots
    bytes32 constant ADMIN_SLOT =
        0xb53127684a568b3173ae13b9f8a6016e243e63b6ef8e575eb6a5fccd7a8e8f5d;
    bytes32 constant IMPL_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    struct Proxies {
        address treasury;
        address timelock;
        address wlf;
        address staking;
        address lp;
        address dao;
        address tokenSale;
        address companies;
    }

    function run() external {
        uint256 multiSigKey = vm.envUint("MULTISIG_PRIVATE_KEY");

        Proxies memory p = _loadProxies();

        // Pre-check which contracts need upgrading (read-only, before broadcast)
        bool[8] memory needs = _checkAll(p);

        vm.startBroadcast(multiSigKey);
        _executeAll(p, needs);
        vm.stopBroadcast();
    }

    function _loadProxies() internal view returns (Proxies memory p) {
        p.treasury  = vm.envOr("TREASURY_PROXY",        address(0));
        p.timelock  = vm.envOr("TIMELOCK_PROXY",        address(0));
        p.wlf       = vm.envOr("WLF_PROXY",             address(0));
        p.staking   = vm.envOr("STAKING_PROXY",         address(0));
        p.lp        = vm.envOr("LP_STAKING_PROXY",      address(0));
        p.dao       = vm.envOr("DAO_PROXY",             address(0));
        p.tokenSale = vm.envOr("TOKEN_SALE_PROXY",      address(0));
        p.companies = vm.envOr("COMPANIES_HOUSE_PROXY", address(0));
    }

    function _checkAll(Proxies memory p) internal view returns (bool[8] memory needs) {
        needs[0] = p.treasury  != address(0) && _needsUpgrade(p.treasury,  "Treasury.sol:Treasury");
        needs[1] = p.timelock  != address(0) && _needsUpgrade(p.timelock,  "Timelock.sol:Timelock");
        needs[2] = p.wlf       != address(0) && _needsUpgrade(p.wlf,       "WerewolfTokenV1.sol:WerewolfTokenV1");
        needs[3] = p.staking   != address(0) && _needsUpgrade(p.staking,   "Staking.sol:Staking");
        needs[4] = p.lp        != address(0) && _needsUpgrade(p.lp,        "LPStaking.sol:LPStaking");
        needs[5] = p.dao       != address(0) && _needsUpgrade(p.dao,       "DAO.sol:DAO");
        needs[6] = p.tokenSale != address(0) && _needsUpgrade(p.tokenSale, "TokenSale.sol:TokenSale");
        needs[7] = p.companies != address(0) && _needsUpgrade(p.companies, "src/CompaniesHouseV1.sol:CompaniesHouseV1");
    }

    function _executeAll(Proxies memory p, bool[8] memory needs) internal {
        if (needs[0]) _upgrade(p.treasury,  address(new Treasury()),         "Treasury");
        else          console.log("Treasury: unchanged, skipped");
        if (needs[1]) _upgrade(p.timelock,  address(new Timelock()),         "Timelock");
        else          console.log("Timelock: unchanged, skipped");
        if (needs[2]) _upgrade(p.wlf,       address(new WerewolfTokenV1()),  "WerewolfTokenV1");
        else          console.log("WerewolfTokenV1: unchanged, skipped");
        if (needs[3]) _upgrade(p.staking,   address(new Staking()),          "Staking");
        else          console.log("Staking: unchanged, skipped");
        if (needs[4]) _upgrade(p.lp,        address(new LPStaking()),        "LPStaking");
        else          console.log("LPStaking: unchanged, skipped");
        if (needs[5]) _upgrade(p.dao,       address(new DAO()),              "DAO");
        else          console.log("DAO: unchanged, skipped");
        if (needs[6]) _upgrade(p.tokenSale, address(new TokenSale()),        "TokenSale");
        else          console.log("TokenSale: unchanged, skipped");
        if (needs[7]) _upgrade(p.companies, address(new CompaniesHouseV1()), "CompaniesHouseV1");
        else          console.log("CompaniesHouseV1: unchanged, skipped");
    }

    function _needsUpgrade(address proxy, string memory artifact) internal view returns (bool) {
        bytes32 newCodeHash = keccak256(vm.getDeployedCode(artifact));
        address currentImpl = address(uint160(uint256(vm.load(proxy, IMPL_SLOT))));
        if (currentImpl == address(0)) return true;
        return currentImpl.codehash != newCodeHash;
    }

    function _upgrade(address proxy, address newImpl, string memory name) internal {
        ProxyAdmin admin = ProxyAdmin(
            address(uint160(uint256(vm.load(proxy, ADMIN_SLOT))))
        );
        admin.upgradeAndCall(ITransparentUpgradeableProxy(proxy), newImpl, "");
        console.log(name, "upgraded to:", newImpl);
    }
}
