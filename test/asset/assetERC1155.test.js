const {
  ethers,
  getUnnamedAccounts,
  getNamedAccounts,
  deployments,
} = require('hardhat');
const {waitFor, recurseTests} = require('../utils');
const generateERC1155Tests = require('../erc1155');

function testAsset() {
  const erc1155Tests = generateERC1155Tests(async () => {
    const {deployer, assetBouncerAdmin} = await getNamedAccounts();
    const otherAccounts = await getUnnamedAccounts();
    const minter = otherAccounts[0];
    const users = otherAccounts.slice(1);
    await deployments.fixture('Asset');

    const assetContractAsBouncerAdmin = await ethers.getContract(
      'Asset',
      assetBouncerAdmin
    );

    await waitFor(assetContractAsBouncerAdmin.setBouncer(minter, true));

    const Asset = await ethers.getContract('Asset', minter);

    const receiverAddress = Asset.address;

    const testMetadataHash = ethers.utils.formatBytes32String('metadataHash');

    let counter = 0;

    // eslint-disable-next-line max-params
    async function mint(id, user, supply) {
      // address creator,
      // uint40 packId,
      // bytes32 hash,
      // uint256 supply,
      // uint8 rarity,
      // address owner,
      // bytes calldata data

      const tx = await Asset.mint(
        user,
        id,
        testMetadataHash,
        supply,
        1,
        user,
        '0x'
      );
      counter++;
      const receipt = await tx.wait();
      return {
        receipt,
        tokenId: receipt.events
          .find((v) => v.event === 'TransferSingle')
          .args[3].toString(),
      };
    }

    async function mintMultiple(id, user, supplies) {
      // address creator,
      // uint40 packId,
      // bytes32 hash,
      // uint256[] calldata supplies,
      // bytes calldata rarityPack,
      // address owner,
      // bytes calldata data

      const tx = await Asset.mintMultiple(
        user,
        id,
        testMetadataHash,
        supplies,
        1,
        user,
        '0x'
      );
      counter++;
      const receipt = await tx.wait();
      return {
        receipt,
        tokenIds: receipt.events.find((v) => v.event === 'TransferBatch')
          .args[3],
      };
    }
    const assetIds = [];
    assetIds.push((await mint(counter, minter, 10)).tokenId);
    assetIds.push((await mint(counter, minter, 1)).tokenId);
    assetIds.push((await mint(counter, minter, 5)).tokenId);
    assetIds.push((await mint(counter, minter, 1)).tokenId);
    assetIds.push((await mint(counter, minter, 12)).tokenId);
    assetIds.push((await mint(counter, minter, 1)).tokenId);
    assetIds.push((await mint(counter, minter, 1111)).tokenId);
    assetIds.push((await mint(counter, minter, 1)).tokenId);

    const batchIds = (
      await mintMultiple(counter, minter, [
        10,
        5,
        8,
        9,
        10,
        6,
        8,
        8,
        10,
        12,
        1,
        1,
        1,
      ])
    ).tokenIds;

    return {
      ethersProvider: ethers.provider,
      contractAddress: Asset.address,
      contract: Asset,
      users,
      mint,
      mintMultiple,
      deployer,
      tokenIds: assetIds,
      batchIds,
      minter,
      deployments,
      receiverAddress,
    };
  }, {});

  describe('Asset:ERC1155', function () {
    for (const test of erc1155Tests) {
      // eslint-disable-next-line mocha/no-setup-in-describe
      recurseTests(test);
    }
  });
}

testAsset();
