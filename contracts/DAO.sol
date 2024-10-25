// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./WerewolfTokenV1.sol";
import "./Treasury.sol";
import "./Timelock.sol";

contract DAO {
    WerewolfTokenV1 public werewolfToken;
    Treasury public treasury;
    Timelock public timelock;
    address public werewolfTokenAddress;

    mapping(address => bool) public authorizedCallers;

    struct Proposal {
        address proposer;
        address[] targets; // Contract to call
        string[] signatures; // Contract to call
        bytes[] datas; // Encoded function call with arguments
        uint256 votesFor; // Votes in favor of the proposal
        uint256 votesAgainst; // Votes against the proposal
        uint startBlock;
        uint endBlock;
        bool executed; // Whether the proposal has been executed
        uint eta;
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
    } // 100,000 = 1% of WerewolfTokenV1
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
    } // 400,000 = 4% of WerewolfTokenV1

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
    event QueueTransaction(
        bytes32 indexed txHash,
        address indexed target,
        string signature,
        bytes data,
        uint eta
    );
    event Voted(uint256 proposalId, address voter, bool support, uint256 votes);

    // Modifier to ensure that only the Timelock can execute specific functions
    modifier onlyTimelock() {
        require(msg.sender == address(timelock), "Only Timelock can execute");
        _;
    }

    constructor(address _token, address _treasury, address _timelock) {
        werewolfToken = WerewolfTokenV1(_token);
        treasury = Treasury(_treasury);
        timelock = Timelock(_timelock);
        treasuryAddress = _treasury;
        werewolfTokenAddress = _token;
        // _authorizeCaller(_timelock);
    }

    // Function to authorize an external contract (like CompaniesHouseV1)
    function _authorizeCaller(address _caller) external onlyTimelock {
        authorizedCallers[_caller] = true;
    }

    // Function to deauthorize an external contract
    function _deauthorizeCaller(address _caller) external onlyTimelock {
        authorizedCallers[_caller] = false;
    }

    // Proxy function that calls payEmployee on WerewolfTokenV1
    function payEmployee(address to, uint256 amount) external {
        require(authorizedCallers[msg.sender], "Not an authorized caller");
        WerewolfTokenV1(werewolfTokenAddress).payEmployee(to, amount);
    }

    // Function to create a proposal
    function createProposal(
        address[] memory _targets,
        string[] memory _signatures,
        bytes[] memory _datas
    ) public {
        require(
            werewolfToken.balanceOf(msg.sender) >= proposalCost,
            "Insufficient balance to create proposal"
        );

        // Transfer the proposal cost to the treasury address
        require(
            werewolfToken.transferFrom(
                msg.sender,
                treasuryAddress,
                proposalCost
            ),
            "WerewolfTokenV1 transfer for proposal cost failed"
        );

        uint startBlock = add256(block.number, votingDelay());
        uint endBlock = add256(startBlock, votingPeriod());

        proposals[proposalCount] = Proposal({
            proposer: msg.sender,
            targets: _targets,
            signatures: _signatures,
            datas: _datas,
            startBlock: startBlock,
            endBlock: endBlock,
            votesFor: 0,
            votesAgainst: 0,
            executed: false,
            eta: 0
        });

        emit ProposalCreated(proposalCount, msg.sender);
        proposalCount++;
    }

    function queueProposal(uint proposalId) public {
        Proposal storage proposal = proposals[proposalId];
        uint eta = add256(block.timestamp, timelock.delay());

        for (uint i = 0; i < proposal.targets.length; i++) {
            bytes32 txHash = keccak256(
                abi.encode(
                    proposal.targets[i],
                    proposal.signatures[i],
                    proposal.datas[i]
                    //eta
                )
            );
            queuedTransactions[txHash] = true;

            emit QueueTransaction(
                txHash,
                proposal.targets[i],
                proposal.signatures[i],
                proposal.datas[i],
                eta
            );
            // _queueOrRevert(
            //     proposal.targets[i],
            //     proposal.signatures[i],
            //     proposal.datas[i],
            //     eta
            // );
        }
    }

    function _queueOrRevert(
        address target,
        string memory signature,
        bytes memory data,
        uint eta
    ) internal {
        require(
            !timelock.queuedTransactions(
                keccak256(abi.encode(target, signature, data))
            ),
            "DAO::_queueOrRevert: proposal action already queued at eta"
        );
        timelock.queueTransaction(target, signature, data, eta);
    }

    // Function to execute a proposal
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Proposal already executed");

        // Ensure the proposal has enough "For" votes (must be more than 50% of total votes)
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        require(
            proposal.votesFor > totalVotes / 2,
            "Proposal must have majority votes to pass"
        );

        // Mark the proposal as executed
        proposal.executed = true;

        for (uint i = 0; i < proposal.targets.length; i++) {
            // Ensure the target contract is valid
            require(
                proposal.targets[i] != address(0),
                "Invalid target contract"
            );

            bytes32 txHash = keccak256(
                abi.encode(
                    proposal.targets[i],
                    proposal.signatures[i],
                    proposal.datas[i]
                    //proposal.eta
                )
            );
            require(
                queuedTransactions[txHash],
                "DAO::executeTransaction: Transaction hasn't been queued."
            );
            require(
                getBlockTimestamp() >= proposal.eta,
                "DAO::executeTransaction: Transaction hasn't surpassed time lock."
            );

            queuedTransactions[txHash] = false;
            // timelock.executeTransaction(
            //     proposal.targets[i],
            //     proposal.signatures[i],
            //     proposal.datas[i],
            //     proposal.eta
            // );
            bytes memory callData = abi.encodePacked(
                bytes4(keccak256(bytes(proposal.signatures[i]))),
                proposal.datas[i]
            );
            // Execute the function call using low-level call
            (bool success, ) = proposal.targets[i].call(callData);
            require(success, "Function call failed");
            emit ProposalExecuted(proposalId);
        }
    }

    // Voting function
    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = proposalReceipts[proposalId][msg.sender];

        require(!receipt.hasVoted, "Already voted");

        uint256 voterBalance = werewolfToken.balanceOf(msg.sender);
        require(voterBalance > 0, "No tokens to vote");

        receipt.hasVoted = true;
        receipt.support = support;

        // uint96 votes = werewolfToken.getPriorVotes(msg.sender, proposal.startBlock);

        if (support) {
            proposal.votesFor += 1;
        } else {
            proposal.votesAgainst += 1;
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

    function getBlockTimestamp() internal view returns (uint) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
    }
}
