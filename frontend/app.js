// AgentBoard frontend (static, no build step, no server).
// All write transactions are sent through the user's own wallet and always
// wait for the user's explicit confirmation in that wallet. This page never
// asks for a seed phrase, private key, or pairing code, and it stores no
// login session anywhere: there is no server at all.
//
// Funds are locked in the AgentBoard escrow contract when a bounty is
// created. They only move along the contract flow the involved users
// approved per transaction: release to the worker, refund to the poster on
// cancel / expiry, or timeout claim by the worker after 3 days of silence.
// No return of any kind is promised.

const AGENT_ID_ADDRESS = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const ZERO = "0x0000000000000000000000000000000000000000";
const CLAIM_TIMEOUT_SECONDS = 3 * 24 * 3600;
const STATUS_NAMES = ["Open", "Claimed", "Submitted", "Completed", "Cancelled", "Expired"];
const SUPPORTED_CHAINS = { 56: "BSC mainnet", 97: "BSC testnet", 31337: "Anvil lokal" };
const READ_RPC = "https://bsc-dataseed.binance.org/";

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];
const AGENT_ID_ABI = ["function balanceOf(address account) view returns (uint256)"];

let abi = null;
let provider = null;      // wallet provider (window.ethereum), when connected
let signer = null;
let account = null;
let chainId = null;
let hasAgent = false;

const $ = (id) => document.getElementById(id);

function log(msg) {
  const el = $("log");
  const line = "[" + new Date().toLocaleTimeString() + "] " + msg;
  el.textContent += "\n" + line;
  el.scrollTop = el.scrollHeight;
  console.log(line);
}

function short(addr) {
  return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";
}

function fmtTime(ts) {
  return new Date(Number(ts) * 1000).toLocaleString();
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function loadAbi() {
  if (abi) return abi;
  const res = await fetch("abi.json");
  if (!res.ok) throw new Error("Gagal memuat abi.json (" + res.status + ")");
  abi = await res.json();
  return abi;
}

function contractAddress() {
  return $("contractAddress").value.trim();
}

function readProvider() {
  // Reading the bounty list works without a wallet: fall back to the public
  // BSC read endpoint. No account data is sent anywhere.
  if (provider) return provider;
  return new ethers.JsonRpcProvider(READ_RPC);
}

async function getBoard(withSigner) {
  const addr = contractAddress();
  if (!ethers.isAddress(addr)) throw new Error("Alamat kontrak AgentBoard belum diisi atau tidak valid.");
  const a = await loadAbi();
  if (withSigner) {
    if (!signer) throw new Error("Hubungkan wallet dulu.");
    return new ethers.Contract(addr, a, signer);
  }
  return new ethers.Contract(addr, a, readProvider());
}

function updateChainInfo() {
  if (chainId === null) {
    $("chainInfo").textContent = "belum terhubung";
    $("chainWarn").hidden = true;
    return;
  }
  const name = SUPPORTED_CHAINS[chainId] || ("chain tidak dikenal (" + chainId + ")");
  $("chainInfo").textContent = "chainId " + chainId + " (" + name + ")";
  $("chainWarn").hidden = Boolean(SUPPORTED_CHAINS[chainId]);
}

async function refreshChain() {
  if (!provider) return;
  const net = await provider.getNetwork();
  chainId = Number(net.chainId);
  updateChainInfo();
}

async function checkAgentId() {
  if (!account) return;
  try {
    const board = await getBoard(false);
    hasAgent = await board.hasAgentId(account);
    // Second, independent read straight from the Agent ID contract.
    const agent = new ethers.Contract(AGENT_ID_ADDRESS, AGENT_ID_ABI, readProvider());
    const bal = await agent.balanceOf(account);
    const el = $("agentIdStatus");
    if (hasAgent && bal > 0n) {
      el.textContent = "Agent ID: YA. Alamat ini memegang Agent ID (balanceOf = " + bal.toString() + "). Kamu bisa membuat dan mengklaim bounty.";
      el.className = "ok";
      $("agentIdWarn").hidden = true;
    } else {
      el.textContent = "Agent ID: TIDAK. Alamat ini belum memegang Agent ID (balanceOf = " + bal.toString() + ").";
      el.className = "warn";
      $("agentIdWarn").hidden = false;
    }
    const stats = await board.agentStats(account);
    $("myStats").textContent = "Reputasi kamu di kontrak ini: " + stats[0].toString() +
      " bounty selesai, total earned mentah " + stats[1].toString() +
      " (tercampur bila bounty memakai token berbeda), " + stats[2].toString() + " klaim aktif.";
  } catch (e) {
    $("agentIdStatus").textContent = "Status Agent ID belum bisa dicek: " + (e.reason || e.message);
    $("agentIdStatus").className = "err";
  }
}

async function connect() {
  if (!window.ethereum) {
    alert("Tidak ada wallet terdeteksi. Pasang MetaMask atau Binance Wallet dulu, lalu muat ulang halaman ini.");
    log("Connect gagal: window.ethereum tidak ada.");
    return;
  }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    account = accounts[0];
    signer = await provider.getSigner();
    $("accountInfo").textContent = " " + account;
    log("Wallet terhubung: " + account);
    await refreshChain();
    await checkAgentId();
    await loadBounties();
  } catch (e) {
    log("Connect gagal: " + (e.reason || e.message));
    alert("Connect wallet gagal: " + (e.reason || e.message));
  }
}

