// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface ITokenSale {
    error InvalidInitialization();
    error NotInitializing();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);

    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SaleEnded(uint256 saleId);
    event SaleStarted(uint256 saleId, uint256 tokensAvailable, uint256 price);
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 saleId);

    function buyTokens(
        uint256 _amount,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external;
    function endSale() external;
    function initialize(
        address newOwner,
        address _token,
        address _treasury,
        address _timelock,
        address _usdtTokenAddress,
        address _stakingAddress,
        address _uniswapHelper
    ) external;
    function liquidityExamplesContract() external view returns (address);
    function owner() external view returns (address);
    function price() external view returns (uint256);
    function renounceOwnership() external;
    function saleActive() external view returns (bool);
    function saleIdCounter() external view returns (uint256);
    function sales(uint256)
        external
        view
        returns (uint256 saleId, uint256 tokensAvailable, uint256 price, bool active);
    function setUsdtTokenAddress(address _usdtTokenAddress) external;
    function stakingContract() external view returns (address);
    function startSale(uint256 _amount, uint256 _price) external;
    function startSaleZero(uint256 _amount, uint256 _price) external;
    function transferOwnership(address newOwner) external;
    function uniswapHelper() external view returns (address);
    function usdtToken() external view returns (address);
    function usdtTokenAddress() external view returns (address);
}
