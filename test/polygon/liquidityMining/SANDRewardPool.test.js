const {
  ethers,
  deployments,
  getNamedAccounts,
  getUnnamedAccounts,
} = require('hardhat');
const {BigNumber} = require('@ethersproject/bignumber');
const {expect} = require('../../chai-setup');
const {mine} = require('../../utils');
const {replicateEarned, replicateRewardPerToken} = require('./_testHelper');
const {contribution} = require('./contributionEquation.test');
const {constants} = require('ethers');
const setupLandWeightedRewardPool = require('../../../setup/send_sand_to_Polygon_land_weighted_reward_pool')
  .default;

const STAKE_TOKEN = 'FakeLPSandMatic';
const REWARD_TOKEN = 'SandBaseToken';
const MULTIPLIER_NFToken = 'Land';
const POOL = 'PolygonLandWeightedSANDRewardPool';
const REWARD_DURATION = 2592000; // 30 days in seconds
const REWARD_AMOUNT = BigNumber.from(1500000).mul('1000000000000000000');
const ACTUAL_REWARD_AMOUNT = REWARD_AMOUNT.div(REWARD_DURATION).mul(
  REWARD_DURATION
);

const NEW_REWARD_AMOUNT = BigNumber.from(2000000).mul('1000000000000000000');
const STAKE_AMOUNT = BigNumber.from(10000).mul('1000000000000000000');
const LESS_PRECISE_STAKE_AMOUNT = BigNumber.from(7).mul('1000000000000000000');
const zeroAddress = constants.AddressZero;

const ONE_DAY = 86400;

let notifyRewardTimestamp;

