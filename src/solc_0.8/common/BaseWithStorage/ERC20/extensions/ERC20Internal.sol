//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

abstract contract ERC20Internal {
    function _approveFor(
        address owner,
        address target,
        uint256 amount
    ) internal virtual;

    function _addAllowanceIfNeeded(
        address owner,
        address spender,
        uint256 amountNeeded
    ) internal virtual;

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual;
}
