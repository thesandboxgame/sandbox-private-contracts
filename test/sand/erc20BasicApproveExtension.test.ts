import {ethers} from 'hardhat';
import {setupERC20BasicApproveExtension} from './fixtures';
import {BigNumber, constants, Contract} from 'ethers';
import {toWei, waitFor} from '../utils';
import {expect} from '../chai-setup';
import {transferSand} from '../polygon/catalyst/utils';
import MerkleTree = require('../../lib/merkleTree');
import MerkleTreeHelper, {SaltedSaleLandInfo} from '../../lib/merkleTreeHelper';

const zeroAddress = constants.AddressZero;

function zeroPadding(s: string) {
  return '0'.repeat(64 - s.length) + s;
}

async function testFunction(
  sandContract: Contract,
  senderAddress: string,
  targetAddress: string,
  approvalAmount: BigNumber,
  senderEthBalanceBefore: BigNumber,
  targetEthBalanceBefore: BigNumber,
  txValue: BigNumber,
  txFee: BigNumber,
  expectedReturnData: string,
  returnData: string
) {
  const allowance = await sandContract.allowance(senderAddress, targetAddress);
  const senderEthBalanceAfter = await ethers.provider.getBalance(senderAddress);
  const targetEthBalanceAfter = await ethers.provider.getBalance(targetAddress);
  expect(targetEthBalanceAfter).to.equal(targetEthBalanceBefore.add(txValue));
  expect(senderEthBalanceAfter).to.equal(
    senderEthBalanceBefore.sub(txValue).sub(txFee)
  );
  expect(allowance).to.equal(approvalAmount);
  expect(returnData.toLowerCase()).to.equal(expectedReturnData.toLowerCase());
}

