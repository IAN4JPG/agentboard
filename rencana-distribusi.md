# Rencana Distribusi: 30 Alamat Agent ID Berinteraksi

Target resmi: minimal **30 alamat pemegang Agent ID berinteraksi dengan kontrak
AgentBoard** (`0x47751df28f9c62faebbfadf191439495f1bff70e`) selama periode submit
(18 Nov – 9 Des 2026 15:00 WIB). Yang dihitung: alamat yang memegang Agent ID
dan melakukan transaksi ke kontrak (create, claim, submit, release, cancel,
dan kawan-kawan). Membaca website saja TIDAK dihitung — harus ada transaksi
on-chain.

## Posisi awal (18 Nov, terverifikasi)

- Alamat berinteraksi: **0**. Kontrak baru di-deploy, `bountyCount()` = 0.
- Alamat Agent ID yang user pegang: **1** (lactus, `0xDd84...b923`).
- Setiap user hanya bisa klaim satu Agent ID, jadi 29 alamat sisanya HARUS
  orang lain yang beneran memegang Agent ID.
- Saldo lactus: 0,002023 BNB — cukup untuk uji Fase A + SATU bounty berbayar
  0,001 BNB (lihat `rencana-uji-mainnet.md`). Bounty tambahan butuh top up.

## Jalur yang dipakai (tanpa spam, tanpa sybil, tanpa beli interaksi)

1. **Bounty dogfood beneran (inti rencana).** Pasang bounty kecil 0,001 BNB
   untuk tugas yang beneran berguna (review, cari bug, tulis tutorial, desain).
   Setiap worker = +1 alamat. Poster lactus = +1 alamat saat membuat bounty
   pertama. Rencana uji di `rencana-uji-mainnet.md` (Fase A + Fase B).
2. **Postingan X oleh user** (draf di `distribusi/draf-x-post.md`). Sekali
   posting pengumuman + sekali posting saat bounty pertama dibuka. Hashtag
   `#BinanceWalletHackathon` dan `#AgenticWallet` (sekaligus ikut promo X
   2.000 USDC: submit tautan postingan lewat survei resmi
   `https://app.binance.com/uni-qr/user-survey/ff6832f8d2984af289068c9450a3c98c`).
   Miku TIDAK PERNAH posting ke X.
3. **Postingan Binance Square oleh user** (draf di `distribusi/draf-square-post.md`).
   Square adalah tempat pengumuman hackathon diterbitkan, jadi audiensnya tepat.
4. **Pengumuman komunitas oleh user** (draf di `distribusi/draf-pengumuman-komunitas.md`).
   Satu kali di tiap komunitas Agent ID / BNB Chain yang user ikuti
   (Telegram, Discord). Tidak diulang-ulang, tidak spam.
5. **Website sebagai pintu masuk.** Setelah hosting live, semua tautan
   mengarah ke website. Di website, pemegang Agent ID bisa langsung connect
   wallet dan klaim bounty — tanpa daftar, tanpa server.

## Hitungan jujur

- 30 alamat dalam 21 hari butuh rata-rata 1,4 alamat baru per hari.
- Realistis bila postingan X/Square mendapat sambutan dan bounty dogfood
  dibuka bertahap. TIDAK dijamin: proyek baru tanpa audiens besar biasanya
  sulit mencapai 30 interaksi organik dalam 3 minggu.
- Bila 30 tidak tercapai, proyek tetap masuk peringkat Pioneer Award (yang
  dihitung dari jumlah alamat berinteraksi, volume, dan jumlah transaksi —
  tanpa ambang minimum). Ambang 30 hanya syarat Innovation Award.
- Yang TIDAK PERNAH dilakukan: membuat banyak akun/Agent ID, membayar orang
  untuk klik tanpa kerja, memanipulasi volume, atau interaksi palsu. Semua itu
  melanggar aturan hackathon dan berujung diskualifikasi.

## Jadwal kerja

- 18–19 Nov: hosting live (butuh user buat repo), uji Fase A, buka bounty #1.
- 19–20 Nov: user posting X + Square, umumkan bounty #1 di komunitas.
- 20 Nov – 9 Des: pantau interaksi (cek `bountyCount` dan alamat worker baru),
  buka bounty baru tiap ada yang selesai, top up lactus bila perlu.
- 9 Des 15:00 WIB: submit ditutup. Pastikan pengajuan proyek sudah masuk
  SEBELUM tenggat (formulir resmi belum diterbitkan tautannya — lihat
  `submission.md`).
