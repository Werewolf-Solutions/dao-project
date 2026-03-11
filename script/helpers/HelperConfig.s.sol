// SPDX: License-Identifier: MIT

pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDT} from "test/mocks/MockUSDT.sol";
import {MockPositionManager} from "test/mocks/MockPositionManager.sol";
import {MockWETH} from "test/mocks/MockWETH.sol";
import {Constants} from "./Constants.sol";

/**
 *
 */
contract HelperConfig is Script, Constants {
    struct NetworkConfig {
        uint256 deployerPrivateKey;
        address multiSig;
        address usdt;
        address positionManager;  // Uniswap v3 NonfungiblePositionManager
        address swapRouter;       // Uniswap v3 SwapRouter (address(0) on local)
        uint256 minReserveMonths; // USDT reserve threshold: 3 for testnet, 60 for mainnet
        address weth;             // WETH9 / Wrapped Ether
        uint256 timelockDelay;    // 0 for local/testnet; 2 days for mainnet
    }
    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////
    // Local network state variables

    mapping(uint256 chainId => NetworkConfig) public networkConfigs;
    bool deployed;
    NetworkConfig currentNetworkConfig;
    /////////////////////////////////
    //           Functions         //
    ////////////////////////////////

    constructor() {}

    function getConfig() public returns (NetworkConfig memory netConfig) {
        if (deployed) {
            return netConfig = currentNetworkConfig;
        }
        deployed = true;

        uint256 id = block.chainid;
        if (id == LOCAL_CHAIN_ID) {
            netConfig = getLocalChainConfig();
        } else if (id == SEPOLIA_CHAIN_ID) {
            netConfig = getSepoliaChainConfig();
        } else if (id == ETH_MAINNET_CHAIN_ID) {
            netConfig = getMainnetChainConfig();
        } else {
            revert("HelperConfig:getConfig chain not supported");
        }
    }

    function getSepoliaChainConfig() public returns (NetworkConfig memory sepoliaNetworkConfig) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address multiSig = vm.envAddress("MULTISIG_ADDRESS");
        address deployer = vm.addr(deployerPrivateKey);

        // Deploy MockUSDT inside broadcast so it actually lands on-chain
        vm.startBroadcast(deployerPrivateKey);
        address mockUsdt = address(new MockUSDT(1_000_000e6));
        MockUSDT(mockUsdt).mint(deployer, 1_000_000e6);
        vm.stopBroadcast();

        // Uniswap v3 NonfungiblePositionManager on Sepolia
        address positionManager = 0x1238536071E1c677A632429e3655c799b22cDA52;

        // Uniswap v3 SwapRouter on Sepolia
        address swapRouterAddr = 0xE592427A0AEce92De3Edee1F18E0157C05861564;

        // WETH9 on Sepolia
        address weth = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;

        sepoliaNetworkConfig = NetworkConfig({
            usdt: mockUsdt,
            deployerPrivateKey: deployerPrivateKey,
            multiSig: multiSig,
            positionManager: positionManager,
            swapRouter: swapRouterAddr,
            weth: weth,
            timelockDelay: 0,
            minReserveMonths: 3  // 3-month reserve for testnet (DAO can raise to 60 via proposal)
        });
    }

    function getMainnetChainConfig() public view returns (NetworkConfig memory) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address multiSig = vm.envAddress("MULTISIG_ADDRESS");
        return NetworkConfig({
            deployerPrivateKey: deployerPrivateKey,
            multiSig: multiSig,
            usdt:            0xdAC17F958D2ee523a2206206994597C13D831ec7, // Tether USDT
            positionManager: 0xC36442b4a4522E871399CD717aBDD847Ab11FE88, // Uniswap v3 NonfungiblePositionManager
            swapRouter:      0xE592427A0AEce92De3Edee1F18E0157C05861564, // Uniswap v3 SwapRouter
            weth:            0xc02AAa39B223fE8d0a0e8E4f27eAd9083c756CC2, // WETH9
            timelockDelay:   2 days,   // 172800 s — enforces governance delay
            minReserveMonths: 60       // 5-year reserve floor for CompaniesHouse
        });
    }

    function getLocalChainConfig() public returns (NetworkConfig memory localNetworkConfig) {
        //default foundry private key
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address defaultFoundryAddress = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        vm.startBroadcast(deployerPrivateKey);
        address mockUsdt = address(new MockUSDT(1_000_000e6));
        MockUSDT(mockUsdt).mint(defaultFoundryAddress, 1_000_000e6);
        address positionManager = address(new MockPositionManager());
        address weth = address(new MockWETH());
        vm.stopBroadcast();
        address multiSig = makeAddr("multiSig");

        localNetworkConfig = NetworkConfig({
            deployerPrivateKey: deployerPrivateKey,
            multiSig: multiSig,
            usdt: mockUsdt,
            positionManager: positionManager,
            swapRouter: address(0),  // No real SwapRouter on local chain
            weth: weth,
            timelockDelay: 0,
            minReserveMonths: 1  // 1-month reserve for local testing
        });
    }
}
