//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-0.8/utils/math/SafeMath.sol";
import "../common/interfaces/IAssetMinter.sol";
import "../catalyst/GemsCatalystsRegistry.sol";
import "../common/interfaces//IERC20Extended.sol";
import "../common/interfaces//IAssetToken.sol";
import "../common/BaseWithStorage/WithMetaTransaction.sol";

/// @notice Allow to upgrade Asset with Catalyst, Gems and Sand, giving the assets attributes through AssetAttributeRegistry
contract AssetMinter is WithMetaTransaction, IAssetMinter {
    using SafeMath for uint256;

    uint256 private constant GEM_UNIT = 1000000000000000000;
    uint256 private constant CATALYST_UNIT = 1000000000000000000;

    IAssetAttributesRegistry internal immutable _registry;
    IAssetToken internal immutable _asset;
    GemsCatalystsRegistry internal immutable _gemsCatalystsRegistry;

    /// @notice AssetMinter depends on
    /// @param registry: AssetAttributesRegistry for recording catalyst and gems used
    /// @param asset: Asset Token Contract (dual ERC1155/ERC721)
    /// @param gemsCatalystsRegistry: that track the canonical catalyst and gems and provide batch burning facility
    constructor(
        IAssetAttributesRegistry registry,
        IAssetToken asset,
        GemsCatalystsRegistry gemsCatalystsRegistry,
        address admin
    ) {
        _registry = registry;
        _asset = asset;
        _gemsCatalystsRegistry = gemsCatalystsRegistry;
        _admin = admin;
    }

    /// @notice mint one Asset token.
    /// @param from address creating the Asset, need to be the tx sender or meta tx signer.
    /// @param packId unused packId that will let you predict the resulting tokenId.
    /// @param metadataHash cidv1 ipfs hash of the folder where 0.json file contains the metadata.
    /// @param catalystId Id of the Catalyst ERC20 token to burn (1, 2, 3 or 4).
    /// @param gemIds list of gem ids to burn in the catalyst.
    /// @param quantity asset supply to mint
    /// @param rarity rarity power of the token to mint.
    /// @param to destination address receiving the minted tokens.
    /// @param data extra data.
    /// @return assetId The new token Id.
    function mint(
        address from,
        uint40 packId,
        bytes32 metadataHash,
        uint16 catalystId,
        uint16[] calldata gemIds,
        uint32 quantity,
        uint8 rarity, // TODO remove : rarity is unused so it should be zero, like for mintMultiple
        address to,
        bytes calldata data
    ) external override returns (uint256 assetId) {
        require(to != address(0), "INVALID_TO_ZERO_ADDRESS");
        _checkAuthorization(from);
        assetId = _asset.mint(from, packId, metadataHash, quantity, rarity, to, data);
        if (catalystId != 0) {
            _setSingleCatalyst(from, assetId, quantity, catalystId, gemIds);
        }
        return assetId;
    }

    /// @notice mint multiple Asset tokens.
    /// @param from address creating the Asset, need to be the tx sender or meta tx signer.
    /// @param packId unused packId that will let you predict the resulting tokenId.
    /// @param metadataHash cidv1 ipfs hash of the folder where 0.json file contains the metadata.
    /// @param gemsQuantities quantities of gems to be used for each id in order, ie: [0, 1, 0, 2, 1, 0]
    /// would be gemId1=1, gemId2=0, gemId3=2, gemId4=1, gemId5=0
    /// @param catalystsQuantities quantities of catalyst to be used for each id in order, ie: [0, 1, 0, 3, 0]
    /// would be catalystId1=1, catalystId2=0, catalystId3=3, catalystId4=0,
    /// @param assets contains the data to associate catalyst and gems to the assets.
    /// @param to destination address receiving the minted tokens.
    /// @param data extra data.
    function mintMultiple(
        address from,
        uint40 packId,
        bytes32 metadataHash,
        uint256[] memory gemsQuantities,
        uint256[] memory catalystsQuantities,
        AssetData[] memory assets,
        address to,
        bytes memory data
    ) public override returns (uint256[] memory assetIds) {
        require(assets.length != 0, "INVALID_0_ASSETS");
        require(to != address(0), "INVALID_TO_ZERO_ADDRESS");
        _checkAuthorization(from);
        uint256[] memory supplies = _handleMultipleAssetRequirements(from, gemsQuantities, catalystsQuantities, assets);
        assetIds = _asset.mintMultiple(from, packId, metadataHash, supplies, "", to, data);
        for (uint256 i = 0; i < assetIds.length; i++) {
            if (assets[i].catalystId != 0) {
                _registry.setCatalyst(assetIds[i], assets[i].catalystId, assets[i].gemIds);
            }
        }
        return assetIds;
    }

    /// @dev Handler for edaling with assets when minting multiple at once.
    /// @param from The original address that signed the transaction.
    /// @param gemsQuantities An array listing the quantity of each type of gem.
    /// @param catalystsQuantities An array listing the quantity of each type of catalyst.
    /// @param assets An array of AssetData structs to define how the total gems and catalysts are to be allocated.
    /// @return supplies An array of the quantities for each asset being minted.
    function _handleMultipleAssetRequirements(
        address from,
        uint256[] memory gemsQuantities,
        uint256[] memory catalystsQuantities,
        AssetData[] memory assets
    ) internal returns (uint256[] memory supplies) {
        _batchBurnCatalysts(from, catalystsQuantities);
        _batchBurnGems(from, gemsQuantities);

        supplies = new uint256[](assets.length);

        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i].catalystId != 0) {
                require(catalystsQuantities[assets[i].catalystId] != 0, "INVALID_CATALYST_NOT_ENOUGH");
                uint16 maxGems = _gemsCatalystsRegistry.getMaxGems(assets[i].catalystId);
                require(assets[i].gemIds.length <= maxGems, "INVALID_GEMS_TOO_MANY");
                catalystsQuantities[assets[i].catalystId] = catalystsQuantities[assets[i].catalystId].sub(1);
                gemsQuantities = _checkGemsQuantities(gemsQuantities, assets[i].gemIds);
            }
            supplies[i] = assets[i].quantity;
        }
    }

    /// @dev Validate the quantities of each type of gem passed.
    /// @param gemsQuantities An array of the quantities of each gem type to use for minting assets.
    /// @param gemIds An array of gemIds to use for minting assets.
    /// @return An array of quantities for aech gem type.
    function _checkGemsQuantities(uint256[] memory gemsQuantities, uint16[] memory gemIds)
        internal
        pure
        returns (uint256[] memory)
    {
        for (uint256 i = 0; i < gemIds.length; i++) {
            require(gemsQuantities[gemIds[i]] != 0, "INVALID_GEMS_NOT_ENOUGH");
            gemsQuantities[gemIds[i]] = gemsQuantities[gemIds[i]].sub(1);
        }
        return gemsQuantities;
    }

    /// @dev Burn a batch of catalysts in one tx.
    /// @param from The original address that signed the tx.
    /// @param catalystsQuantities An array of quantities for each type of catalyst to burn.
    function _batchBurnCatalysts(address from, uint256[] memory catalystsQuantities) internal {
        uint16[] memory ids = new uint16[](catalystsQuantities.length);
        for (uint16 i = 0; i < ids.length; i++) {
            ids[i] = i;
        }
        _gemsCatalystsRegistry.batchBurnCatalysts(from, ids, scaleQuantities(catalystsQuantities));
    }

    /// @dev Burn a batch of gems in one tx.
    /// @param from The original address that signed the tx.
    /// @param gemsQuantities An array of quantities for each type of gems to burn.
    function _batchBurnGems(address from, uint256[] memory gemsQuantities) internal {
        uint16[] memory ids = new uint16[](gemsQuantities.length);
        for (uint16 i = 0; i < ids.length; i++) {
            ids[i] = i;
        }
        _gemsCatalystsRegistry.batchBurnGems(from, ids, scaleQuantities(gemsQuantities));
    }

    /// @dev Set a single catalyst for an asset.
    /// @param from The original address that signed the tx.
    /// @param assetId The id of the asset to set a catalyst for.
    /// @param supply The total number of catalysts to be set.
    /// @param catalystId The type of catalyst to set.
    /// @param gemIds An array of gems to be embedded.
    function _setSingleCatalyst(
        address from,
        uint256 assetId,
        uint32 supply,
        uint16 catalystId,
        uint16[] memory gemIds
    ) internal {
        _burnCatalyst(from, catalystId, supply);
        _burnGems(from, gemIds, supply);

        _registry.setCatalyst(assetId, catalystId, gemIds);
    }

    /// @dev Burn an array of gems.
    /// @param from The original signer of the tx.
    /// @param gemIds The array of gems to burn.
    /// @param numTimes Amount of gems to burn.
    function _burnGems(
        address from,
        uint16[] memory gemIds,
        uint32 numTimes
    ) internal {
        _gemsCatalystsRegistry.burnDifferentGems(from, gemIds, numTimes * GEM_UNIT);
    }

    /// @dev Burn a single type of catalyst.
    /// @param from The original signer of the tx.
    /// @param catalystId The type of catalyst to burn.
    /// @param numTimes Amount of catalysts of this type to burn.
    function _burnCatalyst(
        address from,
        uint16 catalystId,
        uint32 numTimes
    ) internal {
        _gemsCatalystsRegistry.burnCatalyst(from, catalystId, numTimes * CATALYST_UNIT);
    }

    /// @dev Scale up each number in an array of quantities by a factor of 1000000000000000000.
    /// @param quantities The array of numbers to scale.
    /// @return scaledQuantities The scaled-up values.
    function scaleQuantities(uint256[] memory quantities) internal pure returns (uint256[] memory scaledQuantities) {
        uint256[] memory scaled = new uint256[](quantities.length);
        for (uint256 i = 0; i < quantities.length; i++) {
            scaled[i] = quantities[i] * GEM_UNIT;
        }
        return scaled;
    }
}
