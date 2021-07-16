import {
  ethers,
  getUnnamedAccounts,
  getNamedAccounts,
  deployments,
} from 'hardhat';
import {Address} from 'hardhat-deploy/types';
import {BigNumber, Contract} from 'ethers';
import {expect} from '../../../chai-setup';
import catalysts from '../../../../data/catalysts';
import gems from '../../../../data/gems';
import {setupGemsAndCatalysts} from '../gemsCatalystsRegistry/fixtures';
import {setupAssetAttributesRegistry} from '../assetAttributesRegistry/fixtures';
import {setupAssetMinter, MintOptions, MintMultiOptions} from './fixtures';
import {setupAssetUpgrader} from '../assetUpgrader/fixtures';
import {mintCatalyst, mintGem, transferSand} from '../utils';
import {expectEventWithArgs, findEvents, waitFor} from '../../../utils';

let mintOptions: MintOptions;
let mintMultiOptions: MintMultiOptions;

const packId = BigNumber.from('1');
const hash = ethers.utils.keccak256('0x42');
const catId = catalysts[1].catalystId;
const ids = [gems[0].gemId, gems[1].gemId];
const supply = 1;
const callData = Buffer.from('');

const METATX_2771 = 2;
const gemsCatalystsUnit = '1000000000000000000';

const NFT_SUPPLY = 1;
const FT_SUPPLY = 7;
const emptyRecordGemIds = new Array(15).fill(0);
const oneToken = BigNumber.from(1).mul(gemsCatalystsUnit);

function bn(x: number): BigNumber {
  return BigNumber.from(x);
}

type MintObj = {
  contract: Contract;
  amount: number;
  recipient: Address;
};

async function mintCats(mintObjects: MintObj[]): Promise<void> {
  for (const obj of mintObjects) {
    await mintCatalyst(
      obj.contract,
      BigNumber.from(obj.amount.toString()).mul(
        BigNumber.from(gemsCatalystsUnit)
      ),
      obj.recipient
    );
  }
}

async function mintGems(mintObjects: MintObj[]): Promise<void> {
  for (const obj of mintObjects) {
    await mintGem(
      obj.contract,
      BigNumber.from(obj.amount.toString()).mul(
        BigNumber.from(gemsCatalystsUnit)
      ),
      obj.recipient
    );
  }
}

