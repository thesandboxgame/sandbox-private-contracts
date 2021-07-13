const {expect} = require('../../chai-setup');
const {ethers, deployments} = require('hardhat');
const {BigNumber} = require('ethers');

let loopCounter = 0;

function cbrt6(a) {
  loopCounter = 0;
  a = BigNumber.from(a);
  a = a.mul('1000000000000000000');
  let tmp = a.add(2).div(3);
  let c = BigNumber.from(a);
  while (tmp.lt(c)) {
    c = BigNumber.from(tmp);
    const tmpSquare = tmp.pow(2);
    tmp = a.div(tmpSquare).add(tmp.mul(2)).div(3);
    loopCounter++;
  }
  return c;
}

function cbrt3(a) {
  loopCounter = 0;
  a = BigNumber.from(a);
  a = a.mul('1000000000');
  let tmp = a.add(2).div(3);
  let c = BigNumber.from(a);
  while (tmp.lt(c)) {
    c = BigNumber.from(tmp);
    const tmpSquare = tmp.pow(2);
    tmp = a.div(tmpSquare).add(tmp.mul(2)).div(3);
    loopCounter++;
  }
  return c;
}

function rt6_3(a) {
  loopCounter = 0;
  a = BigNumber.from(a);
  a = a.mul('1000000000000000000');
  let tmp = a.add(5).div(6);
  let c = BigNumber.from(a);
  while (tmp.lt(c)) {
    c = BigNumber.from(tmp);
    const tmpFive = tmp.pow(5);
    tmp = a.div(tmpFive).add(tmp.mul(5)).div(6);
    loopCounter++;
  }
  return c;
}

BigNumber.prototype.cbrt6 = function () {
  return cbrt6(this);
};

BigNumber.prototype.cbrt3 = function () {
  return cbrt3(this);
};

BigNumber.prototype.rt6_3 = function () {
  return rt6_3(this);
};

const MIDPOINT_9 = BigNumber.from('500000000');
const NFT_FACTOR_6 = BigNumber.from('10000');
const NFT_CONSTANT_3 = BigNumber.from('9000');
const ROOT3_FACTOR = BigNumber.from(697);
const DECIMALS_9 = BigNumber.from('1000000000');

function contribution(amountStaked, numLands) {
  amountStaked = BigNumber.from(amountStaked);
  numLands = BigNumber.from(numLands);
  if (numLands.eq(0)) {
    return amountStaked;
  }
  let nftContrib = NFT_FACTOR_6.mul(
    NFT_CONSTANT_3.add(numLands.sub(1).mul(ROOT3_FACTOR).add(1).cbrt3())
  );
  if (nftContrib.gt(MIDPOINT_9)) {
    nftContrib = MIDPOINT_9.add(nftContrib.sub(MIDPOINT_9).div(10));
  }
  return amountStaked.add(amountStaked.mul(nftContrib).div(DECIMALS_9));
}

const valuesToTests = [
  {
    amountStaked: 1000,
    numLands: 0,
  },
  {
    amountStaked: 1000,
    numLands: 1,
  },
  {
    amountStaked: 1000,
    numLands: 3,
  },
  {
    amountStaked: 1000,
    numLands: 9,
  },
  {
    amountStaked: 1000,
    numLands: 10,
  },
  {
    amountStaked: 1000,
    numLands: 122,
  },
  {
    amountStaked: 1000,
    numLands: 100,
    expectedContribution: 1500,
  },
  {
    amountStaked: 1000,
    numLands: 10000,
  },
  {
    amountStaked: '1000000000000000000000000',
    numLands: 10000,
  },
];

describe('SafeMathWithRequire', function () {
  it('cbrt6', async function () {
    expect(cbrt6(0)).to.equal(0);
    expect(cbrt6(1)).to.equal(1000000);
    expect(cbrt6(2)).to.equal(1259921);
    expect(cbrt6(4)).to.equal(1587401);
    expect(cbrt6(8)).to.equal(2000000);
    expect(cbrt6(10)).to.equal(2154434);
    expect(cbrt6(20)).to.equal(2714417);
    expect(cbrt6(50)).to.equal(3684031);
    expect(cbrt6(100)).to.equal(4641588);

    expect(cbrt6(1000)).to.equal(10000000);
    console.log({loopCounter});

    expect(cbrt6('1000000000000000000000000000')).to.equal('1000000000000000');
    console.log({loopCounter});
  });

  it('cbrt3', async function () {
    expect(cbrt3(0)).to.equal(0);
    expect(cbrt3(1)).to.equal(1000);
    expect(cbrt3(2)).to.equal(1259);
    expect(cbrt3(4)).to.equal(1587);
    expect(cbrt3(8)).to.equal(2000);
    expect(cbrt3(10)).to.equal(2154);
    expect(cbrt3(20)).to.equal(2714);
    expect(cbrt3(50)).to.equal(3684);
    expect(cbrt3(100)).to.equal(4641);

    expect(cbrt3(1000)).to.equal(10000);
    console.log({loopCounter});

    expect(cbrt3('1000000000000000000000000000')).to.equal('1000000000000');
    console.log({loopCounter});
  });
  it('rt6_3', async function () {
    expect(rt6_3(0)).to.equal(0);
    expect(rt6_3(1)).to.equal(1000);
    expect(rt6_3(2)).to.equal(1122);
    expect(rt6_3(4)).to.equal(1259);
    expect(rt6_3(8)).to.equal(1414);
    expect(rt6_3(10)).to.equal(1467);
    expect(rt6_3(20)).to.equal(1647);
    expect(rt6_3(50)).to.equal(1919);
    expect(rt6_3(100)).to.equal(2154);

    expect(rt6_3(1000)).to.equal(3162);
    console.log({loopCounter});

    expect(rt6_3('1000000000000000000000000000')).to.equal(31622776);
    console.log({loopCounter});
  });
});

describe('PolygonLandWeightedSANDRewardPool computation', function () {
  it('computing contributions', async function () {
    await deployments.fixture('PolygonLandWeightedSANDRewardPool');
    const contract = await ethers.getContract(
      'PolygonLandWeightedSANDRewardPool'
    );
    for (const values of valuesToTests) {
      const result = await contract.computeContribution(
        values.amountStaked,
        values.numLands
      );
      expect(result).to.equal(
        contribution(values.amountStaked, values.numLands)
      );
      if (values.expectedContribution) {
        expect(result).to.equal(values.expectedContribution);
      }
    }
  });
});

module.exports.contribution = contribution;