async function tokenMeta(tokenAddr) {
  // Returns { symbol, decimals } for a token, falling back gracefully.
  if (tokenAddr === ZERO) return { symbol: "BNB", decimals: 18 };
  try {
    const t = new ethers.Contract(tokenAddr, ERC20_ABI, readProvider());
    const [symbol, decimals] = await Promise.all([t.symbol(), t.decimals()]);
    return { symbol, decimals: Number(decimals) };
  } catch (e) {
    return { symbol: "token", decimals: 18 };
  }
}

function fmtAmount(amount, meta) {
  try {
    return ethers.formatUnits(amount, meta.decimals) + " " + meta.symbol;
  } catch (e) {
    return amount.toString() + " (satuan mentah)";
  }
}

async function loadBounties() {
  const list = $("bountyList");
  let board;
  try {
    board = await getBoard(false);
  } catch (e) {
    list.innerHTML = '<p class="err">' + esc(e.message) + "</p>";
    return;
  }
  list.innerHTML = "<p class='muted'>Memuat dari kontrak...</p>";
  try {
    const count = Number(await board.bountyCount());
    if (count === 0) {
      list.innerHTML = "<p class='muted'>Belum ada bounty di kontrak ini.</p>";
      log("Daftar bounty: 0 bounty.");
      return;
    }
    const rows = [];
    for (let id = count - 1; id >= 0 && rows.length < 200; id--) {
      rows.push({ id, bounty: await board.getBounty(id) });
    }
    list.innerHTML = "";
    for (const row of rows) list.appendChild(renderBounty(row.bounty, row.id));
    log("Daftar bounty dimuat: " + count + " bounty.");
  } catch (e) {
    list.innerHTML = '<p class="err">Gagal membaca kontrak: ' + esc(e.reason || e.message) + "</p>";
    log("Gagal memuat bounty: " + (e.reason || e.message));
  }
}

