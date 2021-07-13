import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  let FAKE_LP_MATIC_SAND = await deployments.getOrNull('FakeLPSandMatic');
  if (!FAKE_LP_MATIC_SAND) {
    FAKE_LP_MATIC_SAND = await deploy('FakeLPSandMatic', {
      from: deployer,
      log: true,
    });
  }
};
export default func;
func.tags = ['FakeLPSandMatic', 'L2'];
func.skip = skipUnlessTest;
