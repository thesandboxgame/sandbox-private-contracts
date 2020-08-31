const {assert, expect} = require("local-chai");
const {ethers} = require("@nomiclabs/buidler");
const {utils, BigNumber} = require("ethers");
const {expectRevert, zeroAddress, increaseTime} = require("local-utils");
const {setupEstateSale} = require("./fixtures");
const {calculateLandHash} = require("../../../../lib/merkleTreeHelper");
const {createReferral} = require("../../../../lib/referralValidator");

function runEtherTests(landSaleName, options) {
  const testLands = options ? options.testLands : true;
  describe(landSaleName + ":ETH", function () {
    let initialSetUp;
    const emptyReferral = "0x";
    const privateKey = "0x4242424242424242424242424242424242424242424242424242424242424242";
    const referralLinkValidity = 60 * 60 * 24 * 30;

    describe("--> Tests with real LANDs", function () {
      beforeEach(async function () {
        initialSetUp = await setupEstateSale(landSaleName, "lands", !testLands);
      });

      it("ETH is enabled", async function () {
        const {contracts} = initialSetUp;
        const isETHEnabled = await contracts.estateSale.isETHEnabled();
        assert.ok(isETHEnabled, "ETH should be enabled");
      });

      it("ETH can be disabled", async function () {
        const {LandSaleAdmin} = initialSetUp;
        await LandSaleAdmin.EstateSale.functions.setETHEnabled(false);
        const isETHEnabled = await LandSaleAdmin.EstateSale.functions.isETHEnabled();
        assert.ok(!isETHEnabled, "ETH should not be enabled");
      });

      it("ETH cannot be enabled if not admin", async function () {
        const {users} = initialSetUp;
        await expectRevert(users[1].EstateSale.functions.setETHEnabled(true), "only admin can enable/disable ETH");
      });

      it("can buy estate with ETH (empty referral)", async function () {
        const {tree, users, lands, contracts} = initialSetUp;
        const land = lands.find((l) => l.size === 6);
        const proof = tree.getProof(calculateLandHash(land));
        const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);

        await users[0].EstateSale.functions.buyLandWithETH(
          users[0].address,
          users[0].address,
          zeroAddress,
          land.x,
          land.y,
          land.size,
          land.price,
          land.salt,
          [],
          proof,
          emptyReferral,
          {value: value}
        );

        for (let sx = 0; sx < land.size; sx++) {
          for (let sy = 0; sy < land.size; sy++) {
            const id = land.x + sx + (land.y + sy) * 408;
            const landOwner = await contracts.land.ownerOf(id);
            assert.equal(landOwner, contracts.estate.address);
          }
        }
        const estateOwner = await contracts.estate.ownerOf(1);
        assert.equal(estateOwner, users[0].address);
      });

      it("can buy estate with ETH and referral", async function () {
        const {tree, users, lands, contracts} = initialSetUp;
        const land = lands.find((l) => l.size === 6);
        const proof = tree.getProof(calculateLandHash(land));
        const value = await users[0].EstateSale.functions.getEtherAmountWithSAND(land.price);

        const referral = {
          referrer: "0x80EdC2580F0c768cb5b2bb87b96049A13508C230",
          referee: users[0].address,
          expiryTime: Math.floor(Date.now() / 1000) + referralLinkValidity,
          commissionRate: "500",
        };

        const sig = await createReferral(
          privateKey,
          referral.referrer,
          referral.referee,
          referral.expiryTime,
          referral.commissionRate
        );

        const isReferralValid = await users[0].EstateSale.functions.isReferralValid(
          sig,
          referral.referrer,
          referral.referee,
          referral.expiryTime,
          referral.commissionRate
        );

        assert.equal(isReferralValid, true, "Referral should be valid");

        const encodedReferral = utils.defaultAbiCoder.encode(
          ["bytes", "address", "address", "uint256", "uint256"],
          [sig, referral.referrer, referral.referee, referral.expiryTime, referral.commissionRate]
        );

        const tx = await users[0].EstateSale.functions.buyLandWithETH(
          users[0].address,
          users[0].address,
          zeroAddress,
          land.x,
          land.y,
          land.size,
          land.price,
          land.salt,
          [],
          proof,
          encodedReferral,
          {value: value}
        );

        const receipt = await tx.wait();
        const event = receipt.events[0];
        assert.equal(event.event, "ReferralUsed", "Event name is wrong");

        const referrer = event.args[0];
        const referree = event.args[1];
        const token = event.args[2];
        const amount = event.args[3];
        const commission = event.args[4];
        const commissionRate = event.args[5];

        assert.equal(referrer, referral.referrer, "Referrer is wrong");
        assert.equal(referree, referral.referee, "Referee is wrong");
        assert.equal(token, zeroAddress, "Token is wrong");
        assert.isOk(amount.eq(value), "Amount is wrong");
        assert.equal(commissionRate, referral.commissionRate, "Amount is wrong");

        const referrerBalance = await ethers.provider.getBalance(referral.referrer);

        const expectedCommission = BigNumber.from(amount)
          .mul(BigNumber.from(commissionRate))
          .div(BigNumber.from("10000"));

        assert.isOk(commission.eq(expectedCommission), "Commission is wrong");
        assert.isOk(commission.eq(referrerBalance), "Referrer balance is wrong");

        for (let sx = 0; sx < land.size; sx++) {
          for (let sy = 0; sy < land.size; sy++) {
            const id = land.x + sx + (land.y + sy) * 408;
            const landOwner = await contracts.land.ownerOf(id);
            assert.equal(landOwner, contracts.estate.address);
          }
        }
        const estateOwner = await contracts.estate.ownerOf(1);
        assert.equal(estateOwner, users[0].address);
      });

      it("CANNOT buy LAND (size === 1) with ETH if not enabled (empty referral)", async function () {
        const {LandSaleAdmin, tree, users, lands, contracts} = initialSetUp;

        await LandSaleAdmin.EstateSale.functions.setETHEnabled(false);

        const land = lands[0];
        const proof = tree.getProof(calculateLandHash(land));
        const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);

        await expectRevert(
          users[0].EstateSale.functions.buyLandWithETH(
            users[0].address,
            users[0].address,
            zeroAddress,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            [],
            proof,
            emptyReferral,
            {value: value}
          ),
          "ether payments not enabled"
        );
      });

      it("CANNOT buy LAND (size > 1) with ETH if not enabled (empty referral)", async function () {
        const {LandSaleAdmin, tree, users, lands, contracts} = initialSetUp;

        await LandSaleAdmin.EstateSale.functions.setETHEnabled(false);

        const land = lands.find((l) => l.size === 6);
        const proof = tree.getProof(calculateLandHash(land));
        const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);

        await expectRevert(
          users[0].EstateSale.functions.buyLandWithETH(
            users[0].address,
            users[0].address,
            zeroAddress,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            [],
            proof,
            emptyReferral,
            {value: value}
          ),
          "ether payments not enabled"
        );
      });

      it("can buy lands with ETH and an invalid referral", async function () {
        const {tree, lands, contracts, users} = initialSetUp;
        const land = lands.find((l) => l.size === 6);
        const proof = tree.getProof(calculateLandHash(land));
        const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);

        const referral = {
          referrer: "0x80EdC2580F0c768cb5b2bb87b96049A13508C230",
          referee: users[0].address,
          expiryTime: Math.floor(Date.now() / 1000) + referralLinkValidity,
          commissionRate: "10000",
        };

        const sig = await createReferral(
          privateKey,
          referral.referrer,
          referral.referee,
          referral.expiryTime,
          referral.commissionRate
        );

        const isReferralValid = await contracts.estateSale.isReferralValid(
          sig,
          referral.referrer,
          referral.referee,
          referral.expiryTime,
          referral.commissionRate
        );

        assert.equal(isReferralValid, false, "Referral should be invalid");

        const encodedReferral = utils.defaultAbiCoder.encode(
          ["bytes", "address", "address", "uint256", "uint256"],
          [sig, referral.referrer, referral.referee, referral.expiryTime, referral.commissionRate]
        );

        const tx = await users[0].EstateSale.functions.buyLandWithETH(
          users[0].address,
          users[0].address,
          zeroAddress,
          land.x,
          land.y,
          land.size,
          land.price,
          land.salt,
          [],
          proof,
          encodedReferral,
          {value: value}
        );

        const receipt = await tx.wait();
        const event = receipt.events[0];
        assert.equal(event.event, undefined, "Event should be undefined");

        const referrerBalance = await ethers.provider.getBalance(referral.referrer);

        assert.equal(0, referrerBalance, "Referrer balance is wrong");

        for (let sx = 0; sx < land.size; sx++) {
          for (let sy = 0; sy < land.size; sy++) {
            const id = land.x + sx + (land.y + sy) * 408;
            const landOwner = await contracts.land.ownerOf(id);
            assert.equal(landOwner, contracts.estate.address);
          }
        }
        const estateOwner = await contracts.estate.ownerOf(1);
        assert.equal(estateOwner, users[0].address);
      });

      it("CANNOT buy LAND without enough ETH (empty referral) unless price is zero", async function () {
        const {tree, users, lands} = initialSetUp;
        const land = lands.find((l) => l.size === 6);
        const proof = tree.getProof(calculateLandHash(land));

        if (land.price != 0) {
          await expectRevert(
            users[0].EstateSale.functions.buyLandWithETH(
              users[0].address,
              users[0].address,
              zeroAddress,
              land.x,
              land.y,
              land.size,
              land.price,
              land.salt,
              [],
              proof,
              emptyReferral,
              {value: 0}
            ),
            "not enough ether sent"
          );
        } else {
          await users[0].EstateSale.functions.buyLandWithETH(
            users[0].address,
            users[0].address,
            zeroAddress,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            [],
            proof,
            emptyReferral,
            {value: 0}
          );
        }
      });

      it("CANNOT buy Land from a non reserved Land with reserved param (empty referral)", async function () {
        const {tree, users, lands, contracts} = initialSetUp;
        const land = lands.find((l) => l.size === 6);
        const proof = tree.getProof(calculateLandHash(land));
        const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);

        await expectRevert(
          users[0].EstateSale.functions.buyLandWithETH(
            users[0].address,
            users[0].address,
            users[0].address,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            [],
            proof,
            emptyReferral,
            {value: value}
          ),
          "Invalid land provided"
        );
      });

      it("CANNOT buy LAND when minter rights revoked (empty referral)", async function () {
        const {LandAdmin, tree, users, lands, contracts} = initialSetUp;

        await LandAdmin.Land.functions.setMinter(contracts.estateSale.address, false).then((tx) => tx.wait());

        const land = lands.find((l) => l.size === 6);
        const proof = tree.getProof(calculateLandHash(land));
        const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);

        await expectRevert(
          users[0].EstateSale.functions.buyLandWithETH(
            users[0].address,
            users[0].address,
            zeroAddress,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            [],
            proof,
            emptyReferral,
            {value: value}
          ),
          "Only a minter can mint"
        );
      });

      it("CANNOT buy LAND twice (empty referral)", async function () {
        const {tree, users, lands} = initialSetUp;
        const land = lands.find((l) => l.size === 6);
        const value = await users[0].EstateSale.functions.getEtherAmountWithSAND(land.price);
        const proof = tree.getProof(calculateLandHash(land));

        await users[0].EstateSale.functions.buyLandWithETH(
          users[0].address,
          users[0].address,
          zeroAddress,
          land.x,
          land.y,
          land.size,
          land.price,
          land.salt,
          [],
          proof,
          emptyReferral,
          {value: value}
        );

        await expectRevert(
          users[0].EstateSale.functions.buyLandWithETH(
            users[0].address,
            users[0].address,
            zeroAddress,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            [],
            proof,
            emptyReferral,
            {value: value}
          ),
          "Already minted"
        );
      });

      it("CANNOT buy LAND with invalid proof (empty referral)", async function () {
        const {users, lands, contracts} = initialSetUp;
        const proof = [
          "0x0000000000000000000000000000000000000000000000000000000000000001",
          "0x0000000000000000000000000000000000000000000000000000000000000002",
          "0x0000000000000000000000000000000000000000000000000000000000000003",
        ];
        const land = lands.find((l) => l.size === 6);
        const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);

        await expectRevert(
          users[0].EstateSale.functions.buyLandWithETH(
            users[0].address,
            users[0].address,
            users[0].address,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            [],
            proof,
            emptyReferral,
            {value: value}
          ),
          "Invalid land provided"
        );
      });

      it("CANNOT buy LAND with wrong proof (empty referral)", async function () {
        const {tree, users, lands, contracts} = initialSetUp;
        const land = lands.find((l) => l.size === 6);
        const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);
        const proof = tree.getProof(calculateLandHash(lands[2]));

        await expectRevert(
          users[0].EstateSale.functions.buyLandWithETH(
            users[0].address,
            users[0].address,
            users[0].address,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            [],
            proof,
            emptyReferral,
            {value: value}
          ),
          "Invalid land provided"
        );
      });

      it("after buying user owns an Estate token and the Estate contract owns all LANDs (empty referral)", async function () {
        const {tree, users, lands, contracts} = initialSetUp;
        const land = lands.find((l) => l.size === 6);
        const proof = tree.getProof(calculateLandHash(land));
        const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);
        await users[0].EstateSale.functions.buyLandWithETH(
          users[0].address,
          users[0].address,
          zeroAddress,
          land.x,
          land.y,
          land.size,
          land.price,
          land.salt,
          [],
          proof,
          emptyReferral,
          {value: value}
        );
        for (let sx = 0; sx < land.size; sx++) {
          for (let sy = 0; sy < land.size; sy++) {
            const id = land.x + sx + (land.y + sy) * 408;
            const landOwner = await contracts.land.ownerOf(id);
            assert.equal(landOwner, contracts.estate.address);
          }
        }
        const estateOwner = await contracts.estate.ownerOf(1);
        assert.equal(estateOwner, users[0].address);
      });

      // TODO investigate
      it.skip("CANNOT buy a land after the expiry time (empty referral)", async function () {
        const {lands, users, tree, contracts} = initialSetUp;
        const land = lands.find((l) => l.size === 6);
        const proof = tree.getProof(calculateLandHash(land));
        const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);
        await increaseTime(60 * 60);
        await expectRevert(
          users[0].EstateSale.functions.buyLandWithETH(
            users[0].address,
            users[0].address,
            zeroAddress,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            [],
            proof,
            emptyReferral,
            {value: value}
          ),
          "sale is over"
        );
      });
    });

    if (testLands) {
      describe("--> Tests with test LANDs for reserved addresses", function () {
        beforeEach(async function () {
          initialSetUp = await setupEstateSale(landSaleName, "testLands");
        });

        it("CANNOT buy Land from a reserved Land of a different address (empty referral)", async function () {
          const {lands, users, tree, contracts} = initialSetUp;
          const land = lands[0];
          const proof = tree.getProof(calculateLandHash(land));
          const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);

          await expectRevert(
            users[0].EstateSale.functions.buyLandWithETH(
              users[0].address,
              users[0].address,
              users[0].address,
              land.x,
              land.y,
              land.size,
              land.price,
              land.salt,
              [],
              proof,
              emptyReferral,
              {value: value}
            ),
            "Invalid land provided"
          );
        });

        it("can buy land (size === 1) from a reserved Land if matching address (empty referral)", async function () {
          const {lands, users, tree, contracts} = initialSetUp;
          const land = lands[0];
          const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);
          const proof = tree.getProof(calculateLandHash(land));
          await users[1].EstateSale.functions.buyLandWithETH(
            users[1].address,
            users[1].address,
            users[1].address,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            [],
            proof,
            emptyReferral,
            {value: value}
          );
          const owner = await contracts.land.ownerOf(400 + 106 * 408);
          assert.equal(owner, users[1].address);
        });

        it("can buy lands (size > 1) from a reserved Land if matching address (empty referral)", async function () {
          const {lands, users, tree, contracts} = initialSetUp;
          const land = lands[3];
          const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);
          const proof = tree.getProof(calculateLandHash(land));
          await users[1].EstateSale.functions.buyLandWithETH(
            users[1].address,
            users[1].address,
            users[1].address,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            [],
            proof,
            emptyReferral,
            {value: value}
          );
          for (let sx = 0; sx < land.size; sx++) {
            for (let sy = 0; sy < land.size; sy++) {
              const id = land.x + sx + (land.y + sy) * 408;
              const landOwner = await contracts.land.ownerOf(id);
              assert.equal(landOwner, contracts.estate.address);
            }
          }
          const estateOwner = await contracts.estate.ownerOf(1);
          assert.equal(estateOwner, users[1].address);
        });

        it("can buy land (size === 1) from a reserved Land and send it to another address (empty referral)", async function () {
          const {lands, users, tree, contracts} = initialSetUp;
          const land = lands[0];
          const proof = tree.getProof(calculateLandHash(land));
          const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);
          await users[1].EstateSale.functions.buyLandWithETH(
            users[1].address,
            users[2].address,
            users[1].address,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            [],
            proof,
            emptyReferral,
            {value: value}
          );
          const owner = await contracts.land.ownerOf(400 + 106 * 408);
          assert.equal(owner, users[2].address);
        });

        it("can buy lands (size > 1) from a reserved Land and send Estate token to another address (empty referral)", async function () {
          const {lands, users, tree, contracts} = initialSetUp;
          const land = lands[3];
          const proof = tree.getProof(calculateLandHash(land));
          const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);
          await users[1].EstateSale.functions.buyLandWithETH(
            users[1].address,
            users[2].address,
            users[1].address,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            [],
            proof,
            emptyReferral,
            {value: value}
          );
          for (let sx = 0; sx < land.size; sx++) {
            for (let sy = 0; sy < land.size; sy++) {
              const id = land.x + sx + (land.y + sy) * 408;
              const landOwner = await contracts.land.ownerOf(id);
              assert.equal(landOwner, contracts.estate.address);
            }
          }
          const estateOwner = await contracts.estate.ownerOf(1);
          assert.equal(estateOwner, users[2].address);
        });

        it("can buy all lands specified in json except reserved lands (empty referral)", async function () {
          const {lands, users, tree, contracts} = initialSetUp;
          for (const land of lands) {
            const value = await contracts.estateSale.getEtherAmountWithSAND(land.price);
            const proof = tree.getProof(calculateLandHash(land));
            if (land.reserved) {
              await expectRevert(
                users[0].EstateSale.functions.buyLandWithETH(
                  users[0].address,
                  users[0].address,
                  land.reserved,
                  land.x,
                  land.y,
                  land.size,
                  land.price,
                  land.salt,
                  land.assetIds,
                  proof,
                  emptyReferral,
                  {value: value}
                ),
                "cannot buy reserved Land"
              );
            } else {
              try {
                await users[0].EstateSale.functions.buyLandWithETH(
                  users[0].address,
                  users[0].address,
                  zeroAddress,
                  land.x,
                  land.y,
                  land.size,
                  land.price,
                  land.salt,
                  land.assetIds,
                  proof,
                  emptyReferral,
                  {value: value}
                );
              } catch (e) {
                console.log(JSON.stringify(land));
                console.log(JSON.stringify(proof));
                throw e;
              }
            }
          }
        });
      });

      describe("--> Tests with test LANDs for assets bundle", function () {
        beforeEach(async function () {
          initialSetUp = await setupEstateSale(landSaleName, "testLands");
        });

        it("can buy Land with assets", async function () {
          const {lands, users, tree, contracts} = initialSetUp;
          const land = lands[5];
          const proof = tree.getProof(calculateLandHash(land));

          await users[0].EstateSale.functions.buyLandWithETH(
            users[0].address,
            users[0].address,
            zeroAddress,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            land.assetIds,
            proof,
            emptyReferral
          );

          const {asset} = contracts;
          const balances = await asset.callStatic.balanceOfBatch(
            land.assetIds.map(() => users[0].address),
            land.assetIds
          );
          expect(balances[0]).to.equal(1);
        });

        it("can buy Land with zero assets", async function () {
          const {lands, users, tree} = initialSetUp;
          const land = lands[4];
          const proof = tree.getProof(calculateLandHash(land));

          await users[0].EstateSale.functions.buyLandWithETH(
            users[0].address,
            users[0].address,
            zeroAddress,
            land.x,
            land.y,
            land.size,
            land.price,
            land.salt,
            land.assetIds,
            proof,
            emptyReferral
          );
        });

        it("CANNOT buy Land with assets using zero asset", async function () {
          const {lands, users, tree} = initialSetUp;
          const land = lands[5];
          const proof = tree.getProof(calculateLandHash(land));

          await expectRevert(
            users[0].EstateSale.functions.buyLandWithETH(
              users[0].address,
              users[0].address,
              zeroAddress,
              land.x,
              land.y,
              land.size,
              land.price,
              land.salt,
              [],
              proof,
              emptyReferral
            ),
            "Invalid land provided"
          );
        });

        it("can withdraw asset token post sale from admin", async function () {
          const {lands, users, contracts} = initialSetUp;
          const {asset, estateSale} = contracts;
          const land = lands[5];
          await increaseTime(60 * 60 + 1);
          await estateSale.functions.withdrawAssets(
            users[0].address,
            land.assetIds,
            land.assetIds.map(() => 1)
          );

          const balances = await asset.callStatic.balanceOfBatch(
            land.assetIds.map(() => users[0].address),
            land.assetIds
          );
          expect(balances[0]).to.equal(1);
        });

        it("CANNOT withdraw asset token post sale if not admin", async function () {
          const {lands, users} = initialSetUp;
          const land = lands[5];
          await increaseTime(60 * 60 + 1);
          await expectRevert(
            users[0].EstateSale.functions.withdrawAssets(
              users[0].address,
              land.assetIds,
              land.assetIds.map(() => 1)
            ),
            "NOT_AUTHORIZED"
          );
        });
      });
    }
  });
}

module.exports = {
  runEtherTests,
};
