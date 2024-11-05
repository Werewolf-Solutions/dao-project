// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    constructor(uint256 initialSupply) ERC20("Mock USDT", "mUSDT") {
        _mint(msg.sender, initialSupply);
    }

    // Function to mint new tokens for testing purposes
    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    // Optional: Overwrite transfer function to behave like USDT, which does not always revert on failure
    function transfer(
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        bool success = super.transfer(recipient, amount);
        require(success, "MockUSDT: transfer failed");
        return success;
    }

    // Optional: Overwrite transferFrom to test approval/allowance mechanisms
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        bool success = super.transferFrom(sender, recipient, amount);
        require(success, "MockUSDT: transferFrom failed");
        return success;
    }
}
