import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import {Contract, BigNumber} from 'ethers';
import {transferSand} from '../catalyst/utils';

export const setupSandPolygonDepositor = deployments.createFixture(async () => {
  await deployments.fixture('Sand');
  const sandContract: Contract = await ethers.getContract('Sand');
  const users = await getUnnamedAccounts();
  const {catalystMinter} = await getNamedAccounts();
  const user0 = users[0];

  await deployments.deploy(`MockSandPredicate`, {
    contract: 'MockSandPredicate',
    from: catalystMinter,
    log: true,
    args: [],
  });

  const mockSandPredicateContract: Contract = await ethers.getContract(
    'MockSandPredicate'
  );

  await deployments.deploy(`MockRootChainManager`, {
    contract: 'MockRootChainManager',
    from: catalystMinter,
    log: true,
    args: [mockSandPredicateContract.address],
  });

  const mockRootChainManagerContract: Contract = await ethers.getContract(
    'MockRootChainManager'
  );

  await deployments.deploy(`SandPolygonDepositor`, {
    contract: 'SandPolygonDepositor',
    from: catalystMinter,
    log: true,
    args: [
      sandContract.address,
      mockSandPredicateContract.address,
      mockRootChainManagerContract.address,
    ],
  });

  await transferSand(
    sandContract,
    user0,
    BigNumber.from(100000).mul('1000000000000000000')
  );

  const sandPolygonDepositorContract: Contract = await ethers.getContract(
    'SandPolygonDepositor'
  );
  const sandContractAsUser0 = await sandContract.connect(
    ethers.provider.getSigner(user0)
  );
  return {
    user0,
    sandPolygonDepositorContract,
    sandContract,
    sandContractAsUser0,
    mockSandPredicateContract,
    mockRootChainManagerContract,
  };
});
