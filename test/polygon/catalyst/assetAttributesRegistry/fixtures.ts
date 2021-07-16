import {
  ethers,
  deployments,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {BigNumber, Contract, Event} from 'ethers';
import {Block} from '@ethersproject/providers';
import {waitFor} from '../../../utils';
import {transferSand, mintCatalyst, mintGem} from '../utils';

export const setupAssetAttributesRegistry = deployments.createFixture(
  async () => {
    const assetAttributesRegistry: Contract = await ethers.getContract(
      'AssetAttributesRegistry'
    );
    const assetUpgrader: Contract = await ethers.getContract('AssetUpgrader');
    const assetMinter: Contract = await ethers.getContract('AssetMinter');
    const {assetAttributesRegistryAdmin} = await getNamedAccounts();
    const users = await getUnnamedAccounts();
    const user0 = users[0];
    const mockedMigrationContractAddress = users[1];
    const sandContract = await ethers.getContract('Sand');
    await transferSand(
      sandContract,
      user0,
      BigNumber.from(100000).mul('1000000000000000000')
    );
    const power: Contract = await ethers.getContract('Gem_POWER');
    const defense: Contract = await ethers.getContract('Gem_DEFENSE');
    const speed: Contract = await ethers.getContract('Gem_SPEED');
    const magic: Contract = await ethers.getContract('Gem_MAGIC');
    const luck: Contract = await ethers.getContract('Gem_LUCK');
    const common: Contract = await ethers.getContract('Catalyst_COMMON');
    const rare: Contract = await ethers.getContract('Catalyst_RARE');
    const epic: Contract = await ethers.getContract('Catalyst_EPIC');
    const legendary: Contract = await ethers.getContract('Catalyst_LEGENDARY');

    const gemsCatalystsUnit = '1000000000000000000';
    const mintingAmount = BigNumber.from('8').mul(
      BigNumber.from(gemsCatalystsUnit)
    );

    const gemContracts = [power, defense, speed, luck, magic];
    const catContracts = [common, rare, epic, legendary];

    async function mintAllGems(user: string, amount: BigNumber): Promise<void> {
      for (const contract of gemContracts) {
        await mintGem(contract, amount, user);
      }
    }
    async function mintAllCats(user: string, amount: BigNumber): Promise<void> {
      for (const contract of catContracts) {
        await mintCatalyst(contract, amount, user);
      }
    }

    await mintAllGems(user0, mintingAmount);
    await mintAllCats(user0, mintingAmount);

    const assetAttributesRegistryAsUser0 = await assetAttributesRegistry.connect(
      ethers.provider.getSigner(user0)
    );
    const assetAttributesRegistryAsRegistryAdmin = await assetAttributesRegistry.connect(
      ethers.provider.getSigner(assetAttributesRegistryAdmin)
    );
    const assetUpgraderAsUser0 = await assetUpgrader.connect(
      ethers.provider.getSigner(user0)
    );
    const assetMinterAsUser0 = await assetMinter.connect(
      ethers.provider.getSigner(user0)
    );
    const assetAttributesRegistryAsmockedMigrationContract = await assetAttributesRegistry.connect(
      ethers.provider.getSigner(mockedMigrationContractAddress)
    );

    return {
      mockedMigrationContractAddress,
      user0,
      assetAttributesRegistry,
      assetAttributesRegistryAdmin,
      assetUpgrader,
      assetAttributesRegistryAsUser0,
      assetAttributesRegistryAsRegistryAdmin,
      assetAttributesRegistryAsmockedMigrationContract,
      assetUpgraderAsUser0,
      assetMinterAsUser0,
      assetMinter,
    };
  }
);
export async function setCatalyst(
  from: string,
  assetId: BigNumber,
  catalystId: number,
  gemsIds: number[],
  to: string,
  assetUpgrader: Contract,
  assetAttributesRegistry: Contract,
  collectionId?: BigNumber
): Promise<{
  record: {catalystId: number; exists: boolean; gemIds: []};
  event: Event;
  block: Block;
}> {
  if (collectionId) {
    await waitFor(
      assetUpgrader
        .connect(ethers.provider.getSigner(from))
        .changeCatalyst(from, collectionId, catalystId, gemsIds, to)
    );
  } else {
    await waitFor(
      assetUpgrader
        .connect(ethers.provider.getSigner(from))
        .changeCatalyst(from, assetId, catalystId, gemsIds, to)
    );
  }
  const record = await assetAttributesRegistry.getRecord(assetId);

  const assetAttributesRegistryEvents = await assetAttributesRegistry.queryFilter(
    assetAttributesRegistry.filters.CatalystApplied()
  );
  const event = assetAttributesRegistryEvents.filter(
    (e) => e.event === 'CatalystApplied'
  )[0];
  const block = await ethers.provider.getBlock('latest');
  return {record, event, block};
}
