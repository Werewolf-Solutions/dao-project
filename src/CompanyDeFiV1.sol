// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./interfaces/IAavePool.sol";

//When adding anything please follow the contract layout
/* Contract layout:
 Data types: structs, enums, and type declarations
 State Variables
 Events
 Function Modifiers
 Constructor/Initialize
 Fallback and Receive function
 External functions
 Public functions
 Internal functions
 Private Functions
*/

interface ICompaniesHouseAuth {
    function isAuthorized(address caller, uint96 companyId) external view returns (bool);
    function companyBrief(uint96 companyId) external view returns (address owner, uint96 index);
    function withdrawForDeFi(uint96 companyId, address token, uint256 amount) external;
    function creditFromDeFi(uint96 companyId, address token, uint256 amount) external;
}

/**
 * @title CompanyDeFiV1
 * @notice Allows authorized company roles (owner / operator / powerRoles) to supply and
 *         withdraw company treasury funds into Aave v3, earning yield on idle capital.
 *
 * @dev Architecture:
 *      - Single dispatcher: one contract holds all positions, per-company accounting via
 *        `companyAaveSupplied[companyId][token]`.
 *      - Borrowing is disabled by default (admin flag `borrowingEnabled`) to prevent
 *        cross-company health-factor contagion. Enable only when companies are isolated.
 *      - On local chain (aavePool == address(0)) supply/withdraw revert with AaveNotConfigured.
 *      - Token flow: CompaniesHouse → CompanyDeFiV1 → Aave (supply) and
 *                    Aave → CompanyDeFiV1 → CompaniesHouse (withdraw).
 */
