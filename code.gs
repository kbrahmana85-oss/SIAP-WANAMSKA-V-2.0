const SPREADSHEET_ID = '107uW-UxApF4Ecb-BT9-gRGg-0awaa_lKUkbsNRBupLg';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index').setTitle('SIAP WANAMSKA V2');
}

function hashPassword(password){
  if(!password) return "";
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function loginUser(userId, password){
  if(!userId ||!password) return {success: false, message: 'User ID dan Password wajib diisi'};
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Users');
  if(!sheet) return {success: false, message: 'Sheet "Users" tidak ditemukan'};
  const data = sheet.getDataRange().getValues();
  const userRow = data.find(row => String(row[0]).trim() === userId && String(row[4]).trim() === 'Aktif');
  if(!userRow) return {success: false, message: 'User tidak ditemukan atau Status tidak Aktif'};
  const hashInput = hashPassword(password);
  if(hashInput === String(userRow[1]).trim()){
    return {success: true, sessionToken: "token_" + userId, user:{user_id:userRow[0], nama_lengkap:userRow[2], role:userRow[3]}};
  } else {
    return {success: false, message: 'Password salah'};
  }
}

// Konstanta Nama Sheet
const SHEET_USERS = "Users";
const SHEET_PROFILE = "profile";
const SHEET_ABSENSI = "absensi";
const SHEET_KEGIATAN = "kegiatan";
const SHEET_INVENTARIS = "inventaris";
const SHEET_KAS = "kas";
const SHEET_LOG = "log";

/**
 * Helper untuk membuka spreadsheet target secara konsisten menggunakan SPREADSHEET_ID
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Inisialisasi Database: Membuat Sheet dan Kolom Header jika belum ada.
 * Juga membuat akun admin bawaan (default) jika sheet "Users" masih kosong.
 */
function initializeDatabase() {
  var ss = getSpreadsheet();
  
  // 1. Sheet Users
  var sUsers = ss.getSheetByName(SHEET_USERS);
  if (!sUsers) {
    sUsers = ss.insertSheet(SHEET_USERS);
    sUsers.appendRow(["user_id", "password", "nama_lengkap", "role", "status_aktif", "tanggal_dibuat"]);
  }
  
  // Buat default admin jika kosong
  if (sUsers.getLastRow() <= 1) {
    var adminPasswordHash = hashPassword("admin123");
    sUsers.appendRow(["admin", adminPasswordHash, "Administrator Utama", "Admin", "Aktif", new Date().toISOString()]);
  }

  // 2. Sheet Profile
  var sProfile = ss.getSheetByName(SHEET_PROFILE);
  if (!sProfile) {
    sProfile = ss.insertSheet(SHEET_PROFILE);
    sProfile.appendRow(["user_id", "nta", "nama_lengkap", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "golongan", "regu_sangga", "alamat", "no_hp", "foto_profil", "tanggal_bergabung"]);
  }
  // Daftarkan profil default admin jika kosong
  if (sProfile.getLastRow() <= 1) {
    sProfile.appendRow(["admin", "12.34.56.78", "Administrator Utama", "Jakarta", "2000-01-01", "Laki-laki", "Pembina", "Manggala", "Markas Gerakan Pramuka", "08123456789", "", new Date().toISOString()]);
  }

  // 3. Sheet Absensi
  var sAbsen = ss.getSheetByName(SHEET_ABSENSI);
  if (!sAbsen) {
    sAbsen = ss.insertSheet(SHEET_ABSENSI);
    sAbsen.appendRow(["id_absen", "user_id", "nama", "tanggal", "jam", "status", "foto_selfie", "metode", "kegiatan_terkait", "keterangan"]);
  }

  // 4. Sheet Kegiatan
  var sKegiatan = ss.getSheetByName(SHEET_KEGIATAN);
  if (!sKegiatan) {
    sKegiatan = ss.insertSheet(SHEET_KEGIATAN);
    sKegiatan.appendRow(["id_kegiatan", "nama_kegiatan", "tanggal", "lokasi", "deskripsi", "foto1", "foto2", "foto3", "foto4", "dibuat_oleh", "tanggal_dibuat"]);
  }

  // 5. Sheet Inventaris
  var sInventaris = ss.getSheetByName(SHEET_INVENTARIS);
  if (!sInventaris) {
    sInventaris = ss.insertSheet(SHEET_INVENTARIS);
    sInventaris.appendRow(["id_barang", "nama_barang", "kategori", "jumlah", "kondisi", "lokasi_simpan", "tanggal_masuk", "keterangan", "dikelola_oleh"]);
  }

  // 6. Sheet Kas
  var sKas = ss.getSheetByName(SHEET_KAS);
  if (!sKas) {
    sKas = ss.insertSheet(SHEET_KAS);
    sKas.appendRow(["id_transaksi", "tanggal", "jenis", "kategori", "jumlah", "keterangan", "saldo_berjalan", "dicatat_oleh"]);
  }

  // 7. Sheet Log
  var sLog = ss.getSheetByName(SHEET_LOG);
  if (!sLog) {
    sLog = ss.insertSheet(SHEET_LOG);
    sLog.appendRow(["id_log", "timestamp", "user_id", "aksi", "detail", "alamat_ip"]);
  }
}

/**
 * Pencatatan Log Aktivitas ke Google Sheet
 */
function writeLog(userId, aksi, detail) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_LOG);
    var idLog = "LOG-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    var timestamp = new Date().toISOString();
    
    var ip = "Client Script Engine"; 
    
    sheet.appendRow([idLog, timestamp, userId, aksi, detail, ip]);
  } catch(e) {
    Logger.log("Gagal menulis log: " + e.toString());
  }
}

