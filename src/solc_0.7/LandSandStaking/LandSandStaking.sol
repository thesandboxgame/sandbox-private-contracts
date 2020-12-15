//SPDX-License-Identifier: MIT
pragma solidity 0.7.5;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../common/BaseWithStorage/staking/StakingBase.sol";
import "../common/BaseWithStorage/WithAdmin.sol";
import "../common/Libraries/ExtraSafeMath.sol";

contract LandSandStaking is StakingBase, WithAdmin {
    using SafeMath for uint256;
    using ExtraSafeMath for uint256;
    using SafeERC20 for IERC20;

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    uint256 public immutable duration;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 internal constant DECIMALS_9 = 1000000000;
    uint256 internal constant MIDPOINT_9 = 500000000;
    uint256 internal constant NFT_FACTOR_6 = 10000;
    uint256 internal constant NFT_CONSTANT_3 = 9000;
    uint256 internal constant ROOT3_FACTOR = 697;

    IERC20 internal immutable _rewardToken;
    IERC721 internal immutable _multiplierNFToken;

    uint256 internal _totalContributions;
    mapping(address => uint256) internal _contributions;

    constructor(
        IERC20 stakeToken,
        IERC20 rewardToken,
        IERC721 multiplierNFToken,
        uint256 rewardDuration,
        address admin
    ) StakingBase(stakeToken) {
        _rewardToken = rewardToken;
        _multiplierNFToken = multiplierNFToken;
        duration = rewardDuration;
        _admin = admin;
    }

    function totalContributions() public view returns (uint256) {
        return _totalContributions;
    }

    function contributionOf(address account) public view returns (uint256) {
        return _contributions[account];
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();

        if (block.timestamp >= periodFinish || _totalContributions != 0) {
            // ensure reward past the first staker do not get lost
            lastUpdateTime = lastTimeRewardApplicable();
        }
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalContributions() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e24).div(totalContributions())
            );
    }

    function earned(address account) public view returns (uint256) {
        return
            contributionOf(account).mul(rewardPerToken().sub(userRewardPerTokenPaid[account])).div(1e24).add(
                rewards[account]
            );
    }

    function computeContribution(uint256 amountStaked, uint256 numLands) public pure returns (uint256) {
        if (numLands == 0) {
            return amountStaked;
        }
        uint256 nftContrib = NFT_FACTOR_6.mul(NFT_CONSTANT_3.add(numLands.sub(1).mul(ROOT3_FACTOR).add(1).cbrt3()));
        if (nftContrib > MIDPOINT_9) {
            nftContrib = MIDPOINT_9.add(nftContrib.sub(MIDPOINT_9).div(10));
        }
        return amountStaked.add(amountStaked.mul(nftContrib).div(DECIMALS_9));
    }

    function stake(uint256 amount) public override updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        uint256 contribution = computeContribution(amount, _multiplierNFToken.balanceOf(msg.sender));
        _totalContributions = _totalContributions.add(contribution);
        _contributions[msg.sender] = _contributions[msg.sender].add(contribution);
        super.stake(amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public override updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        uint256 balance = balanceOf(msg.sender);
        uint256 ratio = amount.mul(DECIMALS_18).div(balance);
        uint256 currentContribution = contributionOf(msg.sender);
        uint256 contributionReduction = currentContribution.mul(ratio).div(DECIMALS_18);
        _contributions[msg.sender] = currentContribution.sub(contributionReduction);
        _totalContributions = _totalContributions.sub(contributionReduction);
        super.withdraw(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function exit() external {
        withdraw(balanceOf(msg.sender));
        getReward();
    }

    function getReward() public updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            _rewardToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    ///@notice to be called after the amount of reward tokens (specified by the reward parameter) has been sent to the contract
    // Note that the reward should be divisible by the duration to avoid reward token lost
    ///@param reward number of token to be distributed over the duration
    function notifyRewardAmount(uint256 reward) external onlyAdmin updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(duration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover).div(duration);
        }
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(duration);
        emit RewardAdded(reward);
    }
}
