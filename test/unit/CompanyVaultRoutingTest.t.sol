// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BaseTest} from "../BaseTest.t.sol";
import {CompaniesHouseV1} from "../../src/CompaniesHouseV1.sol";
import {CompanyVault} from "../../src/CompanyVault.sol";
import {PayrollExecutor} from "../../src/PayrollExecutor.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CompanyVaultRoutingTest
 * @notice Tests that CompaniesHouseV1 routes deposits and payments through
 *         CompanyVault when a vault exists, falling back to companyTokenBalances otherwise.
 */
contract CompanyVaultRoutingTest is BaseTest {

    // ── Contracts ──────────────────────────────────────────────────────────────

    CompaniesHouseV1 ch;
    CompanyVault     vault;
    PayrollExecutor  payrollExec;

    // ── Test actors ────────────────────────────────────────────────────────────

    address employee1 = makeAddr("employee1");
    address stranger  = makeAddr("stranger");

    // ── Constants ──────────────────────────────────────────────────────────────

    uint256 constant CREATION_FEE   = 10e18;
    uint256 constant DEPOSIT_AMOUNT = 5_000e6;    // 5k USDT
    uint256 constant MONTHLY_SALARY = 100e6;      // 100 USDT/month
    uint256 constant HOURLY_SALARY  = MONTHLY_SALARY / 730;

    uint96 companyId;

    // ── setUp ──────────────────────────────────────────────────────────────────

    function setUp() public override {
        super.setUp();

        // Deploy CompaniesHouseV1 proxy (1-month reserve to keep deposits small)
        CompaniesHouseV1 chImpl = new CompaniesHouseV1();
        bytes memory chInit = abi.encodeWithSelector(
            CompaniesHouseV1.initialize.selector,
            address(werewolfToken),
            address(treasury),
            address(dao),
            address(tokenSale),
            founder,
            address(mockUSDT),
            address(0),
            1   // 1-month reserve
        );
        ch = CompaniesHouseV1(
            address(new TransparentUpgradeableProxy(address(chImpl), multiSig, chInit))
        );

        // Deploy PayrollExecutor and wire it
        PayrollExecutor peImpl = new PayrollExecutor();
        bytes memory peInit = abi.encodeWithSelector(
            PayrollExecutor.initialize.selector,
            address(ch),
            founder
        );
        payrollExec = PayrollExecutor(
            address(new TransparentUpgradeableProxy(address(peImpl), multiSig, peInit))
        );
        vm.prank(founder);
        ch.setPayrollExecutor(address(payrollExec));

        // Deploy vault beacon and register in CH
        CompanyVault vaultImpl = new CompanyVault();
        UpgradeableBeacon beacon = new UpgradeableBeacon(address(vaultImpl), founder);
        vm.prank(founder);
        ch.setBeacon(address(beacon));

        // Fund founder and create company
        vm.prank(address(timelock));
        werewolfToken.airdrop(founder, 200_000e18);
        mockUSDT.mint(founder, 500_000e6);

        companyId = _createCompany();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    function _createCompany() internal returns (uint96) {
        CompaniesHouseV1.RoleDefinition[] memory roles = new CompaniesHouseV1.RoleDefinition[](2);
        roles[0] = CompaniesHouseV1.RoleDefinition({ name: "CEO",      level: 2 });
        roles[1] = CompaniesHouseV1.RoleDefinition({ name: "Engineer", level: 3 });

        vm.startPrank(founder);
        werewolfToken.approve(address(ch), CREATION_FEE);
        ch.createCompany(CompaniesHouseV1.CreateCompany({
            name:               "Vault Corp",
            industry:           "Tech",
            domain:             "vault.io",
            roles:              roles,
            operatorAddress:    founder,
            ownerRole:          "CEO",
            ownerRoleLevel:     2,
            ownerSalaryPerHour: HOURLY_SALARY,
            ownerName:          "Alice"
        }));
        vm.stopPrank();
        return 1;
    }

    function _createVault() internal {
        vm.prank(founder);
        address v = ch.createVault(companyId, address(0), address(mockUSDT));
        vault = CompanyVault(v);
    }

    function _hireEmployee() internal {
        CompaniesHouseV1.SalaryItem[] memory items = new CompaniesHouseV1.SalaryItem[](1);
        items[0] = CompaniesHouseV1.SalaryItem({
            role:          "Engineer",
            earningsType:  CompaniesHouseV1.EarningsType.SALARY,
            salaryPerHour: HOURLY_SALARY,
            lastPayDate:   0
        });
        vm.prank(founder);
        ch.hireEmployee(CompaniesHouseV1.HireEmployee({
            employeeAddress: employee1,
            name:            "Bob",
            companyId:       companyId,
            salaryItems:     items
        }));
    }

    // ── Deposit routing ────────────────────────────────────────────────────────

    function test_depositToCompany_noVault_updatesMapping() public {
        vm.startPrank(founder);
        mockUSDT.approve(address(ch), DEPOSIT_AMOUNT);
        ch.depositToCompany(companyId, address(mockUSDT), DEPOSIT_AMOUNT);
        vm.stopPrank();

        assertEq(ch.companyTokenBalances(companyId, address(mockUSDT)), DEPOSIT_AMOUNT, "mapping updated");
        assertEq(mockUSDT.balanceOf(address(ch)), DEPOSIT_AMOUNT, "tokens in CH");
    }

    function test_depositToCompany_withVault_routesToVault() public {
        _createVault();

        vm.startPrank(founder);
        mockUSDT.approve(address(ch), DEPOSIT_AMOUNT);
        ch.depositToCompany(companyId, address(mockUSDT), DEPOSIT_AMOUNT);
        vm.stopPrank();

        assertEq(mockUSDT.balanceOf(address(vault)), DEPOSIT_AMOUNT, "tokens in vault");
        assertEq(ch.companyTokenBalances(companyId, address(mockUSDT)), 0, "mapping stays zero");
        assertEq(mockUSDT.balanceOf(address(ch)), 0, "no tokens in CH");
    }

    // ── Balance / reserve checks ───────────────────────────────────────────────

    function test_checkCanPay_readsVaultBalance() public {
        _createVault();

        // Deposit into vault directly (simulates company funding the vault)
        vm.startPrank(founder);
        mockUSDT.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(address(mockUSDT), DEPOSIT_AMOUNT);
        vm.stopPrank();

        // checkCanPay should see vault funds
        assertTrue(ch.checkCanPay(companyId, 1e6), "vault balance satisfies reserve check");
    }

    function test_checkCanPay_noVault_readsMappingBalance() public {
        vm.startPrank(founder);
        mockUSDT.approve(address(ch), DEPOSIT_AMOUNT);
        ch.depositToCompany(companyId, address(mockUSDT), DEPOSIT_AMOUNT);
        vm.stopPrank();

        assertTrue(ch.checkCanPay(companyId, 1e6), "mapping balance satisfies reserve check");
    }

    // ── Payment debiting ───────────────────────────────────────────────────────

    function test_payEmployee_withVault_debitsVault() public {
        _createVault();
        _hireEmployee();

        // Fund vault with enough USDT
        vm.startPrank(founder);
        mockUSDT.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(address(mockUSDT), DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Warp so salary accrues
        vm.warp(block.timestamp + 730 hours); // 1 month

        uint256 vaultBefore = mockUSDT.balanceOf(address(vault));
        uint256 empBefore   = mockUSDT.balanceOf(employee1);

        vm.prank(founder);
        payrollExec.payEmployee(employee1, companyId);

        uint256 vaultAfter = mockUSDT.balanceOf(address(vault));
        uint256 empAfter   = mockUSDT.balanceOf(employee1);

        assertGt(empAfter, empBefore, "employee received payment");
        assertLt(vaultAfter, vaultBefore, "vault balance decreased");
        assertEq(mockUSDT.balanceOf(address(ch)), 0, "CH balance stays zero after payment");
    }

    function test_payEmployee_noVault_debitsMapping() public {
        _hireEmployee();

        vm.startPrank(founder);
        mockUSDT.approve(address(ch), DEPOSIT_AMOUNT);
        ch.depositToCompany(companyId, address(mockUSDT), DEPOSIT_AMOUNT);
        vm.stopPrank();

        vm.warp(block.timestamp + 730 hours);

        uint256 chBefore = ch.companyTokenBalances(companyId, address(mockUSDT));
        vm.prank(founder);
        payrollExec.payEmployee(employee1, companyId);
        uint256 chAfter = ch.companyTokenBalances(companyId, address(mockUSDT));

        assertLt(chAfter, chBefore, "mapping balance decreased");
    }

    // ── Vault auth ─────────────────────────────────────────────────────────────

    function test_vaultWithdraw_rejectsStranger() public {
        _createVault();

        vm.startPrank(founder);
        mockUSDT.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(address(mockUSDT), DEPOSIT_AMOUNT);
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert();
        vault.withdraw(address(mockUSDT), 1e6, stranger);
    }

    function test_vaultWithdraw_allowsCHProxy() public {
        _createVault();

        vm.startPrank(founder);
        mockUSDT.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(address(mockUSDT), DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Simulate CH calling vault.withdraw (the _debitCompany path)
        vm.prank(address(ch));
        vault.withdraw(address(mockUSDT), 1e6, address(ch));

        assertEq(mockUSDT.balanceOf(address(ch)), 1e6, "CH received funds from vault");
    }

    // ── sweepToVault ───────────────────────────────────────────────────────────

    function test_sweepToVault_movesLegacyBalance() public {
        // Deposit into CH mapping (no vault yet)
        vm.startPrank(founder);
        mockUSDT.approve(address(ch), DEPOSIT_AMOUNT);
        ch.depositToCompany(companyId, address(mockUSDT), DEPOSIT_AMOUNT);
        vm.stopPrank();

        assertEq(ch.companyTokenBalances(companyId, address(mockUSDT)), DEPOSIT_AMOUNT, "pre: in mapping");
        assertEq(mockUSDT.balanceOf(address(ch)), DEPOSIT_AMOUNT, "pre: CH holds tokens");

        // Create vault and sweep
        _createVault();
        address[] memory tokens = new address[](1);
        tokens[0] = address(mockUSDT);
        vm.prank(founder);
        ch.sweepToVault(companyId, tokens);

        assertEq(ch.companyTokenBalances(companyId, address(mockUSDT)), 0, "post: mapping zeroed");
        assertEq(mockUSDT.balanceOf(address(ch)), 0, "post: no tokens in CH");
        assertEq(mockUSDT.balanceOf(address(vault)), DEPOSIT_AMOUNT, "post: tokens in vault");
    }

    function test_sweepToVault_skipsZeroBalance() public {
        _createVault();

        address[] memory tokens = new address[](1);
        tokens[0] = address(mockUSDT);

        // Should not revert even with zero balance
        vm.prank(founder);
        ch.sweepToVault(companyId, tokens);

        assertEq(mockUSDT.balanceOf(address(vault)), 0, "vault still empty");
    }

    function test_sweepToVault_revertsForNonOwner() public {
        _createVault();

        address[] memory tokens = new address[](1);
        tokens[0] = address(mockUSDT);

        vm.prank(stranger);
        vm.expectRevert(CompaniesHouseV1.NotAuthorized.selector);
        ch.sweepToVault(companyId, tokens);
    }

    function test_sweepToVault_revertsWhenNoVault() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(mockUSDT);

        vm.prank(founder);
        vm.expectRevert(CompaniesHouseV1.BeaconNotSet.selector);
        ch.sweepToVault(companyId, tokens);
    }
}
