import {expect} from '../chai-setup';
import {
  ethers,
  deployments,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {Contract, BigNumber} from 'ethers';
import {setupUser, setupUsers, waitFor} from '../utils';

type User = {
  address: string;
  Sand: Contract;
};

const DECIMALS_18 = BigNumber.from('1000000000000000000');
const TOTAL_SUPPLY = DECIMALS_18.mul(3000000000);

const setupTest = deployments.createFixture(
  async (): Promise<{
    Sand: Contract;
    userWithSand: User;
    sandBeneficiary: User;
    usersWithoutSand: User[];
  }> => {
    await deployments.fixture('Sand');
    const Sand = await ethers.getContract('Sand');
    const unnamedAccounts = await getUnnamedAccounts();
    let usersWithoutSand = await setupUsers(unnamedAccounts, {Sand});
    const userWithSand = usersWithoutSand[0];
    usersWithoutSand = usersWithoutSand.slice(1);
    const namedAccounts = await getNamedAccounts();
    const sandBeneficiary = await setupUser(namedAccounts.sandBeneficiary, {
      Sand,
    });
    await waitFor(
      sandBeneficiary.Sand.transfer(userWithSand.address, DECIMALS_18.mul(500))
    );
    return {Sand, userWithSand, sandBeneficiary, usersWithoutSand};
  }
);

describe('Sand.sol', function () {
  describe('Deployment', function () {
    it('total supply should be 3,000,000,000 * 10^18', async function () {
      const {Sand} = await setupTest();
      const totalSupply = await Sand.totalSupply();
      expect(totalSupply).to.equal(TOTAL_SUPPLY);
    });
  });

  describe('Transfers', function () {
    it('users should be able to transfer some of the token they have', async function () {
      const {Sand, userWithSand, usersWithoutSand} = await setupTest();
      const userWithoutSand = usersWithoutSand[0];
      const sandTransferValue = DECIMALS_18.mul(250);
      const balanceUserWithSandBefore = await Sand.balanceOf(
        userWithSand.address
      );
      const balanceUserWithoutSandBefore = await Sand.balanceOf(
        userWithoutSand.address
      );
      await userWithSand.Sand.transfer(
        userWithoutSand.address,
        sandTransferValue
      );
      const balanceUserWithSandAfter = await Sand.balanceOf(
        userWithSand.address
      );
      const balanceUserWithoutSandAfter = await Sand.balanceOf(
        userWithoutSand.address
      );
      expect(balanceUserWithSandAfter).to.equal(
        balanceUserWithSandBefore.sub(sandTransferValue)
      );
      expect(balanceUserWithoutSandAfter).to.equal(
        balanceUserWithoutSandBefore.add(sandTransferValue)
      );
    });

    it('users should be able to transfer all token they have', async function () {
      const {Sand, userWithSand, usersWithoutSand} = await setupTest();
      const userWithoutSand = usersWithoutSand[0];
      const sandTransferValue = DECIMALS_18.mul(500);
      const balanceUserWithSandBefore = await Sand.balanceOf(
        userWithSand.address
      );
      const balanceUserWithoutSandBefore = await Sand.balanceOf(
        userWithoutSand.address
      );
      await userWithSand.Sand.transfer(
        userWithoutSand.address,
        sandTransferValue
      );
      const balanceUserWithSandAfter = await Sand.balanceOf(
        userWithSand.address
      );
      const balanceUserWithoutSandAfter = await Sand.balanceOf(
        userWithoutSand.address
      );
      expect(balanceUserWithSandAfter).to.equal(
        balanceUserWithSandBefore.sub(sandTransferValue)
      );
      expect(balanceUserWithoutSandAfter).to.equal(
        balanceUserWithoutSandBefore.add(sandTransferValue)
      );
      expect(balanceUserWithSandAfter).to.equal(0);
    });

    it('users should not be able to transfer more token than they have', async function () {
      const {userWithSand, usersWithoutSand} = await setupTest();
      const userWithoutSand = usersWithoutSand[0];
      const sandTransferValue = DECIMALS_18.mul(800);
      await expect(
        userWithSand.Sand.transfer(userWithoutSand.address, sandTransferValue)
      ).to.be.revertedWith('not enough fund');
    });

    it('users should not be able to transfer token they dont have', async function () {
      const {userWithSand, usersWithoutSand} = await setupTest();
      const userWithoutSand = usersWithoutSand[0];
      const sandTransferValue = DECIMALS_18.mul(1);
      await expect(
        userWithoutSand.Sand.transfer(userWithSand.address, sandTransferValue)
      ).to.be.revertedWith('not enough fund');
    });

    it('users balance should not move if they transfer token to themselves', async function () {
      const {Sand, userWithSand} = await setupTest();
      const balanceUserWithsandBefore = await Sand.balanceOf(
        userWithSand.address
      );
      const sandTransferValue = DECIMALS_18.mul(200);
      userWithSand.Sand.transfer(userWithSand.address, sandTransferValue);
      const balanceUserWithSandAfter = await Sand.balanceOf(
        userWithSand.address
      );
      expect(balanceUserWithsandBefore).to.equal(balanceUserWithSandAfter);
    });

    it('total supply should not be affected by transfers', async function () {
      const {
        Sand,
        sandBeneficiary,
        userWithSand,
        usersWithoutSand,
      } = await setupTest();
      const sandTransferValue = DECIMALS_18.mul(200);
      sandBeneficiary.Sand.transfer(usersWithoutSand, sandTransferValue);
      userWithSand.Sand.transfer(usersWithoutSand, sandTransferValue);
      usersWithoutSand[0].Sand.transfer(usersWithoutSand, sandTransferValue);
      const totalSupply = await Sand.totalSupply();
      expect(totalSupply).to.equal(TOTAL_SUPPLY);
    });
  });

  describe('Allowance', function () {
    it('user should not be able to transfer more token than their allowance permit', async function () {
      const {userWithSand, usersWithoutSand} = await setupTest();
      const TOTAL_ALLOWANCE = DECIMALS_18.mul(250);
      const USED_ALLOWANCE = DECIMALS_18.mul(350);
      userWithSand.Sand.approve(usersWithoutSand[0].address, TOTAL_ALLOWANCE);
      await expect(
        usersWithoutSand[0].Sand.transferFrom(
          userWithSand.address,
          usersWithoutSand[1].address,
          USED_ALLOWANCE
        )
      ).to.be.revertedWith('Not enough funds allowed');
    });

    it('user should be able to transfer some of the amount permitted by their allowance', async function () {
      const {Sand, userWithSand, usersWithoutSand} = await setupTest();
      const TOTAL_ALLOWANCE = DECIMALS_18.mul(250);
      const TRANSFER = TOTAL_ALLOWANCE.sub(100);

      const allowanceApprover = userWithSand;
      const allowanceCarrier = usersWithoutSand[0];
      const allowanceReceiver = usersWithoutSand[1];

      allowanceApprover.Sand.approve(allowanceCarrier.address, TOTAL_ALLOWANCE);

      const senderBefore = await Sand.balanceOf(allowanceApprover.address);
      const receiverBefore = await Sand.balanceOf(allowanceCarrier.address);

      allowanceCarrier.Sand.transferFrom(
        allowanceApprover.address,
        allowanceReceiver.address,
        TRANSFER
      );

      const senderAfter = await Sand.balanceOf(allowanceApprover.address);
      const receiverAfter = await Sand.balanceOf(allowanceReceiver.address);

      expect(senderAfter).to.equal(senderBefore.sub(TRANSFER));
      expect(receiverAfter).to.equal(receiverBefore.add(TRANSFER));
      expect(receiverAfter).to.equal(TRANSFER);
    });

    it('user should be able to transfer all tokens that their allowance permit', async function () {
      const {Sand, userWithSand, usersWithoutSand} = await setupTest();
      const TOTAL_ALLOWANCE = DECIMALS_18.mul(250);
      const TRANSFER = TOTAL_ALLOWANCE;

      const allowanceApprover = userWithSand;
      const allowanceCarrier = usersWithoutSand[0];
      const allowanceReceiver = usersWithoutSand[1];

      allowanceApprover.Sand.approve(allowanceCarrier.address, TOTAL_ALLOWANCE);

      const senderBefore = await Sand.balanceOf(allowanceApprover.address);
      const receiverBefore = await Sand.balanceOf(allowanceCarrier.address);

      allowanceCarrier.Sand.transferFrom(
        allowanceApprover.address,
        allowanceReceiver.address,
        TRANSFER
      );

      const senderAfter = await Sand.balanceOf(allowanceApprover.address);
      const receiverAfter = await Sand.balanceOf(allowanceReceiver.address);

      expect(senderAfter).to.equal(senderBefore.sub(TRANSFER));
      expect(receiverAfter).to.equal(receiverBefore.add(TRANSFER));
      expect(receiverAfter).to.equal(TRANSFER);
    });
  });
});
