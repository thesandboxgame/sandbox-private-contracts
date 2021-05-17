// import {setupEstate} from './fixtures';
// import {waitFor} from '../utils';
// import {expect} from '../chai-setup';
// import {ethers} from 'hardhat';
// import {EstateTestHelper} from './estateTestHelper';
// import {getId} from './utils';
// const emptyBytes = Buffer.from('');

// describe('Estate', function () {
//   it('creating from Land Quad', async function () {
//     const {estateContract, landContractAsMinter, user0} = await setupEstate();
//     const size = 6;
//     const x = 6;
//     const y = 12;

//     await waitFor(landContractAsMinter.mintQuad(user0, size, x, y, emptyBytes));
//     const receipt = await waitFor(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .createFromQuad(user0, user0, size, x, y)
//     );

//     const tokenId = await getId(estateContract, receipt, 'QuadsAddedInEstate');

//     for (let sx = 0; sx < size; sx++) {
//       for (let sy = 0; sy < size; sy++) {
//         const id = x + sx + (y + sy) * 408;
//         const landOwner = await landContractAsMinter.callStatic.ownerOf(id);
//         expect(landOwner).to.equal(estateContract.address);
//       }
//     }
//     const estateOwner = await estateContract.callStatic.ownerOf(tokenId);
//     expect(estateOwner).to.equal(user0);
//   });
//   /**
//   it.skip('creating from Lands with junctions', async function () {
//     const {estateContract, landContractAsMinter, user0} = await setupEstate();
//     const size = 6;
//     const x = 6;
//     const y = 12;
//     await waitFor(landContractAsMinter.mintQuad(user0, size, x, y, emptyBytes));
//     const landIds = [];
//     const junctions = [];
//     for (let sx = 0; sx < size; sx++) {
//       for (let sy = 0; sy < size; sy++) {
//         landIds.push(x + sx + (y + sy) * 408);
//       }
//       junctions.push(sx * size);
//     }
//     await waitFor(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .createFromMultipleLands(user0, user0, landIds, junctions)
//     );
//     for (let sx = 0; sx < size; sx++) {
//       for (let sy = 0; sy < size; sy++) {
//         const id = x + sx + (y + sy) * 408;
//         const landOwner = await landContractAsMinter.callStatic.ownerOf(id);
//         expect(landOwner).to.equal(estateContract.address);
//       }
//     }
//     const estateOwner = await estateContract.callStatic.ownerOf(1);
//     expect(estateOwner).to.equal(user0);
//   });
// */
//   it('creating from multiple quads', async function () {
//     const {
//       estateContract,
//       landContractAsMinter,
//       user0,
//       helper,
//     } = await setupEstate();
//     const landQuads = EstateTestHelper.assignIds([
//       {x: 5, y: 7, size: 1},
//       {x: 6, y: 8, size: 1},
//       {x: 6, y: 9, size: 3},
//       {x: 6, y: 12, size: 3},
//       {x: 180, y: 24, size: 12},
//       {x: 42, y: 48, size: 6},
//       {x: 9, y: 15, size: 3},
//     ]);
//     await helper.mintQuads(user0, landQuads);
//     const {xs, ys, sizes, selection} = EstateTestHelper.selectQuads(landQuads, [
//       1,
//       2,
//       3,
//     ]);
//     const junctions: never[] = [];
//     await waitFor(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .createFromMultipleQuads(user0, user0, sizes, xs, ys, junctions)
//     );
//     for (const landQuad of selection) {
//       for (let sx = 0; sx < landQuad.size; sx++) {
//         for (let sy = 0; sy < landQuad.size; sy++) {
//           const id = landQuad.x + sx + (landQuad.y + sy) * 408;
//           const landOwner = await landContractAsMinter.callStatic.ownerOf(id);
//           expect(landOwner).to.equal(estateContract.address);
//         }
//       }
//     }
//     const estateOwner = await estateContract.callStatic.ownerOf(1);
//     expect(estateOwner).to.equal(user0);
//   });
//   /**
//   it.skip('creating from multiple quads fails if not connected', async function () {
//     const {estateContract, user0, helper} = await setupEstate();
//     const landQuads = EstateTestHelper.assignIds([
//       {x: 5, y: 7, size: 1},
//       {x: 6, y: 8, size: 1},
//       {x: 6, y: 9, size: 3},
//       {x: 6, y: 12, size: 3},
//       {x: 180, y: 24, size: 12},
//       {x: 42, y: 48, size: 6},
//       {x: 9, y: 15, size: 3},
//     ]);
//     await helper.mintQuads(user0, landQuads);
//     const {xs, ys, sizes} = EstateTestHelper.selectQuads(landQuads, [
//       1,
//       2,
//       3,
//       4,
//     ]);
//     const junctions: never[] = [];
//     await expect(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .createFromMultipleQuads(user0, user0, sizes, xs, ys, junctions)
//     ).to.be.revertedWith('JUNCTIONS_MISSING');
//   });
// */
//   it('creating from multiple quads with junctions', async function () {
//     const {estateContract, user0, helper} = await setupEstate();
//     const landQuads = EstateTestHelper.assignIds([
//       {x: 5, y: 7, size: 1},
//       {x: 6, y: 8, size: 1},
//       {x: 6, y: 9, size: 3},
//       {x: 6, y: 12, size: 3},
//       {x: 3, y: 9, size: 3},
//       {x: 180, y: 24, size: 12},
//       {x: 42, y: 48, size: 6},
//       {x: 9, y: 15, size: 3},
//     ]);
//     await helper.mintQuads(user0, landQuads);
//     const {xs, ys, sizes} = EstateTestHelper.selectQuads(landQuads, [
//       1,
//       2,
//       3,
//       4,
//     ]);
//     const junctions = [1];
//     await waitFor(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .createFromMultipleQuads(user0, user0, sizes, xs, ys, junctions)
//     );
//   });
//   /**
//   it.skip('creating from multiple quads without junctions fails', async function () {
//     const {estateContract, user0, helper} = await setupEstate();
//     const landQuads = EstateTestHelper.assignIds([
//       {x: 5, y: 7, size: 1},
//       {x: 6, y: 8, size: 1},
//       {x: 6, y: 9, size: 3},
//       {x: 6, y: 12, size: 3},
//       {x: 3, y: 9, size: 3},
//       {x: 180, y: 24, size: 12},
//       {x: 42, y: 48, size: 6},
//       {x: 9, y: 15, size: 3},
//     ]);
//     await helper.mintQuads(user0, landQuads);
//     const {xs, ys, sizes} = EstateTestHelper.selectQuads(landQuads, [
//       1,
//       2,
//       3,
//       4,
//     ]);
//     const junctions: never[] = [];
//     await expect(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .createFromMultipleQuads(user0, user0, sizes, xs, ys, junctions)
//     ).to.be.revertedWith('JUNCTIONS_MISSING');
//   });
// */
//   /**
//   it.skip('creating from multiple quads with invalid junctions fails', async function () {
//     const {estateContract, user0, helper} = await setupEstate();
//     const landQuads = EstateTestHelper.assignIds([
//       {x: 5, y: 7, size: 1},
//       {x: 6, y: 8, size: 1},
//       {x: 6, y: 9, size: 3},
//       {x: 6, y: 12, size: 3},
//       {x: 3, y: 9, size: 3},
//       {x: 180, y: 24, size: 12},
//       {x: 42, y: 48, size: 6},
//       {x: 9, y: 15, size: 3},
//     ]);
//     await helper.mintQuads(user0, landQuads);
//     const {xs, ys, sizes} = EstateTestHelper.selectQuads(landQuads, [
//       1,
//       2,
//       3,
//       4,
//     ]);
//     const junctions = [2];
//     await expect(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .createFromMultipleQuads(user0, user0, sizes, xs, ys, junctions)
//     ).to.be.revertedWith('JUNCTION_NOT_ADJACENT');
//   });
// */
//   /**
//   // function does not exist
//   it.skip('creating from multiple quads with junctions and destroying get them back', async function () {
//     const {estateContract, user0, helper} = await setupEstate();
//     const {selection} = await helper.mintQuadsAndCreateEstate(
//       {
//         quads: [
//           {x: 5, y: 7, size: 1},
//           {x: 6, y: 8, size: 1},
//           {x: 6, y: 9, size: 3},
//           {x: 6, y: 12, size: 3},
//           {x: 3, y: 9, size: 3},
//           {x: 180, y: 24, size: 12},
//           {x: 42, y: 48, size: 6},
//           {x: 9, y: 15, size: 3},
//         ],
//         junctions: [1],
//         selection: [1, 2, 3, 4],
//       },
//       user0
//     );
//     await waitFor(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .burnAndTransferFrom(user0, 1, user0)
//     );
//     helper.checkLandOwnership(selection, user0);
//   });
// */
//   /**
//   // function does not exist
//   it.skip('creating from multiple quads and adding more and destroying get them back', async function () {
//     const {estateContract, user0, helper} = await setupEstate();
//     const {selection} = await helper.mintQuadsAndCreateEstate(
//       {
//         quads: [
//           {x: 5, y: 7, size: 1},
//           {x: 6, y: 8, size: 1},
//           {x: 6, y: 9, size: 3},
//           {x: 6, y: 12, size: 3},
//           {x: 3, y: 9, size: 3},
//           {x: 180, y: 24, size: 12},
//           {x: 42, y: 48, size: 6},
//           {x: 9, y: 15, size: 3},
//         ],
//         junctions: [1],
//         selection: [1, 2, 3, 4],
//       },
//       user0
//     );