describe('AssetMinter', function () {
  beforeEach(async function () {
    await deployments.fixture();
  });

  before(async function () {
    mintOptions = {
      from: ethers.constants.AddressZero,
      packId: packId,
      metaDataHash: hash,
      catalystId: catId,
      gemIds: ids,
      quantity: supply,
      rarity: 0,
      to: ethers.constants.AddressZero,
      data: callData,
    };

    mintMultiOptions = {
      from: ethers.constants.AddressZero,
      packId: packId,
      metadataHash: hash,
      gemsQuantities: [0, 0, 0, 0, 0, 0],
      catalystsQuantities: [0, 0, 0, 0, 0],
      assets: [],
      to: ethers.constants.AddressZero,
      data: callData,
    };
  });

  describe('AssetMinter: Mint', function () {
    it('the assetMInterAdmin is set correctly', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {assetMinterAdmin} = await getNamedAccounts();
      const minterAdmin = await assetMinterContract.getAdmin();
      expect(minterAdmin).to.equal(assetMinterAdmin);
    });

    it('Record is created with correct data on minting an NFT', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {
        catalystOwner,
        commonCatalyst,
        powerGem,
      } = await setupGemsAndCatalysts();
      const {assetAttributesRegistry} = await setupAssetAttributesRegistry();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: commonCatalyst, amount: 1, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: powerGem, amount: 1, recipient: catalystOwner},
      ]);

      const assetId = await assetMinterAsCatalystOwner.callStatic.mint(
        catalystOwner,
        mintOptions.packId,
        mintOptions.metaDataHash,
        catalysts[0].catalystId,
        [gems[0].gemId],
        NFT_SUPPLY,
        0,
        catalystOwner,
        mintOptions.data
      );

      await assetMinterAsCatalystOwner.mint(
        catalystOwner,
        mintOptions.packId,
        mintOptions.metaDataHash,
        catalysts[0].catalystId,
        [gems[0].gemId],
        NFT_SUPPLY,
        0,
        catalystOwner,
        mintOptions.data
      );

      const record = await assetAttributesRegistry.getRecord(assetId);
      expect(record.catalystId).to.equal(1);
      expect(record.exists).to.equal(true);
      expect(record.gemIds.length).to.equal(15);
      expect(record.gemIds[0]).to.equal(1);
    });

    it('Transfer event is emitted on minting an NFT', async function () {
      const {assetMinterContract, assetContract} = await setupAssetMinter();
      const {
        catalystOwner,
        rareCatalyst,
        powerGem,
        defenseGem,
      } = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: rareCatalyst, amount: 7, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: powerGem, amount: 7, recipient: catalystOwner},
        {contract: defenseGem, amount: 7, recipient: catalystOwner},
      ]);

      const assetId = await assetMinterAsCatalystOwner.callStatic.mint(
        catalystOwner,
        packId.add(1),
        mintOptions.metaDataHash,
        catalysts[1].catalystId,
        mintOptions.gemIds,
        NFT_SUPPLY,
        0,
        catalystOwner,
        mintOptions.data
      );

      const receipt = await assetMinterAsCatalystOwner.mint(
        catalystOwner,
        packId.add(1),
        mintOptions.metaDataHash,
        catalysts[1].catalystId,
        mintOptions.gemIds,
        NFT_SUPPLY,
        0,
        catalystOwner,
        mintOptions.data
      );

      const mintEvent = await expectEventWithArgs(
        assetContract,
        receipt,
        'Transfer'
      );
      const args = mintEvent.args;

      expect(args[0]).to.be.equal(ethers.constants.AddressZero);
      expect(args[1]).to.be.equal(catalystOwner);
      expect(args[2]).to.be.equal(assetId);
    });

    it('CatalystApplied event is emitted on minting an NFT with a catalyst', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {
        catalystOwner,
        rareCatalyst,
        powerGem,
        defenseGem,
      } = await setupGemsAndCatalysts();
      const {assetAttributesRegistry} = await setupAssetAttributesRegistry();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: rareCatalyst, amount: 7, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: powerGem, amount: 7, recipient: catalystOwner},
        {contract: defenseGem, amount: 7, recipient: catalystOwner},
      ]);

      const metaDataHash = ethers.utils.keccak256('0x11111111');
      const assetId = await assetMinterAsCatalystOwner.callStatic.mint(
        catalystOwner,
        packId,
        metaDataHash,
        mintOptions.catalystId,
        mintOptions.gemIds,
        NFT_SUPPLY,
        0,
        catalystOwner,
        mintOptions.data
      );

      const receipt = await assetMinterAsCatalystOwner.mint(
        catalystOwner,
        packId,
        metaDataHash,
        mintOptions.catalystId,
        mintOptions.gemIds,
        NFT_SUPPLY,
        0,
        catalystOwner,
        mintOptions.data
      );

      const catalystEvent = await expectEventWithArgs(
        assetAttributesRegistry,
        receipt,
        'CatalystApplied'
      );
      const args = catalystEvent.args;

      expect(args[0]).to.be.equal(assetId);
      expect(args[1]).to.be.equal(catalysts[1].catalystId);
      expect(args[2]).to.deep.equal(mintOptions.gemIds);
      expect(args[3]).to.be.equal(receipt.blockNumber + 1);
    });

    it('Catalysts and gems totalSuplies are reduced when added', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {
        legendaryCatalyst,
        defenseGem,
        speedGem,
        magicGem,
        powerGem,
        catalystOwner,
      } = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: legendaryCatalyst, amount: 1, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: powerGem, amount: 1, recipient: catalystOwner},
        {contract: defenseGem, amount: 1, recipient: catalystOwner},
        {contract: speedGem, amount: 1, recipient: catalystOwner},
        {contract: magicGem, amount: 1, recipient: catalystOwner},
      ]);

      const legendaryBalanceBefore = await legendaryCatalyst.balanceOf(
        catalystOwner
      );
      const speedBalanceBefore = await speedGem.balanceOf(catalystOwner);
      const defenseBalanceBefore = await defenseGem.balanceOf(catalystOwner);
      const powerBalanceBefore = await powerGem.balanceOf(catalystOwner);
      const magicBalanceBefore = await magicGem.balanceOf(catalystOwner);
      const legendaryTotalSupplyBefore = await legendaryCatalyst.totalSupply();
      const speedTotalSupplyBefore = await speedGem.totalSupply();
      const defenseTotalSupplyBefore = await defenseGem.totalSupply();
      const powerTotalSupplyBefore = await powerGem.totalSupply();
      const magicTotalSupplyBefore = await magicGem.totalSupply();

      await assetMinterAsCatalystOwner.mint(
        catalystOwner,
        mintOptions.packId,
        mintOptions.metaDataHash,
        catalysts[3].catalystId,
        [gems[2].gemId, gems[3].gemId, gems[0].gemId, gems[1].gemId],
        NFT_SUPPLY,
        0,
        catalystOwner,
        mintOptions.data
      );

      const legendaryBalanceAfter = await legendaryCatalyst.balanceOf(
        catalystOwner
      );
      const speedBalanceAfter = await speedGem.balanceOf(catalystOwner);
      const defenseBalanceAfter = await defenseGem.balanceOf(catalystOwner);
      const powerBalanceAfter = await powerGem.balanceOf(catalystOwner);
      const magicBalanceAfter = await magicGem.balanceOf(catalystOwner);
      const legendaryTotalSupplyAfter = await legendaryCatalyst.totalSupply();
      const speedTotalSupplyAfter = await speedGem.totalSupply();
      const defenseTotalSupplyAfter = await defenseGem.totalSupply();
      const powerTotalSupplyAfter = await powerGem.totalSupply();
      const magicTotalSupplyAfter = await magicGem.totalSupply();

      expect(legendaryBalanceAfter).to.be.equal(
        legendaryBalanceBefore.sub(oneToken)
      );
      expect(speedBalanceAfter).to.be.equal(speedBalanceBefore.sub(oneToken));
      expect(defenseBalanceAfter).to.be.equal(
        defenseBalanceBefore.sub(oneToken)
      );
      expect(powerBalanceAfter).to.be.equal(powerBalanceBefore.sub(oneToken));
      expect(magicBalanceAfter).to.be.equal(magicBalanceBefore.sub(oneToken));
      expect(legendaryTotalSupplyAfter).to.be.equal(
        legendaryTotalSupplyBefore.sub(oneToken)
      );
      expect(speedTotalSupplyAfter).to.be.equal(
        speedTotalSupplyBefore.sub(oneToken)
      );
      expect(defenseTotalSupplyAfter).to.be.equal(
        defenseTotalSupplyBefore.sub(oneToken)
      );
      expect(powerTotalSupplyAfter).to.be.equal(
        powerTotalSupplyBefore.sub(oneToken)
      );
      expect(magicTotalSupplyAfter).to.be.equal(
        magicTotalSupplyBefore.sub(oneToken)
      );
    });
  });

  describe('AssetMinter: MintMultiple', function () {
    it('TransferBatch event is emitted on minting a single FT via mintMultiple', async function () {
      const {
        catalystOwner,
        powerGem,
        commonCatalyst,
      } = await setupGemsAndCatalysts();
      const {assetMinterContract, assetContract} = await setupAssetMinter();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: commonCatalyst, amount: 7, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: powerGem, amount: 7, recipient: catalystOwner},
      ]);

      const assetIds = await assetMinterAsCatalystOwner.callStatic.mintMultiple(
        catalystOwner,
        mintMultiOptions.packId,
        mintMultiOptions.metadataHash,
        [0, 1, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [
          {
            gemIds: [1],
            quantity: FT_SUPPLY,
            catalystId: 1,
          },
        ],
        catalystOwner,
        mintMultiOptions.data
      );

      const receipt = await assetMinterAsCatalystOwner.mintMultiple(
        catalystOwner,
        mintMultiOptions.packId,
        mintMultiOptions.metadataHash,
        [0, 1, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [
          {
            gemIds: [1],
            quantity: FT_SUPPLY,
            catalystId: 1,
          },
        ],
        catalystOwner,
        mintMultiOptions.data
      );

      const mintEvent = await expectEventWithArgs(
        assetContract,
        receipt,
        'TransferBatch'
      );
      const args = mintEvent.args;

      expect(args[0]).to.equal(assetMinterContract.address);
      expect(args[1]).to.equal(ethers.constants.AddressZero);
      expect(args[2]).to.equal(catalystOwner);
      expect(args[3]).to.deep.equal(assetIds);
      expect(args[4]).to.deep.equal([bn(7)]);
    });

    it('TransferBatch event is emitted on minting a multiple FTs', async function () {
      const {
        catalystOwner,
        powerGem,
        defenseGem,
        speedGem,
        commonCatalyst,
        rareCatalyst,
        epicCatalyst,
      } = await setupGemsAndCatalysts();
      const {assetMinterContract, assetContract} = await setupAssetMinter();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: commonCatalyst, amount: 1, recipient: catalystOwner},
        {contract: rareCatalyst, amount: 1, recipient: catalystOwner},
        {contract: epicCatalyst, amount: 1, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: powerGem, amount: 3, recipient: catalystOwner},
        {contract: defenseGem, amount: 2, recipient: catalystOwner},
        {contract: speedGem, amount: 1, recipient: catalystOwner},
      ]);

      const assetIds = await assetMinterAsCatalystOwner.callStatic.mintMultiple(
        catalystOwner,
        mintMultiOptions.packId,
        mintMultiOptions.metadataHash,
        [0, 3, 2, 1, 0, 0],
        [0, 1, 1, 1, 0],
        [
          {
            gemIds: [1],
            quantity: FT_SUPPLY + 1,
            catalystId: 1,
          },
          {
            gemIds: [2, 1],
            quantity: FT_SUPPLY,
            catalystId: 2,
          },
          {
            gemIds: [1, 3, 2],
            quantity: FT_SUPPLY - 1,
            catalystId: 3,
          },
        ],
        catalystOwner,
        mintMultiOptions.data
      );

      const receipt = await assetMinterAsCatalystOwner.mintMultiple(
        catalystOwner,
        mintMultiOptions.packId,
        mintMultiOptions.metadataHash,
        [0, 3, 2, 1, 0, 0],
        [0, 1, 1, 1, 0],
        [
          {
            gemIds: [1],
            quantity: FT_SUPPLY + 1,
            catalystId: 1,
          },
          {
            gemIds: [2, 1],
            quantity: FT_SUPPLY,
            catalystId: 2,
          },
          {
            gemIds: [1, 3, 2],
            quantity: FT_SUPPLY - 1,
            catalystId: 3,
          },
        ],
        catalystOwner,
        mintMultiOptions.data
      );

      const mintEvent = await expectEventWithArgs(
        assetContract,
        receipt,
        'TransferBatch'
      );
      const args = mintEvent.args;

      expect(args[0]).to.equal(assetMinterContract.address);
      expect(args[1]).to.equal(ethers.constants.AddressZero);
      expect(args[2]).to.equal(catalystOwner);
      expect(args[3]).to.deep.equal(assetIds);
      expect(args[4]).to.deep.equal([bn(8), bn(7), bn(6)]);
    });

    it('CatalystApplied event is emitted for each NFT minted with a catalyst', async function () {
      const {
        catalystOwner,
        powerGem,
        defenseGem,
        speedGem,
        commonCatalyst,
        rareCatalyst,
        epicCatalyst,
      } = await setupGemsAndCatalysts();
      const {assetMinterContract} = await setupAssetMinter();
      const {assetAttributesRegistry} = await setupAssetAttributesRegistry();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: commonCatalyst, amount: 1, recipient: catalystOwner},
        {contract: rareCatalyst, amount: 1, recipient: catalystOwner},
        {contract: epicCatalyst, amount: 1, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: powerGem, amount: 3, recipient: catalystOwner},
        {contract: defenseGem, amount: 2, recipient: catalystOwner},
        {contract: speedGem, amount: 1, recipient: catalystOwner},
      ]);

      const assetIds = await assetMinterAsCatalystOwner.callStatic.mintMultiple(
        catalystOwner,
        mintMultiOptions.packId,
        mintMultiOptions.metadataHash,
        [0, 3, 2, 1, 0, 0],
        [0, 1, 1, 1, 0],
        [
          {
            gemIds: [1],
            quantity: NFT_SUPPLY,
            catalystId: 1,
          },
          {
            gemIds: [2, 1],
            quantity: NFT_SUPPLY,
            catalystId: 2,
          },
          {
            gemIds: [1, 3, 2],
            quantity: NFT_SUPPLY,
            catalystId: 3,
          },
        ],
        catalystOwner,
        mintMultiOptions.data
      );

      const receipt = await assetMinterAsCatalystOwner.mintMultiple(
        catalystOwner,
        mintMultiOptions.packId,
        mintMultiOptions.metadataHash,
        [0, 3, 2, 1, 0, 0],
        [0, 1, 1, 1, 0],
        [
          {
            gemIds: [1],
            quantity: NFT_SUPPLY,
            catalystId: 1,
          },
          {
            gemIds: [2, 1],
            quantity: NFT_SUPPLY,
            catalystId: 2,
          },
          {
            gemIds: [1, 3, 2],
            quantity: NFT_SUPPLY,
            catalystId: 3,
          },
        ],
        catalystOwner,
        mintMultiOptions.data
      );

      const testGemIds = [[1], [2, 1], [1, 3, 2]];

      const catalystAppliedEvents = await findEvents(
        assetAttributesRegistry,
        'CatalystApplied',
        receipt.blockHash
      );
      expect(catalystAppliedEvents).to.have.lengthOf(3);

      for (const [i, event] of catalystAppliedEvents.entries()) {
        if (event.args) {
          expect(event.args[0]).to.equal(assetIds[i]);
          expect(event.args[1]).to.be.equal(catalysts[i].catalystId);
          expect(event.args[2]).to.deep.equal(testGemIds[i]);
          expect(event.args[3]).to.be.equal(receipt.blockNumber + 1);
        }
      }
    });

    it('records should be updated correctly for each asset minted', async function () {
      const {
        catalystOwner,
        speedGem,
        magicGem,
        luckGem,
        commonCatalyst,
        rareCatalyst,
      } = await setupGemsAndCatalysts();
      const {assetMinterContract} = await setupAssetMinter();
      const {assetAttributesRegistry} = await setupAssetAttributesRegistry();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: commonCatalyst, amount: 1, recipient: catalystOwner},
        {contract: rareCatalyst, amount: 1, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: speedGem, amount: 1, recipient: catalystOwner},
        {contract: magicGem, amount: 1, recipient: catalystOwner},
        {contract: luckGem, amount: 1, recipient: catalystOwner},
      ]);

      const assetIds = await assetMinterAsCatalystOwner.callStatic.mintMultiple(
        catalystOwner,
        mintMultiOptions.packId,
        mintMultiOptions.metadataHash,
        [0, 0, 0, 1, 1, 1],
        [0, 1, 1, 0, 0],
        [
          {
            gemIds: [5],
            quantity: NFT_SUPPLY,
            catalystId: 1,
          },
          {
            gemIds: [3, 4],
            quantity: NFT_SUPPLY,
            catalystId: 2,
          },
        ],
        catalystOwner,
        mintMultiOptions.data
      );

      const record1Before = await assetAttributesRegistry.getRecord(
        assetIds[0]
      );
      const record2Before = await assetAttributesRegistry.getRecord(
        assetIds[1]
      );
      expect(record1Before.exists).to.equal(false);
      expect(record2Before.exists).to.equal(false);

      await assetMinterAsCatalystOwner.mintMultiple(
        catalystOwner,
        mintMultiOptions.packId,
        mintMultiOptions.metadataHash,
        [0, 0, 0, 1, 1, 1],
        [0, 1, 1, 0, 0],
        [
          {
            gemIds: [5],
            quantity: NFT_SUPPLY,
            catalystId: 1,
          },
          {
            gemIds: [3, 4],
            quantity: NFT_SUPPLY,
            catalystId: 2,
          },
        ],
        catalystOwner,
        mintMultiOptions.data
      );

      const record1After = await assetAttributesRegistry.getRecord(assetIds[0]);
      const record2After = await assetAttributesRegistry.getRecord(assetIds[1]);
      expect(record1After.exists).to.equal(true);
      expect(record1After.catalystId).to.equal(1);
      expect(record1After.gemIds[0]).to.equal(5);
      expect(record2After.exists).to.equal(true);
      expect(record2After.catalystId).to.equal(2);
      expect(record2After.gemIds[0]).to.deep.equal(3);
      expect(record2After.gemIds[1]).to.deep.equal(4);
    });

    it('totalSupply & balance should be reduced for burnt gems & catalysts', async function () {
      const {
        catalystOwner,
        speedGem,
        magicGem,
        luckGem,
        commonCatalyst,
        rareCatalyst,
      } = await setupGemsAndCatalysts();
      const {assetMinterContract} = await setupAssetMinter();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: commonCatalyst, amount: 1, recipient: catalystOwner},
        {contract: rareCatalyst, amount: 1, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: speedGem, amount: 1, recipient: catalystOwner},
        {contract: magicGem, amount: 1, recipient: catalystOwner},
        {contract: luckGem, amount: 1, recipient: catalystOwner},
      ]);

      const commonBalanceBefore = await commonCatalyst.balanceOf(catalystOwner);
      const rareBalanceBefore = await rareCatalyst.balanceOf(catalystOwner);
      const speedBalanceBefore = await speedGem.balanceOf(catalystOwner);
      const magicBalanceBefore = await magicGem.balanceOf(catalystOwner);
      const luckBalanceBefore = await luckGem.balanceOf(catalystOwner);
      const commonSupplyBefore = await commonCatalyst.totalSupply();
      const rareSupplyBefore = await rareCatalyst.totalSupply();
      const speedSupplyBefore = await speedGem.totalSupply();
      const magicSupplyBefore = await magicGem.totalSupply();
      const luckSupplyBefore = await luckGem.totalSupply();

      await assetMinterAsCatalystOwner.mintMultiple(
        catalystOwner,
        mintMultiOptions.packId,
        mintMultiOptions.metadataHash,
        [0, 0, 0, 1, 1, 1],
        [0, 1, 1, 0, 0],
        [
          {
            gemIds: [5],
            quantity: NFT_SUPPLY,
            catalystId: 1,
          },
          {
            gemIds: [3, 4],
            quantity: NFT_SUPPLY,
            catalystId: 2,
          },
        ],
        catalystOwner,
        mintMultiOptions.data
      );

      const commonBalanceAfter = await commonCatalyst.balanceOf(catalystOwner);
      const rareBalanceAfter = await rareCatalyst.balanceOf(catalystOwner);
      const speedBalanceAfter = await speedGem.balanceOf(catalystOwner);
      const magicBalanceAfter = await magicGem.balanceOf(catalystOwner);
      const luckBalanceAfter = await luckGem.balanceOf(catalystOwner);
      const commonSupplyAfter = await commonCatalyst.totalSupply();
      const rareSupplyAfter = await rareCatalyst.totalSupply();
      const speedSupplyAfter = await speedGem.totalSupply();
      const magicSupplyAfter = await magicGem.totalSupply();
      const luckSupplyAfter = await luckGem.totalSupply();

      expect(commonBalanceAfter).to.be.equal(commonBalanceBefore.sub(oneToken));
      expect(rareBalanceAfter).to.be.equal(rareBalanceBefore.sub(oneToken));
      expect(speedBalanceAfter).to.be.equal(speedBalanceBefore.sub(oneToken));
      expect(magicBalanceAfter).to.be.equal(magicBalanceBefore.sub(oneToken));
      expect(luckBalanceAfter).to.be.equal(luckBalanceBefore.sub(oneToken));
      expect(commonSupplyAfter).to.be.equal(commonSupplyBefore.sub(oneToken));
      expect(rareSupplyAfter).to.be.equal(rareSupplyBefore.sub(oneToken));
      expect(speedSupplyAfter).to.be.equal(speedSupplyBefore.sub(oneToken));
      expect(magicSupplyAfter).to.be.equal(magicSupplyBefore.sub(oneToken));
      expect(luckSupplyAfter).to.be.equal(luckSupplyBefore.sub(oneToken));
    });

    it('Extra gems & catalysts passed will be burnt even if not added to asset', async function () {
      const {
        catalystOwner,
        speedGem,
        magicGem,
        luckGem,
        commonCatalyst,
        rareCatalyst,
      } = await setupGemsAndCatalysts();
      const {assetMinterContract} = await setupAssetMinter();
      const {assetAttributesRegistry} = await setupAssetAttributesRegistry();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: commonCatalyst, amount: 1, recipient: catalystOwner},
        {contract: rareCatalyst, amount: 1, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: speedGem, amount: 1, recipient: catalystOwner},
        {contract: magicGem, amount: 1, recipient: catalystOwner},
        {contract: luckGem, amount: 1, recipient: catalystOwner},
      ]);

      const commonBalanceBefore = await commonCatalyst.balanceOf(catalystOwner);
      const rareBalanceBefore = await rareCatalyst.balanceOf(catalystOwner);
      const speedBalanceBefore = await speedGem.balanceOf(catalystOwner);
      const magicBalanceBefore = await magicGem.balanceOf(catalystOwner);
      const luckBalanceBefore = await luckGem.balanceOf(catalystOwner);
      const commonSupplyBefore = await commonCatalyst.totalSupply();
      const rareSupplyBefore = await rareCatalyst.totalSupply();
      const speedSupplyBefore = await speedGem.totalSupply();
      const magicSupplyBefore = await magicGem.totalSupply();
      const luckSupplyBefore = await luckGem.totalSupply();

      const receipt = await assetMinterAsCatalystOwner.mintMultiple(
        catalystOwner,
        mintMultiOptions.packId,
        mintMultiOptions.metadataHash,
        [0, 0, 0, 1, 1, 1],
        [0, 1, 1, 0, 0],
        [
          {
            gemIds: [3],
            quantity: NFT_SUPPLY,
            catalystId: 1,
          },
        ],
        catalystOwner,
        mintMultiOptions.data
      );

      const catalystAppliedEvents = await findEvents(
        assetAttributesRegistry,
        'CatalystApplied',
        receipt.blockHash
      );

      expect(catalystAppliedEvents.length).to.equal(1);
      let assetId;
      if (catalystAppliedEvents[0].args) {
        assetId = catalystAppliedEvents[0].args[0];
      }
      const record = await assetAttributesRegistry.getRecord(assetId);

      expect(record.catalystId).to.equal(1);
      expect(record.gemIds).to.deep.equal([3].concat(new Array(14).fill(0)));

      const commonBalanceAfter = await commonCatalyst.balanceOf(catalystOwner);
      const rareBalanceAfter = await rareCatalyst.balanceOf(catalystOwner);
      const speedBalanceAfter = await speedGem.balanceOf(catalystOwner);
      const magicBalanceAfter = await magicGem.balanceOf(catalystOwner);
      const luckBalanceAfter = await luckGem.balanceOf(catalystOwner);
      const commonSupplyAfter = await commonCatalyst.totalSupply();
      const rareSupplyAfter = await rareCatalyst.totalSupply();
      const speedSupplyAfter = await speedGem.totalSupply();
      const magicSupplyAfter = await magicGem.totalSupply();
      const luckSupplyAfter = await luckGem.totalSupply();

      expect(commonBalanceAfter).to.be.equal(commonBalanceBefore.sub(oneToken));
      expect(rareBalanceAfter).to.be.equal(rareBalanceBefore.sub(oneToken));
      expect(speedBalanceAfter).to.be.equal(speedBalanceBefore.sub(oneToken));
      expect(magicBalanceAfter).to.be.equal(magicBalanceBefore.sub(oneToken));
      expect(luckBalanceAfter).to.be.equal(luckBalanceBefore.sub(oneToken));
      expect(commonSupplyAfter).to.be.equal(commonSupplyBefore.sub(oneToken));
      expect(rareSupplyAfter).to.be.equal(rareSupplyBefore.sub(oneToken));
      expect(speedSupplyAfter).to.be.equal(speedSupplyBefore.sub(oneToken));
      expect(magicSupplyAfter).to.be.equal(magicSupplyBefore.sub(oneToken));
      expect(luckSupplyAfter).to.be.equal(luckSupplyBefore.sub(oneToken));
    });
  });

  describe('AssetMinter: addGems', function () {
    it('Can extract an erc721 & add Gems', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {
        assetUpgraderContract,
        assetContract,
        assetAttributesRegistry,
        assetAttributesRegistryAdmin,
      } = await setupAssetUpgrader();
      const {
        sandContract,
        legendaryCatalyst,
        defenseGem,
        speedGem,
        magicGem,
        powerGem,
        catalystOwner,
      } = await setupGemsAndCatalysts();
      await transferSand(
        sandContract,
        catalystOwner,
        BigNumber.from(100000).mul(`1000000000000000000`)
      );
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: legendaryCatalyst, amount: 7, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: powerGem, amount: 7, recipient: catalystOwner},
        {contract: defenseGem, amount: 7, recipient: catalystOwner},
        {contract: speedGem, amount: 7, recipient: catalystOwner},
        {contract: magicGem, amount: 7, recipient: catalystOwner},
      ]);

      const assetUpgraderAsAssetOwner = await assetUpgraderContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );
      const assetAsAssetOwner = await assetContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await waitFor(
        assetAttributesRegistry
          .connect(ethers.provider.getSigner(assetAttributesRegistryAdmin))
          .changeMinter(assetMinterContract.address)
      );

      const assetId = await assetMinterAsCatalystOwner.callStatic.mint(
        catalystOwner,
        mintOptions.packId,
        mintOptions.metaDataHash,
        catalysts[3].catalystId,
        [],
        FT_SUPPLY,
        mintOptions.rarity,
        catalystOwner,
        mintOptions.data
      );

      await assetMinterAsCatalystOwner.mint(
        catalystOwner,
        mintOptions.packId,
        mintOptions.metaDataHash,
        catalysts[3].catalystId,
        [],
        FT_SUPPLY,
        mintOptions.rarity,
        catalystOwner,
        mintOptions.data
      );

      const receipt = await waitFor(
        assetAsAssetOwner.extractERC721From(
          catalystOwner,
          assetId,
          catalystOwner
        )
      );
      const extractionEvent = await expectEventWithArgs(
        assetContract,
        receipt,
        'Extraction'
      );
      const newId = extractionEvent.args[1];
      const gemIds = [
        gems[0].gemId,
        gems[1].gemId,
        gems[2].gemId,
        gems[3].gemId,
      ];

      await waitFor(
        assetUpgraderAsAssetOwner.addGems(
          catalystOwner,
          newId,
          gemIds,
          catalystOwner
        )
      );

      const record = await assetAttributesRegistry.getRecord(newId);
      expect(record.exists).to.equal(true);
      expect(record.catalystId).to.equal(catalysts[3].catalystId);
      expect(record.gemIds).to.deep.equal([
        ...gemIds,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ]);
    });
  });

  describe('AssetMinter: Failures', function () {
    it('should fail if "to" == address(0)', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {catalystOwner} = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );
      await expect(
        assetMinterAsCatalystOwner.mint(
          catalystOwner,
          mintOptions.packId,
          mintOptions.metaDataHash,
          mintOptions.catalystId,
          mintOptions.gemIds,
          mintOptions.quantity,
          mintOptions.rarity,
          mintOptions.to,
          mintOptions.data
        )
      ).to.be.revertedWith('INVALID_TO_ZERO_ADDRESS');
    });

    it('should fail if "from" != msg.sender && processorType == 0', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {catalystOwner} = await setupGemsAndCatalysts();
      const {assetMinterAdmin} = await getNamedAccounts();
      const users = await getUnnamedAccounts();
      const assetMinterAsAdmin = await assetMinterContract.connect(
        ethers.provider.getSigner(assetMinterAdmin)
      );
      await assetMinterAsAdmin.setMetaTransactionProcessor(users[9], 0);
      const assetMinterAsMetaTxProcessor = await assetMinterContract.connect(
        ethers.provider.getSigner(users[9])
      );
      await expect(
        assetMinterAsMetaTxProcessor.mint(
          catalystOwner,
          mintOptions.packId,
          mintOptions.metaDataHash,
          mintOptions.catalystId,
          mintOptions.gemIds,
          mintOptions.quantity,
          mintOptions.rarity,
          catalystOwner,
          mintOptions.data
        )
      ).to.be.revertedWith('AUTH_ACCESS_DENIED');
    });

    it('should fail if processorType == METATX_2771 && "from" != _forceMsgSender()', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {catalystOwner} = await setupGemsAndCatalysts();
      const {assetMinterAdmin} = await getNamedAccounts();
      const users = await getUnnamedAccounts();
      const assetMinterAsAdmin = await assetMinterContract.connect(
        ethers.provider.getSigner(assetMinterAdmin)
      );
      await assetMinterAsAdmin.setMetaTransactionProcessor(
        users[9],
        METATX_2771
      );
      const assetMinterAsMetaTxProcessor = await assetMinterContract.connect(
        ethers.provider.getSigner(users[9])
      );
      await expect(
        assetMinterAsMetaTxProcessor.mint(
          catalystOwner,
          mintOptions.packId,
          mintOptions.metaDataHash,
          mintOptions.catalystId,
          mintOptions.gemIds,
          mintOptions.quantity,
          mintOptions.rarity,
          catalystOwner,
          mintOptions.data
        )
      ).to.be.revertedWith('AUTH_ACCESS_DENIED');
    });

    it('should fail if gem == Gem(0)', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {catalystOwner} = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );
      await expect(
        assetMinterAsCatalystOwner.mint(
          catalystOwner,
          mintOptions.packId,
          mintOptions.metaDataHash,
          mintOptions.catalystId,
          [0, gems[1].gemId],
          mintOptions.quantity,
          mintOptions.rarity,
          catalystOwner,
          mintOptions.data
        )
      ).to.be.revertedWith('GEM_DOES_NOT_EXIST');
    });

    it('should fail if gemIds.length > MAX_NUM_GEMS', async function () {
      const {
        catalystOwner,
        rareCatalyst,
        luckGem,
      } = await setupGemsAndCatalysts();
      const {assetMinterContract} = await setupAssetMinter();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: rareCatalyst, amount: 1, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: luckGem, amount: 17, recipient: catalystOwner},
      ]);

      await expect(
        assetMinterAsCatalystOwner.mint(
          catalystOwner,
          mintOptions.packId,
          mintOptions.metaDataHash,
          mintOptions.catalystId,
          new Array(17).fill(5),
          mintOptions.quantity,
          mintOptions.rarity,
          catalystOwner,
          mintOptions.data
        )
      ).to.be.revertedWith('GEMS_MAX_REACHED');
    });

    it('should fail if gemIds.length > maxGems', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {
        catalystOwner,
        commonCatalyst,
        powerGem,
        defenseGem,
      } = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: commonCatalyst, amount: 1, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: powerGem, amount: 2, recipient: catalystOwner},
        {contract: defenseGem, amount: 1, recipient: catalystOwner},
      ]);

      await expect(
        assetMinterAsCatalystOwner.mint(
          catalystOwner,
          packId,
          mintOptions.metaDataHash,
          [catalysts[0].catalystId],
          [gems[0].gemId, gems[0].gemId, gems[1].gemId],
          NFT_SUPPLY,
          0,
          catalystOwner,
          mintOptions.data
        )
      ).to.be.revertedWith('GEMS_TOO_MANY');
    });

    it('mintMultiple should fail if assets.length == 0', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {catalystOwner} = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );
      await expect(
        assetMinterAsCatalystOwner.mintMultiple(
          catalystOwner,
          mintMultiOptions.packId,
          mintMultiOptions.metadataHash,
          mintMultiOptions.gemsQuantities,
          mintMultiOptions.catalystsQuantities,
          [],
          catalystOwner,
          mintMultiOptions.data
        )
      ).to.be.revertedWith('INVALID_0_ASSETS');
    });

    it('mintMultiple should fail if catalystsQuantities == 0', async function () {
      const {
        catalystOwner,
        powerGem,
        speedGem,
        commonCatalyst,
        rareCatalyst,
      } = await setupGemsAndCatalysts();
      const {assetMinterContract} = await setupAssetMinter();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: commonCatalyst, amount: 1, recipient: catalystOwner},
        {contract: rareCatalyst, amount: 1, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: powerGem, amount: 1, recipient: catalystOwner},
        {contract: speedGem, amount: 1, recipient: catalystOwner},
      ]);

      await expect(
        assetMinterAsCatalystOwner.mintMultiple(
          catalystOwner,
          mintMultiOptions.packId,
          mintMultiOptions.metadataHash,
          [0, 1, 0, 1, 0, 0],
          [0, 0, 0, 0, 0],
          [
            {
              gemIds: [1],
              quantity: 1,
              catalystId: 1,
            },
            {
              gemIds: [3],
              quantity: 1,
              catalystId: 2,
            },
          ],
          catalystOwner,
          mintMultiOptions.data
        )
      ).to.be.revertedWith('INVALID_CATALYST_NOT_ENOUGH');
    });

    it('mintMultiple should fail if gemsQuantities == 0', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {catalystOwner} = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );
      await expect(
        assetMinterAsCatalystOwner.mintMultiple(
          catalystOwner,
          mintMultiOptions.packId,
          mintMultiOptions.metadataHash,
          [],
          mintMultiOptions.catalystsQuantities,
          mintMultiOptions.assets,
          catalystOwner,
          mintMultiOptions.data
        )
      ).to.be.revertedWith('INVALID_0_ASSETS');
    });

    it('mintMultiple should fail if trying to add too many gems', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {catalystOwner} = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );
      await expect(
        assetMinterAsCatalystOwner.mintMultiple(
          catalystOwner,
          mintMultiOptions.packId,
          mintMultiOptions.metadataHash,
          [0, 3, 0, 0, 0, 0],
          [0, 1, 0, 0, 0],
          [
            {
              gemIds: [1, 1, 1],
              quantity: 1,
              catalystId: 1,
            },
          ],
          catalystOwner,
          mintMultiOptions.data
        )
      ).to.be.revertedWith('INVALID_GEMS_TOO_MANY');
    });

    it('mintMultiple should fail if trying to add too few gems', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {catalystOwner} = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );
      await expect(
        assetMinterAsCatalystOwner.mintMultiple(
          catalystOwner,
          mintMultiOptions.packId,
          mintMultiOptions.metadataHash,
          [0, 1, 0, 0, 0, 0],
          [0, 0, 1, 0, 0],
          [
            {
              gemIds: [1, 1],
              quantity: 1,
              catalystId: 2,
            },
          ],
          catalystOwner,
          mintMultiOptions.data
        )
      ).to.be.revertedWith('INVALID_GEMS_NOT_ENOUGH');
    });

    it('should fail if gemsQuantities.length != 5', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {catalystOwner} = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );
      await expect(
        assetMinterAsCatalystOwner.mintMultiple(
          catalystOwner,
          mintMultiOptions.packId,
          mintMultiOptions.metadataHash,
          [0, 2],
          [0, 1, 0, 0, 0],
          [
            {
              gemIds: [5],
              quantity: 1,
              catalystId: 1,
            },
          ],
          catalystOwner,
          mintMultiOptions.data
        )
      ).to.be.reverted; // Error: VM Exception while processing transaction: invalid opcode
    });
    it('should fail if catalystsQuantities.length != 4', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {catalystOwner} = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await expect(
        assetMinterAsCatalystOwner.mintMultiple(
          catalystOwner,
          mintMultiOptions.packId,
          mintMultiOptions.metadataHash,
          [0, 2, 0, 0, 0],
          [0, 1],
          [
            {
              gemIds: [5],
              quantity: 1,
              catalystId: 1,
            },
          ],
          catalystOwner,
          mintMultiOptions.data
        )
      ).to.be.reverted; // Error: VM Exception while processing transaction: invalid opcode
    });

    it('should fail if gemsQuantities are out of order', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {catalystOwner} = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );
      await expect(
        assetMinterAsCatalystOwner.mintMultiple(
          catalystOwner,
          mintMultiOptions.packId,
          mintMultiOptions.metadataHash,
          [1, 0, 0, 0, 0],
          [0, 1, 0, 0, 0],
          [
            {
              gemIds: [1],
              quantity: 1,
              catalystId: 1,
            },
          ],
          catalystOwner,
          mintMultiOptions.data
        )
      ).to.be.revertedWith('INVALID_GEMS_NOT_ENOUGH');
    });
    it('should fail if catalystsQuantities are out of order', async function () {
      const {assetMinterContract} = await setupAssetMinter();
      const {catalystOwner} = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );
      await expect(
        assetMinterAsCatalystOwner.mintMultiple(
          catalystOwner,
          mintMultiOptions.packId,
          mintMultiOptions.metadataHash,
          [0, 1, 0, 0, 0, 0],
          [1, 0, 0, 0],
          [
            {
              gemIds: [1],
              quantity: 1,
              catalystId: 1,
            },
          ],
          catalystOwner,
          mintMultiOptions.data
        )
      ).to.be.revertedWith('INVALID_CATALYST_NOT_ENOUGH');
    });

    it('mintMultiple should not set catalyst if catalystId == 0', async function () {
      const {assetMinterContract, assetContract} = await setupAssetMinter();
      const {assetAttributesRegistry} = await setupAssetAttributesRegistry();
      const {
        commonCatalyst,
        powerGem,
        catalystOwner,
      } = await setupGemsAndCatalysts();
      const assetMinterAsCatalystOwner = await assetMinterContract.connect(
        ethers.provider.getSigner(catalystOwner)
      );

      await mintCats([
        {contract: commonCatalyst, amount: 2, recipient: catalystOwner},
      ]);
      await mintGems([
        {contract: powerGem, amount: 2, recipient: catalystOwner},
      ]);

      const staticIds = await assetMinterAsCatalystOwner.callStatic.mintMultiple(
        catalystOwner,
        mintMultiOptions.packId,
        mintMultiOptions.metadataHash,
        [0, 1, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [
          {
            gemIds: [1],
            quantity: 1,
            catalystId: 0,
          },
        ],
        catalystOwner,
        mintMultiOptions.data
      );

      const assetId = staticIds[0];

      const receipt = await assetMinterAsCatalystOwner.mintMultiple(
        catalystOwner,
        mintMultiOptions.packId,
        mintMultiOptions.metadataHash,
        [0, 1, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [
          {
            gemIds: [1],
            quantity: 1,
            catalystId: 0,
          },
        ],
        catalystOwner,
        mintMultiOptions.data
      );

      const {
        exists,
        catalystId,
        gemIds,
      } = await assetAttributesRegistry.getRecord(assetId);
      const assetOwner = await assetContract.ownerOf(assetId);
      expect(exists).to.be.equal(false);
      expect(catalystId).to.be.equal(0);
      expect(gemIds).to.deep.equal(emptyRecordGemIds);
      expect(assetOwner).to.be.equal(catalystOwner);

      const mintMultiEvent = await expectEventWithArgs(
        assetContract,
        receipt,
        'TransferBatch'
      );
      const args = mintMultiEvent.args;

      expect(args[0]).to.be.equal(assetMinterContract.address);
      expect(args[1]).to.be.equal(ethers.constants.AddressZero);
      expect(args[2]).to.be.equal(catalystOwner);
      expect(args[3]).to.deep.equal(staticIds);
      expect(args[4]).to.deep.equal([BigNumber.from(1)]);
    });
  });
});
