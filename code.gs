/**
 * SIAP WANAMSKA V2 - Sistem Absensi Pramuka SMPN 26 Surakarta
 * Backend Server-side Script (Code.gs)
 * Berjalan 100% mandiri pada domain *.google.com / *.googleusercontent.com
 */

// --- ENTRY POINT ---

function doGet(e) {
  var template = HtmlService.createTemplateFromFile("index");
  return template.evaluate()
    .setTitle("SIAP WANAMSKA V2 - Absensi Pramuka")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- INITIALIZE SPREADSHEET ---
// Fungsi ini dijalankan sekali saat setup pertama kali untuk membuat semua sheet & tabel
function initializeSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var sheets = {
    "users": [["nta", "nama", "password", "role", "kelas_regu", "jenis_kelamin", "foto_profil", "no_hp", "status_aktif", "created_at"]],
    "absensi": [["id_absen", "nta", "nama", "tanggal", "jam", "keterangan", "foto_selfie", "id_kegiatan", "verifikator_nta", "verifikator_nama", "lokasi", "timestamp"]],
    "kegiatan": [["id_kegiatan", "nama_kegiatan", "deskripsi", "tanggal_mulai", "tanggal_selesai", "jam", "lokasi", "wajib_verifikasi_qr", "penanggung_jawab", "status", "foto_urls", "created_by", "created_at", "updated_by", "updated_at"]],
    "inventaris": [["id_barang", "nama_barang", "kategori", "jumlah", "satuan", "kondisi", "lokasi_simpan", "keterangan", "updated_by", "updated_at"]],
    "log": [["id_log", "nta", "nama", "aksi", "modul", "detail", "timestamp", "ip_device_info"]]
  };
  
  for (var sheetName in sheets) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(sheets[sheetName][0]);
    }
  }
  
  // Buat default admin jika tabel user kosong
  var usersSheet = ss.getSheetByName("users");
  if (usersSheet.getLastRow() === 1) {
    var defaultNta = "123456";
    var defaultPass = "admin123";
    var hashedPass = hashPassword(defaultPass);
    usersSheet.appendRow([
      defaultNta,
      "Guru Pembina (Admin)",
      hashedPass,
      "Admin",
      "Pembina",
      "Laki-laki",
      "", 
      "081234567890",
      "Aktif",
      new Date()
    ]);
  }
}

// --- CRYPTOGRAPHY ---

function hashPassword(password) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  var signature = [];
  for (var i = 0; i < digest.length; i++) {
    var byteVal = digest[i];
    if (byteVal < 0) byteVal += 256;
    var byteString = byteVal.toString(16);
    if (byteString.length == 1) byteString = "0" + byteString;
    signature.push(byteString);
  }
  return signature.join("");
}

// --- AUTHENTICATION ---

function loginUser(nta, password) {
  var sheet = getActiveSpreadsheet().getSheetByName("users");
  var data = sheet.getDataRange().getValues();
  var hashedPassword = hashPassword(password);
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === nta.toString().trim() && data[i][2].toString() === hashedPassword) {
      if (data[i][8].toString().toLowerCase() !== "aktif") {
        return { success: false, message: "Akun Anda dinonaktifkan. Hubungi Admin." };
      }
      var token = hashPassword(nta + Date.now().toString());
      var cache = CacheService.getUserCache();
      cache.put("session_" + nta, token, 21600); // Sesi bertahan selama 6 jam
      
      catatLog(nta, "Login", "AUTH", "User berhasil login masuk sistem");
      return {
        success: true,
        user: {
          nta: data[i][0],
          nama: data[i][1],
          role: data[i][3],
          kelas_regu: data[i][4],
          jenis_kelamin: data[i][5],
          foto_profil: data[i][6] ? getFotoUrlFromId(data[i][6]) : "",
          no_hp: data[i][7]
        },
        token: token
      };
    }
  }
  return { success: false, message: "NTA atau Password salah." };
}

function checkSession(nta, token) {
  var cache = CacheService.getUserCache();
  var storedToken = cache.get("session_" + nta);
  if (storedToken && storedToken === token) {
    var user = getDataProfil(nta);
    return { success: true, user: user };
  }
  return { success: false, message: "Sesi habis atau tidak valid." };
}

function logoutUser(nta) {
  var cache = CacheService.getUserCache();
  cache.remove("session_" + nta);
  catatLog(nta, "Logout", "AUTH", "User logout dari sistem");
  return { success: true };
}

function gantiPassword(nta, oldPass, newPass) {
  var sheet = getActiveSpreadsheet().getSheetByName("users");
  var data = sheet.getDataRange().getValues();
  var hashedOld = hashPassword(oldPass);
  var hashedNew = hashPassword(newPass);
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === nta.toString().trim()) {
      if (data[i][2].toString() !== hashedOld) {
        return { success: false, message: "Password lama tidak sesuai." };
      }
      sheet.getRange(i + 1, 3).setValue(hashedNew);
      catatLog(nta, "Ganti Password", "PROFIL", "Mengganti password akun");
      return { success: true, message: "Password berhasil diperbarui!" };
    }
  }
  return { success: false, message: "User tidak ditemukan." };
}

