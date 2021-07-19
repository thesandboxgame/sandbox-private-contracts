import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  await deploy('MockLandWithMint', {
    from: deployer,
    //rgs: [deployer, deployer, sandBeneficiary, supply],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};
export default func;
func.tags = ['MockLandWithMint', 'MockLandWithMint_deploy'];
func.skip = skipUnlessTest;
