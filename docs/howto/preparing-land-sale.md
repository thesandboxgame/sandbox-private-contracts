---
description: Preparing a LAND sale
---

# How to prepare a LAND sale ?

## Requirements

If you haven't done it, follow the [getting started](../intro/index.md) tutorial first. Here the inputs you need to prepare a LAND sale:

- the bundles and sectors files provided by the backend team
- the deadline of the LAND sale

## Prepare the data of the sale

Export an environment variable to define the LAND sale folder. Replace `x` by the LAND sale number.
```shell
export LAND_SALE_PATH=data/landSales/LandPreSale_x
```

Create the new folder in `data/landSales` for the new LAND sale
!!! example
    ```shell
    mkdir $LAND_SALE_PATH
    ```

The bundles and sectors files will be given by the backend team. Copy those files to the LAND sale folder
```shell
touch $LAND_SALE_PATH/bundles.mainnet.json
touch $LAND_SALE_PATH/sectors.mainnet.json
```

Also, make a copy for the rinkeby network
```shell
cp -a $LAND_SALE_PATH/bundles.mainnet.json $LAND_SALE_PATH/bundles.rinkeby.json
cp -a $LAND_SALE_PATH/sectors.mainnet.json $LAND_SALE_PATH/sectors.rinkeby.json
```

You also need to modify `data/landSales/deadlines.ts` to add a new deadline which will mark then end of the sale).

!!! example
    ```ts
    const deadlines: {[sector: number]: number} =  {
      16: 1613566800, // Tuesday, 17 February 2021 13:00:00 GMT+00:00
      17: 1614776400, // Wednesday, 3 March 2021 13:00:00 GMT+00:00
      18: 1619701200, // Thursday, 29 April 2021 13:00:00 GMT+00:00
      19: Date.UTC(2021, 5, 10, 13) / 1000, // Thursday, 10 June 2021 13:00:00 GMT+00:00
    };
    export default deadlines;
    ```

## Prepare the deployment

Create a new deploy file in `deploy/09_landsale/`
You can copy an existing one. Don't forget to increment the prefix and to replace the `x` by your LAND sale number.
```shell
cp -a deploy/09_landsale/00_deploy_land_sale_7.ts deploy/09_landsale/01_deploy_land_sale_x.ts
```

Simply modify the following line to match the folder name created above
```ts
const LANDSALE_NAME = 'LandPreSale_x';
```

You also need to create a secret file (change the name to reflect the name chosen above)
Inside it, any string works. You can generate a random string.
!!! example
    ```shell
    mkdir secret
    openssl rand -base64 32 > secret/.LandPreSale_x_mainnet_secret
    ```

Execute the deployment on the testnet first
```shell
yarn deploy rinkeby
```

And then on the mainnet
```shell
yarn deploy mainnet
```

This will generate one or more file on the root folder called:

`.proofs_<name above>_<sector_number>_<network>.json`

This will need to be given to the backend team. More files will be generated, ready to be pushed to git repository.
