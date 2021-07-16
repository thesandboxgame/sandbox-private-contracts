import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';

const func: DeployFunction = async function (hre) {
  const {deployments, getNamedAccounts} = hre;
  const {log, read, execute} = deployments;

  const {catalystRegistryAdmin} = await getNamedAccounts();
  const currentAdmin = await read('OldCatalystRegistry', 'getAdmin');
  if (currentAdmin.toLowerCase() !== catalystRegistryAdmin.toLowerCase()) {
    log('setting CatalystRegistry Admin');
    await execute(
      'OldCatalystRegistry',
      {from: currentAdmin},
      'changeAdmin',
      catalystRegistryAdmin
    );
  }
};
export default func;
func.tags = ['OldCatalystRegistry'];
func.dependencies = ['OldCatalystRegistry_deploy'];
func.runAtTheEnd = true;
// comment to deploy old system
func.skip = skipUnlessTest; // not meant to be redeployed
