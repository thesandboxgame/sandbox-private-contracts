import 'dotenv/config';
import {isAddress} from '@ethersproject/address';
import fs from 'fs';
import {read} from '../utils/spreadsheet';

(async () => {
  const data: Array<string[]> = await read(
    {
      document: '1aSFdWvHpQEQrUu6eRVRNfVan8-OVILS16ft6uowhX5c',
      sheet: 'Mission #2',
    },
    'E2:E1530'
  );

  const accountsToReward: string[] = [...new Set(data.map((v) => v[0]))]
    .map((v) => v.trim())
    .filter((v) => {
      const isValid = isAddress(v);
      if (!isValid) {
        console.log(`Invalid address:  ${v}`);
      }
      return isValid;
    });

  const assetClaims = [];
  for (const accountToReward of accountsToReward) {
    assetClaims.push({
      reservedAddress: accountToReward,
      assetIds: [
        '55464657044963196816950587289035428064568320970692304673817341489687556012032',
      ],
      assetValues: [1],
    });
  }
  fs.writeFileSync(
    'data/giveaways/asset_giveaway_4/assets_mainnet.json',
    JSON.stringify(assetClaims, null, '  ')
  );
})();
