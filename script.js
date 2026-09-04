// =========================================================================
// === KONFIGURASI SISTEM & API APPS SCRIPT                               ===
// =========================================================================

// URL Web App Apps Script resmi SIAP WANAMSKA
const API_URL = "https://script.google.com/macros/s/AKfycbzRPxxOjTXvd2w9pkpXISJFa7lL_NwPf788F19qU5Omu8mGv39COrdiNpPm5Z633lQC-A/exec";
const APP_VERSION = "2.10.0"; 

// =========================================================================
// === HELPER WAKTU LOKAL & FORMAT (FIX BUG WAKTU / TIMEZONE)             ===
// =========================================================================
// Semua operasi tanggal memakai zona waktu lokal perangkat (Asia/Jakarta /
// WIB), sehingga tidak lagi "lompat" satu hari karena new Date().toISOString()
// yang menggunakan UTC.
function localDateStr(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
// Tanggal default untuk input type=date (lokal, bukan UTC)
function todayLocalInput() { return localDateStr(); }
function dateNDaysLocal(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}
// Format ISO string -> "Relatif" (mis. "5 menit lalu") untuk notifikasi
function formatRelativeTime(input) {
  try {
    const t = new Date(input);
    if (isNaN(t.getTime())) return formatDateString(input);
    const diff = Date.now() - t.getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 0) return "baru saja";
    if (sec < 60) return "baru saja";
    const min = Math.floor(sec / 60);
    if (min < 60) return min + " menit lalu";
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + " jam lalu";
    const day = Math.floor(hr / 24);
    if (day < 7) return day + " hari lalu";
    return formatDateString(input);
  } catch (e) { return input; }
}
// Escape HTML agar data dari server tidak memicu XSS / merusak layout
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let sessionToken = "";
let userRole = "";
let userId = "";
let currentUser = null;

let streamRef = null;
let base64SelfieString = "";
let profilePhotoBase64 = "";
let currentFacingMode = "user";
let previewAnimId = null;

let userLatitude = null;
let userLongitude = null;
let isFakeGPSDetected = false;

// Cache data modul
let kegiatanListCache = [];
let inventarisListCache = [];
let kedaiListCache = [];
let currentKedaiTab = "Atribut Wajib"; // Default tab aktif Kedai

// Variabel penampung upload berkas materi & kedai
let materiFileBase64 = "";
let materiFileName = "";
let materiFileMime = "";
let kedaiFotoBase64 = "";

// =========================================================================
// === API CACHE & NETWORK ENGINE                                        ===
// =========================================================================

const API_CACHE = new Map();
const API_CACHE_TTL = 60000; // 60 detik

const READ_ONLY_FUNCS = new Set([
  'getDashboardData', 'getAbsenHistory', 'getKegiatanList', 'getAgendaList',
  'getInventarisList', 'getPeminjamanList', 'getKasData', 'getUserProfile', 'getUserList',
  'getNotificationList', 'getSystemLogs', 'getMateriFileList', 'getPotensiList',
  'getKedaiList', 'getKedaiNextId', 'getHasilKedaiList'
]);

function isWriteFunc(name) {
  return /^(save|add|submit|delete|change|logout|export|initialize|kembalikan|register|kurangi)/.test(name);
}

function isKasSpecialUser(uid) {
  if (!uid) return false;
  const u = String(uid).trim().toUpperCase();
  return u === "DGW20264" || u === "DGW20265";
}

// ============================================================
// OTORISASI MENU KEDAI PENGGALANG (SISI CLIENT - 2 TIER)
// TIER 1 - PENGELOLA KEDAI (tampilan & hak SETARA Admin):
//          + Tambah Stok Barang & - Jual/Kurangi Stok
//          => Admin (role) + DGW202638 + DGW202641
// TIER 2 - PETUGAS JUAL KEDAI (hak - Jual/Kurangi Stok saja)
//          => DGW20261, DGW20262, DGW20264, DGW20265
// ============================================================
const KEDAI_MANAGER_IDS = ["DGW202638", "DGW202641"];
const KEDAI_SELLER_IDS = ["DGW20261", "DGW20262", "DGW20264", "DGW20265"];

function isKedaiManager(uid) {
  if (!uid) return false;
  if (userRole === "Admin") return true;
  const u = String(uid).trim().toUpperCase();
  return KEDAI_MANAGER_IDS.indexOf(u) !== -1;
}
function isKedaiSeller(uid) {
  if (!uid) return false;
  if (isKedaiManager(uid)) return true;
  const u = String(uid).trim().toUpperCase();
  return KEDAI_SELLER_IDS.indexOf(u) !== -1;
}
// Kompatibilitas pemakaian lama
function isKedaiSpecialUser(uid) {
  return isKedaiSeller(uid);
}

async function callAPI(funcName, params = [], options = {}) {
  const useCache = options.cache !== false && READ_ONLY_FUNCS.has(funcName);
  const cacheKey = funcName + '|' + JSON.stringify(params || []);

  if (useCache) {
    const hit = API_CACHE.get(cacheKey);
    if (hit && (Date.now() - hit.t) < API_CACHE_TTL) return hit.data;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ func: funcName, params: params }),
      signal: controller.signal
    });
    const response = await res.json();
    if (response.status === 'success') {
      if (useCache) API_CACHE.set(cacheKey, { t: Date.now(), data: response.data });
      if (isWriteFunc(funcName)) API_CACHE.clear();
      return response.data;
    }
    throw new Error(response.message);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Koneksi lambat / server tidak merespons. Silakan coba beberapa saat lagi.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function clearAPICache() { API_CACHE.clear(); }

// =========================================================================
// === INISIALISASI APLIKASI (DOM CONTENT LOADED)                        ===
// =========================================================================

document.addEventListener('DOMContentLoaded', function () {
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
    setTimeout(() => { window.location.reload(true); }, 400);
    return;
  }

  requestGPSPermission();
  requestPushNotificationPermission();

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
  } else {
    showPage('login-page');
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.log('SW registration:', e));
  }

  initLiveTimer();
  initCreativeCalendar();

  // Login dengan menekan tombol Enter pada kolom User ID / Password
  const loginFields = ['userId', 'password'];
  loginFields.forEach(function (fieldId) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        if (document.getElementById('loginBtn') && !document.getElementById('loginBtn').disabled) {
          handleLogin();
        }
      }
    });
  });
});

// =========================================================================
// === SISTEM NOTIFIKASI PAKSA KE PERANGKAT/HP                           ===
// =========================================================================

function requestPushNotificationPermission() {
  if ("Notification" in window) {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          triggerNativeNotification("SIAP WANAMSKA", "Notifikasi perangkat berhasil diaktifkan.");
        }
      });
    }
  }
}

function triggerNativeNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body: body,
            icon: 'https://raw.githubusercontent.com/kbrahmana85-oss/SIAP-WANAMSKA-V-2.0/38ae1a1852e585227cf41ae4e6627420df71b199/logo_pwa.png',
            badge: 'https://raw.githubusercontent.com/kbrahmana85-oss/SIAP-WANAMSKA-V-2.0/38ae1a1852e585227cf41ae4e6627420df71b199/logo_pwa.png',
            vibrate: [200, 100, 200]
          });
        });
      } else {
        new Notification(title, {
          body: body,
          icon: 'https://raw.githubusercontent.com/kbrahmana85-oss/SIAP-WANAMSKA-V-2.0/38ae1a1852e585227cf41ae4e6627420df71b199/logo_pwa.png'
        });
      }
    } catch (e) {
      console.log("Device notification trigger error:", e);
    }
  }
}

// =========================================================================
// === BIOMETRIK & PASSKEY WEBAUTHN ENGINE                               ===
// =========================================================================

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function actionRegisterPasskey() {
  if (!window.PublicKeyCredential) {
    showToast("Perangkat atau peramban ini tidak mendukung otentikasi Biometrik/Passkey.", true);
    return;
  }

  try {
    const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!isAvailable) {
      showToast("Sensor sidik jari / kunci biometrik tidak tersedia pada perangkat ini.", true);
      return;
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    const userIdBytes = new TextEncoder().encode(userId);

    const createOptions = {
      publicKey: {
        challenge: challenge,
        rp: {
          name: "SIAP WANAMSKA",
          id: window.location.hostname || "localhost"
        },
        user: {
          id: userIdBytes,
          name: userId,
          displayName: currentUser.nama_lengkap || userId
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          requireResidentKey: false
        },
        timeout: 60000,
        attestation: "none"
      }
    };

    setLoader(true, "Sentuh sensor sidik jari / masukkan PIN perangkat...");
    const credential = await navigator.credentials.create(createOptions);
    setLoader(false);

    if (credential) {
      const credIdBase64 = bufferToBase64Url(credential.rawId);
      const deviceName = navigator.userAgent.includes("Android") ? "HP Android" : 
                         navigator.userAgent.includes("iPhone") ? "Apple iPhone" : 
                         navigator.userAgent.includes("Windows") ? "Laptop/PC Windows" : "Perangkat Biometrik";

      setLoader(true, "Mendaftarkan biometrik ke server...");
      const res = await callAPI('registerPasskey', [sessionToken, {
        credentialId: credIdBase64,
        deviceName: deviceName
      }]);
      setLoader(false);

      if (res.success) {
        localStorage.setItem("saved_passkey_cred_" + userId.toLowerCase(), credIdBase64);
        localStorage.setItem("last_passkey_user_id", userId.toLowerCase());
        showToast("✅ Sidik jari perangkat berhasil didaftarkan!");
        triggerNativeNotification("SIAP WANAMSKA", "Biometrik berhasil didaftarkan untuk akun Anda.");
      } else {
        showToast(res.message, true);
      }
    }
  } catch (err) {
    setLoader(false);
    console.error("Passkey registration failed:", err);
    if (err.name === "NotAllowedError") {
      showToast("Pendaftaran biometrik dibatalkan oleh pengguna.", true);
    } else {
      showToast("Gagal mendaftarkan biometrik: " + err.message, true);
    }
  }
}

