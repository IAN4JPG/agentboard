// AgentBoard frontend v2 (static, no build step, no server).
// Talks to the AgentBoard v1 contract on BSC mainnet. All write transactions
// are sent through the user's own wallet and always wait for the user's
// explicit confirmation in that wallet. This page never asks for a seed
// phrase, private key, or pairing code, and it stores no login session
// anywhere: there is no server at all. localStorage holds only the language
// and the theme choice.
//
// Funds are locked in the AgentBoard escrow contract when a bounty is
// created. They only move along the contract flow the involved users
// approved per transaction: release to the worker, refund to the poster on
// cancel / expiry, or timeout claim by the worker after 3 days of silence.
// No return of any kind is promised.
//
// v2 adds: dashboard, search/filter/sort, activity feed from contract
// events, leaderboard, bounty detail with timeline and countdowns, deep
// links, bounty templates, transaction preview with gas estimation,
// allowance revoke, reputation tiers, light theme, escrow health, live
// security checks, toasts instead of alerts, and pagination.

const AGENT_ID_ADDRESS = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const OFFICIAL_BOARD = "0x47751df28f9c62faebbfadf191439495f1bff70e";
const USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const ZERO = "0x0000000000000000000000000000000000000000";
const CLAIM_TIMEOUT_SECONDS = 3 * 24 * 3600;
const STATUS_NAMES = ["Open", "Claimed", "Submitted", "Completed", "Cancelled", "Expired"];
const SUPPORTED_CHAINS = { 56: "BSC mainnet", 97: "BSC testnet", 31337: "Anvil lokal" };
const READ_RPC = "https://bsc-dataseed.binance.org/";
// Dedicated endpoint for eth_getLogs. Measured 26 Nov 2026 (5 rapid
// getLogs calls): bsc-dataseed 0/5, ankr 0/5, defibit 0/5, publicnode 4/5;
// 20-call burst on publicnode: 17/20. bsc-dataseed answers eth_getLogs
// with -32005 rate-limit almost immediately, so the activity feed and the
// detail timeline read logs here instead.
const LOG_RPC = "https://bsc.publicnode.com";
const DEPLOY_BLOCK = 134322190; // AgentBoard v1 deployment block on BSC mainnet
const PAGE_SIZE = 20;
const MAX_DEADLINE_DAYS = 60;
const THEME_KEY = "agentboard-theme";
const BSCSCAN = "https://bscscan.com";

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];
const AGENT_ID_ABI = ["function balanceOf(address account) view returns (uint256)"];

// Bounty templates (English + Indonesian), filled into the create form.
const TEMPLATES = {
  en: {
    bugfix: {
      title: "Fix bug: [short description]",
      desc: "Steps to reproduce:\n1. ...\nExpected result: ...\nActual result: ...\nThe fix is accepted when the bug no longer reproduces and existing tests still pass.",
    },
    review: {
      title: "Code review: [area or file]",
      desc: "Review the code in [repo / file] for bugs, security issues, and readability. Deliver a written review with findings ordered by severity and a suggested fix for each.",
    },
    design: {
      title: "Design tweak: [page or component]",
      desc: "Improve the layout of [page / component]: ...\nDeliver the updated mockup or CSS, keeping the existing visual style.",
    },
    docs: {
      title: "Write docs: [topic]",
      desc: "Write clear documentation for [topic]: what it does, how to use it, and one working example. Accepted when a new reader can follow it without asking questions.",
    },
    test: {
      title: "Add tests for [module]",
      desc: "Add tests covering [module]: the happy path and at least two edge cases. Tests must pass locally and follow the project's existing test style.",
    },
    feature: {
      title: "Small feature: [feature]",
      desc: "Implement [feature]: ...\nAcceptance: the feature works end to end and does not break existing behavior.",
    },
  },
  id: {
    bugfix: {
      title: "Perbaiki bug: [deskripsi singkat]",
      desc: "Langkah reproduksi:\n1. ...\nHasil yang diharapkan: ...\nHasil saat ini: ...\nPerbaikan diterima bila bug tidak lagi muncul dan test yang ada tetap lolos.",
    },
    review: {
      title: "Code review: [area atau file]",
      desc: "Review kode di [repo / file] untuk bug, masalah keamanan, dan keterbacaan. Serahkan review tertulis dengan temuan diurutkan berdasarkan tingkat keparahan dan saran perbaikan untuk tiap temuan.",
    },
    design: {
      title: "Design tweak: [halaman atau komponen]",
      desc: "Perbaiki tata letak [halaman / komponen]: ...\nSerahkan mockup atau CSS yang diperbarui, dengan tetap menjaga gaya visual yang ada.",
    },
    docs: {
      title: "Tulis docs: [topik]",
      desc: "Tulis dokumentasi yang jelas untuk [topik]: fungsinya apa, cara pakainya, dan satu contoh yang jalan. Diterima bila pembaca baru bisa mengikutinya tanpa bertanya.",
    },
    test: {
      title: "Tambah test untuk [modul]",
      desc: "Tambah test untuk [modul]: happy path dan minimal dua edge case. Test harus lolos secara lokal dan mengikuti gaya test yang sudah ada di proyek.",
    },
    feature: {
      title: "Fitur kecil: [fitur]",
      desc: "Implementasikan [fitur]: ...\nKriteria diterima: fitur jalan end to end dan tidak merusak perilaku yang sudah ada.",
    },
  },
};

let abi = null;
let provider = null;      // wallet provider (window.ethereum), when connected
let signer = null;
let account = null;
let chainId = null;
let hasAgent = false;

let allBounties = [];     // [{ id, bounty }] sorted by id desc, full list
let filteredBounties = [];
let currentPage = 1;
let filters = { q: "", status: "", token: "", addr: "", mine: "" }; // mine: "" | "posted" | "claimed"
let sortKey = "newest";
let tokenMetaCache = {};
// Escrow deficit per asset, from updateEscrowHealth (P0-3). Funding a
// deficit asset is blocked in createBounty until the health check is green.
let escrowDeficit = { bnb: false, usdc: false };
let detailId = null;
let detailTimer = null;
let activityLoading = false;

const $ = (id) => document.getElementById(id);

function log(msg) {
  const el = $("log");
  const line = "[" + new Date().toLocaleTimeString() + "] " + msg;
  el.textContent += "\n" + line;
  el.scrollTop = el.scrollHeight;
  console.log(line);
}

function toast(msg, kind) {
  const wrap = $("toastWrap");
  if (!wrap) { log(msg); return; }
  const div = document.createElement("div");
  div.className = "toast" + (kind ? " " + kind : "");
  div.textContent = msg;
  wrap.appendChild(div);
  log("Toast: " + msg);
  setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 6000);
}

function short(addr) {
  if (!addr) return "";
  const c = checksum(addr);
  return c ? c.slice(0, 6) + "..." + c.slice(-4) : String(addr).slice(0, 6) + "..." + String(addr).slice(-4);
}

function checksum(addr) {
  try { return ethers.getAddress(addr); } catch (e) { return null; }
}

function fmtTime(ts) {
  return new Date(Number(ts) * 1000).toLocaleString();
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtCountdown(seconds) {
  if (seconds <= 0) return "0d 0h 0m 0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return d + "d " + h + "h " + m + "m " + s + "s";
}

// Reputation tier by completed bounties. Names are proper nouns, identical
// in English and Indonesian.
function badgeFor(completed) {
  const n = Number(completed);
  if (n >= 50) return { name: "Diamond", cls: "tier-diamond" };
  if (n >= 15) return { name: "Gold", cls: "tier-gold" };
  if (n >= 5) return { name: "Silver", cls: "tier-silver" };
  if (n >= 1) return { name: "Bronze", cls: "tier-bronze" };
  return null;
}

function badgeEl(completed) {
  const b = badgeFor(completed);
  if (!b) return null;
  const span = document.createElement("span");
  span.className = "tier-badge " + b.cls;
  span.textContent = b.name;
  span.title = String(completed);
  return span;
}

// ---- Theme ---------------------------------------------------------------

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function updateThemeBtn() {
  const btn = $("themeToggle");
  if (!btn) return;
  // Text is written in Indonesian; the i18n observer translates it.
  btn.textContent = currentTheme() === "dark" ? "Mode terang" : "Mode gelap";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  try { window.localStorage.setItem(THEME_KEY, currentTheme()); } catch (e) { /* ignore */ }
  updateThemeBtn();
}

function initTheme() {
  let saved = "dark";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") saved = v;
  } catch (e) { /* storage unavailable */ }
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeBtn();
}

