# Backend Implementation: MySQL + OTP Auth + Policies + WA Reports + Audit Logging

## Context

Foundational setup (models, migrations, factories, seeders, API controllers, routes) selesai di sesi sebelumnya, jalan di SQLite. Sekarang implementasi backend sesuai PRD dilanjutkan dengan empat area yang dipilih user, dan database dev dipindah ke **MySQL Laragon** (sudah jalan, MySQL 8.0.30, `pdo_mysql` aktif, root tanpa password). Tests tetap SQLite in-memory (phpunit.xml sudah dikonfigurasi begitu).

## 1. Migrasi ke MySQL

- Buat database: `mysql -u root -e "CREATE DATABASE IF NOT EXISTS warmad CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"`
- Update `.env`: `DB_CONNECTION=mysql`, `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_DATABASE=warmad`, `DB_USERNAME=root`, `DB_PASSWORD=` (kosong, default Laragon)
- `php artisan migrate:fresh --seed` — verifikasi 20 migrations + seeder jalan di MySQL
- phpunit.xml tidak diubah (tests tetap sqlite :memory:)

## 2. Auth OTP Nomor HP (PRD §6.1)

**Files baru:**
- Migration `create_otp_codes_table`: `phone` (index), `code` (hashed), `expires_at`, `consumed_at`, `attempts` (tinyint), timestamps
- Model `app/Models/OtpCode.php`
- `app/Services/Otp/OtpService.php` — generate 6 digit, hash simpan, verify (max 5 attempts, expiry 5 menit), consume
- `app/Services/WhatsApp/WhatsAppGateway.php` (interface: `send(string $phone, string $message): void`)
- `app/Services/WhatsApp/LogWhatsAppGateway.php` (default dev — tulis ke log)
- `app/Services/WhatsApp/FonnteWhatsAppGateway.php` (HTTP client ke Fonnte, token dari config)
- Binding di `AppServiceProvider` berdasar `config('services.whatsapp.driver')`; tambah blok `whatsapp` + `fonnte` di `config/services.php` + entri `.env.example`
- `app/Http/Controllers/Api/Auth/OtpController.php`:
  - `POST /api/auth/otp/request` — validasi phone (format Indonesia), throttle ketat via RateLimiter (per-phone + per-IP), kirim OTP via gateway
  - `POST /api/auth/otp/verify` — verifikasi code, set `phone_verified_at`, issue Sanctum token (`{token, user}`)
- Routes publik di `routes/api.php` (di luar grup `auth:sanctum`)

Catatan: user harus sudah terdaftar (dibuat juragan/registrasi) — OTP login untuk user existing berdasarkan `users.phone`.

## 3. Otorisasi / Policies

**Files baru** di `app/Policies/`: `OutletPolicy`, `CategoryPolicy`, `ShiftPolicy`, `TransactionPolicy`, `CashReconciliationPolicy`, `DebtPolicy`, `StockOpnameSessionPolicy`.

Aturan (role Spatie `owner` / `penjaga`, sudah di-seed):
- **owner**: full CRUD semua resource dalam tenant-nya
- **penjaga**: viewAny/view + create transaksi/shift/rekonsiliasi/debt/opname-item; TIDAK boleh create/update/delete outlet & category; hanya boleh update shift miliknya sendiri
- Isolasi tenant sudah dijamin `BelongsToTenant` global scope — policy fokus ke role & ownership
- Terapkan di controllers API existing via `$this->authorize(...)` (atau `Gate::authorize`) di tiap method

## 4. Laporan WA Harian (PRD §6.6)

**Files baru:**
- `app/Services/Reports/DailyOwnerReport.php` — kumpulkan data per tenant: omzet per outlet, jumlah transaksi, selisih kas (dari CashReconciliation), bon baru/belum lunas, status opname berjalan; format jadi pesan WA Bahasa Indonesia
- `app/Jobs/SendDailyOwnerReportJob.php` — queued; terima tenant, render report, kirim via `WhatsAppGateway` ke phone owner
- Scheduler di `routes/console.php`: `Schedule::job/command` harian (mis. jam 21:00 WIB) yang dispatch job per tenant aktif

## 5. Audit Logging Append-Only (PRD §10)

**Files baru:**
- `app/Observers/RecordsAuditLogObserver.php` ATAU trait `app/Models/Concerns/Auditable.php` (pilih trait — konsisten dengan pola BelongsToTenant): pada event `created`/`updated`/`deleted` tulis row `AuditLog` (old_values/new_values dari `getOriginal()`/`getChanges()`)
- Pasang di: `CashReconciliation`, `StockOpnameSession`, `StockOpnameItem` (data finansial sensitif per PRD)
- Proteksi append-only di `AuditLog` model: lempar exception pada event `updating`/`deleting`

## 6. Tests (Pest, Feature)

- `tests/Feature/Api/Auth/OtpAuthTest.php` — request→verify→token happy path; kode salah 5x terkunci; expired; rate limit
- `tests/Feature/Api/AuthorizationTest.php` — penjaga tidak bisa create outlet/category (403); owner bisa; penjaga tidak bisa update shift orang lain
- `tests/Feature/Reports/DailyOwnerReportTest.php` — isi report benar (omzet, selisih); job memanggil gateway (fake)
- `tests/Feature/AuditLogTest.php` — create/update rekonsiliasi & opname menghasilkan audit rows; AuditLog tidak bisa diupdate/dihapus

## Reuse

- `BelongsToTenant` trait (app/Models/Concerns/BelongsToTenant.php) — jangan diubah
- Enums existing di `app/Enums/`
- Pola controller API existing (`app/Http/Controllers/Api/*`) — ikuti gaya validasi inline + JsonResponse
- `AuditLog` model sudah ada — tinggal dipakai observer/trait
- Seeder existing (RoleSeeder, DemoSeeder)

## Verifikasi

1. `php artisan migrate:fresh --seed` sukses di MySQL (cek `SHOW TABLES` via mysql CLI)
2. `php artisan test --compact` — semua test lama + baru hijau (SQLite in-memory)
3. `vendor/bin/pint --dirty --format agent` — clean
4. `vendor/bin/phpstan analyse --no-progress` — 0 errors
5. Smoke test manual OTP: `php artisan tinker` request OTP → cek `storage/logs/laravel.log` berisi kode (LogWhatsAppGateway)