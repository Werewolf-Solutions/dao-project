// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @dev Mock Uniswap V3 SwapRouter for testing CompaniesHouseV1.
 *
 * Swaps tokenIn → tokenOut at a fixed wlfPrice (same format as TokenSale.price():
 * USDT per WLF scaled by 1e18, so 0.0004 USDT/WLF is stored as 4e14).
 *
 * amountOut (WLF, 18 dec) = amountIn (USDT, 6 dec) * 1e30 / wlfPrice
 *
 * Must hold enough tokenOut (WLF) before any swap call.
 */
contract MockSwapRouter {
    uint256 public wlfPrice; // USDT per WLF × 1e18 (same as TokenSale.price())

    constructor(uint256 _wlfPrice) {
        wlfPrice = _wlfPrice;
    }

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        returns (uint256 amountOut)
    {
        // Pull tokenIn (USDT) from the caller
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);

        // Convert USDT (6 dec) → WLF (18 dec) at wlfPrice
        amountOut = (params.amountIn * 10 ** 30) / wlfPrice;

        require(amountOut >= params.amountOutMinimum, "MockSwapRouter: slippage exceeded");
        require(
            IERC20(params.tokenOut).balanceOf(address(this)) >= amountOut,
            "MockSwapRouter: insufficient WLF liquidity"
        );

        IERC20(params.tokenOut).transfer(params.recipient, amountOut);
    }
}
