import fs from 'fs';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {createAssetClaimMerkleTree} from '../../data/giveaways/asset_giveaway_6/getAssets';
import {AddressZero} from '@ethersproject/constants';
import helpers, {AssetClaim} from '../../lib/merkleTreeHelper';
const {calculateClaimableAssetHash} = helpers;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts, network, getChainId} = hre;
  const {deploy, log} = deployments;
  const chainId = await getChainId();
  const {deployer} = await getNamedAccounts();

  let assetData: AssetClaim[];
  try {
    assetData = JSON.parse(
      fs
        .readFileSync(
          `data/giveaways/asset_giveaway_6/assets_${hre.network.name}.json`
        )
        .toString()
    );
  } catch (e) {
    return;
  }

  if (assetData.length === 0) {
    log('no assets for Asset_Giveaway_6');
    return;
  }

  const {
    assets,
    merkleRootHash,
    saltedAssets,
    tree,
  } = createAssetClaimMerkleTree(network.live, chainId, assetData);

  const assetContract = await deployments.get('Asset');

  await deploy('Asset_Giveaway_6', {
    contract: 'AssetGiveaway',
    from: deployer,
    linkedData: assets,
    log: true,
    skipIfAlreadyDeployed: true,
    args: [
      assetContract.address,
      AddressZero, // no admin needed
      merkleRootHash,
      AddressZero, // owns the assets
      '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', // do not expire
    ],
  });

  const claimsWithProofs: (AssetClaim & {proof: string[]})[] = [];
  for (const claim of saltedAssets) {
    claimsWithProofs.push({
      ...claim,
      proof: tree.getProof(calculateClaimableAssetHash(claim)),
    });
  }
  if (network.name !== 'hardhat') {
    fs.writeFileSync(
      `./secret/.asset_giveaway_6_claims_proofs_${chainId}.json`,
      JSON.stringify(claimsWithProofs, null, '  ')
    );
  }
};
export default func;
func.tags = ['Asset_Giveaway_6', 'Asset_Giveaway_6_deploy'];
func.dependencies = ['Asset_deploy'];
