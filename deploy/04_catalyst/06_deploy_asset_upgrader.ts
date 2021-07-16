import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';
import {upgradeFee, gemAdditionFee} from '../../data/assetUpgraderFees';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const AssetAttributesRegistry = await deployments.get(
    'AssetAttributesRegistry'
  );
  const Sand = await deployments.get('Sand');
  const Asset = await deployments.get('Asset');
  const GemsCatalystsRegistry = await deployments.get('GemsCatalystsRegistry');

  const {deployer, catalystAssetFeeRecipient} = await getNamedAccounts();

  await deploy(`AssetUpgrader`, {
    from: deployer,
    log: true,
    args: [
      AssetAttributesRegistry.address,
      Sand.address,
      Asset.address,
      GemsCatalystsRegistry.address,
      upgradeFee,
      gemAdditionFee,
      catalystAssetFeeRecipient,
    ],
  });
};
export default func;
func.tags = ['AssetUpgrader', 'AssetUpgrader_deploy'];
func.dependencies = [
  'AssetAttributesRegistry_deploy',
  'Sand_deploy',
  'Asset_deploy',
  'GemsCatalystsRegistry_deploy',
];
func.skip = skipUnlessTest; // disabled for now
