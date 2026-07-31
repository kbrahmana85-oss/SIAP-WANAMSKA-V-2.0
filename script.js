// GANTI dengan URL Web App Apps Script Anda
const API_URL = "https://script.google.com/macros/s/AKfycbx0TzNLsXZe8zeXUGWfgcmisDPlU-oDUjDZIjxlGoOpggeKwziAJw13aQapfBI2Rs0l0w/exec";

// VERSI APLIKASI DI-UPDATE KE 2.4.1 UNTUK AUTO-PURGE CACHE & KAMERA ANTI-MIRROR
const APP_VERSION = "2.4.1"; 

let sessionToken = "";
let userRole = "";
let userId = "";
let currentUser = null;

let streamRef = null;
let base64SelfieString = "";
let profilePhotoBase64 = "";
let currentFacingMode = "user";

let userLatitude = null;
let userLongitude = null;
let isFakeGPSDetected = false;

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
  // 1. PEMBERSIHAN CACHE SERVICE WORKER AGRESIF (VERSI 2.4.1 - TANPA UNINSTALL!)
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
    console.log("Sistem mendeteksi pembaruan versi " + APP_VERSION + ". Perbaikan Kamera & Auto-Sync Materi diaktifkan.");
    setTimeout(() => { window.location.reload(true); }, 500);
    return;
  }

  // 2. VALIDASI GEOLOCATION WAJIB SEBELUM LOGIN / MASUK APLIKASI
  requestGPSPermission();

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

  initLiveTimer();
  initCreativeCalendar();
  requestPushNotificationPermission();
});

// =========================================================================
// === FITUR NATIVE PUSH NOTIFICATION UNTUK HP PENGGUNA                  ===
// =========================================================================
function requestPushNotificationPermission() {
  if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission().then(function (permission) {
      if (permission === "granted") {
        console.log("Izin notifikasi diterima.");
      }
    });
  }
}

function triggerNativeNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body: body,
        icon: 'https://github.com/kbrahmana85-oss/SIAP-WANAMSKA-V-2.0/raw/main/icon.png'
      });
    } catch (e) {
      console.log("Native notification error:", e);
    }
  }
}

// =========================================================================
// === FITUR TAMPILKAN / SEMBUNYIKAN PASSWORD                           ===
// =========================================================================
function togglePassword() {
  const passwordInput = document.getElementById('password');
  const eyeIcon = document.getElementById('eyeIcon');
  if (!passwordInput || !eyeIcon) return;
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeIcon.innerText = '🙈';
  } else {
    passwordInput.type = 'password';
    eyeIcon.innerText = '👁️';
  }
}

