import express from "express";
import morgan from "morgan";
import cors from "cors";
import { newKit } from "@celo/contractkit";
import {
  getEpochFromBlock,
  getVGSlashingMultiplier,
  getTargetVotingYield,
  getElectedValidators,
  getBlockVGRegistered,
} from "./utils.js";

const app = express();
const kit = newKit(`https://forno.celo.org`);

app.use(express.json());
app.use(morgan("tiny"));
app.use(cors());

app.get("/current-epoch", async (req, res) => {
  try {
    const currentBlockNumber = await kit.web3.eth.getBlockNumber();
    return res.json({ epoch: getEpochFromBlock(currentBlockNumber) });
  } catch (err) {
    return res.json({ error: "CANT_FETCH_CURRENT_BLOCK" }).status(500);
  }
});

app.get("/downtime-score/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const slashingMultiplier = await getVGSlashingMultiplier(kit, address);
    if (slashingMultiplier == "INVALID_ARGUMENT")
      return res.json({ error: slashingMultiplier }).status(404);
    return res.json({ multiplier: slashingMultiplier });
  } catch (err) {
    return res.json({ error: err.message }).status(500);
  }
});

app.get("/target-apy", async (req, res) => {
  try {
    const targetVotingYield = await getTargetVotingYield(kit);
    return res.json({ target_apy: targetVotingYield });
  } catch (err) {
    return res.json({ error: err.message }).status(500);
  }
});

app.get("/elected-validators", async (req, res) => {
  try {
    const electedValidators = await getElectedValidators(kit);
    return res.json({
      validators: electedValidators.map((v) => ({
        name: v.name,
        address: v.address,
        group: v.affiliation,
      })),
    });
  } catch (err) {
    return res.json({ error: err.message }).status(500);
  }
});

app.get("/epoch-vg-registered/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const vgRegisteredEvent = await getBlockVGRegistered(kit, address);
    if (vgRegisteredEvent === undefined)
      return res.json({ error: "VG_NOT_FOUND" }).status(404);

    return res.json({
      block: vgRegisteredEvent.blockNumber,
      epoch: getEpochFromBlock(vgRegisteredEvent.blockNumber),
    });
  } catch (err) {
    return res.json({ error: err.message }).status(500);
  }
});

app.listen(5000, async () => {
  console.log("Lezzz go 🚀");
});
