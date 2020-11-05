const {guard} = require("../lib");
const {starterPackPrices} = require("../data/starterPack");

module.exports = async ({getNamedAccounts, deployments}) => {
  const {deploy} = deployments;

  const {deployer, starterPackAdmin, starterPackSaleBeneficiary, backendMessageSigner} = await getNamedAccounts();

  const sandContract = await deployments.get("Sand");
  const daiContract = await deployments.get("DAI");
  const daiMedianizer = await deployments.get("DAIMedianizer");
  const catalystGroup = await deployments.get("Catalyst");
  const gemGroup = await deployments.get("Gem");

  await deploy("StarterPackV1", {
    from: deployer,
    args: [
      starterPackAdmin,
      sandContract.address,
      sandContract.address,
      starterPackSaleBeneficiary,
      daiMedianizer.address,
      daiContract.address,
      catalystGroup.address,
      gemGroup.address,
      backendMessageSigner,
      starterPackPrices,
    ],
    log: true,
  });
};

module.exports.skip = guard(["1", "4", "314159"]);
module.exports.tags = ["StarterPackV1"];
module.exports.dependencies = ["Sand", "DAI", "Catalyst", "Gem"];
