import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {sandBeneficiary, deployer} = await getNamedAccounts();
  const supply = '3000000000';

  await deploy('SandBaseToken', {
    from: deployer,
    args: [deployer, deployer, sandBeneficiary, supply],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};
export default func;
func.tags = ['SandBaseToken', 'SandBaseToken_deploy'];
func.skip = skipUnlessTest;
