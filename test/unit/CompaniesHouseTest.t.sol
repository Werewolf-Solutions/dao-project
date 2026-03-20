// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BaseTest} from "../BaseTest.t.sol";
import {CompaniesHouseV1} from "../../src/CompaniesHouseV1.sol";
import {PayrollExecutor} from "../../src/PayrollExecutor.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract CompaniesHouseTest is BaseTest {

    // ── Contracts ──────────────────────────────────────────────────────────────

    CompaniesHouseV1 companiesHouse;
    PayrollExecutor payrollExecutor;

    // ── Test actors ────────────────────────────────────────────────────────────

    address employee1 = makeAddr("employee1");

    // ── Constants ──────────────────────────────────────────────────────────────

    uint256 constant CREATION_FEE   = 10e18;     // 10 WLF

    // Salary: $10/month (USDT 6 dec)
    uint256 constant MONTHLY_SALARY = 10e6;          // 10 USDT per month
    uint256 constant HOURLY_SALARY  = MONTHLY_SALARY / 730; // ≈ 13 698 USDT-wei/hr

    // Deposit budgets (given to founder in setUp)
    uint256 constant FOUNDER_WLF    = 200_000e18;   // 200 k WLF (covers creation fee + WLF deposits)
    uint256 constant FOUNDER_USDT   = 10_000e6;     // 10 k USDT

    // ── setUp ──────────────────────────────────────────────────────────────────

    function setUp() public override {
        super.setUp();

        // Deploy CompaniesHouseV1 proxy (no swap router — USDT-only payment for now)
        CompaniesHouseV1 impl = new CompaniesHouseV1();
        bytes memory initData = abi.encodeWithSelector(
            CompaniesHouseV1.initialize.selector,
            address(werewolfToken),
            address(treasury),
            address(dao),
            address(tokenSale),
            founder,           // admin = founder (simplifies test calls)
            address(mockUSDT),
            address(0),        // no swap router yet
            3                  // 3-month reserve (testnet friendly)
        );
        address proxy = address(new TransparentUpgradeableProxy(address(impl), multiSig, initData));
        companiesHouse = CompaniesHouseV1(proxy);

        // Deploy PayrollExecutor and wire into CompaniesHouseV1
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

        // Fund founder
        vm.prank(address(timelock));
        werewolfToken.airdrop(founder, FOUNDER_WLF);

        mockUSDT.mint(founder, FOUNDER_USDT);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /// @dev Creates a standard company as `founder`. Returns companyId (always 1).
    function _createCompany() internal returns (uint96 companyId) {
        CompaniesHouseV1.RoleDefinition[] memory roles = new CompaniesHouseV1.RoleDefinition[](2);
        roles[0] = CompaniesHouseV1.RoleDefinition({ name: "CEO",      level: 2 });
        roles[1] = CompaniesHouseV1.RoleDefinition({ name: "Engineer", level: 3 });

        vm.startPrank(founder);
        werewolfToken.approve(address(companiesHouse), CREATION_FEE);
        companiesHouse.createCompany(CompaniesHouseV1.CreateCompany({
            name:               "Werewolf Solutions",
            industry:           "Software",
            domain:             "werewolf.io",
            roles:              roles,
            operatorAddress:    founder,
            ownerRole:          "CEO",
            ownerRoleLevel:     2,
            ownerSalaryPerHour: HOURLY_SALARY,
            ownerName:          "Alice Founder"
        }));
        vm.stopPrank();
        return 1; // currentCompanyIndex starts at 1
    }

    /// @dev Hires `employee1` as Engineer into `companyId`.
    function _hireEmployee(uint96 companyId) internal {
        CompaniesHouseV1.SalaryItem[] memory items = new CompaniesHouseV1.SalaryItem[](1);
        items[0] = CompaniesHouseV1.SalaryItem({
            role:          "Engineer",
            earningsType:  CompaniesHouseV1.EarningsType.SALARY,
            salaryPerHour: HOURLY_SALARY,
            lastPayDate:   0
        });
        vm.prank(founder);
        companiesHouse.hireEmployee(CompaniesHouseV1.HireEmployee({
            employeeAddress: employee1,
            name:            "Bob Engineer",
            companyId:       companyId,
            salaryItems:     items
        }));
    }

    /// @dev Deposits `amount` WLF from `founder` into `companyId`.
    function _depositWLF(uint96 companyId, uint256 amount) internal {
        vm.startPrank(founder);
        werewolfToken.approve(address(companiesHouse), amount);
        companiesHouse.depositToCompany(companyId, address(werewolfToken), amount);
        vm.stopPrank();
    }

    /// @dev Deposits `amount` USDT from `founder` into `companyId`.
    function _depositUSDT(uint96 companyId, uint256 amount) internal {
        vm.startPrank(founder);
        mockUSDT.approve(address(companiesHouse), amount);
        companiesHouse.depositToCompany(companyId, address(mockUSDT), amount);
        vm.stopPrank();
    }

    /// @dev Returns totalUSDT + reserve — the minimum deposit needed for one payment to go through.
    function _requiredUSDT(uint96 companyId, uint256 totalUSDT) internal view returns (uint256) {
        return totalUSDT + companiesHouse.getRequiredReserveUSDT(companyId);
    }

    // ── Tests: company lifecycle ───────────────────────────────────────────────

    function test_CreateCompany() public {
        uint96 id = _createCompany();
        CompaniesHouseV1.CompanyStruct memory co = companiesHouse.retrieveCompany(id);

        assertEq(co.name,     "Werewolf Solutions");
        assertEq(co.owner,    founder);
        assertEq(co.industry, "Software");
        assertEq(co.domain,   "werewolf.io");
        assertTrue(co.active);
        assertEq(co.employees.length, 1, "Founder auto-hired");
        assertEq(companiesHouse.currentCompanyIndex(), 2);
    }

    function test_CreateCompany_ChargecreationFee() public {
        uint256 treasuryBefore = werewolfToken.balanceOf(address(treasury));
        _createCompany();
        assertEq(
            werewolfToken.balanceOf(address(treasury)),
            treasuryBefore + CREATION_FEE,
            "Creation fee not sent to treasury"
        );
    }

    function test_CreateCompany_InsufficientBalance_Reverts() public {
        vm.prank(address(timelock));
        werewolfToken.airdrop(employee1, CREATION_FEE - 1);

        CompaniesHouseV1.RoleDefinition[] memory roles = new CompaniesHouseV1.RoleDefinition[](1);
        roles[0] = CompaniesHouseV1.RoleDefinition({ name: "CEO", level: 2 });

        vm.startPrank(employee1);
        werewolfToken.approve(address(companiesHouse), CREATION_FEE - 1);
        vm.expectRevert(CompaniesHouseV1.InsufficientFee.selector);
        companiesHouse.createCompany(CompaniesHouseV1.CreateCompany({
            name: "Broke Inc", industry: "None", domain: "x.io",
            roles: roles,
            operatorAddress: employee1,
            ownerRole: "CEO", ownerRoleLevel: 2, ownerSalaryPerHour: 0, ownerName: "Nobody"
        }));
        vm.stopPrank();
    }

    function test_HireEmployee() public {
        uint96 id = _createCompany();
        _hireEmployee(id);
        CompaniesHouseV1.CompanyStruct memory co = companiesHouse.retrieveCompany(id);
        assertEq(co.employees.length, 2, "Should have 2 employees");
        assertEq(co.employees[1].name, "Bob Engineer");
        assertTrue(co.employees[1].active);
    }

    function test_FireEmployee() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        vm.prank(founder);
        companiesHouse.fireEmployee(employee1, id);

        CompaniesHouseV1.CompanyStruct memory co = companiesHouse.retrieveCompany(id);
        assertFalse(co.employees[1].active, "Employee should be inactive");
    }

    function test_GetOwnerCompanyIds() public {
        _createCompany();
        uint96[] memory ids = companiesHouse.getOwnerCompanyIds(founder);
        assertEq(ids.length, 1);
        assertEq(ids[0], 1);
    }

    // ── Tests: deposits ────────────────────────────────────────────────────────

    function test_DepositUSDT() public {
        uint96 id = _createCompany();
        uint256 amount = 500e6;
        _depositUSDT(id, amount);
        assertEq(companiesHouse.companyTokenBalances(id, address(mockUSDT)), amount);
    }

    function test_DepositWLF() public {
        uint96 id = _createCompany();
        uint256 amount = 1_000e18;
        _depositWLF(id, amount);
        assertEq(companiesHouse.companyTokenBalances(id, address(werewolfToken)), amount);
    }

    // ── Tests: payEmployee ────────────────────────────────────────────────────

    function test_PayEmployee_USDT_Success() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        uint256 deposit = _requiredUSDT(id, MONTHLY_SALARY) + 1_000e6;
        _depositUSDT(id, deposit);

        vm.warp(block.timestamp + 730 hours);

        uint256 usdtBefore = mockUSDT.balanceOf(employee1);
        uint256 companyBefore = companiesHouse.companyTokenBalances(id, address(mockUSDT));

        vm.prank(founder);
        payrollExecutor.payEmployee(employee1, id);

        uint256 usdtAfter = mockUSDT.balanceOf(employee1);
        uint256 companyAfter = companiesHouse.companyTokenBalances(id, address(mockUSDT));

        assertTrue(usdtAfter > usdtBefore,   "Employee should have received USDT");
        assertTrue(companyAfter < companyBefore, "Company USDT balance should decrease");
    }

    function test_PayEmployee_CorrectUSDTAmount() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        uint256 deposit = _requiredUSDT(id, MONTHLY_SALARY) + 1_000e6;
        _depositUSDT(id, deposit);

        vm.warp(block.timestamp + 730 hours);

        uint256 grossUSDT    = (730 hours * HOURLY_SALARY) / 1 hours;
        uint256 expectedUSDT = grossUSDT * 9_500 / 10_000; // 5% protocol fee

        vm.prank(founder);
        payrollExecutor.payEmployee(employee1, id);

        assertEq(mockUSDT.balanceOf(employee1), expectedUSDT, "USDT amount should match salary formula");
    }

    function test_PayEmployee_EmitsEvent() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        uint256 deposit = _requiredUSDT(id, MONTHLY_SALARY) + 1_000e6;
        _depositUSDT(id, deposit);

        vm.warp(block.timestamp + 730 hours);

        uint256 expectedUSDT = (730 hours * HOURLY_SALARY) / 1 hours;

        vm.expectEmit(true, true, false, false, address(companiesHouse));
        emit CompaniesHouseV1.EmployeePaid(employee1, expectedUSDT);

        vm.prank(founder);
        payrollExecutor.payEmployee(employee1, id);
    }

    function test_PayEmployee_UpdatesLastPayDate() public {
        uint96 id = _createCompany();
        _hireEmployee(id);
        _depositUSDT(id, _requiredUSDT(id, MONTHLY_SALARY) + 1_000e6);

        vm.warp(block.timestamp + 730 hours);

        vm.prank(founder);
        payrollExecutor.payEmployee(employee1, id);

        // Second call immediately should revert — nothing owed yet
        vm.prank(founder);
        vm.expectRevert(PayrollExecutor.NothingToPay.selector);
        payrollExecutor.payEmployee(employee1, id);
    }

    function test_PayEmployee_NothingOwed_Reverts() public {
        uint96 id = _createCompany();
        _hireEmployee(id);
        _depositUSDT(id, 1_000e6);

        // No time has passed → 0 USDT owed
        vm.prank(founder);
        vm.expectRevert(PayrollExecutor.NothingToPay.selector);
        payrollExecutor.payEmployee(employee1, id);
    }

    function test_PayEmployee_BelowReserve_Reverts() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        // Deposit exactly reserve - 1 (adding totalUSDT makes it go below threshold)
        uint256 reserve = companiesHouse.getRequiredReserveUSDT(id);
        vm.assume(reserve > 0);
        _depositUSDT(id, reserve - 1);

        vm.warp(block.timestamp + 730 hours);

        vm.prank(founder);
        vm.expectRevert(PayrollExecutor.ReserveTooLow.selector);
        payrollExecutor.payEmployee(employee1, id);
    }

    function test_PayEmployee_ExactlyAtReserve_Passes() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        vm.warp(block.timestamp + 730 hours);

        uint256 totalUSDT = (730 hours * HOURLY_SALARY) / 1 hours;
        uint256 reserve   = companiesHouse.getRequiredReserveUSDT(id);

        // Deposit exactly totalUSDT + reserve → boundary should succeed
        _depositUSDT(id, totalUSDT + reserve);

        vm.prank(founder);
        payrollExecutor.payEmployee(employee1, id); // should not revert
        assertEq(mockUSDT.balanceOf(employee1), totalUSDT * 9_500 / 10_000, "Employee receives net USDT owed (after 5% fee)");
    }

    function test_PayEmployee_Unauthorized_Reverts() public {
        uint96 id = _createCompany();
        _hireEmployee(id);
        _depositUSDT(id, 5_000e6);

        vm.warp(block.timestamp + 730 hours);

        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(PayrollExecutor.NotAuthorized.selector);
        payrollExecutor.payEmployee(employee1, id);
    }

    // ── Tests: payEmployees (batch) ────────────────────────────────────────────

    function test_PayEmployees_USDT() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        // Two employees, each earning MONTHLY_SALARY
        uint256 twoMonths = _requiredUSDT(id, 2 * MONTHLY_SALARY) + 1_000e6;
        _depositUSDT(id, twoMonths);

        vm.warp(block.timestamp + 730 hours);

        uint256 founderBefore  = mockUSDT.balanceOf(founder);
        uint256 employeeBefore = mockUSDT.balanceOf(employee1);

        vm.prank(founder);
        payrollExecutor.payEmployees(id);

        assertGt(mockUSDT.balanceOf(founder),   founderBefore,   "Founder should be paid in USDT");
        assertGt(mockUSDT.balanceOf(employee1), employeeBefore, "Employee should be paid in USDT");
    }

    function test_PayEmployees_AnyoneCanCall() public {
        uint96 id = _createCompany();
        _depositUSDT(id, 5_000e6);
        vm.warp(block.timestamp + 730 hours);

        address stranger = makeAddr("stranger");
        uint256 founderBefore = mockUSDT.balanceOf(founder);

        vm.prank(stranger); // anyone can trigger payroll
        payrollExecutor.payEmployees(id);

        assertGt(mockUSDT.balanceOf(founder), founderBefore, "Founder should be paid");
    }

    function test_PayEmployees_SkipsInactiveEmployees() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        // Fire employee1 before payout
        vm.prank(founder);
        companiesHouse.fireEmployee(employee1, id);

        _depositUSDT(id, 5_000e6);
        vm.warp(block.timestamp + 730 hours);

        vm.prank(founder);
        payrollExecutor.payEmployees(id); // should not revert even though employee1 is inactive

        assertEq(mockUSDT.balanceOf(employee1), 0, "Fired employee should receive nothing");
    }

    // ── Tests: reserve & burn view functions ──────────────────────────────────

    function test_GetMonthlyBurnUSDT() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        // Two employees, each at HOURLY_SALARY, 730 hours/month
        uint256 expectedMonthly = 2 * HOURLY_SALARY * 730;
        assertEq(companiesHouse.getMonthlyBurnUSDT(id), expectedMonthly);
    }

    function test_GetRequiredReserveUSDT() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        uint256 monthly  = companiesHouse.getMonthlyBurnUSDT(id);
        uint256 expected = monthly * 3; // setUp uses 3-month reserve
        assertEq(companiesHouse.getRequiredReserveUSDT(id), expected);
    }

    function test_SetMinReserveMonths() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        vm.prank(founder); // founder is admin in tests
        companiesHouse.setMinReserveMonths(12);

        uint256 monthly  = companiesHouse.getMonthlyBurnUSDT(id);
        assertEq(companiesHouse.getRequiredReserveUSDT(id), monthly * 12);
    }

    function test_SetDaoCompanyId_OnlyAdmin() public {
        uint96 id = _createCompany();

        // Non-admin should revert
        address stranger = makeAddr("stranger");
        vm.expectRevert();
        vm.prank(stranger);
        companiesHouse.setDaoCompanyId(id);

        // Admin (founder) should succeed
        vm.prank(founder);
        companiesHouse.setDaoCompanyId(id);
        assertEq(companiesHouse.daoCompanyId(), id);
    }

    function test_SetDaoCompanyId_NonExistentCompany_Reverts() public {
        uint96 badId = 99;
        vm.expectRevert();
        vm.prank(founder);
        companiesHouse.setDaoCompanyId(badId);
    }

    // ── Tests: submitEarning (earnings codes & triggers) ──────────────────────

    /// @dev Submits a bonus and verifies it appears in getTotalPendingUSDT.
    function test_SubmitEarning_Bonus_AppearsInPending() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        uint256 bonusUSDT = 50e6; // $50 USDT

        vm.prank(founder);
        companiesHouse.submitEarning(
            employee1, id, CompaniesHouseV1.EarningsType.BONUS, bonusUSDT, "Q1 bonus"
        );

        // Bonus should be immediately visible in total pending
        uint256 pending = companiesHouse.getTotalPendingUSDT(id);
        assertGe(pending, bonusUSDT, "Bonus not included in pending USDT");
    }

    /// @dev Submits overtime and verifies the EarningSubmitted event fires.
    function test_SubmitEarning_EmitsEvent() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        uint256 amount = 25e6;

        vm.expectEmit(true, true, false, true, address(companiesHouse));
        emit CompaniesHouseV1.EarningSubmitted(
            employee1, id, CompaniesHouseV1.EarningsType.OVERTIME, amount, "10hrs OT week 12"
        );

        vm.prank(founder);
        companiesHouse.submitEarning(
            employee1, id, CompaniesHouseV1.EarningsType.OVERTIME, amount, "10hrs OT week 12"
        );
    }

    /// @dev Non-authorized caller cannot submit an earning.
    function test_SubmitEarning_Unauthorized_Reverts() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        address stranger = makeAddr("stranger");
        vm.expectRevert(CompaniesHouseV1.NotAuthorized.selector);
        vm.prank(stranger);
        companiesHouse.submitEarning(
            employee1, id, CompaniesHouseV1.EarningsType.BONUS, 10e6, "sneaky bonus"
        );
    }

    /// @dev Submitting a SALARY type via submitEarning is rejected (use addRoleToEmployee).
    function test_SubmitEarning_SalaryType_Reverts() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        vm.expectRevert(CompaniesHouseV1.InvalidSalaryIndex.selector);
        vm.prank(founder);
        companiesHouse.submitEarning(
            employee1, id, CompaniesHouseV1.EarningsType.SALARY, 10e6, "should fail"
        );
    }

    /// @dev Submitting a zero amount is rejected.
    function test_SubmitEarning_ZeroAmount_Reverts() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        vm.expectRevert(CompaniesHouseV1.NothingToPay.selector);
        vm.prank(founder);
        companiesHouse.submitEarning(
            employee1, id, CompaniesHouseV1.EarningsType.BONUS, 0, "empty bonus"
        );
    }

    /// @dev Paying an employee drains pendingEarnings and the payout includes both salary and bonus.
    function test_PayEmployee_DrainsPendingEarnings() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        uint256 bonusUSDT = 100e6; // $100 bonus

        // Submit bonus
        vm.prank(founder);
        companiesHouse.submitEarning(
            employee1, id, CompaniesHouseV1.EarningsType.BONUS, bonusUSDT, "annual bonus"
        );

        // Warp 30 days so salary also accrues
        vm.warp(block.timestamp + 30 days);

        uint256 salaryAccrued = HOURLY_SALARY * 30 days / 1 hours;
        uint256 totalExpected = salaryAccrued + bonusUSDT;
        uint256 needed = _requiredUSDT(id, totalExpected);
        _depositUSDT(id, needed);

        uint256 balanceBefore = mockUSDT.balanceOf(employee1);
        uint256 fee = totalExpected * 500 / 10_000; // 5%
        uint256 netExpected = totalExpected - fee;

        uint256 pendingBefore = companiesHouse.getTotalPendingUSDT(id);

        vm.prank(founder);
        payrollExecutor.payEmployee(employee1, id);

        assertApproxEqAbs(
            mockUSDT.balanceOf(employee1) - balanceBefore,
            netExpected,
            1e3, // 0.001 USDT tolerance for rounding
            "Employee did not receive salary + bonus"
        );

        // pendingEarnings cleared: total pending dropped by at least the bonus amount
        // (founder's salary still accrues, so pending is not exactly 0)
        uint256 pendingAfter = companiesHouse.getTotalPendingUSDT(id);
        assertLe(pendingAfter, pendingBefore - bonusUSDT, "Bonus not drained from pendingEarnings");
    }

    /// @dev Batch payEmployees also drains pending earnings across employees.
    function test_PayEmployees_BatchIncludesPendingEarnings() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        uint256 bonus = 50e6;

        vm.prank(founder);
        companiesHouse.submitEarning(
            employee1, id, CompaniesHouseV1.EarningsType.BONUS, bonus, "batch bonus"
        );

        vm.warp(block.timestamp + 30 days);

        uint256 totalPending = companiesHouse.getTotalPendingUSDT(id);
        _depositUSDT(id, _requiredUSDT(id, totalPending));

        uint256 balanceBefore = mockUSDT.balanceOf(employee1);

        vm.prank(founder);
        payrollExecutor.payEmployees(id);

        // Employee received more than salary alone (bonus included)
        uint256 salaryOnly = HOURLY_SALARY * 30 days / 1 hours;
        uint256 netSalaryOnly = salaryOnly * 9_500 / 10_000;
        assertGt(
            mockUSDT.balanceOf(employee1) - balanceBefore,
            netSalaryOnly,
            "Batch pay did not include pending bonus"
        );
    }

    // ── Tests: Role Hierarchy Auth ────────────────────────────────────────────

    /// @dev Hire a Level 3 employee then use them as a caller for hierarchy tests.
    function _hireManager(uint96 id) internal returns (address manager) {
        manager = makeAddr("manager");
        deal(address(werewolfToken), manager, 0); // no tokens needed — just to set up address

        // Give manager some WLF so founder can pay them (not strictly needed for auth tests)
        CompaniesHouseV1.SalaryItem[] memory items = new CompaniesHouseV1.SalaryItem[](1);
        items[0] = CompaniesHouseV1.SalaryItem({
            role:          "Engineer",
            earningsType:  CompaniesHouseV1.EarningsType.SALARY,
            salaryPerHour: HOURLY_SALARY,
            lastPayDate:   0
        });
        vm.prank(founder);
        companiesHouse.hireEmployee(CompaniesHouseV1.HireEmployee({
            employeeAddress: manager,
            name:            "Manager",
            companyId:       id,
            salaryItems:     items
        }));
    }

    /// @dev Level 3 (Engineer) can pay another Level 3 (Engineer) — LENIENT rule.
    function test_SameLevel_CanPay() public {
        uint96 id = _createCompany();
        _hireEmployee(id); // employee1 = Engineer (level 3)
        address eng2 = makeAddr("eng2");

        CompaniesHouseV1.SalaryItem[] memory items = new CompaniesHouseV1.SalaryItem[](1);
        items[0] = CompaniesHouseV1.SalaryItem({
            role: "Engineer", earningsType: CompaniesHouseV1.EarningsType.SALARY,
            salaryPerHour: HOURLY_SALARY, lastPayDate: 0
        });
        vm.prank(founder);
        companiesHouse.hireEmployee(CompaniesHouseV1.HireEmployee({
            employeeAddress: eng2, name: "Eng2", companyId: id, salaryItems: items
        }));

        _depositUSDT(id, 5_000e6);
        vm.warp(block.timestamp + 730 hours);

        // employee1 (level 3) pays eng2 (level 3) — should succeed
        vm.prank(employee1);
        payrollExecutor.payEmployee(eng2, id);
    }

    /// @dev Level 3 (Engineer) cannot fire another Level 3 (Engineer) — STRICT rule.
    function test_SameLevel_CannotFire() public {
        uint96 id = _createCompany();
        _hireEmployee(id); // employee1 = Engineer (level 3)
        address eng2 = makeAddr("eng2");

        CompaniesHouseV1.SalaryItem[] memory items = new CompaniesHouseV1.SalaryItem[](1);
        items[0] = CompaniesHouseV1.SalaryItem({
            role: "Engineer", earningsType: CompaniesHouseV1.EarningsType.SALARY,
            salaryPerHour: HOURLY_SALARY, lastPayDate: 0
        });
        vm.prank(founder);
        companiesHouse.hireEmployee(CompaniesHouseV1.HireEmployee({
            employeeAddress: eng2, name: "Eng2", companyId: id, salaryItems: items
        }));

        // employee1 (level 3) tries to fire eng2 (level 3) — must fail
        vm.prank(employee1);
        vm.expectRevert(CompaniesHouseV1.NotAuthorized.selector);
        companiesHouse.fireEmployee(eng2, id);
    }

    /// @dev Level 2 (CEO/founder) can fire Level 3 (Engineer).
    function test_HigherAuthority_CanFireLower() public {
        uint96 id = _createCompany();
        _hireEmployee(id); // employee1 = Engineer (level 3)

        vm.prank(founder); // founder = CEO (level 2)
        companiesHouse.fireEmployee(employee1, id);

        CompaniesHouseV1.CompanyStruct memory co = companiesHouse.retrieveCompany(id);
        assertFalse(co.employees[1].active, "Engineer should be fired");
    }

    /// @dev Level 3 cannot fire Level 2 — STRICT rule.
    function test_LowerAuthority_CannotFireHigher() public {
        uint96 id = _createCompany();
        _hireEmployee(id); // employee1 = Engineer (level 3)

        // Engineer (level 3) tries to fire founder (level 2) — must fail
        vm.prank(employee1);
        vm.expectRevert(CompaniesHouseV1.NotAuthorized.selector);
        companiesHouse.fireEmployee(founder, id);
    }

    /// @dev Level 3 can submit an earning for another Level 3 — LENIENT rule.
    function test_SameLevel_CanSubmitEarning() public {
        uint96 id = _createCompany();
        _hireEmployee(id); // employee1 = Engineer (level 3)
        address eng2 = makeAddr("eng2");

        CompaniesHouseV1.SalaryItem[] memory items = new CompaniesHouseV1.SalaryItem[](1);
        items[0] = CompaniesHouseV1.SalaryItem({
            role: "Engineer", earningsType: CompaniesHouseV1.EarningsType.SALARY,
            salaryPerHour: HOURLY_SALARY, lastPayDate: 0
        });
        vm.prank(founder);
        companiesHouse.hireEmployee(CompaniesHouseV1.HireEmployee({
            employeeAddress: eng2, name: "Eng2", companyId: id, salaryItems: items
        }));

        // employee1 (level 3) submits bonus for eng2 (level 3) — should succeed
        vm.prank(employee1);
        companiesHouse.submitEarning(eng2, id, CompaniesHouseV1.EarningsType.BONUS, 50e6, "peer bonus");
    }

    /// @dev Level 3 cannot hire someone with a Level 2 (CEO) role.
    function test_CannotHireAboveOwnLevel() public {
        uint96 id = _createCompany();
        _hireEmployee(id); // employee1 = Engineer (level 3)

        address newCeo = makeAddr("newCeo");
        CompaniesHouseV1.SalaryItem[] memory items = new CompaniesHouseV1.SalaryItem[](1);
        items[0] = CompaniesHouseV1.SalaryItem({
            role: "CEO", earningsType: CompaniesHouseV1.EarningsType.SALARY,
            salaryPerHour: HOURLY_SALARY, lastPayDate: 0
        });

        // employee1 (level 3) tries to hire someone as CEO (level 2) — must fail
        vm.prank(employee1);
        vm.expectRevert(CompaniesHouseV1.NotAuthorized.selector);
        companiesHouse.hireEmployee(CompaniesHouseV1.HireEmployee({
            employeeAddress: newCeo, name: "New CEO", companyId: id, salaryItems: items
        }));
    }

    // ── Tests: previewPayroll ──────────────────────────────────────────────────

    /**
     * @notice previewPayroll amounts must match what payEmployees actually transfers.
     */
    function test_PreviewPayroll_MatchesActualPayment() public {
        uint96 id = _createCompany();
        _hireEmployee(id); // employee1 = Engineer

        // Accrue one month of salary for both founder and employee1
        vm.warp(block.timestamp + 730 hours);

        // Deposit enough for pay + reserve
        uint256 needed = _requiredUSDT(id, 2 * MONTHLY_SALARY) + 1_000e6;
        _depositUSDT(id, needed);

        // Snapshot preview
        (
            CompaniesHouseV1.PayrollPreviewItem[] memory items,
            uint256 totalGross,
            uint256 totalFee,
            uint256 totalNet
        ) = companiesHouse.previewPayroll(id);

        assertEq(items.length, 2, "Should have 2 employees with pending pay");
        assertGt(totalGross, 0, "Total gross must be > 0");
        assertEq(totalGross, totalFee + totalNet, "gross = fee + net");

        // Capture balances before paying
        uint256 founderBefore  = mockUSDT.balanceOf(founder);
        uint256 employee1Before = mockUSDT.balanceOf(employee1);

        payrollExecutor.payEmployees(id);

        // Each employee receives exactly their netUSDT from the preview
        uint256 founderPreviewNet;
        uint256 employee1PreviewNet;
        for (uint256 i = 0; i < items.length; i++) {
            if (items[i].employeeAddress == founder)    founderPreviewNet   = items[i].netUSDT;
            if (items[i].employeeAddress == employee1)  employee1PreviewNet = items[i].netUSDT;
        }

        assertEq(mockUSDT.balanceOf(founder)   - founderBefore,   founderPreviewNet,   "Founder net mismatch");
        assertEq(mockUSDT.balanceOf(employee1) - employee1Before,  employee1PreviewNet, "Employee net mismatch");
    }

    /**
     * @notice previewPayroll returns empty array when no pay is accrued yet.
     */
    function test_PreviewPayroll_EmptyWhenNothingOwed() public {
        uint96 id = _createCompany();

        (CompaniesHouseV1.PayrollPreviewItem[] memory items,,,) = companiesHouse.previewPayroll(id);
        assertEq(items.length, 0, "Nothing owed at t=0");
    }

    // ── Tests: payEmployeesBatch ───────────────────────────────────────────────

    /**
     * @notice payEmployeesBatch with slice [0,1) pays only the founder (index 0).
     */
    function test_PayEmployeesBatch_SlicedCorrectly() public {
        uint96 id = _createCompany(); // founder at index 0
        _hireEmployee(id);             // employee1 at index 1

        vm.warp(block.timestamp + 730 hours);

        // Deposit enough for both + reserve
        uint256 needed = _requiredUSDT(id, 2 * MONTHLY_SALARY) + 1_000e6;
        _depositUSDT(id, needed);

        uint256 founderBefore  = mockUSDT.balanceOf(founder);
        uint256 employee1Before = mockUSDT.balanceOf(employee1);

        // Pay only index 0 (founder)
        payrollExecutor.payEmployeesBatch(id, 0, 1);

        assertGt(mockUSDT.balanceOf(founder),    founderBefore,   "Founder should be paid");
        assertEq(mockUSDT.balanceOf(employee1), employee1Before, "Employee1 should NOT be paid yet");
    }

    /**
     * @notice payEmployeesBatch covers all employees when slice spans full array.
     */
    function test_PayEmployeesBatch_FullArray_PaysAll() public {
        uint96 id = _createCompany();
        _hireEmployee(id);

        vm.warp(block.timestamp + 730 hours);
        uint256 needed = _requiredUSDT(id, 2 * MONTHLY_SALARY) + 1_000e6;
        _depositUSDT(id, needed);

        uint256 founderBefore  = mockUSDT.balanceOf(founder);
        uint256 employee1Before = mockUSDT.balanceOf(employee1);

        CompaniesHouseV1.CompanyStruct memory co = companiesHouse.retrieveCompany(id);
        payrollExecutor.payEmployeesBatch(id, 0, co.employees.length);

        assertGt(mockUSDT.balanceOf(founder),    founderBefore,   "Founder should be paid");
        assertGt(mockUSDT.balanceOf(employee1), employee1Before, "Employee1 should be paid");
    }

    /**
     * @notice payEmployeesBatch reverts when toIndex is out of bounds.
     */
    function test_PayEmployeesBatch_OutOfBounds_Reverts() public {
        uint96 id = _createCompany(); // 1 employee

        vm.warp(block.timestamp + 730 hours);
        _depositUSDT(id, _requiredUSDT(id, MONTHLY_SALARY) + 1_000e6);

        vm.expectRevert(PayrollExecutor.BatchIndexInvalid.selector);
        payrollExecutor.payEmployeesBatch(id, 0, 999);
    }
}
