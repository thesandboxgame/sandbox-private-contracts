---
description: Setting environment variables
---

# Setting environment variables

## Environment variables

Copy the .env.example file
```shell
cp -a .env.example .env
```

## Wallet

In order to communicate with the blockchain, a wallet is required.
A BIP39 Mnemonic, also called a seed phrase, is a 12-word combination that is used to manipulate your wallet.

As a developer, you only need a rinkeby wallet. The blockchain team shares the same wallet (ask the blockchain team for the seed phrase).
Set the seed phrase for rinkeby:
```shell
MNEMONIC_RINKEBY=cherry cherry cherry cherry cherry cherry cherry cherry cherry cherry cherry cherry
```

For the mainnet, you'll have to set your personal seed phrase on `MNEMONIC_MAINNET`.

## Infura

[Infura](https://infura.io) provides an API to access the Ethereum network.

- [create an account](https://infura.io/register) on Infura
- go the `ETHEREUM` tab and create a new project
- on the `KEYS` section, select the ENDPOINTS `Mainnet`
- copy the https URL below the ENDPOINTS
- set the ETH_NODE_URI_MAINNET variable in the `.env` file
```shell
ETH_NODE_URI_MAINNET=https://mainnet.infura.io/v3/xxxxxxxxxxxxxxxx
```

- Do the same for the rinkeby network by setting the ETH_NODE_URI_RINKEBY variable in the `.env` file
```shell
ETH_NODE_URI_RINKEBY=https://rinkeby.infura.io/v3/xxxxxxxxxxxxxxxx
```

## Etherscan

[Etherscan](https://etherscan.io/) is a Block Explorer and Analytics Platform for Ethereum, a decentralized smart contracts platform.

- [create an account](https://etherscan.io/register) on Etherscan
- [create an API Key](https://etherscan.io/myapikey)
- copy your API Key
- set the ETHERSCAN_API_KEY variable in the `.env` file
```shell
ETHERSCAN_API_KEY=xxxxxxxxxxxxxxxx
```

Your next step is to [develop your first feature](../tutorials/developing-first-feature.md)
