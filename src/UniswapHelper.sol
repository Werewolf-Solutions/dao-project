// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

contract UniswapHelper is IERC721Receiver {
    INonfungiblePositionManager public positionManager;

    constructor(address _positionManager) {
        positionManager = INonfungiblePositionManager(_positionManager);
    }

    function addLiquidity(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint16 slippageBps  // e.g. 100 = 1%, 200 = 2%
    ) external returns (uint256 tokenId) {
        // Pull tokens from caller (TokenSale approved us)
        IERC20(token0).transferFrom(msg.sender, address(this), amount0Desired);
        IERC20(token1).transferFrom(msg.sender, address(this), amount1Desired);

        // Delegate to internal helper to avoid stack-too-deep
        tokenId = _sortInitAndMint(token0, token1, fee, tickLower, tickUpper, amount0Desired, amount1Desired, slippageBps);
    }

    /// @dev Sorts tokens for Uniswap v3, initializes pool if needed, mints position,
    ///      then returns any unused tokens to msg.sender.
    function _sortInitAndMint(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint16 slippageBps
    ) private returns (uint256 tokenId) {
        // Uniswap v3 requires token0 < token1 by address
        (address t0, address t1, uint256 a0, uint256 a1) = token0 < token1
            ? (token0, token1, amount0Desired, amount1Desired)
            : (token1, token0, amount1Desired, amount0Desired);

        // Initialize pool if it doesn't exist: sqrtPriceX96 = sqrt(a1/a0) * 2^96
        positionManager.createAndInitializePoolIfNecessary(t0, t1, fee, _sqrtPriceX96(a0, a1));

        // Approve positionManager and mint
        IERC20(t0).approve(address(positionManager), a0);
        IERC20(t1).approve(address(positionManager), a1);

        (tokenId,,,) = positionManager.mint(INonfungiblePositionManager.MintParams({
            token0: t0,
            token1: t1,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: a0,
            amount1Desired: a1,
            amount0Min: (a0 * (10_000 - slippageBps)) / 10_000,
            amount1Min: (a1 * (10_000 - slippageBps)) / 10_000,
            recipient: msg.sender,
            deadline: block.timestamp + 20 minutes
        }));

        // Return any unused tokens to caller
        _returnExcess(t0, t1);
    }

    /// @dev Returns any leftover token balances held by this contract to msg.sender.
    function _returnExcess(address t0, address t1) private {
        uint256 left0 = IERC20(t0).balanceOf(address(this));
        uint256 left1 = IERC20(t1).balanceOf(address(this));
        if (left0 > 0) IERC20(t0).transfer(msg.sender, left0);
        if (left1 > 0) IERC20(t1).transfer(msg.sender, left1);
    }

    /// @dev sqrtPriceX96 = sqrt(a1 / a0) * 2^96, computed via integer sqrt.
    function _sqrtPriceX96(uint256 a0, uint256 a1) private pure returns (uint160) {
        if (a0 == 0) return uint160(1 << 96);
        return uint160((_sqrt(a1) << 96) / _sqrt(a0));
    }

    /// @dev Babylonian integer square root.
    function _sqrt(uint256 x) private pure returns (uint256 y) {
        if (x == 0) return 0;
        y = x;
        uint256 z = (x >> 1) + 1;
        while (z < y) {
            y = z;
            z = (x / z + z) >> 1;
        }
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
