
# SIAP WANAMSKA V-2.3 🏕️

**Sistem Informasi Administrasi Pangkalan Wanamaskha V-2.3**  
Aplikasi PWA untuk manajemen data anggota Pramuka Pangkalan.

### **FITUR**
- **Login Anggota**: Sistem login dengan ID dan Password
- **PWA / Instalable**: Bisa diinstal jadi aplikasi di HP Android & iOS
- **Offline Mode**: Tetap bisa dibuka walau tidak ada internet
- **Responsive**: Tampilan enak di HP dan Laptop
- **Tema Pramuka**: Warna coklat khas seragam pramuka

### **CARA INSTAL DI HP**
1.  Buka link: https://siap-wanamska-v-2.vercel.app
2.  Tunggu 3 detik, akan muncul popup "Instal aplikasi"
3.  Klik `Instal` 
4.  Icon SIAP WANAMSKA akan muncul di layar HP

### **CARA DEPLOY KE VERCEL**
1.  Download project ini sebagai ZIP
2.  Buka https://vercel.com/new
3.  Klik `a folder` dan pilih folder project ini
4.  `Project Name`: siap-wanamska-v-2
5.  `Framework Preset`: Other
6.  Klik `Deploy`

### **AKUN LOGIN DEMO**
ID: 001 | Password: 1234
ID: 002 | Password: 1234

### **TEKNOLOGI**
- HTML5
- CSS3
- JavaScript Vanilla
- Service Worker untuk PWA
- Deploy di Vercel
Panduan Deploy — Perbaikan SIAP WANAMSKA v3.6.4
Lima permintaan diperbaiki tanpa mengubah fungsi/tampilan lain.
File perbaikan ada di folder ini (siap-fix/).

1. File yang berubah (hanya 4 file)
File	Isi perubahan

index.html
Login: tombol Login + ikon sidik jari berdampingan. Export: 1 tombol Export ▾ + dropdown per modul (Agenda, Absensi, Inventaris, Kas, Kedai).

script.js
Timeout upload materi 120 dtk + verifikasi tersimpan; dashboard instan + pemanasan backend; logika buka/tutup dropdown export.

style.css
Hanya tambahan di akhir file: gaya login-actions, ikon biometrik presisi, dan dropdown export. Aturan lama tidak diubah.

code.gs
Pengganti code(gs).txt: pemasti sheet tepat, saveMateri tahan "DriveApp sibuk", login menyertakan dashboard, + perbaikan otomatis semua sheet.

manifest.json
Kunci orientasi dibuka (any) agar aplikasi terinstal bisa diputar landscape.

sw.js
, 
vercel.json
 tidak diubah.

2. Cara deploy FRONTEND (Vercel)
Ganti file 
index.html
, 
script.js
, 
style.css
, 
manifest.json
 di project Vercel
dengan versi folder ini (atau push/commit 4 file ini saja).
Tunggu deploy selesai, buka aplikasi. Versi 3.5.0 otomatis membersihkan cache lama
dan memuat ulang sekali — itu normal.
Tidak ada perubahan API_URL, jadi frontend tetap jalan walau backend belum di-update
(fitur baru backend aktif setelah langkah backend di bawah).
3. Cara deploy BACKEND (Google Apps Script) — WAJIB agar poin 1–3 penuh
Buka project Apps Script SIAP WANAMSKA → buka file Code.gs.
Blok semua isi lama → hapus → tempel seluruh isi 
code.gs
 dari folder ini.
Simpan (💾), lalu Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.
Jika URL /exec berubah, samakan API_URL di 
script.js
 dengan URL baru lalu deploy ulang frontend.
