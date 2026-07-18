# Auth & Onboarding: HP + OTP WhatsApp untuk Owner & Penjaga

## Keputusan yang sudah disepakati

1. **Satu cara login untuk semua: nomor HP + OTP WhatsApp.** Tanpa password sebagai jalur utama. Familiar seperti verifikasi WhatsApp — cocok untuk user yang gaptek tapi paham WA.
2. **Owner register sendiri**: HP + OTP → isi nama usaha → otomatis buat Tenant + role `owner` + outlet pertama.
3. **Penjaga didaftarkan oleh owner** di dalam aplikasi. Penjaga tidak pernah daftar sendiri, langsung bisa login OTP.
4. **Mekanisme sesi: cookie session via OTP** (`Auth::login`), bukan bearer token. Alasannya client yang sudah ada ([api.ts](resources/js/lib/api.ts)) memakai cookie same-origin + X-XSRF-TOKEN dan `statefulApi()` sudah aktif ([bootstrap/app.php:20](bootstrap/app.php#L20)). Shell Inertia + API kasir sama-sama terautentikasi lewat satu cookie. Endpoint token Sanctum yang ada dipertahankan sebagai bonus untuk klien non-browser masa depan, bukan jalur utama.

## Kondisi saat ini (yang sudah ada)

- Backend OTP lengkap: [OtpController](app/Http/Controllers/Api/Auth/OtpController.php) (request/verify, rate-limit), [OtpService](app/Services/Otp/OtpService.php), gateway [Fonnte](app/Services/WhatsApp/FonnteWhatsAppGateway.php)/[Log](app/Services/WhatsApp/LogWhatsAppGateway.php). Ada test [OtpAuthTest](tests/Feature/Api/Auth/OtpAuthTest.php).
- Role `owner`/`penjaga` ([OutletUserRole](app/Enums/OutletUserRole.php)) di-seed via [RoleSeeder](database/seeders/RoleSeeder.php). Policies sudah mengecek `hasRole`.
- Isolasi tenant via [BelongsToTenant](app/Models/Concerns/BelongsToTenant.php) global scope.
- Halaman auth Inertia (login/register/dll) ada tapi masih pola email+password bawaan Fortify.

## Masalah yang diselesaikan rencana ini

- OTP verify saat ini hanya mengeluarkan token, **tidak membuat session** → shell Inertia tidak ikut login. Perlu `Auth::login`.
- [CreateNewUser](app/Actions/Fortify/CreateNewUser.php) tidak set `tenant_id`/role → register generik menghasilkan user "yatim". Register Fortify dinonaktifkan, diganti alur register-owner OTP.
- Tidak ada UI OTP, tidak ada UI/endpoint owner menambah penjaga.
- Fail-open di [BelongsToTenant:22](app/Models/Concerns/BelongsToTenant.php#L22): user tanpa tenant lihat semua data. Dibuat fail-closed.
- Redirect pasca-login sama untuk semua role → dibuat per-role (penjaga→cashier, owner→dashboard).

---

## Bagian A — Backend: OTP menghidupkan session + registrasi owner

**A1. OtpController: buat session, bukan hanya token**
- Di `verify()`: setelah OTP valid, panggil `Auth::login($user, remember: true)` dan `$request->session()->regenerate()` untuk request dari browser (session tersedia). Tetap keluarkan token Sanctum di response untuk klien non-browser. Kembalikan juga `redirect` target berdasar role.
- Karena route `api/*` kena `statefulApi`, request browser same-origin dengan cookie akan punya session — aman.

**A2. Endpoint & action registrasi owner (baru)**
- `app/Actions/Auth/RegisterOwner.php` — dalam satu DB transaction: buat `Tenant` (name = nama usaha, phone = nomor owner), buat `User` (tenant_id, name, phone), `assignRole('owner')`, buat `Outlet` pertama + attach user sebagai owner di pivot. Return user.
- `OtpController` diperluas / controller baru `RegisterController`:
  - `POST /api/auth/register/request-otp` — validasi phone belum terdaftar + nama usaha, kirim OTP.
  - `POST /api/auth/register/verify` — verifikasi OTP, jalankan `RegisterOwner`, `Auth::login`, return redirect ke dashboard.
- Rate limit setara alur login OTP.

**A3. Endpoint owner menambah penjaga (baru)**
- `app/Http/Controllers/PenjagaController.php` (web/Inertia, middleware `auth`):
  - `index` — daftar penjaga dalam tenant owner (Inertia page).
  - `store` — validasi nama + phone (unik), buat `User` (tenant_id owner, role `penjaga`), attach ke outlet terpilih via pivot. Otorisasi: hanya owner (Gate/policy).
  - `destroy` / nonaktifkan — opsional, hanya owner.
- Route di [routes/web.php](routes/web.php) dalam grup `auth,verified`.

**A4. Nonaktifkan registrasi generik Fortify**
- Hapus `Features::registration()` dari [config/fortify.php](config/fortify.php) features (register owner lewat alur OTP sendiri). Sesuaikan/hapus [RegistrationTest](tests/Feature/Auth/RegistrationTest.php).
- Pertahankan `emailVerification`? Owner/penjaga tidak pakai email → longgarkan `verified` middleware atau anggap phone_verified sebagai pengganti. Keputusan implementasi: ganti guard `verified` pada route bisnis menjadi cek `phone_verified_at` (middleware kustom `EnsurePhoneVerified`) supaya tidak menuntut email.

**A5. Fail-closed tenant scope**
- [BelongsToTenant](app/Models/Concerns/BelongsToTenant.php): jika `auth()->user()` ada tapi `tenant_id === null`, tambahkan `whereRaw('1 = 0')` (jangan tampilkan apa pun) alih-alih melewati scope. User tak-terautentikasi (job/console) tetap dikecualikan seperti sekarang. Verifikasi tidak memecah seeder/factory yang berjalan tanpa auth.

**A6. Redirect per-role**
- Helper `App\Support\HomeRoute::for(User $user)`: penjaga → `route('cashier.index')`, owner → `route('dashboard')`.
- Dipakai di response OTP verify + Fortify login redirect (`Fortify::redirects` atau LoginResponse kustom).

## Bagian B — Frontend: UI OTP & onboarding

**B1. Halaman login OTP** ([login.tsx](resources/js/pages/auth/login.tsx) ditulis ulang)
- Dua langkah: (1) input nomor HP → tombol "Kirim kode WhatsApp"; (2) input 6 digit OTP → verifikasi. Auto-format nomor, keyboard numerik, tombol besar. Countdown "kirim ulang" (mengikuti rate limit 5 menit).
- Bahasa Indonesia sederhana, ikon WhatsApp, teks "Kode dikirim ke WhatsApp kamu".
- Setelah verify sukses → redirect ke target dari response (per role).
- Pertahankan opsi passkey/password sebagai link kecil "Masuk dengan cara lain" (untuk owner yang sudah set password), bukan jalur utama.

**B2. Halaman register owner** ([register.tsx](resources/js/pages/auth/register.tsx) ditulis ulang)
- Langkah: nama usaha + nama owner + nomor HP → kirim OTP → verifikasi → masuk. Buat tenant otomatis di backend.

**B3. Halaman kelola penjaga (baru)** `resources/js/pages/penjaga/index.tsx`
- Daftar penjaga (nama, nomor, outlet), form tambah penjaga (nama + nomor + pilih outlet), aksi hapus. Hanya tampil untuk owner (sudah ada gating nav di [app-navigation.tsx](resources/js/components/app-navigation.tsx) — tambah item "Penjaga").
- Tambah item nav "Penjaga" khusus owner.

**B4. Logout & ganti akun**
- Logout sudah membersihkan coordinator offline ([user-menu-content.tsx](resources/js/components/user-menu-content.tsx)). Pastikan session di-invalidate dan IndexedDB per-owner tidak bocor antar akun (sudah keyed per tenant/user).

## Bagian C — Tests

- `tests/Feature/Api/Auth/OtpAuthTest.php` — perbarui: verify OTP kini juga mengautentikasi session (`assertAuthenticated`) + return redirect per role.
- `tests/Feature/Auth/RegisterOwnerTest.php` (baru) — register owner via OTP membuat Tenant + role owner + outlet pertama; phone duplikat ditolak.
- `tests/Feature/PenjagaManagementTest.php` (baru) — owner bisa tambah penjaga (masuk tenant-nya, role penjaga, ter-attach outlet); penjaga tidak bisa (403); penjaga baru bisa login OTP.
- `tests/Feature/TenantScopeTest.php` (baru) — user `tenant_id=null` tidak melihat data tenant lain (fail-closed).
- Sesuaikan/hapus [RegistrationTest](tests/Feature/Auth/RegistrationTest.php) karena register generik dinonaktifkan.

## Verifikasi

1. `php artisan test --compact` — semua hijau (SQLite in-memory).
2. `vendor/bin/pint --dirty` — clean.
3. `vendor/bin/phpstan analyse --no-progress` — 0 errors.
4. `npx tsc --noEmit` + `npx eslint` pada file frontend yang disentuh — clean.
5. `npm run build` sukses.
6. Smoke manual: register owner via UI → cek log OTP (LogWhatsAppGateway) → masuk dashboard → tambah penjaga → logout → login sebagai penjaga → masuk langsung ke halaman kasir.

## Catatan keputusan terbuka (konfirmasi saat implementasi bila perlu)

- Durasi sesi penjaga: pakai `remember: true` (cookie berbulan; sesuai kebutuhan "jangan sering OTP di HP kasir"). Bisa disetel via `config/session.php` lifetime + remember.
- Nasib `Features::emailVerification()` dan halaman verify-email: dipertahankan untuk owner yang kelak menambah email, tapi tidak jadi syarat akses (diganti `phone_verified_at`).
