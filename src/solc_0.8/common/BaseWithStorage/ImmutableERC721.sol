// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../BaseWithStorage/ERC721BaseToken.sol";

contract ImmutableERC721 is ERC721BaseToken {
    uint256 internal constant CREATOR_OFFSET_MULTIPLIER = uint256(2)**(256 - 160);
    uint256 internal constant SUBID_MULTIPLIER = uint256(2)**(256 - 224);
    uint256 internal constant CHAIN_INDEX_OFFSET_MULTIPLIER = uint256(2)**(256 - 160 - 64 - 16);
    uint256 internal constant STORAGE_ID_MASK = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000;
    uint256 internal constant VERSION_MASK = 0x000000FFFFFFFF00000000000000000000000000000000000000000000000000;

    bytes32 internal constant base32Alphabet = 0x6162636465666768696A6B6C6D6E6F707172737475767778797A323334353637;

    /// @dev An implementation which handles versioned tokenIds.
    /// @param id The tokenId to get the owner of.
    /// @return The address of the owner.
    function _ownerOf(uint256 id) internal view virtual override returns (address) {
        uint256 packedData = _owners[_storageId(id)];
        uint16 idVersion = uint16(id);
        uint16 storageVersion = uint16((packedData & VERSION_MASK) >> 200);

        if (((packedData & BURNED_FLAG) == BURNED_FLAG) || idVersion != storageVersion) {
            return address(0);
        }
        return address(uint160(packedData));
    }

    /// @dev Check if a withdrawal is allowed.
    /// @param from The address requesting the withdrawal.
    /// @param tokenId The id of the token to withdraw assets from.
    function _check_withdrawal_authorized(address from, uint256 tokenId) internal view virtual {
        require(from != address(uint160(0)), "SENDER_ZERO_ADDRESS");
        require(from == _withdrawalOwnerOf(tokenId), "LAST_OWNER_NOT_EQUAL_SENDER");
    }

    /// @dev Get the address allowed to withdraw associated tokens from the parent token.
    /// If too many associated tokens in TOKEN, block.gaslimit won't allow detroy and withdraw in 1 tx.
    /// An owner may destroy their token, then withdraw associated tokens in a later tx (even
    /// though ownerOf(id) would be address(0) after burning.)
    /// @param id The id of the token to query.
    /// @return the address of the owner before burning.
    function _withdrawalOwnerOf(uint256 id) internal view virtual returns (address) {
        uint256 packedData = _owners[_storageId(id)];
        return address(uint160(packedData));
    }

    /// @notice Get the storageID (no chainIndex or version data), which is constant for a given token.
    /// @param tokenId The tokenId for which to find the first token Id.
    /// @return The storage id for this token.
    function getStorageId(uint256 tokenId) external pure virtual returns (uint256) {
        return _storageId(tokenId);
    }

    /// @dev Get the storageId (full id without the version number) from the full tokenId.
    /// @param id The full tokenId for the GAME token.
    /// @return The storageId.
    function _storageId(uint256 id) internal pure virtual override returns (uint256) {
        return uint256(id & STORAGE_ID_MASK);
    }

    /// @dev Get the a full URI string for a given hash + gameId.
    /// @param hash The 32 byte IPFS hash.
    /// @return The URI string.
    function _toFullURI(bytes32 hash) internal pure virtual returns (string memory) {
        return string(abi.encodePacked("ipfs://bafybei", hash2base32(hash), "/", "token.json"));
    }

    /// @dev Create a new tokenId and associate it with an owner.
    /// This is a packed id, consisting of 4 parts:
    /// the creator's address, a uint64 subId, a uint18 chainIndex and a uint16 version.
    /// @param creator The address of the Token creator.
    /// @param subId The id used to generate the id.
    /// @param version The publicversion used to generate the id.
    function _generateTokenId(
        address creator,
        uint64 subId,
        uint8 chainIndex,
        uint16 version
    ) internal pure returns (uint256) {
        return
            uint256(uint160(creator)) *
            CREATOR_OFFSET_MULTIPLIER +
            uint64(subId) *
            SUBID_MULTIPLIER +
            chainIndex *
            CHAIN_INDEX_OFFSET_MULTIPLIER +
            uint16(version);
    }

    /// @dev Convert a 32 byte hash to a base 32 string.
    /// @param hash A 32 byte (IPFS) hash.
    /// @return _uintAsString The hash as a base 32 string.
    // solhint-disable-next-line security/no-assign-params
    function hash2base32(bytes32 hash) internal pure returns (string memory _uintAsString) {
        uint256 _i = uint256(hash);
        uint256 k = 52;
        bytes memory bstr = new bytes(k);
        bstr[--k] = base32Alphabet[uint8((_i % 8) << 2)]; // uint8 s = uint8((256 - skip) % 5);  // (_i % (2**s)) << (5-s)
        _i /= 8;
        while (k > 0) {
            bstr[--k] = base32Alphabet[_i % 32];
            _i /= 32;
        }
        return string(bstr);
    }
}