contract CompanyDeFiV1 is Initializable, PausableUpgradeable {
    ///////////////////////////////////////
    //           Custom Errors           //
    ///////////////////////////////////////

    error NotAdmin();
    error NotAuthorized();
    error AaveNotConfigured();
    error BorrowingDisabled();
    error TokenNotAllowed();
    error InsufficientCompanyBalance();
    error ZeroAmount();

    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////

    /// @notice Aave v3 Pool proxy. address(0) on local chain — skips integration.
    IAavePool public aavePool;

    /// @notice CompaniesHouseV1 proxy — used for auth checks and fund movements.
    ICompaniesHouseAuth public companiesHouse;

    /// @notice Privileged admin (set to Timelock so DAO controls admin functions).
    address public admin;

    /// @notice When false (default), `borrowFromAave` always reverts.
    bool public borrowingEnabled;

    /// @notice Per-company, per-token amount currently supplied to Aave.
    /// @dev Denominated in the token's own decimals (e.g. USDT = 6 dec).
    mapping(uint96 companyId => mapping(address token => uint256)) public companyAaveSupplied;

    /// @notice Tokens that may be supplied/borrowed through this contract.
    mapping(address token => bool) public allowedTokens;

    uint256[40] private __gap;

    ///////////////////////////////////////
    //           Events                  //
    ///////////////////////////////////////

    event AaveSupply(uint96 indexed companyId, address indexed token, uint256 amount);
    event AaveWithdraw(uint96 indexed companyId, address indexed token, uint256 amount, uint256 received);
    event AaveBorrow(uint96 indexed companyId, address indexed token, uint256 amount);
    event AaveRepay(uint96 indexed companyId, address indexed token, uint256 amount, uint256 repaid);
    event TokenAllowed(address indexed token, bool allowed);
    event BorrowingEnabledSet(bool enabled);

    ///////////////////////////////////////
    //           Modifiers               //
    ///////////////////////////////////////

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyAuthorized(uint96 companyId) {
        if (!companiesHouse.isAuthorized(msg.sender, companyId)) revert NotAuthorized();
        _;
    }

    modifier aaveConfigured() {
        if (address(aavePool) == address(0)) revert AaveNotConfigured();
        _;
    }

    modifier tokenAllowed(address token) {
        if (!allowedTokens[token]) revert TokenNotAllowed();
        _;
    }

    ///////////////////////////////////////
    //      Constructor/Initializer      //
    ///////////////////////////////////////

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the proxy storage.
     * @param _aavePool     Aave v3 Pool proxy address (address(0) on local chain)
     * @param _companiesHouse CompaniesHouseV1 proxy address
     * @param _admin        Initial admin (typically founder, transferred to Timelock later)
     */
    function initialize(
        address _aavePool,
        address _companiesHouse,
        address _admin
    ) public initializer {
        __Pausable_init();
        aavePool = IAavePool(_aavePool);
        companiesHouse = ICompaniesHouseAuth(_companiesHouse);
        admin = _admin;
        borrowingEnabled = false;
    }

    ///////////////////////////////////////
    //         External Functions        //
    ///////////////////////////////////////

    /**
     * @notice Supply company treasury tokens to Aave v3 to earn yield.
     * @dev Pulls `amount` from CompaniesHouseV1's company balance (via `withdrawForDeFi`),
     *      approves Aave, calls pool.supply, and records the supply internally.
     *      Emits AaveSupply.
     * @param companyId Company whose treasury funds are supplied
     * @param token     ERC20 token to supply (must be in allowedTokens)
     * @param amount    Amount to supply (token decimals)
     */
    function supplyToAave(
        uint96 companyId,
        address token,
        uint256 amount
    )
        external
        whenNotPaused
        onlyAuthorized(companyId)
        aaveConfigured
        tokenAllowed(token)
    {
        if (amount == 0) revert ZeroAmount();

        // Pull tokens from CompaniesHouse company balance into this contract
        companiesHouse.withdrawForDeFi(companyId, token, amount);

        // Approve Aave pool (clear first to handle non-standard ERC20 that revert on non-zero → non-zero)
        IERC20(token).approve(address(aavePool), 0);
        IERC20(token).approve(address(aavePool), amount);

        // Supply to Aave — aTokens stay in this contract
        aavePool.supply(token, amount, address(this), 0);

        // Record per-company accounting
        companyAaveSupplied[companyId][token] += amount;

        emit AaveSupply(companyId, token, amount);
    }

    /**
     * @notice Withdraw previously supplied tokens from Aave v3 back to company treasury.
     * @dev Withdraws from Aave (receiving underlying + accrued yield), then credits the
     *      actual received amount back into CompaniesHouseV1 via `creditFromDeFi`.
     *      The `amount` recorded in companyAaveSupplied decreases by the requested amount,
     *      while the actual received (which may be slightly higher due to yield) goes to CH.
     *      Emits AaveWithdraw.
     * @param companyId Company whose Aave position is being unwound
     * @param token     ERC20 token to withdraw
     * @param amount    Amount to withdraw (token decimals). Use type(uint256).max for full balance.
     */
    function withdrawFromAave(
        uint96 companyId,
        address token,
        uint256 amount
    )
        external
        whenNotPaused
        onlyAuthorized(companyId)
        aaveConfigured
        tokenAllowed(token)
    {
        if (amount == 0) revert ZeroAmount();

        uint256 supplied = companyAaveSupplied[companyId][token];

        // Resolve "max" withdrawal to the tracked supply amount
        uint256 withdrawAmount = amount == type(uint256).max ? supplied : amount;
        if (withdrawAmount > supplied) revert InsufficientCompanyBalance();

        // Effects before external call
        companyAaveSupplied[companyId][token] -= withdrawAmount;

        // Withdraw from Aave — actual received may include yield
        uint256 received = aavePool.withdraw(token, withdrawAmount, address(this));

        // Credit received amount back to company treasury in CompaniesHouse
        IERC20(token).approve(address(companiesHouse), received);
        companiesHouse.creditFromDeFi(companyId, token, received);

        emit AaveWithdraw(companyId, token, withdrawAmount, received);
    }

    /**
     * @notice Borrow tokens from Aave against the contract's collateral.
     * @dev Disabled by default. Admin must call setBorrowingEnabled(true) first.
     *      Note: all companies share the same Aave health factor — enable with caution.
     *      Borrowed tokens are credited directly to the company balance in CompaniesHouse.
     *      Emits AaveBorrow.
     * @param companyId Company receiving the borrowed tokens
     * @param token     ERC20 token to borrow
     * @param amount    Amount to borrow (token decimals)
     */
    function borrowFromAave(
        uint96 companyId,
        address token,
        uint256 amount
    )
        external
        whenNotPaused
        onlyAuthorized(companyId)
        aaveConfigured
        tokenAllowed(token)
    {
        if (!borrowingEnabled) revert BorrowingDisabled();
        if (amount == 0) revert ZeroAmount();

        // Variable rate (2); stable rate (1) is deprecated in Aave v3
        aavePool.borrow(token, amount, 2, 0, address(this));

        // Credit borrowed tokens to company treasury
        IERC20(token).approve(address(companiesHouse), amount);
        companiesHouse.creditFromDeFi(companyId, token, amount);

        emit AaveBorrow(companyId, token, amount);
    }

    /**
     * @notice Repay a borrow position on behalf of this contract.
     * @dev Pulls `amount` from the company's treasury balance, repays to Aave.
     *      Emits AaveRepay.
     * @param companyId Company whose treasury funds are used to repay
     * @param token     ERC20 token to repay
     * @param amount    Amount to repay. Use type(uint256).max for full debt.
     */
    function repayToAave(
        uint96 companyId,
        address token,
        uint256 amount
    )
        external
        whenNotPaused
        onlyAuthorized(companyId)
        aaveConfigured
        tokenAllowed(token)
    {
        if (!borrowingEnabled) revert BorrowingDisabled();
        if (amount == 0) revert ZeroAmount();

        // Pull from company treasury
        companiesHouse.withdrawForDeFi(companyId, token, amount);

        IERC20(token).approve(address(aavePool), 0);
        IERC20(token).approve(address(aavePool), amount);

        uint256 repaid = aavePool.repay(token, amount, 2, address(this));

        // If repaid < amount (e.g. debt was smaller), return the difference to company
        uint256 leftover = amount - repaid;
        if (leftover > 0) {
            IERC20(token).approve(address(companiesHouse), leftover);
            companiesHouse.creditFromDeFi(companyId, token, leftover);
        }

        emit AaveRepay(companyId, token, amount, repaid);
    }

    // ── Admin functions ───────────────────────────────────────────────────────

    /**
     * @notice Whitelist or remove a token for DeFi operations.
     * @param token   ERC20 token address
     * @param allowed true to allow, false to disallow
     */
    function setAllowedToken(address token, bool allowed) external onlyAdmin {
        allowedTokens[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    /**
     * @notice Enable or disable borrowing. Disabled by default to prevent
     *         cross-company health-factor risk.
     */
    function setBorrowingEnabled(bool enabled) external onlyAdmin {
        borrowingEnabled = enabled;
        emit BorrowingEnabledSet(enabled);
    }

    /**
     * @notice Transfer the admin role to a new address (e.g. founder → Timelock).
     */
    function setAdmin(address _admin) external onlyAdmin {
        admin = _admin;
    }

    /**
     * @notice Update the Aave pool address (e.g. after an Aave upgrade).
     */
    function setAavePool(address _aavePool) external onlyAdmin {
        aavePool = IAavePool(_aavePool);
    }

    /**
     * @notice Emergency pause — halts supply, withdraw, borrow, repay.
     */
    function pause() external onlyAdmin {
        _pause();
    }

    /**
     * @notice Resume normal operation.
     */
    function unpause() external onlyAdmin {
        _unpause();
    }

    ///////////////////////////////////////
    //          Public Functions         //
    ///////////////////////////////////////

    /**
     * @notice Returns the Aave account data for this contract (shared across all companies).
     * @dev Health factor < 1e18 means the contract is at liquidation risk.
     * @return totalCollateralBase  Total supplied value in USD (8 decimals)
     * @return totalDebtBase        Total borrowed value in USD (8 decimals)
     * @return availableBorrowsBase Available to borrow in USD (8 decimals)
     * @return currentLiquidationThreshold Weighted liquidation threshold (bps)
     * @return ltv                  Weighted loan-to-value (bps)
     * @return healthFactor         Health factor (1e18 = safe; <1e18 = liquidatable)
     */
    function getAaveUserData()
        public
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
        if (address(aavePool) == address(0)) {
            return (0, 0, 0, 0, 0, type(uint256).max);
        }
        return aavePool.getUserAccountData(address(this));
    }

    /**
     * @notice Returns the amount of `token` currently supplied to Aave by `companyId`.
     * @dev Does not include accrued yield — use aToken.balanceOf(address(this)) for live balance.
     */
    function getSupplied(uint96 companyId, address token) public view returns (uint256) {
        return companyAaveSupplied[companyId][token];
    }
}
