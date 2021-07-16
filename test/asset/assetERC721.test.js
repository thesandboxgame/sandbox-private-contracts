const {
  ethers,
  deployments,
  getNamedAccounts,
  getUnnamedAccounts,
} = require('hardhat');

const {waitFor, expectEventWithArgsFromReceipt} = require('../utils');

const erc721Tests = require('../erc721')(
  async () => {
    const others = await getUnnamedAccounts();
    const {assetBouncerAdmin} = await getNamedAccounts();
    await deployments.fixture('Asset');
    const minter = others[0];
    const asset = await ethers.getContract('Asset');
    const assetAsMinter = await asset.connect(
      ethers.provider.getSigner(minter)
    );
    const assetContractAsBouncerAdmin = await ethers.getContract(
      'Asset',
      assetBouncerAdmin
    );

    await waitFor(assetContractAsBouncerAdmin.setBouncer(minter, true));

    let id = 0;
    const ipfsHashString =
      '0x78b9f42c22c3c8b260b781578da3151e8200c741c6b7437bafaff5a9df9b403e';

    async function mint(to) {
      const creator = to;
      const packId = ++id;
      const hash = ipfsHashString;
      const supply = 1;
      const rarity = 0;
      const owner = to;
      const data = '0x';

      const receipt = await waitFor(
        assetAsMinter.mint(creator, packId, hash, supply, rarity, owner, data)
      );

      const event = await expectEventWithArgsFromReceipt(
        asset,
        receipt,
        'TransferSingle'
      );
      const tokenId = event.args[3];
      return {receipt, tokenId};
    }
    return {contractAddress: asset.address, users: others, mint};
  },
  {
    batchTransfer: false,
    burn: false,
    burnAsset: true,
    mandatoryERC721Receiver: false,
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

describe('Asset:ERC721', function () {
  for (const test of erc721Tests) {
    // eslint-disable-next-line mocha/no-setup-in-describe
    recurse(test);
  }
});
