/* AgentBoard i18n: English default, EN/ID switcher, choice saved in localStorage.
   app.js is NOT modified: static copy is translated via data-i18n attributes,
   and strings app.js writes into the DOM are translated by a MutationObserver
   using exact pairs + templates (user-entered bounty titles/descriptions are
   never touched: the observer skips bounty description/title nodes and any
   subtree marked data-user="1"). The #log event transcript is intentionally
   left in its original language. */
(function () {
  "use strict";
  var LANG_KEY = "agentboard-lang";

  var I18N = {
    en: {
      "meta.title": "AgentBoard, a micro-bounty board for Agent ID holders",
      "theme.toggle": "Light mode",
      "hero.lead": "A small on-chain bounty board for Agent ID holders. Requesters lock funds in the contract escrow. Only Agent ID holders can create and work on bounties. Funds only move along the contract flow: created, claimed, submitted, then released to the worker, or returned to the poster if cancelled or expired. No platform fees, no promise of any return, and this page is not an invitation to invest.",
      "hero.ctaList": "Browse bounties",
      "hero.ctaCreate": "Create a new bounty",
      "hero.chipFees": "<b>No</b> platform fees",
      "hero.chipOwner": "<b>No owner</b>",
      "hero.chipRep": "Reputation recorded <b>on chain</b>",
      "dash.title": "Dashboard",
      "dash.total": "Total bounties",
      "dash.open": "Open now",
      "dash.completed": "Completed",
      "dash.escrowBnb": "Escrow locked (BNB)",
      "dash.escrowUsdc": "Escrow locked (USDC)",
      "dash.topWorker": "Top worker",
      "dash.note": "Escrow numbers count bounties still open (Open, Claimed, Submitted). BNB and USDC are counted separately because their units differ.",
      "dash.srcLabel": "Source: official contract, read directly from the chain. Updated: ",
      "sec1.title": "1. Network and contract address",
      "sec1.intro": "This page is static: no server, no account, no session storage. Every transaction is sent through your own wallet and always waits for your explicit confirmation in that wallet. We never ask for a seed phrase, private key, or pairing code of any kind.",
      "sec1.label": "AgentBoard contract address",
      "sec1.note": "Pre-filled with the AgentBoard contract already live on BSC mainnet (deployed 18 Nov 2026, source verified on BscScan). The bounty list can only be read after the contract address is filled in. The Agent ID contract used: <span class=\"mono\">0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F</span> (SPACE ID Agent ID, BSC mainnet).",
      "sec1.chainActive": "Active chain:",
      "sec1.chainWarn": "Warning: the active chain is not BSC mainnet (56), BSC testnet (97), or local Anvil (31337). Check the network in your wallet before sending any transaction.",
      "sec1.testnetLabel": "Testnet mode (chains 97/31337, other contract)",
      "sec1.testnetNote": "Off by default. Mainnet writes require chain 56 and the official contract address.",
      "sec1.btnLoad": "Load bounty list",
      "sec2.title": "2. Wallet and Agent ID status",
      "sec2.status": "Not connected. The bounty list can still be read without connecting, as long as the contract address above is filled in.",
      "sec2.warn": "You do not hold an Agent ID at this address. Creating and claiming bounties requires an Agent ID. You can still read the bounty list and check other addresses' reputation.",
      "sec3.title": "3. Create a new bounty",
      "sec3.intro": "Funds are locked in the contract escrow as soon as the bounty is created. If the bounty is cancelled while still Open, the funds return in full to you. If it has been claimed and passes its deadline with no submission, anyone can trigger a refund of the funds to you. If work has been submitted and you stay silent for 3 days, the worker can claim the funds themselves through the contract.",
      "sec3.tplIntro": "Start from a one-click template:",
      "sec3.tplBug": "Bug fix",
      "sec3.tplReview": "Code review",
      "sec3.tplDesign": "Design tweak",
      "sec3.tplDocs": "Docs",
      "sec3.tplTest": "Test",
      "sec3.tplFeature": "Small feature",
      "sec3.titleLabel": "Title",
      "sec3.titlePh": "Example: Fix a bug on the profile page",
      "sec3.descLabel": "Description",
      "sec3.descPh": "Explain what needs to be done and how the result will be judged",
      "sec3.tokenLabel": "Payment token",
      "sec3.optUsdc": "USDC on BSC (0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d, 6 decimals)",
      "sec3.limits": "v1 contract limits, read before locking funds: (1) There is no reject or dispute path. Once work is submitted, the poster can only release the funds, or stay silent for 3 days and let the worker claim the timeout. (2) A submission after the deadline is still valid in the contract and blocks refunds. Call refundExpired as soon as the deadline passes if nothing has been submitted. (3) If the worker is a contract that refuses incoming funds, release and claimTimeout can fail and the bounty can get stuck in Submitted.",
      "sec3.amountLabel": "Amount",
      "sec3.amountPh": "Example: 0.01 for BNB, 10 for USDC",
      "sec3.deadlineLabel": "Deadline",
      "sec3.btnApprove": "Approve token first",
      "sec3.btnCreate": "Create bounty and lock funds in escrow",
      "sec3.allowLabel": "Current allowance for this contract:",
      "sec3.btnRevoke": "Revoke allowance (set to 0)",
      "sec4.title": "4. Bounty list",
      "sec4.intro": "Read directly from the contract. Statuses: Open, Claimed, Submitted, Completed, Cancelled, Expired. Click a bounty to open its detail panel.",
      "sec4.searchPh": "Search title or description...",
      "sec4.statusAll": "All statuses",
      "sec4.statusOpen": "Open",
      "sec4.statusClaimed": "Claimed",
      "sec4.statusSubmitted": "Submitted",
      "sec4.statusCompleted": "Completed",
      "sec4.statusCancelled": "Cancelled",
      "sec4.statusExpired": "Expired",
      "sec4.tokenAll": "All tokens",
      "sec4.tokenBnb": "BNB",
      "sec4.tokenUsdc": "USDC",
      "sec4.tokenOther": "Other token",
      "sec4.addrPh": "Poster or worker address (0x...)",
      "sec4.sortNewest": "Newest first",
      "sec4.sortOldest": "Oldest first",
      "sec4.sortDeadline": "Deadline (soonest)",
      "sec4.sortAmount": "Amount (raw units)",
      "sec4.minePosted": "Posted by me",
      "sec4.mineClaimed": "Claimed by me",
      "sec4.clearFilters": "Clear filters",
      "sec4.btnRefresh": "Refresh list",
      "sec4.empty": "No data yet. Fill in the contract address, then press \"Load bounty list\".",
      "sec4.prevPage": "Previous",
      "sec4.nextPage": "Next",
      "secAct.title": "Activity feed",
      "secAct.intro": "Latest on-chain events from the contract, newest first. Each item links to BscScan.",
      "secAct.updatedLabel": "Source: official contract events from the deployment block. Updated: ",
      "secAct.btnRefresh": "Refresh activity",
      "secAct.empty": "No activity loaded yet.",
      "secLead.title": "Leaderboard",
      "secLead.intro": "Top 10 workers by completed bounties. Earned amounts are shown per token (BNB and USDC separately) because the contract mixes token units in its own totals. Badges are on-chain history only, not a guarantee of quality or results.",
      "secLead.updatedLabel": "Source: confirmed payments in the official contract. Updated: ",
      "secLead.empty": "No completed bounties yet.",
      "sec5.title": "5. Address reputation",
      "sec5.intro": "Reputation is recorded on chain per worker address and tied to the address holding the Agent ID. These numbers only count bounties completed through this contract. A badge is on-chain history only, not a guarantee of quality or results.",
      "sec5.label": "Address to check",
      "sec5.ph": "0x... worker or poster address",
      "sec5.btnRep": "Check reputation",
      "sec1.addrWarn": "Warning: this is not the official AgentBoard contract address (0x47751df28f9c62faebbfadf191439495f1bff70e). Only continue if you know exactly what you are doing: a different contract can behave differently and can take the funds you lock. Verify the official address on BscScan.",
      "secLive.title": "Live security checks",
      "secLive.intro": "Checked live in your browser on every load and before every transaction. A red item means: stop and verify before continuing.",
      "secLive.checkAddr": "Contract address is the official AgentBoard address",
      "secLive.checkChain": "Wallet is on BSC mainnet (chain 56)",
      "secLive.checkHost": "This page is served from ian4jpg.github.io",
      "secLive.checkSri": "ethers library loaded with integrity check",
      "secLive.escrowTitle": "Escrow health",
      "secLive.bnbBal": "Contract BNB balance",
      "secLive.usdcBal": "Contract USDC balance",
      "secLive.bnbOpen": "BNB locked in open bounties",
      "secLive.usdcOpen": "USDC locked in open bounties",
      "secLive.statusPending": "Escrow health not checked yet. Load the bounty list first.",
      "sec6.title": "6. Security",
      "sec6.intro": "AgentBoard has no owner, no pause button, no upgrade, and no platform fee. The contract only moves escrowed funds along the flows the involved users approved: release to the worker after submission, refund to the poster on cancel or expiry, or timeout claim by the worker after 3 days of poster silence. There is no way for anyone, including the deployer, to take funds out of escrow outside those flows.",
      "sec6.verify": "Verify before you trust: the official contract is <a href=\"https://bscscan.com/address/0x47751df28f9c62faebbfadf191439495f1bff70e\">0x47751df28f9c62faebbfadf191439495f1bff70e on BscScan</a> (source verified, deployed 18 Nov 2026), and the Agent ID contract is <a href=\"https://bscscan.com/address/0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F\">0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F on BscScan</a> (SPACE ID Agent ID). The code is open source at <a href=\"https://github.com/IAN4JPG/agentboard\">github.com/IAN4JPG/agentboard</a>.",
      "sec6.never": "This site never asks for your seed phrase, private key, or pairing code. Every transaction waits for your explicit confirmation in your own wallet: always read what your wallet shows (contract address, function, amount) before you confirm.",
      "sec6.clone": "Beware of copies: only use this page at ian4jpg.github.io/agentboard. A lookalike page can point the contract field at a fake contract. If the address above is not the official one, this page shows a warning: stop and check it on BscScan first.",
      "detail.copyLink": "Copy link to this bounty",
      "detail.close": "Close",
      "prev.title": "Transaction preview",
      "prev.intro": "Check everything below before confirming. The transaction is only sent when you press Confirm, and it still waits for your confirmation in your wallet.",
      "prev.confirm": "Confirm and send",
      "prev.cancel": "Cancel",
      "footer.text": "AgentBoard &middot; a micro-bounty board for Agent ID holders &middot; contract verified on BscScan"
    },
    id: {
      "meta.title": "AgentBoard, papan bounty kecil untuk pemilik Agent ID",
      "theme.toggle": "Mode gelap",
      "hero.lead": "Papan bounty kecil on chain untuk pemilik Agent ID. Requester mengunci dana di escrow kontrak. Hanya pemilik Agent ID yang bisa membuat dan mengerjakan bounty. Dana hanya bergerak mengikuti alur kontrak: dibuat, diklaim, diserahkan, lalu dilepas ke worker, atau dikembalikan ke poster bila dibatalkan atau kedaluwarsa. Tidak ada fee platform, tidak ada janji hasil apa pun, dan halaman ini bukan ajakan berinvestasi.",
      "hero.ctaList": "Lihat daftar bounty",
      "hero.ctaCreate": "Buat bounty baru",
      "hero.chipFees": "<b>Tanpa fee</b> platform",
      "hero.chipOwner": "<b>Tanpa owner</b>",
      "hero.chipRep": "Reputasi tercatat <b>on chain</b>",
      "dash.title": "Dashboard",
      "dash.total": "Total bounty",
      "dash.open": "Open sekarang",
      "dash.completed": "Selesai",
      "dash.escrowBnb": "Escrow terkunci (BNB)",
      "dash.escrowUsdc": "Escrow terkunci (USDC)",
      "dash.topWorker": "Top worker",
      "dash.note": "Angka escrow dihitung dari bounty yang masih terbuka (Open, Claimed, Submitted). BNB dan USDC dihitung terpisah karena satuannya berbeda.",
      "dash.srcLabel": "Sumber: kontrak resmi, dibaca langsung dari chain. Diperbarui: ",
      "sec1.title": "1. Jaringan dan alamat kontrak",
      "sec1.intro": "Halaman ini statis, tanpa server, tanpa akun, tanpa penyimpanan sesi. Semua transaksi ditulis lewat wallet kamu sendiri dan selalu menunggu konfirmasi eksplisit dari kamu di wallet itu. Kami tidak pernah meminta seed phrase, private key, atau kode pairing apa pun.",
      "sec1.label": "Alamat kontrak AgentBoard",
      "sec1.note": "Terisi otomatis dengan kontrak AgentBoard yang sudah live di BSC mainnet (deploy 18 Nov 2026, source terverifikasi di BscScan). Daftar bounty hanya bisa dibaca setelah alamat kontrak diisi. Kontrak Agent ID yang dipakai: <span class=\"mono\">0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F</span> (SPACE ID Agent ID, BSC mainnet).",
      "sec1.chainActive": "Chain aktif:",
      "sec1.chainWarn": "Perhatian: chain yang aktif bukan BSC mainnet (56), BSC testnet (97), atau Anvil lokal (31337). Periksa jaringan di wallet kamu sebelum mengirim transaksi apa pun.",
      "sec1.testnetLabel": "Mode testnet (chain 97/31337, kontrak lain)",
      "sec1.testnetNote": "Mati secara default. Write di mainnet wajib chain 56 dan alamat kontrak resmi.",
      "sec1.btnLoad": "Muat daftar bounty",
      "sec2.title": "2. Wallet dan status Agent ID",
      "sec2.status": "Belum terhubung. Daftar bounty tetap bisa dibaca tanpa connect, selama alamat kontrak di atas sudah diisi.",
      "sec2.warn": "Kamu belum memegang Agent ID di alamat ini. Membuat bounty dan mengklaim bounty butuh Agent ID. Kamu tetap bisa membaca daftar bounty dan melihat reputasi alamat lain.",
      "sec3.title": "3. Buat bounty baru",
      "sec3.intro": "Dana langsung terkunci di escrow kontrak saat bounty dibuat. Bila bounty dibatalkan selagi masih Open, dana kembali penuh ke kamu. Bila sudah diklaim lalu melewati deadline tanpa ada penyerahan, siapa pun bisa memicu pengembalian dana ke kamu. Bila hasil sudah diserahkan dan kamu diam selama 3 hari, worker bisa mengklaim dana itu sendiri lewat kontrak.",
      "sec3.tplIntro": "Mulai dari template sekali klik:",
      "sec3.tplBug": "Bug fix",
      "sec3.tplReview": "Code review",
      "sec3.tplDesign": "Design tweak",
      "sec3.tplDocs": "Docs",
      "sec3.tplTest": "Test",
      "sec3.tplFeature": "Small feature",
      "sec3.titleLabel": "Judul",
      "sec3.titlePh": "Contoh: Perbaiki bug di halaman profil",
      "sec3.descLabel": "Deskripsi",
      "sec3.descPh": "Jelaskan apa yang harus dikerjakan dan bagaimana hasil dinilai",
      "sec3.tokenLabel": "Token pembayaran",
      "sec3.optUsdc": "USDC di BSC (0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d, 6 desimal)",
      "sec3.limits": "Batas kontrak v1, baca sebelum mengunci dana: (1) Tidak ada jalur reject/dispute. Begitu hasil diserahkan, poster hanya bisa melepas dana atau diam 3 hari lalu worker mengklaim timeout. (2) Submit setelah deadline tetap sah di kontrak dan memblokir refund. Panggil refundExpired segera setelah deadline lewat bila belum ada submit. (3) Bila worker adalah kontrak yang menolak terima dana, release dan claimTimeout bisa gagal dan bounty macet di Submitted.",
      "sec3.amountLabel": "Jumlah",
      "sec3.amountPh": "Contoh: 0.01 untuk BNB, 10 untuk USDC",
      "sec3.deadlineLabel": "Deadline",
      "sec3.btnApprove": "Approve token dulu",
      "sec3.btnCreate": "Buat bounty dan kunci dana di escrow",
      "sec3.allowLabel": "Allowance saat ini untuk kontrak ini:",
      "sec3.btnRevoke": "Revoke allowance (set ke 0)",
      "sec4.title": "4. Daftar bounty",
      "sec4.intro": "Dibaca langsung dari kontrak. Status: Open, Claimed, Submitted, Completed, Cancelled, Expired. Klik bounty untuk membuka panel detailnya.",
      "sec4.searchPh": "Cari judul atau deskripsi...",
      "sec4.statusAll": "Semua status",
      "sec4.statusOpen": "Open",
      "sec4.statusClaimed": "Claimed",
      "sec4.statusSubmitted": "Submitted",
      "sec4.statusCompleted": "Completed",
      "sec4.statusCancelled": "Cancelled",
      "sec4.statusExpired": "Expired",
      "sec4.tokenAll": "Semua token",
      "sec4.tokenBnb": "BNB",
      "sec4.tokenUsdc": "USDC",
      "sec4.tokenOther": "Token lain",
      "sec4.addrPh": "Alamat poster atau worker (0x...)",
      "sec4.sortNewest": "Terbaru dulu",
      "sec4.sortOldest": "Terlama dulu",
      "sec4.sortDeadline": "Deadline (paling dekat)",
      "sec4.sortAmount": "Jumlah (satuan mentah)",
      "sec4.minePosted": "Dibuat oleh saya",
      "sec4.mineClaimed": "Diklaim oleh saya",
      "sec4.clearFilters": "Hapus filter",
      "sec4.btnRefresh": "Refresh daftar",
      "sec4.empty": "Belum ada data. Isi alamat kontrak lalu tekan \"Muat daftar bounty\".",
      "sec4.prevPage": "Sebelumnya",
      "sec4.nextPage": "Berikutnya",
      "secAct.title": "Activity feed",
      "secAct.intro": "Event on chain terbaru dari kontrak, yang terbaru dulu. Tiap item terhubung ke BscScan.",
      "secAct.updatedLabel": "Sumber: event kontrak resmi dari blok deployment. Diperbarui: ",
      "secAct.btnRefresh": "Refresh aktivitas",
      "secAct.empty": "Belum ada aktivitas yang dimuat.",
      "secLead.title": "Leaderboard",
      "secLead.intro": "Top 10 worker berdasarkan bounty selesai. Jumlah earned ditampilkan per token (BNB dan USDC terpisah) karena kontrak mencampur satuan token di totalnya sendiri. Badge adalah catatan histori on chain saja, bukan jaminan kualitas atau hasil.",
      "secLead.updatedLabel": "Sumber: pembayaran terkonfirmasi di kontrak resmi. Diperbarui: ",
      "secLead.empty": "Belum ada bounty yang selesai.",
      "sec5.title": "5. Reputasi alamat",
      "sec5.intro": "Reputasi tercatat on chain per alamat worker dan terikat pada alamat pemilik Agent ID. Angka ini hanya menghitung bounty yang selesai lewat kontrak ini. Badge adalah catatan histori on chain saja, bukan jaminan kualitas atau hasil.",
      "sec5.label": "Alamat yang dicek",
      "sec5.ph": "0x... alamat worker atau poster",
      "sec5.btnRep": "Lihat reputasi",
      "sec1.addrWarn": "Perhatian: ini bukan alamat kontrak resmi AgentBoard (0x47751df28f9c62faebbfadf191439495f1bff70e). Lanjut hanya kalau kamu tahu persis yang kamu lakukan: kontrak lain bisa berperilaku berbeda dan bisa mengambil dana yang kamu kunci. Verifikasi alamat resmi di BscScan.",
      "secLive.title": "Pemeriksaan keamanan live",
      "secLive.intro": "Dicek langsung di browser kamu setiap kali halaman dimuat dan sebelum setiap transaksi. Item merah artinya: berhenti dan verifikasi dulu sebelum lanjut.",
      "secLive.checkAddr": "Alamat kontrak adalah alamat resmi AgentBoard",
      "secLive.checkChain": "Wallet ada di BSC mainnet (chain 56)",
      "secLive.checkHost": "Halaman ini disajikan dari ian4jpg.github.io",
      "secLive.checkSri": "Library ethers dimuat dengan pemeriksaan integrity",
      "secLive.escrowTitle": "Kesehatan escrow",
      "secLive.bnbBal": "Saldo BNB kontrak",
      "secLive.usdcBal": "Saldo USDC kontrak",
      "secLive.bnbOpen": "BNB terkunci di bounty terbuka",
      "secLive.usdcOpen": "USDC terkunci di bounty terbuka",
      "secLive.statusPending": "Kesehatan escrow belum dicek. Muat daftar bounty dulu.",
      "sec6.title": "6. Keamanan",
      "sec6.intro": "AgentBoard tidak punya owner, tidak ada tombol pause, tidak bisa diupgrade, dan tidak ada fee platform. Kontrak hanya menggerakkan dana escrow mengikuti alur yang disetujui pengguna yang terlibat: release ke worker setelah penyerahan, refund ke poster saat batal atau kedaluwarsa, atau klaim timeout oleh worker setelah poster diam 3 hari. Tidak ada cara bagi siapa pun, termasuk deployer, untuk mengambil dana dari escrow di luar alur itu.",
      "sec6.verify": "Verifikasi sebelum percaya: kontrak resmi ada di <a href=\"https://bscscan.com/address/0x47751df28f9c62faebbfadf191439495f1bff70e\">0x47751df28f9c62faebbfadf191439495f1bff70e di BscScan</a> (source terverifikasi, deploy 18 Nov 2026), dan kontrak Agent ID ada di <a href=\"https://bscscan.com/address/0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F\">0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F di BscScan</a> (SPACE ID Agent ID). Kodenya open source di <a href=\"https://github.com/IAN4JPG/agentboard\">github.com/IAN4JPG/agentboard</a>.",
      "sec6.never": "Situs ini tidak pernah meminta seed phrase, private key, atau kode pairing. Setiap transaksi selalu menunggu konfirmasi eksplisit dari kamu di wallet kamu sendiri: selalu baca apa yang ditampilkan wallet kamu (alamat kontrak, fungsi, jumlah) sebelum menekan confirm.",
      "sec6.clone": "Waspada situs tiruan: pakai halaman ini hanya di ian4jpg.github.io/agentboard. Halaman tiruan bisa mengarahkan field kontrak ke kontrak palsu. Kalau alamat di atas bukan alamat resmi, halaman ini menampilkan peringatan: berhenti dan cek dulu di BscScan.",
      "detail.copyLink": "Salin link bounty ini",
      "detail.close": "Tutup",
      "prev.title": "Preview transaksi",
      "prev.intro": "Periksa semua di bawah ini sebelum konfirmasi. Transaksi hanya dikirim saat kamu menekan Confirm, dan tetap menunggu konfirmasi kamu di wallet.",
      "prev.confirm": "Confirm dan kirim",
      "prev.cancel": "Batal",
      "footer.text": "AgentBoard &middot; papan bounty kecil untuk pemilik Agent ID &middot; kontrak terverifikasi di BscScan"
    }
  };

  /* [english, indonesian] pairs for strings app.js writes into the DOM.
     Applied as plain substring replacement, longest first, only inside the
     watched containers below. Order in the array is irrelevant: sorted by
     length at runtime so longer phrases win over their substrings. */
  var PAIRS = [
    ["Klaim bounty", "Claim bounty"],
    ["Submit hasil kerja", "Submit work"],
    ["Release pembayaran ke worker", "Release payment to worker"],
    ["Batalkan bounty (refund penuh)", "Cancel bounty (full refund)"],
    ["Refund expired (deadline lewat)", "Refund expired (deadline passed)"],
    ["Klaim timeout (poster diam 3 hari)", "Claim timeout (poster silent for 3 days)"],
    [" Klaim butuh Agent ID.", " Claiming requires an Agent ID."],
    ["Bukti kerja: tautan atau teks (contoh: ipfs://... atau URL hasil kerja)", "Proof of work: link or text (e.g. ipfs://... or a URL to your work)"],
    ["Hadiah: ", "Reward: "],
    [" (sudah lewat)", " (passed)"],
    ["Bukti kerja: ", "Proof of work: "],
    [" (satuan mentah di chain)", " (raw on-chain units)"],
    [", satuan mentah di chain)", ", raw on-chain units)"],
    ["(satuan mentah)", "(raw units)"],
    ["Belum ada bounty di kontrak ini.", "No bounties on this contract yet."],
    ["Memuat dari kontrak...", "Loading from the contract..."],
    ["Memuat aktivitas...", "Loading activity..."],
    ["Gagal membaca kontrak: ", "Failed to read the contract: "],
    ["Gagal membaca aktivitas: ", "Failed to read activity: "],
    ["Gagal memuat detail bounty: ", "Failed to load bounty detail: "],
    ["belum terhubung", "not connected"],
    ["Anvil lokal", "local Anvil"],
    ["chain tidak dikenal (", "unknown chain ("],
    ["Status Agent ID belum bisa dicek: ", "Agent ID status could not be checked: "],
    ["Alamat tidak valid.", "Invalid address."],
    ["Gagal membaca reputasi: ", "Failed to read reputation: "],
    ["Isi dulu alamat kontrak AgentBoard di bagian 1.", "Fill in the AgentBoard contract address in section 1 first."],
    ["Allowance sudah cukup (", "Allowance is sufficient ("],
    ["Kontrak belum diizinkan menarik token kamu. Allowance saat ini ", "The contract is not yet allowed to pull your tokens. Current allowance "],
    [", sedangkan bounty butuh ", ", while the bounty needs "],
    [". Tekan tombol approve di bawah: itu transaksi terpisah yang juga menunggu konfirmasi kamu di wallet, dan hanya mengizinkan tepat sebesar jumlah bounty ini, bukan tanpa batas.", ". Press the approve button below: it is a separate transaction that also waits for your confirmation in the wallet, and it only allows exactly this bounty's amount, not an unlimited amount."],
    [" dari wallet kamu.", " from your wallet."],
    ["Siap.", "Ready."],
    ["Template diterapkan.", "Template applied."],
    ["Link bounty disalin.", "Bounty link copied."],
    ["Tautan tidak bisa disalin otomatis, salin manual dari address bar.", "Could not copy the link automatically, copy it manually from the address bar."],
    ["Judul wajib diisi.", "Title is required."],
    ["Deskripsi wajib diisi.", "Description is required."],
    ["Jumlah harus lebih dari 0.", "Amount must be greater than 0."],
    ["Deadline wajib diisi.", "Deadline is required."],
    ["Deadline harus di masa depan.", "Deadline must be in the future."],
    ["Deadline maksimal 60 hari dari sekarang.", "Deadline must be at most 60 days from now."],
    ["Alamat token ERC20 tidak valid.", "Invalid ERC20 token address."],
    ["Alamat kontrak AgentBoard belum diisi atau tidak valid.", "AgentBoard contract address is empty or invalid."],
    ["Hubungkan wallet dulu.", "Connect your wallet first."],
    ["Alamat ini belum memegang Agent ID. Membuat bounty butuh Agent ID.", "This address does not hold an Agent ID. Creating a bounty requires an Agent ID."],
    ["Allowance token belum cukup. Tekan tombol approve dulu, lalu buat bounty.", "Token allowance is not enough yet. Press the approve button first, then create the bounty."],
    ["Isi dulu bukti kerja.", "Fill in the proof of work first."],
    ["Chain tidak didukung untuk transaksi. Pindah ke BSC mainnet dulu.", "Chain not supported for transactions. Switch to BSC mainnet first."],
    ["Kontrak tidak ditemukan di alamat ini pada chain yang aktif.", "No contract found at this address on the active chain."],
    ["Simulasi transaksi gagal (kemungkinan revert): ", "Transaction simulation failed (likely revert): "],
    ["Estimasi gas gagal: ", "Gas estimation failed: "],
    ["Transaksi dibatalkan.", "Transaction cancelled."],
    ["Connect wallet gagal: ", "Connect wallet failed: "],
    ["Aktivitas tidak tersedia (RPC menolak rentang blok).", "Activity unavailable (the RPC rejected the block range)."],
    ["Tidak ada bounty yang cocok dengan filter.", "No bounties match the filters."],
    ["Tidak ada aktivitas.", "No activity found."],
    ["Tidak ada riwayat.", "No history available."],
    ["Detail bounty tidak ditemukan.", "Bounty detail not found."],
    ["Approve gagal atau dibatalkan: ", "Approve failed or was cancelled: "],
    ["Revoke allowance gagal atau dibatalkan: ", "Revoke allowance failed or was cancelled: "],
    ["Poster: ", "Poster: "],
    ["Worker: ", "Worker: "],
    ["Status: ", "Status: "],
    ["Deadline: ", "Deadline: "],
    ["Sisa waktu: ", "Time left: "],
    ["Batas klaim timeout: ", "Timeout claim deadline: "],
    ["Riwayat", "History"],
    ["Dibuat", "Created"],
    ["Diklaim", "Claimed"],
    ["Diserahkan", "Submitted"],
    ["Dibayar ke worker", "Paid to worker"],
    ["Dibatalkan", "Cancelled"],
    ["Kedaluwarsa", "Expired"],
    ["Diklaim via timeout", "Claimed via timeout"],
    ["Bounty dibuat", "Bounty created"],
    ["Bounty diklaim", "Bounty claimed"],
    ["Hasil diserahkan", "Work submitted"],
    ["Pembayaran dilepas", "Payment released"],
    ["Bounty dibatalkan", "Bounty cancelled"],
    ["Bounty kedaluwarsa", "Bounty expired"],
    ["Timeout diklaim", "Timeout claimed"],
    [" oleh ", " by "],
    ["Escrow fully backed: saldo kontrak menutupi semua dana bounty yang masih terbuka.", "Escrow fully backed: the contract balance covers all funds in open bounties."],
    ["PERHATIAN: saldo kontrak kurang dari dana bounty yang masih terbuka. Jangan buat bounty baru sebelum ini diperiksa.", "WARNING: the contract balance is lower than the funds in open bounties. Do not create new bounties until this is checked."],
    ["Kesehatan escrow belum bisa dicek: ", "Escrow health could not be checked: "],
    ["Fungsi: ", "Function: "],
    ["Argumen: ", "Arguments: "],
    ["Nilai: ", "Value: "],
    ["Estimasi gas: ", "Estimated gas: "],
    ["Perkiraan biaya: ", "Estimated fee: "],
    ["Belum ada", "None yet"],
    ["Mode terang", "Light mode"],
    ["Mode gelap", "Dark mode"],
    ["GAGAL", "FAIL"],
    ["Halaman ", "Page "],
    [" dari ", " of "]
  ];
  ["Batas kontrak v1: tidak ada jalur reject. Submit telat memblokir refund. Payout ke kontrak yang menolak dana bisa gagal.", "v1 contract limits: no reject path. Late submit blocks refunds. Payouts to a contract that rejects funds can fail."],
  ["Deadline sudah lewat, submit dinonaktifkan di UI (panggilan langsung ke kontrak tetap bisa).", "Deadline has passed; submit is disabled in the UI (direct contract calls are still possible)."],
  ["Perhatian: worker adalah alamat kontrak. Bila kontrak itu menolak terima dana, payout bisa gagal.", "Warning: the worker is a contract address. If that contract refuses incoming funds, the payout can fail."],
  ["Metadata token tidak bisa dibaca. Token ditolak.", "Token metadata could not be read. Token rejected."],
  ["Token tidak ada di allowlist (hanya BNB dan USDC).", "Token is not on the allowlist (only BNB and USDC)."],
  ["Alamat kontrak harus alamat resmi AgentBoard untuk transaksi di mainnet.", "The contract address must be the official AgentBoard address for mainnet transactions."],
  ["Kontrak memakai Agent ID yang berbeda dari yang resmi.", "The contract uses a different Agent ID than the official one."],
  ["Mode testnet aktif: write diizinkan di chain 97/31337 dengan alamat kontrak lain.", "Testnet mode on: writes are allowed on chains 97/31337 with another contract address."],
  [" (metadata tidak terbaca)", " (metadata unreadable)"],
  ["Alamat kontrak bukan alamat resmi. Write diblokir di mainnet.", "The contract address is not the official one. Writes are blocked on mainnet."],
  ["Chain bukan BSC mainnet (56). Write diblokir.", "Chain is not BSC mainnet (56). Writes are blocked."],
  PAIRS.sort(function (a, b) { return b[0].length - a[0].length; });

  /* Templates with numbers/addresses: [idPattern, idTemplate, enPattern, enTemplate] */
  var TEMPLATES = [
    [/^Agent ID: YA\. Alamat ini memegang Agent ID \(balanceOf = (\d+)\)\. Kamu bisa membuat dan mengklaim bounty\.$/,
     "Agent ID: YA. Alamat ini memegang Agent ID (balanceOf = $1). Kamu bisa membuat dan mengklaim bounty.",
     /^Agent ID: YES\. This address holds an Agent ID \(balanceOf = (\d+)\)\. You can create and claim bounties\.$/,
     "Agent ID: YES. This address holds an Agent ID (balanceOf = $1). You can create and claim bounties."],
    [/^Agent ID: TIDAK\. Alamat ini belum memegang Agent ID \(balanceOf = (\d+)\)\.$/,
     "Agent ID: TIDAK. Alamat ini belum memegang Agent ID (balanceOf = $1).",
     /^Agent ID: NO\. This address does not hold an Agent ID yet \(balanceOf = (\d+)\)\.$/,
     "Agent ID: NO. This address does not hold an Agent ID yet (balanceOf = $1)."],
    [/^Reputasi kamu di kontrak ini: (\d+) bounty selesai, total earned mentah (\d+) \(tercampur bila bounty memakai token berbeda\), (\d+) klaim aktif\.$/,
     "Reputasi kamu di kontrak ini: $1 bounty selesai, total earned mentah $2 (tercampur bila bounty memakai token berbeda), $3 klaim aktif.",
     /^Your reputation on this contract: (\d+) bounties completed, total raw earned (\d+) \(mixed if bounties use different tokens\), (\d+) active claims\.$/,
     "Your reputation on this contract: $1 bounties completed, total raw earned $2 (mixed if bounties use different tokens), $3 active claims."],
    [/^Alamat (\S+): memegang Agent ID: (ya \(\d+\)|tidak)\. Bounty selesai: (\d+)\. Total earned \(satuan mentah, tercampur bila bounty memakai token berbeda\): (\d+)\. Klaim aktif: (\d+)\.$/,
     "Alamat $1: memegang Agent ID: $2. Bounty selesai: $3. Total earned (satuan mentah, tercampur bila bounty memakai token berbeda): $4. Klaim aktif: $5.",
     /^Address (\S+): holds an Agent ID: (yes \(\d+\)|no)\. Bounties completed: (\d+)\. Total earned \(raw units, mixed if bounties use different tokens\): (\d+)\. Active claims: (\d+)\.$/,
     "Address $1: holds an Agent ID: $2. Bounties completed: $3. Total earned (raw units, mixed if bounties use different tokens): $4. Active claims: $5."],
    [/^BNB sebesar (\S+) (\S+) akan dikunci di escrow saat transaksi dikonfirmasi di wallet kamu\.$/,
     "BNB sebesar $1 $2 akan dikunci di escrow saat transaksi dikonfirmasi di wallet kamu.",
     /^BNB of (\S+) (\S+) will be locked in escrow when the transaction is confirmed in your wallet\.$/,
     "BNB of $1 $2 will be locked in escrow when the transaction is confirmed in your wallet."],
    [/^(\d+) bounty selesai$/,
     "$1 bounty selesai",
     /^(\d+) bounties completed$/,
     "$1 bounties completed"]
  ];

  var lang = "en";
  try {
    var saved = window.localStorage.getItem(LANG_KEY);
    if (saved === "id" || saved === "en") lang = saved;
  } catch (e) { /* storage unavailable: stay on English default */ }

  function applyDynToString(s, target) {
    if (!s) return s;
    var out = s;
    var i, m;
    /* templates first (whole-string matches) */
    for (i = 0; i < TEMPLATES.length; i++) {
      var t = TEMPLATES[i];
      if (target === "en") {
        m = out.match(t[0]);
        if (m) {
          var rep = t[3];
          if (t === TEMPLATES[3]) {
            /* $2 is "ya (N)" or "tidak": map to English */
            rep = rep.replace("$2", m[2] === "tidak" ? "no" : "yes (" + m[2].slice(4, -1) + ")");
          }
          out = out.replace(t[0], rep.replace(/\$(\d)/g, function (_, n) { return m[+n] || ""; }));
          if (t === TEMPLATES[3]) out = out.replace(/\$2/g, "");
        }
      } else {
        m = out.match(t[2]);
        if (m) {
          var repId = t[1];
          if (t === TEMPLATES[3]) {
            repId = repId.replace("$2", m[2] === "no" ? "tidak" : "ya (" + m[2].slice(4, -1) + ")");
          }
          out = out.replace(t[2], repId.replace(/\$(\d)/g, function (_, n) { return m[+n] || ""; }));
          if (t === TEMPLATES[3]) out = out.replace(/\$2/g, "");
        }
      }
    }
    /* plain pairs: replace the other language's phrase with the target's */
    for (i = 0; i < PAIRS.length; i++) {
      var from = target === "en" ? PAIRS[i][0] : PAIRS[i][1];
      var to = target === "en" ? PAIRS[i][1] : PAIRS[i][0];
      if (out.indexOf(from) !== -1) out = out.split(from).join(to);
    }
    return out;
  }

  /* Skip user-entered content: bounty titles (strong inside the title div
     of a .bounty card) and bounty descriptions (the plain <p> inside
     .bounty), plus any subtree marked data-user="1" (detail modal user
     text). Everything else in the watched containers is app.js UI copy. */
  function isUserContent(node) {
    var p = node.parentNode;
    if (!p) return false;
    if (p.tagName === "STRONG" && p.parentNode && p.parentNode.parentNode &&
        p.parentNode.parentNode.className === "bounty") return true;
    if (p.tagName === "P" && p.parentNode && p.parentNode.className === "bounty" && p.className !== "muted") return true;
    return false;
  }

  function hasUserAttr(node) {
    var p = node.parentNode;
    while (p) {
      if (p.nodeType === 1 && p.getAttribute && p.getAttribute("data-user") === "1") return true;
      p = p.parentNode;
    }
    return false;
  }

  function translateNode(node, target) {
    if (node.nodeType === 3) {
      if (isUserContent(node) || hasUserAttr(node)) return;
      var next = applyDynToString(node.nodeValue, target);
      if (next !== node.nodeValue) node.nodeValue = next;
    } else if (node.nodeType === 1) {
      if (node.tagName === "INPUT" && node.placeholder) {
        var ph = applyDynToString(node.placeholder, target);
        if (ph !== node.placeholder) node.placeholder = ph;
      }
      if (node.tagName === "SCRIPT" || node.tagName === "STYLE") return;
      var kids = node.childNodes;
      for (var i = 0; i < kids.length; i++) translateNode(kids[i], target);
    }
  }

  var WATCH_IDS = ["bountyList", "agentIdStatus", "myStats", "chainInfo", "createHint", "repResult", "approveBox", "agentIdWarn", "chainWarn", "toastWrap", "detailBody", "previewBody", "activityList", "leaderList", "dashTopWorkerSub", "escrowStatus", "pageInfo", "themeToggle"];
  function translateDynamic(target) {
    WATCH_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) translateNode(el, target);
    });
    /* #log: only translate the leading "Siap." / "Ready." marker, never the
       appended event lines. */
    var log = document.getElementById("log");
    if (log) {
      var txt = log.textContent;
      if (target === "en" && txt.indexOf("Siap.") === 0) log.textContent = "Ready." + txt.slice(5);
      if (target === "id" && txt.indexOf("Ready.") === 0) log.textContent = "Siap." + txt.slice(6);
    }
  }

  function norm(s) { return s.replace(/\s+/g, " ").trim(); }
  /* Only overwrite a data-i18n element with the static dictionary text when
     it still holds a static value. Elements app.js also writes to
     (#agentIdStatus, #agentIdWarn, #chainWarn) keep their dynamic content;
     translateDynamic() below translates that content instead. */
  function isStaticText(el, key) {
    var cur = norm(el.textContent);
    return cur === norm(I18N.en[key]) || cur === norm(I18N.id[key]);
  }

  function applyLang(target) {
    lang = target;
    document.documentElement.lang = target;
    var dict = I18N[target];
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var v = dict[key];
      if (v !== undefined && isStaticText(el, key) && el.textContent !== v) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var v = dict[el.getAttribute("data-i18n-html")];
      if (v !== undefined && el.innerHTML !== v) el.innerHTML = v;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      var v = dict[el.getAttribute("data-i18n-ph")];
      if (v !== undefined && el.placeholder !== v) el.placeholder = v;
    });
    document.getElementById("langEn").classList.toggle("active", target === "en");
    document.getElementById("langId").classList.toggle("active", target === "id");
    translateDynamic(target);
  }

  function setLang(target) {
    try { window.localStorage.setItem(LANG_KEY, target); } catch (e) { /* ignore */ }
    applyLang(target);
  }

  document.getElementById("langEn").addEventListener("click", function () { setLang("en"); });
  document.getElementById("langId").addEventListener("click", function () { setLang("id"); });

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.type === "characterData") {
        translateNode(m.target, lang);
      } else {
        m.addedNodes.forEach(function (n) { translateNode(n, lang); });
      }
    });
  });
  WATCH_IDS.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) observer.observe(el, { childList: true, subtree: true, characterData: true });
  });

  applyLang(lang);
})();
