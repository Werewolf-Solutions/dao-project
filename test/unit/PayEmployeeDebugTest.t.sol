// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BaseTest} from "../BaseTest.t.sol";
import {CompaniesHouseV1} from "../../src/CompaniesHouseV1.sol";
import {MockSwapRouter} from "../mocks/MockSwapRouter.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @dev Run with:  forge test --match-path test/unit/PayEmployeeDebugTest.t.sol -vvvv
 *
 * Traces EVERY decision point in payEmployee so you can see exactly
 * which require() would fire on the real testnet.
 */
contract PayEmployeeDebugTest is BaseTest {

    CompaniesHouseV1 companiesHouse;
    MockSwapRouter   mockSwapRouter;

    address employee1 = makeAddr("employee1");

    // $500 / month salary (same scale as production)
    uint256 constant MONTHLY_SALARY  = 500e6;              // 500 USDT (6 dec)
    uint256 constant HOURLY_SALARY   = MONTHLY_SALARY / 730;

    // tokenPrice from BaseTest = 0.0004 ether = 4e14 (USDT/WLF × 1e18)
    uint256 constant WLF_PRICE       = 4e14;
    uint256 constant CREATION_FEE    = 10e18;

    uint256 constant ROUTER_WLF      = 10_000_000e18;   // mock router liquidity
    uint256 constant FOUNDER_WLF     = 5_000_000e18;    // 5M WLF — covers months of $500/mo salary
    uint256 constant FOUNDER_USDT    = 1_000_000e6;     // 1 M USDT for reserve tests

    uint96  companyId;

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
            1  // 1-month reserve for this debug test
        );
        address proxy = address(new TransparentUpgradeableProxy(address(impl), multiSig, initData));
        companiesHouse = CompaniesHouseV1(proxy);

        vm.startPrank(address(timelock));
        werewolfToken.airdrop(founder,                 FOUNDER_WLF);
        werewolfToken.airdrop(address(mockSwapRouter), ROUTER_WLF);
        vm.stopPrank();

        mockUSDT.mint(founder, FOUNDER_USDT);

        // Create company and hire employee1 once for all tests
        string[] memory roles = new string[](2);
        roles[0] = "CEO"; roles[1] = "Engineer";
        string[] memory powerRoles = new string[](1);
        powerRoles[0] = "CEO";

        vm.startPrank(founder);
        werewolfToken.approve(address(companiesHouse), CREATION_FEE);
        companiesHouse.createCompany(CompaniesHouseV1.CreateCompany({
            name:               "Debug Co",
            industry:           "Software",
            domain:             "debug.io",
            roles:              roles,
            powerRoles:         powerRoles,
            companyWallet:      founder,
            ownerRole:          "CEO",
            ownerSalaryPerHour: HOURLY_SALARY,
            ownerName:          "Debug Owner"
        }));
        vm.stopPrank();
        companyId = 1;

        CompaniesHouseV1.SalaryItem[] memory items = new CompaniesHouseV1.SalaryItem[](1);
        items[0] = CompaniesHouseV1.SalaryItem({
            role: "Engineer", salaryPerHour: HOURLY_SALARY, lastPayDate: 0
        });
        vm.prank(founder);
        companiesHouse.hireEmployee(CompaniesHouseV1.HireEmployee({
            employeeAddress: employee1,
            name:            "Debug Employee",
            companyId:       companyId,
            salaryItems:     items
        }));

        // Advance 30 days so there is pending pay
        vm.warp(block.timestamp + 30 days);
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    /// Prints every value that payEmployee reads, and predicts which path / revert.
    function _logState(string memory label, uint96 cId, address emp) internal view {
        console.log(""); console.log("======", label, "======");

        // --- contract configuration ---
        address router = companiesHouse.swapRouter();
        uint256 minMonths = companiesHouse.minReserveMonths();
        console.log("[config] swapRouter    :", router);
        console.log("[config] minReserveMonths:", minMonths);

        // --- token price ---
        uint256 price = tokenSale.price();
        console.log("[price]  tokenSale.price():", price);
        if (price == 0) {
            console.log("*** WILL REVERT: token price not set ***");
            return;
        }

        // --- company balances ---
        uint256 wlfBal  = companiesHouse.companyTokenBalances(cId, address(werewolfToken));
        uint256 usdtBal = companiesHouse.companyTokenBalances(cId, address(mockUSDT));
        console.log("[balance] company WLF  :", wlfBal);
        console.log("[balance] company USDT :", usdtBal);

        // --- salary maths ---
        uint256 monthlyBurn = companiesHouse.getMonthlyBurnUSDT(cId);
        uint256 minReserve  = companiesHouse.getRequiredReserveUSDT(cId);
        console.log("[burn]   monthly USDT burn :", monthlyBurn);
        console.log("[burn]   required reserve  :", minReserve);
        console.log("[burn]   minReserve = monthlyBurn *", minMonths, "months");

        // --- pending pay for this employee ---
        CompaniesHouseV1.CompanyStruct memory co = companiesHouse.retrieveCompany(cId);
        // find the employee by address
        uint256 totalUSDT;
        for (uint256 i = 0; i < co.employees.length; i++) {
            if (co.employees[i].employeeId == emp) {
                for (uint256 j = 0; j < co.employees[i].salaryItems.length; j++) {
                    uint256 elapsed = block.timestamp > co.employees[i].salaryItems[j].lastPayDate
                        ? block.timestamp - co.employees[i].salaryItems[j].lastPayDate
                        : 0;
                    uint256 owed = (elapsed * co.employees[i].salaryItems[j].salaryPerHour) / 3600;
                    console.log("  salaryItem elapsed(s):", elapsed, "owed USDT:", owed);
                    totalUSDT += owed;
                }
            }
        }
        console.log("[pending] totalUSDT owed :", totalUSDT);

        if (totalUSDT == 0) {
            console.log("*** WILL REVERT: Nothing to pay yet ***");
            return;
        }

        uint256 wlfAmount = (totalUSDT * 10**30) / price;
        console.log("[convert] wlfAmount needed:", wlfAmount);

        // --- path decision ---
        bool payFromWlf = wlfBal >= wlfAmount;
        console.log("[path]   company WLF >= needed?", payFromWlf, "(Path A = WLF direct)");

        if (payFromWlf) {
            console.log("[path A] will transfer", wlfAmount, "WLF from company to employee");
            // Check contract actually holds the WLF
            uint256 contractWlf = werewolfToken.balanceOf(address(companiesHouse));
            console.log("[path A] contract WLF balance:", contractWlf);
            if (contractWlf < wlfAmount) {
                console.log("*** WILL REVERT: contract WLF < wlfAmount (accounting bug) ***");
            } else {
                console.log("[path A] OK - payment should succeed");
            }
        } else {
            console.log("[path B] Uniswap swap path");
            if (router == address(0)) {
                console.log("*** WILL REVERT: swap router not configured ***");
                return;
            }
            uint256 needed = totalUSDT + minReserve;
            console.log("[path B] usdtBal needed (pay+reserve):", needed);
            console.log("[path B] usdtBal actual              :", usdtBal);
            if (usdtBal < needed) {
                console.log("*** WILL REVERT: below minimum reserve threshold ***");
                console.log("   shortfall:", needed - usdtBal);
            } else {
                console.log("[path B] reserve check OK");
                // Check contract actually holds the USDT
                uint256 contractUsdt = mockUSDT.balanceOf(address(companiesHouse));
                console.log("[path B] contract USDT balance:", contractUsdt);
                uint256 routerWlf = werewolfToken.balanceOf(address(mockSwapRouter));
                console.log("[path B] router WLF liquidity :", routerWlf);
                uint256 amountOutMin = (wlfAmount * 95) / 100;
                console.log("[path B] amountOutMin (95%)    :", amountOutMin);
                if (contractUsdt < totalUSDT) {
                    console.log("*** WILL REVERT: contract USDT < totalUSDT (accounting bug) ***");
                } else if (routerWlf < amountOutMin) {
                    console.log("*** WILL REVERT: router has insufficient WLF liquidity ***");
                } else {
                    console.log("[path B] OK - swap should succeed");
                }
            }
        }
    }

    // ── Test 1: Path A — company has WLF ──────────────────────────────────────

    function test_debug_PathA_WLFDirect() public {
        // Compute how much WLF to deposit: 2 months of salary for all employees (2× buffer)
        uint256 price      = tokenSale.price();
        uint256 monthly    = companiesHouse.getMonthlyBurnUSDT(companyId);
        uint256 wlfPerMonth = (monthly * 10**30) / price;
        uint256 wlfDeposit  = wlfPerMonth * 2;   // 2-month buffer

        console.log("[setup] monthly USDT burn :", monthly);
        console.log("[setup] WLF per month      :", wlfPerMonth);
        console.log("[setup] depositing WLF     :", wlfDeposit);

        vm.startPrank(founder);
        werewolfToken.approve(address(companiesHouse), wlfDeposit);
        companiesHouse.depositToCompany(companyId, address(werewolfToken), wlfDeposit);
        vm.stopPrank();

        _logState("PATH A: before payEmployee(employee1)", companyId, employee1);

        uint256 emp1Before = werewolfToken.balanceOf(employee1);
        vm.prank(founder);
        companiesHouse.payEmployee(employee1, companyId);

        uint256 emp1After = werewolfToken.balanceOf(employee1);
        console.log("[result] employee1 WLF received:", emp1After - emp1Before);
        console.log("PATH A TEST: PASSED");
    }

    // ── Test 2: Path B — company has only USDT, swaps via Uniswap ─────────────

    function test_debug_PathB_USDTSwap() public {
        // Deposit USDT only — enough to cover pay + 60-month reserve
        uint256 monthly      = companiesHouse.getMonthlyBurnUSDT(companyId);
        uint256 minReserve   = monthly * companiesHouse.minReserveMonths();

        // Compute approximate pending USDT (30 days of HOURLY_SALARY for 2 employees: owner + employee1)
        uint256 approxPending = HOURLY_SALARY * 30 * 24;   // per employee for 30 days
        uint256 toDeposit = approxPending * 2 + minReserve + 1e6; // buffer

        vm.startPrank(founder);
        mockUSDT.approve(address(companiesHouse), toDeposit);
        companiesHouse.depositToCompany(companyId, address(mockUSDT), toDeposit);
        vm.stopPrank();

        _logState("PATH B: before payEmployee(employee1)", companyId, employee1);

        uint256 emp1Before = werewolfToken.balanceOf(employee1);
        vm.prank(founder);
        companiesHouse.payEmployee(employee1, companyId);

        uint256 emp1After = werewolfToken.balanceOf(employee1);
        console.log("[result] employee1 WLF received:", emp1After - emp1Before);
        console.log("PATH B TEST: PASSED");
    }

    // ── Test 3: Path B failure — below reserve ────────────────────────────────

    function test_debug_PathB_BelowReserve_ShowsShortfall() public {
        // Deposit just the pending amount — NOT enough to cover reserve
        uint256 approxPending = HOURLY_SALARY * 30 * 24;
        uint256 tooLittle = approxPending + 1e6;    // pay + tiny buffer, no reserve

        vm.startPrank(founder);
        mockUSDT.approve(address(companiesHouse), tooLittle);
        companiesHouse.depositToCompany(companyId, address(mockUSDT), tooLittle);
        vm.stopPrank();

        // This logs the shortfall without reverting the test itself
        _logState("PATH B RESERVE FAIL: expected shortfall shown above", companyId, employee1);

        vm.expectRevert(bytes("CompaniesHouse: below minimum reserve threshold"));
        vm.prank(founder);
        companiesHouse.payEmployee(employee1, companyId);
        console.log("PATH B RESERVE FAIL TEST: PASSED (revert confirmed)");
    }

    // ── Test 4: payEmployees (batch) — authorization check ────────────────────

    function test_debug_PayEmployees_AuthorizationCheck() public {
        uint256 price       = tokenSale.price();
        uint256 monthly     = companiesHouse.getMonthlyBurnUSDT(companyId);
        uint256 wlfDeposit  = (monthly * 10**30) / price * 2;

        vm.startPrank(founder);
        werewolfToken.approve(address(companiesHouse), wlfDeposit);
        companiesHouse.depositToCompany(companyId, address(werewolfToken), wlfDeposit);
        vm.stopPrank();

        console.log(""); console.log("====== BATCH PAY AUTH CHECK ======");

        // Check who is authorized
        CompaniesHouseV1.CompanyStruct memory co = companiesHouse.retrieveCompany(companyId);
        console.log("[auth] company owner  :", co.owner);
        console.log("[auth] companyWallet  :", co.companyWallet);
        console.log("[auth] caller (founder):", founder);
        console.log("[auth] founder == owner?", founder == co.owner);

        _logState("BATCH: before payEmployees", companyId, employee1);

        uint256 emp1Before = werewolfToken.balanceOf(employee1);
        vm.prank(founder);
        companiesHouse.payEmployees(companyId);

        uint256 emp1After = werewolfToken.balanceOf(employee1);
        console.log("[result] employee1 WLF received:", emp1After - emp1Before);
        console.log("BATCH PAY TEST: PASSED");
    }
}
