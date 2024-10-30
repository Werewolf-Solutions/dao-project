// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./WerewolfTokenV1.sol";

contract Treasury is Ownable {
    // address public werewolfToken;
    WerewolfTokenV1 private werewolfToken;

    // Percentage threshold, e.g., 20 for 20%
    uint256 public thresholdPercentage = 20;

    // Mapping to track allowed tokens (werewolfToken address => allowed)
    mapping(address => bool) public allowedTokens;

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "WerewolfTokenV1 address cannot be zero");
        // werewolfToken = _token;
        werewolfToken = WerewolfTokenV1(_token);
        allowedTokens[_token] = true; // Set initial werewolfToken as allowed
    }

    // Function to add allowed tokens, can only be called by the DAO
    function addAllowedToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid werewolfToken address");
        allowedTokens[_token] = true;
    }

    // Function to check if a werewolfToken is allowed by the DAO
    function isTokenAllowed(address _token) external view returns (bool) {
        return allowedTokens[_token];
    }

    // Set the percentage threshold (only by owner)
    function setThresholdPercentage(uint256 _percentage) public onlyOwner {
        require(_percentage <= 100, "Percentage cannot exceed 100");
        thresholdPercentage = _percentage;
    }

    // Check if the treasury balance is above the threshold
    function isAboveThreshold() public view returns (bool) {
        uint256 treasuryBalance = werewolfToken.balanceOf(address(this));
        uint256 threshold = (treasuryBalance * thresholdPercentage) / 100;
        return treasuryBalance > threshold;
    }
}