async function handlePasskeyLogin() {
  if (!window.PublicKeyCredential) {
    showToast("Peramban Anda tidak mendukung otentikasi Biometrik.", true);
    return;
  }

  let inputUserId = document.getElementById('userId').value.trim().toLowerCase();
  if (!inputUserId) {
    inputUserId = localStorage.getItem("last_passkey_user_id") || "";
  }

  if (!inputUserId) {
    const prompted = prompt("Silakan masukkan User ID akun Anda untuk verifikasi biometrik:");
    if (!prompted) return;
    inputUserId = prompted.trim().toLowerCase();
    document.getElementById('userId').value = inputUserId;
  }

  const savedCredId = localStorage.getItem("saved_passkey_cred_" + inputUserId);

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const getOptions = {
      publicKey: {
        challenge: challenge,
        timeout: 60000,
        userVerification: "required",
        rpId: window.location.hostname || "localhost"
      }
    };

    if (savedCredId) {
      getOptions.publicKey.allowCredentials = [{
        id: base64UrlToBuffer(savedCredId),
        type: 'public-key',
        transports: ['internal']
      }];
    }

    setLoader(true, "Verifikasi sidik jari / kunci biometrik perangkat...");
    const assertion = await navigator.credentials.get(getOptions);
    setLoader(false);

    if (assertion) {
      const credIdUsed = bufferToBase64Url(assertion.rawId);
      setLoader(true, "Mengotentikasi ke sistem...");
      const res = await callAPI('loginWithPasskey', [inputUserId, credIdUsed]);
      setLoader(false);

      if (res.success) {
        sessionStorage.setItem('sessionToken', res.sessionToken);
        sessionStorage.setItem('user', JSON.stringify(res.user));

        sessionToken = res.sessionToken;
        currentUser = res.user;
        userRole = res.user.role;
        userId = res.user.user_id;

        localStorage.setItem("last_passkey_user_id", userId.toLowerCase());
        localStorage.setItem("saved_passkey_cred_" + userId.toLowerCase(), credIdUsed);

        document.getElementById('user-display-name').innerText = res.user.nama_lengkap;
        document.getElementById('user-display-role').innerText = res.user.role;

        setupRBACUI(res.user.role);
        showPage('dashboard-page');
        showToast("Login Biometrik Berhasil! Selamat datang, " + res.user.nama_lengkap);
      } else {
        showToast(res.message, true);
      }
    }
  } catch (err) {
    setLoader(false);
    console.error("Passkey login error:", err);
    if (err.name === "NotAllowedError") {
      showToast("Otentikasi biometrik dibatalkan.", true);
    } else {
      showToast("Biometrik gagal atau belum terdaftar untuk User ID tersebut.", true);
    }
  }
}

// =========================================================================
// === UTILITY & UI HELPER                                               ===
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

function requestGPSPermission() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (position) {
        userLatitude = position.coords.latitude;
        userLongitude = position.coords.longitude;
        isFakeGPSDetected = (position.mocked === true || (position.coords && position.coords.mocked === true) || (position.coords && position.coords.accuracy === 0));
        
        const overlay = document.getElementById('gps-blocking-overlay');
        if (overlay) overlay.style.display = 'none';
      },
      function () {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }
}

function showPage(pageId) {
  const toggleBtn = document.querySelector('.menu-toggle');
  const overlayEl = document.querySelector('.overlay');

  if (pageId === 'login-page' || pageId === 'login-screen') {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
    // Sembunyikan tombol menu & overlay agar tidak menumpuk di layar login
    if (toggleBtn) toggleBtn.style.display = 'none';
    if (overlayEl) overlayEl.classList.remove('active');
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) { sidebar.classList.remove('active'); sidebar.classList.remove('expanded'); }
    document.body.classList.remove('menu-open');
    return;
  }
  if (pageId === 'dashboard-page') {
    if (toggleBtn) toggleBtn.style.display = 'block';
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
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    // Mobile: dock ikon selalu tampil; klik ☰ membuka panel penuh di bawah header
    sidebar.classList.toggle('expanded');
    if (overlay) overlay.classList.toggle('active');
  } else {
    // Desktop: perluas / ciutkan (dock ikon <-> panel menu)
    sidebar.classList.toggle('expanded');
  }
  // Sinkron: geser konten agar panel terbuka tidak menutup isi halaman
  document.body.classList.toggle('menu-open', sidebar.classList.contains('expanded'));
}

function switchSection(sectionId, elementMenu) {
  const sections = document.querySelectorAll('.app-section');
  sections.forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });

  const target = document.getElementById(sectionId);
  if (target) { target.classList.add('active'); target.style.display = 'block'; }
  else {
    // Bagian tidak ditemukan: tampilkan Dashboard agar halaman tidak kosong
    const dash = document.getElementById('section-dashboard');
    if (dash) { dash.classList.add('active'); dash.style.display = 'block'; }
    showToast("Halaman tidak ditemukan.", true);
    return;
  }

  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => item.classList.remove('active'));
  if (elementMenu) elementMenu.classList.add('active');

  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.overlay');
  if (sidebar) {
    // Setelah memilih modul, ciutkan kembali ke dock agar tidak mengganggu isi
    sidebar.classList.remove('active');
    sidebar.classList.remove('expanded');
    document.body.classList.remove('menu-open');
    if (overlay) overlay.classList.remove('active');
  }

  if (sectionId !== 'section-absensi') {
    try { stopCamera(); } catch (e) {}
  }

  if (sectionId === 'section-dashboard') loadDashboard();
  else if (sectionId === 'section-absensi') loadAbsenHistory();
  else if (sectionId === 'section-kegiatan') loadKegiatan();
  else if (sectionId === 'section-agenda') loadAgenda();
  else if (sectionId === 'section-materi') closeMateriFilesContainer();
  else if (sectionId === 'section-potensi') loadPotensi();
  else if (sectionId === 'section-kedai') loadKedai(); // POIN 1.h
  else if (sectionId === 'section-inventaris') loadInventaris();
  else if (sectionId === 'section-kas') loadKas();
  else if (sectionId === 'section-profile') loadProfileDiri();
  else if (sectionId === 'section-users') loadUsers();
  else if (sectionId === 'section-logs') loadSystemLogs();
}

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
  if (monthYearEl) monthYearEl.innerText = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  
  const grid = document.getElementById('calendar-grid-cells');
  if (!grid) return;
  grid.innerHTML = "";
  
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const startDayIndex = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  for (let i = 0; i < startDayIndex; i++) grid.innerHTML += `<span class="empty-day"></span>`;
  const today = now.getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const isActive = day === today ? "active-day" : "";
    grid.innerHTML += `<span class="${isActive}">${day}</span>`;
  }
}

// =========================================================================
// === AUTENTIKASI PASSWORD & RBAC                                       ===
// =========================================================================

function setLoginLoading(isLoading) {
  const logo = document.getElementById('login-logo');
  const btn = document.getElementById('loginBtn');
  if (logo) logo.classList.toggle('login-logo-animate', isLoading);
  if (btn) {
    btn.disabled = isLoading;
    btn.innerText = isLoading ? 'Memproses...' : 'Login';
  }
}

function handleLogin() {
  const userIdVal = document.getElementById('userId').value.trim();
  const passwordVal = document.getElementById('password').value.trim();

  if (!userIdVal || !passwordVal) { 
    showToast('User ID dan Password wajib diisi', true); 
    return; 
  }
  showToast('Sedang autentikasi...');
  setLoginLoading(true);

  callAPI('loginUser', [userIdVal, passwordVal])
    .then(res => {
      setLoginLoading(false);
      if (res.success) {
        sessionStorage.setItem('sessionToken', res.sessionToken);
        sessionStorage.setItem('user', JSON.stringify(res.user));

        sessionToken = res.sessionToken;
        currentUser = res.user;
        userRole = res.user.role;
        userId = res.user.user_id;

        localStorage.setItem("last_passkey_user_id", userId.toLowerCase());

        document.getElementById('user-display-name').innerText = res.user.nama_lengkap;
        document.getElementById('user-display-role').innerText = res.user.role;

        setupRBACUI(res.user.role);
        showPage('dashboard-page');
        showToast("Selamat Datang, " + res.user.nama_lengkap);
      } else {
        showToast(res.message || 'Login gagal', true);
      }
    })
    .catch(err => {
      setLoginLoading(false);
      showToast(err.message || 'Login gagal', true);
    });
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
  const isSpecialKas = isKasSpecialUser(userId);
  // Hak akses modul Kedai: Pengelola (setara Admin) & Petugas Jual
  const isKedaiPengelola = isKedaiManager(userId);
  const isKedaiPetugasJual = isKedaiSeller(userId);

  // Sembunyikan elemen terbatas secara default
  document.getElementById('menu-materi').style.display = 'none';
  document.getElementById('menu-inventaris').style.display = 'none';
  document.getElementById('menu-kas').style.display = 'none';
  document.getElementById('menu-users').style.display = 'none';
  document.getElementById('menu-exports').style.display = 'none';
  document.getElementById('menu-logs').style.display = 'none';
  
  document.getElementById('btn-tambah-kegiatan-trigger').style.display = 'none';
  document.getElementById('btn-tambah-agenda-trigger').style.display = 'none';
  document.getElementById('btn-tambah-materi-trigger').style.display = 'none';
  document.getElementById('btn-tambah-potensi-trigger').style.display = 'none';
  document.getElementById('btn-tambah-kas').style.display = 'none';
  document.getElementById('btn-tambah-inventaris-trigger').style.display = 'none';
  document.getElementById('btn-tambah-peminjaman-trigger').style.display = 'none';
  
  // POIN 1.f & 1.g: Tombol Kedai Penggalang
  document.getElementById('btn-tambah-kedai-trigger').style.display = 'none';
  document.getElementById('btn-kurangi-kedai-trigger').style.display = 'none';

  document.getElementById('card-dash-kas').style.display = 'none';
  document.getElementById('export-absensi-box').style.display = 'none';
  document.getElementById('export-inventaris-box').style.display = 'none';
  document.getElementById('export-kas-box').style.display = 'none';

  document.getElementById('btn-lonceng').style.display = 'flex';
  setTimeout(function () { loadNotifications(false); }, 1500);

  // POIN 1.h: Menu Kedai Penggalang selalu tampil untuk semua peran
  document.getElementById('menu-kedai').style.display = 'flex';

  // Otorisasi Tombol Kedai Penggalang (tampilan & hak akses = Admin)
  //  - Admin & Pengelola Kedai (DGW202638 / DGW202641): Tambah Stok & Jual/Kurangi
  //  - Petugas Jual Kedai (DGW20261/62/64/65): Jual/Kurangi Stok
  if (isKedaiPengelola) {
    document.getElementById('btn-tambah-kedai-trigger').style.display = 'inline-block'; // Poin 1.f
    document.getElementById('btn-kurangi-kedai-trigger').style.display = 'inline-block'; // Poin 1.g
  } else if (isKedaiPetugasJual) {
    document.getElementById('btn-kurangi-kedai-trigger').style.display = 'inline-block'; // Poin 1.g
  }

  if (role === "Admin" || role === "Pembina" || role === "Dewan Penggalang") {
    document.getElementById('menu-materi').style.display = 'flex';
    document.getElementById('menu-inventaris').style.display = 'flex';
    document.getElementById('btn-tambah-peminjaman-trigger').style.display = 'inline-block';
  }

  if (role === "Admin" || role === "Pembina") {
    document.getElementById('btn-tambah-materi-trigger').style.display = 'inline-block';
    document.getElementById('btn-tambah-potensi-trigger').style.display = 'inline-block';
  }

  if (role === "Admin" || isSpecialKas) {
    document.getElementById('btn-tambah-kas').style.display = 'inline-block';
    document.getElementById('export-kas-box').style.display = 'block';
  }

  if (role === "Admin") {
    document.getElementById('card-riwayat-absen-global').style.display = 'block';
    document.getElementById('card-riwayat-absen-pribadi').style.display = 'none';

    document.getElementById('menu-kas').style.display = 'flex';
    document.getElementById('menu-users').style.display = 'flex';
    document.getElementById('menu-exports').style.display = 'flex';
    document.getElementById('menu-logs').style.display = 'flex';
    
    document.getElementById('btn-tambah-kegiatan-trigger').style.display = 'inline-block';
    document.getElementById('btn-tambah-agenda-trigger').style.display = 'inline-block';
    document.getElementById('btn-tambah-inventaris-trigger').style.display = 'inline-block';
    
    document.getElementById('card-dash-kas').style.display = 'flex';
    document.getElementById('export-absensi-box').style.display = 'block';
    document.getElementById('export-inventaris-box').style.display = 'block';
    document.getElementById('export-kas-box').style.display = 'block';

  } else {
    document.getElementById('card-riwayat-absen-global').style.display = 'none';
    document.getElementById('card-riwayat-absen-pribadi').style.display = 'block';

    if (role === "Pembina") {
      document.getElementById('menu-kas').style.display = 'flex';
      document.getElementById('menu-exports').style.display = 'flex';
      document.getElementById('btn-tambah-kegiatan-trigger').style.display = 'inline-block';
      document.getElementById('btn-tambah-agenda-trigger').style.display = 'inline-block';
      document.getElementById('btn-tambah-inventaris-trigger').style.display = 'inline-block';
      document.getElementById('card-dash-kas').style.display = 'flex';
      document.getElementById('export-absensi-box').style.display = 'block';
      
    } else if (role === "Dewan Penggalang") {
      document.getElementById('menu-kas').style.display = 'flex';
      document.getElementById('btn-tambah-kegiatan-trigger').style.display = 'inline-block';
      document.getElementById('btn-tambah-agenda-trigger').style.display = 'inline-block';
      document.getElementById('btn-tambah-inventaris-trigger').style.display = 'inline-block';
      document.getElementById('card-dash-kas').style.display = 'flex';
    }

    if (isSpecialKas) {
      document.getElementById('menu-kas').style.display = 'flex';
      document.getElementById('menu-exports').style.display = 'flex';
      document.getElementById('card-dash-kas').style.display = 'flex';
    }
  }
}

