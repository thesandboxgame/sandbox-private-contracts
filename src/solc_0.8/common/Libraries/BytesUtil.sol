//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

library BytesUtil {
    /// @dev Check if the data == _address.
    /// @param data The bytes passed to the function.
    /// @param _address The address to compare to.
    /// @return Whether the first param == _address.
    function doFirstParamEqualsAddress(bytes memory data, address _address) internal pure returns (bool) {
        if (data.length < (36 + 32)) {
            return false;
        }
        uint256 value;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            value := mload(add(data, 36))
        }
        return value == uint256(uint160(_address));
    }
}
