// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ILPStaking
 * @notice Interface for the LP staking contract
 */
interface ILPStaking {
    /**
     * @notice Initialize a USDT/WLF LP position from a token sale
     * @param saleId The sale identifier
     * @param tokenId The Uniswap v3 NFT token ID
     * @param wlf WLF amount in the USDT/WLF pool
     * @param usdt USDT amount in the position
     * @param totalWLFSold Total WLF sold across all payment methods in this sale
     */
    function initializeLPPosition(
        uint256 saleId,
        uint256 tokenId,
        uint256 wlf,
        uint256 usdt,
        uint256 totalWLFSold
    ) external;

    /**
     * @notice Claim LP shares after a token sale ends
     * @param user The user claiming shares
     * @param saleId The sale to claim from
     * @param purchaseAmount The amount of WLF the user purchased
     * @param fixedDuration True to lock for 5 years
     */
    function claimShares(
        address user,
        uint256 saleId,
        uint256 purchaseAmount,
        bool fixedDuration
    ) external;

    /**
     * @notice Get the value of a USDT/WLF LP position
     * @param saleId The sale ID to query
     * @return wlf WLF amount in position
     * @return usdt USDT amount in position
     */
    function getPositionValue(uint256 saleId)
        external
        view
        returns (uint256 wlf, uint256 usdt);

    /**
     * @notice Withdraw staked LP shares (5-year hard lock enforced)
     * @param shares Amount of shares to burn
     */
    function withdraw(uint256 shares) external;

    /**
     * @notice Collect trading fees from a specific LP position
     * @param saleId The sale ID whose position to collect from
     */
    function collectFees(uint256 saleId) external;

    /**
     * @notice Claim accumulated rewards
     */
    function claimRewards() external;

    /**
     * @notice Calculate current earned WLF rewards including accrual since last update
     * @param account The user address
     * @return Current claimable WLF amount
     */
    function earned(address account) external view returns (uint256);

    /**
     * @notice Calculate current APY based on staking ratio
     * @return Current APY in basis points
     */
    function calculateAPY() external view returns (uint256);

    /**
     * @notice Set the TokenSale contract address
     * @param _tokenSale The TokenSale contract address
     */
    function setTokenSaleContract(address _tokenSale) external;

    /**
     * @notice Returns the WLF amount the user has staked via LP (raw, no delegation)
     * @param user The user address
     */
    function getWLFVotingPower(address user) external view returns (uint256);

    // Events
    event LPPositionInitialized(uint256 indexed saleId, uint256 indexed tokenId, uint256 wlf, uint256 usdt);
    event SharesClaimed(address indexed user, uint256 indexed saleId, uint256 shares, bool fixedDuration);
    event SharesWithdrawn(address indexed user, uint256 shares, uint256 wlfAmount, uint256 usdtAmount);
    event FeesCollected(uint256 indexed saleId, uint256 wlf, uint256 usdt);
    event RewardsDistributed(address indexed user, uint256 amount);
    event LockedStakesUpdated(address indexed staker, uint256 amount);
}
