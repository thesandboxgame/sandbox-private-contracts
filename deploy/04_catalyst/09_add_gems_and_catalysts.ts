import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';
import gems from '../../data/gems';
import catalysts from '../../data/catalysts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments} = hre;
  const {execute, read} = deployments;

  const catalystsToAdd = [];
  const gemsToAdd = [];

  for (const catalyst of catalysts) {
    const doesCatalystExist = await read(
      `GemsCatalystsRegistry`,
      'doesCatalystExist',
      catalyst.catalystId
    );
    if (!doesCatalystExist) {
      const {address} = await deployments.get(`Catalyst_${catalyst.symbol}`);
      catalystsToAdd.push(address);
    }
  }

  for (const gem of gems) {
    const doesGemExist = await read(
      `GemsCatalystsRegistry`,
      'doesGemExist',
      gem.gemId
    );
    if (!doesGemExist) {
      const {address} = await deployments.get(`Gem_${gem.symbol}`);
      gemsToAdd.push(address);
    }
  }
  const currentAdmin = await read('GemsCatalystsRegistry', 'getAdmin');
  await execute(
    'GemsCatalystsRegistry',
    {from: currentAdmin, log: true},
    'addGemsAndCatalysts',
    gemsToAdd,
    catalystsToAdd
  );
};
export default func;
func.tags = ['GemsCatalystsRegistry', 'GemsCatalystsRegistry_setup'];
func.dependencies = ['GemsCatalystsRegistry_deploy', 'Catalysts', 'Gems'];
func.skip = skipUnlessTest; // disabled for now
