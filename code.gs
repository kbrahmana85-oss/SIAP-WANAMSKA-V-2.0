// =========================================================================
// === API ROUTER & CORS HANDLER UNTUK FRONTEND VERCEL                     ===
// =========================================================================

function doGet(e) {
  if (e && e.parameter && e.parameter.page === 'manifest') {
    var manifest = {
      "name": "SIAP WANAMSKA",
      "short_name": "SIAP",
      "start_url": "/",
      "display": "standalone",
      "background_color": "#F5F5F6",
      "theme_color": "#5D4037",
      "icons": [
        {
          "src": "https://raw.githubusercontent.com/kbrahmana85-oss/SIAP-WANAMSKA-V-2.0/38ae1a1852e585227cf41ae4e6627420df71b199/logo_pwa.png",
          "sizes": "512x512",
          "type": "image/png"
        },
        {
          "src": "https://raw.githubusercontent.com/kbrahmana85-oss/SIAP-WANAMSKA-V-2.0/38ae1a1852e585227cf41ae4e6627420df71b199/logo_pwa.png",
          "sizes": "192x192",
          "type": "image/png"
        }
      ]
    };
    return ContentService.createTextOutput(JSON.stringify(manifest)).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput("API SIAP WANAMSKA Aktif")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var contents = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var body = JSON.parse(contents);
    var funcName = body.func;
    var params = body.params || [];

    if (!funcName) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Parameter 'func' tidak ditemukan dalam payload"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var targetFunc = this[funcName] || globalThis[funcName];

    if (typeof targetFunc === 'function') {
      var paramArray = Array.isArray(params) ? params : [params];
      var hasil = targetFunc.apply(null, paramArray);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: hasil
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: 'Fungsi "' + funcName + '" tidak ditemukan di server Apps Script'
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// === KODE INTI & VALIDASI DATABASE                                     ===
// =========================================================================

const SPREADSHEET_ID = '107uW-UxApF4Ecb-BT9-gRGg-0awaa_lKUkbsNRBupLg';
const TARGET_DRIVE_FOLDER_ID = '1Dc399KOxltIa8osp0blPv_GX0ap--ekq'; // Folder penyimpanan foto Google Drive

// MAPPER FOLDER MATERI KEGIATAN GOOGLE DRIVE
const FOLDER_MATERI_MAP = {
  "SEJARAH": "1NbTGZhi7Zzja9ge5UjK5WAx4spI_9NlS",
  "SKU_SKK": "1GRPQIF4BDnEW88ZiSCTPO5N-Q5EJIG4n",
  "SANDI": "1zhB5yya0nm9iUv165YWQ479RN3BpRXZp",
  "PETA_KOMPAS": "14e3eOU56py88eY7CMHFUj_9DKHwgwKPg",
  "KEWARGANEGARAAN": "12wAdSuYLO8pLUNiW4k946hnLoR-XUZ6D",
  "PERMAINAN": "1eMsGZl7DATRJgkpyMM3QICkZ9DoCpMg_",
  "LAGU": "1B1kcxtDPWTc3Lnn_HWnujeUF0vdfqNlL",
  "MATERI_UMUM": "1tn-bpX8vlsr3UsqKmaZ9-UFxFH2IsbOI"
};

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// =========================================================================
// === OPTIMASI PERFORMANCE (v2.5.1)                                      ===
// =========================================================================
// Membaca SEMUA baris sheet di setiap request adalah penyebab utama
// aplikasi terasa lambat saat data makin banyak. Fungsi di bawah hanya
// membaca N baris TERAKHIR (data terbaru) sehingga jauh lebih cepat.
// Kolom tetap sesuai indeks aslinya (data[i][0] = kolom pertama, dst).

function getRecentRows(sheet, maxRows) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) return []; // hanya header / kosong
  var startRow = 2;
  if (maxRows && (lastRow - 1) > maxRows) {
    startRow = lastRow - maxRows + 1;
  }
  var numRows = lastRow - startRow + 1;
  return sheet.getRange(startRow, 1, numRows, lastCol).getValues();
}

// Jangan pernah mengirim string base64 foto (bisa ratusan KB/baris) ke
// frontend dalam daftar data. Data lama yang masih berupa base64 akan
// disaring agar response JSON tetap kecil & cepat.
function cleanImageValue(v) {
  var s = v ? String(v) : "";
  if (s.indexOf("data:image/") === 0) return "";
  return s;
}

const SHEET_USERS = "Users";
const SHEET_PROFILE = "profile";
const SHEET_ABSENSI = "absensi";
const SHEET_KEGIATAN = "kegiatan";
const SHEET_INVENTARIS = "inventaris";
const SHEET_KAS = "kas";
const SHEET_LOG = "log";
const SHEET_AGENDA = "Agenda";
const SHEET_MATERI = "Materi";

function hashPassword(password){
  if(!password) return "";
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return digest.map(b => ('0' + (b & (0xFF)).toString(16)).slice(-2)).join('');
}

function uploadImageToDrive(base64Str, prefix) {
  if (!base64Str || typeof base64Str !== 'string' || base64Str.indexOf("data:image/") !== 0) {
    return base64Str || "";
  }
  try {
    var folder = DriveApp.getFolderById(TARGET_DRIVE_FOLDER_ID);
    var split = base64Str.split(',');
    var contentType = split[0].match(/:(.*?);/)[1];
    var byteCharacters = Utilities.base64Decode(split[1]);
    
    var extension = "jpg";
    if (contentType.indexOf("png") !== -1) extension = "png";
    else if (contentType.indexOf("gif") !== -1) extension = "gif";
    
    var fileName = prefix + "_" + Utilities.getUuid().substring(0, 8).toUpperCase() + "." + extension;
    var blob = Utilities.newBlob(byteCharacters, contentType, fileName);
    
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return "https://docs.google.com/uc?export=view&id=" + file.getId();
  } catch (e) {
    Logger.log("Gagal mengunggah foto ke Google Drive: " + e.toString());
    return base64Str;
  }
}

function loginUser(userId, password){
  if(!userId || !password) return {success: false, message: 'User ID dan Password wajib diisi'};
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  if(!sheet) return {success: false, message: 'Sheet "Users" tidak ditemukan'};
  const data = sheet.getDataRange().getValues();
  const userRow = data.find(row => String(row[0]).trim().toLowerCase() === userId.trim().toLowerCase() && String(row[4]).trim() === 'Aktif');
  if(!userRow) return {success: false, message: 'User tidak ditemukan atau Status tidak Aktif'};
  const hashInput = hashPassword(password);
  
  if(hashInput === String(userRow[1]).trim()){
    var token = "token_" + userRow[0] + "_" + new Date().getTime();
    var sessionData = {
      userId: userRow[0],
      name: userRow[2],
      role: userRow[3]
    };
    
    CacheService.getScriptCache().put(token, JSON.stringify(sessionData), 21600);
    
    return {
      success: true, 
      sessionToken: token, 
      user: {
        user_id: userRow[0], 
        nama_lengkap: userRow[2], 
        role: userRow[3]
      }
    };
  } else {
    return {success: false, message: 'Password salah'};
  }
}

function initializeDatabase() {
  var ss = getSpreadsheet();
  
  var sUsers = ss.getSheetByName(SHEET_USERS);
  if (!sUsers) {
    sUsers = ss.insertSheet(SHEET_USERS);
    sUsers.appendRow(["user_id", "password", "nama_lengkap", "role", "status_aktif", "tanggal_dibuat"]);
  }
  if (sUsers.getLastRow() <= 1) {
    var adminPasswordHash = hashPassword("admin123");
    sUsers.appendRow(["admin", adminPasswordHash, "Administrator Utama", "Admin", "Aktif", new Date().toISOString()]);
  }

  var sProfile = ss.getSheetByName(SHEET_PROFILE);
  if (!sProfile) {
    sProfile = ss.insertSheet(SHEET_PROFILE);
    sProfile.appendRow(["user_id", "nta", "nama_lengkap", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "golongan", "regu_sangga", "alamat", "no_hp", "foto_profil", "tanggal_bergabung"]);
  }
  if (sProfile.getLastRow() <= 1) {
    sProfile.appendRow(["admin", "12.34.56.78", "Administrator Utama", "Jakarta", "2000-01-01", "Laki-laki", "Pembina", "Manggala", "Markas Gerakan Pramuka", "08123456789", "", new Date().toISOString()]);
  }

  var sAbsen = ss.getSheetByName(SHEET_ABSENSI);
  if (!sAbsen) {
    sAbsen = ss.insertSheet(SHEET_ABSENSI);
    sAbsen.appendRow(["id_absen", "user_id", "nama", "tanggal", "jam", "status", "foto_selfie", "metode", "kegiatan_terkait", "keterangan"]);
  }

  var sKegiatan = ss.getSheetByName(SHEET_KEGIATAN);
  if (!sKegiatan) {
    sKegiatan = ss.insertSheet(SHEET_KEGIATAN);
    sKegiatan.appendRow(["id_kegiatan", "nama_kegiatan", "tanggal", "lokasi", "deskripsi", "foto1", "foto2", "foto3", "foto4", "dibuat_oleh", "tanggal_dibuat"]);
  }

  var sInventaris = ss.getSheetByName(SHEET_INVENTARIS);
  if (!sInventaris) {
    sInventaris = ss.insertSheet(SHEET_INVENTARIS);
    sInventaris.appendRow(["id_barang", "nama_barang", "kategori", "jumlah", "kondisi", "lokasi_simpan", "tanggal_masuk", "keterangan", "dikelola_oleh"]);
  }

  var sKas = ss.getSheetByName(SHEET_KAS);
  if (!sKas) {
    sKas = ss.insertSheet(SHEET_KAS);
    sKas.appendRow(["id_transaksi", "tanggal", "jenis", "kategori", "jumlah", "keterangan", "saldo_berjalan", "dicatat_oleh"]);
  }

  var sLog = ss.getSheetByName(SHEET_LOG);
  if (!sLog) {
    sLog = ss.insertSheet(SHEET_LOG);
    sLog.appendRow(["id_log", "timestamp", "user_id", "aksi", "detail", "alamat_ip"]);
  }

  var sAgenda = ss.getSheetByName(SHEET_AGENDA);
  if (!sAgenda) {
    sAgenda = ss.insertSheet(SHEET_AGENDA);
    sAgenda.appendRow(["id_agenda", "kegiatan", "jenis_kegiatan", "tanggal_pelaksanaan", "waktu", "penanggung_jawab", "keterangan", "updated_by", "updated_at"]);
  }

  var sMateri = ss.getSheetByName(SHEET_MATERI);
  if (!sMateri) {
    sMateri = ss.insertSheet(SHEET_MATERI);
    sMateri.appendRow(["JUDUL", "LOKASI_SIMPAN_FOLDER", "FILE_URL", "MIME_TYPE", "DATE_ADDED"]);
  }
}

function writeLog(userId, aksi, detail) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_LOG);
    var idLog = "LOG-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    var timestamp = new Date().toISOString();
    sheet.appendRow([idLog, timestamp, userId, aksi, detail, "Client Script Engine"]);
  } catch(e) {
    Logger.log("Gagal menulis log: " + e.toString());
  }
}

