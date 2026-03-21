// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/IAavePool.sol";

// Contract layout:
// Data types
// State Variables
// Events
// Modifiers
// Constructor/Initialize
// External functions
// Public functions
// Internal functions
// Private functions

interface ICompaniesHouseVault {
    function isAuthorized(address caller, uint96 companyId) external view returns (bool);
    function admin() external view returns (address);
}

/**
 * @title CompanyVault
 * @notice Per-company DeFi investment vault deployed as an EIP-1167 minimal-proxy clone.
 *         Holds the company's investment funds directly (isolated from payroll in
 *         CompaniesHouseV1) and interacts with Aave v3 on behalf of authorized roles.
 *
 * @dev One clone is deployed per company by CompaniesHouseV1.createVault().
 *      aTokens accrue directly inside this vault — no singleton custody, no cross-company risk.
 *      Auth delegates to companiesHouse.isAuthorized() so the existing CEO/CFO/powerRole
 *      system is reused without duplication.
 */
contract CompanyVault is Initializable {
    ///////////////////////////////////////
    //           Custom Errors           //
    ///////////////////////////////////////

    error NotAdmin();
    error NotAuthorized();
    error AaveNotConfigured();
    error BorrowingDisabled();
    error TokenNotAllowed();
    error ZeroAmount();
    error InsufficientBalance();
    error ZeroAddress();

    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////

    /// @notice The company this vault belongs to.
    uint96 public companyId;

    /// @notice CompaniesHouseV1 proxy — used for auth checks.
    ICompaniesHouseVault public companiesHouse;

    /// @notice Aave v3 Pool proxy. address(0) means Aave not configured on this chain.
    IAavePool public aavePool;

    /// @notice Privileged admin (CompaniesHouseV1 admin — initially founder, then Timelock).
    address public admin;

    /// @notice Guardian address — can toggle borrowingEnabled without going through governance.
    address public guardian;

    /// @notice Tokens whitelisted for Aave operations.
    mapping(address token => bool) public allowedTokens;

    /// @notice When false (default), borrowFromAave always reverts.
    bool public borrowingEnabled;

    /// @notice Governance-set minimum health factor threshold (1e18 = 1.0).
    /// @dev Default: 1.5e18. Informational — callers should respect this before borrowing.
    uint256 public minHealthFactor;

    uint256[37] private __gap;

    ///////////////////////////////////////
    //           Events                  //
    ///////////////////////////////////////

    event Deposited(address indexed token, address indexed from, uint256 amount);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);
    event AaveSupply(address indexed token, uint256 amount);
    event AaveWithdraw(address indexed token, uint256 amount, uint256 received);
    event AaveBorrow(address indexed token, uint256 amount);
    event AaveRepay(address indexed token, uint256 amount, uint256 repaid);
    event TokenAllowed(address indexed token, bool allowed);
    event AavePoolUpdated(address pool);
    event BorrowingEnabledSet(bool enabled);
    event MinHealthFactorSet(uint256 value);
    event GuardianSet(address indexed guardian);

    ///////////////////////////////////////
    //           Modifiers               //
    ///////////////////////////////////////

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyAdminOrGuardian() {
        if (msg.sender != admin && msg.sender != guardian) revert NotAdmin();
        _;
    }

    modifier onlyAuthorized() {
        if (
            msg.sender != admin &&
            msg.sender != companiesHouse.admin() &&
            msg.sender != address(companiesHouse) &&
            !companiesHouse.isAuthorized(msg.sender, companyId)
        ) revert NotAuthorized();
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
     * @notice Initialize this vault clone. Called once by CompaniesHouseV1.createVault().
     * @param _companyId      The company this vault belongs to
     * @param _companiesHouse CompaniesHouseV1 proxy (for auth checks)
     * @param _aavePool       Aave v3 Pool proxy (address(0) on local chain)
     * @param _admin          Initial admin (founder, later transferred to Timelock)
     * @param _allowedToken   Initial whitelisted token (e.g. USDC). address(0) to skip.
     */
    function initialize(
        uint96 _companyId,
        address _companiesHouse,
        address _aavePool,
        address _admin,
        address _allowedToken
    ) external initializer {
        if (_companiesHouse == address(0)) revert ZeroAddress();
        if (_admin == address(0)) revert ZeroAddress();
        companyId = _companyId;
        companiesHouse = ICompaniesHouseVault(_companiesHouse);
        aavePool = IAavePool(_aavePool);
        admin = _admin;
        borrowingEnabled = false;
        minHealthFactor = 1.5e18;
        if (_allowedToken != address(0)) {
            allowedTokens[_allowedToken] = true;
            emit TokenAllowed(_allowedToken, true);
        }
    }

    ///////////////////////////////////////
    //         External Functions        //
    ///////////////////////////////////////

    /**
     * @notice Deposit tokens into this vault. Anyone can fund the vault.
     * @dev Caller must have approved this contract for `amount` of `token` first.
     * @param token  ERC20 token to deposit
     * @param amount Amount (token decimals)
     */
    function deposit(address token, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        emit Deposited(token, msg.sender, amount);
    }

    /**
     * @notice Withdraw tokens from this vault to any address.
     * @param token  ERC20 token to withdraw
     * @param amount Amount to withdraw
     * @param to     Recipient address
     */
    function withdraw(address token, uint256 amount, address to) external onlyAuthorized {
        if (amount == 0) revert ZeroAmount();
        if (IERC20(token).balanceOf(address(this)) < amount) revert InsufficientBalance();
        IERC20(token).transfer(to, amount);
        emit Withdrawn(token, to, amount);
    }

    /**
     * @notice Supply vault tokens to Aave v3 to earn yield.
     * @dev aTokens stay in this vault, accruing yield in real time.
     * @param token  ERC20 token to supply (must be in allowedTokens)
     * @param amount Amount to supply (token decimals)
     */
    function supplyToAave(
        address token,
        uint256 amount
    ) external onlyAuthorized aaveConfigured tokenAllowed(token) {
        if (amount == 0) revert ZeroAmount();
        if (IERC20(token).balanceOf(address(this)) < amount) revert InsufficientBalance();

        // Approve Aave pool (clear first for non-standard ERC20s)
        IERC20(token).approve(address(aavePool), 0);
        IERC20(token).approve(address(aavePool), amount);

        // Supply — aTokens land directly in this vault
        aavePool.supply(token, amount, address(this), 0);

        emit AaveSupply(token, amount);
    }

    /**
     * @notice Withdraw tokens from Aave v3 back to this vault.
     * @param token  ERC20 token to withdraw
     * @param amount Amount to withdraw. Use type(uint256).max for full balance.
     */
    function withdrawFromAave(
        address token,
        uint256 amount
    ) external onlyAuthorized aaveConfigured tokenAllowed(token) {
        if (amount == 0) revert ZeroAmount();

        // Aave transfers underlying back to this vault
        uint256 received = aavePool.withdraw(token, amount, address(this));

        emit AaveWithdraw(token, amount, received);
    }

    /**
     * @notice Borrow tokens from Aave against this vault's collateral.
     * @dev Admin must call setBorrowingEnabled(true) first.
     *      Borrowed tokens land in this vault.
     * @param token  ERC20 token to borrow (must be in allowedTokens)
     * @param amount Amount to borrow (token decimals)
     */
    function borrowFromAave(
        address token,
        uint256 amount
    ) external onlyAuthorized aaveConfigured tokenAllowed(token) {
        if (!borrowingEnabled) revert BorrowingDisabled();
        if (amount == 0) revert ZeroAmount();
        // Variable rate mode (2); stable (1) is deprecated in Aave v3
        aavePool.borrow(token, amount, 2, 0, address(this));
        emit AaveBorrow(token, amount);
    }

    /**
     * @notice Repay a borrow position using tokens held in this vault.
     * @param token  ERC20 token to repay (must be in allowedTokens)
     * @param amount Amount to repay. Use type(uint256).max for full debt.
     */
    function repayToAave(
        address token,
        uint256 amount
    ) external onlyAuthorized aaveConfigured tokenAllowed(token) {
        if (!borrowingEnabled) revert BorrowingDisabled();
        if (amount == 0) revert ZeroAmount();
        if (IERC20(token).balanceOf(address(this)) < amount) revert InsufficientBalance();
        IERC20(token).approve(address(aavePool), 0);
        IERC20(token).approve(address(aavePool), amount);
        uint256 repaid = aavePool.repay(token, amount, 2, address(this));
        emit AaveRepay(token, amount, repaid);
    }

    // ── Admin functions ───────────────────────────────────────────────────────

    /**
     * @notice Whitelist or remove a token for Aave operations.
     */
    function setAllowedToken(address token, bool allowed) external onlyAdmin {
        allowedTokens[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    /**
     * @notice Update the Aave pool address.
     */
    function setAavePool(address _aavePool) external onlyAdmin {
        aavePool = IAavePool(_aavePool);
        emit AavePoolUpdated(_aavePool);
    }

    /**
     * @notice Set the guardian address. Guardian can enable/disable borrowing directly.
     */
    function setGuardian(address _guardian) external onlyAdmin {
        guardian = _guardian;
        emit GuardianSet(_guardian);
    }

    /**
     * @notice Transfer admin role.
     */
    function setAdmin(address _admin) external onlyAdmin {
        if (_admin == address(0)) revert ZeroAddress();
        admin = _admin;
    }

    /**
     * @notice Enable or disable borrowing. Disabled by default to limit risk.
     */
    function setBorrowingEnabled(bool enabled) external onlyAdminOrGuardian {
        borrowingEnabled = enabled;
        emit BorrowingEnabledSet(enabled);
    }

    /**
     * @notice Set the governance-defined minimum health factor threshold.
     * @param value Minimum HF in 1e18 units (e.g. 1.5e18 = 1.5x).
     */
    function setMinHealthFactor(uint256 value) external onlyAdmin {
        minHealthFactor = value;
        emit MinHealthFactorSet(value);
    }

    ///////////////////////////////////////
    //          Public Functions         //
    ///////////////////////////////////////

    /**
     * @notice Returns the vault's balance of `token` (liquid, not in Aave).
     */
    function getTokenBalance(address token) public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @notice Returns this vault's Aave account data.
     * @dev healthFactor < 1e18 means the vault is at liquidation risk.
     *      Returns (0,0,0,0,0, type(uint256).max) when Aave is not configured.
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
}
