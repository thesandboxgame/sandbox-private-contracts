//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "@openzeppelin/contracts-0.8/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts-0.8/token/ERC1155/IERC1155Receiver.sol";
import "./ClaimERC1155.sol";
import "../../common/BaseWithStorage/WithAdmin.sol";

/// @title AssetGiveaway contract.
/// @notice This contract manages ERC1155 claims.
contract AssetGiveaway is WithAdmin, ClaimERC1155 {
    bytes4 private constant ERC1155_RECEIVED = 0xf23a6e61;
    bytes4 private constant ERC1155_BATCH_RECEIVED = 0xbc197c81;
    uint256 internal immutable _expiryTime;
    mapping(address => bool) public claimed;

    constructor(
        address asset,
        address admin,
        bytes32 merkleRoot,
        address assetsHolder,
        uint256 expiryTime
    ) ClaimERC1155(IERC1155(asset), assetsHolder) {
        _admin = admin;
        _merkleRoot = merkleRoot;
        _expiryTime = expiryTime;
    }

    /// @notice Function to set the merkle root hash for the asset data, if it is 0.
    /// @param merkleRoot The merkle root hash of the asset data.
    function setMerkleRoot(bytes32 merkleRoot) external onlyAdmin {
        require(_merkleRoot == 0, "MERKLE_ROOT_ALREADY_SET");
        _merkleRoot = merkleRoot;
    }

    /// @notice Function to permit the claiming of an asset to a reserved address.
    /// @param to The intended recipient (reserved address) of the ERC1155 tokens.
    /// @param assetIds The array of IDs of the asset tokens.
    /// @param assetValues The amounts of each token ID to transfer.
    /// @param proof The proof submitted for verification.
    /// @param salt The salt submitted for verification.
    function claimAssets(
        address to,
        uint256[] calldata assetIds,
        uint256[] calldata assetValues,
        bytes32[] calldata proof,
        bytes32 salt
    ) external {
        require(block.timestamp < _expiryTime, "CLAIM_PERIOD_IS_OVER");
        require(to != address(0), "INVALID_TO_ZERO_ADDRESS");
        require(claimed[to] == false, "DESTINATION_ALREADY_CLAIMED");
        claimed[to] = true;
        _claimERC1155(to, assetIds, assetValues, proof, salt);
    }

    function onERC1155Received(
        address, /*operator*/
        address, /*from*/
        uint256, /*id*/
        uint256, /*value*/
        bytes calldata /*data*/
    ) external pure returns (bytes4) {
        return ERC1155_RECEIVED;
    }

    function onERC1155BatchReceived(
        address, /*operator*/
        address, /*from*/
        uint256[] calldata, /*ids*/
        uint256[] calldata, /*values*/
        bytes calldata /*data*/
    ) external pure returns (bytes4) {
        return ERC1155_BATCH_RECEIVED;
    }
}
