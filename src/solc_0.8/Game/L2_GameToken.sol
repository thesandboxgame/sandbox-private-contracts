//SPDX-License-Identifier: MIT
// solhint-disable-next-line compiler-version
pragma solidity 0.8.2;

import "../common/BaseWithStorage/ERC721BaseToken.sol";
import "../common/BaseWithStorage/WithMinter.sol";
import "../common/interfaces/IAssetToken.sol";
import "../common/interfaces/IGameToken.sol";

// @review should we add simple metaTx support?
// either WithMetaTransaction.sol, or openzeppelin _msgSender style only...

contract GameToken is ERC721BaseToken, WithMinter, IGameToken {
    ///////////////////////////////  Data //////////////////////////////

    IAssetToken internal immutable _asset;

    bytes4 private constant ERC1155_RECEIVED = 0xf23a6e61;
    bytes4 private constant ERC1155_BATCH_RECEIVED = 0xbc197c81;
    uint256 private constant CREATOR_OFFSET_MULTIPLIER = uint256(2)**(256 - 160);
    uint256 private constant SUBID_MULTIPLIER = uint256(2)**(256 - 160 - 64);
    uint256 private constant CHAIN_INDEX_OFFSET_MULTIPLIER = uint256(2)**(256 - 160 - 64 - 16);
    // ((uint256(1) * 2**224) - 1) << 32;
    uint256 private constant STORAGE_ID_MASK = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000;
    // ((uint256(1) * 2**32) - 1) << 200;
    uint256 private constant VERSION_MASK = 0x0000000000FFFF00000000000000000000000000000000000000000000000000;

    uint256 private constant CHAIN_INDEX_MASK = 0x0000000000000000000000000000000000000000000000000000000000FF0000;
    bytes32 private constant base32Alphabet = 0x6162636465666768696A6B6C6D6E6F707172737475767778797A323334353637;

    mapping(uint256 => mapping(uint256 => uint256)) private _gameAssets;
    mapping(address => address) private _creatorship; // creatorship transfer

    mapping(uint256 => bytes32) private _metaData;
    mapping(address => mapping(address => bool)) private _gameEditors;

    // @review Matic
    // for matic integration
    address private immutable _mintGameableAssetPredicate;
    address private immutable _depositor;
    mapping(uint256 => bool) public withdrawnTokens;
    uint256 public constant BATCH_LIMIT = 20; // do we need this?

    ///////////////////////////////  Events //////////////////////////////

    /// @dev Emits when a game is updated.
    /// @param oldId The id of the previous erc721 GAME token.
    /// @param newId The id of the newly minted token.
    /// @param update The changes made to the Game: new assets, removed assets, uri

    event GameTokenUpdated(uint256 indexed oldId, uint256 indexed newId, IGameToken.GameData update);

    /// @dev Emits when creatorship of a GAME token is transferred.
    /// @param original The original creator of the GAME token.
    /// @param from The current 'creator' of the token.
    /// @param to The new 'creator' of the token.
    event CreatorshipTransfer(address indexed original, address indexed from, address indexed to);

    /// @dev Emits when an address has its gameEditor status changed.
    /// @param gameOwner The owner of the GAME token.
    /// @param gameEditor The address whose editor rights to update.
    /// @param isEditor WHether the address 'gameEditor' should be an editor.
    event GameEditorSet(address indexed gameOwner, address gameEditor, bool isEditor);

    event WithdrawnBatch(address indexed user, uint256[] tokenIds);
    event TransferWithMetadata(address indexed from, address indexed to, uint256 indexed tokenId, bytes metaData);

    // @review Matic set up ROLES or access-control address variables
    constructor(
        address metaTransactionContract,
        address admin,
        IAssetToken asset,
        address mintableAssetPredicate,
        address depositor
    ) ERC721BaseToken(metaTransactionContract, admin) {
        _asset = asset;
        _mintGameableAssetPredicate = mintableAssetPredicate;
        _depositor = depositor;
    }

    ///////////////////////////////  Modifiers //////////////////////////////

    modifier notToZero(address to) {
        require(to != address(0), "DESTINATION_ZERO_ADDRESS");
        _;
    }

    modifier notToThis(address to) {
        require(to != address(this), "DESTINATION_GAME_CONTRACT");
        _;
    }

    ///////////////////////////////  Functions //////////////////////////////

    /// @notice Allow token owner to set game editors.
    /// @param gameOwner The address of a GAME token creator.
    /// @param editor The address of the editor to set.
    /// @param isEditor Add or remove the ability to edit.
    function setGameEditor(
        address gameOwner,
        address editor,
        bool isEditor
    ) external override {
        require(msg.sender == gameOwner || _isValidMetaTx(gameOwner), "EDITOR_ACCESS_DENIED");
        _setGameEditor(gameOwner, editor, isEditor);
    }

    /// @notice Transfers creatorship of `original` from `sender` to `to`.
    /// @param sender The address of current registered creator.
    /// @param original The address of the original creator whose creation are saved in the ids themselves.
    /// @param to The address which will be given creatorship for all tokens originally minted by `original`.
    function transferCreatorship(
        address sender,
        address original,
        address to
    ) external override notToZero(to) {
        require(
            msg.sender == sender || _isValidMetaTx(sender) || _superOperators[msg.sender],
            "TRANSFER_ACCESS_DENIED"
        );
        require(sender != address(0), "NOT_FROM_ZEROADDRESS");
        address current = _creatorship[original];
        if (current == address(0)) {
            current = original;
        }
        require(current != to, "CURRENT_=_TO");
        require(current == sender, "CURRENT_!=_SENDER");
        if (to == original) {
            _creatorship[original] = address(0);
        } else {
            _creatorship[original] = to;
        }
        emit CreatorshipTransfer(original, current, to);
    }

    /// @notice Create a new GAME token.
    /// @param from The address of the one creating the game (may be different from msg.sender if metaTx).
    /// @param to The address who will be assigned ownership of this game.
    /// @param creation The struct containing ids & ammounts of assets to add to this game,
    /// along with the uri to set.
    /// @param editor The address to allow to edit (can also be set later).
    /// @param subId A random id created on the backend.
    /// @return id The id of the new GAME token (erc721).
    function createGame(
        address from,
        address to,
        GameData calldata creation,
        address editor,
        uint64 subId
    ) external override onlyMinter() notToZero(to) notToThis(to) returns (uint256 id) {
        (uint256 gameId, uint256 storageId) = _mintGame(from, to, subId, 0, true, false, 0);

        if (editor != address(0)) {
            _setGameEditor(to, editor, true);
        }
        if (creation.assetIdsToAdd.length != 0) {
            _addAssets(from, storageId, creation.assetIdsToAdd, creation.assetAmountsToAdd);
        }

        _metaData[storageId] = creation.uri;
        emit GameTokenUpdated(0, gameId, creation);
        return gameId;
    }

    /// @notice Update an existing GAME token.This actually burns old token
    /// and mints new token with same basId & incremented version.
    /// @param from The one updating the GAME token.
    /// @param gameId The current id of the GAME token.
    /// @param update The values to use for the update.
    /// @return The new gameId.
    function updateGame(
        address from,
        uint256 gameId,
        IGameToken.GameData memory update
    ) external override onlyMinter() returns (uint256) {
        uint256 storageId = _storageId(gameId);
        _addAssets(from, storageId, update.assetIdsToAdd, update.assetAmountsToAdd);
        _removeAssets(storageId, update.assetIdsToRemove, update.assetAmountsToRemove, _ownerOf(gameId));
        _metaData[storageId] = update.uri;
        uint256 newId = _bumpGameVersion(from, gameId);
        emit GameTokenUpdated(gameId, newId, update);
        return newId;
    }

    /// @notice Burn a GAME token and recover assets.
    /// @param from The address of the one destroying the game.
    /// @param to The address to send all GAME assets to.
    /// @param gameId The id of the GAME to destroy.
    /// @param assetIds The assets to recover from the burnt GAME.
    function burnAndRecover(
        address from,
        address to,
        uint256 gameId,
        uint256[] calldata assetIds
    ) external override {
        _burnGame(from, gameId);
        _recoverAssets(from, to, gameId, assetIds);
    }

    /// @notice Burn a GAME token.
    /// @param gameId The id of the GAME to destroy.
    function burn(uint256 gameId) external override(ERC721BaseToken, IGameToken) {
        _burnGame(msg.sender, gameId);
    }

    /// @notice Burn a GAME token on behalf of owner.
    /// @param from The address whose GAME is being burnt.
    /// @param gameId The id of the GAME to burn.
    function burnFrom(address from, uint256 gameId) external override(ERC721BaseToken, IGameToken) {
        require(from != address(0), "NOT_FROM_ZEROADDRESS");
        _burnGame(from, gameId);
    }

    // @review Matic
    /**
     * @notice called when token is deposited on root chain
     * @dev Should be callable only by ChildChainManager
     * Should handle deposit by minting the required tokenId(s) for user
     * Should set `withdrawnTokens` mapping to `false` for the tokenId being deposited
     * Minting can also be done by other functions
     * @param user user address for whom deposit is being done
     * @param depositData abi encoded tokenIds. Batch deposit also supported.
     */
    function deposit(address user, bytes calldata depositData) external {
        require(msg.sender == _depositor, "DEPOSITOR_ONLY");
        // deposit single
        if (depositData.length == 32) {
            uint256 tokenId = abi.decode(depositData, (uint256));
            withdrawnTokens[tokenId] = false;
            _mintGame(
                address(0), // not used in this context
                user,
                0, // not used in this context
                0, // not used in this context
                false, // signifies not a brand new token creation
                true, // signifies a cross-chain token transfer
                tokenId
            );

            // deposit batch
        } else {
            uint256[] memory tokenIds = abi.decode(depositData, (uint256[]));
            uint256 length = tokenIds.length;
            for (uint256 i; i < length; i++) {
                withdrawnTokens[tokenIds[i]] = false;
                _mintGame(address(0), user, 0, 0, false, true, tokenIds[i]);
            }
        }
    }

    // @review Matic
    /**
     * @notice called when user wants to withdraw token back to root chain
     * @dev Should handle withraw by burning user's token.
     * Should set `withdrawnTokens` mapping to `true` for the tokenId being withdrawn
     * This transaction will be verified when exiting on root chain
     * @param tokenId tokenId to withdraw
     */
    function withdraw(uint256 tokenId) external {
        address owner = _ownerOf(tokenId);
        require(_msgSender() == owner, "ChildMintableERC721: INVALID_TOKEN_OWNER");
        withdrawnTokens[tokenId] = true;
        _burn(msg.sender, owner, tokenId);
    }

    // @review Matic
    /**
     * @notice called when user wants to withdraw multiple tokens back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param tokenIds tokenId list to withdraw
     */
    function withdrawBatch(uint256[] calldata tokenIds) external {
        uint256 length = tokenIds.length;
        require(length <= BATCH_LIMIT, "ChildMintableERC721: EXCEEDS_BATCH_LIMIT");

        // Iteratively burn ERC721 tokens, for performing
        // batch withdraw
        for (uint256 i; i < length; i++) {
            uint256 tokenId = tokenIds[i];
            address owner = _ownerOf(tokenId);
            require(
                _msgSender() == owner,
                string(abi.encodePacked("ChildMintableERC721: INVALID_TOKEN_OWNER ", tokenId))
            );
            withdrawnTokens[tokenId] = true;
            _burn(msg.sender, owner, tokenId);
        }

        // At last emit this event, which will be used
        // in MintableERC721 predicate contract on L1
        // while verifying burn proof
        emit WithdrawnBatch(_msgSender(), tokenIds);
    }

    // @review Matic
    /**
     * @notice called when user wants to withdraw token back to root chain with token URI
     * @dev Should handle withraw by burning user's token.
     * Should set `withdrawnTokens` mapping to `true` for the tokenId being withdrawn
     * This transaction will be verified when exiting on root chain
     *
     * @param tokenId tokenId to withdraw
     */
    function withdrawWithMetadata(uint256 tokenId) external {
        address owner = _ownerOf(tokenId);
        require(_msgSender() == owner, "ChildMintableERC721: INVALID_TOKEN_OWNER");
        withdrawnTokens[tokenId] = true;

        // Encoding metadata associated with tokenId & emitting event
        emit TransferWithMetadata(owner, address(0), tokenId, this.encodeTokenMetadata(tokenId));

        _burn(msg.sender, owner, tokenId);
    }

    /// @review Matic
    /**
     * @notice This method is supposed to be called by client when withdrawing token with metadata
     * and pass return value of this function as second paramter of `withdrawWithMetadata` method
     *
     * It can be overridden by clients to encode data in a different form, which needs to
     * be decoded back by them correctly during exiting
     *
     * @param tokenId Token for which URI to be fetched
     */
    function encodeTokenMetadata(uint256 tokenId) external view virtual returns (bytes memory) {
        // You're always free to change this default implementation
        // and pack more data in byte array which can be decoded back
        // in L1
        return abi.encode(tokenURI(tokenId));
    }

    /// @notice Get the amount of each assetId in a GAME.
    /// @param gameId The game to query.
    /// @param assetIds The assets to get balances for.
    function getAssetBalances(uint256 gameId, uint256[] calldata assetIds)
        external
        view
        override
        returns (uint256[] memory)
    {
        uint256 storageId = _storageId(gameId);
        require(_ownerOf(gameId) != address(0), "NONEXISTANT_TOKEN");
        uint256 length = assetIds.length;
        uint256[] memory assets;
        assets = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            assets[i] = _gameAssets[storageId][assetIds[i]];
        }
        return assets;
    }

    /// @notice Get game editor status.
    /// @param gameOwner The address of the owner of the GAME.
    /// @param editor The address of the editor to set.
    /// @return isEditor Editor status of editor for given tokenId.
    function isGameEditor(address gameOwner, address editor) external view override returns (bool isEditor) {
        return _gameEditors[gameOwner][editor];
    }

    /// @notice Called by other contracts to check if this can receive erc1155 batch.
    /// @param operator The address of the operator in the current tx.
    /// @return the bytes4 value 0xbc197c81.
    function onERC1155BatchReceived(
        address operator,
        address, /*from*/
        uint256[] calldata, /*ids*/
        uint256[] calldata, /*values*/
        bytes calldata /*data*/
    ) external view override returns (bytes4) {
        if (operator == address(this)) {
            return ERC1155_BATCH_RECEIVED;
        }
        revert("ERC1155_BATCH_REJECTED");
    }

    /// @notice Called by other contracts to check if this can receive erc1155 tokens.
    /// @param operator The address of the operator in the current tx.
    /// @return the bytes4 value 0xf23a6e61.
    function onERC1155Received(
        address operator,
        address, /*from*/
        uint256, /*id*/
        uint256, /*value*/
        bytes calldata /*data*/
    ) external view override returns (bytes4) {
        if (operator == address(this)) {
            return ERC1155_RECEIVED;
        }
        revert("ERC1155_REJECTED");
    }

    /// @notice Get the first token id minted using the same storageId as given tokenId.
    /// Can be useful in tracking lineage of a token.
    /// @param gameId The tokenId for which to find the first token Id.
    /// @return The first token minted with this base id.
    function originalId(uint256 gameId) external pure override returns (uint256) {
        return _storageId(gameId) + uint32(1);
    }

    /// @notice Return the name of the token contract.
    /// @return The name of the token contract.
    function name() external pure override returns (string memory) {
        return "The Sandbox: GAME token";
    }

    /// @notice Get the symbol of the token contract.
    /// @return the symbol of the token contract.
    function symbol() external pure override returns (string memory) {
        return "GAME";
    }

    // @review Matic Do we even need this? if not needed by Matic system , remove it.
    /**
     * @notice Example function to handle minting tokens on matic chain
     * @dev Minting can be done as per requirement,
     * This implementation allows only admin to mint tokens but it can be changed as per requirement
     * Should verify if token is withdrawn by checking `withdrawnTokens` mapping
     * @param user user for whom tokens are being minted
     * @param tokenId tokenId to mint
     */
    function mint(address user, uint256 tokenId) public onlyMinter() {
        require(!withdrawnTokens[tokenId], "ChildMintableERC721: TOKEN_EXISTS_ON_ROOT_CHAIN");
        _mintGame(address(0), user, 0, 0, false, false, 0);

    }

    /// @notice Get the creator of the token type `id`.
    /// @param id The id of the token to get the creator of.
    /// @return the creator of the token type `id`.
    function creatorOf(uint256 id) public view override returns (address) {
        require(id != uint256(0), "GAME_NEVER_MINTED");
        address originalCreator = address(uint160(id / CREATOR_OFFSET_MULTIPLIER));
        address newCreator = _creatorship[originalCreator];
        if (newCreator != address(0)) {
            return newCreator;
        }
        return originalCreator;
    }

    /// @notice Return the URI of a specific token.
    /// @param gameId The id of the token.
    /// @return uri The URI of the token metadata.
    function tokenURI(uint256 gameId) public view override returns (string memory uri) {
        require(_ownerOf(gameId) != address(0), "BURNED_OR_NEVER_MINTED");
        uint256 storageId = _storageId(gameId);
        return _toFullURI(_metaData[storageId]);
    }

    /// @notice Transfer assets from a burnt GAME.
    /// @param from Previous owner of the burnt game.
    /// @param to Address that will receive the assets.
    /// @param gameId Id of the burnt GAME token.
    /// @param assetIds The assets to recover from the burnt GAME.
    function recoverAssets(
        address from,
        address to,
        uint256 gameId,
        uint256[] memory assetIds
    ) public override {
        _recoverAssets(from, to, gameId, assetIds);
    }

    /// @notice Check if the contract supports an interface.
    /// 0x01ffc9a7 is ERC-165.
    /// 0x80ac58cd is ERC-721.
    /// @param id The id of the interface.
    /// @return if the interface is supported.
    function supportsInterface(bytes4 id) public pure override returns (bool) {
        return id == 0x01ffc9a7 || id == 0x80ac58cd || id == 0x5b5e139f;
    }

    /// @notice Add assets to an existing GAME.
    /// @param from The address of the current owner of assets.
    /// @param storageId The storageId of the GAME to add assets to.
    /// @param assetIds The id of the asset to add to GAME.
    /// @param amounts The amount of each asset to add to GAME.
    function _addAssets(
        address from,
        uint256 storageId,
        uint256[] memory assetIds,
        uint256[] memory amounts
    ) internal {
        if (assetIds.length == 0) {
            return;
        }
        require(assetIds.length == amounts.length, "INVALID_INPUT_LENGTHS");
        uint256 currentValue;
        for (uint256 i = 0; i < assetIds.length; i++) {
            currentValue = _gameAssets[storageId][assetIds[i]];
            require(amounts[i] != 0, "INVALID_ASSET_ADDITION");
            _gameAssets[storageId][assetIds[i]] = currentValue + amounts[i];
        }
        if (assetIds.length == 1) {
            _asset.safeTransferFrom(from, address(this), assetIds[0], amounts[0], "");
        } else {
            _asset.safeBatchTransferFrom(from, address(this), assetIds, amounts, "");
        }
    }

    /// @notice Remove assets from a GAME.
    /// @param storageId The storageId of the GAME to remove assets from.
    /// @param assetIds An array of asset Ids to remove.
    /// @param values An array of the number of each asset id to remove.
    /// @param to The address to send removed assets to.
    function _removeAssets(
        uint256 storageId,
        uint256[] memory assetIds,
        uint256[] memory values,
        address to
    ) internal {
        if (assetIds.length == 0) {
            return;
        }
        require(assetIds.length == values.length && assetIds.length != 0, "INVALID_INPUT_LENGTHS");
        uint256 currentValue;
        for (uint256 i = 0; i < assetIds.length; i++) {
            currentValue = _gameAssets[storageId][assetIds[i]];
            require(currentValue != 0 && values[i] != 0 && values[i] <= currentValue, "INVALID_ASSET_REMOVAL");
            _gameAssets[storageId][assetIds[i]] = currentValue - values[i];
        }

        if (assetIds.length == 1) {
            _asset.safeTransferFrom(address(this), to, assetIds[0], values[0], "");
        } else {
            _asset.safeBatchTransferFrom(address(this), to, assetIds, values, "");
        }
    }

    /// @dev See burn / burnFrom.
    function _burnGame(address from, uint256 gameId) internal {
        uint256 storageId = _storageId(gameId);
        (address owner, bool operatorEnabled) = _ownerAndOperatorEnabledOf(storageId);
        require(
            msg.sender == owner ||
                _isValidMetaTx(from) ||
                (operatorEnabled && _operators[storageId] == msg.sender) ||
                _superOperators[msg.sender] ||
                _operatorsForAll[from][msg.sender],
            "UNAUTHORIZED_BURN"
        );

        delete _metaData[storageId];
        // @review should creatorship be zeroed here?
        _creatorship[creatorOf(gameId)] = address(0);
        _burn(from, owner, gameId);
    }

    /// @dev See recoverAssets.
    function _recoverAssets(
        address from,
        address to,
        uint256 gameId,
        uint256[] memory assetIds
    ) internal notToZero(to) notToThis(to) {
        require(_ownerOf(gameId) == address(0), "ONLY_FROM_BURNED_TOKEN");
        bool validMetaTx = _isValidMetaTx(from);
        uint256 storageId = _storageId(gameId);
        if (!validMetaTx) {
            require(from == msg.sender, "INVALID_RECOVERY");
        }
        _check_withdrawal_authorized(from, gameId);
        require(assetIds.length > 0, "WITHDRAWAL_COMPLETE");
        uint256[] memory values;
        values = new uint256[](assetIds.length);
        for (uint256 i = 0; i < assetIds.length; i++) {
            values[i] = _gameAssets[storageId][assetIds[i]];
            delete _gameAssets[storageId][assetIds[i]];
        }
        _asset.safeBatchTransferFrom(address(this), to, assetIds, values, "");

        GameData memory recovery;
        recovery.assetIdsToRemove = assetIds;
        recovery.assetAmountsToRemove = values;
        emit GameTokenUpdated(gameId, 0, recovery);
    }

    /// @dev Create a new gameId and associate it with an owner.
    /// @param from The address of one creating the game.
    /// @param to The address of the Game owner.
    /// @param subId The id to use when generating the new GameId.
    /// @param version The version number part of the gameId.
    /// @param isCreation Whether this is a brand new GAME (as opposed to an update).
    /// @param isCrossChainTransfer Whether this is a token that was exited from L2.
    /// @param existingTokenId If this is a token that was exited from L2, use the exisiting Id.
    /// @dev Neither CrossChainTransfers or updates are considered Creations.
    /// @return id The newly created gameId.
    function _mintGame(
        address from,
        address to,
        uint64 subId,
        uint16 version,
        bool isCreation,
        bool isCrossChainTransfer,
        uint256 existingTokenId
    ) internal returns (uint256 id, uint256 storageId) {
        uint16 idVersion;
        uint256 gameId;
        uint256 strgId;
        if (isCrossChainTransfer) {
            require(existingTokenId != uint256(0), "INVALID_ID");
            // This is a token which has exited L2.
            gameId = existingTokenId;
            strgId = _storageId(gameId);
            idVersion = uint16(existingTokenId);
        } else if (isCreation && !isCrossChainTransfer) {
            // This is a brand new token which has never existed on L2
            idVersion = 1;
            gameId = _generateGameId(from, subId, idVersion);
            strgId = _storageId(gameId);
            require(_owners[strgId] == 0, "STORAGE_ID_REUSE_FORBIDDEN");
        } else if (!isCreation && !isCrossChainTransfer) {
            // This is an update
            idVersion = version;
            gameId = _generateGameId(from, subId, idVersion);
            strgId = _storageId(gameId);
        }

        _owners[strgId] = (uint256(idVersion) << 200) + uint256(uint160(to));
        _numNFTPerAddress[to]++;
        emit Transfer(address(0), to, gameId);
        return (gameId, strgId);
    }

    /// @dev Allow token owner to set game editors.
    /// @param gameCreator The address of a GAME creator,
    /// @param editor The address of the editor to set.
    /// @param isEditor Add or remove the ability to edit.
    function _setGameEditor(
        address gameCreator,
        address editor,
        bool isEditor
    ) internal {
        emit GameEditorSet(gameCreator, editor, isEditor);
        _gameEditors[gameCreator][editor] = isEditor;
    }

    /// @dev Bumps the version number of a game token, buring the previous
    /// version and minting a new one.
    /// @param from The address of the GAME token owner.
    /// @param gameId The Game token to bump the version of.
    /// @return The new gameId.
    function _bumpGameVersion(address from, uint256 gameId) internal returns (uint256) {
        address originalCreator = address(uint160(gameId / CREATOR_OFFSET_MULTIPLIER));
        uint64 subId = uint64(gameId / SUBID_MULTIPLIER);
        uint16 version = uint16(gameId);
        version++;
        address owner = _ownerOf(gameId);
        if (from == owner) {
            // caller is owner or metaTx on owner's behalf
            _burn(from, owner, gameId);
        } else if (_gameEditors[owner][from]) {
            // caller is editor or metaTx on editor's behalf, so we need to pass owner
            // instead of from or _burn will fail
            _burn(owner, owner, gameId);
        }
        (uint256 newId, ) = _mintGame(originalCreator, owner, subId, version, false, false, 0);
        address newOwner = _ownerOf(newId);
        assert(owner == newOwner);
        return newId;
    }

    /// @dev Check if a withdrawal is allowed.
    /// @param from The address requesting the withdrawal.
    /// @param gameId The id of the GAME token to withdraw assets from.
    function _check_withdrawal_authorized(address from, uint256 gameId) internal view {
        require(from != address(0), "SENDER_ZERO_ADDRESS");
        require(from == _withdrawalOwnerOf(gameId), "LAST_OWNER_NOT_EQUAL_SENDER");
    }

    /// @dev Get the address allowed to withdraw assets from the GAME token.
    /// If too many assets in GAME, block.gaslimit won't allow detroy and withdraw in 1 tx.
    /// A game owner may destroy their GAME token, then withdraw assets in a later tx (even
    /// though_ownerOf(id) would be address(0) after burning.)
    /// @param id The id of the GAME token to query.
    /// @return the address of the owner before burning.
    function _withdrawalOwnerOf(uint256 id) internal view returns (address) {
        uint256 packedData = _owners[_storageId(id)];
        return address(uint160(packedData));
    }

    /// @dev A GameToken-specific implementation which handles versioned tokenIds.
    /// @param id The tokenId to get the owner of.
    /// @return The address of the owner.
    function _ownerOf(uint256 id) internal view override returns (address) {
        uint256 packedData = _owners[_storageId(id)];
        uint16 idVersion = uint16(id);
        uint16 storageVersion = uint16((packedData & VERSION_MASK) >> 200);

        if (((packedData & BURNED_FLAG) == BURNED_FLAG) || idVersion != storageVersion) {
            return address(0);
        }
        return address(uint160(packedData));
    }

    /// @dev get the layer a token was minted on from its id.
    /// @param id The id of the token to query.
    /// @return chainIndex The index of the original layer of minting.
    /// 0 = eth mainnet, 1 == matic mainnet, etc...
    function mintOrigin(uint256 id) public pure returns (uint256 chainIndex) {
        return uint256((id & CHAIN_INDEX_MASK) >> 16);
    }

    /// @dev Get the storageId (full id without the version number) from the full tokenId.
    /// @param id The full tokenId for the GAME token.
    /// @return The storageId.
    function _storageId(uint256 id) internal pure override returns (uint256) {
        return uint256(id & STORAGE_ID_MASK);
    }

    /// @dev Create a new gameId and associate it with an owner.
    /// This is a packed id, consisting of 3 parts:
    /// the creator's address, a uint64 subId and a uint32 version number.
    /// @param creator The address of the Game creator.
    /// @param subId The id to use when generating the new GameId.
    function _generateGameId(
        address creator,
        uint64 subId,
        uint16 version
    ) internal pure returns (uint256) {
        uint8 chainIndex = 1; // index for matic-mainnet
        return
            uint256(uint160(creator)) *
            CREATOR_OFFSET_MULTIPLIER +
            uint64(subId) *
            SUBID_MULTIPLIER +
            chainIndex *
            CHAIN_INDEX_OFFSET_MULTIPLIER +
            uint16(version);
    }

    /// @dev Get the a full URI string for a given hash + gameId.
    /// @param hash The 32 byte IPFS hash.
    /// @return The URI string.
    function _toFullURI(bytes32 hash) internal pure returns (string memory) {
        return string(abi.encodePacked("ipfs://bafybei", hash2base32(hash), "/", "game.json"));
    }

    /// @dev Convert a 32 byte hash to a base 32 string.
    /// @param hash A 32 byte (IPFS) hash.
    /// @return _uintAsString The hash as a base 32 string.
    // solium-disable-next-line security/no-assign-params
    function hash2base32(bytes32 hash) private pure returns (string memory _uintAsString) {
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
