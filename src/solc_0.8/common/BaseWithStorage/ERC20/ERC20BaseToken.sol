//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "./extensions/ERC20Internal.sol";
import "../../interfaces/IERC20Extended.sol";
import "../WithSuperOperators.sol";

abstract contract ERC20BaseToken is WithSuperOperators, IERC20, IERC20Extended, ERC20Internal {
    bytes32 internal immutable _name; // works only for string that can fit into 32 bytes
    bytes32 internal immutable _symbol; // works only for string that can fit into 32 bytes
    address internal immutable _operator;
    uint256 internal _totalSupply;
    mapping(address => uint256) internal _balances;
    mapping(address => mapping(address => uint256)) internal _allowances;

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        address admin,
        address operator
    ) {
        require(bytes(tokenName).length > 0, "INVALID_NAME_REQUIRED");
        require(bytes(tokenName).length <= 32, "INVALID_NAME_TOO_LONG");
        _name = _firstBytes32(bytes(tokenName));
        require(bytes(tokenSymbol).length > 0, "INVALID_SYMBOL_REQUIRED");
        require(bytes(tokenSymbol).length <= 32, "INVALID_SYMBOL_TOO_LONG");
        _symbol = _firstBytes32(bytes(tokenSymbol));
        _admin = admin;
        _operator = operator;
    }

    /// @notice Transfer `amount` tokens to `to`.
    /// @param to The recipient address of the tokens being transfered.
    /// @param amount The number of tokens being transfered.
    /// @return success Whether or not the transfer succeeded.
    function transfer(address to, uint256 amount) external override returns (bool success) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    /// @notice Transfer `amount` tokens from `from` to `to`.
    /// @param from The origin address  of the tokens being transferred.
    /// @param to The recipient address of the tokensbeing  transfered.
    /// @param amount The number of tokens transfered.
    /// @return success Whether or not the transfer succeeded.
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external override returns (bool success) {
        if (msg.sender != from && !_superOperators[msg.sender] && msg.sender != _operator) {
            uint256 currentAllowance = _allowances[from][msg.sender];
            if (currentAllowance != ~uint256(0)) {
                // save gas when allowance is maximal by not reducing it (see https://github.com/ethereum/EIPs/issues/717)
                require(currentAllowance >= amount, "NOT_AUTHORIZED_ALLOWANCE");
                _allowances[from][msg.sender] = currentAllowance - amount;
            }
        }
        _transfer(from, to, amount);
        return true;
    }

    /// @notice Burn `amount` tokens.
    /// @param amount The number of tokens to burn.
    function burn(uint256 amount) external override {
        _burn(msg.sender, amount);
    }

    /// @notice Burn `amount` tokens from `owner`.
    /// @param from The address whose token to burn.
    /// @param amount The number of tokens to burn.
    function burnFor(address from, uint256 amount) external override {
        if (msg.sender != from && !_superOperators[msg.sender] && msg.sender != _operator) {
            uint256 currentAllowance = _allowances[from][msg.sender];
            if (currentAllowance != ~uint256(0)) {
                require(currentAllowance >= amount, "NOT_AUTHORIZED_ALLOWANCE");
                _allowances[from][msg.sender] = currentAllowance - amount;
            }
        }
        _burn(from, amount);
    }

    /// @notice Approve `spender` to transfer `amount` tokens.
    /// @param spender The address to be given rights to transfer.
    /// @param amount The number of tokens allowed.
    /// @return success Whether or not the call succeeded.
    function approve(address spender, uint256 amount) external override returns (bool success) {
        _approveFor(msg.sender, spender, amount);
        return true;
    }

    /// @notice Get the name of the token collection.
    /// @return The name of the token collection.
    function name() external view virtual returns (string memory) {
        //added virtual
        return string(abi.encodePacked(_name));
    }

    /// @notice Get the symbol for the token collection.
    /// @return The symbol of the token collection.
    function symbol() external view virtual returns (string memory) {
        //added virtual
        return string(abi.encodePacked(_symbol));
    }

    /// @notice Get the total number of tokens in existence.
    /// @return The total number of tokens in existence.
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    /// @notice Get the balance of `owner`.
    /// @param owner The address to query the balance of.
    /// @return The amount owned by `owner`.
    function balanceOf(address owner) external view override returns (uint256) {
        return _balances[owner];
    }

    /// @notice Get the allowance of `spender` for `owner`'s tokens.
    /// @param owner The address whose token is allowed.
    /// @param spender The address allowed to transfer.
    /// @return remaining The amount of token `spender` is allowed to transfer on behalf of `owner`.
    function allowance(address owner, address spender) external view override returns (uint256 remaining) {
        return _allowances[owner][spender];
    }

    /// @notice Get the number of decimals for the token collection.
    /// @return The number of decimals.
    function decimals() external pure virtual returns (uint8) {
        return uint8(18);
    }

    /// @notice Approve `spender` to transfer `amount` tokens from `owner`.
    /// @param owner The address whose token is allowed.
    /// @param spender The address to be given rights to transfer.
    /// @param amount The number of tokens allowed.
    /// @return success Whether or not the call succeeded.
    function approveFor(
        address owner,
        address spender,
        uint256 amount
    ) public override returns (bool success) {
        require(msg.sender == owner || _superOperators[msg.sender] || msg.sender == _operator, "NOT_AUTHORIZED");
        _approveFor(owner, spender, amount);
        return true;
    }

    /// @notice Increase the allowance for the spender if needed
    /// @param owner The address of the owner of the tokens
    /// @param spender The address wanting to spend tokens
    /// @param amountNeeded The amount requested to spend
    /// @return success Whether or not the call succeeded.
    function addAllowanceIfNeeded(
        address owner,
        address spender,
        uint256 amountNeeded
    ) public returns (bool success) {
        require(msg.sender == owner || _superOperators[msg.sender] || msg.sender == _operator, "INVALID_SENDER");
        _addAllowanceIfNeeded(owner, spender, amountNeeded);
        return true;
    }

    /// @notice Get the first 32 bytes of input `src`.
    /// @param src The input data
    /// @return output The first 32 bytes of `src`.
    function _firstBytes32(bytes memory src) public pure returns (bytes32 output) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            output := mload(add(src, 32))
        }
    }

    /// @dev See addAllowanceIfNeeded.
    function _addAllowanceIfNeeded(
        address owner,
        address spender,
        uint256 amountNeeded /*(ERC20Internal, ERC20ExecuteExtension, ERC20BasicApproveExtension)*/
    ) internal virtual override {
        if (amountNeeded > 0 && !isSuperOperator(spender) && spender != _operator) {
            uint256 currentAllowance = _allowances[owner][spender];
            if (currentAllowance < amountNeeded) {
                _approveFor(owner, spender, amountNeeded);
            }
        }
    }

    /// @dev See approveFor.
    function _approveFor(
        address owner,
        address spender,
        uint256 amount /*(ERC20BasicApproveExtension, ERC20Internal)*/
    ) internal virtual override {
        require(owner != address(0) && spender != address(0), "INVALID_OWNER_||_SPENDER");
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /// @dev See transfer.
    function _transfer(
        address from,
        address to,
        uint256 amount /*(ERC20Internal, ERC20ExecuteExtension)*/
    ) internal virtual override {
        require(to != address(0), "NOT_TO_ZEROADDRESS");
        require(to != address(this), "NOT_TO_THIS");
        uint256 currentBalance = _balances[from];
        require(currentBalance >= amount, "INSUFFICIENT_FUNDS");
        _balances[from] = currentBalance - amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    /// @dev Mint tokens for a recipient.
    /// @param to The recipient address.
    /// @param amount The number of token to mint.
    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "NOT_TO_ZEROADDRESS");
        require(amount > 0, "MINT_O_TOKENS");
        uint256 currentTotalSupply = _totalSupply;
        uint256 newTotalSupply = currentTotalSupply + amount;
        require(newTotalSupply > currentTotalSupply, "OVERFLOW");
        _totalSupply = newTotalSupply;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    /// @dev Burn tokens from an address.
    /// @param from The address whose tokens to burn.
    /// @param amount The number of token to burn.
    function _burn(address from, uint256 amount) internal {
        require(amount > 0, "BURN_O_TOKENS");
        if (msg.sender != from && !_superOperators[msg.sender] && msg.sender != _operator) {
            uint256 currentAllowance = _allowances[from][msg.sender];
            require(currentAllowance >= amount, "INSUFFICIENT_ALLOWANCE");
            if (currentAllowance != ~uint256(0)) {
                // save gas when allowance is maximal by not reducing it (see https://github.com/ethereum/EIPs/issues/717)
                _allowances[from][msg.sender] = currentAllowance - amount;
            }
        }

        uint256 currentBalance = _balances[from];
        require(currentBalance >= amount, "INSUFFICIENT_FUNDS");
        _balances[from] = currentBalance - amount;
        _totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }
}
