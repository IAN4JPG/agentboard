# AgentBoard — Materi Submit (Binance Agent ID Hackathon)

Status: **DEPLOYED + TERVERIFIKASI di BSC mainnet 18 Nov 2026 ~20:52 WIB.** Kontrak
0x47751df28f9c62faebbfadf191439495f1bff70e, tx deploy
0x0bf3127c02af163fb8eaea5841224d8bd59c09bd2df23c35aa258c40e524c404, deployer
MetaMask Airdrop Wallet 0xb62a40449Df2E405d47e81cc58f11bcf34DAcDc1, gas
1.690.048 @ 0,05 gwei (fee 0,0000845024 BNB, sekitar 0,05 USD), block 134322190.
Source terverifikasi di BscScan ("Exact Match", compiler 0.8.28+commit.7893614a,
optimizer 200 runs, MIT). agentId() dibaca balik = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F (benar).
Top-up deployer dari wallet Agentic sebelum deploy: 0,05 USD + 0,10 USD (total
0,15 USD). Saldo deployer setelah deploy sekitar 0,0003153 BNB. Sisa sebelum
submit: hosting frontend + 30 alamat Agent ID berinteraksi + pengajuan proyek.

## Proyek

- **Nama:** AgentBoard
- **Deskripsi singkat:** Papan bounty kecil on-chain: requester mengunci dana (BNB
  atau ERC20) di escrow; hanya pemilik Agent ID yang bisa klaim dan mengerjakan
  bounty; requester melepas dana setelah hasil diserahkan; reputasi per Agent ID
  tercatat on-chain.
- **Website:** `https://ian4jpg.github.io/agentboard/` (GitHub Pages, folder `docs/`)
  — BELUM LIVE. Repo GitHub `agentboard` belum bisa dibuat lewat konektor
  (GitHub App tidak boleh membuat repo, error 403) dan Pages tidak bisa
  diaktifkan lewat API. Butuh user membuat repo publik kosong `agentboard` di
  github.com lalu memberi akses ke Muse GitHub App; setelah itu Miku push dan
  Pages diaktifkan (Settings → Pages → main branch, folder `/docs`).
  Alternatif satu langkah: repo `IAN4JPG.github.io` (otomatis terbit).
  Token Cloudflare yang ada hanya berhak atas Workers AI (probe 18 Nov: 403),
  jadi Cloudflare Pages tidak bisa dipakai dengan kredensial ini.
- **Repo:** `https://github.com/IAN4JPG/agentboard` (BELUM DIBUAT — sama seperti
  di atas; isi repo sudah siap di `~/workspace/binance-agentid-hackathon/`,
  manifest push 18 file sudah disiapkan).
- **Kontrak:** `contracts/AgentBoard.sol`, Solidity ^0.8.28, single file, tanpa
  import, tanpa owner, tanpa fee platform.

## Alamat kontrak

