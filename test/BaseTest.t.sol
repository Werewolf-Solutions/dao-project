// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {WerewolfTokenV1} from "../src/WerewolfTokenV1.sol";
import {Treasury} from "../src/Treasury.sol";
import {TokenSale} from "../src/TokenSale.sol";
import {Timelock} from "../src/Timelock.sol";
import {DAO} from "../src/DAO.sol";
import {Staking} from "../src/Staking.sol";
import {UniswapHelper} from "../src/UniswapHelper.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract BaseTest is Test {
    // Contract instances
    WerewolfTokenV1 werewolfToken;
    Treasury treasury;
    TokenSale tokenSale;
    Timelock timelock;
    DAO dao;
    Staking staking;
    UniswapHelper uniswapHelper;
    MockUSDT mockUSDT;

    // Addresses
    address multiSig;
    address founder;
    address addr1;
    address addr2;

    // Constants
    uint256 constant votingPeriod = 2 days;
    uint256 constant tokenSaleAirdrop = 5_000_000 ether;
    uint256 constant tokenPrice = 0.001 ether;

    function setUp() public virtual {
        // Set up signers
        multiSig = makeAddr("multiSig");
        founder = makeAddr("founder");
        addr1 = address(0x1);
        addr2 = address(0x2);

        // Deploy MockUSDT
        mockUSDT = new MockUSDT(1_000_000 ether);

        // Deploy UniswapHelper
        uniswapHelper = new UniswapHelper(founder);

        // Deploy Treasury
        address treasuryImpl = address(new Treasury());
        bytes memory initDataTreasury = abi.encodeWithSelector(Treasury.initialize.selector, founder);
        address treasuryAddress = address(new TransparentUpgradeableProxy(treasuryImpl, multiSig, initDataTreasury));
        treasury = Treasury(treasuryAddress);

        // Deploy Timelock
        address timelockImpl = address(new Timelock());
        bytes memory initDataTimelock = abi.encodeWithSelector(Timelock.initialize.selector, founder, votingPeriod); //this might be wrong, just copying the original test
        address timelockAddress = address(new TransparentUpgradeableProxy(timelockImpl, multiSig, initDataTimelock));
        timelock = Timelock(timelockAddress);

        // Deploy WerewolfTokenV1
        // note the Treasury and the Werewolf token need eachother's address in the constructor which is not possible, need to fix the contract's logic
        address werewolfTokenImpl = address(new WerewolfTokenV1());
        bytes memory initDataWerewolfToken = abi.encodeWithSelector(
            WerewolfTokenV1.initialize.selector, founder, address(treasury), address(timelock), founder, addr1
        );
        address werewolfTokenAddress =
            address(new TransparentUpgradeableProxy(werewolfTokenImpl, multiSig, initDataWerewolfToken));
        werewolfToken = WerewolfTokenV1(werewolfTokenAddress);

        //After deploying the WerewolfTokenV1 set the token in the treasury contract
        vm.prank(founder);
        treasury.setWerewolfToken(address(werewolfToken));

        // Deploy Staking
        address stakingImpl = address(new Staking());
        bytes memory initDataStaking =
            abi.encodeWithSelector(Staking.initialize.selector, address(werewolfToken), address(timelock));
        address stakingAddress = address(new TransparentUpgradeableProxy(stakingImpl, multiSig, initDataStaking));
        staking = Staking(stakingAddress);

        // Deploy DAO
        address daoImpl = address(new DAO());
        bytes memory initDataDAO = abi.encodeWithSelector(
            DAO.initialize.selector, address(werewolfToken), address(treasury), address(timelock), founder
        );
        address daoAddress = address(new TransparentUpgradeableProxy(daoImpl, multiSig, initDataDAO));
        dao = DAO(daoAddress);

        // Deploy TokenSale
        address tokenSaleImpl = address(new TokenSale());
        bytes memory initDataTokenSale = abi.encodeWithSelector(
            TokenSale.initialize.selector,
            founder,
            address(werewolfToken),
            address(treasury),
            address(timelock),
            address(mockUSDT),
            address(staking),
            address(uniswapHelper)
        );
        address tokenSaleAddress = address(new TransparentUpgradeableProxy(tokenSaleImpl, multiSig, initDataTokenSale));
        tokenSale = TokenSale(tokenSaleAddress);

        // Airdrop tokens to TokenSale contract
        vm.startPrank(founder);
        werewolfToken.airdrop(address(tokenSale), tokenSaleAirdrop);

        // Start Token Sale #0
        tokenSale.startSaleZero(tokenSaleAirdrop, tokenPrice);

        // Transfer ownerships
        werewolfToken.transferOwnership(address(timelock));
        treasury.transferOwnership(address(timelock));
        tokenSale.transferOwnership(address(timelock));
        vm.stopPrank();
    }

    function test_SetupProcess() public {
        //blank test
        //run this to verify the setup is running correctly
    }

    function test_AirdropToTokenSale() public {
        uint256 tokenSaleBalance = werewolfToken.balanceOf(address(tokenSale));
        assertEq(tokenSaleBalance, tokenSaleAirdrop);
    }

    function test_StartTokenSaleZero() public {
        uint256 saleCounter = tokenSale.saleIdCounter();
        (uint256 saleId, uint256 tokensAvailable, uint256 price, bool active) = tokenSale.sales(saleCounter);
        bool saleActive = tokenSale.saleActive();

        assertEq(tokensAvailable, tokenSaleAirdrop);
        assertEq(price, tokenPrice);
        assertTrue(saleActive);
    }

    function test_TransferOwnershipToTimelock() public {
        assertEq(werewolfToken.owner(), address(timelock));
        assertEq(treasury.owner(), address(timelock));
        assertEq(tokenSale.owner(), address(timelock));
    }

    function test_FounderBuyTokens() public {
        vm.startPrank(founder);
        uint256 amount = 5_000e6; //mainnet USDT has 6 decimals
        mockUSDT.mint(founder, amount);
        uint256 founderWLFBalanceBefore = werewolfToken.balanceOf(founder);
        uint256 founderUSDTBalanceBefore = mockUSDT.balanceOf(founder);

        // Approve TokenSale contract to spend tokens
        werewolfToken.approve(address(tokenSale), tokenSaleAirdrop);
        mockUSDT.approve(address(tokenSale), amount);

        // Buy tokens (updated signature: amount, tokenAmount, usdtAmount)
        tokenSale.buyTokens(
            tokenSaleAirdrop, tokenSaleAirdrop, amount
        );

        uint256 founderWLFBalanceAfter = werewolfToken.balanceOf(founder);
        uint256 founderUSDTBalanceAfter = mockUSDT.balanceOf(founder);
        uint256 stakingWLFBalance = werewolfToken.balanceOf(address(staking));
        uint256 stakingUSDTBalance = mockUSDT.balanceOf(address(staking));

        assertEq(stakingWLFBalance, tokenSaleAirdrop);
        assertEq(founderUSDTBalanceAfter, founderUSDTBalanceBefore - amount);
        assertEq(stakingUSDTBalance, amount);
        vm.stopPrank();
    }
}
