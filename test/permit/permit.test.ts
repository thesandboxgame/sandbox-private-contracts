import {ethers, deployments} from 'hardhat';
import {setupPermit} from './fixtures';
import {BigNumber, constants} from 'ethers';
import {splitSignature, _TypedDataEncoder} from 'ethers/lib/utils';
import {
  expectEventWithArgs,
  expectReceiptEventWithArgs,
  waitFor,
} from '../utils';
import {expect} from '../chai-setup';
import {data712} from './data712';

const zeroAddress = constants.AddressZero;
const TEST_AMOUNT = BigNumber.from(10).mul('1000000000000000000');

describe('Permit', function () {
  // Note: on test network, others[1] is sandAdmin, others[2] is sandBeneficiary

  before(async function () {
    await deployments.fixture();
  });

  it('ERC20 Approval event is emitted when msg signer == owner', async function () {
    const setUp = await setupPermit();
    const {permitContract, sandContract, others, nonce, deadline} = setUp;

    const approve = {
      owner: others[5],
      spender: others[3],
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };

    const permitData712 = data712(permitContract, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      others[5],
      permitData712,
    ]);
    const sig = splitSignature(flatSig);

    const receipt = await waitFor(
      permitContract.permit(
        others[5],
        others[3],
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    );

    const approvalEvent = await expectEventWithArgs(
      sandContract,
      receipt,
      'Approval'
    );
    expect(approvalEvent.args[0]).to.equal(others[5]); // owner
    expect(approvalEvent.args[1]).to.equal(others[3]); // spender
    expect(approvalEvent.args[2]).to.equal(TEST_AMOUNT); // amount
  });

  it('Nonce is incremented for each Approval', async function () {
    const setUp = await setupPermit();

    const {permitContract, others, nonce, deadline} = setUp;

    const approve = {
      owner: others[5],
      spender: others[3],
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };

    const permitData712 = data712(permitContract, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      others[5],
      permitData712,
    ]);
    const sig = splitSignature(flatSig);

    const checkNonce = await permitContract.nonces(others[5]);
    expect(checkNonce).to.equal(0);

    await waitFor(
      permitContract.permit(
        others[5],
        others[3],
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    );

    const nonceAfterApproval = await permitContract.nonces(others[5]);
    expect(nonceAfterApproval).to.equal(1);
  });

  it('Permit function reverts if deadline has passed', async function () {
    const setUp = await setupPermit();
    const deadline = BigNumber.from(1382718400);

    const {permitContract, others, nonce} = setUp;

    const approve = {
      owner: others[5],
      spender: others[3],
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };

    const permitData712 = data712(permitContract, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      others[5],
      permitData712,
    ]);
    const sig = splitSignature(flatSig);

    await expect(
      permitContract.permit(
        others[5],
        others[3],
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    ).to.be.revertedWith('PAST_DEADLINE');
  });

  it('Permit function reverts if owner is zeroAddress', async function () {
    const setUp = await setupPermit();

    const {permitContract, others, nonce, deadline} = setUp;

    const approve = {
      owner: others[5],
      spender: others[3],
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };

    const permitData712 = data712(permitContract, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      others[5],
      permitData712,
    ]);
    const sig = splitSignature(flatSig);

    await expect(
      permitContract.permit(
        zeroAddress,
        others[3],
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    ).to.be.revertedWith('INVALID_SIGNATURE');
  });

  it('Permit function reverts if owner != msg signer', async function () {
    const setUp = await setupPermit();

    const {permitContract, others, nonce, deadline} = setUp;

    const approve = {
      owner: others[5],
      spender: others[3],
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };

    const permitData712 = data712(permitContract, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      others[5],
      permitData712,
    ]);
    const sig = splitSignature(flatSig);

    await expect(
      permitContract.permit(
        others[4],
        others[3],
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    ).to.be.revertedWith('INVALID_SIGNATURE');
  });

  it('Permit function reverts if spender is not the approved spender', async function () {
    const setUp = await setupPermit();

    const {permitContract, others, nonce, deadline} = setUp;

    const approve = {
      owner: others[5],
      spender: others[3],
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };

    const permitData712 = data712(permitContract, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      others[5],
      permitData712,
    ]);
    const sig = splitSignature(flatSig);

    await expect(
      permitContract.permit(
        others[5],
        others[4],
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    ).to.be.revertedWith('INVALID_SIGNATURE');
  });

  it('Domain separator is public', async function () {
    const setUp = await setupPermit();

    const {permitContract, others, nonce, deadline} = setUp;
    const domainSeparator = await permitContract.DOMAIN_SEPARATOR();

    const approve = {
      owner: others[5],
      spender: others[3],
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };

    const permitData712 = data712(permitContract, approve);
    const expectedDomainSeparator = _TypedDataEncoder.hashDomain(
      permitData712.domain
    );
    expect(domainSeparator).to.equal(expectedDomainSeparator);
  });

  it('Non-approved operators cannot transfer ERC20 until approved', async function () {
    const setUp = await setupPermit();

    const {
      permitContract,
      sandContract,
      sandAdmin,
      sandBeneficiary,
      others,
      nonce,
      deadline,
    } = setUp;
    const receiverOriginalBalance = await sandContract.balanceOf(others[4]);
    expect(receiverOriginalBalance).to.equal(0);

    const approve = {
      owner: others[5],
      spender: others[3],
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };

    const permitData712 = data712(permitContract, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      others[5],
      permitData712,
    ]);
    const sig = splitSignature(flatSig);

    // Give wallet some SAND
    const sandContractAsAdmin = await sandContract.connect(
      ethers.provider.getSigner(sandAdmin)
    );
    await waitFor(
      sandContractAsAdmin.transferFrom(sandBeneficiary, others[5], TEST_AMOUNT)
    );

    const sandContractAsSpender = await sandContract.connect(
      ethers.provider.getSigner(others[3])
    );
    await expect(
      sandContractAsSpender.transferFrom(others[5], others[4], TEST_AMOUNT)
    ).to.be.revertedWith('Not enough funds allowed');
    await waitFor(
      permitContract.permit(
        others[5],
        others[3],
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    );
    const receipt = await waitFor(
      sandContractAsSpender.transferFrom(others[5], others[4], TEST_AMOUNT)
    );
    const receiverNewBalance = await sandContract.balanceOf(others[4]);
    const firstTransferEvent = await expectReceiptEventWithArgs(
      receipt,
      'Transfer'
    );
    expect(firstTransferEvent.args[0]).to.equal(others[5]);
    expect(firstTransferEvent.args[1]).to.equal(others[4]);
    expect(firstTransferEvent.args[2]).to.equal(TEST_AMOUNT);
    expect(receiverNewBalance).to.equal(
      TEST_AMOUNT.add(receiverOriginalBalance)
    );
  });

  it('Approved operators cannot transfer more ERC20 than their allowance', async function () {
    const setUp = await setupPermit();

    const {
      permitContract,
      sandContract,
      sandAdmin,
      sandBeneficiary,
      others,
      nonce,
      deadline,
    } = setUp;

    const approve = {
      owner: others[5],
      spender: others[3],
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };

    const permitData712 = data712(permitContract, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      others[5],
      permitData712,
    ]);
    const sig = splitSignature(flatSig);

    // Give wallet lots of SAND
    const sandContractAsAdmin = await sandContract.connect(
      ethers.provider.getSigner(sandAdmin)
    );
    await waitFor(
      sandContractAsAdmin.transferFrom(
        sandBeneficiary,
        others[5],
        TEST_AMOUNT.mul(2)
      )
    );

    const sandContractAsSpender = await sandContract.connect(
      ethers.provider.getSigner(others[3])
    );
    await waitFor(
      permitContract.permit(
        others[5],
        others[3],
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    );
    await expect(
      sandContractAsSpender.transferFrom(
        others[5],
        others[4],
        TEST_AMOUNT.mul(2)
      )
    ).to.be.revertedWith('Not enough funds allowed');
  });

  it('Approved operators cannot transfer more ERC20 than there is', async function () {
    const setUp = await setupPermit();

    const {
      permitContract,
      sandContract,
      sandAdmin,
      sandBeneficiary,
      others,
      nonce,
      deadline,
    } = setUp;

    const approve = {
      owner: others[5],
      spender: others[3],
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };

    const permitData712 = data712(permitContract, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      others[5],
      permitData712,
    ]);
    const sig = splitSignature(flatSig);

    // Give wallet small amount of SAND
    const sandContractAsAdmin = await sandContract.connect(
      ethers.provider.getSigner(sandAdmin)
    );
    await waitFor(
      sandContractAsAdmin.transferFrom(
        sandBeneficiary,
        others[5],
        TEST_AMOUNT.div(2)
      )
    );

    const sandContractAsSpender = await sandContract.connect(
      ethers.provider.getSigner(others[3])
    );
    await waitFor(
      permitContract.permit(
        others[5],
        others[3],
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    );
    await expect(
      sandContractAsSpender.transferFrom(others[5], others[4], TEST_AMOUNT)
    ).to.be.revertedWith('not enough fund');
  });
});