function registerUser(dataUser, ntaPelaku) {
  var rolePelaku = getRoleByNta(ntaPelaku);
  if (rolePelaku !== "Admin") {
    return { success: false, message: "Akses ditolak. Hanya Admin yang dapat mendaftarkan user." };
  }
  
  var sheet = getActiveSpreadsheet().getSheetByName("users");
  var data = sheet.getDataRange().getValues();
  var nta = dataUser.nta.toString().trim();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === nta) {
      return { success: false, message: "NTA sudah terdaftar dalam sistem." };
    }
  }
  
  var hashedPassword = hashPassword(dataUser.password);
  sheet.appendRow([
    nta,
    dataUser.nama,
    hashedPassword,
    dataUser.role,
    dataUser.kelas_regu,
    dataUser.jenis_kelamin,
    "", 
    dataUser.no_hp,
    "Aktif",
    new Date()
  ]);
  
  catatLog(ntaPelaku, "Registrasi User", "ADMIN", "Mendaftarkan NTA baru: " + nta);
  return { success: true, message: "User baru berhasil didaftarkan!" };
}

// --- DASHBOARD ---

function getDashboardStats(role, nta) {
  var absensiSheet = getActiveSpreadsheet().getSheetByName("absensi");
  var absensiData = absensiSheet.getDataRange().getValues();
  var usersSheet = getActiveSpreadsheet().getSheetByName("users");
  var usersData = usersSheet.getDataRange().getValues();
  
  var stats = {
    rekapHariIni: { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 },
    kehadiranPerKelas: {}, 
    kehadiranPribadi: { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0, totalSesi: 0 } 
  };
  
  var todayStr = getFormattedDate(new Date());
  var currentMonth = new Date().getMonth();
  var currentYear = new Date().getFullYear();
  
  var userMap = {};
  for (var u = 1; u < usersData.length; u++) {
    var uNta = usersData[u][0].toString().trim();
    var uKelas = usersData[u][4].toString().trim();
    userMap[uNta] = uKelas;
  }
  
  for (var i = 1; i < absensiData.length; i++) {
    var rNta = absensiData[i][1].toString().trim();
    var rTanggal = absensiData[i][3];
    var rKet = absensiData[i][5].toString().trim();
    
    var rowDateStr = (rTanggal instanceof Date) ? getFormattedDate(rTanggal) : rTanggal.toString().trim();
    var rowDateObj = (rTanggal instanceof Date) ? rTanggal : new Date(rTanggal);
    
    if (rowDateStr === todayStr) {
      if (stats.rekapHariIni[rKet] !== undefined) {
        stats.rekapHariIni[rKet]++;
      }
    }
    
    var kelas = userMap[rNta] || "Lainnya";
    if (!stats.kehadiranPerKelas[kelas]) {
      stats.kehadiranPerKelas[kelas] = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 };
    }
    if (stats.kehadiranPerKelas[kelas][rKet] !== undefined) {
      stats.kehadiranPerKelas[kelas][rKet]++;
    }
    
    if (rNta === nta.toString().trim()) {
      if (rowDateObj.getMonth() === currentMonth && rowDateObj.getFullYear() === currentYear) {
        if (stats.kehadiranPribadi[rKet] !== undefined) {
          stats.kehadiranPribadi[rKet]++;
        }
        stats.kehadiranPribadi.totalSesi++;
      }
    }
  }
  
  return { success: true, stats: stats };
}

function getJamServer() {
  return { timestamp: Date.now(), text: getFormattedTime(new Date()) };
}

function getKegiatanTerdekat() {
  var list = getAllKegiatan().data || [];
  var now = new Date();
  var filtered = list.filter(function(k) {
    return new Date(k.tanggal_mulai) >= now;
  });
  filtered.sort(function(a, b) {
    return new Date(a.tanggal_mulai) - new Date(b.tanggal_mulai);
  });
  return { success: true, data: filtered.slice(0, 3) };
}

// --- ABSENSI ---

