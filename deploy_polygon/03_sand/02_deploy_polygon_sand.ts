import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessL2} from '../../utils/network';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  const CHILD_CHAIN_MANAGER = await deployments.get('CHILD_CHAIN_MANAGER');

  await deploy('PolygonSand', {
    from: deployer,
    args: [CHILD_CHAIN_MANAGER.address, deployer, deployer],
    log: true,
  });
};

export default func;
func.tags = ['PolygonSand', 'PolygonSand_deploy'];
func.dependencies = ['CHILD_CHAIN_MANAGER'];
func.skip = skipUnlessL2;
