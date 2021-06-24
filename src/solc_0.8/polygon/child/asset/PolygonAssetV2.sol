//SPDX-License-Identifier: MIT
// solhint-disable-next-line compiler-version
pragma solidity 0.8.2;

import "../../../asset/ERC1155ERC721.sol";
import "@openzeppelin/contracts-0.8/utils/Address.sol";

// solhint-disable-next-line no-empty-blocks
contract PolygonAssetV2 is ERC1155ERC721 {
    using Address for address;

    address private _childChainManager;

    event ChainExit(address indexed to, uint256[] tokenIds, uint256[] amounts, bytes data);

    /// @notice fulfills the purpose of a constructor in upgradeabale contracts
    function initialize(
        address trustedForwarder,
        address admin,
        address bouncerAdmin,
        address childChainManager,
        uint8 chainIndex
    ) external {
        require(trustedForwarder.isContract(), "TRUSTERFORWARDER_NOT_CONTRACT");
        require(childChainManager.isContract(), "CHILDCHAINMANAGER_NOT_CONTRACT");
        initV2(trustedForwarder, admin, bouncerAdmin, address(0), chainIndex);
        _childChainManager = childChainManager;
    }

    /// @notice called when tokens are deposited on root chain
    /// @dev Should be callable only by ChildChainManager
    /// @dev Should handle deposit by minting the required tokens for user
    /// @dev Make sure minting is done only by this function
    /// @param user user address for whom deposit is being done
    /// @param depositData abi encoded ids array and amounts array
    function deposit(address user, bytes calldata depositData) external {
        require(_msgSender() == _childChainManager, "!DEPOSITOR");
        require(user != address(0), "INVALID_DEPOSIT_USER");
        (uint256[] memory ids, uint256[] memory amounts, bytes memory data) =
            abi.decode(depositData, (uint256[], uint256[], bytes));
        address sender = _msgSender();
        bytes32[] memory hashes = abi.decode(data, (bytes32[]));
        for (uint256 i = 0; i < ids.length; i++) {
            // @review - any reason to have separate calls to _mint() for ERC721 & ERC1155?
            uint8 rarity = 0;
            _mint(hashes[i], amounts[i], rarity, sender, user, ids[i], data, false);
        }
    }

    /// @notice called when user wants to withdraw tokens back to root chain
    /// @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
    /// @param ids ids to withdraw
    /// @param amounts amounts to withdraw
    function withdraw(uint256[] calldata ids, uint256[] calldata amounts) external {
        bytes32[] memory hashes = new bytes32[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            bytes32 hash = _metadataHash[ids[i] & URI_ID];
            hashes[i] = hash;
        }
        bytes memory data = abi.encode(hashes);
        if (ids.length == 1) {
            _burn(_msgSender(), ids[0], amounts[0]);
        } else {
            _burnBatch(_msgSender(), ids, amounts);
        }
        emit ChainExit(_msgSender(), ids, amounts, data);
    }
}
