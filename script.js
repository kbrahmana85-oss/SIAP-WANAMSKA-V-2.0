// Data Default Sesuai Spesifikasi dengan Hash Sandi yang Sesuai
const DEFAULT_USERS = [
  { id: "admin", role: "Admin", nama: "Admin Pangkalan", hash: "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9", noHp: "081234567890", alamat: "Pangkalan SMPN 26 Surakarta" }, // admin123
  { id: "PMB001", role: "Pembina", nama: "Pembina 1", hash: "ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f", noHp: "082345678901", alamat: "Surakarta" }, // 12345678
  { id: "PMB002", role: "Pembina", nama: "Pembina 2", hash: "ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f", noHp: "083456789012", alamat: "Surakarta" }, // 12345678
  { id: "DGW20261", role: "Dewan Penggalang", nama: "Dewan 1", hash: "ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f", noHp: "084567890123", alamat: "Surakarta" }, // 12345678
  { id: "PGW20261", role: "Penggalang", nama: "Penggalang 1", hash: "ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f", noHp: "085678901234", alamat: "Surakarta" }  // 12345678
];

// Inisialisasi Database Lokal pada Browser
function initDatabase() {
  if (!localStorage.getItem('wanamska_users')) {
    localStorage.setItem('wanamska_users', JSON.stringify(DEFAULT_USERS));
  }
}

