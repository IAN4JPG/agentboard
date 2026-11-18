# AgentBoard — Micro-Bounty Escrow untuk Agent ID

## Ringkasan
Papan bounty kecil on-chain untuk Binance Agent ID Hackathon. Requester mengunci dana
(BNB atau ERC20, mis. USDC) di kontrak escrow. Hanya pemilik Agent ID yang bisa klaim
dan mengerjakan bounty. Requester melepas dana setelah hasil diserahkan. Reputasi per
Agent ID tercatat on-chain. Tanpa fee platform, tanpa owner privileged, tanpa janji
return apa pun.

**Nama proyek: AgentBoard** (orisinil, tidak memakai kata Binance/BNB).

## Fakta hackathon (terverifikasi dari pengumuman resmi 18 Nov 2026)
- Submit: 18 Nov 08:00 UTC – 9 Des 08:00 UTC (15:00 WIB 18 Nov – 15:00 WIB 9 Des 2026).
  Review internal 9–17 Des, review publik 17–20 Des.
- Total 60.000 USDC. Pioneer Award 29.000 (top 10, metrik on-chain: jumlah alamat Agent ID
  yang berinteraksi, volume, jumlah tx). Innovation Award 29.000 (top 10, juri 100 poin:
  kedalaman Agent ID 30%, praktis 25%, kelengkapan 25%, inovasi 20%). 1st 10.000,
  2nd 6.000, 3rd 4.000, 4th 3.000, 5th 2.000, 6–10th 800. Tiap proyek hanya bisa menang
  satu kategori. Pemenang juga dapat spot klaim Agent ID 2 digit.
- Syarat Innovation: produk live + minimal 30 alamat Agent ID berinteraksi selama periode
  submit. Syarat wajib: kontrak deploy di BNB Chain, terverifikasi + open source di
  BscScan, aktif pakai Agent ID.
- Kontrak Agent ID: `0x60b9262456de011f7d15a54cdd8c48baaa8b022f` (SPACE ID Agent ID, ERC-721,
  non-transferable). Cek kepemilikan: `balanceOf(address) > 0`.
- Sumber: https://www.binance.com/en/square/post/389517345917641

## Fakta teknis terverifikasi (18 Nov 2026, via cast ke BSC mainnet)
- `balanceOf(0xDd8411f299b1da04D61283a8C2Ffa2790978b923)` (lactus) = **1**. Agent ID dimiliki.
- `tokenOfOwnerByIndex` **REVERT** — kontrak Agent ID TIDAK implement ERC721Enumerable.
  Konsekuensi: kontrak TIDAK BOLEH memanggil `tokenOfOwnerByIndex`. Reputasi diikat ke
  alamat worker (aman karena token non-transferable, jadi 1 alamat = 1 Agent ID secara
  efektif). Frontend boleh menampilkan nama Agent ID dari sumber off-chain bila ada.
- `name()` = "SPACE ID Agent ID", `symbol()` = "AI".
- Agentic Wallet hanya menandatangani operasi terverifikasi; contract call arbitrer butuh
  Developer Mode (opt-in di Binance App, time-boxed). Frontend kami memakai wallet
  connect standar (MetaMask / Binance Wallet via `window.ethereum`), BUKAN login QR-code
  Agentic Wallet. Semua transaksi butuh konfirmasi eksplisit user di walletnya sendiri.

## Red lines (pelanggaran = diskualifikasi)
- Tidak ada login QR-code Agentic Wallet di web; tidak ada penyimpanan sesi login di server
  (kami tidak punya server sama sekali).
- Tidak ada prompt yang melewati konfirmasi transaksi user.
- Tidak ada transfer tanpa izin, auto-transfer terjadwal, transfer bundel, atau approval
  unlimited tanpa sepengetahuan user. Kontrak hanya memindahkan dana escrow sesuai alur
  yang user setujui per transaksi.
- Kontrak open source, tanpa owner permission tersembunyi. TIDAK ADA fungsi owner sama
  sekali (tidak ada pause, mint, withdraw owner, upgrade).
- Tidak pakai nama/brand Binance/BNB. Tidak kumpulkan seed phrase / private key / API
  secret / pairing code. Tidak janjikan return. Bukan produk trading (tidak perlu
  peringatan risiko trading). Agent ID tidak dikemas sebagai alat cari wallet orang dari nama.

## Arsitektur

### Kontrak: `contracts/AgentBoard.sol` (Solidity ^0.8.28, single file, TANPA import)
Alasan single file: verifikasi BscScan paling mudah, tidak ada dependency yang bisa
rusak. ReentrancyGuard ditulis sendiri (bukan import OpenZeppelin).

```solidity
interface IAgentID { function balanceOf(address) external view returns (uint256); }
interface IERC20 { function transferFrom(address,address,uint256) external returns (bool);
                   function transfer(address,uint256) external returns (bool); }
```

State machine bounty: `Open -> Claimed -> Submitted -> Completed`
Jalur batal: `Open -> Cancelled` (poster, sebelum diklaim), `Claimed -> Expired`
(deadline lewat tanpa submit, refund poster), `Submitted -> Completed` via
`releasePayment` (poster) atau `claimTimeout` (worker, bila poster diam 3 hari
setelah submit).

