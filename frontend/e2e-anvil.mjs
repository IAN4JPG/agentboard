// AgentBoard end-to-end check on a local Anvil chain (NO browser needed).
// Mirrors exactly what the frontend does through the UI:
//   create BNB bounty -> claim -> submit -> release
//   + ERC20 bounty with exact-amount approve first (same as the UI approve step)
//   + cancel path (refund) + refundExpired path + claimTimeout path
//   + negative checks that mirror the UI gating (no Agent ID, poster cannot
//     claim own bounty, timeout too early).
//
// Usage:  node e2e-anvil.mjs        (from frontend/, or npm run e2e)
// The script starts its own Anvil on 127.0.0.1:8545 (unless one is already
// running there), deploys MockAgentID + MockERC20 + AgentBoard from the
// forge build output, runs every step, writes frontend/e2e-anvil.log, and
// exits non-zero if any step FAILs. Anvil test keys only; nothing leaves
// the local machine, no mainnet/testnet transaction is ever sent.

import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ethers } from "ethers";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const LOG_FILE = path.join(HERE, "e2e-anvil.log");
const RPC_URL = "http://127.0.0.1:8545";
const ANVIL_PORT = 8545;

// Well-known Anvil test accounts (local only, funded by Anvil itself).
// Taken from Anvil's own "Private Keys" output for its default mnemonic
// and verified with `cast wallet address` before this script was written:
// key 0 -> 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,
// key 1 -> 0x70997970C51812dc3A010C7d01b50e0d17dc79C8,
// key 2 -> 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC.
// The script asserts these addresses and their funding up front, so a
// wrong key fails fast instead of failing later as "insufficient funds".
const POSTER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const WORKER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const STRANGER_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const EXPECTED = {
  poster: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  worker: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  stranger: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
};

let passed = 0;
let failed = 0;
const lines = [];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  lines.push(line);
  console.log(line);
}

function check(name, cond, extra = "") {
  if (cond) {
    passed++;
    log(`PASS  ${name}${extra ? "  (" + extra + ")" : ""}`);
  } else {
    failed++;
    log(`FAIL  ${name}${extra ? "  (" + extra + ")" : ""}`);
  }
}

function loadBuild(rel) {
  return JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));
}

function findAnvil() {
  try {
    return execSync("command -v anvil", { encoding: "utf8" }).trim();
  } catch {
    for (const p of ["/.foundry/bin/anvil", "/.local/bin/anvil"]) {
      const full = process.env.HOME + p;
      try {
        execSync(`test -x ${full}`);
        return full;
      } catch { /* try next */ }
    }
    return "anvil";
  }
}

async function waitForRpc(provider, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await provider.getBlockNumber();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return false;
}

function gasCost(receipt, tx) {
  const price = tx.gasPrice ?? receipt.gasPrice ?? 0n;
  return receipt.gasUsed * price;
}

async function expectRevert(name, promiseFn) {
  try {
    await promiseFn();
    check(name, false, "expected revert, call succeeded");
  } catch (e) {
    const msg = e.reason || e.message || "";
    check(name, /revert|AgentBoard/.test(msg), "reverted: " + msg.slice(0, 120));
  }
}