(Jika URL tetap sama, tidak perlu apa-apa.)
Uji: tambah materi kecil (±1 MB) → harus sukses tanpa pesan DriveApp;
login → dashboard langsung terisi angka.
4. Rincian perbaikan per permintaan
Poin 1 — Seluruh fungsi tepat sheet (backend 
code.gs
)
Daftar header resmi tiap sheet (SHEET_HEADERS) + helper ensureSheet_(): setiap fungsi
simpan (inventaris, peminjaman, kegiatan, agenda, absensi, kas, profil, user, materi,
kedai) kini dipastikan menulis ke sheet & kolom yang benar; sheet dibuat + header
dipasang hanya bila belum ada (data lama tidak disentuh).
Fungsi baca (get*) tetap memakai konstanta sheet yang sama seperti sebelumnya.
exportToExcel/PDF/DOC (lapisan lama) kini memakai _resolveExportSheetName() sehingga
membaca sheet yang tepat walau dipanggil dengan kunci modul (kedai_stok,
kedai_penjualan, …) atau huruf besar/kecil berbeda. Izin export tidak berubah.
saveMateri menolak kategori tak dikenal agar folder Drive selalu tepat.
Poin 2 — Tambah materi: "DriveApp sibuk" padahal file tersimpan
Backend saveMateri: buat file di Drive dicoba ulang 3× dengan jeda;
gagal setSharing tidak lagi menggagalkan simpan (file tetap dicatat ke sheet);
bila error terjadi setelah file terbuat, server mencatat ke sheet lalu tetap
mengembalikan sukses (anti-duplikat via cek fileId).
Batas aman 25 MB (frontend + backend) dengan pesan jelas — file raksasa yang
dulu timeout dan terbaca sebagai error Drive kini dicegah sejak awal.
Frontend: timeout khusus upload 120 detik, cegah klik ganda, dan bila
respons meragukan (timeout/Drive sibuk) otomatis verifikasi ke folder Drive:
kalau file ada → tampil sukses, bukan error.
Poin 3 — Login → dashboard kadang lama
Backend: loginUser & loginWithPasskey membaca sheet hemat kolom, hash password
dihitung seperlunya (hasil pencocokan identik), dan menyertakan data dashboard
dalam respons login sehingga hemat 1× round-trip (±2–5 detik saat cold-start).
Frontend: backend "dipanaskan" sejak halaman login dibuka (GET ringan saat user
mengetik); dashboard memakai cache instan (60 dtk) — angka langsung tampil lalu
disegarkan. Notifikasi lonceng tetap ditunda seperti sebelumnya.
Bila backend lama (belum di-update), frontend otomatis fallback ke alur lama —
tetap jalan, hanya tanpa bonus instan.
Poin 4 — Biometrik jadi ikon sidik jari di samping Login
Baris ATAU + tombol teks panjang diganti satu baris: [ Login (membesar) ][ ikon 🖐 52×48 px ].
Ikon = SVG sidik jari inline 28 px (putih di atas hijau biometrik), presisi dan
tajam di semua layar, tanpa file/URL eksternal.
id tombol (loginBtn, btn-login-passkey) dan onclick tidak berubah,
sehingga handleLogin() / handlePasskeyLogin() dan animasi loading tetap sama.
Poin 5 — Export dirapikan jadi dropdown sesuai hak akses
Tiap modul kini punya satu tombol 📤 Export ▾ → dropdown Excel (.xlsx) → PDF → Word (.docx).
Modul multi-laporan dikelompokkan rapi: Inventaris (Barang Tersimpan + Peminjaman),
Kedai (Data Stok + Riwayat Penjualan + Laporan Hasil Penjualan).
Hak akses tidak berubah: tombol Export muncul hanya untuk peran yang berhak
(aturan lama di applyExportActionUI dipertahankan); item Word (.docx) tetap
khusus Admin (disembunyikan untuk Pembina/Pengelola Kas/Pengelola Kedai).
Dropdown menutup otomatis saat memilih, klik di luar, atau tekan Escape.
Halaman cadangan section-exports (menu tersembunyi) tidak diubah.
5. Checklist uji cepat (±5 menit)
 Login ID+password → dashboard langsung berangka (tanpa backend baru: tetap normal).
 Login sidik jari → sama instannya.
 Tambah materi 1–5 MB → sukses, buka folder → file ada, tidak ada pesan DriveApp.
 Tambah materi >25 MB → ditolak dengan pesan jelas (bukan error teknis).
 Tampilan login: tombol Login + ikon sidik jari sejajar (HP & laptop).
 Admin: tiap modul ada 1 tombol Export ▾ berisi Excel/PDF/Word.
 Pembina: Export Absensi hanya Excel+PDF (tanpa Word); modul lain tanpa Export.
 Pengelola Kas (DGW20264/65): Export Kas hanya Excel+PDF.
 Pengelola Kedai (DGW202638/641): Export Kedai hanya Excel+PDF per kelompok.
 Simpan agenda/inventaris/kas/kedai/absensi → data masuk sheet yang benar.
