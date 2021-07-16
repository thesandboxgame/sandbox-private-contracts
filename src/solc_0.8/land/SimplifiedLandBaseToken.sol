//SPDX-License-Identifier: MIT
/* solhint-disable func-order, code-complexity */
pragma solidity 0.8.2;

import "../common/BaseWithStorage/ERC721BaseToken.sol";

contract SimplifiedLandBaseToken is ERC721BaseToken {
    // Our grid is 408 x 408 lands
    uint256 internal constant GRID_SIZE = 408;
    // set ChildChainManager as only minter for Polygon, but keep flexibility for other L2s
    mapping(address => bool) internal _minters;

    constructor(
        address trustedForwarder,
        uint8 chainIndex,
        address admin
    ) {
        _admin = admin;
        ERC721BaseToken.__ERC721BaseToken_initialize(chainIndex);
        ERC2771Handler.__ERC2771Handler_initialize(trustedForwarder);
    }

    // @todo implement land minting without quads
    // consider seperating into _mintLand & _mintLandBatch...
    // It is likeky that existing L1 estates(with quads) will be migrated to L2. make it easy for them to be reminted on L2.
    /// @notice Mint one or more lands
    /// @param to The recipient of the new quad
    /// @param xCoordinates An array of x coordinates for the top left corner of lands to mint
    /// @param yCoordinates An array of y coordinates for the top left corner of lands to mint
    /// @param landData extra data to pass to the transfer
    function _mintLand(
        address to,
        uint256[] memory xCoordinates,
        uint256[] memory yCoordinates,
        bytes[] calldata landData
    ) internal {
        require(
            xCoordinates.length == yCoordinates.length && yCoordinates.length == landData.length,
            "ARRAY_LENGTH_MISMATCH"
        );
        require(to != address(0), "to is zero address");
        require(isMinter(msg.sender), "Only a minter can mint");

        for (uint256 i; i < xCoordinates.length; i++) {
            uint256 x = xCoordinates[i];
            uint256 y = yCoordinates[i];
            bytes memory data = landData[i];
            require(x <= GRID_SIZE - 1 && y <= GRID_SIZE - 1, "Out of bounds");

            uint256 id = x + y * GRID_SIZE;
            require(_owners[id] == 0, "ALREADY_MINTED");
            _owners[id] = uint256(uint160(to));
            _numNFTPerAddress[to]++;
            emit Transfer(address(0), to, id);
        }
        // @todo keep _idInPath, but simplify.
        /**
        for (uint256 i = 0; i < size*size; i++) {
            uint256 id = _idInPath(i, size, x, y);
            require(_owners[id] == 0, "Already minted");
            emit Transfer(address(0), to, id);
        }
        */
    }

    /// @notice check whether address `who` is given minter rights.
    /// @param who The address to query.
    /// @return whether the address has minter rights.
    function isMinter(address who) public view returns (bool) {
        return _minters[who];
    }

    /// @notice x coordinate of Land token
    /// @param id tokenId
    /// @return the x coordinates
    function x(uint256 id) external view returns (uint256) {
        require(_ownerOf(id) != address(0), "token does not exist");
        return id % GRID_SIZE;
    }

    /// @notice y coordinate of Land token
    /// @param id tokenId
    /// @return the y coordinates
    function y(uint256 id) external view returns (uint256) {
        require(_ownerOf(id) != address(0), "token does not exist");
        return id / GRID_SIZE;
    }

    /// @notice total width of the map
    /// @return width
    function width() external pure returns (uint256) {
        return GRID_SIZE;
    }

    /// @notice total height of the map
    /// @return height
    function height() external pure returns (uint256) {
        return GRID_SIZE;
    }

    // @note from Ronan: "the _idInPath is still needed to ensure lands are adjacent, but it could maybe be simplified if there are no quads."
    function _idInPath(
        uint256 i,
        uint256 size,
        uint256 x,
        uint256 y
    ) internal pure returns (uint256) {
        uint256 row = i / size;
        if (row % 2 == 0) {
            // alow ids to follow a path in a quad
            return (x + (i % size)) + ((y + row) * GRID_SIZE);
        } else {
            return ((x + size) - (1 + (i % size))) + ((y + row) * GRID_SIZE);
        }
    }
}