//     const extraLandQuads = EstateTestHelper.assignIds([
//       {x: 3, y: 12, size: 3},
//       {x: 4, y: 15, size: 1},
//       {x: 4, y: 16, size: 1},
//       {x: 4, y: 17, size: 1},
//       {x: 3, y: 18, size: 3},
//     ]);
//     await helper.mintQuads(user0, extraLandQuads);
//     const selected = EstateTestHelper.selectQuads(extraLandQuads);
//     const {xs, ys, sizes} = selected;
//     const newSelection = selected.selection;
//     for (const sel of newSelection) {
//       selection.push(sel);
//     }
//     await waitFor(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .addMultipleQuads(user0, 1, sizes, xs, ys, [])
//     );
//     await waitFor(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .burnAndTransferFrom(user0, 1, user0)
//     );
//     helper.checkLandOwnership(selection, user0);
//   });
// */
//   it('creating from multiple quads and adding more with gaps fails', async function () {
//     const {estateContract, user0, helper} = await setupEstate();
//     const {selection} = await helper.mintQuadsAndCreateEstate(
//       {
//         quads: [
//           {x: 5, y: 7, size: 1},
//           {x: 6, y: 8, size: 1},
//           {x: 6, y: 9, size: 3},
//           {x: 6, y: 12, size: 3},
//           {x: 3, y: 9, size: 3},
//           {x: 180, y: 24, size: 12},
//           {x: 42, y: 48, size: 6},
//           {x: 9, y: 15, size: 3},
//         ],
//         junctions: [1],
//         selection: [1, 2, 3, 4],
//       },
//       user0
//     );

