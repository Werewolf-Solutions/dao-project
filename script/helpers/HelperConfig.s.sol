// SPDX: License-Identifier: MIT

pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDT} from "test/mocks/MockUSDT.sol";
import {Constants} from "./Constants.sol";

contract HelperConfig is Script, Constants {
    struct NetworkConfig {
        uint256 deployerPrivateKey;
        address multiSig;
        address usdt;
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

    constructor() {
        /*  networkConfigs[LOCAL_CHAIN_ID] = getLocalChainConfig();
        networkConfigs[SEPOLIA_CHAIN_ID] = getSepoliaChainConfig(); */
    }

    function getConfig() public returns (NetworkConfig memory netConfig) {
        if (deployed) {
            return netConfig = currentNetworkConfig;
        }
        uint256 id = block.chainid;
        if (id == LOCAL_CHAIN_ID) {
            netConfig = getLocalChainConfig();
        } else if (id == SEPOLIA_CHAIN_ID) {
            netConfig = getSepoliaChainConfig();
        } else {
            revert("HelperConfig:getConfig chain not supported");
        }
        deployed = true;
    }

    function getSepoliaChainConfig() public returns (NetworkConfig memory sepoliaNetworkConfig) {
        //first time we will deploy our own usdt then after that we need to hardcode the address in the Constants contract
        address mockUsdt = address(new MockUSDT(1_000_000 ether));

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address multiSig = vm.envAddress("MULTISIG_ADDRESS");

        sepoliaNetworkConfig =
            NetworkConfig({usdt: mockUsdt, deployerPrivateKey: deployerPrivateKey, multiSig: multiSig});
    }

    function getLocalChainConfig() public returns (NetworkConfig memory localNetworkConfig) {
        address mockUsdt = address(new MockUSDT(1_000_000 ether));
        //default foundry private key
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address multiSig = makeAddr("multiSig");
        localNetworkConfig = NetworkConfig({usdt: mockUsdt, deployerPrivateKey: deployerPrivateKey, multiSig: multiSig});
    }
}
