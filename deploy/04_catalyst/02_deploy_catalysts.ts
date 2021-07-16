import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';
import catalysts from '../../data/catalysts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const DefaultAttributes = await deployments.get('DefaultAttributes');
  const GemsCatalystsRegistry = await deployments.get('GemsCatalystsRegistry');

  const {catalystAdmin, deployer} = await getNamedAccounts();
  for (const catalyst of catalysts) {
    await deploy(`Catalyst_${catalyst.symbol}`, {
      contract: 'Catalyst',
      from: deployer,
      log: true,
      args: [
        `Sandbox's ${catalyst.symbol} Catalysts`,
        catalyst.symbol,
        catalystAdmin,
        catalyst.maxGems,
        catalyst.catalystId,
        DefaultAttributes.address,
        GemsCatalystsRegistry.address,
      ],
      skipIfAlreadyDeployed: true,
    });
  }
};
export default func;
func.tags = ['Catalysts', 'Catalysts_deploy'];
func.dependencies = [
  'DefaultAttributes_deploy',
  'GemsCatalystsRegistry_deploy',
];
func.skip = skipUnlessTest; // disabled for now