// ---- Providers / contract -------------------------------------------------

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

let logProv = null;
function logProvider() {
  if (!logProv) logProv = new ethers.JsonRpcProvider(LOG_RPC);
  return logProv;
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

// Checked before EVERY write, not only at connect time. Fails closed.
// P0-1 hard gate: a mainnet write requires chain 56 + the official contract
// address + an on-chain agentId() match. Chains 97/31337 are allowed ONLY
// while the explicit testnet-mode checkbox is on, and the agentId() check
// still applies there.
function testnetMode() {
  const el = $("testnetMode");
  return el ? el.checked : false;
}

async function ensureWritableChain() {
  if (!provider || !signer || !account) {
    toast("Hubungkan wallet dulu.", "err");
    return false;
  }
  await refreshChain();
  const addr = contractAddress();
  if (!ethers.isAddress(addr)) {
    toast("Alamat kontrak AgentBoard belum diisi atau tidak valid.", "err");
    return false;
  }
  const isOfficial = addr.toLowerCase() === OFFICIAL_BOARD.toLowerCase();
  if (chainId === 56) {
    if (!isOfficial) {
      toast("Alamat kontrak bukan alamat resmi. Write diblokir di mainnet.", "err");
      return false;
    }
  } else if (testnetMode() && (chainId === 97 || chainId === 31337)) {
    // Explicit testnet mode: another contract address is allowed, but the
    // on-chain agentId() verification below still applies.
  } else {
    toast("Chain bukan BSC mainnet (56). Write diblokir.", "err");
    return false;
  }
  try {
    const rp = readProvider();
    const code = await rp.getCode(addr);
    if (code === "0x") {
      toast("Kontrak tidak ditemukan di alamat ini pada chain yang aktif.", "err");
      return false;
    }
    // Verify the contract points at the official Agent ID contract.
    const board = await getBoard(false);
    const agentIdOnChain = await board.agentId();
    if (String(agentIdOnChain).toLowerCase() !== AGENT_ID_ADDRESS.toLowerCase()) {
      toast("Kontrak memakai Agent ID yang berbeda dari yang resmi.", "err");
      return false;
    }
  } catch (e) {
    toast("Kontrak tidak bisa diverifikasi di chain yang aktif: " + (e.reason || e.message), "err");
    return false;
  }
  return true;
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
    const box = $("myStats");
    box.textContent = "Reputasi kamu di kontrak ini: " + stats[0].toString() +
      " bounty selesai, total earned mentah " + stats[1].toString() +
      " (tercampur bila bounty memakai token berbeda), " + stats[2].toString() + " klaim aktif.";
    const badge = badgeEl(stats[0]);
    if (badge) box.appendChild(badge);
  } catch (e) {
    $("agentIdStatus").textContent = "Status Agent ID belum bisa dicek: " + (e.reason || e.message);
    $("agentIdStatus").className = "err";
  }
}

async function connect() {
  if (!window.ethereum) {
    // Blocking error: without a wallet nothing else can proceed.
    alert("Tidak ada wallet terdeteksi. Pasang MetaMask atau Binance Wallet dulu, lalu muat ulang halaman ini.");
    log("Connect gagal: window.ethereum tidak ada.");
    return;
  }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    account = accounts[0];
    signer = await provider.getSigner();
    $("accountInfo").textContent = " " + checksum(account);
    log("Wallet terhubung: " + account);
    await refreshChain();
    updateLiveSecurity();
    await checkAgentId();
    await loadBounties();
  } catch (e) {
    const msg = e.reason || e.message || "transaksi dibatalkan atau gagal";
    log("Connect gagal: " + msg);
    toast("Connect wallet gagal: " + msg, "err");
  }
}

// Token metadata, fail-closed (P0-3). Only BNB and USDC are on the allowlist.
// Strict: used for writes (amount parsing, allowance). Throws when the token
// is not allowed or its metadata cannot be read. Never guesses decimals.
const TOKEN_ALLOWLIST = [ZERO.toLowerCase(), USDC_BSC.toLowerCase()];

async function tokenMetaStrict(tokenAddr) {
  const key = String(tokenAddr).toLowerCase();
  const cached = tokenMetaCache[key];
  if (cached && !cached.unknown) return cached;
  if (!TOKEN_ALLOWLIST.includes(key)) {
    throw new Error("Token tidak ada di allowlist (hanya BNB dan USDC).");
  }
  if (key === ZERO.toLowerCase()) {
    tokenMetaCache[key] = { symbol: "BNB", decimals: 18 };
    return tokenMetaCache[key];
  }
  let meta;
  try {
    const t = new ethers.Contract(tokenAddr, ERC20_ABI, readProvider());
    const [symbol, decimals] = await Promise.all([t.symbol(), t.decimals()]);
    meta = { symbol, decimals: Number(decimals) };
  } catch (e) {
    throw new Error("Metadata token tidak bisa dibaca. Token ditolak.");
  }
  tokenMetaCache[key] = meta;
  return meta;
}

// Display-only metadata: for bounties already on chain with other tokens,
// show the amount but flag it as unreadable instead of guessing.
async function tokenMetaDisplay(tokenAddr) {
  const key = String(tokenAddr).toLowerCase();
  const cached = tokenMetaCache[key];
  if (cached) return cached;
  if (key === ZERO.toLowerCase()) {
    tokenMetaCache[key] = { symbol: "BNB", decimals: 18 };
    return tokenMetaCache[key];
  }
  let meta;
  try {
    const t = new ethers.Contract(tokenAddr, ERC20_ABI, readProvider());
    const [symbol, decimals] = await Promise.all([t.symbol(), t.decimals()]);
    meta = { symbol, decimals: Number(decimals) };
    tokenMetaCache[key] = meta;
  } catch (e) {
    meta = { symbol: "token", decimals: 18, unknown: true };
  }
  return meta;
}

function fmtAmount(amount, meta) {
  try {
    const out = ethers.formatUnits(amount, meta.decimals) + " " + meta.symbol;
    return meta.unknown ? out + " (metadata tidak terbaca)" : out;
  } catch (e) {
    return amount.toString() + " (satuan mentah)";
  }
}

// Safe proof rendering: only http(s) and ipfs become links; anything else
// is plain text. The href is built from a validated scheme only.
function proofNode(proof) {
  const span = document.createElement("span");
  const p = String(proof || "").trim();
  if (/^https?:\/\//i.test(p)) {
    const a = document.createElement("a");
    a.href = p;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = p;
    try { a.title = new URL(p).hostname; } catch (e) { /* keep link without title */ }
    span.appendChild(a);
  } else if (/^ipfs:\/\//i.test(p)) {
    const cid = p.slice(7).split("/")[0];
    const a = document.createElement("a");
    a.href = "https://ipfs.io/ipfs/" + encodeURIComponent(cid);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = p;
    a.title = "ipfs.io";
    span.appendChild(a);
  } else {
    span.textContent = p;
  }
  return span;
}

function bscLink(kind, value, label) {
  const a = document.createElement("a");
  if (kind === "tx") {
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
    a.href = BSCSCAN + "/tx/" + value;
  } else {
    const c = checksum(value);
    if (!c) return null;
    a.href = BSCSCAN + "/address/" + c;
  }
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = label;
  return a;
}

// ---- Bounty list: load, filter, sort, paginate ----------------------------

async function loadBounties() {
  const list = $("bountyList");
  let board;
  try {
    board = await getBoard(false);
  } catch (e) {
    list.innerHTML = '<p class="err">' + esc(e.message) + "</p>";
    return;
  }
  list.innerHTML =
    '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  try {
    const count = Number(await board.bountyCount());
    const ids = [];
    for (let id = count - 1; id >= 0; id--) ids.push(id);
    const rows = [];
    const CHUNK = 10;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = await Promise.all(
        ids.slice(i, i + CHUNK).map((id) =>
          board.getBounty(id).then((b) => ({ id, bounty: b })).catch(() => null)
        )
      );
      for (const r of part) if (r) rows.push(r);
    }
    allBounties = rows;
    currentPage = 1;
    applyFiltersAndRender();
    updateDashboard();
    updateLeaderboard();
    await updateEscrowHealth();
    updateLiveSecurity();
    loadActivity();
    log("Daftar bounty dimuat: " + count + " bounty.");
    const m = window.location.hash.match(/^#bounty-(\d+)$/);
    if (m) openDetail(Number(m[1]));
  } catch (e) {
    list.innerHTML = '<p class="err">Gagal membaca kontrak: ' + esc(e.reason || e.message) + "</p>";
    log("Gagal memuat bounty: " + (e.reason || e.message));
  }
}