6. Tambahan v3.5.0 — Sheet otomatis + landscape penuh
Sheet (backend):

initializeDatabase() kini juga membuat sheet ke-15 yang belum ada: Laporan Template
(+ baris default Global). Total 16 sheet baku (termasuk potensi_game).
Fungsi baru repairDatabaseSchema() — dijalankan sekali dari editor Apps Script
(atau via API oleh Admin) untuk memeriksa & membuatkan sheet/header yang hilang,
memastikan folder Drive Kedai, dan mengisi akun admin default bila sheet Users
kosong. Idempoten: aman dijalankan berulang, data lama tidak diubah.
Semua fungsi baca (getUserList, getAbsenHistory, getKasData, getAgendaList,
getKegiatanList, getInventarisList, getPeminjamanList, getPotensiList,
getHasilKedaiList, getUserProfile, getSystemLogs, changePassword) dan
writeLog kini otomatis membuatkan sheet + header bila belum ada
(hasil tetap: daftar kosong, bukan error). Fungsi hapus tetap ketat
(tidak membuat sheet) — sesuai perilakunya.
Cache frontend ikut dibersihkan setelah operasi repair*.
Landscape (frontend):


manifest.json
: kunci portrait-primary dibuka → any, sehingga aplikasi
terinstal mengikuti putaran perangkat.
Background login fullscreen + tidak pernah terpotong (v3.5.2, teknik dua lapis):
.login-bg-fill (gambar sama, diburamkan, cover) menutup seluruh layar tanpa
ruang kosong; .login-bg-image (gambar tajam, contain) tampil utuh di atasnya.
Berlaku di portrait maupun landscape; lapisan dikunci ke viewport (fixed).
Gambar background adalah potret → di layar portrait tampil nyaris penuh;
di landscape tampil utuh dengan bingkai buram senada gambar (fullscreen, tanpa crop).
Galeri Baca Berita (frontend):

Aturan galeri foto sebelumnya hanya ada di @media <=768px, sehingga di layar
lebar foto tampil mentah/rusak. Kini ada aturan dasar [3.7]: grid + ukuran foto
benar di semua ukuran layar (desktop, portrait, landscape).
Tiap foto galeri punya cadangan otomatis: bila URL foto rusak, diganti logo
aplikasi (tidak pernah ikon gambar rusak).
Galeri Baca Berita — perbaikan URL foto (v3.5.1):

Akar masalah foto tidak tampil: URL foto Drive tersimpan dalam format yang
tidak selalu bisa disematkan (lh3..., /file/d/.../view, open?id=).
Backend: getKegiatanList kini melewatkan foto1–4 ke normalisasiUrlFotoDrive_()
→ selalu menjadi thumbnail?id=...&sz=w1600 (format paling andal untuk <img>);
unggahan baru (uploadImageToDrive) langsung menyimpan format ini.
Frontend: fungsi khusus renderGaleriBeritaKegiatan() dipanggil setiap
"Baca Berita" diklik — menormalkan URL (termasuk respons API lama), membangun
grid foto, menulis hitungan "(N foto)" pada judul galeri, dan mengganti foto
gagal-muat dengan logo aplikasi. Tidak perlu deploy backend untuk menampilkan
foto lama — cukup deploy frontend (
script.js
).
Cara uji: buka Dokumentasi → klik berita → judul galeri harus tertulis
"(N foto)" dan foto tampil; klik foto untuk memperbesar.
Cara uji putaran layar (setelah deploy):