//     const extraLandQuads = EstateTestHelper.assignIds([
//       {x: 4, y: 15, size: 1},
//       {x: 4, y: 16, size: 1},
//       {x: 4, y: 17, size: 1},
//       {x: 3, y: 18, size: 3},
//     ]);
//     await helper.mintQuads(user0, extraLandQuads);
//     const selected = EstateTestHelper.selectQuads(extraLandQuads);
//     const {xs, ys, sizes} = selected;
//     const newSelection = selected.selection;
//     for (const sel of newSelection) {
//       selection.push(sel);
//     }
//     await expect(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .addMultipleQuads(user0, 1, sizes, xs, ys, [])
//     ).to.be.reverted;
//   });
//   /**
//   // function does not exist
//   it.skip('creating from multiple quads and adding more with junctions and destroying get them back', async function () {
//     const {estateContract, user0, helper} = await setupEstate();
//     const {selection} = await helper.mintQuadsAndCreateEstate(
//       {
//         quads: [
//           {x: 5, y: 7, size: 1},
//           {x: 6, y: 8, size: 1},
//           {x: 6, y: 9, size: 3},
//           {x: 6, y: 12, size: 3},
//           {x: 3, y: 9, size: 3},
//           {x: 180, y: 24, size: 12},
//           {x: 42, y: 48, size: 6},
//           {x: 9, y: 15, size: 3},
//         ],
//         junctions: [1],
//         selection: [1, 2, 3, 4],
//       },
//       user0
//     );
//     const extraLandQuads = EstateTestHelper.assignIds([
//       {x: 6, y: 15, size: 3},
//       {x: 7, y: 18, size: 1},
//       {x: 7, y: 19, size: 1},
//       {x: 7, y: 20, size: 1},
//       {x: 6, y: 21, size: 3},
//       {x: 3, y: 15, size: 3},
//     ]);
//     await helper.mintQuads(user0, extraLandQuads);
//     const newSelected = EstateTestHelper.selectQuads(extraLandQuads);
//     const {xs, ys, sizes} = newSelected;
//     const newSelection = newSelected.selection;
//     for (const sel of newSelection) {
//       selection.push(sel);
//     }
//     await waitFor(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .addMultipleQuads(user0, 1, sizes, xs, ys, [2, 4])
//     );
//     await estateContract
//       .connect(ethers.provider.getSigner(user0))
//       .burnAndTransferFrom(user0, 1, user0);
//     helper.checkLandOwnership(selection, user0);
//   });
// */
//   /**
//   // function does not exist
//   it.skip('creating Estate with many Lands and destroying get them back', async function () {
//     const {estateContract, user0, helper} = await setupEstate();
//     const {selection} = await helper.mintQuadsAndCreateEstate(
//       {
//         quads: [
//           {x: 5, y: 7, size: 1},
//           {x: 6, y: 7, size: 1},
//           {x: 6, y: 8, size: 1},
//           {x: 6, y: 9, size: 3},
//           {x: 6, y: 12, size: 3},

