// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, Ownable {
    address public treasury;

    struct Checkpoint {
        uint32 fromBlock;
        uint96 votes;
    }

    mapping(address => uint32) public numCheckpoints;
    mapping(address => mapping(uint32 => Checkpoint)) public checkpoints;

    constructor(
        address _treasury,
        address addr1,
        address addr2
    ) ERC20("DAO Token", "DAO") Ownable(msg.sender) {
        require(_treasury != address(0), "Treasury address cannot be zero");
        treasury = _treasury; // Set the Treasury address
        // Mint initial 1M tokens directly to the DAO's Treasury
        _mint(_treasury, 1_000_000 * 10 ** decimals());

        // Transfer tokens from the treasury to specified addresses
        // You can adjust the amount as per your requirement
        uint256 transferAmount = 1000 * 10 ** decimals();
        _transfer(treasury, addr1, transferAmount);
        _transfer(treasury, addr2, transferAmount);
    }

    // BUG: to remove before deploy
    function testMint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    // Only allow DAO to mint tokens
    function mint(uint256 amount) external onlyOwner {
        require(amount > 0, "Mint amount must be greater than zero");
        _mint(treasury, amount);
    }

    // Set Treasury address (can only be called by owner)
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Treasury address cannot be zero");
        treasury = _treasury;
    }

    function getPriorVotes(
        address account,
        uint blockNumber
    ) public view returns (uint96) {
        require(
            blockNumber < block.number,
            "Comp::getPriorVotes: not yet determined"
        );

        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }
}
