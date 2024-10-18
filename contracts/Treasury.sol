// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./Token.sol";

contract Treasury is Ownable {
    // address public token;
    Token private token;

    // Mapping to track allowed tokens (token address => allowed)
    mapping(address => bool) public allowedTokens;

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Token address cannot be zero");
        // token = _token;
        token = Token(_token);
        allowedTokens[_token] = true; // Set initial token as allowed
    }

    // Function to add allowed tokens, can only be called by the DAO
    function addAllowedToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        allowedTokens[_token] = true;
    }

    // Function to check if a token is allowed by the DAO
    function isTokenAllowed(address _token) external view returns (bool) {
        return allowedTokens[_token];
    }
}
