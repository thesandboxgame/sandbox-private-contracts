import {ethers} from 'hardhat';
import {read} from '../utils/spreadsheet';

async function main() {
  const provider = ethers.provider;
  const AssetAddress = '0xa342f5d851e866e18ff98f351f2c6637f4478db5';
  const AssetId =
    '55464657044963196816950587289035428064568320970692304673817341489687556012034';

  const data: Array<string[]> = await read(
    {
      document: '1aSFdWvHpQEQrUu6eRVRNfVan8-OVILS16ft6uowhX5c',
      sheet: 'MetalympicReward',
    },
    'D3:D288'
  );

  const cleanedData: string[] = [];

  data.map((val) => cleanedData.push(val[0]));

  const ids: string[] = [];
  const amounts: number[] = [];

  const resolvedAdd = async (address: string) => {
    if (!address.match(/^0x[a-fA-F0-9]{40}$/g)) {
      return provider.resolveName(address);
    }
    return address;
  };

  const script = async () =>
    Promise.all(cleanedData.map((add) => resolvedAdd(add)));

  script()
    .then((arrayResolvedAddress) => {
      arrayResolvedAddress.map(() => {
        ids.push(AssetId);
        amounts.push(1);
      });
      console.log(`
        execute the following on 0xc653e1b3a971078812a72d11c45ad71e00f3ad1f (MultiSender)

        function: send1155ToAddresses

        args:

       - ${arrayResolvedAddress.join(',')}

       - ${ids.join(',')}

       - ${amounts.join(',')}

       - ${AssetAddress}
      `);
    })
    .catch((err) => console.log(err));
}

main();
