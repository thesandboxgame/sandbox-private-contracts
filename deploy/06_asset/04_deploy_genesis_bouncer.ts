import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy, read, execute} = deployments;

  const {
    genesisBouncerAdmin,
    genesisMinter,
    deployer,
  } = await getNamedAccounts();

  const Asset = await deployments.get('Asset');

  //(ERC1155ERC721 asset, address genesisAdmin, address firstMinter
  const GenesisBouncer = await deploy('GenesisBouncer', {
    from: deployer,
    args: [Asset.address, genesisBouncerAdmin, genesisMinter],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  const isBouncer = await read('Asset', 'isBouncer', GenesisBouncer.address);
  if (!isBouncer) {
    const bouncerAdmin = await read('Asset', 'getBouncerAdmin');
    await execute(
      'Asset',
      {from: bouncerAdmin, log: true},
      'setBouncer',
      GenesisBouncer.address,
      true
    );
  }
};
export default func;
func.tags = ['GenesisBouncer', 'GenesisBouncer_deploy'];
func.dependencies = ['Asset'];
func.skip = async (hre) => !hre.network.tags.testnet;
