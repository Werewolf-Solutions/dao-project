// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {HelperConfig} from "./helpers/HelperConfig.s.sol";

import {WerewolfTokenV1} from "../src/WerewolfTokenV1.sol";
import {Treasury} from "../src/Treasury.sol";
import {TokenSale} from "../src/TokenSale.sol";
import {Timelock} from "../src/Timelock.sol";
import {DAO} from "../src/DAO.sol";
import {Staking} from "../src/Staking.sol";
import {LPStaking} from "../src/LPStaking.sol";
import {UniswapHelper} from "../src/UniswapHelper.sol";
import {CompaniesHouseV1} from "../src/CompaniesHouseV1.sol";
import {PayrollExecutor} from "../src/PayrollExecutor.sol";
import {CompanyVault} from "../src/CompanyVault.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

contract Deploy is Script {
    //helper contract for chain settings
    HelperConfig helperConfig;
    HelperConfig.NetworkConfig netConfig;

    // Constants
    // votingPeriod is hardcoded in DAO.sol::votingPeriod() — 1 hour for testnet
    // timelockDelay comes from netConfig (0 for local/Sepolia, 2 days for mainnet)
    uint256 constant tokenSaleAirdrop    = 500_000 ether;
    uint256 constant tokenPrice          = 0.004 ether;
    uint256 constant tokenSaleOneAirdrop = 25_000_000 ether;
    uint256 constant tokenSaleOnePrice   = 0.04 ether;    // 0.04 USDT/WLF → 25M * 0.04 = 1M USDT

    // Addresses
    address multiSig;
    address founder;

    // Protocol contract instances
    Treasury treasury;
    Timelock timelock;
    WerewolfTokenV1 werewolfToken;
    Staking staking;
    LPStaking lpStaking;
    DAO dao;
    TokenSale tokenSale;
    UniswapHelper uniswapHelper;
    CompaniesHouseV1 companiesHouse;
    PayrollExecutor payrollExecutor;
    address companyVaultImpl;


    function run() external {
        // setting up a helper contract that will handle mocks and mainnet address's etc
        // The helper will handle all dependencies/external contract that the protocol will interact with
        helperConfig = new HelperConfig();
        netConfig = helperConfig.getConfig();

        // starting broadcast
        vm.startBroadcast(netConfig.deployerPrivateKey);

        // Define addresses
        founder = vm.addr(netConfig.deployerPrivateKey); //Note this might need to be changed

        // Deploy UniswapHelper
        uniswapHelper = new UniswapHelper(netConfig.positionManager);

        // Deploy Treasury
        _deployTreasury();

        // Deploy Timelock
        _deployTimelock();

        // Deploy WerewolfTokenV1
        _deployWereWolfToken();

        // Set WerewolfToken in Treasury
        treasury.setWerewolfToken(address(werewolfToken));

        // Deploy Staking
        _deployStaking();

        // Deploy LPStaking
        _deployLPStaking();

        // Configure Treasury for LP staking
        treasury.setStakingContract(address(staking));
        treasury.setLPStakingContract(address(lpStaking));

        // Deploy DAO
        _deployDao();

        // Wire staking contracts for voting power computation
        dao.setStakingContracts(address(staking), address(lpStaking));

        // Deploy TokenSale
        _deployTokenSale();

        // Wire DAO into TokenSale so endSale() can auto-delegate sale #0/#1 buyers to founder
        tokenSale.setDaoContract(address(dao));

        // Wire TokenSale into DAO so DAO.autoDelegate() accepts calls from TokenSale
        dao.setTokenSaleContract(address(tokenSale));

        // Auto-delegations from sales #0 and #1 are locked for 2 years
        dao.setDelegateLockDuration(2 * 365 days);

        // Set TokenSale contract in LPStaking (can only be set once)
        lpStaking.setTokenSaleContract(address(tokenSale));
        lpStaking.transferOwnership(address(timelock));

        // Deploy CompaniesHouseV1
        _deployCompaniesHouse();

        // Deploy PayrollExecutor and wire it into CompaniesHouseV1
        _deployPayrollExecutor();

        // Authorize CompaniesHouseV1 to pay DAO company employees from Treasury
        treasury.setCompaniesHouse(address(companiesHouse));

        // Authorize CompaniesHouseV1 to record governance fees in DAO (for voting power)
        dao.authorizeCaller(address(companiesHouse));

        // Deploy CompanyVault logic contract and register it in CompaniesHouseV1
        _deployCompanyVault();

        // Airdrop tokens to TokenSale
        werewolfToken.airdrop(address(tokenSale), tokenSaleAirdrop);

        // Start Token Sale #0
        tokenSale.startSaleZero(tokenSaleAirdrop, tokenPrice);

        // Configure Treasury swap router for DAO buyback proposals (skip on local chain)
        if (netConfig.swapRouter != address(0)) {
            treasury.setSwapRouter(netConfig.swapRouter, netConfig.usdt, 500);
        }

        // Wire Staking.treasury and LPStaking reference while founder still owns Staking
        staking.setTreasury(address(treasury));
        staking.setLPStakingContract(address(lpStaking));

        // Authorize LPStaking and CompaniesHouse as WLF payEmployee callers
        // (must happen before werewolfToken.transferOwnership — onlyOwner check)
        werewolfToken._authorizeCaller(address(lpStaking));
        werewolfToken._authorizeCaller(address(companiesHouse));

        // Set USDC address on CompaniesHouse (admin = founder at this point, transferred inside _createDaoCompany)
        if (netConfig.usdc != address(0)) {
            companiesHouse.setUsdcAddress(netConfig.usdc);
        }

        // Create the Werewolf DAO company — must happen before werewolfToken.transferOwnership
        // so we can still call werewolfToken.airdrop (onlyOwner) for the creation fee seed
        _createDaoCompany();
        _createWerewolfSolutions();

        // Deployer buys all sale #0 tokens → Uniswap LP created + staked
        // Skipped on live networks with real USDT (deployer must hold enough before running)
        if (netConfig.isMockUsdt) {
            _buyFounderSale();
        }

        // Start Token Sale #1 — only after Sale #0 has been bought out and closed
        // Skipped on live networks since _buyFounderSale() is also skipped there
        if (netConfig.isMockUsdt) {
            _startSaleOne();
        }

        // Transfer ownership to Timelock
        werewolfToken.transferOwnership(address(timelock));
        treasury.transferOwnership(address(timelock));
        tokenSale.transferOwnership(address(timelock));
        staking.transferOwnership(address(timelock));
        payrollExecutor.setAdmin(address(timelock));

        // Transfer Timelock admin to DAO (must be last action as founder)
        // setPendingAdmin now accepts msg.sender == admin, no queue needed
        timelock.setPendingAdmin(address(dao));
        dao.__acceptAdmin();

        console.log("Timelock admin transferred to DAO. Timelock.delay =", timelock.delay());

        vm.stopBroadcast();

        //Write the address to file
        _writeDeploymentData();
    }

    function _deployTreasury() internal {
        // Deploy Treasury
        Treasury treasuryImpl = new Treasury();
        bytes memory initDataTreasury = abi.encodeWithSelector(
            Treasury.initialize.selector,
            founder
        );
        TransparentUpgradeableProxy treasuryProxy = new TransparentUpgradeableProxy(
                address(treasuryImpl),
                netConfig.multiSig,
                initDataTreasury
            );
        treasury = Treasury(address(treasuryProxy));
    }

    function _deployTimelock() internal {
        Timelock timelockImpl = new Timelock();
        bytes memory initDataTimelock = abi.encodeWithSelector(
            Timelock.initialize.selector,
            founder,
            netConfig.timelockDelay
        );
        TransparentUpgradeableProxy timelockProxy = new TransparentUpgradeableProxy(
                address(timelockImpl),
                netConfig.multiSig,
                initDataTimelock
            );
        timelock = Timelock(address(timelockProxy));
    }

    function _deployCompaniesHouse() internal {
        CompaniesHouseV1 companiesHouseImpl = new CompaniesHouseV1();
        bytes memory initDataCompaniesHouse = abi.encodeWithSelector(
            CompaniesHouseV1.initialize.selector,
            address(werewolfToken),
            address(treasury),
            address(dao),
            address(tokenSale),
            founder,                   // admin starts as founder; transferred to Timelock after _createDaoCompany()
            netConfig.usdt,            // USDT token for employee payouts
            netConfig.swapRouter,      // Uniswap V3 router (address(0) on local chain)
            netConfig.minReserveMonths // 1 local / 3 testnet / 60 mainnet
        );
        TransparentUpgradeableProxy companiesHouseProxy = new TransparentUpgradeableProxy(
                address(companiesHouseImpl),
                netConfig.multiSig,
                initDataCompaniesHouse
            );
        companiesHouse = CompaniesHouseV1(address(companiesHouseProxy));
        // Admin starts as founder so we can call setDaoCompanyId after createCompany.
        // Transferred to Timelock at end of _createDaoCompany().
    }

    function _deployPayrollExecutor() internal {
        PayrollExecutor payrollExecutorImpl = new PayrollExecutor();
        bytes memory initData = abi.encodeWithSelector(
            PayrollExecutor.initialize.selector,
            address(companiesHouse),
            founder  // admin starts as founder; transferred to Timelock at end of run()
        );
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(payrollExecutorImpl),
            netConfig.multiSig,
            initData
        );
        payrollExecutor = PayrollExecutor(address(proxy));
        companiesHouse.setPayrollExecutor(address(payrollExecutor));
        console.log("PayrollExecutor:     ", address(payrollExecutor));
    }

    function _deployCompanyVault() internal {
        // 1. Deploy CompanyVault logic contract (the implementation)
        companyVaultImpl = address(new CompanyVault());

        // 2. Deploy UpgradeableBeacon — Timelock is owner so DAO governs future upgrades.
        //    To add a new protocol: deploy CompanyVaultV2, then DAO proposal → beacon.upgradeTo(V2).
        UpgradeableBeacon vaultBeacon = new UpgradeableBeacon(companyVaultImpl, address(timelock));

        // 3. Register beacon in CompaniesHouseV1
        companiesHouse.setBeacon(address(vaultBeacon));

        console.log("CompanyVault impl:   ", companyVaultImpl);
        console.log("CompanyVault beacon: ", address(vaultBeacon));
    }

    function _deployWereWolfToken() internal {
        WerewolfTokenV1 werewolfTokenImpl = new WerewolfTokenV1();
        bytes memory initDataWerewolfToken = abi.encodeWithSelector(
            WerewolfTokenV1.initialize.selector,
            founder,
            address(treasury),
            address(timelock),
            founder,
            address(0x1) // Placeholder for another address
        );
        TransparentUpgradeableProxy werewolfTokenProxy = new TransparentUpgradeableProxy(
                address(werewolfTokenImpl),
                netConfig.multiSig,
                initDataWerewolfToken
            );
        werewolfToken = WerewolfTokenV1(address(werewolfTokenProxy));
    }

    function _deployStaking() internal {
        Staking stakingImpl = new Staking();
        bytes memory initDataStaking = abi.encodeWithSelector(
            Staking.initialize.selector,
            address(werewolfToken),
            founder  // founder owns initially so setTreasury() can be called before timelock transfer
        );
        TransparentUpgradeableProxy stakingProxy = new TransparentUpgradeableProxy(
                address(stakingImpl),
                netConfig.multiSig,
                initDataStaking
            );
        staking = Staking(address(stakingProxy));
    }

    function _deployLPStaking() internal {
        LPStaking lpStakingImpl = new LPStaking();
        bytes memory initDataLPStaking = abi.encodeWithSelector(
            LPStaking.initialize.selector,
            address(werewolfToken),         // WLF token
            netConfig.usdt,                  // USDT token
            founder,                          // Owner (transferred to timelock after setTokenSaleContract)
            address(treasury),               // Reward source
            netConfig.positionManager        // Uniswap v3 NFT manager
        );
        TransparentUpgradeableProxy lpStakingProxy = new TransparentUpgradeableProxy(
                address(lpStakingImpl),
                netConfig.multiSig,
                initDataLPStaking
            );
        lpStaking = LPStaking(address(lpStakingProxy));
    }

    function _deployDao() internal {
        DAO daoImpl = new DAO();
        bytes memory initDataDAO = abi.encodeWithSelector(
            DAO.initialize.selector,
            address(werewolfToken),
            address(treasury),
            address(timelock),
            founder
        );
        TransparentUpgradeableProxy daoProxy = new TransparentUpgradeableProxy(
            address(daoImpl),
            netConfig.multiSig,
            initDataDAO
        );
        dao = DAO(address(daoProxy));
    }

    function _deployTokenSale() internal {
        TokenSale tokenSaleImpl = new TokenSale();
        bytes memory initDataTokenSale = abi.encodeWithSelector(
            TokenSale.initialize.selector,
            founder,
            address(werewolfToken),
            address(treasury),
            address(timelock),
            netConfig.usdt,
            address(staking),
            address(lpStaking),
            address(uniswapHelper)
        );
        TransparentUpgradeableProxy tokenSaleProxy = new TransparentUpgradeableProxy(
                address(tokenSaleImpl),
                netConfig.multiSig,
                initDataTokenSale
            );
        tokenSale = TokenSale(payable(address(tokenSaleProxy)));
    }

    function _createDaoCompany() internal {
        // 1. Approve creation fee from deployer's own WLF balance (1000 WLF pre-funded)
        uint256 creationFee = companiesHouse.creationFee();
        werewolfToken.approve(address(companiesHouse), creationFee);

        // 2. Salary: $10,000/month on testnets, $1,000/month on mainnet
        //    Formula: $monthly * 1_000_000 / 730  (USDT 6-dec wei per hour)
        uint256 hourlyWei = block.chainid == 1
            ? uint256( 1_000 * 1_000_000) / 730   // ≈  1,369,863 USDT-wei/hr on mainnet
            : uint256(10_000 * 1_000_000) / 730;  // ≈ 13,698,630 USDT-wei/hr on testnets/local

        // 3. Build the Werewolf DAO company params
        CompaniesHouseV1.RoleDefinition[] memory roles = new CompaniesHouseV1.RoleDefinition[](7);
        roles[0] = CompaniesHouseV1.RoleDefinition({ name: "Founder",   level: 1 });
        roles[1] = CompaniesHouseV1.RoleDefinition({ name: "Engineer",  level: 2 });
        roles[2] = CompaniesHouseV1.RoleDefinition({ name: "Advisor",   level: 2 });
        roles[3] = CompaniesHouseV1.RoleDefinition({ name: "HR",        level: 2 });
        roles[4] = CompaniesHouseV1.RoleDefinition({ name: "SMM",       level: 2 });
        roles[5] = CompaniesHouseV1.RoleDefinition({ name: "Developer", level: 3 });
        roles[6] = CompaniesHouseV1.RoleDefinition({ name: "Tester",    level: 3 });

        CompaniesHouseV1.CreateCompany memory params = CompaniesHouseV1.CreateCompany({
            name:               "Werewolf DAO",
            industry:           "software",
            domain:             "dao.werewolf.solutions",
            roles:              roles,
            operatorAddress:    founder,
            ownerRole:          "Founder",
            ownerRoleLevel:     1,
            ownerSalaryPerHour: hourlyWei,
            ownerName:          "Lorenzo"
        });

        companiesHouse.createCompany(params);

        // 4. Mark this as the canonical DAO company
        uint96 daoId = companiesHouse.currentCompanyIndex() - 1;
        companiesHouse.setDaoCompanyId(daoId);

        // 4b. Create CompanyVault for the DAO company — enables DeFi/Aave via governance proposals.
        //     aavePool = address(0) on local chain (vault created but DeFi inactive until configured).
        address vaultToken = netConfig.aaveUsdt != address(0) ? netConfig.aaveUsdt : netConfig.usdt;
        companiesHouse.createVault(daoId, netConfig.aavePool, vaultToken);
        address daoVaultAddr = companiesHouse.companyVault(daoId);
        console.log("DAO company vault created:", daoVaultAddr);

        // Whitelist USDC while founder is still vault admin
        if (netConfig.usdc != address(0)) {
            CompanyVault(daoVaultAddr).setAllowedToken(netConfig.usdc, true);
        }

        // Set guardian = founder so guardian can toggle borrowing without a proposal.
        // Must happen while founder is still vault admin.
        CompanyVault(daoVaultAddr).setGuardian(founder);

        // Transfer vault admin to Timelock so DAO proposals can call supplyToAave / withdrawFromAave.
        // Must happen while founder is still vault.admin (vault.admin = founder at creation time).
        CompanyVault(daoVaultAddr).setAdmin(address(timelock));

        // 5. Mint 1T mock USDT to deployer (only on chains with MockUSDT)
        //    1T USDT = 1_000_000_000_000 * 1_000_000 = 1e18 USDT-wei
        if (netConfig.isMockUsdt) {
            IMintable(netConfig.usdt).mint(founder, 1_000_000_000_000 * 1_000_000);
        }

        // 6. Set DAO company reserve to 6 months (admin still = founder here)
        companiesHouse.setCompanyReserveMonths(daoId, 6);

        // 6b. Confirm protocol fee rates (initialize already sets these; explicit here for clarity)
        //     50 bps = 0.5% on WLF payments, 500 bps = 5% on USDT payments
        companiesHouse.setFees(50, 500);

        // 7. Transfer CompaniesHouse admin to Timelock
        companiesHouse.setAdmin(address(timelock));

        console.log("Werewolf DAO company created. ID:", daoId);
    }

    function _createWerewolfSolutions() internal {
        // 1. Approve creation fee from deployer's WLF balance (10 WLF)
        uint256 creationFee = companiesHouse.creationFee();
        werewolfToken.approve(address(companiesHouse), creationFee);

        // 2. Salary: $5,000/month (all chains)
        uint256 hourlyWei = uint256(5_000 * 1_000_000) / 730; // ≈ 6,849,315 USDT-wei/hr

        // 3. Build Werewolf Solutions company params
        CompaniesHouseV1.RoleDefinition[] memory roles = new CompaniesHouseV1.RoleDefinition[](8);
        roles[0] = CompaniesHouseV1.RoleDefinition({ name: "Founder",  level: 1 });
        roles[1] = CompaniesHouseV1.RoleDefinition({ name: "CEO",      level: 2 });
        roles[2] = CompaniesHouseV1.RoleDefinition({ name: "CTO",      level: 2 });
        roles[3] = CompaniesHouseV1.RoleDefinition({ name: "Engineer", level: 3 });
        roles[4] = CompaniesHouseV1.RoleDefinition({ name: "Designer", level: 3 });
        roles[5] = CompaniesHouseV1.RoleDefinition({ name: "HR",       level: 3 });
        roles[6] = CompaniesHouseV1.RoleDefinition({ name: "Advisor",  level: 3 });
        roles[7] = CompaniesHouseV1.RoleDefinition({ name: "SMM",      level: 3 });

        CompaniesHouseV1.CreateCompany memory params = CompaniesHouseV1.CreateCompany({
            name:               "Werewolf Solutions",
            industry:           "software",
            domain:             "werewolf.solutions",
            roles:              roles,
            operatorAddress:    founder,
            ownerRole:          "Founder",
            ownerRoleLevel:     1,
            ownerSalaryPerHour: hourlyWei,
            ownerName:          "Lorenzo"
        });

        companiesHouse.createCompany(params);

        uint96 wsId = companiesHouse.currentCompanyIndex() - 1;

        // 4. Create CompanyVault for DeFi (same token as DAO vault)
        address vaultToken = netConfig.aaveUsdt != address(0) ? netConfig.aaveUsdt : netConfig.usdt;
        companiesHouse.createVault(wsId, netConfig.aavePool, vaultToken);

        console.log("Werewolf Solutions company created. ID:", wsId);
    }

    function _startSaleOne() internal {
        werewolfToken.airdrop(address(tokenSale), tokenSaleOneAirdrop);
        tokenSale.startSale(tokenSaleOneAirdrop, tokenSaleOnePrice);
    }

    function _buyFounderSale() internal {
        // price is USDT/WLF with 18-decimal scaling; USDT has 6 decimals
        uint256 usdtRequired = tokenSaleAirdrop * tokenPrice / 1 ether / 1e12;

        // Approve TokenSale to spend the USDT
        IERC20(netConfig.usdt).approve(address(tokenSale), usdtRequired);

        // Buy all tokens — auto-closes sale when tokensAvailable hits 0
        tokenSale.buyTokens(0, tokenSaleAirdrop, usdtRequired);

        // Create Uniswap LP + stake with 5-yr lock (callable by anyone after auto-close)
        tokenSale.endSale();
    }

    function _writeDeploymentData() internal {
        // Inside foundry.toml it must have the following settings enabled
        // fs_permissions = [{ access = "write", path = "./"}]

        string memory path = "./script/output/deployed-addresses.txt";
        vm.removeFile(path);

        vm.writeLine(
            path,
            string.concat("Chain ID:", vm.toString(block.chainid))
        );

        string memory treasuryStr = string.concat(
            "Treasury:",
            vm.toString(address(treasury))
        );
        vm.writeLine(path, treasuryStr);

        string memory timelockStr = string.concat(
            "TimeLock:",
            vm.toString(address(timelock))
        );
        vm.writeLine(path, timelockStr);

        string memory werewolfTokenStr = string.concat(
            "WerewolfToken:",
            vm.toString(address(werewolfToken))
        );
        vm.writeLine(path, werewolfTokenStr);

        string memory stakingStr = string.concat(
            "Staking:",
            vm.toString(address(staking))
        );
        vm.writeLine(path, stakingStr);

        string memory lpStakingStr = string.concat(
            "LPStaking:",
            vm.toString(address(lpStaking))
        );
        vm.writeLine(path, lpStakingStr);

        string memory daoStr = string.concat("DAO:", vm.toString(address(dao)));
        vm.writeLine(path, daoStr);

        string memory tokenSaleStr = string.concat(
            "TokenSale:",
            vm.toString(address(tokenSale))
        );
        vm.writeLine(path, tokenSaleStr);

        string memory usdtStr = string.concat(
            "USDT:",
            vm.toString(address(netConfig.usdt))
        );
        vm.writeLine(path, usdtStr);

        string memory companiesHouseStr = string.concat(
            "CompaniesHouse:",
            vm.toString(address(companiesHouse))
        );
        vm.writeLine(path, companiesHouseStr);

        string memory payrollExecutorStr = string.concat(
            "PayrollExecutor:",
            vm.toString(address(payrollExecutor))
        );
        vm.writeLine(path, payrollExecutorStr);

        string memory companyVaultImplStr = string.concat(
            "CompanyVaultImpl:",
            vm.toString(companyVaultImpl)
        );
        vm.writeLine(path, companyVaultImplStr);

        // Write separate AaveUSDT address when it differs from the token-sale USDT
        if (netConfig.aaveUsdt != address(0)) {
            vm.writeLine(path, string.concat("AaveUSDT:", vm.toString(netConfig.aaveUsdt)));
        }
        // Write Aave pool address so sync-dapp.mjs keeps it in addresses.ts
        if (netConfig.aavePool != address(0)) {
            vm.writeLine(path, string.concat("AavePool:", vm.toString(netConfig.aavePool)));
        }
        // Write USDC address (from aave-address-book on live networks)
        if (netConfig.usdc != address(0)) {
            vm.writeLine(path, string.concat("USDC:", vm.toString(netConfig.usdc)));
        }
    }
}
