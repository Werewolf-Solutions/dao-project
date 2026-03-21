// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BaseTest} from "../BaseTest.t.sol";
import {CompaniesHouseV1} from "../../src/CompaniesHouseV1.sol";
import {PayrollExecutor} from "../../src/PayrollExecutor.sol";
import {PaymentEngine} from "../../src/PaymentEngine.sol";
import {IPaymentEngine} from "../../src/interfaces/IPaymentEngine.sol";
import {MockSwapRouter} from "../mocks/MockSwapRouter.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @dev Tests for PaymentEngine — edge CRUD, settlement, commissions, revenue share.
 *      Run with:  forge test --match-path test/unit/PaymentEngineTest.t.sol -vvvv
 */
contract PaymentEngineTest is BaseTest {

    CompaniesHouseV1 companiesHouse;
    PayrollExecutor  payrollExecutor;
    PaymentEngine    paymentEngine;
    MockSwapRouter   mockSwapRouter;

    address vendor   = makeAddr("vendor");
    address alice    = makeAddr("alice");
    address bob      = makeAddr("bob");
    address oracle   = makeAddr("oracle");
    address stranger = makeAddr("stranger");

    uint256 constant WLF_PRICE    = 4e14;
    uint256 constant CREATION_FEE = 10e18;
    uint256 constant FOUNDER_WLF  = 5_000_000e18;
    uint256 constant FOUNDER_USDT = 1_000_000e6;
    uint256 constant ROUTER_WLF   = 10_000_000e18;

    // $500/month in USDT-wei/hr
    uint256 constant HOURLY_SALARY = uint256(500e6) / 730;

    // Subscription: $100/month = 100e6 USDT per 30 days
    uint96  constant SUB_RATE   = 100e6;  // USDT-wei per period
    uint48  constant SUB_PERIOD = 30 days;

    uint96 companyId;

    function setUp() public override {
        super.setUp();

        mockSwapRouter = new MockSwapRouter(WLF_PRICE);

        // Deploy CompaniesHouseV1
        CompaniesHouseV1 chImpl = new CompaniesHouseV1();
        bytes memory chInit = abi.encodeWithSelector(
            CompaniesHouseV1.initialize.selector,
            address(werewolfToken),
            address(treasury),
            address(dao),
            address(tokenSale),
            founder,
            address(mockUSDT),
            address(mockSwapRouter),
            1
        );
        companiesHouse = CompaniesHouseV1(address(new TransparentUpgradeableProxy(address(chImpl), multiSig, chInit)));

        // Deploy PayrollExecutor
        PayrollExecutor peImpl = new PayrollExecutor();
        bytes memory peInit = abi.encodeWithSelector(
            PayrollExecutor.initialize.selector,
            address(companiesHouse),
            founder
        );
        payrollExecutor = PayrollExecutor(address(new TransparentUpgradeableProxy(address(peImpl), multiSig, peInit)));
        vm.prank(founder);
        companiesHouse.setPayrollExecutor(address(payrollExecutor));

        // Deploy PaymentEngine
        PaymentEngine engImpl = new PaymentEngine();
        bytes memory engInit = abi.encodeWithSelector(
            PaymentEngine.initialize.selector,
            address(companiesHouse),
            address(payrollExecutor),
            oracle,
            founder,
            address(mockUSDT)
        );
        paymentEngine = PaymentEngine(address(new TransparentUpgradeableProxy(address(engImpl), multiSig, engInit)));
        vm.prank(founder);
        companiesHouse.setPaymentEngine(address(paymentEngine));

        // Mint WLF and USDT
        vm.startPrank(address(timelock));
        werewolfToken.airdrop(founder,                 FOUNDER_WLF);
        werewolfToken.airdrop(address(mockSwapRouter), ROUTER_WLF);
        vm.stopPrank();
        mockUSDT.mint(founder, FOUNDER_USDT);

        // Create company
        CompaniesHouseV1.RoleDefinition[] memory roles = new CompaniesHouseV1.RoleDefinition[](1);
        roles[0] = CompaniesHouseV1.RoleDefinition({ name: "Engineer", level: 2 });

        vm.startPrank(founder);
        werewolfToken.approve(address(companiesHouse), CREATION_FEE);
        companiesHouse.createCompany(CompaniesHouseV1.CreateCompany({
            name:               "Edge Test Co",
            industry:           "Software",
            domain:             "edgetest.io",
            roles:              roles,
            operatorAddress:    founder,
            ownerRole:          "Engineer",
            ownerRoleLevel:     2,
            ownerSalaryPerHour: HOURLY_SALARY,
            ownerName:          "Founder"
        }));
        vm.stopPrank();
        companyId = 1;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    function _fundCompany(uint256 usdtAmount) internal {
        mockUSDT.mint(founder, usdtAmount);
        vm.startPrank(founder);
        mockUSDT.approve(address(companiesHouse), usdtAmount);
        companiesHouse.depositToCompany(companyId, address(mockUSDT), usdtAmount);
        vm.stopPrank();
    }

    function _addSubEdge() internal returns (uint256 edgeId) {
        vm.prank(founder);
        edgeId = paymentEngine.addEdge(
            address(founder),
            vendor,
            IPaymentEngine.PaymentType.SUBSCRIPTION,
            SUB_RATE,
            SUB_PERIOD,
            companyId
        );
    }

    // ── Test 1: addEdge stores edge correctly ─────────────────────────────────

    function test_addEdge_stores_edge() public {
        vm.prank(founder);
        uint256 id = paymentEngine.addEdge(
            address(founder),
            vendor,
            IPaymentEngine.PaymentType.SUBSCRIPTION,
            SUB_RATE,
            SUB_PERIOD,
            companyId
        );

        assertEq(id, 1);
        assertEq(paymentEngine.edgeCounter(), 1);

        PaymentEngine.EdgeData memory d = paymentEngine.getEdge(id);
        assertEq(d.edge.id,           1);
        assertEq(d.edge.to,           vendor);
        assertEq(uint8(d.edge.pType), uint8(IPaymentEngine.PaymentType.SUBSCRIPTION));
        assertEq(d.edge.rateUSDT,     SUB_RATE);
        assertEq(d.edge.period,       SUB_PERIOD);
        assertTrue(d.edge.active);
        assertEq(d.companyId,         companyId);
    }

    // ── Test 2: addEdge reverts for non-admin ─────────────────────────────────

    function test_addEdge_reverts_not_admin() public {
        vm.prank(stranger);
        vm.expectRevert(PaymentEngine.NotAdmin.selector);
        paymentEngine.addEdge(address(founder), vendor, IPaymentEngine.PaymentType.SUBSCRIPTION, SUB_RATE, SUB_PERIOD, companyId);
    }

    // ── Test 3: removeEdge deactivates the edge ───────────────────────────────

    function test_removeEdge_deactivates() public {
        vm.prank(founder);
        uint256 id = paymentEngine.addEdge(address(founder), vendor, IPaymentEngine.PaymentType.SUBSCRIPTION, SUB_RATE, SUB_PERIOD, companyId);

        vm.prank(founder);
        paymentEngine.removeEdge(id);

        assertFalse(paymentEngine.getEdge(id).edge.active);
    }

    // ── Test 4: settleEdges SUBSCRIPTION moves funds to vendor ───────────────

    function test_settleEdges_subscription() public {
        uint256 edgeId = _addSubEdge();

        // Fund company with enough USDT (plus reserve buffer)
        uint256 monthly  = companiesHouse.getMonthlyBurnUSDT(companyId);
        uint256 reserve  = companiesHouse.getRequiredReserveUSDT(companyId);
        _fundCompany(SUB_RATE + reserve + monthly + 10e6);

        // Warp one full period
        vm.warp(block.timestamp + SUB_PERIOD);

        uint256 vendorBefore = mockUSDT.balanceOf(vendor);

        uint256[] memory ids = new uint256[](1);
        ids[0] = edgeId;
        paymentEngine.settleEdges(ids, uint48(block.timestamp));

        // vendor received net (gross - 5% fee)
        uint256 fee = SUB_RATE * 500 / 10_000;
        assertEq(mockUSDT.balanceOf(vendor), vendorBefore + SUB_RATE - fee);

        // lastSettled updated
        assertEq(paymentEngine.getEdge(edgeId).edge.lastSettled, uint48(block.timestamp));
    }

    // ── Test 5: settleEdges returns 0 if period not elapsed ───────────────────

    function test_settleEdges_reverts_period_not_elapsed() public {
        uint256 edgeId = _addSubEdge();
        _fundCompany(1_000e6);

        // Do NOT warp — period has not elapsed
        uint256 vendorBefore = mockUSDT.balanceOf(vendor);

        uint256[] memory ids = new uint256[](1);
        ids[0] = edgeId;
        paymentEngine.settleEdges(ids, uint48(block.timestamp));

        // vendor should have received nothing
        assertEq(mockUSDT.balanceOf(vendor), vendorBefore);
    }

    // ── Test 6: settleEdges skips inactive edges ──────────────────────────────

    function test_settleEdges_skips_inactive() public {
        uint256 edgeId = _addSubEdge();
        _fundCompany(1_000e6);

        vm.prank(founder);
        paymentEngine.removeEdge(edgeId);

        vm.warp(block.timestamp + SUB_PERIOD);

        uint256 vendorBefore = mockUSDT.balanceOf(vendor);
        uint256[] memory ids = new uint256[](1);
        ids[0] = edgeId;
        paymentEngine.settleEdges(ids, uint48(block.timestamp));

        assertEq(mockUSDT.balanceOf(vendor), vendorBefore);
    }

    // ── Test 7: triggerCommission sends correct bps amount ────────────────────

    function test_triggerCommission_by_oracle() public {
        // 500 bps = 5% commission
        uint96 commBps = 500;
        vm.prank(founder);
        uint256 edgeId = paymentEngine.addEdge(
            address(founder),
            alice,
            IPaymentEngine.PaymentType.COMMISSION,
            commBps,
            0,       // trigger-only
            companyId
        );

        uint256 saleAmount = 1_000e6; // $1000 USDT
        uint256 expected   = saleAmount * commBps / 10_000; // $50

        uint256 monthly = companiesHouse.getMonthlyBurnUSDT(companyId);
        uint256 reserve = companiesHouse.getRequiredReserveUSDT(companyId);
        _fundCompany(expected + reserve + monthly + 10e6);

        uint256 aliceBefore = mockUSDT.balanceOf(alice);

        vm.prank(oracle);
        paymentEngine.triggerCommission(edgeId, saleAmount);

        uint256 fee = expected * 500 / 10_000;
        assertEq(mockUSDT.balanceOf(alice), aliceBefore + expected - fee);
    }

    // ── Test 8: triggerCommission reverts for non-oracle ──────────────────────

    function test_triggerCommission_reverts_not_oracle() public {
        vm.prank(founder);
        uint256 edgeId = paymentEngine.addEdge(address(founder), alice, IPaymentEngine.PaymentType.COMMISSION, 500, 0, companyId);

        vm.prank(stranger);
        vm.expectRevert(PaymentEngine.NotOracle.selector);
        paymentEngine.triggerCommission(edgeId, 1_000e6);
    }

    // ── Test 9: triggerCommission reverts for wrong payment type ─────────────

    function test_triggerCommission_wrong_type() public {
        uint256 edgeId = _addSubEdge(); // SUBSCRIPTION, not COMMISSION

        vm.prank(oracle);
        vm.expectRevert(PaymentEngine.WrongPaymentType.selector);
        paymentEngine.triggerCommission(edgeId, 1_000e6);
    }

    // ── Test 10: revenue share settlement splits correctly ────────────────────

    function test_revenue_share_settlement() public {
        vm.prank(founder);
        uint256 edgeId = paymentEngine.addEdge(
            address(founder),
            address(0), // `to` ignored for REVENUE_SHARE — recipients set below
            IPaymentEngine.PaymentType.REVENUE_SHARE,
            SUB_RATE,
            SUB_PERIOD,
            companyId
        );

        // 60% to alice, 40% to bob
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 6_000;
        bps[1] = 4_000;

        vm.prank(founder);
        paymentEngine.setRevenueRecipients(edgeId, recipients, bps);

        uint256 monthly = companiesHouse.getMonthlyBurnUSDT(companyId);
        uint256 reserve = companiesHouse.getRequiredReserveUSDT(companyId);
        _fundCompany(SUB_RATE + reserve + monthly + 10e6);

        vm.warp(block.timestamp + SUB_PERIOD);

        uint256 aliceBefore = mockUSDT.balanceOf(alice);
        uint256 bobBefore   = mockUSDT.balanceOf(bob);

        uint256[] memory ids = new uint256[](1);
        ids[0] = edgeId;
        paymentEngine.settleEdges(ids, uint48(block.timestamp));

        uint256 feeRate = 500; // 5%
        uint256 aliceShare = SUB_RATE * 6_000 / 10_000;
        uint256 bobShare   = SUB_RATE * 4_000 / 10_000;
        uint256 aliceNet   = aliceShare - aliceShare * feeRate / 10_000;
        uint256 bobNet     = bobShare   - bobShare   * feeRate / 10_000;

        assertEq(mockUSDT.balanceOf(alice), aliceBefore + aliceNet);
        assertEq(mockUSDT.balanceOf(bob),   bobBefore   + bobNet);
    }

    // ── Test 11: setOracle is admin only ──────────────────────────────────────

    function test_setOracle_admin_only() public {
        vm.prank(stranger);
        vm.expectRevert(PaymentEngine.NotAdmin.selector);
        paymentEngine.setOracle(stranger);

        vm.prank(founder);
        paymentEngine.setOracle(stranger);
        assertEq(paymentEngine.oracle(), stranger);
    }

    // ── Test 12: pause blocks settleEdges ────────────────────────────────────

    function test_pause_blocks_settleEdges() public {
        uint256 edgeId = _addSubEdge();
        _fundCompany(1_000e6);
        vm.warp(block.timestamp + SUB_PERIOD);

        vm.prank(founder);
        paymentEngine.pause();

        uint256[] memory ids = new uint256[](1);
        ids[0] = edgeId;
        vm.expectRevert();
        paymentEngine.settleEdges(ids, uint48(block.timestamp));
    }

    // ── Test 13: getOrgEdgeIds returns edge IDs for a payer ──────────────────

    function test_getOrgEdgeIds() public {
        vm.startPrank(founder);
        paymentEngine.addEdge(address(founder), vendor, IPaymentEngine.PaymentType.SUBSCRIPTION, SUB_RATE, SUB_PERIOD, companyId);
        paymentEngine.addEdge(address(founder), alice,  IPaymentEngine.PaymentType.COMMISSION,   500, 0, companyId);
        vm.stopPrank();

        uint256[] memory ids = paymentEngine.getOrgEdgeIds(address(founder));
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }
}
