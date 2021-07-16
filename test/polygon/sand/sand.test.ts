import {setupSand as setupPolygonSand} from './fixtures';
import {setupERC20BasicApproveExtension as setupMainnetSand} from '../../sand/fixtures';
import {waitFor} from '../../utils';
import {expect} from '../../chai-setup';
import {ethers} from 'hardhat';
import {AbiCoder} from 'ethers/lib/utils';
import {BigNumber} from '@ethersproject/bignumber';

const abiCoder = new AbiCoder();

describe('PolygonSand.sol', function () {
  describe('Bridging: L1 <> L2', function () {
    it('should be able to transfer SAND: L1 to L2', async function () {
      const polygon = await setupPolygonSand();
      const mainnet = await setupMainnetSand();

      const transferAmount = ethers.utils.parseEther('20').toString();

      const mainnet_balance = BigNumber.from(
        await mainnet.sandContractAsUser0.balanceOf(
          mainnet.sandBeneficiary.address
        )
      );
      const polygon_balance = BigNumber.from(
        await polygon.users[0].Sand.balanceOf(polygon.sandBeneficiary.address)
      );

      // Grant approval to ERC20 predicate contract
      await waitFor(
        mainnet.sandBeneficiary.sandContract.approve(
          mainnet.predicate.address,
          transferAmount
        )
      );

      // Lock tokens on ERC20 predicate contract
      const data = abiCoder.encode(['uint256'], [transferAmount]);
      await waitFor(
        mainnet.predicate.lockTokens(
          mainnet.sandBeneficiary.address,
          polygon.sandBeneficiary.address,
          data
        )
      );

      // Emulate the ChildChainManager call to deposit
      await waitFor(
        polygon.childChainManager.callSandDeposit(
          polygon.Sand.address,
          polygon.sandBeneficiary.address,
          data
        )
      );

      // Ensure balance is updated on Mainnet & Polygon
      const updated_mainnet_balance = BigNumber.from(
        await mainnet.sandContractAsUser0.balanceOf(
          mainnet.sandBeneficiary.address
        )
      );
      const updated_polygon_balance = BigNumber.from(
        await polygon.users[0].Sand.balanceOf(polygon.sandBeneficiary.address)
      );

      expect(updated_mainnet_balance).to.be.equal(
        mainnet_balance.sub(transferAmount)
      );
      expect(updated_polygon_balance).to.be.equal(
        polygon_balance.add(transferAmount)
      );
    });
    it('should be able to transfer SAND: L2 to L1', async function () {
      const polygon = await setupPolygonSand();
      const mainnet = await setupMainnetSand();

      const transferAmount = ethers.utils.parseEther('20').toString();

      // Transfer: L1 to L2
      await waitFor(
        mainnet.sandBeneficiary.sandContract.approve(
          mainnet.predicate.address,
          transferAmount
        )
      );
      const data = abiCoder.encode(['uint256'], [transferAmount]);
      await waitFor(
        mainnet.predicate.lockTokens(
          mainnet.sandBeneficiary.address,
          mainnet.sandBeneficiary.address,
          data
        )
      );
      await waitFor(
        polygon.childChainManager.callSandDeposit(
          polygon.Sand.address,
          mainnet.sandBeneficiary.address,
          data
        )
      );

      const mainnet_balance = BigNumber.from(
        await mainnet.sandContractAsUser0.balanceOf(
          mainnet.sandBeneficiary.address
        )
      );
      const polygon_balance = BigNumber.from(
        await polygon.users[0].Sand.balanceOf(mainnet.sandBeneficiary.address)
      );

      // Withdraw tokens from PolygonSand
      await waitFor(polygon.sandBeneficiary.Sand.withdraw(transferAmount));

      // Emulate exit token
      await waitFor(
        mainnet.predicate.exitTokens(
          mainnet.sandBeneficiary.address,
          transferAmount
        )
      );

      // Ensure balance is updated on Mainnet & Polygon
      const updated_mainnet_balance = BigNumber.from(
        await mainnet.sandContractAsUser0.balanceOf(
          mainnet.sandBeneficiary.address
        )
      );
      const updated_polygon_balance = BigNumber.from(
        await polygon.users[0].Sand.balanceOf(mainnet.sandBeneficiary.address)
      );
      console.log(mainnet_balance.toString());
      console.log(polygon_balance.toString());
      console.log(updated_mainnet_balance.toString());
      console.log(updated_polygon_balance.toString());
      expect(updated_mainnet_balance).to.be.equal(
        mainnet_balance.add(transferAmount)
      );
      expect(updated_polygon_balance).to.be.equal(
        polygon_balance.sub(transferAmount)
      );
    });
  });
});
