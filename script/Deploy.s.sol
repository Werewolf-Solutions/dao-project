// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {HelperConfig} from "./helpers/HelperConfig.s.sol";

import {WerewolfTokenV1} from "../src/WerewolfTokenV1.sol";
import {Treasury} from "../src/Treasury.sol";
import {TokenSale} from "../src/TokenSale.sol";
import {Timelock} from "../src/Timelock.sol";
import {DAO} from "../src/DAO.sol";
import {Staking} from "../src/Staking.sol";
import {LPStaking} from "../src/LPStaking.sol";
import {UniswapHelper} from "../src/UniswapHelper.sol";
import {CompaniesHouseV1} from "../src/CompaniesHouseV1.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract Deploy is Script {
    //helper contract for chain settings
    HelperConfig helperConfig;
    HelperConfig.NetworkConfig netConfig;

    // Constants
    // votingPeriod is hardcoded in DAO.sol::votingPeriod() — 1 hour for testnet
    // timelockDelay comes from netConfig (0 for local/Sepolia, 2 days for mainnet)
    uint256 constant tokenSaleAirdrop = 5_000_000 ether;
    uint256 constant tokenPrice = 0.0004 ether;

    // Addresses
    address multiSig;
    address founder;

    // Protocol contract instances
    Treasury treasury;
    Timelock timelock;
    WerewolfTokenV1 werewolfToken;
    Staking staking;
    LPStaking lpStaking;
    DAO dao;
    TokenSale tokenSale;
    UniswapHelper uniswapHelper;
    CompaniesHouseV1 companiesHouse;


    function run() external {
        // setting up a helper contract that will handle mocks and mainnet address's etc
        // The helper will handle all dependencies/external contract that the protocol will interact with
        helperConfig = new HelperConfig();
        netConfig = helperConfig.getConfig();

        // starting broadcast
        vm.startBroadcast(netConfig.deployerPrivateKey);

        // Define addresses
        founder = vm.addr(netConfig.deployerPrivateKey); //Note this might need to be changed

        // Deploy UniswapHelper
        uniswapHelper = new UniswapHelper(netConfig.positionManager);

        // Deploy Treasury
        _deployTreasury();

        // Deploy Timelock
        _deployTimelock();

        // Deploy WerewolfTokenV1
        _deployWereWolfToken();

        // Set WerewolfToken in Treasury
        treasury.setWerewolfToken(address(werewolfToken));

        // Deploy Staking
        _deployStaking();

        // Deploy LPStaking
        _deployLPStaking();

        // Configure Treasury for LP staking
        treasury.setStakingContract(address(staking));
        treasury.setLPStakingContract(address(lpStaking));

        // Deploy DAO
        _deployDao();

        // Wire staking contracts for voting power computation
        dao.setStakingContracts(address(staking), address(lpStaking));

        // Deploy TokenSale
        _deployTokenSale();

        // Wire DAO into TokenSale so endSale() can auto-delegate sale #0/#1 buyers to founder
        tokenSale.setDaoContract(address(dao));

        // Wire TokenSale into DAO so DAO.autoDelegate() accepts calls from TokenSale
        dao.setTokenSaleContract(address(tokenSale));

        // Set TokenSale contract in LPStaking (can only be set once)
        lpStaking.setTokenSaleContract(address(tokenSale));
        lpStaking.transferOwnership(address(timelock));

        // Deploy CompaniesHouseV1
        _deployCompaniesHouse();

        // Airdrop tokens to TokenSale
        werewolfToken.airdrop(address(tokenSale), tokenSaleAirdrop);

        // Start Token Sale #0
        tokenSale.startSaleZero(tokenSaleAirdrop, tokenPrice);

        // Configure Treasury swap router for DAO buyback proposals (skip on local chain)
        if (netConfig.swapRouter != address(0)) {
            treasury.setSwapRouter(netConfig.swapRouter, netConfig.usdt, 500);
        }

        // Wire Staking.treasury while founder still owns Staking
        staking.setTreasury(address(treasury));

        // Authorize LPStaking and CompaniesHouse as WLF payEmployee callers
        // (must happen before werewolfToken.transferOwnership — onlyOwner check)
        werewolfToken._authorizeCaller(address(lpStaking));
        werewolfToken._authorizeCaller(address(companiesHouse));

        // Transfer ownership to Timelock
        werewolfToken.transferOwnership(address(timelock));
        treasury.transferOwnership(address(timelock));
        tokenSale.transferOwnership(address(timelock));
        staking.transferOwnership(address(timelock));

        // Transfer Timelock admin to DAO (must be last action as founder)
        // setPendingAdmin now accepts msg.sender == admin, no queue needed
        timelock.setPendingAdmin(address(dao));
        dao.__acceptAdmin();

        console.log("Timelock admin transferred to DAO. Timelock.delay =", timelock.delay());

        vm.stopBroadcast();

        //Write the address to file
        _writeDeploymentData();
    }

    function _deployTreasury() internal {
        // Deploy Treasury
        Treasury treasuryImpl = new Treasury();
        bytes memory initDataTreasury = abi.encodeWithSelector(
            Treasury.initialize.selector,
            founder
        );
        TransparentUpgradeableProxy treasuryProxy = new TransparentUpgradeableProxy(
                address(treasuryImpl),
                netConfig.multiSig,
                initDataTreasury
            );
        treasury = Treasury(address(treasuryProxy));
    }

    function _deployTimelock() internal {
        Timelock timelockImpl = new Timelock();
        bytes memory initDataTimelock = abi.encodeWithSelector(
            Timelock.initialize.selector,
            founder,
            netConfig.timelockDelay
        );
        TransparentUpgradeableProxy timelockProxy = new TransparentUpgradeableProxy(
                address(timelockImpl),
                netConfig.multiSig,
                initDataTimelock
            );
        timelock = Timelock(address(timelockProxy));
    }

    function _deployCompaniesHouse() internal {
        CompaniesHouseV1 companiesHouseImpl = new CompaniesHouseV1();
        bytes memory initDataCompaniesHouse = abi.encodeWithSelector(
            CompaniesHouseV1.initialize.selector,
            address(werewolfToken),
            address(treasury),
            address(dao),
            address(tokenSale),
            address(timelock),         // admin — Timelock controls company treasury admin functions
            netConfig.usdt,            // USDT token for employee payouts
            netConfig.swapRouter,      // Uniswap V3 router (address(0) on local chain)
            netConfig.minReserveMonths // 1 local / 3 testnet / 60 mainnet
        );
        TransparentUpgradeableProxy companiesHouseProxy = new TransparentUpgradeableProxy(
                address(companiesHouseImpl),
                netConfig.multiSig,
                initDataCompaniesHouse
            );
        companiesHouse = CompaniesHouseV1(address(companiesHouseProxy));
    }

    function _deployWereWolfToken() internal {
        WerewolfTokenV1 werewolfTokenImpl = new WerewolfTokenV1();
        bytes memory initDataWerewolfToken = abi.encodeWithSelector(
            WerewolfTokenV1.initialize.selector,
            founder,
            address(treasury),
            address(timelock),
            founder,
            address(0x1) // Placeholder for another address
        );
        TransparentUpgradeableProxy werewolfTokenProxy = new TransparentUpgradeableProxy(
                address(werewolfTokenImpl),
                netConfig.multiSig,
                initDataWerewolfToken
            );
        werewolfToken = WerewolfTokenV1(address(werewolfTokenProxy));
    }

    function _deployStaking() internal {
        Staking stakingImpl = new Staking();
        bytes memory initDataStaking = abi.encodeWithSelector(
            Staking.initialize.selector,
            address(werewolfToken),
            founder  // founder owns initially so setTreasury() can be called before timelock transfer
        );
        TransparentUpgradeableProxy stakingProxy = new TransparentUpgradeableProxy(
                address(stakingImpl),
                netConfig.multiSig,
                initDataStaking
            );
        staking = Staking(address(stakingProxy));
    }

    function _deployLPStaking() internal {
        LPStaking lpStakingImpl = new LPStaking();
        bytes memory initDataLPStaking = abi.encodeWithSelector(
            LPStaking.initialize.selector,
            address(werewolfToken),         // WLF token
            netConfig.usdt,                  // USDT token
            founder,                          // Owner (transferred to timelock after setTokenSaleContract)
            address(treasury),               // Reward source
            netConfig.positionManager        // Uniswap v3 NFT manager
        );
        TransparentUpgradeableProxy lpStakingProxy = new TransparentUpgradeableProxy(
                address(lpStakingImpl),
                netConfig.multiSig,
                initDataLPStaking
            );
        lpStaking = LPStaking(address(lpStakingProxy));
    }

    function _deployDao() internal {
        DAO daoImpl = new DAO();
        bytes memory initDataDAO = abi.encodeWithSelector(
            DAO.initialize.selector,
            address(werewolfToken),
            address(treasury),
            address(timelock),
            founder
        );
        TransparentUpgradeableProxy daoProxy = new TransparentUpgradeableProxy(
            address(daoImpl),
            netConfig.multiSig,
            initDataDAO
        );
        dao = DAO(address(daoProxy));
    }

    function _deployTokenSale() internal {
        TokenSale tokenSaleImpl = new TokenSale();
        bytes memory initDataTokenSale = abi.encodeWithSelector(
            TokenSale.initialize.selector,
            founder,
            address(werewolfToken),
            address(treasury),
            address(timelock),
            netConfig.usdt,
            address(staking),
            address(lpStaking),
            address(uniswapHelper)
        );
        TransparentUpgradeableProxy tokenSaleProxy = new TransparentUpgradeableProxy(
                address(tokenSaleImpl),
                netConfig.multiSig,
                initDataTokenSale
            );
        tokenSale = TokenSale(payable(address(tokenSaleProxy)));
    }

    function _writeDeploymentData() internal {
        // Inside foundry.toml it must have the following settings enabled
        // fs_permissions = [{ access = "write", path = "./"}]

        string memory path = "./script/output/deployed-addresses.txt";
        vm.removeFile(path);

        vm.writeLine(
            path,
            string.concat("Chain ID:", vm.toString(block.chainid))
        );

        string memory treasuryStr = string.concat(
            "Treasury:",
            vm.toString(address(treasury))
        );
        vm.writeLine(path, treasuryStr);

        string memory timelockStr = string.concat(
            "TimeLock:",
            vm.toString(address(timelock))
        );
        vm.writeLine(path, timelockStr);

        string memory werewolfTokenStr = string.concat(
            "WerewolfToken:",
            vm.toString(address(werewolfToken))
        );
        vm.writeLine(path, werewolfTokenStr);

        string memory stakingStr = string.concat(
            "Staking:",
            vm.toString(address(staking))
        );
        vm.writeLine(path, stakingStr);

        string memory lpStakingStr = string.concat(
            "LPStaking:",
            vm.toString(address(lpStaking))
        );
        vm.writeLine(path, lpStakingStr);

        string memory daoStr = string.concat("DAO:", vm.toString(address(dao)));
        vm.writeLine(path, daoStr);

        string memory tokenSaleStr = string.concat(
            "TokenSale:",
            vm.toString(address(tokenSale))
        );
        vm.writeLine(path, tokenSaleStr);

        string memory usdtStr = string.concat(
            "USDT:",
            vm.toString(address(netConfig.usdt))
        );
        vm.writeLine(path, usdtStr);

        string memory companiesHouseStr = string.concat(
            "CompaniesHouse:",
            vm.toString(address(companiesHouse))
        );
        vm.writeLine(path, companiesHouseStr);
    }
}
