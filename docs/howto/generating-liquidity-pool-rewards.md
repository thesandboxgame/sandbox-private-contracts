---
description: Generating liquidity pool rewards
---

# How to generate liquidity pool rewards ?

When using [uniswap](https://uniswap.org), you can stake your SAND in liquidity pool to earn rewards tokens.

## Requirements

If you haven't done it, follow the [getting started](../intro/index.md) tutorial first.

Here the inputs you need to get a snapshot of everyone who staked SAND up until a date of your choice:

- the date to consider for the rewards (it will determine the block number)

## The Graph service

The script located at `scripts/gathering/generateLPRewards.ts` is using the service [The Graph](https://thegraph.com) to query the blockchain. A subgraph API has been already generated at this address:

```url
https://api.thegraph.com/subgraphs/name/pixowl/staking
```

And it is used by the script to determine the rewards with a graphql query.

```sql
query($blockNumber: Int!, $first: Int!, $lastId: ID!) {
  stakers(
    first: $first
    where: {id_gt: $lastId}
    block: {number: $blockNumber}
  ) {
    id
  }
}
```

## Generating liquidity pool rewards

Run the script `generateLPRewards.ts` on the network of your choice and pass the deadline date as argument

```shell
yarn execute mainnet scripts/gathering/generateLPRewards.ts 2021-06-30T00:00:00Z
```

A summary is displayed with the block number and the number of stakers found

```json
{
  "date": "2021-06-29T23:59:13.000Z",
  "blockNumber": 12732053,
  "numStakers": 2082
}
```

Also, a file `result.json` is generated and located where you ran the script. This export is a json file containing the list of all of the addresses of the winners that should get a reward, ie:

```json
[
  "0x00166dc077f76c0619c680f9c992af715bed69b0",
  "0x002556d2ff1766dc2dcfe95c3066745c0eb2d885",
  "0x005018f9716f7c617c183fc3b4dd0eb17f72edc3",
  "0x005c25473bf2367aa821a7072332820ac9902547",
  "0x00b18ff3222fc785ea8b2ad5521ae472bdeed240"
]
```
