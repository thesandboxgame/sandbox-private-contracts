//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "../interfaces/IAssetAttributesRegistry.sol";

interface IAttributes {
    function getAttributes(uint256 assetId, IAssetAttributesRegistry.GemEvent[] calldata events)
        external
        view
        returns (uint32[] memory values);
}
