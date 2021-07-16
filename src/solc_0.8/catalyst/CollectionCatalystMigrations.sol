//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "./interfaces/IOldCatalystRegistry.sol";
import "./interfaces/IAssetAttributesRegistry.sol";
import "./interfaces/ICollectionCatalystMigrations.sol";
import "../common/interfaces/IAssetToken.sol";
import "../common/BaseWithStorage/WithAdmin.sol";

/// @notice Contract performing migrations for collections, do not require owner approval
contract CollectionCatalystMigrations is WithAdmin, ICollectionCatalystMigrations {
    uint256 private constant IS_NFT = 0x0000000000000000000000000000000000000000800000000000000000000000;

    IOldCatalystRegistry internal immutable _oldRegistry;
    IAssetAttributesRegistry internal immutable _registry;
    IAssetToken internal immutable _asset;

    /// @notice CollectionCatalystMigrations depends on:
    /// @param asset: Asset Token Contract
    /// @param registry: New AssetAttributesRegistry
    /// @param oldRegistry: Old CatalystRegistry
    /// @param admin: Contract admin
    constructor(
        IAssetToken asset,
        IAssetAttributesRegistry registry,
        IOldCatalystRegistry oldRegistry,
        address admin
    ) {
        _oldRegistry = oldRegistry;
        _asset = asset;
        _registry = registry;
        _admin = admin;
    }

    /// @notice Migrate the catalyst for a collection of assets.
    /// @param assetId The id of the asset for which the catalyst is being migrated.
    /// @param oldGemIds The gems currently embedded in the catalyst (old gems count starts from 0)
    /// @param blockNumber The blocknumber to use when setting the catalyst.
    function migrate(
        uint256 assetId,
        uint16[] calldata oldGemIds,
        uint64 blockNumber
    ) external override {
        require(msg.sender == _admin, "NOT_AUTHORIZED");
        _migrate(assetId, oldGemIds, blockNumber);
    }

    /// @notice Migrate the catalysts for a batch of assets.
    /// @param migrations The data to use for each migration in the batch.
    function batchMigrate(Migration[] calldata migrations) external override {
        require(msg.sender == _admin, "NOT_AUTHORIZED");
        for (uint256 i = 0; i < migrations.length; i++) {
            _migrate(migrations[i].assetId, migrations[i].gemIds, migrations[i].blockNumber);
        }
    }

    /// @notice Set the registry migration contract
    /// @param migrationContract The migration contract for AssetAttributesRegistry
    function setAssetAttributesRegistryMigrationContract(address migrationContract) external {
        require(msg.sender == _admin, "NOT_AUTHORIZED");
        _registry.setMigrationContract(migrationContract);
    }

    /// @dev Perform the migration of the catalyst. See `migrate(...)`
    function _migrate(
        uint256 assetId,
        uint16[] memory oldGemIds,
        uint64 blockNumber
    ) internal {
        (bool oldExists, uint256 oldCatalystId) = _oldRegistry.getCatalyst(assetId);
        require(oldExists, "OLD_CATALYST_NOT_EXIST");
        (bool exists, , ) = _registry.getRecord(assetId);
        require(!exists, "ALREADY_MIGRATED");
        oldCatalystId += 1; // old catalyst start from 0 , new one start with common = 1
        if (assetId & IS_NFT != 0) {
            // ensure this NFT has no collection: original NFT
            // If it has, the collection itself need to be migrated
            try _asset.collectionOf(assetId) returns (uint256 collId) {
                require(collId == 0, "NOT_ORIGINAL_NFT");
                // solhint-disable-next-line no-empty-blocks
            } catch {}
        }
        // old gems started from 0, new gems starts with power = 1
        for (uint256 i = 0; i < oldGemIds.length; i++) {
            oldGemIds[i] += 1;
        }
        _registry.setCatalystWithBlockNumber(assetId, uint16(oldCatalystId), oldGemIds, blockNumber);
    }
}
