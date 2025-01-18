// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {BaseTest, console} from "../BaseTest.t.sol";

import {MockWLFTokenAPY} from "./MockWLFTokenAPY.sol";

contract StakingTest is BaseTest {
    function setUp() public override {
        super.setUp();
    }

    function test_staking_setup() public {
        //blank to test the setup
    }

    function test_staking_apy_calculations() public {
        MockWLFTokenAPY wlfToken = new MockWLFTokenAPY();
        //overwrite the token address with the mock
        vm.etch(address(werewolfToken), address(wlfToken).code);
        MockWLFTokenAPY(address(werewolfToken)).setTotalSupply(10_000_000e18);

        uint256[] memory stakingBalances = new uint256[](10);
        {
            uint256 incrementAmount = 750_000e18;
            stakingBalances[0] = (incrementAmount);
            stakingBalances[1] = (2 * incrementAmount);
            stakingBalances[2] = (3 * incrementAmount);
            stakingBalances[3] = (4 * incrementAmount);
            stakingBalances[4] = (5 * incrementAmount);
            stakingBalances[5] = (6 * incrementAmount);
            stakingBalances[6] = (7 * incrementAmount);
            stakingBalances[7] = (8 * incrementAmount);
            stakingBalances[8] = (9 * incrementAmount);
            stakingBalances[9] = (10 * incrementAmount);
        }

        for (uint256 i = 0; i < stakingBalances.length; i++) {
            bytes32 stakedBalanceSlot = bytes32(uint256(1));
            bytes32 stakedAmount = bytes32(stakingBalances[i]);

            //store the value
            vm.store(address(staking), stakedBalanceSlot, stakedAmount);

            uint256 apy = staking.calculateApy();
            console.log("Staked balance is: ", uint256(stakedAmount));
            console.log("The apy is: ", apy);
        }

        /*  uint256 maxExp = (3 ** 99);
        console.log("Max exp value: ", maxExp); */
    }
}
