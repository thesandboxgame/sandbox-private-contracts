import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';

const func: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const {deployments, getNamedAccounts} = hre;
  const {deployer, landAdmin} = await getNamedAccounts();
  const {deploy} = deployments;

  const TRUSTED_FORWARDER = await deployments.get('TRUSTED_FORWARDER');
  const chainIndex = 1; // L2 (Polygon). Use 0 for Ethereum-Mainnet.

  await deploy('ChildLandToken', {
    from: deployer,
    args: [TRUSTED_FORWARDER.address, chainIndex, landAdmin],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ['ChildLandToken', 'ChildLandToken_deploy'];
func.dependencies = ['TRUSTED_FORWARDER'];
func.skip = skipUnlessTest; // TODO: Setup deploy-polygon folder and network.
