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
        uint256 votes; // Total votes in favor
        bool executed; // Whether the proposal has been executed
    }
    // struct Proposal {
    //     /// @notice Unique id for looking up a proposal
    //     uint id;
    //     /// @notice Creator of the proposal
    //     address proposer;
    //     /// @notice The timestamp that the proposal will be available for execution, set once the vote succeeds
    //     uint eta;
    //     /// @notice the ordered list of target addresses for calls to be made
    //     address[] targets;
    //     /// @notice The ordered list of values (i.e. msg.value) to be passed to the calls to be made
    //     uint[] values;
    //     /// @notice The ordered list of function signatures to be called
    //     string[] signatures;
    //     /// @notice The ordered list of calldata to be passed to each call
    //     bytes[] calldatas;
    //     /// @notice The block at which voting begins: holders must delegate their votes prior to this block
    //     uint startBlock;
    //     /// @notice The block at which voting ends: votes must be cast prior to this block
    //     uint endBlock;
    //     /// @notice Current number of votes in favor of this proposal
    //     uint forVotes;
    //     /// @notice Current number of votes in opposition to this proposal
    //     uint againstVotes;
    //     /// @notice Flag marking whether the proposal has been canceled
    //     bool canceled;
    //     /// @notice Flag marking whether the proposal has been executed
    //     bool executed;
    // }

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

    event ProposalCreated(
        uint id,
        address proposer,
        address[] targets,
        uint[] values,
        string[] signatures,
        bytes[] calldatas,
        uint startBlock,
        uint endBlock,
        string description
    );

    event QueueTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint value,
        string signature,
        bytes data
    );

    constructor(address _token, address _treasury) {
        token = Token(_token);
        treasury = Treasury(_treasury);
        treasuryAddress = _treasury;
    }

    // BUG: debugging
    function callFunc(
        address _targetContract,
        string memory _functionSignature,
        bytes memory _functionParams
    ) public {
        // Encode the function signature and parameters together
        bytes memory callData = abi.encodeWithSignature(
            _functionSignature,
            _functionParams
        );
        (bool success, ) = _targetContract.call(callData);
        require(success, "Function call failed");
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

        // Compute the selector
        // bytes4 selector = bytes4(keccak256(bytes(_functionSignature)));

        // // Encode the selector with parameters
        // bytes memory callData = abi.encodeWithSelector(
        //     selector,
        //     abi.decode(_functionParams, (address, uint256))
        // );

        // This works with mint
        // bytes memory callData = abi.encodePacked(
        //     abi.encodeWithSignature(_functionSignature),
        //     _functionParams
        // );

        // This works with mint
        // bytes memory callData = abi.encodePacked(
        //     bytes4(keccak256(bytes(_functionSignature))),
        //     _functionParams
        // );

        // What I'd like to use
        bytes memory callData = abi.encodeWithSignature(
            _functionSignature,
            _functionParams
        );

        // Example encoding to call transfer function
        // bytes memory callData = abi.encodeWithSignature(
        //     "transfer(address,uint256)",
        //     to,
        //     amount
        // );

        proposals[proposalCount] = Proposal({
            proposer: msg.sender,
            targetContract: _targetContract,
            callData: callData,
            votes: 0,
            executed: false
        });
        proposalCount++;
    }

    // Function to execute a proposal
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Proposal already executed");

        // Before the function call
        require(
            proposal.targetContract != address(0),
            "Invalid target contract"
        );

        // Calculate circulating supply
        uint256 circulatingSupply = token.totalSupply() -
            token.balanceOf(address(treasury));

        // Check if votes exceed half of the circulating supply
        require(
            proposal.votes > circulatingSupply / 2,
            "Proposal must be passed to execute"
        );

        proposal.executed = true;

        // Execute the function call using low-level call
        (bool success, ) = proposal.targetContract.call(proposal.callData);
        require(success, "Function call failed");
    }

    // Voting function
    // TODO: change voting power?
    function vote(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(!voted[msg.sender][proposalId], "Already voted");
        voted[msg.sender][proposalId] = true;

        uint256 voterBalance = token.balanceOf(msg.sender);
        proposal.votes += voterBalance;
    }

    // function vote(uint256 proposalId, bool support) external {
    //     Proposal storage proposal = proposals[proposalId];
    //     require(state(proposalId) == ProposalState.Active, "Voting closed");
    //     require(
    //         !proposalReceipts[proposalId][msg.sender].hasVoted,
    //         "Already voted"
    //     );

    //     uint96 votes = token.getPriorVotes(msg.sender, proposal.startBlock);
    //     proposalReceipts[proposalId][msg.sender] = Receipt({
    //         hasVoted: true,
    //         support: support,
    //         votes: votes
    //     });

    //     if (support) {
    //         proposal.forVotes += votes;
    //     } else {
    //         proposal.againstVotes += votes;
    //     }
    // }

    function delegate(address delegatee) external {
        // Implement delegation logic efficiently
    }

    function undelegate() external {
        // Implement undelegation logic efficiently
    }

    // function executeProposal(uint proposalId) external {
    //     Proposal storage proposal = proposals[proposalId];
    //     require(
    //         state(proposalId) == ProposalState.Succeeded,
    //         "Proposal not passed"
    //     );
    //     proposal.executed = true;
    //     // Execute each call
    //     for (uint i = 0; i < proposal.targets.length; i++) {
    //         bytes memory callData;
    //         if (bytes(proposal.signatures[i]).length == 0) {
    //             callData = proposal.calldatas[i];
    //         } else {
    //             callData = abi.encodeWithSignature(
    //                 proposal.signatures[i],
    //                 proposal.calldatas[i]
    //             );
    //         }
    //         (bool success, ) = proposal.targets[i].call{
    //             value: proposal.values[i]
    //         }(callData);
    //         require(success, "DAO::executeProposal: call failed");
    //     }
    // }

    // Compound GovernorAlpha test
    // function propose(
    //     address[] memory targets,
    //     uint[] memory values,
    //     string[] memory signatures,
    //     bytes[] memory calldatas,
    //     string memory description
    // ) public returns (uint) {
    //     require(
    //         token.getPriorVotes(msg.sender, sub256(block.number, 1)) >
    //             proposalThreshold(),
    //         "DAO::propose: proposer votes below proposal threshold"
    //     );
    //     require(
    //         targets.length == values.length &&
    //             targets.length == signatures.length &&
    //             targets.length == calldatas.length,
    //         "DAO::propose: proposal function information arity mismatch"
    //     );
    //     require(targets.length != 0, "DAO::propose: must provide actions");
    //     require(
    //         targets.length <= proposalMaxOperations(),
    //         "DAO::propose: too many actions"
    //     );

    //     uint latestProposalId = latestProposalIds[msg.sender];
    //     if (latestProposalId != 0) {
    //         ProposalState proposersLatestProposalState = state(
    //             latestProposalId
    //         );
    //         require(
    //             proposersLatestProposalState != ProposalState.Active,
    //             "DAO::propose: one live proposal per proposer, found an already active proposal"
    //         );
    //         require(
    //             proposersLatestProposalState != ProposalState.Pending,
    //             "DAO::propose: one live proposal per proposer, found an already pending proposal"
    //         );
    //     }

    //     uint startBlock = add256(block.number, votingDelay());
    //     uint endBlock = add256(startBlock, votingPeriod());

    //     proposalCount++;
    //     Proposal storage newProposal = proposals[proposalCount];
    //     newProposal.id = proposalCount;
    //     newProposal.proposer = msg.sender;
    //     newProposal.eta = 0;
    //     newProposal.targets = targets;
    //     newProposal.values = values;
    //     newProposal.signatures = signatures;
    //     newProposal.calldatas = calldatas;
    //     newProposal.startBlock = startBlock;
    //     newProposal.endBlock = endBlock;
    //     newProposal.forVotes = 0;
    //     newProposal.againstVotes = 0;
    //     newProposal.canceled = false;
    //     newProposal.executed = false;

    //     latestProposalIds[newProposal.proposer] = newProposal.id;

    //     emit ProposalCreated(
    //         newProposal.id,
    //         msg.sender,
    //         targets,
    //         values,
    //         signatures,
    //         calldatas,
    //         startBlock,
    //         endBlock,
    //         description
    //     );
    //     return newProposal.id;
    // }

    // function state(uint proposalId) public view returns (ProposalState) {
    //     require(
    //         proposalCount >= proposalId && proposalId > 0,
    //         "GovernorAlpha::state: invalid proposal id"
    //     );
    //     Proposal storage proposal = proposals[proposalId];
    //     if (proposal.canceled) {
    //         return ProposalState.Canceled;
    //     } else if (block.number <= proposal.startBlock) {
    //         return ProposalState.Pending;
    //     } else if (block.number <= proposal.endBlock) {
    //         return ProposalState.Active;
    //     } else if (
    //         proposal.forVotes <= proposal.againstVotes ||
    //         proposal.forVotes < quorumVotes()
    //     ) {
    //         return ProposalState.Defeated;
    //     } else if (proposal.eta == 0) {
    //         return ProposalState.Succeeded;
    //     } else if (proposal.executed) {
    //         return ProposalState.Executed;
    //     } else if (block.timestamp >= add256(proposal.eta, GRACE_PERIOD)) {
    //         return ProposalState.Expired;
    //     } else {
    //         return ProposalState.Queued;
    //     }
    // }

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
