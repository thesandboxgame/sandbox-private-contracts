//SPDX-License-Identifier: MIT
// solhint-disable-next-line compiler-version
pragma solidity 0.8.2;

import "@openzeppelin/contracts-0.8/access/Ownable.sol";
import "../../../Sand/SandBaseToken.sol";

contract PolygonSand is SandBaseToken, Ownable {
    address public childChainManagerProxy;

    constructor(
        address _childChainManagerProxy,
        address sandAdmin,
        address executionAdmin
    ) SandBaseToken(sandAdmin, executionAdmin, address(0), 0) {
        require(_childChainManagerProxy != address(0), "Bad ChildChainManagerProxy address");
        childChainManagerProxy = _childChainManagerProxy;
    }

    /// @notice update the ChildChainManager Proxy address
    /// @param newChildChainManagerProxy address of the new childChainManagerProxy
    function updateChildChainManager(address newChildChainManagerProxy) external onlyOwner {
        require(newChildChainManagerProxy != address(0), "Bad ChildChainManagerProxy address");
        childChainManagerProxy = newChildChainManagerProxy;
    }

    /// @notice called when tokens are deposited on root chain
    /// @param user user address for whom deposit is being done
    /// @param depositData abi encoded amount
    function deposit(address user, bytes calldata depositData) external {
        require(_msgSender() == childChainManagerProxy, "You're not allowed to deposit");
        uint256 amount = abi.decode(depositData, (uint256));
        _mint(user, amount);
    }

    /// @notice called when user wants to withdraw tokens back to root chain
    /// @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
    /// @param amount amount to withdraw
    function withdraw(uint256 amount) external {
        _burn(_msgSender(), amount);
    }
}
