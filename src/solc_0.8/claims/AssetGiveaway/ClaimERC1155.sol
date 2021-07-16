//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "@openzeppelin/contracts-0.8/token/ERC1155/IERC1155.sol";

contract ClaimERC1155 {
    bytes32 internal _merkleRoot;
    IERC1155 internal immutable _asset;
    address internal immutable _assetsHolder;
    event ClaimedAssets(address to, uint256[] assetIds, uint256[] assetValues);

    constructor(IERC1155 asset, address assetsHolder) {
        _asset = asset;
        if (assetsHolder == address(0)) {
            assetsHolder = address(this);
        }
        _assetsHolder = assetsHolder;
    }

    /// @dev See for example AssetGiveaway.sol claimAssets.
    function _claimERC1155(
        address to,
        uint256[] calldata assetIds,
        uint256[] calldata assetValues,
        bytes32[] calldata proof,
        bytes32 salt
    ) internal {
        _checkValidity(to, assetIds, assetValues, proof, salt);
        _sendAssets(to, assetIds, assetValues);
        emit ClaimedAssets(to, assetIds, assetValues);
    }

    function _checkValidity(
        address to,
        uint256[] memory assetIds,
        uint256[] memory assetValues,
        bytes32[] memory proof,
        bytes32 salt
    ) internal view {
        require(assetIds.length == assetValues.length, "INVALID_INPUT");
        bytes32 leaf = _generateClaimHash(to, assetIds, assetValues, salt);
        require(_verify(proof, leaf), "INVALID_CLAIM");
    }

    function _generateClaimHash(
        address to,
        uint256[] memory assetIds,
        uint256[] memory assetValues,
        bytes32 salt
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(to, assetIds, assetValues, salt));
    }

    function _verify(bytes32[] memory proof, bytes32 leaf) internal view returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (computedHash < proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == _merkleRoot;
    }

    function _sendAssets(
        address to,
        uint256[] memory assetIds,
        uint256[] memory assetValues
    ) internal {
        _asset.safeBatchTransferFrom(_assetsHolder, to, assetIds, assetValues, "");
    }
}
