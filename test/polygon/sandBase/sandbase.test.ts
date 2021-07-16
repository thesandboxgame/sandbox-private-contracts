import {expect} from '../../chai-setup';
import {
  ethers,
  deployments,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {Contract, BigNumber} from 'ethers';
import {setupUser, setupUsers, waitFor} from '../../utils';

type User = {
  address: string;
  SandBaseToken: Contract;
};

const DECIMALS_18 = BigNumber.from('1000000000000000000');
const TOTAL_SUPPLY = DECIMALS_18.mul(3000000000);

const setupTest = deployments.createFixture(
  async (): Promise<{
    SandBaseToken: Contract;
    userWithSand: User;
    sandBeneficiary: User;
    usersWithoutSand: User[];
  }> => {
    await deployments.fixture('SandBaseToken');
    const SandBaseToken = await ethers.getContract('SandBaseToken');
    const unnamedAccounts = await getUnnamedAccounts();
    let usersWithoutSand = await setupUsers(unnamedAccounts, {SandBaseToken});
    const userWithSand = usersWithoutSand[0];
    usersWithoutSand = usersWithoutSand.slice(1);
    const namedAccounts = await getNamedAccounts();
    const sandBeneficiary = await setupUser(namedAccounts.sandBeneficiary, {
      SandBaseToken,
    });
    await waitFor(
      sandBeneficiary.SandBaseToken.transfer(
        userWithSand.address,
        DECIMALS_18.mul(500)
      )
    );
    return {SandBaseToken, userWithSand, sandBeneficiary, usersWithoutSand};
  }
);

describe('SandBaseToken.sol', function () {
  describe('Deployment', function () {
    it('total supply should be 3,000,000,000 * 10^18', async function () {
      const {SandBaseToken} = await setupTest();
      const totalSupply = await SandBaseToken.totalSupply();
      expect(totalSupply).to.equal(TOTAL_SUPPLY);
    });
  });

  describe('Transfers', function () {
    it('users should be able to transfer some of the token they have', async function () {
      const {SandBaseToken, userWithSand, usersWithoutSand} = await setupTest();
      const userWithoutSand = usersWithoutSand[0];
      const sandTransferValue = DECIMALS_18.mul(250);
      const balanceUserWithSandBefore = await SandBaseToken.balanceOf(
        userWithSand.address
      );
      const balanceUserWithoutSandBefore = await SandBaseToken.balanceOf(
        userWithoutSand.address
      );
      await userWithSand.SandBaseToken.transfer(
        userWithoutSand.address,
        sandTransferValue
      );
      const balanceUserWithSandAfter = await SandBaseToken.balanceOf(
        userWithSand.address
      );
      const balanceUserWithoutSandAfter = await SandBaseToken.balanceOf(
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
      const {SandBaseToken, userWithSand, usersWithoutSand} = await setupTest();
      const userWithoutSand = usersWithoutSand[0];
      const sandTransferValue = DECIMALS_18.mul(500);
      const balanceUserWithSandBefore = await SandBaseToken.balanceOf(
        userWithSand.address
      );
      const balanceUserWithoutSandBefore = await SandBaseToken.balanceOf(
        userWithoutSand.address
      );
      await userWithSand.SandBaseToken.transfer(
        userWithoutSand.address,
        sandTransferValue
      );
      const balanceUserWithSandAfter = await SandBaseToken.balanceOf(
        userWithSand.address
      );
      const balanceUserWithoutSandAfter = await SandBaseToken.balanceOf(
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
        userWithSand.SandBaseToken.transfer(
          userWithoutSand.address,
          sandTransferValue
        )
      ).to.be.revertedWith('INSUFFICIENT_FUNDS');
    });

    it('users should not be able to transfer token they dont have', async function () {
      const {userWithSand, usersWithoutSand} = await setupTest();
      const userWithoutSand = usersWithoutSand[0];
      const sandTransferValue = DECIMALS_18.mul(1);
      await expect(
        userWithoutSand.SandBaseToken.transfer(
          userWithSand.address,
          sandTransferValue
        )
      ).to.be.revertedWith('INSUFFICIENT_FUNDS');
    });

    it('users balance should not move if they transfer token to themselves', async function () {
      const {SandBaseToken, userWithSand} = await setupTest();
      const balanceUserWithsandBefore = await SandBaseToken.balanceOf(
        userWithSand.address
      );
      const sandTransferValue = DECIMALS_18.mul(200);
      userWithSand.SandBaseToken.transfer(
        userWithSand.address,
        sandTransferValue
      );
      const balanceUserWithSandAfter = await SandBaseToken.balanceOf(
        userWithSand.address
      );
      expect(balanceUserWithsandBefore).to.equal(balanceUserWithSandAfter);
    });

    it('total supply should not be affected by transfers', async function () {
      const {
        SandBaseToken,
        sandBeneficiary,
        userWithSand,
        usersWithoutSand,
      } = await setupTest();
      const sandTransferValue = DECIMALS_18.mul(200);
      sandBeneficiary.SandBaseToken.transfer(
        usersWithoutSand,
        sandTransferValue
      );
      userWithSand.SandBaseToken.transfer(usersWithoutSand, sandTransferValue);
      usersWithoutSand[0].SandBaseToken.transfer(
        usersWithoutSand,
        sandTransferValue
      );
      const totalSupply = await SandBaseToken.totalSupply();
      expect(totalSupply).to.equal(TOTAL_SUPPLY);
    });
  });

  describe('Allowance', function () {
    it('user should not be able to transfer more token than their allowance permit', async function () {
      const {userWithSand, usersWithoutSand} = await setupTest();
      const TOTAL_ALLOWANCE = DECIMALS_18.mul(250);
      const USED_ALLOWANCE = DECIMALS_18.mul(350);
      userWithSand.SandBaseToken.approve(
        usersWithoutSand[0].address,
        TOTAL_ALLOWANCE
      );
      await expect(
        usersWithoutSand[0].SandBaseToken.transferFrom(
          userWithSand.address,
          usersWithoutSand[1].address,
          USED_ALLOWANCE
        )
      ).to.be.revertedWith('NOT_AUTHORIZED_ALLOWANCE');
    });

    it('user should be able to transfer some of the amount permitted by their allowance', async function () {
      const {SandBaseToken, userWithSand, usersWithoutSand} = await setupTest();
      const TOTAL_ALLOWANCE = DECIMALS_18.mul(250);
      const TRANSFER = TOTAL_ALLOWANCE.sub(100);

      const allowanceApprover = userWithSand;
      const allowanceCarrier = usersWithoutSand[0];
      const allowanceReceiver = usersWithoutSand[1];

      allowanceApprover.SandBaseToken.approve(
        allowanceCarrier.address,
        TOTAL_ALLOWANCE
      );

      const senderBefore = await SandBaseToken.balanceOf(
        allowanceApprover.address
      );
      const receiverBefore = await SandBaseToken.balanceOf(
        allowanceCarrier.address
      );

      allowanceCarrier.SandBaseToken.transferFrom(
        allowanceApprover.address,
        allowanceReceiver.address,
        TRANSFER
      );

      const senderAfter = await SandBaseToken.balanceOf(
        allowanceApprover.address
      );
      const receiverAfter = await SandBaseToken.balanceOf(
        allowanceReceiver.address
      );

      expect(senderAfter).to.equal(senderBefore.sub(TRANSFER));
      expect(receiverAfter).to.equal(receiverBefore.add(TRANSFER));
      expect(receiverAfter).to.equal(TRANSFER);
    });

    it('user should be able to transfer all tokens that their allowance permit', async function () {
      const {SandBaseToken, userWithSand, usersWithoutSand} = await setupTest();
      const TOTAL_ALLOWANCE = DECIMALS_18.mul(250);
      const TRANSFER = TOTAL_ALLOWANCE;

      const allowanceApprover = userWithSand;
      const allowanceCarrier = usersWithoutSand[0];
      const allowanceReceiver = usersWithoutSand[1];

      allowanceApprover.SandBaseToken.approve(
        allowanceCarrier.address,
        TOTAL_ALLOWANCE
      );

      const senderBefore = await SandBaseToken.balanceOf(
        allowanceApprover.address
      );
      const receiverBefore = await SandBaseToken.balanceOf(
        allowanceCarrier.address
      );

      allowanceCarrier.SandBaseToken.transferFrom(
        allowanceApprover.address,
        allowanceReceiver.address,
        TRANSFER
      );

      const senderAfter = await SandBaseToken.balanceOf(
        allowanceApprover.address
      );
      const receiverAfter = await SandBaseToken.balanceOf(
        allowanceReceiver.address
      );

      expect(senderAfter).to.equal(senderBefore.sub(TRANSFER));
      expect(receiverAfter).to.equal(receiverBefore.add(TRANSFER));
      expect(receiverAfter).to.equal(TRANSFER);
    });
  });
});
