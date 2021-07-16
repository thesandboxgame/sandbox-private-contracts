import fs from 'fs';
import {BigNumber} from 'ethers';
import MerkleTree from '../../../lib/merkleTree';
import helpers, {MultiClaim} from '../../../lib/merkleTreeHelper';

const {
  createDataArrayMultiClaim,
  saltMultiClaim,
} = helpers;

export function createClaimMerkleTree(
  isDeploymentChainId: boolean,
  chainId: string,
  claimData: Array<MultiClaim>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  let secretPath = './secret/.multi_giveaway_1_secret';
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

  const saltedClaims = saltMultiClaim(claimData, secret);
  const tree = new MerkleTree(
    createDataArrayMultiClaim(saltedClaims)
  );
  const merkleRootHash = tree.getRoot().hash;

  return {
    claims: expose ? saltedClaims : claimData,
    merkleRootHash,
    saltedClaims,
    tree,
  };
}
