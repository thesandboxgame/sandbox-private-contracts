import hre, {getNamedAccounts} from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import {AssetClaim} from '../lib/merkleTreeHelper';

const func: DeployFunction = async function () {
  const {deployments} = hre;
  const {execute, catchUnknownSigner} = deployments;

  const {deployer} = await getNamedAccounts();

  let owner;
  let tokenId;

  switch (hre.network.name) {
    case 'mainnet':
      owner = '0x7a9fe22691c811ea339d9b73150e6911a5343dca';
      tokenId =
        '55464657044963196816950587289035428064568320970692304673817341489687556012032';
      break;
    case 'rinkeby':
      owner = deployer;
      tokenId =
        '62444819085029820430510176096152162965519726676600689231267083118584247879680';
      break;
  }

  if (!owner || owner === '') {
    return;
  }

  const AssetGiveaway = await deployments.get('Asset_Giveaway_4');

  const assetData: AssetClaim[] = AssetGiveaway.linkedData;
  let totalAsset = 0;
  for (const asset of assetData) {
    if (asset.assetIds[0] !== tokenId) {
      throw new Error(`invalid asset`);
    }
    if (asset.assetIds.length > 1) {
      throw new Error(`not supported: multiple assets`);
    }
    totalAsset += asset.assetValues[0];
  }

  console.log({
    assetId: tokenId,
    totalAsset,
  });

  await catchUnknownSigner(
    execute(
      'Asset',
      {from: owner, log: true},
      'safeTransferFrom(address,address,uint256,uint256,bytes)',
      owner,
      AssetGiveaway.address,
      tokenId,
      totalAsset,
      '0x'
    )
  );
};
export default func;

if (require.main === module) {
  func(hre);
}
