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
import {UniswapHelper} from "../src/UniswapHelper.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract Deploy is Script {
    //helper contract for chain settings
    HelperConfig helperConfig;
    HelperConfig.NetworkConfig netConfig;

    // Constants
    uint256 constant votingPeriod = 2 days;
    uint256 constant tokenSaleAirdrop = 5_000_000 ether;
    uint256 constant tokenPrice = 0.001 ether;

    // Addresses
    address multiSig;
    address founder;

    //Protocol contract instances
    Treasury treasury;
    Timelock timelock;
    WerewolfTokenV1 werewolfToken;
    Staking staking;
    DAO dao;
    TokenSale tokenSale;
    UniswapHelper uniswapHelper;

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
        uniswapHelper = new UniswapHelper(founder);
        /*Current order of Deployment: 
        * Treasury --> Timelock --> WereWolfToken --> Treasury::setWereWolfToken --> Staking --> DAO --> TokenSale
        *
        */
        //deploy treasury
        _deployTreasury();

        // Deploy Timelock
        _deployTimelock();

        // Deploy WerewolfTokenV1
        _deployWereWolfToken();

        // Set WerewolfToken in Treasury
        treasury.setWerewolfToken(address(werewolfToken));

        // Deploy Staking
        _deployStaking();

        // Deploy DAO
        _deployDao();

        // Deploy TokenSale
        _deployTokenSale();

        // Airdrop tokens to TokenSale
        werewolfToken.airdrop(address(tokenSale), tokenSaleAirdrop);

        // Start Token Sale #0
        tokenSale.startSaleZero(tokenSaleAirdrop, tokenPrice);

        // Transfer ownership to Timelock
        werewolfToken.transferOwnership(address(timelock));
        treasury.transferOwnership(address(timelock));
        tokenSale.transferOwnership(address(timelock));

        vm.stopBroadcast();
    }

    function _deployTreasury() internal {
        // Deploy Treasury
        Treasury treasuryImpl = new Treasury();
        bytes memory initDataTreasury = abi.encodeWithSelector(Treasury.initialize.selector, founder);
        TransparentUpgradeableProxy treasuryProxy =
            new TransparentUpgradeableProxy(address(treasuryImpl), netConfig.multiSig, initDataTreasury);
        treasury = Treasury(address(treasuryProxy));
    }

    function _deployTimelock() internal {
        Timelock timelockImpl = new Timelock();
        bytes memory initDataTimelock = abi.encodeWithSelector(Timelock.initialize.selector, founder, votingPeriod);
        TransparentUpgradeableProxy timelockProxy =
            new TransparentUpgradeableProxy(address(timelockImpl), netConfig.multiSig, initDataTimelock);
        timelock = Timelock(address(timelockProxy));
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
        TransparentUpgradeableProxy werewolfTokenProxy =
            new TransparentUpgradeableProxy(address(werewolfTokenImpl), netConfig.multiSig, initDataWerewolfToken);
        werewolfToken = WerewolfTokenV1(address(werewolfTokenProxy));
    }

    function _deployStaking() internal {
        Staking stakingImpl = new Staking();
        bytes memory initDataStaking =
            abi.encodeWithSelector(Staking.initialize.selector, address(werewolfToken), address(timelock));
        TransparentUpgradeableProxy stakingProxy =
            new TransparentUpgradeableProxy(address(stakingImpl), netConfig.multiSig, initDataStaking);
        staking = Staking(address(stakingProxy));
    }

    function _deployDao() internal {
        DAO daoImpl = new DAO();
        bytes memory initDataDAO = abi.encodeWithSelector(
            DAO.initialize.selector, address(werewolfToken), address(treasury), address(timelock), founder
        );
        TransparentUpgradeableProxy daoProxy =
            new TransparentUpgradeableProxy(address(daoImpl), netConfig.multiSig, initDataDAO);
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
            address(uniswapHelper)
        );
        TransparentUpgradeableProxy tokenSaleProxy =
            new TransparentUpgradeableProxy(address(tokenSaleImpl), netConfig.multiSig, initDataTokenSale);
        tokenSale = TokenSale(address(tokenSaleProxy));
    }
}