describe('ERC20BasicApproveExtension', function () {
  it('ApproveAndCall calling buyLandWithSand', async function () {
    const {
      landContract,
      lands,
      landSaleContract,
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const emptyReferral = '0x';
    const secret =
      '0x4467363716526536535425451427798982881775318563547751090997863683';
    const saltedLands = MerkleTreeHelper.saltLands(lands, secret);
    const landHashArray = MerkleTreeHelper.createDataArray(saltedLands);
    const land = saltedLands
      .filter((l: SaltedSaleLandInfo) => l.size === 6)
      .find((l: SaltedSaleLandInfo) => !l.reserved);

    expect(land).to.not.be.equal(undefined);
    if (land !== undefined) {
      const tree = new MerkleTree(landHashArray);
      const proof = tree.getProof(MerkleTreeHelper.calculateLandHash(land));
      const totalSandBalance = BigNumber.from(100000).mul(
        `1000000000000000000`
      );
      const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
      const encodedABI = await landSaleContract.populateTransaction.buyLandWithSand(
        user0,
        user0,
        zeroAddress,
        land.x,
        land.y,
        land.size,
        land.price,
        land.price,
        land.salt,
        [],
        proof,
        emptyReferral
      );
      expect(encodedABI.data).to.not.be.equal(undefined);
      if (encodedABI.data) {
        await transferSand(sandContract, user0, totalSandBalance);
        const txValue = toWei(0);
        await waitFor(
          sandContractAsUser0.approveAndCall(
            landSaleContract.address,
            approvalAmount,
            encodedABI.data,
            {value: txValue}
          )
        );
        const landMintingEvents = await landContract.queryFilter(
          landContract.filters.Transfer()
        );
        expect(landMintingEvents).to.not.equal(undefined);
        if (landMintingEvents) {
          for (let i = 0; i < landMintingEvents.length; i++) {
            expect(landMintingEvents[i].args).to.not.equal(undefined);
            if (landMintingEvents[i].args !== undefined) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              expect(landMintingEvents[i].args![0]).to.equal(zeroAddress);
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              expect(landMintingEvents[i].args![1]).to.equal(user0);
            }
          }
        }
      }
    }
  });
  it('ApproveAndCall should fail for input data too short', async function () {
    const {
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const function4BytesId = '11111111';
    const data = `${function4BytesId}`;
    await transferSand(sandContract, user0, totalSandBalance);
    await expect(
      sandContractAsUser0.approveAndCall(
        zeroAddress,
        approvalAmount,
        Buffer.from(data, 'hex')
      )
    ).to.be.revertedWith(`first param != sender`);
  });
  it('ApproveAndCall should fail for first parameter != sender', async function () {
    const {
      sandContractAsUser0,
      sandContract,
      user0,
      user1,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const function4BytesId = '11111111';
    const paddedAddress = zeroPadding(user1.substring(2));
    const paddedZeros = zeroPadding('0');
    const data = `${function4BytesId}${paddedAddress}${paddedZeros}`;
    await transferSand(sandContract, user0, totalSandBalance);
    await expect(
      sandContractAsUser0.approveAndCall(
        zeroAddress,
        approvalAmount,
        Buffer.from(data, 'hex')
      )
    ).to.be.revertedWith(`first param != sender`);
  });
  it('ApproveAndCall should fail for zero data', async function () {
    const {
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const data = zeroPadding('0');
    await transferSand(sandContract, user0, totalSandBalance);
    await expect(
      sandContractAsUser0.approveAndCall(
        zeroAddress,
        approvalAmount,
        Buffer.from(data, 'hex')
      )
    ).to.be.revertedWith(`first param != sender`);
  });
  it('ApproveAndCall should fail for Approving the zeroAddress', async function () {
    const {
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const function4BytesId = '11111111';
    const paddedMsgSender = zeroPadding(user0.substring(2));
    const paddedZeros = zeroPadding('0');
    const data = `${function4BytesId}${paddedMsgSender}${paddedZeros}`;
    await transferSand(sandContract, user0, totalSandBalance);
    await expect(
      sandContractAsUser0.approveAndCall(
        zeroAddress,
        approvalAmount,
        Buffer.from(data, 'hex')
      )
    ).to.be.revertedWith(`Cannot approve with 0x0`);
  });
  it('ApproveAndCall should work for target = EOA with ether value = 1', async function () {
    const {
      sandContractAsUser0,
      sandContract,
      user0,
      user1,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const function4BytesId = '11111111';
    const paddedMsgSender = zeroPadding(user0.substring(2));
    const paddedZeros = zeroPadding('0');
    const data = `${function4BytesId}${paddedMsgSender}${paddedZeros}`;
    await transferSand(sandContract, user0, totalSandBalance);
    const senderEthBalanceBefore = await ethers.provider.getBalance(user0);
    const targetEthBalanceBefore = await ethers.provider.getBalance(user1);
    const txValue = toWei(1);
    const returnData = await sandContractAsUser0.callStatic.approveAndCall(
      user1,
      approvalAmount,
      Buffer.from(data, 'hex')
    );
    const tx = await sandContractAsUser0.approveAndCall(
      user1,
      approvalAmount,
      Buffer.from(data, 'hex'),
      {value: txValue}
    );
    const receipt = await tx.wait();
    const txFee = tx.gasPrice.mul(receipt.gasUsed);

    await testFunction(
      sandContract,
      user0,
      user1,
      approvalAmount,
      senderEthBalanceBefore,
      targetEthBalanceBefore,
      txValue,
      txFee,
      '0x',
      returnData
    );
  });
  it('ApproveAndCall should work for target = EOA with ether value = 0', async function () {
    const {
      sandContractAsUser0,
      sandContract,
      user0,
      user1,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const function4BytesId = '11111111';
    const paddedMsgSender = zeroPadding(user0.substring(2));
    const paddedZeros = zeroPadding('0');
    const data = `${function4BytesId}${paddedMsgSender}${paddedZeros}`;
    await transferSand(sandContract, user0, totalSandBalance);
    const senderEthBalanceBefore = await ethers.provider.getBalance(user0);
    const targetEthBalanceBefore = await ethers.provider.getBalance(user1);
    const txValue = toWei(0);
    const returnData = await sandContractAsUser0.callStatic.approveAndCall(
      user1,
      approvalAmount,
      Buffer.from(data, 'hex')
    );
    const tx = await sandContractAsUser0.approveAndCall(
      user1,
      approvalAmount,
      Buffer.from(data, 'hex'),
      {value: txValue}
    );
    const receipt = await tx.wait();
    const txFee = tx.gasPrice.mul(receipt.gasUsed);

    await testFunction(
      sandContract,
      user0,
      user1,
      approvalAmount,
      senderEthBalanceBefore,
      targetEthBalanceBefore,
      txValue,
      txFee,
      '0x',
      returnData
    );
  });
  it('ApproveAndCall for an empty contract as a target should revert', async function () {
    const {
      emptyContract,
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const function4BytesId = '11111111';
    const paddedMsgSender = zeroPadding(user0.substring(2));
    const paddedZeros = zeroPadding('0');
    const data = `${function4BytesId}${paddedMsgSender}${paddedZeros}`;
    await transferSand(sandContract, user0, totalSandBalance);
    const txValue = toWei(0);

    await expect(
      sandContractAsUser0.approveAndCall(
        emptyContract.address,
        approvalAmount,
        Buffer.from(data, 'hex'),
        {value: txValue}
      )
    ).to.be.reverted;
  });
  it('ApproveAndCall calling logOnCall of a mock contract', async function () {
    const {
      mockERC20BasicApprovalTarget,
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const encodedABI = await mockERC20BasicApprovalTarget.populateTransaction.logOnCall(
      user0
    );
    const senderEthBalanceBefore = await ethers.provider.getBalance(user0);
    const targetEthBalanceBefore = await ethers.provider.getBalance(
      mockERC20BasicApprovalTarget.address
    );
    expect(encodedABI.data).to.not.be.equal(undefined);
    if (encodedABI.data) {
      const function4BytesId = encodedABI.data.substring(2, 10);
      const paddedMsgSender = zeroPadding(user0.substring(2));
      const paddedZeros = zeroPadding('0');
      const data = `${function4BytesId}${paddedMsgSender}${paddedZeros}`;
      await transferSand(sandContract, user0, totalSandBalance);

      const txValue = toWei(0);

      const returnData = await sandContractAsUser0.callStatic.approveAndCall(
        mockERC20BasicApprovalTarget.address,
        approvalAmount,
        Buffer.from(data, 'hex')
      );

      const tx = await sandContractAsUser0.approveAndCall(
        mockERC20BasicApprovalTarget.address,
        approvalAmount,
        Buffer.from(data, 'hex'),
        {value: txValue}
      );
      const receipt = await tx.wait();
      const txFee = tx.gasPrice.mul(receipt.gasUsed);

      const events = await mockERC20BasicApprovalTarget.queryFilter(
        mockERC20BasicApprovalTarget.filters.LogOnCall()
      );
      const event = events.filter((e) => e.event === 'LogOnCall')[0];
      expect(event.args).not.to.equal(null || undefined);
      if (event.args) {
        expect(event.args[0]).to.equal(user0);
      }
      await testFunction(
        sandContract,
        user0,
        mockERC20BasicApprovalTarget.address,
        approvalAmount,
        senderEthBalanceBefore,
        targetEthBalanceBefore,
        txValue,
        txFee,
        '0x' + paddedMsgSender,
        returnData
      );
    }
  });
  it('ApproveAndCall with only one parameter should fail', async function () {
    const {
      mockERC20BasicApprovalTarget,
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const encodedABI = await mockERC20BasicApprovalTarget.populateTransaction.logOnCall(
      user0
    );
    expect(encodedABI.data).to.not.be.equal(undefined);
    if (encodedABI.data) {
      const function4BytesId = encodedABI.data.substring(2, 10);
      const paddedMsgSender = zeroPadding(user0.substring(2));
      const data = `${function4BytesId}${paddedMsgSender}`;
      await transferSand(sandContract, user0, totalSandBalance);

      const txValue = toWei(0);

      expect(
        sandContractAsUser0.approveAndCall(
          mockERC20BasicApprovalTarget.address,
          approvalAmount,
          Buffer.from(data, 'hex'),
          {value: txValue}
        )
      ).to.be.revertedWith('first param != sender');
    }
  });
  it('ApproveAndCall calling revertOnCall of a mock contract should fail', async function () {
    const {
      mockERC20BasicApprovalTarget,
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const encodedABI = await mockERC20BasicApprovalTarget.populateTransaction.revertOnCall();
    expect(encodedABI.data).to.not.be.equal(undefined);
    if (encodedABI.data) {
      const totalSandBalance = BigNumber.from(100000).mul(
        `1000000000000000000`
      );
      const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
      const function4BytesId = encodedABI.data.substring(2);
      const paddedMsgSender = zeroPadding(user0.substring(2));
      const paddedZeros = zeroPadding('0');
      const data = `${function4BytesId}${paddedMsgSender}${paddedZeros}`;
      await transferSand(sandContract, user0, totalSandBalance);
      const txValue = toWei(0);

      await expect(
        sandContractAsUser0.approveAndCall(
          mockERC20BasicApprovalTarget.address,
          approvalAmount,
          Buffer.from(data, 'hex'),
          {value: txValue}
        )
      ).to.be.revertedWith('REVERT_ON_CALL');
    }
  });
  it('PaidCall calling buyLandWithSand', async function () {
    const {
      landContract,
      lands,
      landSaleContract,
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const emptyReferral = '0x';
    const secret =
      '0x4467363716526536535425451427798982881775318563547751090997863683';
    const saltedLands = MerkleTreeHelper.saltLands(lands, secret);
    const landHashArray = MerkleTreeHelper.createDataArray(saltedLands);
    const land = saltedLands
      .filter((l: SaltedSaleLandInfo) => l.size === 6)
      .find((l: SaltedSaleLandInfo) => !l.reserved);

    expect(land).to.not.be.equal(undefined);
    if (land !== undefined) {
      const tree = new MerkleTree(landHashArray);
      const proof = tree.getProof(MerkleTreeHelper.calculateLandHash(land));
      const totalSandBalance = BigNumber.from(100000).mul(
        `1000000000000000000`
      );
      const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
      const encodedABI = await landSaleContract.populateTransaction.buyLandWithSand(
        user0,
        user0,
        zeroAddress,
        land.x,
        land.y,
        land.size,
        land.price,
        land.price,
        land.salt,
        [],
        proof,
        emptyReferral
      );
      expect(encodedABI.data).to.not.be.equal(undefined);
      if (encodedABI.data) {
        await transferSand(sandContract, user0, totalSandBalance);
        const txValue = toWei(0);
        await waitFor(
          sandContractAsUser0.paidCall(
            landSaleContract.address,
            approvalAmount,
            encodedABI.data,
            {value: txValue}
          )
        );
        const landMintingEvents = await landContract.queryFilter(
          landContract.filters.Transfer()
        );
        expect(landMintingEvents).to.not.equal(undefined);
        if (landMintingEvents) {
          for (let i = 0; i < landMintingEvents.length; i++) {
            expect(landMintingEvents[i].args).to.not.equal(undefined);
            if (landMintingEvents[i].args !== undefined) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              expect(landMintingEvents[i].args![0]).to.equal(zeroAddress);
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              expect(landMintingEvents[i].args![1]).to.equal(user0);
            }
          }
        }
      }
    }
  });
  it('PaidCall should fail for input data too short', async function () {
    const {
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const function4BytesId = '11111111';
    const data = `${function4BytesId}`;
    await transferSand(sandContract, user0, totalSandBalance);
    await expect(
      sandContractAsUser0.paidCall(
        zeroAddress,
        approvalAmount,
        Buffer.from(data, 'hex')
      )
    ).to.be.revertedWith(`first param != sender`);
  });
  it('PaidCall should fail for first parameter != sender', async function () {
    const {
      sandContractAsUser0,
      sandContract,
      user0,
      user1,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const function4BytesId = '11111111';
    const paddedAddress = zeroPadding(user1.substring(2));
    const paddedZeros = zeroPadding('0');
    const data = `${function4BytesId}${paddedAddress}${paddedZeros}`;
    await transferSand(sandContract, user0, totalSandBalance);
    await expect(
      sandContractAsUser0.paidCall(
        zeroAddress,
        approvalAmount,
        Buffer.from(data, 'hex')
      )
    ).to.be.revertedWith(`first param != sender`);
  });
  it('PaidCall should fail for zero data', async function () {
    const {
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const data = zeroPadding('0');
    await transferSand(sandContract, user0, totalSandBalance);
    await expect(
      sandContractAsUser0.paidCall(
        zeroAddress,
        approvalAmount,
        Buffer.from(data, 'hex')
      )
    ).to.be.revertedWith(`first param != sender`);
  });
  it('PaidCall should fail for Approving the zeroAddress', async function () {
    const {
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const function4BytesId = '11111111';
    const paddedMsgSender = zeroPadding(user0.substring(2));
    const paddedZeros = zeroPadding('0');
    const data = `${function4BytesId}${paddedMsgSender}${paddedZeros}`;
    await transferSand(sandContract, user0, totalSandBalance);
    await expect(
      sandContractAsUser0.paidCall(
        zeroAddress,
        approvalAmount,
        Buffer.from(data, 'hex')
      )
    ).to.be.revertedWith(`Cannot approve with 0x0`);
  });
  it('PaidCall should work for target = EOA with ether value = 1', async function () {
    const {
      sandContractAsUser0,
      sandContract,
      user0,
      user1,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const function4BytesId = '11111111';
    const paddedMsgSender = zeroPadding(user0.substring(2));
    const paddedZeros = zeroPadding('0');
    const data = `${function4BytesId}${paddedMsgSender}${paddedZeros}`;
    await transferSand(sandContract, user0, totalSandBalance);
    const senderEthBalanceBefore = await ethers.provider.getBalance(user0);
    const targetEthBalanceBefore = await ethers.provider.getBalance(user1);
    const txValue = toWei(1);
    const returnData = await sandContractAsUser0.callStatic.paidCall(
      user1,
      approvalAmount,
      Buffer.from(data, 'hex')
    );
    const tx = await sandContractAsUser0.paidCall(
      user1,
      approvalAmount,
      Buffer.from(data, 'hex'),
      {value: txValue}
    );
    const receipt = await tx.wait();
    const txFee = tx.gasPrice.mul(receipt.gasUsed);

    await testFunction(
      sandContract,
      user0,
      user1,
      approvalAmount,
      senderEthBalanceBefore,
      targetEthBalanceBefore,
      txValue,
      txFee,
      '0x',
      returnData
    );
  });
  it('PaidCall should work for target = EOA with ether value = 0', async function () {
    const {
      sandContractAsUser0,
      sandContract,
      user0,
      user1,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const function4BytesId = '11111111';
    const paddedMsgSender = zeroPadding(user0.substring(2));
    const paddedZeros = zeroPadding('0');
    const data = `${function4BytesId}${paddedMsgSender}${paddedZeros}`;
    await transferSand(sandContract, user0, totalSandBalance);
    const senderEthBalanceBefore = await ethers.provider.getBalance(user0);
    const targetEthBalanceBefore = await ethers.provider.getBalance(user1);
    const txValue = toWei(0);
    const returnData = await sandContractAsUser0.callStatic.paidCall(
      user1,
      approvalAmount,
      Buffer.from(data, 'hex')
    );
    const tx = await sandContractAsUser0.paidCall(
      user1,
      approvalAmount,
      Buffer.from(data, 'hex'),
      {value: txValue}
    );
    const receipt = await tx.wait();
    const txFee = tx.gasPrice.mul(receipt.gasUsed);

    await testFunction(
      sandContract,
      user0,
      user1,
      approvalAmount,
      senderEthBalanceBefore,
      targetEthBalanceBefore,
      txValue,
      txFee,
      '0x',
      returnData
    );
  });
  it('PaidCall for an empty contract as a target should revert', async function () {
    const {
      emptyContract,
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const function4BytesId = '11111111';
    const paddedMsgSender = zeroPadding(user0.substring(2));
    const paddedZeros = zeroPadding('0');
    const data = `${function4BytesId}${paddedMsgSender}${paddedZeros}`;
    await transferSand(sandContract, user0, totalSandBalance);
    const txValue = toWei(0);

    await expect(
      sandContractAsUser0.paidCall(
        emptyContract.address,
        approvalAmount,
        Buffer.from(data, 'hex'),
        {value: txValue}
      )
    ).to.be.reverted;
  });
  it('PaidCall calling logOnCall of a mock contract', async function () {
    const {
      mockERC20BasicApprovalTarget,
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const encodedABI = await mockERC20BasicApprovalTarget.populateTransaction.logOnCall(
      user0
    );
    const senderEthBalanceBefore = await ethers.provider.getBalance(user0);
    const targetEthBalanceBefore = await ethers.provider.getBalance(
      mockERC20BasicApprovalTarget.address
    );
    expect(encodedABI.data).to.not.be.equal(undefined);
    if (encodedABI.data) {
      const function4BytesId = encodedABI.data.substring(2, 10);
      const paddedMsgSender = zeroPadding(user0.substring(2));
      const paddedZeros = zeroPadding('0');
      const data = `${function4BytesId}${paddedMsgSender}${paddedZeros}`;
      await transferSand(sandContract, user0, totalSandBalance);

      const txValue = toWei(0);

      const returnData = await sandContractAsUser0.callStatic.paidCall(
        mockERC20BasicApprovalTarget.address,
        approvalAmount,
        Buffer.from(data, 'hex')
      );

      const tx = await sandContractAsUser0.paidCall(
        mockERC20BasicApprovalTarget.address,
        approvalAmount,
        Buffer.from(data, 'hex'),
        {value: txValue}
      );
      const receipt = await tx.wait();
      const txFee = tx.gasPrice.mul(receipt.gasUsed);

      const events = await mockERC20BasicApprovalTarget.queryFilter(
        mockERC20BasicApprovalTarget.filters.LogOnCall()
      );
      const event = events.filter((e) => e.event === 'LogOnCall')[0];
      expect(event.args).not.to.equal(null || undefined);
      if (event.args) {
        expect(event.args[0]).to.equal(user0);
      }

      await testFunction(
        sandContract,
        user0,
        mockERC20BasicApprovalTarget.address,
        approvalAmount,
        senderEthBalanceBefore,
        targetEthBalanceBefore,
        txValue,
        txFee,
        '0x' + paddedMsgSender,
        returnData
      );
    }
  });
  it('PaidCall calling revertOnCall of a mock contract should fail', async function () {
    const {
      mockERC20BasicApprovalTarget,
      sandContractAsUser0,
      sandContract,
      user0,
    } = await setupERC20BasicApproveExtension();
    const totalSandBalance = BigNumber.from(100000).mul(`1000000000000000000`);
    const approvalAmount = BigNumber.from(5000).mul(`1000000000000000000`);
    const encodedABI = await mockERC20BasicApprovalTarget.populateTransaction.revertOnCall();
    expect(encodedABI.data).to.not.be.equal(undefined);
    if (encodedABI.data) {
      const function4BytesId = encodedABI.data.substring(2);
      const paddedMsgSender = zeroPadding(user0.substring(2));
      const paddedZeros = zeroPadding('0');
      const data = `${function4BytesId}${paddedMsgSender}${paddedZeros}`;
      await transferSand(sandContract, user0, totalSandBalance);

      const txValue = toWei(0);
      await expect(
        sandContractAsUser0.paidCall(
          mockERC20BasicApprovalTarget.address,
          approvalAmount,
          Buffer.from(data, 'hex'),
          {value: txValue}
        )
      ).to.be.revertedWith('REVERT_ON_CALL');
    }
  });
});
