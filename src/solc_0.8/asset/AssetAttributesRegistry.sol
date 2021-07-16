//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "../catalyst/GemsCatalystsRegistry.sol";
import "../common/BaseWithStorage/WithAdmin.sol";
import "../common/BaseWithStorage/WithMinter.sol";
import "../common/BaseWithStorage/WithUpgrader.sol";

/// @notice Allows setting the gems and catalysts of an asset
contract AssetAttributesRegistry is WithMinter, WithUpgrader, IAssetAttributesRegistry {
    uint256 internal constant MAX_NUM_GEMS = 15;
    uint256 private constant IS_NFT = 0x0000000000000000000000000000000000000000800000000000000000000000;
    uint256 private constant NOT_IS_NFT = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF7FFFFFFFFFFFFFFFFFFFFFFF;
    uint256 private constant NOT_NFT_INDEX = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF800000007FFFFFFFFFFFFFFF;

    GemsCatalystsRegistry internal immutable _gemsCatalystsRegistry;
    mapping(uint256 => Record) internal _records;

    // used to allow migration to specify blockNumber when setting catalyst/gems
    address public migrationContract;

    struct Record {
        uint16 catalystId; // start at 1
        uint16[MAX_NUM_GEMS] gemIds;
    }

    event CatalystApplied(uint256 indexed assetId, uint16 indexed catalystId, uint16[] gemIds, uint64 blockNumber);
    event GemsAdded(uint256 indexed assetId, uint16[] gemIds, uint64 blockNumber);

    /// @notice AssetAttributesRegistry depends on
    /// @param gemsCatalystsRegistry: GemsCatalystsRegistry for fetching attributes
    /// @param admin: for setting the migration contract address
    /// @param minter: allowed to set gems and catalysts for a given asset
    constructor(
        GemsCatalystsRegistry gemsCatalystsRegistry,
        address admin,
        address minter,
        address upgrader
    ) {
        _gemsCatalystsRegistry = gemsCatalystsRegistry;
        _admin = admin;
        _minter = minter;
        _upgrader = upgrader;
    }

    /// @notice get the record data (catalyst id, gems ids list) for an asset id
    /// @param assetId id of the asset
    function getRecord(uint256 assetId)
        external
        view
        override
        returns (
            bool exists,
            uint16 catalystId,
            uint16[] memory gemIds
        )
    {
        catalystId = _records[assetId].catalystId;
        if (catalystId == 0 && assetId & IS_NFT != 0) {
            // fallback on collection catalyst
            assetId = _getCollectionId(assetId);
            catalystId = _records[assetId].catalystId;
        }
        uint16[MAX_NUM_GEMS] memory fixedGemIds = _records[assetId].gemIds;
        exists = catalystId != 0;
        gemIds = new uint16[](MAX_NUM_GEMS);
        uint8 i = 0;
        while (fixedGemIds[i] != 0) {
            gemIds[i] = (fixedGemIds[i]);
            i++;
        }
    }

    /// @notice getAttributes
    /// @param assetId id of the asset
    /// @return values The array of values(256) requested.
    function getAttributes(uint256 assetId, GemEvent[] calldata events)
        external
        view
        override
        returns (uint32[] memory values)
    {
        return _gemsCatalystsRegistry.getAttributes(_records[assetId].catalystId, assetId, events);
    }

    /// @notice sets the catalyst and gems for an asset, minter only
    /// @param assetId id of the asset
    /// @param catalystId id of the catalyst to set
    /// @param gemIds list of gems ids to set
    function setCatalyst(
        uint256 assetId,
        uint16 catalystId,
        uint16[] calldata gemIds
    ) external virtual override {
        require(msg.sender == _minter || msg.sender == _upgrader, "NOT_AUTHORIZED_MINTER");
        _setCatalyst(assetId, catalystId, gemIds, _getBlockNumber());
    }

    /// @notice sets the catalyst and gems for an asset for a given block number, migration contract only
    /// @param assetId id of the asset
    /// @param catalystId id of the catalyst to set
    /// @param gemIds list of gems ids to set
    /// @param blockNumber block number
    function setCatalystWithBlockNumber(
        uint256 assetId,
        uint16 catalystId,
        uint16[] calldata gemIds,
        uint64 blockNumber
    ) external override {
        require(msg.sender == migrationContract, "NOT_AUTHORIZED_MIGRATION");
        _setCatalyst(assetId, catalystId, gemIds, blockNumber);
    }

    /// @notice adds gems to an existing list of gems of an asset, minter only
    /// @param assetId id of the asset
    /// @param gemIds list of gems ids to set
    function addGems(uint256 assetId, uint16[] calldata gemIds) external virtual override {
        require(msg.sender == _upgrader, "NOT_AUTHORIZED_UPGRADER");
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

    /// @notice set the migratcion contract address, admin or migration contract only
    /// @param _migrationContract address of the migration contract
    function setMigrationContract(address _migrationContract) external override {
        address currentMigrationContract = migrationContract;
        if (currentMigrationContract == address(0)) {
            require(msg.sender == _admin, "NOT_AUTHORIZED");
            migrationContract = _migrationContract;
        } else {
            require(msg.sender == currentMigrationContract, "NOT_AUTHORIZED_MIGRATION");
            migrationContract = _migrationContract;
        }
    }

    /// @dev Set a catalyst for the given asset.
    /// @param assetId The asset to set a catalyst on.
    /// @param catalystId The catalyst to set.
    /// @param gemIds The gems to embed in the catalyst.
    /// @param blockNumber The blocknumber to emit in the event.
    function _setCatalyst(
        uint256 assetId,
        uint16 catalystId,
        uint16[] memory gemIds,
        uint64 blockNumber
    ) internal virtual {
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

    /// @dev Get the collection Id for an asset.
    /// @param assetId The asset to get the collection id for.
    /// @return The id of the collection the asset belongs to.
    function _getCollectionId(uint256 assetId) internal pure returns (uint256) {
        return assetId & NOT_NFT_INDEX & NOT_IS_NFT; // compute the same as Asset to get collectionId
    }

    /// @dev Get a blocknumber for use when querying attributes.
    /// @return blockNumber The current blocknumber + 1.
    function _getBlockNumber() internal view returns (uint64 blockNumber) {
        blockNumber = uint64(block.number + 1);
    }
}
