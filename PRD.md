# PRD: Amanah — Platform Kepercayaan & Operasional untuk Warung Madura

**Versi:** 0.1 (Draft)
**Tanggal:** 15 Juli 2026
**Status:** Untuk direview & divalidasi ke lapangan sebelum development

> *"Amanah"* dipakai sebagai nama kerja saja (working title) — merefleksikan inti produk ini: infrastruktur kepercayaan antara pemilik dan penjaga. Ganti bebas sesuai selera branding.

---

## Daftar Isi

1. Ringkasan Produk
2. Tujuan & Metrik Sukses
3. Target Pengguna & Persona
4. Keputusan Platform: Web, Aplikasi, atau Keduanya
5. Ruang Lingkup (In-Scope & Out-of-Scope)
6. Spesifikasi Fitur
7. Model Bisnis & Monetisasi
8. Arsitektur Teknis & Stack Pilihan
9. Model Data (Entitas Utama)
10. Kebutuhan Non-Fungsional
11. Roadmap & Fase Rilis
12. Risiko & Mitigasi
13. Analisis Kompetitor & Gap yang Bisa Diadopsi

---

## 1. Ringkasan Produk

Amanah adalah SaaS yang menggantikan proses hitung-total-lalu-sengketa di warung Madura dengan **rekonsiliasi harian yang berkelanjutan** dan **serah terima yang transparan & terdokumentasi** saat penjaga berganti — tanpa memaksa warung beroperasi seperti kasir minimarket.

Produk ini punya dua sisi pengguna dengan kebutuhan sangat berbeda:

- **Pemilik (juragan)** — butuh visibilitas tanpa harus buka aplikasi terus-menerus, dan kepastian angka modal terjaga.
- **Penjaga** — butuh alat kerja yang cepat, tidak menambah beban saat melayani pembeli jam berapa pun, dan yang paling penting: **bukti objektif bahwa dia bekerja jujur**.

Produk didesain jujur soal presisi: ini bukan sistem inventori SKU-sempurna. Fokusnya adalah menangkap sinyal yang *cukup* untuk mendeteksi masalah lebih awal dan memberi kedua pihak bukti yang sama saat terjadi selisih.

---

## 2. Tujuan & Metrik Sukses

### Tujuan Bisnis
- Validasi kemauan bayar dari juragan warung Madura untuk alat rekonsiliasi + serah terima.
- Membangun moat lewat data historis (trust ledger) yang makin berharga seiring waktu — sulit ditiru kompetitor kasir generik yang baru masuk belakangan.

### Tujuan Pengguna
- **Juragan**: tahu kondisi warung tanpa harus datang/telepon/nunggu laporan bulanan; sengketa serah terima jadi berbasis data, bukan debat.
- **Penjaga**: proses serah terima tidak lagi menegangkan; ada bukti kalau ia bekerja bersih.

### Metrik Sukses per Fase

| Metrik | Target Fase MVP | Target Fase Growth |
|---|---|---|
| Juragan aktif mingguan (buka laporan WA/dashboard) | >60% dari yang daftar | >75% |
| Rata-rata selisih kas harian per outlet | Baseline diukur bulan 1 | Turun ≥30% dari baseline |
| Waktu proses serah terima (opname akhir) | Baseline diukur | Turun ≥50% dibanding hitung manual |
| Sengketa serah terima yang butuh mediasi eksternal | Baseline diukur | Turun signifikan (self-reported) |
| Retensi juragan bulan ke-3 | >50% | >70% |

---

## 3. Target Pengguna & Persona

### Persona 1 — Juragan (Pembeli/Customer Utama)
Punya 1–5+ warung, tidak berjaga sendiri, ingin fokus ekspansi bukan urus operasional harian. Titik sakitnya: laporan telat, gak tahu kondisi riil, tiap ganti penjaga selalu was-was soal selisih.

### Persona 2 — Penjaga (Pengguna Harian)
Kerja shift panjang bahkan 24 jam, sering sendirian, tingkat melek teknologi bervariasi (dari cukup mahir HP sampai hanya bisa WhatsApp dasar). Titik sakitnya: dituduh tanpa bukti, proses serah terima melelahkan dan menegangkan.

### Persona 3 — Calon Penjaga (Fase Lanjut)
Orang dari jaringan Madura yang cari kerja jaga warung, saat ini rekrutmen 100% dari mulut ke mulut. Titik sakitnya: susah dapat kerja di luar jaringan kenalan langsung, gak ada cara buktikan rekam jejak baik ke juragan baru.

---

## 4. Keputusan Platform: Web, Aplikasi, atau Keduanya

