const {guard} = require("../lib");
module.exports = async ({getNamedAccounts, deployments}) => {
  const {read, execute, log} = deployments;

  const {landSaleAdmin} = await getNamedAccounts();

  const landSaleName = "LandGiveaway_1";
  const landSale = await deployments.get(landSaleName);

  const isMinter = await read("Land", "isMinter", landSale.address);
  if (!isMinter) {
    log("setting LandGiveaway_1 as Land minter");
    const currentLandAdmin = await read("Land", "getAdmin");
    await execute("Land", {from: currentLandAdmin, skipUnknownSigner: true}, "setMinter", landSale.address, true);
  }

  const currentAdmin = await read(landSaleName, "getAdmin");
  if (currentAdmin.toLowerCase() !== landSaleAdmin.toLowerCase()) {
    log("setting LandGiveaway_1 Admin");
    await execute(landSaleName, {from: currentAdmin, skipUnknownSigner: true}, "changeAdmin", landSaleAdmin);
  }

  const isSandSuperOperator = await read("Sand", "isSuperOperator", landSale.address);
  if (!isSandSuperOperator) {
    log("setting LandGiveaway_1 as super operator for Sand");
    const currentSandAdmin = await read("Sand", "getAdmin");
    await execute(
      "Sand",
      {from: currentSandAdmin, skipUnknownSigner: true},
      "setSuperOperator",
      landSale.address,
      true
    );
  }
};
module.exports.skip = guard(["1", "4", "314159"]); // TODO remove
module.exports.dependencies = ["Land", "LandGiveaway_1"];
