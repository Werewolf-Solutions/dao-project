// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IPaymentEngine.sol";
import "./interfaces/IOrgWallet.sol";

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
 * @title OrgWalletImpl
 * @notice Beacon-upgradeable smart wallet deployed per employee/user by OrgBeaconFactory.
 *
 *         One UpgradeableBeacon is deployed per organisation. Each employee receives a
 *         BeaconProxy pointing at that beacon. When the org upgrades the beacon
 *         implementation, all employee wallets gain new functionality instantly.
 *
 *         Auth model:
 *           - `org`      (company-authorised address) — controls operators, can execute
 *           - `owner`    (employee EOA) — can execute personal calls
 *           - operators  (e.g. PaymentEngine) — authorised by org to push payments in
 *
 * @dev No ERC-4337 / EntryPoint dependency. Upgrade to full AA by upgrading the beacon
 *      implementation to one that implements IAccount.
 */
contract OrgWalletImpl is Initializable, ReentrancyGuardUpgradeable, IOrgWallet {

    ///////////////////////////////////////
    //           Custom Errors           //
    ///////////////////////////////////////

    error NotAuthorized();
    error ZeroAddress();
    error CallFailed(uint256 index);

    ///////////////////////////////////////
    //           State Variables         //
    ///////////////////////////////////////

    /// @notice The organisation address that controls this wallet's operator list.
    address public org;

    /// @notice The employee's EOA — personal execution authority.
    address public owner;

    /// @notice Addresses authorised by org to call execute/executeBatch.
    mapping(address => bool) public isOperator;

    uint256[47] private __gap;

    ///////////////////////////////////////
    //           Events                  //
    ///////////////////////////////////////

    event Executed(address indexed to, uint256 value, bytes data);
    event BatchExecuted(uint256 count);
    event OperatorAuthorized(address indexed op);
    event OperatorRevoked(address indexed op);

    ///////////////////////////////////////
    //           Modifiers               //
    ///////////////////////////////////////

    modifier onlyAuthorized() {
        if (msg.sender != org && msg.sender != owner && !isOperator[msg.sender])
            revert NotAuthorized();
        _;
    }

    modifier onlyOrg() {
        if (msg.sender != org) revert NotAuthorized();
        _;
    }

    ///////////////////////////////////////
    //      Constructor/Initializer      //
    ///////////////////////////////////////

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialises the wallet for an employee.
     * @param _org   Organisation address (company-authorised EOA or contract).
     * @param _owner Employee's EOA.
     */
    function initialize(address _org, address _owner) public initializer {
        if (_org == address(0) || _owner == address(0)) revert ZeroAddress();
        __ReentrancyGuard_init();
        org   = _org;
        owner = _owner;
    }

    ///////////////////////////////////////
    //       Fallback / Receive          //
    ///////////////////////////////////////

    receive() external payable {}

    ///////////////////////////////////////
    //       External Functions          //
    ///////////////////////////////////////

    /**
     * @notice Executes a single arbitrary call from this wallet.
     * @dev Callable by org, owner, or any authorised operator.
     * @param to    Target address.
     * @param value ETH value to forward.
     * @param data  Calldata.
     */
    function execute(address to, uint256 value, bytes calldata data)
        external
        onlyAuthorized
        nonReentrant
    {
        (bool ok,) = to.call{value: value}(data);
        if (!ok) revert CallFailed(0);
        emit Executed(to, value, data);
    }

    /**
     * @notice Executes multiple calls atomically. Reverts on any individual failure.
     * @dev Callable by org, owner, or any authorised operator.
     * @param calls Array of {to, value, data} structs.
     */
    function executeBatch(IPaymentEngine.Call[] calldata calls)
        external
        onlyAuthorized
        nonReentrant
    {
        for (uint256 i = 0; i < calls.length; i++) {
            (bool ok,) = calls[i].to.call{value: calls[i].value}(calls[i].data);
            if (!ok) revert CallFailed(i);
        }
        emit BatchExecuted(calls.length);
    }

    /**
     * @notice Authorises `op` to call execute/executeBatch on this wallet.
     * @dev onlyOrg. Used to whitelist PaymentEngine so it can push payments in.
     */
    function authorizeOperator(address op) external onlyOrg {
        if (op == address(0)) revert ZeroAddress();
        isOperator[op] = true;
        emit OperatorAuthorized(op);
    }

    /**
     * @notice Revokes `op`'s operator status.
     * @dev onlyOrg.
     */
    function revokeOperator(address op) external onlyOrg {
        isOperator[op] = false;
        emit OperatorRevoked(op);
    }
}
