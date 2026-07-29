// GANTI dengan URL Web App Apps Script kamu (Deploy > Manage deployments)
const API_URL = "https://script.google.com/macros/s/AKfycbyBjTe9nFKuF_gAeWh6OiZMnqSI4gq3a3KRIIm-mRC12vyJ9ozO2jADOW10VBQLZDMvsg/exec";

// VERSI APLIKASI UNTUK RESET CORRUPT PWA CACHE (Ditingkatkan ke 2.1.1)
const APP_VERSION = "2.1.1"; 

let sessionToken = "";
let userRole = "";
let userId = "";
let currentUser = null;

let streamRef = null;
let base64SelfieString = "";
let currentFacingMode = "user"; // Menyimpan status kamera ("user" untuk depan, "environment" untuk belakang)

// PERBAIKAN: Penyimpanan memori array global untuk mencegah crash parsing data string di HTML inline
let agendaList = [];
let kegiatanList = [];
let inventarisList = [];
let userList = [];

// KONFIGURASI GEOFENCING MANDIRI
const OFFICE_LAT = -7.56354193439929;
const OFFICE_LNG = 110.8307413078518;
const MAX_RADIUS = 100.0; // Radius toleransi (Meter)
let isLocationValid = false; // Status kesesuaian geolokasi
let detectedLat = "";
let detectedLng = "";

async function callAPI(funcName, params = []) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ func: funcName, params: params })
  });
  const response = await res.json();
  if (response.status === 'success') return response.data;
  else throw new Error(response.message);
}

document.addEventListener('DOMContentLoaded', function () {
  // LOGIKA ANTISIPASI CORRUPT SERVICE WORKER
  if (localStorage.getItem("app_version") !== APP_VERSION) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
    if ('caches' in window) {
      caches.keys().then(function (names) {
        for (let name of names) {
          caches.delete(name);
        }
      });
    }
    localStorage.setItem("app_version", APP_VERSION);
    console.log("Sistem mendeteksi pembaruan versi " + APP_VERSION + ". Cache usang telah dibersihkan.");
  }

  sessionToken = sessionStorage.getItem('sessionToken');
  const userData = sessionStorage.getItem('user');
  if (sessionToken && userData) {
    currentUser = JSON.parse(userData);
    userRole = currentUser.role;
    userId = currentUser.user_id;

    document.getElementById('user-display-name').innerText = currentUser.nama_lengkap;
    document.getElementById('user-display-role').innerText = userRole;

    setupRBACUI(userRole);
    showPage('dashboard-page');
    loadDashboard();
  } else {
    showPage('login-page');
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }

  // Inisialisasi widgets pada Dashboard
  initLiveTimer();
  initCreativeCalendar();
});

/* PWA Hooks */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const box = document.getElementById('installPWABox');
  if (box) box.style.display = 'block';
});
document.getElementById('btnInstallPWA')?.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt = null;
    document.getElementById('installPWABox').style.display = 'none';
  }
});

/* SPA Routing */
function showPage(pageId) {
  if (pageId === 'login-page' || pageId === 'login-screen') {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
    return;
  }
  if (pageId === 'dashboard-page') {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    switchSection('section-dashboard');
    return;
  }
  const sections = document.querySelectorAll('.app-section');
  sections.forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
  const target = document.getElementById(pageId);
  if (target) { target.classList.add('active'); target.style.display = 'block'; }
}

function showToast(message, isDanger = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${isDanger ? 'danger' : ''}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function setLoader(show, text = "Sedang memproses data...") {
  const loader = document.getElementById('global-loader');
  const loaderText = document.getElementById('loader-text');
  if (!loader) return;
  if (show) { loaderText.innerText = text; loader.style.display = 'flex'; }
  else { loader.style.display = 'none'; }
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.overlay');
  if (sidebar) {
    sidebar.classList.toggle('active'); // mobile drawer
    sidebar.classList.toggle('collapsed'); // desktop collapse
  }
  if (overlay && window.innerWidth <= 768) {
    overlay.classList.toggle('active');
  }
}

function switchSection(sectionId, elementMenu) {
  const sections = document.querySelectorAll('.app-section');
  sections.forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });

  const target = document.getElementById(sectionId);
  if (target) { target.classList.add('active'); target.style.display = 'block'; }

  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => item.classList.remove('active'));
  if (elementMenu) elementMenu.classList.add('active');

  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.overlay');
  if (sidebar && overlay) {
    sidebar.classList.remove('active');
    if (window.innerWidth <= 768) {
      overlay.classList.remove('active');
    }
  }

  if (sectionId === 'section-dashboard') loadDashboard();
  else if (sectionId === 'section-absensi') {
    // NOTIFIKASI AKTIFKAN LOKASI SAAT MENGGUNAKAN MODUL ABSENSI
    showToast("⚠️ PENTING: Harap aktifkan GPS/Lokasi perangkat Anda sebelum absensi!");
    initGeofenceCheck(); // Jalankan proteksi koordinat fisik
    loadAbsenHistory();
  }
  else if (sectionId === 'section-kegiatan') loadKegiatan();
  else if (sectionId === 'section-agenda') loadAgenda();
  else if (sectionId === 'section-inventaris') loadInventaris();
  else if (sectionId === 'section-kas') loadKas();
  else if (sectionId === 'section-profile') loadProfileDiri();
  else if (sectionId === 'section-users') loadUsers();
  else if (sectionId === 'section-exports') { }
  else if (sectionId === 'section-logs') loadSystemLogs();
}

