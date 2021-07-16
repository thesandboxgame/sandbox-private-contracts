import {setupAsset} from './fixtures';
import {waitFor, getAssetChainIndex} from '../utils';
import {expect} from '../chai-setup';
import {sendMetaTx} from '../sendMetaTx';

describe('Asset.sol', function () {
  it('user sending asset to itself keep the same balance', async function () {
    const {Asset, users, mintAsset} = await setupAsset();
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

  it('can transfer assets', async function () {
    const {Asset, users, mintAsset} = await setupAsset();
    const tokenId = await mintAsset(users[1].address, 11);
    await waitFor(
      users[1].Asset['safeTransferFrom(address,address,uint256,uint256,bytes)'](
        users[1].address,
        users[2].address,
        tokenId,
        10,
        '0x'
      )
    );
    const balance = await Asset['balanceOf(address,uint256)'](
      users[2].address,
      tokenId
    );
    expect(balance).to.be.equal(10);
  });

  it('user batch sending asset to itself keep the same balance', async function () {
    const {Asset, users, mintAsset} = await setupAsset();
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
    const {Asset, users, mintAsset} = await setupAsset();
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
    const {users, mintAsset} = await setupAsset();
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
    const {users, mintAsset} = await setupAsset();
    const tokenId = await mintAsset(users[1].address, 11);
    const chainIndex = getAssetChainIndex(tokenId);
    expect(chainIndex).to.be.equal(0);
  });

  it('can get the URI for an NFT', async function () {
    const {Asset, users, mintAsset} = await setupAsset();
    const tokenId = await mintAsset(users[1].address, 1);
    const URI = await Asset.callStatic.tokenURI(tokenId);
    expect(URI).to.be.equal(
      'ipfs://bafybeidyxh2cyiwdzczgbn4bk6g2gfi6qiamoqogw5bxxl5p6wu57g2ahy/0.json'
    );
  });

  it('can get the URI for a FT', async function () {
    const {Asset, users, mintAsset} = await setupAsset();
    const tokenId = await mintAsset(users[1].address, 11);
    const URI = await Asset.callStatic.tokenURI(tokenId);
    expect(URI).to.be.equal(
      'ipfs://bafybeidyxh2cyiwdzczgbn4bk6g2gfi6qiamoqogw5bxxl5p6wu57g2ahy/0.json'
    );
  });

  it('fails get the URI for an invalid tokeId', async function () {
    const {Asset} = await setupAsset();
    const tokenId = 42;
    await expect(Asset.callStatic.tokenURI(tokenId)).to.be.revertedWith(
      'NFT_!EXIST_||_FT_!MINTED'
    );
  });

  it('can burn ERC1155 asset', async function () {
    const {Asset, users, mintAsset} = await setupAsset();
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
    const {Asset, users, mintAsset} = await setupAsset();
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

  describe('Asset: MetaTransactions', function () {
    it('can transfer by metaTx', async function () {
      const {Asset, users, mintAsset, trustedForwarder} = await setupAsset();
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
      const {Asset, users, mintAsset, trustedForwarder} = await setupAsset();
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
      const {Asset, users, mintAsset, trustedForwarder} = await setupAsset();
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
});
