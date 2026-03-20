// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

/**
 * @notice Minimal interface for CompaniesHouseV1 used by PayrollExecutor and other satellite contracts.
 * @dev Only includes functions that external callers need. For the full ABI see CompaniesHouseV1.sol.
 */
interface ICompaniesHouseV1 {

    // ── Structs ───────────────────────────────────────────────────────────────

    struct PayrollPreviewItem {
        address employeeAddress;
        string  name;
        uint256 grossUSDT;
        uint256 fee;
        uint256 netUSDT;
    }

    // ── Auth / view helpers ───────────────────────────────────────────────────

    /**
     * @notice Returns true if `caller` has any authority level in the given company.
     */
    function isAuthorized(address caller, uint96 companyId) external view returns (bool);

    /**
     * @notice Returns whether `caller` is authorized to trigger payment for `employee`.
     * @dev Wraps the LENIENT auth rule inside CompaniesHouseV1.
     */
    function canPayEmployee(address caller, address employee, uint96 companyId) external view returns (bool);

    /**
     * @notice Returns total USDT gross owed to one employee right now (salary + pending earnings).
     * @dev Returns 0 if employee is not an active member.
     */
    function calcEmployeeGross(address employee, uint96 companyId) external view returns (uint256);

    /**
     * @notice Returns whether the company can afford to pay `amount` while maintaining reserve.
     */
    function checkCanPay(uint96 companyId, uint256 amount) external view returns (bool);

    /**
     * @notice Calculates what each active employee would receive if payroll ran now.
     */
    function previewPayroll(uint96 companyId) external view returns (
        PayrollPreviewItem[] memory items,
        uint256 totalGross,
        uint256 totalFee,
        uint256 totalNet
    );

    /**
     * @notice Returns the brief (owner address + index) for a company.
     */
    function companyBrief(uint96 companyId) external view returns (address owner, uint96 index);

    // ── State-mutating callbacks (onlyPayrollExecutor) ────────────────────────

    /**
     * @notice Executes a single queued payment. Sets lastPayDate to snapshotTimestamp,
     *         drains pending earnings up to snapshot, transfers USDT to employee.
     * @dev Callable only by the registered payrollExecutor address.
     */
    function executeQueuedPayment(
        uint96 companyId,
        address employee,
        uint256 grossUSDT,
        uint256 snapshotTimestamp
    ) external;

    /**
     * @notice Executes a mixed USDT + WLF payment. Either amount may be zero.
     * @dev Callable only by the registered payrollExecutor address.
     */
    function executeTokenPayment(
        uint96 companyId,
        address employee,
        uint256 usdtAmount,
        address wlfToken,
        uint256 wlfAmount,
        uint256 payTimestamp
    ) external;
}
