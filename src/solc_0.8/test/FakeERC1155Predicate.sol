//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import {IERC1155} from "@openzeppelin/contracts-0.8/token/ERC1155/IERC1155.sol";

/// @dev This is NOT a secure ChildChainManager contract implementation!
/// DO NOT USE in production.

contract ERC1155Predicate {
    address private asset;

    constructor(address _asset) {
        asset = _asset;
    }

    function lockTokens(
        address depositor,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external {
        IERC1155(asset).safeBatchTransferFrom(depositor, address(this), ids, amounts, data);
    }

    function exitTokens(
        address withdrawer,
        uint256[] memory ids,
        uint256[] memory amounts
    ) public {
        IERC1155(asset).safeBatchTransferFrom(address(this), withdrawer, ids, amounts, bytes(""));
    }
}