//           {x: 3, y: 9, size: 3},
//           {x: 2, y: 9, size: 1},

//           {x: 4, y: 12, size: 1},
//           {x: 4, y: 13, size: 1},
//           {x: 4, y: 14, size: 1},
//           {x: 4, y: 15, size: 1},
//           {x: 4, y: 16, size: 1},
//           {x: 4, y: 17, size: 1},
//           {x: 4, y: 18, size: 1},
//           {x: 4, y: 19, size: 1},
//           {x: 4, y: 20, size: 1},
//           {x: 4, y: 21, size: 1},
//           {x: 4, y: 22, size: 1},
//           {x: 4, y: 23, size: 1},
//           {x: 4, y: 24, size: 1},
//           {x: 4, y: 25, size: 1},
//           {x: 4, y: 26, size: 1},
//           {x: 4, y: 27, size: 1},
//           {x: 4, y: 28, size: 1},
//           {x: 4, y: 29, size: 1},
//           {x: 4, y: 30, size: 1},
//           {x: 4, y: 31, size: 1},
//           {x: 4, y: 32, size: 1},
//           {x: 4, y: 33, size: 1},
//           {x: 4, y: 34, size: 1},
//           {x: 4, y: 35, size: 1},
//           {x: 4, y: 36, size: 1},
//           {x: 4, y: 37, size: 1},
//         ],
//         junctions: [3, 5],
//       },
//       user0
//     );
//     await waitFor(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .burnAndTransferFrom(user0, 1, user0)
//     );
//     helper.checkLandOwnership(selection, user0);
//   });
// */
//   it('creating Estate with many Lands and destroying in 2 step get them back', async function () {
//     const {estateContract, user0, helper} = await setupEstate();
//     const {selection} = await helper.mintQuadsAndCreateEstate(
//       {
//         quads: [
//           {x: 5, y: 7, size: 1},
//           {x: 6, y: 7, size: 1},
//           {x: 6, y: 8, size: 1},
//           {x: 6, y: 9, size: 3},
//           {x: 6, y: 12, size: 3},

