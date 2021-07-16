//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "../common/BaseWithStorage/ERC20/ERC20Token.sol";

contract Gem is ERC20Token {
    uint16 public immutable gemId;

    constructor(
        string memory name,
        string memory symbol,
        address admin,
        uint16 _gemId,
        address operator
    ) ERC20Token(name, symbol, admin, operator) {
        gemId = _gemId;
    }
}
