// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Token.sol";
import "./Treasury.sol";

contract DAO {
    Token public token;
    Treasury public treasury;

    uint public constant GRACE_PERIOD = 14 days;

    struct Proposal {
        address proposer;
        address targetContract; // Contract to call
        bytes callData; // Encoded function call with arguments
        uint256 votesFor; // Votes in favor of the proposal
        uint256 votesAgainst; // Votes against the proposal
        uint startBlock;
        uint endBlock;
        bool executed; // Whether the proposal has been executed
    }

    struct Receipt {
        /// @notice Whether or not a vote has been cast
        bool hasVoted;
        /// @notice Whether or not the voter supports the proposal
        bool support;
        /// @notice The number of votes the voter had, which were cast
        uint96 votes;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint => mapping(address => Receipt)) public proposalReceipts;
    mapping(address => mapping(uint256 => bool)) public voted; // Tracks votes by user for each proposal
    address public treasuryAddress;
    uint256 public proposalCost = 10 * (10 ** 18); // cost to create a proposal in tokens
    mapping(bytes32 => bool) public queuedTransactions;
    function proposalThreshold() public pure returns (uint) {
        return 100000e18;
    } // 100,000 = 1% of Token
    function proposalMaxOperations() public pure returns (uint) {
        return 10;
    } // 10 actions
    function votingDelay() public pure returns (uint) {
        return 1;
    } // 1 block
    function votingPeriod() public pure returns (uint) {
        return 17280;
    } // ~3 days in blocks (assuming 15s blocks)
    function quorumVotes() public pure returns (uint) {
        return 400000e18;
    } // 400,000 = 4% of Token

    mapping(address => uint) public latestProposalIds;

    /// @notice Possible states that a proposal may be in
    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }

    event ProposalCreated(uint256 proposalId, address proposer);
    event ProposalExecuted(uint256 proposalId);
    event Voted(uint256 proposalId, address voter, bool support, uint256 votes);

    constructor(address _token, address _treasury) {
        token = Token(_token);
        treasury = Treasury(_treasury);
        treasuryAddress = _treasury;
    }

    // Function to create a proposal
    function createProposal(
        address _targetContract,
        string memory _functionSignature,
        bytes memory _functionParams
    ) public {
        require(
            token.balanceOf(msg.sender) >= proposalCost,
            "Insufficient balance to create proposal"
        );

        // Transfer the proposal cost to the treasury address
        require(
            token.transferFrom(msg.sender, treasuryAddress, proposalCost),
            "Token transfer for proposal cost failed"
        );

        // Encode the function call
        bytes memory callData = abi.encodePacked(
            bytes4(keccak256(bytes(_functionSignature))),
            _functionParams
        );

        uint startBlock = add256(block.number, votingDelay());
        uint endBlock = add256(startBlock, votingPeriod());

        proposals[proposalCount] = Proposal({
            proposer: msg.sender,
            targetContract: _targetContract,
            callData: callData,
            startBlock: startBlock,
            endBlock: endBlock,
            votesFor: 0,
            votesAgainst: 0,
            executed: false
        });

        emit ProposalCreated(proposalCount, msg.sender);
        proposalCount++;
    }

    // Function to execute a proposal
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Proposal already executed");

        // Ensure the target contract is valid
        require(
            proposal.targetContract != address(0),
            "Invalid target contract"
        );

        require(
            treasury.owner() == address(this),
            "DAO is not the owner of the Treasury"
        );

        // Ensure the proposal has enough "For" votes (must be more than 50% of total votes)
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        require(
            proposal.votesFor > totalVotes / 2,
            "Proposal must have majority votes to pass"
        );

        // Mark the proposal as executed
        proposal.executed = true;

        // Execute the function call using low-level call
        (bool success, ) = proposal.targetContract.call(proposal.callData);
        require(success, "Function call failed");

        emit ProposalExecuted(proposalId);
    }

    // Voting function
    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = proposalReceipts[proposalId][msg.sender];

        require(!receipt.hasVoted, "Already voted");

        uint256 voterBalance = token.balanceOf(msg.sender);
        require(voterBalance > 0, "No tokens to vote");

        receipt.hasVoted = true;
        receipt.support = support;

        uint96 votes = token.getPriorVotes(msg.sender, proposal.startBlock);

        if (support) {
            proposal.votesFor += voterBalance;
        } else {
            proposal.votesAgainst += voterBalance;
        }
        if (support) {
            proposal.votesFor = add256(proposal.votesFor, votes);
        } else {
            proposal.votesAgainst = add256(proposal.votesAgainst, votes);
        }

        emit Voted(proposalId, msg.sender, support, voterBalance);
    }

    function delegate(address delegatee) external {
        // Implement delegation logic efficiently
    }

    function undelegate() external {
        // Implement undelegation logic efficiently
    }

    function sub256(uint256 a, uint256 b) internal pure returns (uint) {
        require(b <= a, "subtraction underflow");
        return a - b;
    }

    function add256(uint256 a, uint256 b) internal pure returns (uint) {
        uint c = a + b;
        require(c >= a, "addition overflow");
        return c;
    }
}