Di HP: aktifkan Rotasi otomatis (pengaturan perangkat).
Buka aplikasi (mode browser) → putar HP → tampilan wajib mengikuti.
Aplikasi terinstal (PWA): tutup total lalu buka ulang agar manifest baru
(orientation: any) terbaca; bila masih terkunci, hapus & instal ulang PWA-nya.
Login: gambar Pramuka tampil utuh (tidak terpotong) di portrait & landscape.
7. Rollback (jaga-jaga)
Frontend: kembalikan 4 file lama (
index.html
, 
script.js
, 
style.css
, 
manifest.json
) + deploy ulang.
Backend: di Apps Script gunakan Manage deployments → pilih versi sebelumnya.
Kedua arah kompatibel (frontend baru × backend lama, atau sebaliknya).
GAME "KENALI POTENSIMU" (v3.6.0)
Modul Kenali Potensimu kini berupa game gamifikasi SKU Penggalang — media
belajar di rumah sekaligus peningkat keaktifan, pengetahuan, dan keterampilan
kepramukaan (usia 11–15, SMP).

Fitur:

3 golongan × 3 level × 5 soal = 45 soal pilihan ganda materi SKU:
Ramu (pondasi, Dasa Dharma–Trisatya, keterampilan dasar), Rakit (tali-temali,
navigasi & survival), Terap (pionering lanjut, berkemah & ZIP, kepemimpinan & sandi).
Berjenjang: Level berikutnya terbuka setelah level sebelumnya selesai.
Nilai ditampilkan per level (skala 0–100 + bintang) dan poin total per golongan.
Bekal Singkat sebelum kuis tiap level: ringkasan materi agar pemain
benar-benar memahami pramuka, bukan sekadar menebak.
Pangkat kepramukaan mengikuti total poin: Tamu Penggalang → Ramu →
Rakit → Terap → Garuda, dengan sisa poin menuju pangkat berikutnya.
Efek interaktif: bunyi benar/salah/tuntas (bisa dimatikan 🔊/🔇), konfeti
saat lulus level, combo streak 🔥 jawaban benar beruntun.
Setiap jawaban muncul pembahasan → langsung menjadi media belajar.
Layar penuh otomatis saat tombol "Mainkan" diklik (boleh ditolak, game tetap jalan).
Anti-curang: kunci jawaban hanya ada di server (code.gs), pilihan diacak,
soal yang sudah dijawab tidak bisa dijawab ulang untuk menambah poin.
Tahan tutup-layar: progres tersimpan di sheet potensi_game setiap jawaban;
layar tertutup/HP terkunci/aplikasi ditutup → buka lagi, tekan "Lanjutkan",
permainan berlanjut dari soal yang belum dijawab.
Papan Skor (20 besar, semua pengguna) untuk memotivasi keaktifan.
Materi per golongan dari Google Drive (lihat di bawah).
[v3.6.4] Fitur penugasan (+ Tambah Penugasan, arsip, modal form) dihapus —
modul murni game gamifikasi. Data penugasan lama tetap aman di sheet
potensi_arsip (bisa dilihat langsung di Google Sheet).
Folder materi — DIBUAT OTOMATIS (v3.6.1):

Backend kini membuat sendiri subfolder Materi Ramu, Materi Rakit,
Materi Terap di dalam folder Drive gudep:
https://drive.google.com/drive/folders/1m5x062c0DIDMNeA_RXYNG12U8kp86gG-
— otomatis saat Admin pertama kali membuka tombol "📖 Materi" di game,
atau jalankan sekali fungsi siapkanFolderMateriPotensi(tokenAdmin) dari
editor Apps Script.
Admin tinggal mengunggah file materi (PDF/gambar/dokumen) ke
subfolder yang sudah terbentuk tersebut.
Tombol "📖 Materi" di game otomatis membaca isinya (tanpa ubah kode).
Deploy (frontend + backend):

Frontend ke Vercel: 
index.html
, 
style.css
, 
script.js
, 
potensi-game.js
 (baru).
Backend: tempel seluruh 
code.gs
 → New version → Deploy.
Sheet potensi_game dibuat otomatis saat pertama dipakai (atau jalankan
repairDatabaseSchema sekali dari editor Apps Script).
Ceklis uji:

