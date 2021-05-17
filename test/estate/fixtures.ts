import {ethers, deployments, getUnnamedAccounts} from 'hardhat';
import {waitFor} from '../utils';
import {EstateTestHelper} from './estateTestHelper';

export const setupEstate = deployments.createFixture(async function () {
  await deployments.fixture(['ChildEstateToken']);
  const others = await getUnnamedAccounts();
  const minter = others[4];
  const user0 = others[0];
  const user1 = others[2];
  const estateContract = await ethers.getContract('ChildEstateToken', minter);
  const landContract = await ethers.getContract('ChildLandToken');
  const landAdmin = await landContract.callStatic.getAdmin();
  const landContractAsMinter = await landContract.connect(
    ethers.provider.getSigner(minter)
  );
  await waitFor(
    landContract
      .connect(ethers.provider.getSigner(landAdmin))
      .setMinter(minter, true)
  );

  await waitFor(
    landContract
      .connect(ethers.provider.getSigner(landAdmin))
      .setSuperOperator(estateContract.address, true)
  );

  return {
    estateContract,
    landContractAsMinter,
    minter,
    user0,
    user1,
    // @note need to pass the mainnet Land contract to estateTestHelper for it to work
    helper: new EstateTestHelper({
      Estate: estateContract,
      LandFromMinter: landContractAsMinter,
      Land: landContract,
    }),
  };
});
