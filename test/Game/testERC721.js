// const {ethers, getNamedAccounts, ethereum} = require('@nomiclabs/buidler');
const {
  ethers,
  deployments,
  getNamedAccounts,
  getUnnamedAccounts,
} = require('hardhat');
const {BigNumber, utils} = require('ethers');
const Prando = require('prando');
const {supplyAssets} = require('./assets');
const {expectEventWithArgs} = require('../utils');
const {toUtf8Bytes} = require('ethers/lib/utils');

const rng = new Prando('GameToken ERC721 tests');
async function getRandom() {
  return rng.nextInt(1, 1000000000);
}

const creation = {
  assetIdsToRemove: [],
  assetAmountsToRemove: [],
  assetIdsToAdd: [],
  assetAmountsToAdd: [1],
  uri: utils.keccak256(toUtf8Bytes('My GAME token URI!')),
};

const erc721Tests = require('../erc721')(
  async () => {
    const {gameTokenAdmin} = await getNamedAccounts();
    const others = await getUnnamedAccounts();
    await deployments.fixture(['ChildGameToken']);

    const contract = await ethers.getContract('ChildGameToken');

    const gameAsAdmin = await contract.connect(
      ethers.provider.getSigner(gameTokenAdmin)
    );
    await gameAsAdmin.changeMinter(gameTokenAdmin);

    async function mint(to) {
      const assets = await supplyAssets(to, [1]);
      const randomId = await getRandom();

      const receipt = await gameAsAdmin.createGame(
        to,
        to,
        {
          ...creation,
          assetIdsToAdd: assets,
        },
        ethers.constants.AddressZero,
        randomId
      );
      const updateEvent = await expectEventWithArgs(
        contract,
        receipt,
        'GameTokenUpdated'
      );
      const tokenId = BigNumber.from(updateEvent.args[1]);
      return {receipt, tokenId};
    }
    return {contractAddress: contract.address, users: others, mint};
  },
  {
    batchTransfer: true,
    burn: true,
    burnAsset: false,
    mandatoryERC721Receiver: true,
  }
);

function recurse(test) {
  if (test.subTests) {
    // eslint-disable-next-line mocha/no-setup-in-describe
    describe(test.title, function () {
      // eslint-disable-next-line mocha/no-setup-in-describe
      for (const subTest of test.subTests) {
        // eslint-disable-next-line mocha/no-setup-in-describe
        recurse(subTest);
      }
    });
  } else {
    it(test.title, test.test);
  }
}

describe('GameToken:ERC721', function () {
  for (const test of erc721Tests) {
    // eslint-disable-next-line mocha/no-setup-in-describe
    recurse(test);
  }
});
