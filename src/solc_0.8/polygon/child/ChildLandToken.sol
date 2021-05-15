//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "../../land/SimplifiedLandBaseToken.sol";

// solhint-disable-next-line no-empty-blocks
contract ChildLandToken is SimplifiedLandBaseToken {
    constructor(
        address trustedForwarder,
        uint8 chainIndex,
        address admin
    )
        SimplifiedLandBaseToken(trustedForwarder, chainIndex, admin)
        // solhint-disable-next-line no-empty-blocks
    {}
}