// SPDX: Licnese-Idenitifier: MIT
pragma solidity ^0.8.27;

/// @title MockWFLTokenAPY
/// @notice This is mock contract used for testing the APY calculation which needs
/// to easily modify the totalSupply
/// @dev Only used for testing APY calculations
contract MockWLFTokenAPY {
    uint256 public totalSupply;

    constructor() {}

    function setTotalSupply(uint256 _newTotalSupply) public {
        totalSupply = _newTotalSupply;
    }
}