function renderBounty(b, id) {
  // Note: the on-chain Bounty struct has no id field; the id comes from
  // the loop index in loadBounties.
  const status = Number(b.status);
  const now = Math.floor(Date.now() / 1000);
  const isPoster = account && account.toLowerCase() === b.poster.toLowerCase();
  const isWorker = account && b.worker !== ZERO && account.toLowerCase() === b.worker.toLowerCase();
  const pastDeadline = now > Number(b.deadline);
  const timeoutReady = status === 2 && now > Number(b.submittedAt) + CLAIM_TIMEOUT_SECONDS;

  const div = document.createElement("div");
  div.className = "bounty";
  const tokenLabel = b.paymentToken === ZERO ? "BNB" : short(b.paymentToken);
  div.innerHTML =
    "<div><strong>#" + id + " " + esc(b.title) + "</strong> " +
    '<span class="badge st-' + status + '">' + STATUS_NAMES[status] + "</span></div>" +
    "<p>" + esc(b.description) + "</p>" +
    "<p class='muted'>Poster: <span class='mono'>" + esc(b.poster) + "</span><br>" +
    "Worker: <span class='mono'>" + (b.worker === ZERO ? "-" : esc(b.worker)) + "</span><br>" +
    "Hadiah: <span class='mono'>" + esc(b.amount.toString()) + "</span> (" + esc(tokenLabel) + ", satuan mentah di chain)<br>" +
    "Deadline: " + fmtTime(b.deadline) + (pastDeadline ? " (sudah lewat)" : "") + "<br>" +
    (b.proof ? "Bukti kerja: " + esc(b.proof) + "<br>" : "") +
    "</p>";

  const actions = document.createElement("div");

  function addBtn(label, fn, enabled, title) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.disabled = !enabled;
    if (title) btn.title = title;
    btn.onclick = fn;
    actions.appendChild(btn);
  }

  // Claim: only when Open, caller holds an Agent ID, and caller is not the poster.
  addBtn("Klaim bounty", () => doTx("claimBounty #" + id, async (board) => board.claimBounty(id)),
    status === 0 && Boolean(account) && hasAgent && !isPoster,
    status === 0 ? (hasAgent ? (isPoster ? "Poster tidak bisa mengklaim bounty sendiri." : "Klaim bounty ini dan mulai mengerjakannya.") : "Butuh Agent ID untuk klaim.") : "Hanya bounty Open yang bisa diklaim.");
  if (status === 0 && account && !hasAgent) {
    const note = document.createElement("span");
    note.className = "muted";
    note.textContent = " Klaim butuh Agent ID.";
    actions.appendChild(note);
  }

  // Submit work: only the worker, while Claimed.
  if (status === 1 && isWorker) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Bukti kerja: tautan atau teks (contoh: ipfs://... atau URL hasil kerja)";
    input.style.marginTop = "6px";
    actions.appendChild(input);
    addBtn("Submit hasil kerja", async () => {
      const proof = input.value.trim();
      if (!proof) { alert("Isi dulu bukti kerja."); return; }
      await doTx("submitWork #" + id, async (board) => board.submitWork(id, proof));
    }, true, "Kirim bukti kerja ke poster.");
  }

  // Release: only the poster, while Submitted.
  addBtn("Release pembayaran ke worker", () => doTx("releasePayment #" + id, async (board) => board.releasePayment(id)),
    status === 2 && isPoster, "Hanya poster yang bisa melepas dana setelah hasil diserahkan.");

  // Cancel: only the poster, while Open. Full refund to the poster.
  addBtn("Batalkan bounty (refund penuh)", () => doTx("cancelBounty #" + id, async (board) => board.cancelBounty(id)),
    status === 0 && isPoster, "Hanya poster, hanya saat masih Open. Dana kembali penuh ke poster.");

  // Refund expired: anyone, while Claimed and past deadline.
  addBtn("Refund expired (deadline lewat)", () => doTx("refundExpired #" + id, async (board) => board.refundExpired(id)),
    status === 1 && pastDeadline, "Bisa dipanggil siapa pun bila bounty Claimed dan deadline sudah lewat. Dana kembali ke poster.");

  // Claim timeout: only the worker, while Submitted and 3 days after submit.
  addBtn("Klaim timeout (poster diam 3 hari)", () => doTx("claimTimeout #" + id, async (board) => board.claimTimeout(id)),
    status === 2 && isWorker && timeoutReady,
    timeoutReady ? "Poster diam lebih dari 3 hari setelah submit, worker bisa mengklaim dana escrow." : "Baru bisa setelah 3 hari sejak submit tanpa release.");

  div.appendChild(actions);
  return div;
}

async function doTx(label, fn) {
  let board;
  try {
    board = await getBoard(true);
  } catch (e) {
    alert(e.message);
    return;
  }
  log("Mengirim " + label + " ... (konfirmasi di wallet kamu, transaksi hanya jalan bila kamu menyetujuinya)");
  try {
    const tx = await fn(board);
    log(label + ": tx terkirim " + tx.hash + ", menunggu konfirmasi...");
    const receipt = await tx.wait();
    log(label + ": TERKONFIRMASI di blok " + receipt.blockNumber + " (status " + receipt.status + ").");
    await loadBounties();
    await checkAgentId();
  } catch (e) {
    const msg = e.reason || e.message || "transaksi dibatalkan atau gagal";
    log(label + " GAGAL / dibatalkan: " + msg);
    alert(label + " gagal atau dibatalkan: " + msg);
  }
}

// ---- Create bounty -------------------------------------------------------

function selectedToken() {
  const choice = $("fToken").value;
  if (choice === "BNB") return { address: ZERO, kind: "BNB" };
  if (choice === "USDC") return { address: USDC_BSC, kind: "USDC" };
  return { address: $("fCustomToken").value.trim(), kind: "CUSTOM" };
}

