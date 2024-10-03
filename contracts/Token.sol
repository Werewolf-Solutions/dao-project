// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, Ownable {
    address public treasury;

    constructor(
        address _treasury
    ) ERC20("DAO Token", "DAO") Ownable(msg.sender) {
        require(_treasury != address(0), "Treasury address cannot be zero");
        treasury = _treasury; // Set the Treasury address
        // Mint initial 1M tokens directly to the DAO (deployer)
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
        transferOwnership(msg.sender); // DAO is initially the owner
    }

    // Only allow DAO to mint tokens
    function mint(uint256 amount) external onlyOwner {
        _mint(treasury, amount);
    }

    // Set Treasury address (can only be called by owner)
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Treasury address cannot be zero");
        treasury = _treasury;
    }
}
