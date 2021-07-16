import {BigNumber, Contract} from 'ethers';
import {ethers, getNamedAccounts} from 'hardhat';
import {Receipt} from 'hardhat-deploy/types';
import {waitFor} from '../../../scripts/utils/utils';
import {findEvents} from '../../utils';

export async function mintAsset(
  creator: string,
  packId: BigNumber,
  hash: string,
  supply: number | BigNumber,
  rarity: number,
  owner: string,
  callData: Buffer
): Promise<BigNumber> {
  const {assetBouncerAdmin} = await getNamedAccounts();
  const assetContract = await ethers.getContract('Asset');

  await waitFor(
    assetContract
      .connect(ethers.provider.getSigner(assetBouncerAdmin))
      .setBouncer(assetBouncerAdmin, true)
  );

  const assetId = await assetContract
    .connect(ethers.provider.getSigner(assetBouncerAdmin))
    .callStatic.mint(creator, packId, hash, supply, rarity, owner, callData);

  await waitFor(
    assetContract
      .connect(ethers.provider.getSigner(assetBouncerAdmin))
      .mint(creator, packId, hash, supply, rarity, owner, callData)
  );
  return assetId;
}
export async function changeCatalyst(
  assetUpgraderContract: Contract,
  from: string,
  assetId: BigNumber,
  catalystId: string,
  gemsIds: string[],
  to: string
): Promise<void> {
  await waitFor(
    assetUpgraderContract
      .connect(ethers.provider.getSigner(from))
      .changeCatalyst(from, assetId, catalystId, gemsIds, to)
  );
}
export async function transferSand(
  sandContract: Contract,
  to: string,
  amount: BigNumber
): Promise<void> {
  const {sandBeneficiary} = await getNamedAccounts();
  await waitFor(
    sandContract
      .connect(ethers.provider.getSigner(sandBeneficiary))
      .transfer(to, amount)
  );
}
export async function mintCatalyst(
  catalystContract: Contract,
  mintingAmount: BigNumber,
  beneficiary: string
): Promise<void> {
  const {catalystMinter} = await getNamedAccounts();

  await waitFor(
    catalystContract
      .connect(ethers.provider.getSigner(catalystMinter))
      .mint(beneficiary, mintingAmount)
  );
}
export async function mintGem(
  gemContract: Contract,
  mintingAmount: BigNumber,
  beneficiary: string
): Promise<void> {
  const {gemMinter} = await getNamedAccounts();

  await waitFor(
    gemContract
      .connect(ethers.provider.getSigner(gemMinter))
      .mint(beneficiary, mintingAmount)
  );
}

class GemEvent {
  gemIds: number[];
  blockHash: string;
  constructor(ids: number[], hash: string) {
    this.gemIds = ids;
    this.blockHash = hash;
  }
}

class ReceiptObject {
  receipt: Receipt;
  type: number;
  constructor(rec: Receipt, _type: number) {
    this.receipt = rec;
    this.type = _type;
  }
}

async function getGemEvent(ids: number[], hash: string): Promise<GemEvent> {
  return new GemEvent(ids, hash);
}

export async function getReceiptObject(
  receipt: Receipt,
  type: number
): Promise<ReceiptObject> {
  return new ReceiptObject(receipt, type);
}

interface AttributesObj {
  assetId: BigNumber;
  gemEvents: GemEvent[];
}

export async function prepareGemEventData(
  registry: Contract,
  receiptObjects: ReceiptObject[]
): Promise<AttributesObj> {
  const mintReceipt = receiptObjects[0].receipt;
  const mintEvents = await findEvents(
    registry,
    'CatalystApplied',
    mintReceipt.blockHash
  );
  const args = mintEvents[0].args;
  const assetId = args ? args[0] : null;
  const gemEvents: GemEvent[] = [];

  for (const obj of receiptObjects) {
    // mint || ChangeCatalyst
    if (obj.type == 1 || obj.type == 2) {
      const events = await findEvents(
        registry,
        'CatalystApplied',
        obj.receipt.blockHash
      );
      if (events.length != 1) {
        console.log('Longer than 1 ! Need to fix prepareGemEventData()');
      } else {
        let gemEvent: GemEvent;
        if (events[0].args) {
          gemEvent = await getGemEvent(
            events[0].args[2],
            obj.receipt.blockHash
          );
          gemEvents.push(gemEvent);
        }
      }
    }

    // AddGems
    if (obj.type == 3) {
      const events = await findEvents(
        registry,
        'GemsAdded',
        obj.receipt.blockHash
      );
      if (events.length != 1) {
        console.log('Longer than 1 ! Need to fix prepareGemEventData() !');
      } else {
        let gemEvent: GemEvent;
        if (events[0].args) {
          gemEvent = await getGemEvent(
            events[0].args[1],
            obj.receipt.blockHash
          );
          gemEvents.push(gemEvent);
        }
      }
    }
  }

  return {assetId, gemEvents};
}
