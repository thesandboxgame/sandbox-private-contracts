//SPDX-License-Identifier: MIT
// solhint-disable code-complexity
pragma solidity 0.8.2;

import "../common/BaseWithStorage/ImmutableERC721.sol";
import "../common/interfaces/ILandToken.sol";
import "../Game/GameBaseToken.sol";
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
    mapping(uint256 => EstateData) internal estates;

    LandToken internal _land;
    GameBaseToken internal _gameToken;
    address internal _minter;
    // @review needed?
    address internal _breaker;

    struct EstateData {
        uint256[] gameIds;
        uint24[] landIds;
    }
    /// @param ids LAND tokenIds added, Games added, Games removed, uri
    /// @param junctions
    /// @param gamesToAdd Games added
    /// @param gamesToRemove Games removed
    /// @param uri ipfs hash (without the prefix, assume cidv1 folder)
    struct EstateCRUDData {
        uint256[] ids;
        uint256[] junctions;
        uint256[] gamesToAdd;
        uint256[] gamesToRemove;
        bytes32 uri;
    }

    /// @dev Emits when a estate is updated.
    /// @param oldId The id of the previous erc721 ESTATE token.
    /// @param newId The id of the newly minted token.
    /// @param update The changes made to the Estate.
    event EstateTokenUpdated(uint256 indexed oldId, uint256 indexed newId, EstateCRUDData update);

    function initV1(
        address trustedForwarder,
        LandToken land,
        uint8 chainIndex
    ) public initializer() {
        _land = land;
        ERC721BaseToken.__ERC721BaseToken_initialize(chainIndex);
        ERC2771Handler.__ERC2771Handler_initialize(trustedForwarder);
    }

    // @todo Add access-control: minter-only? could inherit WithMinter.sol
    /// @notice Create a new estate token with adjacent lands.
    /// @param from The address of the one creating the estate.
    /// @param to The address that will own the estate.
    /// @param creation The data to use to create the estate.
    function createEstate(
        address from,
        address to,
        EstateCRUDData calldata creation
    ) external returns (uint256) {
        _check_authorized(from, ADD);
        (uint256 estateId, uint256 storageId) = _mintEstate(from, to, _nextId++, 1, true);
        _addLands(from, storageId, creation.ids, creation.junctions, true);
        _addGames(from, storageId, creation.gamesToAdd);
        _metaData[storageId] = creation.uri;
        emit EstateTokenUpdated(0, estateId, creation);
        return estateId;
    }

    /// @notice Update an existing ESTATE token.This actually burns old token
    /// and mints new token with same basId & incremented version.
    /// @param from The one updating the ESTATE token.
    /// @param to The address to transfer removed GAMES to.
    /// @param estateId The current id of the ESTATE token.
    /// @param update The data to use for the Estate update.
    /// @return The new estateId.
    // @todo  Allow for updating a linked gameToken directly to avoid getting out of sync? think some more...
    function updateEstate(
        address from,
        address to,
        uint256 estateId,
        EstateCRUDData memory update
    ) external returns (uint256) {
        _check_hasOwnerRights(from, estateId);
        uint256 storageId = _storageId(estateId);
        if (update.ids.length != 0) {
            _check_authorized(from, ADD);
        }
        _addLands(from, storageId, update.ids, update.junctions, false);
        _removeGames(to, storageId, update.gamesToRemove);
        _addGames(from, storageId, update.gamesToAdd);
        _metaData[storageId] = update.uri;
        uint256 newId = _incrementTokenVersion(from, estateId);
        emit EstateTokenUpdated(estateId, newId, update);
        return newId;
    }

    /// @notice Used to remove lands from an estate.
    // @review do we need from? only needed when called by approved/superoperators...
    // @note see https://docs.google.com/document/d/1eXJP0Tp2C617kOkDNpLCS_hJXaGZizHkxJndMIlKpeQ/edit for offchain metadata solution
    /// @param from The address of the one removing lands.
    /// @param estateId The estate token to remove lands from.
    /// @param ids The tokenIds of the LANDs to remove
    /// @param rebuild The data to use when reconstructing the Estate.
    /// @dev Note that a valid estate can only contain adjacent lands, so it is possible to attempt to remove lands in a way that would result in an invalid estate, which must be prevented.
    // @todo decide how to handle the above case.
    function downsizeEstate(
        address from,
        uint256 estateId,
        uint256[] calldata ids,
        EstateCRUDData memory rebuild
    ) external returns (uint256) {
        _check_hasOwnerRights(from, estateId);
        _check_authorized(from, BREAK);
        _check_authorized(from, ADD);
        // @todo implement.
        // - [ ] ensure resultant estate's lands are still adjacent
        // - [ ] _addLands(...);
        // - [ ] remove and/or add Games. update _gamesInEstate[] mapping if needed.
        // - [ ] _incrementTokenVersion(...)
        // - [ ] emit EstateTokenUpdated(...)
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
        // @todo implement the actual transfer ! see GameToken.recoverAssets()
        // need to validate lands, pass land ids ?
    }

    function getEstateData(uint256 estateId) external view returns (EstateData memory) {
        uint256 storageId = _storageId(estateId);
        return estates[storageId];
    }

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

    function _addGames(
        address from,
        uint256 storageId,
        uint256[] memory gamesToAdd
    ) internal {
        _gameToken.batchTransferFrom(from, address(this), gamesToAdd, "");
        // no need to de-duplicate as gameId is unique
        for (uint256 i = 0; i < gamesToAdd.length; i++) {
            require(gamesToAdd[i] != 0);
            estates[storageId].gameIds.push(gamesToAdd[i]);
        }
    }

    function _removeGames(
        address to,
        uint256 storageId,
        uint256[] memory gamesToRemove
    ) internal {
        _gameToken.batchTransferFrom(address(this), to, gamesToRemove, "");
        uint256 len = estates[storageId].gameIds.length;
        for (uint256 i = 0; i < gamesToRemove.length; i++) {
            for (uint256 j = 0; j < len; j++) {
                if (gamesToRemove[i] == estates[storageId].gameIds[j]) {
                    estates[storageId].gameIds[j] = 0;
                }
            }
        }
    }

    function _addLands(
        address sender,
        uint256 storageId,
        uint256[] memory ids,
        uint256[] memory junctions,
        bool justCreated
    ) internal {
        _land.batchTransferFrom(sender, address(this), ids, "");
        uint24[] memory list = new uint24[](ids.length);
        for (uint256 i = 0; i < list.length; i++) {
            uint16 x = uint16(ids[i] % GRID_SIZE);
            uint16 y = uint16(ids[i] / GRID_SIZE);
            list[i] = _encode(x, y, 1);
        }
        // solhint-disable-next-line use-forbidden-name
        uint256 l = estates[storageId].landIds.length;
        uint16 lastX = 409;
        uint16 lastY = 409;
        if (!justCreated) {
            uint24 d = estates[storageId].landIds[l - 1];
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
                    data = estates[storageId].landIds[j];
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
            estates[storageId].landIds = list;
        } else {
            for (uint256 i = 0; i < list.length; i++) {
                estates[storageId].landIds.push(list[i]);
            }
        }
    }

    /// @dev used to increment the version in a tokenId by burning the original and reminting a new token. Mappings to token-specific data are preserved via the storageId mechanism.
    /// @param from The address of the token owner.
    /// @param estateId The tokenId to increment.
    /// @return the version-incremented tokenId.
    function _incrementTokenVersion(address from, uint256 estateId) internal returns (uint256) {
        address originalCreator = address(uint160(estateId / CREATOR_OFFSET_MULTIPLIER));
        uint64 subId = uint64(estateId / SUBID_MULTIPLIER);
        uint16 version = uint16(estateId);
        version++;
        address owner = _ownerOf(estateId);
        if (from == owner) {
            _burn(from, owner, estateId);
        }
        (uint256 newId, ) = _mintEstate(originalCreator, owner, subId, version, false);
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
    /// @param subId The id to use when generating the new estateId.
    /// @param version The version number part of the estateId.
    /// @param isCreation Whether this is a brand new Estate (as opposed to an update).
    /// @return id The newly created estateId.
    /// @return storageId The staorage Id for the token.
    function _mintEstate(
        address from,
        address to,
        uint64 subId,
        uint16 version,
        bool isCreation
    ) internal returns (uint256, uint256 storageId) {
        require(to != address(uint160(0)), "can't send to zero address");
        uint16 idVersion;
        uint256 estateId;
        uint256 strgId;
        if (isCreation) {
            idVersion = 1;
            estateId = _generateTokenId(from, subId, _chainIndex, idVersion);
            strgId = _storageId(estateId);
            require(_owners[strgId] == 0, "STORAGE_ID_REUSE_FORBIDDEN");
        } else {
            estateId = _generateTokenId(from, subId, _chainIndex, version);
            strgId = _storageId(estateId);
        }

        _owners[strgId] = (uint256(idVersion) << 200) + uint256(uint160(to));
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

    // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    function onERC721BatchReceived(
        address, // operator,
        address, // from,
        uint256[] calldata, // ids,
        bytes calldata // data
    ) external pure returns (bytes4) {
        revert("please call createEstate or updateEstate functions");
    }

    function onERC721Received(
        address, // operator,
        address, // from,
        uint256, // tokenId,
        bytes calldata // data
    ) external pure returns (bytes4) {
        revert("please call createEstate or updateEstate functions");
    }

    /// @dev Get the a full URI string for a given hash + gameId.
    /// @param hash The 32 byte IPFS hash.
    /// @return The URI string.
    function _toFullURI(bytes32 hash) internal pure override returns (string memory) {
        return string(abi.encodePacked("ipfs://bafybei", hash2base32(hash), "/", "estate.json"));
    }

    // solhint-enable code-complexity
}
