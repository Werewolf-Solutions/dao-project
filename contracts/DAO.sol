// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Token.sol";
import "./Treasury.sol";

contract DAO is Ownable {
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

    constructor(address _token, address _treasury) Ownable(msg.sender) {
        token = Token(_token);
        treasury = Treasury(_treasury);
    }

    // Function to create a generalized proposal
    function createProposal(
        address _targetContract,
        string memory _functionSignature,
        bytes memory _functionParams
    ) public onlyOwner {
        // Encode the function call data
        bytes memory callData = abi.encodeWithSignature(
            _functionSignature,
            _functionParams
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
        require(
            proposal.votes > token.totalSupply() / 2,
            "Proposal must be passed to execute"
        );

        proposal.executed = true;

        // Execute the function call using low-level call
        (bool success, ) = proposal.targetContract.call(proposal.callData);
        require(success, "Function call failed");
    }

    // Helper function to create specific proposals for minting tokens
    function proposeMintToTreasury(uint256 amount) external {
        createProposal(
            address(token),
            "mint(address,uint256)",
            abi.encode(address(treasury), amount)
        );
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
