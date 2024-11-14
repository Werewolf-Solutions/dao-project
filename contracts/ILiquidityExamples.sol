// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ILiquidityExamples {
    function mintNewPosition()
        external
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );
    function _addLiquidity()
        external
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );
}
