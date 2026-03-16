// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BaseTest} from "../BaseTest.t.sol";
import {CompaniesHouseV1} from "../../src/CompaniesHouseV1.sol";
import {CompanyVault} from "../../src/CompanyVault.sol";
import {MockAavePool} from "../mocks/MockAavePool.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

contract CompanyVaultTest is BaseTest {

    // ── Contracts ──────────────────────────────────────────────────────────────

    CompaniesHouseV1 companiesHouse;
    CompanyVault     vaultImpl;
    MockAavePool     mockAave;
    CompanyVault     vault;        // cloned vault for companyId = 1

    // ── Test actors ────────────────────────────────────────────────────────────

    address unauthorized = makeAddr("unauthorized");

    // ── Constants ──────────────────────────────────────────────────────────────

    uint256 constant CREATION_FEE  = 10e18;
    uint256 constant DEPOSIT_USDT  = 10_000e6;
    uint256 constant SUPPLY_AMOUNT = 500e6;
    uint256 constant HOURLY_USDT   = uint256(100e6) / 730;

    uint96 companyId;

    // ── setUp ──────────────────────────────────────────────────────────────────

    function setUp() public override {
        super.setUp();

        // 1. Mock Aave pool
        mockAave = new MockAavePool();
        console.log("[setUp] mockAave         :", address(mockAave));

        // 2. CompaniesHouseV1 proxy
        CompaniesHouseV1 chImpl = new CompaniesHouseV1();
        bytes memory chInit = abi.encodeWithSelector(
            CompaniesHouseV1.initialize.selector,
            address(werewolfToken),
            address(treasury),
            address(dao),
            address(tokenSale),
            founder,        // admin
            address(mockUSDT),
            address(0),     // no swap router on local
            1               // 1-month reserve
        );
        companiesHouse = CompaniesHouseV1(
            address(new TransparentUpgradeableProxy(address(chImpl), multiSig, chInit))
        );
        console.log("[setUp] companiesHouse   :", address(companiesHouse));
        console.log("[setUp] ch.admin         :", companiesHouse.admin());

        // 3. Vault logic contract + beacon
        vaultImpl = new CompanyVault();
        UpgradeableBeacon vaultBeacon = new UpgradeableBeacon(address(vaultImpl), founder);
        console.log("[setUp] vaultImpl        :", address(vaultImpl));
        console.log("[setUp] vaultBeacon      :", address(vaultBeacon));

        // 4. Register beacon in CompaniesHouseV1
        vm.prank(founder);
        companiesHouse.setBeacon(address(vaultBeacon));
        console.log("[setUp] beacon set       :", companiesHouse.beacon());

        // 5. Fund founder and create company
        vm.prank(address(timelock));
        werewolfToken.airdrop(founder, 200_000e18);
        mockUSDT.mint(founder, DEPOSIT_USDT + 100_000e6);

        companyId = _createCompany();
        console.log("[setUp] companyId        :", companyId);

        // 6. Create vault (passes mockAave + mockUSDT as the initial allowed token)
        vm.prank(founder);
        address vaultAddr = companiesHouse.createVault(companyId, address(mockAave), address(mockUSDT));
        vault = CompanyVault(vaultAddr);
        console.log("[setUp] vault            :", address(vault));

        // 7. Log vault initial state
        console.log("[setUp] vault.companyId  :", vault.companyId());
        console.log("[setUp] vault.aavePool   :", address(vault.aavePool()));
        console.log("[setUp] vault.admin      :", vault.admin());
        console.log("[setUp] allowedTokens[USDT]:", vault.allowedTokens(address(mockUSDT)));
        console.log("[setUp] isAuthorized(founder):", companiesHouse.isAuthorized(founder, companyId));

        // 8. Deposit USDT into vault so supplyToAave has balance
        vm.startPrank(founder);
        mockUSDT.approve(address(vault), DEPOSIT_USDT);
        vault.deposit(address(mockUSDT), DEPOSIT_USDT);
        vm.stopPrank();
        console.log("[setUp] vault USDT bal   :", vault.getTokenBalance(address(mockUSDT)));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    function _createCompany() internal returns (uint96) {
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

    // ── Debug: full pre/post log then supply ───────────────────────────────────

    function test_debug_supplyToAave() public {
        console.log("=== pre-supply state ===");
        console.log("vault              :", address(vault));
        console.log("aavePool           :", address(vault.aavePool()));
        console.log("aavePool != 0      :", address(vault.aavePool()) != address(0));
        console.log("allowedTokens[USDT]:", vault.allowedTokens(address(mockUSDT)));
        console.log("vault USDT balance :", vault.getTokenBalance(address(mockUSDT)));
        console.log("isAuthorized(founder):", companiesHouse.isAuthorized(founder, companyId));
        console.log("SUPPLY_AMOUNT      :", SUPPLY_AMOUNT);

        vm.prank(founder);
        vault.supplyToAave(address(mockUSDT), SUPPLY_AMOUNT);

        console.log("=== post-supply state ===");
        console.log("vault USDT balance :", vault.getTokenBalance(address(mockUSDT)));
        console.log("mockAave.supplied  :", mockAave.supplied(address(vault), address(mockUSDT)));

        assertEq(vault.getTokenBalance(address(mockUSDT)), DEPOSIT_USDT - SUPPLY_AMOUNT, "vault balance decreased");
        assertEq(mockAave.supplied(address(vault), address(mockUSDT)), SUPPLY_AMOUNT, "aave received tokens");
    }

    // ── Happy path: withdraw after supply ─────────────────────────────────────

    function test_withdrawFromAave_happy_path() public {
        vm.prank(founder);
        vault.supplyToAave(address(mockUSDT), SUPPLY_AMOUNT);

        vm.prank(founder);
        vault.withdrawFromAave(address(mockUSDT), SUPPLY_AMOUNT);

        assertEq(vault.getTokenBalance(address(mockUSDT)), DEPOSIT_USDT, "balance fully restored");
    }

    // ── Guard: unauthorized caller ────────────────────────────────────────────

    function test_reverts_unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert(CompanyVault.NotAuthorized.selector);
        vault.supplyToAave(address(mockUSDT), SUPPLY_AMOUNT);
    }

    // ── Guard: token not whitelisted ──────────────────────────────────────────

    function test_reverts_token_not_allowed() public {
        address otherToken = makeAddr("otherToken");
        vm.prank(founder);
        vm.expectRevert(CompanyVault.TokenNotAllowed.selector);
        vault.supplyToAave(otherToken, SUPPLY_AMOUNT);
    }

    // ── Guard: zero amount ────────────────────────────────────────────────────

    function test_reverts_zero_amount() public {
        vm.prank(founder);
        vm.expectRevert(CompanyVault.ZeroAmount.selector);
        vault.supplyToAave(address(mockUSDT), 0);
    }

    // ── Guard: insufficient vault balance ─────────────────────────────────────

    function test_reverts_insufficient_balance() public {
        vm.prank(founder);
        vm.expectRevert(CompanyVault.InsufficientBalance.selector);
        vault.supplyToAave(address(mockUSDT), DEPOSIT_USDT + 1);
    }

    // ── Guard: aave not configured ────────────────────────────────────────────

    function test_reverts_aave_not_configured() public {
        // Need a second company for this
        vm.startPrank(founder);
        werewolfToken.approve(address(companiesHouse), CREATION_FEE);
        string[] memory roles = new string[](1); roles[0] = "CEO";
        string[] memory powerRoles = new string[](1); powerRoles[0] = "CEO";
        companiesHouse.createCompany(CompaniesHouseV1.CreateCompany({
            name: "Corp2", industry: "Finance", domain: "corp2.io",
            roles: roles, powerRoles: powerRoles,
            operatorAddress: founder, ownerRole: "CEO",
            ownerSalaryPerHour: HOURLY_USDT, ownerName: "Bob"
        }));
        address vaultNoAave = companiesHouse.createVault(2, address(0), address(mockUSDT));
        vm.stopPrank();

        // Deposit so balance check passes
        vm.startPrank(founder);
        mockUSDT.approve(vaultNoAave, SUPPLY_AMOUNT);
        CompanyVault(vaultNoAave).deposit(address(mockUSDT), SUPPLY_AMOUNT);
        vm.stopPrank();

        vm.prank(founder);
        vm.expectRevert(CompanyVault.AaveNotConfigured.selector);
        CompanyVault(vaultNoAave).supplyToAave(address(mockUSDT), SUPPLY_AMOUNT);
    }

    // ── Admin: setAllowedToken ────────────────────────────────────────────────

    function test_admin_can_whitelist_token() public {
        address newToken = makeAddr("newToken");
        assertFalse(vault.allowedTokens(newToken));

        vm.prank(founder);
        vault.setAllowedToken(newToken, true);

        assertTrue(vault.allowedTokens(newToken));
    }

    function test_non_admin_cannot_whitelist() public {
        vm.prank(unauthorized);
        vm.expectRevert(CompanyVault.NotAdmin.selector);
        vault.setAllowedToken(address(mockUSDT), false);
    }
}
