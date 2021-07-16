//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import {SafeERC20} from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";

/// @dev This is NOT a secure ERC20 Predicate contract implementation!
/// DO NOT USE in production.

contract ERC20Predicate {
    address private token;
    using SafeERC20 for IERC20;

    event LockedERC20(
        address indexed depositor,
        address indexed depositReceiver,
        address indexed rootToken,
        uint256 amount
    );

    function setToken(address _token) external {
        token = _token;
    }

    function lockTokens(
        address depositor,
        address depositReceiver,
        bytes calldata depositData
    ) external {
        uint256 amount = abi.decode(depositData, (uint256));
        emit LockedERC20(depositor, depositReceiver, token, amount);
        IERC20(token).safeTransferFrom(depositor, address(this), amount);
    }

    function exitTokens(address withdrawer, uint256 amount) public {
        IERC20(token).safeTransfer(withdrawer, amount);
    }
}