**Keputusan: Web-first untuk sisi juragan, Progressive Web App (PWA) untuk sisi penjaga — bukan dua native app terpisah dari awal.**

| Kebutuhan | Native App (Flutter/RN) | PWA | Web biasa |
|---|---|---|---|
| Kamera untuk scan barcode/foto | ✅ | ✅ (via `getUserMedia`, didukung baik di Chrome Android) | ❌ (terbatas) |
| Mikrofon untuk input suara | ✅ | ✅ | ❌ (terbatas) |
| Bekerja offline & antre sync | ✅ | ✅ (service worker + IndexedDB) | ❌ |
| Install tanpa app store | ❌ | ✅ (Add to Home Screen) | — |
| Update instan tanpa nunggu approval store | ❌ | ✅ | — |
| Biaya development (1 codebase) | ❌ (2 platform) | ✅ | ✅ |
| Push notification di iOS | ✅ | ⚠️ terbatas (membaik tapi belum penuh) | ❌ |

**Alasan memilih PWA untuk aplikasi penjaga:**

1. Anda solo/tim kecil — satu codebase React yang dipakai bareng untuk web dashboard juragan *dan* aplikasi penjaga jauh lebih realistis daripada maintain native app di dua platform.
2. Mayoritas target pengguna (penjaga warung Madura) pakai Android kelas menengah-bawah dengan Chrome sebagai browser default — cakupan fitur kamera/mic/offline di PWA sudah cukup matang di sana. Keterbatasan PWA paling terasa di iOS, yang bukan mayoritas target pasar ini.
3. **Update instan penting justru karena rotasi penjaga sering** — penjaga baru harus langsung dapat versi terbaru tanpa perlu update manual dari Play Store.
4. Migrasi ke Play Store tetap terbuka nanti lewat pembungkus tipis (Trusted Web Activity/Capacitor) tanpa nulis ulang — jadi keputusan ini tidak menutup opsi kalau suatu saat kehadiran di Play Store dianggap penting untuk kepercayaan (banyak orang masih mengasosiasikan "aplikasi asli" dengan yang ada di Play Store).

**Untuk juragan:** dashboard web responsif biasa sudah cukup — interaksinya lebih jarang (cek laporan, lihat multi-outlet), dan laporan utama justru didorong lewat WhatsApp, bukan lewat buka aplikasi.

---

## 5. Ruang Lingkup

### In-Scope (MVP + Fase Lanjut)
- Pencatatan transaksi ringan berbasis kategori
- Opname awal & serah terima multi-mode (scan, suara, ketik, foto)
- Rekonsiliasi kas harian
- Utang/piutang pelanggan
- Laporan otomatis via WhatsApp
- Dashboard multi-outlet untuk juragan
- Trust ledger & rating dua arah (opsional, fase lanjut)
- Marketplace pencarian penjaga (opsional, fase lanjut)

### Out-of-Scope (Non-Goals)
- **Bukan sistem inventori SKU-presisi penuh** — tidak menjanjikan akurasi stok per unit untuk barang eceran/curah, hanya level kategori/estimasi yang cukup untuk kontrol.
- **Bukan aplikasi untuk pembeli/konsumen akhir** — tidak ada fitur belanja online, katalog publik, dsb.
- **Bukan sistem akuntansi/pajak lengkap** di MVP — laporan keuangan sederhana dulu, integrasi pembukuan formal (jika dibutuhkan) belakangan.
- **Bukan pengganti hubungan kerja/kontrak formal** — produk membantu transparansi data, bukan mengatur hubungan hukum ketenagakerjaan.

---

## 6. Spesifikasi Fitur

### 6.1 Autentikasi & Onboarding Tenant
- Login berbasis **nomor HP + OTP** (via WA/SMS) — bukan email/password, karena lebih sesuai kebiasaan target pengguna.
- Satu akun juragan bisa punya banyak outlet (tenant → outlet → user), role: `owner`, `penjaga`.
- Saat outlet baru dibuat, wizard onboarding langsung mengarahkan ke fitur 6.2 (Opname Awal).

### 6.2 Opname Awal & Serah Terima — Multi-Mode Capture

Ini titik paling kritis karena hasilnya jadi **baseline modal awal** yang menentukan semua rekonsiliasi berikutnya. Karena itu presisinya harus lebih tinggi dari transaksi harian biasa, dan tiga mode input bukan pilihan bebas — masing-masing berperan beda:

