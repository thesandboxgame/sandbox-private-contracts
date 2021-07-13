# ChainExitERC1155Predicate

A Predicate for ERC1155 Tokens that allows Tokens to be in some case irrevocably burnt on L2 and in some other case burn to be transfered back on l1

The predicate only consider the ChainExit event, which is as follow:

```solidity
event ChainExit(address to, uint256 tokenId, uint256 amount, bytes data);
```

It will be emitted on L2 when the token is burnt (Transfer to `address(0)`)

If the transaction that burnt the token was meant to be so the user can retrived it on L1. the ChainExit event's `to` parameter will represent the address that is expected to withdraw the token on L1.

If the transaction that burnt the token was meant to be a permanent burnt, the ChainExit event's `to` parameter will be `address(0)` but will only do so for token that was originally minted on L1.

 This can work with token that have a fixed initial supply. It would need to be passed through ChainExit data field so that proper management of supply can be performed.
This complicate thing and the [./chain_exit_erc1155_predicate.md](./chain_exit_erc1155_predicate.md) proposal is simpler