//           {x: 3, y: 9, size: 3},
//           {x: 2, y: 9, size: 1},

//           {x: 4, y: 12, size: 1},
//           {x: 4, y: 13, size: 1},
//           {x: 4, y: 14, size: 1},
//           {x: 4, y: 15, size: 1},
//           {x: 4, y: 16, size: 1},
//           {x: 4, y: 17, size: 1},
//           {x: 4, y: 18, size: 1},
//           {x: 4, y: 19, size: 1},
//           {x: 4, y: 20, size: 1},
//           {x: 4, y: 21, size: 1},
//           {x: 4, y: 22, size: 1},
//           {x: 4, y: 23, size: 1},
//           {x: 4, y: 24, size: 1},
//           {x: 4, y: 25, size: 1},
//           {x: 4, y: 26, size: 1},
//           {x: 4, y: 27, size: 1},
//           {x: 4, y: 28, size: 1},
//           {x: 4, y: 29, size: 1},
//           {x: 4, y: 30, size: 1},
//           {x: 4, y: 31, size: 1},
//           {x: 4, y: 32, size: 1},
//           {x: 4, y: 33, size: 1},
//           {x: 4, y: 34, size: 1},
//           {x: 4, y: 35, size: 1},
//           {x: 4, y: 36, size: 1},
//           {x: 4, y: 37, size: 1},
//         ],
//         junctions: [3, 5],
//       },
//       user0
//     );
//     await waitFor(
//       estateContract.connect(ethers.provider.getSigner(user0)).burn(1)
//     );
//     await waitFor(
//       estateContract
//         .connect(ethers.provider.getSigner(user0))
//         .transferFromDestroyedEstate(user0, user0, 0)
//     );
//     helper.checkLandOwnership(selection, user0);
//   });
//   /**
//   it.skip('creating estate with gap fails', async function () {
//     const {user0, helper} = await setupEstate();
//     await expect(
//       helper.mintQuadsAndCreateEstate(
//         {
//           quads: [
//             {x: 5, y: 7, size: 1},
//             {x: 6, y: 7, size: 1},
//             {x: 6, y: 8, size: 1},
//             {x: 6, y: 9, size: 3},
//             {x: 6, y: 12, size: 3},

//             {x: 3, y: 9, size: 3},
//             {x: 2, y: 9, size: 1},

//             {x: 4, y: 12, size: 1},
//             {x: 4, y: 13, size: 1},
//             {x: 4, y: 14, size: 1},
//             {x: 4, y: 15, size: 1},
//             {x: 4, y: 16, size: 1},
//             {x: 4, y: 17, size: 1},
//             {x: 4, y: 18, size: 1},
//             {x: 4, y: 19, size: 1},
//             {x: 4, y: 20, size: 1},
//             {x: 4, y: 21, size: 1},
//             {x: 4, y: 22, size: 1},
//             {x: 4, y: 23, size: 1},
//             {x: 4, y: 24, size: 1},
//             {x: 4, y: 25, size: 1},

//             {x: 4, y: 27, size: 1},
//             {x: 4, y: 28, size: 1},
//             {x: 4, y: 29, size: 1},
//             {x: 4, y: 30, size: 1},
//             {x: 4, y: 31, size: 1},
//             {x: 4, y: 32, size: 1},
//             {x: 4, y: 33, size: 1},
//             {x: 4, y: 34, size: 1},
//             {x: 4, y: 35, size: 1},
//             {x: 4, y: 36, size: 1},
//             {x: 4, y: 37, size: 1},
//           ],
//           junctions: [3, 5],
//         },
//         user0
//       )
//     ).to.be.revertedWith('JUNCTIONS_MISSING');
//   });
// */
// });
