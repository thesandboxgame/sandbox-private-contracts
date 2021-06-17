// import {HardhatRuntimeEnvironment} from 'hardhat/types';
// import {DeployFunction} from 'hardhat-deploy/types';

// const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
//   const {deployments, getNamedAccounts} = hre;
//   const {deploy} = deployments;

//   const {deployer} = await getNamedAccounts();

//   let ERC1155_PREDICATE = await deployments.getOrNull('ERC1155_PREDICATE');
//   if (!ERC1155_PREDICATE) {
//     ERC1155_PREDICATE = await deploy('ERC1155_PREDICATE', {
//       from: deployer,
//       contract: 'FakePredicateForwarder',
//       log: true,
//     });
//   }
// };
// export default func;
// func.tags = ['ERC1155_PREDICATE'];

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { skipUnlessTest } from '../../utils/network';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  let ERC1155_PREDICATE = await deployments.getOrNull('ERC1155_PREDICATE');
  if (!ERC1155_PREDICATE) {
    ERC1155_PREDICATE = await deploy('ERC1155_PREDICATE', {
      from: deployer,
      contract: 'ERC1155Predicate',
      args: [],
      log: true,
    });
  }
};
export default func;
func.tags = ['ERC1155_PREDICATE'];
func.skip = skipUnlessTest;
