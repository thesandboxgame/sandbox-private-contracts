const {guard} = require("../lib");

module.exports = async ({getNamedAccounts, deployments}) => {
  const {deployIfDifferent, log} = deployments;
  const {deployer} = await getNamedAccounts();

  const asset = await deployments.get("Asset");
  const catalyst = await deployments.get("Catalyst");

  const catalystRegistry = await deployIfDifferent(
    ["data"],
    "CatalystRegistry",
    {from: deployer, gas: 3000000},
    "CatalystRegistry",
    asset.address,
    catalyst.address,
    deployer // is to to catalystRegistryAdmin later
  );
  if (catalystRegistry.newlyDeployed) {
    log(` - CatalystRegistry deployed at :  ${catalystRegistry.address} for gas: ${catalystRegistry.receipt.gasUsed}`);
  } else {
    log(`reusing CatalystRegistry at ${catalystRegistry.address}`);
  }
};
module.exports.skip = guard(["1", "4", "314159"]); // TODO
