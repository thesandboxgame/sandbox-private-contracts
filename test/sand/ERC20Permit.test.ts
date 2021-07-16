import {ethers, deployments} from 'hardhat';
import {Address} from 'hardhat-deploy/types';
import {splitSignature} from 'ethers/lib/utils';
import {BigNumber, Contract, constants} from 'ethers';
import {expect} from '../chai-setup';
import {setupGemsAndCatalysts} from '../polygon/catalyst/gemsCatalystsRegistry/fixtures';
import {expectEventWithArgs, waitFor} from '../utils';
import {setupPermit} from '../permit/fixtures';
import {data712} from '../permit/data712';

const zeroAddress = constants.AddressZero;
const TEST_AMOUNT = BigNumber.from(10).mul('1000000000000000000');

describe('Gems & Catalysts permit', function () {
  let luckGem: Contract;
  let epicCatalyst: Contract;
  let catalystOwner: Address;
  let gemOwner: Address;
  let user3: Address;
  let nonce: BigNumber;
  let deadline: BigNumber;

  before(async function () {
    await deployments.fixture();
    ({
      luckGem,
      epicCatalyst,
      catalystOwner,
      gemOwner,
      user3,
    } = await setupGemsAndCatalysts());
    const setUp = await setupPermit();
    ({nonce, deadline} = setUp);
  });

  it('user can use permit function to approve Gems via signature', async function () {
    const approve = {
      owner: gemOwner,
      spender: user3,
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };
    const permitData712 = data712(luckGem, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      gemOwner,
      permitData712,
    ]);
    const sig = splitSignature(flatSig);
    const gemAllowanceBefore = await luckGem.allowance(gemOwner, user3);
    expect(gemAllowanceBefore).to.equal(0);

    const receipt = await waitFor(
      luckGem.permit(
        gemOwner,
        user3,
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    );

    const approvalEvent = await expectEventWithArgs(
      luckGem,
      receipt,
      'Approval'
    );
    expect(approvalEvent.args[0]).to.equal(gemOwner); // owner
    expect(approvalEvent.args[1]).to.equal(user3); // spender
    expect(approvalEvent.args[2]).to.equal(TEST_AMOUNT); // amount
  });

  it('user can use permit function to approve Catalysts via signature', async function () {
    const approve = {
      owner: catalystOwner,
      spender: user3,
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };
    const permitData712 = data712(epicCatalyst, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      catalystOwner,
      permitData712,
    ]);
    const sig = splitSignature(flatSig);

    const catalystAlowanceBefore = await epicCatalyst.allowance(
      catalystOwner,
      user3
    );
    expect(catalystAlowanceBefore).to.equal(0);

    const receipt = await waitFor(
      epicCatalyst.permit(
        catalystOwner,
        user3,
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    );

    const approvalEvent = await expectEventWithArgs(
      epicCatalyst,
      receipt,
      'Approval'
    );
    expect(approvalEvent.args[0]).to.equal(catalystOwner); // owner
    expect(approvalEvent.args[1]).to.equal(user3); // spender
    expect(approvalEvent.args[2]).to.equal(TEST_AMOUNT); // amount
  });

  it('updates a users allowances correctly', async function () {
    const gemAllowanceAfter = await luckGem.allowance(gemOwner, user3);
    const catalystAllowanceAfter = await epicCatalyst.allowance(
      catalystOwner,
      user3
    );

    expect(gemAllowanceAfter).to.equal('10000000000000000000');
    expect(catalystAllowanceAfter).to.equal('10000000000000000000');
  });

  it('should fail if deadline < block.timestamp', async function () {
    const deadline = BigNumber.from(1382718400);
    const approve = {
      owner: catalystOwner,
      spender: user3,
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };
    const permitData712 = data712(epicCatalyst, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      catalystOwner,
      permitData712,
    ]);
    const sig = splitSignature(flatSig);

    await expect(
      epicCatalyst.permit(
        catalystOwner,
        user3,
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    ).to.be.revertedWith('PAST_DEADLINE');
  });

  it('should fail if recoveredAddress == address(0) || recoveredAddress != owner', async function () {
    const approve = {
      owner: zeroAddress,
      spender: user3,
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };
    const permitData712 = data712(epicCatalyst, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      catalystOwner,
      permitData712,
    ]);
    const sig = splitSignature(flatSig);

    await expect(
      epicCatalyst.permit(
        catalystOwner,
        user3,
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    ).to.be.revertedWith('INVALID_SIGNATURE');

    const approve2 = {
      owner: user3,
      spender: user3,
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };
    const permitData7122 = data712(epicCatalyst, approve2);
    const flatSig2 = await ethers.provider.send('eth_signTypedData_v4', [
      catalystOwner,
      permitData7122,
    ]);
    const sig2 = splitSignature(flatSig2);

    await expect(
      epicCatalyst.permit(
        catalystOwner,
        user3,
        TEST_AMOUNT,
        deadline,
        sig2.v,
        sig2.r,
        sig2.s
      )
    ).to.be.revertedWith('INVALID_SIGNATURE');
  });

  it('should fail if owner == address(0) || spender == address(0)', async function () {
    const approve = {
      owner: catalystOwner,
      spender: user3,
      value: TEST_AMOUNT._hex,
      nonce: nonce._hex,
      deadline: deadline._hex,
    };
    const permitData712 = data712(epicCatalyst, approve);
    const flatSig = await ethers.provider.send('eth_signTypedData_v4', [
      catalystOwner,
      permitData712,
    ]);
    const sig = splitSignature(flatSig);

    await expect(
      epicCatalyst.permit(
        zeroAddress,
        user3,
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    ).to.be.revertedWith('INVALID_OWNER_||_SPENDER');
    await expect(
      epicCatalyst.permit(
        catalystOwner,
        zeroAddress,
        TEST_AMOUNT,
        deadline,
        sig.v,
        sig.r,
        sig.s
      )
    ).to.be.revertedWith('INVALID_OWNER_||_SPENDER');
  });
});
