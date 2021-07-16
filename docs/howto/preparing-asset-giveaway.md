---
description: Preparing an ASSET giveaway
---

# How to prepare an ASSET giveaway ?

If you haven't done it, follow the [getting started](../intro/index.md) tutorial first.

## Obtaining the ASSET to claim

There are two ways to obtain the ASSET, one is creating a genesis assets through the command line

### Through a script

```shell
yarn execute rinkeby scripts/transact/connected_mintGenesisAsset.ts
```

The script will output a json where you can find the token id of the asset

```json
{
  "from": "0x0000000000000000000000000000000000000000",
  "to": "0xa4519D601F43D0b8f167842a367465681F652252",
  "id": "74323507945526641635977002777803291354030065309481262884217564584542581295104",
  "quantity": "20000"
}
```

### Through the dashbaord

And the other one is minting an ASSET using the dashboard

- upload and mint an asset using VE
- copy the token id

## Obtaining the addresses

### Rinkeby

For testing purposes, ask the addresses to whoever is going to test it.

### Mainnet

For mainnet, The list of addresses should come from the output of a certain reward requirements

## Deploying the contract

Once we have the pre-proof generated with the tokenId and addresses, we can deploy the contract

### Generating the deployment data

A new deployment should be created, this can be done by duplicating the last deployment and renaming it to the latest deployment number (if last deployment is asset_giveaway_3, the new one should be asset_giveaway_4).

!!! example
    ```shell
    cp -a data/giveaways/asset_giveaway_3 data/giveaways/asset_giveaway_4
    ```

This folder contains 3 files
```shell
assets_mainnet.json
assets_rinkeby.json
getAssets.ts
```
The file `assets_mainnet.json` is a json containing the list of addresses to whom gift the asset. The structure of the json is an array of object where:

- `reservedAddress` is the address of the winner
- `assetIds` are the assets that the winner can claim
- `assetValues` are the number of asset the winner can claim of each asset id

!!! example
    ```json
    [
      {
        "reservedAddress": "0x00493aa44bcfd6f0c2ecc7f8b154e4fb352d1c81",
        "assetIds": [
          "55464657044963196816950587289035428064568320970692304673817341489687572776960"
        ],
        "assetValues": [
          1
        ]
      }
    ]
    ```

To generate this json file, you can use [this script](https://github.com/thesandboxgame/TSB_Marketplace/blob/master/web-marketplace-server/src/scripts/AssetClaimPreProofsGenerator.js)

### Merging the code

Once the giveaway data are ready, push it to the repository, so it gets reviewed.

### Running the deployment

Run the deployment with the deploy command

On Rinkeby
```shell
yarn deploy rinkeby
```

On Mainnet
```shell
yarn deploy mainnet
```

### Transfering the asset to the ASSET giveaway contract

Afterwards, the reward asset should be transferred by the owner to the deployed contract.
The ASSET giveaway contract is an [ERC1155](https://eips.ethereum.org/EIPS/eip-1155#specification). The entrypoint safeTransferFrom can be called to transfer the asset with this input

- from: address of the owner
- to: address of the ASSET giveaway contract
- ids: token ids of the assets
- amounts: quantity of assets for each token ids
- data: none

Here is an [example](https://etherscan.io/tx/0x9eab1686825254fe16e68b3a8f430ce74002a3900ebfb47ce35a69fe1e75c0d7) of a transfer of assets to the ASSET giveaway contract

```
from: 0x7a9fe22691c811ea339d9b73150e6911a5343dca
to: 0xa342f5D851E866E18ff98F351f2c6637f4478dB5 (Asset)
method: safeTransferFrom(address,address,uint256,uint256,bytes)
args:
- 0x7a9fe22691c811ea339d9b73150e6911a5343dca
- 0x34A64705ad386124CDc7058A68220f11E19F4E90
- 55464657044963196816950587289035428064568320970692304673817341489687774103552
- 1808
- 0x
```