| Jaringan | Alamat | Status |
| --- | --- | --- |
| BSC mainnet (56) | `0x47751df28f9c62faebbfadf191439495f1bff70e` | LIVE, source terverifikasi di BscScan (Exact Match), agentId() benar |
| BSC testnet (97) | — | BELUM DEPLOY, alamat Agent ID testnet belum terverifikasi (lihat Deploy.s.sol) |
| Anvil lokal (31337) | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` | Terbukti jalan (e2e 41 PASS) |

## Deskripsi penggunaan Agent ID

Agent ID adalah gerbang dan identitas di seluruh alur inti produk, bukan tempelan:

1. **Access control on-chain.** `createBounty`, `claimBounty`, dan semua aksi tulis
   memeriksa `balanceOf(msg.sender) > 0` pada kontrak Agent ID
   (`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`). Alamat tanpa Agent ID tidak bisa
   memasang bounty, mengklaim, menyerahkan hasil, atau menerima pembayaran.
2. **Identitas + reputasi.** Setiap bounty mencatat alamat worker pemilik Agent ID.
   `agentStats` mencatat per alamat: jumlah bounty selesai (`completed`) dan total
   dana yang diterima (`earned`). Karena Agent ID non-transferable, 1 alamat = 1
   Agent ID secara efektif, jadi reputasi ini adalah reputasi Agent ID tersebut.
3. **Pembayaran.** Escrow membayar langsung ke alamat worker pemilik Agent ID saat
   `releasePayment` (oleh poster) atau `claimTimeout` (oleh worker bila poster diam
   3 hari setelah submit). Tidak ada perantara.
4. **Frontend menampilkan status Agent ID** (cek ganda: `hasAgentId` di kontrak
   kami + `balanceOf` langsung ke kontrak Agent ID) sebelum user bisa beraksi.

## Bukti kualitas

- **Test Foundry: 36/36 PASS** (`forge test`, `test/AgentBoard.t.sol`), termasuk
  gating Agent ID, semua jalur batal (cancel / refundExpired / claimTimeout),
  dan 2 percobaan serangan reentrancy (keduanya gagal, worker dibayar tepat 1x).
- **E2E Anvil: 41 PASS, 0 FAIL** (`frontend/e2e-anvil.mjs`, log di
  `frontend/e2e-anvil.log`): happy path BNB + ERC20 (approve exact amount, bukan
  unlimited), semua jalur batal, semua cek negatif gating UI.
- **Keamanan:** checks-effects-interactions + reentrancy guard di semua fungsi
  pemindah dana; tidak ada `delegatecall`/`selfdestruct`; tidak ada fungsi owner;
  tidak ada fee; tidak ada janji return.
- **Red lines dipatuhi:** tidak ada login QR-code; tidak ada penyimpanan sesi
  (tidak ada server); tidak ada approval unlimited; tidak ada transfer tanpa izin;
  tidak memakai nama/brand Binance/BNB; tidak mengumpulkan kredensial; tidak
  menjanjikan return.

## Kanal submit (status 18 Nov 2026 — BELUM ADA TAUTAN FORMULIR PROYEK)

Riset 18 Nov: pengumuman resmi Binance
(`https://www.binance.com/en/square/post/389517345917641`, dibaca ulang hari
ini) TIDAK memuat tautan formulir pengajuan proyek. Langkah 3 pengumuman hanya
berbunyi: "Submit your project name, website, contract address(es), Agent ID
usage description, and other required materials during the Submission Period.
No registration needed." Pencarian web (3 kali, kata kunci berbeda) tidak
menemukan formulir proyek di sumber resmi lain.

Satu-satunya survei yang tertaut di pengumuman adalah survei promo X:
`https://app.binance.com/uni-qr/user-survey/ff6832f8d2984af289068c9450a3c98c`
("Submit your X link via the official campaign survey"). Miku TIDAK BISA
memuat survei itu dari VM (fetch timeout; tidak diulang). Yang harus dicek
di Chrome user: apakah survei itu hanya untuk promo X, atau juga menerima
pengajuan proyek. Bila pengumuman susulan dari Binance menerbitkan tautan
formulir proyek, pakai tautan itu.

Kesimpulan: pengajuan proyek BELUM BISA dikirim hari ini karena kanal
resminya belum diterbitkan/diketahui. Semua isi pengajuan di bawah sudah
siap tempel begitu formulirnya ada. Tenggat 9 Des 2026 15:00 WIB — pantau
pengumuman Binance dan akun @BinanceWallet / @BNBCHAIN untuk tautan formulir.

## Isi pengajuan (siap tempel)

- **Nama proyek:** AgentBoard
- **Website:** https://ian4jpg.github.io/agentboard/ (GitHub Pages; BELUM LIVE,
  menunggu repo dibuat user — lihat bagian Website di atas)
- **Alamat kontrak (BSC mainnet):** 0x47751df28f9c62faebbfadf191439495f1bff70e
  ([BscScan](https://bscscan.com/address/0x47751df28f9c62faebbfadf191439495f1bff70e),
  source terverifikasi, Exact Match, solc 0.8.28, optimizer 200 runs, MIT)
- **Tx deploy:** 0x0bf3127c02af163fb8eaea5841224d8bd59c09bd2df23c35aa258c40e524c404
- **Repo (open source):** https://github.com/IAN4JPG/agentboard (BELUM DIBUAT —
  sama seperti di atas)
