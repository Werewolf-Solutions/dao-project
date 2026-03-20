// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BaseTest} from "../BaseTest.t.sol";
import {CompaniesHouseV1} from "../../src/CompaniesHouseV1.sol";
import {PayrollExecutor} from "../../src/PayrollExecutor.sol";
import {MockSwapRouter} from "../mocks/MockSwapRouter.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @dev Tests for PayrollExecutor queue lifecycle and immediate-pay functions.
 *      Run with:  forge test --match-path test/unit/PayrollExecutorTest.t.sol -vvvv
 */
contract PayrollExecutorTest is BaseTest {

    CompaniesHouseV1 companiesHouse;
    PayrollExecutor  payrollExecutor;
    MockSwapRouter   mockSwapRouter;

    address employee1 = makeAddr("employee1");
    address employee2 = makeAddr("employee2");

    // $500/month salary (6-decimal USDT)
    uint256 constant MONTHLY_SALARY  = 500e6;
    uint256 constant HOURLY_SALARY   = MONTHLY_SALARY / 730;

    uint256 constant WLF_PRICE       = 4e14;        // 0.0004 USDT/WLF × 1e18
    uint256 constant CREATION_FEE    = 10e18;
    uint256 constant FOUNDER_WLF     = 5_000_000e18;
    uint256 constant FOUNDER_USDT    = 1_000_000e6;
    uint256 constant ROUTER_WLF      = 10_000_000e18;

    uint96 companyId;

    // ── setUp ──────────────────────────────────────────────────────────────────

    function setUp() public override {
        super.setUp();

        mockSwapRouter = new MockSwapRouter(WLF_PRICE);

        CompaniesHouseV1 impl = new CompaniesHouseV1();
        bytes memory initData = abi.encodeWithSelector(
            CompaniesHouseV1.initialize.selector,
            address(werewolfToken),
            address(treasury),
            address(dao),
            address(tokenSale),
            founder,
            address(mockUSDT),
            address(mockSwapRouter),
            1   // 1-month reserve
        );
        address proxy = address(new TransparentUpgradeableProxy(address(impl), multiSig, initData));
        companiesHouse = CompaniesHouseV1(proxy);

        PayrollExecutor peImpl = new PayrollExecutor();
        bytes memory peInitData = abi.encodeWithSelector(
            PayrollExecutor.initialize.selector,
            address(companiesHouse),
            founder
        );
        address peProxy = address(new TransparentUpgradeableProxy(address(peImpl), multiSig, peInitData));
        payrollExecutor = PayrollExecutor(peProxy);
        vm.prank(founder);
        companiesHouse.setPayrollExecutor(address(payrollExecutor));

        vm.startPrank(address(timelock));
        werewolfToken.airdrop(founder,                 FOUNDER_WLF);
        werewolfToken.airdrop(address(mockSwapRouter), ROUTER_WLF);
        vm.stopPrank();

        mockUSDT.mint(founder, FOUNDER_USDT);

        // Create company with two employees
        CompaniesHouseV1.RoleDefinition[] memory roles = new CompaniesHouseV1.RoleDefinition[](2);
        roles[0] = CompaniesHouseV1.RoleDefinition({ name: "CEO",      level: 2 });
        roles[1] = CompaniesHouseV1.RoleDefinition({ name: "Engineer", level: 3 });

        vm.startPrank(founder);
        werewolfToken.approve(address(companiesHouse), CREATION_FEE);
        companiesHouse.createCompany(CompaniesHouseV1.CreateCompany({
            name:               "PE Test Co",
            industry:           "Software",
            domain:             "petest.io",
            roles:              roles,
            operatorAddress:    founder,
            ownerRole:          "CEO",
            ownerRoleLevel:     2,
            ownerSalaryPerHour: HOURLY_SALARY,
            ownerName:          "Alice CEO"
        }));
        vm.stopPrank();
        companyId = 1;

        CompaniesHouseV1.SalaryItem[] memory items = new CompaniesHouseV1.SalaryItem[](1);
        items[0] = CompaniesHouseV1.SalaryItem({
            role: "Engineer", earningsType: CompaniesHouseV1.EarningsType.SALARY,
            salaryPerHour: HOURLY_SALARY, lastPayDate: 0
        });
        vm.prank(founder);
        companiesHouse.hireEmployee(CompaniesHouseV1.HireEmployee({
            employeeAddress: employee1,
            name:            "Bob Engineer",
            companyId:       companyId,
            salaryItems:     items
        }));

        vm.prank(founder);
        companiesHouse.hireEmployee(CompaniesHouseV1.HireEmployee({
            employeeAddress: employee2,
            name:            "Carol Engineer",
            companyId:       companyId,
            salaryItems:     items
        }));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    function _fundCompanyForPayroll() internal {
        uint256 monthly    = companiesHouse.getMonthlyBurnUSDT(companyId);
        uint256 pending    = companiesHouse.getTotalPendingUSDT(companyId);
        uint256 reserve    = companiesHouse.getRequiredReserveUSDT(companyId);
        uint256 usdtNeeded = pending + reserve + monthly; // extra buffer

        mockUSDT.mint(founder, usdtNeeded);
        vm.startPrank(founder);
        mockUSDT.approve(address(companiesHouse), usdtNeeded);
        companiesHouse.depositToCompany(companyId, address(mockUSDT), usdtNeeded);
        vm.stopPrank();
    }

    function _warp30Days() internal {
        vm.warp(block.timestamp + 30 days);
    }

    // ── Test 1: queuePayroll creates a correct snapshot ───────────────────────

    function test_QueuePayroll_CreatesSnapshot() public {
        _warp30Days();
        _fundCompanyForPayroll();

        uint256 ts = block.timestamp;
        vm.prank(founder);
        payrollExecutor.queuePayroll(companyId);

        PayrollExecutor.CompanyQueue memory q = payrollExecutor.getQueue(companyId);
        assertTrue(q.active, "queue should be active");
        assertEq(q.snapshotTimestamp, ts, "snapshotTimestamp mismatch");
        assertEq(q.executedCount, 0, "executedCount should start at 0");
        // Company has 3 employees with pending pay (founder owner + employee1 + employee2)
        assertEq(q.payments.length, 3, "expected 3 queued payments");
        // All gross amounts must be > 0
        for (uint256 i = 0; i < q.payments.length; i++) {
            assertGt(q.payments[i].grossUSDT, 0, "grossUSDT must be > 0");
        }
    }

    // ── Test 2: second queuePayroll reverts QueueAlreadyActive ────────────────

    function test_QueuePayroll_RevertsIfAlreadyActive() public {
        _warp30Days();
        _fundCompanyForPayroll();

        vm.prank(founder);
        payrollExecutor.queuePayroll(companyId);

        vm.prank(founder);
        vm.expectRevert(PayrollExecutor.QueueAlreadyActive.selector);
        payrollExecutor.queuePayroll(companyId);
    }

    // ── Test 3: executeQueue pays correct snapshotted amounts ─────────────────

    function test_ExecuteQueue_PaysSnapshotAmounts() public {
        _warp30Days();
        _fundCompanyForPayroll();

        // Snapshot the payroll
        vm.prank(founder);
        payrollExecutor.queuePayroll(companyId);

        PayrollExecutor.CompanyQueue memory q = payrollExecutor.getQueue(companyId);
        // Find employee1's queued amount
        uint256 queuedGross;
        for (uint256 i = 0; i < q.payments.length; i++) {
            if (q.payments[i].employee == employee1) {
                queuedGross = q.payments[i].grossUSDT;
            }
        }
        assertGt(queuedGross, 0, "employee1 should have queued gross > 0");

        // Advance time — accrual after snapshot should NOT change what employee1 receives
        vm.warp(block.timestamp + 15 days);

        uint256 balBefore = mockUSDT.balanceOf(employee1);
        payrollExecutor.executeQueue(companyId);
        uint256 balAfter = mockUSDT.balanceOf(employee1);

        // Employee received USDT for the snapshotted gross (minus protocol fee)
        assertGt(balAfter - balBefore, 0, "employee1 should have received USDT");

        // Queue should now be inactive
        assertFalse(payrollExecutor.hasActiveQueue(companyId), "queue should be inactive after execute");
    }

    // ── Test 4: executeQueueBatch tracks executedCount and closes queue ────────

    function test_ExecuteQueueBatch_PartialThenComplete() public {
        _warp30Days();
        _fundCompanyForPayroll();

        vm.prank(founder);
        payrollExecutor.queuePayroll(companyId);
        uint256 total = payrollExecutor.getQueue(companyId).payments.length; // 3

        // Execute first 2 in batch 0..2
        payrollExecutor.executeQueueBatch(companyId, 0, 2);

        PayrollExecutor.CompanyQueue memory q = payrollExecutor.getQueue(companyId);
        assertEq(q.executedCount, 2, "executedCount should be 2 after first batch");
        assertTrue(q.active, "queue still active (1 payment remaining)");

        // Execute last payment
        payrollExecutor.executeQueueBatch(companyId, 2, total);

        assertFalse(payrollExecutor.hasActiveQueue(companyId), "queue should be closed after final batch");
    }

    // ── Test 5: cancelQueue clears the active flag ────────────────────────────

    function test_CancelQueue_ClearsActive() public {
        _warp30Days();
        _fundCompanyForPayroll();

        vm.prank(founder);
        payrollExecutor.queuePayroll(companyId);
        assertTrue(payrollExecutor.hasActiveQueue(companyId));

        vm.prank(founder);
        payrollExecutor.cancelQueue(companyId);
        assertFalse(payrollExecutor.hasActiveQueue(companyId), "queue should be inactive after cancel");

        // A fresh queue can be created immediately after cancel
        vm.prank(founder);
        payrollExecutor.queuePayroll(companyId);
        assertTrue(payrollExecutor.hasActiveQueue(companyId), "re-queue should succeed after cancel");
    }

    // ── Test 6: earnings submitted after snapshot are preserved ───────────────

    function test_PostSnapshotEarningsPreserved() public {
        _warp30Days();
        _fundCompanyForPayroll();

        // Snapshot
        vm.prank(founder);
        payrollExecutor.queuePayroll(companyId);
        uint256 snapshotTs = payrollExecutor.getQueue(companyId).snapshotTimestamp;

        // Submit a bonus AFTER the snapshot
        uint256 bonusAmount = 100e6; // $100 USDT
        vm.warp(block.timestamp + 1);
        mockUSDT.mint(founder, bonusAmount);
        vm.startPrank(founder);
        mockUSDT.approve(address(companiesHouse), bonusAmount);
        companiesHouse.depositToCompany(companyId, address(mockUSDT), bonusAmount);
        companiesHouse.submitEarning(
            employee1, companyId, CompaniesHouseV1.EarningsType.BONUS, bonusAmount, "post-snapshot bonus"
        );
        vm.stopPrank();

        // Execute the queue — should only pay up to snapshotTs
        payrollExecutor.executeQueue(companyId);
        assertFalse(payrollExecutor.hasActiveQueue(companyId));

        // The bonus (submittedAt > snapshotTs) must still show as pending
        uint256 pendingAfter = companiesHouse.getTotalPendingUSDT(companyId);
        assertGe(pendingAfter, bonusAmount, "post-snapshot bonus should remain pending after execute");
    }

    // ── Test 7: immediate payEmployee works without queue ─────────────────────

    function test_PayEmployee_Immediate_Works() public {
        _warp30Days();
        _fundCompanyForPayroll();

        uint256 balBefore = mockUSDT.balanceOf(employee1);
        vm.prank(founder);
        payrollExecutor.payEmployee(employee1, companyId);
        uint256 balAfter = mockUSDT.balanceOf(employee1);

        assertGt(balAfter - balBefore, 0, "immediate payEmployee should transfer USDT");

        // Immediate pay again right after should revert NothingToPay
        vm.prank(founder);
        vm.expectRevert(PayrollExecutor.NothingToPay.selector);
        payrollExecutor.payEmployee(employee1, companyId);
    }

    // ── Test 8: queuePayroll reverts if reserve is too low ────────────────────

    function test_QueuePayroll_RevertsIfReserveTooLow() public {
        _warp30Days();
        // Fund only the pending amount — not enough to cover the required reserve

        uint256 pending = companiesHouse.getTotalPendingUSDT(companyId);
        // Deposit just the pending — no reserve buffer
        mockUSDT.mint(founder, pending);
        vm.startPrank(founder);
        mockUSDT.approve(address(companiesHouse), pending);
        companiesHouse.depositToCompany(companyId, address(mockUSDT), pending);
        vm.stopPrank();

        vm.prank(founder);
        vm.expectRevert(PayrollExecutor.ReserveTooLow.selector);
        payrollExecutor.queuePayroll(companyId);
    }
}
