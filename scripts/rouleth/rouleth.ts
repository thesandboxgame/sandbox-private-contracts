import fs from 'fs';
import {ethers} from 'hardhat';
import {BigNumber, utils} from 'ethers';
import {TheGraph} from '../utils/thegraph';
import 'dotenv/config';
// run the script: yarn execute mainnet scripts/rouleth/rouleth.ts
// this script need a json file with the same file name containing a block number, a number of ticket and a list of addresses
const {solidityKeccak256} = utils;
interface Owner {
  id: string;
  numLands: number;
}

const getAddressFromGraph = async (blockNb: number): Promise<Owner[]> => {
  const theGraph = new TheGraph(
    'https://api.thegraph.com/subgraphs/name/pixowl/the-sandbox'
  );
  // query for thegraph api that get adress from users who own more than a land
  const queryString = `
      query($blockNb: Int! $first: Int! $lastId: ID!) {
        owners(first: $first where: {numLands_gt: 0 id_gt: $lastId} block: {number: $blockNb}) {
          id
          numLands
        }
      }
    `;

  return theGraph.query(queryString, 'owners', {
    blockNb,
  });
};

const getAddressFromBack = async (address: string[]): Promise<string[]> => {
  const provider = ethers.provider;
  // check if address is a contract
  const isContract = async (address: string) => {
    const result = await provider.getCode(address);
    return result !== '0x';
  };
  // remove whitespaces, check if address is valid, resolve ens
  const verifyAddress = async (address: string) => {
    const addressClean: string = address.replace(/\s/g, '');
    if (ethers.utils.isAddress(addressClean)) {
      if (await isContract(addressClean)) {
        console.error('contract are not eligible:\t', addressClean);
        return false;
      }
      return addressClean;
    } else {
      try {
        const resolvedEns = await provider.resolveName(addressClean);
        if (resolvedEns !== null && address !== '.eth') {
          return resolvedEns;
        }
        console.error('failed to resolve ens:\t\t', addressClean);
        return false;
      } catch (err) {
        console.error(err);
      }
    }
  };
  // check all address are valid, and await resolution
  const promiseResolver = await Promise.all(
    address.map((add) => verifyAddress(add))
  );
  // insure we only have string in the array and false / undefined values from address check are removed
  const addressFromBack: string[] = promiseResolver.filter(
    (val) => typeof val === 'string'
  ) as string[];
  return addressFromBack;
};

const lottery = async (
  addBack: Array<string>,
  addGraph: Array<Owner>,
  maxWinnerNb: number,
  blockNumber: number
) => {
  const seed: string = (await ethers.provider.getBlock(blockNumber)).hash;
  class SeededRand {
    private seed;
    constructor(seed: string) {
      this.seed = seed;
    }
    nextInteger(): number {
      this.seed = solidityKeccak256(['bytes32'], [this.seed]);
      return BigNumber.from(this.seed)
        .mod('' + Number.MAX_SAFE_INTEGER)
        .toNumber();
    }
  }
  // return an array of address subscribe on the back
  // if an address own x land, add x time the address to the array (x >= 1)
  const extendedAddressArray = async () => {
    const extendedArray: Array<string> = [];
    addBack.filter((itemAddress: string) => {
      extendedArray.push(itemAddress);
      addGraph.map((itemLandOwner: Owner) => {
        if (itemLandOwner.id === itemAddress) {
          for (let i = 0; i < itemLandOwner.numLands; i++) {
            extendedArray.push(itemLandOwner.id);
          }
        }
      });
    });
    return extendedArray;
  };
  // return an array of max winner address randomly selected in the extendedAddressArray
  const randomWinnersSelection = (addresses: string[], seed: string) => {
    const result: Array<string> = [];
    const rand = new SeededRand(seed);
    let sortedList = addresses.sort((address1, address2) =>
      BigNumber.from(address1).sub(BigNumber.from(address2)).gt(0) ? 1 : -1
    );
    for (let i = 0; i < maxWinnerNb; i++) {
      const index = rand.nextInteger() % sortedList.length;
      const address = sortedList[index];
      result.push(address);
      sortedList = sortedList.filter(
        (v) => v.toLowerCase() !== address.toLowerCase()
      );
    }
    return result;
  };
  // check if there is less address than winners
  const generateWinners = (addresses: string[], seed: string) => {
    if (addresses.length <= maxWinnerNb) {
      return addresses;
    } else {
      return randomWinnersSelection(addresses, seed);
    }
  };
  const addresses: Array<string> = await extendedAddressArray();
  return generateWinners(addresses, seed);
};

const main = async () => {
  const argv = process.argv;
  const jsonFilePath = argv[1].replace('.ts', '.json');
  const rawdata = fs.readFileSync(jsonFilePath);
  const data = JSON.parse(rawdata.toString());
  const addressBack = data.tickets;
  const blockNumber = parseInt(data.blockNumber);
  const maxWinnerNb = parseInt(data.maxWinnerNb);
  const addBack: Array<string> = await getAddressFromBack(addressBack);
  const addGraph: Array<Owner> = await getAddressFromGraph(blockNumber);
  console.log('graph', JSON.stringify(addGraph, null, 2));
  console.log(
    'ADDRESS THAT WON THE LOTTERY\n',
    await lottery(addBack, addGraph, maxWinnerNb, blockNumber)
  );
  // fs.writeFileSync(`./roulethResult`, await lottery(addBack, addGraph, maxWinnerNb, blockNumber));
};

main();
