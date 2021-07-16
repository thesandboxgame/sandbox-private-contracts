import {BigNumber} from 'ethers';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';
import {sandWei} from '../../utils/units';

const catalysts = [
  {
    name: 'Common',
    symbol: 'COMMON',
    sandMintingFee: sandWei(1),
    sandUpdateFee: sandWei(1),
    maxGems: 1,
    quantityRange: [4000, 20000],
  },
  {
    name: 'Rare',
    symbol: 'RARE',
    sandMintingFee: sandWei(4),
    sandUpdateFee: sandWei(4),
    maxGems: 2,
    quantityRange: [1500, 4000],
  },
  {
    name: 'Epic',
    symbol: 'EPIC',
    sandMintingFee: sandWei(10),
    sandUpdateFee: sandWei(10),
    maxGems: 3,
    quantityRange: [200, 1500],
  },
  {
    name: 'Legendary',
    symbol: 'LEGENDARY',
    sandMintingFee: sandWei(200),
    sandUpdateFee: sandWei(200),
    maxGems: 4,
    quantityRange: [1, 200],
  },
];

const func: DeployFunction = async function (hre) {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {execute, deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  const sand = await deployments.get('Sand');

  const catalystGroup = await deploy('OldCatalysts', {
    contract: 'ERC20GroupCatalyst',
    from: deployer,
    log: true,
    args: [
      sand.address, // metatx
      deployer,
      deployer,
    ],
  });
  async function addCatalysts(
    catalystData: {
      name: string;
      symbol: string;
      sandMintingFee: BigNumber;
      sandUpdateFee: BigNumber;
      quantityRange: number[];
      maxGems: number;
    }[]
  ) {
    const erc20s = [];
    const data = [];
    for (let i = 0; i < catalystData.length; i++) {
      const catalyst = catalystData[i];
      const deploymentName = `Old_${catalyst.name}Catalyst`;
      const tokenSymbol = catalyst.symbol;
      const result = await deploy(deploymentName, {
        contract: 'ERC20SubToken',
        from: deployer,
        log: true,
        args: [
          catalystGroup.address,
          i,
          `Sandbox's ${tokenSymbol} Catalysts`,
          tokenSymbol,
        ],
      });
      erc20s.push(result.address);
      data.push({
        sandMintingFee: catalyst.sandMintingFee,
        sandUpdateFee: catalyst.sandUpdateFee,
        minQuantity: catalyst.quantityRange[0],
        maxQuantity: catalyst.quantityRange[1],
        maxGems: catalyst.maxGems,
      });
    }
    const contract = await ethers.getContract('OldCatalysts');
    const filter = contract.filters['SubToken']();
    const res = await contract.queryFilter(filter);
    if (res.length === 0) {
      return execute(
        'OldCatalysts',
        {from: deployer},
        'addCatalysts',
        erc20s,
        data,
        []
      );
    } else {
      console.log('Catalyst already setup');
    }
  }
  await addCatalysts(catalysts);
};
export default func;
func.tags = ['OldCatalysts', 'OldCatalysts_deploy'];
func.dependencies = ['Sand'];
// comment to deploy old system
func.skip = skipUnlessTest; // not meant to be redeployed
