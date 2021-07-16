import fs from 'fs';
import {TheGraph} from '../utils/thegraph';
import hre from 'hardhat';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const EthDater = require('ethereum-block-by-date');
const {ethers} = hre;
const args = process.argv.slice(2);

interface Staker {
  id: string;
}

const theGraph = new TheGraph(
  'https://api.thegraph.com/subgraphs/name/pixowl/staking'
);

const queryString = `
  query($blockNumber: Int! $first: Int! $lastId: ID!) {
    stakers(first: $first where: {id_gt: $lastId} block: {number: $blockNumber}) {
      id
    }
  }
`;

async function main() {
  const date = args[0];
  if (!date) throw new Error('Date must be provided');
  const dater = new EthDater(ethers.provider);
  // Get closest block before date
  const {block: blockNumber, timestamp} = await dater.getDate(date, false);
  const addList: Array<string> = [];

  const stakers: Array<Staker> = await theGraph.query(queryString, 'stakers', {
    blockNumber,
  });

  stakers.map((staker) => {
    addList.push(staker.id);
  });

  console.log({
    date: new Date(timestamp * 1000).toISOString(),
    blockNumber,
    numStakers: stakers.length,
  });
  fs.writeFileSync('result.json', JSON.stringify(addList, null, '  '));
}

main();
