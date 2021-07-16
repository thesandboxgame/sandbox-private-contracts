import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import {BigNumber, Contract, BytesLike, utils} from 'ethers';
import Prando from 'prando';
import {expect} from '../../chai-setup';
import {expectEventWithArgs, expectEventWithArgsFromReceipt} from '../../utils';
import {Address} from 'hardhat-deploy/types';
import {supplyAssets} from '../assets';
import {toUtf8Bytes} from 'ethers/lib/utils';
import {gameMintingFee, gameUpdateFee} from '../../../data/gameMinterFees';
import {sendMetaTx} from '../../sendMetaTx';

const rng = new Prando('GameMinter');

type Update = {
  assetIdsToRemove: BigNumber[];
  assetAmountsToRemove: number[];
  assetIdsToAdd: BigNumber[];
  assetAmountsToAdd: number[];
  uri: BytesLike;
};

const update: Update = {
  assetIdsToRemove: [],
  assetAmountsToRemove: [],
  assetIdsToAdd: [],
  assetAmountsToAdd: [],
  uri: utils.keccak256(ethers.utils.toUtf8Bytes('')),
};

async function getRandom(): Promise<number> {
  return rng.nextInt(1, 1000000000);
}

async function getURI(string: string): Promise<string> {
  return utils.keccak256(toUtf8Bytes(string));
}

function increment(id: BigNumber): BigNumber {
  return id.add(1);
}

async function getTokenBalances(
  contract: Contract,
  addr1: Address,
  addr2: Address
): Promise<BigNumber[]> {
  const balances: BigNumber[] = [];
  balances.push(await contract.balanceOf(addr1));
  balances.push(await contract.balanceOf(addr2));
  return balances;
}

type User = {
  address: Address;
  GameMinter: Contract;
};

const setupTest = deployments.createFixture(
  async (): Promise<{
    GameMinter: Contract;
    users: User[];
  }> => {
    await deployments.fixture(['ChildGameToken', 'GameMinter']);
    const users = await getUnnamedAccounts();
    return {
      GameMinter: await ethers.getContract('GameMinter'),
      users: await Promise.all(
        users.map((acc: string) =>
          (async () => {
            return {
              address: acc,
              GameMinter: await ethers.getContract('GameMinter', acc),
            };
          })()
        )
      ),
    };
  }
);

