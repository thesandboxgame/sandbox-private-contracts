import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {execute, read} = deployments;

  const AssetMinter = await deployments.get('AssetMinter');
  const {gemsCatalystsRegistryAdmin} = await getNamedAccounts();

  const isAssetMinterSuperOperator = await read(
    'GemsCatalystsRegistry',
    'isSuperOperator',
    AssetMinter.address
  );

  if (!isAssetMinterSuperOperator) {
    await execute(
      'GemsCatalystsRegistry',
      {from: gemsCatalystsRegistryAdmin, log: true},
      'setSuperOperator',
      AssetMinter.address,
      true
    );
  }
};
export default func;
func.runAtTheEnd = true;
func.tags = ['GemsCatalystsRegistry', 'GemsCatalystsRegistry_setup'];
func.dependencies = ['GemsCatalystsRegistry_deploy', 'AssetMinter_deploy'];
func.skip = skipUnlessTest; // disabled for now
