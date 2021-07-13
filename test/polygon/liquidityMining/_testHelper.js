const {BigNumber} = require('ethers');
const SOL_PRECISION = BigNumber.from(1).mul('1000000000000000000000000');

// LandWeightedSANDRewardPool.sol helper functions

module.exports.replicateRewardPerToken = (
  rewardPerTokenStored,
  lastTimeRewardApplicable,
  lastUpdateTime,
  rewardRate,
  totalContributions
) => {
  const timeDifference = lastTimeRewardApplicable.sub(lastUpdateTime);
  return rewardPerTokenStored.add(
    timeDifference.mul(rewardRate).mul(SOL_PRECISION).div(totalContributions)
  );
};

module.exports.replicateEarned = (contribution, rewardPerToken) => {
  return contribution.mul(rewardPerToken).div(SOL_PRECISION);
};
