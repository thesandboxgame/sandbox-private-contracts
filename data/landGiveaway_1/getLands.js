const fs = require("fs");
const MerkleTree = require("../../lib/merkleTree");
const {createDataArray, saltLands} = require("../../lib/merkleTreeHelper");
const rawSector = require("./sector10.json");
const prices = require("./prices");
const addresses = require("../addresses.json");
const bundles = require("./sector10.bundles.json");

const sandboxWallet = addresses["sandbox"];

let errors = false;
function reportError(e) {
  errors = true;
  console.error(e);
}

function exitIfError() {
  if (errors) {
    process.exit(1);
  }
}

function generateLandsForMerkleTree() {
  const partnersLands = [];
  const lands = [];
  let numLands = 0;
  let numLandsInInput = 0;
  let num1x1Lands = 0;
  let num3x3Lands = 0;
  let num6x6Lands = 0;
  let num12x12Lands = 0;
  let num24x24Lands = 0;
  let numSandboxReservedGroups = 0;
  let numSandboxReserved = 0;
  let numReserved = 0;
  let numReservedGroup = 0;
  let numBundles = 0;

  function addLandGroup(landGroup) {
    const size = Math.sqrt(landGroup.numLands);
    if (size * size !== landGroup.numLands) {
      reportError("wrong number of land ", landGroup.numLands);
    }

    let assetIds = [];
    if (landGroup.bundleId) {
      assetIds = bundles[landGroup.bundleId];
      numBundles++;
    }
    if (!assetIds) {
      throw new Error("assetIds cannot be undefined");
    }

    const premium = assetIds.length > 0;
    if (size === 1) {
      num1x1Lands++;
      priceId = (premium ? "premium_" : "") + "1x1";
    } else if (size === 3) {
      num3x3Lands++;
      priceId = (premium ? "premium_" : "") + "3x3";
    } else if (size === 6) {
      num6x6Lands++;
      priceId = (premium ? "premium_" : "") + "6x6";
    } else if (size === 12) {
      num12x12Lands++;
      priceId = (premium ? "premium_" : "") + "12x12";
    } else if (size === 24) {
      num24x24Lands++;
      priceId = (premium ? "premium_" : "") + "24x24";
    } else {
      reportError("wrong size : " + size);
    }
    const price = prices[priceId];
    if (!price) {
      reportError("no price for size = " + size);
    }

    if (!(landGroup.x % size === 0 && landGroup.y % size === 0)) {
      reportError("invalid coordinates: " + JSON.stringify({x: landGroup.x, y: landGroup.y, size}));
    }

    if (landGroup.x < 0 || landGroup.x >= 408) {
      reportError("wrong x : " + landGroup.x);
    }
    if (landGroup.y < 0 || landGroup.y >= 408) {
      reportError("wrong y : " + landGroup.y);
    }

    if (landGroup.reserved) {
      numReservedGroup++;
      numReserved += size * size;
      if (landGroup.reserved.toLowerCase() === sandboxWallet.toLowerCase()) {
        numSandboxReservedGroups++;
        numSandboxReserved += size * size;
      }
      const name = "unknown : " + landGroup.reserved;
      // switch (land.reserved) {
      //     case '':
      //     default:
      //         reportError('partner not expected: ' + land.name);
      // }
      partnersLands.push({
        x: landGroup.x,
        y: landGroup.x,
        originalX: landGroup.originalX,
        originalY: landGroup.originalY,
        name,
        size,
        price,
        reserved: landGroup.reserved,
        assetIds,
      });
    }
    lands.push({
      x: landGroup.x,
      y: landGroup.y,
      size,
      price,
      reserved: landGroup.reserved,
      assetIds,
    });
    numLands += size * size;
  }

  for (const land of rawSector.lands) {
    const x = land.coordinateX + 204;
    const y = land.coordinateY + 204;
    numLandsInInput++;
    addLandGroup({
      x,
      y,
      numLands: 1,
      reserved: land.ownerAddress,
      originalX: land.coordinateX,
      originalY: land.coordinateY,
      bundleId: land.bundleId,
    });
  }

  for (const estate of rawSector.estates) {
    const x = estate.coordinateX + 204;
    const y = estate.coordinateY + 204;
    numLandsInInput += estate.lands.length;
    addLandGroup({
      x,
      y,
      numLands: estate.lands.length,
      reserved: estate.ownerAddress,
      originalX: estate.coordinateX,
      originalY: estate.coordinateY,
      bundleId: estate.bundleId,
    });
  }

  // TODO debug option
  if (false) {
    console.log({
      numGroups: lands.length,
      numLandsInOutput: numLands,
      numLandsInInput,
      num1x1Lands,
      num3x3Lands,
      num6x6Lands,
      num12x12Lands,
      num24x24Lands,
      numSandboxReservedGroups,
      numSandboxReserved,
      numReserved,
      numReservedGroup,
      numBundles,
    });
  }
  exitIfError();
  return {lands, partnersLands};
}

const {lands, partnersLands} = generateLandsForMerkleTree();

module.exports = {
  getLands: (isDeploymentChainId, chainId) => {
    if (typeof chainId !== "string") {
      throw new Error("chainId not a string");
    }

    let secretPath = "./.land_presale_4_1_secret";
    if (chainId === "1") {
      console.log("MAINNET secret");
      secretPath = "./.land_presale_4_1_secret.mainnet";
    }

    let expose = false;
    let secret;
    try {
      secret = fs.readFileSync(secretPath);
    } catch (e) {
      if (isDeploymentChainId) {
        throw e;
      }
      secret = "0x4467363716526536535425451427798982881775318563547751090997863683";
    }

    if (!isDeploymentChainId) {
      expose = true;
    }

    const saltedLands = saltLands(lands, secret);
    const tree = new MerkleTree(createDataArray(saltedLands));
    const merkleRootHash = tree.getRoot().hash;

    // const landsWithProof = [];
    // for (const land of saltedLands) {
    //     land.proof = tree.getProof(calculateLandHash(land));
    //     landsWithProof.push(land);
    // }

    return {
      lands: expose ? saltedLands : lands,
      merkleRootHash,
      saltedLands,
      tree,
      // landsWithProof,
    };
  },
  nonExposedLands: lands,
  partnersLands,
};