function applyFiltersAndRender() {
  const q = filters.q.trim().toLowerCase();
  const addrF = filters.addr.trim().toLowerCase();
  filteredBounties = allBounties.filter(({ bounty: b }) => {
    if (filters.status !== "" && Number(b.status) !== Number(filters.status)) return false;
    if (filters.token === "BNB" && b.paymentToken !== ZERO) return false;
    if (filters.token === "USDC" && b.paymentToken.toLowerCase() !== USDC_BSC.toLowerCase()) return false;
    if (filters.token === "OTHER" && (b.paymentToken === ZERO || b.paymentToken.toLowerCase() === USDC_BSC.toLowerCase())) return false;
    if (addrF && !b.poster.toLowerCase().includes(addrF) && !b.worker.toLowerCase().includes(addrF)) return false;
    if (q && !(b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q))) return false;
    if (filters.mine === "posted" && (!account || b.poster.toLowerCase() !== account.toLowerCase())) return false;
    if (filters.mine === "claimed" && (!account || b.worker.toLowerCase() !== account.toLowerCase())) return false;
    return true;
  });
  if (sortKey === "newest") filteredBounties.sort((a, b) => b.id - a.id);
  else if (sortKey === "oldest") filteredBounties.sort((a, b) => a.id - b.id);
  else if (sortKey === "deadline") filteredBounties.sort((a, b) => Number(a.bounty.deadline) - Number(b.bounty.deadline));
  else if (sortKey === "amount") filteredBounties.sort((a, b) => (a.bounty.amount > b.bounty.amount ? -1 : a.bounty.amount < b.bounty.amount ? 1 : 0));
  const pages = Math.max(1, Math.ceil(filteredBounties.length / PAGE_SIZE));
  if (currentPage > pages) currentPage = pages;
  renderPage();
}

function renderPage() {
  const list = $("bountyList");
  const total = filteredBounties.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE;
  const rows = filteredBounties.slice(start, start + PAGE_SIZE);
  list.innerHTML = "";
  if (total === 0) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = allBounties.length === 0
      ? "Belum ada bounty di kontrak ini."
      : "Tidak ada bounty yang cocok dengan filter.";
    list.appendChild(p);
  } else {
    for (const row of rows) list.appendChild(renderBounty(row.bounty, row.id));
  }
  $("pageInfo").textContent = "Halaman " + currentPage + " dari " + pages;
  $("btnPrevPage").disabled = currentPage <= 1;
  $("btnNextPage").disabled = currentPage >= pages;
}

function buildActions(b, id) {
  const status = Number(b.status);
  const now = Math.floor(Date.now() / 1000);
  const isPoster = account && account.toLowerCase() === b.poster.toLowerCase();
  const isWorker = account && b.worker !== ZERO && account.toLowerCase() === b.worker.toLowerCase();
  const pastDeadline = now > Number(b.deadline);
  const timeoutReady = status === 2 && now > Number(b.submittedAt) + CLAIM_TIMEOUT_SECONDS;

  const actions = document.createElement("div");
  function addBtn(label, fn, enabled, title) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.disabled = !enabled;
    if (title) btn.title = title;
    btn.onclick = (ev) => { ev.stopPropagation(); fn(); };
    actions.appendChild(btn);
  }

  // Claim: only when Open, caller holds an Agent ID, and caller is not the poster.
  addBtn("Klaim bounty", () => doTx("claimBounty #" + id, "claimBounty", [id], 0n),
    status === 0 && Boolean(account) && hasAgent && !isPoster,
    status === 0 ? (hasAgent ? (isPoster ? "Poster tidak bisa mengklaim bounty sendiri." : "Klaim bounty ini dan mulai mengerjakannya.") : "Butuh Agent ID untuk klaim.") : "Hanya bounty Open yang bisa diklaim.");
  if (status === 0 && account && !hasAgent) {
    const note = document.createElement("span");
    note.className = "muted";
    note.textContent = " Klaim butuh Agent ID.";
    actions.appendChild(note);
  }

  // Submit work: only the worker, while Claimed. Disabled in the UI once
  // the deadline has passed (P0-4): a late submit is still valid on-chain
  // and would block the poster's refund, so the UI must not invite it.
  // Note: this is a UI guard only; a direct contract call can still submit.
  if (status === 1 && isWorker) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Bukti kerja: tautan atau teks (contoh: ipfs://... atau URL hasil kerja)";
    input.style.marginTop = "6px";
    input.addEventListener("click", (ev) => ev.stopPropagation());
    actions.appendChild(input);
    addBtn("Submit hasil kerja", async () => {
      const proof = input.value.trim();
      if (!proof) { toast("Isi dulu bukti kerja.", "err"); return; }
      await doTx("submitWork #" + id, "submitWork", [id, proof], 0n);
    }, !pastDeadline, pastDeadline ? "Deadline sudah lewat, submit dinonaktifkan di UI (panggilan langsung ke kontrak tetap bisa)." : "Kirim bukti kerja ke poster.");
    if (pastDeadline) {
      const note = document.createElement("span");
      note.className = "muted";
      note.textContent = " Deadline sudah lewat, submit dinonaktifkan di UI (panggilan langsung ke kontrak tetap bisa).";
      actions.appendChild(note);
    }
  }

  // Release: only the poster, while Submitted.
  addBtn("Release pembayaran ke worker", () => doTx("releasePayment #" + id, "releasePayment", [id], 0n),
    status === 2 && isPoster, "Hanya poster yang bisa melepas dana setelah hasil diserahkan.");

  // Cancel: only the poster, while Open. Full refund to the poster.
  addBtn("Batalkan bounty (refund penuh)", () => doTx("cancelBounty #" + id, "cancelBounty", [id], 0n),
    status === 0 && isPoster, "Hanya poster, hanya saat masih Open. Dana kembali penuh ke poster.");

  // Refund expired: anyone, while Claimed and past deadline.
  addBtn("Refund expired (deadline lewat)", () => doTx("refundExpired #" + id, "refundExpired", [id], 0n),
    status === 1 && pastDeadline, "Bisa dipanggil siapa pun bila bounty Claimed dan deadline sudah lewat. Dana kembali ke poster.");

  // Claim timeout: only the worker, while Submitted and 3 days after submit.
  addBtn("Klaim timeout (poster diam 3 hari)", () => doTx("claimTimeout #" + id, "claimTimeout", [id], 0n),
    status === 2 && isWorker && timeoutReady,
    timeoutReady ? "Poster diam lebih dari 3 hari setelah submit, worker bisa mengklaim dana escrow." : "Baru bisa setelah 3 hari sejak submit tanpa release.");

  return actions;
}

function renderBounty(b, id) {
  // Note: the on-chain Bounty struct has no id field; the id comes from
  // the loop index in loadBounties.
  const status = Number(b.status);
  const now = Math.floor(Date.now() / 1000);
  const pastDeadline = now > Number(b.deadline);

  const div = document.createElement("div");
  div.className = "bounty";
  const tokenLabel = b.paymentToken === ZERO ? "BNB" : short(b.paymentToken);
  div.innerHTML =
    "<div><strong>#" + id + " " + esc(b.title) + "</strong> " +
    '<span class="badge st-' + status + '">' + STATUS_NAMES[status] + "</span></div>" +
    "<p>" + esc(b.description) + "</p>" +
    "<p class='muted'>Poster: <span class='mono'>" + esc(short(b.poster)) + "</span><br>" +
    "Worker: <span class='mono'>" + (b.worker === ZERO ? "-" : esc(short(b.worker))) + "</span><br>" +
    "Hadiah: <span class='mono'>" + esc(b.amount.toString()) + "</span> (" + esc(tokenLabel) + ", satuan mentah di chain)<br>" +
    "Deadline: " + fmtTime(b.deadline) + (pastDeadline ? " (sudah lewat)" : "") + "<br>" +
    (b.proof ? "Bukti kerja: " + esc(b.proof) + "<br>" : "") +
    "</p>";

  div.appendChild(buildActions(b, id));
  div.addEventListener("click", (ev) => {
    if (ev.target.closest("button, input, textarea, a, select")) return;
    openDetail(id);
  });
  return div;
}