/**
 * Memvalidasi Sesi Token dari CacheService dan mengembalikan data pengguna jika valid.
 */
function validateSession(token, allowedRoles) {
  if (!token) throw new Error("Sesi kadaluarsa. Silakan login kembali.");
  var cache = CacheService.getScriptCache();
  var sessionDataStr = cache.get(token);
  if (!sessionDataStr) throw new Error("Sesi tidak valid atau telah berakhir.");
  
  var session = JSON.parse(sessionDataStr);
  
  if (allowedRoles && allowedRoles.indexOf(session.role) === -1) {
    throw new Error("Anda tidak memiliki hak akses untuk fungsi ini.");
  }
  
  return session;
}

/**
 * Menambahkan user baru secara manual dari Apps Script Editor ke sheet "Users" dengan password terenkripsi SHA-256.
 */
function addUser(userId, password, namaLengkap, role) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_USERS);
    if (!sheet) {
      return { success: false, message: "Sheet Users tidak ditemukan." };
    }
    var hash = hashPassword(password);
    sheet.appendRow([userId, hash, namaLengkap, role, 'Aktif', new Date().toISOString()]);
    return 'User ' + userId + ' berhasil dibuat';
  } catch (e) {
    return 'Gagal membuat user: ' + e.toString();
  }
}

/**
 * LOGOUT USER
 */
function logoutUser(token) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan", "Penggalang"]);
    CacheService.getScriptCache().remove(token);
    writeLog(session.userId, "LOGOUT", "Keluar dari sistem");
    return { success: true };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * DASHBOARD DATA FETCH
 */
