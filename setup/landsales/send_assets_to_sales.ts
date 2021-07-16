import hre from 'hardhat';
import {getLandSaleFiles} from '../../data/landSales/getLandSales';
import {BigNumber} from '@ethersproject/bignumber';

const {deployments} = hre;
const {read, execute, catchUnknownSigner} = deployments;

const args = process.argv.slice(2);
const landSalePrefix = args[0];

(async () => {
  const networkName = hre.network.name;
  const {sectors, bundles} = await getLandSaleFiles(
    landSalePrefix,
    networkName
  );

  for (const sector of sectors) {
    const assetIdsCount: {[assetId: string]: number} = {};
    const countBundleId = (bundleId?: string) => {
      if (bundleId && bundleId !== '') {
        const bundle = bundles[bundleId];
        for (const assetId of bundle) {
          assetIdsCount[assetId] = (assetIdsCount[assetId] || 0) + 1;
        }
      }
    };

    for (const land of sector.lands) {
      countBundleId(land.bundleId);
    }
    for (const estate of sector.estates) {
      countBundleId(estate.bundleId);
    }

    const landSaleName = `${landSalePrefix}_${sector.sector}`;

    console.log({landSaleName});

    const presale = await deployments.get(landSaleName);
    const owner =
      networkName === 'mainnet'
        ? '0x7A9fe22691c811ea339D9B73150e6911a5343DcA'
        : '0x5BC3D5A39a50BE2348b9C529f81aE79f00945897';
    const ids = [];
    const values = [];
    for (const assetId of Object.keys(assetIdsCount)) {
      const balance: BigNumber = await read(
        'Asset',
        'balanceOf(address,uint256)',
        presale.address,
        assetId
      );
      const assetCount = BigNumber.from(assetIdsCount[assetId]);
      if (balance.lt(assetCount)) {
        ids.push(assetId);
        values.push(assetCount.sub(balance).toNumber());
      }
    }
    if (ids.length > 0) {
      console.log(landSaleName, JSON.stringify(assetIdsCount, null, '  '));

      await catchUnknownSigner(
        execute(
          'Asset',
          {from: owner, log: true},
          'safeBatchTransferFrom',
          owner,
          presale.address,
          ids,
          values,
          '0x'
        )
      );
    }
  }
})();
