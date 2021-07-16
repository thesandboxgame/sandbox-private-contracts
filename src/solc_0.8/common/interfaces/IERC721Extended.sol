//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "@openzeppelin/contracts-0.8/token/ERC721/IERC721.sol";

interface IERC721Extended is IERC721 {
    function approveFor(
        address sender,
        address operator,
        uint256 id
    ) external;

    function batchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        bytes calldata data
    ) external;

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        bytes calldata data
    ) external;

    function setApprovalForAllFor(
        address sender,
        address operator,
        bool approved
    ) external;

    function burn(uint256 id) external;

    function burnFrom(address from, uint256 id) external;
}
