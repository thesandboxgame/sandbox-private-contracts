import {
  ethers,
  deployments,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';

import {setupUsers, setupUser} from '../../utils';

export const setupSand = deployments.createFixture(async () => {
  await deployments.fixture('PolygonSand');
  const Sand = await ethers.getContract('PolygonSand');
  const accounts = await getNamedAccounts();
  const unnamedAccounts = await getUnnamedAccounts();
  const users = await setupUsers(unnamedAccounts, {Sand});
  const childChainManager = await ethers.getContract('CHILD_CHAIN_MANAGER');
  const sandBeneficiary = await setupUser(accounts.sandBeneficiary, {
    Sand,
  });
  return {Sand, users, sandBeneficiary, childChainManager};
});
