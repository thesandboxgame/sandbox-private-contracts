//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "../asset/AssetUpgrader.sol";

/// @notice Allow to upgrade Asset with Catalyst, Gems and Sand, giving the assets attributes through AssetAttributeRegistry
contract AssetUpgraderFeeBurner is AssetUpgrader {
    constructor(
        IAssetAttributesRegistry registry,
        IERC20Extended sand,
        IAssetToken asset,
        GemsCatalystsRegistry gemsCatalystsRegistry,
        uint256 _upgradeFee,
        uint256 _gemAdditionFee,
        address _feeRecipient
    )
        AssetUpgrader(registry, sand, asset, gemsCatalystsRegistry, _upgradeFee, _gemAdditionFee, _feeRecipient)
    // solhint-disable-next-line no-empty-blocks
    {

    }
}