function simpanAbsensi(dataAbsen) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Cegah race condition
  } catch (e) {
    return { success: false, message: "Sistem sibuk, silakan kirim ulang absensi Anda." };
  }
  
  try {
    var nta = dataAbsen.nta;
    var tanggal = dataAbsen.tanggal || getFormattedDate(new Date());
    var jam = dataAbsen.jam || getFormattedTime(new Date());
    var idKegiatan = dataAbsen.id_kegiatan || "";
    
    if (cekDuplikatAbsen(nta, tanggal, idKegiatan)) {
      return { success: false, message: "Anda sudah melakukan absen hari ini." };
    }
    
    var fileId = "";
    if (dataAbsen.foto_selfie) {
      if (!validasiUkuranFotoServer(dataAbsen.foto_selfie)) {
        return { success: false, message: "Gagal: File foto selfie melebihi 500KB." };
      }
      fileId = uploadFotoToBase64Storage(dataAbsen.foto_selfie, "Absen_" + nta + "_" + tanggal + ".jpg", "SIAP_Absensi_Selfie");
    }
    
    var sheet = getActiveSpreadsheet().getSheetByName("absensi");
    var idAbsen = generateUniqueId("ABS");
    
    var verifNta = dataAbsen.verifikator_nta || "";
    var verifNama = "";
    if (verifNta) {
      var verifUser = getDataProfil(verifNta);
      if (verifUser) verifNama = verifUser.nama;
    }
    
    var userProfil = getDataProfil(nta);
    var namaUser = userProfil ? userProfil.nama : "";
    
    sheet.appendRow([
      idAbsen,
      nta,
      namaUser,
      tanggal,
      jam,
      dataAbsen.keterangan,
      fileId,
      idKegiatan,
      verifNta,
      verifNama,
      dataAbsen.lokasi || "",
      new Date()
    ]);
    
    catatLog(nta, "Absen", "ABSENSI", "Absen berhasil dicatat: " + dataAbsen.keterangan);
    return { success: true, message: "Selesai! Absensi Anda berhasil direkam." };
  } catch (err) {
    return { success: false, message: "Kesalahan sistem: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function getRiwayatAbsensi(nta, bulan) {
  var sheet = getActiveSpreadsheet().getSheetByName("absensi");
  var data = sheet.getDataRange().getValues();
  var list = [];
  var role = getRoleByNta(nta);
  
  for (var i = 1; i < data.length; i++) {
    var rNta = data[i][1].toString().trim();
    var rTanggal = data[i][3];
    var rowDateObj = (rTanggal instanceof Date) ? rTanggal : new Date(rTanggal);
    var formattedRowMonth = (rowDateObj.getMonth() + 1).toString();
    if (formattedRowMonth.length < 2) formattedRowMonth = "0" + formattedRowMonth;
    var rowMonthYear = rowDateObj.getFullYear() + "-" + formattedRowMonth;
    
    if (role === "Admin" || role === "Pembina" || rNta === nta.toString().trim()) {
      if (!bulan || rowMonthYear === bulan) {
        list.push({
          id_absen: data[i][0],
          nta: data[i][1],
          nama: data[i][2],
          tanggal: (data[i][3] instanceof Date) ? getFormattedDate(data[i][3]) : data[i][3],
          jam: data[i][4],
          keterangan: data[i][5],
          foto_selfie: data[i][6] ? getFotoUrlFromId(data[i][6]) : "",
          id_kegiatan: data[i][7],
          verifikator_nta: data[i][8],
          verifikator_nama: data[i][9],
          lokasi: data[i][10]
        });
      }
    }
  }
  return { success: true, data: list.reverse() };
}

function getAbsensiHariIni(idKegiatan) {
  var sheet = getActiveSpreadsheet().getSheetByName("absensi");
  var data = sheet.getDataRange().getValues();
  var list = [];
  var todayStr = getFormattedDate(new Date());
  
  for (var i = 1; i < data.length; i++) {
    var rTanggal = data[i][3];
    var rIdKeg = data[i][7].toString().trim();
    var rowDateStr = (rTanggal instanceof Date) ? getFormattedDate(rTanggal) : rTanggal.toString().trim();
    
    if (rowDateStr === todayStr && (!idKegiatan || rIdKeg === idKegiatan.toString().trim())) {
      list.push({
        id_absen: data[i][0],
        nta: data[i][1],
        nama: data[i][2],
        tanggal: rowDateStr,
        jam: data[i][4],
        keterangan: data[i][5],
        foto_selfie: data[i][6] ? getFotoUrlFromId(data[i][6]) : "",
        id_kegiatan: data[i][7],
        verifikator_nta: data[i][8],
        verifikator_nama: data[i][9],
        lokasi: data[i][10]
      });
    }
  }
  return { success: true, data: list };
}

function validasiQRPetugas(qrString) {
  var user = getDataProfil(qrString);
  if (user && (user.role === "Admin" || user.role === "Pembina" || user.role === "Dewan")) {
    return { success: true, user: user };
  }
  return { success: false, message: "QR Code ini bukan milik Petugas verifikator sah." };
}

function cekDuplikatAbsen(nta, tanggal, idKegiatan) {
  var sheet = getActiveSpreadsheet().getSheetByName("absensi");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowNta = data[i][1].toString().trim();
    var rowTanggal = data[i][3];
    var rowIdKeg = data[i][7].toString().trim();
    
    var formattedRowDate = (rowTanggal instanceof Date) ? getFormattedDate(rowTanggal) : rowTanggal.toString().trim();
    var formattedCheckDate = (tanggal instanceof Date) ? getFormattedDate(tanggal) : tanggal.toString().trim();
    
    if (rowNta === nta.toString().trim() && formattedRowDate === formattedCheckDate && rowIdKeg === idKegiatan.toString().trim()) {
      return true;
    }
  }
  return false;
}