| Mode | Kapan dipakai | Kenapa |
|---|---|---|
| **Scan barcode** | Barang kemasan pabrik (mayoritas SKU) | Tercepat & paling akurat, jadi mode utama |
| **Input suara** | Menghitung sambil menyusuri rak tanpa harus tap-tap | Cepat, natural, tangan tetap bebas pegang barang |
| **Ketik/tap manual** | Barang tanpa barcode, istilah lokal (rokok ketengan, gorengan, dll) | Fallback wajib karena scan & suara tidak selalu cocok |
| **Foto per rak/section** | Semua section, sebagai bukti pendukung | Kalau ada hitungan yang nanti disengketakan, foto jadi rujukan objektif |

**Alur:**
1. Sesi opname dibuat, dibagi per **section/rak** (bukan bebas urut) supaya tidak ada yang terlewat dan bisa dijeda-lanjut untuk sesi panjang (bisa ratusan item).
2. Untuk serah terima (bukan opname pertama kali buka warung): **penjaga lama & penjaga baru sama-sama login ke sesi yang sama**, progress terlihat live di kedua device (dan juragan bisa memantau juga kalau mau).
3. Tiap section difoto sebelum dan sesudah dihitung.
4. Di akhir sesi, total dikonfirmasi oleh kedua pihak (tombol "Setuju" dari penjaga lama *dan* penjaga baru) — baru status sesi berubah jadi final dan angkanya terkunci sebagai modal awal baru.
5. Kalau salah satu pihak tidak setuju dengan suatu angka, ada kolom catatan sengketa per-item yang tetap tersimpan (tidak memblokir penyelesaian sesi, tapi tercatat untuk referensi).

**Acceptance criteria kunci:**
- Sesi bisa dijeda & dilanjut tanpa kehilangan progres (disimpan lokal + sync).
- Sesi tidak bisa "final" tanpa konfirmasi dari kedua pihak yang terlibat.
- Semua foto & timestamp tersimpan permanen, bisa diakses ulang kapan saja oleh juragan.

### 6.3 Transaksi Harian
- ~20–40 tombol kategori besar (rokok, sembako, minuman dingin/panas, snack, pulsa/PPOB, bensin eceran, gas, lain-lain) dengan harga default yang bisa disesuaikan cepat.
- Scan barcode opsional untuk barang berkemasan yang sudah terdaftar dari sesi opname.
- **Voice-first input via Voice Queue (Antrean Suara)** untuk efisiensi tinggi saat warung ramai:
  - Penjaga dapat merekam suara pembeli satu demi satu (seperti mengirim Voice Note di WhatsApp) dengan cepat tanpa perlu menunggu proses konversi selesai. Rekaman disimpan instan sebagai antrean kartu lokal (Voice Cards) di device.
  - Proses transkripsi (Speech-to-Text) dan analisis berbasis AI (LLM parser) berjalan secara asinkron di background. Kartu antrean akan berubah status jika AI selesai mem-parse ucapan tersebut menjadi daftar produk/kategori.
  - Penjaga cukup mengetuk kartu antrean yang siap untuk membuka popup konfirmasi yang menampilkan list barang beserta nominal belanja dan kolom input nominal bayar (kembalian dihitung otomatis). Hal ini mencegah data kacau akibat salah dengar AI sebelum transaksi resmi dicatat.
- Semua transaksi tersimpan lokal dulu (offline-capable), sync ke server saat ada koneksi. File rekaman suara diantre secara lokal di IndexedDB ketika tidak ada jaringan.

### 6.4 Tutup Kasir & Rekonsiliasi Harian
- **Check-in awal shift**: penjaga wajib foto diri + sistem catat geolokasi saat mulai jaga — pola ini diadopsi dari fitur absensi foto+geolokasi yang sudah terbukti dipakai luas (mis. Majoo). Fungsinya di sini bukan sekadar absensi, tapi bukti tambahan siapa yang benar-benar bertugas di jam berapa, berguna kalau ada sengketa terkait waktu kejadian.
- Di akhir shift: sistem hitung total transaksi tercatat → "kas seharusnya". Penjaga input kas fisik → "kas aktual".
- Selisih dalam toleransi → auto-approve. Selisih besar → wajib isi catatan alasan saat itu juga.
- Riwayat rekonsiliasi harian inilah yang jadi dasar trust ledger nantinya (6.9).

### 6.5 Utang/Piutang Pelanggan (Bon)
- Catat nama/panggilan pelanggan, jumlah, tanggal, status lunas/belum.
- Muncul sebagai komponen terpisah di laporan — supaya tidak tercampur dengan "selisih/kerugian".
- **Reminder otomatis via WA** ke pelanggan yang belum lunas — pola ini sudah terbukti dipakai luas (BukuWarung punya fitur pengingat tagihan lewat SMS/WA), tinggal diadaptasi ke konteks bon warung yang lebih informal (nada pesan santai, bukan nada tagihan formal).

