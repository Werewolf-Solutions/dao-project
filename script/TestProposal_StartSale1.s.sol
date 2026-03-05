// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {DAO} from "../src/DAO.sol";
import {WerewolfTokenV1} from "../src/WerewolfTokenV1.sol";

/**
 * @notice Multi-step script to create, approve, queue, and execute a DAO proposal
 *         that starts Token Sale #1 (public sale at 0.001 USDT/WLF, 5M WLF).
 *
 * Usage — set env vars then run with STEP=<step>:
 *
 *   export DAO_ADDRESS=0x...          (from script/output/deployed-addresses.txt)
 *   export WEREWOLF_TOKEN_ADDRESS=0x...
 *   export TOKEN_SALE_ADDRESS=0x...
 *   export PROPOSAL_ID=1              (only needed for approve/queue/execute)
 *
 *   STEP=create  make propose-sepolia        # submit the proposal
 *   STEP=approve make approve-proposal-sepolia # guardian approves → Active
 *   # wait votingPeriod (1 hour on testnet) then:
 *   STEP=queue   make queue-proposal-sepolia  # queue for execution
 *   STEP=execute make execute-proposal-sepolia # execute (delay=0 → immediate)
 *
 * Proposal actions:
 *   1. werewolfToken.airdrop(tokenSale, 5_000_000 WLF)   — sends tokens from Treasury
 *   2. tokenSale.startSale(5_000_000 WLF, 0.001 USDT)   — opens the public sale
 */
contract TestProposalStartSale1 is Script {
    uint256 constant SALE_AMOUNT = 100_000_000 ether;
    uint256 constant SALE_PRICE  = 0.01 ether;    // in USDT units (6 dec on mainnet, 18 dec on testnet)

    function run() external {
        string memory step = vm.envOr("STEP", string("create"));

        address daoAddr   = vm.envAddress("DAO_ADDRESS");
        address wlfAddr   = vm.envAddress("WEREWOLF_TOKEN_ADDRESS");
        address saleAddr  = vm.envAddress("TOKEN_SALE_ADDRESS");

        DAO dao                   = DAO(daoAddr);
        WerewolfTokenV1 wlf       = WerewolfTokenV1(wlfAddr);

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address sender = vm.addr(pk);

        if (_eq(step, "create")) {
            _create(dao, wlf, saleAddr, wlfAddr, pk, sender);
        } else if (_eq(step, "approve")) {
            uint256 proposalId = vm.envUint("PROPOSAL_ID");
            _approve(dao, proposalId, pk);
        } else if (_eq(step, "queue")) {
            uint256 proposalId = vm.envUint("PROPOSAL_ID");
            _queue(dao, proposalId, pk);
        } else if (_eq(step, "execute")) {
            uint256 proposalId = vm.envUint("PROPOSAL_ID");
            _execute(dao, proposalId, pk);
        } else if (_eq(step, "vote")) {
            uint256 proposalId = vm.envUint("PROPOSAL_ID");
            _vote(dao, proposalId, pk);
        } else {
            revert(string.concat("Unknown STEP: ", step));
        }
    }

    // ── Step 1: Create ───────────────────────────────────────────────────────

    function _create(
        DAO dao,
        WerewolfTokenV1 wlf,
        address saleAddr,
        address wlfAddr,
        uint256 pk,
        address sender
    ) internal {
        uint256 proposalCost = dao.proposalCost();

        console.log("=== Create Proposal: Start Sale #1 ===");
        console.log("Sender:        ", sender);
        console.log("WLF balance:   ", wlf.balanceOf(sender) / 1e18, "WLF");
        console.log("Proposal cost: ", proposalCost / 1e18, "WLF");
        console.log("Allowance:     ", wlf.allowance(sender, address(dao)) / 1e18, "WLF");

        // Build proposal payload
        address[] memory targets    = new address[](2);
        string[]  memory signatures = new string[](2);
        bytes[]   memory datas      = new bytes[](2);

        // Action 1: airdrop 5M WLF to TokenSale (WerewolfToken.airdrop is onlyOwner = Timelock)
        targets[0]    = wlfAddr;
        signatures[0] = "airdrop(address,uint256)";
        datas[0]      = abi.encode(saleAddr, SALE_AMOUNT);

        // Action 2: start sale #1 (TokenSale.startSale is onlyOwner = Timelock)
        targets[1]    = saleAddr;
        signatures[1] = "startSale(uint256,uint256)";
        datas[1]      = abi.encode(SALE_AMOUNT, SALE_PRICE);

        vm.startBroadcast(pk);

        // Approve proposal cost
        wlf.approve(address(dao), proposalCost);

        uint256 proposalId = dao.proposalCount();
        dao.createProposal(targets, signatures, datas);

        vm.stopBroadcast();

        console.log("Proposal created. ID:", proposalId);
        console.log("Next: STEP=approve PROPOSAL_ID=", proposalId);
    }

    // ── Step 2: Approve (guardian only) ─────────────────────────────────────

    function _approve(DAO dao, uint256 proposalId, uint256 pk) internal {
        console.log("=== Approve Proposal", proposalId, "===");
        vm.startBroadcast(pk);
        dao.approveProposal(proposalId);
        vm.stopBroadcast();
        console.log("Proposal approved -> Active.");
        console.log("Next: wait votingPeriod (1 hour), then STEP=queue PROPOSAL_ID=", proposalId);
    }

    // ── Step 2b: Vote (anyone with WLF) ─────────────────────────────────────

    function _vote(DAO dao, uint256 proposalId, uint256 pk) internal {
        console.log("=== Vote FOR Proposal", proposalId, "===");
        vm.startBroadcast(pk);
        dao.vote(proposalId, true);
        vm.stopBroadcast();
        console.log("Voted FOR.");
    }

    // ── Step 3: Queue (after votingPeriod ends) ──────────────────────────────

    function _queue(DAO dao, uint256 proposalId, uint256 pk) internal {
        console.log("=== Queue Proposal", proposalId, "===");
        vm.startBroadcast(pk);
        dao.queueProposal(proposalId);
        vm.stopBroadcast();
        uint256 eta = dao.getEta(proposalId);
        console.log("Proposal queued. ETA:", eta);
        console.log("Next: STEP=execute PROPOSAL_ID=", proposalId, "(delay=0, execute now)");
    }

    // ── Step 4: Execute (after eta) ──────────────────────────────────────────

    function _execute(DAO dao, uint256 proposalId, uint256 pk) internal {
        console.log("=== Execute Proposal", proposalId, "===");
        vm.startBroadcast(pk);
        dao.executeProposal(proposalId);
        vm.stopBroadcast();
        console.log("Proposal executed. Sale #1 should now be active.");
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    function _eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
