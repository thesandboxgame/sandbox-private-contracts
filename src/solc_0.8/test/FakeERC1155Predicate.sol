//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import {IERC1155} from "@openzeppelin/contracts-0.8/token/ERC1155/IERC1155.sol";
import {ERC1155Receiver} from "@openzeppelin/contracts-0.8/token/ERC1155/utils/ERC1155Receiver.sol";

interface IMintableERC1155 is IERC1155 {
    function mint(
        address account,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;

    function mintBatch(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external;
}

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
        IMintableERC1155(asset).safeBatchTransferFrom(depositor, address(this), ids, amounts, data);
    }

    function exitTokens(
        address withdrawer,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public {
        IMintableERC1155 token = IMintableERC1155(asset);
        uint256[] memory balances = token.balanceOfBatch(makeArrayWithAddress(address(this), ids.length), ids);
        (uint256[] memory toBeMinted, bool needMintStep, bool needTransferStep) =
            calculateAmountsToBeMinted(balances, amounts);
        if (needMintStep) {
            token.mintBatch(
                withdrawer,
                ids,
                toBeMinted,
                data // passing data when minting to withdrawer
            );
        }
        if (needTransferStep) {
            token.safeBatchTransferFrom(
                address(this),
                withdrawer,
                ids,
                balances,
                data // passing data when transferring unlocked tokens to withdrawer
            );
        }
    }

    function calculateAmountsToBeMinted(uint256[] memory balances, uint256[] memory exitAmounts)
        internal
        pure
        returns (
            uint256[] memory,
            bool,
            bool
        )
    {
        uint256 count = balances.length;
        require(count == exitAmounts.length, "ChainExitERC1155Predicate: Array length mismatch found");
        uint256[] memory toBeMinted = new uint256[](count);
        bool needMintStep;
        bool needTransferStep;
        for (uint256 i = 0; i < count; i++) {
            if (balances[i] < exitAmounts[i]) {
                toBeMinted[i] = exitAmounts[i] - balances[i];
                needMintStep = true;
            }
            if (balances[i] != 0) {
                needTransferStep = true;
            }
        }
        return (toBeMinted, needMintStep, needTransferStep);
    }

    function makeArrayWithAddress(address addr, uint256 size) internal pure returns (address[] memory) {
        require(addr != address(0), "MintableERC1155Predicate: Invalid address");
        require(size > 0, "MintableERC1155Predicate: Invalid resulting array length");
        address[] memory addresses = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            addresses[i] = addr;
        }
        return addresses;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return 0;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return ERC1155Receiver(address(0)).onERC1155BatchReceived.selector;
    }
}
