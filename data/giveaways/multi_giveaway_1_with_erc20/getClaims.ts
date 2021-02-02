import fs from 'fs';
import {BigNumber} from 'ethers';
import MerkleTree from '../../../lib/merkleTree';
import helpers from '../../../lib/merkleTreeHelper';

const {
  createDataArrayClaimableAssetsLandsAndSand,
  saltClaimableAssetsLandsAndSand,
} = helpers;

type AssetAndLandClaimWithSAND = {
  reservedAddress: string;
  assetIds?: Array<string>;
  assetValues?: Array<number>;
  landIds?: Array<number>;
  sand?: number;
};

export function createAssetLandAndSandClaimMerkleTree(
  isDeploymentChainId: boolean,
  chainId: string,
  claimData: Array<AssetAndLandClaimWithSAND>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  let secretPath = './.multi_giveaway_1_secret';
  if (BigNumber.from(chainId).toString() === '1') {
    console.log('MAINNET secret');
    secretPath = './.multi_giveaway_1_secret.mainnet';
  }

  let expose = false;
  let secret;
  try {
    secret = fs.readFileSync(secretPath);
  } catch (e) {
    if (isDeploymentChainId) {
      throw e;
    }
    secret =
      '0x4467363716526536535425451427798982881775318563547751090997863683';
  }

  if (!isDeploymentChainId) {
    expose = true;
  }

  const saltedClaims = saltClaimableAssetsLandsAndSand(claimData, secret);
  const tree = new MerkleTree(
    createDataArrayClaimableAssetsLandsAndSand(saltedClaims)
  );
  const merkleRootHash = tree.getRoot().hash;

  return {
    claims: expose ? saltedClaims : claimData,
    merkleRootHash,
    saltedClaims,
    tree,
  };
}