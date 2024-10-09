// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Token.sol";
import "./Treasury.sol";

contract DAO {
    Token public token;
    Treasury public treasury;

    struct Proposal {
        address proposer;
        address targetContract; // Contract to call
        bytes callData; // Encoded function call with arguments
        uint256 votes; // Total votes in favor
        bool executed; // Whether the proposal has been executed
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(address => mapping(uint256 => bool)) public voted; // Tracks votes by user for each proposal
    address public treasuryAddress;
    uint256 public proposalCost = 10 * (10 ** 18); // cost to create a proposal in tokens

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

        // Encode the function call data with the function signature and parameters directly
        bytes memory callData = abi.encodeWithSignature(
            _functionSignature,
            abi.decode(_functionParams, (uint256)) // Decode and re-encode to match the signature
        );

        proposals[proposalCount] = Proposal({
            proposer: msg.sender,
            targetContract: _targetContract,
            callData: callData,
            votes: 0,
            executed: false
        });
        proposalCount++;
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

    // Function to execute a proposal
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Proposal already executed");

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

    // Helper function to propose adding allowed token in Treasury
    function proposeAddAllowedToken(address _token) external {
        createProposal(
            address(treasury),
            "addAllowedToken(address)",
            abi.encode(_token)
        );
    }

    // Helper function to propose setting a new Treasury in the Token contract
    function proposeSetTreasury(address newTreasury) external {
        createProposal(
            address(token),
            "setTreasury(address)",
            abi.encode(newTreasury)
        );
    }

    // Example for token sale function call
    function proposeStartTokenSale(uint256 amount, uint256 price) external {
        createProposal(
            address(token), // Assuming token sale is part of token
            "startSale(uint256,uint256)",
            abi.encode(amount, price)
        );
    }

    function delegate(address delegatee) external {
        // Implement delegation logic efficiently
    }

    function undelegate() external {
        // Implement undelegation logic efficiently
    }
}