// =========================================================================
// === MANAJEMEN LIVE WIDGETS                                            ===
// =========================================================================

function initLiveTimer() {
  setInterval(() => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('id-ID', options);
    
    const timerEl = document.getElementById('widget-timer');
    const dateEl = document.getElementById('widget-date');
    if (timerEl) timerEl.innerText = `${hrs}:${mins}:${secs}`;
    if (dateEl) dateEl.innerText = dateStr;
  }, 1000);
}

function initCreativeCalendar() {
  const now = new Date();
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  
  const monthYearEl = document.getElementById('calendar-month-year');
  if (monthYearEl) {
    monthYearEl.innerText = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  }
  
  const grid = document.getElementById('calendar-grid-cells');
  if (!grid) return;
  grid.innerHTML = "";
  
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const startDayIndex = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  for (let i = 0; i < startDayIndex; i++) {
    grid.innerHTML += `<span class="empty-day"></span>`;
  }
  
  const today = now.getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const isActive = day === today ? "active-day" : "";
    grid.innerHTML += `<span class="${isActive}">${day}</span>`;
  }
}

// =========================================================================
// === MANAJEMEN GEOFENCING & DETEKSI FAKE GPS                           ===
// =========================================================================

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius Bumi (Meter)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function runFakeGPSCheck(position) {
  const coords = position.coords;

  // Lapis 1: Periksa flag mocked internal browser
  if (coords.mocked === true || coords.isFromMockProvider === true || coords.accuracy === 0) {
    return { isFake: true, reason: "Terdeteksi driver manipulasi lokasi (Mocked)." };
  }

  // Lapis 3: Validasi perbedaan waktu GPS dan waktu lokal browser
  const timeDiff = Math.abs(Date.now() - position.timestamp);
  if (timeDiff > 10000) { // Toleransi maksimal 10 detik
    return { isFake: true, reason: "Waktu respons GPS tidak sinkron (Deteksi putar jam lama)." };
  }

  // Lapis 2: Analisis kecepatan perpindahan tidak wajar (anti-teleportasi)
  try {
    const history = localStorage.getItem("wanamska_gps_history");
    if (history) {
      const lastPoint = JSON.parse(history);
      const timeElapsed = (position.timestamp - lastPoint.timestamp) / 1000;

      if (timeElapsed > 0 && timeElapsed <= 10) {
        const distanceMoved = calculateHaversineDistance(
          lastPoint.latitude,
          lastPoint.longitude,
          coords.latitude,
          coords.longitude
        );

        // Jika berpindah lebih dari 500 meter dalam waktu kurang dari 5 detik
        if (distanceMoved > 500 && timeElapsed <= 5) {
          return { isFake: true, reason: "Perpindahan koordinat terlampau cepat (Teleportasi)." };
        }
      }
    }
  } catch (err) {
    console.error(err);
  }

  // Simpan data koordinat aktual
  localStorage.setItem(
    "wanamska_gps_history",
    JSON.stringify({
      latitude: coords.latitude,
      longitude: coords.longitude,
      timestamp: position.timestamp,
    })
  );

  return { isFake: false };
}

