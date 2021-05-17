//SPDX-License-Identifier: MIT
// solhint-disable code-complexity
pragma solidity 0.8.2;

import "../common/BaseWithStorage/ImmutableERC721.sol";
import "../common/interfaces/ILandToken.sol";
import "../common/interfaces/IERC721MandatoryTokenReceiver.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @dev An updated Estate Token contract using a simplified verison of LAND with no Quads

contract EstateBaseToken is ImmutableERC721, Initializable {
    uint8 internal constant OWNER = 0;
    uint8 internal constant ADD = 1;
    uint8 internal constant BREAK = 2;
    uint8 internal constant WITHDRAWAL = 3;

    uint16 internal constant GRID_SIZE = 408;

    uint64 internal _nextId; // max uint64 = 18,446,744,073,709,551,615

    mapping(uint256 => bytes32) internal _metaData;
    LandToken internal _land;
    address internal _minter;
    // @review needed?
    address internal _breaker;
    // @todo add Update struct like GameToken ?
    event EstateTokenUpdated(
        uint256 indexed oldId,
        uint256 indexed newId,
        uint256[] ids,
        uint256[] junctions,
        bytes32 uri
    );

    function initV1(
        address trustedForwarder,
        LandToken land,
        uint8 chainIndex
    ) public initializer() {
        _land = land;
        ERC721BaseToken.__ERC721BaseToken_initialize(chainIndex);
        ERC2771Handler.__ERC2771Handler_initialize(trustedForwarder);
    }

    // @review rename createEstate to mimic GameToken funcs ?
    function createFromMultipleLands(
        address sender,
        address to,
        uint256[] calldata ids,
        uint256[] calldata junctions
    ) external returns (uint256) {
        _check_authorized(sender, ADD);
        (uint256 id, ) = _mintEstate(sender, to, 1, true);
        _addLands(sender, id, ids, junctions, true);
        return id;
    }

    // TODO addSingleLand

    function addMultipleLands(
        address sender,
        uint256 estateId,
        uint256[] calldata ids,
        uint256[] calldata junctions
    ) external {
        _check_authorized(sender, ADD);
        _check_hasOwnerRights(sender, estateId);
        _addLands(sender, estateId, ids, junctions, false);
    }

    /// @notice Burns token `id`.
    /// @param id The token which will be burnt.
    function burn(uint256 id) external override {
        address sender = _msgSender();
        _check_authorized(sender, BREAK);
        _check_hasOwnerRights(sender, id);
        _burn(sender, _ownerOf(id), id);
    }

    /// @notice Burn token`id` from `from`.
    /// @param from address whose token is to be burnt.
    /// @param id The token which will be burnt.
    function burnFrom(address from, uint256 id) external override {
        require(from != address(uint160(0)), "NOT_FROM_ZERO_ADDRESS");
        (address owner, bool operatorEnabled) = _ownerAndOperatorEnabledOf(id);
        require(owner != address(uint160(0)), "NONEXISTENT_TOKEN");
        address msgSender = _msgSender();
        require(
            msgSender == from ||
                (operatorEnabled && _operators[id] == msgSender) ||
                _superOperators[msgSender] ||
                _operatorsForAll[from][msgSender],
            "UNAUTHORIZED_BURN"
        );
        _burn(from, owner, id);
    }

    /// @notice Update an existing ESTATE token.This actually burns old token
    /// and mints new token with same basId & incremented version.
    /// @param from The one updating the ESTATE token.
    /// @param estateId The current id of the ESTATE token.
    /// @param ids The ids to use for the update.
    /// @param junctions The junctions to use for the update.
    /// @return The new estateId.
    function updateEstate(
        address from,
        uint256 estateId,
        uint256[] memory ids,
        uint256[] memory junctions,
        bytes32 uri
    ) external returns (uint256) {
        // @review can this function also handle removing lands?
        // would involve breaking and reminting.
        // could try to preserve internal data, ie: metaData hash, _owners[] mapping, etc...
        uint256 id = _storageId(estateId);
        _addLands(from, estateId, ids, junctions, false);
        _metaData[id] = uri;
        uint256 newId = _incrementTokenVersion(from, estateId);
        emit EstateTokenUpdated(estateId, newId, ids, junctions, uri);
        return newId;
    }

    /// @notice Used to recover Land tokens from a burned estate.
    /// Note: Implemented separately from burn to avoid hitting the block gas-limit if estate has too many lands.
    /// @param sender The sender of the request.
    // / @param to The recipient of the Land tokens.
    // / @param num The number of Lands to transfer.
    /// @param estateId The estate to recover lands from.
    function transferFromDestroyedEstate(
        address sender,
        address, // to,
        uint256, // num,
        uint256 estateId
    ) external view {
        _check_authorized(sender, WITHDRAWAL);
        require(sender != address(this), "NOT_FROM_THIS");
        require(sender != address(uint160(0)), "NOT_FROM_ZERO");
        address msgSender = _msgSender();
        require(msgSender == sender || _superOperators[msgSender], "not _check_authorized");
        require(sender == _withdrawalOwnerOf(estateId), "NOT_WITHDRAWAL_OWNER");
        // @todo implement the actual transfer !
        // need to validate lands, pass land ids ?
    }

    // solhint-enable no-unused-vars

    /// @notice Return the name of the token contract.
    /// @return The name of the token contract.
    function name() external pure returns (string memory) {
        return "The Sandbox: ESTATE token";
    }

    /// @notice Get the symbol of the token contract.
    /// @return the symbol of the token contract.
    function symbol() external pure returns (string memory) {
        return "ESTATE";
    }

    /// @notice Return the URI of a specific token.
    /// @param id The id of the token.
    /// @return uri The URI of the token metadata.
    function tokenURI(uint256 id) public view returns (string memory uri) {
        require(_ownerOf(id) != address(0), "BURNED_OR_NEVER_MINTED");
        uint256 immutableId = _storageId(id);
        return _toFullURI(_metaData[immutableId]);
    }

    // //////////////////////////////////////////////////////////////////////////////////////////////////////

    /// @dev used to increment the version in a tokenId by burning the original and reminting a new token. Mappings to token-specific data are preserved via the storageId mechanism.
    /// @param from The address of the token owner.
    /// @param estateId The tokenId to increment.
    /// @return the version-incremented tokenId.
    function _incrementTokenVersion(address from, uint256 estateId) internal returns (uint256) {
        address originalCreator = address(uint160(estateId / CREATOR_OFFSET_MULTIPLIER));
        uint16 version = uint16(estateId);
        version++;
        address owner = _ownerOf(estateId);
        if (from == owner) {
            _burn(from, owner, estateId);
        }
        (uint256 newId, ) = _mintEstate(originalCreator, owner, version, false);
        address newOwner = _ownerOf(newId);
        assert(owner == newOwner);
        return newId;
    }

    function _check_authorized(address sender, uint8 action) internal view {
        require(sender != address(uint160(0)), "sender is zero address");
        address msgSender = _msgSender();
        if (action == ADD) {
            address minter = _minter;
            if (minter == address(uint160(0))) {
                require(msgSender == sender, "not _check_authorized");
            } else {
                require(msgSender == minter, "only minter allowed");
            }
        } else if (action == BREAK) {
            address breaker = _breaker;
            if (breaker == address(uint160(0))) {
                require(msgSender == sender, "not _check_authorized");
            } else {
                require(msgSender == breaker, "only breaker allowed");
            }
        } else {
            require(msgSender == sender, "not _check_authorized");
        }
    }

    function _check_hasOwnerRights(address sender, uint256 estateId) internal view {
        (address owner, bool operatorEnabled) = _ownerAndOperatorEnabledOf(estateId);
        require(owner != address(uint160(0)), "token does not exist");
        require(owner == sender, "not owner");
        address msgSender = _msgSender();
        require(
            _superOperators[msgSender] ||
                _operatorsForAll[sender][msgSender] ||
                (operatorEnabled && _operators[estateId] == msgSender),
            "not approved"
        );
    }

    // //////////////////////////////////////////////////////////////////////////////////////////////////////////

    function _encode(
        uint16 x,
        uint16 y,
        uint8 size
    ) internal pure returns (uint24) {
        return uint24(size) * uint24(2**18) + (uint24(x) + uint24(y) * GRID_SIZE);
    }

    function _decode(uint24 data)
        internal
        pure
        returns (
            uint16 x,
            uint16 y,
            uint8 size
        )
    {
        size = uint8(data / (2**18));
        y = uint16((data % (2**18)) / GRID_SIZE);
        x = uint16(data % GRID_SIZE);
    }

    /// @dev Create a new (or incremented) estateId and associate it with an owner.
    /// @param from The address of one creating the Estate.
    /// @param to The address of the Estate owner.
    /// @param version The version number part of the estateId.
    /// @param isCreation Whether this is a brand new Estate (as opposed to an update).
    /// @return id The newly created estateId.
    /// @return storageId The staorage Id for the token.
    function _mintEstate(
        address from,
        address to,
        uint16 version,
        bool isCreation
    ) internal returns (uint256 id, uint256 storageId) {
        require(to != address(uint160(0)), "can't send to zero address");
        uint256 estateId;
        uint256 strgId;
        if (isCreation) {
            estateId = _generateTokenId(from, _nextId++, _chainIndex, version);
            strgId = _storageId(estateId);
            require(_owners[strgId] == 0, "STORAGE_ID_REUSE_FORBIDDEN");
        } else {
            uint64 subId = uint64(estateId / SUBID_MULTIPLIER);
            estateId = _generateTokenId(from, subId, _chainIndex, version);
            strgId = _storageId(estateId);
        }

        _owners[strgId] = (uint256(version) << 200) + uint256(uint160(to));
        _numNFTPerAddress[to]++;
        emit Transfer(address(0), to, estateId);
        return (estateId, strgId);
    }

    function _adjacent(
        uint16 x1,
        uint16 y1,
        uint16 x2,
        uint16 y2
    ) internal pure returns (bool) {
        return ((x1 == x2 && y1 == y2 - 1) ||
            (x1 == x2 && y1 == y2 + 1) ||
            (x1 == x2 - 1 && y1 == y2) ||
            (x1 == x2 + 1 && y1 == y2));
    }

    function _adjacent(
        uint16 x1,
        uint16 y1,
        uint16 x2,
        uint16 y2,
        uint8 s2
    ) internal pure returns (bool) {
        return ((x1 >= x2 && x1 < x2 + s2 && y1 == y2 - 1) ||
            (x1 >= x2 && x1 < x2 + s2 && y1 == y2 + s2) ||
            (x1 == x2 - 1 && y1 >= y2 && y1 < y2 + s2) ||
            (x1 == x2 - s2 && y1 >= y2 && y1 < y2 + s2));
    }

    // solhint-disable no-empty-blocks
    function _addLands(
        address sender,
        uint256 estateId,
        uint256[] memory ids,
        uint256[] memory junctions,
        bool justCreated
    ) internal {}

    // solhint-enable no-empty-blocks
    //temporarily disable function logic until it gets refactored in next PR

    /**
        _land.batchTransferFrom(sender, address(this), ids, "");
        uint24[] memory list = new uint24[](ids.length);
        for (uint256 i = 0; i < list.length; i++) {
            uint16 x = uint16(ids[i] % GRID_SIZE);
            uint16 y = uint16(ids[i] / GRID_SIZE);
            list[i] = _encode(x, y, 1);
        }
        // solhint-disable-next-line use-forbidden-name
        uint256 l = _quadsInEstate[estateId].length;
        uint16 lastX = 409;
        uint16 lastY = 409;
        if (!justCreated) {
            uint24 d = _quadsInEstate[estateId][l - 1];
            lastX = uint16(d % GRID_SIZE);
            lastY = uint16(d % GRID_SIZE);
        }
        uint256 j = 0;
        for (uint256 i = 0; i < list.length; i++) {
            uint16 x = uint16(ids[i] % GRID_SIZE);
            uint16 y = uint16(ids[i] / GRID_SIZE);
            if (lastX != 409 && !_adjacent(x, y, lastX, lastY)) {
                uint256 index = junctions[j];
                j++;
                uint24 data;
                if (index >= l) {
                    require(index - l < j, "junctions need to refers to previously accepted land");
                    data = list[index - l];
                } else {
                    data = _quadsInEstate[estateId][j];
                }
                (uint16 jx, uint16 jy, uint8 jsize) = _decode(data);
                if (jsize == 1) {
                    require(_adjacent(x, y, jx, jy), "need junctions to be adjacent");
                } else {
                    require(_adjacent(x, y, jx, jy, jsize), "need junctions to be adjacent");
                }
            }
            lastX = x;
            lastY = y;
        }
        if (justCreated) {
            _quadsInEstate[estateId] = list;
        } else {
            for (uint256 i = 0; i < list.length; i++) {
                _quadsInEstate[estateId].push(list[i]);
            }
        }
    }
    */

    // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    function onERC721BatchReceived(
        address, // operator,
        address, // from,
        uint256[] calldata, // ids,
        bytes calldata // data
    ) external pure returns (bytes4) {
        revert("please call add* or createFrom* functions");
    }

    function onERC721Received(
        address, // operator,
        address, // from,
        uint256, // tokenId,
        bytes calldata // data
    ) external pure returns (bytes4) {
        revert("please call add* or createFrom* functions");
    }

    /// @dev Get the a full URI string for a given hash + gameId.
    /// @param hash The 32 byte IPFS hash.
    /// @return The URI string.
    function _toFullURI(bytes32 hash) internal pure override returns (string memory) {
        return string(abi.encodePacked("ipfs://bafybei", hash2base32(hash), "/", "estate.json"));
    }

    // solhint-enable code-complexity
}
