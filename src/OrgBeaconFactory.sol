// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./OrgWalletImpl.sol";

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

/**
 * @title OrgBeaconFactory
 * @notice Deploys per-organisation UpgradeableBeacons and per-employee BeaconProxy wallets.
 *
 *         One beacon per org: org admin can upgrade the wallet implementation for all
 *         employees in a single `UpgradeableBeacon.upgradeTo()` call.
 *
 *         One BeaconProxy (OrgWalletImpl) per employee: initialised with the org address
 *         and the employee's EOA.
 *
 * @dev Plain (non-upgradeable) contract. Wallet state lives in the BeaconProxy instances,
 *      not here. If re-deployed, existing beacons and wallets remain valid on-chain.
 */
contract OrgBeaconFactory {

    ///////////////////////////////////////
    //           Custom Errors           //
    ///////////////////////////////////////

    error ZeroAddress();
    error BeaconAlreadyExists();
    error WalletAlreadyExists();

    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////

    /// @notice The OrgWalletImpl address used as the initial beacon implementation.
    address public immutable orgWalletImpl;

    /// @notice Maps orgId → deployed UpgradeableBeacon address.
    mapping(uint96 orgId => address beacon) public orgBeacon;

    /// @notice Maps beacon → employee → deployed wallet (BeaconProxy) address.
    mapping(address beacon => mapping(address employee => address wallet)) public walletOf;

    ///////////////////////////////////////
    //           Events                  //
    ///////////////////////////////////////

    event OrgBeaconCreated(uint96 indexed orgId, address beacon);
    event WalletDeployed(address indexed beacon, address indexed employee, address wallet);

    ///////////////////////////////////////
    //      Constructor/Initializer      //
    ///////////////////////////////////////

    constructor(address _orgWalletImpl) {
        if (_orgWalletImpl == address(0)) revert ZeroAddress();
        orgWalletImpl = _orgWalletImpl;
    }

    ///////////////////////////////////////
    //       External Functions          //
    ///////////////////////////////////////

    /**
     * @notice Deploys a new UpgradeableBeacon for an organisation.
     * @dev Each org gets exactly one beacon. `orgAdmin` is set as the beacon owner —
     *      they can call `UpgradeableBeacon.upgradeTo()` to upgrade all employee wallets.
     * @param orgAdmin Address that will own the beacon (typically the company owner EOA).
     * @param orgId    Unique identifier for this organisation (maps to CH companyId).
     * @return beacon  The deployed UpgradeableBeacon address.
     */
    function createOrgBeacon(address orgAdmin, uint96 orgId) external returns (address beacon) {
        if (orgAdmin == address(0)) revert ZeroAddress();
        if (orgBeacon[orgId] != address(0)) revert BeaconAlreadyExists();

        beacon = address(new UpgradeableBeacon(orgWalletImpl, orgAdmin));
        orgBeacon[orgId] = beacon;

        emit OrgBeaconCreated(orgId, beacon);
    }

    /**
     * @notice Deploys a BeaconProxy wallet for an employee.
     * @dev `orgAddress` is the company-authorised address stored in the wallet (not the beacon
     *      owner). It controls operator authorisation inside the wallet. This is typically the
     *      company owner EOA or a multisig.
     * @param beacon      UpgradeableBeacon to point the proxy at.
     * @param orgAddress  Address stored as `OrgWalletImpl.org` — controls the wallet on org side.
     * @param employee    Employee's EOA stored as `OrgWalletImpl.owner`.
     * @return wallet     The deployed BeaconProxy address.
     */
    function deployWallet(
        address beacon,
        address orgAddress,
        address employee
    ) external returns (address wallet) {
        if (beacon == address(0) || orgAddress == address(0) || employee == address(0))
            revert ZeroAddress();
        if (walletOf[beacon][employee] != address(0)) revert WalletAlreadyExists();

        bytes memory initData = abi.encodeCall(OrgWalletImpl.initialize, (orgAddress, employee));
        wallet = address(new BeaconProxy(beacon, initData));
        walletOf[beacon][employee] = wallet;

        emit WalletDeployed(beacon, employee, wallet);
    }

    /**
     * @notice Returns the wallet address for an employee under a given beacon.
     * @dev Returns address(0) if no wallet has been deployed yet.
     */
    function getWallet(address beacon, address employee) external view returns (address) {
        return walletOf[beacon][employee];
    }
}