Login (semua peran) → menu Kenali Potensimu → tampil 3 kartu golongan.
Klik "Mainkan" → layar penuh → peta level → mainkan Level 1 → muncul
Bekal Singkat → "Aku Siap, Mulai Kuis" → jawab soal → muncul
pembahasan + poin + bunyi; selesai 5 soal → nilai + bintang + konfeti →
Level 2 terbuka. Banner pangkat naik seiring poin bertambah.
Tutup aplikasi di tengah soal → buka lagi → "Lanjutkan" → berlanjut dari
soal yang belum dijawab, poin tidak hilang.
Tombol "🏆 Papan Skor" menampilkan peringkat; "📖 Materi" menampilkan isi
subfolder Drive golongan tersebut.
Modul lain tetap normal (Dashboard, Kas, Absensi, Dokumentasi, dll.).
SHEET "POTENSI" → PANTAUAN ADMIN (v3.6.2)
Sheet potensi kini menjadi lembar pantauan kemampuan siswa dalam
mengerjakan Game Kenali Potensimu. Header barunya:

user_id | nama_lengkap | role | soal_dijawab | jawaban_benar | jawaban_salah | total_poin | nilai_persen | pangkat | progres_ramu | progres_rakit | progres_terap | terakhir_aktivitas

Satu baris per user, urut poin tertinggi; nilai_persen = poin/450,
pangkat mengikuti gelar game, progres_* format benar/15 • Ppoin.
Data lama penugasan dipindah otomatis ke sheet baru potensi_arsip
saat pertama kali pantauan dibuka (tidak ada data hilang).
Di aplikasi: tombol "📊 Pantauan Siswa" (hanya tampak untuk Admin,
di bawah kartu golongan) menampilkan rekap yang sama + menyegarkan sheet.
Fungsi penugasan lama (arsip) & notifikasi otomatis mengarah ke
potensi_arsip — perilaku tampilan tidak berubah.
Tidak ada sheet/fungsi modul lain yang diubah.
Deploy: sama seperti v3.6.1 (frontend 4 file + 
code.gs
). Setelah deploy,
Admin cukup membuka "📊 Pantauan Siswa" satu kali — sheet potensi langsung
terisi rekap, sheet potensi_arsip terbentuk bila ada data penugasan lama.

GERBANG AKTIVASI GAME (v3.6.3)
Sesuai permintaan: fitur Kenali Potensimu baru berfungsi setelah Admin
membuka folder materinya.

Saat menu dibuka, aplikasi memeriksa folder Drive (fungsi
getPotensiFolderStatus): jika 3 subfolder (Ramu/Rakit/Terap) belum ada,
game terkunci.
Admin melihat kartu "🔓 Aktifkan Game Kenali Potensimu" — satu klik
pada "Buka Folder & Aktifkan Game": subfolder dibuat otomatis di dalam
folder gudep, tautan folder Drive muncul untuk dibuka (unggah materi),
lalu game langsung bisa dimainkan.
Peran lain (Pembina/Dewan/Penggalang) melihat "⏳ Game Belum
Diaktifkan — hubungi Admin".
Aktivasi sekali saja (terdeteksi dari adanya subfolder — tanpa flag
tambahan); setelah itu game langsung berjalan untuk semua pengguna.
Tidak ada modul/sheet lain yang disentuh.
FITUR PENUGASAN DIHAPUS + GAME AKTIVASI DIPASTIKAN (v3.6.4)
Tombol "+ Tambah Penugasan", modal form penugasan, tombol "📚 Arsip
Penugasan", dan seluruh fungsi frontend-nya dihapus dari modul
Kenali Potensimu (menu kini bersih: hanya game + papan skor + pantauan Admin).
Referensi tombol di RBAC (setupRBACUI) ikut dibersihkan — tidak ada
error null; modul lain tidak tersentuh (fungsi backend penugasan lama
dibiarkan menganggur, tanpa dampak).
Game benar-benar muncul setelah "Buka Folder & Aktifkan Game":
status folder kini selalu diperiksa segar (tanpa cache) dan setelah
aktivasi sukses: cache dibersihkan → kartu "✅ Game Aktif!" → game
terbuka otomatis 2,5 detik kemudian (atau klik "🎮 Mulai Game Sekarang").
Teruji: admin aktifkan → launcher 3 golongan tampil otomatis; alur
bekal → kuis → hasil tetap normal; penggalang sebelum aktivasi tetap
terkunci; tidak ada referensi tersisa ke fitur penugasan.

### **KREDIT**
Dibuat oleh: Pembina Pramuka Pangkalan Wanamaskha
Tahun: 2026

Semoga bermanfaat untuk adik-adik Pramuka 🙏
