module.exports = async ({deployments}) => {
  const {read, execute, log} = deployments;
  const starterPack = await deployments.get("StarterPackV1");

  const isSandSuperOperator = await read("Sand", "isSuperOperator", starterPack.address);
  if (!isSandSuperOperator) {
    log("setting StarterPackV1 as super operator for Sand");
    const currentSandAdmin = await read("Sand", "getAdmin");
    await execute(
      "Sand",
      {from: currentSandAdmin, skipUnknownSigner: true},
      "setSuperOperator",
      starterPack.address,
      true
    );
  }
};
module.exports.skip = () => true;
