// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {BaseTest} from "../BaseTest.t.sol";
import {Timelock} from "../../src/Timelock.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract TimelockTest is BaseTest {
    function setUp() public override {
        super.setUp();
    }

    // ── Initialize ────────────────────────────────────────────────────────────

    function test_initialize_reverts_belowMinDelay() public {
        address impl = address(new Timelock());
        bytes memory initData = abi.encodeWithSelector(
            Timelock.initialize.selector, founder, 1 days  // < MINIMUM_DELAY (2 days)
        );
        vm.expectRevert("Timelock::constructor: Delay must exceed minimum delay.");
        new TransparentUpgradeableProxy(impl, multiSig, initData);
    }

    function test_initialize_reverts_aboveMaxDelay() public {
        address impl = address(new Timelock());
        bytes memory initData = abi.encodeWithSelector(
            Timelock.initialize.selector, founder, 31 days  // > MAXIMUM_DELAY (30 days)
        );
        vm.expectRevert("Timelock::setDelay: Delay must not exceed maximum delay.");
        new TransparentUpgradeableProxy(impl, multiSig, initData);
    }

    function test_initialize_succeeds_withValidDelay() public {
        address impl = address(new Timelock());
        bytes memory initData = abi.encodeWithSelector(
            Timelock.initialize.selector, founder, 2 days
        );
        Timelock t = Timelock(address(new TransparentUpgradeableProxy(impl, multiSig, initData)));
        assertEq(t.delay(), 2 days);
        assertEq(t.admin(), founder);
    }

    // ── queueTransaction ─────────────────────────────────────────────────────

    function test_queueTransaction_reverts_ifEtaTooEarly() public {
        uint256 badEta = block.timestamp + 1 days;  // < delay (2 days)
        vm.prank(founder);
        vm.expectRevert("Timelock::queueTransaction: Estimated execution block must satisfy delay.");
        timelock.queueTransaction(address(0x1), "", "", badEta);
    }

    function test_queueTransaction_succeeds_withCorrectEta() public {
        uint256 eta = block.timestamp + timelock.delay();
        vm.prank(founder);
        bytes32 txHash = timelock.queueTransaction(address(0x1), "sig()", "", eta);
        assertTrue(timelock.queuedTransactions(txHash), "Transaction should be queued");
    }

    // ── cancelTransaction ─────────────────────────────────────────────────────

    function test_cancelTransaction_removesQueuedTx() public {
        uint256 eta = block.timestamp + timelock.delay();
        vm.prank(founder);
        bytes32 txHash = timelock.queueTransaction(address(0x1), "sig()", "", eta);
        assertTrue(timelock.queuedTransactions(txHash), "Should be queued");

        vm.prank(founder);
        timelock.cancelTransaction(address(0x1), "sig()", "", eta);
        assertFalse(timelock.queuedTransactions(txHash), "Should be dequeued after cancel");
    }

    // ── executeTransaction ────────────────────────────────────────────────────

    function test_executeTransaction_reverts_beforeEta() public {
        // Deploy a simple target (use address(this) — calls won't revert if data is empty)
        address target = address(this);
        uint256 eta = block.timestamp + timelock.delay();

        vm.prank(founder);
        timelock.queueTransaction(target, "", "", eta);

        // Try to execute before eta passes
        vm.warp(eta - 1);
        vm.prank(founder);
        vm.expectRevert("Timelock::executeTransaction: Transaction hasn't surpassed time lock.");
        timelock.executeTransaction(target, "", "", eta);
    }

    function test_executeTransaction_reverts_pastGracePeriod() public {
        address target = address(this);
        uint256 eta = block.timestamp + timelock.delay();

        vm.prank(founder);
        timelock.queueTransaction(target, "", "", eta);

        // Advance past grace period
        vm.warp(eta + timelock.GRACE_PERIOD() + 1);
        vm.prank(founder);
        vm.expectRevert("Timelock::executeTransaction: Transaction is stale.");
        timelock.executeTransaction(target, "", "", eta);
    }

    function test_executeTransaction_succeeds_atEta() public {
        // Queue a no-op call
        address target = address(this);
        uint256 eta = block.timestamp + timelock.delay();

        vm.prank(founder);
        timelock.queueTransaction(target, "", "", eta);

        vm.warp(eta);
        vm.prank(founder);
        timelock.executeTransaction(target, "", "", eta);

        // After execution, the tx should be dequeued
        bytes32 txHash = keccak256(abi.encode(target, "", "", eta));
        assertFalse(timelock.queuedTransactions(txHash), "Tx should be dequeued after execution");
    }

    // Fallback to accept the empty call from executeTransaction
    fallback() external {}
}
