//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "./WithAdmin.sol";

contract WithUpgrader is WithAdmin {
    address internal _upgrader;

    /// @dev Emits when the Upgrader address is changed
    /// @param oldUpgrader The previous Upgrader address
    /// @param newUpgrader The new Upgrader address
    event UpgraderChanged(address oldUpgrader, address newUpgrader);

    modifier onlyUpgrader() {
        require(msg.sender == _upgrader, "UPGRADER_ACCESS_DENIED");
        _;
    }

    /// @dev Get the current upgrader of this contract.
    /// @return The current upgrader of this contract.
    function getUpgrader() external view returns (address) {
        return _upgrader;
    }

    /// @dev Change the upgrader to be `newUpgrader`.
    /// @param newUpgrader The address of the new upgrader.
    function changeUpgrader(address newUpgrader) external onlyAdmin() {
        emit UpgraderChanged(_upgrader, newUpgrader);
        _upgrader = newUpgrader;
    }
}
