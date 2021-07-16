import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';
import {BigNumber} from '@ethersproject/bignumber';
import {sandWei} from '../../utils/units';

const func: DeployFunction = async function (hre) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy, log, read, execute} = deployments;

  const {deployer, catalystMinterAdmin} = await getNamedAccounts();

  const registry = await deployments.get('OldCatalystRegistry');
  const sand = await deployments.get('Sand');
  const asset = await deployments.get('Asset');
  const gem = await deployments.get('OldGems');
  const catalyst = await deployments.get('OldCatalysts');

  const bakedMintData = [];
  for (let i = 0; i < 4; i++) {
    const mintData = await read('OldCatalysts', 'getMintData', i);
    const maxGems = BigNumber.from(mintData.maxGems).mul(
      BigNumber.from(2).pow(240)
    );
    const minQuantity = BigNumber.from(mintData.minQuantity).mul(
      BigNumber.from(2).pow(224)
    );
    const maxQuantity = BigNumber.from(mintData.maxQuantity).mul(
      BigNumber.from(2).pow(208)
    );
    const sandMintingFee = BigNumber.from(mintData.sandMintingFee).mul(
      BigNumber.from(2).pow(120)
    );
    const sandUpdateFee = BigNumber.from(mintData.sandUpdateFee);
    const bakedData = sandUpdateFee
      .add(sandMintingFee)
      .add(maxGems)
      .add(minQuantity)
      .add(maxQuantity);
    bakedMintData.push(bakedData);
  }

  const catalystMinter = await deploy('OldCatalystMinter', {
    contract: 'CatalystMinter',
    from: deployer,
    log: true,
    args: [
      registry.address,
      sand.address,
      asset.address,
      gem.address,
      sand.address,
      catalystMinterAdmin,
      '0x0000000000000000000000000000000000000000', // TODO SAND : mintingFeeCollector
      sandWei(1), //TODO SAND : confirm
      catalyst.address,
      bakedMintData,
    ],
  });

  const currentMinter = await read('OldCatalystRegistry', 'getMinter');
  if (currentMinter.toLowerCase() != catalystMinter.address.toLowerCase()) {
    log('setting OldCatalystMinter as CatalystRegistry minter');
    const currentRegistryAdmin = await read('OldCatalystRegistry', 'getAdmin');
    await execute(
      'OldCatalystRegistry',
      {from: currentRegistryAdmin},
      'setMinter',
      catalystMinter.address
    );
  }

  const isBouncer = await read('Asset', 'isBouncer', catalystMinter.address);
  if (!isBouncer) {
    log('setting OldCatalystMinter as Asset bouncer');
    const currentBouncerAdmin = await read('Asset', 'getBouncerAdmin');
    await execute(
      'Asset',
      {from: currentBouncerAdmin},
      'setBouncer',
      catalystMinter.address,
      true
    );
  }

  async function setSuperOperatorFor(contractName: string, address: string) {
    const isSuperOperator = await read(
      contractName,
      'isSuperOperator',
      address
    );
    if (!isSuperOperator) {
      log('setting OldCatalystMinter as super operator for ' + contractName);
      const currentSandAdmin = await read(contractName, 'getAdmin');
      await execute(
        contractName,
        {from: currentSandAdmin},
        'setSuperOperator',
        address,
        true
      );
    }
  }

  await setSuperOperatorFor('Sand', catalystMinter.address);
  await setSuperOperatorFor('OldGems', catalystMinter.address);
  await setSuperOperatorFor('Asset', catalystMinter.address);
  await setSuperOperatorFor(`OldCatalysts`, catalystMinter.address);
};
export default func;
func.tags = ['OldCatalystMinter', 'OldCatalystMinter_deploy'];
func.dependencies = [
  'OldCatalysts_deploy',
  'Sand_deploy',
  'OldGems_deploy',
  'Asset_deploy',
  'OldCatalystRegistry_deploy',
];
// comment to deploy old system
func.skip = skipUnlessTest; // not meant to be redeployed
