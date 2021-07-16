//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "@openzeppelin/contracts-0.8/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";
import "../../common/interfaces/IERC721Extended.sol";
import "../../common/Libraries/Verify.sol";

contract ClaimERC1155ERC721ERC20 {
    ///////////////////////////////  Libs //////////////////////////////

    using SafeERC20 for IERC20;

    ///////////////////////////////  Data //////////////////////////////

    struct Claim {
        address to;
        ERC1155Claim[] erc1155;
        ERC721Claim[] erc721;
        ERC20Claim erc20;
        bytes32 salt;
    }

    struct ERC1155Claim {
        uint256[] ids;
        uint256[] values;
        address contractAddress;
    }

    struct ERC721Claim {
        uint256[] ids;
        address contractAddress;
    }

    struct ERC20Claim {
        uint256[] amounts;
        address[] contractAddresses;
    }

    ///////////////////////////////  Events //////////////////////////////

    /// @dev Emits when a successful claim occurs.
    /// @param to The destination address for the claimed ERC1155, ERC721 and ERC20 tokens.
    /// @param erc1155 The array of ERC1155Claim structs containing the ids, values and ERC1155 contract address.
    /// @param erc721 The array of ERC721Claim structs containing the ids and ERC721 contract address.
    /// @param erc20 The ERC20Claim struct containing the amounts and ERC20 contract addresses.
    event ClaimedMultipleTokens(address to, ERC1155Claim[] erc1155, ERC721Claim[] erc721, ERC20Claim erc20);

    ///////////////////////////////  Functions ///////////////////////////

    /// @dev Internal function used to claim multiple token types in one claim.
    /// @param merkleRoot The merkle root hash for the specific set of items being claimed.
    /// @param claim The claim struct containing the destination address, all items to be claimed and optional salt param.
    /// @param proof The proof provided by the user performing the claim function.
    function _claimERC1155ERC721ERC20(
        bytes32 merkleRoot,
        Claim memory claim,
        bytes32[] calldata proof
    ) internal {
        _checkValidity(merkleRoot, claim, proof);
        for (uint256 i = 0; i < claim.erc1155.length; i++) {
            require(claim.erc1155[i].ids.length == claim.erc1155[i].values.length, "INVALID_INPUT");
            _transferERC1155(claim.to, claim.erc1155[i].ids, claim.erc1155[i].values, claim.erc1155[i].contractAddress);
        }
        for (uint256 i = 0; i < claim.erc721.length; i++) {
            _transferERC721(claim.to, claim.erc721[i].ids, claim.erc721[i].contractAddress);
        }
        if (claim.erc20.amounts.length != 0) {
            require(claim.erc20.amounts.length == claim.erc20.contractAddresses.length, "INVALID_INPUT");
            _transferERC20(claim.to, claim.erc20.amounts, claim.erc20.contractAddresses);
        }
        emit ClaimedMultipleTokens(claim.to, claim.erc1155, claim.erc721, claim.erc20);
    }

    /// @dev Private function used to check the validity of a specific claim.
    /// @param merkleRoot The merkle root hash for the specific set of items being claimed.
    /// @param claim The claim struct containing the destination address, all items to be claimed and optional salt param.
    /// @param proof The proof provided by the user performing the claim function.
    function _checkValidity(
        bytes32 merkleRoot,
        Claim memory claim,
        bytes32[] memory proof
    ) private pure {
        bytes32 leaf = _generateClaimHash(claim);
        require(Verify.doesComputedHashMatchMerkleRootHash(merkleRoot, proof, leaf), "INVALID_CLAIM");
    }

    /// @dev Private function used to generate a hash from an encoded claim.
    /// @param claim The claim struct.
    function _generateClaimHash(Claim memory claim) private pure returns (bytes32) {
        return keccak256(abi.encode(claim));
    }

    /// @dev Private function used to transfer the ERC1155 tokens specified in a specific claim.
    /// @param to The destination address for the claimed tokens.
    /// @param ids The array of ERC1155 ids.
    /// @param values The amount of ERC1155 tokens of each id to be transferred.
    /// @param contractAddress The ERC1155 token contract address.
    function _transferERC1155(
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        address contractAddress
    ) private {
        require(contractAddress != address(0), "INVALID_CONTRACT_ZERO_ADDRESS");
        IERC1155(contractAddress).safeBatchTransferFrom(address(this), to, ids, values, "");
    }

    /// @dev Private function used to transfer the ERC721tokens specified in a specific claim.
    /// @param to The destination address for the claimed tokens.
    /// @param ids The array of ERC721 ids.
    /// @param contractAddress The ERC721 token contract address.
    function _transferERC721(
        address to,
        uint256[] memory ids,
        address contractAddress
    ) private {
        require(contractAddress != address(0), "INVALID_CONTRACT_ZERO_ADDRESS");
        IERC721Extended(contractAddress).safeBatchTransferFrom(address(this), to, ids, "");
    }

    /// @dev Private function used to transfer the ERC20 tokens specified in a specific claim.
    /// @param to The destination address for the claimed tokens.
    /// @param amounts The array of amounts of ERC20 tokens to be transferred.
    /// @param contractAddresses The array of ERC20 token contract addresses.
    function _transferERC20(
        address to,
        uint256[] memory amounts,
        address[] memory contractAddresses
    ) private {
        for (uint256 i = 0; i < amounts.length; i++) {
            address erc20ContractAddress = contractAddresses[i];
            uint256 erc20Amount = amounts[i];
            require(erc20ContractAddress != address(0), "INVALID_CONTRACT_ZERO_ADDRESS");
            IERC20(erc20ContractAddress).safeTransferFrom(address(this), to, erc20Amount);
        }
    }
}