// ---- Dashboard / leaderboard / escrow / live security ---------------------

function workerStatsFromList() {
  // Completed bounties only; earned split per token (the contract's own
  // agentStats mixes token units, so the list is the accurate source).
  const map = {};
  for (const { bounty: b } of allBounties) {
    if (Number(b.status) !== 3 || b.worker === ZERO) continue;
    const key = b.worker.toLowerCase();
    if (!map[key]) map[key] = { addr: b.worker, completed: 0, bnb: 0n, usdc: 0n, other: 0 };
    map[key].completed += 1;
    if (b.paymentToken === ZERO) map[key].bnb += b.amount;
    else if (b.paymentToken.toLowerCase() === USDC_BSC.toLowerCase()) map[key].usdc += b.amount;
    else map[key].other += 1;
  }
  return Object.values(map).sort((a, b) =>
    b.completed - a.completed || (b.bnb > a.bnb ? 1 : b.bnb < a.bnb ? -1 : 0));
}

function updateDashboard() {
  let open = 0;
  let completed = 0;
  let escBnb = 0n;
  let escUsdc = 0n;
  for (const { bounty: b } of allBounties) {
    const st = Number(b.status);
    if (st === 0) open += 1;
    if (st === 3) completed += 1;
    if (st === 0 || st === 1 || st === 2) {
      if (b.paymentToken === ZERO) escBnb += b.amount;
      else if (b.paymentToken.toLowerCase() === USDC_BSC.toLowerCase()) escUsdc += b.amount;
    }
  }
  $("dashTotal").textContent = String(allBounties.length);
  $("dashOpen").textContent = String(open);
  $("dashCompleted").textContent = String(completed);
  $("dashEscrowBnb").textContent = ethers.formatEther(escBnb) + " BNB";
  $("dashEscrowUsdc").textContent = ethers.formatUnits(escUsdc, 6) + " USDC";
  const top = workerStatsFromList()[0];
  if (top) {
    $("dashTopWorker").textContent = short(top.addr);
    $("dashTopWorkerSub").textContent = top.completed + " bounty selesai";
    const badge = badgeEl(top.completed);
    const el = $("dashTopWorker");
    if (badge) el.appendChild(badge);
  } else {
    $("dashTopWorker").textContent = "Belum ada";
    $("dashTopWorkerSub").textContent = "";
  }
  const du = $("dashUpdated");
  if (du) du.textContent = new Date().toLocaleTimeString("id-ID", { hour12: false }) + " WIB";
}

function updateLeaderboard() {
  const box = $("leaderList");
  const lu = $("leadUpdated");
  if (lu) lu.textContent = new Date().toLocaleTimeString("id-ID", { hour12: false }) + " WIB";
  const rows = workerStatsFromList().slice(0, 10);
  box.innerHTML = "";
  if (rows.length === 0) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Belum ada bounty yang selesai.";
    box.appendChild(p);
    return;
  }
  const table = document.createElement("table");
  table.className = "leader";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>#</th><th>Worker</th><th>Tier</th><th class='num'>Selesai</th><th class='num'>Earned BNB</th><th class='num'>Earned USDC</th></tr>";
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  rows.forEach((r, i) => {
    const tr = document.createElement("tr");
    const rank = document.createElement("td");
    rank.textContent = String(i + 1);
    const addr = document.createElement("td");
    const link = bscLink("address", r.addr, short(r.addr));
    if (link) addr.appendChild(link); else addr.textContent = short(r.addr);
    const tier = document.createElement("td");
    const badge = badgeEl(r.completed);
    if (badge) tier.appendChild(badge); else tier.textContent = "-";
    const comp = document.createElement("td");
    comp.className = "num";
    comp.textContent = String(r.completed);
    const bnb = document.createElement("td");
    bnb.className = "num";
    bnb.textContent = ethers.formatEther(r.bnb);
    const usdc = document.createElement("td");
    usdc.className = "num";
    usdc.textContent = ethers.formatUnits(r.usdc, 6);
    tr.append(rank, addr, tier, comp, bnb, usdc);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  box.appendChild(table);
}

async function updateEscrowHealth() {
  const st = $("escrowStatus");
  try {
    const rp = readProvider();
    const addr = contractAddress();
    if (!ethers.isAddress(addr)) {
      st.textContent = "Kesehatan escrow belum bisa dicek: alamat kontrak tidak valid.";
      st.className = "muted";
      return;
    }
    const bnbBal = await rp.getBalance(addr);
    const usdc = new ethers.Contract(USDC_BSC, ERC20_ABI, rp);
    const usdcBal = await usdc.balanceOf(addr);
    let openBnb = 0n;
    let openUsdc = 0n;
    for (const { bounty: b } of allBounties) {
      const s = Number(b.status);
      if (s === 0 || s === 1 || s === 2) {
        if (b.paymentToken === ZERO) openBnb += b.amount;
        else if (b.paymentToken.toLowerCase() === USDC_BSC.toLowerCase()) openUsdc += b.amount;
      }
    }
    $("escrowBnbBal").textContent = ethers.formatEther(bnbBal) + " BNB";
    $("escrowUsdcBal").textContent = ethers.formatUnits(usdcBal, 6) + " USDC";
    $("escrowBnbOpen").textContent = ethers.formatEther(openBnb) + " BNB";
    $("escrowUsdcOpen").textContent = ethers.formatUnits(openUsdc, 6) + " USDC";
    escrowDeficit.bnb = bnbBal < openBnb;
    escrowDeficit.usdc = usdcBal < openUsdc;
    if (bnbBal >= openBnb && usdcBal >= openUsdc) {
      st.textContent = "Escrow fully backed: saldo kontrak menutupi semua dana bounty yang masih terbuka.";
      st.className = "ok";
    } else {
      st.textContent = "PERHATIAN: saldo kontrak kurang dari dana bounty yang masih terbuka. Jangan buat bounty baru sebelum ini diperiksa.";
      st.className = "err";
    }
  } catch (e) {
    st.textContent = "Kesehatan escrow belum bisa dicek: " + (e.reason || e.message);
    st.className = "err";
  }
}

function setCheck(id, state) {
  const li = $(id);
  if (!li) return;
  const mark = li.querySelector(".mark");
  const st = li.querySelector(".st");
  li.classList.remove("check-ok", "check-bad");
  if (state === "ok") {
    li.classList.add("check-ok");
    mark.textContent = "✓";
    st.textContent = "OK";
  } else if (state === "bad") {
    li.classList.add("check-bad");
    mark.textContent = "✕";
    st.textContent = "GAGAL";
  } else {
    mark.textContent = "?";
    st.textContent = "-";
  }
}

function updateLiveSecurity() {
  const addrOk = contractAddress().trim().toLowerCase() === OFFICIAL_BOARD.toLowerCase();
  setCheck("checkAddr", addrOk ? "ok" : "bad");
  if (chainId === null) setCheck("checkChain", "unknown");
  else setCheck("checkChain", chainId === 56 ? "ok" : "bad");
  const host = window.location.hostname;
  if (host === "ian4jpg.github.io") setCheck("checkHost", "ok");
  else if (host === "localhost" || host === "127.0.0.1" || host === "") setCheck("checkHost", "unknown");
  else setCheck("checkHost", "bad");
  let sriOk = false;
  try {
    const scripts = document.querySelectorAll('script[src*="ethers"]');
    sriOk = scripts.length > 0 && !!window.ethers &&
      Array.from(scripts).some((s) => s.getAttribute("integrity"));
  } catch (e) { sriOk = false; }
  setCheck("checkSri", sriOk ? "ok" : "bad");
}

// ---- Activity feed --------------------------------------------------------

const EVENT_LABELS = {
  BountyCreated: "Bounty dibuat",
  BountyClaimed: "Bounty diklaim",
  WorkSubmitted: "Hasil diserahkan",
  PaymentReleased: "Pembayaran dilepas",
  BountyCancelled: "Bounty dibatalkan",
  BountyExpired: "Bounty kedaluwarsa",
  TimeoutClaimed: "Timeout diklaim",
};

async function loadActivity() {
  if (activityLoading) return;
  activityLoading = true;
  const list = $("activityList");
  list.innerHTML = "<p class='muted'>Memuat aktivitas...</p>";
  try {
    const board = await getBoard(false);
    const rp = readProvider();
    const latest = await rp.getBlockNumber();
    const logs = [];
    const CHUNK = 50000; // max block range publicnode (diuji 26 Nov 2026: 50k OK, 100k ditolak -32701)
    const MAX_EVENTS = 40;
    let to = latest;
    // getLogs dengan retry di endpoint log khusus (lihat LOG_RPC): RPC
    // publik utama me-rate-limit eth_getLogs (error -32005) bila chunk
    // diminta terlalu cepat. Tiap chunk dicoba sampai 4x dengan jeda
    // 0/2/5/10 detik, lalu sekali lewat provider baca utama sebagai
    // upaya terakhir; bila tetap gagal, seluruh feed gagal dengan anggun
    // seperti sebelumnya.
    async function getLogsRetry(params) {
      const delays = [0, 2000, 5000, 10000];
      let lastErr = null;
      for (let i = 0; i < delays.length; i++) {
        if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
        try {
          return await logProvider().getLogs(params);
        } catch (e) {
          lastErr = e;
          log("getLogs gagal, coba lagi (" + (i + 1) + "/4): " + (e.reason || e.message));
        }
      }
      try {
        return await rp.getLogs(params);
      } catch (e) {
        lastErr = e;
      }
      throw lastErr;
    }
    while (to >= DEPLOY_BLOCK && logs.length < MAX_EVENTS) {
      const from = Math.max(DEPLOY_BLOCK, to - CHUNK + 1);
      const chunk = await getLogsRetry({ address: contractAddress(), fromBlock: from, toBlock: to });
      for (const l of chunk) logs.push(l);
      if (from === DEPLOY_BLOCK) break;
      to = from - 1;
      // Jeda kecil antar chunk supaya RPC publik tidak me-rate-limit.
      await new Promise((r) => setTimeout(r, 400));
    }
    logs.sort((a, b) => (b.blockNumber - a.blockNumber) || (b.index - a.index));
    const shown = logs.slice(0, MAX_EVENTS);
    if (shown.length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Tidak ada aktivitas.";
      list.innerHTML = "";
      list.appendChild(p);
      return;
    }
    // Block timestamps, batched.
    const blockNums = [...new Set(shown.map((l) => l.blockNumber))];
    const times = {};
    await Promise.all(blockNums.map(async (n) => {
      try { times[n] = Number((await rp.getBlock(n)).timestamp); } catch (e) { /* leave unset */ }
    }));
    list.innerHTML = "";
    for (const l of shown) {
      let parsed = null;
      try { parsed = board.interface.parseLog(l); } catch (e) { /* skip */ }
      if (!parsed) continue;
      const item = document.createElement("div");
      item.className = "feed-item";
      const ev = document.createElement("span");
      ev.className = "ev";
      const id = parsed.args.id !== undefined ? Number(parsed.args.id) : null;
      ev.textContent = (EVENT_LABELS[parsed.name] || parsed.name) + (id !== null ? " #" + id : "");
      item.appendChild(ev);
      const actor = parsed.args.worker || parsed.args.poster;
      if (actor) {
        const by = document.createElement("span");
        by.className = "muted";
        by.textContent = " oleh " + short(actor);
        item.appendChild(by);
      }
      if (parsed.args.amount !== undefined) {
        // Payment events carry no token address: look the bounty up in the
        // loaded list so the amount is formatted with the right token.
        const row = allBounties.find((r) => r.id === id);
        const tok = row ? row.bounty.paymentToken : ZERO;
        const meta = await tokenMetaDisplay(tok);
        const amt = document.createElement("span");
        amt.className = "mono";
        amt.textContent = fmtAmount(parsed.args.amount, meta);
        item.appendChild(amt);
      }
      if (id !== null) {
        const open = document.createElement("a");
        open.href = "#bounty-" + id;
        open.textContent = "#" + id;
        open.addEventListener("click", (e) => { e.preventDefault(); openDetail(id); });
        item.appendChild(open);
      }
      const txLink = bscLink("tx", l.transactionHash, "tx");
      if (txLink) item.appendChild(txLink);
      const when = document.createElement("span");
      when.className = "when";
      when.textContent = times[l.blockNumber] ? fmtTime(times[l.blockNumber]) : "blok " + l.blockNumber;
      item.appendChild(when);
      list.appendChild(item);
    }
    const au = $("actUpdated");
    if (au) au.textContent = new Date().toLocaleTimeString("id-ID", { hour12: false }) + " WIB";
    log("Activity dimuat: " + shown.length + " event.");
  } catch (e) {
    const p = document.createElement("p");
    p.className = "err";
    p.textContent = "Aktivitas tidak tersedia (RPC menolak rentang blok).";
    list.innerHTML = "";
    list.appendChild(p);
    log("Gagal membaca aktivitas: " + (e.reason || e.message));
  } finally {
    activityLoading = false;
  }
}

// ---- Bounty detail ---------------------------------------------------------

function closeDetail() {
  $("detailModal").hidden = true;
  detailId = null;
  if (detailTimer) { clearInterval(detailTimer); detailTimer = null; }
  try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e) { /* ignore */ }
}