- **Deskripsi pemakaian Agent ID:** Agent ID adalah gerbang dan identitas di
  seluruh alur inti produk, bukan tempelan. `createBounty` dan `claimBounty`
  (serta semua aksi tulis) memeriksa `balanceOf(msg.sender) > 0` pada kontrak
  Agent ID `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` (SPACE ID Agent ID,
  ERC-721, non-transferable); alamat tanpa Agent ID tidak bisa memasang bounty,
  mengklaim, menyerahkan hasil, atau menerima pembayaran. Reputasi worker
  (`completed`, `earned`) tercatat on-chain per alamat dan terikat pada alamat
  pemilik Agent ID (1 alamat = 1 Agent ID secara efektif karena token tidak
  bisa dipindah). Frontend memeriksa status Agent ID dua kali (via kontrak
  kami dan langsung ke kontrak Agent ID) sebelum user bisa beraksi.
- **Deskripsi singkat proyek:** Papan bounty kecil on-chain: requester mengunci
  dana (BNB atau ERC20) di escrow; hanya pemilik Agent ID yang bisa klaim dan
  mengerjakan bounty; requester melepas dana setelah hasil diserahkan; reputasi
  per Agent ID tercatat on-chain. Tanpa fee platform, tanpa owner, tanpa janji
  return.
- **Alamat penerima hadiah (reward receiving address):** BELUM DIPUTUSKAN USER.
  Kandidat: wallet Agentic lactus `0xDd8411f299b1da04D61283a8C2Ffa2790978b923`
  (pemegang Agent ID, direkomendasikan — ini wallet proyek) atau wallet
  MetaMask deployer `0xb62a40449Df2E405d47e81cc58f11bcf34DAcDc1`. User pilih
  satu saat mengisi formulir.
- **Kategori yang dituju:** Agent Application Innovation Award (butuh produk
  live + minimal 30 alamat Agent ID berinteraksi) dan Agent ID Ecosystem
  Pioneer Award (peringkat berdasarkan metrik on-chain).

## Yang masih dibutuhkan sebelum submit

1. ~~Persetujuan user + preview untuk deploy mainnet~~ — SELESAI 18 Nov 20:52 WIB.
2. ~~Deploy + verifikasi source di BscScan.~~ — SELESAI 18 Nov 20:57 WIB.
3. **Hosting frontend (TERHALANG, butuh user):** buat repo publik kosong
   `agentboard` di github.com + beri akses ke Muse GitHub App → Miku push
   (manifest 18 file siap) → aktifkan Pages (main, `/docs`) → live di
   `https://ian4jpg.github.io/agentboard/`. Alternatif satu langkah: repo
   `IAN4JPG.github.io` (otomatis terbit; frontend di root).
4. **Uji end-to-end mainnet (MENUNGGU PERSETUJUAN USER):** rencana lengkap di
   `rencana-uji-mainnet.md`. Fase A (uji poster, 0,001 BNB, dibatalkan +
   refund, biaya bersih sekitar 0,0000158 BNB / 0,009 USD) + Fase B (bounty
   beneran 0,001 BNB untuk worker pemegang Agent ID lain, biaya lactus sekitar
   0,0010184 BNB / 0,60 USD). Saldo lactus 0,002023 BNB hanya cukup untuk
   Fase A + SATU bounty 0,001 BNB. TIDAK ADA eksekusi sebelum user menyetujui
   angka pastinya.
5. **Kanal submit (MENUNGGU TAUTAN RESMI):** formulir proyek belum diterbitkan
   tautannya di pengumuman resmi (lihat bagian Kanal submit). Isi pengajuan
   sudah siap tempel di atas.
6. **30 alamat Agent ID berinteraksi (RENCANA SIAP):** lihat
   `rencana-distribusi.md` + draf di `distribusi/` (draf X, draf Square,
   draf pengumuman komunitas). Posting dilakukan USER. Saat ini 0 alamat
   berinteraksi; bounty dogfood adalah magnet utamanya.

## Tenggat

Submit ditutup **9 Des 2026 15:00 WIB**. Review internal 9–17 Des, review publik
17–20 Des.