### 6.6 Laporan Otomatis & Notifikasi WhatsApp
- Ringkasan harian/mingguan/bulanan didorong otomatis ke WA juragan: omzet, estimasi margin, selisih kas, flag anomali, status serah terima kalau sedang berjalan.
- Juragan tidak wajib buka aplikasi sama sekali untuk dapat insight dasar.
- **Broadcast dua arah**: selain laporan naik ke juragan, juragan juga bisa kirim pengumuman turun ke penjaga di satu/semua outlet sekaligus (mis. perubahan harga, info kulakan baru, pengingat) — pola ini diadopsi dari fitur broadcast pengumuman karyawan yang sudah umum di aplikasi kasir sekelas Majoo, memastikan komunikasi tidak cuma satu arah.
- **Export laporan ke PDF/Excel** untuk kebutuhan formal (pajak, presentasi ke mitra, dsb) — fitur umum yang sudah jadi standar (BukuWarung menyediakan ini), murah untuk diimplementasikan dan menambah persepsi profesional produk.

### 6.7 Dashboard Multi-Outlet (Juragan)
- Satu akun, banyak outlet, role terpisah per outlet.
- Dashboard agregat: bandingkan performa antar outlet, filter per periode.

### 6.8 Trust Ledger & Rating Dua Arah *(Opsional — Fase Lanjut)*
- Skor objektif dari data yang sistem sudah punya: rata-rata selisih harian, kebersihan proses serah terima, konsistensi laporan.
- Rating subjektif **dua arah**: juragan menilai penjaga, dan penjaga menilai juragan (bayar tepat waktu, modal awal transparan, perlakuan wajar) — supaya tidak timpang seperti keluhan umum di sistem rating satu arah.
- Ada jalur sanggah/banding untuk rating yang dianggap tidak adil, karena ini menyangkut penghidupan orang di komunitas yang cukup tertutup.
- **Tidak dirilis di MVP** — butuh basis data dari 6.4 & 6.2 dulu supaya skornya bermakna, bukan kosong.
- **Potensi jangka panjang — akses pembiayaan berbasis data**: kompetitor seperti Majoo sudah membuktikan model ini jalan — mereka menawarkan pinjaman modal usaha tanpa agunan hingga Rp2 miliar berbasis data penjualan yang terintegrasi di sistemnya, bekerja sama dengan lembaga keuangan berizin OJK. Bedanya, data trust ledger kita bukan cuma soal kesehatan bisnis warung, tapi juga rekam jejak **individu penjaga**. Ini punya potensi unik: banyak penjaga akhirnya membuka warung sendiri (lihat 1.1) — trust ledger yang sudah terbangun bisa jadi data underwriting untuk pembiayaan modal usaha bagi penjaga yang mau naik kelas jadi juragan, sesuatu yang tidak dimiliki kompetitor manapun karena mereka semua membangun skor di level bisnis, bukan di level individu pekerja informal.

### 6.9 Marketplace Pencarian Penjaga *(Opsional — Fase Lanjut Lebih Jauh)*
- Juragan bisa cari calon penjaga berdasarkan trust score & riwayat kerja, bukan cuma jaringan kenalan langsung.
- Berpotensi pakai pencarian berbasis lokasi (siapa yang available di sekitar mana) — cocok dipasangkan dengan pengalaman GIS/PostGIS yang sudah pernah Anda kerjakan.
- Butuh volume dua sisi (juragan *dan* penjaga terdaftar) supaya berguna — classic cold-start marketplace, jadi memang harus belakangan, sesuai insting Anda soal ini opsional.

---

## 7. Model Bisnis & Monetisasi

**Yang membayar: juragan.** Penjaga pengguna gratis (mereka justru harus dimudahkan untuk mau pakai).

### Struktur Harga (usulan awal, perlu divalidasi ke pasar)

| Tier | Target | Fitur |
|---|---|---|
| **Gratis** | Akuisisi, 1 outlet | Laporan WA dasar + tutup kasir harian |
| **Standar** (~Rp30–75rb/outlet/bulan) | Juragan 1–3 outlet | + opname multi-mode, utang/piutang, dashboard |
| **Pro** (per-juragan, tier jumlah outlet) | Juragan 4+ outlet | + dashboard multi-outlet agregat, trust ledger, prioritas support |

