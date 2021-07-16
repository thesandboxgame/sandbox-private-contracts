//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "../asset/AssetAttributesRegistry.sol";

/// @notice Allows setting the gems and catalysts of an asset
contract MockAssetAttributesRegistry is AssetAttributesRegistry {
    uint256 private constant IS_NFT = 0x0000000000000000000000000000000000000000800000000000000000000000;

    constructor(
        GemsCatalystsRegistry gemsCatalystsRegistry,
        address admin,
        address minter,
        address upgrader
    )
        AssetAttributesRegistry(gemsCatalystsRegistry, admin, minter, upgrader)
    // solhint-disable-next-line no-empty-blocks
    {

    }

    function setCatalyst(
        uint256 assetId,
        uint16 catalystId,
        uint16[] calldata gemIds
    ) external override {
        // @note access control removed for testing
        _setCatalyst(assetId, catalystId, gemIds, _getBlockNumber());
    }

    function _setCatalyst(
        uint256 assetId,
        uint16 catalystId,
        uint16[] memory gemIds,
        uint64 blockNumber
    ) internal override {
        // @note access control removed for testing
        require(gemIds.length <= MAX_NUM_GEMS, "GEMS_MAX_REACHED");
        uint8 maxGems = _gemsCatalystsRegistry.getMaxGems(catalystId);
        require(gemIds.length <= maxGems, "GEMS_TOO_MANY");
        uint16[MAX_NUM_GEMS] memory gemIdsToStore;
        for (uint8 i = 0; i < gemIds.length; i++) {
            require(gemIds[i] != 0, "INVALID_GEM_ID");
            gemIdsToStore[i] = gemIds[i];
        }
        _records[assetId] = Record(catalystId, gemIdsToStore);
        emit CatalystApplied(assetId, catalystId, gemIds, blockNumber);
    }

    function addGems(uint256 assetId, uint16[] calldata gemIds) external override {
        // @note removed access control for ease of testing.
        require(assetId & IS_NFT != 0, "INVALID_NOT_NFT");
        require(gemIds.length != 0, "INVALID_GEMS_0");

        uint16 catalystId = _records[assetId].catalystId;
        uint16[MAX_NUM_GEMS] memory gemIdsToStore;
        if (catalystId == 0) {
            // fallback on collection catalyst
            uint256 collectionId = _getCollectionId(assetId);
            catalystId = _records[collectionId].catalystId;
            if (catalystId != 0) {
                _records[assetId].catalystId = catalystId;
                gemIdsToStore = _records[collectionId].gemIds;
            }
        } else {
            gemIdsToStore = _records[assetId].gemIds;
        }

        require(catalystId != 0, "NO_CATALYST_SET");
        uint8 j = 0;
        uint8 i = 0;
        for (i = 0; i < MAX_NUM_GEMS; i++) {
            if (j == gemIds.length) {
                break;
            }
            if (gemIdsToStore[i] == 0) {
                require(gemIds[j] != 0, "INVALID_GEM_ID");
                gemIdsToStore[i] = gemIds[j];
                j++;
            }
        }
        uint8 maxGems = _gemsCatalystsRegistry.getMaxGems(catalystId);
        require(i <= maxGems, "GEMS_TOO_MANY");
        _records[assetId].gemIds = gemIdsToStore;
        uint64 blockNumber = _getBlockNumber();
        emit GemsAdded(assetId, gemIds, blockNumber);
    }
}