// PERBAIKAN FATAL BUG 2: SESI TIDAK BOLEH EXPULSED/EXPIRING SAAT UPLOAD FOTO
function validateSession(token, allowedRoles) {
  if (!token) throw new Error("Sesi kadaluarsa. Silakan login kembali.");
  var cache = CacheService.getScriptCache();
  var sessionDataStr = cache.get(token);
  var session = null;

  if (sessionDataStr) {
    try {
      session = JSON.parse(sessionDataStr);
    } catch(e) { session = null; }
  }

  // FALLBACK PEMULIHAN SESI OTOMATIS JIKA CACHESERVICE DIBERSIHKAN OLEH GOOGLE
  if (!session && token.indexOf("token_") === 0) {
    var parts = token.split("_");
    if (parts.length >= 2) {
      var uId = parts[1];
      var ss = getSpreadsheet();
      var sheet = ss.getSheetByName(SHEET_USERS);
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim().toLowerCase() === uId.trim().toLowerCase() && String(data[i][4]).trim() === 'Aktif') {
            session = {
              userId: data[i][0],
              name: data[i][2],
              role: data[i][3]
            };
            try { cache.put(token, JSON.stringify(session), 21600); } catch(cErr){}
            break;
          }
        }
      }
    }
  }

  if (!session) throw new Error("Sesi tidak valid atau telah berakhir.");

  if (allowedRoles && allowedRoles.indexOf(session.role) === -1) {
    throw new Error("Anda tidak memiliki hak akses untuk fungsi ini.");
  }

  return session;
}

