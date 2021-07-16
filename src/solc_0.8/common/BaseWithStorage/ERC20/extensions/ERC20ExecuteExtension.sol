// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "./ERC20Internal.sol";

abstract contract ERC20ExecuteExtension is ERC20Internal {
    /// @dev _executionAdmin != _admin so that this super power can be disabled independently
    address internal _executionAdmin;

    event ExecutionAdminAdminChanged(address oldAdmin, address newAdmin);

    /// @notice give the address responsible for adding execution rights.
    /// @return address of the execution administrator.
    function getExecutionAdmin() external view returns (address) {
        return _executionAdmin;
    }

    /// @notice change the execution adminstrator to be `newAdmin`.
    /// @param newAdmin address of the new administrator.
    function changeExecutionAdmin(address newAdmin) external {
        require(msg.sender == _executionAdmin, "only executionAdmin can change executionAdmin");
        emit ExecutionAdminAdminChanged(_executionAdmin, newAdmin);
        _executionAdmin = newAdmin;
    }

    mapping(address => bool) internal _executionOperators;
    event ExecutionOperator(address executionOperator, bool enabled);

    /// @notice set `executionOperator` as executionOperator: `enabled`.
    /// @param executionOperator address that will be given/removed executionOperator right.
    /// @param enabled set whether the executionOperator is enabled or disabled.
    function setExecutionOperator(address executionOperator, bool enabled) external {
        require(msg.sender == _executionAdmin, "only execution admin is allowed to add execution operators");
        _executionOperators[executionOperator] = enabled;
        emit ExecutionOperator(executionOperator, enabled);
    }

    /// @notice check whether address `who` is given executionOperator rights.
    /// @param who The address to query.
    /// @return whether the address has executionOperator rights.
    function isExecutionOperator(address who) public view returns (bool) {
        return _executionOperators[who];
    }

    /// @notice execute on behalf of the contract.
    /// @param to destination address fo the call.
    /// @param gasLimit exact amount of gas to be passed to the call.
    /// @param data the bytes sent to the destination address.
    /// @return success whether the execution was successful.
    /// @return returnData data resulting from the execution.
    function executeWithSpecificGas(
        address to,
        uint256 gasLimit,
        bytes calldata data
    ) external returns (bool success, bytes memory returnData) {
        require(_executionOperators[msg.sender], "only execution operators allowed to execute on SAND behalf");
        // solhint-disable-next-line avoid-low-level-calls
        (success, returnData) = to.call{gas: gasLimit}(data);
        assert(gasleft() > gasLimit / 63); // not enough gas provided, assert to throw all gas // TODO use EIP-1930
    }

    /// @notice approve a specific amount of token for `from` and execute on behalf of the contract.
    /// @param from address of which token will be transfered.
    /// @param to destination address fo the call.
    /// @param amount number of tokens allowed that can be transfer by the code at `to`.
    /// @param gasLimit exact amount of gas to be passed to the call.
    /// @param data the bytes sent to the destination address.
    /// @return success whether the execution was successful.
    /// @return returnData data resulting from the execution.
    function approveAndExecuteWithSpecificGas(
        address from,
        address to,
        uint256 amount,
        uint256 gasLimit,
        bytes calldata data
    ) external returns (bool success, bytes memory returnData) {
        require(_executionOperators[msg.sender], "only execution operators allowed to execute on SAND behalf");
        return _approveAndExecuteWithSpecificGas(from, to, amount, gasLimit, data);
    }

    /// @dev the reason for this function is that charging for gas here is more gas-efficient than doing it in the caller.
    /// @notice approve a specific amount of token for `from` and execute on behalf of the contract. Plus charge the gas required to perform it.
    /// @param from address of which token will be transfered.
    /// @param to destination address fo the call.
    /// @param amount number of tokens allowed that can be transfer by the code at `to`.
    /// @param gasLimit exact amount of gas to be passed to the call.
    /// @param tokenGasPrice price in token for the gas to be charged.
    /// @param baseGasCharge amount of gas charged on top of the gas used for the call.
    /// @param tokenReceiver recipient address of the token charged for the gas used.
    /// @param data the bytes sent to the destination address.
    /// @return success whether the execution was successful.
    /// @return returnData data resulting from the execution.
    function approveAndExecuteWithSpecificGasAndChargeForIt(
        address from,
        address to,
        uint256 amount,
        uint256 gasLimit,
        uint256 tokenGasPrice,
        uint256 baseGasCharge,
        address tokenReceiver,
        bytes calldata data
    ) external returns (bool success, bytes memory returnData) {
        uint256 initialGas = gasleft();
        require(_executionOperators[msg.sender], "only execution operators allowed to execute on SAND behalf");
        (success, returnData) = _approveAndExecuteWithSpecificGas(from, to, amount, gasLimit, data);
        if (tokenGasPrice > 0) {
            _charge(from, gasLimit, tokenGasPrice, initialGas, baseGasCharge, tokenReceiver);
        }
    }

    /// @notice transfer 1amount1 token from `from` to `to` and charge the gas required to perform that transfer.
    /// @param from address of which token will be transfered.
    /// @param to destination address fo the call.
    /// @param amount number of tokens allowed that can be transfer by the code at `to`.
    /// @param gasLimit exact amount of gas to be passed to the call.
    /// @param tokenGasPrice price in token for the gas to be charged.
    /// @param baseGasCharge amount of gas charged on top of the gas used for the call.
    /// @param tokenReceiver recipient address of the token charged for the gas used.
    /// @return whether the transfer was successful.
    function transferAndChargeForGas(
        address from,
        address to,
        uint256 amount,
        uint256 gasLimit,
        uint256 tokenGasPrice,
        uint256 baseGasCharge,
        address tokenReceiver
    ) external returns (bool) {
        uint256 initialGas = gasleft();
        require(_executionOperators[msg.sender], "only execution operators allowed to perfrom transfer and charge");
        _transfer(from, to, amount);
        if (tokenGasPrice > 0) {
            _charge(from, gasLimit, tokenGasPrice, initialGas, baseGasCharge, tokenReceiver);
        }
        return true;
    }

    function _charge(
        address from,
        uint256 gasLimit,
        uint256 tokenGasPrice,
        uint256 initialGas,
        uint256 baseGasCharge,
        address tokenReceiver
    ) internal {
        uint256 gasCharge = initialGas - gasleft();
        if (gasCharge > gasLimit) {
            gasCharge = gasLimit;
        }
        gasCharge += baseGasCharge;
        uint256 tokensToCharge = gasCharge * tokenGasPrice;
        require(tokensToCharge / gasCharge == tokenGasPrice, "overflow");
        _transfer(from, tokenReceiver, tokensToCharge);
    }

    function _approveAndExecuteWithSpecificGas(
        address from,
        address to,
        uint256 amount,
        uint256 gasLimit,
        bytes memory data
    ) internal returns (bool success, bytes memory returnData) {
        if (amount > 0) {
            _addAllowanceIfNeeded(from, to, amount);
        }
        // solhint-disable-next-line avoid-low-level-calls
        (success, returnData) = to.call{gas: gasLimit}(data);
        assert(gasleft() > gasLimit / 63); // not enough gas provided, assert to throw all gas // TODO use EIP-1930
    }
}
