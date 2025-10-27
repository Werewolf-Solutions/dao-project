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

contract DaoTest is Test {
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

    // Proposal args
    address[] targets;
    string[] signatures;
    bytes[] calldatas;

    // Constants
    uint256 constant votingPeriod = 2 days;
    uint256 constant tokenSaleAirdrop = 5_000_000 ether;
    uint256 constant tokenPrice = 0.001 ether;
    uint256 mintAmount = 1000 ether;
    uint256 proposalCost = 10 ether;

    function setUp() public virtual {
        // Set up signers
        multiSig = makeAddr("multiSig");
        founder = makeAddr("founder");
        addr1 = makeAddr("addr1");
        addr2 = makeAddr("addr2");

        // Deploy MockUSDT
        mockUSDT = new MockUSDT(1_000_000 ether);

        // Deploy UniswapHelper
        uniswapHelper = new UniswapHelper(founder);

        // Deploy Treasury
        address treasuryImpl = address(new Treasury());
        bytes memory initDataTreasury = abi.encodeWithSelector(
            Treasury.initialize.selector,
            founder
        );
        address treasuryAddress = address(
            new TransparentUpgradeableProxy(
                treasuryImpl,
                multiSig,
                initDataTreasury
            )
        );
        treasury = Treasury(treasuryAddress);

        // Deploy Timelock
        address timelockImpl = address(new Timelock());
        bytes memory initDataTimelock = abi.encodeWithSelector(
            Timelock.initialize.selector,
            founder,
            votingPeriod
        );
        address timelockAddress = address(
            new TransparentUpgradeableProxy(
                timelockImpl,
                multiSig,
                initDataTimelock
            )
        );
        timelock = Timelock(timelockAddress);

        // Deploy WerewolfTokenV1
        address werewolfTokenImpl = address(new WerewolfTokenV1());
        bytes memory initDataWerewolfToken = abi.encodeWithSelector(
            WerewolfTokenV1.initialize.selector,
            founder,
            address(treasury),
            address(timelock),
            founder,
            addr1
        );
        address werewolfTokenAddress = address(
            new TransparentUpgradeableProxy(
                werewolfTokenImpl,
                multiSig,
                initDataWerewolfToken
            )
        );
        werewolfToken = WerewolfTokenV1(werewolfTokenAddress);

        // Set the Werewolf token in the Treasury contract
        vm.prank(founder);
        treasury.setWerewolfToken(address(werewolfToken));

        // Deploy Staking
        address stakingImpl = address(new Staking());
        bytes memory initDataStaking = abi.encodeWithSelector(
            Staking.initialize.selector,
            address(werewolfToken),
            address(timelock)
        );
        address stakingAddress = address(
            new TransparentUpgradeableProxy(
                stakingImpl,
                multiSig,
                initDataStaking
            )
        );
        staking = Staking(stakingAddress);

        // Deploy DAO
        address daoImpl = address(new DAO());
        bytes memory initDataDAO = abi.encodeWithSelector(
            DAO.initialize.selector,
            address(werewolfToken),
            address(treasury),
            address(timelock),
            founder
        );
        address daoAddress = address(
            new TransparentUpgradeableProxy(daoImpl, multiSig, initDataDAO)
        );
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
        address tokenSaleAddress = address(
            new TransparentUpgradeableProxy(
                tokenSaleImpl,
                multiSig,
                initDataTokenSale
            )
        );
        tokenSale = TokenSale(tokenSaleAddress);

        // Airdrop tokens to TokenSale contract
        vm.startPrank(founder);
        werewolfToken.airdrop(address(tokenSale), tokenSaleAirdrop);

        // Start Token Sale
        tokenSale.startSaleZero(tokenSaleAirdrop, tokenPrice);

        // Transfer ownerships
        werewolfToken.transferOwnership(address(timelock));
        treasury.transferOwnership(address(timelock));
        tokenSale.transferOwnership(address(timelock));

        vm.stopPrank();

        _setTimelockAdmin();
    }

    function _setTimelockAdmin() public {
        console.log("Setting up Timelock admin...");

        // Step 1: Queue `setPendingAdmin(address(dao))`
        bytes memory setPendingAdminCallData = abi.encode(address(dao));

        uint256 eta = block.timestamp + 2 days; // Ensure eta is exactly 2 days later

        vm.prank(founder);
        timelock.queueTransaction(
            address(timelock),
            "setPendingAdmin(address)", // Function signature
            setPendingAdminCallData,
            eta
        );

        console.log("Queued setPendingAdmin. ETA:", eta);
        console.log(
            "Pending admin before execution: ",
            timelock.pendingAdmin()
        );

        // Step 2: Advance time past timelock delay
        vm.warp(eta + 1); // Move past the eta to allow execution

        // Step 3: Execute `setPendingAdmin(address(dao))`
        vm.prank(founder);
        timelock.executeTransaction(
            address(timelock),
            "setPendingAdmin(address)", // Function signature
            setPendingAdminCallData,
            eta
        );

        console.log(
            "Executed setPendingAdmin. Pending Admin:",
            timelock.pendingAdmin()
        );
        console.log("Timelock admin: ", timelock.admin());

        // Step 4: DAO accepts admin role
        vm.prank(founder);
        dao.__acceptAdmin();

        console.log("New Timelock admin set to DAO:", timelock.admin());

        require(
            timelock.admin() == address(dao),
            "Timelock admin was not set correctly"
        );
    }

    function test_dao_mint_tokens_to_treasury() public {
        console.log("Starting DAO mint token test...");
        console.log("Minting amount:", mintAmount);

        // Declare proposal variables
        delete targets;
        delete signatures;
        delete calldatas;

        // Encode function call data correctly for minting tokens
        bytes memory mintProposalCallData = abi.encode(mintAmount);

        // abi.encodeWithSignature(
        //     "mint(uint256)",
        //     mintAmount
        // );

        // Approve DAO to spend proposalCost tokens on behalf of founder
        vm.prank(founder);
        werewolfToken.approve(address(dao), proposalCost);

        console.log("Creating mint proposal...");
        vm.prank(founder);

        targets.push(address(werewolfToken)); // Assign the target address
        signatures.push("mint(uint256)"); // Assign the function signature
        calldatas.push(mintProposalCallData); // Assign the calldata

        // Create the proposal
        dao.createProposal(targets, signatures, calldatas);

        uint256 proposalId = dao.proposalCount() - 1; // Get the latest proposal ID

        vm.prank(founder);
        dao.approveProposal(proposalId);

        console.log("Start voting period:", block.timestamp);
        console.log("Voting period:", dao.votingPeriod());

        // Cast votes
        vm.prank(founder);
        dao.vote(proposalId, true);

        vm.prank(addr1);
        dao.vote(proposalId, true);

        // Simulate the end of voting period
        vm.roll(block.timestamp + dao.votingPeriod());
        vm.warp(block.timestamp + dao.votingPeriod());

        console.log("End voting period:", block.timestamp);

        // Check Treasury balance before proposal execution
        uint256 initialTreasuryBalance = werewolfToken.balanceOf(
            address(treasury)
        );
        console.log(
            "Treasury balance before execution:",
            initialTreasuryBalance
        );

        // Ensure timelock admin is correct before proceeding
        require(timelock.admin() == address(dao), "Timelock admin mismatch");

        console.log("Queue proposal");
        // Queue proposal
        vm.prank(founder);
        dao.queueProposal(proposalId);

        console.log("Start timelock delay after queueing:", block.timestamp);
        console.log("Timelock delay:", timelock.delay());
        // Simulate timelock delay
        vm.roll(block.timestamp + timelock.delay() + 1);
        vm.warp(block.timestamp + timelock.delay() + 1);
        console.log("End of timelock delay:", block.timestamp);

        console.log("Executing proposal...");
        uint256 eta = dao.getEta(proposalId);

        console.log("Block number:", block.timestamp);
        console.log("ETA:", eta);
        console.log("Check ETA:", block.timestamp >= eta);
        // Execute proposal
        vm.prank(founder);
        dao.executeProposal(proposalId);

        // Check Treasury balance after proposal execution
        uint256 newTreasuryBalance = werewolfToken.balanceOf(address(treasury));
        console.log("Treasury balance after execution:", newTreasuryBalance);

        uint256 expectedTreasuryBalance = initialTreasuryBalance + mintAmount;
        console.log("Expected treasury balance:", expectedTreasuryBalance);
        assertEq(
            newTreasuryBalance,
            expectedTreasuryBalance,
            "Treasury balance mismatch"
        );
    }
}
