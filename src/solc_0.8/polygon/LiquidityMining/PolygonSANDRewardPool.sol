//SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts-0.8/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-0.8/utils/math/Math.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";
import "./IRewardDistributionRecipient.sol";
import "../../common/interfaces/IERC721.sol";

contract LPTokenWrapper {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 internal _stakeToken;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    constructor(IERC20 stakeToken) {
        _stakeToken = stakeToken;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function stake(uint256 amount) public virtual {
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        _stakeToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) public virtual {
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        _stakeToken.safeTransfer(msg.sender, amount);
    }
}

contract SANDRewardPool is LPTokenWrapper, IRewardDistributionRecipient {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant DURATION = 30 days; // Reward period

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    IERC20 internal _rewardToken;

    constructor(IERC20 stakeToken, IERC20 rewardToken) LPTokenWrapper(stakeToken) {
        _rewardToken = rewardToken;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
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
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18).div(totalSupply())
            );
    }

    function earned(address account) public view returns (uint256) {
        return
            balanceOf(account).mul(rewardPerToken().sub(userRewardPerTokenPaid[account])).div(1e18).add(
                rewards[account]
            );
    }

    // stake visibility is public as overriding LPTokenWrapper's stake() function
    function stake(uint256 amount) public override updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        super.stake(amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public override updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        super.withdraw(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function exit() external {
        withdraw(balanceOf(msg.sender));
        getReward();
    }

    function getReward() public updateReward(msg.sender) {
        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            rewards[msg.sender] = 0;
            _rewardToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function notifyRewardAmount(uint256 reward) external override onlyRewardDistribution updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(DURATION);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover).div(DURATION);
        }
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(DURATION);
        emit RewardAdded(reward);
    }

    // Add Setter functions for every external contract

    function SetRewardLPToken(address newRewardToken) external onlyOwner {
        require(newRewardToken != address(0), "Bad RewardToken address");

        _rewardToken = IERC20(newRewardToken);
    }

    function SetStakeLPToken(address newStakeLPToken) external onlyOwner {
        require(newStakeLPToken != address(0), "Bad StakeToken address");

        _stakeToken = IERC20(newStakeLPToken);
    }
}