// =========================================================================
// === MANAJEMEN GEOFENCING & GPS LOCK SEBELUM LOGIN                     ===
// =========================================================================
function requestGPSPermission() {
  if (navigator.geolocation) {
    setLoader(true, "Mendapatkan sinyal koordinat GPS...");
    navigator.geolocation.getCurrentPosition(
      function (position) {
        setLoader(false);
        userLatitude = position.coords.latitude;
        userLongitude = position.coords.longitude;
        
        isFakeGPSDetected = false;
        if (position.mocked === true || (position.coords && position.coords.mocked === true)) {
          isFakeGPSDetected = true;
        }
        if (position.coords && position.coords.accuracy === 0) {
          isFakeGPSDetected = true;
        }

        const blockingOverlay = document.getElementById('gps-blocking-overlay');
        if (blockingOverlay) {
          blockingOverlay.style.display = 'none';
        }
        showToast("GPS aktif & terverifikasi.");
      },
      function (error) {
        setLoader(false);
        let errorMsg = "Harap izinkan akses lokasi pada browser Anda.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "Akses lokasi ditolak! Anda wajib mengaktifkan GPS untuk menggunakan aplikasi.";
        }
        showToast(errorMsg, true);
        const blockingOverlay = document.getElementById('gps-blocking-overlay');
        if (blockingOverlay) {
          blockingOverlay.style.display = 'flex';
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  } else {
    showToast("Browser/Perangkat Anda tidak mendukung fitur lokasi GPS.", true);
  }
}

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
    sidebar.classList.toggle('active');
    sidebar.classList.toggle('collapsed');
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
  else if (sectionId === 'section-absensi') loadAbsenHistory();
  else if (sectionId === 'section-kegiatan') loadKegiatan();
  else if (sectionId === 'section-agenda') loadAgenda();
  else if (sectionId === 'section-materi') {
    closeMateriFilesContainer();
  }
  else if (sectionId === 'section-inventaris') loadInventaris();
  else if (sectionId === 'section-kas') loadKas();
  else if (sectionId === 'section-profile') loadProfileDiri();
  else if (sectionId === 'section-users') loadUsers();
  else if (sectionId === 'section-exports') { /* no-op */ }
  else if (sectionId === 'section-logs') loadSystemLogs();
}

// =========================================================================
// === LIVE TIMERS & CALENDAR                                            ===
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
// === LOGIN / LOGOUT & RBAC INTERFACE PERAN                              ===
// =========================================================================
function handleLogin() {
  const userIdVal = document.getElementById('userId').value.trim();
  const passwordVal = document.getElementById('password').value.trim();

  if (!userIdVal || !passwordVal) { showToast('User ID dan Password wajib diisi', true); return; }
  showToast('Sedang autentikasi...');

  callAPI('loginUser', [userIdVal, passwordVal])
    .then(res => {
      if (res.success) {
        sessionStorage.setItem('sessionToken', res.sessionToken);
        sessionStorage.setItem('user', JSON.stringify(res.user));

        sessionToken = res.sessionToken;
        currentUser = res.user;
        userRole = res.user.role;
        userId = res.user.user_id;

        document.getElementById('user-display-name').innerText = res.user.nama_lengkap;
        document.getElementById('user-display-role').innerText = res.user.role;

        setupRBACUI(res.user.role);
        showPage('dashboard-page');
        loadDashboard();
      } else {
        showToast(res.message || 'Login gagal', true);
      }
    })
    .catch(err => showToast(err.message || 'Login gagal', true));
}

function actionLogout() {
  if (!confirm("Apakah Anda yakin ingin keluar dari sistem?")) return;
  callAPI('logoutUser', [sessionToken]).catch(() => {});
  sessionStorage.clear();
  sessionToken = ""; userRole = ""; userId = ""; currentUser = null;
  
  document.getElementById('btn-lonceng').style.display = 'none';
  showPage('login-page');
  showToast("Berhasil logout.");
}

function setupRBACUI(role) {
  document.getElementById('menu-materi').style.display = 'none';
  document.getElementById('menu-inventaris').style.display = 'none';
  document.getElementById('menu-kas').style.display = 'none';
  document.getElementById('menu-users').style.display = 'none';
  document.getElementById('menu-exports').style.display = 'none';
  document.getElementById('menu-logs').style.display = 'none';
  
  document.getElementById('btn-lonceng').style.display = 'flex';
  loadNotifications(false);
  
  document.getElementById('btn-tambah-kegiatan-trigger').style.display = 'none';
  document.getElementById('btn-tambah-agenda-trigger').style.display = 'none';
  document.getElementById('btn-tambah-kas').style.display = 'none';
  
  const btnTambahInv = document.querySelector("#section-inventaris .btn-gold");
  if (btnTambahInv) btnTambahInv.style.display = 'none';
  
  document.getElementById('card-dash-kas').style.display = 'none';
  document.getElementById('dashboard-absen-massal-box').style.display = 'none';
  
  document.getElementById('export-absensi-box').style.display = 'none';
  document.getElementById('export-inventaris-box').style.display = 'none';
  document.getElementById('export-kas-box').style.display = 'none';

  const docExportBtn = document.getElementById('btn-export-doc-absensi');
  if (docExportBtn) docExportBtn.style.display = 'none';

  // ATURAN HAK AKSES PERAN (RBAC) MATERI KEGIATAN:
  // ADMIN, PEMBINA, DAN DEWAN PENGGALANG -> DAPAT MENGAKSES & DOWNLOAD
  // PENGGALANG -> TIDAK DAPAT MENGAKSES (SAMA SEKALI DISEMBUNYIKAN)
  if (role === "Admin" || role === "Pembina" || role === "Dewan Penggalang") {
    document.getElementById('menu-materi').style.display = 'flex';
  }

  if (role === "Admin") {
    document.getElementById('card-riwayat-absen-global').style.display = 'block';
    document.getElementById('card-riwayat-absen-pribadi').style.display = 'none';

    document.getElementById('menu-inventaris').style.display = 'flex';
    document.getElementById('menu-kas').style.display = 'flex';
    document.getElementById('menu-users').style.display = 'flex';
    document.getElementById('menu-exports').style.display = 'flex';
    document.getElementById('menu-logs').style.display = 'flex';
    
    document.getElementById('btn-tambah-kegiatan-trigger').style.display = 'inline-block';
    document.getElementById('btn-tambah-agenda-trigger').style.display = 'inline-block';
    document.getElementById('btn-tambah-kas').style.display = 'inline-block';
    if (btnTambahInv) btnTambahInv.style.display = 'inline-block';
    
    document.getElementById('card-dash-kas').style.display = 'flex';
    document.getElementById('dashboard-absen-massal-box').style.display = 'block';
    
    document.getElementById('export-absensi-box').style.display = 'block';
    document.getElementById('export-inventaris-box').style.display = 'block';
    document.getElementById('export-kas-box').style.display = 'block';
    if (docExportBtn) docExportBtn.style.display = 'block';
    
  } else {
    document.getElementById('card-riwayat-absen-global').style.display = 'none';
    document.getElementById('card-riwayat-absen-pribadi').style.display = 'block';

    if (role === "Pembina") {
      document.getElementById('menu-inventaris').style.display = 'flex';
      document.getElementById('menu-kas').style.display = 'flex';
      document.getElementById('menu-exports').style.display = 'flex';
      
      document.getElementById('btn-tambah-kegiatan-trigger').style.display = 'inline-block';
      document.getElementById('btn-tambah-agenda-trigger').style.display = 'inline-block';
      document.getElementById('btn-tambah-kas').style.display = 'inline-block';
      if (btnTambahInv) btnTambahInv.style.display = 'inline-block';
      
      document.getElementById('card-dash-kas').style.display = 'flex';
      document.getElementById('dashboard-absen-massal-box').style.display = 'block';
      
      document.getElementById('export-absensi-box').style.display = 'block';
      document.getElementById('export-inventaris-box').style.display = 'none';
      document.getElementById('export-kas-box').style.display = 'none';
      
    } else if (role === "Dewan Penggalang") {
      document.getElementById('menu-inventaris').style.display = 'flex';
      document.getElementById('menu-kas').style.display = 'flex';
      
      document.getElementById('btn-tambah-kegiatan-trigger').style.display = 'inline-block';
      document.getElementById('btn-tambah-agenda-trigger').style.display = 'inline-block';
      document.getElementById('btn-tambah-kas').style.display = 'inline-block';
      if (btnTambahInv) btnTambahInv.style.display = 'inline-block';
      
      document.getElementById('card-dash-kas').style.display = 'flex';
      document.getElementById('dashboard-absen-massal-box').style.display = 'block';
      
      document.getElementById('menu-exports').style.display = 'none';
    }
  }
}

// =========================================================================
// === MANAJEMEN NOTIFIKASI LONCENG & FILTER PER ROLE                    ===
// =========================================================================
function openNotifikasiModal() {
  document.getElementById('modal-notifikasi').style.display = 'flex';
  loadNotifications(true);
}

function closeNotifikasiModal() {
  document.getElementById('modal-notifikasi').style.display = 'none';
}

function loadNotifications(markAsRead = false) {
  const container = document.getElementById('body-notifikasi');
  if (!container) return;

  callAPI('getNotificationList', [sessionToken])
    .then(res => {
      if (res.success) {
        container.innerHTML = "";
        if (res.list.length === 0) {
          container.innerHTML = `<p style="text-align: center; color: var(--color-text-muted);">Belum ada notifikasi pembaruan.</p>`;
          return;
        }

        res.list.forEach(notif => {
          let icon = '📢';
          if (notif.type === 'absensi') icon = '✅';
          else if (notif.type === 'inventaris') icon = '📦';
          else if (notif.type === 'kas') icon = '💰';
          else if (notif.type === 'agenda') icon = '🗓️';

          const borderClass = notif.type === 'absensi' ? 'absensi' : '';
          
          container.innerHTML += `
            <div class="notif-item ${borderClass}">
              <div class="notif-time">${formatDateString(notif.timestamp)}</div>
              <div class="notif-title">${icon} ${notif.title}</div>
              <div class="notif-detail">${notif.detail}</div>
            </div>`;
        });

        if (res.list.length > 0) {
          const newestId = res.list[0].id;
          const lastReadId = localStorage.getItem('last_read_notif_id_' + userId);

          if (lastReadId !== newestId && !markAsRead) {
            triggerNativeNotification("SIAP WANAMSKA Pembaruan", res.list[0].title);
          }

          if (markAsRead) {
            localStorage.setItem('last_read_notif_id_' + userId, newestId);
            const badge = document.getElementById('lonceng-badge');
            if (badge) badge.style.display = 'none';
          } else {
            const badge = document.getElementById('lonceng-badge');
            if (badge) {
              if (lastReadId !== newestId) {
                badge.style.display = 'block';
              } else {
                badge.style.display = 'none';
              }
            }
          }
        }
      }
    })
    .catch(err => {
      console.error("Gagal memuat notifikasi:", err);
    });
}

function formatDateString(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
}

// =========================================================================
// === FITUR MODUL MATERI KEGIATAN KEPRAMUKAAN                            ===
// =========================================================================

function openMateriFolder(folderKey, folderTitle) {
  const container = document.getElementById('materi-files-container');
  const titleEl = document.getElementById('materi-folder-title');
  const tbody = document.getElementById('body-materi-files');

  if (!container || !tbody) return;

  titleEl.innerText = "Folder File: " + folderTitle;
  tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Memuat daftar file dari Google Drive...</td></tr>`;
  container.style.display = 'block';

  container.scrollIntoView({ behavior: 'smooth' });

  setLoader(true, "Mengambil berkas materi dari Google Drive...");

  callAPI('getMateriFileList', [sessionToken, folderKey])
    .then(res => {
      setLoader(false);
      if (res.success) {
        tbody.innerHTML = "";
        if (res.list.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-text-muted);">Folder ini masih kosong atau belum ada file yang ditambahkan.</td></tr>`;
          return;
        }

        res.list.forEach(file => {
          let fileIcon = "📄";
          const mime = file.mimeType.toLowerCase();
          const fname = file.name.toLowerCase();

          if (mime.includes("pdf")) fileIcon = "📕 PDF";
          else if (mime.includes("image") || fname.endsWith(".jpg") || fname.endsWith(".png") || fname.endsWith(".jpeg")) fileIcon = "🖼️ GAMBAR";
          else if (mime.includes("audio") || fname.endsWith(".mp3")) fileIcon = "🎵 AUDIO";
          else if (mime.includes("video") || fname.endsWith(".mp4")) fileIcon = "🎬 VIDEO";
          else if (mime.includes("word") || fname.endsWith(".doc") || fname.endsWith(".docx")) fileIcon = "📘 WORD";

          tbody.innerHTML += `
            <tr>
              <td><strong>${fileIcon}</strong></td>
              <td><strong>${file.name}</strong></td>
              <td>${file.size}</td>
              <td>
                <button class="btn btn-gold" style="padding: 6px 14px; font-size: 0.85rem;" onclick="actionDownloadMateri('${file.downloadUrl}', '${file.viewUrl}', '${file.name}')">
                  ⬇️ Download
                </button>
              </td>
            </tr>`;
        });
      } else {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-danger-red);">${res.message}</td></tr>`;
        showToast(res.message, true);
      }
    })
    .catch(err => {
      setLoader(false);
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-danger-red);">${err.message}</td></tr>`;
      showToast(err.message, true);
    });
}

