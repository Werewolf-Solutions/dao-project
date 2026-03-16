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
        uint256 timelockDelay;    // 2 days on all networks
        address aavePool;         // Aave v3 Pool proxy (address(0) on local)
        bool isMockUsdt;          // true = MockUSDT (mintable); false = real USDT on live networks
        address aaveUsdt;         // Aave-listed USDT for DeFi (address(0) = use usdt field instead)
        address usdc;             // USDC token address (address(0) on local/chains without USDC)
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
        } else if (id == BASE_SEPOLIA_CHAIN_ID) {
            netConfig = getBaseSepoliaChainConfig();
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
            timelockDelay: 2 days,
            minReserveMonths: 3,  // 3-month reserve for testnet (DAO can raise to 60 via proposal)
            aavePool: 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951,  // Aave v3 Pool on Sepolia
            isMockUsdt: true,
            aaveUsdt: 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8,  // USDC on Aave Sepolia
            usdc: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238        // USDC on Sepolia
        });
    }

    function getBaseSepoliaChainConfig() public returns (NetworkConfig memory baseSepoliaNetworkConfig) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address multiSig = vm.envAddress("MULTISIG_ADDRESS");
        address deployer = vm.addr(deployerPrivateKey);

        // Deploy MockUSDT for WLF token sales — so founder sale and sale #1 work normally.
        // The real Aave-listed USDT (aaveUsdt) is used only for CompanyDeFi.
        vm.startBroadcast(deployerPrivateKey);
        address mockUsdt = address(new MockUSDT(1_000_000e6));
        MockUSDT(mockUsdt).mint(deployer, 1_000_000e6);
        vm.stopBroadcast();

        baseSepoliaNetworkConfig = NetworkConfig({
            deployerPrivateKey: deployerPrivateKey,
            multiSig: multiSig,
            usdt:            mockUsdt,                                      // MockUSDT for token sales
            positionManager: 0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2,   // Uniswap v3 NonfungiblePositionManager
            swapRouter:      0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4,   // Uniswap v3 SwapRouter
            weth:            0x4200000000000000000000000000000000000006,   // WETH9 on Base
            timelockDelay:   2 days,
            minReserveMonths: 3,
            aavePool:        0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27,   // Aave v3 Pool on Base Sepolia (AaveV3BaseSepolia.POOL)
            isMockUsdt:      true,
            aaveUsdt:        0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f,  // Aave-listed USDC on Base Sepolia
            usdc:            0x036CbD53842c5426634e7929541eC2318f3dCF7e    // USDC on Base Sepolia
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
            minReserveMonths: 60,      // 5-year reserve floor for CompaniesHouse
            aavePool:        0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2,  // Aave v3 Pool on Ethereum mainnet
            isMockUsdt:      false,  // Real Tether USDT — cannot mint
            aaveUsdt:        address(0),  // Same as usdt on mainnet
            usdc:            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  // Circle USDC on mainnet
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
            timelockDelay: 2 days,
            minReserveMonths: 1,     // 1-month reserve for local testing
            aavePool: address(0),    // No Aave on local chain — CompanyDeFiV1 skips integration
            isMockUsdt: true,
            aaveUsdt: address(0),    // No separate Aave USDT on local chain
            usdc: address(0)         // No USDC on local chain
        });
    }
}
