import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessL2} from '../../utils/network';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  let CHILD_CHAIN_MANAGER = await deployments.getOrNull('CHILD_CHAIN_MANAGER');
  if (!CHILD_CHAIN_MANAGER) {
    CHILD_CHAIN_MANAGER = await deploy('CHILD_CHAIN_MANAGER', {
      from: deployer,
      contract: 'FakeChildChainManager',
      log: true,
    });
  }
};
export default func;
func.tags = ['CHILD_CHAIN_MANAGER'];
func.skip = skipUnlessL2;
