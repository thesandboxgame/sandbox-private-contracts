//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface IERC677 {
    function transferAndCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external returns (bool success);
    //TODO: decide whether we use that event, as it collides with ERC20 Transfer event
    //event Transfer(address indexed from, address indexed to, uint256 value, bytes data);
}
