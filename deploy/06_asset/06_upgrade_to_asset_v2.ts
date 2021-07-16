import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';

const func: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const {deployments, getNamedAccounts} = hre;
  const {
    assetBouncerAdmin,
    assetAdmin,
    upgradeAdmin,
  } = await getNamedAccounts();
  const {deploy} = deployments;

  const TRUSTED_FORWARDER = await deployments.get('TRUSTED_FORWARDER');

  const ERC1155_PREDICATE = await deployments.get('ERC1155_PREDICATE');

  await deploy('Asset', {
    from: upgradeAdmin,
    contract: 'AssetV2',
    args: [
      TRUSTED_FORWARDER.address,
      assetAdmin,
      assetBouncerAdmin,
      ERC1155_PREDICATE.address,
      0,
    ],
    proxy: {
      owner: upgradeAdmin,
      proxyContract: 'OpenZeppelinTransparentProxy',
      methodName: 'initV2',
      upgradeIndex: 1,
    },
    log: true,
  });

  console.log('Asset upgraded to AssetV2');
};

export default func;
func.tags = ['Asset', 'AssetV2', 'AssetV2_deploy'];
func.runAtTheEnd = true;
func.dependencies = [
  'Asset_deploy',
  'Asset_setup',
  'AssetMinter_deploy',
  'TRUSTED_FORWARDER',
  'ERC1155_PREDICATE',
];
func.skip = skipUnlessTest;