### Potensi Revenue Tambahan (Fase Lanjut)
- **Komisi PPOB** — banyak warung Madura sudah menambah layanan pulsa/token listrik/BPJS sebagai sumber cuan tambahan. Kalau produk ini mengintegrasikan PPOB langsung di alur transaksi, ada potensi komisi per transaksi selain biaya langganan.
- **Fee marketplace** (fase jauh) — biaya sukses saat juragan merekrut penjaga lewat platform.
- **Fee referral pembiayaan** (fase jauh, terkait 6.8) — begitu trust ledger cukup matang, produk bisa jadi kanal referral ke lembaga keuangan berizin OJK untuk pembiayaan modal usaha, baik untuk juragan maupun penjaga yang mau naik kelas jadi pemilik warung sendiri.

---

## 8. Arsitektur Teknis & Stack Pilihan

### Ringkasan Keputusan

| Layer | Pilihan | Alasan Singkat |
|---|---|---|
| Backend | **Go** (chi/Fiber) | Konsisten dengan stack yang sudah Anda kuasai & pernah dipakai di Rosmon/netops-engine |
| Database | **PostgreSQL** | Multi-tenant lewat `tenant_id` + partial index, sudah familiar dari Rosmon |
| Auth/RBAC | **Casbin** | Pola role owner/penjaga/superadmin mirip Rosmon, tinggal disesuaikan konteksnya |
| Cache/Session | **Redis** | Untuk sesi opname live & rate limiting OTP |
| Realtime (sesi opname bareng) | **SSE/WebSocket** | Sudah pernah dipakai di netops-engine untuk streaming, pola yang sama cocok untuk progress opname live antar dua device |
| Web Dashboard (Juragan) | **React + TanStack (Router/Query/Table) + Vite** | Konsisten dengan pilihan Rosmon dashboard |
| Aplikasi Penjaga | **PWA** (React, service worker, IndexedDB via Dexie) | Satu codebase dengan dashboard, lihat bagian 4 untuk alasan lengkap |
| Object storage (foto opname) | **S3-compatible (MinIO self-hosted)** | Anda sudah mengoperasikan infrastruktur sendiri sebagai ISP — self-host lebih murah dari cloud storage untuk volume foto yang bisa besar |
| Notifikasi WhatsApp | **WA gateway (mis. Fonnte) untuk MVP** | Sudah pernah dipakai & terbukti jalan di Rosmon; migrasi ke WA Business API resmi bisa dipertimbangkan kalau skala & kebutuhan compliance meningkat |
| Speech-to-Text (input suara) | **Whisper (self-hosted) atau API STT Bahasa Indonesia** | Mulai dari API cloud untuk MVP (lebih cepat validasi), evaluasi self-host Whisper kalau volume naik & biaya API jadi signifikan |
| Barcode scan | **Library JS client-side (mis. ZXing-js)** | Jalan di browser lewat kamera, tidak butuh hardware tambahan, tetap berfungsi offline |
| Payment/billing SaaS | **Xendit** | Sudah dipakai di Rosmon, tinggal reuse integrasinya |
| Deployment | **Docker Compose di infra sendiri**, evolusi ke orchestration kalau perlu | Sesuai dengan yang Anda operasikan sebagai ISP — kontrol biaya lebih baik dibanding cloud managed service dari awal |

### Strategi Offline-First (Aplikasi Penjaga)
- Semua input (transaksi, opname, tutup kasir) ditulis dulu ke **IndexedDB lokal**, ditandai `pending_sync`.
- Service worker melakukan **background sync** begitu koneksi kembali.
- Karena umumnya satu device dipegang satu penjaga per shift, konflik tulis jarang terjadi. Untuk sesi opname yang melibatkan dua device (penjaga lama & baru), progress disinkron real-time lewat SSE **saat online**; kalau salah satu offline sementara, perubahan diantre dan digabung begitu online kembali (last-write-wins per item, dengan log perubahan tetap tersimpan untuk audit).

### Keamanan & Privasi Data
- Data finansial per-tenant terisolasi ketat lewat `tenant_id` di setiap query + RBAC Casbin — pola yang sudah terbukti di Rosmon, cukup diperketat lagi mengingat data di sini menyangkut sengketa uang antar individu.
- Foto & rekaman suara disimpan terenkripsi at-rest, retensi dan akses dibatasi ke pihak yang terlibat sesi terkait.

---

## 9. Model Data (Entitas Utama)

