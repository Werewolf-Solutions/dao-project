// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {BaseTest} from "../BaseTest.t.sol";
import {Treasury} from "../../src/Treasury.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract TreasuryTest is BaseTest {
    function setUp() public override {
        super.setUp();
    }

    // ── isAboveThreshold ─────────────────────────────────────────────────────

    function test_isAboveThreshold_returnsFalse_whenTokenNotSet() public {
        // Deploy a fresh treasury with no token set
        address impl = address(new Treasury());
        bytes memory initData = abi.encodeWithSelector(Treasury.initialize.selector, address(this));
        Treasury freshTreasury = Treasury(address(new TransparentUpgradeableProxy(impl, multiSig, initData)));

        assertFalse(freshTreasury.isAboveThreshold(), "Should return false when werewolfToken not set");
    }

    function test_isAboveThreshold_returnsTrue_whenTokenSetAndBalanceAboveZero() public {
        // The setUp treasury already has werewolfToken set and holds tokens
        // isAboveThreshold compares balance > (balance * thresholdPercentage / 100)
        // Since threshold = (balance * 20%) / 100 = 20% of balance, balance > 20% is always true unless balance=0
        assertTrue(treasury.isAboveThreshold(), "Should return true with tokens in treasury");
    }

    // ── buybackWLF ────────────────────────────────────────────────────────────

    function test_buybackWLF_reverts_whenMinWLFOutIsZero() public {
        // Configure swap router first
        vm.prank(address(timelock));
        treasury.setSwapRouter(makeAddr("router"), address(mockUSDT), 500);

        // Fund treasury with USDT
        mockUSDT.mint(address(treasury), 1000e6);

        vm.prank(address(timelock));
        vm.expectRevert("Treasury: minWLFOut must be > 0");
        treasury.buybackWLF(100e6, 0);
    }

    function test_buybackWLF_reverts_whenNoSwapRouterSet() public {
        vm.prank(address(timelock));
        vm.expectRevert("Swap router not set");
        treasury.buybackWLF(100e6, 1 ether);
    }

    function test_buybackWLF_reverts_whenInsufficientUSDT() public {
        vm.prank(address(timelock));
        treasury.setSwapRouter(makeAddr("router"), address(mockUSDT), 500);

        // Treasury has no USDT
        vm.prank(address(timelock));
        vm.expectRevert("Insufficient USDT");
        treasury.buybackWLF(100e6, 1 ether);
    }

    // ── setWerewolfToken ─────────────────────────────────────────────────────

    function test_setWerewolfToken_reverts_ifAlreadySet() public {
        // Treasury in setUp already has token set
        vm.prank(address(timelock));
        vm.expectRevert("Teasury token address already set");
        treasury.setWerewolfToken(address(werewolfToken));
    }

    // ── withdrawToken ─────────────────────────────────────────────────────────

    function test_withdrawToken_transfersToken() public {
        address recipient = makeAddr("recipient");
        uint256 amount = 50e6;
        mockUSDT.mint(address(treasury), amount);

        vm.prank(address(timelock));
        treasury.withdrawToken(address(mockUSDT), amount, recipient);

        assertEq(mockUSDT.balanceOf(recipient), amount);
    }
}
