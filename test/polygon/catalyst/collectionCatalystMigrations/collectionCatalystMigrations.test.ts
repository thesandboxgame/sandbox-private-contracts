import {expect} from '../../../chai-setup';
import {BigNumber, Contract} from 'ethers';
import {waitFor} from '../../../utils';
import {setupCollectionCatalystMigrations, setupUser} from './fixtures';
describe('CollectionCatalystMigrations', function () {
  async function oldAssetMint(
    catalystMinterAsUser: Contract,
    creator: string,
    packId: BigNumber,
    hash: string,
    supply: number | BigNumber,
    owner: string,
    callData: Buffer,
    catalystId: number,
    gemIds: number[]
  ): Promise<BigNumber> {
    const assetId = await catalystMinterAsUser.callStatic.mint(
      creator,
      packId,
      hash,
      catalystId,
      gemIds,
      supply,
      owner,
      callData
    );
    await waitFor(
      catalystMinterAsUser.mint(
        creator,
        packId,
        hash,
        catalystId,
        gemIds,
        supply,
        owner,
        callData
      )
    );
    return assetId;
  }

  async function testMigration(
    assetAttributesRegistry: Contract,
    assetId: BigNumber,
    catalystId: number,
    gemIds: number[],
    blockNumber: number,
    eventIndex: number
  ) {
    const record = await assetAttributesRegistry.getRecord(assetId);
    expect(record.catalystId).to.equal(catalystId + 1);
    expect(record.exists).to.equal(true);
    for (let i = 0; i < gemIds.length; i++) {
      expect(record.gemIds[i]).to.equal(gemIds[i]);
    }
    const assetAttributesRegistryEvents = await assetAttributesRegistry.queryFilter(
      assetAttributesRegistry.filters.CatalystApplied()
    );
    const event = assetAttributesRegistryEvents.filter(
      (e) => e.event === 'CatalystApplied'
    )[eventIndex];

    expect(event.args).not.to.equal(null || undefined);
    if (event.args) {
      expect(event.args[0]).to.equal(BigNumber.from(assetId));
      expect(event.args[1]).to.equal(BigNumber.from(catalystId + 1));
      expect(event.args[2]).to.eql(gemIds);
      expect(event.args[3]).to.equal(BigNumber.from(blockNumber));
    }
  }

  async function incrementGemIds(gemIds: number[]) {
    for (let i = 0; i < gemIds.length; i++) {
      gemIds[i]++;
    }
  }

  async function extractAndAddGems(
    catalystMinterAsUser: Contract,
    from: string,
    assetId: BigNumber,
    gemIds: number[],
    to: string
  ) {
    const newAssetId = await catalystMinterAsUser.callStatic.extractAndAddGems(
      from,
      assetId,
      gemIds,
      to
    );
    await waitFor(
      catalystMinterAsUser.extractAndAddGems(from, assetId, gemIds, to)
    );
    return newAssetId;
  }
  it('migrating assetId with epic catalyst and no gems', async function () {
    const {
      assetAttributesRegistry,
      oldCatalystMinterAsUser0,
      collectionCatalystMigrationsContract,
      collectionCatalystMigrationsContractAsAdmin,
      assetAttributesRegistryAsRegistryAdmin,
      user0,
    } = await setupCollectionCatalystMigrations();
    await setupUser(user0);
    const packId = BigNumber.from(0);
    const gemIds: number[] = [];
    const quantity = 201;
    const dummyHash =
      '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
    const oldEpicCatalystId = 2;
    const emptyBytes = Buffer.from('');
    const assetId = await oldAssetMint(
      oldCatalystMinterAsUser0,
      user0,
      packId,
      dummyHash,
      quantity,
      user0,
      emptyBytes,
      oldEpicCatalystId,
      gemIds
    );
    const blockNumber = 11874541;
    await waitFor(
      assetAttributesRegistryAsRegistryAdmin.setMigrationContract(
        collectionCatalystMigrationsContract.address
      )
    );
    await waitFor(
      collectionCatalystMigrationsContractAsAdmin.migrate(
        assetId,
        [],
        blockNumber
      )
    );
    await testMigration(
      assetAttributesRegistry,
      assetId,
      oldEpicCatalystId,
      gemIds,
      blockNumber,
      0
    );
  });
  it('migrating assetId with rare catalyst and power gem', async function () {
    const {
      assetAttributesRegistry,
      oldCatalystMinterAsUser0,
      assetAttributesRegistryAsRegistryAdmin,
      collectionCatalystMigrationsContract,
      collectionCatalystMigrationsContractAsAdmin,
      user0,
    } = await setupCollectionCatalystMigrations();
    await setupUser(user0);
    const powerGemId = 0;
    const packId = BigNumber.from(0);
    const gemIds: number[] = [];
    const quantity = 1500;
    const dummyHash =
      '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
    const oldRareCatalystId = 1;
    const emptyBytes = Buffer.from('');
    const assetId = await oldAssetMint(
      oldCatalystMinterAsUser0,
      user0,
      packId,
      dummyHash,
      quantity,
      user0,
      emptyBytes,
      oldRareCatalystId,
      gemIds
    );
    const blockNumber = 11874541;
    const gemIdsForMigration = [powerGemId];
    await waitFor(
      assetAttributesRegistryAsRegistryAdmin.setMigrationContract(
        collectionCatalystMigrationsContract.address
      )
    );
    await waitFor(
      collectionCatalystMigrationsContractAsAdmin.migrate(
        assetId,
        gemIdsForMigration,
        blockNumber
      )
    );
    incrementGemIds(gemIdsForMigration);
    await testMigration(
      assetAttributesRegistry,
      assetId,
      oldRareCatalystId,
      gemIdsForMigration,
      blockNumber,
      0
    );
  });
  it('migrating assetId of quantity = 1 with legendary catalyst', async function () {
    const {
      assetAttributesRegistry,
      assetAttributesRegistryAsRegistryAdmin,
      collectionCatalystMigrationsContract,
      oldCatalystMinterAsUser0,
      collectionCatalystMigrationsContractAsAdmin,
      user0,
    } = await setupCollectionCatalystMigrations();
    await setupUser(user0);
    const powerGemId = 0;
    const packId = BigNumber.from(0);
    const gemIds: number[] = [];
    const quantity = 1;
    const dummyHash =
      '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
    const oldLegendaryCatalystId = 3;
    const emptyBytes = Buffer.from('');
    const assetId = await oldAssetMint(
      oldCatalystMinterAsUser0,
      user0,
      packId,
      dummyHash,
      quantity,
      user0,
      emptyBytes,
      oldLegendaryCatalystId,
      gemIds
    );
    const blockNumber = 11874541;
    const gemIdsForMigration = [powerGemId];

    await waitFor(
      assetAttributesRegistryAsRegistryAdmin.setMigrationContract(
        collectionCatalystMigrationsContract.address
      )
    );
    await waitFor(
      collectionCatalystMigrationsContractAsAdmin.migrate(
        assetId,
        gemIdsForMigration,
        blockNumber
      )
    );
    incrementGemIds(gemIdsForMigration);
    await testMigration(
      assetAttributesRegistry,
      assetId,
      oldLegendaryCatalystId,
      gemIdsForMigration,
      blockNumber,
      0
    );
  });
  it('migrating asset with collection id != 0 should fail', async function () {
    const {
      oldCatalystMinterAsUser0,
      collectionCatalystMigrationsContractAsAdmin,
      user0,
    } = await setupCollectionCatalystMigrations();
    await setupUser(user0);
    const powerGemId = 0;
    const defenseGemId = 1;
    const packId = BigNumber.from(0);
    const gemIds: number[] = [];
    const quantity = 1500;
    const dummyHash =
      '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
    const oldRareCatalystId = 1;
    const emptyBytes = Buffer.from('');
    const assetId = await oldAssetMint(
      oldCatalystMinterAsUser0,
      user0,
      packId,
      dummyHash,
      quantity,
      user0,
      emptyBytes,
      oldRareCatalystId,
      gemIds
    );
    const blockNumber = 11874541;
    const gemIdsForMigration = [powerGemId];
    const newAssetId = await extractAndAddGems(
      oldCatalystMinterAsUser0,
      user0,
      assetId,
      [defenseGemId],
      user0
    );

    expect(
      collectionCatalystMigrationsContractAsAdmin.migrate(
        newAssetId,
        gemIdsForMigration,
        blockNumber
      )
    ).to.be.revertedWith('NOT_ORIGINAL_NFT');
  });
  it('migrating assetId not from admin account should fail', async function () {
    const {
      collectionCatalystMigrationsContractAsUser0,
    } = await setupCollectionCatalystMigrations();
    const assetId = BigNumber.from(
      '0x0000011100000000000000000000000000000000800000000000000000000000'
    );
    const blockNumber = 11874541;
    await expect(
      collectionCatalystMigrationsContractAsUser0.migrate(
        assetId,
        [],
        blockNumber
      )
    ).to.be.revertedWith('NOT_AUTHORIZED');
  });
  it('migrating assetId that does not exist in old registry should fail', async function () {
    const {
      collectionCatalystMigrationsContractAsAdmin,
    } = await setupCollectionCatalystMigrations();
    const assetId = BigNumber.from(
      '0x0000000000000000000000000000000000000000800000000000000000000000'
    );
    const blockNumber = 11874541;
    await expect(
      collectionCatalystMigrationsContractAsAdmin.migrate(
        assetId,
        [],
        blockNumber
      )
    ).to.be.revertedWith('OLD_CATALYST_NOT_EXIST');
  });
  it('migrating assetId that has already been migrated should fail', async function () {
    const {
      assetAttributesRegistryAsRegistryAdmin,
      collectionCatalystMigrationsContract,
      oldCatalystMinterAsUser0,
      collectionCatalystMigrationsContractAsAdmin,
      user0,
    } = await setupCollectionCatalystMigrations();
    await setupUser(user0);
    const packId = 0;
    const gemIds: number[] = [];
    const quantity = 201;
    const dummyHash =
      '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
    const oldEpicCatalystId = 2;
    const emptyBytes = Buffer.from('');
    const assetId = await oldCatalystMinterAsUser0.callStatic.mint(
      user0,
      packId,
      dummyHash,
      oldEpicCatalystId,
      gemIds,
      quantity,
      user0,
      emptyBytes
    );
    await waitFor(
      oldCatalystMinterAsUser0.mint(
        user0,
        packId,
        dummyHash,
        oldEpicCatalystId,
        gemIds,
        quantity,
        user0,
        emptyBytes
      )
    );
    const blockNumber = 11874541;

    await waitFor(
      assetAttributesRegistryAsRegistryAdmin.setMigrationContract(
        collectionCatalystMigrationsContract.address
      )
    );
    await waitFor(
      collectionCatalystMigrationsContractAsAdmin.migrate(
        assetId,
        [],
        blockNumber
      )
    );
    await expect(
      collectionCatalystMigrationsContractAsAdmin.migrate(
        assetId,
        [],
        blockNumber
      )
    ).to.be.revertedWith('ALREADY_MIGRATED');
  });
  it('batch migrating assetId not from admin account should fail', async function () {
    const {
      collectionCatalystMigrationsContractAsUser0,
    } = await setupCollectionCatalystMigrations();
    await expect(
      collectionCatalystMigrationsContractAsUser0.batchMigrate([])
    ).to.be.revertedWith('NOT_AUTHORIZED');
  });
  it('batchMigrate two assets', async function () {
    const {
      assetAttributesRegistryAsRegistryAdmin,
      collectionCatalystMigrationsContract,
      assetAttributesRegistry,
      oldCatalystMinterAsUser0,
      collectionCatalystMigrationsContractAsAdmin,
      user0,
    } = await setupCollectionCatalystMigrations();
    await setupUser(user0);
    const powerGemId = 0;
    const packId = BigNumber.from(0);
    const gemIds: number[] = [];
    const quantity = 1500;
    const dummyHash =
      '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
    const hash =
      '0xFFFFFF1111FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
    const oldRareCatalystId = 1;
    const emptyBytes = Buffer.from('');
    const assetId1 = await oldAssetMint(
      oldCatalystMinterAsUser0,
      user0,
      packId,
      dummyHash,
      quantity,
      user0,
      emptyBytes,
      oldRareCatalystId,
      gemIds
    );
    const assetId2 = await oldAssetMint(
      oldCatalystMinterAsUser0,
      user0,
      BigNumber.from(1),
      hash,
      quantity,
      user0,
      emptyBytes,
      oldRareCatalystId,
      gemIds
    );
    const blockNumber = 11874541;
    const gemIdsForMigration = [powerGemId];
    const migrations = [
      {assetId: assetId1, gemIds: gemIdsForMigration, blockNumber},
      {assetId: assetId2, gemIds: gemIdsForMigration, blockNumber},
    ];
    await waitFor(
      assetAttributesRegistryAsRegistryAdmin.setMigrationContract(
        collectionCatalystMigrationsContract.address
      )
    );
    await waitFor(
      collectionCatalystMigrationsContractAsAdmin.batchMigrate(migrations)
    );
    incrementGemIds(gemIdsForMigration);
    await testMigration(
      assetAttributesRegistry,
      assetId1,
      oldRareCatalystId,
      gemIdsForMigration,
      blockNumber,
      0
    );
    await testMigration(
      assetAttributesRegistry,
      assetId2,
      oldRareCatalystId,
      gemIdsForMigration,
      blockNumber,
      1
    );
  });
  it('setAssetAttributesRegistryMigrationContract first assignment', async function () {
    const {
      assetAttributesRegistryAsRegistryAdmin,
      collectionCatalystMigrationsContract,
      mockedMigrationContractAddress,
      assetAttributesRegistry,
      collectionCatalystMigrationsContractAsAdmin,
    } = await setupCollectionCatalystMigrations();

    await waitFor(
      assetAttributesRegistryAsRegistryAdmin.setMigrationContract(
        collectionCatalystMigrationsContract.address
      )
    );
    await waitFor(
      collectionCatalystMigrationsContractAsAdmin.setAssetAttributesRegistryMigrationContract(
        mockedMigrationContractAddress
      )
    );
    expect(await assetAttributesRegistry.migrationContract()).to.equal(
      mockedMigrationContractAddress
    );
  });
  it('setAssetAttributesRegistryMigrationContract first assignment should fail for non admin', async function () {
    const {
      mockedMigrationContractAddress,
      collectionCatalystMigrationsContractAsUser0,
    } = await setupCollectionCatalystMigrations();
    await expect(
      collectionCatalystMigrationsContractAsUser0.setAssetAttributesRegistryMigrationContract(
        mockedMigrationContractAddress
      )
    ).to.be.revertedWith('NOT_AUTHORIZED');
  });
  it('setAssetAttributesRegistryMigrationContract second assignment', async function () {
    const {
      assetAttributesRegistryAsRegistryAdmin,
      collectionCatalystMigrationsContract,
      assetAttributesRegistryAsCollectionCatalystMigrationsAdmin,
      collectionCatalystMigrationsAdmin,
      newMigrationContract,
      assetAttributesRegistry,
      collectionCatalystMigrationsContractAsAdmin,
    } = await setupCollectionCatalystMigrations();

    await waitFor(
      assetAttributesRegistryAsRegistryAdmin.setMigrationContract(
        collectionCatalystMigrationsContract.address
      )
    );
    await waitFor(
      collectionCatalystMigrationsContractAsAdmin.setAssetAttributesRegistryMigrationContract(
        collectionCatalystMigrationsAdmin
      )
    );

    expect(await assetAttributesRegistry.migrationContract()).to.equal(
      collectionCatalystMigrationsAdmin
    );

    await waitFor(
      assetAttributesRegistryAsCollectionCatalystMigrationsAdmin.setMigrationContract(
        newMigrationContract
      )
    );

    expect(await assetAttributesRegistry.migrationContract()).to.equal(
      newMigrationContract
    );
  });
  it('setAssetAttributesRegistryMigrationContract second assignment should fail for non migrationContract', async function () {
    const {
      assetAttributesRegistryAsRegistryAdmin,
      collectionCatalystMigrationsContract,
      newMigrationContract,
      mockedMigrationContractAddress,
      assetAttributesRegistry,
      collectionCatalystMigrationsContractAsAdmin,
    } = await setupCollectionCatalystMigrations();

    await waitFor(
      assetAttributesRegistryAsRegistryAdmin.setMigrationContract(
        collectionCatalystMigrationsContract.address
      )
    );
    await waitFor(
      collectionCatalystMigrationsContractAsAdmin.setAssetAttributesRegistryMigrationContract(
        mockedMigrationContractAddress
      )
    );

    expect(await assetAttributesRegistry.migrationContract()).to.equal(
      mockedMigrationContractAddress
    );

    await expect(
      collectionCatalystMigrationsContractAsAdmin.setAssetAttributesRegistryMigrationContract(
        newMigrationContract
      )
    ).to.be.revertedWith('NOT_AUTHORIZED_MIGRATION');
  });
});
