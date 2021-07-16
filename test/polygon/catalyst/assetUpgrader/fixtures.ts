import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import {BigNumber, Contract} from 'ethers';
import {waitFor} from '../../../utils';
import {transferSand} from '../utils';

export const setupAssetUpgrader = deployments.createFixture(async () => {
  const {assetAttributesRegistryAdmin, assetAdmin} = await getNamedAccounts();
  const users = await getUnnamedAccounts();
  const catalystOwner = users[0];
  const user2 = users[2];
  const user4 = users[4];
  const user5 = users[5];
  const user10 = users[10];

  const assetUpgraderContract: Contract = await ethers.getContract(
    'AssetUpgrader'
  );
  const assetAttributesRegistry: Contract = await ethers.getContract(
    'AssetAttributesRegistry'
  );
  const assetContract = await ethers.getContract('Asset');
  const sandContract: Contract = await ethers.getContract('Sand');
  const feeRecipient: string = await assetUpgraderContract.callStatic.feeRecipient();
  const upgradeFee: BigNumber = await assetUpgraderContract.callStatic.upgradeFee();
  const gemAdditionFee: BigNumber = await assetUpgraderContract.callStatic.gemAdditionFee();
  const rareCatalyst: Contract = await ethers.getContract('Catalyst_RARE');
  const powerGem: Contract = await ethers.getContract('Gem_POWER');
  const defenseGem: Contract = await ethers.getContract('Gem_DEFENSE');
  const gemsCatalystsRegistry: Contract = await ethers.getContract(
    'GemsCatalystsRegistry'
  );
  const gemsCatalystsUnit = '1000000000000000000';

  const assetUpgraderFeeBurnerContract: Contract = await ethers.getContract(
    'AssetUpgraderFeeBurner'
  );

  await waitFor(
    assetContract
      .connect(ethers.provider.getSigner(assetAdmin))
      .setSuperOperator(assetUpgraderContract.address, true)
  );
  await transferSand(
    sandContract,
    catalystOwner,
    BigNumber.from(100000).mul(`1000000000000000000`)
  );

  const assetUpgraderContractAsCatalystOwner = await assetUpgraderContract.connect(
    ethers.provider.getSigner(catalystOwner)
  );

  const assetUpgraderContractAsUser4 = await assetUpgraderContract.connect(
    ethers.provider.getSigner(user4)
  );

  const powerGemAsUser4 = await powerGem.connect(
    ethers.provider.getSigner(user4)
  );

  const defenseGemAsUser4 = await defenseGem.connect(
    ethers.provider.getSigner(user4)
  );
  return {
    user2,
    user4,
    user5,
    user10,
    catalystOwner,
    rareCatalyst,
    powerGem,
    defenseGem,
    assetAttributesRegistryAdmin,
    assetUpgraderContract,
    assetAttributesRegistry,
    sandContract,
    assetContract,
    feeRecipient,
    upgradeFee,
    gemAdditionFee,
    gemsCatalystsUnit,
    gemsCatalystsRegistry,
    assetUpgraderContractAsCatalystOwner,
    powerGemAsUser4,
    defenseGemAsUser4,
    assetUpgraderContractAsUser4,
    assetUpgraderFeeBurnerContract,
  };
});
