import {ethers} from 'hardhat';
import {setupTestGiveaway} from './fixtures';
import {constants} from 'ethers';
import {waitFor, expectReceiptEventWithArgs, increaseTime} from '../utils';
import {expect} from '../chai-setup';

import helpers from '../../lib/merkleTreeHelper';
const {calculateClaimableAssetLandAndSandHash} = helpers;

const zeroAddress = constants.AddressZero;

describe('Land_Giveaway', function () {
  it('User cannot claim when test contract holds zero assets', async function () {
    const options = {
      landHolder: true,
    };
    const setUp = await setupTestGiveaway(options);
    const {giveawayContract, others, tree, lands} = setUp;
    const land = lands[0];
    const proof = tree.getProof(calculateClaimableAssetLandAndSandHash(land));
    const giveawayContractAsUser = await giveawayContract.connect(
      ethers.provider.getSigner(others[0])
    );

    await expect(
      giveawayContractAsUser.claimLands(others[0], land.ids, proof, land.salt)
    ).to.be.revertedWith(`not owner in batchTransferFrom`);
  });

  it('User can claim allocated multiple assets for multiple assetIds from Giveaway contract', async function () {
    const options = {
      mint: true,
    };
    const setUp = await setupTestGiveaway(options);
    const {giveawayContract, others, tree, lands, landContract} = setUp;

    const land = lands[0];
    const proof = tree.getProof(calculateClaimableAssetLandAndSandHash(land));
    const giveawayContractAsUser = await giveawayContract.connect(
      ethers.provider.getSigner(others[0])
    );

    const originalOwnerLandId1 = await landContract.ownerOf(0);
    expect(originalOwnerLandId1).to.equal(giveawayContract.address);
    const originalOwnerLandId2 = await landContract.ownerOf(1);
    expect(originalOwnerLandId2).to.equal(giveawayContract.address);
    const originalOwnerLandId3 = await landContract.ownerOf(2);
    expect(originalOwnerLandId3).to.equal(giveawayContract.address);

    await waitFor(
      giveawayContractAsUser.claimLands(others[0], land.ids, proof, land.salt)
    );

    const ownerLandId1 = await landContract.ownerOf(0);
    expect(ownerLandId1).to.equal(land.reservedAddress);
    const ownerLandId2 = await landContract.ownerOf(1);
    expect(ownerLandId2).to.equal(land.reservedAddress);
    const ownerLandId3 = await landContract.ownerOf(2);
    expect(ownerLandId3).to.equal(land.reservedAddress);
  });

  it('Claimed Event is emitted for successful claim', async function () {
    const options = {
      mint: true,
    };
    const setUp = await setupTestGiveaway(options);
    const {giveawayContract, others, tree, lands} = setUp;

    const land = lands[0];
    const proof = tree.getProof(calculateClaimableAssetLandAndSandHash(land));
    const giveawayContractAsUser = await giveawayContract.connect(
      ethers.provider.getSigner(others[0])
    );

    const receipt = await waitFor(
      giveawayContractAsUser.claimLands(others[0], land.ids, proof, land.salt)
    );

    const claimedEvent = await expectReceiptEventWithArgs(
      receipt,
      'ClaimedLands'
    );

    expect(claimedEvent.args[0]).to.equal(others[0]); // to
    if (land.ids) expect(claimedEvent.args[1][0]).to.equal(land.ids[0]);
    if (land.ids) expect(claimedEvent.args[1][1]).to.equal(land.ids[1]);
    if (land.ids) expect(claimedEvent.args[1][2]).to.equal(land.ids[2]);
  });

  it('User can claim allocated single asset for single assetId from Giveaway contract', async function () {
    const options = {
      mint: true,
    };
    const setUp = await setupTestGiveaway(options);
    const {giveawayContract, others, tree, lands} = setUp;

    const land = lands[1];
    const proof = tree.getProof(calculateClaimableAssetLandAndSandHash(land));
    const giveawayContractAsUser = await giveawayContract.connect(
      ethers.provider.getSigner(others[0])
    );

    await waitFor(
      giveawayContractAsUser.claimLands(others[0], land.ids, proof, land.salt)
    );
  });

  it('User cannot claim their lands more than once', async function () {
    const options = {
      mint: true,
    };
    const setUp = await setupTestGiveaway(options);
    const {giveawayContract, others, tree, lands} = setUp;

    const land = lands[0];
    const proof = tree.getProof(calculateClaimableAssetLandAndSandHash(land));
    const giveawayContractAsUser = await giveawayContract.connect(
      ethers.provider.getSigner(others[0])
    );

    await waitFor(
      giveawayContractAsUser.claimLands(others[0], land.ids, proof, land.salt)
    );
    await expect(
      giveawayContractAsUser.claimLands(others[0], land.ids, proof, land.salt)
    ).to.be.revertedWith('DESTINATION_ALREADY_CLAIMED');
  });

  it('User cannot claim lands from Giveaway contract if destination is not the reserved address', async function () {
    const options = {
      mint: true,
    };
    const setUp = await setupTestGiveaway(options);
    const {giveawayContract, others, tree, lands} = setUp;

    const land = lands[0];
    const proof = tree.getProof(calculateClaimableAssetLandAndSandHash(land));
    const giveawayContractAsUser = await giveawayContract.connect(
      ethers.provider.getSigner(others[0])
    );

    await expect(
      giveawayContractAsUser.claimLands(
        others[2], // bad param
        land.ids,
        proof,
        land.salt
      )
    ).to.be.revertedWith('INVALID_CLAIM');
  });

  it('User cannot claim lands from Giveaway contract to destination zeroAddress', async function () {
    const options = {
      mint: true,
    };
    const setUp = await setupTestGiveaway(options);
    const {giveawayContract, others, tree, lands} = setUp;

    const land = lands[0];
    const proof = tree.getProof(calculateClaimableAssetLandAndSandHash(land));
    const giveawayContractAsUser = await giveawayContract.connect(
      ethers.provider.getSigner(others[0])
    );

    await expect(
      giveawayContractAsUser.claimLands(zeroAddress, land.ids, proof, land.salt)
    ).to.be.revertedWith('INVALID_TO_ZERO_ADDRESS');
  });

  it('User can claim allocated lands from alternate address', async function () {
    const options = {
      mint: true,
      assetsHolder: true, // others[5]
    };
    const setUp = await setupTestGiveaway(options);
    const {giveawayContract, others, tree, lands} = setUp;

    const land = lands[0];
    const proof = tree.getProof(calculateClaimableAssetLandAndSandHash(land));
    const giveawayContractAsUser = await giveawayContract.connect(
      ethers.provider.getSigner(others[0])
    );
    await waitFor(
      giveawayContractAsUser.claimLands(others[0], land.ids, proof, land.salt)
    );
  });

  it('merkleRoot cannot be set twice', async function () {
    const options = {};
    const setUp = await setupTestGiveaway(options);
    const {giveawayContract, nftGiveawayAdmin} = setUp;

    const giveawayContractAsAdmin = await giveawayContract.connect(
      ethers.provider.getSigner(nftGiveawayAdmin)
    );

    await expect(
      giveawayContractAsAdmin.setMerkleRootLands(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      )
    ).to.be.revertedWith('MERKLE_ROOT_ALREADY_SET');
  });

  it('merkleRoot can only be set by admin', async function () {
    const options = {};
    const setUp = await setupTestGiveaway(options);
    const {giveawayContract, others} = setUp;

    const giveawayContractAsUser = await giveawayContract.connect(
      ethers.provider.getSigner(others[8])
    );

    await expect(
      giveawayContractAsUser.setMerkleRootLands(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      )
    ).to.be.revertedWith('ADMIN_ONLY');
  });

  it('User cannot claim assets after the expiryTime', async function () {
    const options = {};
    const setUp = await setupTestGiveaway(options);
    const {giveawayContract, others, tree, lands} = setUp;

    const land = lands[0];
    const proof = tree.getProof(calculateClaimableAssetLandAndSandHash(land));
    const giveawayContractAsUser = await giveawayContract.connect(
      ethers.provider.getSigner(others[0])
    );

    await increaseTime(60 * 60 * 24 * 30 * 4);

    await expect(
      giveawayContractAsUser.claimLands(others[0], land.ids, proof, land.salt)
    ).to.be.revertedWith('CLAIM_PERIOD_IS_OVER');
  });
});
