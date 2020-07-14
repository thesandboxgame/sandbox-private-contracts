pragma solidity 0.6.5;
pragma experimental ABIEncoderV2;

import "../contracts_common/src/Libraries/SafeMathWithRequire.sol";
import "../contracts_common/src/Interfaces/ERC20.sol";
import "../contracts_common/src/BaseWithStorage/MetaTransactionReceiver.sol";
import "../contracts_common/src/Interfaces/Medianizer.sol";
import "../contracts_common/src/BaseWithStorage/Admin.sol";
import "../Catalyst/ERC20GroupCatalyst.sol";
import "../Catalyst/ERC20GroupGem.sol";
import "./PurchaseValidator.sol";


/**
 * @title StarterPack contract that supports SAND, DAI and ETH as payment
 * @notice This contract manages the distribution of StarterPacks for Catalysts and Gems
 */
contract StarterPackV1 is Admin, MetaTransactionReceiver, PurchaseValidator {
    using SafeMathWithRequire for uint256;
    uint256 internal constant DAI_PRICE = 14400000000000000;

    ERC20 internal immutable _sand;
    Medianizer private immutable _medianizer;
    ERC20 private immutable _dai;
    ERC20Group internal immutable _erc20GroupCatalyst;
    ERC20Group internal immutable _erc20GroupGem;

    bool _sandEnabled;
    bool _etherEnabled;
    bool _daiEnabled;

    uint256[] private _starterPackPrices;

    address payable internal _wallet;

    mapping(address => mapping(uint256 => uint256)) public nonceByCreator;

    mapping (uint256 => mapping(uint256 => uint256)) private _previousPrices;
    uint256 private _previousTransactionDelay = 60; // TODO: define suitable delay

    event Purchase(address indexed from, Message, uint256 priceInSand);

    event SetPrices(uint256[] prices);

    struct Message {
        uint256[] catalystIds;
        uint256[] catalystQuantities;
        uint256[] gemIds;
        uint256[] gemQuantities;
        address buyer;
        uint256 nonce;
    }

    // ////////////////////////// Functions ////////////////////////

    /// @dev set the wallet receiving the proceeds
    /// @param newWallet address of the new receiving wallet
    function setReceivingWallet(address payable newWallet) external {
        require(newWallet != address(0), "WALLET_ZERO_ADDRESS");
        require(msg.sender == _admin, "ONLY_ADMIN_CAN_CHANGE_WALLET");
        _wallet = newWallet;
    }

    /// @dev enable/disable DAI payment for StarterPacks
    /// @param enabled whether to enable or disable
    function setDAIEnabled(bool enabled) external {
        require(msg.sender == _admin, "ONLY_ADMIN_CAN_SET_DAI_ENABLED_OR_DISABLED");
        _daiEnabled = enabled;
    }

    /// @notice return whether DAI payments are enabled
    /// @return whether DAI payments are enabled
    function isDAIEnabled() external view returns (bool) {
        return _daiEnabled;
    }

    /// @notice enable/disable ETH payment for StarterPacks
    /// @param enabled whether to enable or disable
    function setETHEnabled(bool enabled) external {
        require(msg.sender == _admin, "ONLY_ADMIN_CAN_SET_ETH_ENABLED_OR_DISABLED");
        _etherEnabled = enabled;
    }

    /// @notice return whether ETH payments are enabled
    /// @return whether ETH payments are enabled
    function isETHEnabled() external view returns (bool) {
        _etherEnabled;
    }

    /// @dev enable/disable the specific SAND payment for StarterPacks
    /// @param enabled whether to enable or disable
    function setSANDEnabled(bool enabled) external {
        require(msg.sender == _admin, "ONLY_ADMIN_CAN_SET_SAND_ENABLED_OR_DISABLED");
        _sandEnabled = enabled;
    }

    /// @notice return whether the specific SAND payments are enabled
    /// @return whether the specific SAND payments are enabled
    function isSANDEnabled() external view returns (bool) {
        return _sandEnabled;
    }

    function purchaseWithSand(
        address from,
        Message calldata message,
        bytes calldata signature
    ) external {
        require(_sandEnabled, "SAND_IS_NOT_ENABLED");
        require(message.buyer != address(0), "DESTINATION_ZERO_ADDRESS");
        require(message.buyer != address(this), "DESTINATION_STARTERPACKV1_CONTRACT");
        require(isPurchaseValid(from, message.catalystIds, message.catalystQuantities, message.gemIds, message.gemQuantities, message.buyer, message.nonce, signature), "INVALID_PURCHASE");
        require(_isPricingValid(message.catalystIds), "INVALID_PRICING");

        uint256 amountInSand = _calculateTotalPriceInSand(message.catalystIds, message.catalystQuantities);
        _handlePurchaseWithERC20(message.buyer, _wallet, address(_sand), amountInSand);
        _erc20GroupCatalyst.batchTransferFrom(address(this), message.buyer, message.catalystIds, message.catalystQuantities);
        _erc20GroupGem.batchTransferFrom(address(this), message.buyer, message.gemIds, message.gemQuantities);
        emit Purchase(from, message, amountInSand);
    }

    // function purchaseWithEth(
    //     address from,
    //     address to,
    //     uint256[] calldata catalystIds,
    //     uint256[] calldata catalystQuantities,
    //     uint256[] calldata gemIds,
    //     uint256[] calldata gemQuantities,
    //     uint256 nonce,
    //     bytes calldata signature
    // ) external payable {
    //     // TODO:
    //     uint256 priceInSand = 0;

    //     emit Purchase(from, to, catalystIds, catalystQuantities, gemIds, gemQuantities, priceInSand);
    // }

    // function purchaseWithDai(
    //     address from,
    //     address to,
    //     uint256[] calldata catalystIds,
    //     uint256[] calldata catalystQuantities,
    //     uint256[] calldata gemIds,
    //     uint256[] calldata gemQuantities,
    //     uint256 nonce,
    //     bytes calldata signature
    // ) external payable {n
    //     // TODO:
    //     uint256 priceInSand = 0;

    //     emit Purchase(from, to, catalystIds, catalystQuantities, gemIds, gemQuantities, priceInSand);
    // }

    function withdrawAll(address to) external {
        require(msg.sender == _admin, "only admin can withdraw remaining tokens");
        // TODO: withdrawal
    }

    function setPrices(uint256[] calldata prices) external { // TODO: review
        require(msg.sender == _admin, "only admin can change StarterPack prices");
        for (uint256 i = 0; i < prices.length; i++) {
            uint256 price = prices[i];
            _previousPrices[i][price] = now + _previousTransactionDelay;
        }
        _starterPackPrices = prices;
        emit SetPrices(prices);
    }

    

     function getStarterPackPrices() external view returns (uint256[] memory prices) {
        return _starterPackPrices;
    }

    function checkCatalystBalance(uint256 tokenId) external view returns (uint256) {
        return _erc20GroupCatalyst.balanceOf(address(this), tokenId);
    }

    function checkGemBalance(uint256 tokenId) external view returns (uint256) {
        return _erc20GroupGem.balanceOf(address(this), tokenId);
    }

    function checkCatalystBatchBalances(uint256[] calldata tokenIds) external view returns (uint256[] memory balances) {
        address[] memory owners = new address[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            owners[i] = address(this);
        }
        return _erc20GroupCatalyst.balanceOfBatch(owners, tokenIds);
    }

    function checkGemBatchBalances(uint256[] calldata tokenIds) external view returns (uint256[] memory balances) {
        address[] memory owners = new address[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            owners[i] = address(this);
        }
        return _erc20GroupGem.balanceOfBatch(owners, tokenIds);
    }

    // ////////////////////////// Internal ////////////////////////

    /**
     * @notice Returns the amount of ETH for a specific amount of SAND
     * @param sandAmount An amount of SAND
     * @return The amount of ETH
     */
    function _getEtherAmountWithSAND(uint256 sandAmount) internal view returns (uint256) {
        uint256 ethUsdPair = _getEthUsdPair();
        return sandAmount.mul(DAI_PRICE).div(ethUsdPair);
    }

    /**
     * @notice Gets the ETHUSD pair from the Medianizer contract
     * @return The pair as an uint256
     */
    function _getEthUsdPair() internal view returns (uint256) {
        bytes32 pair = _medianizer.read();
        return uint256(pair);
    }

    function _calculateTotalPriceInSand(uint256[] memory catalystIds, uint256[] memory catalystQuantities) internal returns (uint256) {
        uint256 totalPrice;
        for (uint256 i = 0; i < catalystIds.length; i++) {
            uint256 id = catalystIds[i];
            uint256 quantity = catalystQuantities[i];
            totalPrice += (_starterPackPrices[id] * quantity);
        }
        return totalPrice;
    }

    function _isPricingValid(uint256[] memory catalystIds) internal returns (bool) {
        for (uint256 i = 0; i < catalystIds.length; i++) {
            uint256 id = catalystIds[i];
            uint256 price = _starterPackPrices[id];
            if (_previousPrices[id][price] < now) {
                return false;
            }
        }
        return true;
    }

    function _handlePurchaseWithERC20(
        address buyer,
        address payable paymentRecipient,
        address tokenAddress,
        uint256 amount
    ) internal {
        ERC20 token = ERC20(tokenAddress);
        uint256 amountForDestination = amount;
        require(token.transferFrom(buyer, paymentRecipient, amountForDestination), "PAYMENT_TRANSFER_FAILED");
    }

    // /////////////////// CONSTRUCTOR ////////////////////

    constructor(
        address starterPackAdmin,
        address sandContractAddress,
        address initialMetaTx,
        address payable initialWalletAddress,
        address medianizerContractAddress,
        address daiTokenContractAddress,
        address erc20GroupCatalystAddress,
        address erc20GroupGemAddress,
        address initialSigningWallet
    ) public PurchaseValidator(initialSigningWallet) {
        _admin = starterPackAdmin;
        _sand = ERC20(sandContractAddress);
        _setMetaTransactionProcessor(initialMetaTx, true);
        _wallet = initialWalletAddress;
        _admin = starterPackAdmin;
        _sand = ERC20(sandContractAddress);
        _medianizer = Medianizer(medianizerContractAddress);
        _dai = ERC20(daiTokenContractAddress);
        _erc20GroupCatalyst = ERC20Group(erc20GroupCatalystAddress);
        _erc20GroupGem = ERC20Group(erc20GroupGemAddress);
    }
}
