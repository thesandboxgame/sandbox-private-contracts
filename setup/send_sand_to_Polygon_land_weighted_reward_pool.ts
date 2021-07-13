import hre from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import {BigNumber} from '@ethersproject/bignumber';

const func: DeployFunction = async function () {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {execute, read} = deployments;

  const {
    deployer,
    liquidityRewardAdmin,
    liquidityRewardProvider,
  } = await getNamedAccounts();

  // Monthly reward 1,500,000 SAND
  const REWARD_AMOUNT = BigNumber.from(1500000).mul('1000000000000000000');
  const REWARD_NAME = 'PolygonLandWeightedSANDRewardPool';

  const rewardPool = await deployments.get(REWARD_NAME);

  const currentRewardDistribution = await read(
    REWARD_NAME,
    'rewardDistribution'
  );
  if (
    currentRewardDistribution.toLowerCase() !==
    liquidityRewardAdmin.toLowerCase()
  ) {
    await execute(
      REWARD_NAME,
      {from: deployer, log: true},
      'setRewardDistribution',
      liquidityRewardAdmin
    );
  }

  await execute(
    'Sand',
    {from: liquidityRewardProvider, log: true},
    'transfer',
    rewardPool.address,
    REWARD_AMOUNT
  );

  const receipt = await execute(
    REWARD_NAME,
    {from: liquidityRewardAdmin, log: true},
    'notifyRewardAmount',
    REWARD_AMOUNT
  );

  // Pass the timestamp of notifyRewardAmount to linkedData for accurate testing
  const latestBlock = await ethers.provider.getBlock(receipt.blockNumber);
  rewardPool.linkedData = JSON.stringify(latestBlock.timestamp);
  await deployments.save('REWARD_NAME', rewardPool);
};
export default func;
if (require.main === module) {
  func(hre);
}