async function parseCreateForm() {
  const title = $("fTitle").value.trim();
  const description = $("fDesc").value.trim();
  const amountText = $("fAmount").value.trim();
  const deadlineText = $("fDeadline").value;
  if (!title) throw new Error("Judul bounty wajib diisi.");
  if (!description) throw new Error("Deskripsi bounty wajib diisi.");
  if (!amountText || Number(amountText) <= 0) throw new Error("Jumlah harus lebih dari 0.");
  if (!deadlineText) throw new Error("Deadline wajib diisi.");
  const deadline = Math.floor(new Date(deadlineText).getTime() / 1000);
  if (!(deadline > Math.floor(Date.now() / 1000))) throw new Error("Deadline harus di masa depan.");
  const token = selectedToken();
  if (token.kind !== "BNB" && !ethers.isAddress(token.address)) {
    throw new Error("Alamat token ERC20 tidak valid.");
  }
  const meta = await tokenMeta(token.address);
  const amount = ethers.parseUnits(amountText, meta.decimals);
  return { title, description, amount, deadline, token, meta };
}

async function refreshApproveState() {
  const box = $("approveBox");
  const btn = $("btnApprove");
  box.hidden = true;
  btn.hidden = true;
  $("createHint").textContent = "";
  try {
    if (!account) return;
    const f = await parseCreateForm();
    if (f.token.address === ZERO) {
      $("createHint").textContent = "BNB sebesar " + f.meta.symbol + " " + $("fAmount").value.trim() +
        " akan dikunci di escrow saat transaksi dikonfirmasi di wallet kamu.";
      return;
    }
    const boardAddr = contractAddress();
    if (!ethers.isAddress(boardAddr)) {
      $("createHint").textContent = "Isi dulu alamat kontrak AgentBoard di bagian 1.";
      return;
    }
    const token = new ethers.Contract(f.token.address, ERC20_ABI, readProvider());
    const allowance = await token.allowance(account, boardAddr);
    if (allowance >= f.amount) {
      $("createHint").textContent = "Allowance sudah cukup (" + ethers.formatUnits(allowance, f.meta.decimals) +
        " " + f.meta.symbol + "). Bounty bisa dibuat, kontrak akan menarik " +
        ethers.formatUnits(f.amount, f.meta.decimals) + " " + f.meta.symbol + " dari wallet kamu.";
    } else {
      box.hidden = false;
      box.textContent = "Kontrak belum diizinkan menarik token kamu. Allowance saat ini " +
        ethers.formatUnits(allowance, f.meta.decimals) + " " + f.meta.symbol +
        ", sedangkan bounty butuh " + ethers.formatUnits(f.amount, f.meta.decimals) + " " + f.meta.symbol +
        ". Tekan tombol approve di bawah: itu transaksi terpisah yang juga menunggu konfirmasi kamu di wallet, " +
        "dan hanya mengizinkan tepat sebesar jumlah bounty ini, bukan tanpa batas.";
      btn.hidden = false;
    }
  } catch (e) {
    // Form belum lengkap: jangan tampilkan apa pun, biarkan user melengkapi.
  }
}

async function approveToken() {
  try {
    const f = await parseCreateForm();
    const boardAddr = contractAddress();
    if (!ethers.isAddress(boardAddr)) throw new Error("Alamat kontrak AgentBoard belum diisi atau tidak valid.");
    if (!signer) throw new Error("Hubungkan wallet dulu.");
    const token = new ethers.Contract(f.token.address, ERC20_ABI, signer);
    log("Approve " + ethers.formatUnits(f.amount, f.meta.decimals) + " " + f.meta.symbol +
      " untuk kontrak " + boardAddr + " (tepat sebesar bounty, bukan tanpa batas). Konfirmasi di wallet kamu.");
    const tx = await token.approve(boardAddr, f.amount);
    log("Approve terkirim " + tx.hash + ", menunggu konfirmasi...");
    await tx.wait();
    log("Approve TERKONFIRMASI.");
    await refreshApproveState();
  } catch (e) {
    const msg = e.reason || e.message || "approve dibatalkan atau gagal";
    log("Approve GAGAL / dibatalkan: " + msg);
    alert("Approve gagal atau dibatalkan: " + msg);
  }
}

