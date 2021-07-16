import 'dotenv/config';
import {HardhatUserConfig} from 'hardhat/types';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers'; // aliased to hardhat-deploy-ethers
import 'hardhat-gas-reporter';
import '@openzeppelin/hardhat-upgrades';
import 'solidity-coverage';
import 'hardhat-contract-sizer';
import '@nomiclabs/hardhat-etherscan';
import {node_url, accounts} from './utils/network';

const config: HardhatUserConfig = {
  gasReporter: {
    currency: 'USD',
    gasPrice: 100,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    maxMethodDiff: 10,
  },
  mocha: {
    timeout: 0,
  },
  solidity: {
    compilers: [
      {
        version: '0.8.2',
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
      {
        version: '0.7.5',
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
      {
        version: '0.6.5',
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
      {
        version: '0.5.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
    ],
    overrides: {
      'src/solc_0.8/polygon/child/asset/PolygonAssetV2.sol': {
        version: '0.8.2',
        settings: {
          optimizer: {
            enabled: true,
            runs: 550,
          },
        },
      },
    },
  },
  namedAccounts: {
    deployer: {
      default: 1,
      mainnet: '0xe19ae8F9B36Ca43D12741288D0e311396140DF6F',
      rinkeby: '0x8A0e83DE499d7543CF486974a6196a35B5F573E7',
      goerli: '0xA796AE911621E00809E0E7C8f0AD6BF118E5139e',
      mumbai: '0x5F890c9522dCE5670d741D4277BFCC2d9cA8Af02',
    }, // deploy contracts and make sure they are set up correctly

    sandAdmin: {
      default: 2,
      mainnet: '0xeaa0993e1d21c2103e4f172a20d29371fbaf6d06',
      rinkeby: '0xa4519D601F43D0b8f167842a367465681F652252',
      goerli: '0x39D01ecc951C2c1f20ba0549e62212659c4d1e06',
    }, // can add super operators and change admin

    upgradeAdmin: 'sandAdmin',

    multiGiveawayAdmin: 'sandAdmin',

    liquidityRewardProvider: {
      default: 'sandBeneficiary',
      mainnet: '0x8FFA64FB50559c3Ff09a1022b84B2c5233ed8068',
    },
    liquidityRewardAdmin: 'sandAdmin',

    kyberDepositor: {
      default: 'sandBeneficiary',
      mainnet: '0x8FFA64FB50559c3Ff09a1022b84B2c5233ed8068',
    },

    sandExecutionAdmin: 'sandAdmin', // can add execution extension to SAND (used for Native metatx support)
    mintingFeeCollector: 'sandAdmin', // will receiver the fee from Asset minting
    sandBeneficiary: 'sandAdmin', // will be the owner of all initial SAND
    assetAdmin: 'sandAdmin', // can add super operator and change admin to Asset
    assetMinterAdmin: 'sandAdmin', // can set metaTxProcessors & types
    assetBouncerAdmin: 'sandAdmin', // setup the contract allowed to mint Assets
    sandSaleAdmin: 'sandAdmin', // can pause the sandSale and withdraw SAND
    genesisBouncerAdmin: 'sandAdmin', // can set who is allowed to mint
    defaultMinterAdmin: 'sandAdmin', // can change the fees
    genesisMinter: 'sandAdmin', // the first account allowed to mint genesis Assets
    assetAuctionFeeCollector: 'sandSaleBeneficiary', // collect fees from asset auctions
    assetAuctionAdmin: 'sandAdmin', // can change fee collector

    sandSaleBeneficiary: {
      default: 3,
      mainnet: '0x9695ed5020BB47880738Db356678fe8cBc8FF60b', // TODO use another wallet ?
      rinkeby: '0x60927eB036621b801491B6c5e9A60A8d2dEeD75A',
      goerli: '0xF22455c7F2a81E197AecD951F588a9B650f5b282',
    },

    Foundation: {
      default: 5,
      mainnet: '', // TODO
    },

    StakingPool: {
      default: 6,
      mainnet: '', // TODO
    },

    treasury: {
      default: 'sandSaleBeneficiary',
      rinkeby: 'sandSaleBeneficiary',
      goerli: 'sandSaleBeneficiary',
      mainnet: '0x4489590a116618B506F0EfE885432F6A8ED998E9',
    },

    landSaleBeneficiary: {
      default: 'sandSaleBeneficiary',
      rinkeby: 'sandSaleBeneficiary',
      goerli: 'sandSaleBeneficiary',
      mainnet: 'treasury',
    }, // updated to company treasury wallet 9th September - collect funds from land sales

    catalystAssetFeeRecipient: 'treasury',

    landSaleFeeRecipient: {
      default: 3,
      rinkeby: 5,
      goerli: 5,
      mainnet: '0x0EB04462D69B1D267d269377E34f60b9De1c8510',
    }, // collect 5% fee from land sales (prior to implementation of FeeDistributor)

    landAdmin: {
      default: 2,
      mainnet: '0xeaa0993e1d21c2103e4f172a20d29371fbaf6d06',
      rinkeby: '0xa4519D601F43D0b8f167842a367465681F652252',
      goerli: '0x39D01ecc951C2c1f20ba0549e62212659c4d1e06',
    }, // can add super operators and change admin

    gemsAndCatalystsAdmin: 'sandAdmin',
    assetAttributesRegistryAdmin: 'sandAdmin',
    proxyAdminOwner: {
      default: 2,
      mainnet: '0xeaa0993e1d21c2103e4f172a20d29371fbaf6d06',
      rinkeby: '0xa4519D601F43D0b8f167842a367465681F652252',
      goerli: '0x39D01ecc951C2c1f20ba0549e62212659c4d1e06',
    },

    landSaleAdmin: 'sandAdmin', // can enable currencies
    gameTokenAdmin: 'sandAdmin', // can set minter address
    gameTokenFeeBeneficiary: 'treasury', // receives fees from GAME token  minting / Mods
    estateAdmin: 'sandAdmin', // can add super operators and change admin
    P2PERC721SaleAdmin: 'sandAdmin', // can set fees
    backendReferralWallet: {
      // default is computed from private key:
      // "0x4242424242424242424242424242424242424242424242424242424242424242"
      default: '0x17c5185167401eD00cF5F5b2fc97D9BBfDb7D025',
      mainnet: '0x3044719d139F866a44c988823513eCB93060bF1b',
      rinkeby: '0xB7060D3FeCAC3AE1F0A0AA416E3e8E472257950e',
      goerli: '0xB7060D3FeCAC3AE1F0A0AA416E3e8E472257950e',
    },
    sandboxAccount: {
      default: 4,
      mainnet: '0x7A9fe22691c811ea339D9B73150e6911a5343DcA',
      rinkeby: '0x5BC3D5A39a50BE2348b9C529f81aE79f00945897', // Leon account on demo.sandbox
      goerli: '0x5BC3D5A39a50BE2348b9C529f81aE79f00945897', // Leon account on demo.sandbox
    },
    extraCatalystAndGemMinter: {
      default: null,
      mainnet: null,
      rinkeby: '0x5BC3D5A39a50BE2348b9C529f81aE79f00945897', // Leon account on demo.sandbox
      goerli: '0x5BC3D5A39a50BE2348b9C529f81aE79f00945897', // Leon account on demo.sandbox
    },
    collectionCatalystMigrationsAdmin: 'sandAdmin', // TODO use special account or deployer ?
    catalystMinter: 'sandAdmin', // account that can mint catalysts
    catalystAdmin: 'sandAdmin', // can set minter and admin for catatalyt, as well as super operators
    gemAdmin: 'sandAdmin', // can set minter and admin for gems, as well as super operators
    gemMinter: 'sandAdmin', // account that can mint gems
    catalystRegistryAdmin: 'sandAdmin', // can change the minter
    catalystMinterAdmin: 'sandAdmin', // control the fees and which catalyst are allowed
    starterPackAdmin: 'sandAdmin', // can change price
    starterPackSaleBeneficiary: 'treasury', // collect funds from starter pack sales
    backendMessageSigner: 'backendReferralWallet', // account that sign message for the starter pack
    kyberLiquidityProvider: 'sandBeneficiary', //TODO check what should be the value

    gemsCatalystsRegistryAdmin: 'sandAdmin',
  },
  networks: {
    /**
     * TAGS:
     *  - mainnet -> production networks
     *  - testnet -> non production networks
     *  - L1      -> Layer 1 networks
     *  - L2      -> Layer 2 networks
     */
    hardhat: {
      accounts: accounts(process.env.HARDHAT_FORK),
      tags: ['testnet', 'L1', 'L2'],
      forking: process.env.HARDHAT_FORK
        ? {
            url: node_url(process.env.HARDHAT_FORK),
            blockNumber: process.env.HARDHAT_FORK_NUMBER
              ? parseInt(process.env.HARDHAT_FORK_NUMBER)
              : undefined,
          }
        : undefined,
      deploy: ['deploy_polygon', 'deploy'],
      // deploy: ['deploy-for-test', 'deploy'],
    },
    localhost: {
      url: 'http://localhost:8545',
      accounts: accounts(),
      tags: ['testnet', 'L1', 'L2'],
    },
    rinkeby_test: {
      url: node_url('rinkeby'),
      accounts: accounts('rinkeby_test'),
      tags: ['testnet'],
    },
    rinkeby: {
      url: node_url('rinkeby'),
      accounts: accounts('rinkeby'),
      tags: ['testnet', 'L1'],
    },
    goerli: {
      url: node_url('goerli'),
      accounts: accounts('goerli'),
      tags: ['testnet', 'L1'],
      gasPrice: 600000000000,
    },
    mainnet: {
      url: node_url('mainnet'),
      accounts: accounts('mainnet'),
      tags: ['mainnet', 'L1'],
    },
    mumbai: {
      url: node_url('mumbai'),
      accounts: accounts('mumbai'),
      tags: ['testnet', 'L2'],
      deploy: ['deploy_polygon'],
    },
    polygon: {
      url: node_url('polygon'),
      accounts: accounts('polygon'),
      tags: ['mainnet', 'L2'],
      deploy: ['deploy_polygon'],
    },
  },
  paths: {
    sources: 'src',
  },

  external: process.env.HARDHAT_FORK
    ? {
        deployments: {
          hardhat: ['deployments/' + process.env.HARDHAT_FORK],
        },
      }
    : undefined,
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
};

export default config;