| Entitas | Deskripsi Singkat |
|---|---|
| `Tenant` (Juragan) | Akun pemilik, bisa punya banyak outlet |
| `Outlet` (Warung) | Satu lokasi warung, terikat ke satu tenant |
| `User` | Penjaga/owner, terikat ke tenant + role via Casbin |
| `Shift` | Sesi kerja seorang penjaga di suatu outlet |
| `Category` | Kategori transaksi (rokok, sembako, dst), per outlet bisa custom |
| `Transaction` | Catatan penjualan, terikat ke shift + category (+ opsional SKU kalau discan) |
| `CashReconciliation` | Hasil tutup kasir harian: kas seharusnya vs aktual vs selisih |
| `Debt` (Piutang) | Catatan utang pelanggan |
| `StockOpnameSession` | Sesi opname (awal atau serah terima), status draft/final |
| `StockOpnameItem` | Item per section dalam satu sesi, dengan mode input & foto |
| `TrustScoreLog` *(fase lanjut)* | Riwayat skor objektif per penjaga per periode |
| `Rating` *(fase lanjut)* | Rating dua arah owner↔penjaga |
| `Subscription` | Status langganan tenant (tier, status pembayaran via Xendit) |

---

## 10. Kebutuhan Non-Fungsional

- **Toleransi device rendah**: harus tetap responsif di Android RAM ≤3GB, koneksi 3G/4G lemah.
- **Ketahanan offline**: fitur inti (transaksi, tutup kasir) harus tetap bisa dipakai tanpa internet, sync otomatis nanti.
- **Onboarding cepat**: penjaga baru harus bisa mulai pakai fitur transaksi dasar dalam <5 menit tanpa training formal.
- **Auditability**: semua perubahan pada data finansial (opname, rekonsiliasi) harus punya log siapa-kapan-apa yang tidak bisa dihapus, hanya ditambah (append-only untuk data sensitif sengketa).

---

## 11. Roadmap & Fase Rilis

| Fase | Fitur | Fokus |
|---|---|---|
| **MVP** | 6.1, 6.3 (kategori saja dulu, scan/suara menyusul), 6.4 (termasuk check-in foto+geolokasi), 6.6 (bot WA + broadcast dua arah) | Validasi kemauan pakai dengan effort dev minimal |
| **V2** | 6.2 (opname multi-mode lengkap), 6.5 (+ reminder otomatis), 6.7 | Menjawab langsung masalah inti pergantian penjaga |
| **V3** | 6.3 lengkap (scan + suara), integrasi PPOB, export PDF/Excel | Percepat transaksi harian, tambah revenue stream |
| **V4** | 6.8 Trust Ledger & Rating Dua Arah | Setelah cukup data historis dari V2/V3 |
| **V5** | 6.9 Marketplace Pencarian Penjaga, referral pembiayaan | Setelah basis pengguna dua sisi cukup besar |

---

## 12. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Penjaga menolak karena kesan "diawasi" | Framing & onboarding menekankan produk sebagai pelindung diri penjaga (bukti kejujuran), bukan alat pengawasan owner |
| Akurasi STT Bahasa Indonesia untuk istilah lokal warung rendah | Mulai dari API cloud yang sudah mature untuk Bahasa Indonesia, kumpulkan data koreksi pengguna untuk fine-tune/kamus kustom nanti |
| Device fragmentasi (Android lama, browser lawas) | Uji di device kelas bawah sejak awal, hindari fitur web modern yang butuh browser sangat baru |
| Rating jadi alat balas dendam saat sengketa | Skor utama dari data objektif, rating subjektif cuma sinyal tambahan + ada jalur sanggah |
| Cold-start marketplace kosong | Rilis belakangan (V5) setelah basis pengguna V2–V4 cukup besar |
| Resistensi budaya "cukup percaya kekerabatan" | Adopsi bertahap mulai dari fitur paling tidak mengganggu (laporan WA pasif) sebelum masuk fitur yang lebih terasa "diaudit" |

---

## 13. Analisis Kompetitor & Gap yang Bisa Diadopsi

### 13.1 Lanskap Aplikasi yang Sudah Ada

| Aplikasi | Fokus Utama | Fitur Kunci |
|---|---|---|
| **BukuWarung** | Pembukuan & pembayaran digital untuk UMKM mikro | Laporan otomatis harian–tahunan (PDF/Excel), utang piutang + reminder WA/SMS, stok dengan alert habis, split multi-usaha, struk WA/Bluetooth, QRIS, PPOB, gratis selamanya |
| **Majoo** | POS lengkap untuk UMKM naik kelas (F&B, retail, jasa) | Multi-cabang/gudang/kasir, absensi foto+geolokasi karyawan, hak akses per karyawan, komisi & payroll, CRM/loyalty, akuntansi lengkap, **majoo Capital** (pembiayaan modal usaha tanpa agunan berbasis data penjualan), offline via local server hardware |
| **MPStore SuperApp** | Kasir gratis + PPOB, klaim dipakai luas oleh warung Madura | Kasir gratis, QRIS, fokus akuisisi warung skala sangat mikro |
| **"Warung Madura" (Tanean Digital)** | Aplikasi UMKM dengan branding spesifik warung Madura | Positioning sebagai partner usaha sehari-hari, fitur umum UMKM |
| **Repo open source GitHub** (open-retail, AppKasir, kasir-laravel, dll) | Kasir/inventori generik, proyek komunitas/skripsi | Katalog produk, transaksi, laporan gaya minimarket konvensional |

