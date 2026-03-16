// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Mock Aave v3 Pool for unit testing CompanyDeFiV1.
 * @dev Holds tokens as if they were deposited, returns them on withdraw.
 *      Does not simulate interest accrual — use fork tests for that.
 */
contract MockAavePool {
    // user => token => supplied amount
    mapping(address => mapping(address => uint256)) public supplied;
    // user => token => borrowed amount
    mapping(address => mapping(address => uint256)) public borrowed;

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 /* referralCode */
    ) external {
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        supplied[onBehalfOf][asset] += amount;
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        uint256 bal = supplied[msg.sender][asset];
        uint256 out = amount > bal ? bal : amount;
        supplied[msg.sender][asset] -= out;
        IERC20(asset).transfer(to, out);
        return out;
    }

    function borrow(
        address asset,
        uint256 amount,
        uint256 /* interestRateMode */,
        uint16 /* referralCode */,
        address onBehalfOf
    ) external {
        borrowed[onBehalfOf][asset] += amount;
        IERC20(asset).transfer(msg.sender, amount);
    }

    function repay(
        address asset,
        uint256 amount,
        uint256 /* rateMode */,
        address onBehalfOf
    ) external returns (uint256) {
        uint256 debt = borrowed[onBehalfOf][asset];
        uint256 repaid = amount > debt ? debt : amount;
        borrowed[onBehalfOf][asset] -= repaid;
        IERC20(asset).transferFrom(msg.sender, address(this), repaid);
        return repaid;
    }

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
        )
    {
        // Sum all supplied tokens as a rough collateral proxy (ignores real Aave pricing)
        totalCollateralBase = 0;
        totalDebtBase = 0;
        availableBorrowsBase = type(uint256).max;
        currentLiquidationThreshold = 8500;
        ltv = 7500;
        healthFactor = type(uint256).max;

        // Suppress unused variable warning
        user;
    }

    /// @dev Helper for tests: seed the mock pool with tokens so withdraw works.
    function seedBalance(address token, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }
}
