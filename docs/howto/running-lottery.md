---
description: Running a lottery
---

# How to run a lottery ?

## Requirements

If you haven't done it, follow the [getting started](../intro/index.md) tutorial first.

Here the inputs you need to run a lottery:

- the block number to use during the lottery
- the maximum number of users that can win the lottery
- a list of addresses that participate to the lottery (provided by the backend team)

## What is a lottery ?

The idea of the lottery is to reward owners of lands. The winners are randomly selected but the more lands you have the more chances to win you have.

## Running the lottery

The script needs to have at the same path a json file with the same name (`rouleth.ts` would require a `rouleth.json`) containing the block number, the number of winners and the participants. Internally, the script uses [The Graph](https://thegraph.com/) to query the blockchain.

After creating the `rouleth.json` file, run the script on the network of your choice with:
```shell
yarn execute mainnet scripts/rouleth/rouleth.ts
```

!!! example
    ```json
    {
      "blockNumber": "11438254",
      "maxWinnerNb": "10",
      "tickets": [
        "0xffc617a199e9717f0a3208371b026d93e56b10eb",
        "0x7466ebF3B8aF67511f7163Ab1E31f928b2E60330",
        "0x0081d6E0a5A7CB0C1a0636e276982d8Bbd12b71d",
        "0xc212Fc9E1A61b8400E0323FDe83ed1Fe359e3312",
        "0xEDBC7D68195A411D5c6a32d3bd93703880Ad7692",
        "0x3E0998E9FCbD992d36239D5c5ad182D2B5CfB00b",
        "0x9F1f7957C0456157485a0Fc433a5f86403055432",
        "0x03d366a956775a3476df720254d45deb0891c6a9",
        "0x0368bec04b11c47a6bb72d611282bb80e029c0c7",
        "0x03813ce38a3ed7785fa0920706cc010790c8a05f",
        "0x03892ea625e341859ac654150836d991f578e3be",
        "0x038ce2f12e592dd1b9ed8a6e5aa213ca135417aa",
        "0x038dc3bf2121ea337bffe8a03d95fbb205e37b0f",
        "0x039ed38dd7abc5ce9b311ddd05c656f1b46d416f",
        "0x03a4234e6ced7f3276b8d42fee83ca1ea64e34bb",
        "0x05329a2a6a91bb66dac615d1426a40ae468a1255",
        "0x056d2d46edd91692595a3c85f5bded037a5c9da2"
      ]
    }
    ```

The winners are displayed in a json containing the list of adresses

!!! example
    ```json
    [
      "0x03892ea625e341859ac654150836d991f578e3be",
      "0x038dc3bf2121ea337bffe8a03d95fbb205e37b0f",
      "0x03d366a956775a3476df720254d45deb0891c6a9",
      "0x0368bec04b11c47a6bb72d611282bb80e029c0c7",
      "0x03a4234e6ced7f3276b8d42fee83ca1ea64e34bb",
      "0x7466ebF3B8aF67511f7163Ab1E31f928b2E60330",
      "0xffc617a199e9717f0a3208371b026d93e56b10eb",
      "0x038ce2f12e592dd1b9ed8a6e5aa213ca135417aa",
      "0x05329a2a6a91bb66dac615d1426a40ae468a1255",
      "0xc212Fc9E1A61b8400E0323FDe83ed1Fe359e3312"
    ]
    ```

## How the script works

The script is divided in 4 main modules.

- main() deal with the arguments, call the other modules
- getAddressFromGraph() query the sandbox subgraph to get the 1. addresses that owned a land at the time of the snapshot and 2. the number of lands they had
- getAddressFromBack() retrieve from the json the list of address that the back provides us and perform verification (validity and ens resolution)
- lottery() will randomly select winners, weighting is function of how many lands each user owned at the time of the snapshot
