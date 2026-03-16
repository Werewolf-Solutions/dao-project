// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {BaseTest} from "../BaseTest.t.sol";

contract WerewolfTokenTest is BaseTest {
    function setUp() public override {
        super.setUp();
    }

    // ── Mint Tests ────────────────────────────────────────────────────────────

    function test_mint_revertsForNonOwner() public {
        vm.prank(addr1);
        vm.expectRevert();
        werewolfToken.mint(1000 ether);
    }

    function test_mint_succeeds_asOwner() public {
        uint256 balanceBefore = werewolfToken.balanceOf(address(treasury));
        vm.prank(address(timelock));
        werewolfToken.mint(500 ether);
        assertEq(werewolfToken.balanceOf(address(treasury)), balanceBefore + 500 ether);
    }

    // ── Airdrop Tests ─────────────────────────────────────────────────────────

    function test_airdrop_distributeTokens() public {
        address recipient = makeAddr("recipient");
        uint256 amount = 200 ether;

        uint256 treasuryBefore = werewolfToken.balanceOf(address(treasury));
        uint256 recipientBefore = werewolfToken.balanceOf(recipient);

        vm.prank(address(timelock));
        werewolfToken.airdrop(recipient, amount);

        assertEq(werewolfToken.balanceOf(recipient), recipientBefore + amount);
        assertEq(werewolfToken.balanceOf(address(treasury)), treasuryBefore - amount);
    }

    function test_airdrop_reverts_forNonOwner() public {
        vm.prank(addr1);
        vm.expectRevert();
        werewolfToken.airdrop(addr2, 100 ether);
    }

    // ── Checkpoint Tests ──────────────────────────────────────────────────────

    function test_getPriorVotes_zeroBeforeAnyTransfers() public {
        address newAddr = makeAddr("brand_new");
        // newAddr has never received tokens
        vm.roll(block.number + 1);
        uint96 votes = werewolfToken.getPriorVotes(newAddr, block.number - 1);
        assertEq(votes, 0, "Should have 0 prior votes before any transfers");
    }

    function test_getPriorVotes_reflectsBalanceAfterTransfer() public {
        // founder received WLF during setUp (at the setUp block); roll forward first
        vm.roll(block.number + 1);
        uint256 pastBlock = block.number - 1; // the block where setUp checkpoints were written

        uint96 founderVotes = werewolfToken.getPriorVotes(founder, pastBlock);
        assertGt(founderVotes, 0, "Founder should have prior votes");
    }

    function test_getPriorVotes_checkpointWrittenOnTransfer() public {
        uint256 transferAmount = 50 ether;

        // Transfer tokens (writes checkpoint at current block)
        vm.prank(address(timelock));
        werewolfToken.airdrop(makeAddr("target"), transferAmount);

        // Roll to next block, then query the block where the transfer happened
        vm.roll(block.number + 1);
        uint256 snapshotBlock = block.number - 1;

        // Treasury votes at snapshotBlock should equal current balance (no further transfers)
        uint96 treasuryVotes = werewolfToken.getPriorVotes(address(treasury), snapshotBlock);
        uint256 currentBalance = werewolfToken.balanceOf(address(treasury));
        assertEq(uint256(treasuryVotes), currentBalance, "Checkpoint should match current balance when no further transfers");
    }

    function test_getPriorVotes_reverts_forCurrentBlock() public {
        vm.expectRevert("WerewolfTokenV1::getPriorVotes: not yet determined");
        werewolfToken.getPriorVotes(founder, block.number);
    }
}
