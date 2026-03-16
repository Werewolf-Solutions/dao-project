// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BaseTest} from "../BaseTest.t.sol";
import {CompaniesHouseV1} from "../../src/CompaniesHouseV1.sol";
import {CompanyDeFiV1} from "../../src/CompanyDeFiV1.sol";
import {MockAavePool} from "../mocks/MockAavePool.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract CompanyDeFiTest is BaseTest {

    // ── Contracts ──────────────────────────────────────────────────────────────

    CompaniesHouseV1 companiesHouse;
    CompanyDeFiV1 companyDefi;
    MockAavePool mockAave;

    // ── Test actors ────────────────────────────────────────────────────────────

    address employee1   = makeAddr("employee1");
    address unauthorized = makeAddr("unauthorized");

    // ── Constants ──────────────────────────────────────────────────────────────

    uint256 constant CREATION_FEE  = 10e18;
    uint256 constant MONTHLY_USDT  = 100e6;          // $100/month
    uint256 constant HOURLY_USDT   = MONTHLY_USDT / 730;
    uint256 constant FOUNDER_WLF   = 200_000e18;
    uint256 constant DEPOSIT_USDT  = 10_000e6;       // initial company treasury
    uint256 constant SUPPLY_AMOUNT = 500e6;          // amount supplied to Aave in tests

    uint96 companyId;

    // ── setUp ──────────────────────────────────────────────────────────────────

    function setUp() public override {
        super.setUp();

        // Deploy mock Aave pool
        mockAave = new MockAavePool();

        // Deploy CompaniesHouseV1 proxy
        CompaniesHouseV1 chImpl = new CompaniesHouseV1();
        bytes memory chInit = abi.encodeWithSelector(
            CompaniesHouseV1.initialize.selector,
            address(werewolfToken),
            address(treasury),
            address(dao),
            address(tokenSale),
            founder,            // admin
            address(mockUSDT),
            address(0),         // no swap router
            1                   // 1-month reserve for tests
        );
        companiesHouse = CompaniesHouseV1(
            address(new TransparentUpgradeableProxy(address(chImpl), multiSig, chInit))
        );

        // Deploy CompanyDeFiV1 proxy
        CompanyDeFiV1 defiImpl = new CompanyDeFiV1();
        bytes memory defiInit = abi.encodeWithSelector(
            CompanyDeFiV1.initialize.selector,
            address(mockAave),        // aavePool
            address(companiesHouse),  // companiesHouse
            founder                   // admin
        );
        companyDefi = CompanyDeFiV1(
            address(new TransparentUpgradeableProxy(address(defiImpl), multiSig, defiInit))
        );

        // Wire CompanyDeFiV1 into CompaniesHouseV1
        vm.prank(founder);
        companiesHouse.setCompanyDefi(address(companyDefi));

        // Whitelist USDT for DeFi operations
        vm.prank(founder);
        companyDefi.setAllowedToken(address(mockUSDT), true);

        // Fund founder with WLF for creation fee and USDT for company treasury
        vm.prank(address(timelock));
        werewolfToken.airdrop(founder, FOUNDER_WLF);
        mockUSDT.mint(founder, DEPOSIT_USDT + 100_000e6); // extra for reserve

        // Create a company and deposit USDT into its treasury
        companyId = _createCompany();

        vm.startPrank(founder);
        mockUSDT.approve(address(companiesHouse), DEPOSIT_USDT);
        companiesHouse.depositToCompany(companyId, address(mockUSDT), DEPOSIT_USDT);
        vm.stopPrank();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    function _createCompany() internal returns (uint96 id) {
        string[] memory roles = new string[](2);
        roles[0] = "CEO";
        roles[1] = "Engineer";

        string[] memory powerRoles = new string[](1);
        powerRoles[0] = "CEO";

        vm.startPrank(founder);
        werewolfToken.approve(address(companiesHouse), CREATION_FEE);
        companiesHouse.createCompany(CompaniesHouseV1.CreateCompany({
            name:               "Test Corp",
            industry:           "Software",
            domain:             "test.io",
            roles:              roles,
            powerRoles:         powerRoles,
            operatorAddress:    founder,
            ownerRole:          "CEO",
            ownerSalaryPerHour: HOURLY_USDT,
            ownerName:          "Alice"
        }));
        vm.stopPrank();
        return 1;
    }

    // ── Tests ──────────────────────────────────────────────────────────────────

    // ── 1. Supply happy path ──────────────────────────────────────────────────

    function test_supply_usdt_to_aave() public {
        uint256 companyBalBefore = companiesHouse.companyTokenBalances(companyId, address(mockUSDT));

        vm.prank(founder);
        companyDefi.supplyToAave(companyId, address(mockUSDT), SUPPLY_AMOUNT);

        // Company balance in CompaniesHouse decreases
        uint256 companyBalAfter = companiesHouse.companyTokenBalances(companyId, address(mockUSDT));
        assertEq(companyBalAfter, companyBalBefore - SUPPLY_AMOUNT, "CH balance should decrease");

        // Per-company accounting records the supply
        assertEq(companyDefi.companyAaveSupplied(companyId, address(mockUSDT)), SUPPLY_AMOUNT, "supplied tracking");

        // Mock Aave pool holds the tokens
        assertEq(mockUSDT.balanceOf(address(mockAave)), SUPPLY_AMOUNT, "Aave pool holds tokens");
    }

    // ── 2. Withdraw happy path ────────────────────────────────────────────────

    function test_withdraw_usdt_from_aave() public {
        // First supply
        vm.prank(founder);
        companyDefi.supplyToAave(companyId, address(mockUSDT), SUPPLY_AMOUNT);

        uint256 companyBalBefore = companiesHouse.companyTokenBalances(companyId, address(mockUSDT));

        // Now withdraw
        vm.prank(founder);
        companyDefi.withdrawFromAave(companyId, address(mockUSDT), SUPPLY_AMOUNT);

        // Company balance restored
        uint256 companyBalAfter = companiesHouse.companyTokenBalances(companyId, address(mockUSDT));
        assertEq(companyBalAfter, companyBalBefore + SUPPLY_AMOUNT, "CH balance should increase");

        // Accounting cleared
        assertEq(companyDefi.companyAaveSupplied(companyId, address(mockUSDT)), 0, "supplied tracking cleared");
    }

    // ── 3. Withdraw max ───────────────────────────────────────────────────────

    function test_withdraw_max_from_aave() public {
        vm.prank(founder);
        companyDefi.supplyToAave(companyId, address(mockUSDT), SUPPLY_AMOUNT);

        vm.prank(founder);
        companyDefi.withdrawFromAave(companyId, address(mockUSDT), type(uint256).max);

        assertEq(companyDefi.companyAaveSupplied(companyId, address(mockUSDT)), 0, "max withdraw clears balance");
    }

    // ── 4. Unauthorized caller reverts ────────────────────────────────────────

    function test_supply_reverts_unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert(CompanyDeFiV1.NotAuthorized.selector);
        companyDefi.supplyToAave(companyId, address(mockUSDT), SUPPLY_AMOUNT);
    }

    function test_withdraw_reverts_unauthorized() public {
        vm.prank(founder);
        companyDefi.supplyToAave(companyId, address(mockUSDT), SUPPLY_AMOUNT);

        vm.prank(unauthorized);
        vm.expectRevert(CompanyDeFiV1.NotAuthorized.selector);
        companyDefi.withdrawFromAave(companyId, address(mockUSDT), SUPPLY_AMOUNT);
    }

    // ── 5. Insufficient company balance reverts ───────────────────────────────

    function test_supply_reverts_insufficient_balance() public {
        uint256 companyBal = companiesHouse.companyTokenBalances(companyId, address(mockUSDT));

        vm.prank(founder);
        vm.expectRevert(CompaniesHouseV1.InsufficientWLF.selector);
        companyDefi.supplyToAave(companyId, address(mockUSDT), companyBal + 1);
    }

    // ── 6. Token not in whitelist reverts ─────────────────────────────────────

    function test_supply_reverts_unallowed_token() public {
        address randomToken = makeAddr("randomToken");

        vm.prank(founder);
        vm.expectRevert(CompanyDeFiV1.TokenNotAllowed.selector);
        companyDefi.supplyToAave(companyId, randomToken, SUPPLY_AMOUNT);
    }

    // ── 7. Borrow disabled by default ─────────────────────────────────────────

    function test_borrow_disabled_by_default() public {
        vm.prank(founder);
        vm.expectRevert(CompanyDeFiV1.BorrowingDisabled.selector);
        companyDefi.borrowFromAave(companyId, address(mockUSDT), 100e6);
    }

    // ── 8. Admin can enable borrowing ─────────────────────────────────────────

    function test_admin_enables_borrow() public {
        // Seed mock Aave with USDT so borrow can transfer tokens
        mockUSDT.mint(address(this), 100e6);
        mockUSDT.approve(address(mockAave), 100e6);
        mockAave.seedBalance(address(mockUSDT), 100e6);

        vm.prank(founder);
        companyDefi.setBorrowingEnabled(true);
        assertTrue(companyDefi.borrowingEnabled(), "borrowingEnabled should be true");

        // Now borrow should succeed
        vm.prank(founder);
        companyDefi.borrowFromAave(companyId, address(mockUSDT), 100e6);

        // Borrowed amount credited to company treasury
        uint256 chBal = companiesHouse.companyTokenBalances(companyId, address(mockUSDT));
        assertEq(chBal, DEPOSIT_USDT + 100e6, "borrowed tokens credited to company");
    }

    // ── 9. getAaveUserData returns non-zero when pool configured ──────────────

    function test_getAaveUserData() public view {
        (,,,,,uint256 hf) = companyDefi.getAaveUserData();
        assertEq(hf, type(uint256).max, "mock returns max health factor");
    }

    // ── 10. Zero amount reverts ───────────────────────────────────────────────

    function test_supply_zero_reverts() public {
        vm.prank(founder);
        vm.expectRevert(CompanyDeFiV1.ZeroAmount.selector);
        companyDefi.supplyToAave(companyId, address(mockUSDT), 0);
    }

    // ── 11. isAuthorized view exposed correctly ───────────────────────────────

    function test_isAuthorized_view() public view {
        assertTrue(companiesHouse.isAuthorized(founder, companyId), "founder is authorized");
        assertFalse(companiesHouse.isAuthorized(unauthorized, companyId), "random address not authorized");
    }
}
