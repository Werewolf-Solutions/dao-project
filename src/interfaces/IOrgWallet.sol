// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "./IPaymentEngine.sol";

/**
 * @notice Interface for OrgWalletImpl — a beacon-upgradeable smart wallet
 *         deployed per employee/user by OrgBeaconFactory.
 *
 *         The `org` address controls operator authorization and batch execution.
 *         The `owner` address (employee's EOA) can execute individual calls.
 *         Operators (e.g. PaymentEngine) can push payments in once authorized by org.
 */
interface IOrgWallet {

    // ── Mutating functions ────────────────────────────────────────────────────

    /**
     * @notice Executes a single arbitrary call from this wallet.
     * @dev Callable by org, owner, or any authorized operator.
     */
    function execute(address to, uint256 value, bytes calldata data) external;

    /**
     * @notice Executes multiple calls atomically. Reverts on any failure.
     * @dev Callable by org, owner, or any authorized operator.
     */
    function executeBatch(IPaymentEngine.Call[] calldata calls) external;

    /**
     * @notice Authorizes an operator to call execute/executeBatch on this wallet.
     * @dev onlyOrg.
     */
    function authorizeOperator(address op) external;

    /**
     * @notice Revokes an operator's authorization.
     * @dev onlyOrg.
     */
    function revokeOperator(address op) external;

    // ── View functions ────────────────────────────────────────────────────────

    /// @notice The organization address that deployed this wallet (controls operators).
    function org() external view returns (address);

    /// @notice The employee's EOA that owns this wallet.
    function owner() external view returns (address);

    /// @notice Returns true if `op` is an authorized operator.
    function isOperator(address op) external view returns (bool);
}
