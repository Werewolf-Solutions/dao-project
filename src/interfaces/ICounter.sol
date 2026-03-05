// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

library Hooks {
    struct Permissions {
        bool beforeInitialize;
        bool afterInitialize;
        bool beforeAddLiquidity;
        bool afterAddLiquidity;
        bool beforeRemoveLiquidity;
        bool afterRemoveLiquidity;
        bool beforeSwap;
        bool afterSwap;
        bool beforeDonate;
        bool afterDonate;
        bool beforeSwapReturnDelta;
        bool afterSwapReturnDelta;
        bool afterAddLiquidityReturnDelta;
        bool afterRemoveLiquidityReturnDelta;
    }
}

library IPoolManager {
    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
        bytes32 salt;
    }

    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }
}

interface ICounter {
    type BalanceDelta is int256;
    type BeforeSwapDelta is int256;
    type Currency is address;
    type PoolId is bytes32;

    struct PoolKey {
        Currency currency0;
        Currency currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    error HookNotImplemented();
    error InvalidPool();
    error LockFailure();
    error NotPoolManager();
    error NotSelf();

    function afterAddLiquidity(
        address,
        PoolKey memory,
        IPoolManager.ModifyLiquidityParams memory,
        BalanceDelta,
        BalanceDelta,
        bytes memory
    ) external returns (bytes4, BalanceDelta);
    function afterDonate(address, PoolKey memory, uint256, uint256, bytes memory) external returns (bytes4);
    function afterInitialize(address, PoolKey memory, uint160, int24) external returns (bytes4);
    function afterRemoveLiquidity(
        address,
        PoolKey memory,
        IPoolManager.ModifyLiquidityParams memory,
        BalanceDelta,
        BalanceDelta,
        bytes memory
    ) external returns (bytes4, BalanceDelta);
    function afterSwap(address, PoolKey memory key, IPoolManager.SwapParams memory, BalanceDelta, bytes memory)
        external
        returns (bytes4, int128);
    function afterSwapCount(PoolId) external view returns (uint256 count);
    function beforeAddLiquidity(address, PoolKey memory key, IPoolManager.ModifyLiquidityParams memory, bytes memory)
        external
        returns (bytes4);
    function beforeAddLiquidityCount(PoolId) external view returns (uint256 count);
    function beforeDonate(address, PoolKey memory, uint256, uint256, bytes memory) external returns (bytes4);
    function beforeInitialize(address, PoolKey memory, uint160) external returns (bytes4);
    function beforeRemoveLiquidity(address, PoolKey memory key, IPoolManager.ModifyLiquidityParams memory, bytes memory)
        external
        returns (bytes4);
    function beforeRemoveLiquidityCount(PoolId) external view returns (uint256 count);
    function beforeSwap(address, PoolKey memory key, IPoolManager.SwapParams memory, bytes memory)
        external
        returns (bytes4, BeforeSwapDelta, uint24);
    function beforeSwapCount(PoolId) external view returns (uint256 count);
    function getHookPermissions() external pure returns (Hooks.Permissions memory);
    function poolManager() external view returns (address);
    function unlockCallback(bytes memory data) external returns (bytes memory);
}
