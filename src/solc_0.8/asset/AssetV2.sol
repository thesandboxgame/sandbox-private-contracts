//SPDX-License-Identifier: MIT
// solhint-disable-next-line compiler-version
pragma solidity 0.8.2;

import "./ERC1155ERC721.sol";

// solhint-disable-next-line no-empty-blocks
contract AssetV2 is ERC1155ERC721 {
    /// @notice called by predicate to mint tokens transferred from L2
    /// @param to address to mint to
    /// @param ids ids to mint
    /// @param amounts supply for each token type
    /// @param data extra data to accompany the minting call
    function mintBatch(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external {
        require(_msgSender() == _predicate, "!PREDICATE");
        bytes32 hash = abi.decode(data, (bytes32));
        for (uint256 i = 0; i < ids.length; i++) {
            // ERC-721
            if ((amounts[i] == 1) && (ids[i] & IS_NFT > 0)) {
                uint8 rarity = 0;
                _mint(hash, amounts[i], rarity, _predicate, to, ids[i], data, false);
            }
            // ERC-1155
            else {
                uint8 rarity = 0;
                _mint(hash, amounts[i], rarity, _predicate, to, ids[i], data, false);
            }
        }
    }
}