// =========================================================================
// === MODUL KEDAI PENGGALANG ENGINE (POIN 1.a - 1.l)                    ===
// =========================================================================

function switchKedaiTab(tabName) {
  currentKedaiTab = tabName;
  const tabWajib = document.getElementById('tab-kedai-wajib');
  const tabPelengkap = document.getElementById('tab-kedai-pelengkap');

  if (tabName === 'Atribut Wajib') {
    tabWajib.classList.add('active');
    tabPelengkap.classList.remove('active');
  } else {
    tabPelengkap.classList.add('active');
    tabWajib.classList.remove('active');
  }

  renderKedaiGrid();
}

function loadKedai() {
  const emptyState = document.getElementById('kedai-empty-state');
  const grid = document.getElementById('kedai-grid-list');
  if (!grid || !emptyState) return;

  setLoader(true, "Memuat katalog Kedai Penggalang...");

  callAPI('getKedaiList', [sessionToken])
    .then(res => {
      setLoader(false);
      if (res.success) {
        kedaiListCache = res.list || [];
        // Sinkronkan ulang tombol aksi & info peran langsung dari server (dinamis & akurat)
        syncKedaiRoleUI(res);
        renderKedaiGrid();
      }
    })
    .catch(err => {
      setLoader(false);
      showToast(err.message, true);
    });
}

// Sinkronisasi dinamis tombol aksi + keterangan peran pada halaman Kedai.
// Sumber utama = flag otorisasi dari server (isManager / isSeller);
// jika server versi lama (belum mengirim flag) => pakai helper lokal.
function syncKedaiRoleUI(res) {
  const flagManager = (res && typeof res.isManager === 'boolean') ? res.isManager : isKedaiManager(userId);
  const flagSeller  = (res && typeof res.isSeller  === 'boolean') ? res.isSeller  : isKedaiSeller(userId);
  const canTambah   = !!flagManager;
  const canJual     = !!flagManager || !!flagSeller;

  const btnTambah = document.getElementById('btn-tambah-kedai-trigger');
  const btnJual   = document.getElementById('btn-kurangi-kedai-trigger');
  if (btnTambah) btnTambah.style.display = canTambah ? 'inline-block' : 'none';
  if (btnJual)   btnJual.style.display   = canJual   ? 'inline-block' : 'none';

  const hint = document.getElementById('kedai-role-hint');
  if (hint) {
    if (canTambah) {
      hint.innerHTML = '<span class="kedai-hint-ico">&#128736;&#65039;</span><span><strong>Mode Pengelola Kedai (setara Admin):</strong> Anda dapat menambah / memperbarui stok dan mencatat penjualan atribut kedai.</span>';
      hint.style.display = 'flex';
    } else if (canJual) {
      hint.innerHTML = '<span class="kedai-hint-ico">&#128722;</span><span><strong>Petugas Jual Kedai:</strong> Anda dapat mencatat penjualan / pengurangan stok kedai.</span>';
      hint.style.display = 'flex';
    } else {
      hint.style.display = 'none';
    }
  }
}

function renderKedaiGrid() {
  const emptyState = document.getElementById('kedai-empty-state');
  const grid = document.getElementById('kedai-grid-list');
  if (!grid || !emptyState) return;

  // POIN 1.l: JIKA DATABASE BELUM ADA BARANG, MUNCULKAN ==SEGERA==
  if (kedaiListCache.length === 0) {
    emptyState.style.display = 'block';
    grid.style.display = 'none';
    return;
  }

  // Filter sesuai tab aktif
  const filtered = kedaiListCache.filter(item => item.jenis_atribut === currentKedaiTab);

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
    grid.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  grid.style.display = 'grid';
  grid.innerHTML = "";

  // POIN 1.e: TAMPILAN DETAILS DENGAN NAMA BARANG DAN TOMBOL LIHAT HARGA
  filtered.forEach((item, index) => {
    const isHabis = (item.jumlah <= 0 || item.keterangan === "Habis");
    const badgeClass = isHabis ? "badge-habis" : "badge-ada";
    const statusText = isHabis ? "Stok Habis" : "Stok Tersedia";
    const imgUrl = escapeHtml(item.foto_barang || "https://raw.githubusercontent.com/kbrahmana85-oss/SIAP-WANAMSKA-V-2.0/main/icon.png");
    const safeId = escapeHtml(item.id_barang);
    const safeName = escapeHtml(item.nama_barang);

    grid.innerHTML += `
      <div class="kedai-card" style="animation-delay:${Math.min(index * 70, 560)}ms">
        <div class="kedai-img-wrap">
          <img src="${imgUrl}" alt="${safeName}" loading="lazy">
        </div>
        <div class="kedai-body">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.75rem; font-weight: 700; color: var(--color-text-muted);">${safeId}</span>
              <span class="badge ${badgeClass}">${statusText}</span>
            </div>
            <h3 style="font-size: 1rem; color: var(--color-primary-dark); margin-bottom: 12px; line-height: 1.4;">${safeName}</h3>
          </div>
          <div>
            <button class="btn btn-gold btn-full" style="padding: 9px 12px; font-size: 0.85rem;" onclick="openDetailKedaiModal('${safeId}')">
              🔍 Lihat Harga / Detail
            </button>
          </div>
        </div>
      </div>`;
  });
}

// POIN 1.e: MODAL DETAIL / LIHAT HARGA
function openDetailKedaiModal(idBarang) {
  const item = kedaiListCache.find(b => b.id_barang === idBarang);
  if (!item) return;

  document.getElementById('kedai-detail-nama').innerText = item.nama_barang;
  document.getElementById('kedai-detail-kategori').innerText = item.jenis_atribut;
  document.getElementById('kedai-detail-harga').innerText = "Rp " + Number(item.harga_satuan).toLocaleString('id-ID');
  document.getElementById('kedai-detail-stok').innerText = item.jumlah + " Unit";
  
  const isHabis = (item.jumlah <= 0 || item.keterangan === "Habis");
  const statusEl = document.getElementById('kedai-detail-status');
  statusEl.className = `badge ${isHabis ? 'badge-habis' : 'badge-ada'}`;
  statusEl.innerText = isHabis ? "Habis" : "Tersedia";

  const imgEl = document.getElementById('kedai-detail-foto');
  imgEl.src = item.foto_barang || "https://raw.githubusercontent.com/kbrahmana85-oss/SIAP-WANAMSKA-V-2.0/main/icon.png";

  document.getElementById('modal-detail-kedai').style.display = 'flex';
}

function closeDetailKedaiModal() {
  document.getElementById('modal-detail-kedai').style.display = 'none';
}

// POIN 1.f: MODAL (+) TAMBAH / UPDATE MASTER STOK KEDAI
function openTambahKedaiModal() {
  document.getElementById('kedai-form-id').value = "";
  document.getElementById('kedai-form-nama').value = "";
  document.getElementById('kedai-form-harga').value = "";
  document.getElementById('kedai-form-jumlah').value = "1";
  document.getElementById('kedai-form-file').value = "";
  document.getElementById('kedai-form-foto-base64').value = "";
  kedaiFotoBase64 = "";

  onKedaiJenisChange();
  document.getElementById('modal-tambah-kedai').style.display = 'flex';
}

function closeTambahKedaiModal() {
  document.getElementById('modal-tambah-kedai').style.display = 'none';
}

function onKedaiJenisChange() {
  const jenis = document.getElementById('kedai-form-jenis').value;
  // cache:false -> ID berikutnya harus selalu fresh agar tidak terduplikasi
  callAPI('getKedaiNextId', [sessionToken, jenis], { cache: false }).then(res => {
    if (res.success && res.nextId) {
      document.getElementById('kedai-form-id-display').value = res.nextId;
      document.getElementById('kedai-form-id').value = res.nextId;
    }
  }).catch(() => {});
}

function processKedaiPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  setLoader(true, "Mengompresi foto barang...");
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const maxDim = 900;
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

      kedaiFotoBase64 = canvas.toDataURL('image/jpeg', 0.85);
      document.getElementById('kedai-form-foto-base64').value = kedaiFotoBase64;
      setLoader(false);
      showToast("Foto barang siap diunggah.");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function actionSaveKedaiBarang() {
  const payload = {
    id_barang: document.getElementById('kedai-form-id').value,
    jenis_atribut: document.getElementById('kedai-form-jenis').value,
    nama_barang: document.getElementById('kedai-form-nama').value.trim(),
    harga_satuan: parseFloat(document.getElementById('kedai-form-harga').value) || 0,
    jumlah: parseInt(document.getElementById('kedai-form-jumlah').value) || 0,
    foto_barang: document.getElementById('kedai-form-foto-base64').value
  };

  if (!payload.nama_barang || payload.harga_satuan <= 0 || payload.jumlah <= 0) {
    showToast("Nama Barang, Harga Satuan, dan Jumlah Stok wajib diisi dengan benar!", true);
    return;
  }

  setLoader(true, "Menyimpan data stok ke Kedai Penggalang...");
  callAPI('saveKedaiBarang', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      if (res.success) {
        showToast(res.message);
        closeTambahKedaiModal();
        // Otomatis pindah ke tab kategori barang yang baru disimpan agar langsung terlihat
        if (payload.jenis_atribut && currentKedaiTab !== payload.jenis_atribut) {
          switchKedaiTab(payload.jenis_atribut);
        }
        loadKedai();
        loadNotifications(false);
      } else {
        showToast(res.message, true);
      }
    })
    .catch(err => {
      setLoader(false);
      showToast(err.message, true);
    });
}

