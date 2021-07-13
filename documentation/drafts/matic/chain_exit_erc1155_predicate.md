# ChainExitERC1155Predicate

A Predicate for ERC1155 Tokens that allows Tokens to be in some case irrevocably burnt on L2 (locked forever on L1) and in some other case burn to be transfered back on l1

The predicate only consider the ChainExit event, which is as follow:

```solidity
event ChainExit(address to, uint256 tokenId, uint256 amount, bytes data);
```

It will only be emitted on L2 when the token is burnt with the intent of transfering the token to L1.

It will not be emitted if the token is burnt with the intent of being permanently burnt.

(There is no incentive to allow the burn to be actualised on L1 and allowing it to be burnt on L1 introduce some unecessary complexity regarding supply. An alternative would be to still emit the event on a permanent burn and set the `to` parameter to `address(0)` but then reject such exit on L1)


The predicate will consume the event as follow :

- if `to` == `address(0)` reject the exit
- else
  - call Asset.fromL2(tokenId, data)
  - if balance < amount:
    mint(amount - balance)
  - transfer amount to `to`

