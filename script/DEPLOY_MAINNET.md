# Deploy Mainnet — Preview untuk Persetujuan User

> DOKUMEN INI HANYA PREVIEW. Tidak ada deploy yang dijalankan.
> Deploy butuh persetujuan eksplisit user setelah membaca preview ini (Imprint gate).

## Yang akan di-deploy

- **Kontrak:** `contracts/AgentBoard.sol` (sudah dites: `forge test` 36/36 PASS,
  `forge build` bersih kecuali warning lint yang didokumentasikan).
- **Jaringan:** BSC mainnet, chain 56.
- **Constructor arg:** alamat Agent ID mainnet
  `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` (sudah terverifikasi on-chain:
  `balanceOf` wallet lactus = 1).
- **Deployer:** wallet yang user tentukan saat eksekusi (bukan Miku; Miku tidak
  memegang private key).

## Perintah deploy (dijalankan hanya setelah user bilang YA)

```sh
cd ~/workspace/binance-agentid-hackathon
export PATH="$HOME/.foundry/bin:$PATH"
forge script script/Deploy.s.sol --rpc-url https://bsc.publicnode.com --broadcast --account <nama-akun-forge-yang-user-tentukan>
```

Catatan: `--account` memakai akun Foundry yang sudah user siapkan sendiri.
Alternatif: `--private-key` HANYA bila user yang menempelkannya sendiri saat
eksekusi — Miku tidak pernah meminta atau menerima private key di chat.

Setelah deploy, verifikasi source di BscScan:

```sh
forge verify-contract <alamat-kontrak> contracts/AgentBoard.sol:AgentBoard \
  --chain 56 --constructor-args $(cast abi-encode "constructor(address)" 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F) \
  --compiler-version 0.8.28 --optimizer-runs 200
```

## Estimasi gas (simulasi fork mainnet, 18 Nov 2026, TANPA broadcast)

Perintah simulasi yang sudah dijalankan (read-only, tanpa dana):

```sh
forge script script/Deploy.s.sol --rpc-url https://bsc.publicnode.com \
  --sender 0xDd8411f299b1da04D61283a8C2Ffa2790978b923
```

Hasil:

| Item | Nilai |
| --- | --- |
| Total gas deploy | **2.197.062 gas** |
| Biaya pada 0,05 gwei (hasil simulasi) | **0,0001098531 BNB** |
| Biaya pada 0,1 gwei | ~0,00022 BNB |
| Biaya pada 1 gwei | ~0,0022 BNB |

Biaya sebenarnya mengikuti gas price saat deploy. Deployer juga butuh sedikit BNB
untuk verifikasi BscScan bila memakai API (gratis bila via UI).

## Langkah setelah deploy

1. Catat alamat kontrak ke `submission.md` + README.
2. Verifikasi source di BscScan (perintah di atas).
3. Isi alamat kontrak di frontend, host halaman statis.
4. Uji satu bounty kecil end-to-end di mainnet (buat → klaim → submit → release)
   dengan dana kecil, sebelum mengumumkan.
5. Ajukan proyek ke hackathon (nama, website, alamat kontrak, deskripsi Agent ID)
   sebelum 9 Des 2026 15:00 WIB.

## Yang TIDAK dilakukan di langkah ini

- Tidak ada transfer dana selain gas deploy.
- Tidak ada interaksi dengan kontrak Agent ID selain membaca `balanceOf` (sudah
  dilakukan, read-only).
- Tidak ada perubahan ke wallet, approval, atau setting apa pun.