### 13.2 Fitur dari Kompetitor yang Sudah Diadopsi ke PRD Ini

Sudah disisipkan langsung ke section terkait di atas, supaya tidak jadi daftar ide terpisah yang gampang terlupa:

- **Reminder otomatis piutang via WA** (dari BukuWarung) → masuk ke 6.5
- **Check-in shift dengan foto + geolokasi** (dari Majoo) → masuk ke 6.4
- **Broadcast pengumuman dua arah ke penjaga** (dari Majoo) → masuk ke 6.6
- **Export laporan PDF/Excel** (dari BukuWarung) → masuk ke 6.6
- **Model pembiayaan berbasis data terintegrasi** (dari majoo Capital) → masuk ke 6.8, dengan twist unik: berbasis data individu penjaga, bukan cuma data bisnis warung

### 13.3 Fitur Kompetitor yang Sengaja Tidak Diadopsi (dan Kenapa)

| Fitur | Kenapa tidak relevan untuk kita |
|---|---|
| CRM/loyalty pelanggan (poin, membership) | Warung Madura mengandalkan kedekatan sosial langsung, bukan program loyalty formal — prioritas rendah, bukan pembeda |
| Akuntansi lengkap (CoA, e-Faktur, auto posting) | Target kita bukan bisnis yang sudah PKP/butuh pelaporan pajak formal; kalaupun dibutuhkan, cukup lewat export sederhana (13.2), bukan modul akuntansi penuh |
| Offline via local server hardware | Solusi ini butuh investasi hardware tambahan per outlet — bertentangan dengan prinsip minim biaya modal (lihat Prinsip Desain di bagian 3); pendekatan PWA offline-first kita lebih murah untuk skala warung mikro |

### 13.4 Gap yang Tetap Jadi Keunggulan Kita (Belum Ada di Kompetitor Manapun)

Ini validasi penting hasil riset — tidak satupun aplikasi di atas, baik komersial maupun open source, menjawab lima hal berikut:

1. **Serah terima terstruktur dua pihak** dengan sesi live, foto per section, dan konfirmasi bersama sebagai baseline modal baru (6.2) — semua kompetitor hanya punya "stok" sebagai angka, bukan sebagai proses transisi yang disaksikan bersama.
2. **Rekonsiliasi kas harian yang secara eksplisit dirancang mendeteksi selisih sebelum menumpuk** (6.4) — kompetitor fokus ke laporan laba-rugi retrospektif, bukan pencegahan sengketa.
3. **Trust ledger dua arah untuk hubungan kerja informal** (6.8) — yang ada di pasar hanya penilaian kinerja karyawan formal satu arah (atasan menilai bawahan), bukan untuk konteks kekerabatan dengan rotasi tinggi.
4. **Marketplace pencarian penjaga berbasis rekam jejak** (6.9) — rekrutmen di sektor ini 100% masih berbasis jaringan kenalan; tidak ada satupun platform yang membuka akses itu lebih luas.
5. **Transaksi voice-first berbasis Voice Queue (Antrean Suara)** (6.3) — meminimalkan latency pengenalan suara saat warung ramai dengan menyimpan rekaman sebagai antrean kartu lokal, memprosesnya secara asinkron di background melalui AI parser, dan menyediakan popup konfirmasi manual sebelum transaksi disimpan. Kompetitor kasir lain tidak ada yang memiliki antrean rekaman suara asinkron seperti ini.

Kesimpulannya sama seperti sebelumnya, tapi sekarang dengan bukti lebih konkret: pasar UMKM retail di Indonesia sudah ramai dan matang untuk fitur pembukuan/pembayaran generik, tapi kosong total untuk masalah spesifik yang jadi titik tolak produk ini — kepercayaan saat rotasi tenaga kerja informal.

---

**Langkah berikutnya yang disarankan:** validasi PRD ini ke 3–5 juragan warung Madura nyata sebelum mulai development V2 — khususnya soal kesediaan bayar dan reaksi mereka terhadap fitur opname multi-mode & rating dua arah.


Ide
apakah jika ada ai akan tetap cepat atau malah akan delay yang lama untuk prosesnya, atau pendekatan seperti pesan suara saja seperti whatsapp untuk menagani banyak pembeli, jadi nanti jika terdapat banyak pembeli bisa langsung klik ikon suara lalu berikan apa saja yang dibbeli, setela itu baru klik lagi untuk pembeli lainnya dan setiap suara yang sudah disimpan bisa langsung di proses dengan mengkliknya dan nantinya sat di proses akan muncul popup produk yang sesuai dengan suara gitu. bagaimana menurutmu

