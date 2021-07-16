import {
  ethers,
  getUnnamedAccounts,
  getNamedAccounts,
  deployments,
} from 'hardhat';
import {BigNumber, Event} from 'ethers';
import {expect} from '../../../chai-setup';
import {setCatalyst, setupAssetAttributesRegistry} from './fixtures';
import catalysts from '../../../../data/catalysts';
import gems from '../../../../data/gems';
import {Block} from '@ethersproject/providers';
import {mintAsset} from '../utils';
import {waitFor} from '../../../utils';
describe('AssetAttributesRegistry', function () {
  function testSetCatalyst(
    record: {catalystId: number; exists: boolean; gemIds: []},
    event: Event,
    block: Block,
    gemsIds: number[],
    catalystId: number,
    assetId: BigNumber
  ) {
    expect(record.catalystId).to.equal(catalystId);
    expect(record.exists).to.equal(true);
    for (let i = 0; i < gemsIds.length; i++) {
      expect(record.gemIds[i]).to.equal(i + 1);
    }
    expect(event.args).not.to.equal(null || undefined);
    if (event.args) {
      expect(event.args[0]).to.equal(BigNumber.from(assetId));
      expect(event.args[1]).to.equal(BigNumber.from(catalystId));
      expect(event.args[2]).to.eql(gemsIds);
      expect(event.args[3]).to.equal(
        BigNumber.from(block.number).add(BigNumber.from('1'))
      );
    }
  }

  beforeEach(async function () {
    await deployments.fixture();
  });

  it('getRecord for non existing assetId', async function () {
    const {assetAttributesRegistry} = await setupAssetAttributesRegistry();
    const record = await assetAttributesRegistry.getRecord(0);
    expect(record.catalystId).to.equal(0);
    expect(record.exists).to.equal(false);
    expect(record.gemIds.length).to.equal(15);
  });

  it('setCatalyst for legendary catalyst with 4 gems', async function () {
    const {
      assetUpgrader,
      assetAttributesRegistry,
      user0,
    } = await setupAssetAttributesRegistry();
    const assetId = await mintAsset(
      user0,
      BigNumber.from('2233'),
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      1,
      0,
      user0,
      Buffer.from('ff')
    );
    const legendaryCatalystId = catalysts[3].catalystId;
    const gemsIds = gems.filter((gem) => gem.gemId < 5).map((gem) => gem.gemId);
    const {record, event, block} = await setCatalyst(
      user0,
      assetId,
      legendaryCatalystId,
      gemsIds,
      user0,
      assetUpgrader,
      assetAttributesRegistry
    );
    testSetCatalyst(
      record,
      event,
      block,
      gemsIds,
      legendaryCatalystId,
      assetId
    );
  });
  it('setCatalyst should fail for non minter account', async function () {
    const {
      assetAttributesRegistryAsUser0,
    } = await setupAssetAttributesRegistry();
    const assetId = BigNumber.from('0x12000000000800000000000000000000000');
    const legendaryCatalystId = catalysts[3].catalystId;
    const gemsIds = gems.filter((gem) => gem.gemId < 5).map((gem) => gem.gemId);
    await expect(
      assetAttributesRegistryAsUser0.setCatalyst(
        assetId,
        legendaryCatalystId,
        gemsIds
      )
    ).to.be.revertedWith('NOT_AUTHORIZED_MINTER');
  });

  it('setCatalyst with gems.length > MAX_NUM_GEMS should fail', async function () {
    const {assetUpgraderAsUser0, user0} = await setupAssetAttributesRegistry();
    const assetId = BigNumber.from(
      '0x100000000000000000012000000000800000000000000000000000'
    );
    const legendaryCatalystId = catalysts[3].catalystId;
    const gemsIds = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3];
    await expect(
      assetUpgraderAsUser0.changeCatalyst(
        user0,
        assetId,
        legendaryCatalystId,
        gemsIds,
        user0
      )
    ).to.be.revertedWith('GEMS_MAX_REACHED');
  });

  it('setCatalyst with gems.length > maxGemForCatalyst should fail', async function () {
    const {assetUpgraderAsUser0, user0} = await setupAssetAttributesRegistry();
    const assetId = BigNumber.from('0x1ff80000800000000000000080000000');
    const legendaryCatalystId = catalysts[3].catalystId;
    const gemsIds = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1];
    await expect(
      assetUpgraderAsUser0.changeCatalyst(
        user0,
        assetId,
        legendaryCatalystId,
        gemsIds,
        user0
      )
    ).to.be.revertedWith('GEMS_TOO_MANY');
  });

  it('setCatalystWithBlockNumber should fail for non migration contract', async function () {
    const {
      assetAttributesRegistryAsmockedMigrationContract,
    } = await setupAssetAttributesRegistry();
    const assetId = 2;
    const legendaryCatalystId = catalysts[2].catalystId;
    const gemsIds = gems.filter((gem) => gem.gemId < 4).map((gem) => gem.gemId);
    const blockNumber = 100;

    await expect(
      assetAttributesRegistryAsmockedMigrationContract.setCatalystWithBlockNumber(
        assetId,
        legendaryCatalystId,
        gemsIds,
        blockNumber
      )
    ).to.be.revertedWith('NOT_AUTHORIZED_MIGRATION');
  });

  it('addGems to rareCatalystId', async function () {
    const {
      user0,
      assetAttributesRegistry,
      assetUpgrader,
      assetUpgraderAsUser0,
    } = await setupAssetAttributesRegistry();
    const assetId = await mintAsset(
      user0,
      BigNumber.from('2233'),
      '0x1111111111111111111111111111111111111111111111111111111111fff111',
      1,
      0,
      user0,
      Buffer.from('ff')
    );
    let gemsIds = [gems[0].gemId];
    const rareCatalystId = catalysts[1].catalystId;

    const {record, event, block} = await setCatalyst(
      user0,
      assetId,
      rareCatalystId,
      gemsIds,
      user0,
      assetUpgrader,
      assetAttributesRegistry
    );

    testSetCatalyst(record, event, block, gemsIds, rareCatalystId, assetId);
    const gemsToAdd = [gems[1].gemId];
    await waitFor(
      assetUpgraderAsUser0.addGems(user0, assetId, gemsToAdd, user0)
    );
    gemsIds = [...gemsIds, ...gemsToAdd];
    const newRecord = await assetAttributesRegistry.getRecord(assetId);
    expect(newRecord.exists).to.equal(true);
    for (let i = 0; i < gemsIds.length; i++) {
      expect(newRecord.gemIds[i]).to.equal(i + 1);
    }
  });

  it('should fail for non-nft', async function () {
    const {
      user0,
      assetAttributesRegistry,
      assetUpgrader,
    } = await setupAssetAttributesRegistry();
    const assetId = BigNumber.from(
      '9435802489392532849329415225251965785597302377102806428109850929297113483264'
    );
    const gemsIds = [gems[0].gemId];
    const rareCatalystId = catalysts[1].catalystId;

    await expect(
      setCatalyst(
        user0,
        assetId,
        rareCatalystId,
        gemsIds,
        user0,
        assetUpgrader,
        assetAttributesRegistry
      )
    ).to.be.revertedWith('INVALID_NOT_NFT');
  });

  it('addGems should fail for non minter account', async function () {
    const {
      user0,
      assetAttributesRegistryAsUser0,
      assetUpgrader,
      assetAttributesRegistry,
    } = await setupAssetAttributesRegistry();
    const assetId = await mintAsset(
      user0,
      BigNumber.from('22331'),
      '0x1111111111111112111111111111111111111111111111111111111111fff111',
      1,
      0,
      user0,
      Buffer.from('ff')
    );
    let gemsIds = [gems[0].gemId];
    const rareCatalystId = catalysts[1].catalystId;
    await setCatalyst(
      user0,
      assetId,
      rareCatalystId,
      gemsIds,
      user0,
      assetUpgrader,
      assetAttributesRegistry
    );
    gemsIds = gems.filter((gem) => gem.gemId < 5).map((gem) => gem.gemId);
    await expect(
      assetAttributesRegistryAsUser0.addGems(assetId, gemsIds)
    ).to.be.revertedWith('NOT_AUTHORIZED_UPGRADER');
  });

  it('addGems should fail for empty gemsId array', async function () {
    const {user0, assetUpgraderAsUser0} = await setupAssetAttributesRegistry();
    const assetId = BigNumber.from(
      '0x0000000000000000000000000000000000000000800000000000000000000000'
    );
    let gemsIds = [];
    gemsIds = gems.filter((gem) => gem.gemId < 5).map((gem) => gem.gemId);
    await expect(
      assetUpgraderAsUser0.addGems(user0, assetId, gemsIds, user0)
    ).to.be.revertedWith('NO_CATALYST_SET');
  });

  it('addGems should fail for non existing catalystId', async function () {
    const {user0, assetUpgraderAsUser0} = await setupAssetAttributesRegistry();
    const assetId = BigNumber.from(
      '0x0000000000000000000000000000000000000000800000000000000000000000'
    );
    let gemsIds = [];
    gemsIds = gems.filter((gem) => gem.gemId < 5).map((gem) => gem.gemId);
    await expect(
      assetUpgraderAsUser0.addGems(user0, assetId, gemsIds, user0)
    ).to.be.revertedWith('NO_CATALYST_SET');
  });

  it('should fail for gemId = 0', async function () {
    const {
      user0,
      assetUpgrader,
      assetAttributesRegistry,
    } = await setupAssetAttributesRegistry();

    const assetId = BigNumber.from(
      '0x0000000000000000000000000000000000000000800000000000000000000000'
    );
    const gemsIds = [0];
    const rareCatalystId = catalysts[1].catalystId;

    await expect(
      setCatalyst(
        user0,
        assetId,
        rareCatalystId,
        gemsIds,
        user0,
        assetUpgrader,
        assetAttributesRegistry
      )
    ).to.be.revertedWith('GEM_DOES_NOT_EXIST');
  });

  it('addGems should fail when trying to add two gems in total to commonCatalyst', async function () {
    const {
      user0,
      assetUpgraderAsUser0,
      assetUpgrader,
      assetAttributesRegistry,
    } = await setupAssetAttributesRegistry();
    const assetId = await mintAsset(
      user0,
      BigNumber.from('121'),
      '0x0011111111111112111111111111111111111111111111111111111111fff111',
      1,
      0,
      user0,
      Buffer.from('ff')
    );
    const gemsIds = [gems[0].gemId];
    const commonCatalystId = catalysts[0].catalystId;

    await setCatalyst(
      user0,
      assetId,
      commonCatalystId,
      gemsIds,
      user0,
      assetUpgrader,
      assetAttributesRegistry
    );
    await expect(
      assetUpgraderAsUser0.addGems(user0, assetId, [gems[1].gemId], user0)
    ).to.be.revertedWith('GEMS_TOO_MANY');
  });

  it('admin can change attributes contract', async function () {
    const {catalystAdmin} = await getNamedAccounts();
    const users = await getUnnamedAccounts();
    const commonCatalyst = await ethers.getContract('Catalyst_COMMON');
    const catalystAsAdmin = await commonCatalyst.connect(
      ethers.provider.getSigner(catalystAdmin)
    );
    const pretendAttributesContractAddress = users[9];
    await catalystAsAdmin.changeAttributes(pretendAttributesContractAddress);
    await expect(commonCatalyst.getAttributes(42, [])).to.be.reverted;
  });

  it('fails if anyone other than admin trys to change attributes', async function () {
    const users = await getUnnamedAccounts();
    const commonCatalyst = await ethers.getContract('Catalyst_COMMON');
    await expect(commonCatalyst.changeAttributes(users[6])).to.be.revertedWith(
      'ADMIN_ONLY'
    );
  });
});
