---
description: Fixing tests
---

# How to fix the tests locally ?

Switching branches or changing npm packages can provoke the tests to fail.
A quick fix is to reinstall the packages, clean the cache of hardhat with those commands:

```bash
yarn && yarn hardhat clean && yarn compile && yarn test
```
