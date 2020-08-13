const {BigNumber} = require("@ethersproject/bignumber");

function sandWei(v) {
  return BigNumber.from(v).mul("1000000000000000000").toString();
}
module.exports = {
  "1x1": sandWei(0),
  "3x3": sandWei(0),
  "6x6": sandWei(0),
  "12x12": sandWei(0),
  "24x24": sandWei(0),
  premium_1x1: sandWei(0),
};
