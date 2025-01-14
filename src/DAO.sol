// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./WerewolfTokenV1.sol";
import "./Treasury.sol";
import "./Timelock.sol";

//For merkle proofs
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/* Contract layout:
 Data types: structs, enums, and type declarations
 State Variables
 Events
 Function Modifiers
 Constructor/Initialize
 Fallback and Receive function
 External functions
 Public functions
 Internal functions
 Private Functions
*/
contract DAO is Initializable {
    ///////////////////////////////////////
    //           Data Types              //
    ///////////////////////////////////////
    struct Proposal {
        bool executed; // Whether the proposal has been executed
        address proposer;
        address[] targets; // Contract to call
        string[] signatures; // Contract to call
        bytes[] datas; // Encoded function call with arguments
        uint256 votesFor; // Votes in favor of the proposal
        uint256 votesAgainst; // Votes against the proposal
        uint256 startBlock;
        uint256 endBlock;
        uint256 eta;
    }

    struct Receipt {
        /// @notice Whether or not a vote has been cast
        bool hasVoted;
        /// @notice Whether or not the voter supports the proposal
        bool support;
        /// @notice The number of votes the voter had, which were cast
        uint96 votes;
    }

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

    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////

    WerewolfTokenV1 public werewolfToken;
    Treasury public treasury;
    Timelock public timelock;
    address public werewolfTokenAddress;
    bytes32 merkleRoot;

    address public guardian;

    mapping(address => bool) public authorizedCallers;

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => Receipt)) public proposalReceipts;
    mapping(address => mapping(uint256 => bool)) public voted; // Tracks votes by user for each proposal
    address public treasuryAddress;
    uint256 public proposalCost = 10e18; // cost to create a proposal in tokens
    mapping(bytes32 => bool) public queuedTransactions;
    mapping(address => uint256) public latestProposalIds;

    ///////////////////////////////////////
    //           Events                  //
    ///////////////////////////////////////

    event ProposalCreated(uint256 proposalId, address proposer);
    event ProposalQueued(uint256 id, uint256 eta);
    event ProposalExecuted(uint256 proposalId);
    event Voted(uint256 proposalId, address voter, bool support, uint256 votes);
    ///////////////////////////////////////
    //           Modifiers               //
    ///////////////////////////////////////
    // Modifier to ensure that only the Timelock can execute specific functions

    modifier onlyTimelock() {
        require(msg.sender == address(timelock), "Only Timelock can execute");
        _;
    }

    ///////////////////////////////////////
    //      Constructor/Initializer      //
    ///////////////////////////////////////
    constructor() {
        //disable the implementation contract's initializers
        _disableInitializers();
    }

    function initialize(address _token, address _treasury, address _timelock, address _gaurdian) public initializer {
        werewolfToken = WerewolfTokenV1(_token);
        treasury = Treasury(_treasury);
        timelock = Timelock(_timelock);
        treasuryAddress = _treasury;
        werewolfTokenAddress = _token;
        guardian = _gaurdian; //guardian cannot be the msg.sender since is will be the proxyAdmin
            //guardian = msg.sender;
            // _authorizeCaller(_timelock);
    }

    ///////////////////////////////////////
    //           External Functions      //
    ///////////////////////////////////////

    // Function to authorize an external contract (like CompaniesHouseV1)
    function authorizeCaller(address _caller) external onlyTimelock {
        authorizedCallers[_caller] = true;
    }

    function updateMerkleRoot(bytes32 _root) external /* onlyAdmin */ {
        merkleRoot = _root;
    }

    // Function to deauthorize an external contract
    function deauthorizeCaller(address _caller) external onlyTimelock {
        authorizedCallers[_caller] = false;
    }

    /**
     * @dev currently taking a snapshot and submitting a merkle root
     * @notice Allows token holders, stakers, and LP's to vote on proposals
     * @param _proposalId this ID of the porposal they are voting on
     * @param _voteAmount this is the weight of the voter which is also equal to the "balance" at the time of the snapshot
     * @param _support boolean for if the voter is "for" or "against" the proposal
     * @param _proof this is the proof for the merkle tree, which can be retrieved from the front-end
     */
    function vote(uint256 _proposalId, uint256 _voteAmount, bool _support, bytes32[] calldata _proof) external {
        bytes32 leaf = keccak256(abi.encode(msg.sender, _voteAmount));
        require(MerkleProof.verifyCalldata(_proof, merkleRoot, leaf), "DAO:vote merkle proof failed");

        Proposal storage proposal = proposals[_proposalId];
        //note it is possible for users to vote on multiple proposal which is desired
        Receipt storage receipt = proposalReceipts[_proposalId][msg.sender];
        //only allowed to vote once for the same proposal
        require(!receipt.hasVoted, "Already voted.");

        receipt.hasVoted = true;
        receipt.support = _support;

        if (_support) {
            proposal.votesFor += _voteAmount;
        } else {
            proposal.votesAgainst += _voteAmount;
        }

        emit Voted(_proposalId, msg.sender, _support, _voteAmount);
    }

    // Function to execute a proposal
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "DAO::executeProposal: Proposal already executed");

        // Ensure the proposal has enough "For" votes (must be more than 50% of total votes)
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        require(
            proposal.votesFor > totalVotes * quorumVotes(),
            "DAO::executeProposal: Proposal must reach minimum quorum votes to pass."
        );

        // Mark the proposal as executed
        proposal.executed = true;

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            timelock.executeTransaction(proposal.targets[i], proposal.signatures[i], proposal.datas[i], proposal.eta);
            emit ProposalExecuted(proposalId);
        }
    }

    function delegate(address delegatee) external {
        // Implement delegation logic efficiently
    }

    function undelegate() external {
        // Implement undelegation logic efficiently
    }

    ///////////////////////////////////////
    //           Public Functions        //
    ///////////////////////////////////////

    // Function to create a proposal
    function createProposal(address[] memory _targets, string[] memory _signatures, bytes[] memory _datas) public {
        require(
            werewolfToken.balanceOf(msg.sender) >= proposalCost,
            "DAO::createProposal: Insufficient balance to create proposal"
        );

        // Transfer the proposal cost to the treasury address
        require(
            werewolfToken.transferFrom(msg.sender, treasuryAddress, proposalCost),
            "DAO::createProposal: WerewolfTokenV1 transfer for proposal cost failed"
        );

        // require(
        //     werewolfToken.getPriorVotes(msg.sender, sub256(block.number, 1)) >
        //         ((werewolfToken.getPriorVotes(
        //             msg.sender,
        //             sub256(block.number, 1)
        //         ) * proposalThreshold()) / 100),
        //     "DAO::createProposal: proposer votes below proposal threshold"
        // );

        require(
            werewolfToken.balanceOf(msg.sender) > (werewolfToken.balanceOf(address(treasury)) * proposalThreshold()),
            "DAO::createProposal: proposer votes below proposal threshold"
        );

        require(
            _targets.length == _signatures.length && _targets.length == _datas.length,
            "DAO::createProposal: proposal function information arity mismatch"
        );
        require(_targets.length != 0, "DAO::createProposal: must provide actions");
        require(_targets.length <= proposalMaxOperations(), "DAO::createProposal: too many actions");

        uint256 startBlock = (block.number + votingDelay());
        uint256 endBlock = (startBlock + votingPeriod());

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

    function queueProposal(uint256 proposalId) public {
        Proposal storage proposal = proposals[proposalId];
        uint256 eta = block.timestamp + timelock.delay();
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            _queueOrRevert(proposal.targets[i], proposal.signatures[i], proposal.datas[i], eta);
        }
        proposal.eta = eta;
        emit ProposalQueued(proposalId, eta);
    }

    function __acceptAdmin() public {
        require(msg.sender == guardian, "GovernorAlpha::__acceptAdmin: sender must be gov guardian");
        timelock.acceptAdmin();
    }
    ///////////////////////////////////////
    //   Public View/Pure Functions      //
    ///////////////////////////////////////

    function proposalMaxOperations() public pure returns (uint256) {
        return 10;
    } // 10 actions

    function votingDelay() public pure returns (uint256) {
        return 1;
    } // 1 block

    function votingPeriod() public pure returns (uint256) {
        return 17280;
    } // ~3 days in blocks (assuming 15s blocks)

    function quorumVotes() public pure returns (uint256) {
        return (50 * 10 ** 18) / 100; // 50% represented with a factor of 10**18 for precision
    }

    function proposalThreshold() public pure returns (uint256) {
        return (5 * 10 ** 18) / 1000; // 0.5% represented with a factor of 10**18
    }

    ///////////////////////////////////////
    //         Internal Functions        //
    ///////////////////////////////////////

    /*     function _calculateVotingPower(address _voter) internal returns (uint256) {
        uint256 totalSupply = werewolfToken.balanceOf(address(treasury));
        uint256 balance = werewolfToken.balanceOf(_voter);
        uint256 holdingPercentage = (balance * 100) / totalSupply;

        // Apply voting weight formula based on holding percentage
        if (holdingPercentage <= 10) {
            return (balance * 19) / 10; // 1.9x weight for bottom 10%
        } else if (holdingPercentage <= 20) {
            return (balance * 18) / 10; // 1.8x weight for bottom 20%
        } else if (holdingPercentage <= 70) {
            return (balance * 7) / 10; // 0.7x weight for top 70%
        } else if (holdingPercentage <= 80) {
            return (balance * 6) / 10; // 0.6x weight for top 80%
        } else {
            return balance; // Normal voting power for others
        }
    } */

    function _queueOrRevert(address target, string memory signature, bytes memory data, uint256 eta) internal {
        require(
            !timelock.queuedTransactions(keccak256(abi.encode(target, signature, data))),
            "DAO::_queueOrRevert: proposal action already queued at eta"
        );
        timelock.queueTransaction(target, signature, data, eta);
    }

    function getBlockTimestamp() internal view returns (uint256) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
    }
}
