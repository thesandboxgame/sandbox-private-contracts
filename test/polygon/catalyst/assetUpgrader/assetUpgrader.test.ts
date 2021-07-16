import {BigNumber} from '@ethersproject/bignumber';
import {expect} from '../../../chai-setup';
import {setupAssetUpgrader} from './fixtures';
import {waitFor} from '../../../utils';
import {
  changeCatalyst,
  mintAsset,
  mintCatalyst,
  mintGem,
  transferSand,
} from '../utils';
import {ethers} from 'hardhat';
import {upgradeFee} from '../../../../data/assetUpgraderFees';

const GEM_CATALYST_UNIT = BigNumber.from('1000000000000000000');

describe('AssetUpgrader', function () {
  it('extractAndSetCatalyst for FT with rareCatalyst and powerGem, no ownership change', async function () {
    const {
      catalystOwner,
      upgradeFee,
      assetAttributesRegistry,
      assetContract,
      sandContract,
      feeRecipient,
      rareCatalyst,
      powerGem,
      gemsCatalystsUnit,
      assetUpgraderContractAsCatalystOwner,
    } = await setupAssetUpgrader();
    const catalystId = await rareCatalyst.catalystId();
    const mintingAmount = BigNumber.from('8').mul(
      BigNumber.from(gemsCatalystsUnit)
    );
    await mintCatalyst(rareCatalyst, mintingAmount, catalystOwner);
    await mintGem(powerGem, mintingAmount, catalystOwner);

    const powerGemId = await powerGem.gemId();

    const totalSupplyBeforeRareCatalyst = await rareCatalyst.totalSupply();
    const balanceBeforeBurning = await rareCatalyst.balanceOf(catalystOwner);

    const balanceBeforeBurningPowerGem = await powerGem.balanceOf(
      catalystOwner
    );
    const totalSupplyBeforeBurningPowerGem = await powerGem.totalSupply();

    const sandBalanceFromBefore = await sandContract.balanceOf(catalystOwner);
    const sandBalanceToBefore = await sandContract.balanceOf(feeRecipient);
    const assetSupply = BigNumber.from('3');
    const assetId = await mintAsset(
      catalystOwner,
      BigNumber.from('22'),
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      assetSupply,
      0,
      catalystOwner,
      Buffer.from('ff')
    );
    const tokenId = await assetUpgraderContractAsCatalystOwner.callStatic.extractAndSetCatalyst(
      catalystOwner,
      assetId,
      catalystId,
      [powerGemId],
      catalystOwner
    );
    await waitFor(
      assetUpgraderContractAsCatalystOwner.extractAndSetCatalyst(
        catalystOwner,
        assetId,
        catalystId,
        [powerGemId],
        catalystOwner
      )
    );
    const balanceOldAsset = await assetContract['balanceOf(address,uint256)'](
      catalystOwner,
      assetId
    );
    const sandBalanceFromAfter = await sandContract.balanceOf(catalystOwner);
    const sandBalanceToAfter = await sandContract.balanceOf(feeRecipient);

    const totalSupplyAfterRareCatalyst = await rareCatalyst.totalSupply();
    const balanceAfterBurningRareCatalyst = await rareCatalyst.balanceOf(
      catalystOwner
    );
    const balanceAfterBurningPowerGem = await powerGem.balanceOf(catalystOwner);
    const totalSupplyAfterBurningPowerGem = await powerGem.totalSupply();

    // check erc1155 burn
    expect(balanceOldAsset).to.equal(assetSupply.sub(BigNumber.from('1')));
    // check catalyst burn
    expect(balanceAfterBurningRareCatalyst).to.equal(
      balanceBeforeBurning.sub(GEM_CATALYST_UNIT)
    );
    expect(totalSupplyAfterRareCatalyst).to.equal(
      totalSupplyBeforeRareCatalyst.sub(GEM_CATALYST_UNIT)
    );
    // check gem burn
    expect(balanceAfterBurningPowerGem).to.equal(
      balanceBeforeBurningPowerGem.sub(GEM_CATALYST_UNIT)
    );
    expect(totalSupplyAfterBurningPowerGem).to.equal(
      totalSupplyBeforeBurningPowerGem.sub(GEM_CATALYST_UNIT)
    );
    // check sand fee transfer
    expect(sandBalanceFromAfter).to.equal(
      sandBalanceFromBefore.sub(upgradeFee)
    );
    expect(sandBalanceToAfter).to.equal(sandBalanceToBefore.add(upgradeFee));
    // check assetAttributesRegistry
    const record = await assetAttributesRegistry.getRecord(tokenId);
    expect(record.catalystId).to.equal(catalystId);
    expect(record.exists).to.equal(true);
    // check asset transfer
    const newOwner = await assetContract.callStatic.ownerOf(tokenId);
    expect(newOwner).to.equal(catalystOwner);
  });
  it('extractAndSetCatalyst should fail for NFT', async function () {
    const {
      catalystOwner,
      rareCatalyst,
      powerGem,
      gemsCatalystsUnit,
      assetUpgraderContractAsCatalystOwner,
    } = await setupAssetUpgrader();
    const catalystId = await rareCatalyst.catalystId();
    const mintingAmount = BigNumber.from('8').mul(
      BigNumber.from(gemsCatalystsUnit)
    );
    await mintCatalyst(rareCatalyst, mintingAmount, catalystOwner);
    await mintGem(powerGem, mintingAmount, catalystOwner);

    const powerGemId = await powerGem.gemId();

    const assetId = await mintAsset(
      catalystOwner,
      BigNumber.from('2233'),
      '0x1111111111111111111100111111111111111111111111111111111111111111',
      1,
      0,
      catalystOwner,
      Buffer.from('ff')
    );
    await expect(
      assetUpgraderContractAsCatalystOwner.extractAndSetCatalyst(
        catalystOwner,
        assetId,
        catalystId,
        [powerGemId],
        catalystOwner
      )
    ).to.be.revertedWith(`!1155`);
  });
  it('setting a rareCatalyst with powerGem and defenseGem', async function () {
    const {
      user2,
      user5,
      upgradeFee,
      assetUpgraderContract,
      assetAttributesRegistry,
      assetContract,
      sandContract,
      feeRecipient,
      rareCatalyst,
      powerGem,
      defenseGem,
      gemsCatalystsUnit,
    } = await setupAssetUpgrader();

    await transferSand(
      sandContract,
      user5,
      BigNumber.from('2').mul(upgradeFee)
    );
    const mintingAmount = BigNumber.from('8').mul(
      BigNumber.from(gemsCatalystsUnit)
    );
    await mintCatalyst(rareCatalyst, mintingAmount, user5);
    await mintGem(powerGem, mintingAmount, user5);
    await mintGem(defenseGem, mintingAmount, user5);
    const assetId = await mintAsset(
      user5,
      BigNumber.from('12312'),
      '0x1111111111111111111222211111111111111111111111111111111111111111',
      1,
      0,
      user5,
      Buffer.from('ff')
    );
    const powerGemId = await powerGem.gemId();
    const defenseGemId = await defenseGem.gemId();

    const catalystId = await rareCatalyst.catalystId();
    const totalSupplyBeforeRareCatalyst = await rareCatalyst.totalSupply();
    const balanceBeforeBurning = await rareCatalyst.balanceOf(user5);

    const balanceBeforeBurningPowerGem = await powerGem.balanceOf(user5);
    const balanceBeforeBurningDefenseGem = await defenseGem.balanceOf(user5);
    const totalSupplyBeforeBurningPowerGem = await powerGem.totalSupply();
    const totalSupplyBeforeBurningDefenseGem = await defenseGem.totalSupply();

    const sandBalanceFromBefore = await sandContract.balanceOf(user5);
    const sandBalanceToBefore = await sandContract.balanceOf(feeRecipient);
    await changeCatalyst(
      assetUpgraderContract,
      user5,
      assetId,
      catalystId,
      [powerGemId, defenseGemId],
      user2
    );
    const sandBalanceFromAfter = await sandContract.balanceOf(user5);
    const sandBalanceToAfter = await sandContract.balanceOf(feeRecipient);

    const totalSupplyAfterRareCatalyst = await rareCatalyst.totalSupply();
    const balanceAfterBurningRareCatalyst = await rareCatalyst.balanceOf(user5);
    const balanceAfterBurningPowerGem = await powerGem.balanceOf(user5);
    const balanceAfterBurningDefenseGem = await defenseGem.balanceOf(user5);
    const totalSupplyAfterBurningPowerGem = await powerGem.totalSupply();
    const totalSupplyAfterBurningDefenseGem = await defenseGem.totalSupply();
    // check catalyst burn
    expect(balanceAfterBurningRareCatalyst).to.equal(
      balanceBeforeBurning.sub(GEM_CATALYST_UNIT)
    );
    expect(totalSupplyAfterRareCatalyst).to.equal(
      totalSupplyBeforeRareCatalyst.sub(GEM_CATALYST_UNIT)
    );
    // check gem burn
    expect(balanceAfterBurningPowerGem).to.equal(
      balanceBeforeBurningPowerGem.sub(GEM_CATALYST_UNIT)
    );
    expect(balanceAfterBurningDefenseGem).to.equal(
      balanceBeforeBurningDefenseGem.sub(GEM_CATALYST_UNIT)
    );
    expect(totalSupplyAfterBurningPowerGem).to.equal(
      totalSupplyBeforeBurningPowerGem.sub(GEM_CATALYST_UNIT)
    );
    expect(totalSupplyAfterBurningDefenseGem).to.equal(
      totalSupplyBeforeBurningDefenseGem.sub(GEM_CATALYST_UNIT)
    );
    // check sand fee transfer
    expect(sandBalanceFromAfter).to.equal(
      sandBalanceFromBefore.sub(upgradeFee)
    );
    expect(sandBalanceToAfter).to.equal(sandBalanceToBefore.add(upgradeFee));
    // check assetAttributesRegistry
    const record = await assetAttributesRegistry.getRecord(assetId);
    expect(record.catalystId).to.equal(catalystId);
    expect(record.exists).to.equal(true);
    // check asset transfer
    const newOwner = await assetContract.callStatic.ownerOf(assetId);
    expect(newOwner).to.equal(user2);
  });
  it('adding powerGem and defenseGem to a rareCatalyst with no gems', async function () {
    const {
      powerGemAsUser4,
      defenseGemAsUser4,
      assetUpgraderContract,
      assetAttributesRegistry,
      sandContract,
      assetContract,
      feeRecipient,
      rareCatalyst,
      powerGem,
      defenseGem,
      gemAdditionFee,
      gemsCatalystsUnit,
      gemsCatalystsRegistry,
      assetUpgraderContractAsUser4,
      user4,
    } = await setupAssetUpgrader();

    await transferSand(
      sandContract,
      user4,
      BigNumber.from('100').mul(gemAdditionFee)
    );
    const mintingAmount = BigNumber.from('8').mul(
      BigNumber.from(gemsCatalystsUnit)
    );
    await mintCatalyst(rareCatalyst, mintingAmount, user4);
    await mintGem(powerGem, mintingAmount, user4);
    await mintGem(defenseGem, mintingAmount, user4);
    const assetId = await mintAsset(
      user4,
      BigNumber.from('2257'),
      '0x2211111111111111111111111111111111111111111111111111111111111111',
      1,
      0,
      user4,
      Buffer.from('ff')
    );
    const powerGemId = await powerGem.gemId();
    const defenseGemId = await defenseGem.gemId();
    const catalystId = await rareCatalyst.catalystId();

    const balanceBeforeBurningPowerGem = await powerGem.balanceOf(user4);
    const balanceBeforeBurningDefenseGem = await defenseGem.balanceOf(user4);
    const totalSupplyBeforeBurningPowerGem = await powerGem.totalSupply();
    const totalSupplyBeforeBurningDefenseGem = await defenseGem.totalSupply();
    const sandBalanceFromBefore = await sandContract.balanceOf(user4);
    const sandBalanceToBefore = await sandContract.balanceOf(feeRecipient);
    const gemIds = [powerGemId, defenseGemId];
    await waitFor(
      powerGemAsUser4.approve(gemsCatalystsRegistry.address, 100000000000000)
    );
    await waitFor(
      defenseGemAsUser4.approve(gemsCatalystsRegistry.address, 100000000000000)
    );

    await changeCatalyst(
      assetUpgraderContract,
      user4,
      assetId,
      catalystId,
      [],
      user4
    );
    await waitFor(
      assetUpgraderContractAsUser4.addGems(user4, assetId, gemIds, user4)
    );

    const balanceAfterBurningPowerGem = await powerGem.balanceOf(user4);
    const balanceAfterBurningDefenseGem = await defenseGem.balanceOf(user4);
    const totalSupplyAfterBurningPowerGem = await powerGem.totalSupply();
    const totalSupplyAfterBurningDefenseGem = await defenseGem.totalSupply();
    const sandBalanceFromAfter = await sandContract.balanceOf(user4);
    const sandBalanceToAfter = await sandContract.balanceOf(feeRecipient);

    // check gem burn
    expect(balanceAfterBurningPowerGem).to.equal(
      balanceBeforeBurningPowerGem.sub(GEM_CATALYST_UNIT)
    );
    expect(balanceAfterBurningDefenseGem).to.equal(
      balanceBeforeBurningDefenseGem.sub(GEM_CATALYST_UNIT)
    );
    expect(totalSupplyAfterBurningPowerGem).to.equal(
      totalSupplyBeforeBurningPowerGem.sub(GEM_CATALYST_UNIT)
    );
    expect(totalSupplyAfterBurningDefenseGem).to.equal(
      totalSupplyBeforeBurningDefenseGem.sub(GEM_CATALYST_UNIT)
    );

    // check sand fee transfer
    expect(sandBalanceFromAfter).to.equal(
      sandBalanceFromBefore.sub(gemAdditionFee.add(upgradeFee))
    );
    expect(sandBalanceToAfter).to.equal(
      sandBalanceToBefore.add(gemAdditionFee.add(upgradeFee))
    );

    // check assetAttributesRegistry
    const record = await assetAttributesRegistry.getRecord(assetId);
    const zeroPaddedArray = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(record.catalystId).to.equal(catalystId);
    expect(record.exists).to.equal(true);
    expect(record.gemIds).to.eql([...gemIds, ...zeroPaddedArray]);
    // check asset transfer
    const newOwner = await assetContract.callStatic.ownerOf(assetId);
    expect(newOwner).to.equal(user4);
  });
  it('setting a rareCatalyst where ownerOf(assetId)!= msg.sender should fail', async function () {
    const {
      user5,
      user10,
      upgradeFee,
      assetUpgraderContract,
      sandContract,
      rareCatalyst,
      powerGem,
      defenseGem,
      gemsCatalystsUnit,
    } = await setupAssetUpgrader();

    await transferSand(
      sandContract,
      user5,
      BigNumber.from('2').mul(upgradeFee)
    );

    await transferSand(
      sandContract,
      user10,
      BigNumber.from('2').mul(upgradeFee)
    );

    const assetId = await mintAsset(
      user5,
      BigNumber.from('22'),
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      1,
      0,
      user5,
      Buffer.from('ff')
    );

    const mintingAmount = BigNumber.from('8').mul(
      BigNumber.from(gemsCatalystsUnit)
    );
    await mintCatalyst(rareCatalyst, mintingAmount, user10);
    await mintGem(powerGem, mintingAmount, user10);
    await mintGem(defenseGem, mintingAmount, user10);

    const powerGemId = await powerGem.gemId();
    const defenseGemId = await defenseGem.gemId();
    const catalystId = await rareCatalyst.catalystId();

    await expect(
      assetUpgraderContract
        .connect(ethers.provider.getSigner(user10))
        .changeCatalyst(
          user10,
          assetId,
          catalystId,
          [powerGemId, defenseGemId],
          user10
        )
    ).to.be.revertedWith('NOT_AUTHORIZED_ASSET_OWNER');
  });

  it('burns sand fees when feeRecipient = BURN_ADDRESS', async function () {
    const BURN_ADDRESS = '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF';

    const {
      powerGemAsUser4,
      defenseGemAsUser4,
      sandContract,
      rareCatalyst,
      powerGem,
      defenseGem,
      gemAdditionFee,
      gemsCatalystsUnit,
      gemsCatalystsRegistry,
      user4,
      assetUpgraderFeeBurnerContract,
    } = await setupAssetUpgrader();

    const currentFeeRecipient = await assetUpgraderFeeBurnerContract.feeRecipient();
    expect(currentFeeRecipient).to.be.equal(BURN_ADDRESS);

    const upgraderFeeBurnerAsUser4 = await assetUpgraderFeeBurnerContract.connect(
      ethers.provider.getSigner(user4)
    );

    await transferSand(
      sandContract,
      user4,
      BigNumber.from('100').mul(gemAdditionFee)
    );
    const mintingAmount = BigNumber.from('8').mul(
      BigNumber.from(gemsCatalystsUnit)
    );
    await mintCatalyst(rareCatalyst, mintingAmount, user4);
    await mintGem(powerGem, mintingAmount, user4);
    await mintGem(defenseGem, mintingAmount, user4);
    const assetId = await mintAsset(
      user4,
      BigNumber.from('2257'),
      '0x2211111111111111111111111111111111111111111111111111111111111111',
      1,
      0,
      user4,
      Buffer.from('ff')
    );
    const powerGemId = await powerGem.gemId();
    const defenseGemId = await defenseGem.gemId();
    const catalystId = await rareCatalyst.catalystId();

    const sandBalanceFromBefore = await sandContract.balanceOf(user4);
    const totalSandSupplyBefore = await sandContract.totalSupply();

    const gemIds = [powerGemId, defenseGemId];
    await waitFor(
      powerGemAsUser4.approve(gemsCatalystsRegistry.address, 100000000000000)
    );
    await waitFor(
      defenseGemAsUser4.approve(gemsCatalystsRegistry.address, 100000000000000)
    );

    await changeCatalyst(
      assetUpgraderFeeBurnerContract,
      user4,
      assetId,
      catalystId,
      [],
      user4
    );
    await waitFor(
      upgraderFeeBurnerAsUser4.addGems(user4, assetId, gemIds, user4)
    );

    const sandBalanceFromAfter = await sandContract.balanceOf(user4);
    const totalSandSupplyAfter = await sandContract.totalSupply();

    // check sand burn
    expect(sandBalanceFromAfter).to.equal(
      sandBalanceFromBefore.sub(gemAdditionFee.add(upgradeFee))
    );
    expect(totalSandSupplyAfter).to.be.equal(
      totalSandSupplyBefore.sub(gemAdditionFee.add(upgradeFee))
    );
  });
});
