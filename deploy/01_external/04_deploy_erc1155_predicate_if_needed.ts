import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { skipUnlessTest } from '../../utils/network';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const AssetV2 = await deployments.get('AssetV2');
  let ERC1155_PREDICATE = await deployments.getOrNull('ERC1155_PREDICATE');
  if (!ERC1155_PREDICATE) {
    ERC1155_PREDICATE = await deploy('ERC1155_PREDICATE', {
      from: deployer,
      contract: 'FakeERC1155Predicate',
      args: [
        AssetV2.address
      ],
      log: true,
    });
  }
};
export default func;
func.tags = ['ERC1155_PREDICATE'];
func.dependencies = ['AssetV2'];
func.skip = skipUnlessTest;