async function openDetail(id) {
  detailId = id;
  const modal = $("detailModal");
  const body = $("detailBody");
  modal.hidden = false;
  if (detailTimer) { clearInterval(detailTimer); detailTimer = null; }
  body.innerHTML = "<p class='muted'>Memuat dari kontrak...</p>";
  let row = allBounties.find((r) => r.id === id);
  let b = row ? row.bounty : null;
  if (!b) {
    try {
      const board = await getBoard(false);
      b = await board.getBounty(id);
    } catch (e) {
      body.innerHTML = "";
      const p = document.createElement("p");
      p.className = "err";
      p.textContent = "Detail bounty tidak ditemukan.";
      body.appendChild(p);
      return;
    }
  }
  try { history.replaceState(null, "", "#bounty-" + id); } catch (e) { /* ignore */ }
  $("detailTitle").textContent = "#" + id + " " + b.title;
  await renderDetailBody(b, id);
}

async function renderDetailBody(b, id) {
  const body = $("detailBody");
  body.innerHTML = "";
  const status = Number(b.status);
  const meta = await tokenMetaDisplay(b.paymentToken);
  const statsMap = {};
  for (const r of workerStatsFromList()) statsMap[r.addr.toLowerCase()] = r.completed;

  const titleEl = document.createElement("div");
  titleEl.setAttribute("data-user", "1");
  const strong = document.createElement("strong");
  strong.textContent = "#" + id + " " + b.title;
  titleEl.appendChild(strong);
  const badge = document.createElement("span");
  badge.className = "badge st-" + status;
  badge.textContent = STATUS_NAMES[status];
  titleEl.appendChild(document.createTextNode(" "));
  titleEl.appendChild(badge);
  body.appendChild(titleEl);

  const descEl = document.createElement("p");
  descEl.setAttribute("data-user", "1");
  descEl.textContent = b.description;
  body.appendChild(descEl);

  const info = document.createElement("p");
  info.className = "muted";
  function addRow(label, node) {
    const line = document.createElement("span");
    line.textContent = label;
    info.appendChild(line);
    info.appendChild(node);
    info.appendChild(document.createElement("br"));
  }
  const posterLink = bscLink("address", b.poster, short(b.poster));
  const posterSpan = document.createElement("span");
  if (posterLink) posterSpan.appendChild(posterLink); else posterSpan.textContent = short(b.poster);
  if (statsMap[b.poster.toLowerCase()]) {
    const pb = badgeEl(statsMap[b.poster.toLowerCase()]);
    if (pb) posterSpan.appendChild(pb);
  }
  addRow("Poster: ", posterSpan);
  const workerSpan = document.createElement("span");
  if (b.worker === ZERO) {
    workerSpan.textContent = "-";
  } else {
    const wl = bscLink("address", b.worker, short(b.worker));
    if (wl) workerSpan.appendChild(wl); else workerSpan.textContent = short(b.worker);
    if (statsMap[b.worker.toLowerCase()]) {
      const wb = badgeEl(statsMap[b.worker.toLowerCase()]);
      if (wb) workerSpan.appendChild(wb);
    }
  }
  addRow("Worker: ", workerSpan);
  const rewardSpan = document.createElement("span");
  rewardSpan.className = "mono";
  rewardSpan.textContent = fmtAmount(b.amount, meta) + " (" + b.amount.toString() + ", satuan mentah di chain)";
  addRow("Hadiah: ", rewardSpan);
  const statusSpan = document.createElement("span");
  statusSpan.textContent = STATUS_NAMES[status];
  addRow("Status: ", statusSpan);
  const dlSpan = document.createElement("span");
  dlSpan.textContent = fmtTime(b.deadline);
  addRow("Deadline: ", dlSpan);
  body.appendChild(info);

  // P0-4: honest settlement limits, shown while the bounty is not final.
  if (status <= 2) {
    const warn = document.createElement("div");
    warn.className = "warn";
    warn.textContent = "Batas kontrak v1: tidak ada jalur reject. Submit telat memblokir refund. Payout ke kontrak yang menolak dana bisa gagal.";
    body.appendChild(warn);
  }

  // Countdowns (live, updated every second while the modal is open).
  const now = Math.floor(Date.now() / 1000);
  if (status === 0 || status === 1) {
    const cdP = document.createElement("p");
    cdP.appendChild(document.createTextNode("Sisa waktu: "));
    const cd = document.createElement("span");
    cd.className = "countdown";
    cd.id = "detailCountdown";
    cd.textContent = fmtCountdown(Number(b.deadline) - now);
    cdP.appendChild(cd);
    body.appendChild(cdP);
  }
  if (status === 2) {
    const toP = document.createElement("p");
    toP.appendChild(document.createTextNode("Batas klaim timeout: "));
    const to = document.createElement("span");
    to.className = "countdown";
    to.id = "detailTimeoutCountdown";
    to.textContent = fmtCountdown(Number(b.submittedAt) + CLAIM_TIMEOUT_SECONDS - now);
    toP.appendChild(to);
    body.appendChild(toP);
  }
  if (b.proof) {
    const proofP = document.createElement("p");
    proofP.appendChild(document.createTextNode("Bukti kerja: "));
    proofP.appendChild(proofNode(b.proof));
    body.appendChild(proofP);
  }

  // Timeline: contract events for this bounty id + state timestamps.
  const histH = document.createElement("p");
  histH.textContent = "Riwayat";
  histH.style.fontWeight = "700";
  body.appendChild(histH);
  const tl = document.createElement("ul");
  tl.className = "timeline";
  body.appendChild(tl);
  const entries = [];
  try {
    const rp = readProvider();
    const board = await getBoard(false);
    const latest = await rp.getBlockNumber();
    const idTopic = ethers.zeroPadValue(ethers.toBeHex(id), 32);
    const evLogs = [];
    const CHUNK = 50000; // max block range publicnode (diuji 26 Nov 2026: 50k OK, 100k ditolak -32701)
    let to = latest;
    let chunks = 0;
    let foundCreated = false;
    while (to >= DEPLOY_BLOCK && chunks < 40 && !foundCreated) {
      const from = Math.max(DEPLOY_BLOCK, to - CHUNK + 1);
      const chunk = await logProvider().getLogs({
        address: contractAddress(), fromBlock: from, toBlock: to,
        topics: [null, idTopic],
      });
      for (const l of chunk) {
        evLogs.push(l);
        try {
          const p = board.interface.parseLog(l);
          if (p && p.name === "BountyCreated") foundCreated = true;
        } catch (e) { /* unparsable log: ignore */ }
      }
      if (from === DEPLOY_BLOCK) break;
      to = from - 1;
      chunks += 1;
    }
    const times = {};
    const blockNums = [...new Set(evLogs.map((l) => l.blockNumber))];
    await Promise.all(blockNums.map(async (n) => {
      try { times[n] = Number((await rp.getBlock(n)).timestamp); } catch (e) { /* leave unset */ }
    }));
    for (const l of evLogs) {
      let parsed = null;
      try { parsed = board.interface.parseLog(l); } catch (e) { /* skip */ }
      if (!parsed) continue;
      const labelMap = {
        BountyCreated: "Dibuat",
        BountyClaimed: "Diklaim",
        WorkSubmitted: "Diserahkan",
        PaymentReleased: "Dibayar ke worker",
        BountyCancelled: "Dibatalkan",
        BountyExpired: "Kedaluwarsa",
        TimeoutClaimed: "Diklaim via timeout",
      };
      entries.push({ time: times[l.blockNumber] || null, label: labelMap[parsed.name] || parsed.name, tx: l.transactionHash });
    }
  } catch (e) {
    log("Timeline event gagal dibaca: " + (e.reason || e.message));
  }
  // State timestamps fill gaps when events could not be read.
  if (Number(b.claimedAt) > 0 && !entries.some((x) => x.label === "Diklaim")) {
    entries.push({ time: Number(b.claimedAt), label: "Diklaim", tx: null });
  }
  if (Number(b.submittedAt) > 0 && !entries.some((x) => x.label === "Diserahkan")) {
    entries.push({ time: Number(b.submittedAt), label: "Diserahkan", tx: null });
  }
  if (entries.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Tidak ada riwayat.";
    tl.appendChild(li);
  } else {
    entries.sort((a, b) => (a.time || 0) - (b.time || 0));
    for (const en of entries) {
      const li = document.createElement("li");
      li.textContent = en.label;
      if (en.time) {
        const w = document.createElement("span");
        w.className = "t-when";
        w.textContent = " · " + fmtTime(en.time);
        li.appendChild(w);
      }
      if (en.tx) {
        li.appendChild(document.createTextNode(" "));
        const txLink = bscLink("tx", en.tx, "tx");
        if (txLink) li.appendChild(txLink);
      }
      tl.appendChild(li);
    }
  }

  body.appendChild(buildActions(b, id));

  detailTimer = setInterval(() => {
    const n = Math.floor(Date.now() / 1000);
    const cd = document.getElementById("detailCountdown");
    if (cd) cd.textContent = fmtCountdown(Number(b.deadline) - n);
    const to = document.getElementById("detailTimeoutCountdown");
    if (to) to.textContent = fmtCountdown(Number(b.submittedAt) + CLAIM_TIMEOUT_SECONDS - n);
  }, 1000);
}