// --- KEGIATAN (CRUD) ---

function getAllKegiatan() {
  var sheet = getActiveSpreadsheet().getSheetByName("kegiatan");
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var photoIds = [];
    try {
      photoIds = JSON.parse(data[i][10]);
    } catch(e){}
    var photoUrls = photoIds.map(function(id) {
      return getFotoUrlFromId(id);
    });
    
    list.push({
      id_kegiatan: data[i][0],
      nama_kegiatan: data[i][1],
      deskripsi: data[i][2],
      tanggal_mulai: (data[i][3] instanceof Date) ? getFormattedDate(data[i][3]) : data[i][3],
      tanggal_selesai: (data[i][4] instanceof Date) ? getFormattedDate(data[i][4]) : data[i][4],
      jam: data[i][5],
      lokasi: data[i][6],
      wajib_verifikasi_qr: data[i][7],
      penanggung_jawab: data[i][8],
      status: data[i][9],
      foto_urls: photoUrls,
      foto_ids: photoIds,
      created_by: data[i][11]
    });
  }
  return { success: true, data: list };
}

function tambahKegiatan(dataKegiatan, fotoArray, ntaPelaku) {
  var role = getRoleByNta(ntaPelaku);
  if (role === "Penggalang" || role === "") {
    return { success: false, message: "Akses ditolak." };
  }
  if (!fotoArray || fotoArray.length < 2) {
    return { success: false, message: "Error: Wajib mengunggah minimal 2 foto kegiatan!" };
  }
  
  var uploadedPhotoIds = [];
  try {
    for (var i = 0; i < fotoArray.length; i++) {
      if (!validasiUkuranFotoServer(fotoArray[i])) {
        return { success: false, message: "Gagal: Salah satu ukuran file foto melebihi 500KB." };
      }
      var photoId = uploadFotoToBase64Storage(fotoArray[i], "Kegiatan_" + Date.now() + "_" + i + ".jpg", "SIAP_Kegiatan_Foto");
      uploadedPhotoIds.push(photoId);
    }
    
    var sheet = getActiveSpreadsheet().getSheetByName("kegiatan");
    var idKegiatan = generateUniqueId("KEG");
    sheet.appendRow([
      idKegiatan,
      dataKegiatan.nama_kegiatan,
      dataKegiatan.deskripsi,
      dataKegiatan.tanggal_mulai,
      dataKegiatan.tanggal_selesai,
      dataKegiatan.jam,
      dataKegiatan.lokasi,
      dataKegiatan.wajib_verifikasi_qr ? "YA" : "TIDAK",
      dataKegiatan.penanggung_jawab,
      dataKegiatan.status || "Aktif",
      JSON.stringify(uploadedPhotoIds),
      ntaPelaku,
      new Date(),
      "",
      ""
    ]);
    
    catatLog(ntaPelaku, "Tambah Kegiatan", "KEGIATAN", "Membuat kegiatan baru: " + dataKegiatan.nama_kegiatan);
    return { success: true, message: "Agenda kegiatan baru berhasil disimpan." };
  } catch (e) {
    uploadedPhotoIds.forEach(function(id) { hapusFotoDrive(id); });
    return { success: false, message: "Gagal menyimpan agenda: " + e.toString() };
  }
}

