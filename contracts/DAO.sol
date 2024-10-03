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
        uint256 amount; // Amount of tokens to mint
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

    // Function to propose minting tokens to Treasury
    function proposeMintToTreasury(uint256 amount) external onlyOwner {
        token.mint(amount);
    }

    // Function to propose adding allowed token to Treasury
    function proposeAddAllowedToken(address _token) external onlyOwner {
        treasury.addAllowedToken(_token);
    }

    // Create a proposal to mint new tokens
    function createProposal(uint256 amount) external {
        proposals[proposalCount] = Proposal({
            proposer: msg.sender,
            amount: amount,
            votes: 0,
            executed: false
        });
        proposalCount++;
    }

    // Vote on a proposal
    function vote(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(!voted[msg.sender][proposalId], "Already voted");
        voted[msg.sender][proposalId] = true;

        uint256 voterBalance = token.balanceOf(msg.sender);
        proposal.votes += voterBalance;
    }

    // Execute proposal to mint tokens
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(
            proposal.votes > token.totalSupply() / 2,
            "Proposal must be passed to execute"
        );

        proposal.executed = true;

        // Mint tokens to the Treasury
        token.mint(proposal.amount);
    }
}
