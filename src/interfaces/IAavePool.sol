// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

/**
 * @notice Minimal Aave v3 Pool interface — only the functions used by CompanyDeFiV1.
 * @dev Full interface: https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IPool.sol
 *      referralCode is always 0 (program retired in Aave v3).
 *      interestRateMode: 1 = stable (deprecated), 2 = variable.
 */
interface IAavePool {
    /**
     * @notice Supplies an amount of underlying asset into the reserve.
     *         The underlying asset is transferred from msg.sender.
     *         Mints aTokens to onBehalfOf.
     * @param asset The address of the underlying asset
     * @param amount The amount to supply
     * @param onBehalfOf Address that will receive the aTokens
     * @param referralCode Referral code (pass 0)
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    /**
     * @notice Withdraws an amount of underlying asset from the reserve.
     *         Burns aTokens from msg.sender and sends underlying to `to`.
     * @param asset The address of the underlying asset
     * @param amount The amount to withdraw (use type(uint256).max for full balance)
     * @param to The address that receives the underlying
     * @return The final amount withdrawn
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    /**
     * @notice Allows users to borrow a specific amount using their supplied collateral.
     * @param asset The address of the underlying asset
     * @param amount The amount to borrow
     * @param interestRateMode 1 for stable (deprecated), 2 for variable
     * @param referralCode Referral code (pass 0)
     * @param onBehalfOf The address that will receive the debt tokens
     */
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external;

    /**
     * @notice Repays a borrowed amount, burning the corresponding debt tokens.
     * @param asset The address of the underlying asset
     * @param amount The amount to repay (use type(uint256).max for full debt)
     * @param interestRateMode 1 for stable (deprecated), 2 for variable
     * @param onBehalfOf The address of the user whose debt is being repaid
     * @return The final amount repaid
     */
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external returns (uint256);

    /**
     * @notice Returns the user account data across all reserves.
     * @param user The address of the user
     * @return totalCollateralBase Total collateral in base currency (8 decimals on mainnet = USD)
     * @return totalDebtBase Total debt in base currency
     * @return availableBorrowsBase Available borrows in base currency
     * @return currentLiquidationThreshold Weighted average liquidation threshold (bps, e.g. 8500 = 85%)
     * @return ltv Weighted average loan-to-value (bps)
     * @return healthFactor Current health factor (1e18 = 1.0; <1e18 = liquidatable)
     */
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
}