describe('GameMinter', function () {
  describe('GameMinter: Calling Directly', function () {
    let gameId1: BigNumber;
    let users: User[];
    let GameMinter: Contract;
    let sandContract: Contract;
    let sandAsAdmin: Contract;
    let gameTokenContract: Contract;
    let assets: BigNumber[];
    let editorAssets: BigNumber[];
    let gameTokenFeeBeneficiary: Address;

    before(async function () {
      ({GameMinter, users} = await setupTest());
      const {sandAdmin, gameTokenAdmin} = await getNamedAccounts();
      gameTokenContract = await ethers.getContract('ChildGameToken');
      sandContract = await ethers.getContract('Sand');
      sandAsAdmin = await sandContract.connect(
        ethers.provider.getSigner(sandAdmin)
      );
      await sandAsAdmin.setSuperOperator(GameMinter.address, true);
      const gameAsAdmin = await gameTokenContract.connect(
        ethers.provider.getSigner(gameTokenAdmin)
      );
      await gameAsAdmin.changeMinter(GameMinter.address);
      const signers = await ethers.getSigners();
      gameTokenFeeBeneficiary = await signers[3].getAddress();

      // Supply users with sand and assets:
      await sandAsAdmin.transfer(
        users[1].address,
        BigNumber.from('1000000000000000000000000')
      );
      await sandAsAdmin.transfer(
        users[8].address,
        BigNumber.from('1000000000000000000000000')
      );

      assets = await supplyAssets(users[1].address, [77, 3, 14]);

      editorAssets = await supplyAssets(users[8].address, [11]);
    });

    it('should fail to create GAME if user has insufficient SAND', async function () {
      await expect(
        users[2].GameMinter.createGame(
          users[2].address,
          {...update, uri: await getURI('Test Game URI')},
          ethers.constants.AddressZero,
          await getRandom()
        )
      ).to.be.revertedWith('not enough fund');
    });

    it('should allow anyone to create a game', async function () {
      const balancesBefore = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );

      const receipt = await users[1].GameMinter.createGame(
        users[1].address,
        {...update, uri: await getURI('Test Game URI')},
        users[8].address,
        await getRandom()
      );
      const event = await expectEventWithArgs(
        gameTokenContract,
        receipt,
        'Transfer'
      );
      gameId1 = event.args[2];

      const balancesAfter = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );

      expect(balancesAfter[0]).to.be.equal(
        balancesBefore[0].sub(gameMintingFee)
      );
      expect(balancesAfter[1]).to.be.equal(
        balancesBefore[1].add(gameMintingFee)
      );
    });

    it('should allow owner to add assets', async function () {
      const gameAssetsBefore = await gameTokenContract.getAssetBalances(
        gameId1,
        [assets[0], assets[1]]
      );

      const receipt = await users[1].GameMinter.updateGame(gameId1, {
        ...update,
        assetIdsToAdd: [assets[0], assets[1]],
        assetAmountsToAdd: [77, 3],
        uri: await getURI('Updated URI with Assets!'),
      });

      gameId1 = increment(gameId1);

      const updateEvent = await expectEventWithArgs(
        gameTokenContract,
        receipt,
        'GameTokenUpdated'
      );
      const oldId = updateEvent.args[0];
      const newId = updateEvent.args[1];
      const updateArgs = updateEvent.args[2];

      const gameAssetsAfter = await gameTokenContract.getAssetBalances(newId, [
        assets[0],
        assets[1],
      ]);

      expect(gameAssetsAfter[0]).to.be.equal(gameAssetsBefore[0].add(77));
      expect(gameAssetsAfter[1]).to.be.equal(gameAssetsBefore[1].add(3));
      expect(oldId).to.be.equal(gameId1.sub(1));
      expect(newId).to.be.equal(gameId1);
      expect(updateArgs[0]).to.deep.equal([]);
      expect(updateArgs[1]).to.deep.equal([]);
      expect(updateArgs[2]).to.deep.equal([assets[0], assets[1]]);
      expect(updateArgs[3][0]).to.deep.equal(77);
      expect(updateArgs[3][1]).to.deep.equal(3);
      expect(updateArgs[4]).to.be.equal(
        await getURI('Updated URI with Assets!')
      );
    });

    it('should charge a fee when owner adds assets', async function () {
      const balancesBefore = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );

      await users[1].GameMinter.updateGame(gameId1, {
        ...update,
        assetIdsToAdd: [assets[2]],
        assetAmountsToAdd: [14],
        uri: await getURI('Updated URI with Assets!'),
      });
      gameId1 = increment(gameId1);

      const balancesAfter = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );

      expect(balancesAfter[0]).to.be.equal(
        balancesBefore[0].sub(gameUpdateFee)
      );
      expect(balancesAfter[1]).to.be.equal(
        balancesBefore[1].add(gameUpdateFee)
      );
    });

    it('should allow editor to add assets', async function () {
      const balancesBefore = await getTokenBalances(
        sandContract,
        users[8].address,
        gameTokenFeeBeneficiary
      );
      const gameAssetsBefore = await gameTokenContract.getAssetBalances(
        gameId1,
        editorAssets
      );

      await users[8].GameMinter.updateGame(gameId1, {
        ...update,
        assetIdsToAdd: editorAssets,
        assetAmountsToAdd: [11],
        uri: await getURI('Updated URI with Assets!'),
      });
      gameId1 = increment(gameId1);

      const balancesAfter = await getTokenBalances(
        sandContract,
        users[8].address,
        gameTokenFeeBeneficiary
      );
      const gameAssetsAfter = await gameTokenContract.getAssetBalances(
        gameId1,
        editorAssets
      );

      expect(balancesAfter[0]).to.be.equal(
        balancesBefore[0].sub(gameUpdateFee)
      );
      expect(balancesAfter[1]).to.be.equal(
        balancesBefore[1].add(gameUpdateFee)
      );
      expect(gameAssetsAfter[0]).to.be.equal(gameAssetsBefore[0].add(11));
    });

    it('should allow owner to remove assets', async function () {
      const balancesBefore = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );
      const gameAssetsBefore = await gameTokenContract.getAssetBalances(
        gameId1,
        [assets[1]]
      );

      await users[1].GameMinter.updateGame(gameId1, {
        ...update,
        assetIdsToRemove: [assets[1]],
        assetAmountsToRemove: [3],
        uri: await getURI('Updated URI when removing Assets'),
      });

      gameId1 = increment(gameId1);

      const balancesAfter = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );
      const gameAssetsAfter = await gameTokenContract.getAssetBalances(
        gameId1,
        [assets[1]]
      );

      expect(balancesAfter[0]).to.be.equal(
        balancesBefore[0].sub(gameUpdateFee)
      );
      expect(balancesAfter[1]).to.be.equal(
        balancesBefore[1].add(gameUpdateFee)
      );
      expect(gameAssetsAfter[0]).to.be.equal(gameAssetsBefore[0].sub(3));
    });

    it('should allow editor to remove assets', async function () {
      const balancesBefore = await getTokenBalances(
        sandContract,
        users[8].address,
        gameTokenFeeBeneficiary
      );

      await users[8].GameMinter.updateGame(gameId1, {
        ...update,
        assetIdsToRemove: [assets[0]],
        assetAmountsToRemove: [3],
        uri: await getURI('Updated URI when editor removing Assets'),
      });

      gameId1 = increment(gameId1);

      const balancesAfter = await getTokenBalances(
        sandContract,
        users[8].address,
        gameTokenFeeBeneficiary
      );

      expect(balancesAfter[0]).to.be.equal(
        balancesBefore[0].sub(gameUpdateFee)
      );
      expect(balancesAfter[1]).to.be.equal(
        balancesBefore[1].add(gameUpdateFee)
      );
    });

    it('should fail if not authorized to add assets', async function () {
      await expect(
        users[0].GameMinter.updateGame(gameId1, {...update})
      ).to.be.revertedWith('AUTH_ACCESS_DENIED');
    });

    it('should fail to modify GAME if user has insufficient SAND', async function () {
      const gameAsGameOwner = await gameTokenContract.connect(
        ethers.provider.getSigner(users[1].address)
      );
      await gameAsGameOwner.setGameEditor(
        users[1].address,
        users[2].address,
        true
      );
      await expect(
        users[2].GameMinter.updateGame(gameId1, {...update})
      ).to.be.revertedWith('not enough fund');
    });

    it('should fail if not authorized to remove assets', async function () {
      await expect(
        users[0].GameMinter.updateGame(gameId1, {...update})
      ).to.be.revertedWith('AUTH_ACCESS_DENIED');
    });

    it('should fail if not authorized to set GAME URI', async function () {
      await expect(
        users[0].GameMinter.updateGame(gameId1, {
          ...update,
          uri: await getURI('Test Game URI'),
        })
      ).to.be.revertedWith('AUTH_ACCESS_DENIED');
    });
    it('allows GAME owner to set GAME URI', async function () {
      const balancesBefore = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );

      const receipt = await users[1].GameMinter.updateGame(gameId1, {
        ...update,
        uri: await getURI('Updating URI'),
      });

      gameId1 = increment(gameId1);

      const updateEvent = await expectEventWithArgs(
        gameTokenContract,
        receipt,
        'GameTokenUpdated'
      );
      const eventURI = updateEvent.args[2][4];
      expect(eventURI).to.be.equal(await getURI('Updating URI'));

      const balancesAfter = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );

      expect(balancesAfter[0]).to.be.equal(
        balancesBefore[0].sub(gameUpdateFee)
      );
      expect(balancesAfter[1]).to.be.equal(
        balancesBefore[1].add(gameUpdateFee)
      );
    });
    it('allows GAME editor to set GAME URI', async function () {
      const balancesBefore = await getTokenBalances(
        sandContract,
        users[8].address,
        gameTokenFeeBeneficiary
      );

      const receipt = await users[8].GameMinter.updateGame(gameId1, {
        ...update,
        uri: await getURI('Updating URI Again ...'),
      });

      gameId1 = increment(gameId1);

      const updateEvent = await expectEventWithArgs(
        gameTokenContract,
        receipt,
        'GameTokenUpdated'
      );
      const eventURI = updateEvent.args[2][4];

      const balancesAfter = await getTokenBalances(
        sandContract,
        users[8].address,
        gameTokenFeeBeneficiary
      );

      expect(eventURI).to.be.equal(await getURI('Updating URI Again ...'));
      expect(balancesAfter[0]).to.be.equal(
        balancesBefore[0].sub(gameUpdateFee)
      );
      expect(balancesAfter[1]).to.be.equal(
        balancesBefore[1].add(gameUpdateFee)
      );
    });
  });
  describe('GameMinter: Sandbox MetaTXs', function () {
    let gameId2: BigNumber;
    let users: User[];
    let GameMinter: Contract;
    let sandContract: Contract;
    let sandAsAdmin: Contract;
    let gameTokenContract: Contract;
    let testForwarder: Contract;
    let assets: BigNumber[];
    let editorAssets: BigNumber[];
    let gameTokenFeeBeneficiary: Address;

    before(async function () {
      ({GameMinter, users} = await setupTest());
      const {sandAdmin, gameTokenAdmin} = await getNamedAccounts();
      sandContract = await ethers.getContract('Sand');
      const TRUSTED_FORWARDER = await deployments.get('TRUSTED_FORWARDER');
      testForwarder = await ethers.getContractAt(
        'TestMetaTxForwarder',
        TRUSTED_FORWARDER.address
      );

      gameTokenContract = await ethers.getContract('ChildGameToken');
      sandAsAdmin = await sandContract.connect(
        ethers.provider.getSigner(sandAdmin)
      );
      await sandAsAdmin.setSuperOperator(GameMinter.address, true);
      const gameAsAdmin = await gameTokenContract.connect(
        ethers.provider.getSigner(gameTokenAdmin)
      );
      await gameAsAdmin.changeMinter(GameMinter.address);

      const signers = await ethers.getSigners();
      gameTokenFeeBeneficiary = await signers[3].getAddress();

      // Supply users with sand and assets:
      await sandAsAdmin.transfer(
        users[1].address,
        BigNumber.from('1000000000000000000000000')
      );
      await sandAsAdmin.transfer(
        users[8].address,
        BigNumber.from('1000000000000000000000000')
      );

      assets = await supplyAssets(users[1].address, [42, 3]);
      editorAssets = await supplyAssets(users[8].address, [5]);
    });

    it('should allow anyone to create a game via MetaTx', async function () {
      const balancesBefore = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );
      const gamesBefore = await gameTokenContract.balanceOf(users[1].address);

      const {to, data} = await GameMinter.populateTransaction.createGame(
        users[1].address,
        {...update, uri: await getURI('Sandbox MetaTx URI')},
        users[8].address,
        await getRandom()
      );
      const gas = '1000000';
      const receipt = await sendMetaTx(
        to,
        testForwarder,
        data,
        users[1].address,
        gas
      );

      const event = await expectEventWithArgsFromReceipt(
        gameTokenContract,
        receipt,
        'Transfer'
      );

      gameId2 = event.args[2];
      const balancesAfter = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );

      const gamesAfter = await gameTokenContract.balanceOf(users[1].address);

      expect(balancesAfter[0]).to.be.equal(
        balancesBefore[0].sub(gameMintingFee)
      );
      expect(balancesAfter[1]).to.be.equal(
        balancesBefore[1].add(gameMintingFee)
      );
      expect(gamesAfter).to.be.equal(gamesBefore.add(1));
    });

    it('should allow GAME Owner to add assets via MetaTx', async function () {
      const balancesBefore = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );

      const {to, data} = await GameMinter.populateTransaction.updateGame(
        gameId2,
        {
          ...update,
          assetIdsToAdd: assets,
          assetAmountsToAdd: [42, 3],
          uri: await getURI('Sandbox MetaTx URI'),
        }
      );

      gameId2 = increment(gameId2);

      const gas = '1000000';
      const receipt = await sendMetaTx(
        to,
        testForwarder,
        data,
        users[1].address,
        gas
      );

      const event = await expectEventWithArgsFromReceipt(
        gameTokenContract,
        receipt,
        'GameTokenUpdated'
      );

      const balancesAfter = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );

      expect(balancesAfter[0]).to.be.equal(
        balancesBefore[0].sub(gameUpdateFee)
      );
      expect(balancesAfter[1]).to.be.equal(
        balancesBefore[1].add(gameUpdateFee)
      );

      expect(event.args[0]).to.be.equal(gameId2.sub(1));
      expect(event.args[1]).to.be.equal(gameId2);
      expect(event.args[2][2]).to.deep.equal(assets);
      expect(event.args[2][3][0]).to.deep.equal(42);
      expect(event.args[2][3][1]).to.deep.equal(3);
      expect(event.args[2][4]).to.be.equal(await getURI('Sandbox MetaTx URI'));
    });

    it('should allow GAME Owner to remove assets via MetaTx', async function () {
      const balancesBefore = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );

      const {to, data} = await GameMinter.populateTransaction.updateGame(
        gameId2,
        {
          ...update,
          assetIdsToRemove: [assets[0]],
          assetAmountsToRemove: [42],
          uri: await getURI('Sandbox MetaTx URI'),
        }
      );

      gameId2 = increment(gameId2);

      const gas = '1000000';
      const receipt = await sendMetaTx(
        to,
        testForwarder,
        data,
        users[1].address,
        gas
      );

      const event = await expectEventWithArgsFromReceipt(
        gameTokenContract,
        receipt,
        'GameTokenUpdated'
      );

      const balancesAfter = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );

      expect(balancesAfter[0]).to.be.equal(
        balancesBefore[0].sub(gameUpdateFee)
      );
      expect(balancesAfter[1]).to.be.equal(
        balancesBefore[1].add(gameUpdateFee)
      );
      expect(event.args[0]).to.be.equal(gameId2.sub(1));
      expect(event.args[1]).to.be.equal(gameId2);
      expect(event.args[2][0]).to.deep.equal([assets[0]]);
      expect(event.args[2][1][0]).to.deep.equal(42);
      expect(event.args[2][4]).to.be.equal(await getURI('Sandbox MetaTx URI'));
    });

    it('should allow GAME Owner to set URI via MetaTx', async function () {
      const balancesBefore = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );
      const {to, data} = await GameMinter.populateTransaction.updateGame(
        gameId2,
        {
          ...update,
          uri: await getURI('Sandbox MetaTx change URI'),
        }
      );

      gameId2 = increment(gameId2);
      const gas = '1000000';
      const receipt = await sendMetaTx(
        to,
        testForwarder,
        data,
        users[1].address,
        gas
      );

      const event = await expectEventWithArgsFromReceipt(
        gameTokenContract,
        receipt,
        'GameTokenUpdated'
      );

      const balancesAfter = await getTokenBalances(
        sandContract,
        users[1].address,
        gameTokenFeeBeneficiary
      );
      const newURI = await gameTokenContract.tokenURI(gameId2);

      expect(newURI).to.be.equal(
        'ipfs://bafybeicjgxfke4ojlythuopitdce6gdyheikqdtumnbrwlk4iottqksb6e/game.json'
      );
      expect(event.args[0]).to.be.equal(gameId2.sub(1));
      expect(event.args[1]).to.be.equal(gameId2);
      expect(event.args[2][4]).to.be.equal(
        await getURI('Sandbox MetaTx change URI')
      );
      expect(balancesAfter[0]).to.be.equal(
        balancesBefore[0].sub(gameUpdateFee)
      );
      expect(balancesAfter[1]).to.be.equal(
        balancesBefore[1].add(gameUpdateFee)
      );
    });

    it('should allow GAME Editor to add assets via MetaTx', async function () {
      const {to, data} = await GameMinter.populateTransaction.updateGame(
        gameId2,
        {
          ...update,
          assetIdsToAdd: editorAssets,
          assetAmountsToAdd: [5],
        }
      );

      const assetsBefore = await gameTokenContract.getAssetBalances(gameId2, [
        editorAssets[0],
      ]);

      const gas = '10000000';
      await sendMetaTx(to, testForwarder, data, users[8].address, gas);

      gameId2 = increment(gameId2);

      const assetsAfter = await gameTokenContract.getAssetBalances(gameId2, [
        editorAssets[0],
      ]);
      expect(assetsBefore[0]).to.deep.equal(0);
      expect(assetsAfter[0]).to.deep.equal(5);
    });

    it('should allow GAME Editor to remove assets via MetaTx', async function () {
      const {to, data} = await GameMinter.populateTransaction.updateGame(
        gameId2,
        {
          ...update,
          assetIdsToRemove: editorAssets,
          assetAmountsToRemove: [3],
        }
      );

      const assetsBefore = await gameTokenContract.getAssetBalances(gameId2, [
        editorAssets[0],
      ]);

      const gas = '1000000';
      await sendMetaTx(to, testForwarder, data, users[1].address, gas);

      gameId2 = increment(gameId2);

      const assetsAfter = await gameTokenContract.getAssetBalances(gameId2, [
        editorAssets[0],
      ]);
      expect(assetsBefore[0]).to.deep.equal(5);
      expect(assetsAfter[0]).to.deep.equal(2);
    });

    it('should allow GAME Editor to set URI via MetaTx', async function () {
      const {to, data} = await GameMinter.populateTransaction.updateGame(
        gameId2,
        {
          ...update,
          uri: await getURI('New uri set via metatransaction'),
        }
      );

      const uriBefore = await gameTokenContract.tokenURI(gameId2);

      const gas = '1000000';
      await sendMetaTx(to, testForwarder, data, users[8].address, gas);

      gameId2 = increment(gameId2);

      const uriAfter = await gameTokenContract.tokenURI(gameId2);

      expect(uriBefore).to.be.equal(
        'ipfs://bafybeigf2jdadbxxem6je7t5wlomoa6a4ualmu6kqittw6723acf3bneoa/game.json'
      );
      expect(uriAfter).to.be.equal(
        'ipfs://bafybeibsy54me3nljizcjxj24ts4mrx5yfq6gmqcvmz3ctk3shyvwgkbmy/game.json'
      );
    });
  });
});