function getDashboardData(token) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan", "Penggalang"]);
    var ss = getSpreadsheet();
    
    var usersSheet = ss.getSheetByName(SHEET_USERS);
    var totalAnggota = usersSheet.getLastRow() - 1;
    
    var absensiSheet = ss.getSheetByName(SHEET_ABSENSI);
    var absensiData = absensiSheet.getDataRange().getValues();
    var hariIni = new Date().toISOString().substring(0, 10);
    var hadirHariIni = 0;
    
    for (var i = 1; i < absensiData.length; i++) {
      var tglRow = absensiData[i][3];
      var status = absensiData[i][5];
      if (tglRow === hariIni && status === "Hadir") {
        hadirHariIni++;
      }
    }
    
    var kegiatanSheet = ss.getSheetByName(SHEET_KEGIATAN);
    var kegiatanData = kegiatanSheet.getDataRange().getValues();
    var kegiatanTerbaru = "-";
    if (kegiatanData.length > 1) {
      kegiatanTerbaru = kegiatanData[kegiatanData.length - 1][1];
    }
    
    var saldoKas = 0;
    if (["Admin", "Pembina", "Dewan"].indexOf(session.role) !== -1) {
      var kasSheet = ss.getSheetByName(SHEET_KAS);
      var kasData = kasSheet.getDataRange().getValues();
      if (kasData.length > 1) {
        saldoKas = kasData[kasData.length - 1][6];
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

/**
 * SUBMIT ABSENSI (Selfie & Manual/QR)
 */
function submitAbsen(token, status, fotoSelfie, metode, kegiatanTerkait, keterangan) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan", "Penggalang"]);
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
    
    sheet.appendRow([
      idAbsen,
      session.userId,
      session.name,
      tanggal,
      jam,
      status,
      fotoSelfie,
      metode,
      kegiatanTerkait,
      keterangan
    ]);
    
    writeLog(session.userId, "ABSEN", "Melakukan absensi " + status + " via " + metode);
    return { success: true, message: "Absensi berhasil dicatat!" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * GET RIWAYAT ABSENSI
 */
function getAbsenHistory(token, filterDate) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan", "Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_ABSENSI);
    var data = sheet.getDataRange().getValues();
    
    var list = [];
    for (var i = 1; i < data.length; i++) {
      var show = false;
      
      if (session.role === "Penggalang") {
        if (data[i][1] === session.userId) {
          show = true;
        }
      } else {
        show = true;
      }
      
      if (show && filterDate) {
        if (data[i][3] !== filterDate) {
          show = false;
        }
      }
      
      if (show) {
        list.push({
          id_absen: data[i][0],
          user_id: data[i][1],
          nama: data[i][2],
          tanggal: data[i][3],
          jam: data[i][4],
          status: data[i][5],
          foto_selfie: data[i][6] ? "Ada Foto" : "Tidak Ada",
          foto_base64: data[i][6],
          metode: data[i][7],
          kegiatan: data[i][8],
          keterangan: data[i][9]
        });
      }
    }
    
    list.reverse();
    return { success: true, list: list };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * GET DAFTAR KEGIATAN
 */
function getKegiatanList(token) {
  try {
    validateSession(token, ["Admin", "Pembina", "Dewan", "Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_KEGIATAN);
    var data = sheet.getDataRange().getValues();
    
    var list = [];
    for (var i = 1; i < data.length; i++) {
      list.push({
        id_kegiatan: data[i][0],
        nama_kegiatan: data[i][1],
        tanggal: data[i][2],
        lokasi: data[i][3],
        deskripsi: data[i][4],
        foto1: data[i][5],
        foto2: data[i][6],
        foto3: data[i][7],
        foto4: data[i][8],
        dibuat_oleh: data[i][9],
        tanggal_dibuat: data[i][10]
      });
    }
    list.reverse();
    return { success: true, list: list };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * SAVE KEGIATAN (Create & Update)
 */
function saveKegiatan(token, dataKegiatan) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_KEGIATAN);
    var data = sheet.getDataRange().getValues();
    
    var idKegiatan = dataKegiatan.id_kegiatan;
    var rowIdx = -1;
    
    if (idKegiatan) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === idKegiatan) {
          rowIdx = i + 1;
          break;
        }
      }
    } else {
      idKegiatan = "KEG-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    }
    
    var tglDibuat = new Date().toISOString();
    
    if (rowIdx !== -1) {
      sheet.getRange(rowIdx, 2, 1, 9).setValues([[
        dataKegiatan.nama_kegiatan,
        dataKegiatan.tanggal,
        dataKegiatan.lokasi,
        dataKegiatan.deskripsi,
        dataKegiatan.foto1,
        dataKegiatan.foto2,
        dataKegiatan.foto3 || "",
        dataKegiatan.foto4 || "",
        session.userId
      ]]);
      writeLog(session.userId, "EDIT_KEGIATAN", "Mengubah kegiatan " + dataKegiatan.nama_kegiatan);
    } else {
      sheet.appendRow([
        idKegiatan,
        dataKegiatan.nama_kegiatan,
        dataKegiatan.tanggal,
        dataKegiatan.lokasi,
        dataKegiatan.deskripsi,
        dataKegiatan.foto1,
        dataKegiatan.foto2,
        dataKegiatan.foto3 || "",
        dataKegiatan.foto4 || "",
        session.userId,
        tglDibuat
      ]);
      writeLog(session.userId, "TAMBAH_KEGIATAN", "Menambahkan kegiatan baru " + dataKegiatan.nama_kegiatan);
    }
    
    return { success: true, message: "Kegiatan berhasil disimpan." };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * DELETE KEGIATAN (Hanya Admin)
 */
function deleteKegiatan(token, idKegiatan) {
  try {
    var session = validateSession(token, ["Admin"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_KEGIATAN);
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === idKegiatan) {
        sheet.deleteRow(i + 1);
        writeLog(session.userId, "HAPUS_KEGIATAN", "Menghapus kegiatan ID " + idKegiatan);
        return { success: true, message: "Kegiatan berhasil dihapus." };
      }
    }
    return { success: false, message: "Kegiatan tidak ditemukan." };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * GET INVENTARIS
 */
function getInventarisList(token) {
  try {
    validateSession(token, ["Admin", "Pembina", "Dewan"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_INVENTARIS);
    var data = sheet.getDataRange().getValues();
    
    var list = [];
    for (var i = 1; i < data.length; i++) {
      list.push({
        id_barang: data[i][0],
        nama_barang: data[i][1],
        kategori: data[i][2],
        jumlah: data[i][3],
        kondisi: data[i][4],
        lokasi_simpan: data[i][5],
        tanggal_masuk: data[i][6],
        keterangan: data[i][7],
        dikelola_oleh: data[i][8]
      });
    }
    return { success: true, list: list };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * SAVE INVENTARIS (Create & Update)
 */
function saveInventaris(token, dataBarang) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_INVENTARIS);
    var data = sheet.getDataRange().getValues();
    
    var idBarang = dataBarang.id_barang;
    var rowIdx = -1;
    
    if (idBarang) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === idBarang) {
          rowIdx = i + 1;
          break;
        }
      }
    } else {
      idBarang = "INV-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    }
    
    if (rowIdx !== -1) {
      sheet.getRange(rowIdx, 2, 1, 8).setValues([[
        dataBarang.nama_barang,
        dataBarang.kategori,
        dataBarang.jumlah,
        dataBarang.kondisi,
        dataBarang.lokasi_simpan,
        dataBarang.tanggal_masuk,
        dataBarang.keterangan,
        session.userId
      ]]);
      writeLog(session.userId, "EDIT_INVENTARIS", "Mengubah barang " + dataBarang.nama_barang);
    } else {
      sheet.appendRow([
        idBarang,
        dataBarang.nama_barang,
        dataBarang.kategori,
        dataBarang.jumlah,
        dataBarang.kondisi,
        dataBarang.lokasi_simpan,
        dataBarang.tanggal_masuk,
        dataBarang.keterangan,
        session.userId
      ]);
      writeLog(session.userId, "TAMBAH_INVENTARIS", "Menambahkan barang baru " + dataBarang.nama_barang);
    }
    
    return { success: true, message: "Data barang berhasil disimpan." };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * DELETE INVENTARIS (Hanya Admin)
 */
function deleteInventaris(token, idBarang) {
  try {
    var session = validateSession(token, ["Admin"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_INVENTARIS);
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === idBarang) {
        sheet.deleteRow(i + 1);
        writeLog(session.userId, "HAPUS_INVENTARIS", "Menghapus barang ID " + idBarang);
        return { success: true, message: "Barang berhasil dihapus." };
      }
    }
    return { success: false, message: "Barang tidak ditemukan." };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * GET KAS DATA (Mendapatkan riwayat kas & menghitung saldo)
 */
function getKasData(token) {
  try {
    validateSession(token, ["Admin", "Pembina", "Dewan"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_KAS);
    var data = sheet.getDataRange().getValues();
    
    var list = [];
    var totalMasuk = 0;
    var totalKeluar = 0;
    
    for (var i = 1; i < data.length; i++) {
      var jumlah = parseFloat(data[i][4]) || 0;
      var jenis = data[i][2];
      
      if (jenis === "Pemasukan") totalMasuk += jumlah;
      else if (jenis === "Pengeluaran") totalKeluar += jumlah;
      
      list.push({
        id_transaksi: data[i][0],
        tanggal: data[i][1],
        jenis: jenis,
        kategori: data[i][3],
        jumlah: jumlah,
        keterangan: data[i][5],
        saldo_berjalan: data[i][6],
        dicatat_oleh: data[i][7]
      });
    }
    
    return {
      success: true,
      list: list.reverse(),
      totalMasuk: totalMasuk,
      totalKeluar: totalKeluar,
      saldoAkhir: totalMasuk - totalKeluar
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * ADD KAS TRANSACTION (Hanya Admin)
 */
function addKasTransaction(token, trans) {
  try {
    var session = validateSession(token, ["Admin"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_KAS);
    var data = sheet.getDataRange().getValues();
    
    var saldoTerakhir = 0;
    if (data.length > 1) {
      saldoTerakhir = parseFloat(data[data.length - 1][6]) || 0;
    }
    
    var idTrans = "KAS-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    var tanggal = trans.tanggal || new Date().toISOString().substring(0, 10);
    var jenis = trans.jenis;
    var jumlah = parseFloat(trans.jumlah) || 0;
    
    var saldoBaru = saldoTerakhir;
    if (jenis === "Pemasukan") {
      saldoBaru += jumlah;
    } else if (jenis === "Pengeluaran") {
      saldoBaru -= jumlah;
    }
    
    sheet.appendRow([
      idTrans,
      tanggal,
      jenis,
      trans.kategori,
      jumlah,
      trans.keterangan,
      saldoBaru,
      session.userId
    ]);
    
    writeLog(session.userId, "TAMBAH_KAS", "Pencatatan kas baru " + jenis + ": Rp " + jumlah);
    return { success: true, message: "Transaksi kas berhasil ditambahkan." };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * GET PROFILE (Mendapatkan data diri pengguna)
 */
function getUserProfile(token, targetUserId) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan", "Penggalang"]);
    var ss = getSpreadsheet();
    
    var uId = session.userId;
    if (targetUserId && ["Admin", "Pembina"].indexOf(session.role) !== -1) {
      uId = targetUserId;
    }
    
    var sheet = ss.getSheetByName(SHEET_PROFILE);
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().toLowerCase() === uId.toLowerCase()) {
        return {
          success: true,
          profile: {
            user_id: data[i][0],
            nta: data[i][1],
            nama_lengkap: data[i][2],
            tempat_lahir: data[i][3],
            tanggal_lahir: data[i][4],
            jenis_kelamin: data[i][5],
            golongan: data[i][6],
            regu_sangga: data[i][7],
            alamat: data[i][8],
            no_hp: data[i][9],
            foto_profil: data[i][10],
            tanggal_bergabung: data[i][11]
          }
        };
      }
    }
    
    return {
      success: true,
      profile: {
        user_id: uId,
        nta: "",
        nama_lengkap: session.name,
        tempat_lahir: "",
        tanggal_lahir: "",
        jenis_kelamin: "",
        golongan: "",
        regu_sangga: "",
        alamat: "",
        no_hp: "",
        foto_profil: "",
        tanggal_bergabung: ""
      }
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * SAVE PROFILE (Update Profil Diri Sendiri atau User Lain oleh Admin)
 */
function saveUserProfile(token, prof) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan", "Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_PROFILE);
    var data = sheet.getDataRange().getValues();
    
    var uId = prof.user_id.toLowerCase();
    if (session.role === "Penggalang" && uId !== session.userId) {
      return { success: false, message: "Anda tidak berhak mengubah profil orang lain." };
    }
    
    var rowIdx = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().toLowerCase() === uId) {
        rowIdx = i + 1;
        break;
      }
    }
    
    var rowData = [
      uId,
      prof.nta,
      prof.nama_lengkap,
      prof.tempat_lahir,
      prof.tanggal_lahir,
      prof.jenis_kelamin,
      prof.golongan,
      prof.regu_sangga,
      prof.alamat,
      prof.no_hp,
      prof.foto_profil,
      prof.tanggal_bergabung || new Date().toISOString()
    ];
    
    if (rowIdx !== -1) {
      sheet.getRange(rowIdx, 1, 1, 12).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    var userSheet = ss.getSheetByName(SHEET_USERS);
    var userData = userSheet.getDataRange().getValues();
    for (var j = 1; j < userData.length; j++) {
      if (userData[j][0].toString().toLowerCase() === uId) {
        userSheet.getRange(j + 1, 3).setValue(prof.nama_lengkap);
        break;
      }
    }
    
    writeLog(session.userId, "UPDATE_PROFILE", "Memperbarui data profil " + uId);
    return { success: true, message: "Profil berhasil diperbarui." };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * CHANGE PASSWORD
 */
function changePassword(token, oldPassword, newPassword) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan", "Penggalang"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_USERS);
    var data = sheet.getDataRange().getValues();
    
    var pHashOld = hashPassword(oldPassword);
    var pHashNew = hashPassword(newPassword);
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().toLowerCase() === session.userId) {
        if (data[i][1] === pHashOld) {
          sheet.getRange(i + 1, 2).setValue(pHashNew);
          writeLog(session.userId, "GANTI_PASSWORD", "Berhasil mengganti password");
          return { success: true, message: "Password berhasil diganti." };
        } else {
          return { success: false, message: "Password lama salah." };
        }
      }
    }
    return { success: false, message: "User tidak ditemukan." };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * GET ALL USERS (Hanya Admin)
 */
function getUserList(token) {
  try {
    validateSession(token, ["Admin"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_USERS);
    var data = sheet.getDataRange().getValues();
    
    var list = [];
    for (var i = 1; i < data.length; i++) {
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

/**
 * SAVE USER (Khusus Admin: Membuat/Update User baru + sekaligus profil)
 */
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
      writeLog(session.userId, "EDIT_USER", "Mengedit user " + uId);
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

/**
 * DELETE USER (Hanya Admin)
 */
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

/**
 * GET SYSTEM LOGS (Hanya Admin)
 */
function getSystemLogs(token, filterUser) {
  try {
    validateSession(token, ["Admin"]);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_LOG);
    var data = sheet.getDataRange().getValues();
    
    var list = [];
    for (var i = 1; i < data.length; i++) {
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
    
    return { success: true, list: list.reverse().slice(0, 500) };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * EXPORT DATA TO EXCEL
 */
function exportToExcel(token, moduleName) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan"]);
    var ss = getSpreadsheet();
    var sourceSheet = ss.getSheetByName(moduleName);
    
    if (!sourceSheet) throw new Error("Modul data tidak ditemukan.");
    
    var tempSS = SpreadsheetApp.create("Export_" + moduleName + "_" + new Date().toISOString().substring(0, 10));
    var tempSheet = tempSS.getSheets()[0];
    
    var data = sourceSheet.getDataRange().getValues();
    
    var cleanData = data.map(function(row) {
      return row.map(function(cell) {
        var str = String(cell);
        if (str.indexOf("data:image/") === 0) {
          return "[GAMBAR_DISEMBUNYIKAN]";
        }
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

/**
 * EXPORT DATA TO PDF
 */
function exportToPDF(token, moduleName) {
  try {
    var session = validateSession(token, ["Admin", "Pembina", "Dewan"]);
    var ss = getSpreadsheet();
    var sourceSheet = ss.getSheetByName(moduleName);
    if (!sourceSheet) throw new Error("Modul data tidak ditemukan.");
    
    var tempSS = SpreadsheetApp.create("Export_PDF_" + moduleName + "_" + new Date().toISOString().substring(0, 10));
    var tempSheet = tempSS.getSheets()[0];
    
    var data = sourceSheet.getDataRange().getValues();
    var cleanData = data.map(function(row) {
      return row.map(function(cell) {
        var str = String(cell);
        if (str.indexOf("data:image/") === 0) {
          return "[GAMBAR]";
        }
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

/**
 * Mengambil daftar anggota dari sheet "Anggota" atau cadangan sheet "Users".
 * Filter: Hanya menampilkan role 'penggalang' atau 'pembina'.
 */
function getAnggotaUntukAbsen() {
  try {
    var ss = getSpreadsheet();
    // Gunakan sheet "Anggota" sebagai prioritas, jika tidak ada fallback ke sheet "Users"
    var sheet = ss.getSheetByName("Anggota") || ss.getSheetByName(SHEET_USERS);
    if (!sheet) {
      return { success: false, message: "Sheet data anggota tidak ditemukan." };
    }
    
    var data = sheet.getDataRange().getValues();
    var isAnggotaSheet = (sheet.getName() === "Anggota");
    var result = [];
    
    for (var i = 1; i < data.length; i++) {
      var userId = data[i][0];
      var namaLengkap = isAnggotaSheet ? data[i][1] : data[i][2];
      var role = isAnggotaSheet ? data[i][2] : data[i][3];
      
      if (userId && role) {
        var roleLower = role.toString().trim().toLowerCase();
        if (roleLower === "penggalang" || roleLower === "pembina") {
          result.push({
            user_id: userId.toString(),
            nama_lengkap: namaLengkap.toString(),
            role: role.toString()
          });
        }
      }
    }
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Menyimpan seluruh data kehadiran harian ke dalam sheet "Kehadiran".
 * Jika data dengan kombinasi Tanggal + user_id sudah ada, sistem akan memperbaruinya (UPDATE).
 * Jika belum ada, data baru akan ditambahkan (APPEND).
 */
function saveKehadiran(dataAbsen) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName("Kehadiran");
    if (!sheet) {
      sheet = ss.insertSheet("Kehadiran");
      sheet.appendRow(["Tanggal", "user_id", "status"]);
    }
    
    var data = sheet.getDataRange().getValues();
    var tanggalStr = dataAbsen.tanggal; // format: 'YYYY-MM-DD'
    var listRecord = dataAbsen.data;
    
    // Petakan data baris yang sudah ada untuk mempercepat verifikasi duplikasi
    var mappedKeys = {};
    for (var i = 1; i < data.length; i++) {
      var rowDate = data[i][0];
      var rowDateStr = (rowDate instanceof Date) ? Utilities.formatDate(rowDate, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd") : rowDate.toString().substring(0, 10);
      var rowUserId = data[i][1].toString().trim();
      
      mappedKeys[rowDateStr + "_" + rowUserId] = i + 1; // Menyimpan index baris sheet (1-based)
    }
    
    // Proses tulis/update data
    for (var j = 0; j < listRecord.length; j++) {
      var record = listRecord[j];
      var key = tanggalStr + "_" + record.user_id.trim();
      
      if (mappedKeys[key]) {
        // Jika sudah terdata pada tanggal yang sama, lakukan UPDATE pada kolom Status (Kolom C/3)
        var targetRow = mappedKeys[key];
        sheet.getRange(targetRow, 3).setValue(record.status);
      } else {
        // Jika belum ada, lakukan APPEND baris baru
        sheet.appendRow([tanggalStr, record.user_id, record.status]);
      }
    }
    
    return { success: true, message: 'Data kehadiran harian berhasil disimpan' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
