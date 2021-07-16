//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "../../../interfaces/IERC677.sol";
import "../../../interfaces/IERC677Receiver.sol";
import "../../ERC20/extensions/ERC20Internal.sol";
import "@openzeppelin/contracts-0.8/utils/Address.sol";

abstract contract ERC677Extension is ERC20Internal, IERC677 {
    using Address for address;

    /// @notice Transfers tokens to an address with _data if the recipient is a contact.
    /// @param _to The address to transfer to.
    /// @param _value The amount to be transferred.
    /// @param _data The extra data to be passed to the receiving contract.
    function transferAndCall(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external override returns (bool success) {
        _transfer(msg.sender, _to, _value);
        if (_to.isContract()) {
            IERC677Receiver receiver = IERC677Receiver(_to);
            receiver.onTokenTransfer(msg.sender, _value, _data);
        }
        return true;
    }
}
