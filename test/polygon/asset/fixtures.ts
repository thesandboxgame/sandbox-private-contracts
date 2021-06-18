import {Event} from '@ethersproject/contracts';
import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';

import {waitFor, setupUsers} from '../../utils';
// import asset_regenerate_and_distribute from '../../setup/asset_regenerate_and_distribute';

export const setupAsset = deployments.createFixture(async function () {
  await deployments.fixture(['PolygonAsset']);
  // await asset_regenerate_and_distribute(hre);
  const otherAccounts = await getUnnamedAccounts();
  const minter = otherAccounts[0];
  otherAccounts.splice(0, 1);

  const {assetBouncerAdmin} = await getNamedAccounts();

  const assetContractAsBouncerAdmin = await ethers.getContract(
    'PolygonAsset',
    assetBouncerAdmin
  );
  await waitFor(assetContractAsBouncerAdmin.setBouncer(minter, true));
  const Asset = await ethers.getContract('PolygonAsset', minter);
  const childChainManager = await ethers.getContract('CHILD_CHAIN_MANAGER');
  const TRUSTED_FORWARDER = await deployments.get('TRUSTED_FORWARDER');
  const trustedForwarder = await ethers.getContractAt(
    'TestMetaTxForwarder',
    TRUSTED_FORWARDER.address
  );

    // Set childChainManager Asset
    let setAssetReceipt;
    try {
      setAssetReceipt = await waitFor(
        childChainManager.setPolygonAsset(Asset.address)
      )
    } catch (e) {
      console.log(e);
    }

  let id = 0;
  const ipfsHashString =
    '0x78b9f42c22c3c8b260b781578da3151e8200c741c6b7437bafaff5a9df9b403e';

  async function mintAsset(to: string, value: number) {
    // Asset to be minted
    const creator = to;
    const packId = ++id;
    const hash = ipfsHashString;
    const supply = value;
    const rarity = 0;
    const owner = to;
    const data = '0x';

    let receipt;
    try {
      receipt = await waitFor(
        Asset.mint(creator, packId, hash, supply, rarity, owner, data)
      );
    } catch (e) {
      console.log(e);
    }

    const event = receipt?.events?.filter(
      (event: Event) => event.event === 'TransferSingle'
    )[0];
    if (!event) {
      throw new Error('no TransferSingle event after mint single');
    }
    return event.args?.id;
  }

  const users = await setupUsers(otherAccounts, {Asset});

  return {
    Asset,
    users,
    mintAsset,
    trustedForwarder,
    childChainManager,
  };
});
