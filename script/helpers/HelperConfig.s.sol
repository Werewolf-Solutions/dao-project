// SPDX: License-Identifier: MIT

pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDT} from "test/mocks/MockUSDT.sol";
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
        } else {
            revert("HelperConfig:getConfig chain not supported");
        }
    }

    function getSepoliaChainConfig() public returns (NetworkConfig memory sepoliaNetworkConfig) {
        //first time we will deploy our own usdt then after that we need to hardcode the address in the Constants contract
        address mockUsdt = address(new MockUSDT(1_000_000e6));

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address multiSig = vm.envAddress("MULTISIG_ADDRESS");

        // Uniswap v3 NonfungiblePositionManager on Sepolia
        address positionManager = 0x1238536071E1c677A632429e3655c799b22cDA52;

        sepoliaNetworkConfig = NetworkConfig({
            usdt: mockUsdt,
            deployerPrivateKey: deployerPrivateKey,
            multiSig: multiSig,
            positionManager: positionManager
        });
    }

    function getLocalChainConfig() public returns (NetworkConfig memory localNetworkConfig) {
        //default foundry private key
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address defaultFoundryAddress = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        vm.startBroadcast(deployerPrivateKey);
        address mockUsdt = address(new MockUSDT(1_000_000e6));
        MockUSDT(mockUsdt).mint(defaultFoundryAddress, 1_000_000e6);
        vm.stopBroadcast();
        address multiSig = makeAddr("multiSig");

        // For local testing, use a placeholder address (in tests, we'd mock this)
        address positionManager = makeAddr("uniswapPositionManager");

        localNetworkConfig = NetworkConfig({
            deployerPrivateKey: deployerPrivateKey,
            multiSig: multiSig,
            usdt: mockUsdt,
            positionManager: positionManager
        });
    }
}
