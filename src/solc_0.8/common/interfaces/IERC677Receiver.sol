//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface IERC677Receiver {
    function onTokenTransfer(
        address _sender,
        uint256 _value,
        bytes calldata _data
    ) external;
}
