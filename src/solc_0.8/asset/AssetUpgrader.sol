//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "@openzeppelin/contracts-0.8/utils/math/SafeMath.sol";
import "../common/interfaces/IAssetAttributesRegistry.sol";
import "../common/interfaces/IAssetUpgrader.sol";
import "../catalyst/GemsCatalystsRegistry.sol";
import "../common/interfaces/IERC20Extended.sol";
import "../common/interfaces/IAssetToken.sol";
import "../common/BaseWithStorage/WithMetaTransaction.sol";

/// @notice Allow to upgrade Asset with Catalyst, Gems and Sand, giving the assets attributes through AssetAttributeRegistry
contract AssetUpgrader is WithMetaTransaction, IAssetUpgrader {
    using SafeMath for uint256;

    address public immutable feeRecipient;
    uint256 public immutable upgradeFee;
    uint256 public immutable gemAdditionFee;
    uint256 private constant GEM_UNIT = 1000000000000000000;
    uint256 private constant CATALYST_UNIT = 1000000000000000000;
    uint256 private constant IS_NFT = 0x0000000000000000000000000000000000000000800000000000000000000000;
    address private constant BURN_ADDRESS = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;

    IERC20Extended internal immutable _sand;
    IAssetAttributesRegistry internal immutable _registry;
    IAssetToken internal immutable _asset;
    GemsCatalystsRegistry internal immutable _gemsCatalystsRegistry;

    /// @notice AssetUpgrader depends on
    /// @param registry: AssetAttributesRegistry for recording catalyst and gems used
    /// @param sand: ERC20 for fee payment
    /// @param asset: Asset Token Contract (dual ERC1155/ERC721)
    /// @param gemsCatalystsRegistry: that track the canonical catalyst and gems and provide batch burning facility
    /// @param _upgradeFee: the fee in Sand paid for an upgrade (setting or replacing a catalyst)
    /// @param _gemAdditionFee: the fee in Sand paid for adding gems
    /// @param _feeRecipient: address receiving the Sand fee
    constructor(
        IAssetAttributesRegistry registry,
        IERC20Extended sand,
        IAssetToken asset,
        GemsCatalystsRegistry gemsCatalystsRegistry,
        uint256 _upgradeFee,
        uint256 _gemAdditionFee,
        address _feeRecipient
    ) {
        _registry = registry;
        _sand = sand;
        _asset = asset;
        _gemsCatalystsRegistry = gemsCatalystsRegistry;
        upgradeFee = _upgradeFee;
        gemAdditionFee = _gemAdditionFee;
        feeRecipient = _feeRecipient;
    }

    /// @notice associate a catalyst to a fungible Asset token by extracting it as ERC721 first.
    /// @param from address from which the Asset token belongs to.
    /// @param assetId tokenId of the Asset being extracted.
    /// @param catalystId address of the catalyst token to use and burn.
    /// @param gemIds list of gems to socket into the catalyst (burned).
    /// @param to destination address receiving the extracted and upgraded ERC721 Asset token.
    /// @return tokenId The Id of the extracted token.
    function extractAndSetCatalyst(
        address from,
        uint256 assetId,
        uint16 catalystId,
        uint16[] calldata gemIds,
        address to
    ) external override returns (uint256 tokenId) {
        require(to != address(0), "INVALID_TO_ZERO_ADDRESS");
        _checkAuthorization(from);
        tokenId = _asset.extractERC721From(from, assetId, from);
        _changeCatalyst(from, tokenId, catalystId, gemIds, to);
    }

    // TODO tests
    // function extractAndAddGems(
    //     address from,
    //     uint256 assetId,
    //     uint16[] calldata gemIds,
    //     address to
    // ) external override returns (uint256 tokenId) {
    //     require(to != address(0), "INVALID_TO_ZERO_ADDRESS");
    //     _checkAuthorization(from);
    //     tokenId = _asset.extractERC721From(from, assetId, from);
    //     _addGems(from, assetId, gemIds, to);
    // }

    /// @notice associate a new catalyst to a non-fungible Asset token.
    /// @param from address from which the Asset token belongs to.
    /// @param assetId tokenId of the Asset being updated.
    /// @param catalystId address of the catalyst token to use and burn.
    /// @param gemIds list of gems to socket into the catalyst (burned).
    /// @param to destination address receiving the Asset token.
    /// @return tokenId The id of the asset.
    function changeCatalyst(
        address from,
        uint256 assetId,
        uint16 catalystId,
        uint16[] calldata gemIds,
        address to
    ) external override returns (uint256 tokenId) {
        require(to != address(0), "INVALID_TO_ZERO_ADDRESS");
        _checkAuthorization(from);
        _changeCatalyst(from, assetId, catalystId, gemIds, to);
        return assetId;
    }

    /// @notice add gems to a non-fungible Asset token.
    /// @param from address from which the Asset token belongs to.
    /// @param assetId tokenId of the Asset to which the gems will be added to.
    /// @param gemIds list of gems to socket into the existing catalyst (burned).
    /// @param to destination address receiving the extracted and upgraded ERC721 Asset token.
    function addGems(
        address from,
        uint256 assetId,
        uint16[] calldata gemIds,
        address to
    ) external override {
        require(to != address(0), "INVALID_TO_ZERO_ADDRESS");
        _checkAuthorization(from);
        _addGems(from, assetId, gemIds, to);
    }

    /// @dev Collect a fee in SAND tokens
    /// @param from The address paying the fee.
    /// @param sandFee The fee amount.
    function _chargeSand(address from, uint256 sandFee) internal {
        if (feeRecipient != address(0) && sandFee != 0) {
            if (feeRecipient == address(BURN_ADDRESS)) {
                // special address for burn
                _sand.burnFor(from, sandFee);
            } else {
                _sand.transferFrom(from, feeRecipient, sandFee);
            }
        }
    }

    /// @dev Change the catalyst for an asset.
    /// @param from The current owner of the asset.
    /// @param assetId The id of the asset to change.
    /// @param catalystId The id of the new catalyst to set.
    /// @param gemIds An array of gemIds to embed.
    /// @param to The address to transfer the asset to after the catalyst is changed.
    function _changeCatalyst(
        address from,
        uint256 assetId,
        uint16 catalystId,
        uint16[] memory gemIds,
        address to
    ) internal {
        require(assetId & IS_NFT != 0, "INVALID_NOT_NFT"); // Asset (ERC1155ERC721.sol) ensure NFT will return true here and non-NFT will return false
        _burnCatalyst(from, catalystId);
        _burnGems(from, gemIds);
        _chargeSand(from, upgradeFee);
        _registry.setCatalyst(assetId, catalystId, gemIds);
        _transfer(from, to, assetId);
    }

    /// @dev Add gems to an existing asset.
    /// @param from The current owner of the asset.
    /// @param assetId The asset to add gems to.
    /// @param gemIds An array of gemIds to add to the asset.
    /// @param to The address to transfer the asset to after adding gems.
    function _addGems(
        address from,
        uint256 assetId,
        uint16[] memory gemIds,
        address to
    ) internal {
        require(assetId & IS_NFT != 0, "INVALID_NOT_NFT"); // Asset (ERC1155ERC721.sol) ensure NFT will return true here and non-NFT will return false
        _burnGems(from, gemIds);
        _chargeSand(from, gemAdditionFee);
        _registry.addGems(assetId, gemIds);
        _transfer(from, to, assetId);
    }

    /// @dev transfer an asset if from != to.
    /// @param from The address to transfer the asset from.
    /// @param to The address to transfer the asset to.
    /// @param assetId The asset to transfer.
    function _transfer(
        address from,
        address to,
        uint256 assetId
    ) internal {
        if (from != to) {
            _asset.safeTransferFrom(from, to, assetId);
        } else {
            require(_asset.balanceOf(from, assetId) > 0, "NOT_AUTHORIZED_ASSET_OWNER");
        }
    }

    /// @dev Burn gems.
    /// @param from The owner of the gems.
    /// @param gemIds The gem types to burn.
    function _burnGems(address from, uint16[] memory gemIds) internal {
        _gemsCatalystsRegistry.burnDifferentGems(from, gemIds, GEM_UNIT);
    }

    /// @dev Burn a catalyst.
    /// @param from The owner of the catalyst.
    /// @param catalystId The catalyst type to burn.
    function _burnCatalyst(address from, uint16 catalystId) internal {
        _gemsCatalystsRegistry.burnCatalyst(from, catalystId, CATALYST_UNIT);
    }
}
