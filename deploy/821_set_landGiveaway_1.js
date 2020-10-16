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

  const isSANDEnabled = await read(landSaleName, "isSANDEnabled");
  if (!isSANDEnabled) {
    log("enabling SAND for LandGiveaway_1");
    const currentLandSaleAdmin = await read(landSaleName, "getAdmin");
    await execute(landSaleName, {from: currentLandSaleAdmin, skipUnknownSigner: true}, "setSANDEnabled", true);
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
module.exports.dependencies = ["Land", "LandGiveaway_1"];
