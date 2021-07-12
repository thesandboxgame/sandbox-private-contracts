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
        bytes32[] memory hashes = abi.decode(data, (bytes32[]));
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 uriId = ids[i] & URI_ID;
            // @review - why does this fail even though nothing has been minted yet?
            // require(uint256(_metadataHash[uriId]) == 0, "ID_TAKEN");
            _metadataHash[uriId] = hashes[i];
            _rarityPacks[uriId] = "0x00";
        }
        // @todo - handle numNFTs
        _mintBatches(amounts, to, ids, 0);
    }
}
