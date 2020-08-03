const {guard} = require("../lib");
const {getLands} = require("../data/LandPreSale_4/getLands");
const percentages = require("../data/feeDistribution/percentages");

module.exports = async ({getChainId, getNamedAccounts, deployments, network}) => {
  const {deployIfDifferent, deploy, log} = deployments;
  const chainId = await getChainId();

  const {deployer, landSaleBeneficiary, backendReferralWallet, feeDistributionRecipients} = await getNamedAccounts();

  const sandContract = await deployments.getOrNull("Sand");
  const landContract = await deployments.getOrNull("Land");
  const estateContract = await deployments.getOrNull("Estate");

  if (!sandContract) {
    throw new Error("no SAND contract deployed");
  }

  if (!landContract) {
    throw new Error("no LAND contract deployed");
  }

  if (!estateContract) {
    throw new Error("no ESTATE contract deployed");
  }

  let daiMedianizer = await deployments.getOrNull("DAIMedianizer");
  if (!daiMedianizer) {
    log("setting up a fake DAI medianizer");
    daiMedianizer = await deployIfDifferent(
      ["data"],
      "DAIMedianizer",
      {from: deployer, gas: 6721975},
      "FakeMedianizer"
    );
  }

  let dai = await deployments.getOrNull("DAI");
  if (!dai) {
    log("setting up a fake DAI");
    dai = await deployIfDifferent(
      ["data"],
      "DAI",
      {
        from: deployer,
        gas: 6721975,
      },
      "FakeDai"
    );
  }

  const {lands, merkleRootHash} = getLands(network.live, chainId);

  const deployResult = await deployIfDifferent(
    ["data"],
    "LandPreSale_4",
    {from: deployer, gas: 3000000, linkedData: lands},
    "EstateSaleWithFee",
    landContract.address,
    sandContract.address,
    sandContract.address,
    deployer,
    landSaleBeneficiary,
    merkleRootHash,
    2591016400, // TODO
    daiMedianizer.address,
    dai.address,
    backendReferralWallet,
    2000,
    estateContract.address,
    feeDistributionRecipients,
    percentages
  );
  if (deployResult.newlyDeployed) {
    log(" - EstateSaleWithFee deployed at : " + deployResult.address + " for gas : " + deployResult.receipt.gasUsed);
  } else {
    log("reusing EstateSaleWithFee at " + deployResult.address);
  }
};
module.exports.skip = guard(["1", "4", "314159"]); // TODO EstateSaleWithFee');