Ide pendekatan **antrean pesan suara (Voice Queue)** yang Anda usulkan ini **sangat brilian dan jauh lebih realistis untuk kondisi lapangan warung Madura!**

Ini adalah solusi UX (User Experience) tingkat lanjut yang memecahkan masalah performa, koneksi internet, dan kesibukan penjaga sekaligus. 

Berikut adalah analisis mengapa ide Anda sangat bagus dan perbandingannya dengan sistem *real-time*:

---

### Perbandingan UX: Real-Time vs Antrean Suara (Voice Queue)

| Aspek | Pendekatan Real-Time | Pendekatan Antrean Suara (Usulan Anda) |
| :--- | :--- | :--- |
| **Kecepatan saat Ramai** | **Lambat.** Penjaga harus menunggu AI memproses (~1.5–3 detik) sebelum bisa melayani pembeli berikutnya. Jika internet lemot, antrean pembeli akan menumpuk. | **Sangat Cepat.** Penjaga hanya rekam 2 detik, simpan ke antrean lokal, dan langsung bisa melayani/merekam pembeli berikutnya. |
| **Ketergantungan Internet** | **Sangat Tinggi.** Jika koneksi terputus, fitur input suara langsung tidak bisa digunakan sama sekali. | **Aman (Offline-First).** Rekaman suara disimpan sebagai file audio lokal di browser (IndexedDB PWA). Begitu internet stabil, PWA mengirimkannya ke API untuk diproses. |
| **Akurasi & Kontrol** | **Rendah.** Jika AI salah dengar (misal "Surya dua" didengar "Surya muda"), transaksi langsung masuk dan data kas/stok menjadi kacau tanpa disadari penjaga. | **Tinggi (Ada Verifikasi).** Saat antrean diklik, muncul popup hasil parse AI. Penjaga bisa mengoreksi jumlah/kategori jika AI salah dengar sebelum mengklik tombol **"Bayar"**. |

---

### Bagaimana Cara Kerja Teknis Terbaik untuk Ide Anda?

Untuk mengimplementasikan ide ini tanpa membuat server Anda berat, kita bisa menggunakan teknik **Background Processing**:

1. **Rekam & Antre (Instant)**:
   * Pembeli A datang $\rightarrow$ Penjaga klik mikrofon, bicara, klik simpan $\rightarrow$ Muncul kartu **"Antrean 1"** (menyimpan audio lokal).
   * Pembeli B datang $\rightarrow$ Lakukan hal yang sama $\rightarrow$ Muncul kartu **"Antrean 2"**.
2. **Proses di Background (Asinkron)**:
   * Begitu tombol "Simpan" diklik, aplikasi PWA di latar belakang langsung mengirim audio ke server untuk di-parse oleh AI.
   * Saat proses AI selesai (misal butuh 2 detik), kartu **"Antrean 1"** berubah warna atau memunculkan ikon centang hijau $\rightarrow$ menandakan **"Data Siap Ditinjau"**.
3. **Eksekusi Pembayaran**:
   * Saat penjaga punya waktu luang, dia tinggal mengetuk kartu **"Antrean 1"**.
   * Popup langsung muncul menampilkan: 
     * *Rokok Surya (2 bungkus) - Rp60.000*
     * *Aqua Dingin (1 botol) - Rp5.000*
     * **Total: Rp65.000**
   * Penjaga tinggal klik **"Bayar"**, masukkan uang yang diterima, selesai!

---

### Apakah Backend Sudah Mendukung Ini?

Secara arsitektur, backend yang kita bangun saat ini **sudah sangat kompatibel** karena:
1. Endpoint transaksi kita bersifat **idempotent** menggunakan `client_uuid` (untuk mencegah transaksi ganda jika dikirim ulang).
2. Data yang masuk tetap menggunakan format terstruktur yang sama.

Jika nanti Anda masuk ke tahap development frontend/PWA (V2/V3), kita hanya perlu menambahkan satu endpoint sederhana di backend:
* **`POST /api/voice/parse`**: Endpoint ini menerima file audio rekaman, mengirimkannya ke Whisper/Gemini API, lalu mengembalikan JSON hasil konversi teks ke produk/kategori. Data audio ini tidak perlu disimpan permanen di database server (bisa langsung dihapus setelah di-parse untuk menghemat storage).

Apakah konsep alur kerja antrean suara (Voice Queue) dengan verifikasi popup ini yang akan kita jadikan acuan untuk development frontend nanti?