describe('Polygon ActualSANDRewardPool', function () {
  let deployer;
  let others;
  let landAdmin;
  let rewardPool;
  let rewardPoolAsUser;
  let rewardPoolAsAdmin;
  let stakeToken;
  let stakeTokenAsUser;
  let stakeTokenAsAdmin;
  let rewardToken;
  let multiplierNFToken;
  let multiplierNFTokenAsAdmin;
  let liquidityRewardAdmin;
  let sandBeneficiary;
  let rewardTokenAsAdmin;
  let rewardPoolAsOwner;

  async function createFixture() {
    // TODO use deployments.createFixture()
    await deployments.fixture([
      'PolygonLandWeightedSANDRewardPool',
      'FakeLPSandMatic',
      'SandBaseToken',
      'Land',
    ]);
    await setupLandWeightedRewardPool();

    ({
      deployer,
      liquidityRewardAdmin,
      landAdmin,
      sandBeneficiary,
    } = await getNamedAccounts());

    others = await getUnnamedAccounts();

    // Define token admins
    const stakeTokenAdmin = deployer;
    const multiplierNFTokenAdmin = landAdmin;
    const rewardTokenAdmin = sandBeneficiary;

    // Contracts
    rewardToken = await ethers.getContract(REWARD_TOKEN);
    multiplierNFToken = await ethers.getContract(MULTIPLIER_NFToken);
    stakeToken = await ethers.getContract(STAKE_TOKEN);

    // Get contract roles
    rewardPool = await ethers.getContract(POOL);
    rewardPoolAsAdmin = rewardPool.connect(
      ethers.provider.getSigner(liquidityRewardAdmin)
    );
    rewardPoolAsUser = rewardPool.connect(ethers.provider.getSigner(others[0]));
    rewardPoolAsOwner = rewardPool.connect(ethers.provider.getSigner(deployer));
    stakeTokenAsAdmin = stakeToken.connect(
      ethers.provider.getSigner(stakeTokenAdmin)
    );
    stakeTokenAsUser = stakeToken.connect(ethers.provider.getSigner(others[0]));
    multiplierNFTokenAsAdmin = multiplierNFToken.connect(
      ethers.provider.getSigner(multiplierNFTokenAdmin)
    );
    rewardTokenAsAdmin = rewardToken.connect(
      ethers.provider.getSigner(rewardTokenAdmin)
    );
    await rewardTokenAsAdmin.transfer(rewardPool.address, REWARD_AMOUNT);
    // Give user some stakeTokens
    await stakeTokenAsAdmin.transfer(others[0], STAKE_AMOUNT);
    await stakeTokenAsUser.approve(rewardPool.address, STAKE_AMOUNT);

    // Enable minting of LANDs
    await multiplierNFTokenAsAdmin
      .setMinter(landAdmin, true)
      .then((tx) => tx.wait());

    // Get notifyRewardAmount timestamp from deployment linkedData
    const deployedRewardPool = await deployments.get(POOL);
    const linkedData = deployedRewardPool.linkedData;
    notifyRewardTimestamp = parseInt(linkedData);
  }

  // Provide users with LANDs
  let counter = 0;
  async function mintLandQuad(to) {
    await multiplierNFTokenAsAdmin.mintQuad(to, 1, counter, counter, '0x');
    counter++;
  }

  it('Contract should exist', async function () {
    await createFixture();
    await ethers.getContract(POOL);
  });

  it('Pool contains reward tokens', async function () {
    await createFixture();
    await ethers.getContract(POOL);
    let balance = await rewardToken.balanceOf(rewardPool.address);
    expect(balance).to.equal(REWARD_AMOUNT);
  });

  it('User with stakeTokens can stake', async function () {
    await createFixture();
    let balance = await stakeToken.balanceOf(others[0]);
    expect(balance).to.equal(STAKE_AMOUNT);
    const receipt = await rewardPoolAsUser
      .stake(STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    const eventsMatching = receipt.events.filter(
      (event) => event.event === 'Staked'
    );
    expect(eventsMatching.length).to.equal(1);
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    balance = await stakeToken.balanceOf(others[0]);
    expect(balance).to.equal(0);
  });

  it('User can earn rewardTokens if pool has been notified of reward', async function () {
    await createFixture();
    await rewardPoolAsUser.stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    const userContribution = await rewardPool.contributionOf(others[0]);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser.earned(others[0]);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
    expect(userContribution).to.equal(contribution(STAKE_AMOUNT, 0));
  });

  it('admin can notifyRewardAmount and start a new reward process (without sending more reward tokens)', async function () {
    await createFixture();
    const receipt = await rewardPoolAsAdmin
      .notifyRewardAmount(NEW_REWARD_AMOUNT)
      .then((tx) => tx.wait());
    const eventsMatching = receipt.events.filter(
      (event) => event.event === 'RewardAdded'
    );
    expect(eventsMatching.length).to.equal(1);
    let balance = await rewardToken.balanceOf(rewardPool.address);
    expect(balance).to.equal(REWARD_AMOUNT);
  });

  it('User cannot earn rewardTokens if they stake after the end time', async function () {
    await createFixture();
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]); // fast forward to after the end of current reward period
    await rewardPoolAsUser.stake(STAKE_AMOUNT);
    await mine();
    const rewardPerToken = await rewardPool.rewardPerToken();
    expect(rewardPerToken).to.equal(0);
    const earned = await rewardPoolAsUser.earned(others[0]);
    expect(earned).to.equal(0);
  });

  it('User earns full reward amount if they are the only staker after 1 day', async function () {
    await createFixture();
    await ethers.provider.send('evm_increaseTime', [ONE_DAY]);
    await mine();
    await rewardPoolAsUser.stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION - ONE_DAY,
    ]);
    await mine();
    const earned = await rewardPoolAsUser.earned(others[0]);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it('User earns full reward amount if they are the only staker after 29 days', async function () {
    await createFixture();
    await ethers.provider.send('evm_increaseTime', [ONE_DAY * 29]);
    await mine();
    await rewardPoolAsUser.stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION - ONE_DAY * 29,
    ]);
    await mine();
    const earned = await rewardPoolAsUser.earned(others[0]);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  // Using LAND contract

  it('User with 0 LAND earns correct reward amount', async function () {
    const numNfts = 0;
    await createFixture();
    const receipt = await rewardPoolAsUser
      .stake(STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const stakeBlock = await ethers.provider.getBlock(receipt.blockNumber);
    const stakeTimestamp = stakeBlock.timestamp;
    const timeDiff = stakeTimestamp - notifyRewardTimestamp;

    // user earnings immediately after staking
    const earnedAfterStake = await rewardPoolAsUser.earned(others[0]);
    const userContribution = await rewardPool.contributionOf(others[0]);
    expect(userContribution).to.equal(contribution(STAKE_AMOUNT, numNfts));
    const rewardRate = REWARD_AMOUNT.div(REWARD_DURATION);

    const expectedInitialRewardPerToken = replicateRewardPerToken(
      BigNumber.from(0),
      BigNumber.from(stakeTimestamp),
      BigNumber.from(stakeTimestamp - timeDiff),
      rewardRate,
      contribution(STAKE_AMOUNT, numNfts)
    );
    const expectedInitialReward = replicateEarned(
      contribution(STAKE_AMOUNT, numNfts),
      expectedInitialRewardPerToken
    );
    expect(expectedInitialReward).to.equal(earnedAfterStake);

    // fast forward to end of reward period
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      stakeTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser.earned(others[0]);

    // total earned over entire reward period
    const finishTimestamp = stakeTimestamp - timeDiff + REWARD_DURATION;
    const expectedRewardPerToken = replicateRewardPerToken(
      BigNumber.from(0),
      BigNumber.from(finishTimestamp),
      BigNumber.from(stakeTimestamp - timeDiff),
      rewardRate,
      contribution(STAKE_AMOUNT, numNfts)
    );
    const expectedReward = replicateEarned(
      contribution(STAKE_AMOUNT, numNfts),
      expectedRewardPerToken
    );
    expect(ACTUAL_REWARD_AMOUNT).to.equal(expectedReward);
    expect(earned).to.equal(expectedReward);
  });

  it('User with 0 LAND earns correct reward amount - smaller stake', async function () {
    const numNfts = 0;
    await createFixture();
    const receipt = await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const stakeBlock = await ethers.provider.getBlock(receipt.blockNumber);
    const stakeTimestamp = stakeBlock.timestamp;
    const timeDiff = stakeTimestamp - notifyRewardTimestamp;

    // user earnings immediately after staking
    const earnedAfterStake = await rewardPoolAsUser.earned(others[0]);
    const userContribution = await rewardPool.contributionOf(others[0]);
    expect(userContribution).to.equal(
      contribution(LESS_PRECISE_STAKE_AMOUNT, numNfts)
    );
    const rewardRate = REWARD_AMOUNT.div(REWARD_DURATION);

    const expectedInitialRewardPerToken = replicateRewardPerToken(
      BigNumber.from(0),
      BigNumber.from(stakeTimestamp),
      BigNumber.from(stakeTimestamp - timeDiff),
      rewardRate,
      contribution(LESS_PRECISE_STAKE_AMOUNT, numNfts)
    );
    const expectedInitialReward = replicateEarned(
      contribution(LESS_PRECISE_STAKE_AMOUNT, numNfts),
      expectedInitialRewardPerToken
    );
    expect(expectedInitialReward).to.equal(earnedAfterStake);

    // fast forward to end of reward period
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      stakeTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser.earned(others[0]);

    // total earned over entire reward period
    const finishTimestamp = stakeTimestamp - timeDiff + REWARD_DURATION;
    const expectedRewardPerToken = replicateRewardPerToken(
      BigNumber.from(0),
      BigNumber.from(finishTimestamp),
      BigNumber.from(stakeTimestamp - timeDiff),
      rewardRate,
      contribution(LESS_PRECISE_STAKE_AMOUNT, numNfts)
    );
    const expectedReward = replicateEarned(
      contribution(LESS_PRECISE_STAKE_AMOUNT, numNfts),
      expectedRewardPerToken
    );
    expect(earned).to.equal(expectedReward);

    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(expectedReward);
    expect(ACTUAL_REWARD_AMOUNT).not.to.equal(expectedReward);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(1);
  });

  it('User with 1 LAND earns correct reward amount', async function () {
    const numNfts = 1;
    await createFixture();
    await mintLandQuad(others[0]);
    const landCount = await multiplierNFToken.balanceOf(others[0]);
    expect(landCount).to.equal(numNfts);
    const receipt = await rewardPoolAsUser
      .stake(STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const stakeBlock = await ethers.provider.getBlock(receipt.blockNumber);
    const stakeTimestamp = stakeBlock.timestamp;
    const timeDiff = stakeTimestamp - notifyRewardTimestamp;

    // user earnings immediately after staking
    const earnedAfterStake = await rewardPoolAsUser.earned(others[0]);
    const userContribution = await rewardPool.contributionOf(others[0]);
    expect(userContribution).to.equal(contribution(STAKE_AMOUNT, numNfts));
    const rewardRate = REWARD_AMOUNT.div(REWARD_DURATION);

    const expectedInitialRewardPerToken = replicateRewardPerToken(
      BigNumber.from(0),
      BigNumber.from(stakeTimestamp),
      BigNumber.from(stakeTimestamp - timeDiff),
      rewardRate,
      contribution(STAKE_AMOUNT, numNfts)
    );
    const expectedInitialReward = replicateEarned(
      contribution(STAKE_AMOUNT, numNfts),
      expectedInitialRewardPerToken
    );
    expect(expectedInitialReward).to.equal(earnedAfterStake);

    // fast forward to end of reward period
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      stakeTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser.earned(others[0]);

    // total earned over entire reward period
    const finishTimestamp = stakeTimestamp - timeDiff + REWARD_DURATION;
    const expectedRewardPerToken = replicateRewardPerToken(
      BigNumber.from(0),
      BigNumber.from(finishTimestamp),
      BigNumber.from(stakeTimestamp - timeDiff),
      rewardRate,
      contribution(STAKE_AMOUNT, numNfts)
    );
    const expectedReward = replicateEarned(
      contribution(STAKE_AMOUNT, numNfts),
      expectedRewardPerToken
    );
    expect(earned).to.equal(expectedReward);

    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(expectedReward);
    expect(ACTUAL_REWARD_AMOUNT).not.to.equal(expectedReward);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(1);
  });

  it('User with 3 LANDs earns correct reward amount', async function () {
    const numNfts = 3;
    await createFixture();
    for (let i = 0; i < 3; i++) {
      await mintLandQuad(others[0]);
    }
    const landCount = await multiplierNFToken.balanceOf(others[0]);
    expect(landCount).to.equal(numNfts);
    const receipt = await rewardPoolAsUser
      .stake(STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const stakeBlock = await ethers.provider.getBlock(receipt.blockNumber);
    const stakeTimestamp = stakeBlock.timestamp;
    const timeDiff = stakeTimestamp - notifyRewardTimestamp;

    // user earnings immediately after staking
    const earnedAfterStake = await rewardPoolAsUser.earned(others[0]);
    const userContribution = await rewardPool.contributionOf(others[0]);
    expect(userContribution).to.equal(contribution(STAKE_AMOUNT, numNfts));
    const rewardRate = REWARD_AMOUNT.div(REWARD_DURATION);

    const expectedInitialRewardPerToken = replicateRewardPerToken(
      BigNumber.from(0),
      BigNumber.from(stakeTimestamp),
      BigNumber.from(stakeTimestamp - timeDiff),
      rewardRate,
      contribution(STAKE_AMOUNT, numNfts)
    );
    const expectedInitialReward = replicateEarned(
      contribution(STAKE_AMOUNT, numNfts),
      expectedInitialRewardPerToken
    );
    expect(expectedInitialReward).to.equal(earnedAfterStake);

    // fast forward to end of reward period
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      stakeTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser.earned(others[0]);

    // total earned over entire reward period
    const finishTimestamp = stakeTimestamp - timeDiff + REWARD_DURATION;
    const expectedRewardPerToken = replicateRewardPerToken(
      BigNumber.from(0),
      BigNumber.from(finishTimestamp),
      BigNumber.from(stakeTimestamp - timeDiff),
      rewardRate,
      contribution(STAKE_AMOUNT, numNfts)
    );
    const expectedReward = replicateEarned(
      contribution(STAKE_AMOUNT, numNfts),
      expectedRewardPerToken
    );
    expect(earned).to.equal(expectedReward);

    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(expectedReward);
    expect(ACTUAL_REWARD_AMOUNT).not.to.equal(expectedReward);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(1);
  });

  it('User with 10 LANDs earns correct reward amount', async function () {
    const numNfts = 10;
    await createFixture();
    for (let i = 0; i < 10; i++) {
      await mintLandQuad(others[0]);
    }
    const landCount = await multiplierNFToken.balanceOf(others[0]);
    expect(landCount).to.equal(numNfts);
    const receipt = await rewardPoolAsUser
      .stake(STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const stakeBlock = await ethers.provider.getBlock(receipt.blockNumber);
    const stakeTimestamp = stakeBlock.timestamp;
    const timeDiff = stakeTimestamp - notifyRewardTimestamp;

    // user earnings immediately after staking
    const earnedAfterStake = await rewardPoolAsUser.earned(others[0]);
    const userContribution = await rewardPool.contributionOf(others[0]);
    expect(userContribution).to.equal(contribution(STAKE_AMOUNT, numNfts));
    const rewardRate = REWARD_AMOUNT.div(REWARD_DURATION);

    const expectedInitialRewardPerToken = replicateRewardPerToken(
      BigNumber.from(0),
      BigNumber.from(stakeTimestamp),
      BigNumber.from(stakeTimestamp - timeDiff),
      rewardRate,
      contribution(STAKE_AMOUNT, numNfts)
    );
    const expectedInitialReward = replicateEarned(
      contribution(STAKE_AMOUNT, numNfts),
      expectedInitialRewardPerToken
    );
    expect(expectedInitialReward).to.equal(earnedAfterStake);

    // fast forward to end of reward period
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      stakeTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser.earned(others[0]);

    // total earned over entire reward period
    const finishTimestamp = stakeTimestamp - timeDiff + REWARD_DURATION;
    const expectedRewardPerToken = replicateRewardPerToken(
      BigNumber.from(0),
      BigNumber.from(finishTimestamp),
      BigNumber.from(stakeTimestamp - timeDiff),
      rewardRate,
      contribution(STAKE_AMOUNT, numNfts)
    );
    const expectedReward = replicateEarned(
      contribution(STAKE_AMOUNT, numNfts),
      expectedRewardPerToken
    );
    expect(earned).to.equal(expectedReward);

    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(expectedReward);
    expect(ACTUAL_REWARD_AMOUNT).not.to.equal(expectedReward);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(1);
  });

  it('User can withdraw some stakeTokens after several amounts have been staked', async function () {
    await createFixture();
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const receipt = await rewardPoolAsUser
      .withdraw(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const balance = await stakeToken.balanceOf(others[0]);
    expect(balance).to.equal(STAKE_AMOUNT.sub(LESS_PRECISE_STAKE_AMOUNT));
    const eventsMatching = receipt.events.filter(
      (event) => event.event === 'Withdrawn'
    );
    expect(eventsMatching.length).to.equal(1);
  });

  it('First user can withdraw their stakeTokens', async function () {
    await createFixture();
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const stakedTokens = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedTokens).to.equal(LESS_PRECISE_STAKE_AMOUNT);
    const receipt = await rewardPoolAsUser
      .withdraw(stakedTokens)
      .then((tx) => tx.wait());
    const balance = await stakeToken.balanceOf(others[0]);
    expect(balance).to.equal(STAKE_AMOUNT);
    const eventsMatching = receipt.events.filter(
      (event) => event.event === 'Withdrawn'
    );
    expect(eventsMatching.length).to.equal(1);
    const balancePool = await stakeToken.balanceOf(rewardPool.address);
    expect(balancePool).to.equal(0);
  });

  it('User can withdraw all stakeTokens after several amounts have been staked', async function () {
    await createFixture();
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const receipt = await rewardPoolAsUser
      .withdraw(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const balance = await stakeToken.balanceOf(others[0]);
    expect(balance).to.equal(STAKE_AMOUNT.sub(LESS_PRECISE_STAKE_AMOUNT));
    const eventsMatching = receipt.events.filter(
      (event) => event.event === 'Withdrawn'
    );
    expect(eventsMatching.length).to.equal(1);

    const receiptTwo = await rewardPoolAsUser
      .withdraw(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const balanceTwo = await stakeToken.balanceOf(others[0]);
    expect(balanceTwo).to.equal(STAKE_AMOUNT);
    const eventsMatchingTwo = receiptTwo.events.filter(
      (event) => event.event === 'Withdrawn'
    );
    expect(eventsMatchingTwo.length).to.equal(1);
  });

  it('First user can claim their reward - no NFTs', async function () {
    await createFixture();
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();

    const expectedReward = await rewardPoolAsUser.earned(others[0]);
    const rewardReceipt = await rewardPoolAsUser
      .getReward()
      .then((tx) => tx.wait());
    const balance = await rewardToken.balanceOf(others[0]);
    expect(balance).to.equal(expectedReward);
    const eventsMatching = rewardReceipt.events.filter(
      (event) => event.event === 'RewardPaid'
    );
    expect(eventsMatching.length).to.equal(1);
    const balanceRewardPool = await rewardToken.balanceOf(rewardPool.address);
    expect(balanceRewardPool).to.equal(REWARD_AMOUNT.sub(expectedReward));
  });

  it('First user can claim their reward - has NFTs', async function () {
    await createFixture();
    for (let i = 0; i < 10; i++) {
      await mintLandQuad(others[0]);
    }
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const expectedReward = await rewardPoolAsUser.earned(others[0]);
    const rewardReceipt = await rewardPoolAsUser
      .getReward()
      .then((tx) => tx.wait());
    const balance = await rewardToken.balanceOf(others[0]);
    expect(balance).to.equal(expectedReward);
    const eventsMatching = rewardReceipt.events.filter(
      (event) => event.event === 'RewardPaid'
    );
    expect(eventsMatching.length).to.equal(1);
    const balanceRewardPool = await rewardToken.balanceOf(rewardPool.address);
    expect(balanceRewardPool).to.equal(REWARD_AMOUNT.sub(expectedReward));
  });

  it('A user can claim their reward after multiple stakes', async function () {
    await createFixture();
    for (let i = 0; i < 10; i++) {
      await mintLandQuad(others[0]);
    }
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const expectedReward = await rewardPoolAsUser.earned(others[0]);
    const rewardReceipt = await rewardPoolAsUser
      .getReward()
      .then((tx) => tx.wait());
    const balance = await rewardToken.balanceOf(others[0]);
    expect(balance).to.equal(expectedReward);
    const eventsMatching = rewardReceipt.events.filter(
      (event) => event.event === 'RewardPaid'
    );
    expect(eventsMatching.length).to.equal(1);
    const balanceRewardPool = await rewardToken.balanceOf(rewardPool.address);
    expect(balanceRewardPool).to.equal(REWARD_AMOUNT.sub(expectedReward));
  });

  it('First user can exit the pool', async function () {
    await createFixture();
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const receipt = await rewardPoolAsUser.exit().then((tx) => tx.wait());

    // No user stakeTokens remaining in pool
    const balanceUser = await stakeToken.balanceOf(others[0]);
    expect(balanceUser).to.equal(STAKE_AMOUNT);
    const balancePool = await stakeToken.balanceOf(rewardPool.address);
    expect(balancePool).to.equal(0);

    // Withdraw Event
    const eventsMatchingWithdraw = receipt.events.filter(
      (event) => event.event === 'Withdrawn'
    );
    expect(eventsMatchingWithdraw.length).to.equal(1);

    // RewardPaidEvent
    const eventsMatchingRewardPaid = receipt.events.filter(
      (event) => event.event === 'RewardPaid'
    );
    expect(eventsMatchingRewardPaid.length).to.equal(1);
  });

  it('A user can exit the pool after multiple stakes', async function () {
    await createFixture();
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const receipt = await rewardPoolAsUser.exit().then((tx) => tx.wait());

    // No user stakeTokens remaining in pool
    const balanceUser = await stakeToken.balanceOf(others[0]);
    expect(balanceUser).to.equal(STAKE_AMOUNT);
    const balancePool = await stakeToken.balanceOf(rewardPool.address);
    expect(balancePool).to.equal(0);

    // Withdraw Event
    const eventsMatchingWithdraw = receipt.events.filter(
      (event) => event.event === 'Withdrawn'
    );
    expect(eventsMatchingWithdraw.length).to.equal(1);

    // RewardPaidEvent
    const eventsMatchingRewardPaid = receipt.events.filter(
      (event) => event.event === 'RewardPaid'
    );
    expect(eventsMatchingRewardPaid.length).to.equal(1);
  });

  it('A user with NFTs can exit the pool after multiple stakes', async function () {
    await createFixture();
    for (let i = 0; i < 10; i++) {
      await mintLandQuad(others[0]);
    }
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    await rewardPoolAsUser
      .stake(LESS_PRECISE_STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const receipt = await rewardPoolAsUser.exit().then((tx) => tx.wait());

    // No user stakeTokens remaining in pool
    const balanceUser = await stakeToken.balanceOf(others[0]);
    expect(balanceUser).to.equal(STAKE_AMOUNT);
    const balancePool = await stakeToken.balanceOf(rewardPool.address);
    expect(balancePool).to.equal(0);

    // Withdraw Event
    const eventsMatchingWithdraw = receipt.events.filter(
      (event) => event.event === 'Withdrawn'
    );
    expect(eventsMatchingWithdraw.length).to.equal(1);

    // RewardPaidEvent
    const eventsMatchingRewardPaid = receipt.events.filter(
      (event) => event.event === 'RewardPaid'
    );
    expect(eventsMatchingRewardPaid.length).to.equal(1);
  });

  it('Change externals contracts', async function () {
    await createFixture();

    // owner can change LPtoken contract
    await expect(
      rewardPoolAsOwner.SetRewardToken(zeroAddress)
    ).to.be.revertedWith('Bad RewardToken address');

    // use deployer address as not contract address
    await expect(rewardPoolAsOwner.SetRewardToken(deployer)).to.be.revertedWith(
      'Bad RewardToken address'
    );

    await expect(rewardPoolAsAdmin.SetNFTMultiplierToken(rewardToken.address))
      .to.be.reverted;

    // Change address with another contract in order to see if not reverted
    await expect(rewardPoolAsOwner.SetNFTMultiplierToken(rewardToken.address))
      .not.to.be.reverted;
  });
});
