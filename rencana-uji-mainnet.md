# Rencana Uji End-to-End Mainnet AgentBoard — FASE A SELESAI 18 Nov 2026 21:21 WIB

Status: **FASE A SELESAI + terverifikasi on-chain.** createBounty #0 tx 0x000ff9654963b0e3e08735f8f693508976a842fd82758c0e545ce4a7d836a33b (gas 294.996 @ 0,0724 gwei), cancelBounty #0 tx 0xa8997ed96346f29f6ff14961135e4597460e6fda2880dac8b145897e0b3a198a (gas 63.471 @ 0,0652 gwei). Bounty #0 status Cancelled, escrow 0 BNB, refund 0,001 BNB penuh. Biaya bersih Fase A 0,0000255 BNB (sekitar 0,015 USD; di atas estimasi 0,009 USD karena gas terpakai + gas price lebih tinggi dari estimasi Foundry). Saldo lactus kini 0,001827 BNB. Catatan: angka saldo awal di rencana ini (0,002023 BNB) sudah basi, itu sebelum top-up kedua 0,10 USD; semua dana cocok, tidak ada yang hilang. Fase B masih menunggu pemegang Agent ID lain sebagai worker.
Tidak ada dana yang dipindahkan sebelum user menyetujui angka di bawah ini.
Semua eksekusi lewat `baw` tetap butuh preview + kata "ya" eksplisit per transaksi
(Imprint gate). Perintah `baw` persisnya disiapkan saat eksekusi (preview dulu),
karena flag untuk value perlu dicek di `baw contract-call --help`.

## Fakta yang sudah diverifikasi (18 Nov 2026, via eth_call langsung)

- Kontrak: `0x47751df28f9c62faebbfadf191439495f1bff70e`, `bountyCount()` = 0.
- `hasAgentId(lactus 0xDd8411f299b1da04D61283a8C2Ffa2790978b923)` = **true**.
- `hasAgentId(deployer MetaMask 0xb62a40449Df2E405d47e81cc58f11bcf34DAcDc1)` = **false**.
  Wallet deployer TIDAK bisa membuat atau mengklaim bounty (tidak pegang Agent ID).
- Saldo wallet lactus (Agentic): **0,002023 BNB** (sekitar 1,19 USD, harga BNB 589,40 USD).
- Saldo wallet deployer: sekitar 0,0003153 BNB (hanya sisa gas deploy, tidak relevan
  untuk uji karena tidak pegang Agent ID).
- Setiap user hanya bisa klaim SATU Agent ID (aturan resmi Binance). Jadi user TIDAK
  bisa membuat alamat Agent ID kedua sendiri. Jalur klaim/submit/release penuh
  BUTUH satu pemegang Agent ID lain (orang beneran) sebagai worker.
- Biaya gas dihitung dari laporan gas Foundry (`forge test --gas-report`,
  36/36 PASS) pada gas price 0,05 gwei. Gas deploy aktual 1.690.048 sama persis
  dengan laporan Foundry, jadi angka-angka ini bisa dipercaya.

## Biaya gas per fungsi (0,05 gwei, BNB 589,40 USD)

| Fungsi | Gas (median / maks) | Biaya maks (BNB) | Biaya maks (USD) |
| --- | --- | --- | --- |
| createBounty | 184.971 / 241.923 | 0,0000121 | 0,0071 |
| claimBounty | 123.891 / 123.891 | 0,0000062 | 0,0037 |
| submitWork | 84.222 / 84.270 | 0,0000043 | 0,0025 |
| releasePayment | 101.261 / 125.468 | 0,0000063 | 0,0037 |
| cancelBounty | 49.777 / 73.299 | 0,0000037 | 0,0022 |
| refundExpired | 33.206 / 60.972 | 0,0000031 | 0,0018 |
| claimTimeout | 34.371 / 96.299 | 0,0000049 | 0,0029 |

## Fase A — Uji poster saja (satu Agent ID, sepenuhnya dalam kendali user)

Tujuan: buktikan create + kunci escrow + cancel + refund penuh di mainnet.

