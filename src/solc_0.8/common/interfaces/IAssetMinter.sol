//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

interface IAssetMinter {
    struct AssetData {
        uint16[] gemIds;
        uint32 quantity;
        uint16 catalystId;
    }

    function mint(
        address from,
        uint40 packId,
        bytes32 metadataHash,
        uint16 catalystId,
        uint16[] calldata gemIds,
        uint32 quantity,
        uint8 rarity,
        address to,
        bytes calldata data
    ) external returns (uint256 assetId);

    function mintMultiple(
        address from,
        uint40 packId,
        bytes32 metadataHash,
        uint256[] memory gemsQuantities,
        uint256[] memory catalystsQuantities,
        AssetData[] memory assets,
        address to,
        bytes memory data
    ) external returns (uint256[] memory assetIds);
}