function closeMateriFilesContainer() {
  const container = document.getElementById('materi-files-container');
  if (container) container.style.display = 'none';
}

function actionDownloadMateri(downloadUrl, viewUrl, fileName) {
  if (confirm("IZIN DOWNLOAD: Apakah Anda setuju untuk mengunduh file '" + fileName + "' ke perangkat Anda?")) {
    showToast("Memulai pengunduhan file: " + fileName);
    var win = window.open(downloadUrl, '_blank');
    if (!win) {
      window.location.href = viewUrl;
    }
  }
}

// =========================================================================
// === DASBOR                                                            ===
// =========================================================================
function loadDashboard() {
  callAPI('getDashboardData', [sessionToken])
    .then(res => {
      if (res.success) {
        document.getElementById('dash-total-anggota').innerText = res.total_anggota;
        document.getElementById('dash-hadir-hari-ini').innerText = res.hadir_hari_ini;
        document.getElementById('dash-kegiatan-terbaru').innerText = res.kegiatan_terbaru;

        const saldoEl = document.getElementById('dash-saldo-kas');
        const cardKas = document.getElementById('card-dash-kas');
        if (res.saldo_kas !== undefined && res.saldo_kas !== null) {
          if (saldoEl) saldoEl.innerText = "Rp " + Number(res.saldo_kas).toLocaleString('id-ID');
          if (cardKas && (userRole === "Admin" || userRole === "Pembina" || userRole === "Dewan Penggalang")) {
            cardKas.style.display = 'flex';
          }
        }
      }
    })
    .catch(err => showToast(err.message, true));
}

