import {expect} from '../../chai-setup';
import {
  ethers,
  deployments,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {Contract} from 'ethers';
import {waitFor} from '../../utils';

type User = {
  address: string;
  MockLandWithMint: Contract;
};

const setupTest = deployments.createFixture(
  /*async (): Promise<{
    MockLandWithMint: Contract;
  }> => {
    await deployments.fixture('MockLandWithMint');
    const MockLandWithMint: Contract = await ethers.getContract(
      'MockLandWithMint'
    );*/
  async function () {
    await deployments.fixture(['MockLandWithMint']);

    const accounts = await getNamedAccounts();
    const others = await getUnnamedAccounts();
    const user0 = others[0];
    const user1 = others[1];

    const MockLandWithMint = await ethers.getContract('MockLandWithMint');
    await deployments.deploy('MockERC20BasicApprovalTarget', {
      from: accounts.deployer,
      args: [],
    });

    return {MockLandWithMint, accounts, others, user0, user1};
  }
);

describe('MockLandWithMint.sol', function () {
  /*describe('Deployment', function () {
    it('testing', async function () {
      const {MockLandWithMint} = await setupTest();
      const symbol = await MockLandWithMint.symbol();
      expect(symbol).to.equal(name);
    });
  });*/
  describe('Mint and transfer', function () {
    it('testing transferQuad', async function () {
      const {MockLandWithMint, user0, user1} = await setupTest();
      await waitFor(MockLandWithMint.mintQuad(user0, 12, 0, 0, ''));
      const num = await MockLandWithMint.balanceOf(user0);
      expect(num).to.equal(144);
      //await waitFor(MockLandWithMint.transferQuad(user0, user1, 12, 0, 0));
      //const num1 = await MockLandWithMint.balanceOf(user0);
      //expect(num1).to.equal(0);
      //const num2 = await MockLandWithMint.balanceOf(user1);
      //expect(num2).to.equal(144);
    });
  });

  describe('transfer batch', function () {
    it('testing batchTransferQuad', async function () {
      const {MockLandWithMint, user0, user1} = await setupTest();
      await waitFor(MockLandWithMint.mintQuad(user0, 24, 0, 0));
      await waitFor(MockLandWithMint.mintQuad(user0, 12, 300, 300));
      await waitFor(MockLandWithMint.mintQuad(user0, 6, 30, 30));
      await waitFor(MockLandWithMint.mintQuad(user0, 3, 24, 24));
      const num = await MockLandWithMint.balanceOf(user0);
      //expect(num).to.equal(720);
      await waitFor(
        MockLandWithMint.batchTransferQuad(
          user0,
          user1,
          [24, 12, 6, 3],
          [0, 300, 30, 24],
          [0, 300, 30, 24]
        )
      );
      const num1 = await MockLandWithMint.balanceOf(user0);
      expect(num1).to.equal(0);
      const num2 = await MockLandWithMint.balanceOf(user1);
      expect(num2).to.equal(765);
    });
  });
});

//address to, uint256 x, uint256 y, uint256 size, uint256 price

/*
batchTransferQuad(
        address from,
        address to,
        uint256[] calldata sizes,
        uint256[] calldata xs,
        uint256[] calldata ys,
        bytes calldata data
    ) external {
*/
