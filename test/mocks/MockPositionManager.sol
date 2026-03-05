// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MockPositionManager
 * @notice Minimal mock of the Uniswap v3 NonfungiblePositionManager for local testing.
 *         Matches the ABI signatures used by UniswapHelper and LPStaking.
 */
contract MockPositionManager {
    uint256 private _nextId = 1;
    mapping(uint256 => address) private _owners;

    // Matches INonfungiblePositionManager.MintParams layout exactly
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        tokenId = _nextId++;
        _owners[tokenId] = params.recipient;
        liquidity = 1e18;
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }

    function transferFrom(address, address to, uint256 tokenId) external {
        _owners[tokenId] = to;
    }

    function positions(uint256 /*tokenId*/)
        external
        pure
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        return (0, address(0), address(0), address(0), 0, 0, 0, 1e18, 0, 0, 0, 0);
    }

    function collect(CollectParams calldata /*params*/)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        return (0, 0);
    }

    function decreaseLiquidity(DecreaseLiquidityParams calldata /*params*/)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        return (0, 0);
    }

    function createAndInitializePoolIfNecessary(
        address,
        address,
        uint24,
        uint160
    ) external payable returns (address pool) {
        pool = address(0); // stub — pool creation not needed for local tests
    }
}
