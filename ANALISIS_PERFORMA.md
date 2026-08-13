# Diagnosa & Perbaikan Performa — SIAP WANAMSKA V-2.3

Keluhan: **login kadang lama** dan **membaca data tersimpan lama**.

Setelah menelaah `script.js` (frontend) dan `code.gs` (backend Apps Script),
ditemukan beberapa akar masalah dan sudah diperbaiki.

---

## 🔴 Akar Masalah Utama

### A. Login tertahan menunggu GPS (frontend)
`requestGPSPermission()` dipanggil saat aplikasi dibuka, **sebelum** user login,
dan menampilkan loader penuh *"Mendapatkan sinyal koordinat GPS..."* sambil
memaksa GPS mencari fix satelit baru:
```js
setLoader(true, "Mendapatkan sinyal koordinat GPS...");
{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
```
Akibatnya layar login baru bisa dipakai setelah GPS selesai (bisa 5–15 detik).

### B. Notifikasi membaca 5 sheet sekaligus saat login (backend)
`getNotificationList()` membaca **seluruh** isi sheet Agenda, Kegiatan, Inventaris,
Kas, dan Absensi setiap kali login (dipanggil `setupRBACUI` → `loadNotifications`).
Ditambah `getDashboardData()` yang membaca 4 sheet penuh. Satu kali login =
~10 pembacaan sheet penuh + kemungkinan *cold start* Apps Script.

### C. Semua daftar dibaca penuh tanpa batas (backend)
`getAbsenHistory`, `getKegiatanList`, `getInventarisList`, `getAgendaList`,
`getUserList`, `getSystemLogs`, `getNotificationList` menggunakan
`getDataRange().getValues()` → membaca **semua baris** lalu mengirim semua hasil.
Makin banyak data, makin lambat (tidak berskala).

### D. Foto lama masih berupa Base64 di dalam sheet (backend)
Data absensi/kegiatan lama masih menyimpan foto sebagai teks `data:image/...`
(ratusan KB per baris). Response JSON jadi membengkak sehingga baca data terasa
sangat lambat. (Data baru sudah benar: diunggah ke Drive dan disimpan sebagai URL.)

### E. Panggilan berulang & tanpa timeout (frontend)
- `loadDashboard()` dipanggil dua kali setiap login (sekali di `handleLogin`/restore
  sesi, sekali lagi di dalam `showPage` → `switchSection`).
- `callAPI()` tidak punya timeout, tidak ada cache, sehingga setiap klik menu
  memanggil ulang Apps Script meski datanya belum berubah.

---

## ✅ Perbaikan yang Sudah Diterapkan

### Frontend (`script.js`)
1. **GPS tidak lagi menahan login** — loader dihapus, akurasi dilonggarkan
   (`enableHighAccuracy: false`, `maximumAge: 5 menit`). GPS presisi tinggi tetap
   dipakai saat absensi (`actionSubmitAbsen`).
2. **Cache data baca 60 detik** — `callAPI` menyimpan hasil fungsi baca
   (`getDashboardData`, `getAbsenHistory`, dll.) agar navigasi antar-menu tidak
   memanggil server berulang. Otomatis dibuang setelah ada operasi tulis.
3. **Timeout 30 detik + pesan jelas** di `callAPI` (pakai `AbortController`).
4. **Notifikasi ditunda** 2 detik setelah login (tidak lagi memblokir masuk ke
   dashboard).
5. **Hapus pemanggilan `loadDashboard()` ganda** saat login.
6. **Menambahkan fungsi `viewFullImage()`** yang sebelumnya dipanggil tapi belum
   pernah didefinisikan (klik foto absensi kini berfungsi).
7. Versi aplikasi dinaikkan ke `2.5.1` + query string `script.js?v=2.5.1` agar
   pengguna lama yang masih ter-cache service worker mendapat file terbaru.

### Backend (`code.gs`)
1. **Helper `getRecentRows(sheet, N)`** — hanya membaca N baris **terakhir**
   (data terbaru), bukan seluruh sheet.
2. **`getNotificationList`** — cukup baca 40 baris terakhir tiap sheet (sebelumnya
   seluruh baris).
3. **`getDashboardData`** — cukup ambil 1 sel untuk kegiatan terbaru & saldo kas,
   serta 500 baris terakhir absensi (sebelumnya 4 sheet penuh).
4. **`getAbsenHistory`** — batasi 800 baris terakhir + **saring base64 foto**
   (`cleanImageValue`) agar JSON tidak membengkak.
5. **`getKegiatanList`, `getInventarisList`, `getAgendaList`, `getUserList`,
   `getSystemLogs`** — dibatasi baris terakhir + saring base64 foto.

---

## 📌 Yang Masih Perlu Diperhatikan (di luar repo / rekomendasi lanjutan)

1. **Cold start Apps Script** — setiap deployment baru/dingin butuh 2–5 detik
   untuk panggilan pertama. Tidak bisa dihilangkan total dari kode; makin sedikit
   panggilan (sudah dikurangi) makin terasa ringan.
2. **`writeLog()` memakai `appendRow` di banyak aksi** (absen, simpan, dll.).
   `appendRow` adalah operasi Sheets yang relatif lambat. Bisa di-*batch* atau
   dihapus dari alur kritis bila ingin lebih cepat lagi.
3. **`getMateriFileList`** mengiterasi file Drive + menulis ulang ke sheet setiap
   dibuka. Bisa di-cache (mis. hanya sinkron tiap beberapa jam).
4. **`getKasData`** tetap membaca penuh demi akurasi total pemasukan/pengeluaran.
   Bila kas sudah ribuan baris, pertimbangkan pagination atau hitung total dari
   kolom `saldo_berjalan` baris terakhir.
5. **Paginasi sejati** (muat bertahap) adalah solusi jangka panjang bila data
   terus bertambah. Saat ini dipakai batas baris terakhir sebagai pengganti cepat.
6. **URL Apps Script di `script.js` vs `vercel.json` berbeda** — pastikan keduanya
   menunjuk deployment yang sama agar tidak membingungkan (saat ini frontend
   memakai `AKfycbwAxShOx...` langsung, proxy `/api` di vercel.json tidak terpakai).

---

## Cara Menerapkan Perbaikan Backend
1. Buka Google Apps Script (backend SIAP WANAMSKA).
2. Tempel/sinkronkan isi `code.gs` hasil perbaikan.
3. **Deploy → New deployment / Manage deployments → Web app**.
4. Salin URL `/exec` baru dan pastikan `API_URL` di `script.js` menunjuk ke URL
   tersebut.
5. Redeploy frontend di Vercel (atau cukup push branch ini).

> Catatan: perubahan frontend sudah siap di branch ini; perubahan backend di
> `code.gs` harus kamu tempel manual ke editor Apps Script karena backend tidak
> di-host di repo ini.
