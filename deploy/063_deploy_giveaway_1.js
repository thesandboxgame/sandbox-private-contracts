const {guard} = require("../lib");
const fs = require("fs");
const {getLands} = require("../data/LandGiveaway_1/getLands");
const {calculateLandHash} = require("../lib/merkleTreeHelper");

module.exports = async ({getChainId, getNamedAccounts, deployments, network}) => {
  const {deploy} = deployments;
  const chainId = await getChainId();

  const {deployer, landSaleBeneficiary, backendReferralWallet} = await getNamedAccounts();

  const sandContract = await deployments.get("Sand");
  const landContract = await deployments.get("Land");
  const estateContract = await deployments.get("Estate");
  const assetContract = await deployments.get("Asset");

  const daiMedianizer = await deployments.get("DAIMedianizer");
  const dai = await deployments.get("DAI");

  const {lands, merkleRootHash, saltedLands, tree} = getLands(network.live, chainId);

  await deploy("LandGiveaway_1", {
    from: deployer,
    gas: 3000000,
    linkedData: lands,
    contract: "EstateSale",
    args: [
      landContract.address,
      sandContract.address,
      sandContract.address,
      deployer,
      landSaleBeneficiary,
      merkleRootHash,
      1600007120, // TODO
      daiMedianizer.address,
      dai.address,
      backendReferralWallet,
      2000,
      estateContract.address,
      assetContract.address,
    ],
    log: true,
  });

  const landsWithProof = [];
  for (const land of saltedLands) {
    land.proof = tree.getProof(calculateLandHash(land));
    landsWithProof.push(land);
  }
  fs.writeFileSync(`./.presale_giveaway_1_proofs_${chainId}.json`, JSON.stringify(landsWithProof, null, "  "));
};
module.exports.skip = guard(["1", "4", "314159"]); // TODO , 'LandPreSale_5');
module.exports.tags = ["LandGiveaway_1"];
module.exports.dependencies = ["Sand", "Land", "DAI", "Asset", "Estate"];