// POIN 1.g & 1.j: MODAL (-) JUAL / KURANGI STOK KEDAI
function openKurangiKedaiModal() {
  const selectEl = document.getElementById('kedai-jual-select');
  selectEl.innerHTML = `<option value="">-- Pilih Barang yang Dibeli --</option>`;

  // Filter hanya barang yang stoknya > 0
  const availableItems = kedaiListCache.filter(item => item.jumlah > 0);
  availableItems.forEach(item => {
    selectEl.innerHTML += `<option value="${item.id_barang}">${item.nama_barang} (${item.jenis_atribut} - Sisa: ${item.jumlah})</option>`;
  });
  if (availableItems.length === 0) {
    showToast("Belum ada barang dengan stok tersedia untuk dijual.", true);
  }

  document.getElementById('kedai-jual-id').value = "";
  document.getElementById('kedai-jual-harga-display').value = "-";
  document.getElementById('kedai-jual-harga-val').value = "0";
  document.getElementById('kedai-jual-stok-display').value = "-";
  document.getElementById('kedai-jual-jumlah').value = "1";
  document.getElementById('kedai-jual-total-display').innerText = "Rp 0";

  document.getElementById('modal-kurangi-kedai').style.display = 'flex';
}

function closeKurangiKedaiModal() {
  document.getElementById('modal-kurangi-kedai').style.display = 'none';
}

function onKedaiJualSelectChange() {
  const selectedId = document.getElementById('kedai-jual-select').value;
  const targetItem = kedaiListCache.find(b => b.id_barang === selectedId);

  if (targetItem) {
    document.getElementById('kedai-jual-id').value = targetItem.id_barang;
    document.getElementById('kedai-jual-harga-display').value = "Rp " + Number(targetItem.harga_satuan).toLocaleString('id-ID');
    document.getElementById('kedai-jual-harga-val').value = targetItem.harga_satuan;
    document.getElementById('kedai-jual-stok-display').value = targetItem.jumlah + " Unit Tersedia";
    document.getElementById('kedai-jual-jumlah').max = targetItem.jumlah;
    document.getElementById('kedai-jual-jumlah').value = "1";
  } else {
    document.getElementById('kedai-jual-id').value = "";
    document.getElementById('kedai-jual-harga-display').value = "-";
    document.getElementById('kedai-jual-harga-val').value = "0";
    document.getElementById('kedai-jual-stok-display').value = "-";
  }

  calculateKedaiTotalPembayaran();
}

function calculateKedaiTotalPembayaran() {
  const qty = parseInt(document.getElementById('kedai-jual-jumlah').value) || 0;
  const harga = parseFloat(document.getElementById('kedai-jual-harga-val').value) || 0;
  const total = qty * harga;
  document.getElementById('kedai-jual-total-display').innerText = "Rp " + total.toLocaleString('id-ID');
}

function actionSubmitKurangiKedai() {
  const payload = {
    id_barang: document.getElementById('kedai-jual-id').value,
    jumlah: parseInt(document.getElementById('kedai-jual-jumlah').value) || 0
  };

  if (!payload.id_barang || payload.jumlah <= 0) {
    showToast("Pilih barang dan tentukan jumlah unit yang valid!", true);
    return;
  }

  setLoader(true, "Memproses transaksi penjualan kedai...");
  callAPI('kurangiStokKedai', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      if (res.success) {
        showToast(res.message);
        closeKurangiKedaiModal();
        loadKedai();
        loadNotifications(false);
      } else {
        showToast(res.message, true);
      }
    })
    .catch(err => {
      setLoader(false);
      showToast(err.message, true);
    });
}

// =========================================================================
// === NOTIFIKASI LONCENG & PUSH UPDATE                                  ===
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
        
        if (!res.list || res.list.length === 0) {
          container.innerHTML = `
            <div style="text-align: center; padding: 25px 15px; color: var(--color-text-muted);">
              <span style="font-size: 2.5rem; display: block; margin-bottom: 8px;">🔕</span>
              <strong style="font-size: 1rem; color: var(--color-primary);">BELUM ADA PEMBAHARUAN</strong>
              <p style="font-size: 0.8rem; margin-top: 4px;">Tidak ada aktivitas baru yang tercatat dalam 24 jam terakhir.</p>
            </div>`;
          const badge = document.getElementById('lonceng-badge');
          if (badge) badge.style.display = 'none';
          return;
        }

        res.list.forEach(notif => {
          let icon = '📢';
          if (notif.type === 'absensi') icon = '✅';
          else if (notif.type === 'inventaris') icon = '📦';
          else if (notif.type === 'kedai') icon = '🏪';
          else if (notif.type === 'kas') icon = '💰';
          else if (notif.type === 'agenda') icon = '🗓️';
          else if (notif.type === 'potensi') icon = '🎯';
          else if (notif.type === 'kegiatan') icon = '📸';

          const scheduleLine = notif.schedule
            ? `<div style="font-size:0.8rem; color:var(--color-primary-dark); font-weight:600; background:#FAF4EE; border:1px solid var(--color-light-brown); padding:4px 10px; border-radius:6px; margin-top:5px; display:inline-block;">📅 ${escapeHtml(notif.schedule)}</div>`
            : '';

          container.innerHTML += `
            <div class="notif-item">
              <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 3px;">🕒 <span class="notif-time">${formatRelativeTime(notif.timestamp)}</span> <span style="opacity:0.7;">• ${formatDateString(notif.timestamp)}</span></div>
              <div style="font-weight: 700; color: var(--color-text-dark); font-size: 0.88rem;">${icon} ${escapeHtml(notif.title)}</div>
              <div style="font-size: 0.82rem; color: var(--color-text-muted); margin-top: 2px;">${escapeHtml(notif.detail)}</div>
              ${scheduleLine}
            </div>`;
        });

        const newestId = res.list[0].id;
        const lastReadId = localStorage.getItem('last_read_notif_id_' + userId);

        if (lastReadId !== newestId && !markAsRead) {
          triggerNativeNotification("SIAP WANAMSKA: " + res.list[0].title, res.list[0].detail);
        }

        const badge = document.getElementById('lonceng-badge');
        if (badge) {
          if (markAsRead) {
            localStorage.setItem('last_read_notif_id_' + userId, newestId);
            badge.style.display = 'none';
          } else {
            badge.style.display = (lastReadId !== newestId) ? 'block' : 'none';
          }
        }
      }
    })
    .catch(err => console.error("Gagal memuat notifikasi:", err));
}

function formatDateString(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
}

// =========================================================================
// === DOKUMENTASI KEGIATAN & PEMBACA FOTO LAMPIRAN BERITA               ===
// =========================================================================

