// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "./CompaniesHouseV1.sol";

/**
 * @title CompaniesHouseViewsV1
 * @notice Stateless read-only lens for CompaniesHouseV1.
 *         Provides frontend helper views that were extracted from CompaniesHouseV1
 *         to stay within the EIP-170 bytecode size limit.
 *
 * @dev Stores the CompaniesHouseV1 proxy address as an immutable.
 *      Deploy once per network; no proxy needed (pure view logic, no state).
 */
contract CompaniesHouseViewsV1 {

    /// @notice The CompaniesHouseV1 proxy this lens reads from.
    CompaniesHouseV1 public immutable ch;

    constructor(address _ch) {
        ch = CompaniesHouseV1(_ch);
    }

    /**
     * @notice Returns all active company IDs owned by `_owner`.
     * @dev Mirrors the old CompaniesHouseV1.getOwnerCompanyIds() signature exactly.
     *      Iterates all company IDs from 1..currentCompanyIndex-1, checking
     *      companyBrief[id].owner. Deleted companies have owner == address(0) after
     *      deleteCompany(), so they are naturally excluded.
     */
    function getOwnerCompanyIds(address _owner) external view returns (uint96[] memory) {
        uint96 maxId = ch.currentCompanyIndex();

        // First pass: count
        uint256 count;
        for (uint96 i = 1; i < maxId; i++) {
            (address owner,) = ch.companyBrief(i);
            if (owner == _owner) count++;
        }

        // Second pass: fill
        uint96[] memory ids = new uint96[](count);
        uint256 idx;
        for (uint96 i = 1; i < maxId; i++) {
            (address owner,) = ch.companyBrief(i);
            if (owner == _owner) ids[idx++] = i;
        }
        return ids;
    }

    /**
     * @notice Returns total USDT (6 dec) owed to all active employees right now.
     * @dev Mirrors the old CompaniesHouseV1.getTotalPendingUSDT() signature exactly.
     */
    function getTotalPendingUSDT(uint96 _companyId) external view returns (uint256 totalUSDT) {
        CompaniesHouseV1.CompanyStruct memory company = ch.retrieveCompany(_companyId);
        for (uint256 i; i < company.employees.length; i++) {
            if (!company.employees[i].active) continue;
            totalUSDT += ch.calcEmployeeGross(company.employees[i].employeeId, _companyId);
        }
    }

    /**
     * @notice Returns the combined stable token balance for a company (vault or mapping).
     * @dev Mirrors the old CompaniesHouseV1.getCompanyStableBalance() signature exactly.
     *      Reads vault balance directly if a vault exists, otherwise reads companyTokenBalances.
     */
    function getCompanyStableBalance(uint96 _companyId) external view returns (uint256 total) {
        address vault = ch.companyVault(_companyId);
        address usdt = ch.usdtAddress();
        if (vault != address(0)) {
            return IERC20(usdt).balanceOf(vault);
        }
        total = ch.companyTokenBalances(_companyId, usdt);
        address usdc = ch.usdcAddress();
        if (usdc != address(0)) total += ch.companyTokenBalances(_companyId, usdc);
    }
}