function editKegiatan(idKegiatan, dataKegiatan, fotoArrayBaru, ntaPelaku) {
  var role = getRoleByNta(ntaPelaku);
  if (role === "Penggalang" || role === "") {
    return { success: false, message: "Akses ditolak." };
  }
  
  var sheet = getActiveSpreadsheet().getSheetByName("kegiatan");
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === idKegiatan.toString()) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) return { success: false, message: "Agenda kegiatan tidak ditemukan." };
  
  var currentPhotosJson = data[rowIndex-1][10];
  var currentPhotos = [];
  try {
    currentPhotos = JSON.parse(currentPhotosJson);
  } catch(e) {}
  
  var uploadedPhotoIds = [];
  try {
    if (fotoArrayBaru && fotoArrayBaru.length > 0) {
      for (var f = 0; f < fotoArrayBaru.length; f++) {
        if (!validasiUkuranFotoServer(fotoArrayBaru[f])) {
          return { success: false, message: "Salah satu file foto berukuran lebih dari 500KB." };
        }
        var photoId = uploadFotoToBase64Storage(fotoArrayBaru[f], "Kegiatan_" + Date.now() + "_" + f + ".jpg", "SIAP_Kegiatan_Foto");
        uploadedPhotoIds.push(photoId);
      }
    }
    
    var finalPhotos = currentPhotos.concat(uploadedPhotoIds);
    if (dataKegiatan.foto_dihapus) {
      var toDelete = dataKegiatan.foto_dihapus; 
      finalPhotos = finalPhotos.filter(function(id) {
        if (toDelete.indexOf(id) > -1) {
          hapusFotoDrive(id);
          return false;
        }
        return true;
      });
    }
    
    if (finalPhotos.length < 2) {
      uploadedPhotoIds.forEach(function(id) { hapusFotoDrive(id); });
      return { success: false, message: "Error: Kegiatan wajib menyimpan minimal 2 foto!" };
    }
    
    sheet.getRange(rowIndex, 2).setValue(dataKegiatan.nama_kegiatan);
    sheet.getRange(rowIndex, 3).setValue(dataKegiatan.deskripsi);
    sheet.getRange(rowIndex, 4).setValue(dataKegiatan.tanggal_mulai);
    sheet.getRange(rowIndex, 5).setValue(dataKegiatan.tanggal_selesai);
    sheet.getRange(rowIndex, 6).setValue(dataKegiatan.jam);
    sheet.getRange(rowIndex, 7).setValue(dataKegiatan.lokasi);
    sheet.getRange(rowIndex, 8).setValue(dataKegiatan.wajib_verifikasi_qr ? "YA" : "TIDAK");
    sheet.getRange(rowIndex, 9).setValue(dataKegiatan.penanggung_jawab);
    sheet.getRange(rowIndex, 10).setValue(dataKegiatan.status || "Aktif");
    sheet.getRange(rowIndex, 11).setValue(JSON.stringify(finalPhotos));
    sheet.getRange(rowIndex, 14).setValue(ntaPelaku);
    sheet.getRange(rowIndex, 15).setValue(new Date());
    
    catatLog(ntaPelaku, "Edit Kegiatan", "KEGIATAN", "Memperbarui data kegiatan: " + dataKegiatan.nama_kegiatan);
    return { success: true, message: "Data kegiatan berhasil diperbarui." };
  } catch (e) {
    return { success: false, message: "Pembaruan gagal: " + e.toString() };
  }
}

function hapusKegiatan(idKegiatan, ntaPelaku) {
  var role = getRoleByNta(ntaPelaku);
  if (role !== "Admin") {
    return { success: false, message: "Akses ditolak. Fitur khusus Administrator." };
  }
  
  var sheet = getActiveSpreadsheet().getSheetByName("kegiatan");
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  var photosToDeleteJson = "";
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === idKegiatan.toString()) {
      rowIndex = i + 1;
      photosToDeleteJson = data[i][10];
      break;
    }
  }
  if (rowIndex === -1) return { success: false, message: "Kegiatan tidak ditemukan." };
  
  try {
    var photos = JSON.parse(photosToDeleteJson);
    photos.forEach(function(id) {
      hapusFotoDrive(id);
    });
  } catch(e){}
  
  sheet.deleteRow(rowIndex);
  catatLog(ntaPelaku, "Hapus Kegiatan", "KEGIATAN", "Menghapus kegiatan dengan ID: " + idKegiatan);
  return { success: true, message: "Agenda kegiatan berhasil dihapus." };
}

function getDetailKegiatan(idKegiatan) {
  var list = getAllKegiatan().data;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id_kegiatan.toString() === idKegiatan.toString()) {
      return { success: true, data: list[i] };
    }
  }
  return { success: false, message: "Kegiatan tidak ditemukan." };
}

// --- INVENTARIS (CRUD) ---

function getAllInventaris(filter, ntaPelaku) {
  var role = getRoleByNta(ntaPelaku);
  if (role === "Penggalang" || role === "") {
    return { success: false, message: "Akses ditolak." };
  }
  
  var sheet = getActiveSpreadsheet().getSheetByName("inventaris");
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    list.push({
      id_barang: data[i][0],
      nama_barang: data[i][1],
      kategori: data[i][2],
      jumlah: data[i][3],
      satuan: data[i][4],
      kondisi: data[i][5],
      lokasi_simpan: data[i][6],
      keterangan: data[i][7]
    });
  }
  return { success: true, data: list };
}

function tambahInventaris(dataBarang, ntaPelaku) {
  var role = getRoleByNta(ntaPelaku);
  if (role === "Penggalang" || role === "") {
    return { success: false, message: "Akses ditolak." };
  }
  
  var sheet = getActiveSpreadsheet().getSheetByName("inventaris");
  var idBarang = generateUniqueId("INV");
  sheet.appendRow([
    idBarang,
    dataBarang.nama_barang,
    dataBarang.kategori,
    dataBarang.jumlah,
    dataBarang.satuan,
    dataBarang.kondisi,
    dataBarang.lokasi_simpan,
    dataBarang.keterangan || "",
    ntaPelaku,
    new Date()
  ]);
  
  catatLog(ntaPelaku, "Tambah Barang", "INVENTARIS", "Menambahkan barang gudang: " + dataBarang.nama_barang);
  return { success: true, message: "Aset barang baru berhasil disimpan." };
}

