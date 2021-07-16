const {
  ethers,
  deployments,
  getNamedAccounts,
  getUnnamedAccounts,
} = require('hardhat');
const {waitFor, recurseTests} = require('../../../utils');
const generateERC20Tests = require('../../../erc20');

function testGem(gemName) {
  const erc20Tests = generateERC20Tests(
    async () => {
      const others = await getUnnamedAccounts();
      const {gemMinter} = await getNamedAccounts();
      await deployments.fixture('Gems');
      const contract = await ethers.getContract(gemName);

      function mint(to, amount) {
        return waitFor(
          contract
            .connect(ethers.provider.getSigner(gemMinter))
            .mint(to, amount)
        );
      }

      return {
        ethersProvider: ethers.provider,
        contractAddress: contract.address,
        users: others,
        mint,
      };
    },
    {
      EIP717: true,
      burn: false,
    }
  );

  describe(gemName, function () {
    for (const test of erc20Tests) {
      // eslint-disable-next-line mocha/no-setup-in-describe
      recurseTests(test);
    }
  });
}

testGem('Gem_POWER');
// testGem('Gem_DEFENSE');
// testGem('Gem_SPEED');
// testGem('Gem_MAGIC');
// testGem('Gem_LUCK');
