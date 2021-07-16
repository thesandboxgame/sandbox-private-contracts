// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "../common/BaseWithStorage/ERC20/extensions/ERC20ExecuteExtension.sol";
import "../common/BaseWithStorage/ERC20/extensions/ERC20BasicApproveExtension.sol";
import "../common/BaseWithStorage/ERC20/ERC20BaseToken.sol";

contract SandBaseToken is ERC20BaseToken, ERC20ExecuteExtension, ERC20BasicApproveExtension {
    constructor(
        address sandAdmin,
        address executionAdmin,
        address beneficiary,
        uint256 amount
    ) ERC20BaseToken("SAND", "SAND", sandAdmin, executionAdmin) {
        _admin = sandAdmin;
        _executionAdmin = executionAdmin;
        if (beneficiary != address(0)) {
            uint256 initialSupply = amount * (1 ether);
            _mint(beneficiary, initialSupply);
        }
    }
}
