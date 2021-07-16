import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  let ERC20_PREDICATE = await deployments.getOrNull('ERC20_PREDICATE');
  if (!ERC20_PREDICATE) {
    ERC20_PREDICATE = await deploy('ERC20_PREDICATE', {
      from: deployer,
      contract: 'ERC20Predicate',
      log: true,
    });
  }
};
export default func;
func.tags = ['ERC20_PREDICATE'];
func.skip = skipUnlessTest;
