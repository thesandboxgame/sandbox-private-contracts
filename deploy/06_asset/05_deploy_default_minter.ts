import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy, read, execute, catchUnknownSigner} = deployments;

  const {
    deployer,
    defaultMinterAdmin,
    mintingFeeCollector,
  } = await getNamedAccounts();

  const Asset = await deployments.get('Asset');
  const Sand = await deployments.get('Sand');

  // constructor(ERC1155ERC721 asset, ERC20 sand, uint256 feePerCopy, address admin, address feeReceiver)
  const DefaultMinter = await deploy('DefaultMinter', {
    contract: 'CommonMinter',
    from: deployer,
    args: [
      Asset.address,
      Sand.address,
      0,
      defaultMinterAdmin,
      mintingFeeCollector,
    ],
    skipIfAlreadyDeployed: true,
    log: true,
  });

  const isBouncer = await read('Asset', 'isBouncer', DefaultMinter.address);
  if (!isBouncer) {
    const bouncerAdmin = await read('Asset', 'getBouncerAdmin');
    await await catchUnknownSigner(
      execute(
        'Asset',
        {from: bouncerAdmin, log: true},
        'setBouncer',
        DefaultMinter.address,
        true
      )
    );
  }

  const isSandSuperOperator = await read(
    'Sand',
    'isSuperOperator',
    DefaultMinter.address
  );
  if (!isSandSuperOperator) {
    const sandAdmin = await read('Sand', 'getAdmin');
    await catchUnknownSigner(
      execute(
        'Sand',
        {from: sandAdmin, log: true},
        'setSuperOperator',
        DefaultMinter.address,
        true
      )
    );
  }
};
export default func;
func.tags = ['DefaultMinter', 'DefaultMinter_deploy'];
func.dependencies = ['Asset', 'Sand'];
