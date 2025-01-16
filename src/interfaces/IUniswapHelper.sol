// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface IUniswapHelper {
    function addLiquidity(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external returns (uint256 tokenId);
    function onERC721Received(address, address, uint256, bytes memory) external pure returns (bytes4);
    function positionManager() external view returns (address);
}