// Fungsi Hash SHA-256 menggunakan Web Crypto API
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Toast Notifikasi Sederhana
function showToast(message, isDanger = false) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${isDanger ? 'danger' : ''}`;
  toast.innerText = message;
  container.appendChild(toast);
  
  // Hapus otomatis setelah waktu animasi rampung
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Manajemen Sesi Aktif
let currentUser = null;

function checkActiveSession() {
  const savedSession = sessionStorage.getItem('active_user');
  if (savedSession) {
    currentUser = JSON.parse(savedSession);
    loadAppView();
  } else {
    showScreen('login-screen');
  }
}

// Toggle Visibilitas Password
document.getElementById('toggle-pwd-btn').addEventListener('click', function () {
  const pwdInput = document.getElementById('login-password');
  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    this.innerText = '🙈';
  } else {
    pwdInput.type = 'password';
    this.innerText = '👁️';
  }
});

// Penanganan Proses Login
document.getElementById('login-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const idInput = document.getElementById('login-id').value.trim();
  const passInput = document.getElementById('login-password').value;

  const userList = JSON.parse(localStorage.getItem('wanamska_users')) || [];
  const matchedUser = userList.find(u => u.id === idInput);

  if (!matchedUser) {
    showToast("User ID tidak terdaftar.", true);
    return;
  }

  const hashedInput = await sha256(passInput);
  if (hashedInput === matchedUser.hash) {
    currentUser = matchedUser;
    sessionStorage.setItem('active_user', JSON.stringify(matchedUser));
    showToast("Login sukses, selamat datang!");
    
    // Reset form
    document.getElementById('login-id').value = "";
    document.getElementById('login-password').value = "";
    
    loadAppView();
  } else {
    showToast("Password salah.", true);
  }
});

// Penanganan Logout Sesi
document.getElementById('logout-btn').addEventListener('click', function () {
  sessionStorage.removeItem('active_user');
  currentUser = null;
  showToast("Anda telah keluar dari sesi.");
  showScreen('login-screen');
  
  // Tutup sidebar jika dalam tampilan HP
  document.getElementById('sidebar').classList.remove('active');
  document.getElementById('sidebar-overlay').classList.remove('active');
});

// Penyiapan Data Setelah Login
function loadAppView() {
  showScreen('app-screen');
  
  // Update Element Header dan Sidebar
  document.getElementById('header-user-role').innerText = currentUser.role;
  document.getElementById('sidebar-user-name').innerText = currentUser.nama;
  document.getElementById('sidebar-user-id').innerText = currentUser.id;
  
  // Dashboard Panel
  document.getElementById('dash-nama').innerText = currentUser.nama;
  document.getElementById('dash-id').innerText = currentUser.id;
  document.getElementById('dash-role').innerText = currentUser.role;
  document.getElementById('dash-hp').innerText = currentUser.noHp || '-';
  document.getElementById('dash-alamat').innerText = currentUser.alamat || '-';

  // Profile Edit Panel Form
  document.getElementById('profile-nama').value = currentUser.nama;
  document.getElementById('profile-hp').value = currentUser.noHp || '';
  document.getElementById('profile-alamat').value = currentUser.alamat || '';
  
  // Navigasi Standar Kembali ke Dashboard
  switchPanel('panel-dashboard');
}

// Simpan Perubahan Profil
document.getElementById('profile-edit-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const newNama = document.getElementById('profile-nama').value.trim();
  const newHp = document.getElementById('profile-hp').value.trim();
  const newAlamat = document.getElementById('profile-alamat').value.trim();

  const userList = JSON.parse(localStorage.getItem('wanamska_users')) || [];
  const userIdx = userList.findIndex(u => u.id === currentUser.id);

  if (userIdx !== -1) {
    userList[userIdx].nama = newNama;
    userList[userIdx].noHp = newHp;
    userList[userIdx].alamat = newAlamat;

    // Simpan ke LocalStorage & Update Sesi Aktif
    localStorage.setItem('wanamska_users', JSON.stringify(userList));
    currentUser = userList[userIdx];
    sessionStorage.setItem('active_user', JSON.stringify(currentUser));

    showToast("Profil berhasil diperbarui!");
    loadAppView();
  }
});

// Penanganan Ganti Password
document.getElementById('password-change-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const passOld = document.getElementById('pass-old').value;
  const passNew = document.getElementById('pass-new').value;
  const passConfirm = document.getElementById('pass-confirm').value;

  const hashedOld = await sha256(passOld);
  if (hashedOld !== currentUser.hash) {
    showToast("Password lama salah.", true);
    return;
  }

  if (passNew !== passConfirm) {
    showToast("Konfirmasi password baru tidak cocok.", true);
    return;
  }

  if (passNew.length < 6) {
    showToast("Password baru minimal 6 karakter.", true);
    return;
  }

  const hashedNew = await sha256(passNew);
  const userList = JSON.parse(localStorage.getItem('wanamska_users')) || [];
  const userIdx = userList.findIndex(u => u.id === currentUser.id);

  if (userIdx !== -1) {
    userList[userIdx].hash = hashedNew;
    
    localStorage.setItem('wanamska_users', JSON.stringify(userList));
    currentUser.hash = hashedNew;
    sessionStorage.setItem('active_user', JSON.stringify(currentUser));

    showToast("Password berhasil diperbarui!");
    
    // Kosongkan form input
    document.getElementById('pass-old').value = "";
    document.getElementById('pass-new').value = "";
    document.getElementById('pass-confirm').value = "";

    switchPanel('panel-dashboard');
  }
});

// Alur Manajemen Tampilan Screen (Login vs Dashboard)
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(screenId).classList.remove('hidden');
}

// Alur Manajemen Panel di dalam Dashboard
function switchPanel(panelId) {
  document.querySelectorAll('.sub-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(panelId).classList.remove('hidden');

  // Sync menu active state
  document.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.getAttribute('data-target') === panelId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Event Listener Navigasi Menu
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', function () {
    const target = this.getAttribute('data-target');
    if (target) {
      switchPanel(target);
      
      // Tutup menu samping jika pada perangkat seluler
      document.getElementById('sidebar').classList.remove('active');
      document.getElementById('sidebar-overlay').classList.remove('active');
    }
  });
});

// Kontrol Menu Mobile (Hamburger Menu)
const menuToggleBtn = document.getElementById('menu-toggle-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

if (menuToggleBtn) {
  menuToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
  });
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
  });
}

// Bootstrap Pemuatan Pertama Kali
document.addEventListener('DOMContentLoaded', () => {
  initDatabase();
  checkActiveSession();
});