1. **createBounty #0** dari wallet lactus (Agentic, via `baw contract-call`):
   - Judul: "Uji dogfood AgentBoard #0 (tes internal, akan dibatalkan)"
   - Deskripsi: "Bounty tes internal untuk memverifikasi escrow dan refund di mainnet."
   - Token: BNB (address 0), jumlah: **0,001 BNB** (sekitar 0,59 USD),
     deadline: 7 hari dari pembuatan.
   - Biaya: escrow 0,001 BNB + gas maks 0,0000121 BNB.
   - Saldo lactus setelah langkah ini: sekitar 0,002023 - 0,0010121 = **0,0010109 BNB**.
   - Verifikasi: `bountyCount()` = 1, `getBounty(0)` status Open, poster lactus,
     amount 0,001 BNB, saldo kontrak 0,001 BNB.
2. **cancelBounty #0** dari wallet lactus:
   - Biaya: gas maks 0,0000037 BNB. Dana 0,001 BNB kembali penuh ke lactus.
   - Saldo lactus setelah langkah ini: sekitar **0,0020072 BNB**.
   - Verifikasi: `getBounty(0)` status Cancelled, saldo kontrak 0 BNB.
   - **Biaya bersih Fase A: sekitar 0,0000158 BNB (sekitar 0,009 USD).**

## Fase B — Uji jalur penuh dengan worker beneran (butuh pemegang Agent ID lain)

Tujuan: buktikan claim -> submit -> release dengan orang beneran, sekaligus
mendapat interaksi Agent ID ke-2 untuk hitungan hackathon.

3. **createBounty #1** dari wallet lactus:
   - Judul: "Tulis review jujur pemakaian AgentBoard (5 menit)"
   - Deskripsi: "Buka website AgentBoard, connect wallet Agent ID kamu, baca daftar
     bounty dan coba semua tombol baca (tanpa transaksi), lalu tulis review jujur
     maksimal 300 kata: apa yang membingungkan, apa yang rusak, apa yang bagus.
     Kirim review sebagai bukti kerja (tautan atau teks)."
   - Token: BNB, jumlah: **0,001 BNB** (sekitar 0,59 USD), deadline: 7 hari.
   - Biaya: escrow 0,001 BNB + gas maks 0,0000121 BNB.
   - Saldo lactus setelah langkah ini: sekitar 0,0020072 - 0,0010121 = **0,0009951 BNB**.
4. **claimBounty #1** oleh worker (pemegang Agent ID lain, lewat website + walletnya):
   - Biaya worker: gas maks 0,0000062 BNB (sekitar 0,0037 USD, dibayar worker).
   - Verifikasi: status Claimed, worker = alamat worker.
5. **submitWork #1** oleh worker, bukti = teks/tautan review:
   - Biaya worker: gas maks 0,0000043 BNB.
   - Verifikasi: status Submitted, proof tercatat.
6. **releasePayment #1** oleh lactus:
   - Biaya: gas maks 0,0000063 BNB. Worker menerima **0,001 BNB**.
   - Saldo lactus setelah langkah ini: sekitar **0,0009888 BNB**.
   - Verifikasi: status Completed, `agentStats(worker)` = 1 completed,
     0,001 BNB earned.
   - **Biaya bersih Fase B untuk lactus: sekitar 0,0010184 BNB (sekitar 0,60 USD).**

## Batas dana (jujur)

- Saldo lactus saat ini (0,002023 BNB) hanya cukup untuk Fase A + SATU bounty
  berbayar 0,001 BNB (Fase B). Setelah itu sisa sekitar 0,00099 BNB, cukup
  untuk gas beberapa transaksi kecil tapi TIDAK cukup untuk bounty 0,001 BNB lagi.
- Bila user mau 3 bounty berbayar 0,001 BNB, total yang dibutuhkan sekitar
  0,003 BNB + gas. Pilihannya: top up wallet Agentic dulu, atau pakai bounty
  yang lebih kecil (0,0005 BNB, sekitar 0,29 USD) sehingga 2-3 bounty muat.
- Keputusan jumlah dan jumlah bounty ada di tangan user. Rencana ini TIDAK
  mengeksekusi apa pun sebelum user menyetujui angka pastinya.

## Yang TIDAK diuji di mainnet (sudah tercakup di Foundry)

- claimTimeout (butuh poster diam 3 hari), refundExpired (butuh deadline lewat),
  dan serangan reentrancy: semuanya sudah PASS di `forge test` (36/36) dan
  tidak layak diuji dengan dana beneran.
