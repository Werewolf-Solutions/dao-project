// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenSale {
    ERC20 public token;
    address public treasury; // Address of the Treasury contract
    uint256 public price;

    constructor(address _token, address _treasury, uint256 _price) {
        token = ERC20(_token);
        treasury = _treasury; // Set Treasury as the recipient
        price = _price;
    }

    function buyTokens(uint256 amount) external payable {
        require(msg.value == amount * price, "Incorrect amount of ETH");

        uint256 tokenAmount = amount * 10 ** token.decimals();
        token.transfer(msg.sender, tokenAmount);

        payable(treasury).transfer(msg.value); // Send ETH to Treasury
    }
}