function editInventaris(idBarang, dataBarang, ntaPelaku) {
  var role = getRoleByNta(ntaPelaku);
  if (role === "Penggalang" || role === "") {
    return { success: false, message: "Akses ditolak." };
  }
  
  var sheet = getActiveSpreadsheet().getSheetByName("inventaris");
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === idBarang.toString()) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) return { success: false, message: "Barang tidak ditemukan." };
  
  sheet.getRange(rowIndex, 2).setValue(dataBarang.nama_barang);
  sheet.getRange(rowIndex, 3).setValue(dataBarang.kategori);
  sheet.getRange(rowIndex, 4).setValue(dataBarang.jumlah);
  sheet.getRange(rowIndex, 5).setValue(dataBarang.satuan);
  sheet.getRange(rowIndex, 6).setValue(dataBarang.kondisi);
  sheet.getRange(rowIndex, 7).setValue(dataBarang.lokasi_simpan);
  sheet.getRange(rowIndex, 8).setValue(dataBarang.keterangan || "");
  sheet.getRange(rowIndex, 9).setValue(ntaPelaku);
  sheet.getRange(rowIndex, 10).setValue(new Date());
  
  catatLog(ntaPelaku, "Edit Barang", "INVENTARIS", "Mengubah data aset barang: " + dataBarang.nama_barang);
  return { success: true, message: "Data barang inventaris berhasil diupdate." };
}

function hapusInventaris(idBarang, ntaPelaku) {
  var role = getRoleByNta(ntaPelaku);
  if (role !== "Admin") {
    return { success: false, message: "Akses ditolak. Fitur khusus Administrator." };
  }
  
  var sheet = getActiveSpreadsheet().getSheetByName("inventaris");
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === idBarang.toString()) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) return { success: false, message: "Barang tidak ditemukan." };
  
  sheet.deleteRow(rowIndex);
  catatLog(ntaPelaku, "Hapus Barang", "INVENTARIS", "Menghapus barang dengan ID: " + idBarang);
  return { success: true, message: "Barang berhasil dihapus." };
}

function updateStokBarang(idBarang, jumlahBaru) {
  var sheet = getActiveSpreadsheet().getSheetByName("inventaris");
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === idBarang.toString()) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) return { success: false, message: "Barang tidak ditemukan." };
  sheet.getRange(rowIndex, 4).setValue(jumlahBaru);
  return { success: true, message: "Stok barang berhasil diperbarui." };
}

// --- USER PROFILE ---

function getDataProfil(nta) {
  var sheet = getActiveSpreadsheet().getSheetByName("users");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === nta.toString().trim()) {
      return {
        nta: data[i][0],
        nama: data[i][1],
        role: data[i][3],
        kelas_regu: data[i][4],
        jenis_kelamin: data[i][5],
        foto_profil: data[i][6] ? getFotoUrlFromId(data[i][6]) : "",
        foto_profil_id: data[i][6] || "",
        no_hp: data[i][7],
        status_aktif: data[i][8]
      };
    }
  }
  return null;
}

function updateProfil(nta, dataBaru) {
  var sheet = getActiveSpreadsheet().getSheetByName("users");
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === nta.toString().trim()) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) return { success: false, message: "User tidak ditemukan." };
  
  if (dataBaru.foto_profil_base64) {
    if (!validasiUkuranFotoServer(dataBaru.foto_profil_base64)) {
      return { success: false, message: "Ukuran foto profil melebihi batas 500KB." };
    }
    var oldFileId = data[rowIndex-1][6];
    if (oldFileId) hapusFotoDrive(oldFileId);
    
    var fileId = uploadFotoToBase64Storage(dataBaru.foto_profil_base64, "Profil_" + nta + ".jpg", "SIAP_Profil");
    sheet.getRange(rowIndex, 7).setValue(fileId);
  }
  
  sheet.getRange(rowIndex, 2).setValue(dataBaru.nama);
  sheet.getRange(rowIndex, 5).setValue(dataBaru.kelas_regu);
  sheet.getRange(rowIndex, 6).setValue(dataBaru.jenis_kelamin);
  sheet.getRange(rowIndex, 8).setValue(dataBaru.no_hp);
  
  catatLog(nta, "Update Profil", "PROFIL", "Memperbarui profil diri.");
  return { success: true, message: "Perubahan profil berhasil disimpan!" };
}

function generateQRDataString(nta) {
  return nta.toString();
}

