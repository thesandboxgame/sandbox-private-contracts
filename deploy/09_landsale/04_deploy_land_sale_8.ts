import {getLandSales, LandSale} from '../../data/landSales/getLandSales';
import deadlines from '../../data/landSales/deadlines';
import fs from 'fs';
import helpers, {SaltedSaleLandInfo} from '../../lib/merkleTreeHelper';
const {calculateLandHash} = helpers;

const LANDSALE_NAME = 'LandPreSale_8';

import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy, read, execute, catchUnknownSigner, log} = deployments;
  const {
    deployer,
    landSaleBeneficiary,
    backendReferralWallet,
    landSaleFeeRecipient,
    landSaleAdmin,
  } = await getNamedAccounts();

  const sandContract = await deployments.get('Sand');
  const landContract = await deployments.get('Land');
  const assetContract = await deployments.get('Asset');

  async function deployLandSale(landSale: LandSale) {
    const {lands, merkleRootHash, saltedLands, tree, sector} = landSale;

    const landSaleName = `${LANDSALE_NAME}_${sector}`;
    let deadline = deadlines[sector];

    if (!deadline) {
      throw new Error(`no deadline for sector ${sector}`);
    }

    if (hre.network.tags.testnet) {
      log('increasing deadline by 1 year');
      deadline += 365 * 24 * 60 * 60; //add 1 year on testnets
    }

    const landSaleDeployment = await deploy(landSaleName, {
      from: deployer,
      linkedData: lands,
      contract: 'EstateSaleWithFee',
      args: [
        landContract.address,
        sandContract.address,
        sandContract.address,
        landSaleAdmin,
        landSaleBeneficiary,
        merkleRootHash,
        deadline,
        backendReferralWallet,
        2000,
        '0x0000000000000000000000000000000000000000',
        assetContract.address,
        landSaleFeeRecipient,
      ],
      skipIfAlreadyDeployed: true,
      log: true,
    });

    if (hre.network.name !== 'hardhat') {
      const landsWithProof: (SaltedSaleLandInfo & {proof: string[]})[] = [];
      for (const land of saltedLands) {
        const proof = tree.getProof(calculateLandHash(land));
        landsWithProof.push({...land, proof});
      }
      fs.writeFileSync(
        `./.proofs_${landSaleName}_${hre.network.name}.json`,
        JSON.stringify(landsWithProof, null, '  ')
      );
    }

    const isMinter = await read('Land', 'isMinter', landSaleDeployment.address);
    if (!isMinter) {
      const currentLandAdmin = await read('Land', 'getAdmin');
      await catchUnknownSigner(
        execute(
          'Land',
          {from: currentLandAdmin, log: true},
          'setMinter',
          landSaleDeployment.address,
          true
        )
      );
    }
  }

  const landSales = await getLandSales(
    LANDSALE_NAME,
    hre.network.name,
    hre.network.live
  );

  for (const landSale of landSales) {
    await deployLandSale(landSale);
  }
};

export default func;
func.tags = [LANDSALE_NAME, LANDSALE_NAME + '_deploy'];
func.dependencies = ['Sand_deploy', 'Land_deploy', 'Asset_deploy'];