async function main() {
  writeFileSync(LOG_FILE, "");
  log("AgentBoard e2e-anvil: start");
  log("Repo root: " + ROOT);

  // cacheTimeout: -1 disables ethers v6's 250ms shared-request cache.
  // Without this, getBalance / getTransactionCount / getBlock read right
  // after a mined transaction return the pre-transaction value, which
  // breaks every exact balance assertion and every deadline computed from
  // the latest block. (A browser wallet does not have this problem: the
  // user confirms one transaction at a time and the UI re-reads later.)
  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { cacheTimeout: -1 });
  let anvil = null;
  if (await waitForRpc(provider, 2000)) {
    log("Anvil already running on " + RPC_URL + ", reusing it (will not stop it).");
  } else {
    const anvilBin = findAnvil();
    log("Starting Anvil: " + anvilBin + " --port " + ANVIL_PORT + " --chain-id 31337");
    anvil = spawn(anvilBin, ["--port", String(ANVIL_PORT), "--chain-id", "31337"], {
      stdio: "ignore",
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.foundry/bin:${process.env.HOME}/.local/bin:${process.env.PATH}`,
      },
    });
    if (!(await waitForRpc(provider))) {
      log("FATAL: Anvil did not come up on " + RPC_URL);
      process.exitCode = 1;
      return;
    }
    log("Anvil up.");
  }

  // NonceManager is REQUIRED here, not optional: ethers v6 JsonRpcProvider
  // caches eth_getTransactionCount until its next block poll (default 4s),
  // so a plain Wallet sending rapid sequential transactions reuses a stale
  // nonce and Anvil rejects the second one with "nonce too low" even
  // though the first transaction is already mined. NonceManager tracks the
  // nonce locally and increments it on every send, which matches what a
  // browser wallet does when the user confirms transactions one by one.
  const poster = new ethers.NonceManager(new ethers.Wallet(POSTER_KEY, provider));
  const worker = new ethers.NonceManager(new ethers.Wallet(WORKER_KEY, provider));
  const stranger = new ethers.NonceManager(new ethers.Wallet(STRANGER_KEY, provider));
  // NonceManager has no .address property, so resolve the addresses once.
  const posterAddr = await poster.getAddress();
  const workerAddr = await worker.getAddress();
  const strangerAddr = await stranger.getAddress();
  // Fail fast if the test keys do not match the Anvil instance in use.
  check("poster key derives to Anvil account 0", posterAddr === EXPECTED.poster, posterAddr);
  check("worker key derives to Anvil account 1", workerAddr === EXPECTED.worker, workerAddr);
  check("stranger key derives to Anvil account 2", strangerAddr === EXPECTED.stranger, strangerAddr);
  for (const [name, addr] of [["poster", posterAddr], ["worker", workerAddr], ["stranger", strangerAddr]]) {
    check(`Anvil funds ${name}`, (await provider.getBalance(addr)) > 0n);
  }
  const chainId = Number((await provider.getNetwork()).chainId);
  check("chainId is Anvil local 31337", chainId === 31337, "chainId=" + chainId);

  // ---- Deploy mocks + board from forge build output ---------------------
  const mockIdJson = loadBuild("out/AgentBoard.t.sol/MockAgentID.json");
  const mockTokenJson = loadBuild("out/AgentBoard.t.sol/MockERC20.json");
  const boardJson = loadBuild("out/AgentBoard.sol/AgentBoard.json");
  const frontendAbi = JSON.parse(readFileSync(path.join(HERE, "abi.json"), "utf8"));
  check("frontend abi.json matches forge build ABI",
    JSON.stringify(frontendAbi) === JSON.stringify(boardJson.abi));

  const mockId = await new ethers.ContractFactory(mockIdJson.abi, mockIdJson.bytecode.object, poster).deploy();
  await mockId.waitForDeployment();
  log("MockAgentID deployed at " + (await mockId.getAddress()));
  await (await mockId.setBalance(posterAddr, 1)).wait();
  await (await mockId.setBalance(workerAddr, 1)).wait();

  const token = await new ethers.ContractFactory(mockTokenJson.abi, mockTokenJson.bytecode.object, poster).deploy();
  await token.waitForDeployment();
  log("MockERC20 deployed at " + (await token.getAddress()));
  await (await token.mint(posterAddr, ethers.parseEther("1000000"))).wait();

  // The board is driven through the ABI shipped in frontend/abi.json,
  // exactly like the browser UI does.
  const boardFactory = new ethers.ContractFactory(frontendAbi, boardJson.bytecode.object, poster);
  const board = await boardFactory.deploy(await mockId.getAddress());
  await board.waitForDeployment();
  const boardAddr = await board.getAddress();
  log("AgentBoard deployed at " + boardAddr + " (agentId=" + (await mockId.getAddress()) + ")");

  const boardAs = (wallet) => new ethers.Contract(boardAddr, frontendAbi, wallet);
  const DAY = 24 * 3600;
  // Track chain time locally: every time jump in this script goes through
  // increaseTime below, so this stays exact even if a block read is stale.
  let chainNow = Number((await provider.getBlock("latest")).timestamp);
  const deadline = (days) => chainNow + days * DAY;
  const increaseTime = async (seconds) => {
    await provider.send("evm_increaseTime", [seconds]);
    await provider.send("evm_mine", []);
    chainNow += seconds;
  };
  const BNB = ethers.parseEther("0.01");
  const TOK = ethers.parseEther("100");

  check("hasAgentId(poster) true", await board.hasAgentId(posterAddr));
  check("hasAgentId(worker) true", await board.hasAgentId(workerAddr));
  check("hasAgentId(stranger) false", !(await board.hasAgentId(strangerAddr)));
  check("CLAIM_TIMEOUT is 3 days", (await board.CLAIM_TIMEOUT()) === 3n * 24n * 3600n);
  check("bountyCount starts at 0", (await board.bountyCount()) === 0n);

  // ---- 1. Happy path, BNB: create -> claim -> submit -> release ---------
  log("--- 1. Happy path BNB ---");
  let tx = await boardAs(poster).createBounty("Fix bug", "Fix the bug", ethers.ZeroAddress, BNB, await deadline(7), { value: BNB });
  await tx.wait();
  check("createBounty BNB: bountyCount 1", (await board.bountyCount()) === 1n);
  let b = await board.getBounty(0);
  check("bounty 0 status Open", Number(b.status) === 0);
  check("bounty 0 escrow holds 0.01 BNB", (await provider.getBalance(boardAddr)) === BNB);

  tx = await boardAs(worker).claimBounty(0);
  await tx.wait();
  b = await board.getBounty(0);
  check("claimBounty: status Claimed, worker set", Number(b.status) === 1 && b.worker === workerAddr);

  tx = await boardAs(worker).submitWork(0, "ipfs://proof-e2e");
  await tx.wait();
  b = await board.getBounty(0);
  check("submitWork: status Submitted, proof stored", Number(b.status) === 2 && b.proof === "ipfs://proof-e2e");

  const workerBalBefore = await provider.getBalance(workerAddr);
  tx = await boardAs(poster).releasePayment(0);
  await tx.wait();
  const workerBalAfter = await provider.getBalance(workerAddr);
  b = await board.getBounty(0);
  check("releasePayment: status Completed", Number(b.status) === 3);
  check("releasePayment: worker received exactly 0.01 BNB", workerBalAfter - workerBalBefore === BNB);
  check("releasePayment: escrow empty", (await provider.getBalance(boardAddr)) === 0n);
  const stats = await board.agentStats(workerAddr);
  check("agentStats worker: completed=1, earned=0.01 BNB",
    stats[0] === 1n && stats[1] === BNB, `completed=${stats[0]} earned=${stats[1]}`);

  // ---- 2. ERC20 path with exact-amount approve (same as the UI) ---------
  log("--- 2. ERC20 path with approve-first (UI flow) ---");
  tx = await token.connect(poster).approve(boardAddr, TOK);
  await tx.wait();
  check("approve exact amount: allowance == 100", (await token.allowance(posterAddr, boardAddr)) === TOK);
  tx = await boardAs(poster).createBounty("Write docs", "Write the docs", await token.getAddress(), TOK, await deadline(7));
  await tx.wait();
  check("createBounty ERC20: token escrow holds 100", (await token.balanceOf(boardAddr)) === TOK);
  tx = await boardAs(worker).claimBounty(1);
  await tx.wait();
  tx = await boardAs(worker).submitWork(1, "https://example.invalid/docs");
  await tx.wait();
  tx = await boardAs(poster).releasePayment(1);
  await tx.wait();
  check("releasePayment ERC20: worker token balance 100", (await token.balanceOf(workerAddr)) === TOK);
  const stats2 = await board.agentStats(workerAddr);
  check("agentStats worker: completed=2, earned adds 100 tokens (raw units)",
    stats2[0] === 2n && stats2[1] === BNB + TOK, `earned=${stats2[1]}`);

  // ---- 3. Cancel path -----------------------------------------------------
  log("--- 3. Cancel path ---");
  tx = await boardAs(poster).createBounty("Cancelled job", "Will be cancelled", ethers.ZeroAddress, BNB, await deadline(7), { value: BNB });
  await tx.wait();
  const posterBeforeCancel = await provider.getBalance(posterAddr);
  tx = await boardAs(poster).cancelBounty(2);
  const receiptCancel = await tx.wait();
  const posterAfterCancel = await provider.getBalance(posterAddr);
  b = await board.getBounty(2);
  check("cancelBounty: status Cancelled", Number(b.status) === 4);
  check("cancelBounty: poster refunded in full (net of gas)",
    posterAfterCancel + gasCost(receiptCancel, tx) - posterBeforeCancel === BNB);
  check("cancelBounty: escrow empty", (await provider.getBalance(boardAddr)) === 0n);

  // ---- 4. refundExpired path ----------------------------------------------
  log("--- 4. refundExpired path ---");
  tx = await boardAs(poster).createBounty("Slow job", "Worker goes silent", ethers.ZeroAddress, BNB, await deadline(7), { value: BNB });
  await tx.wait();
  tx = await boardAs(worker).claimBounty(3);
  await tx.wait();
  await expectRevert("refundExpired before deadline reverts",
    () => boardAs(stranger).refundExpired.staticCall(3));
  await increaseTime(7 * DAY + 1);
  const posterBeforeRefund = await provider.getBalance(posterAddr);
  tx = await boardAs(stranger).refundExpired(3);
  await tx.wait();
  const posterAfterRefund = await provider.getBalance(posterAddr);
  b = await board.getBounty(3);
  check("refundExpired: status Expired", Number(b.status) === 5);
  check("refundExpired: poster refunded exactly 0.01 BNB (called by stranger)",
    posterAfterRefund - posterBeforeRefund === BNB);
  const stats3 = await board.agentStats(workerAddr);
  check("refundExpired: worker active claims back to 0", stats3[2] === 0n);

  // ---- 5. claimTimeout path -----------------------------------------------
  log("--- 5. claimTimeout path ---");
  tx = await boardAs(poster).createBounty("Silent poster", "Poster never releases", ethers.ZeroAddress, BNB, await deadline(7), { value: BNB });
  await tx.wait();
  tx = await boardAs(worker).claimBounty(4);
  await tx.wait();
  tx = await boardAs(worker).submitWork(4, "ipfs://proof-timeout");
  await tx.wait();
  await expectRevert("claimTimeout before 3 days reverts",
    () => boardAs(worker).claimTimeout.staticCall(4));
  await increaseTime(3 * DAY + 1);
  const workerBeforeTimeout = await provider.getBalance(workerAddr);
  tx = await boardAs(worker).claimTimeout(4);
  const receiptTimeout = await tx.wait();
  const workerAfterTimeout = await provider.getBalance(workerAddr);
  b = await board.getBounty(4);
  check("claimTimeout: status Completed", Number(b.status) === 3);
  check("claimTimeout: worker received 0.01 BNB (net of gas)",
    workerAfterTimeout + gasCost(receiptTimeout, tx) - workerBeforeTimeout === BNB);
  const stats4 = await board.agentStats(workerAddr);
  check("agentStats worker: completed=3 after timeout", stats4[0] === 3n, `completed=${stats4[0]}`);

  // ---- 6. Negative checks mirroring the UI gating -------------------------
  log("--- 6. Negative checks (UI gating) ---");
  await expectRevert("createBounty without Agent ID reverts",
    async () => boardAs(stranger).createBounty.staticCall("x", "x", ethers.ZeroAddress, BNB, await deadline(7), { value: BNB }));
  tx = await boardAs(poster).createBounty("Own claim test", "Poster tries to claim", ethers.ZeroAddress, BNB, await deadline(7), { value: BNB });
  await tx.wait();
  await expectRevert("poster cannot claim own bounty",
    () => boardAs(poster).claimBounty.staticCall(5));
  await expectRevert("claim after deadline reverts",
    async () => {
      await increaseTime(7 * DAY + 1);
      await boardAs(worker).claimBounty.staticCall(5);
    });
  check("bountyCount is 6 at end", (await board.bountyCount()) === 6n);

  log(`SUMMARY: ${passed} PASS, ${failed} FAIL`);
  if (anvil) {
    anvil.kill("SIGTERM");
    log("Anvil stopped.");
  }
  writeFileSync(LOG_FILE, lines.join("\n") + "\n");
  if (failed > 0) {
    process.exitCode = 1;
    log("E2E RESULT: FAIL");
  } else {
    log("E2E RESULT: ALL PASS");
  }
}

main().catch((e) => {
  log("FATAL: " + (e.stack || e.message));
  writeFileSync(LOG_FILE, lines.join("\n") + "\n");
  process.exit(1);
});