// (helper removed: timeline scan now parses logs with the board interface)

// ---- Templates -------------------------------------------------------------

function applyTemplate(key) {
  const lang = document.documentElement.lang === "id" ? "id" : "en";
  const t = TEMPLATES[lang][key];
  if (!t) return;
  $("fTitle").value = t.title;
  $("fDesc").value = t.desc;
  refreshApproveState();
  toast("Template diterapkan.", "ok");
}

// ---- Transaction preview + send -------------------------------------------

let previewResolve = null;

function showPreview({ fnName, argsText, valueText, gasText, feeText }) {
  const body = $("previewBody");
  body.innerHTML = "";
  function row(label, value) {
    const div = document.createElement("div");
    div.style.margin = "6px 0";
    const lab = document.createElement("span");
    lab.textContent = label;
    const val = document.createElement("span");
    val.className = "mono";
    val.setAttribute("data-user", "1");
    val.textContent = value;
    div.appendChild(lab);
    div.appendChild(val);
    body.appendChild(div);
  }
  row("Fungsi: ", fnName);
  row("Argumen: ", argsText);
  row("Nilai: ", valueText);
  row("Estimasi gas: ", gasText);
  row("Perkiraan biaya: ", feeText);
  $("previewModal").hidden = false;
  return new Promise((resolve) => { previewResolve = resolve; });
}

function closePreview(result) {
  $("previewModal").hidden = true;
  if (previewResolve) { const r = previewResolve; previewResolve = null; r(result); }
}

function argsToText(args) {
  return "[" + args.map((a) => {
    if (typeof a === "bigint") return a.toString();
    if (typeof a === "string") return JSON.stringify(a);
    return String(a);
  }).join(", ") + "]";
}