// --- FILE STORAGE (GOOGLE DRIVE) ---

function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    var newFolder = DriveApp.createFolder(folderName);
    newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return newFolder;
  }
}

function uploadFotoToBase64Storage(base64String, namaFile, folderTujuan) {
  var parts = base64String.split(",");
  var contentType = parts[0].split(";")[0].split(":")[1];
  var rawData = parts[1];
  var decoded = Utilities.base64Decode(rawData);
  var blob = Utilities.newBlob(decoded, contentType, namaFile);
  
  var folder = getOrCreateFolder(folderTujuan);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getId();
}

function hapusFotoDrive(fileId) {
  if (!fileId) return false;
  try {
    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return true;
  } catch (e) {
    return false;
  }
}

function getFotoUrlFromId(fileId) {
  if (!fileId) return "";
  return "https://docs.google.com/uc?export=view&id=" + fileId;
}

function validasiUkuranFotoServer(base64String) {
  if (!base64String) return true;
  var parts = base64String.split(",");
  var rawData = parts.length > 1 ? parts[1] : parts[0];
  var sizeInBytes = (rawData.length * 3) / 4;
  if (rawData.endsWith("==")) sizeInBytes -= 2;
  else if (rawData.endsWith("=")) sizeInBytes -= 1;
  return sizeInBytes <= 500 * 1024; // Maksimal 500 KB
}

// --- REPORT EXPORTS (ADMIN ONLY) ---

function exportKegiatanToExcel(filterTanggal, ntaPelaku) {
  var role = getRoleByNta(ntaPelaku);
  if (role !== "Admin") return { success: false, message: "Akses ditolak." };
  
  var ss = SpreadsheetApp.create("Export_Kegiatan_" + Date.now());
  var sheet = ss.getSheets()[0];
  sheet.appendRow(["ID Kegiatan", "Nama Kegiatan", "Deskripsi", "Mulai", "Selesai", "Jam", "Lokasi", "PJ", "Status"]);
  
  var list = getAllKegiatan().data;
  list.forEach(function(k) {
    sheet.appendRow([k.id_kegiatan, k.nama_kegiatan, k.deskripsi, k.tanggal_mulai, k.tanggal_selesai, k.jam, k.lokasi, k.penanggung_jawab, k.status]);
  });
  
  SpreadsheetApp.flush();
  var fileId = ss.getId();
  var file = DriveApp.getFileById(fileId);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  var url = "https://docs.google.com/spreadsheets/d/" + fileId + "/export?format=xlsx";
  catatLog(ntaPelaku, "Export Excel", "KEGIATAN", "Mengekspor kegiatan ke file Excel");
  return { success: true, url: url };
}

