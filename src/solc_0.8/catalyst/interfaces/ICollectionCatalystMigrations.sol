//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

interface ICollectionCatalystMigrations {
    struct Migration {
        uint256 assetId;
        uint16[] gemIds;
        uint64 blockNumber;
    }

    function migrate(
        uint256 assetId,
        uint16[] calldata gemIds,
        uint64 blockNumber
    ) external;

    function batchMigrate(Migration[] calldata migrations) external;
}