function logoutUser(token) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang", "Penggalang"]);
    CacheService.getScriptCache().remove(token);
    writeLog(session.userId, "LOGOUT", "Keluar dari sistem");
    return { success: true };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// =========================================================================
// === FITUR MODUL MATERI KEGIATAN (WITH DRIVE TO SHEET AUTO-SYNC)       ===
// =========================================================================

function getMateriFileList(token, folderKey) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang"]);
    var folderId = FOLDER_MATERI_MAP[folderKey];
    if (!folderId) {
      return { success: false, message: "Folder materi tidak ditemukan atau kunci folder tidak valid." };
    }

    var folder = DriveApp.getFolderById(folderId);
    var folderName = folder.getName();
    var files = folder.getFiles();
    var list = [];

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_MATERI);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_MATERI);
      sheet.appendRow(["JUDUL", "LOKASI_SIMPAN_FOLDER", "FILE_URL", "MIME_TYPE", "DATE_ADDED"]);
    }

    var sheetData = sheet.getDataRange().getValues();
    var existingUrls = {};
    for (var i = 1; i < sheetData.length; i++) {
      if (sheetData[i][2]) {
        existingUrls[String(sheetData[i][2]).trim()] = true;
      }
    }

    var newRows = [];

    while (files.hasNext()) {
      var file = files.next();
      var sizeKb = Math.round((file.getSize() / 1024) * 10) / 10;
      var sizeStr = sizeKb > 1024 ? (Math.round((sizeKb / 1024) * 10) / 10) + " MB" : sizeKb + " KB";
      var downloadUrl = "https://drive.google.com/uc?export=download&id=" + file.getId();
      var viewUrl = file.getUrl();

      if (!existingUrls[downloadUrl] && !existingUrls[viewUrl]) {
        newRows.push([
          file.getName(),
          folderName,
          downloadUrl,
          file.getMimeType(),
          file.getDateCreated().toISOString()
        ]);
        existingUrls[downloadUrl] = true;
      }

      list.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getMimeType(),
        size: sizeStr,
        viewUrl: viewUrl,
        downloadUrl: downloadUrl,
        created: file.getDateCreated().toISOString()
      });
    }

    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 5).setValues(newRows);
    }

    writeLog(session.userId, "AKSES_MATERI", "Membuka & sinkronisasi folder materi: " + folderName);

    return { 
      success: true, 
      folderName: folderName, 
      list: list 
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// =========================================================================
// === FITUR AGENDA KEGIATAN                                             ===
// =========================================================================

function getAgendaList(token) {
  try {
    validateSession(token, ["Admin", "Pembina", "Dewan Penggalang", "Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_AGENDA);
    if (!sheet) return { success: true, list: [] };
    var data = getRecentRows(sheet, 300);
    
    var list = [];
    for (var i = 0; i < data.length; i++) {
      list.push({
        id_agenda: data[i][0],
        kegiatan: data[i][1],
        jenis_kegiatan: data[i][2],
        tanggal_pelaksanaan: data[i][3],
        waktu: data[i][4],
        penanggung_jawab: data[i][5],
        keterangan: data[i][6],
        updated_by: data[i][7],
        updated_at: data[i][8]
      });
    }
    return { success: true, list: list.reverse() };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function saveAgenda(token, dataAgenda) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_AGENDA);
    var data = sheet.getDataRange().getValues();
    
    var idAgenda = dataAgenda.id_agenda;
    var rowIdx = -1;
    
    if (idAgenda) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === idAgenda) {
          rowIdx = i + 1;
          break;
        }
      }
    } else {
      idAgenda = "AGD-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    }
    
    var timestamp = new Date().toISOString();
    
    if (rowIdx !== -1) {
      sheet.getRange(rowIdx, 2, 1, 8).setValues([[
        dataAgenda.kegiatan,
        dataAgenda.jenis_kegiatan,
        dataAgenda.tanggal_pelaksanaan,
        dataAgenda.waktu,
        dataAgenda.penanggung_jawab,
        dataAgenda.keterangan,
        session.userId,
        timestamp
      ]]);
      writeLog(session.userId, "EDIT_AGENDA", "Mengubah agenda: " + dataAgenda.kegiatan);
    } else {
      sheet.appendRow([
        idAgenda,
        dataAgenda.kegiatan,
        dataAgenda.jenis_kegiatan,
        dataAgenda.tanggal_pelaksanaan,
        dataAgenda.waktu,
        dataAgenda.penanggung_jawab,
        dataAgenda.keterangan,
        session.userId,
        timestamp
      ]);
      writeLog(session.userId, "TAMBAH_AGENDA", "Menambahkan agenda baru: " + dataAgenda.kegiatan);
    }
    
    return { success: true, message: "Agenda berhasil disimpan." };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function deleteAgenda(token, idAgenda) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_AGENDA);
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === idAgenda) {
        sheet.deleteRow(i + 1);
        writeLog(session.userId, "HAPUS_AGENDA", "Menghapus agenda ID " + idAgenda);
        return { success: true, message: "Agenda berhasil dihapus." };
      }
    }
    return { success: false, message: "Agenda tidak ditemukan." };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// =========================================================================
// === MANAJEMEN TRANSAKSI & RBAC CORE                                  ===
// =========================================================================

