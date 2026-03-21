// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

/**
 * @notice Interface for the PaymentEngine — a general-purpose payment graph engine.
 *         Models payment relationships as directed edges between addresses,
 *         supporting PAYROLL, SUBSCRIPTION, COMMISSION, and REVENUE_SHARE types.
 */
interface IPaymentEngine {

    // ── Data types ────────────────────────────────────────────────────────────

    /// @notice Generic call struct used by OrgWallet.executeBatch.
    struct Call {
        address to;
        uint256 value;
        bytes   data;
    }

    /**
     * @notice Supported payment edge types.
     * @dev PAYROLL and SUBSCRIPTION are time-accrual (settled via settleEdges).
     *      COMMISSION is event-driven (settled via triggerCommission only).
     *      REVENUE_SHARE splits a computed amount among configured recipients.
     */
    enum PaymentType { PAYROLL, SUBSCRIPTION, COMMISSION, REVENUE_SHARE }

    /**
     * @notice A directed payment relationship between two addresses.
     * @param id          Auto-incrementing edge identifier.
     * @param from        Payer — company address used as org identifier.
     * @param to          Payee address (employee wallet, vendor, recipient).
     * @param pType       Payment type (determines settlement logic).
     * @param rateUSDT    USDT (6 dec) per `period` seconds.
     *                    For COMMISSION: treated as basis points of the sale amount.
     * @param lastSettled Unix timestamp of the most recent settlement.
     * @param period      Seconds between settlements. 0 = trigger-only (COMMISSION).
     * @param active      False = soft-deleted, skipped during settlement.
     */
    struct PaymentEdge {
        uint256     id;
        address     from;
        address     to;
        PaymentType pType;
        uint96      rateUSDT;
        uint48      lastSettled;
        uint48      period;
        bool        active;
    }

    // ── Mutating functions ────────────────────────────────────────────────────

    /**
     * @notice Settles a batch of edges as of `asOf` timestamp.
     * @dev Public — anyone can trigger settlement. No auth check (same as payEmployees).
     *      COMMISSION edges are skipped; use triggerCommission for those.
     * @param edgeIds Array of edge IDs to settle.
     * @param asOf    Settlement timestamp (typically block.timestamp cast to uint48).
     */
    function settleEdges(uint256[] calldata edgeIds, uint48 asOf) external;

    /**
     * @notice Triggers a commission payment for a COMMISSION-type edge.
     * @dev onlyOracle. `rateUSDT` is treated as basis points of `saleAmount`.
     * @param edgeId     The COMMISSION edge to settle.
     * @param saleAmount The gross sale amount in USDT (6 dec).
     */
    function triggerCommission(uint256 edgeId, uint256 saleAmount) external;

    /**
     * @notice Adds a new payment edge. Returns the assigned edge ID.
     * @dev onlyAdmin.
     * @param from      Payer address (used as org identifier for CH lookup).
     * @param to        Payee address.
     * @param pType     Payment type.
     * @param rateUSDT  USDT (6 dec) per period, or bps for COMMISSION.
     * @param period    Seconds between settlements (0 for COMMISSION).
     * @param companyId CompaniesHouseV1 company ID — required for CH callbacks.
     */
    function addEdge(
        address     from,
        address     to,
        PaymentType pType,
        uint96      rateUSDT,
        uint48      period,
        uint96      companyId
    ) external returns (uint256 edgeId);

    /**
     * @notice Soft-deletes a payment edge (sets active = false).
     * @dev onlyAdmin.
     */
    function removeEdge(uint256 edgeId) external;

    // ── View functions ────────────────────────────────────────────────────────

    /**
     * @notice Returns the edge IDs associated with a given payer address.
     */
    function getOrgEdgeIds(address from) external view returns (uint256[] memory);
}
