import express from "express";
import morgan from "morgan";
import cors from "cors";
import { newKit } from "@celo/contractkit";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Celo on-chain data service",
      version: "1.0.0",
    },
  },
  apis: ["index.js"],
};
const specs = swaggerJsdoc(options);
specs.then((spec) => console.log(spec.paths));

const app = express();
const kit = newKit(`https://forno.celo.org`);

app.use(express.json());
app.use(morgan("tiny"));
app.use(cors());
// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

const BLOCKS_PER_EPOCH = 17280;

/* 
APIs to implement ->
1. Find when was VG registered
2. Find estimated APY for a VG
3. List of currently elected Validators
*/

/**
 * @openapi
 * /:
 *   get:
 *     description: Welcome to swagger-jsdoc!
 *     responses:
 *       200:
 *         description: Returns a mysterious string.
 */
app.get("/", async (req, res) => {
  return res.json({ API: "Fetch Celo on-chain data." });
});

/**
 * @openapi
 * /:
 *   get:
 *     description: Welcome to swagger-jsdoc!
 *     responses:
 *       200:
 *         description: Returns a mysterious string.
 */
app.get("/current-epoch", async (req, res) => {
  const currentBlockNumber = await kit.web3.eth.getBlockNumber();
  return res.json({ epoch: getEpochFromBlock(currentBlockNumber) });
});

/**
 * @openapi
 * /:
 *   get:
 *     description: Welcome to swagger-jsdoc!
 *     responses:
 *       200:
 *         description: Returns a mysterious string.
 */
app.get("/downtime-score/:address", async (req, res) => {
  const { address } = req.params;
  const slashingMultiplier = await getVGSlashingMultiplier(kit, address);
  return res.json({ multiplier: slashingMultiplier });
});

/**
 * @openapi
 * /:
 *   get:
 *     description: Welcome to swagger-jsdoc!
 *     responses:
 *       200:
 *         description: Returns a mysterious string.
 */
app.get("/target-voting-yield", async (req, res) => {
  const targetVotingYield = await getTargetVotingYield(kit);

  return res.json({ target_yield: targetVotingYield });
});

app.listen(5000, async () => {
  console.log("Lezzz go 🚀");
});

/* UTIL FUNCTIONS */
function getEpochFromBlock(block) {
  if (block == 0) return 0;

  return Math.floor(block / BLOCKS_PER_EPOCH);
}

async function getVGSlashingMultiplier(kit, address) {
  const validators = await kit._web3Contracts.getValidators();
  // "0xa432da0ed5a2c15cbc681227ccec3b375908fdcb"
  return await validators.methods
    .getValidatorGroupSlashingMultiplier(address)
    .call();
}

async function getTargetVotingYield(kit) {
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
  console.log(targetVotingYield.times(rewardMultiplier).times(100).toString());
}
