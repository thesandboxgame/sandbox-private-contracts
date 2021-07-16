import {deployments} from 'hardhat';
import {BigNumber} from '@ethersproject/bignumber';
import {expect} from '../../../chai-setup';
import {setupGemsAndCatalysts} from './fixtures';
import {waitFor} from '../../../utils';
import catalysts from '../../../../data/catalysts';
describe('GemsCatalystsRegistry', function () {
  before(async function () {
    await deployments.fixture('GemsCatalystsRegistry');
  });

  it('getMaxGems for commonCatalyst should be 1', async function () {
    const {
      gemsCatalystsRegistry,
      commonCatalyst,
    } = await setupGemsAndCatalysts();
    const catalystId = await commonCatalyst.catalystId();
    const maxGems = await gemsCatalystsRegistry.getMaxGems(catalystId);
    expect(maxGems).to.equal(catalysts[0].maxGems);
  });

  it('getMaxGems for non existing catalystId should fail', async function () {
    const {gemsCatalystsRegistry} = await setupGemsAndCatalysts();
    await expect(gemsCatalystsRegistry.getMaxGems(10)).to.be.revertedWith(
      'CATALYST_DOES_NOT_EXIST'
    );
  });

  it('burnCatalyst should burn 2 common catalysts from catalystOwner account', async function () {
    const {
      gemsCatalystsRegistryAsCataystOwner,
      commonCatalyst,
      catalystOwner,
    } = await setupGemsAndCatalysts();
    const catalystId = await commonCatalyst.catalystId();
    const totalSupplyBefore = await commonCatalyst.totalSupply();
    const balanceBeforeBurning = await commonCatalyst.balanceOf(catalystOwner);
    const burnAmount = BigNumber.from('2');
    await waitFor(
      gemsCatalystsRegistryAsCataystOwner.burnCatalyst(
        catalystOwner,
        catalystId,
        burnAmount
      )
    );
    const totalSupplyAfter = await commonCatalyst.totalSupply();
    const balanceAfterBurning = await commonCatalyst.balanceOf(catalystOwner);
    expect(balanceAfterBurning).to.equal(balanceBeforeBurning.sub(burnAmount));
    expect(totalSupplyAfter).to.equal(totalSupplyBefore.sub(burnAmount));
  });

  it('burnCatalyst should burn 2 common catalysts from superOperator account', async function () {
    const {
      gemsCatalystsRegistryAsRegistrySuperOperator,
      commonCatalyst,
      catalystOwner,
    } = await setupGemsAndCatalysts();
    const catalystId = await commonCatalyst.catalystId();
    const totalSupplyBefore = await commonCatalyst.totalSupply();
    const balanceBeforeBurning = await commonCatalyst.balanceOf(catalystOwner);
    const burnAmount = BigNumber.from('2');
    await waitFor(
      gemsCatalystsRegistryAsRegistrySuperOperator.burnCatalyst(
        catalystOwner,
        catalystId,
        burnAmount
      )
    );
    const totalSupplyAfter = await commonCatalyst.totalSupply();
    const balanceAfterBurning = await commonCatalyst.balanceOf(catalystOwner);
    expect(balanceAfterBurning).to.equal(balanceBeforeBurning.sub(burnAmount));
    expect(totalSupplyAfter).to.equal(totalSupplyBefore.sub(burnAmount));
  });
  it('burnCatalyst should fail for unauthorized account', async function () {
    const {
      gemsCatalystsRegistryAsUser3,
      commonCatalyst,
      catalystOwner,
    } = await setupGemsAndCatalysts();
    const catalystId = await commonCatalyst.catalystId();
    const burnAmount = BigNumber.from('2');
    await expect(
      gemsCatalystsRegistryAsUser3.burnCatalyst(
        catalystOwner,
        catalystId,
        burnAmount
      )
    ).to.be.revertedWith('AUTH_ACCESS_DENIED');
  });

  it('burnCatalyst should fail for non existing catalystId', async function () {
    const {
      gemsCatalystsRegistryAdmin,
      gemsCatalystsRegistryAsRegAdmin,
    } = await setupGemsAndCatalysts();
    const burnAmount = BigNumber.from('2');

    await expect(
      gemsCatalystsRegistryAsRegAdmin.burnCatalyst(
        gemsCatalystsRegistryAdmin,
        101,
        burnAmount
      )
    ).to.be.revertedWith('CATALYST_DOES_NOT_EXIST');
  });

  it('burnCatalyst should fail for insufficient amount', async function () {
    const {
      gemsCatalystsRegistryAsCataystMinter,
      commonCatalyst,
      catalystMinter,
    } = await setupGemsAndCatalysts();
    const catalystId = await commonCatalyst.catalystId();
    const burnAmount = BigNumber.from('200');
    await expect(
      gemsCatalystsRegistryAsCataystMinter.burnCatalyst(
        catalystMinter,
        catalystId,
        burnAmount
      )
    ).to.be.revertedWith('INSUFFICIENT_FUNDS');
  });

  it('burnCatalyst should fail for account with no gems', async function () {
    const {
      user3,
      gemsCatalystsRegistryAsUser3,
      commonCatalyst,
    } = await setupGemsAndCatalysts();
    const catalystId = await commonCatalyst.catalystId();
    const burnAmount = BigNumber.from('200');
    await expect(
      gemsCatalystsRegistryAsUser3.burnGem(user3, catalystId, burnAmount)
    ).to.be.revertedWith('INSUFFICIENT_FUNDS');
  });

  it('burnGem should burn 3 power gems from gemOwner account', async function () {
    const {
      gemsCatalystsRegistryAsGemOwner,
      powerGem,
      gemOwner,
    } = await setupGemsAndCatalysts();
    const gemId = await powerGem.gemId();
    const totalSupplyBefore = await powerGem.totalSupply();
    const balanceBeforeBurning = await powerGem.balanceOf(gemOwner);
    const burnAmount = BigNumber.from('3');
    await waitFor(
      gemsCatalystsRegistryAsGemOwner.burnGem(gemOwner, gemId, burnAmount)
    );
    const balanceAfterBurning = await powerGem.balanceOf(gemOwner);
    const totalSupplyAfter = await powerGem.totalSupply();
    expect(balanceAfterBurning).to.equal(balanceBeforeBurning.sub(burnAmount));
    expect(totalSupplyAfter).to.equal(totalSupplyBefore.sub(burnAmount));
  });

  it('burnGem should burn 3 power gems from superOperator account', async function () {
    const {
      gemsCatalystsRegistryAsRegistrySuperOperator,
      powerGem,
      gemOwner,
    } = await setupGemsAndCatalysts();
    const gemId = await powerGem.gemId();
    const totalSupplyBefore = await powerGem.totalSupply();
    const balanceBeforeBurning = await powerGem.balanceOf(gemOwner);
    const burnAmount = BigNumber.from('3');
    await waitFor(
      gemsCatalystsRegistryAsRegistrySuperOperator.burnGem(
        gemOwner,
        gemId,
        burnAmount
      )
    );
    const balanceAfterBurning = await powerGem.balanceOf(gemOwner);
    const totalSupplyAfter = await powerGem.totalSupply();
    expect(balanceAfterBurning).to.equal(balanceBeforeBurning.sub(burnAmount));
    expect(totalSupplyAfter).to.equal(totalSupplyBefore.sub(burnAmount));
  });

  it('burnGem should fail for unauthorized account', async function () {
    const {
      gemsCatalystsRegistryAsUser3,
      powerGem,
      gemOwner,
    } = await setupGemsAndCatalysts();
    const gemId = await powerGem.gemId();
    const burnAmount = BigNumber.from('2');
    await expect(
      gemsCatalystsRegistryAsUser3.burnGem(gemOwner, gemId, burnAmount)
    ).to.be.revertedWith('AUTH_ACCESS_DENIED');
  });
  it('burnGem should fail for non existing gemId', async function () {
    const {
      gemsCatalystsRegistryAsGemMinter,
      gemMinter,
    } = await setupGemsAndCatalysts();
    const burnAmount = BigNumber.from('2');
    await expect(
      gemsCatalystsRegistryAsGemMinter.burnGem(gemMinter, 101, burnAmount)
    ).to.be.revertedWith('GEM_DOES_NOT_EXIST');
  });

  it('burnGem should fail for insufficient amount', async function () {
    const {
      gemsCatalystsRegistryAsGemMinter,
      powerGem,
      gemMinter,
    } = await setupGemsAndCatalysts();
    const gemId = await powerGem.gemId();
    const burnAmount = BigNumber.from('200');
    await expect(
      gemsCatalystsRegistryAsGemMinter.burnGem(gemMinter, gemId, burnAmount)
    ).to.be.revertedWith('INSUFFICIENT_FUNDS');
  });

  it('burnGem should fail for account with no gems', async function () {
    const {
      user3,
      gemsCatalystsRegistryAsUser3,
      powerGem,
    } = await setupGemsAndCatalysts();
    const gemId = await powerGem.gemId();
    const burnAmount = BigNumber.from('200');
    expect(
      gemsCatalystsRegistryAsUser3.burnGem(user3, gemId, burnAmount)
    ).to.be.revertedWith('INSUFFICIENT_FUNDS');
  });

  it('addGemsAndCatalysts should fail for existing gemId', async function () {
    const {
      gemsCatalystsRegistryAsRegAdmin,
      powerGem,
      commonCatalyst,
    } = await setupGemsAndCatalysts();
    await expect(
      gemsCatalystsRegistryAsRegAdmin.addGemsAndCatalysts(
        [powerGem.address],
        [commonCatalyst.address]
      )
    ).to.be.revertedWith('GEM_ID_NOT_IN_ORDER');
  });

  it('addGemsAndCatalysts should fail for existing catalystd', async function () {
    const {
      gemsCatalystsRegistryAsRegAdmin,
      commonCatalyst,
    } = await setupGemsAndCatalysts();
    await expect(
      gemsCatalystsRegistryAsRegAdmin.addGemsAndCatalysts(
        [],
        [commonCatalyst.address]
      )
    ).to.be.revertedWith('CATALYST_ID_NOT_IN_ORDER');
  });

  it('addGemsAndCatalysts should add gemExample', async function () {
    const {
      gemsCatalystsRegistry,
      gemExample,
      gemsCatalystsRegistryAsRegAdmin,
    } = await setupGemsAndCatalysts();
    await waitFor(
      gemsCatalystsRegistryAsRegAdmin.addGemsAndCatalysts(
        [gemExample.address],
        []
      )
    );
    const gemId = await gemExample.gemId();
    expect(await gemsCatalystsRegistry.doesGemExist(gemId)).to.equal(true);
  });

  it('addGemsAndCatalysts should add catalystExample', async function () {
    const {
      gemsCatalystsRegistry,
      catalystExample,
      gemsCatalystsRegistryAsRegAdmin,
    } = await setupGemsAndCatalysts();
    await waitFor(
      gemsCatalystsRegistryAsRegAdmin.addGemsAndCatalysts(
        [],
        [catalystExample.address]
      )
    );
    const catalystId = await catalystExample.catalystId();
    expect(await gemsCatalystsRegistry.doesCatalystExist(catalystId)).to.equal(
      true
    );
  });

  it('addGemsAndCatalysts should fail for gem id not in order', async function () {
    const {
      gemNotInOrder,
      gemsCatalystsRegistryAsRegAdmin,
    } = await setupGemsAndCatalysts();
    await expect(
      gemsCatalystsRegistryAsRegAdmin.addGemsAndCatalysts(
        [gemNotInOrder.address],
        []
      )
    ).to.be.revertedWith('GEM_ID_NOT_IN_ORDER');
  });

  it('addGemsAndCatalysts should fail for unauthorized user', async function () {
    const {
      gemsCatalystsRegistryAsUser3,
      gemExample,
    } = await setupGemsAndCatalysts();
    await expect(
      gemsCatalystsRegistryAsUser3.addGemsAndCatalysts([gemExample.address], [])
    ).to.be.revertedWith('NOT_AUTHORIZED');
  });

  it('burnDifferentGems for two different gem tokens', async function () {
    const {
      gemsCatalystsRegistryAsGemOwner,
      powerGem,
      defenseGem,
      gemOwner,
    } = await setupGemsAndCatalysts();
    const powerGemId = await powerGem.gemId();
    const defenseGemId = await defenseGem.gemId();
    const balanceBeforeBurningPowerGem = await powerGem.balanceOf(gemOwner);
    const balanceBeforeBurningDefenseGem = await defenseGem.balanceOf(gemOwner);
    const totalSupplyBeforeBurningPowerGem = await powerGem.totalSupply();
    const totalSupplyBeforeBurningDefenseGem = await defenseGem.totalSupply();
    const burnAmount = BigNumber.from('15555');
    await waitFor(
      gemsCatalystsRegistryAsGemOwner.burnDifferentGems(
        gemOwner,
        [defenseGemId, powerGemId],
        burnAmount
      )
    );
    const balanceAfterBurningPowerGem = await powerGem.balanceOf(gemOwner);
    const balanceAfterBurningDefenseGem = await defenseGem.balanceOf(gemOwner);
    const totalSupplyAfterBurningPowerGem = await powerGem.totalSupply();
    const totalSupplyAfterBurningDefenseGem = await defenseGem.totalSupply();
    expect(balanceAfterBurningPowerGem).to.equal(
      balanceBeforeBurningPowerGem.sub(burnAmount)
    );
    expect(balanceAfterBurningDefenseGem).to.equal(
      balanceBeforeBurningDefenseGem.sub(burnAmount)
    );
    expect(totalSupplyAfterBurningPowerGem).to.equal(
      totalSupplyBeforeBurningPowerGem.sub(burnAmount)
    );
    expect(totalSupplyAfterBurningDefenseGem).to.equal(
      totalSupplyBeforeBurningDefenseGem.sub(burnAmount)
    );
  });

  it('burnDifferentCatalysts for two different catalyst tokens', async function () {
    const {
      gemsCatalystsRegistryAsCataystOwner,
      rareCatalyst,
      commonCatalyst,
      catalystOwner,
    } = await setupGemsAndCatalysts();
    const rareCatalystId = await rareCatalyst.catalystId();
    const commonCatalystId = await commonCatalyst.catalystId();
    const balanceBeforeBurningRareCatalyst = await rareCatalyst.balanceOf(
      catalystOwner
    );
    const balanceBeforeBurningCommonCatalyst = await commonCatalyst.balanceOf(
      catalystOwner
    );
    const totalSupplyBeforeBurningRareCatalyst = await rareCatalyst.totalSupply();
    const totalSupplyBeforeBurningDefenseGem = await commonCatalyst.totalSupply();
    const burnAmount = BigNumber.from('100');
    await waitFor(
      gemsCatalystsRegistryAsCataystOwner.burnDifferentCatalysts(
        catalystOwner,
        [rareCatalystId, commonCatalystId],
        burnAmount
      )
    );
    const balanceAfterBurningRareCatalyst = await rareCatalyst.balanceOf(
      catalystOwner
    );
    const balanceAfterBurningCommonCatalyst = await commonCatalyst.balanceOf(
      catalystOwner
    );
    const totalSupplyAfterBurningRareCatalyst = await rareCatalyst.totalSupply();
    const totalSupplyAfterBurningDefenseGem = await commonCatalyst.totalSupply();
    expect(balanceAfterBurningRareCatalyst).to.equal(
      balanceBeforeBurningRareCatalyst.sub(burnAmount)
    );
    expect(balanceAfterBurningCommonCatalyst).to.equal(
      balanceBeforeBurningCommonCatalyst.sub(burnAmount)
    );
    expect(totalSupplyAfterBurningRareCatalyst).to.equal(
      totalSupplyBeforeBurningRareCatalyst.sub(burnAmount)
    );
    expect(totalSupplyAfterBurningDefenseGem).to.equal(
      totalSupplyBeforeBurningDefenseGem.sub(burnAmount)
    );
  });

  it('batchBurnGems for two different gem tokens and two different amounts', async function () {
    const {
      gemsCatalystsRegistryAsGemOwner,
      powerGem,
      defenseGem,
      gemOwner,
    } = await setupGemsAndCatalysts();
    const powerGemId = await powerGem.gemId();
    const defenseGemId = await defenseGem.gemId();
    const balanceBeforeBurningPowerGem = await powerGem.balanceOf(gemOwner);
    const balanceBeforeBurningDefenseGem = await defenseGem.balanceOf(gemOwner);
    const totalSupplyBeforeBurningPowerGem = await powerGem.totalSupply();
    const totalSupplyBeforeBurningDefenseGem = await defenseGem.totalSupply();
    const burnAmounts = [BigNumber.from('4'), BigNumber.from('6')];
    await waitFor(
      gemsCatalystsRegistryAsGemOwner.batchBurnGems(
        gemOwner,
        [defenseGemId, powerGemId],
        burnAmounts
      )
    );
    const balanceAfterBurningPowerGem = await powerGem.balanceOf(gemOwner);
    const balanceAfterBurningDefenseGem = await defenseGem.balanceOf(gemOwner);
    const totalSupplyAfterBurningPowerGem = await powerGem.totalSupply();
    const totalSupplyAfterBurningDefenseGem = await defenseGem.totalSupply();
    expect(balanceAfterBurningPowerGem).to.equal(
      balanceBeforeBurningPowerGem.sub(burnAmounts[1])
    );
    expect(balanceAfterBurningDefenseGem).to.equal(
      balanceBeforeBurningDefenseGem.sub(burnAmounts[0])
    );
    expect(totalSupplyAfterBurningPowerGem).to.equal(
      totalSupplyBeforeBurningPowerGem.sub(burnAmounts[1])
    );
    expect(totalSupplyAfterBurningDefenseGem).to.equal(
      totalSupplyBeforeBurningDefenseGem.sub(burnAmounts[0])
    );
  });
});
