const {ethers, deployments, getNamedAccounts} = require("@nomiclabs/buidler");
const MerkleTree = require("../../../../lib/merkleTree");
const {createDataArray} = require("../../../../lib/merkleTreeHelper");
const {testLands, generateUserPermissions, setupUser} = require("../_testHelper");
const {findEvents} = require("../../../../lib/findEvents.js");

// Inputs
const maxCommissionRate = "2000";
const signer = "0x26BC52894A05EDE59B34EE7B014b57ef0a8558B3";
const contractName = "EstateSaleWithFee";

module.exports.setupEstateSale = async (landSaleName, landType, exactDeployment) => {
  const {
    userWithSAND,
    secondUserWithSAND,
    userWithoutSAND,
    userWithDAI,
    secondUserWithDAI,
    userWithoutDAI,
    LandSaleAdmin,
    LandSaleBeneficiary,
    LandAdmin,
    SandAdmin,
    DaiAdmin,
    users,
    contracts,
    lands,
    tree,
    saleEnd,
  } = await deployments.createFixture(async () => {
    await deployments.fixture();

    const roles = await getNamedAccounts();
    const {assetBouncerAdmin} = roles;
    const creator = roles.others[3];

    const asset = await ethers.getContract("Asset", assetBouncerAdmin);
    await asset.setBouncer(assetBouncerAdmin, true);

    const contracts = {
      landSale: await ethers.getContract(landSaleName, roles.landSaleAdmin),
      land: await ethers.getContract("Land"),
      estate: await ethers.getContract("Estate"),
      sand: await ethers.getContract("Sand"),
      asset,
      daiMedianizer: await ethers.getContract("DAIMedianizer"),
      dai: await ethers.getContract("DAI"),
    };
    const latestBlock = await ethers.provider.getBlock("latest");
    const saleStart = latestBlock.timestamp; // Math.floor(Date.now() / 1000); // TODO ? getChainCurrentTime();
    const saleDuration = 60 * 60;
    const saleEnd = saleStart + saleDuration;

    let tree;
    let lands;

    const assetAsCreator = await ethers.getContract("Asset", creator);
    const ipfsHash = "0x0000000000000000000000000000000000000000000000000000000000000001";
    const assetIds = [];
    const assetAmounts = [];
    async function mintAsset() {
      const mintReceipt = await contracts.asset.mint(creator, 0, ipfsHash, 200, 0, creator, "0x");
      const events = await findEvents(asset, "TransferSingle", mintReceipt.blockHash);
      const tokenId = events[0].args.id;
      const value = events[0].args.value;
      // const to = events[0].args.to;
      assetIds.push(tokenId);
      assetAmounts.push(value);
      // console.log({tokenId, value, to});
      return tokenId;
    }

    // Supply a tree made from real lands or testLands
    if (landType === "lands") {
      const deployment = await deployments.get(landSaleName);
      lands = deployment.linkedData;
      const landHashArray = createDataArray(lands);
      tree = new MerkleTree(landHashArray);
      if (exactDeployment) {
        contracts.estateSale = await ethers.getContract(landSaleName, roles.landSaleAdmin);
      }
    } else if (landType === "testLands") {
      testLands.forEach((testLand) => {
        testLand.assetIds = [];
      });
      testLands[0].reserved = roles.others[1];
      const tokenId = await mintAsset();
      testLands[5].assetIds = [tokenId];
      testLands[3].reserved = roles.others[1];
      lands = testLands;
      const testLandHashArray = createDataArray(lands);
      tree = new MerkleTree(testLandHashArray);
    }

    if (!exactDeployment || landType === "testLands") {
      const ethersFactory = await ethers.getContractFactory(contractName);

      const estateSaleContract = await ethersFactory.deploy(
        contracts.land.address,
        contracts.sand.address,
        contracts.sand.address,
        roles.landSaleAdmin,
        roles.landSaleBeneficiary,
        tree.getRoot().hash,
        saleEnd,
        signer,
        maxCommissionRate,
        contracts.estate.address,
        contracts.asset.address
      );

      contracts.estateSale = estateSaleContract.connect(estateSaleContract.provider.getSigner(roles.landSaleAdmin));
    }

    if (landType === "testLands") {
      await assetAsCreator.safeBatchTransferFrom(creator, contracts.estateSale.address, assetIds, assetAmounts, "0x");
    }

    const {LandSaleAdmin, LandSaleBeneficiary, LandAdmin, SandAdmin, DaiAdmin, users} = await generateUserPermissions(
      roles,
      contracts
    );
    await LandAdmin.Land.functions.setMinter(contracts.estateSale.address, true).then((tx) => tx.wait());
    await SandAdmin.Sand.functions.setSuperOperator(contracts.estateSale.address, true).then((tx) => tx.wait());

    const userWithSAND = await setupUser(contracts, SandAdmin, DaiAdmin, users[0], {hasSand: true, hasDAI: false});
    const secondUserWithSAND = await setupUser(contracts, SandAdmin, DaiAdmin, users[1], {
      hasSand: true,
      hasDAI: false,
    });
    const userWithoutSAND = users[2];

    const userWithDAI = await setupUser(contracts, SandAdmin, DaiAdmin, users[0], {hasSand: false, hasDAI: true});
    const secondUserWithDAI = await setupUser(contracts, SandAdmin, DaiAdmin, users[1], {hasSand: false, hasDAI: true});
    const userWithoutDAI = await setupUser(contracts, SandAdmin, DaiAdmin, users[2], {hasSand: false, hasDAI: false});

    return {
      userWithSAND,
      secondUserWithSAND,
      userWithoutSAND,
      userWithDAI,
      secondUserWithDAI,
      userWithoutDAI,
      LandSaleAdmin,
      LandSaleBeneficiary,
      LandAdmin,
      SandAdmin,
      DaiAdmin,
      users,
      contracts,
      lands,
      tree,
      saleEnd,
    };
  })();

  return {
    // User types
    userWithSAND,
    secondUserWithSAND,
    userWithoutSAND,
    userWithDAI,
    secondUserWithDAI,
    userWithoutDAI,
    LandSaleAdmin,
    LandSaleBeneficiary,
    LandAdmin,
    SandAdmin,
    DaiAdmin,
    users,

    // Contracts
    contracts,

    // Timing
    saleEnd,

    // Lands, tree
    lands,
    tree,
  };
};
