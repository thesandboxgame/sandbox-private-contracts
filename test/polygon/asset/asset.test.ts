import {setupAsset as setupPolygonAsset} from './fixtures';
import {setupAsset as setupMainnetAsset} from '../../asset/fixtures';
import {waitFor, getAssetChainIndex} from '../../utils';
import {expect} from '../../chai-setup';
import {sendMetaTx} from '../../sendMetaTx';
import {AbiCoder} from 'ethers/lib/utils';
import {Event} from '@ethersproject/contracts';

const abiCoder = new AbiCoder();

describe('PolygonAsset.sol', function () {
  it('user sending asset to itself keep the same balance', async function () {
    const {Asset, users, mintAsset} = await setupPolygonAsset();
    const tokenId = await mintAsset(users[0].address, 20);
    await waitFor(
      users[0].Asset['safeTransferFrom(address,address,uint256,uint256,bytes)'](
        users[0].address,
        users[0].address,
        tokenId,
        10,
        '0x'
      )
    );
    const balance = await Asset['balanceOf(address,uint256)'](
      users[0].address,
      tokenId
    );
    expect(balance).to.be.equal(20);
  });

  it('user batch sending asset to itself keep the same balance', async function () {
    const {Asset, users, mintAsset} = await setupPolygonAsset();
    const tokenId = await mintAsset(users[0].address, 20);
    await waitFor(
      users[0].Asset.safeBatchTransferFrom(
        users[0].address,
        users[0].address,
        [tokenId],
        [10],
        '0x'
      )
    );
    const balance = await Asset['balanceOf(address,uint256)'](
      users[0].address,
      tokenId
    );
    expect(balance).to.be.equal(20);
  });

  it('user batch sending in series whose total is more than its balance', async function () {
    const {Asset, users, mintAsset} = await setupPolygonAsset();
    const tokenId = await mintAsset(users[0].address, 20);
    await waitFor(
      users[0].Asset.safeBatchTransferFrom(
        users[0].address,
        users[0].address,
        [tokenId, tokenId, tokenId],
        [10, 20, 20],
        '0x'
      )
    );
    const balance = await Asset['balanceOf(address,uint256)'](
      users[0].address,
      tokenId
    );
    expect(balance).to.be.equal(20);
  });

  it('user batch sending more asset that it owns should fails', async function () {
    const {users, mintAsset} = await setupPolygonAsset();
    const tokenId = await mintAsset(users[0].address, 20);
    await expect(
      users[0].Asset.safeBatchTransferFrom(
        users[0].address,
        users[0].address,
        [tokenId],
        [30],
        '0x'
      )
    ).to.be.revertedWith(`BALANCE_TOO_LOW`);
  });

  it('can get the chainIndex from the tokenId', async function () {
    const {users, mintAsset} = await setupPolygonAsset();
    const tokenId = await mintAsset(users[1].address, 11);
    const chainIndex = getAssetChainIndex(tokenId);
    expect(chainIndex).to.be.equal(1);
  });

  it('can get the URI for an NFT', async function () {
    const {Asset, users, mintAsset} = await setupPolygonAsset();
    const tokenId = await mintAsset(users[1].address, 1);
    const URI = await Asset.callStatic.tokenURI(tokenId);
    expect(URI).to.be.equal(
      'ipfs://bafybeidyxh2cyiwdzczgbn4bk6g2gfi6qiamoqogw5bxxl5p6wu57g2ahy/0.json'
    );
  });

  it('can get the URI for a FT', async function () {
    const {Asset, users, mintAsset} = await setupPolygonAsset();
    const tokenId = await mintAsset(users[1].address, 11);
    const URI = await Asset.callStatic.tokenURI(tokenId);
    expect(URI).to.be.equal(
      'ipfs://bafybeidyxh2cyiwdzczgbn4bk6g2gfi6qiamoqogw5bxxl5p6wu57g2ahy/0.json'
    );
  });

  it('fails get the URI for an invalid tokeId', async function () {
    const {Asset} = await setupPolygonAsset();
    const tokenId = 42;
    await expect(Asset.callStatic.tokenURI(tokenId)).to.be.revertedWith(
      'NFT_!EXIST_||_FT_!MINTED'
    );
  });

  it('can burn ERC1155 asset', async function () {
    const {Asset, users, mintAsset} = await setupPolygonAsset();
    const tokenId = await mintAsset(users[0].address, 20);
    await waitFor(
      users[0].Asset['burnFrom(address,uint256,uint256)'](
        users[0].address,
        tokenId,
        10
      )
    );
    const balance = await Asset['balanceOf(address,uint256)'](
      users[0].address,
      tokenId
    );
    expect(balance).to.be.equal(10);
  });

  it('can burn ERC721 asset', async function () {
    const {Asset, users, mintAsset} = await setupPolygonAsset();
    const tokenId = await mintAsset(users[0].address, 1);
    await waitFor(
      users[0].Asset['burnFrom(address,uint256,uint256)'](
        users[0].address,
        tokenId,
        1
      )
    );
    const balance = await Asset['balanceOf(address,uint256)'](
      users[0].address,
      tokenId
    );
    expect(balance).to.be.equal(0);
  });

  describe('PolygonAsset: MetaTransactions', function () {
    it('can transfer by metaTx', async function () {
      const {
        Asset,
        users,
        mintAsset,
        trustedForwarder,
      } = await setupPolygonAsset();
      const tokenId = await mintAsset(users[1].address, 11);

      const {to, data} = await Asset.populateTransaction[
        'safeTransferFrom(address,address,uint256,uint256,bytes)'
      ](users[1].address, users[2].address, tokenId, 10, '0x');

      await sendMetaTx(to, trustedForwarder, data, users[1].address);

      const balance = await Asset['balanceOf(address,uint256)'](
        users[2].address,
        tokenId
      );
      expect(balance).to.be.equal(10);
    });

    it('fails to transfer someone else token by metaTx', async function () {
      const {
        Asset,
        users,
        mintAsset,
        trustedForwarder,
      } = await setupPolygonAsset();
      const tokenId = await mintAsset(users[1].address, 11);

      const {to, data} = await Asset.populateTransaction[
        'safeTransferFrom(address,address,uint256,uint256,bytes)'
      ](users[1].address, users[2].address, tokenId, 10, '0x');

      // users[2] trys to transfer users[1]'s token
      await sendMetaTx(to, trustedForwarder, data, users[2].address);

      const balance = await Asset['balanceOf(address,uint256)'](
        users[2].address,
        tokenId
      );
      // but it fails, and balance is not 10
      expect(balance).to.be.equal(0);
    });

    it('can batch-transfer by metaTx', async function () {
      const {
        Asset,
        users,
        mintAsset,
        trustedForwarder,
      } = await setupPolygonAsset();
      const tokenId1 = await mintAsset(users[1].address, 7);
      const tokenId2 = await mintAsset(users[1].address, 3);
      const tokenIds = [tokenId1, tokenId2];
      const values = [7, 3];

      const {to, data} = await Asset.populateTransaction[
        'safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)'
      ](users[1].address, users[2].address, tokenIds, values, '0x');

      await sendMetaTx(to, trustedForwarder, data, users[1].address);

      const balance1 = await Asset['balanceOf(address,uint256)'](
        users[2].address,
        tokenId1
      );
      const balance2 = await Asset['balanceOf(address,uint256)'](
        users[2].address,
        tokenId2
      );
      expect(balance1).to.be.equal(7);
      expect(balance2).to.be.equal(3);
    });
  });

  describe('Asset <> PolygonAsset: Transfer', function () {
    it('can transfer L1 minted assets: L1 to L2', async function () {
      const mainnet = await setupMainnetAsset();
      const polygon = await setupPolygonAsset();
      const tokenId = await mainnet.mintAsset(mainnet.users[0].address, 20);

      const balance = await mainnet.Asset['balanceOf(address,uint256)'](
        mainnet.users[0].address,
        tokenId
      );

      // Approve ERC1155 predicate contarct
      await waitFor(
        mainnet.users[0].Asset.setApprovalForAll(
          mainnet.predicate.address,
          true
        )
      );

      // Generate data to be passed to Polygon
      const ipfsHashes = [
        '0x78b9f42c22c3c8b260b781578da3151e8200c741c6b7437bafaff5a9df9b403e',
      ];
      const tokenData = abiCoder.encode(['bytes32[]'], [ipfsHashes]);
      const data = abiCoder.encode(
        ['uint256[]', 'uint256[]', 'bytes'],
        [[tokenId], [balance], tokenData]
      );

      // Lock tokens on ERC1155 predicate contract
      await waitFor(
        mainnet.predicate.lockTokens(
          mainnet.users[0].address,
          [tokenId],
          [20],
          data
        )
      );

      // Emulate the ChildChainManager call to deposit
      await waitFor(
        polygon.childChainManager.callDeposit(mainnet.users[0].address, data)
      );

      // Ensure balance has been updated on Asset & PolygonAsset
      const mainnet_balance = await mainnet.Asset['balanceOf(address,uint256)'](
        mainnet.users[0].address,
        tokenId
      );
      const polygon_balance = await polygon.Asset['balanceOf(address,uint256)'](
        mainnet.users[0].address,
        tokenId
      );
      expect(polygon_balance).to.be.equal(balance);
      expect(mainnet_balance).to.be.equal(0);

      // Ensure URI is same
      const mainnet_URI = await mainnet.Asset['tokenURI(uint256)'](tokenId);
      const polygon_URI = await polygon.Asset['tokenURI(uint256)'](tokenId);
      expect(mainnet_URI).to.be.equal(polygon_URI);
    });
    it('can transfer L2 minted assets: L2 to L1', async function () {
      const mainnet = await setupMainnetAsset();
      const polygon = await setupPolygonAsset();
      const tokenId = await polygon.mintAsset(polygon.users[0].address, 20);

      const balance = await polygon.Asset['balanceOf(address,uint256)'](
        polygon.users[0].address,
        tokenId
      );

      // User withdraws tokens from Polygon
      const receipt = await waitFor(
        polygon.users[0].Asset.withdraw([tokenId], [balance])
      );
      const event = receipt?.events?.filter(
        (event: Event) => event.event === 'ChainExit'
      )[0];
      const tokenData = event?.args?.data;

      // Emulate exit call
      await waitFor(
        mainnet.predicate.exitTokens(
          polygon.users[0].address,
          [tokenId],
          [balance],
          tokenData
        )
      );

      // Ensure balance has been updated on Asset & PolygonAsset
      const mainnet_balance = await mainnet.Asset['balanceOf(address,uint256)'](
        polygon.users[0].address,
        tokenId
      );
      const polygon_balance = await polygon.Asset['balanceOf(address,uint256)'](
        polygon.users[0].address,
        tokenId
      );
      expect(polygon_balance).to.be.equal(0);
      expect(mainnet_balance).to.be.equal(balance);

      // Ensure URI is same
      const mainnet_URI = await mainnet.Asset['tokenURI(uint256)'](tokenId);
      const polygon_URI = await polygon.Asset['tokenURI(uint256)'](tokenId);
      expect(mainnet_URI).to.be.equal(polygon_URI);
    });
    it('can transfer multiple L1 minted assets: L1 to L2', async function () {
      const mainnet = await setupMainnetAsset();
      const polygon = await setupPolygonAsset();
      const hash_01 =
        '0x78b9f42c22c3c8b260b781578da3151e8200c741c6b7437bafaff5a9df9b403e';
      const hash_02 =
        '0x83a68fc134ed86aed865454adbe76086adbe7609de987db432ab587ad7655a68';
      // Format: <variable>_<hash_id>_<id>
      const balance_01_01 = 20;
      const balance_01_02 = 10;
      const balance_02_01 = 5;
      const balance_02_02 = 15;
      const tokenId_01_01 = await mainnet.mintAsset(
        mainnet.users[0].address,
        balance_01_01,
        hash_01
      );
      const tokenId_01_02 = await mainnet.mintAsset(
        mainnet.users[0].address,
        balance_01_02,
        hash_01
      );
      const tokenId_02_01 = await mainnet.mintAsset(
        mainnet.users[0].address,
        balance_02_01,
        hash_02
      );
      const tokenId_02_02 = await mainnet.mintAsset(
        mainnet.users[0].address,
        balance_02_02,
        hash_02
      );

      // Approve ERC1155 predicate contarct
      await waitFor(
        mainnet.users[0].Asset.setApprovalForAll(
          mainnet.predicate.address,
          true
        )
      );

      // Generate data to be passed to Polygon
      const tokenIds = [
        tokenId_01_01,
        tokenId_01_02,
        tokenId_02_01,
        tokenId_02_02,
      ];
      const balances = [
        balance_01_01,
        balance_01_02,
        balance_02_01,
        balance_02_02,
      ];
      const ipfsHashes = [hash_01, hash_01, hash_02, hash_02];
      const tokenData = abiCoder.encode(['bytes32[]'], [ipfsHashes]);
      const data = abiCoder.encode(
        ['uint256[]', 'uint256[]', 'bytes'],
        [tokenIds, balances, tokenData]
      );

      // @temp - checking token URI
      for (var i = 0; i < tokenIds.length; i++) {
        const mainnet_URI = await mainnet.Asset['tokenURI(uint256)'](
          tokenIds[i]
        );
        console.log(mainnet_URI);
      }

      // Lock tokens on ERC1155 predicate contract
      await waitFor(
        mainnet.predicate.lockTokens(
          mainnet.users[0].address,
          tokenIds,
          balances,
          data
        )
      );

      // Emulate the ChildChainManager call to deposit
      await waitFor(
        polygon.childChainManager.callDeposit(mainnet.users[0].address, data)
      );

      // Ensure balance has been updated on Asset & PolygonAsset
      for (var i = 0; i < tokenIds.length; i++) {
        const mainnet_balance = await mainnet.Asset[
          'balanceOf(address,uint256)'
        ](mainnet.users[0].address, tokenIds[i]);
        const polygon_balance = await polygon.Asset[
          'balanceOf(address,uint256)'
        ](mainnet.users[0].address, tokenIds[i]);
        expect(polygon_balance).to.be.equal(balances[i]);
        expect(mainnet_balance).to.be.equal(0);

        // Ensure URI is same
        const mainnet_URI = await mainnet.Asset['tokenURI(uint256)'](
          tokenIds[i]
        );
        const polygon_URI = await polygon.Asset['tokenURI(uint256)'](
          tokenIds[i]
        );
        expect(mainnet_URI).to.be.equal(polygon_URI);
        // console.log(mainnet_URI);
        // console.log(polygon_URI);
      }
    });
  });
});
