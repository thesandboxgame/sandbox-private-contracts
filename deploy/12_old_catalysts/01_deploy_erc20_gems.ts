import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';

const func: DeployFunction = async function (hre) {
  const {deployments, getNamedAccounts, ethers} = hre;
  const {execute, deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  const sand = await deployments.get('Sand');

  const gemGroup = await deploy('OldGems', {
    contract: 'ERC20GroupGem',
    from: deployer,
    log: true,
    args: [
      sand.address, // metatx
      deployer,
      deployer,
    ],
  });
  async function addGems(names: string[]) {
    const gems = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const contractName = `Old_${name}Gem`;
      const tokenSymbol = name.toUpperCase();
      const result = await deploy(contractName, {
        contract: 'ERC20SubToken',
        from: deployer,
        log: true,
        args: [
          gemGroup.address,
          i,
          `Sandbox's ${tokenSymbol} Gems`,
          tokenSymbol,
        ],
      });
      gems.push(result.address);
    }
    const contract = await ethers.getContract('OldGems');
    const filter = contract.filters['SubToken']();
    const res = await contract.queryFilter(filter);
    if (res.length === 0) {
      return execute('OldGems', {from: deployer}, 'addGems', gems);
    } else {
      console.log('Gems already setup');
    }
  }
  await addGems(['Power', 'Defense', 'Speed', 'Magic', 'Luck']);
};
export default func;
func.tags = ['OldGems', 'OldGems_deploy'];
func.dependencies = ['Sand'];
// comment to deploy old system
func.skip = skipUnlessTest; // not meant to be redeployed
