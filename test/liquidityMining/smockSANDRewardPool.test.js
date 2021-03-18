const {
  ethers,
  deployments,
  getNamedAccounts,
  getUnnamedAccounts,
} = require('hardhat');
const {smoddit} = require('@eth-optimism/smock');
const {BigNumber} = require('@ethersproject/bignumber');
const {expect} = require('../chai-setup');
const {mine} = require('../utils');

const STAKE_TOKEN = 'UNI_SAND_ETH';
const REWARD_TOKEN = 'Sand';
const MULTIPLIER_NFToken = 'Land';
const POOL = 'LandWeightedSANDRewardPool';
const REWARD_DURATION = 2592000; // 30 days in seconds
const REWARD_AMOUNT = BigNumber.from(1500000).mul('1000000000000000000');
const ACTUAL_REWARD_AMOUNT = REWARD_AMOUNT.div(REWARD_DURATION).mul(
  REWARD_DURATION
);

const STAKE_AMOUNT = BigNumber.from(10000).mul('1000000000000000000');

// Tests for single stakes but modifying NFT numbers with a modifiable NFT contract

const setupTestRewardPool = deployments.createFixture(async function (
  hre,
  options
) {
  const {supplyRewardTokens, notifyReward} = options || {};
  const {
    deployer,
    sandAdmin,
    liquidityRewardAdmin,
    landAdmin,
    sandBeneficiary,
  } = await getNamedAccounts();

  const others = await getUnnamedAccounts();

  // Get contracts
  const rewardToken = await ethers.getContract(REWARD_TOKEN);
  const multiplierNFToken = await ethers.getContract(MULTIPLIER_NFToken);
  const stakeToken = await ethers.getContract(STAKE_TOKEN);

  // Create modifiable Reward contract using Smoddit
  const modifiableRewardContractFactory = await smoddit(POOL);

  const modifiableRewardContract = await modifiableRewardContractFactory.deploy(
    stakeToken.address,
    rewardToken.address,
    multiplierNFToken.address,
    2592000
  );

  // Function to modify user's staked balance in Reward Contract
  // async function setUserStakedBalance(stakedBalance, user) {
  //   modifiableRewardContract.smodify.put({
  //     _balances: {
  //       [user]: stakedBalance,
  //     },
  //   });
  //   const userStakedBal = await modifiableRewardContract.balanceOf(user);
  //   expect(userStakedBal).to.equal(stakedBalance);
  // }

  // Create modifiable MockLand contract uing Smoddit
  const modifiableNFTContractFactory = await smoddit('MockLand'); // TODO: MockLand contract works here because the artifact can be found, but ideally we want this to be Land
  const modifiableNFTContract = await modifiableNFTContractFactory.deploy(
    rewardToken.address,
    landAdmin
  );

  // Function to modify user's NFT balance in MockLand Contract
  async function setUserNftBalance(numberOfNfts, user) {
    modifiableNFTContract.smodify.put({
      _numNFTPerAddress: {
        [user]: numberOfNfts,
      },
    });
    const userNftBal = await modifiableNFTContract.balanceOf(user);
    expect(userNftBal).to.equal(numberOfNfts);
  }

  const rewardPoolAsUser = {
    0: modifiableRewardContract.connect(ethers.provider.getSigner(others[0])),
    1: modifiableRewardContract.connect(ethers.provider.getSigner(others[1])),
    2: modifiableRewardContract.connect(ethers.provider.getSigner(others[2])),
  };

  const rewardTokenAdmin = sandAdmin;
  const stakeTokenAdmin = deployer;

  const stakeTokenAsAdmin = stakeToken.connect(
    ethers.provider.getSigner(stakeTokenAdmin)
  );

  const stakeTokenAsUser = {
    0: stakeToken.connect(ethers.provider.getSigner(others[0])),
    1: stakeToken.connect(ethers.provider.getSigner(others[1])),
    2: stakeToken.connect(ethers.provider.getSigner(others[2])),
  };
  const rewardTokenAsAdmin = rewardToken.connect(
    ethers.provider.getSigner(rewardTokenAdmin)
  );

  const rewardPoolAsAdmin = modifiableRewardContract.connect(
    ethers.provider.getSigner(liquidityRewardAdmin)
  );

  // Send reward to pool
  await modifiableRewardContract.setRewardDistribution(liquidityRewardAdmin);

  // Supply pool
  if (supplyRewardTokens === true) {
    await rewardTokenAsAdmin.transfer(
      modifiableRewardContract.address,
      REWARD_AMOUNT
    );
  }

  // Start reward period
  if (notifyReward === true) {
    await rewardPoolAsAdmin.notifyRewardAmount(REWARD_AMOUNT);
  }

  // Give users some stakeTokens
  for (let i = 0; i < 3; i++) {
    await stakeTokenAsAdmin.transfer(others[i], STAKE_AMOUNT.mul(10));
    await stakeTokenAsUser[i].approve(
      modifiableRewardContract.address,
      STAKE_AMOUNT.mul(10)
    );
  }

  return {
    deployer,
    sandAdmin,
    liquidityRewardAdmin,
    landAdmin,
    sandBeneficiary,
    others,
    stakeToken,
    rewardToken,
    modifiableNFTContract,
    modifiableRewardContract,
    rewardPoolAsUser,
    setUserNftBalance,
  };
});
describe.only('SmockitSANDRewardPool', function () {
  it('User earnings for 89 NFTs match expected reward', async function () {
    const {
      setUserNftBalance,
      rewardPoolAsUser,
      stakeToken,
      modifiableRewardContract,
      others,
    } = await setupTestRewardPool(true, true);
    await setUserNftBalance(89, others[0]);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);

    const stakedBalance = await stakeToken.balanceOf(
      modifiableRewardContract.address
    );
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it('User earnings for 1 NFTs match expected reward', async function () {
    const {
      setUserNftBalance,
      rewardPoolAsUser,
      stakeToken,
      modifiableRewardContract,
      others,
    } = await setupTestRewardPool(true, true);
    await setUserNftBalance(1, others[0]);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(
      modifiableRewardContract.address
    );
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it('User earnings for 2 NFTs match expected reward', async function () {
    const {
      setUserNftBalance,
      rewardPoolAsUser,
      stakeToken,
      modifiableRewardContract,
      others,
    } = await setupTestRewardPool(true, true);
    await setUserNftBalance(2, others[0]);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(
      modifiableRewardContract.address
    );
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it('User earnings for 3 NFTs match expected reward', async function () {
    const {
      setUserNftBalance,
      rewardPoolAsUser,
      stakeToken,
      modifiableRewardContract,
      others,
    } = await setupTestRewardPool(true, true);
    await setUserNftBalance(3, others[0]);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(
      modifiableRewardContract.address
    );
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it('User earnings for 500 NFTs match expected reward', async function () {
    const {
      setUserNftBalance,
      rewardPoolAsUser,
      stakeToken,
      modifiableRewardContract,
      others,
    } = await setupTestRewardPool(true, true);
    await setUserNftBalance(500, others[0]);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(
      modifiableRewardContract.address
    );
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it('User earnings for 10000 NFTs match expected reward', async function () {
    const {
      setUserNftBalance,
      rewardPoolAsUser,
      stakeToken,
      modifiableRewardContract,
      others,
    } = await setupTestRewardPool(true, true);
    await setUserNftBalance(10000, others[0]);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(
      modifiableRewardContract.address
    );
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it("Multiple Users' earnings for 1 NFTs match expected reward: 2 users, 1 stake each", async function () {
    const {
      setUserNftBalance,
      rewardPoolAsUser,
      stakeToken,
      modifiableRewardContract,
      others,
    } = await setupTestRewardPool(true, true);
    await setUserNftBalance(1, others[0]);
    await setUserNftBalance(1, others[1]);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    await rewardPoolAsUser[1].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(
      modifiableRewardContract.address
    );
    expect(stakedBalance).to.equal(STAKE_AMOUNT.mul(2));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned0 = await rewardPoolAsUser[0].earned(others[0]);
    const earned1 = await rewardPoolAsUser[1].earned(others[1]);
    const earned = earned0.add(earned1);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it("Multiple Users' earnings for 3 NFTs match expected reward: 2 users, 1 stake each", async function () {
    const {
      setUserNftBalance,
      rewardPoolAsUser,
      stakeToken,
      modifiableRewardContract,
      others,
    } = await setupTestRewardPool(true, true);
    await setUserNftBalance(3, others[0]);
    await setUserNftBalance(3, others[1]);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    await rewardPoolAsUser[1].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(
      modifiableRewardContract.address
    );
    expect(stakedBalance).to.equal(STAKE_AMOUNT.mul(2));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned0 = await rewardPoolAsUser[0].earned(others[0]);
    const earned1 = await rewardPoolAsUser[1].earned(others[1]);
    const earned = earned0.add(earned1);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it("Multiple Users' earnings for 100 NFTs match expected reward: 2 users, 1 stake each", async function () {
    const {
      setUserNftBalance,
      rewardPoolAsUser,
      stakeToken,
      modifiableRewardContract,
      others,
    } = await setupTestRewardPool(true, true);
    await setUserNftBalance(100, others[0]);
    await setUserNftBalance(100, others[1]);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    await rewardPoolAsUser[1].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(
      modifiableRewardContract.address
    );
    expect(stakedBalance).to.equal(STAKE_AMOUNT.mul(2));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned0 = await rewardPoolAsUser[0].earned(others[0]);
    const earned1 = await rewardPoolAsUser[1].earned(others[1]);
    const earned = earned0.add(earned1);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it('Earlier staker gets more rewards with same NFT amount - small NFT number', async function () {
    const {
      setUserNftBalance,
      rewardPoolAsUser,
      others,
    } = await setupTestRewardPool(true, true);
    await setUserNftBalance(1, others[0]);
    await setUserNftBalance(1, others[1]);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    await rewardPoolAsUser[1].stake(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned0 = await rewardPoolAsUser[0].earned(others[0]);
    const earned1 = await rewardPoolAsUser[1].earned(others[1]);
    expect(earned0).to.be.gte(earned1);
    const earned = earned0.add(earned1);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it('Earlier staker gets more rewards with same NFT amount - large NFT number', async function () {
    const {
      setUserNftBalance,
      rewardPoolAsUser,
      others,
    } = await setupTestRewardPool(true, true);
    await setUserNftBalance(100, others[0]);
    await setUserNftBalance(100, others[1]);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    await rewardPoolAsUser[1].stake(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned0 = await rewardPoolAsUser[0].earned(others[0]);
    const earned1 = await rewardPoolAsUser[1].earned(others[1]);
    expect(earned0).to.be.gte(earned1);
    const earned = earned0.add(earned1);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });
});