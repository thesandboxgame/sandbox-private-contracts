//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

interface IAssetUpgrader {
    function extractAndSetCatalyst(
        address from,
        uint256 assetId,
        uint16 catalystId,
        uint16[] calldata gemIds,
        address to
    ) external returns (uint256 tokenId);

    function changeCatalyst(
        address from,
        uint256 assetId,
        uint16 catalystId,
        uint16[] calldata gemIds,
        address to
    ) external returns (uint256 tokenId);

    function addGems(
        address from,
        uint256 assetId,
        uint16[] calldata gemIds,
        address to
    ) external;
}