// Simulate (staticCall) + estimate gas, then show the preview modal.
// Returns { gas, fee } when the user confirms, null otherwise.
async function simulateAndPreview(contract, fnName, args, value, valueText) {
  try {
    await contract[fnName].staticCall(...args, { value });
  } catch (e) {
    toast("Simulasi transaksi gagal (kemungkinan revert): " + (e.reason || e.message), "err");
    log("Simulasi " + fnName + " gagal: " + (e.reason || e.message));
    return null;
  }
  let gas;
  try {
    gas = await contract[fnName].estimateGas(...args, { value });
  } catch (e) {
    toast("Estimasi gas gagal: " + (e.reason || e.message), "err");
    log("Estimasi gas " + fnName + " gagal: " + (e.reason || e.message));
    return null;
  }
  let feeText = "-";
  try {
    const feeData = await readProvider().getFeeData();
    if (feeData.gasPrice) feeText = ethers.formatEther(gas * feeData.gasPrice) + " BNB";
  } catch (e) { /* leave fee unknown */ }
  const ok = await showPreview({
    fnName,
    argsText: argsToText(args),
    valueText: valueText || (ethers.formatEther(value) + " BNB"),
    gasText: gas.toString() + " gas",
    feeText,
  });
  if (!ok) {
    toast("Transaksi dibatalkan.");
    return null;
  }
  return { gas, fee: feeText };
}

async function doTx(label, fnName, args, value) {
  if (!(await ensureWritableChain())) return;
  let board;
  try {
    board = await getBoard(true);
  } catch (e) {
    toast(e.message, "err");
    return;
  }
  // P0-4: warn before paying a worker that is itself a contract. If that
  // contract refuses incoming funds, release/claimTimeout can revert and
  // the bounty gets stuck in Submitted.
  if (fnName === "releasePayment" || fnName === "claimTimeout") {
    try {
      const b = await (await getBoard(false)).bounties(args[0]);
      const workerCode = await readProvider().getCode(b.worker);
      if (workerCode !== "0x") {
        toast("Perhatian: worker adalah alamat kontrak. Bila kontrak itu menolak terima dana, payout bisa gagal.");
        log("Peringatan payout: worker " + b.worker + " adalah alamat kontrak (code != 0x).");
      }
    } catch (e) { /* warning only; the simulation below is the real gate */ }
  }
  const sim = await simulateAndPreview(board, fnName, args, value);
  if (!sim) return;
  log("Mengirim " + label + " ... (konfirmasi di wallet kamu, transaksi hanya jalan bila kamu menyetujuinya)");
  try {
    const tx = await board[fnName](...args, { value });
    log(label + ": tx terkirim " + tx.hash + ", menunggu konfirmasi...");
    const receipt = await tx.wait();
    log(label + ": TERKONFIRMASI di blok " + receipt.blockNumber + " (status " + receipt.status + ").");
    await loadBounties();
    await checkAgentId();
    if (detailId !== null) openDetail(detailId);
  } catch (e) {
    const msg = e.reason || e.message || "transaksi dibatalkan atau gagal";
    log(label + " GAGAL / dibatalkan: " + msg);
    toast(label + " gagal atau dibatalkan: " + msg, "err");
  }
}

// ---- Create bounty -------------------------------------------------------

function selectedToken() {
  const choice = $("fToken").value;
  if (choice === "BNB") return { address: ZERO, kind: "BNB" };
  if (choice === "USDC") return { address: USDC_BSC, kind: "USDC" };
  throw new Error("Token tidak ada di allowlist (hanya BNB dan USDC).");
}

async function parseCreateForm() {
  const title = $("fTitle").value.trim();
  const description = $("fDesc").value.trim();
  const amountText = $("fAmount").value.trim();
  const deadlineText = $("fDeadline").value;
  if (!title) throw new Error("Judul wajib diisi.");
  if (title.length > 120) throw new Error("Judul maksimal 120 karakter.");
  if (!description) throw new Error("Deskripsi wajib diisi.");
  if (description.length > 1000) throw new Error("Deskripsi maksimal 1000 karakter.");
  if (!amountText || Number(amountText) <= 0) throw new Error("Jumlah harus lebih dari 0.");
  if (!deadlineText) throw new Error("Deadline wajib diisi.");
  const deadline = Math.floor(new Date(deadlineText).getTime() / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!(deadline > nowSec)) throw new Error("Deadline harus di masa depan.");
  if (deadline > nowSec + MAX_DEADLINE_DAYS * 86400) throw new Error("Deadline maksimal 60 hari dari sekarang.");
  const token = selectedToken();
  const meta = await tokenMetaStrict(token.address);
  const amount = ethers.parseUnits(amountText, meta.decimals);
  return { title, description, amount, deadline, token, meta };
}

