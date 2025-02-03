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
        /// @notice State of proposal
        ProposalState state; //current state of the proposal
        /// @notice Unique id for looking up a proposal
        uint256 id;
        /// @notice Creator of the proposal
        address proposer;
        /// @notice the ordered list of target addresses for calls to be made
        address[] targets;
        /// @notice The ordered list of function signatures to be called
        string[] signatures;
        /// @notice The ordered list of calldata to be passed to each call
        bytes[] datas;
        /// @notice Current number of votes in favor of this proposal
        uint256 votesFor;
        /// @notice Current number of votes in opposition to this proposal
        uint256 votesAgainst;
        /// @notice The block at which voting begins: holders must delegate their votes prior to this block
        uint256 startTime;
        /// @notice The block at which voting ends: votes must be cast prior to this block
        uint256 endTime;
        /// @notice The timestamp that the proposal will be available for execution, set once the vote succeeds
        uint eta;
        /// @notice Flag marking whether the proposal has been canceled
        bool canceled;
        /// @notice Flag marking whether the proposal has been executed
        bool executed;
    }

    struct Receipt {
        /// @notice Whether or not a vote has been cast
        bool hasVoted;
        /// @notice Whether or not the voter supports the proposal
        bool support;
        /// @notice The number of votes the voter had, which were cast
        uint96 votes;
    }

    /**
     * @notice Enum used to track the lifetime state of a proposal
     * @notice Pending the proposal has been created, but yet queued for voting
     * @notice Active the proposal was approved/queued for voting
     * @notice Canceled the proposal was canceled by the creator or DAO admin
     * @notice Defeated proposal did not receice enough votes
     * @notice Succeeded proposal was voted on and passed
     * @notice
     */
    enum ProposalState {
        DONT_USE, //avoid using the zero value of an enum
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
    address public treasuryAddress;
    Timelock public timelock;
    address public werewolfTokenAddress;
    address public guardian;
    bytes32 merkleRoot;
    uint256 minVotesRequired; //minimum votes require to enforce participation
    uint256 public proposalCount;
    uint256 public proposalCost; // cost to create a proposal in WLF tokens

    mapping(address => bool) public authorizedCallers;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => Receipt)) public proposalReceipts;
    mapping(address => mapping(uint256 => bool)) public voted; // Tracks votes by user for each proposal

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

    modifier onlyGuardian() {
        require(msg.sender == guardian, "Only guardian");
        _;
    }

    ///////////////////////////////////////
    //      Constructor/Initializer      //
    ///////////////////////////////////////
    constructor() {
        //disable the implementation contract's initializers
        _disableInitializers();
    }

    function initialize(
        address _token,
        address _treasury,
        address _timelock,
        address _guardian
    ) public initializer {
        werewolfToken = WerewolfTokenV1(_token);
        treasury = Treasury(_treasury);
        timelock = Timelock(_timelock);
        treasuryAddress = _treasury;
        werewolfTokenAddress = _token;
        guardian = _guardian;
        proposalCost = 10e18; // 10 WLF tokens
        proposalCount = 1;
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

    function updateMerkleRoot(bytes32 _root) external onlyGuardian {
        merkleRoot = _root;
    }

    // Function to deauthorize an external contract
    function deauthorizeCaller(address _caller) external onlyTimelock {
        authorizedCallers[_caller] = false;
    }

    /**
     * @notice Allows token holders, stakers, and LP's to vote on proposals
     * @param _proposalId this ID of the proposal they are voting on
     * @param _support boolean for if the voter is "for" or "against" the proposal
     */
    function vote(uint256 _proposalId, bool _support) external {
        Proposal storage proposal = proposals[_proposalId];

        // question do we need this?
        // _checkAndUpdateProposal(proposal);
        require(
            proposal.endTime >= block.timestamp,
            "DAO:vote voting period has finished"
        );

        require(
            proposal.state == ProposalState.Active,
            "DAO:vote proposal is not active"
        );

        //note it is possible for users to vote on multiple proposal
        Receipt storage receipt = proposalReceipts[_proposalId][msg.sender];
        //only allowed to vote once for the same proposal
        require(!receipt.hasVoted, "DAO:vote Already voted.");

        receipt.hasVoted = true;
        receipt.support = _support;

        uint256 _voteAmount = werewolfToken.balanceOf(msg.sender);

        if (_support) {
            proposal.votesFor += 1; //_voteAmount;
        } else {
            proposal.votesAgainst += 1; // _voteAmount;
        }

        emit Voted(_proposalId, msg.sender, _support, _voteAmount);
    }

    /**
     * @dev Using a Merkle proof to verify voting power. The root if generated off-chain
     * @notice Allows token holders, stakers, and LP's to vote on proposals
     * @param _proposalId this ID of the proposal being executed
     */
    function executeProposal(uint256 _proposalId) external {
        //@dev need to have a min execution requirement

        Proposal storage proposal = proposals[_proposalId];
        //check the status of the proposal and update it if needed
        // _checkAndUpdateProposal(proposal);
        require(
            proposal.state != ProposalState.Executed,
            "DAO:executeProposal Proposal already executed"
        );
        // require(
        //     proposal.state == ProposalState.Succeeded,
        //     "DAO:executeProposal proposal defeated"
        // ); //question maybe just check it is on the succeeded state?

        // Ensure the proposal has enough "For" votes (must be more than 50% of total votes)
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        require(
            proposal.votesFor > (totalVotes * quorumVotes()) / 1e18, //1e18 since the precision of the totalVotes and quorumVotes is 1e18
            "DAO:executeProposal min quorum votes not reached"
        );

        // Mark the proposal as executed
        proposal.state = ProposalState.Executed;

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            timelock.executeTransaction(
                proposal.targets[i],
                proposal.signatures[i],
                proposal.datas[i],
                proposal.eta
            );
            emit ProposalExecuted(_proposalId);
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

    // todo remove after testing
    function getEta(uint256 _proposalId) public view returns (uint256 eta) {
        Proposal storage proposal = proposals[_proposalId];
        return proposal.eta;
    }

    // Function to create a proposal
    function createProposal(
        address[] memory _targets,
        string[] memory _signatures,
        bytes[] memory _datas
    ) public {
        // Check if msg.sender has enough tokens to pay proposalCost
        require(
            werewolfToken.balanceOf(msg.sender) >= proposalCost,
            "DAO::createProposal: Insufficient balance to create proposal"
        );
        // Transfer the proposal cost to the treasury address
        require(
            werewolfToken.transferFrom(
                msg.sender,
                treasuryAddress,
                proposalCost
            ),
            "DAO::createProposal: WerewolfTokenV1 transfer for proposal cost failed"
        );

        //question not sure what this code is...
        // require(
        //     werewolfToken.getPriorVotes(msg.sender, sub256(block.number, 1)) >
        //         ((werewolfToken.getPriorVotes(
        //             msg.sender,
        //             sub256(block.number, 1)
        //         ) * proposalThreshold()) / 100),
        //     "DAO::createProposal: proposer votes below proposal threshold"
        // );

        /*
         * Requiring the proposal creator to hold a balance of werewolf tokens greater than 0.5% of the total balance within
         * the treasury. For example, the treasury hold 1000 tokens, then the proposal creator
         * must hold more than 5 tokens (ignoring decimals).
         */
        // require(
        //     werewolfToken.balanceOf(msg.sender)
        //         > ((werewolfToken.balanceOf(address(treasury)) * proposalThreshold()) / 1e18),
        //     "DAO:createProposal proposer votes below proposal threshold"
        // );

        require(
            _targets.length == _signatures.length &&
                _targets.length == _datas.length,
            "DAO:createProposal proposal function information arity mismatch"
        );
        require(
            _targets.length != 0,
            "DAO:createProposal must provide actions"
        );
        require(
            _targets.length <= proposalMaxOperations(),
            "DAO:createProposal too many actions"
        );

        uint256 startTime = (block.timestamp + votingDelay());
        uint256 endTime = (startTime + votingPeriod());

        proposals[proposalCount] = Proposal({
            state: ProposalState.Pending,
            id: proposalCount,
            proposer: msg.sender,
            targets: _targets,
            signatures: _signatures,
            datas: _datas,
            votesFor: 0,
            votesAgainst: 0,
            startTime: startTime,
            endTime: endTime,
            eta: 0,
            canceled: false,
            executed: false
        });

        emit ProposalCreated(proposalCount, msg.sender);
        proposalCount++;
    }

    function approveProposal(uint256 _proposalId) public onlyGuardian {
        Proposal storage s_proposal = proposals[_proposalId];
        require(s_proposal.state == ProposalState.Pending);
        s_proposal.state = ProposalState.Active;
        //set the proposal deadlines
        // s_proposal.startTime = block.timestamp;
        // s_proposal.endTime = block.timestamp + votingPeriod();
    }

    // todo remove after testing
    function getTargets(
        uint256 _proposalId
    ) public view returns (uint256 targets) {
        Proposal storage proposal = proposals[_proposalId];
        // return proposal.targets;
        return timelock.delay();
    }

    function queueProposal(uint256 _proposalId) public {
        Proposal storage proposal = proposals[_proposalId];
        uint256 eta = block.timestamp + timelock.delay();
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            _queueOrRevert(
                proposal.targets[i],
                proposal.signatures[i],
                proposal.datas[i],
                eta
            );
        }
        proposal.eta = eta;
        proposal.state = ProposalState.Queued;
        emit ProposalQueued(_proposalId, eta);
    }

    function __acceptAdmin() public {
        require(
            msg.sender == guardian,
            "GovernorAlpha::__acceptAdmin: sender must be gov guardian"
        );
        timelock.acceptAdmin();
    }
    ///////////////////////////////////////
    //   Public View/Pure Functions      //
    ///////////////////////////////////////

    function votingDelay() public pure returns (uint) {
        return 1;
    } // 1 block

    function proposalMaxOperations() public pure returns (uint256) {
        return 10;
    } // 10 actions

    function votingPeriod() public pure returns (uint256) {
        return 3 days;
    }

    function quorumVotes() public pure returns (uint256) {
        return (50 * 10 ** 18) / 100; // 50% represented with a factor of 10**18 for precision
    }

    function proposalThreshold() public pure returns (uint256) {
        return (5 * 10 ** 18) / 1000; // 0.5% represented with a factor of 10**18
    }

    function getProposalState(
        uint256 _proposalId
    ) public view returns (string memory status) {
        Proposal storage proposal = proposals[_proposalId];

        // Convert enum to a string
        if (proposal.state == ProposalState.Pending) return "Pending";
        if (proposal.state == ProposalState.Active) return "Active";
        if (proposal.state == ProposalState.Canceled) return "Canceled";
        if (proposal.state == ProposalState.Defeated) return "Defeated";
        if (proposal.state == ProposalState.Succeeded) return "Succeeded";
        if (proposal.state == ProposalState.Queued) return "Queued";
        if (proposal.state == ProposalState.Expired) return "Expired";
        if (proposal.state == ProposalState.Executed) return "Executed";

        return "Unknown"; // Fallback case (should never be hit)
    }

    ///////////////////////////////////////
    //         Internal Functions        //
    ///////////////////////////////////////
    function _queueOrRevert(
        address target,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) internal {
        require(
            !timelock.queuedTransactions(
                keccak256(abi.encode(target, signature, data))
            ),
            "DAO::_queueOrRevert: proposal action already queued at eta"
        );
        timelock.queueTransaction(target, signature, data, eta);
    }

    function _checkAndUpdateProposal(Proposal storage s_proposalPtr) internal {
        if (
            s_proposalPtr.startTime >= block.timestamp &&
            s_proposalPtr.endTime <= block.timestamp
        ) {
            s_proposalPtr.state = ProposalState.Active;
        } else if (s_proposalPtr.startTime < block.timestamp) {
            revert("DAO:_checkAndUpdateProposal proposal not started");
        } else if (s_proposalPtr.endTime < block.timestamp) {
            _calculateResult(s_proposalPtr);
        }
    }

    function _calculateResult(Proposal storage s_proposalPtr) internal {
        uint256 totalVotes = s_proposalPtr.votesAgainst +
            s_proposalPtr.votesFor;
        if (totalVotes < minVotesRequired) {
            s_proposalPtr.state = ProposalState.Canceled;
        } else if (s_proposalPtr.votesAgainst >= s_proposalPtr.votesFor) {
            s_proposalPtr.state = ProposalState.Defeated;
        } else {
            s_proposalPtr.state = ProposalState.Succeeded;
        }
    }
}
