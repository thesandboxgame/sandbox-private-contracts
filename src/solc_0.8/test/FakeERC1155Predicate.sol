//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import {IERC1155} from "@openzeppelin/contracts-0.8/token/ERC1155/IERC1155.sol";
import {ERC1155Receiver} from "@openzeppelin/contracts-0.8/token/ERC1155/utils/ERC1155Receiver.sol";

/// @dev This is NOT a secure ChildChainManager contract implementation!
/// DO NOT USE in production.

contract ERC1155Predicate is ERC1155Receiver {
    address private asset;

    function setAsset(address _asset) external {
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
    
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external override pure returns (bytes4) {
        return 0;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external override pure returns (bytes4) {
        return ERC1155Receiver(address(0)).onERC1155BatchReceived.selector;
    }
}