async function refreshApproveState() {
  const box = $("approveBox");
  const btn = $("btnApprove");
  box.hidden = true;
  btn.hidden = true;
  $("createHint").textContent = "";
  const allowBox = $("allowBox");
  allowBox.hidden = true;
  try {
    if (!account) return;
    const f = await parseCreateForm();
    const assetDeficit = f.token.address === ZERO ? escrowDeficit.bnb : escrowDeficit.usdc;
    if (assetDeficit) {
      $("createHint").textContent = "PERHATIAN: escrow " + f.meta.symbol +
        " sedang defisit (saldo kontrak kurang dari dana bounty yang masih terbuka). Bounty baru dengan token ini diblokir sampai kesehatan escrow kembali normal.";
      return;
    }
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
    $("allowCurrent").textContent = ethers.formatUnits(allowance, f.meta.decimals) + " " + f.meta.symbol;
    allowBox.hidden = false;
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
  if (!(await ensureWritableChain())) return;
  let f;
  try {
    f = await parseCreateForm();
  } catch (e) {
    toast(e.message, "err");
    return;
  }
  const boardAddr = contractAddress();
  if (!ethers.isAddress(boardAddr)) { toast("Alamat kontrak AgentBoard belum diisi atau tidak valid.", "err"); return; }
  if (!signer) { toast("Hubungkan wallet dulu.", "err"); return; }
  const token = new ethers.Contract(f.token.address, ERC20_ABI, signer);
  const sim = await simulateAndPreview(token, "approve", [boardAddr, f.amount], 0n,
    "0 BNB (approve " + ethers.formatUnits(f.amount, f.meta.decimals) + " " + f.meta.symbol + ")");
  if (!sim) return;
  log("Approve " + ethers.formatUnits(f.amount, f.meta.decimals) + " " + f.meta.symbol +
    " untuk kontrak " + boardAddr + " (tepat sebesar bounty, bukan tanpa batas). Konfirmasi di wallet kamu.");
  try {
    const tx = await token.approve(boardAddr, f.amount);
    log("Approve terkirim " + tx.hash + ", menunggu konfirmasi...");
    await tx.wait();
    log("Approve TERKONFIRMASI.");
    await refreshApproveState();
  } catch (e) {
    const msg = e.reason || e.message || "approve dibatalkan atau gagal";
    log("Approve GAGAL / dibatalkan: " + msg);
    toast("Approve gagal atau dibatalkan: " + msg, "err");
  }
}

async function revokeAllowance() {
  if (!(await ensureWritableChain())) return;
  let f;
  try {
    f = await parseCreateForm();
  } catch (e) {
    toast(e.message, "err");
    return;
  }
  if (f.token.address === ZERO) { toast("BNB tidak memakai allowance.", "err"); return; }
  const boardAddr = contractAddress();
  if (!ethers.isAddress(boardAddr)) { toast("Alamat kontrak AgentBoard belum diisi atau tidak valid.", "err"); return; }
  if (!signer) { toast("Hubungkan wallet dulu.", "err"); return; }
  const token = new ethers.Contract(f.token.address, ERC20_ABI, signer);
  const sim = await simulateAndPreview(token, "approve", [boardAddr, 0n], 0n, "0 BNB (revoke ke 0)");
  if (!sim) return;
  log("Revoke allowance untuk kontrak " + boardAddr + " (set ke 0). Konfirmasi di wallet kamu.");
  try {
    const tx = await token.approve(boardAddr, 0n);
    log("Revoke terkirim " + tx.hash + ", menunggu konfirmasi...");
    await tx.wait();
    log("Revoke TERKONFIRMASI.");
    await refreshApproveState();
  } catch (e) {
    const msg = e.reason || e.message || "revoke dibatalkan atau gagal";
    log("Revoke GAGAL / dibatalkan: " + msg);
    toast("Revoke allowance gagal atau dibatalkan: " + msg, "err");
  }
}

async function createBounty() {
  if (!account || !signer) { toast("Hubungkan wallet dulu.", "err"); return; }
  if (!hasAgent) {
    toast("Alamat ini belum memegang Agent ID. Membuat bounty butuh Agent ID.", "err");
    return;
  }
  let f;
  try {
    f = await parseCreateForm();
  } catch (e) {
    toast(e.message, "err");
    return;
  }
  const boardAddr = contractAddress();
  if (!ethers.isAddress(boardAddr)) { toast("Alamat kontrak AgentBoard belum diisi atau tidak valid.", "err"); return; }
  const assetDeficit = f.token.address === ZERO ? escrowDeficit.bnb : escrowDeficit.usdc;
  if (assetDeficit) {
    toast("Escrow " + f.meta.symbol + " sedang defisit: saldo kontrak kurang dari dana bounty yang masih terbuka. Jangan buat bounty baru sampai ini diperiksa.", "err");
    return;
  }
  if (f.token.address !== ZERO) {
    const token = new ethers.Contract(f.token.address, ERC20_ABI, readProvider());
    const allowance = await token.allowance(account, boardAddr);
    if (allowance < f.amount) {
      toast("Allowance token belum cukup. Tekan tombol approve dulu, lalu buat bounty.", "err");
      await refreshApproveState();
      return;
    }
  }
  const value = f.token.address === ZERO ? f.amount : 0n;
  log("Membuat bounty '" + f.title + "' (" + ethers.formatUnits(f.amount, f.meta.decimals) + " " +
    f.meta.symbol + ", deadline " + fmtTime(f.deadline) + "). Dana dikunci di escrow. Konfirmasi di wallet kamu.");
  await doTx(
    "createBounty '" + f.title + "'",
    "createBounty",
    [f.title, f.description, f.token.address, f.amount, f.deadline],
    value
  );
}

async function showReputation() {
  const addr = $("repAddress").value.trim();
  if (!ethers.isAddress(addr)) { $("repResult").textContent = "Alamat tidak valid."; return; }
  try {
    const board = await getBoard(false);
    const stats = await board.agentStats(addr);
    const agent = new ethers.Contract(AGENT_ID_ADDRESS, AGENT_ID_ABI, readProvider());
    const bal = await agent.balanceOf(addr);
    const box = $("repResult");
    box.textContent = "Alamat " + addr + ": memegang Agent ID: " + (bal > 0n ? "ya (" + bal.toString() + ")" : "tidak") +
      ". Bounty selesai: " + stats[0].toString() + ". Total earned (satuan mentah, tercampur bila bounty memakai token berbeda): " +
      stats[1].toString() + ". Klaim aktif: " + stats[2].toString() + ".";
    const badge = badgeEl(stats[0]);
    if (badge) box.appendChild(badge);
    log("Reputasi " + addr + ": completed=" + stats[0] + ", earned(raw)=" + stats[1] + ", active=" + stats[2]);
  } catch (e) {
    $("repResult").textContent = "Gagal membaca reputasi: " + (e.reason || e.message);
  }
}

// ---- Wiring ---------------------------------------------------------------

$("btnConnect").addEventListener("click", connect);
$("btnLoad").addEventListener("click", loadBounties);
$("btnRefresh").addEventListener("click", loadBounties);
$("btnRefreshActivity").addEventListener("click", loadActivity);
$("btnCreate").addEventListener("click", createBounty);
$("btnApprove").addEventListener("click", approveToken);
$("btnRevoke").addEventListener("click", revokeAllowance);
$("btnRep").addEventListener("click", showReputation);
$("themeToggle").addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark"));
$("btnDetailClose").addEventListener("click", closeDetail);
$("detailModal").addEventListener("click", (e) => { if (e.target === $("detailModal")) closeDetail(); });
$("btnPreviewCancel").addEventListener("click", () => closePreview(false));
$("previewModal").addEventListener("click", (e) => { if (e.target === $("previewModal")) closePreview(false); });
$("btnPreviewConfirm").addEventListener("click", () => closePreview(true));
$("btnCopyLink").addEventListener("click", async () => {
  if (detailId === null) return;
  const url = window.location.href.split("#")[0] + "#bounty-" + detailId;
  try {
    await navigator.clipboard.writeText(url);
    toast("Link bounty disalin.", "ok");
  } catch (e) {
    toast("Tautan tidak bisa disalin otomatis, salin manual dari address bar.", "err");
  }
});
document.querySelectorAll(".tpl-btn").forEach((btn) => {
  btn.addEventListener("click", () => applyTemplate(btn.getAttribute("data-tpl")));
});
$("fToken").addEventListener("change", refreshApproveState);
["fTitle", "fDesc", "fAmount", "fDeadline"].forEach((id) => {
  $(id).addEventListener("input", refreshApproveState);
});
// P0-1: the contract address input is locked to the official address.
// Editing it requires the explicit testnet-mode checkbox; turning the mode
// off resets the input to the official address.
$("contractAddress").readOnly = true;
$("testnetMode").addEventListener("change", () => {
  const on = $("testnetMode").checked;
  const input = $("contractAddress");
  if (!on) {
    input.value = OFFICIAL_BOARD;
    input.readOnly = true;
  } else {
    input.readOnly = false;
    toast("Mode testnet aktif: write diizinkan di chain 97/31337 dengan alamat kontrak lain.");
  }
  updateLiveSecurity();
  checkAgentId();
});
$("contractAddress").addEventListener("input", () => { checkAgentId(); updateLiveSecurity(); });
$("fSearch").addEventListener("input", () => { filters.q = $("fSearch").value; currentPage = 1; applyFiltersAndRender(); });
$("fStatus").addEventListener("change", () => { filters.status = $("fStatus").value; currentPage = 1; applyFiltersAndRender(); });
$("fTokenFilter").addEventListener("change", () => { filters.token = $("fTokenFilter").value; currentPage = 1; applyFiltersAndRender(); });
$("fAddrFilter").addEventListener("input", () => { filters.addr = $("fAddrFilter").value; currentPage = 1; applyFiltersAndRender(); });
$("fSort").addEventListener("change", () => { sortKey = $("fSort").value; applyFiltersAndRender(); });
$("btnMinePosted").addEventListener("click", () => {
  if (!account) { toast("Hubungkan wallet dulu.", "err"); return; }
  filters.mine = filters.mine === "posted" ? "" : "posted";
  $("btnMinePosted").classList.toggle("active-filter", filters.mine === "posted");
  $("btnMineClaimed").classList.toggle("active-filter", false);
  currentPage = 1;
  applyFiltersAndRender();
});
$("btnMineClaimed").addEventListener("click", () => {
  if (!account) { toast("Hubungkan wallet dulu.", "err"); return; }
  filters.mine = filters.mine === "claimed" ? "" : "claimed";
  $("btnMineClaimed").classList.toggle("active-filter", filters.mine === "claimed");
  $("btnMinePosted").classList.toggle("active-filter", false);
  currentPage = 1;
  applyFiltersAndRender();
});
$("btnClearFilters").addEventListener("click", () => {
  filters = { q: "", status: "", token: "", addr: "", mine: "" };
  sortKey = "newest";
  $("fSearch").value = "";
  $("fStatus").value = "";
  $("fTokenFilter").value = "";
  $("fAddrFilter").value = "";
  $("fSort").value = "newest";
  $("btnMinePosted").classList.toggle("active-filter", false);
  $("btnMineClaimed").classList.toggle("active-filter", false);
  currentPage = 1;
  applyFiltersAndRender();
});
$("btnPrevPage").addEventListener("click", () => {
  if (currentPage > 1) { currentPage -= 1; renderPage(); }
});
$("btnNextPage").addEventListener("click", () => {
  const pages = Math.max(1, Math.ceil(filteredBounties.length / PAGE_SIZE));
  if (currentPage < pages) { currentPage += 1; renderPage(); }
});
window.addEventListener("hashchange", () => {
  const m = window.location.hash.match(/^#bounty-(\d+)$/);
  if (m) openDetail(Number(m[1]));
  else if (detailId !== null) closeDetail();
});

if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accs) => {
    account = accs[0] || null;
    $("accountInfo").textContent = account ? " " + checksum(account) : "";
    log("Akun wallet berubah: " + (account || "-"));
    closePreview(false);
    checkAgentId();
    loadBounties();
  });
  window.ethereum.on("chainChanged", () => { window.location.reload(); });
}

initTheme();
updateChainInfo();
updateLiveSecurity();
log("AgentBoard frontend v2 siap. Memuat daftar bounty dari kontrak... (tanpa wallet pun daftar tetap bisa dibaca.)");
loadBounties();
