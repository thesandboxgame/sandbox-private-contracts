const {
  ethers,
  deployments,
  getNamedAccounts,
  getUnnamedAccounts,
} = require('hardhat');
const {BigNumber} = require('@ethersproject/bignumber');
const {expect} = require('../../chai-setup');
const {mine} = require('../../utils');
const {contribution} = require('./contributionEquation.test');

const STAKE_TOKEN = 'FakeLPSandMatic';
const REWARD_TOKEN = 'SandBaseToken';
const MULTIPLIER_NFToken = 'MockLand';
const POOL = 'PolygonLandWeightedSANDRewardPoolNFTTest';
const REWARD_DURATION = 2592000; // 30 days in seconds
const REWARD_AMOUNT = BigNumber.from(1500000).mul('1000000000000000000');
const WRONG_REWARD_AMOUNT = BigNumber.from(1500000);
const ACTUAL_REWARD_AMOUNT = REWARD_AMOUNT.div(REWARD_DURATION).mul(
  REWARD_DURATION
);

const STAKE_AMOUNT = BigNumber.from(10000).mul('1000000000000000000');
const SMALL_STAKE_AMOUNT = BigNumber.from(10).mul('1000000000000000000');

describe('Polygon MockSANDRewardPool', function () {
  let deployer;
  let others;
  let sandBeneficiary;
  let landAdmin;
  let rewardPool;
  let rewardPoolAsUser;
  let rewardPoolAsAdmin;
  let stakeToken;
  let stakeTokenAsAdmin;
  let stakeTokenAsUser;
  let rewardToken;
  let rewardTokenAsAdmin;
  let multiplierNFToken;
  let multiplierNFTokenAsAdmin;
  let liquidityRewardAdmin;

  async function createFixture(supplyRewardTokens, notifyReward) {
    await deployments.fixture('PolygonLandWeightedSANDRewardPool');
    ({
      deployer,
      sandBeneficiary,
      liquidityRewardAdmin,
      landAdmin,
    } = await getNamedAccounts());

    others = await getUnnamedAccounts();

    // Deploy mock contracts
    rewardToken = await ethers.getContract(REWARD_TOKEN);
    await deployments.deploy(MULTIPLIER_NFToken, {
      from: deployer,
      args: [rewardToken.address, landAdmin],
    });
    multiplierNFToken = await ethers.getContract(MULTIPLIER_NFToken);
    stakeToken = await ethers.getContract(STAKE_TOKEN);
    await deployments.deploy(POOL, {
      from: deployer,
      args: [
        stakeToken.address,
        rewardToken.address,
        multiplierNFToken.address,
        2592000,
      ],
    });
    rewardPool = await ethers.getContract(POOL);

    // Define token admins
    const rewardTokenAdmin = sandBeneficiary;
    const stakeTokenAdmin = deployer;
    const multiplierNFTokenAdmin = landAdmin;

    // Get contract roles
    rewardPoolAsAdmin = rewardPool.connect(
      ethers.provider.getSigner(liquidityRewardAdmin)
    );
    rewardPoolAsUser = {
      0: rewardPool.connect(ethers.provider.getSigner(others[0])),
      1: rewardPool.connect(ethers.provider.getSigner(others[1])),
      2: rewardPool.connect(ethers.provider.getSigner(others[2])),
    };
    stakeTokenAsAdmin = stakeToken.connect(
      ethers.provider.getSigner(stakeTokenAdmin)
    );
    multiplierNFTokenAsAdmin = multiplierNFToken.connect(
      ethers.provider.getSigner(multiplierNFTokenAdmin)
    );
    stakeTokenAsUser = {
      0: stakeToken.connect(ethers.provider.getSigner(others[0])),
      1: stakeToken.connect(ethers.provider.getSigner(others[1])),
      2: stakeToken.connect(ethers.provider.getSigner(others[2])),
    };
    rewardTokenAsAdmin = rewardToken.connect(
      ethers.provider.getSigner(rewardTokenAdmin)
    );
    const rewardPoolAsDeployer = rewardPool.connect(
      ethers.provider.getSigner(deployer)
    );

    // Send reward to pool
    await rewardPoolAsDeployer.setRewardDistribution(liquidityRewardAdmin);

    if (supplyRewardTokens === true) {
      await rewardTokenAsAdmin.transfer(rewardPool.address, REWARD_AMOUNT);
    }

    if (notifyReward === true) {
      await rewardPoolAsAdmin.notifyRewardAmount(REWARD_AMOUNT);
    }
    // Give users some stakeTokens
    for (let i = 0; i < 3; i++) {
      await stakeTokenAsAdmin.transfer(others[i], STAKE_AMOUNT.mul(10));
      await stakeTokenAsUser[i].approve(
        rewardPool.address,
        STAKE_AMOUNT.mul(10)
      );
    }
  }

  async function setUpUserWithNfts(user, min, max) {
    // Set up users with NFTs (mockLands)
    for (let i = min; i < max; i++) {
      await multiplierNFTokenAsAdmin.mint(user, i);
    }
  }

  it('Pool contains reward tokens', async function () {
    await createFixture(true, true);
    await ethers.getContract(POOL);
    let balance = await rewardToken.balanceOf(rewardPool.address);
    expect(balance).to.equal(REWARD_AMOUNT);
  });

  it('User with stakeTokens can stake', async function () {
    await createFixture(true, true);
    let balance = await stakeToken.balanceOf(others[0]);
    expect(balance).to.equal(STAKE_AMOUNT.mul(10));
    const receipt = await rewardPoolAsUser[0]
      .stake(STAKE_AMOUNT)
      .then((tx) => tx.wait());
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    const eventsMatching = receipt.events.filter(
      (event) => event.event === 'Staked'
    );
    expect(eventsMatching.length).to.equal(1);
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    balance = await stakeToken.balanceOf(others[0]);
    expect(balance).to.equal(STAKE_AMOUNT.mul(10).sub(STAKE_AMOUNT));
  });

  // Single staker with no LANDs receive rewards
  // Total rewards add up to 100% of reward available

  it('User earnings for 0 NFTs match expected reward', async function () {
    await createFixture(true, true);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
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

  it('User earnings for 0 NFTs match expected reward with 1 stake', async function () {
    await createFixture(true, true);
    await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it('User earnings for 0 NFTs match expected reward with 2 stakes', async function () {
    await createFixture(true, true);
    for (let i = 0; i < 2; i++) {
      await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
    }
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT.mul(2));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it('User earnings for 0 NFTs match expected reward with 3 stakes', async function () {
    await createFixture(true, true);
    for (let i = 0; i < 3; i++) {
      await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
    }
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT.mul(3));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it('User earnings for 0 NFTs match expected reward with 4 stakes', async function () {
    await createFixture(true, true);
    for (let i = 0; i < 4; i++) {
      await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
    }
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT.mul(4));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(1);
  });

  it('User earnings for 0 NFTs match expected reward with 10 stakes', async function () {
    await createFixture(true, true);
    for (let i = 0; i < 10; i++) {
      await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
    }
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT.mul(10));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(4);
  });

  // Single staker with LANDs receive rewards
  // Total rewards add up to 100% of reward available

  it('User earnings for 1 NFTs match expected reward', async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 1);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(1);
  });

  it('User earnings for 1 NFTs match expected reward with 10 stakes', async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 1);
    for (let i = 0; i < 10; i++) {
      await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
    }
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT.mul(10));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(10);
  });

  it('User earnings for 2 NFTs match expected reward', async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 2);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(1);
  });

  it('User earnings for 3 NFTs match expected reward', async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 3);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(1);
  });

  it('User earnings for 3 NFTs match expected reward with 10 stakes', async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 3);
    for (let i = 0; i < 10; i++) {
      await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
    }
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT.mul(10));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(10);
  });

  it('User earnings for 89 NFTs match expected reward', async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 89);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(1);
  });

  it('User earnings for 89 NFTs match expected reward with 10 stakes', async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 89);
    for (let i = 0; i < 10; i++) {
      await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
    }
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT.mul(10));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(10);
  });

  // TODO ?
  // it.skip('User earnings for 500 NFTs match expected reward', async function () {
  //   await createFixture(true, true);
  //   await setUpUserWithNfts(others[0], 0, 500);
  //   await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
  //   const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
  //   expect(stakedBalance).to.equal(STAKE_AMOUNT);
  //   const latestBlock = await ethers.provider.getBlock('latest');
  //   const currentTimestamp = latestBlock.timestamp;
  //   await ethers.provider.send('evm_setNextBlockTimestamp', [
  //     currentTimestamp + REWARD_DURATION,
  //   ]);
  //   await mine();
  //   const earned = await rewardPoolAsUser[0].earned(others[0]);

  //   expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
  //   const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
  //   expect(precisionLost).to.be.at.least(1);
  //   expect(precisionLost).to.be.at.most(1);
  // });

  // it.skip('User earnings for 10000 NFTs match expected reward', async function () {
  //   await createFixture(true, true);
  //   await setUpUserWithNfts(others[0], 0, 10000);
  //   await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
  //   const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
  //   expect(stakedBalance).to.equal(STAKE_AMOUNT);
  //   const latestBlock = await ethers.provider.getBlock('latest');
  //   const currentTimestamp = latestBlock.timestamp;
  //   await ethers.provider.send('evm_setNextBlockTimestamp', [
  //     currentTimestamp + REWARD_DURATION,
  //   ]);
  //   await mine();
  //   const earned = await rewardPoolAsUser[0].earned(others[0]);

  //   expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
  //   const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
  //   expect(precisionLost).to.be.at.least(1);
  //   expect(precisionLost).to.be.at.most(1);
  // });

  // Multiple stakers with no LANDs receive rewards
  // Total rewards add up to 100% of reward available

  it("Multiple Users' earnings for 0 NFTs match expected reward: 2 users", async function () {
    await createFixture(true, true);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    await rewardPoolAsUser[1].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(STAKE_AMOUNT.mul(2));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned0 = await rewardPoolAsUser[0].earned(others[0]);
    const earned1 = await rewardPoolAsUser[1].earned(others[1]);
    expect(earned0.add(earned1)).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it("Multiple Users' earnings for 0 NFTs match expected reward: 2 users, 10 stakes each", async function () {
    await createFixture(true, true);
    for (let i = 0; i < 10; i++) {
      await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
      await rewardPoolAsUser[1].stake(SMALL_STAKE_AMOUNT);
    }
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT.mul(20));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned0 = await rewardPoolAsUser[0].earned(others[0]);
    const earned1 = await rewardPoolAsUser[1].earned(others[1]);
    const earned = earned0.add(earned1);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(10);
  });

  it("Multiple Users' earnings for 0 NFTs match expected reward: 3 users, 1 stake each", async function () {
    await createFixture(true, true);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    await rewardPoolAsUser[1].stake(STAKE_AMOUNT);
    await rewardPoolAsUser[2].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(STAKE_AMOUNT.mul(3));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned0 = await rewardPoolAsUser[0].earned(others[0]);
    const earned1 = await rewardPoolAsUser[1].earned(others[1]);
    const earned2 = await rewardPoolAsUser[2].earned(others[2]);
    const earned = earned0.add(earned1).add(earned2);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(1);
  });

  // Multiple stakers with LANDs receive rewards
  // Total contributions add up to 100% of reward available

  it("Multiple Users' earnings for 1 NFTs match expected reward: 2 users, 1 stake each", async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 1);
    await setUpUserWithNfts(others[1], 1, 2);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    await rewardPoolAsUser[1].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
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

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(2);
  });

  it("Multiple Users' earnings for 1 NFTs match expected reward: 2 users, 10 stakes each", async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 1);
    await setUpUserWithNfts(others[1], 1, 2);
    for (let i = 0; i < 10; i++) {
      await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
      await rewardPoolAsUser[1].stake(SMALL_STAKE_AMOUNT);
    }
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT.mul(20));
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned0 = await rewardPoolAsUser[0].earned(others[0]);
    const earned1 = await rewardPoolAsUser[1].earned(others[1]);
    const earned = earned0.add(earned1);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(11);
  });

  it("Multiple Users' earnings for 3 NFTs match expected reward: 2 users, 1 stake each", async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 3);
    await setUpUserWithNfts(others[1], 3, 6);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    await rewardPoolAsUser[1].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
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

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(2);
  });

  it("Multiple Users' earnings for 100 NFTs match expected reward: 2 users, 1 stake each", async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 100);
    await setUpUserWithNfts(others[1], 100, 200);
    await rewardPoolAsUser[0].stake(STAKE_AMOUNT);
    await rewardPoolAsUser[1].stake(STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
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

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(2);
  });

  it('Staking with STAKE_AMOUNT plus an extra amount equivalent to 2 NFTs', async function () {
    await createFixture(true, true);
    const numNfts = 2;
    const contributionNoNfts = contribution(STAKE_AMOUNT, 0);
    const contributionWithNfts = contribution(STAKE_AMOUNT, numNfts);
    const stakeAmount = STAKE_AMOUNT.add(
      contributionWithNfts.sub(contributionNoNfts)
    );
    await rewardPoolAsUser[0].stake(stakeAmount);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(stakeAmount);

    const userContribution = await rewardPool.contributionOf(others[0]);
    expect(userContribution).to.equal(contribution(stakeAmount, 0));

    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(1);
    // same precision loss as for 2 NFTs
  });

  it('Earlier staker gets more rewards with same NFT amount - small NFT number', async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 1);
    await setUpUserWithNfts(others[1], 1, 2);
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

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(2);
  });

  it('Earlier staker gets more rewards with same NFT amount - large NFT number', async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 100);
    await setUpUserWithNfts(others[1], 100, 200);
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

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(2);
  });

  it('More lands give more rewards than earlier staker when NFT amounts are smaller', async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 1);
    await setUpUserWithNfts(others[1], 1, 3); // has extra NFT
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
    expect(earned1).to.be.gte(earned0);
    const earned = earned0.add(earned1);

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(1);
  });

  it('More lands do not give more rewards than earlier staker with large NFT amounts', async function () {
    await createFixture(true, true);
    await setUpUserWithNfts(others[0], 0, 100);
    await setUpUserWithNfts(others[1], 100, 201); // has extra NFT
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

    expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
    const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
    expect(precisionLost).to.be.at.least(1);
    expect(precisionLost).to.be.at.most(1);
  });

  // TODO ?
  // it.skip("Multiple Users' earnings for 0 NFTs match expected reward: 2 users, 100 stakes each", async function () {
  //   await createFixture(true, true);
  //   for (let i = 0; i < 100; i++) {
  //     await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
  //     await rewardPoolAsUser[1].stake(SMALL_STAKE_AMOUNT);
  //   }
  //   const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
  //   expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT.mul(200));
  //   const latestBlock = await ethers.provider.getBlock('latest');
  //   const currentTimestamp = latestBlock.timestamp;
  //   await ethers.provider.send('evm_setNextBlockTimestamp', [
  //     currentTimestamp + REWARD_DURATION,
  //   ]);
  //   await mine();
  //   const earned0 = await rewardPoolAsUser[0].earned(others[0]);
  //   const earned1 = await rewardPoolAsUser[1].earned(others[1]);
  //   const earned = earned0.add(earned1);

  //   expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
  //   const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
  //   expect(precisionLost).to.be.at.least(1);
  //   expect(precisionLost).to.be.at.most(99);
  // });

  // it.skip("Multiple Users' earnings for 100 NFTs match expected reward: 2 users, 100 stakes each", async function () {
  //   await createFixture(true, true);
  //   await setUpUserWithNfts(others[0], 0, 100);
  //   await setUpUserWithNfts(others[1], 100, 200);
  //   for (let i = 0; i < 100; i++) {
  //     await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
  //     await rewardPoolAsUser[1].stake(SMALL_STAKE_AMOUNT);
  //   }
  //   const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
  //   expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT.mul(200));
  //   const latestBlock = await ethers.provider.getBlock('latest');
  //   const currentTimestamp = latestBlock.timestamp;
  //   await ethers.provider.send('evm_setNextBlockTimestamp', [
  //     currentTimestamp + REWARD_DURATION,
  //   ]);
  //   await mine();
  //   const earned0 = await rewardPoolAsUser[0].earned(others[0]);
  //   const earned1 = await rewardPoolAsUser[1].earned(others[1]);
  //   const earned = earned0.add(earned1);

  //   expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
  //   const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
  //   expect(precisionLost).to.be.at.least(1);
  //   expect(precisionLost).to.be.at.most(100);
  // });

  // it.skip("Multiple Users' earnings for 100 NFTs match expected reward: 2 users, 1000 stakes each", async function () {
  //   await createFixture(true, true);
  //   await setUpUserWithNfts(others[0], 0, 100);
  //   await setUpUserWithNfts(others[1], 100, 200);
  //   for (let i = 0; i < 1000; i++) {
  //     await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
  //     await rewardPoolAsUser[1].stake(SMALL_STAKE_AMOUNT);
  //   }
  //   const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
  //   expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT.mul(2000));
  //   const latestBlock = await ethers.provider.getBlock('latest');
  //   const currentTimestamp = latestBlock.timestamp;
  //   await ethers.provider.send('evm_setNextBlockTimestamp', [
  //     currentTimestamp + REWARD_DURATION,
  //   ]);
  //   await mine();
  //   const earned0 = await rewardPoolAsUser[0].earned(others[0]);
  //   const earned1 = await rewardPoolAsUser[1].earned(others[1]);
  //   const earned = earned0.add(earned1);

  //   expect(earned).not.to.equal(ACTUAL_REWARD_AMOUNT);
  //   const precisionLost = ACTUAL_REWARD_AMOUNT.sub(earned);
  //   expect(precisionLost).to.be.at.least(1);
  //   expect(precisionLost).to.be.at.most(1015);
  // });

  it('rewardToken in pool is more than amount notified', async function () {
    await createFixture(true, false);
    const wrongRewardAmount = BigNumber.from(1400000).mul(
      '1000000000000000000'
    );
    const actualRewardAmount = wrongRewardAmount
      .div(REWARD_DURATION)
      .mul(REWARD_DURATION);
    await rewardPoolAsAdmin.notifyRewardAmount(wrongRewardAmount);
    await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    // expect earnings to be accrued based on amount notified
    expect(earned).to.equal(actualRewardAmount);
  });

  it('rewardToken in pool is zero', async function () {
    await createFixture(false, true);
    await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    // expect earnings to be accrued based on amount notified
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);

    // expect that user cannot withdraw reward tokens as they have not been provided to the pool
    await expect(rewardPoolAsUser[0].getReward()).to.be.reverted;
  });

  it('rewardToken in pool is less than amount notified', async function () {
    await createFixture(false, true);
    await rewardTokenAsAdmin.transfer(rewardPool.address, WRONG_REWARD_AMOUNT);
    await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    // expect earnings to be accrued based on amount notified
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);

    // expect that user cannot withdraw reward tokens as they have not been provided to the pool
    await expect(rewardPoolAsUser[0].getReward()).to.be.reverted;
  });

  it('the call to notifyRewardAmount is made after users first call stake', async function () {
    await createFixture(true, false);
    await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
    await mine();
    const initialEarnings = await rewardPoolAsUser[0].earned(others[0]);
    expect(initialEarnings).to.equal(0); // pool has not been notified yet

    await rewardPoolAsAdmin.notifyRewardAmount(REWARD_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    // earnings accrue from timestamp of notifyRewardAmount
    expect(earned).to.equal(ACTUAL_REWARD_AMOUNT);
  });

  it('user is earning rewards and pool is notified for a second time before end of current reward period', async function () {
    await createFixture(true, true);
    await rewardPoolAsUser[0].stake(SMALL_STAKE_AMOUNT);
    await mine();
    const initialEarnings = await rewardPoolAsUser[0].earned(others[0]);
    expect(initialEarnings).to.not.equal(0); // user earns as a result of earlier notifyRewardAmount

    await rewardPoolAsAdmin.notifyRewardAmount(REWARD_AMOUNT);
    const stakedBalance = await stakeToken.balanceOf(rewardPool.address);
    expect(stakedBalance).to.equal(SMALL_STAKE_AMOUNT);
    const latestBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = latestBlock.timestamp;
    await ethers.provider.send('evm_setNextBlockTimestamp', [
      currentTimestamp + REWARD_DURATION,
    ]);
    await mine();
    const earned = await rewardPoolAsUser[0].earned(others[0]);

    // double reward tokens available to be earned
    expect(earned).to.be.above(ACTUAL_REWARD_AMOUNT);
  });
});