function initGeofenceCheck() {
  const statusBox = document.getElementById('geofence-status-box');
  const submitBtn = document.getElementById('btn-submit-absen');
  if (!statusBox || !submitBtn) return;

  // Lock tombol kirim absensi sebelum sensor lokasi selesai divalidasi
  isLocationValid = false;
  submitBtn.disabled = true;
  submitBtn.style.opacity = "0.5";
  submitBtn.style.cursor = "not-allowed";

  statusBox.style.backgroundColor = "#FEF08A";
  statusBox.style.color = "#713F12";
  statusBox.style.border = "1px dashed #F59E0B";
  statusBox.innerText = "⏳ Memeriksa jangkauan GPS... Harap aktifkan lokasi perangkat Anda.";

  if (!navigator.geolocation) {
    statusBox.style.backgroundColor = "#FDE8E8";
    statusBox.style.color = "#9B1C1C";
    statusBox.style.border = "none";
    statusBox.innerText = "❌ Browser Anda tidak mendukung sensor geolokasi.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const { latitude, longitude } = position.coords;

      // Jalankan proteksi manipulasi Fake GPS
      const fakeCheck = runFakeGPSCheck(position);
      if (fakeCheck.isFake) {
        statusBox.style.backgroundColor = "#FDE8E8";
        statusBox.style.color = "#9B1C1C";
        statusBox.style.border = "2px dashed #B91C1C";
        statusBox.innerText = "🚨 Terdeteksi Fake GPS! Modifikasi lokasi dilarang.";
        showToast("Fake GPS Terdeteksi: " + fakeCheck.reason, true);
        return;
      }

      // Hitung sisa jarak fisik ke titik koordinat kantor
      const distance = calculateHaversineDistance(latitude, longitude, OFFICE_LAT, OFFICE_LNG);
      const roundedDistance = Math.round(distance);

      detectedLat = latitude;
      detectedLng = longitude;

      if (distance > MAX_RADIUS) {
        statusBox.style.backgroundColor = "#FDE8E8";
        statusBox.style.color = "#9B1C1C";
        statusBox.style.border = "none";
        statusBox.innerText = "❌ Anda berada di luar area kantor. Jarak: " + roundedDistance + "m (Maksimal: 100m)";
      } else {
        isLocationValid = true;
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
        statusBox.style.backgroundColor = "#DEF7EC";
        statusBox.style.color = "#03543F";
        statusBox.style.border = "none";
        statusBox.innerText = "✅ Jangkauan Valid! Jarak Anda: " + roundedDistance + " meter dari titik kantor.";
      }
    },
    function (error) {
      statusBox.style.backgroundColor = "#FDE8E8";
      statusBox.style.color = "#9B1C1C";
      statusBox.style.border = "none";
      let errMsg = "❌ Gagal memindai sensor lokasi GPS.";
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errMsg = "❌ Izin lokasi ditolak. Aktifkan izin GPS pada browser.";
          break;
        case error.POSITION_UNAVAILABLE:
          errMsg = "❌ Sensor koordinat tidak aktif. Aktifkan fitur GPS ponsel.";
          break;
        case error.TIMEOUT:
          errMsg = "❌ Waktu request sensor GPS habis (Timeout). Coba lagi.";
          break;
      }
      statusBox.innerText = errMsg;
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// =========================================================================
// === MANAJEMEN LOGIN / LOGOUT & RBAC                                  ===
// =========================================================================

// ... (Seluruh kode manajemen sesi login/logout tetap dipertahankan sepenuhnya) ...

// =========================================================================
// === PROSES SUBMIT ABSENSI TERINTEGRASI GEOFENCING                      ===
// =========================================================================

function actionSubmitAbsen() {
  const status = document.getElementById('absen-status').value;
  const metode = document.getElementById('absen-metode').value;
  const kegiatanCode = document.getElementById('absen-kegiatan-id').value;
  const keterangan = document.getElementById('absen-keterangan').value;

  // Proteksi mutlak: Jika status Hadir, lokasi wajib valid (berada di dalam geofence dan bebas Fake GPS)
  if (status === "Hadir" && !isLocationValid) {
    showToast("Pendaftaran absen ditolak! Anda berada di luar koordinat jangkauan atau terindikasi melakukan pemalsuan lokasi.", true);
    return;
  }

  if (status === "Hadir" && metode === "Selfie" && !base64SelfieString) {
    showToast("Harap lakukan foto selfie terlebih dahulu sebelum absensi!", true); return;
  }
  if (status === "Hadir" && metode === "Manual" && !kegiatanCode) {
    showToast("Harap isi kode kegiatan pelaksanaan absensi!", true); return;
  }

  setLoader(true, "Mengirim data absensi...");

  // Mengirimkan data koordinat geografis (detectedLat dan detectedLng) sebagai argumen ke-7 dan ke-8 untuk diverifikasi ulang di server Apps Script
  callAPI('submitAbsen', [sessionToken, status, base64SelfieString, metode, kegiatanCode, keterangan, detectedLat, detectedLng])
    .then(res => {
      setLoader(false);
      if (res.success) {
        showToast(res.message);
        stopCamera();
        document.getElementById('absen-kegiatan-id').value = "";
        document.getElementById('absen-keterangan').value = "";
        loadAbsenHistory();
      } else {
        showToast(res.message, true);
      }
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function loadAbsenHistory() {
  const filter = document.getElementById('filter-absen-date').value;

  callAPI('getAbsenHistory', [sessionToken, filter])
    .then(res => {
      if (res.success) {
        const tbody = document.getElementById('body-riwayat-absen');
        tbody.innerHTML = "";
        if (res.list.length === 0) {
          tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Belum terdapat riwayat absensi.</td></tr>`;
          return;
        }
        res.list.forEach(row => {
          let badgeClass = row.status === "Hadir" ? "badge-hadir" : row.status === "Izin" ? "badge-izin" : "badge-sakit";
          let imgTag = row.foto_base64 ? `<img src="${row.foto_base64}" style="width: 60px; height: 90px; border-radius:4px; object-fit:cover; cursor:pointer;" onclick="viewFullImage('${row.foto_base64}')">` : "Tidak Ada";
          tbody.innerHTML += `
            <tr>
              <td>${row.tanggal} <br> <span style="font-size:0.75rem; color:var(--color-text-muted);">${row.jam}</span></td>
              <td><strong>${row.nama}</strong><br><span style="font-size:0.75rem;">${row.user_id}</span></td>
              <td><span class="badge ${badgeClass}">${row.status}</span></td>
              <td>${row.metode}</td>
              <td>${row.kegiatan || "-"} <br> <span style="font-size:0.8rem; font-style:italic;">${row.keterangan || ""}</span></td>
              <td>${imgTag}</td>
            </tr>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function viewFullImage(base64) {
  const w = window.open();
  w.document.write(`<img src="${base64}" style="max-width:100%; height:auto;" />`);
}

function showAbsenPage() {
  showPage('absen-page');
  document.getElementById('tanggalAbsen').value = new Date().toISOString().substring(0, 10);
  loadDaftarAnggota();
}

function kembaliKeDashboard() { showPage('dashboard-page'); }

// =========================================================================
// === FITUR AGENDA KEGIATAN                                             ===
// =========================================================================

function loadAgenda() {
  callAPI('getAgendaList', [sessionToken])
    .then(res => {
      if (res.success) {
        agendaList = res.list; // PERBAIKAN: Simpan data ke array global
        const tbody = document.getElementById('body-agenda');
        tbody.innerHTML = "";
        if (res.list.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Belum ada agenda terdaftar.</td></tr>`;
          return;
        }
        const isPengurus = ["Admin", "Pembina", "Dewan Penggalang"].indexOf(userRole) !== -1;
        const isAdmin = userRole === "Admin";
        
        res.list.forEach((agd, index) => {
          let actionButtons = "";
          if (isPengurus) {
            // PERBAIKAN: Oper indeks array, bukan JSON stringify
            actionButtons += `<button class="btn" style="padding:6px 10px; margin-right:5px;" onclick="openAgendaModal(${index})">Edit</button>`;
          }
          if (isAdmin) {
            actionButtons += `<button class="btn btn-danger" style="padding:6px 10px;" onclick="actionDeleteAgenda('${agd.id_agenda}')">Hapus</button>`;
          }

          tbody.innerHTML += `
            <tr>
              <td><strong>${agd.kegiatan}</strong></td>
              <td>${agd.jenis_kegiatan}</td>
              <td>${agd.tanggal_pelaksanaan}</td>
              <td>${agd.waktu}</td>
              <td>${agd.penanggung_jawab}</td>
              <td>${agd.keterangan || "-"}</td>
              <td class="opsi-cell">${actionButtons || "-"}</td>
            </tr>`;
        });
        
        const optionHeaders = document.querySelectorAll('.opsi-header');
        const optionCells = document.querySelectorAll('.opsi-cell');
        if (!isPengurus) {
          optionHeaders.forEach(el => el.style.display = 'none');
          optionCells.forEach(el => el.style.display = 'none');
        } else {
          optionHeaders.forEach(el => el.style.display = '');
          optionCells.forEach(el => el.style.display = '');
        }
      }
    })
    .catch(err => showToast(err.message, true));
}

function openAgendaModal(indexOrObj) {
  let selectedAgd = null;
  if (typeof indexOrObj === 'number') {
    selectedAgd = agendaList[indexOrObj];
  } else {
    selectedAgd = indexOrObj;
  }
  
  document.getElementById('agenda-modal-title').innerText = selectedAgd ? "Form Edit Agenda" : "Form Tambah Agenda";
  document.getElementById('agd-id').value = selectedAgd ? selectedAgd.id_agenda : "";
  document.getElementById('agd-kegiatan').value = selectedAgd ? selectedAgd.kegiatan : "";
  document.getElementById('agd-jenis').value = selectedAgd ? selectedAgd.jenis_kegiatan : "";
  document.getElementById('agd-tanggal').value = selectedAgd ? selectedAgd.tanggal_pelaksanaan : "";
  document.getElementById('agd-waktu').value = selectedAgd ? selectedAgd.waktu : "";
  document.getElementById('agd-pj').value = selectedAgd ? selectedAgd.penanggung_jawab : "";
  document.getElementById('agd-keterangan').value = selectedAgd ? selectedAgd.keterangan : "";
  document.getElementById('modal-agenda').style.display = 'flex';
}

function closeAgendaModal() {
  document.getElementById('modal-agenda').style.display = 'none';
}

function actionSaveAgenda() {
  const kegiatan = document.getElementById('agd-kegiatan').value;
  const jenis_kegiatan = document.getElementById('agd-jenis').value;
  const tanggal_pelaksanaan = document.getElementById('agd-tanggal').value;
  const waktu = document.getElementById('agd-waktu').value;
  const penanggung_jawab = document.getElementById('agd-pj').value;
  const keterangan = document.getElementById('agd-keterangan').value;

  if (!kegiatan || !jenis_kegiatan || !tanggal_pelaksanaan || !waktu || !penanggung_jawab) {
    showToast("Harap isi semua field wajib.", true);
    return;
  }

  const payload = {
    id_agenda: document.getElementById('agd-id').value,
    kegiatan: kegiatan,
    jenis_kegiatan: jenis_kegiatan,
    tanggal_pelaksanaan: tanggal_pelaksanaan,
    waktu: waktu,
    penanggung_jawab: penanggung_jawab,
    keterangan: keterangan
  };
  setLoader(true, "Menyimpan agenda...");

  callAPI('saveAgenda', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      showToast(res.message);
      closeAgendaModal();
      loadAgenda();
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function actionDeleteAgenda(idAgenda) {
  if (!confirm("Hapus agenda ini?")) return;
  callAPI('deleteAgenda', [sessionToken, idAgenda])
    .then(res => { showToast(res.message); loadAgenda(); })
    .catch(err => showToast(err.message, true));
}

// =========================================================================
// === MANAJEMEN MODUL DOKUMENTASI KEGIATAN & INVENTARIS                  ===
// =========================================================================

function loadKegiatan() {
  callAPI('getKegiatanList', [sessionToken])
    .then(res => {
      if (res.success) {
        kegiatanList = res.list; // PERBAIKAN: Simpan data ke array global
        const grid = document.getElementById('grid-list-kegiatan');
        grid.innerHTML = "";
        if (res.list.length === 0) {
          grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color: var(--color-text-muted);">Belum ada dokumentasi kegiatan.</p>`;
          return;
        }
        res.list.forEach((keg, index) => {
          const defaultImg = "https://github.com/kbrahmana85-oss/SIAP-WANAMSKA-V-2.0/raw/main/icon.png";
          
          const isPengurus = ["Admin", "Pembina", "Dewan Penggalang"].indexOf(userRole) !== -1;
          const isAdmin = userRole === "Admin";
          
          let actionButtons = "";
          if (isPengurus) {
            // PERBAIKAN: Oper indeks array, bukan JSON stringify
            actionButtons += `<button class="btn" style="flex:1; padding:6px;" onclick="openKegiatanModal(${index})">Edit</button>`;
          }
          if (isAdmin) {
            actionButtons += `<button class="btn btn-danger" style="flex:1; padding:6px;" onclick="actionDeleteKegiatan('${keg.id_kegiatan}')">Hapus</button>`;
          }
          
          grid.innerHTML += `
            <div class="kegiatan-card">
              <img class="kegiatan-img" src="${keg.foto1 || defaultImg}" alt="Foto">
              <div class="kegiatan-body">
                <div>
                  <h3>${keg.nama_kegiatan}</h3>
                  <div class="meta">
                    <span>&#128197; ${keg.tanggal}</span> | <span>&#128205; ${keg.lokasi}</span>
                  </div>
                  <p style="font-size:0.85rem; margin-bottom:15px; color:var(--color-text-dark);">${keg.deskripsi}</p>
                </div>
                ${actionButtons ? `<div style="display:flex; gap:8px;">${actionButtons}</div>` : ''}
              </div>
            </div>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function openKegiatanModal(indexOrObj) {
  let selectedKeg = null;
  if (typeof indexOrObj === 'number') {
    selectedKeg = kegiatanList[indexOrObj];
  } else {
    selectedKeg = indexOrObj;
  }

  document.getElementById('kegiatan-modal-title').innerText = selectedKeg ? "Form Edit Dokumentasi" : "Form Tambah Dokumentasi";
  document.getElementById('keg-id').value = selectedKeg ? selectedKeg.id_kegiatan : "";
  document.getElementById('keg-nama').value = selectedKeg ? selectedKeg.nama_kegiatan : "";
  document.getElementById('keg-tanggal').value = selectedKeg ? selectedKeg.tanggal : "";
  document.getElementById('keg-lokasi').value = selectedKeg ? selectedKeg.lokasi : "";
  document.getElementById('keg-deskripsi').value = selectedKeg ? selectedKeg.deskripsi : "";
  document.getElementById('keg-foto-1-base64').value = selectedKeg ? (selectedKeg.foto1 || "") : "";
  document.getElementById('keg-foto-2-base64').value = selectedKeg ? (selectedKeg.foto2 || "") : "";
  document.getElementById('keg-foto-3-base64').value = selectedKeg ? (selectedKeg.foto3 || "") : "";
  document.getElementById('modal-kegiatan').style.display = 'flex';
}

function closeKegiatanModal() {
  document.getElementById('modal-kegiatan').style.display = 'none';
}

function processKegiatanPhoto(index, event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const maxDim = 800; 
      let width = img.width;
      let height = img.height;
      
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      document.getElementById('keg-foto-' + index + '-base64').value = dataUrl;
      showToast("Foto " + index + " berhasil diproses.");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function actionSaveKegiatan() {
  const nama = document.getElementById('keg-nama').value;
  const tanggal = document.getElementById('keg-tanggal').value;
  const lokasi = document.getElementById('keg-lokasi').value;
  const deskripsi = document.getElementById('keg-deskripsi').value;
  const foto1 = document.getElementById('keg-foto-1-base64').value;
  const foto2 = document.getElementById('keg-foto-2-base64').value;

  if (!nama || !tanggal || !lokasi || !deskripsi || !foto1 || !foto2) {
    showToast("Field nama, tanggal, lokasi, deskripsi, serta Foto 1 & 2 wajib dilampirkan.", true);
    return;
  }

  const payload = {
    id_kegiatan: document.getElementById('keg-id').value,
    nama_kegiatan: nama,
    tanggal: tanggal,
    lokasi: lokasi,
    deskripsi: deskripsi,
    foto1: foto1,
    foto2: foto2,
    foto3: document.getElementById('keg-foto-3-base64').value
  };
  setLoader(true, "Menyimpan dokumentasi...");

  callAPI('saveKegiatan', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      showToast(res.message);
      closeKegiatanModal();
      loadKegiatan();
    })
    .catch(err => { setLoader(false); showToast(err.toString(), true); });
}

function actionDeleteKegiatan(idKegiatan) {
  if (!confirm("Anda yakin ingin menghapus dokumentasi kegiatan ini?")) return;
  callAPI('deleteKegiatan', [sessionToken, idKegiatan])
    .then(res => { showToast(res.message); loadKegiatan(); })
    .catch(err => showToast(err.message, true));
}

function loadInventaris() {
  callAPI('getInventarisList', [sessionToken])
    .then(res => {
      if (res.success) {
        inventarisList = res.list; // PERBAIKAN: Simpan data ke array global
        const tbody = document.getElementById('body-inventaris');
        tbody.innerHTML = "";
        if (res.list.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Belum ada inventaris tercatat.</td></tr>`;
          return;
        }
        res.list.forEach((row, index) => {
          const isPengurus = ["Admin", "Pembina", "Dewan Penggalang"].indexOf(userRole) !== -1;
          const isAdmin = userRole === "Admin";
          
          let actionButtons = "";
          if (isPengurus) {
            // PERBAIKAN: Oper indeks array, bukan JSON stringify
            actionButtons += `<button class="btn" style="padding:6px 10px; margin-right:5px;" onclick="openInventarisModal(${index})">Edit</button>`;
          }
          if (isAdmin) {
            actionButtons += `<button class="btn btn-danger" style="padding:6px 10px;" onclick="actionDeleteInventaris('${row.id_barang}')">Hapus</button>`;
          }
          
          tbody.innerHTML += `
            <tr>
              <td>${row.id_barang}</td>
              <td>${row.nama_barang}</td>
              <td>${row.kategori}</td>
              <td>${row.jumlah}</td>
              <td>${row.kondisi}</td>
              <td>${row.locations_simpan}</td>
              <td>${actionButtons || "-"}</td>
            </tr>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function openInventarisModal(indexOrObj) {
  let selectedItem = null;
  if (typeof indexOrObj === 'number') {
    selectedItem = inventarisList[indexOrObj];
  } else {
    selectedItem = indexOrObj;
  }

  document.getElementById('inv-modal-title').innerText = selectedItem ? "Edit Barang Inventaris" : "Catat Barang Inventaris";
  document.getElementById('inv-id').value = selectedItem ? selectedItem.id_barang : "";
  document.getElementById('inv-nama').value = selectedItem ? selectedItem.nama_barang : "";
  document.getElementById('inv-kategori').value = selectedItem ? selectedItem.kategori : "Perlengkapan Kemah";
  document.getElementById('inv-jumlah').value = selectedItem ? selectedItem.jumlah : "";
  document.getElementById('inv-kondisi').value = selectedItem ? selectedItem.kondisi : "Baik";
  document.getElementById('inv-lokasi').value = selectedItem ? selectedItem.locations_simpan : "";
  document.getElementById('inv-tanggal').value = selectedItem ? selectedItem.tanggal_masuk : "";
  document.getElementById('inv-keterangan').value = selectedItem ? selectedItem.keterangan : "";
  document.getElementById('modal-inventaris').style.display = 'flex';
}

function closeInventarisModal() {
  document.getElementById('modal-inventaris').style.display = 'none';
}

function actionSaveInventaris() {
  const payload = {
    id_barang: document.getElementById('inv-id').value,
    nama_barang: document.getElementById('inv-nama').value,
    kategori: document.getElementById('inv-kategori').value,
    jumlah: document.getElementById('inv-jumlah').value,
    kondisi: document.getElementById('inv-kondisi').value,
    locations_simpan: document.getElementById('inv-lokasi').value,
    tanggal_masuk: document.getElementById('inv-tanggal').value,
    keterangan: document.getElementById('inv-keterangan').value
  };
  setLoader(true, "Menyimpan...");

  callAPI('saveInventaris', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      showToast(res.message);
      closeInventarisModal();
      loadInventaris();
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function actionDeleteInventaris(idBarang) {
  if (!confirm("Hapus inventaris barang ini?")) return;
  callAPI('deleteInventaris', [sessionToken, idBarang])
    .then(res => { showToast(res.message); loadInventaris(); })
    .catch(err => showToast(err.message, true));
}

// =========================================================================
// === MANAJEMEN MODUL KAS                                               ===
// =========================================================================

function loadKas() {
  callAPI('getKasData', [sessionToken])
    .then(res => {
      if (res.success) {
        document.getElementById('kas-total-pemasukan').innerText = "Rp " + res.totalMasuk.toLocaleString('id-ID');
        document.getElementById('kas-total-pengeluaran').innerText = "Rp " + res.totalKeluar.toLocaleString('id-ID');
        document.getElementById('kas-saldo-akhir').innerText = "Rp " + res.saldoAkhir.toLocaleString('id-ID');
        drawKasChart(res.totalMasuk, res.totalKeluar);

        const tbody = document.getElementById('body-kas');
        if (tbody) {
          tbody.innerHTML = "";
          res.list.forEach(row => {
            tbody.innerHTML += `
              <tr>
                <td>${row.tanggal}</td>
                <td>${row.jenis}</td>
                <td>${row.kategori}</td>
                <td>Rp ${Number(row.jumlah).toLocaleString('id-ID')}</td>
                <td>${row.keterangan}</td>
                <td>Rp ${Number(row.saldo_berjalan).toLocaleString('id-ID')}</td>
              </tr>`;
          });
        }
      }
    })
    .catch(err => showToast(err.message, true));
}

function drawKasChart(masuk, keluar) {
  const canvas = document.getElementById('canvas-kas-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FAF4EE";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const max = Math.max(masuk, keluar, 10000);
  const hM = (masuk / max) * 180;
  const hK = (keluar / max) * 180;
  ctx.fillStyle = "#03543F";
  ctx.fillRect(100, 240 - hM, 80, hM);
  ctx.fillStyle = "#B91C1C";
  ctx.fillRect(320, 240 - hK, 80, hK);
}

function openKasModal() {
  document.getElementById('kas-tanggal-form').value = new Date().toISOString().substring(0, 10);
  document.getElementById('modal-kas').style.display = 'flex';
}
function closeKasModal() {
  document.getElementById('modal-kas').style.display = 'none';
}

function actionSaveKas() {
  const payload = {
    jenis: document.getElementById('kas-jenis').value,
    kategori: document.getElementById('kas-kategori').value,
    jumlah: document.getElementById('kas-jumlah').value,
    tanggal: document.getElementById('kas-tanggal-form').value,
    keterangan: document.getElementById('kas-keterangan-form').value
  };
  setLoader(true, "Mencatat kas...");

  callAPI('addKasTransaction', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      showToast(res.message);
      closeKasModal();
      loadKas();
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

// =========================================================================
// === MANAJEMEN DATA PROFIL ANGGOTA                                     ===
// =========================================================================

function loadProfileDiri() {
  callAPI('getUserProfile', [sessionToken, userId])
    .then(res => {
      if (res.success) {
        const p = res.profile;
        document.getElementById('prof-user-id').value = p.user_id;
        document.getElementById('prof-nama').value = p.nama_lengkap || "";
        document.getElementById('prof-nta').value = p.nta || "";
        document.getElementById('prof-tempat-lahir').value = p.tempat_lahir || "";
        
        let birthDateFormatted = "";
        if (p.tanggal_lahir) {
          try {
            const d = new Date(p.tanggal_lahir);
            if (!isNaN(d.getTime())) {
              birthDateFormatted = d.toISOString().substring(0, 10);
            } else {
              birthDateFormatted = p.tanggal_lahir;
            }
          } catch(e) {
            birthDateFormatted = p.tanggal_lahir;
          }
        }
        document.getElementById('prof-tanggal-lahir').value = birthDateFormatted;
        
        if (p.jenis_kelamin) document.getElementById('prof-jk').value = p.jenis_kelamin;
        document.getElementById('prof-golongan').value = p.golongan || "";
        document.getElementById('prof-regu').value = p.regu_sangga || "";
        document.getElementById('prof-alamat').value = p.alamat || "";
        document.getElementById('prof-hp').value = p.no_hp || "";
        if (p.foto_profil) {
          document.getElementById('prof-preview-img').src = p.foto_profil;
          document.getElementById('prof-preview-img').dataset.base64 = p.foto_profil;
        } else {
          document.getElementById('prof-preview-img').src = "";
          document.getElementById('prof-preview-img').dataset.base64 = "";
        }
      }
    })
    .catch(err => showToast(err.message, true));
}

function previewAndResizeProfilePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = 300; 
      canvas.height = 300; 
      const ctx = canvas.getContext('2d');
      
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 300, 300);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      document.getElementById('prof-preview-img').src = dataUrl;
      document.getElementById('prof-preview-img').dataset.base64 = dataUrl;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function actionSaveProfile() {
  const payload = {
    user_id: document.getElementById('prof-user-id').value,
    nta: document.getElementById('prof-nta').value,
    nama_lengkap: document.getElementById('prof-nama').value,
    tempat_lahir: document.getElementById('prof-tempat-lahir').value,
    tanggal_lahir: document.getElementById('prof-tanggal-lahir').value,
    jenis_kelamin: document.getElementById('prof-jk').value,
    golongan: document.getElementById('prof-golongan').value,
    regu_sangga: document.getElementById('prof-regu').value,
    alamat: document.getElementById('prof-alamat').value,
    no_hp: document.getElementById('prof-hp').value,
    foto_profil: document.getElementById('prof-preview-img').dataset.base64 || document.getElementById('prof-preview-img').src
  };
  setLoader(true, "Menyimpan profil...");

  callAPI('saveUserProfile', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      showToast(res.message);
      if (res.success && payload.user_id.toLowerCase() === userId.toLowerCase()) {
        currentUser.nama_lengkap = payload.nama_lengkap;
        sessionStorage.setItem('user', JSON.stringify(currentUser));
        document.getElementById('user-display-name').innerText = currentUser.nama_lengkap;
        loadProfileDiri();
      }
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function actionGantiPassword() {
  const lama = document.getElementById('pass-lama').value;
  const baru = document.getElementById('pass-baru').value;
  if (!lama || !baru) { showToast("Password lama dan baru wajib diisi.", true); return; }
  if (baru.length < 6) { showToast("Password baru minimal 6 karakter.", true); return; }

  callAPI('changePassword', [sessionToken, lama, baru])
    .then(res => {
      showToast(res.message, !res.success);
      if (res.success) {
        document.getElementById('pass-lama').value = "";
        document.getElementById('pass-baru').value = "";
      }
    })
    .catch(err => showToast(err.message, true));
}

// =========================================================================
// === KELOLA USER & UTILITIES                                          ===
// =========================================================================

function loadUsers() {
  callAPI('getUserList', [sessionToken])
    .then(res => {
      if (res.success) {
        userList = res.list; // PERBAIKAN: Simpan data ke array global
        const tbody = document.getElementById('body-users');
        tbody.innerHTML = "";
        res.list.forEach((row, index) => {
          tbody.innerHTML += `
            <tr>
              <td><strong>${row.user_id}</strong></td>
              <td>${row.nama_lengkap}</td>
              <td><span class="role">${row.role}</span></td>
              <td><span class="badge badge-hadir">${row.status_aktif}</span></td>
              <td>
                <button class="btn" style="padding:6px 10px; margin-right:5px;" onclick="openUserModal(${index})">Edit</button>
                <button class="btn btn-danger" style="padding:6px 10px;" onclick="actionDeleteUser('${row.user_id}')">Hapus</button>
              </td>
            </tr>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function openUserModal(indexOrObj) {
  let selectedUser = null;
  if (typeof indexOrObj === 'number') {
    selectedUser = userList[indexOrObj];
  } else {
    selectedUser = indexOrObj;
  }

  const idField = document.getElementById('usr-id');
  document.getElementById('usr-id').value = selectedUser ? selectedUser.user_id : "";
  idField.disabled = !!selectedUser; 
  document.getElementById('usr-nama').value = selectedUser ? selectedUser.nama_lengkap : "";
  document.getElementById('usr-password').value = "";
  document.getElementById('usr-role').value = selectedUser ? selectedUser.role : "Penggalang";
  document.getElementById('usr-status').value = selectedUser ? selectedUser.status_aktif : "Aktif";
  document.getElementById('modal-user').style.display = 'flex';
}

function closeUserModal() {
  document.getElementById('modal-user').style.display = 'none';
  document.getElementById('usr-id').disabled = false;
}

function actionSaveUser() {
  const payload = {
    user_id: document.getElementById('usr-id').value,
    nama_lengkap: document.getElementById('usr-nama').value,
    password: document.getElementById('usr-password').value,
    role: document.getElementById('usr-role').value,
    status_aktif: document.getElementById('usr-status').value
  };
  if (!payload.user_id || !payload.nama_lengkap) {
    showToast("User ID dan Nama Lengkap wajib diisi.", true); return;
  }
  setLoader(true, "Menyimpan user...");

  callAPI('saveUserByAdmin', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      showToast(res.message);
      closeUserModal();
      loadUsers();
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function actionDeleteUser(targetUserId) {
  if (!confirm("Hapus user " + targetUserId + "?")) return;
  callAPI('deleteUser', [sessionToken, targetUserId])
    .then(res => { showToast(res.message); loadUsers(); })
    .catch(err => showToast(err.message, true));
}

function loadSystemLogs() {
  const tbody = document.getElementById('body-logs');
  if (!tbody) return;
  const filter = document.getElementById('filter-log-user').value;

  callAPI('getSystemLogs', [sessionToken, filter])
    .then(res => {
      if (res.success) {
        tbody.innerHTML = "";
        if (res.list.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Tidak ada log aktivitas ditemukan.</td></tr>`;
          return;
        }
        res.list.forEach(row => {
          tbody.innerHTML += `
            <tr>
              <td>${row.timestamp}</td>
              <td><strong>${row.user_id}</strong></td>
              <td>${row.aksi}</td>
              <td>${row.detail}</td>
              <td>${row.ip}</td>
            </tr>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function triggerExport(jenis, format) {
  setLoader(true, `Mengekspor data ${jenis} ke format ${format.toUpperCase()}...`);
  const functionName = format === 'pdf' ? 'exportToPDF' : 'exportToExcel';

  callAPI(functionName, [sessionToken, jenis])
    .then(res => {
      setLoader(false);
      if (res.success && res.url) {
        showToast("Ekspor Berhasil! Membuka unduhan...");
        window.open(res.url, '_blank');
      } else {
        showToast(res.message || "Gagal melakukan ekspor data", true);
      }
    })
    .catch(err => {
      setLoader(false);
      showToast(err.message, true);
    });
}

function loadDaftarAnggota() {
  callAPI('getUserList', [sessionToken])
    .then(res => {
      if (res.success) {
        const tbody = document.getElementById('daftarAnggotaAbsen');
        tbody.innerHTML = "";
        res.list.forEach(member => {
          tbody.innerHTML += `
            <tr>
              <td>${member.user_id}</td>
              <td>${member.nama_lengkap}</td>
              <td>${member.role}</td>
              <td>
                <select class="form-control" id="status_${member.user_id}">
                  <option value="Hadir">Hadir</option>
                  <option value="Izin">Izin</option>
                  <option value="Sakit">Sakit</option>
                  <option value="Alpa">Alpa</option>
                </select>
              </td>
            </tr>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function simpanKehadiran() {
  const tanggal = document.getElementById('tanggalAbsen').value;
  if (!tanggal) { showToast("Pilih tanggal kegiatan terlebih dahulu.", true); return; }

  const rows = document.querySelectorAll('#daftarAnggotaAbsen tr');
  const requests = [];
  rows.forEach(tr => {
    const select = tr.querySelector('select[id^="status_"]');
    if (!select) return;
    const targetUserId = select.id.replace('status_', '');
    requests.push(
      callAPI('submitAbsen', [sessionToken, select.value, "", "Manual", "", "Dicatat massal oleh " + userId + " untuk " + targetUserId])
    );
  });

  setLoader(true, "Menyimpan kehadiran...");
  Promise.allSettled(requests).then(() => {
    setLoader(false);
    showToast("Kehadiran berhasil disimpan.");
    kembaliKeDashboard();
  });
}
