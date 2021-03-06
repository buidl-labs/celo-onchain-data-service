import BigNumber from "bignumber.js";

export const BLOCKS_PER_EPOCH = 17280;

export function getEpochFromBlock(block) {
  if (block == 0) return 0;

  let epochNumber = Math.floor(block / BLOCKS_PER_EPOCH);
  if (block % BLOCKS_PER_EPOCH == 0) {
    return epochNumber;
  } else {
    return epochNumber + 1;
  }
}

export async function getVGSlashingMultiplier(kit, address) {
  const validators = await kit._web3Contracts.getValidators();
  // "0xa432da0ed5a2c15cbc681227ccec3b375908fdcb"
  try {
    return await validators.methods
      .getValidatorGroupSlashingMultiplier(address)
      .call();
  } catch (err) {
    return err.code;
  }
}

export async function getTargetVotingYield(kit) {
  const epochReward = await kit._web3Contracts.getEpochRewards();

  // fetches the current reward multiplier from the contract.
  const rewardMultiplierResp = await epochReward.methods
    .getRewardsMultiplier()
    .call();

  // fetches the current target voting yield parameters  from the contract.
  const targetVotingYieldResp = await epochReward.methods
    .getTargetVotingYieldParameters()
    .call();

  // targetVotingYield -> 160000000000000000000 (0.00016 * 10^24)
  // target inflation over an year -> (0.00016 + 1) ** 365 = 1.06
  // 1.06 represents 6% increase year-over-year.
  const targetVotingYield = BigNumber(targetVotingYieldResp[0])
    .div(10 ** 24)
    .plus(1)
    .exponentiatedBy(365)
    .minus(1);

  // rewardMultiplier changes based on the target inflation rate for the network.
  // for more info -> https://docs.celo.org/celo-codebase/protocol/proof-of-stake/epoch-rewards#adjusting-rewards-for-target-schedule
  const rewardMultiplier = BigNumber(rewardMultiplierResp).div(10 ** 24);

  // target yield -> targetVotingYield * rewardMultiplier
  return targetVotingYield.times(rewardMultiplier).times(100).toFixed();
}

export async function getElectedValidators(kit) {
  const validators = await kit.contracts.getValidators();
  const election = await kit.contracts.getElection();

  const electedValidatorSigners = await election.getCurrentValidatorSigners();
  const electedValidators = await Promise.all(
    electedValidatorSigners.map(async (signer) => {
      const account = await validators.signerToAccount(signer);
      return validators.getValidator(account);
    })
  );
  return electedValidators;
}

export async function getBlockVGRegistered(kit, address) {
  const validators = await kit.contracts.getValidators();
  const latestBlock = await kit.web3.eth.getBlockNumber();
  const events = await validators.getPastEvents("ValidatorGroupRegistered", {
    fromBlock: 1,
    toBlock: latestBlock,
  });

  const vgRegisteredEvent = events.find(
    (e) => e.returnValues.group.toLowerCase() == address
  );
  return vgRegisteredEvent;
}
