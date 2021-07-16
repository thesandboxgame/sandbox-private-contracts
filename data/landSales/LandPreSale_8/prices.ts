import {BigNumber} from '@ethersproject/bignumber';

function sandWei(v: number) {
  return BigNumber.from(v).mul("1000000000000000000").toString();
}

// These are Mainnet prices based on 0.036367$ per SAND
const prices: {[priceId: string]: string} =  {
  "1x1": sandWei(1011),
  "3x3": sandWei(8648),
  "6x6": sandWei(32772),
  "12x12": sandWei(123806),
  "24x24": sandWei(466102),
  premium_1x1: sandWei(4683),
};


export default prices;
