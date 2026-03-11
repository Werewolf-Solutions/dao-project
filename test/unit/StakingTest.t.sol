// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {BaseTest, console} from "../BaseTest.t.sol";
import {Staking} from "../../src/Staking.sol";

import {MockWLFTokenAPY} from "./MockWLFTokenAPY.sol";

contract StakingTest is BaseTest {
    function setUp() public override {
        super.setUp();
    }

    function test_staking_setup() public {
        //blank to test the setup
    }

    // ── Stake & Position Tests ────────────────────────────────────────────────

    function test_stakeFlexible_createsPosition() public {
        uint256 amount = 100 ether;
        vm.startPrank(founder);
        werewolfToken.approve(address(staking), amount);
        staking.stakeFlexible(amount);
        vm.stopPrank();

        Staking.StakePosition[] memory positions = staking.getPositions(founder);
        assertEq(positions.length, 1, "Should have 1 position");
        assertTrue(positions[0].active, "Position should be active");
        assertEq(positions[0].unlockAt, 0, "Flexible position should have unlockAt=0");
        assertGt(positions[0].shares, 0, "Should have shares");
    }

    function test_stakeFixed_allDurations() public {
        uint256 amount = 10 ether;
        uint256[7] memory durations = [
            staking.DURATION_30D(),
            staking.DURATION_3MO(),
            staking.DURATION_6MO(),
            staking.DURATION_1YR(),
            staking.DURATION_2YR(),
            staking.DURATION_5YR(),
            staking.DURATION_10YR()
        ];
        uint256[7] memory expectedBonus = [
            uint256(  5_000),
                     10_000,
                     20_000,
                     50_000,
                    100_000,
                    150_000,
                    200_000
        ];

        vm.startPrank(founder);
        werewolfToken.approve(address(staking), amount * 7);
        for (uint256 i = 0; i < durations.length; i++) {
            staking.stakeFixed(amount, durations[i]);
        }
        vm.stopPrank();

        Staking.StakePosition[] memory positions = staking.getPositions(founder);
        assertEq(positions.length, 7, "Should have 7 positions");
        for (uint256 i = 0; i < durations.length; i++) {
            assertEq(positions[i].unlockAt, block.timestamp + durations[i], "Incorrect unlockAt");
            assertEq(positions[i].bonusApy, expectedBonus[i], "Incorrect bonusApy");
            assertTrue(positions[i].active, "Position should be active");
        }
    }

    function test_withdrawPosition_earnsBonus() public {
        uint256 amount = 100 ether;
        vm.startPrank(founder);
        werewolfToken.approve(address(staking), amount);
        staking.stakeFixed(amount, staking.DURATION_1YR());
        vm.stopPrank();

        // Fund reward reserve (base APY + bonus)
        deal(address(werewolfToken), address(staking), 1_000 ether);

        // Advance exactly 1 year
        vm.warp(block.timestamp + staking.DURATION_1YR() + 1);

        uint256 balanceBefore = werewolfToken.balanceOf(founder);
        vm.prank(founder);
        staking.withdrawPosition(0);
        uint256 received = werewolfToken.balanceOf(founder) - balanceBefore;

        // Bonus for 1yr = 50_000 / 100_000 = 50% on principal (100 ether) ≈ 50 ether
        // ERC4626 base rewards add a small amount on top
        assertGt(received, 149 ether, "Should receive principal + bonus > 149 WLF");
    }

    function test_withdrawPosition_beforeUnlock_reverts() public {
        uint256 amount = 100 ether;
        vm.startPrank(founder);
        werewolfToken.approve(address(staking), amount);
        staking.stakeFixed(amount, staking.DURATION_30D());
        vm.expectRevert("Staking: still locked");
        staking.withdrawPosition(0);
        vm.stopPrank();
    }

    function test_withdrawPosition_afterUnlock_succeeds() public {
        uint256 amount = 100 ether;
        vm.startPrank(founder);
        werewolfToken.approve(address(staking), amount);
        staking.stakeFixed(amount, staking.DURATION_30D());
        vm.stopPrank();

        // Fund staking contract with extra tokens to cover accrued rewards
        deal(address(werewolfToken), address(staking), 300 ether);

        vm.warp(block.timestamp + staking.DURATION_30D() + 1);
        vm.prank(founder);
        uint256 withdrawn = staking.withdrawPosition(0);

        assertGt(withdrawn, 0, "Should withdraw some tokens");
        Staking.StakePosition[] memory positions = staking.getPositions(founder);
        assertFalse(positions[0].active, "Position should be inactive after withdrawal");
    }

    function test_withdrawAmountFromPosition_partial() public {
        uint256 amount = 100 ether;
        vm.startPrank(founder);
        werewolfToken.approve(address(staking), amount);
        staking.stakeFlexible(amount);

        uint256 partialWithdraw = 40 ether;
        uint256 withdrawn = staking.withdrawAmountFromPosition(0, partialWithdraw);
        vm.stopPrank();

        assertGe(withdrawn, partialWithdraw - 1, "Withdrawn amount approx correct");
        Staking.StakePosition[] memory positions = staking.getPositions(founder);
        assertTrue(positions[0].active, "Position should still be active");
    }

    function test_withdrawAll_clearsPositions() public {
        uint256 amount = 50 ether;
        vm.startPrank(founder);
        werewolfToken.approve(address(staking), amount * 2);
        staking.stakeFlexible(amount);
        staking.stakeFixed(amount, staking.DURATION_30D());
        vm.stopPrank();

        // Fund staking contract with extra tokens to cover accrued rewards
        deal(address(werewolfToken), address(staking), 300 ether);

        // Advance past the lock
        vm.warp(block.timestamp + staking.DURATION_30D() + 1);
        vm.prank(founder);
        staking.withdrawAll();

        Staking.StakePosition[] memory positions = staking.getPositions(founder);
        for (uint256 i = 0; i < positions.length; i++) {
            assertFalse(positions[i].active, "All positions should be withdrawn");
        }
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
