//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "./Gem.sol";
import "./Catalyst.sol";
import "./interfaces/IGemsCatalystsRegistry.sol";
import "../common/BaseWithStorage/WithSuperOperators.sol";
import "../common/BaseWithStorage/WithMetaTransaction.sol";

/// @notice Contract managing the Gems and Catalysts
/// Each Gems and Catalys must be registered here.
/// Each new Gem get assigned a new id (starting at 1)
/// Each new Catalyst get assigned a new id (starting at 1)
contract GemsCatalystsRegistry is WithSuperOperators, WithMetaTransaction, IGemsCatalystsRegistry {
    Gem[] internal _gems;
    Catalyst[] internal _catalysts;

    constructor(address admin) {
        _admin = admin;
    }

    /// @notice Returns the values for each gem included in a given asset.
    /// @param catalystId The catalyst identifier.
    /// @param assetId The asset tokenId.
    /// @param events An array of GemEvents. Be aware that only gemEvents from the last CatalystApplied event onwards should be used to populate a query. If gemEvents from multiple CatalystApplied events are included the output values will be incorrect.
    /// @return values An array of values for each gem present in the asset.
    function getAttributes(
        uint16 catalystId,
        uint256 assetId,
        IAssetAttributesRegistry.GemEvent[] calldata events
    ) external view override returns (uint32[] memory values) {
        Catalyst catalyst = getCatalyst(catalystId);
        require(catalyst != Catalyst(address(0)), "CATALYST_DOES_NOT_EXIST");
        return catalyst.getAttributes(assetId, events);
    }

    /// @notice Returns the maximum number of gems for a given catalyst
    /// @param catalystId catalyst identifier
    function getMaxGems(uint16 catalystId) external view override returns (uint8) {
        Catalyst catalyst = getCatalyst(catalystId);
        require(catalyst != Catalyst(address(0)), "CATALYST_DOES_NOT_EXIST");
        return catalyst.getMaxGems();
    }

    /// @notice Burns one gem unit from each gem id on behalf of a beneficiary
    /// @param from address of the beneficiary to burn on behalf of
    /// @param gemIds list of gems to burn one gem from each
    /// @param amount amount units to burn
    function burnDifferentGems(
        address from,
        uint16[] calldata gemIds,
        uint256 amount
    ) external override {
        for (uint256 i = 0; i < gemIds.length; i++) {
            burnGem(from, gemIds[i], amount);
        }
    }

    /// @notice Burns one catalyst unit from each catalyst id on behalf of a beneficiary
    /// @param from address of the beneficiary to burn on behalf of
    /// @param catalystIds list of catalysts to burn one catalyst from each
    /// @param amount amount to burn
    function burnDifferentCatalysts(
        address from,
        uint16[] calldata catalystIds,
        uint256 amount
    ) external override {
        for (uint256 i = 0; i < catalystIds.length; i++) {
            burnCatalyst(from, catalystIds[i], amount);
        }
    }

    /// @notice Burns few gem units from each gem id on behalf of a beneficiary
    /// @param from address of the beneficiary to burn on behalf of
    /// @param gemIds list of gems to burn gem units from each
    /// @param amounts list of amounts of units to burn
    function batchBurnGems(
        address from,
        uint16[] calldata gemIds,
        uint256[] calldata amounts
    ) public override {
        for (uint256 i = 0; i < gemIds.length; i++) {
            if (gemIds[i] != 0 && amounts[i] != 0) {
                burnGem(from, gemIds[i], amounts[i]);
            }
        }
    }

    /// @notice Burns few catalyst units from each catalyst id on behalf of a beneficiary
    /// @param from address of the beneficiary to burn on behalf of
    /// @param catalystIds list of catalysts to burn catalyst units from each
    /// @param amounts list of amounts of units to burn
    function batchBurnCatalysts(
        address from,
        uint16[] calldata catalystIds,
        uint256[] calldata amounts
    ) public override {
        for (uint256 i = 0; i < catalystIds.length; i++) {
            if (catalystIds[i] != 0 && amounts[i] != 0) {
                burnCatalyst(from, catalystIds[i], amounts[i]);
            }
        }
    }

    /// @notice Adds both arrays of gems and catalysts to registry
    /// @param gems array of gems to be added
    /// @param catalysts array of catalysts to be added
    function addGemsAndCatalysts(Gem[] calldata gems, Catalyst[] calldata catalysts) external override {
        require(msg.sender == _admin, "NOT_AUTHORIZED");
        for (uint256 i = 0; i < gems.length; i++) {
            Gem gem = gems[i];
            uint16 gemId = gem.gemId();
            require(gemId == _gems.length + 1, "GEM_ID_NOT_IN_ORDER");
            _gems.push(gem);
        }

        for (uint256 i = 0; i < catalysts.length; i++) {
            Catalyst catalyst = catalysts[i];
            uint16 catalystId = catalyst.catalystId();
            require(catalystId == _catalysts.length + 1, "CATALYST_ID_NOT_IN_ORDER");
            _catalysts.push(catalyst);
        }
    }

    /// @notice Query whether a given gem exists.
    /// @param gemId The gem being queried.
    /// @return Whether the gem exists.
    function doesGemExist(uint16 gemId) external view override returns (bool) {
        return getGem(gemId) != Gem(address(0));
    }

    /// @notice Query whether a giving catalyst exists.
    /// @param catalystId The catalyst being queried.
    /// @return Whether the catalyst exists.
    function doesCatalystExist(uint16 catalystId) external view returns (bool) {
        return getCatalyst(catalystId) != Catalyst(address(0));
    }

    /// @notice Burn a catalyst.
    /// @param from The signing address for the tx.
    /// @param catalystId The id of the catalyst to burn.
    /// @param amount The number of catalyst tokens to burn.
    function burnCatalyst(
        address from,
        uint16 catalystId,
        uint256 amount
    ) public override {
        _checkAuthorization(from);
        Catalyst catalyst = getCatalyst(catalystId);
        require(catalyst != Catalyst(address(0)), "CATALYST_DOES_NOT_EXIST");
        catalyst.burnFor(from, amount);
    }

    /// @notice Burn a gem.
    /// @param from The signing address for the tx.
    /// @param gemId The id of the gem to burn.
    /// @param amount The number of gem tokens to burn.
    function burnGem(
        address from,
        uint16 gemId,
        uint256 amount
    ) public override {
        _checkAuthorization(from);
        Gem gem = getGem(gemId);
        require(gem != Gem(address(0)), "GEM_DOES_NOT_EXIST");
        gem.burnFor(from, amount);
    }

    // //////////////////// INTERNALS ////////////////////

    /// @dev Get the catalyst contract corresponding to the id.
    /// @param catalystId The catalyst id to use to retrieve the contract.
    /// @return The requested Catalyst contract.
    function getCatalyst(uint16 catalystId) internal view returns (Catalyst) {
        if (catalystId > 0 && catalystId <= _catalysts.length) {
            return _catalysts[catalystId - 1];
        } else {
            return Catalyst(address(0));
        }
    }

    /// @dev Get the gem contract corresponding to the id.
    /// @param gemId The gem id to use to retrieve the contract.
    /// @return The requested Gem contract.
    function getGem(uint16 gemId) internal view returns (Gem) {
        if (gemId > 0 && gemId <= _gems.length) {
            return _gems[gemId - 1];
        } else {
            return Gem(address(0));
        }
    }

    /// @dev verify that the caller is authorized for this function call.
    /// @param from The original signer of the transaction.
    function _checkAuthorization(address from) internal view override {
        require(msg.sender == from || _isValidMetaTx(from) || isSuperOperator(msg.sender), "AUTH_ACCESS_DENIED");
    }
}