function exportKegiatanToPDF(filterTanggal, ntaPelaku) {
  var role = getRoleByNta(ntaPelaku);
  if (role !== "Admin") return { success: false, message: "Akses ditolak." };
  
  var list = getAllKegiatan().data;
  var html = "<html><head><style>table {width:100%; border-collapse:collapse;} th,td {border:1px solid #ddd; padding:8px;} th {background:#6F4E37; color:white;}</style></head><body>";
  html += "<h2>Laporan Daftar Kegiatan Pramuka</h2>";
  html += "<table><thead><tr><th>ID</th><th>Nama Kegiatan</th><th>Deskripsi</th><th>Tanggal</th><th>Lokasi</th><th>Status</th></tr></thead><tbody>";
  list.forEach(function(k) {
    html += "<tr><td>" + k.id_kegiatan + "</td><td>" + k.nama_kegiatan + "</td><td>" + k.deskripsi + "</td><td>" + k.tanggal_mulai + " - " + k.tanggal_selesai + "</td><td>" + k.lokasi + "</td><td>" + k.status + "</td></tr>";
  });
  html += "</tbody></table></body></html>";
  
  var blob = Utilities.newBlob(html, "text/html", "Laporan_Kegiatan.html");
  var pdfBlob = blob.getAs("application/pdf").setName("Laporan_Kegiatan_" + Date.now() + ".pdf");
  
  var folder = getOrCreateFolder("SIAP_Reports");
  var file = folder.createFile(pdfBlob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  catatLog(ntaPelaku, "Export PDF", "KEGIATAN", "Mengekspor kegiatan ke file PDF");
  return { success: true, url: file.getUrl() };
}

function exportInventarisToExcel(ntaPelaku) {
  var role = getRoleByNta(ntaPelaku);
  if (role !== "Admin") return { success: false, message: "Akses ditolak." };
  
  var ss = SpreadsheetApp.create("Export_Inventaris_" + Date.now());
  var sheet = ss.getSheets()[0];
  sheet.appendRow(["ID Barang", "Nama Barang", "Kategori", "Jumlah", "Satuan", "Kondisi", "Lokasi Simpan", "Keterangan"]);
  
  var res = getAllInventaris("", ntaPelaku);
  if (res.success) {
    res.data.forEach(function(b) {
      sheet.appendRow([b.id_barang, b.nama_barang, b.kategori, b.jumlah, b.satuan, b.kondisi, b.lokasi_simpan, b.keterangan]);
    });
  }
  
  SpreadsheetApp.flush();
  var fileId = ss.getId();
  var file = DriveApp.getFileById(fileId);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  var url = "https://docs.google.com/spreadsheets/d/" + fileId + "/export?format=xlsx";
  catatLog(ntaPelaku, "Export Excel", "INVENTARIS", "Mengekspor inventaris ke file Excel");
  return { success: true, url: url };
}

function exportInventarisToPDF(ntaPelaku) {
  var role = getRoleByNta(ntaPelaku);
  if (role !== "Admin") return { success: false, message: "Akses ditolak." };
  
  var res = getAllInventaris("", ntaPelaku);
  var list = res.success ? res.data : [];
  
  var html = "<html><head><style>table {width:100%; border-collapse:collapse;} th,td {border:1px solid #ddd; padding:8px;} th {background:#6F4E37; color:white;}</style></head><body>";
  html += "<h2>Laporan Inventaris Gudang Pramuka</h2>";
  html += "<table><thead><tr><th>ID</th><th>Nama Barang</th><th>Kategori</th><th>Jumlah</th><th>Kondisi</th><th>Lokasi Simpan</th></tr></thead><tbody>";
  list.forEach(function(b) {
    html += "<tr><td>" + b.id_barang + "</td><td>" + b.nama_barang + "</td><td>" + b.kategori + "</td><td>" + b.jumlah + " " + b.satuan + "</td><td>" + b.kondisi + "</td><td>" + b.lokasi_simpan + "</td></tr>";
  });
  html += "</tbody></table></body></html>";
  
  var blob = Utilities.newBlob(html, "text/html", "Laporan_Inventaris.html");
  var pdfBlob = blob.getAs("application/pdf").setName("Laporan_Inventaris_" + Date.now() + ".pdf");
  
  var folder = getOrCreateFolder("SIAP_Reports");
  var file = folder.createFile(pdfBlob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  catatLog(ntaPelaku, "Export PDF", "INVENTARIS", "Mengekspor inventaris ke file PDF");
  return { success: true, url: file.getUrl() };
}

// --- LOGGING ---

function catatLog(nta, aksi, modul, detail) {
  try {
    var sheet = getActiveSpreadsheet().getSheetByName("log");
    var idLog = generateUniqueId("LOG");
    var userProfil = getDataProfil(nta);
    var namaUser = userProfil ? userProfil.nama : (nta === "Admin" ? "Administrator" : "Sistem");
    
    sheet.appendRow([
      idLog,
      nta,
      namaUser,
      aksi,
      modul,
      detail,
      new Date(),
      "Sistem Web Browser"
    ]);
  } catch(e) {}
}

function getLogAktivitas(nta, filterRole) {
  var sheet = getActiveSpreadsheet().getSheetByName("log");
  var data = sheet.getDataRange().getValues();
  var list = [];
  var role = getRoleByNta(nta);
  
  for (var i = 1; i < data.length; i++) {
    var logNta = data[i][1].toString().trim();
    if (role === "Admin" || role === "Pembina" || logNta === nta.toString().trim()) {
      list.push({
        id_log: data[i][0],
        nta: data[i][1],
        nama: data[i][2],
        aksi: data[i][3],
        modul: data[i][4],
        detail: data[i][5],
        timestamp: (data[i][6] instanceof Date) ? getFormattedDate(data[i][6]) + " " + getFormattedTime(data[i][6]) : data[i][6],
        ip_device_info: data[i][7]
      });
    }
  }
  return { success: true, data: list.reverse() };
}

// --- UTILITIES ---

function getActiveSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function generateUniqueId(prefix) {
  return prefix + "_" + Math.random().toString(36).substr(2, 9).toUpperCase();
}

function getFormattedDate(dateObj) {
  var d = new Date(dateObj);
  var month = '' + (d.getMonth() + 1);
  var day = '' + d.getDate();
  var year = d.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
}

function getFormattedTime(dateObj) {
  var d = new Date(dateObj);
  var hh = d.getHours().toString();
  var mm = d.getMinutes().toString();
  var ss = d.getSeconds().toString();
  if (hh.length < 2) hh = '0' + hh;
  if (mm.length < 2) mm = '0' + mm;
  if (ss.length < 2) ss = '0' + ss;
  return hh + ":" + mm + ":" + ss;
}

function getRoleByNta(nta) {
  var sheet = getActiveSpreadsheet().getSheetByName("users");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === nta.toString().trim()) {
      return data[i][3].toString();
    }
  }
  return "";
}
