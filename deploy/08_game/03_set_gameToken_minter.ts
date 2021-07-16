import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';

const func: DeployFunction = async function (hre) {
  const {deployments, getNamedAccounts} = hre;
  const {execute, read} = deployments;

  const {gameTokenAdmin} = await getNamedAccounts();

  const gameMinter = await deployments.get('GameMinter');

  const currentMinter = await read('ChildGameToken', 'getMinter');
  const isMinter = currentMinter == gameMinter.address;

  if (!isMinter) {
    await execute(
      'ChildGameToken',
      {from: gameTokenAdmin, log: true},
      'changeMinter',
      gameMinter.address
    );
  }
};
export default func;
func.runAtTheEnd = true;
func.tags = ['ChildGameToken', 'ChildGameToken_setup'];
func.dependencies = ['ChildGameToken_deploy', 'GameMinter_deploy'];
// TODO: Setup deploy-polygon folder and network.
func.skip = skipUnlessTest; // TODO enable
