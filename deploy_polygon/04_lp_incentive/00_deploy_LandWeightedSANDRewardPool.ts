import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  const stakeToken = await deployments.get('FakeLPSandMatic');
  const land = await deployments.get('Land');
  const sand = await deployments.get('SandBaseToken');

  const durationInSeconds = 30 * 24 * 60 * 60;
  await deploy('PolygonLandWeightedSANDRewardPool', {
    from: deployer,
    log: true,
    args: [stakeToken.address, sand.address, land.address, durationInSeconds],
    skipIfAlreadyDeployed: true,
  });
};
export default func;
func.tags = [
  'PolygonLandWeightedSANDRewardPool',
  'PolygonLandWeightedSANDRewardPool_deploy',
  'L2',
];
func.dependencies = ['Land_deploy', 'SandBaseToken_deploy', 'FakeLPSandMatic'];