Fungsi:
- `createBounty(string title, string description, address paymentToken, uint256 amount, uint256 deadline)` payable
  - Hanya pemilik Agent ID (cek `balanceOf(msg.sender) > 0`).
  - `paymentToken == address(0)` berarti BNB: `msg.value` harus == amount.
  - ERC20: `transferFrom` sebesar amount (poster harus approve dulu).
  - `deadline` harus di masa depan. `amount > 0`.
- `claimBounty(uint256 id)` — hanya pemilik Agent ID, bounty Open, belum lewat deadline,
  claimer bukan poster. State -> Claimed, catat worker + claimedAt.
- `submitWork(uint256 id, string proof)` — hanya worker, state Claimed. State -> Submitted,
  simpan proof (teks/URL), catat submittedAt.
- `releasePayment(uint256 id)` — hanya poster, state Submitted. Bayar escrow ke worker,
  state -> Completed, reputasi worker: completed + 1, earned += amount.
- `cancelBounty(uint256 id)` — hanya poster, state Open. Refund penuh ke poster,
  state -> Cancelled.
- `refundExpired(uint256 id)` — siapa pun, state Claimed DAN `block.timestamp > deadline`.
  Refund penuh ke poster, state -> Expired.
- `claimTimeout(uint256 id)` — hanya worker, state Submitted DAN
  `block.timestamp > submittedAt + 3 days`. Bayar escrow ke worker, state -> Completed,
  reputasi sama seperti release.
- View: `getBounty(id)`, `bountyCount()`, `hasAgentId(address)`, `agentStats(address)`
  (completed, earned, claimed aktif), `agentTokenId` TIDAK ADA (kontrak Agent ID tidak
  enumerable, lihat fakta di atas).

Reputasi: `mapping(address => AgentStats)`, `AgentStats { uint256 completed; uint256 earned; }`.
Dana escrow: kontrak hanya memegang dana bounty aktif; tidak ada fungsi penarikan lain.

Keamanan: checks-effects-interactions di semua fungsi yang memindahkan dana, guard
reentrancy sendiri, tidak ada delegatecall/selfdestruct, tidak ada owner.

### Frontend: `frontend/` (HTML + JS statis, ethers v6 via CDN)
- Satu file `index.html` + `app.js`, tanpa build step, tanpa server, tanpa penyimpanan
  sesi. Connect via `window.ethereum` (MetaMask / Binance Wallet).
- Fitur: status Agent ID (cek `balanceOf` alamat yang connect), daftar bounty (baca dari
  kontrak), form buat bounty (BNB / USDC BSC `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`),
  tombol klaim / submit / release / cancel / refund sesuai state dan peran,
  tampilan reputasi per alamat.
- Semua aksi tulis memanggil wallet user dan menunggu konfirmasi eksplisit. Tidak ada
  QR login, tidak ada auto-sign.

### Test: `test/AgentBoard.t.sol` (Foundry)
- Mock: `MockAgentID` (balanceOf bisa diatur per alamat, tokenOfOwnerByIndex TIDAK ADA,
  sama seperti aslinya) + `MockERC20` (mint + approve + transferFrom).
- Cakupan: create BNB + ERC20 + semua revert (tanpa Agent ID, amount 0, deadline lewat,
  value tidak cocok); claim (gate Agent ID, double claim, poster tidak bisa klaim,
  setelah deadline); submit (hanya worker); release (hanya poster, dana sampai ke
  worker, reputasi naik); cancel (hanya Open, refund); refundExpired; claimTimeout
  (sebelum 3 hari revert, sesudah 3 hari bayar); percobaan reentrancy dasar;
  view functions. Target: SEMUA test PASS.

## Alur end-to-end (yang harus terbukti)
1. Poster (Agent ID) buat bounty 0.01 BNB, deadline +7 hari -> dana terkunci.
2. Worker (Agent ID lain) klaim -> state Claimed.
3. Worker submit proof -> state Submitted.
4. Poster release -> worker terima 0.01 BNB, reputasi worker completed=1.
5. Jalur batal: cancel saat Open (refund), refundExpired saat Claimed lewat deadline,
   claimTimeout saat Submitted + 3 hari tanpa release.
Pembuktian lokal: Foundry test + skrip Anvil (rantai lokal) + frontend melawan Anvil.
Deploy BSC testnet butuh wallet testnet berdana — disiapkan skripnya, dieksekusi hanya
bila user menyediakan akses (di luar tugas build ini).

## Materi submit (disiapkan, belum diajukan)
- Nama proyek: AgentBoard. Website: GitHub Pages `https://ian4jpg.github.io/agentboard/`
  (BELUM LIVE — repo `agentboard` belum dibuat user, lihat `submission.md`).
- Alamat kontrak: BSC mainnet `0x47751df28f9c62faebbfadf191439495f1bff70e`
  (DEPLOYED + terverifikasi BscScan 18 Nov 2026, tx
  `0x0bf3127c02af163fb8eaea5841224d8bd59c09bd2df23c35aa258c40e524c404`).
- Deskripsi penggunaan Agent ID: gerbang klaim/buat/submit/release (cek `balanceOf`
  on-chain di kontrak), reputasi terikat alamat pemilik Agent ID.
- Dokumen deployment mainnet: `script/DEPLOY_MAINNET.md` (perintah + estimasi gas).

## Batasan build ini
- JANGAN deploy mainnet, JANGAN eksekusi baw, JANGAN pakai dana apa pun.
- JANGAN kumpulkan data user. JANGAN janjikan return di produk/dokumen.
- Jangan sentuh kredensial, seed, atau private key.