function getDashboardData(token) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang", "Penggalang"]);
    var ss = getSpreadsheet();
    
    var usersSheet = ss.getSheetByName(SHEET_USERS);
    var totalAnggota = usersSheet ? (usersSheet.getLastRow() - 1) : 0;
    
    var hariIni = new Date().toISOString().substring(0, 10);
    var hadirHariIni = 0;
    var absensiSheet = ss.getSheetByName(SHEET_ABSENSI);
    if (absensiSheet) {
      // Hanya baca 500 baris terakhir absensi (hari ini selalu di paling bawah)
      var absensiData = getRecentRows(absensiSheet, 500);
      for (var i = 0; i < absensiData.length; i++) {
        if (absensiData[i][3] === hariIni && absensiData[i][5] === "Hadir") {
          hadirHariIni++;
        }
      }
    }
    
    // Kegiatan terbaru cukup ambil 1 sel (baris terakhir, kolom nama)
    var kegiatanTerbaru = "-";
    var kegiatanSheet = ss.getSheetByName(SHEET_KEGIATAN);
    if (kegiatanSheet && kegiatanSheet.getLastRow() > 1) {
      var kLast = kegiatanSheet.getLastRow();
      var kVal = kegiatanSheet.getRange(kLast, 2).getValue();
      if (kVal) kegiatanTerbaru = kVal;
    }
    
    // Saldo kas cukup ambil saldo berjalan di baris terakhir
    var saldoKas = 0;
    if (["Admin", "Pembina", "Dewan Penggalang"].indexOf(session.role) !== -1) {
      var kasSheet = ss.getSheetByName(SHEET_KAS);
      if (kasSheet && kasSheet.getLastRow() > 1) {
        saldoKas = kasSheet.getRange(kasSheet.getLastRow(), 7).getValue();
      }
    }
    
    return {
      success: true,
      total_anggota: totalAnggota,
      hadir_hari_ini: hadirHariIni,
      kegiatan_terbaru: kegiatanTerbaru,
      saldo_kas: saldoKas
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function submitAbsen(token, status, fotoSelfie, metode, kegiatanTerkait, keterangan, userLat, userLng, isFakeGPS) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang", "Penggalang"]);
    
    if (session.role === "Dewan Penggalang" || session.role === "Penggalang") {
      if (isFakeGPS) {
        return { success: false, message: "ABSENSI DITOLAK: Sistem mendeteksi penggunaan Fake GPS atau lokasi palsu!" };
      }
      if (!userLat || !userLng) {
        return { success: false, message: "ABSENSI DITOLAK: Titik koordinat GPS tidak terdeteksi atau diblokir." };
      }
      
      var targetLat = -7.563383309402712;
      var targetLng = 110.83081309791396;
      var distance = getDistance(userLat, userLng, targetLat, targetLng);
      
      if (distance > 100) {
        return { success: false, message: "ABSENSI DITOLAK: Lokasi Anda berada di luar area pangkalan (jarak: " + Math.round(distance) + " meter)." };
      }
    }

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_ABSENSI);
    
    var idAbsen = "ABS-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    var tanggal = new Date().toISOString().substring(0, 10);
    var jam = new Date().toTimeString().substring(0, 8);
    
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === session.userId && data[i][3] === tanggal) {
        return { success: false, message: "Anda sudah melakukan absensi hari ini." };
      }
    }
    
    var fotoSelfieUrl = uploadImageToDrive(fotoSelfie, "SELFIE_" + session.userId);
    
    sheet.appendRow([idAbsen, session.userId, session.name, tanggal, jam, status, fotoSelfieUrl, metode, kegiatanTerkait, keterangan]);
    writeLog(session.userId, "ABSEN", "Absensi " + status + " via " + metode);
    return { success: true, message: "Absensi Berhasil" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function getAbsenHistory(token, filterDate) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang", "Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_ABSENSI);
    // Batasi baca ke 800 baris terakhir agar daftar tidak lambat saat data banyak.
    var data = getRecentRows(sheet, 800);
    
    var list = [];
    for (var i = 0; i < data.length; i++) {
      var show = (session.role === "Admin") ? true : (data[i][1].toString().toLowerCase() === session.userId.toLowerCase());
      if (show && filterDate && data[i][3] !== filterDate) show = false;
      
      if (show) {
        var foto = cleanImageValue(data[i][6]);
        list.push({
          id_absen: data[i][0],
          user_id: data[i][1],
          nama: data[i][2],
          tanggal: data[i][3],
          jam: data[i][4],
          status: data[i][5],
          foto_selfie: foto ? "Ada Foto" : "Tidak Ada",
          foto_base64: foto,
          metode: data[i][7],
          kegiatan: data[i][8],
          keterangan: data[i][9]
        });
      }
    }
    return { success: true, list: list.reverse() };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function getKegiatanList(token) {
  try {
    validateSession(token, ["Admin", "Pembina", "Dewan Penggalang", "Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_KEGIATAN);
    var data = getRecentRows(sheet, 300);
    var list = [];
    for (var i = 0; i < data.length; i++) {
      list.push({
        id_kegiatan: data[i][0],
        nama_kegiatan: data[i][1],
        tanggal: data[i][2],
        lokasi: data[i][3],
        deskripsi: data[i][4],
        foto1: cleanImageValue(data[i][5]),
        foto2: cleanImageValue(data[i][6]),
        foto3: cleanImageValue(data[i][7]),
        foto4: cleanImageValue(data[i][8]),
        dibuat_oleh: data[i][9],
        tanggal_dibuat: data[i][10]
      });
    }
    return { success: true, list: list.reverse() };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function saveKegiatan(token, dataKegiatan) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_KEGIATAN);
    var data = sheet.getDataRange().getValues();
    
    var idKegiatan = dataKegiatan.id_kegiatan;
    var rowIdx = -1;
    
    if (idKegiatan) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === idKegiatan) { rowIdx = i + 1; break; }
      }
    } else {
      idKegiatan = "KEG-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    }
    
    var urlFoto1 = uploadImageToDrive(dataKegiatan.foto1, "KEG_" + idKegiatan + "_1");
    var urlFoto2 = uploadImageToDrive(dataKegiatan.foto2, "KEG_" + idKegiatan + "_2");
    var urlFoto3 = uploadImageToDrive(dataKegiatan.foto3, "KEG_" + idKegiatan + "_3");
    var urlFoto4 = uploadImageToDrive(dataKegiatan.foto4, "KEG_" + idKegiatan + "_4");
    
    if (rowIdx !== -1) {
      sheet.getRange(rowIdx, 2, 1, 9).setValues([[
        dataKegiatan.nama_kegiatan, dataKegiatan.tanggal, dataKegiatan.lokasi, dataKegiatan.deskripsi,
        urlFoto1, urlFoto2 || "", urlFoto3 || "", urlFoto4 || "", session.userId
      ]]);
    } else {
      sheet.appendRow([idKegiatan, dataKegiatan.nama_kegiatan, dataKegiatan.tanggal, dataKegiatan.lokasi, dataKegiatan.deskripsi, urlFoto1, urlFoto2 || "", urlFoto3 || "", urlFoto4 || "", session.userId, new Date().toISOString()]);
    }
    writeLog(session.userId, "TAMBAH_KEGIATAN", "Menyimpan kegiatan: " + dataKegiatan.nama_kegiatan);
    return { success: true, message: "Dokumentasi kegiatan berhasil disimpan ke Drive." };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function deleteKegiatan(token, idKegiatan) {
  try {
    var session = validateSession(token, ["Admin"]); 
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_KEGIATAN);
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === idKegiatan) {
        sheet.deleteRow(i + 1);
        writeLog(session.userId, "HAPUS_KEGIATAN", "Hapus kegiatan " + idKegiatan);
        return { success: true, message: "Kegiatan berhasil dihapus." };
      }
    }
    return { success: false, message: "Kegiatan tidak ditemukan." };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function getInventarisList(token) {
  try {
    validateSession(token, ["Admin", "Pembina", "Dewan Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_INVENTARIS);
    var data = getRecentRows(sheet, 500);
    var list = [];
    for (var i = 0; i < data.length; i++) {
      list.push({
        id_barang: data[i][0], nama_barang: data[i][1], kategori: data[i][2], jumlah: data[i][3], kondisi: data[i][4], locations_simpan: data[i][5], tanggal_masuk: data[i][6], keterangan: data[i][7]
      });
    }
    return { success: true, list: list };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function saveInventaris(token, dataBarang) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_INVENTARIS);
    var data = sheet.getDataRange().getValues();
    var idBarang = dataBarang.id_barang;
    var rowIdx = -1;
    if (idBarang) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === idBarang) { rowIdx = i + 1; break; }
      }
    } else {
      idBarang = "INV-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    }
    
    if (rowIdx !== -1) {
      sheet.getRange(rowIdx, 2, 1, 8).setValues([[dataBarang.nama_barang, dataBarang.kategori, dataBarang.jumlah, dataBarang.kondisi, dataBarang.locations_simpan, dataBarang.tanggal_masuk, dataBarang.keterangan, session.userId]]);
    } else {
      sheet.appendRow([idBarang, dataBarang.nama_barang, dataBarang.kategori, dataBarang.jumlah, dataBarang.kondisi, dataBarang.locations_simpan, dataBarang.tanggal_masuk, dataBarang.keterangan, session.userId]);
    }
    writeLog(session.userId, "SIMPAN_INVENTARIS", "Menyimpan barang inventaris: " + dataBarang.nama_barang);
    return { success: true, message: "Data inventaris berhasil disimpan." };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function deleteInventaris(token, idBarang) {
  try {
    var session = validateSession(token, ["Admin"]); 
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_INVENTARIS);
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === idBarang) {
        sheet.deleteRow(i + 1);
        return { success: true, message: "Barang dihapus." };
      }
    }
    return { success: false, message: "Tidak ditemukan." };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function getKasData(token) {
  try {
    validateSession(token, ["Admin", "Pembina", "Dewan Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_KAS);
    var data = sheet.getDataRange().getValues();
    var list = [], totalMasuk = 0, totalKeluar = 0;
    for (var i = 1; i < data.length; i++) {
      var jumlah = parseFloat(data[i][4]) || 0;
      if (data[i][2] === "Pemasukan") totalMasuk += jumlah;
      else totalKeluar += jumlah;
      list.push({
        id_transaksi: data[i][0], tanggal: data[i][1], jenis: data[i][2], kategori: data[i][3], jumlah: jumlah, keterangan: data[i][5], saldo_berjalan: data[i][6], dicatat_oleh: data[i][7]
      });
    }
    return { success: true, list: list.reverse(), totalMasuk: totalMasuk, totalKeluar: totalKeluar, saldoAkhir: totalMasuk - totalKeluar };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function addKasTransaction(token, trans) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_KAS);
    var data = sheet.getDataRange().getValues();
    var saldoTerakhir = (data.length > 1) ? parseFloat(data[data.length - 1][6]) || 0 : 0;
    
    var idTrans = "KAS-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    var jumlah = parseFloat(trans.jumlah) || 0;
    var saldoBaru = (trans.jenis === "Pemasukan") ? (saldoTerakhir + jumlah) : (saldoTerakhir - jumlah);
    
    sheet.appendRow([idTrans, trans.tanggal, trans.jenis, trans.kategori, jumlah, trans.keterangan, saldoBaru, session.userId]);
    writeLog(session.userId, "CATAT_KAS", "Menambah transaksi kas: " + trans.kategori + " (Rp " + jumlah + ")");
    return { success: true, message: "Transaksi kas berhasil dicatat." };
  } catch (err) { return { success: false, message: err.toString() }; }
}

// PERBAIKAN FATAL BUG 3: FORMAT TANGGAL LAHIR SESUAI TIMEZONE DENGAN MENCEGAH UTC SHIFT
function getUserProfile(token, targetUserId) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang", "Penggalang"]);
    var ss = getSpreadsheet();
    var uId = (targetUserId && ["Admin", "Pembina"].indexOf(session.role) !== -1) ? targetUserId : session.userId;
    var sheet = ss.getSheetByName(SHEET_PROFILE);
    var data = sheet.getDataRange().getValues();
    var tz = ss.getSpreadsheetTimeZone();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().toLowerCase() === uId.toLowerCase()) {
        
        var tglLahirStr = "";
        if (data[i][4]) {
          if (data[i][4] instanceof Date) {
            tglLahirStr = Utilities.formatDate(data[i][4], tz, "yyyy-MM-dd");
          } else {
            tglLahirStr = String(data[i][4]).substring(0, 10);
          }
        }

        var tglBergabungStr = "";
        if (data[i][11]) {
          if (data[i][11] instanceof Date) {
            tglBergabungStr = Utilities.formatDate(data[i][11], tz, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
          } else {
            tglBergabungStr = String(data[i][11]);
          }
        }

        return {
          success: true,
          profile: {
            user_id: data[i][0], 
            nta: data[i][1], 
            nama_lengkap: data[i][2], 
            tempat_lahir: data[i][3], 
            tanggal_lahir: tglLahirStr, 
            jenis_kelamin: data[i][5], 
            golongan: data[i][6], 
            regu_sangga: data[i][7], 
            alamat: data[i][8], 
            no_hp: data[i][9], 
            foto_profil: data[i][10], 
            tanggal_bergabung: tglBergabungStr
          }
        };
      }
    }
    return { success: true, profile: { user_id: uId, nama_lengkap: session.name } };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function saveUserProfile(token, prof) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang", "Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_PROFILE);
    var data = sheet.getDataRange().getValues();
    var uId = prof.user_id.toLowerCase();
    if (session.role === "Penggalang" && uId !== session.userId.toLowerCase()) {
      return { success: false, message: "Anda tidak berhak mengubah profil orang lain." };
    }
    var rowIdx = -1;
    var existingProfil = null;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().toLowerCase() === uId) { 
        rowIdx = i + 1; 
        existingProfil = data[i];
        break; 
      }
    }
    
    var urlFotoProfil = uploadImageToDrive(prof.foto_profil, "PROFILE_" + uId);
    if (!urlFotoProfil && existingProfil) {
      urlFotoProfil = existingProfil[10];
    }
    
    var tanggalBergabung = (existingProfil && existingProfil[11]) ? existingProfil[11] : new Date().toISOString();
    if (tanggalBergabung instanceof Date) {
      tanggalBergabung = Utilities.formatDate(tanggalBergabung, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    }

    var tglLahirInput = prof.tanggal_lahir ? String(prof.tanggal_lahir).substring(0, 10) : "";
    
    var rowData = [uId, prof.nta, prof.nama_lengkap, prof.tempat_lahir, tglLahirInput, prof.jenis_kelamin, prof.golongan, prof.regu_sangga, prof.alamat, prof.no_hp, urlFotoProfil, tanggalBergabung];
    if (rowIdx !== -1) sheet.getRange(rowIdx, 1, 1, 12).setValues([rowData]);
    else sheet.appendRow(rowData);
    
    var usersSheet = ss.getSheetByName(SHEET_USERS);
    var usersData = usersSheet.getDataRange().getValues();
    for (var k = 1; k < usersData.length; k++) {
      if (usersData[k][0].toString().toLowerCase() === uId) {
        usersSheet.getRange(k + 1, 3).setValue(prof.nama_lengkap);
        break;
      }
    }
    
    writeLog(session.userId, "SIMPAN_PROFIL", "Menyimpan profil anggota " + uId);
    return { success: true, message: "Profil dan foto berhasil disimpan ke Drive." };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function changePassword(token, oldPassword, newPassword) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang", "Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_USERS);
    var data = sheet.getDataRange().getValues();
    var pHashOld = hashPassword(oldPassword), pHashNew = hashPassword(newPassword);
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().toLowerCase() === session.userId.toLowerCase()) {
        if (data[i][1] === pHashOld) {
          sheet.getRange(i + 1, 2).setValue(pHashNew);
          return { success: true, message: "Password berhasil diganti." };
        } else {
          return { success: false, message: "Password lama salah." };
        }
      }
    }
    return { success: false, message: "User tidak ditemukan." };
  } catch (err) { return { success: false, message: err.toString() }; }
}

