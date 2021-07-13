//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "../polygon/LiquidityMining/PolygonLandWeightedSANDRewardPool.sol";

contract PolygonLandWeightedSANDRewardPoolNFTTest is PolygonLandWeightedSANDRewardPool {
    constructor(
        address stakeTokenContract,
        address rewardTokenContract,
        address nftContract,
        uint256 rewardDuration
    )
        PolygonLandWeightedSANDRewardPool(
            IERC20(stakeTokenContract),
            IERC20(rewardTokenContract),
            IERC721(nftContract),
            rewardDuration
        )
    // solhint-disable-next-line no-empty-blocks
    {

    }
}
