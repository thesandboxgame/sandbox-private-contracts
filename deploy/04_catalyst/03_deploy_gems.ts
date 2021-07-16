import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';
import gems from '../../data/gems';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const GemsCatalystsRegistry = await deployments.get('GemsCatalystsRegistry');

  const {gemMinter, deployer} = await getNamedAccounts();
  for (const gem of gems) {
    await deploy(`Gem_${gem.symbol}`, {
      contract: 'Gem',
      from: deployer,
      log: true,
      args: [
        `Sandbox's ${gem.symbol} Gems`,
        gem.symbol,
        gemMinter,
        gem.gemId,
        GemsCatalystsRegistry.address,
      ],
      skipIfAlreadyDeployed: true,
    });
  }
};
export default func;
func.tags = ['Gems', 'Gems_deploy'];
func.dependencies = ['GemsCatalystsRegistry_deploy'];
func.skip = skipUnlessTest; // disabled for now
