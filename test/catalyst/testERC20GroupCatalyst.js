const {ethers, getNamedAccounts, ethereum} = require("@nomiclabs/buidler");
const erc20GroupTests = require("../erc20Group")(
  async () => {
    const {others, catalystMinter} = await getNamedAccounts();

    await deployments.fixture();

    const contract = await ethers.getContract("Catalyst", catalystMinter);

    // Catalyst ERC20SubToken contracts: "Common", "Rare", "Epic", "Legendary"
    const ERC20SubTokenCommon = await ethers.getContract("CommonCatalyst");
    const ERC20SubTokenRare = await ethers.getContract("RareCatalyst");
    const ERC20SubTokenEpic = await ethers.getContract("EpicCatalyst");
    const ERC20SubTokenLegendary = await ethers.getContract("LegendaryCatalyst");

    const tokenByIds = [ERC20SubTokenCommon, ERC20SubTokenRare, ERC20SubTokenEpic, ERC20SubTokenLegendary];

    const sandContract = await ethers.getContract("Sand");

    const catalystMinterContract = await ethers.getContract("CatalystMinter", catalystMinter);

    async function mint(to, amount) {
      const tx = await contract.mint(to, 1, amount);
      const receipt = await tx.wait();
      return {receipt};
    }
    async function batchMint(to, amount, ids) {
      const tx = await contract.batchMint(to, ids || [1, 2, 3], amount);
      const receipt = await tx.wait();
      return {receipt};
    }
    return {
      ethereum,
      contractAddress: contract.address,
      minter: catalystMinter,
      minterContract: catalystMinterContract,
      users: others,
      meta: sandContract.address,
      sandContract,
      mint,
      batchMint,
      tokenByIds,
      ERC20SubToken: ERC20SubTokenRare, // index 1
      secondERC20SubToken: ERC20SubTokenEpic, // index 2
      thirdERC20SubToken: ERC20SubTokenLegendary, // index 3
    };
  },
  {
    burn: true,
    fee: true,
  }
);

function recurse(test) {
  if (test.subTests) {
    // eslint-disable-next-line mocha/no-setup-in-describe
    describe(test.title, function () {
      // eslint-disable-next-line mocha/no-setup-in-describe
      for (const subTest of test.subTests) {
        // eslint-disable-next-line mocha/no-setup-in-describe
        recurse(subTest);
      }
    });
  } else {
    it(test.title, test.test);
  }
}

describe("Catalysts:ERC20Group", function () {
  for (const test of erc20GroupTests) {
    // eslint-disable-next-line mocha/no-setup-in-describe
    recurse(test);
  }
});