function loadKegiatan() {
  const container = document.getElementById('list-details-kegiatan');
  if (!container) return;

  callAPI('getKegiatanList', [sessionToken])
    .then(res => {
      if (res.success) {
        kegiatanListCache = res.list || [];
        container.innerHTML = "";

        if (kegiatanListCache.length === 0) {
          container.innerHTML = `<p style="text-align:center; color:var(--color-text-muted); padding: 25px 0;">Belum ada dokumentasi kegiatan yang tersimpan.</p>`;
          return;
        }

        kegiatanListCache.forEach((keg, idx) => {
          const authorId = keg.dibuat_oleh || "Admin";
          const tgl = keg.tanggal || keg.tanggal_dibuat || "-";
          const canEdit = ["Admin", "Pembina", "Dewan Penggalang"].indexOf(userRole) !== -1;
          const canDelete = userRole === "Admin";
          let actionBtns = "";
          if (canEdit) {
            actionBtns += `<span class="badge-reader-btn" style="cursor:pointer;" onclick="event.stopPropagation(); openEditKegiatanModal(${idx})">✏️ Edit</span>`;
          }
          if (canDelete) {
            actionBtns += `<span class="badge-reader-btn" style="cursor:pointer; border-color:var(--color-danger-red); color:var(--color-danger-red);" onclick="event.stopPropagation(); actionDeleteKegiatan('${escapeHtml(keg.id_kegiatan)}')">🗑️ Hapus</span>`;
          }

          container.innerHTML += `
            <div class="kegiatan-detail-item" onclick="openBacaKegiatanModal(${idx})">
              <div style="flex: 1;">
                <div style="font-weight: 700; color: var(--color-primary); font-size: 1.05rem;">${escapeHtml(keg.nama_kegiatan)}</div>
                <div class="kegiatan-meta">
                  <span>📅 Tanggal: <strong>${escapeHtml(tgl)}</strong></span>
                  <span>📍 Lokasi: <strong>${escapeHtml(keg.lokasi)}</strong></span>
                  <span>👤 ID Pembuat: <strong>${escapeHtml(authorId)}</strong></span>
                </div>
                <div class="kegiatan-brief">${escapeHtml(keg.deskripsi)}</div>
              </div>
              <div style="display:flex; flex-direction:column; gap:6px; align-items:stretch;">
                ${actionBtns}
                <span class="badge-reader-btn">📖 Baca Berita</span>
              </div>
            </div>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function openBacaKegiatanModal(index) {
  const keg = kegiatanListCache[index];
  if (!keg) return;

  document.getElementById('reader-title').innerText = keg.nama_kegiatan;
  document.getElementById('reader-date').innerText = keg.tanggal || keg.tanggal_dibuat || "-";
  document.getElementById('reader-location').innerText = keg.lokasi || "-";
  document.getElementById('reader-author').innerText = keg.dibuat_oleh || "Admin";
  document.getElementById('reader-description').innerText = keg.deskripsi || "-";

  const gallery = document.getElementById('reader-gallery-container');
  gallery.innerHTML = "";
  
  const photos = [keg.foto1, keg.foto2, keg.foto3, keg.foto4].filter(f => f && String(f).trim() !== "");
  
  if (photos.length === 0) {
    gallery.innerHTML = `<p style="font-size: 0.85rem; color: var(--color-text-muted); font-style: italic; grid-column: 1/-1;">Tidak ada lampiran foto untuk dokumentasi berita ini.</p>`;
  } else {
    photos.forEach((photoUrl, pIdx) => {
      gallery.innerHTML += `
        <div style="display:flex; flex-direction:column; align-items:center;">
          <img src="${photoUrl}" alt="Lampiran Foto ${pIdx+1}" onclick="viewFullImage('${photoUrl}')" title="Klik untuk memperbesar tampilan">
          <span style="font-size:0.75rem; color:var(--color-text-muted); margin-top:4px;">Lampiran Foto ${pIdx+1}</span>
        </div>`;
    });
  }

  document.getElementById('modal-baca-kegiatan').style.display = 'flex';
}

function closeBacaKegiatanModal() {
  document.getElementById('modal-baca-kegiatan').style.display = 'none';
}

function processKegiatanPhoto(index, event) {
  const file = event.target.files[0];
  if (!file) return;

  setLoader(true, "Mengompresi foto " + index + "...");
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const maxDim = 1000;
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
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      document.getElementById('keg-foto-' + index + '-base64').value = dataUrl;
      setLoader(false);
      showToast("Foto " + index + " siap diunggah.");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function openKegiatanModal() {
  document.getElementById('kegiatan-modal-title').innerText = "Form Tambah Dokumentasi Kegiatan";
  document.getElementById('keg-id').value = "";
  document.getElementById('keg-nama').value = "";
  document.getElementById('keg-tanggal').value = todayLocalInput();
  document.getElementById('keg-lokasi').value = "";
  document.getElementById('keg-deskripsi').value = "";
  document.getElementById('keg-foto-1-base64').value = "";
  document.getElementById('keg-foto-2-base64').value = "";
  document.getElementById('modal-kegiatan').style.display = 'flex';
}

// EDIT DOKUMENTASI KEGIATAN (isi form dengan data yang dipilih)
function openEditKegiatanModal(index) {
  const keg = kegiatanListCache[index];
  if (!keg) return;
  document.getElementById('kegiatan-modal-title').innerText = "Edit Dokumentasi Kegiatan";
  document.getElementById('keg-id').value = keg.id_kegiatan || "";
  document.getElementById('keg-nama').value = keg.nama_kegiatan || "";
  document.getElementById('keg-tanggal').value = String(keg.tanggal || "").substring(0, 10);
  document.getElementById('keg-lokasi').value = keg.lokasi || "";
  document.getElementById('keg-deskripsi').value = keg.deskripsi || "";
  // Foto lama tidak dimuat ulang; hanya foto baru jika user pilih berkas baru
  document.getElementById('keg-foto-1-base64').value = "";
  document.getElementById('keg-foto-2-base64').value = "";
  document.getElementById('modal-kegiatan').style.display = 'flex';
}

// HAPUS DOKUMENTASI KEGIATAN (Admin)
function actionDeleteKegiatan(idKegiatan) {
  if (!idKegiatan) return;
  if (!confirm("Apakah Anda yakin ingin menghapus dokumentasi kegiatan ini?")) return;
  setLoader(true, "Menghapus dokumentasi kegiatan...");
  callAPI('deleteKegiatan', [sessionToken, idKegiatan])
    .then(res => {
      setLoader(false);
      if (res.success) {
        showToast(res.message);
        loadKegiatan();
        loadNotifications(false);
      } else {
        showToast(res.message, true);
      }
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function closeKegiatanModal() {
  document.getElementById('modal-kegiatan').style.display = 'none';
}

function actionSaveKegiatan() {
  const payload = {
    id_kegiatan: document.getElementById('keg-id').value,
    nama_kegiatan: document.getElementById('keg-nama').value.trim(),
    tanggal: document.getElementById('keg-tanggal').value,
    lokasi: document.getElementById('keg-lokasi').value.trim(),
    deskripsi: document.getElementById('keg-deskripsi').value.trim(),
    foto1: document.getElementById('keg-foto-1-base64').value,
    foto2: document.getElementById('keg-foto-2-base64').value
  };

  if (!payload.nama_kegiatan || !payload.tanggal || !payload.lokasi || !payload.deskripsi || !payload.foto1) {
    showToast("Field Nama, Tanggal, Lokasi, Deskripsi, dan Foto Utama wajib diisi!", true);
    return;
  }

  setLoader(true, "Menyimpan dokumentasi kegiatan...");
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
// === MODUL INVENTARIS & PEMINJAMAN BARANG                              ===
// =========================================================================

function switchInventarisTab(tabType) {
  const btnSimpan = document.getElementById('tab-btn-simpan');
  const btnPinjam = document.getElementById('tab-btn-pinjam');
  const viewSimpan = document.getElementById('view-inventaris-tersimpan');
  const viewPinjam = document.getElementById('view-inventaris-dipinjam');

  if (tabType === 'tersimpan') {
    btnSimpan.classList.add('active');
    btnPinjam.classList.remove('active');
    viewSimpan.style.display = 'block';
    viewPinjam.style.display = 'none';
    loadInventaris();
  } else {
    btnPinjam.classList.add('active');
    btnSimpan.classList.remove('active');
    viewPinjam.style.display = 'block';
    viewSimpan.style.display = 'none';
    loadPeminjaman();
  }
}

function loadInventaris() {
  callAPI('getInventarisList', [sessionToken])
    .then(res => {
      if (res.success) {
        inventarisListCache = res.list || [];
        const tbody = document.getElementById('body-inventaris');
        if (!tbody) return;
        tbody.innerHTML = "";
        
        if (inventarisListCache.length === 0) {
          tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Belum ada barang di inventaris.</td></tr>`;
          return;
        }

        inventarisListCache.forEach(row => {
          const lokasi = row.locations_simpan || row.lokasi_simpan || "-";
          const stokBadge = row.jumlah > 0 ? `<span class="badge badge-hadir">${row.jumlah} Unit</span>` : `<span class="badge badge-dipinjam">Habis / 0</span>`;
          const canEdit = ["Admin", "Pembina", "Dewan Penggalang"].indexOf(userRole) !== -1;
          const canDelete = userRole === "Admin";
          let actionBtns = "-";
          if (canEdit) {
            actionBtns = `<button class="btn" style="padding:4px 10px; font-size:0.78rem; margin-right:4px;" onclick="openInventarisModal('${escapeHtml(row.id_barang)}')">Edit</button>`;
          }
          if (canDelete) {
            actionBtns += `<button class="btn btn-danger" style="padding:4px 10px; font-size:0.78rem;" onclick="actionDeleteInventaris('${escapeHtml(row.id_barang)}')">Hapus</button>`;
          }
          tbody.innerHTML += `
            <tr>
              <td><strong>${escapeHtml(row.id_barang)}</strong></td>
              <td>${escapeHtml(row.nama_barang)}</td>
              <td>${escapeHtml(row.kategori)}</td>
              <td>${stokBadge}</td>
              <td>${escapeHtml(row.kondisi)}</td>
              <td>${escapeHtml(lokasi)}</td>
              <td>${actionBtns}</td>
            </tr>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function loadPeminjaman() {
  callAPI('getPeminjamanList', [sessionToken])
    .then(res => {
      if (res.success) {
        const tbody = document.getElementById('body-peminjaman');
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!res.list || res.list.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Belum ada riwayat peminjaman barang.</td></tr>`;
          return;
        }

        res.list.forEach(p => {
          const isDipinjam = (p.status === "Dipinjam");
          const badgeClass = isDipinjam ? "badge-dipinjam" : "badge-kembali";
          
          let actionBtn = "-";
          if (isDipinjam && (userRole === "Admin" || userRole === "Pembina" || userRole === "Dewan Penggalang")) {
            actionBtn = `<button class="btn btn-gold" style="padding:4px 10px; font-size:0.8rem;" onclick="actionKembalikanBarang('${p.id_pinjam}')">Kembalikan ↩️</button>`;
          }

          tbody.innerHTML += `
            <tr>
              <td><strong>${escapeHtml(p.id_pinjam)}</strong></td>
              <td><strong>${escapeHtml(p.nama_barang)}</strong><br><span style="font-size:0.75rem; color:var(--color-text-muted);">${escapeHtml(p.id_barang)}</span></td>
              <td>${escapeHtml(p.jumlah_pinjam)} Unit</td>
              <td>Pinjam: ${escapeHtml(p.tanggal_pinjam)}<br><span style="font-size:0.75rem;">Kembali: ${escapeHtml(p.tanggal_kembali) || "-"}</span></td>
              <td><strong>${escapeHtml(p.nama_peminjam)}</strong></td>
              <td><span class="badge ${badgeClass}">${escapeHtml(p.status)}</span></td>
              <td>${actionBtn}</td>
            </tr>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function openPeminjamanModal() {
  const selectBarang = document.getElementById('pjm-select-barang');
  selectBarang.innerHTML = `<option value="">-- Pilih Barang yang Tersedia --</option>`;

  if (inventarisListCache.length === 0) {
    callAPI('getInventarisList', [sessionToken]).then(res => {
      if (res.success) {
        inventarisListCache = res.list || [];
        populateSelectBarangOptions();
      }
    });
  } else {
    populateSelectBarangOptions();
  }

  document.getElementById('pjm-id-barang').value = "";
  document.getElementById('pjm-nama-barang').value = "";
  document.getElementById('pjm-stok-tersedia').value = "-";
  document.getElementById('pjm-jumlah').value = "1";
  
  const today = todayLocalInput();
  document.getElementById('pjm-tgl-pinjam').value = today;
  const next3Days = dateNDaysLocal(3);
  document.getElementById('pjm-tgl-kembali').value = next3Days;
  document.getElementById('pjm-nama-peminjam').value = "";

  document.getElementById('modal-peminjaman').style.display = 'flex';
}

function populateSelectBarangOptions() {
  const selectBarang = document.getElementById('pjm-select-barang');
  inventarisListCache.forEach(item => {
    if (item.jumlah > 0) {
      selectBarang.innerHTML += `<option value="${item.id_barang}">${item.nama_barang} (Stok: ${item.jumlah})</option>`;
    }
  });
}

function onPeminjamanBarangChange() {
  const selectedId = document.getElementById('pjm-select-barang').value;
  const targetItem = inventarisListCache.find(b => b.id_barang === selectedId);

  if (targetItem) {
    document.getElementById('pjm-id-barang').value = targetItem.id_barang;
    document.getElementById('pjm-nama-barang').value = targetItem.nama_barang;
    document.getElementById('pjm-stok-tersedia').value = targetItem.jumlah + " Unit Tersedia";
    document.getElementById('pjm-jumlah').max = targetItem.jumlah;
  } else {
    document.getElementById('pjm-id-barang').value = "";
    document.getElementById('pjm-nama-barang').value = "";
    document.getElementById('pjm-stok-tersedia').value = "-";
  }
}

function closePeminjamanModal() {
  document.getElementById('modal-peminjaman').style.display = 'none';
}

function actionSavePeminjaman() {
  const payload = {
    id_barang: document.getElementById('pjm-id-barang').value,
    nama_barang: document.getElementById('pjm-nama-barang').value,
    jumlah_pinjam: parseInt(document.getElementById('pjm-jumlah').value) || 0,
    tanggal_pinjam: document.getElementById('pjm-tgl-pinjam').value,
    tanggal_kembali: document.getElementById('pjm-tgl-kembali').value,
    nama_peminjam: document.getElementById('pjm-nama-peminjam').value.trim(),
    status: document.getElementById('pjm-status').value
  };

  if (!payload.id_barang || payload.jumlah_pinjam <= 0 || !payload.tanggal_pinjam || !payload.nama_peminjam) {
    showToast("Semua field peminjaman wajib diisi dengan benar!", true);
    return;
  }

  setLoader(true, "Mencatat peminjaman & mengurangi stok...");
  callAPI('savePeminjaman', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      if (res.success) {
        showToast(res.message);
        closePeminjamanModal();
        switchInventarisTab('dipinjam');
        loadNotifications(false);
      } else {
        showToast(res.message, true);
      }
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function actionKembalikanBarang(idPinjam) {
  if (!confirm("Konfirmasi pengembalian barang ini? Stok inventaris akan otomatis ditambahkan kembali.")) return;

  setLoader(true, "Memproses pengembalian barang...");
  callAPI('kembalikanBarang', [sessionToken, idPinjam])
    .then(res => {
      setLoader(false);
      if (res.success) {
        showToast(res.message);
        loadPeminjaman();
        loadInventaris();
      } else {
        showToast(res.message, true);
      }
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function openInventarisModal(idBarang) {
  document.getElementById('inv-modal-title').innerText = "Form Inventaris Barang";
  if (idBarang) {
    const item = inventarisListCache.find(b => b.id_barang === idBarang);
    if (item) {
      document.getElementById('inv-modal-title').innerText = "Edit Inventaris Barang";
      document.getElementById('inv-id').value = item.id_barang || "";
      document.getElementById('inv-nama').value = item.nama_barang || "";
      document.getElementById('inv-jumlah').value = item.jumlah || "1";
      if (item.kategori) document.getElementById('inv-kategori').value = item.kategori;
      if (item.kondisi) document.getElementById('inv-kondisi').value = item.kondisi;
      document.getElementById('inv-lokasi').value = item.locations_simpan || item.lokasi_simpan || "";
      document.getElementById('inv-tanggal').value = String(item.tanggal_masuk || "").substring(0, 10);
      document.getElementById('inv-keterangan').value = item.keterangan || "";
      document.getElementById('modal-inventaris').style.display = 'flex';
      return;
    }
  }
  // Mode tambah baru
  document.getElementById('inv-id').value = "";
  document.getElementById('inv-nama').value = "";
  document.getElementById('inv-jumlah').value = "1";
  document.getElementById('inv-kategori').selectedIndex = 0;
  document.getElementById('inv-kondisi').selectedIndex = 0;
  document.getElementById('inv-lokasi').value = "";
  document.getElementById('inv-tanggal').value = todayLocalInput();
  document.getElementById('inv-keterangan').value = "";
  document.getElementById('modal-inventaris').style.display = 'flex';
}

function actionDeleteInventaris(idBarang) {
  if (!idBarang) return;
  if (!confirm("Apakah Anda yakin ingin menghapus barang inventaris ini?")) return;
  setLoader(true, "Menghapus barang inventaris...");
  callAPI('deleteInventaris', [sessionToken, idBarang])
    .then(res => {
      setLoader(false);
      showToast(res.message, !res.success);
      if (res.success) loadInventaris();
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function closeInventarisModal() {
  document.getElementById('modal-inventaris').style.display = 'none';
}

function actionSaveInventaris() {
  const payload = {
    id_barang: document.getElementById('inv-id').value,
    nama_barang: document.getElementById('inv-nama').value.trim(),
    kategori: document.getElementById('inv-kategori').value,
    jumlah: document.getElementById('inv-jumlah').value,
    kondisi: document.getElementById('inv-kondisi').value,
    locations_simpan: document.getElementById('inv-lokasi').value.trim(),
    lokasi_simpan: document.getElementById('inv-lokasi').value.trim(),
    tanggal_masuk: document.getElementById('inv-tanggal').value,
    keterangan: document.getElementById('inv-keterangan').value.trim()
  };

  if (!payload.nama_barang || !payload.jumlah || !payload.lokasi_simpan || !payload.tanggal_masuk) {
    showToast("Field Nama Barang, Jumlah, Lokasi, dan Tanggal Masuk wajib diisi!", true);
    return;
  }

  setLoader(true, "Menyimpan data inventaris...");
  callAPI('saveInventaris', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      if (res.success) {
        showToast(res.message);
        closeInventarisModal();
        loadInventaris();
      } else {
        showToast(res.message, true);
      }
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

// =========================================================================
// === MATERI KEGIATAN & SYNC DRIVE                                      ===
// =========================================================================

function openTambahMateriModal() {
  document.getElementById('mat-judul').value = "";
  document.getElementById('mat-file').value = "";
  document.getElementById('mat-file-base64').value = "";
  materiFileBase64 = ""; materiFileName = ""; materiFileMime = "";
  document.getElementById('modal-tambah-materi').style.display = 'flex';
}

function closeTambahMateriModal() {
  document.getElementById('modal-tambah-materi').style.display = 'none';
}

function processMateriFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  materiFileName = file.name;
  materiFileMime = file.type || "application/pdf";

  setLoader(true, "Membaca berkas materi...");
  const reader = new FileReader();
  reader.onload = function(e) {
    materiFileBase64 = e.target.result;
    document.getElementById('mat-file-base64').value = materiFileBase64;
    setLoader(false);
    showToast("Berkas siap: " + materiFileName);
  };
  reader.readAsDataURL(file);
}

function actionSaveMateri() {
  const judul = document.getElementById('mat-judul').value.trim();
  const kategori = document.getElementById('mat-kategori').value;

  if (!judul || !materiFileBase64) {
    showToast("Judul dan File Materi wajib diisi / diunggah!", true);
    return;
  }

  const payload = {
    judul: judul,
    kategori: kategori,
    fileBase64: materiFileBase64,
    fileName: materiFileName,
    mimeType: materiFileMime
  };

  setLoader(true, "Mengunggah materi ke Google Drive...");
  callAPI('saveMateri', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      if (res.success) {
        showToast(res.message);
        closeTambahMateriModal();
        loadNotifications(false);
      } else {
        showToast(res.message, true);
      }
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function openMateriFolder(folderKey, folderTitle) {
  const container = document.getElementById('materi-files-container');
  const titleEl = document.getElementById('materi-folder-title');
  const tbody = document.getElementById('body-materi-files');

  if (!container || !tbody) return;

  titleEl.innerText = "Folder Berkas: " + folderTitle;
  tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Memuat berkas dari Google Drive...</td></tr>`;
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });

  setLoader(true, "Mengambil berkas materi...");

  callAPI('getMateriFileList', [sessionToken, folderKey])
    .then(res => {
      setLoader(false);
      if (res.success) {
        tbody.innerHTML = "";
        if (res.list.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-text-muted);">Folder ini masih kosong.</td></tr>`;
          return;
        }

        res.list.forEach(file => {
          let fileIcon = "📄";
          const mime = file.mimeType.toLowerCase();
          const fname = file.name.toLowerCase();

          if (mime.includes("pdf")) fileIcon = "📕 PDF";
          else if (mime.includes("image") || fname.endsWith(".jpg") || fname.endsWith(".png")) fileIcon = "🖼️ GAMBAR";
          else if (mime.includes("audio") || fname.endsWith(".mp3")) fileIcon = "🎵 AUDIO";
          else if (mime.includes("video") || fname.endsWith(".mp4")) fileIcon = "🎬 VIDEO";
          else if (mime.includes("word") || fname.endsWith(".doc") || fname.endsWith(".docx")) fileIcon = "📘 WORD";

          tbody.innerHTML += `
            <tr>
              <td><strong>${fileIcon}</strong></td>
              <td><strong>${file.name}</strong></td>
              <td>${file.size}</td>
              <td>
                <button class="btn btn-gold" style="padding: 6px 12px; font-size: 0.85rem;" onclick="actionDownloadMateri('${file.downloadUrl}', '${file.viewUrl}', '${file.name}')">
                  ⬇️ Unduh
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
  if (confirm("Unduh berkas '" + fileName + "' ke perangkat Anda?")) {
    showToast("Memulai unduhan berkas: " + fileName);
    var win = window.open(downloadUrl, '_blank');
    if (!win) window.location.href = viewUrl;
  }
}

// =========================================================================
// === MODUL KENALI POTENSIMU                                            ===
// =========================================================================

function loadPotensi() {
  const emptyState = document.getElementById('potensi-empty-state');
  const grid = document.getElementById('potensi-grid-list');
  if (!grid || !emptyState) return;

  callAPI('getPotensiList', [sessionToken])
    .then(res => {
      if (res.success) {
        if (!res.list || res.list.length === 0) {
          emptyState.style.display = 'block';
          grid.style.display = 'none';
          return;
        }

        emptyState.style.display = 'none';
        grid.style.display = 'grid';
        grid.innerHTML = "";

        const canManage = (userRole === "Admin" || userRole === "Pembina");

        res.list.forEach(item => {
          let deleteBtn = canManage ? `<button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="actionDeletePotensi('${item.id_potensi}')">Hapus</button>` : "";
          
          grid.innerHTML += `
            <div class="potensi-card">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                  <span class="badge badge-hadir">${escapeHtml(item.kategori)}</span>
                  <span style="font-size:0.75rem; color:var(--color-text-muted);">${escapeHtml(item.id_potensi)}</span>
                </div>
                <h3 style="font-size:1.1rem; color:var(--color-primary); margin-bottom:8px;">${escapeHtml(item.judul)}</h3>
                <p style="font-size:0.8rem; color:var(--color-text-muted); margin-bottom:15px;">Dibuat: ${formatDateString(item.created_at)}</p>
              </div>
              <div style="display:flex; gap:8px; justify-content:space-between; align-items:center;">
                <a href="${escapeHtml(item.link_url)}" target="_blank" rel="noopener" class="btn btn-gold" style="flex:1; padding:8px 12px; font-size:0.85rem; text-decoration:none;">
                  🚀 Buka Asesmen
                </a>
                ${deleteBtn}
              </div>
            </div>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function openPotensiModal() {
  document.getElementById('pot-id').value = "";
  document.getElementById('pot-judul').value = "";
  document.getElementById('pot-link-url').value = "";
  document.getElementById('modal-potensi').style.display = 'flex';
}

function closePotensiModal() {
  document.getElementById('modal-potensi').style.display = 'none';
}

function actionSavePotensi() {
  const payload = {
    id_potensi: document.getElementById('pot-id').value,
    judul: document.getElementById('pot-judul').value.trim(),
    kategori: document.getElementById('pot-kategori').value,
    link_url: document.getElementById('pot-link-url').value.trim()
  };

  if (!payload.judul || !payload.link_url) {
    showToast("Judul dan Link URL Asesmen wajib diisi!", true);
    return;
  }

  setLoader(true, "Menyimpan penugasan asesmen...");
  callAPI('savePotensi', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      if (res.success) {
        showToast(res.message);
        closePotensiModal();
        loadPotensi();
        loadNotifications(false);
      } else {
        showToast(res.message, true);
      }
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function actionDeletePotensi(idPotensi) {
  if (!confirm("Apakah Anda yakin ingin menghapus penugasan asesmen ini?")) return;
  setLoader(true, "Menghapus penugasan...");
  callAPI('deletePotensi', [sessionToken, idPotensi])
    .then(res => {
      setLoader(false);
      showToast(res.message);
      loadPotensi();
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

// =========================================================================
// === KAMERA (SELFIE ABSENSI) ANTI-MIRRORING                            ===
// =========================================================================

function isFrontCameraActive() {
  try {
    const track = streamRef && streamRef.getVideoTracks()[0];
    if (track && typeof track.getSettings === 'function') {
      const facing = track.getSettings().facingMode;
      if (facing) return facing === 'user';
    }
  } catch (e) {}
  return currentFacingMode === 'user';
}

function stopPreviewLoop() {
  if (previewAnimId) {
    cancelAnimationFrame(previewAnimId);
    previewAnimId = null;
  }
}

function ensurePreviewCanvas() {
  let canvas = document.getElementById('camera-preview-canvas');
  const box = document.querySelector('.camera-box');
  if (!canvas && box) {
    canvas = document.createElement('canvas');
    canvas.id = 'camera-preview-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const video = document.getElementById('camera-video');
    if (video && video.parentNode === box) box.insertBefore(canvas, video.nextSibling);
    else box.appendChild(canvas);
  }
  return canvas;
}

function setCameraSurfaceVisibility(mode) {
  const video = document.getElementById('camera-video');
  const liveCanvas = ensurePreviewCanvas();
  const snap = document.getElementById('selfie-canvas-preview');

  if (video) {
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.classList.add('camera-video-hidden');
    video.style.transform = 'none';
  }
  if (liveCanvas) liveCanvas.style.transform = 'none';
  if (snap) snap.style.transform = 'none';

  if (mode === 'live') {
    if (video) video.style.display = 'block';
    if (liveCanvas) liveCanvas.style.display = 'block';
    if (snap) snap.style.display = 'none';
  } else if (mode === 'snapshot') {
    if (liveCanvas) liveCanvas.style.display = 'none';
    if (video) video.style.display = 'none';
    if (snap) snap.style.display = 'block';
  }
}

function drawUnmirroredToContext(ctx, source, width, height) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (isFrontCameraActive()) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, width, height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawCameraPreviewFrame() {
  const video = document.getElementById('camera-video');
  const canvas = ensurePreviewCanvas();
  if (!video || !canvas || !streamRef) return;

  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w && h) {
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    drawUnmirroredToContext(canvas.getContext('2d'), video, w, h);
  }

  previewAnimId = requestAnimationFrame(drawCameraPreviewFrame);
}

function startCamera() {
  const video = document.getElementById('camera-video');
  if (!video) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Peramban tidak mendukung akses kamera.', true);
    return;
  }

  stopCamera();
  setCameraSurfaceVisibility('live');

  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: currentFacingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };

  navigator.mediaDevices.getUserMedia(constraints)
    .then(function (stream) {
      streamRef = stream;
      video.srcObject = stream;

      const onReady = function () {
        video.play().catch(function () {});
        stopPreviewLoop();
        drawCameraPreviewFrame();
      };
      if (video.readyState >= 2) onReady();
      else video.onloadedmetadata = onReady;

      showToast(currentFacingMode === 'user' ? 'Kamera depan aktif.' : 'Kamera belakang aktif.');
    })
    .catch(function (err) {
      showToast('Gagal mengakses kamera: ' + err.message, true);
    });
}

function stopCamera() {
  stopPreviewLoop();
  if (streamRef) {
    streamRef.getTracks().forEach(track => track.stop());
    streamRef = null;
  }
  const video = document.getElementById('camera-video');
  if (video) {
    video.srcObject = null;
    video.onloadedmetadata = null;
  }
}

function flipCamera() {
  currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
  startCamera();
}

function captureSnapshot() {
  const video = document.getElementById('camera-video');
  const preview = document.getElementById('selfie-canvas-preview');
  const liveCanvas = document.getElementById('camera-preview-canvas');
  if (!video || !video.srcObject) {
    showToast('Aktifkan kamera terlebih dahulu!', true);
    return;
  }

  const canvas = document.createElement('canvas');
  const srcW = (liveCanvas && liveCanvas.width) || video.videoWidth || 640;
  const srcH = (liveCanvas && liveCanvas.height) || video.videoHeight || 480;
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext('2d');

  if (liveCanvas && liveCanvas.width) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(liveCanvas, 0, 0, srcW, srcH);
  } else {
    drawUnmirroredToContext(ctx, video, srcW, srcH);
  }

  base64SelfieString = canvas.toDataURL('image/jpeg', 0.85);
  if (preview) {
    preview.src = base64SelfieString;
    preview.style.transform = 'none';
  }
  setCameraSurfaceVisibility('snapshot');
  stopCamera();
  showToast('Foto selfie berhasil diambil.');
}

// =========================================================================
// === ABSENSI MANDIRI                                                   ===
// =========================================================================

function actionSubmitAbsen() {
  const status = document.getElementById('absen-status').value;

  if (status === "Hadir" && !base64SelfieString) {
    showToast("Harap lakukan foto selfie terlebih dahulu sebelum mengirim absensi!", true);
    return;
  }

  if (userRole === "Dewan Penggalang" || userRole === "Penggalang") {
    setLoader(true, "Memvalidasi koordinat GPS pangkalan...");
    navigator.geolocation.getCurrentPosition(
      function (position) {
        userLatitude = position.coords.latitude;
        userLongitude = position.coords.longitude;
        isFakeGPSDetected = (position.mocked === true || (position.coords && position.coords.mocked === true) || (position.coords && position.coords.accuracy === 0));

        sendAbsenRequest(status, base64SelfieString, userLatitude, userLongitude, isFakeGPSDetected);
      },
      function () {
        setLoader(false);
        showToast("ABSENSI DITOLAK: Akses GPS wajib diizinkan untuk presensi.", true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    sendAbsenRequest(status, base64SelfieString, null, null, false);
  }
}

function sendAbsenRequest(status, fotoSelfie, lat, lng, isFake) {
  setLoader(true, "Mencatat presensi...");
  callAPI('submitAbsen', [sessionToken, status, fotoSelfie, lat, lng, isFake])
    .then(res => {
      setLoader(false);
      if (res.success) {
        showToast(res.message);
        stopCamera();
        base64SelfieString = "";
        const snap = document.getElementById('selfie-canvas-preview');
        if (snap) snap.src = "";
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
        if (userRole === "Admin" || userRole === "Pembina") {
          const tbody = document.getElementById('body-riwayat-absen');
          if (!tbody) return;
          tbody.innerHTML = "";
          if (res.list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Belum terdapat riwayat absensi.</td></tr>`;
            return;
          }
          res.list.forEach(row => {
            let badgeClass = row.status === "Hadir" ? "badge-hadir" : row.status === "Izin" ? "badge-izin" : "badge-sakit";
            let imgTag = row.foto_base64 ? `<img src="${row.foto_base64}" style="width: 50px; height: 65px; border-radius:4px; object-fit:cover; cursor:pointer;" onclick="viewFullImage('${row.foto_base64}')">` : "Tidak Ada";
            tbody.innerHTML += `
              <tr>
                <td>${row.tanggal} <br> <span style="font-size:0.75rem; color:var(--color-text-muted);">${row.jam}</span></td>
                <td><strong>${row.nama}</strong><br><span style="font-size:0.75rem;">${row.user_id}</span></td>
                <td><span class="badge ${badgeClass}">${row.status}</span></td>
                <td>${imgTag}</td>
              </tr>`;
          });
        } else {
          const container = document.getElementById('body-riwayat-absen-pribadi');
          if (!container) return;
          container.innerHTML = "";
          if (res.list.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--color-text-muted);">Belum ada riwayat absensi tercatat.</p>`;
            return;
          }
          res.list.forEach(row => {
            let statusColor = row.status === "Hadir" ? "#03543F" : row.status === "Izin" ? "#1E429F" : "#713F12";
            let imgTag = row.foto_base64 ? `<img src="${row.foto_base64}" style="width: 70px; height: 95px; border-radius:6px; object-fit:cover; cursor:pointer; margin-top:8px; display:block;" onclick="viewFullImage('${row.foto_base64}')">` : "";
            
            container.innerHTML += `
              <div style="padding: 12px; background: #FFFFFF; border-radius: var(--rounded-btn); border-left: 5px solid ${statusColor}; box-shadow: var(--shadow-soft);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <strong>${row.tanggal} (${row.jam})</strong>
                  <span class="badge" style="background-color:${statusColor}22; color:${statusColor}; font-weight:bold;">${row.status}</span>
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
// === DASBOR & AGENDA                                                   ===
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
          if (cardKas && (userRole === "Admin" || userRole === "Pembina" || userRole === "Dewan Penggalang" || isKasSpecialUser(userId))) {
            cardKas.style.display = 'flex';
          }
        }
      }
    })
    .catch(err => showToast(err.message, true));
}

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
            actionButtons += `<button class="btn" style="padding:4px 8px; font-size:0.8rem; margin-right:4px;" onclick='openAgendaModal(${JSON.stringify(agd)})'>Edit</button>`;
          }
          if (isAdmin) {
            actionButtons += `<button class="btn btn-danger" style="padding:4px 8px; font-size:0.8rem;" onclick="actionDeleteAgenda('${agd.id_agenda}')">Hapus</button>`;
          }

          tbody.innerHTML += `
            <tr>
              <td><strong>${escapeHtml(agd.kegiatan)}</strong></td>
              <td>${escapeHtml(agd.jenis_kegiatan)}</td>
              <td>${escapeHtml(agd.tanggal_pelaksanaan)}</td>
              <td>${escapeHtml(agd.waktu)}</td>
              <td>${escapeHtml(agd.penanggung_jawab)}</td>
              <td>${escapeHtml(agd.keterangan) || "-"}</td>
              <td>${actionButtons || "-"}</td>
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
    setNotifRolesCheckboxes(agd.notif_roles || "");
  } else {
    document.getElementById('agenda-modal-title').innerText = "Form Tambah Agenda";
    document.getElementById('agd-id').value = "";
    document.getElementById('agd-kegiatan').value = "";
    document.getElementById('agd-jenis').value = "";
    document.getElementById('agd-tanggal').value = todayLocalInput();
    document.getElementById('agd-waktu').value = "";
    document.getElementById('agd-pj').value = "";
    document.getElementById('agd-keterangan').value = "";
    setNotifRolesCheckboxes("");
  }
  document.getElementById('modal-agenda').style.display = 'flex';
}

// Set state checkbox tujuan notifikasi sesuai role tersimpan (kosong = semua)
function setNotifRolesCheckboxes(rolesStr) {
  var map = { 'notif-pembina': 'Pembina', 'notif-dewan': 'Dewan Penggalang', 'notif-penggalang': 'Penggalang', 'notif-admin': 'Admin' };
  var all = ["Pembina", "Dewan Penggalang", "Penggalang", "Admin"];
  var sel = [];
  var s = rolesStr ? String(rolesStr) : "";
  if (!s || /semua|all|pengguna/i.test(s)) {
    sel = all;
  } else {
    sel = s.split(',').map(function (r) { return r.trim(); });
  }
  Object.keys(map).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.checked = sel.indexOf(map[id]) !== -1;
  });
}

// Ambil daftar role tujuan notifikasi yang tercentang
function getNotifRoles() {
  var map = { 'notif-admin': 'Admin', 'notif-pembina': 'Pembina', 'notif-dewan': 'Dewan Penggalang', 'notif-penggalang': 'Penggalang' };
  var arr = [];
  Object.keys(map).forEach(function (id) {
    var el = document.getElementById(id);
    if (el && el.checked) arr.push(map[id]);
  });
  return arr;
}

function closeAgendaModal() {
  document.getElementById('modal-agenda').style.display = 'none';
}

function actionSaveAgenda() {
  const payload = {
    id_agenda: document.getElementById('agd-id').value,
    kegiatan: document.getElementById('agd-kegiatan').value.trim(),
    jenis_kegiatan: document.getElementById('agd-jenis').value.trim(),
    tanggal_pelaksanaan: document.getElementById('agd-tanggal').value,
    waktu: document.getElementById('agd-waktu').value.trim(),
    penanggung_jawab: document.getElementById('agd-pj').value.trim(),
    keterangan: document.getElementById('agd-keterangan').value.trim(),
    notif_roles: getNotifRoles().join(',')
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
// === KAS PRAMUKA                                                       ===
// =========================================================================

function loadKas() {
  callAPI('getKasData', [sessionToken])
    .then(res => {
      if (res.success) {
        document.getElementById('kas-total-pemasukan').innerText = "Rp " + res.totalMasuk.toLocaleString('id-ID');
        document.getElementById('kas-total-pengeluaran').innerText = "Rp " + res.totalKeluar.toLocaleString('id-ID');
        document.getElementById('kas-saldo-akhir').innerText = "Rp " + res.saldoAkhir.toLocaleString('id-ID');
        
        drawKasChart(res.totalMasuk, res.totalKeluar, res.saldoAkhir);

        const tbody = document.getElementById('body-kas');
        if (tbody) {
          tbody.innerHTML = "";
          res.list.forEach(row => {
            tbody.innerHTML += `
              <tr>
                <td>${row.tanggal}</td>
                <td><strong>${row.jenis}</strong></td>
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

function drawKasChart(masuk, keluar, saldo) {
  const canvas = document.getElementById('canvas-kas-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = "#FAF4EE";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const total = (masuk + keluar) || 1;
  const pMasuk = masuk / total;
  const pKeluar = keluar / total;

  const centerX = 110;
  const centerY = 145;
  const radius = 70;
  const innerRadius = 40;

  let startAngle = -0.5 * Math.PI;
  let endAngle = startAngle + (pMasuk * 2 * Math.PI);

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, endAngle);
  ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
  ctx.closePath();
  ctx.fillStyle = "#03543F";
  ctx.fill();

  startAngle = endAngle;
  endAngle = startAngle + (pKeluar * 2 * Math.PI);
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, endAngle);
  ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
  ctx.closePath();
  ctx.fillStyle = "#B91C1C";
  ctx.fill();

  ctx.fillStyle = "#3E2723";
  ctx.font = "bold 11px Poppins, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FLOW KAS", centerX, centerY + 4);

  const barX = 240;
  const maxBarWidth = 260;
  const maxVal = Math.max(masuk, keluar, saldo, 100000);

  const wMasuk = Math.max((masuk / maxVal) * maxBarWidth, 10);
  ctx.fillStyle = "#03543F";
  ctx.fillRect(barX, 55, wMasuk, 25);
  ctx.fillStyle = "#3E2723";
  ctx.font = "bold 11px Poppins, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Pemasukan: Rp " + masuk.toLocaleString('id-ID'), barX, 48);

  const wKeluar = Math.max((keluar / maxVal) * maxBarWidth, 10);
  ctx.fillStyle = "#B91C1C";
  ctx.fillRect(barX, 130, wKeluar, 25);
  ctx.fillStyle = "#3E2723";
  ctx.fillText("Pengeluaran: Rp " + keluar.toLocaleString('id-ID'), barX, 123);

  const wSaldo = Math.max((saldo / maxVal) * maxBarWidth, 10);
  ctx.fillStyle = "#F59E0B";
  ctx.fillRect(barX, 205, wSaldo, 25);
  ctx.fillStyle = "#3E2723";
  ctx.fillText("Saldo Akhir: Rp " + saldo.toLocaleString('id-ID'), barX, 198);
}

function openKasModal() {
  document.getElementById('kas-kategori').value = "";
  document.getElementById('kas-jumlah').value = "";
  document.getElementById('kas-tanggal-form').value = todayLocalInput();
  document.getElementById('kas-keterangan-form').value = "";
  document.getElementById('modal-kas').style.display = 'flex';
}

function closeKasModal() {
  document.getElementById('modal-kas').style.display = 'none';
}

function actionSaveKas() {
  const payload = {
    jenis: document.getElementById('kas-jenis').value,
    kategori: document.getElementById('kas-kategori').value.trim(),
    jumlah: document.getElementById('kas-jumlah').value,
    tanggal: document.getElementById('kas-tanggal-form').value,
    keterangan: document.getElementById('kas-keterangan-form').value.trim()
  };

  if (!payload.kategori || !payload.jumlah || !payload.tanggal) {
    showToast("Kategori, Jumlah, dan Tanggal Transaksi wajib diisi!", true);
    return;
  }

  setLoader(true, "Mencatat transaksi kas...");
  callAPI('addKasTransaction', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      if (res.success) {
        showToast(res.message);
        closeKasModal();
        loadKas();
        loadNotifications(false);
      } else {
        showToast(res.message, true);
      }
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

// =========================================================================
// === MANAJEMEN PROFIL & USER                                           ===
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
        
        if (p.tanggal_lahir) {
          var tglStr = String(p.tanggal_lahir);
          if (tglStr.indexOf('T') !== -1) tglStr = tglStr.substring(0, 10);
          document.getElementById('prof-tanggal-lahir').value = tglStr;
        }

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
      canvas.width = 300; canvas.height = 300; 
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
  setLoader(true, "Menyimpan profil...");
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

function loadUsers() {
  callAPI('getUserList', [sessionToken])
    .then(res => {
      if (res.success) {
        const tbody = document.getElementById('body-users');
        if (!tbody) return;
        tbody.innerHTML = "";
        if (!res.list || res.list.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Belum ada pengguna terdaftar.</td></tr>`;
          return;
        }
        res.list.forEach(row => {
          const isSelf = String(row.user_id).toLowerCase() === String(userId).toLowerCase();
          const statusBadge = String(row.status_aktif).toLowerCase() === 'aktif' ? 'badge-hadir' : 'badge-dipinjam';
          const editBtn = `<button class="btn" style="padding:4px 10px; font-size:0.78rem; margin-right:4px;" onclick="openUserModal(${JSON.stringify(row).replace(/"/g, '&quot;')})">Edit</button>`;
          const delBtn = isSelf ? "" : `<button class="btn btn-danger" style="padding:4px 10px; font-size:0.78rem;" onclick="actionDeleteUser('${escapeHtml(row.user_id)}')">Hapus</button>`;
          tbody.innerHTML += `
            <tr>
              <td><strong>${escapeHtml(row.user_id)}</strong></td>
              <td>${escapeHtml(row.nama_lengkap)}</td>
              <td><span class="role" style="background:var(--color-accent-gold);color:#1A0C00;padding:2px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">${escapeHtml(row.role)}</span></td>
              <td><span class="badge ${statusBadge}">${escapeHtml(row.status_aktif)}</span></td>
              <td>${editBtn} ${delBtn || "-"}</td>
            </tr>`;
        });
      }
    })
    .catch(err => showToast(err.message, true));
}

function openUserModal(user) {
  document.getElementById('modal-user').style.display = 'flex';
  if (user && user.user_id) {
    document.getElementById('usr-id').value = user.user_id;
    document.getElementById('usr-nama').value = user.nama_lengkap || "";
    document.getElementById('usr-role').value = user.role || "Penggalang";
    document.getElementById('usr-status').value = user.status_aktif === "Aktif" ? "Aktif" : "Nonaktif";
    document.getElementById('usr-id').readOnly = true;
    document.getElementById('usr-id').style.backgroundColor = '#EEE';
  } else {
    document.getElementById('usr-id').value = "";
    document.getElementById('usr-nama').value = "";
    document.getElementById('usr-password').value = "";
    document.getElementById('usr-role').value = "Penggalang";
    document.getElementById('usr-status').value = "Aktif";
    document.getElementById('usr-id').readOnly = false;
    document.getElementById('usr-id').style.backgroundColor = '';
  }
}
function closeUserModal() { document.getElementById('modal-user').style.display = 'none'; }

function actionSaveUser() {
  const payload = {
    user_id: document.getElementById('usr-id').value.trim(),
    nama_lengkap: document.getElementById('usr-nama').value.trim(),
    password: document.getElementById('usr-password').value,
    role: document.getElementById('usr-role').value,
    status_aktif: document.getElementById('usr-status').value
  };
  if (!payload.user_id || !payload.nama_lengkap) {
    showToast("User ID dan Nama Lengkap wajib diisi!", true);
    return;
  }
  setLoader(true, "Menyimpan data pengguna...");
  callAPI('saveUserByAdmin', [sessionToken, payload])
    .then(res => {
      setLoader(false);
      if (res.success) {
        showToast(res.message);
        closeUserModal();
        document.getElementById('usr-password').value = "";
        loadUsers();
      } else {
        showToast(res.message, true);
      }
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function actionDeleteUser(uid) {
  if (String(uid).toLowerCase() === String(userId).toLowerCase()) {
    showToast("Anda tidak dapat menghapus akun Anda sendiri.", true);
    return;
  }
  if (!confirm("Apakah Anda yakin ingin menghapus pengguna " + uid + "? Tindakan ini tidak dapat dibatalkan.")) return;
  setLoader(true, "Menghapus pengguna...");
  callAPI('deleteUser', [sessionToken, uid])
    .then(res => {
      setLoader(false);
      showToast(res.message, !res.success);
      loadUsers();
    })
    .catch(err => { setLoader(false); showToast(err.message, true); });
}

function loadSystemLogs() {
  const tbody = document.getElementById('body-logs');
  if (!tbody) return;
  const filter = document.getElementById('filter-log-user') ? document.getElementById('filter-log-user').value.trim() : "";

  callAPI('getSystemLogs', [sessionToken, filter], { cache: false })
    .then(res => {
      if (!res.success) { showToast(res.message, true); return; }
      tbody.innerHTML = "";
      if (!res.list || res.list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Belum ada log aktivitas tercatat.</td></tr>`;
        return;
      }
      res.list.forEach(log => {
        const waktu = formatDateString(log.timestamp);
        tbody.innerHTML += `
          <tr>
            <td style="white-space:nowrap;">${waktu}</td>
            <td><strong>${escapeHtml(log.user_id)}</strong></td>
            <td><span class="badge" style="background:#FAF4EE; color:var(--color-primary);">${escapeHtml(log.aksi)}</span></td>
            <td>${escapeHtml(log.detail)}</td>
            <td style="font-size:0.78rem;">${escapeHtml(log.ip || "-")}</td>
          </tr>`;
      });
    })
    .catch(err => { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-danger-red);">${escapeHtml(err.message)}</td></tr>`; });
}

function viewFullImage(src) {
  if (!src) return;
  const overlay = document.getElementById('lightbox-overlay');
  const img = document.getElementById('lightbox-img');
  if (overlay && img) {
    img.src = src;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}
function closeLightbox() {
  const overlay = document.getElementById('lightbox-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

// =========================================================================
// === MANAJEMEN EXPORT LAPORAN                                          ===
// =========================================================================

function triggerExport(jenis, format) {
  setLoader(true, `Mengekspor data ${jenis} ke format ${format.toUpperCase()}...`);
  
  let functionName = 'exportToExcel';
  if (format === 'pdf') functionName = 'exportToPDF';
  if (format === 'doc') functionName = 'exportToDOC';

  callAPI(functionName, [sessionToken, jenis])
    .then(res => {
      setLoader(false);
      if (res.success && res.url) {
        showToast("Ekspor Berhasil! Membuka unduhan...");
        const downloadLink = document.createElement('a');
        downloadLink.href = res.url;
        downloadLink.target = '_blank';
        downloadLink.setAttribute('download', jenis + '_' + format + '_' + todayLocalInput());
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      } else {
        showToast(res.message || "Gagal mengekspor data", true);
      }
    })
    .catch(err => {
      setLoader(false);
      showToast(err.message, true);
    });
}