// =========================================================================
// === KELOLA USER & SYSTEM LOGS (UNTUK ADMIN)                        ===
// =========================================================================

function getUserList(token) {
  try {
    validateSession(token, ["Admin"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_USERS);
    var data = getRecentRows(sheet, 1000);
    
    var list = [];
    for (var i = 0; i < data.length; i++) {
      list.push({
        user_id: data[i][0],
        nama_lengkap: data[i][2],
        role: data[i][3],
        status_aktif: data[i][4],
        tanggal_dibuat: data[i][5]
      });
    }
    return { success: true, list: list };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function saveUserByAdmin(token, userData) {
  try {
    var session = validateSession(token, ["Admin"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_USERS);
    var data = sheet.getDataRange().getValues();
    
    var uId = userData.user_id.trim().toLowerCase();
    var rowIdx = -1;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().toLowerCase() === uId) {
        rowIdx = i + 1;
        break;
      }
    }
    
    if (rowIdx !== -1) {
      sheet.getRange(rowIdx, 3, 1, 3).setValues([[
        userData.nama_lengkap,
        userData.role,
        userData.status_aktif
      ]]);
      
      if (userData.password) {
        var pHash = hashPassword(userData.password);
        sheet.getRange(rowIdx, 2).setValue(pHash);
      }
      
      var profSheet = ss.getSheetByName(SHEET_PROFILE);
      var profData = profSheet.getDataRange().getValues();
      var profRowIdx = -1;
      for (var j = 1; j < profData.length; j++) {
        if (profData[j][0].toString().toLowerCase() === uId) {
          profRowIdx = j + 1;
          break;
        }
      }
      if (profRowIdx !== -1) {
        profSheet.getRange(profRowIdx, 3).setValue(userData.nama_lengkap);
      } else {
        profSheet.appendRow([
          uId,
          "",
          userData.nama_lengkap,
          "", "", "", "", "", "", "", "",
          new Date().toISOString()
        ]);
      }
      
      writeLog(session.userId, "EDIT_USER", "Mengedit user: " + uId);
    } else {
      if (!userData.password) {
        return { success: false, message: "Password awal wajib diisi untuk user baru." };
      }
      var newPHash = hashPassword(userData.password);
      sheet.appendRow([
        uId,
        newPHash,
        userData.nama_lengkap,
        userData.role,
        userData.status_aktif,
        new Date().toISOString()
      ]);
      
      var profSheet = ss.getSheetByName(SHEET_PROFILE);
      profSheet.appendRow([
        uId,
        "",
        userData.nama_lengkap,
        "", "", "", "", "", "", "", "",
        new Date().toISOString()
      ]);
      
      writeLog(session.userId, "TAMBAH_USER", "Mendaftarkan user baru " + uId);
    }
    
    return { success: true, message: "User berhasil disimpan." };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function deleteUser(token, targetUserId) {
  try {
    var session = validateSession(token, ["Admin"]);
    var ss = getSpreadsheet();
    
    var uId = targetUserId.toLowerCase();
    if (uId === "admin") {
      return { success: false, message: "Akun Super Admin utama tidak boleh dihapus!" };
    }
    
    var userSheet = ss.getSheetByName(SHEET_USERS);
    var userData = userSheet.getDataRange().getValues();
    for (var i = 1; i < userData.length; i++) {
      if (userData[i][0].toString().toLowerCase() === uId) {
        userSheet.deleteRow(i + 1);
        break;
      }
    }
    
    var profSheet = ss.getSheetByName(SHEET_PROFILE);
    var profData = profSheet.getDataRange().getValues();
    for (var j = 1; j < profData.length; j++) {
      if (profData[j][0].toString().toLowerCase() === uId) {
        profSheet.deleteRow(j + 1);
        break;
      }
    }
    
    writeLog(session.userId, "HAPUS_USER", "Menghapus akun " + uId);
    return { success: true, message: "User berhasil dihapus." };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function getSystemLogs(token, filterUser) {
  try {
    validateSession(token, ["Admin"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_LOG);
    var data = getRecentRows(sheet, 500);
    
    var list = [];
    for (var i = 0; i < data.length; i++) {
      var show = true;
      if (filterUser) {
        if (data[i][2].toString().toLowerCase().indexOf(filterUser.toLowerCase()) === -1) {
          show = false;
        }
      }
      
      if (show) {
        list.push({
          id_log: data[i][0],
          timestamp: data[i][1],
          user_id: data[i][2],
          aksi: data[i][3],
          detail: data[i][4],
          ip: data[i][5]
        });
      }
    }
    
    return { success: true, list: list.reverse() };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// =========================================================================
// === MANAJEMEN EXPORT DATA (EXCEL, PDF & DOC DENGAN PEMBATASAN ROLE)    ===
// =========================================================================

function exportToExcel(token, moduleName) {
  try {
    var session = validateSession(token, ["Admin", "Pembina"]);
    if (session.role === "Pembina" && moduleName !== "absensi") {
      throw new Error("Sebagai Pembina, Anda hanya memiliki hak akses untuk mengekspor data absensi.");
    }
    
    var ss = getSpreadsheet();
    var sourceSheet = ss.getSheetByName(moduleName);
    if (!sourceSheet) throw new Error("Modul data tidak ditemukan.");
    
    var tempSS = SpreadsheetApp.create("Export_" + moduleName + "_" + new Date().toISOString().substring(0, 10));
    var tempSheet = tempSS.getSheets()[0];
    var data = sourceSheet.getDataRange().getValues();
    
    var cleanData = data.map(function(row) {
      return row.map(function(cell) {
        var str = String(cell);
        if (str.indexOf("data:image/") === 0) return "[GAMBAR_DISEMBUNYIKAN]";
        return cell;
      });
    });
    
    tempSheet.getRange(1, 1, cleanData.length, cleanData[0].length).setValues(cleanData);
    var fileId = tempSS.getId();
    var file = DriveApp.getFileById(fileId);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var downloadUrl = "https://docs.google.com/spreadsheets/d/" + fileId + "/export?format=xlsx";
    writeLog(session.userId, "EXPORT_EXCEL", "Mengekspor data modul " + moduleName + " ke Excel");
    return { success: true, url: downloadUrl };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function exportToPDF(token, moduleName) {
  try {
    var session = validateSession(token, ["Admin", "Pembina"]);
    if (session.role === "Pembina" && moduleName !== "absensi") {
      throw new Error("Sebagai Pembina, Anda hanya memiliki hak akses untuk mengekspor data absensi.");
    }
    
    var ss = getSpreadsheet();
    var sourceSheet = ss.getSheetByName(moduleName);
    if (!sourceSheet) throw new Error("Modul data tidak ditemukan.");
    
    var tempSS = SpreadsheetApp.create("Export_PDF_" + moduleName + "_" + new Date().toISOString().substring(0, 10));
    var tempSheet = tempSS.getSheets()[0];
    var data = sourceSheet.getDataRange().getValues();
    
    var cleanData = data.map(function(row) {
      return row.map(function(cell) {
        var str = String(cell);
        if (str.indexOf("data:image/") === 0) return "[GAMBAR]";
        return cell;
      });
    });
    tempSheet.getRange(1, 1, cleanData.length, cleanData[0].length).setValues(cleanData);
    
    var fileId = tempSS.getId();
    var file = DriveApp.getFileById(fileId);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var downloadUrl = "https://docs.google.com/spreadsheets/d/" + fileId + "/export?format=pdf&size=letter&portrait=false&fitw=true&gridlines=true";
    writeLog(session.userId, "EXPORT_PDF", "Mengekspor data modul " + moduleName + " ke PDF");
    return { success: true, url: downloadUrl };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function exportToDOC(token, moduleName) {
  try {
    var session = validateSession(token, ["Admin"]); 
    var ss = getSpreadsheet();
    var sourceSheet = ss.getSheetByName(moduleName);
    if (!sourceSheet) throw new Error("Modul data tidak ditemukan.");
    
    var tempDoc = DocumentApp.create("Export_DOC_" + moduleName + "_" + new Date().toISOString().substring(0, 10));
    var body = tempDoc.getBody();
    var data = sourceSheet.getDataRange().getValues();
    
    body.appendParagraph("LAPORAN DATA " + moduleName.toUpperCase() + " - SIAP WANAMSKA");
    body.appendParagraph("Dicetak pada: " + new Date().toLocaleString());
    body.appendParagraph("--------------------------------------------------------------------------------");
    body.appendParagraph("");
    
    for (var i = 0; i < data.length; i++) {
      var rowText = data[i].map(function(cell) {
        var str = String(cell);
        if (str.indexOf("data:image/") === 0 || str.indexOf("https://docs.google.com/") === 0) return "[TAMPIRAN LAMPIRAN]";
        return str;
      }).join(" | ");
      body.appendParagraph((i === 0 ? "HEADER: " : "• ") + rowText);
    }
    
    tempDoc.saveAndClose();
    var fileId = tempDoc.getId();
    var file = DriveApp.getFileById(fileId);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var downloadUrl = "https://docs.google.com/document/d/" + fileId + "/export?format=docx";
    writeLog(session.userId, "EXPORT_DOC", "Mengekspor data modul " + moduleName + " ke DOC");
    return { success: true, url: downloadUrl };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function getDistance(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; 
  return d;
}

function getNotificationList(token) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan Penggalang", "Penggalang"]);
    var ss = getSpreadsheet();
    var notifications = [];
    
    var agendaSheet = ss.getSheetByName(SHEET_AGENDA);
    if (agendaSheet) {
      var agendaData = getRecentRows(agendaSheet, 40);
      for (var i = 0; i < agendaData.length; i++) {
        notifications.push({
          id: "AGD_" + agendaData[i][0] + "_" + (agendaData[i][8] ? String(agendaData[i][8]).substring(0, 19) : ""),
          module: "Agenda",
          title: "Agenda Baru: " + agendaData[i][1],
          detail: "Jenis: " + agendaData[i][2] + " | Tanggal: " + agendaData[i][3] + " | Waktu: " + agendaData[i][4] + " (PJ: " + agendaData[i][5] + ")",
          timestamp: agendaData[i][8] || new Date().toISOString(),
          roles: ["Admin", "Pembina", "Dewan Penggalang", "Penggalang"],
          type: "agenda"
        });
      }
    }
    
    var kegSheet = ss.getSheetByName(SHEET_KEGIATAN);
    if (kegSheet) {
      var kegData = getRecentRows(kegSheet, 40);
      for (var i = 0; i < kegData.length; i++) {
        notifications.push({
          id: "KEG_" + kegData[i][0] + "_" + (kegData[i][10] ? String(kegData[i][10]).substring(0, 19) : ""),
          module: "Kegiatan",
          title: "Dokumentasi Baru: " + kegData[i][1],
          detail: "Lokasi: " + kegData[i][3] + " | Tanggal: " + kegData[i][2],
          timestamp: kegData[i][10] || new Date().toISOString(),
          roles: ["Admin", "Pembina", "Dewan Penggalang", "Penggalang"],
          type: "kegiatan"
        });
      }
    }
    
    var invSheet = ss.getSheetByName(SHEET_INVENTARIS);
    if (invSheet) {
      var invData = getRecentRows(invSheet, 40);
      for (var i = 0; i < invData.length; i++) {
        notifications.push({
          id: "INV_" + invData[i][0] + "_" + (invData[i][6] ? String(invData[i][6]).substring(0, 10) : ""),
          module: "Inventaris",
          title: "Inventaris Ditambah: " + invData[i][1],
          detail: "Kategori: " + invData[i][2] + " | Jumlah: " + invData[i][3] + " | Lokasi: " + invData[i][5],
          timestamp: invData[i][6] || new Date().toISOString(),
          roles: ["Admin", "Pembina", "Dewan Penggalang"],
          type: "inventaris"
        });
      }
    }
    
    var kasSheet = ss.getSheetByName(SHEET_KAS);
    if (kasSheet) {
      var kasData = getRecentRows(kasSheet, 40);
      for (var i = 0; i < kasData.length; i++) {
        notifications.push({
          id: "KAS_" + kasData[i][0] + "_" + (kasData[i][1] ? String(kasData[i][1]).substring(0, 10) : ""),
          module: "Kas",
          title: "Transaksi Kas: " + kasData[i][3],
          detail: kasData[i][2] + " sebesar Rp " + Number(kasData[i][4]).toLocaleString('id-ID') + " (" + kasData[i][5] + ")",
          timestamp: kasData[i][1] || new Date().toISOString(),
          roles: ["Admin", "Pembina", "Dewan Penggalang"],
          type: "kas"
        });
      }
    }
    
    var absSheet = ss.getSheetByName(SHEET_ABSENSI);
    if (absSheet) {
      var absData = getRecentRows(absSheet, 60);
      for (var i = 0; i < absData.length; i++) {
        if (absData[i][1].toString().toLowerCase() === session.userId.toLowerCase()) {
          notifications.push({
            id: "ABS_" + absData[i][0] + "_" + String(absData[i][3]).substring(0, 10),
            module: "Absensi",
            title: "Konfirmasi Absensi Berhasil",
            detail: "Status Anda dinyatakan " + absData[i][5] + " pada tanggal " + absData[i][3] + " pukul " + absData[i][4] + " (Metode: " + absData[i][7] + ")",
            timestamp: absData[i][3] + "T" + absData[i][4],
            roles: ["Dewan Penggalang", "Penggalang"],
            type: "absensi"
          });
        }
      }
    }
    
    var filtered = notifications.filter(function(notif) {
      return notif.roles.indexOf(session.role) !== -1;
    });
    
    filtered.sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    return { success: true, list: filtered.slice(0, 30) };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}