async function createBounty() {
  if (!account || !signer) { alert("Hubungkan wallet dulu."); return; }
  if (!hasAgent) {
    alert("Alamat ini belum memegang Agent ID. Membuat bounty butuh Agent ID.");
    return;
  }
  let f;
  try {
    f = await parseCreateForm();
  } catch (e) {
    alert(e.message);
    return;
  }
  const boardAddr = contractAddress();
  if (!ethers.isAddress(boardAddr)) { alert("Alamat kontrak AgentBoard belum diisi atau tidak valid."); return; }
  if (f.token.address !== ZERO) {
    const token = new ethers.Contract(f.token.address, ERC20_ABI, readProvider());
    const allowance = await token.allowance(account, boardAddr);
    if (allowance < f.amount) {
      alert("Allowance token belum cukup. Tekan tombol approve dulu, lalu buat bounty.");
      await refreshApproveState();
      return;
    }
  }
  const value = f.token.address === ZERO ? f.amount : 0n;
  log("Membuat bounty '" + f.title + "' (" + ethers.formatUnits(f.amount, f.meta.decimals) + " " +
    f.meta.symbol + ", deadline " + fmtTime(f.deadline) + "). Dana dikunci di escrow. Konfirmasi di wallet kamu.");
  try {
    const board = await getBoard(true);
    const tx = await board.createBounty(f.title, f.description, f.token.address, f.amount, f.deadline, { value });
    log("createBounty terkirim " + tx.hash + ", menunggu konfirmasi...");
    const receipt = await tx.wait();
    log("Bounty dibuat, TERKONFIRMASI di blok " + receipt.blockNumber + ".");
    await loadBounties();
  } catch (e) {
    const msg = e.reason || e.message || "transaksi dibatalkan atau gagal";
    log("createBounty GAGAL / dibatalkan: " + msg);
    alert("Buat bounty gagal atau dibatalkan: " + msg);
  }
}

async function showReputation() {
  const addr = $("repAddress").value.trim();
  if (!ethers.isAddress(addr)) { $("repResult").textContent = "Alamat tidak valid."; return; }
  try {
    const board = await getBoard(false);
    const stats = await board.agentStats(addr);
    const agent = new ethers.Contract(AGENT_ID_ADDRESS, AGENT_ID_ABI, readProvider());
    const bal = await agent.balanceOf(addr);
    $("repResult").textContent = "Alamat " + addr + ": memegang Agent ID: " + (bal > 0n ? "ya (" + bal.toString() + ")" : "tidak") +
      ". Bounty selesai: " + stats[0].toString() + ". Total earned (satuan mentah, tercampur bila bounty memakai token berbeda): " +
      stats[1].toString() + ". Klaim aktif: " + stats[2].toString() + ".";
    log("Reputasi " + addr + ": completed=" + stats[0] + ", earned(raw)=" + stats[1] + ", active=" + stats[2]);
  } catch (e) {
    $("repResult").textContent = "Gagal membaca reputasi: " + (e.reason || e.message);
  }
}

// ---- Wiring ---------------------------------------------------------------

$("btnConnect").addEventListener("click", connect);
$("btnLoad").addEventListener("click", loadBounties);
$("btnRefresh").addEventListener("click", loadBounties);
$("btnCreate").addEventListener("click", createBounty);
$("btnApprove").addEventListener("click", approveToken);
$("btnRep").addEventListener("click", showReputation);
$("fToken").addEventListener("change", () => {
  const custom = $("fToken").value === "CUSTOM";
  $("fCustomToken").hidden = !custom;
  $("fCustomTokenLabel").hidden = !custom;
  refreshApproveState();
});
["fTitle", "fDesc", "fAmount", "fDeadline", "fCustomToken"].forEach((id) => {
  $(id).addEventListener("input", refreshApproveState);
});
$("contractAddress").addEventListener("input", () => { checkAgentId(); });

if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accs) => {
    account = accs[0] || null;
    $("accountInfo").textContent = account ? " " + account : "";
    log("Akun wallet berubah: " + (account || "-"));
    checkAgentId();
    loadBounties();
  });
  window.ethereum.on("chainChanged", () => { window.location.reload(); });
}

updateChainInfo();
log("AgentBoard frontend siap. Isi alamat kontrak, lalu muat daftar bounty. Tanpa wallet pun daftar tetap bisa dibaca.");
