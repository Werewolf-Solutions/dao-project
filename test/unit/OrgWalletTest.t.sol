// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {OrgWalletImpl} from "../../src/OrgWalletImpl.sol";
import {OrgBeaconFactory} from "../../src/OrgBeaconFactory.sol";
import {IPaymentEngine} from "../../src/interfaces/IPaymentEngine.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @dev Tests for OrgWalletImpl and OrgBeaconFactory.
 *      Run with:  forge test --match-path test/unit/OrgWalletTest.t.sol -vvvv
 */
contract OrgWalletTest is Test {

    OrgWalletImpl    impl;
    OrgBeaconFactory factory;

    address org      = makeAddr("org");
    address employee = makeAddr("employee");
    address stranger = makeAddr("stranger");
    address operator = makeAddr("operator");

    uint96 constant ORG_ID = 1;

    OrgWalletImpl wallet;
    address beaconAddr;

    function setUp() public {
        impl    = new OrgWalletImpl();
        factory = new OrgBeaconFactory(address(impl));

        vm.prank(org);
        beaconAddr = factory.createOrgBeacon(org, ORG_ID);

        address walletAddr = factory.deployWallet(beaconAddr, org, employee);
        wallet = OrgWalletImpl(payable(walletAddr));
    }

    // ── Test 1: initialize sets org and owner ─────────────────────────────────

    function test_initialize_sets_org_and_owner() public view {
        assertEq(wallet.org(),   org);
        assertEq(wallet.owner(), employee);
    }

    // ── Test 2: execute by org ────────────────────────────────────────────────

    function test_execute_by_org() public {
        address target = makeAddr("target");
        vm.deal(address(wallet), 1 ether);

        vm.prank(org);
        wallet.execute(target, 0.5 ether, "");

        assertEq(target.balance, 0.5 ether);
    }

    // ── Test 3: execute by owner (employee EOA) ───────────────────────────────

    function test_execute_by_owner() public {
        address target = makeAddr("target");
        vm.deal(address(wallet), 1 ether);

        vm.prank(employee);
        wallet.execute(target, 0.1 ether, "");

        assertEq(target.balance, 0.1 ether);
    }

    // ── Test 4: execute reverts for unauthorized caller ───────────────────────

    function test_execute_reverts_unauthorized() public {
        vm.deal(address(wallet), 1 ether);
        vm.prank(stranger);
        vm.expectRevert(OrgWalletImpl.NotAuthorized.selector);
        wallet.execute(makeAddr("target"), 0.1 ether, "");
    }

    // ── Test 5: executeBatch succeeds for all calls ───────────────────────────

    function test_executeBatch() public {
        address t1 = makeAddr("t1");
        address t2 = makeAddr("t2");
        vm.deal(address(wallet), 2 ether);

        IPaymentEngine.Call[] memory calls = new IPaymentEngine.Call[](2);
        calls[0] = IPaymentEngine.Call({ to: t1, value: 0.3 ether, data: "" });
        calls[1] = IPaymentEngine.Call({ to: t2, value: 0.7 ether, data: "" });

        vm.prank(org);
        wallet.executeBatch(calls);

        assertEq(t1.balance, 0.3 ether);
        assertEq(t2.balance, 0.7 ether);
    }

    // ── Test 6: authorizeOperator by org allows execution ─────────────────────

    function test_authorizeOperator_by_org() public {
        vm.prank(org);
        wallet.authorizeOperator(operator);
        assertTrue(wallet.isOperator(operator));

        address target = makeAddr("target");
        vm.deal(address(wallet), 1 ether);
        vm.prank(operator);
        wallet.execute(target, 0.1 ether, "");
        assertEq(target.balance, 0.1 ether);
    }

    // ── Test 7: authorizeOperator reverts if called by owner (not org) ─────────

    function test_authorizeOperator_reverts_if_not_org() public {
        vm.prank(employee);
        vm.expectRevert(OrgWalletImpl.NotAuthorized.selector);
        wallet.authorizeOperator(operator);
    }

    // ── Test 8: revokeOperator removes access ─────────────────────────────────

    function test_revokeOperator() public {
        vm.prank(org);
        wallet.authorizeOperator(operator);

        vm.prank(org);
        wallet.revokeOperator(operator);
        assertFalse(wallet.isOperator(operator));

        vm.deal(address(wallet), 1 ether);
        vm.prank(operator);
        vm.expectRevert(OrgWalletImpl.NotAuthorized.selector);
        wallet.execute(makeAddr("target"), 0.1 ether, "");
    }

    // ── Test 9: beacon upgrade propagates to all existing wallets ─────────────

    function test_beacon_upgrade() public {
        // Deploy a V2 implementation with an extra function
        OrgWalletV2Mock v2 = new OrgWalletV2Mock();

        // Org admin upgrades the beacon
        vm.prank(org);
        UpgradeableBeacon(beaconAddr).upgradeTo(address(v2));

        // Existing wallet proxy now uses V2 logic
        assertEq(OrgWalletV2Mock(payable(address(wallet))).version(), 2);
        // Existing state is preserved
        assertEq(wallet.org(),   org);
        assertEq(wallet.owner(), employee);
    }

    // ── Test 10: wallet accepts ETH via receive() ─────────────────────────────

    function test_receive_ether() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok,) = address(wallet).call{value: 0.5 ether}("");
        assertTrue(ok);
        assertEq(address(wallet).balance, 0.5 ether);
    }

    // ── Test 11: cannot reinitialize ──────────────────────────────────────────

    function test_cannot_reinitialize() public {
        vm.expectRevert();
        wallet.initialize(stranger, stranger);
    }

    // ── Test 12: factory reverts duplicate beacon for same orgId ──────────────

    function test_factory_reverts_duplicate_beacon() public {
        vm.prank(org);
        vm.expectRevert(OrgBeaconFactory.BeaconAlreadyExists.selector);
        factory.createOrgBeacon(org, ORG_ID);
    }
}

// ── Minimal V2 mock for beacon upgrade test ───────────────────────────────────

contract OrgWalletV2Mock is OrgWalletImpl {
    function version() external pure returns (uint256) {
        return 2;
    }
}
