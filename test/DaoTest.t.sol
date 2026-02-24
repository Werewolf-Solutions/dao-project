// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {WerewolfTokenV1} from "../src/WerewolfTokenV1.sol";
import {Treasury} from "../src/Treasury.sol";
import {TokenSale} from "../src/TokenSale.sol";
import {Timelock} from "../src/Timelock.sol";
import {DAO} from "../src/DAO.sol";
import {Staking} from "../src/Staking.sol";
import {LPStaking} from "../src/LPStaking.sol";
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
    LPStaking lpStaking;
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

        // Deploy LPStaking
        address lpStakingImpl = address(new LPStaking());
        bytes memory initDataLPStaking = abi.encodeWithSelector(
            LPStaking.initialize.selector,
            address(werewolfToken),
            address(mockUSDT),
            founder,
            address(treasury),
            founder  // Using founder as positionManager for tests
        );
        address lpStakingAddress = address(
            new TransparentUpgradeableProxy(
                lpStakingImpl,
                multiSig,
                initDataLPStaking
            )
        );
        lpStaking = LPStaking(lpStakingAddress);

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
            address(lpStaking),
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

        // Configure LPStaking
        vm.prank(founder);
        lpStaking.setTokenSaleContract(address(tokenSale));

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

        // Simulate the end of voting period (endTime = startTime + votingDelay + votingPeriod)
        vm.roll(block.number + dao.votingPeriod() + dao.votingDelay() + 1);
        vm.warp(block.timestamp + dao.votingPeriod() + dao.votingDelay() + 1);

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

    ///////////////////////////////////////
    //           Helpers                 //
    ///////////////////////////////////////

    /// @dev Creates a mint proposal and has guardian approve it. Returns the proposalId.
    function _createProposal() internal returns (uint256 proposalId) {
        delete targets;
        delete signatures;
        delete calldatas;

        targets.push(address(werewolfToken));
        signatures.push("mint(uint256)");
        calldatas.push(abi.encode(mintAmount));

        vm.prank(founder);
        werewolfToken.approve(address(dao), proposalCost);

        vm.prank(founder);
        dao.createProposal(targets, signatures, calldatas);

        proposalId = dao.proposalCount() - 1;

        vm.prank(founder);
        dao.approveProposal(proposalId);
    }

    /// @dev founder and addr1 both vote FOR the proposal.
    function _voteFor(uint256 proposalId) internal {
        vm.prank(founder);
        dao.vote(proposalId, true);
        vm.prank(addr1);
        dao.vote(proposalId, true);
    }

    /// @dev founder and addr1 both vote AGAINST the proposal.
    function _voteAgainst(uint256 proposalId) internal {
        vm.prank(founder);
        dao.vote(proposalId, false);
        vm.prank(addr1);
        dao.vote(proposalId, false);
    }

    /// @dev Advance time and block past the proposal's voting end time.
    function _advancePastVotingPeriod() internal {
        vm.roll(block.number + dao.votingPeriod() + dao.votingDelay() + 1);
        vm.warp(block.timestamp + dao.votingPeriod() + dao.votingDelay() + 1);
    }

    ///////////////////////////////////////
    //        Admin Transfer Tests       //
    ///////////////////////////////////////

    function test_timelockAdminTransfer() public {
        // After setUp + _setTimelockAdmin: DAO is timelock admin, pendingAdmin is cleared
        assertEq(timelock.admin(), address(dao), "Timelock admin should be DAO");
        assertEq(timelock.pendingAdmin(), address(0), "pendingAdmin should be cleared");
        assertEq(dao.getAdmin(), address(dao), "getAdmin() should return DAO address");

        // Founder can no longer queue transactions directly — DAO is now admin
        vm.prank(founder);
        vm.expectRevert("Timelock::queueTransaction: Call must come from admin.");
        timelock.queueTransaction(
            address(werewolfToken),
            "mint(uint256)",
            abi.encode(1 ether),
            block.timestamp + 2 days
        );
    }

    function test_ownership_transfers() public {
        assertEq(werewolfToken.owner(), address(timelock), "WerewolfToken owner should be Timelock");
        assertEq(treasury.owner(), address(timelock), "Treasury owner should be Timelock");
        assertEq(tokenSale.owner(), address(timelock), "TokenSale owner should be Timelock");
        assertEq(timelock.admin(), address(dao), "Timelock admin should be DAO");
    }

    ///////////////////////////////////////
    //     Proposal State Tests          //
    ///////////////////////////////////////

    function test_proposal_state_transitions() public {
        uint256 proposalId = _createProposal();

        // After guardian approval → Active
        assertEq(dao.getProposalState(proposalId), "Active", "Should be Active after approval");

        _voteFor(proposalId);
        _advancePastVotingPeriod();

        // Before queueProposal, stored state is still Active
        assertEq(dao.getProposalState(proposalId), "Active", "Should still be Active before queueProposal");

        dao.queueProposal(proposalId);

        // After queueProposal → Queued
        assertEq(dao.getProposalState(proposalId), "Queued", "Should be Queued after queueProposal");

        uint256 eta = dao.getEta(proposalId);
        vm.warp(eta + 1);
        vm.roll(block.number + 1);

        dao.executeProposal(proposalId);

        // After execution → Executed
        assertEq(dao.getProposalState(proposalId), "Executed", "Should be Executed after executeProposal");
    }

    function test_cannot_queue_before_voting_ends() public {
        uint256 proposalId = _createProposal();
        _voteFor(proposalId);

        // Voting period has NOT ended yet
        vm.expectRevert("DAO::queueProposal: voting period has not ended");
        dao.queueProposal(proposalId);
    }

    function test_cannot_queue_defeated_proposal() public {
        uint256 proposalId = _createProposal();
        _voteAgainst(proposalId);
        _advancePastVotingPeriod();

        // votesAgainst > votesFor → _calculateResult sets Defeated → require(Succeeded) reverts
        // The entire tx reverts so storage is rolled back and state remains Active
        vm.expectRevert("DAO::queueProposal: proposal did not succeed");
        dao.queueProposal(proposalId);

        // State is rolled back to Active (storage write from _calculateResult is reverted)
        assertEq(dao.getProposalState(proposalId), "Active", "State should remain Active after failed queue");
    }

    function test_cannot_execute_without_queuing() public {
        uint256 proposalId = _createProposal();
        _voteFor(proposalId);
        _advancePastVotingPeriod();

        // Skip queueProposal — state is Active, not Queued
        vm.expectRevert("DAO:executeProposal proposal is not queued");
        dao.executeProposal(proposalId);
    }

    function test_proposal_expired_after_grace_period() public {
        uint256 proposalId = _createProposal();
        _voteFor(proposalId);
        _advancePastVotingPeriod();
        dao.queueProposal(proposalId);

        uint256 eta = dao.getEta(proposalId);

        // Advance past grace period (14 days after eta)
        vm.warp(eta + 14 days + 1);
        vm.roll(block.number + 1);

        // DAO state is still Queued, but Timelock rejects stale tx
        vm.expectRevert("Timelock::executeTransaction: Transaction is stale.");
        dao.executeProposal(proposalId);
    }

    ///////////////////////////////////////
    //          Voting Tests             //
    ///////////////////////////////////////

    function test_weighted_voting() public {
        uint256 proposalId = _createProposal();

        // After paying proposal cost (10 WLF): founder=990e18, addr1=1000e18
        uint256 founderBalance = werewolfToken.balanceOf(founder);
        uint256 addr1Balance = werewolfToken.balanceOf(addr1);

        _voteFor(proposalId);

        // Read votes via auto-getter (arrays skipped, order: state,id,proposer,votesFor,votesAgainst,...)
        (, , , uint256 votesFor, uint256 votesAgainst, , , , , ) = dao.proposals(proposalId);

        assertEq(votesFor, founderBalance + addr1Balance, "votesFor should equal sum of token balances");
        assertEq(votesAgainst, 0, "votesAgainst should be zero");
        // Token-weighted: must be much greater than 2 (not 1-per-address)
        assertTrue(votesFor > 2, "votesFor should be token-weighted, not count-weighted");
    }

    function test_cannot_vote_twice() public {
        uint256 proposalId = _createProposal();

        vm.prank(founder);
        dao.vote(proposalId, true);

        // Second vote — same direction
        vm.prank(founder);
        vm.expectRevert("DAO:vote Already voted.");
        dao.vote(proposalId, true);

        // Second vote — opposite direction
        vm.prank(founder);
        vm.expectRevert("DAO:vote Already voted.");
        dao.vote(proposalId, false);
    }

    function test_vote_split_outcome() public {
        // Demonstrates token-weighting matters: addr1 (1000 WLF) voting against
        // defeats founder (990 WLF after proposal cost) voting for.
        uint256 proposalId = _createProposal();

        // founder votes FOR (990e18), addr1 votes AGAINST (1000e18)
        vm.prank(founder);
        dao.vote(proposalId, true);
        vm.prank(addr1);
        dao.vote(proposalId, false);

        _advancePastVotingPeriod();

        // votesAgainst (1000e18) > votesFor (990e18) → Defeated
        vm.expectRevert("DAO::queueProposal: proposal did not succeed");
        dao.queueProposal(proposalId);
    }
}