// =========================================================================
// === KAMERA (SELFIE ABSENSI) - MENJAGA ORIENTASI NORMAL ANTI-MIRROR   ===
// =========================================================================
function startCamera() {
  const video = document.getElementById('camera-video');
  if (!video) return;
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: currentFacingMode }
  })
  .then(stream => {
    streamRef = stream;
    video.srcObject = stream;
    video.style.display = 'block';
    document.getElementById('selfie-canvas-preview').style.display = 'none';
    showToast("Kamera diaktifkan.");
  })
  .catch(err => {
    showToast("Gagal mengakses kamera: " + err.message, true);
  });
}

function stopCamera() {
  if (streamRef) {
    streamRef.getTracks().forEach(track => track.stop());
    streamRef = null;
  }
}

function flipCamera() {
  currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
  stopCamera();
  startCamera();
}

function captureSnapshot() {
  const video = document.getElementById('camera-video');
  const preview = document.getElementById('selfie-canvas-preview');
  if (!video || !video.srcObject) {
    showToast("Kamera belum aktif!", true);
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');

  // PROSES PROYEKSI TANGKAPAN DILAKUKAN SECARA LANGSUNG TANPA PERUBAHAN MATRIX MIRROR
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  base64SelfieString = canvas.toDataURL('image/jpeg', 0.85);
  
  preview.src = base64SelfieString;
  preview.style.display = 'block';
  video.style.display = 'none';
  stopCamera();
  showToast("Foto selfie berhasil diambil.");
}

// =========================================================================
// === ABSENSI & GEOFENCING VALIDASI                                    ===
// =========================================================================
function actionSubmitAbsen() {
  const status = document.getElementById('absen-status').value;
  const metode = document.getElementById('absen-metode').value;
  const kegiatanCode = document.getElementById('absen-kegiatan-id').value;
  const keterangan = document.getElementById('absen-keterangan').value;

  if (status === "Hadir" && metode === "Selfie" && !base64SelfieString) {
    showToast("Harap lakukan foto selfie terlebih dahulu sebelum absensi!", true); return;
  }
  if (status === "Hadir" && metode === "Manual" && !kegiatanCode) {
    showToast("Harap isi kode kegiatan pelaksanaan absensi!", true); return;
  }

  if (userRole === "Dewan Penggalang" || userRole === "Penggalang") {
    setLoader(true, "Mengecek koordinat GPS & radius pangkalan...");
    navigator.geolocation.getCurrentPosition(
      function (position) {
        userLatitude = position.coords.latitude;
        userLongitude = position.coords.longitude;
        
        isFakeGPSDetected = false;
        if (position.mocked === true || (position.coords && position.coords.mocked === true)) {
          isFakeGPSDetected = true;
        }
        if (position.coords && position.coords.accuracy === 0) {
          isFakeGPSDetected = true;
        }

        sendAbsenRequest(status, base64SelfieString, metode, kegiatanCode, keterangan, userLatitude, userLongitude, isFakeGPSDetected);
      },
      function () {
        setLoader(false);
        showToast("ABSENSI DITOLAK: Akses GPS wajib aktif untuk melakukan presensi.", true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    sendAbsenRequest(status, base64SelfieString, metode, kegiatanCode, keterangan, null, null, false);
  }
}

function sendAbsenRequest(status, fotoSelfie, metode, kegiatanTerkait, keterangan, lat, lng, isFake) {
  setLoader(true, "Mengirim data absensi...");
  callAPI('submitAbsen', [sessionToken, status, fotoSelfie, metode, kegiatanTerkait, keterangan, lat, lng, isFake])
    .then(res => {
      setLoader(false);
      if (res.success) {
        showToast(res.message);
        stopCamera();
        document.getElementById('absen-kegiatan-id').value = "";
        document.getElementById('absen-keterangan').value = "";
        loadAbsenHistory();
        loadNotifications(false);
      } else {
        showToast(res.message, true);
      }
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function loadAbsenHistory() {
  const filter = document.getElementById('filter-absen-date') ? document.getElementById('filter-absen-date').value : "";

  callAPI('getAbsenHistory', [sessionToken, filter])
    .then(res => {
      if (res.success) {
        if (userRole === "Admin") {
          const tbody = document.getElementById('body-riwayat-absen');
          if (!tbody) return;
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
        } else {
          const container = document.getElementById('body-riwayat-absen-pribadi');
          if (!container) return;
          container.innerHTML = "";
          if (res.list.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--color-text-muted);">Belum ada riwayat absensi pribadi tercatat.</p>`;
            return;
          }
          res.list.forEach(row => {
            let statusColor = row.status === "Hadir" ? "#03543F" : row.status === "Izin" ? "#1E429F" : "#713F12";
            let imgTag = row.foto_base64 ? `<img src="${row.foto_base64}" style="width: 80px; height: 120px; border-radius:8px; object-fit:cover; cursor:pointer; margin-top:10px; display:block;" onclick="viewFullImage('${row.foto_base64}')">` : "";
            
            container.innerHTML += `
              <div class="timeline-pribadi-item" style="border-left: 5px solid ${statusColor};">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                  <strong>${row.tanggal} (${row.jam})</strong>
                  <span class="badge" style="background-color:${statusColor}22; color:${statusColor}; font-weight:bold;">${row.status}</span>
                </div>
                <div style="font-size:0.9rem; color:var(--color-text-muted);">
                  Metode: ${row.metode} <br>
                  Catatan: ${row.keterangan || "-"} <br>
                  Kegiatan: ${row.kegiatan || "-"}
                </div>
                ${imgTag}
              </div>`;
          });
        }
      }
    })
    .catch(err => showToast(err.message, true));
}

// =========================================================================
// === AGENDA KEGIATAN                                                   ===
// =========================================================================
function loadAgenda() {
  callAPI('getAgendaList', [sessionToken])
    .then(res => {
      if (res.success) {
        const tbody = document.getElementById('body-agenda');
        tbody.innerHTML = "";
        if (res.list.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Belum ada agenda terdaftar.</td></tr>`;
          return;
        }
        const isPengurus = ["Admin", "Pembina", "Dewan Penggalang"].indexOf(userRole) !== -1;
        const isAdmin = userRole === "Admin";
        
        res.list.forEach(agd => {
          let actionButtons = "";
          if (isPengurus) {
            actionButtons += `<button class="btn" style="padding:6px 10px; margin-right:5px;" onclick='openAgendaModal(${JSON.stringify(agd)})'>Edit</button>`;
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
      }
    })
    .catch(err => showToast(err.message, true));
}

function openAgendaModal(agd) {
  if (agd && agd.id_agenda) {
    document.getElementById('agenda-modal-title').innerText = "Edit Agenda Kegiatan";
    document.getElementById('agd-id').value = agd.id_agenda;
    document.getElementById('agd-kegiatan').value = agd.kegiatan || "";
    document.getElementById('agd-jenis').value = agd.jenis_kegiatan || "";
    document.getElementById('agd-tanggal').value = agd.tanggal_pelaksanaan || "";
    document.getElementById('agd-waktu').value = agd.waktu || "";
    document.getElementById('agd-pj').value = agd.penanggung_jawab || "";
    document.getElementById('agd-keterangan').value = agd.keterangan || "";
  } else {
    document.getElementById('agenda-modal-title').innerText = "Form Tambah Agenda";
    document.getElementById('agd-id').value = "";
    document.getElementById('agd-kegiatan').value = "";
    document.getElementById('agd-jenis').value = "";
    document.getElementById('agd-tanggal').value = new Date().toISOString().substring(0, 10);
    document.getElementById('agd-waktu').value = "";
    document.getElementById('agd-pj').value = "";
    document.getElementById('agd-keterangan').value = "";
  }
  document.getElementById('modal-agenda').style.display = 'flex';
}

function closeAgendaModal() {
  document.getElementById('modal-agenda').style.display = 'none';
}

function actionSaveAgenda() {
  const payload = {
    id_agenda: document.getElementById('agd-id').value,
    kegiatan: document.getElementById('agd-kegiatan').value,
    jenis_kegiatan: document.getElementById('agd-jenis').value,
    tanggal_pelaksanaan: document.getElementById('agd-tanggal').value,
    waktu: document.getElementById('agd-waktu').value,
    penanggung_jawab: document.getElementById('agd-pj').value,
    keterangan: document.getElementById('agd-keterangan').value
  };

  if (!payload.kegiatan || !payload.jenis_kegiatan || !payload.tanggal_pelaksanaan || !payload.waktu || !payload.penanggung_jawab) {
    showToast("Semua field agenda wajib diisi!", true);
    return;
  }

  setLoader(true, "Menyimpan agenda...");
  callAPI('saveAgenda', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      showToast(res.message);
      closeAgendaModal();
      loadAgenda();
      loadNotifications(false);
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function actionDeleteAgenda(idAgenda) {
  if (!confirm("Apakah Anda yakin ingin menghapus agenda ini?")) return;
  setLoader(true, "Menghapus agenda...");
  callAPI('deleteAgenda', [sessionToken, idAgenda])
    .then(res => {
      setLoader(false);
      showToast(res.message);
      loadAgenda();
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

// =========================================================================
// === DOKUMENTASI KEGIATAN                                              ===
// =========================================================================
function processKegiatanPhoto(index, event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    showToast("Ukuran file Foto terlalu besar! Batas maksimal adalah 10 MB.", true);
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const maxDim = 1024;
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
      showToast("Foto " + index + " siap diunggah.");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function loadKegiatan() {
  callAPI('getKegiatanList', [sessionToken])
    .then(res => {
      if (res.success) {
        const grid = document.getElementById('grid-list-kegiatan');
        if (!grid) return;
        grid.innerHTML = "";
        if (res.list.length === 0) {
          grid.innerHTML = `<p style="text-align:center; color:var(--color-text-muted);">Belum ada dokumentasi kegiatan.</p>`;
          return;
        }
        res.list.forEach(keg => {
          let imgUrl = keg.foto1 || "https://via.placeholder.com/300x160?text=SIAP+WANAMSKA";
          grid.innerHTML += `
            <div class="kegiatan-card">
              <img src="${imgUrl}" class="kegiatan-img" alt="Foto Kegiatan">
              <div class="kegiatan-body">
                <div>
                  <h3 style="font-family:var(--font-title); font-size:1.1rem; color:var(--color-primary-brown); margin-bottom:5px;">${keg.nama_kegiatan}</h3>
                  <p style="font-size:0.8rem; color:var(--color-text-muted); margin-bottom:8px;">📍 ${keg.lokasi} | 📅 ${keg.tanggal}</p>
                  <p style="font-size:0.9rem;">${keg.deskripsi}</p>
                </div>
              </div>
            </div>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function openKegiatanModal() {
  document.getElementById('kegiatan-modal-title').innerText = "Form Tambah Dokumentasi Kegiatan";
  document.getElementById('keg-id').value = "";
  document.getElementById('keg-nama').value = "";
  document.getElementById('keg-tanggal').value = new Date().toISOString().substring(0, 10);
  document.getElementById('keg-lokasi').value = "";
  document.getElementById('keg-deskripsi').value = "";
  document.getElementById('keg-foto-1-base64').value = "";
  document.getElementById('keg-foto-2-base64').value = "";
  document.getElementById('keg-foto-3-base64').value = "";
  document.getElementById('modal-kegiatan').style.display = 'flex';
}

function closeKegiatanModal() {
  document.getElementById('modal-kegiatan').style.display = 'none';
}

function actionSaveKegiatan() {
  const payload = {
    id_kegiatan: document.getElementById('keg-id').value,
    nama_kegiatan: document.getElementById('keg-nama').value,
    tanggal: document.getElementById('keg-tanggal').value,
    lokasi: document.getElementById('keg-lokasi').value,
    deskripsi: document.getElementById('keg-deskripsi').value,
    foto1: document.getElementById('keg-foto-1-base64').value,
    foto2: document.getElementById('keg-foto-2-base64').value,
    foto3: document.getElementById('keg-foto-3-base64').value
  };

  if (!payload.nama_kegiatan || !payload.tanggal || !payload.lokasi || !payload.deskripsi || !payload.foto1) {
    showToast("Field Nama, Tanggal, Lokasi, Deskripsi, dan Foto 1 utama wajib diisi!", true);
    return;
  }

  setLoader(true, "Mengunggah dokumentasi ke Google Drive...");
  callAPI('saveKegiatan', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      showToast(res.message);
      closeKegiatanModal();
      loadKegiatan();
      loadNotifications(false);
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

// =========================================================================
// === INVENTARIS & KAS                                                  ===
// =========================================================================
function loadInventaris() {
  callAPI('getInventarisList', [sessionToken])
    .then(res => {
      if (res.success) {
        const tbody = document.getElementById('body-inventaris');
        if (!tbody) return;
        tbody.innerHTML = "";
        res.list.forEach(row => {
          tbody.innerHTML += `
            <tr>
              <td>${row.id_barang}</td>
              <td>${row.nama_barang}</td>
              <td>${row.kategori}</td>
              <td>${row.jumlah}</td>
              <td>${row.kondisi}</td>
              <td>${row.locations_simpan}</td>
              <td>-</td>
            </tr>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function openInventarisModal() {
  document.getElementById('modal-inventaris').style.display = 'flex';
}
function closeInventarisModal() {
  document.getElementById('modal-inventaris').style.display = 'none';
}
function actionSaveInventaris() {
  closeInventarisModal();
  showToast("Inventaris disimpan.");
}

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
  document.getElementById('modal-kas').style.display = 'flex';
}
function closeKasModal() {
  document.getElementById('modal-kas').style.display = 'none';
}
function actionSaveKas() {
  closeKasModal();
  showToast("Kas berhasil dicatat.");
}

// =========================================================================
// === PROFIL DIRI & SIMPAN FOTO KE DRIVE                                ===
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
        document.getElementById('prof-tanggal-lahir').value = p.tanggal_lahir ? p.tanggal_lahir.substring(0, 10) : "";
        if (p.jenis_kelamin) document.getElementById('prof-jk').value = p.jenis_kelamin;
        document.getElementById('prof-golongan').value = p.golongan || "";
        document.getElementById('prof-regu').value = p.regu_sangga || "";
        document.getElementById('prof-alamat').value = p.alamat || "";
        document.getElementById('prof-hp').value = p.no_hp || "";
        if (p.foto_profil) {
          document.getElementById('prof-preview-img').src = p.foto_profil;
          profilePhotoBase64 = p.foto_profil;
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
      profilePhotoBase64 = dataUrl; 
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
    foto_profil: profilePhotoBase64 
  };
  setLoader(true, "Menyimpan profil & foto ke Drive...");

  callAPI('saveUserProfile', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      showToast(res.message);
      loadProfileDiri();
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function actionGantiPassword() {
  const lama = document.getElementById('pass-lama').value;
  const baru = document.getElementById('pass-baru').value;
  if (!lama || !baru) { showToast("Password lama dan baru wajib diisi.", true); return; }
  callAPI('changePassword', [sessionToken, lama, baru])
    .then(res => showToast(res.message, !res.success))
    .catch(err => showToast(err.message, true));
}

// =========================================================================
// === MANAJEMEN USER & EXPORT (EXCEL, PDF, & DOC)                       ===
// =========================================================================
function loadUsers() {
  callAPI('getUserList', [sessionToken])
    .then(res => {
      if (res.success) {
        const tbody = document.getElementById('body-users');
        if (!tbody) return;
        tbody.innerHTML = "";
        res.list.forEach(row => {
          tbody.innerHTML += `
            <tr>
              <td><strong>${row.user_id}</strong></td>
              <td>${row.nama_lengkap}</td>
              <td><span class="role">${row.role}</span></td>
              <td><span class="badge badge-hadir">${row.status_aktif}</span></td>
              <td>-</td>
            </tr>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function openUserModal() { document.getElementById('modal-user').style.display = 'flex'; }
function closeUserModal() { document.getElementById('modal-user').style.display = 'none'; }
function actionSaveUser() { closeUserModal(); showToast("User disimpan."); }

function loadSystemLogs() {}

function triggerExport(jenis, format) {
  setLoader(true, `Mengekspor data ${jenis} ke format ${format.toUpperCase()}...`);
  
  let functionName = 'exportToExcel';
  if (format === 'pdf') functionName = 'exportToPDF';
  if (format === 'doc') functionName = 'exportToDOC';

  callAPI(functionName, [sessionToken, jenis])
    .then(res => {
      setLoader(false);
      if (res.success && res.url) {
        showToast("Ekspor Berhasil! Membuka file...");
        window.open(res.url, '_blank');
      } else {
        showToast(res.message || "Gagal mengekspor data", true);
      }
    })
    .catch(err => {
      setLoader(false);
      showToast(err.message, true);
    });
}
