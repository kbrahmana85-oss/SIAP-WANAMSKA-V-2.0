// =========================================================================
// [GAME-POTENSI] GAME GAMIFIKASI "KENALI POTENSIMU" — SKU PENGGALANG
// -------------------------------------------------------------------------
// - Materi: SKU Penggalang (Ramu / Rakit / Terap) — media belajar di rumah.
// - Kunci jawaban TIDAK berada di file ini (diperiksa server, anti-curang).
// - Progres tersimpan server-side: layar ditutup / HP terkunci -> bisa
//   melanjutkan kapan saja; soal yang sudah dijawab tidak bisa diulang.
// - Dipanggil dari script.js: PotensiGame.init() saat membuka section.
"use strict";

const POTENSI_GOLONGAN = {
  ramu:  { label: "Ramu",  sub: "Tingkat 1 • Dasar",   ikon: "🏕️", warna: "#2e7d32", warna2: "#66bb6a" },
  rakit: { label: "Rakit", sub: "Tingkat 2 • Menengah", ikon: "🧭", warna: "#1565c0", warna2: "#42a5f5" },
  terap: { label: "Terap", sub: "Tingkat 3 • Lanjutan", ikon: "⛰️", warna: "#6a1b9a", warna2: "#ab47bc" }
};

const POTENSI_LEVELS = {
  ramu: [
    { id: "ramu-1", judul: "Pondasi Kepramukaan",   ikon: "🏕️", soal: ["rm1a", "rm1b", "rm1c", "rm1d", "rm1e"] },
    { id: "ramu-2", judul: "Dasa Dharma & Trisatya", ikon: "⭐", soal: ["rm2a", "rm2b", "rm2c", "rm2d", "rm2e"] },
    { id: "ramu-3", judul: "Keterampilan Dasar",     ikon: "🪢", soal: ["rm3a", "rm3b", "rm3c", "rm3d", "rm3e"] }
  ],
  rakit: [
    { id: "rakit-1", judul: "Melangkah Lebih Jauh",   ikon: "🎯", soal: ["rk1a", "rk1b", "rk1c", "rk1d", "rk1e"] },
    { id: "rakit-2", judul: "Tali-Temali & Pionering", ikon: "🛠️", soal: ["rk2a", "rk2b", "rk2c", "rk2d", "rk2e"] },
    { id: "rakit-3", judul: "Navigasi & Survival",     ikon: "🌲", soal: ["rk3a", "rk3b", "rk3c", "rk3d", "rk3e"] }
  ],
  terap: [
    { id: "terap-1", judul: "Pionering Lanjut",     ikon: "🗼", soal: ["rt1a", "rt1b", "rt1c", "rt1d", "rt1e"] },
    { id: "terap-2", judul: "Berkemah & ZIP",       ikon: "⛺", soal: ["rt2a", "rt2b", "rt2c", "rt2d", "rt2e"] },
    { id: "terap-3", judul: "Kepemimpinan & Sandi", ikon: "👑", soal: ["rt3a", "rt3b", "rt3c", "rt3d", "rt3e"] }
  ]
};

// Bank soal — TANPA kunci jawaban (kunci hanya di code.gs server)
const POTENSI_SOAL = {
  rm1a: { t: "Siapa tokoh dunia yang mencetuskan gerakan kepanduan yang menjadi cikal bakal pramuka?", o: { a: "Julius Caesar", b: "Lord Robert Baden-Powell", c: "Ki Hajar Dewantara", d: "Napoleon Bonaparte" } },
  rm1b: { t: "Gerakan Pramuka Indonesia resmi berdiri pada tanggal?", o: { a: "14 Agustus 1961", b: "17 Agustus 1945", c: "20 Mei 1908", d: "28 Oktober 1928" } },
  rm1c: { t: "Makna tiga jari yang tegak pada Salam Pramuka adalah?", o: { a: "Tiga golongan pramuka", b: "Tiga pahlawan nasional", c: "Tri Satya (tiga janji Penggalang)", d: "Tiga pilar negara" } },
  rm1d: { t: "Motto Gerakan Pramuka Indonesia adalah?", o: { a: "\u201CSatyaku Kudarmakan, Darmaku Kubaktikan\u201D", b: "\u201CBhinneka Tunggal Ika\u201D", c: "\u201CTut Wuri Handayani\u201D", d: "\u201CJalesveva Jayamahe\u201D" } },
  rm1e: { t: "Makna warna putih pada bendera Sang Saka Merah Putih bagi seorang pramuka adalah?", o: { a: "Keberanian menghadapi tantangan", b: "Kemurnian sikap, ucapan, dan perbuatan", c: "Kesuburan alam Indonesia", d: "Persatuan seluruh rakyat" } },
  rm2a: { t: "Berapa jumlah janji pada Dasa Dharma Pramuka?", o: { a: "10", b: "12", c: "8", d: "5" } },
  rm2b: { t: "\u201CAmanah pada tanggung jawab dan dapat dipercaya dalam segala tugas\u201D adalah isi Dasa Dharma nomor?", o: { a: "3", b: "8", c: "10", d: "1" } },
  rm2c: { t: "Tiga janji Penggalang yang diucapkan saat pelantikan disebut?", o: { a: "Trisatya", b: "Dasa Dharma", c: "Dasasila", d: "Tridarma" } },
  rm2d: { t: "Dasa Dharma nomor 5 berbunyi?", o: { a: "\u201CDisiplin, pilihan, dan setia dalam satuan/karya\u201D", b: "\u201CRajin, terampil, dan gembira\u201D", c: "\u201CHemat, cermat, dan bersahabat\u201D", d: "\u201CPatriot yang sopan dan kesatria\u201D" } },
  rm2e: { t: "Satu regu Penggalang umumnya beranggota?", o: { a: "2\u20133 orang", b: "15\u201320 orang", c: "6\u20138 orang", d: "25\u201330 orang" } },
  rm3a: { t: "Simpul yang dibuat di ujung tali agar tali tidak terurai disebut?", o: { a: "Simpul mati", b: "Simpul pangkal", c: "Simpul hidup", d: "Simpul jangkar" } },
  rm3b: { t: "Simpul yang dipakai untuk mengikat benda atau tongkat dan tidak mudah lepas adalah?", o: { a: "Simpul pangkal", b: "Simpul anyam", c: "Simpul mati", d: "Simpul jangkar" } },
  rm3c: { t: "Alat penunjuk arah yang jarumnya selalu mengarah ke utara adalah?", o: { a: "Barometer", b: "Kompas", c: "Termometer", d: "Peta pita" } },
  rm3d: { t: "Perbedaan utama bendera morse dan semaphore adalah?", o: { a: "Morse berwarna merah semua, semaphore putih semua", b: "Semaphore dipakai malam, morse dipakai siang", c: "Tidak ada perbedaan keduanya", d: "Morse satu bendera dengan pola titik-garis, semaphore dua bendera dengan posisi lengan" } },
  rm3e: { t: "Cara sederhana menjernihkan air keruh saat berkemah adalah?", o: { a: "Disaring lalu dididihkan beberapa menit", b: "Langsung diminum agar cepat", c: "Diberi campuran gula dan garam", d: "Disimpan dalam botol tertutup semalam" } },
  rk1a: { t: "Urutan tingkatan kecakapan umum (SKU) Penggalang dari awal adalah?", o: { a: "Ramu, Rakit, Terap", b: "Rakit, Ramu, Terap", c: "Terap, Rakit, Ramu", d: "Purwa, Madya, Utama" } },
  rk1b: { t: "Peta yang digambar dengan garis mengikuti jarak tanah lengkap dengan tanda keterangan perjalanan disebut?", o: { a: "Peta dunia", b: "Peta pita", c: "Peta negara", d: "Denah kamar" } },
  rk1c: { t: "Lebar sungai dapat ditaksir menggunakan rumus perbandingan?", o: { a: "Segitiga siku-siku", b: "Lingkaran", c: "Persegi", d: "Tabung" } },
  rk1d: { t: "P3K singkatan dari?", o: { a: "Pertolongan Perawatan Khusus Kesehatan", b: "Persatuan Pertolongan Keluarga", c: "Pertolongan Pertama Pada Kecelakaan", d: "Pusat Perawatan Korban Keadaan" } },
  rk1e: { t: "Tanda darurat internasional dalam morse (tiga titik, tiga garis, tiga titik) dibaca?", o: { a: "MAYDAY", b: "SOS", c: "HELP", d: "TOLONG" } },
  rk2a: { t: "Ikatan untuk menyatukan dua tongkat yang bersilangan membentuk huruf X adalah?", o: { a: "Ikatan silang", b: "Ikatan palang", c: "Ikatan paralel", d: "Ikatan canggah" } },
  rk2b: { t: "Ikatan untuk menyambung dua tongkat yang sejajar (berdampingan) adalah?", o: { a: "Ikatan silang", b: "Ikatan mati", c: "Ikatan paralel", d: "Simpul pangkal" } },
  rk2c: { t: "Simpul yang kuat menahan tarikan dari segala arah dan dipakai mengikat tali pada tiang besar adalah?", o: { a: "Simpul jangkar", b: "Simpul mati", c: "Simpul hidup", d: "Simpul pangkal" } },
  rk2d: { t: "Nama tongkat kayu panjang yang menjadi alat utama pionering pramuka?", o: { a: "Londa", b: "Tongkat pramuka (staf)", c: "Beton", d: "Pion" } },
  rk2e: { t: "Tali pramuka dengan panjang sekitar 10 meter disebut?", o: { a: "Tali beton", b: "Tali mini", c: "Tali roda", d: "Tali londa" } },
  rk3a: { t: "Metode menaksir tinggi pohon dengan bantuan tongkat dan perbandingan bayangan disebut metode?", o: { a: "Klik", b: "Lansera", c: "Morse", d: "Peta pita" } },
  rk3b: { t: "Pada kompas, jarum yang berwarna merah selalu menunjuk arah?", o: { a: "Selatan", b: "Timur", c: "Utara", d: "Barat" } },
  rk3c: { t: "Perlakuan pertama yang benar pada luka terbuka adalah?", o: { a: "Hentikan pendarahan, bersihkan dengan air bersih, tutup dengan perban", b: "Diolesi minyak goreng", c: "Ditaburi tanah halus", d: "Dibiarkan terbuka hingga kering sendiri" } },
  rk3d: { t: "Tanda minta tolong universal di alam terbuka ditandai dengan angka?", o: { a: "Satu", b: "Lima", c: "Tujuh", d: "Tiga" } },
  rk3e: { t: "Jika tersesat di hutan, tindakan yang benar sesuai prinsip STOP adalah?", o: { a: "Berlari mencari jalan keluar secepatnya", b: "Berhenti, berpikir tenang, amati, lalu susun rencana", c: "Terus berjalan mengikuti arah matahari terbenam", d: "Mengikuti jejak binatang buas" } },
  rt1a: { t: "Ikatan yang dipakai menyambung dua tongkat memanjang menjadi lebih panjang (untuk tiang menara) adalah?", o: { a: "Ikatan palang", b: "Ikatan paralel", c: "Ikatan canggah", d: "Simpul mati" } },
  rt1b: { t: "Tali yang dipakai untuk membuat jembatan satu tali karena panjangnya sekitar 10 meter adalah?", o: { a: "Tali londa", b: "Tali beton", c: "Tali roda", d: "Tali kur" } },
  rt1c: { t: "Hal pertama yang harus diperiksa sebelum mendirikan konstruksi pionering adalah?", o: { a: "Warna tali sesuai tema", b: "Keutuhan tongkat, kekuatan tali dan simpul, serta kekokohan tanah", c: "Cuaca hari besok", d: "Jumlah penonton yang datang" } },
  rt1d: { t: "Teknik mengencangkan tali konstruksi tanpa alat khusus disebut?", o: { a: "Simpul mati", b: "Ikatan canggah", c: "Semaphore", d: "Putar tali (rope tackle)" } },
  rt1e: { t: "Setiap konstruksi pionering besar harus?", o: { a: "Dibiarkan tanpa pengawasan", b: "Diawasi Pembina dan diuji kekuatannya bertahap", c: "Dinaiki seluruh regu sekaligus", d: "Dibangun tanpa perencanaan" } },
  rt2a: { t: "ZIP dalam standar perkemahan singkatan dari?", o: { a: "Zona Isi Pusat", b: "Ziarah Inti Pramuka", c: "Zona Inti Perkemahan", d: "Zona Induk Penggalang" } },
  rt2b: { t: "Lokasi perkemahan yang ideal adalah?", o: { a: "Tanah datar dan kering, dekat air bersih, aman dari bahaya", b: "Di tengah jalur aliran air hujan", c: "Di bawah pohon tua yang rapat", d: "Di tepi jurang yang curam" } },
  rt2c: { t: "Fungsi menggali parit resapan di sekeliling tenda adalah?", o: { a: "Membuat tembok alami", b: "Menyalurkan air hujan agar tidak menggenangi tenda", c: "Tempat meletakkan sandal", d: "Mempercepat mendirikan tenda" } },
  rt2d: { t: "Prinsip yang benar saat menutup kegiatan perkemahan (meninggalkan lokasi)?", o: { a: "Meninggalkan sampah sebagai tanda pernah berkemah", b: "Membiarkan parit terbuka", c: "Meninggalkan tempat lebih bersih dan menghapus jejak kemah", d: "Membawa pulang tanah lokasi kemah" } },
  rt2e: { t: "Pertemuan besar pramuka tingkat nasional yang diselenggarakan berkala disebut?", o: { a: "Rapat kerja daerah", b: "Lomba tingkat", c: "Persami", d: "Jambore nasional" } },
  rt3a: { t: "Urutan aba-aba baris-berbaris yang benar adalah?", o: { a: "Aba-aba gerak lalu aba-aba persiapan", b: "Aba-aba persiapan lalu aba-aba gerak (contoh: \u201Chadap kanan \u2014 PUS\u201D)", c: "Aba-aba boleh dibalik sesuka hati", d: "Hanya aba-aba akhir saja" } },
  rt3b: { t: "Sikap pemimpin regu ketika anggota berbeda pendapat adalah?", o: { a: "Memilih pendapatnya sendiri", b: "Memilih suara yang paling keras", c: "Memimpin musyawarah untuk mufakat", d: "Mengabaikan semua pendapat" } },
  rt3c: { t: "Sandi kreasi pribadi wajib dilengkapi dengan?", o: { a: "Kunci sandi", b: "Bendera merah", c: "Kompas", d: "Stempel regu" } },
  rt3d: { t: "Berita semaphore diterima dengan cara?", o: { a: "Mendengarkan bunyi peluit", b: "Meraba getaran tanah", c: "Menunggu asap api", d: "Membaca posisi sudut lengan pengirim" } },
  rt3e: { t: "Tingkat penghargaan tertinggi bagi golongan Penggalang adalah?", o: { a: "TKK Madya", b: "Pramuka Garuda", c: "Penegak Bantara", d: "Tamu Penggalang" } }
};

// [GAME-POTENSI] BEKAL SINGKAT — materi mini sebelum kuis agar pemain MEMAHAMI
// materi pramuka, bukan sekadar menebak. Tampil saat masuk level (bisa dilewati).
const POTENSI_BEKAL = {
  "ramu-1": [
    "Kepramukaan dunia dirintis <b>Lord Robert Baden-Powell (BP)</b>: perkemahan percobaan di Pulau Brownsea (1907) dan buku <i>Scouting for Boys</i>.",
    "Gerakan Pramuka Indonesia resmi berdiri <b>14 Agustus 1961</b> melalui SK Presiden No. 234/1961 — itulah Hari Pramuka.",
    "Salam Pramuka: <b>tiga jari tegak</b> = Tri Satya; ibu jari dan kelingking bertemu = <i>yang kuat melindungi yang lemah</i> (persaudaraan).",
    "Motto: <b>\u201CSatyaku Kudarmakan, Darmaku Kubaktikan\u201D</b>. Merah = keberanian, putih = kemurnian sikap, ucapan, dan perbuatan."
  ],
  "ramu-2": [
    "<b>Dasa Dharma</b> = 10 janji sikap hidup pramuka. Nomor 1: Takwa kepada Tuhan Yang Maha Esa; nomor 9: Suci pikiran, perkataan, perbuatan.",
    "<b>Trisatya</b> = tiga janji Penggalang yang diucapkan saat pelantikan: menyanggupi Dasasila & Kode Kehormatan, memelihara Dasa Dharma, melaksanakan Tridarma.",
    "DD no. 5: <b>Rajin, terampil, dan gembira</b>. DD no. 8: <b>Amanah pada tanggung jawab dan dapat dipercaya</b>.",
    "Satu <b>regu</b> berisi 6–8 Penggalang, dipimpin Pimpinan Regu (PR) dan Wakil PR; beberapa regu membentuk <b>pasukan</b>."
  ],
  "ramu-3": [
    "<b>Simpul pangkal</b> dibuat di ujung tali agar tidak terurai; <b>simpul mati</b> untuk mengikat benda/tongkat.",
    "<b>Simpul hidup (mandel)</b> mudah dibuka setelah dipakai — cocok untuk menambat hewan.",
    "<b>Kompas</b>: jarum berwarna merah selalu menunjuk <b>utara</b>; pegang mendatar agar akurat.",
    "<b>Morse</b> = satu bendera, pola titik & garis. <b>Semaphore</b> = dua bendera, posisi sudut lengan. Air keruh: <b>disaring lalu dididihkan</b> 3–5 menit."
  ],
  "rakit-1": [
    "Tingkatan SKU Penggalang: <b>Ramu → Rakit → Terap</b>, lalu penghargaan tertinggi <b>Pramuka Garuda</b>.",
    "<b>Peta pita</b>: peta garis mengikuti panjang jalan, bertanda sungai/bangunan, digulung saat berjalanan.",
    "Lebar sungai ditaksir dengan <b>perbandingan segitiga siku-siku</b>: ukur jarak di darat = lebar sungai.",
    "<b>P3K</b> = Pertolongan Pertama Pada Kecelakaan. <b>SOS</b> = ... --- ... (tanda darurat internasional morse)."
  ],
  "rakit-2": [
    "<b>Ikatan silang</b>: dua tongkat bersilangan (X). <b>Ikatan palang</b>: tongkat sejajar. <b>Ikatan canggah</b>: menyambung tongkat memanjang.",
    "<b>Simpul jangkar</b>: mengikat tali pada tiang/benda besar, kuat dari segala arah, mudah dilepas.",
    "<b>Tongkat pramuka (staf)</b>: panjang ± sejajar tinggi hidung; alat utama pionering.",
    "<b>Tali londa</b> ± 10 meter (jembatan, ikatan besar); <b>tali beton</b> lebih pendek (± 4–5 m)."
  ],
  "rakit-3": [
    "<b>Metode lansera</b>: menaksir tinggi pohon dengan tongkat & perbandingan bayangan (segitiga).",
    "Kompas: <b>merah menunjuk utara</b> — dasar navigasi berjalanan.",
    "Luka terbuka: <b>hentikan pendarahan → bersihkan air bersih → tutup perban</b>. Jangan olesi sembarang zat.",
    "Tanda minta tolong = <b>tiga</b> (api, asap, teriakan). Tersesat → prinsip <b>STOP</b>: Stop, Think, Observe, Plan."
  ],
  "terap-1": [
    "Konstruksi besar dibangun dengan <b>ikatan canggah</b> (menyambung tiang) + <b>ikatan silang</b> (mempertautkan silangan).",
    "<b>Jembatan satu tali</b>: tali londa + simpul jangkar pada tiang penyangga; jembatan ganda = tali kaki + tali pegangan.",
    "Sebelum dibangun: periksa <b>tongkat (tidak retak), tali & simpul, kekokohan tanah</b> — keselamatan nomor satu.",
    "<b>Putar tali (rope tackle)</b>: mengencangkan tali tanpa alat khusus agar konstruksi kaku dan kuat."
  ],
  "terap-2": [
    "<b>ZIP (Zona Inti Perkemahan)</b>: standar tata letak kemah dari Kwarnas — tenda, dapur umum, air bersih, sanitasi, lapangan upacara.",
    "Lokasi ideal: tanah <b>datar & kering</b>, dekat air bersih, jauh dari pohon tua/jalur air/sarang binatang berbisa.",
    "<b>Parit resapan</b> digali keliling tenda agar air hujan tidak menggenangi lantai.",
    "Prinsip meninggalkan lokasi: <b>lebih bersih dari sebelumnya</b> — hapus jejak kemah (DD no. 6 mencintai alam)."
  ],
  "terap-3": [
    "Aba-aba: <b>persiapan lalu gerak</b> — contoh \u201Chadap kanan, <b>PUS</b>\u201D; suara jelas, sikap benar.",
    "Pemimpin baik <b>memimpin musyawarah untuk mufakat</b>, mendengar seluruh anggota (DD no. 3).",
    "Sandi kreasi wajib punya <b>kunci sandi</b> agar pesan bisa diterjemahkan teman.",
    "Semaphore: penerima membalas <b>huruf K (oke)</b> bila siap; membaca posisi sudut lengan pengirim. <b>Pramuka Garuda</b> = penghargaan tertinggi Penggalang."
  ]
};

// [GAME-POTENSI] PANGKAT game — gelar kepramukaan sesuai total poin (0–1000)
const POTENSI_PANGKAT = [
  { min: 1000, nama: "Penggalang Hebat", ikon: "🌟" },
  { min: 750, nama: "Penggalang Terap",  ikon: "⛰️" },
  { min: 500, nama: "Penggalang Rakit",  ikon: "🧭" },
  { min: 250, nama: "Penggalang Ramu",   ikon: "🏕️" },
  { min: 0,   nama: "Tamu Penggalang",   ikon: "🌱" }
];

// =========================================================================
// === ENGINE GAME                                                        ===
// =========================================================================
const PotensiGame = (() => {
  let progres = {};      // { golongan: { qid: {k,b,p} } }
  let golAktif = null;   // golongan yang sedang dimainkan
  let quiz = null;       // { levelId, daftar:[qid], pos, skrg }
  let dimuat = false;
  let statusFolder = null; // [v3.6.3] { aktif, folder_url, admin }
  let streak = 0;        // [FX] jawaban benar beruntun

  // ---------------- EFEK: SUARA, KONFETI, PANGKAT ----------------
  let audioCtx = null;
  function suaraAktif() { try { return localStorage.getItem('pg_suara') !== '0'; } catch (e) { return true; } }
  function beep(freq, mulai, lama, tipe) {
    if (!suaraAktif()) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = tipe || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + mulai);
      g.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + mulai + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + mulai + lama);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(audioCtx.currentTime + mulai); o.stop(audioCtx.currentTime + mulai + lama + 0.05);
    } catch (e) {}
  }
  function bunyiBenar()  { beep(660, 0, .12); beep(880, .12, .18); }
  function bunyiSalah()  { beep(220, 0, .22, 'sawtooth'); }
  function bunyiTuntas() { [523, 659, 784, 1047].forEach((f, i) => beep(f, i * .14, .2)); }

  function konfeti() {
    try {
      const ov = $('pg-overlay');
      if (!ov) return;
      const wadah = document.createElement('div');
      wadah.className = 'pg-konfeti';
      const potongan = ['🎉', '⭐', '🎊', '🟡', '🟢', '✨'];
      for (let i = 0; i < 36; i++) {
        const s = document.createElement('span');
        s.textContent = potongan[Math.floor(Math.random() * potongan.length)];
        s.style.left = Math.random() * 100 + '%';
        s.style.animationDelay = (Math.random() * 0.9) + 's';
        s.style.fontSize = (12 + Math.random() * 14) + 'px';
        wadah.appendChild(s);
      }
      ov.appendChild(wadah);
      setTimeout(() => wadah.remove(), 4000);
    } catch (e) {}
  }

  function totalPoin() {
    return Object.keys(POTENSI_GOLONGAN).reduce((a, g) => a + statistik(g).poin, 0);
  }
  function pangkatSekarang() {
    const p = totalPoin();
    return POTENSI_PANGKAT.find(x => p >= x.min) || POTENSI_PANGKAT[POTENSI_PANGKAT.length - 1];
  }
  function toggleSuara() {
    const baru = suaraAktif() ? '0' : '1';
    try { localStorage.setItem('pg_suara', baru); } catch (e) {}
    const btn = $('pg-btn-suara');
    if (btn) btn.textContent = baru === '1' ? '🔊' : '🔇';
    if (baru === '1') beep(880, 0, .1);
  }

  function $(id) { return document.getElementById(id); }

  function pct(n, d) { return d > 0 ? Math.round((n / d) * 100) : 0; }

  function statistik(g) {
    const all = POTENSI_LEVELS[g].flatMap(L => L.soal);
    const jw = progres[g] || {};
    let benar = 0, poin = 0, dijawab = 0;
    all.forEach(q => {
      const r = jw[q];
      if (r) { dijawab++; poin += (r.p || 0); if (r.b === 1) benar++; }
    });
    // [v3.7.0] agregat arena soal tak terbatas (poin terus bertambah)
    const A = jw._arena;
    if (A) { poin += (A.poin || 0); benar += (A.benar || 0); dijawab += (A.dijawab || 0); }
    return { total: all.length, dijawab, benar, poin, nilai: Math.min(100, pct(poin, all.length * 10)) };
  }

  function levelSelesai(g, L) {
    const jw = progres[g] || {};
    return L.soal.every(q => jw[q]);
  }

  function levelTerbuka(g, idx) {
    if (idx === 0) return true;
    return levelSelesai(g, POTENSI_LEVELS[g][idx - 1]);
  }

  function bintang(nilai) {
    if (nilai >= 100) return "⭐⭐⭐";
    if (nilai >= 70) return "⭐⭐";
    if (nilai >= 50) return "⭐";
    return "☆";
  }

  // ---------------- LAUNCHER ----------------
  async function init() {
    if (!sessionToken) return;
    const grid = $('pg-golongan-grid');
    // [v3.6.3] Gerbang aktivasi: game baru berjalan setelah Admin membuka folder
    // [v3.6.4] cache:false -> status selalu segar; game LANGSUNG muncul setelah aktivasi
    try {
      statusFolder = await callAPI('getPotensiFolderStatus', [sessionToken], { cache: false });
    } catch (err) {
      if (grid) grid.innerHTML = `<p class="pg-error">Gagal memeriksa status game: ${escapeHtml(err.message)}</p>`;
      return;
    }
    if (!statusFolder || !statusFolder.aktif) { renderGerbangAktivasi(); return; }
    try {
      const res = await callAPI('getPotensiGameProgres', [sessionToken]);
      progres = (res && res.progres) || {};
      dimuat = true;
    } catch (err) {
      if (grid) grid.innerHTML = `<p class="pg-error">Gagal memuat progres game: ${escapeHtml(err.message)}</p>`;
      return;
    }
    // [v3.6.2] Tombol pantauan & [v3.8.0] bank soal hanya untuk Admin
    const btnPantau = $('pg-btn-pantau');
    if (btnPantau && typeof userRole !== 'undefined' && userRole === 'Admin') btnPantau.style.display = 'inline-block';
    const btnBank = $('pg-btn-bank');
    if (btnBank && typeof userRole !== 'undefined' && userRole === 'Admin') btnBank.style.display = 'inline-block';
    renderLauncher();
  }

  // [v3.6.3] Layar gerbang: Admin = tombol aktivasi; pengguna lain = menunggu Admin
  function renderGerbangAktivasi() {
    const grid = $('pg-golongan-grid');
    if (!grid) return;
    const isAdmin = statusFolder && statusFolder.admin;
    const urlFolder = statusFolder && statusFolder.folder_url ? statusFolder.folder_url : '#';
    if (isAdmin) {
      grid.innerHTML = `
        <div class="pg-gerbang">
          <div class="pg-gerbang-ikon">🔓</div>
          <h3>Aktifkan Game Kenali Potensimu</h3>
          <p>Game baru dapat dimainkan setelah Admin <b>membuka Folder Materi</b> di Google Drive.
          Tekan tombol di bawah: subfolder <i>Ramu, Rakit, Terap</i> disiapkan otomatis, lalu folder terbuka.</p>
          <button class="btn pg-btn-main" id="pg-btn-aktifkan" onclick="PotensiGame.aktifkanLewatFolder()">🔓 Buka Folder &amp; Aktifkan Game</button>
          <p class="pg-catatan">Aktivasi hanya sekali — setelah ini game langsung berjalan untuk semua pengguna.
          <br>Folder: <a class="pg-link-folder" href="${urlFolder}" target="_blank" rel="noopener">${urlFolder}</a></p>
        </div>`;
    } else {
      grid.innerHTML = `
        <div class="pg-gerbang pg-gerbang-tunggu">
          <div class="pg-gerbang-ikon">⏳</div>
          <h3>Game Belum Diaktifkan</h3>
          <p>Fitur <b>Kenali Potensimu</b> baru bisa dimainkan setelah <b>Admin</b> membuka Folder Materi game.
          Silakan hubungi Admin untuk mengaktifkannya.</p>
        </div>`;
    }
  }

  async function aktifkanLewatFolder() {
    const btn = $('pg-btn-aktifkan');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyiapkan folder...'; }
    try {
      const res = await callAPI('aktifkanPotensiLewatFolder', [sessionToken], { cache: false });
      // [v3.6.4] Pastikan status & cache segar lalu game LANGSUNG tampil
      if (typeof clearAPICache === 'function') clearAPICache();
      statusFolder = statusFolder || {};
      statusFolder.aktif = true;
      const grid = $('pg-golongan-grid');
      const dibuat = res && res.dibuat && res.dibuat.length ? res.dibuat.join(', ') : 'sudah ada sebelumnya';
      grid.innerHTML = `
        <div class="pg-gerbang" id="pg-aktif-sukses">
          <div class="pg-gerbang-ikon">✅</div>
          <h3>Game Aktif!</h3>
          <p>Subfolder materi siap (${escapeHtml(dibuat)}). Game akan terbuka otomatis sesaat lagi...</p>
          <a class="btn pg-btn-secondary pg-link-folder" href="${(res && res.folder_url) || '#'}" target="_blank" rel="noopener">📁 Buka Folder Materi di Drive — unggah file materi di sini</a><br><br>
          <button class="btn pg-btn-main" onclick="PotensiGame.init()">🎮 Mulai Game Sekarang</button>
        </div>`;
      // Tampil otomatis: tunggu 2,5 detik (kesempatan membuka link Drive), lalu muat game
      setTimeout(() => { if (document.getElementById('pg-aktif-sukses')) init(); }, 2500);
    } catch (err) {
      const grid = $('pg-golongan-grid');
      if (grid) grid.innerHTML = `<p class="pg-error">Gagal mengaktifkan: ${escapeHtml(err.message)}</p><br><button class="btn pg-btn-secondary" onclick="PotensiGame.init()">↻ Coba Lagi</button>`;
    }
  }

  function renderLauncher() {
    const grid = $('pg-golongan-grid');
    if (!grid) return;
    const pk = pangkatSekarang();
    const tp = totalPoin();
    const berikut = POTENSI_PANGKAT.find(x => x.min > tp);
    const menuju = berikut
      ? `<div class="pg-pangkat-menuju">${berikut.ikon} ${berikut.min - tp} poin lagi menuju <b>${berikut.nama}</b></div>`
      : `<div class="pg-pangkat-menuju">🏅 Pangkat tertinggi game tercapai — luar biasa!</div>`;
    grid.innerHTML = `
      <div class="pg-pangkat-banner">
        <span class="pg-pangkat-ikon">${pk.ikon}</span>
        <div class="pg-pangkat-info"><small>Pangkatmu saat ini</small><h3>${pk.nama}</h3>${menuju}</div>
        <div class="pg-pangkat-poin"><b>${tp}</b><span>total poin</span></div>
      </div>` + Object.keys(POTENSI_GOLONGAN).map(g => {
      const info = POTENSI_GOLONGAN[g];
      const s = statistik(g);
      const persen = pct(s.dijawab, s.total);
      return `
      <div class="pg-gol-card" style="--pg-c1:${info.warna}; --pg-c2:${info.warna2};">
        <div class="pg-gol-head"><span class="pg-gol-ikon">${info.ikon}</span>
          <div><h3>Penggalang ${info.label}</h3><small>${info.sub}</small></div>
        </div>
        <div class="pg-gol-stat"><div><b>${s.poin}</b><span>poin</span></div><div><b>${s.dijawab}/${s.total}</b><span>soal</span></div><div><b>${s.nilai}</b><span>nilai</span></div></div>
        <div class="pg-bar"><div class="pg-bar-fill" style="width:${persen}%;"></div></div>
        <button class="btn pg-btn-main" onclick="PotensiGame.buka('${g}')">${persen > 0 ? '▶ Lanjutkan' : '▶ Mainkan'}</button>
      </div>`;
    }).join("");
  }

  // ---------------- OVERLAY / FULLSCREEN ----------------
  function layarPenuhOn() {
    const el = $('pg-overlay');
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (fn) { try { fn.call(el); } catch (e) {} }
  }
  function layarPenuhOff() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn && (document.fullscreenElement || document.webkitFullscreenElement)) {
      try { fn.call(document); } catch (e) {}
    }
  }

  function buka(g) {
    golAktif = g;
    const ov = $('pg-overlay');
    ov.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    layarPenuhOn();
    const sb = $('pg-btn-suara');
    if (sb) sb.textContent = suaraAktif() ? '🔊' : '🔇';
    renderPetaLevel();
  }

  function tutup() {
    layarPenuhOff();
    $('pg-overlay').style.display = 'none';
    document.body.style.overflow = '';
    quiz = null;
    renderLauncher(); // segarkan statistik kartu
  }

  // ---------------- PETA LEVEL ----------------
  function renderPetaLevel() {
    const g = golAktif, info = POTENSI_GOLONGAN[g];
    const s = statistik(g);
    quiz = null;
    $('pg-topbar-judul').textContent = `Game Kenali Potensimu — Penggalang ${info.label}`;
    $('pg-body').innerHTML = `
      <div class="pg-peta-head">
        <div class="pg-peta-ringkas">${info.ikon} Poin <b>${s.poin}</b> • Soal terjawab <b>${s.dijawab}/${s.total}</b> • Nilai <b>${s.nilai}</b></div>
        <div class="pg-bar"><div class="pg-bar-fill" style="width:${pct(s.dijawab, s.total)}%;"></div></div>
      </div>
      <div class="pg-level-grid">
        ${POTENSI_LEVELS[g].map((L, i) => {
          const selesai = levelSelesai(g, L);
          const terbuka = levelTerbuka(g, i);
          const nilai = selesai ? nilaiLevel(g, L) : 0;
          return `
          <div class="pg-level-card ${terbuka ? '' : 'pg-terkunci'}" onclick="${terbuka ? `PotensiGame.mulaiLevel('${L.id}')` : ''}">
            <div class="pg-level-ikon">${terbuka ? L.ikon : '🔒'}</div>
            <h4>Level ${i + 1}: ${L.judul}</h4>
            <small>${L.soal.length} soal • ${selesai ? `Nilai <b>${nilai}</b> ${bintang(nilai)}` : (terbuka ? 'Siap dimainkan!' : 'Selesaikan level sebelumnya')}</small>
            ${terbuka ? `<button class="btn pg-btn-main">${selesai ? '🔄 Lihat Ulang' : '▶ Mulai'}</button>` : ''}
          </div>`;
        }).join("")}
      </div>
      <div class="pg-peta-aksi">
        <button class="btn pg-btn-secondary" onclick="PotensiGame.bukaMateri()">📖 Materi ${info.label}</button>
        ${POTENSI_LEVELS[g].every(L => levelSelesai(g, L))
          ? '<button class="btn pg-btn-main" style="width:auto;" onclick="PotensiGame.mulaiArena(&quot;&quot;)">♾️ Arena Soal Tak Terbatas — Soal Baru!</button>'
          : `<small style="opacity:.8;">♾️ Arena soal tak terbatas terbuka setelah ke-3 level selesai</small>`}
      </div>
      <p class="pg-catatan">🔒 Anti-curang: jawaban diperiksa di server. 💾 Progres otomatis tersimpan — layar tertutup/terkunci pun bisa dilanjutkan kapan saja.</p>`;
  }

  function nilaiLevel(g, L) {
    const jw = progres[g] || {};
    const poin = L.soal.reduce((a, q) => a + ((jw[q] && jw[q].p) || 0), 0);
    return pct(poin, L.soal.length * 10);
  }

  // ---------------- KUIS ----------------
  function mulaiLevel(levelId) {
    const g = golAktif;
    const L = POTENSI_LEVELS[g].find(x => x.id === levelId);
    if (!L) return;
    const jw = progres[g] || {};
    const sisa = L.soal.filter(q => !jw[q]);
    if (sisa.length === 0) { renderHasil(L, true); return; }
    quiz = { level: L, daftar: sisa, pos: 0 };
    streak = 0;
    renderBekal();
  }

  // [FX] Bekal singkat: materi mini sebelum kuis agar pemain memahami materi
  function renderBekal() {
    const g = golAktif;
    const bekal = POTENSI_BEKAL[quiz.level.id] || [];
    $('pg-topbar-judul').textContent = `Bekal: ${quiz.level.judul} — Penggalang ${POTENSI_GOLONGAN[g].label}`;
    $('pg-body').innerHTML = `
      <div class="pg-bekal">
        <h3>📖 Bekal Singkat: ${quiz.level.ikon} ${quiz.level.judul}</h3>
        <p class="pg-bekal-sub">Baca dulu sebentar — nanti gampang menjawabnya!</p>
        <ul>${bekal.map(b => `<li>${b}</li>`).join("")}</ul>
        <div class="pg-bekal-aksi">
          <button class="btn pg-btn-main" onclick="PotensiGame.mulaiKuisDariBekal()">⚡ Aku Siap, Mulai Kuis!</button>
        </div>
      </div>`;
  }

  function mulaiKuisDariBekal() { renderSoal(); }

  function renderSoal() {
    const g = golAktif;
    const soal = POTENSI_SOAL[quiz.daftar[quiz.pos]];
    // Acak urutan tampilan opsi (kunci tetap berdasarkan huruf internal)
    const kunci = Object.keys(soal.o);
    for (let i = kunci.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kunci[i], kunci[j]] = [kunci[j], kunci[i]];
    }
    $('pg-topbar-judul').textContent = `Level: ${quiz.level.judul} — Penggalang ${POTENSI_GOLONGAN[g].label}`;
    $('pg-body').innerHTML = `
      <div class="pg-quiz-progress">Soal ${quiz.pos + 1} dari ${quiz.daftar.length} <span id="pg-streak" class="pg-streak">${streak >= 2 ? `🔥 ${streak}x beruntun!` : ''}</span><span class="pg-quiz-poin">+10 poin per jawaban benar</span></div>
      <div class="pg-bar"><div class="pg-bar-fill" style="width:${pct(quiz.pos, quiz.daftar.length)}%;"></div></div>
      <div class="pg-kartu-soal">
        <p class="pg-soal-teks">${escapeHtml(soal.t)}</p>
        <div class="pg-opsi">
          ${kunci.map(k => `<button class="pg-opsi" data-key="${k}" onclick="PotensiGame.jawab('${k}')">${escapeHtml(soal.o[k])}</button>`).join("")}
        </div>
        <div id="pg-umpan-balik"></div>
      </div>
      <p class="pg-catatan">💾 Layar tertutup? Tenang, progres tersimpan otomatis dan bisa dilanjutkan.</p>`;
  }

  async function jawab(pilihKey) {
    const g = golAktif;
    const qid = quiz.daftar[quiz.pos];
    const tombol = document.querySelectorAll('.pg-opsi');
    tombol.forEach(b => { b.disabled = true; if (b.dataset.key === pilihKey) b.classList.add('pg-dipilih'); });
    const fb = $('pg-umpan-balik');
    fb.innerHTML = `<p class="pg-memeriksa">⏳ Memeriksa jawaban...</p>`;
    try {
      const res = await callAPI('savePotensiJawab', [sessionToken, g, qid, pilihKey]);
      if (!progres[g]) progres[g] = {};
      progres[g][qid] = { k: pilihKey, b: res.benar ? 1 : 0, p: res.poin_didapat };
      if (res.benar) { streak++; bunyiBenar(); } else { streak = 0; bunyiSalah(); }
      const st = $('pg-streak');
      if (st) st.textContent = streak >= 2 ? `🔥 ${streak}x beruntun!` : '';
      tombol.forEach(b => {
        if (b.dataset.key === res.kunci) b.classList.add('pg-benar');
        else if (b.dataset.key === pilihKey && !res.benar) b.classList.add('pg-salah');
      });
      const terakhir = quiz.pos === quiz.daftar.length - 1;
      fb.innerHTML = `
        <div class="pg-verdik ${res.benar ? 'pg-verdik-benar' : 'pg-verdik-salah'}">
          ${res.benar ? `✅ Benar! +${res.poin_didapat} poin` : '❌ Belum tepat — tidak apa-apa, ini media belajar!'}
        </div>
        <div class="pg-pembahasan"><b>📖 Pembahasan:</b> ${escapeHtml(res.pembahasan)}</div>
        <button class="btn pg-btn-main" onclick="PotensiGame.${terakhir ? 'selesaiLevel' : 'lanjut'}()">${terakhir ? '🏁 Lihat Hasil' : 'Lanjut ▶'}</button>`;
    } catch (err) {
      fb.innerHTML = `<p class="pg-error">Gagal memeriksa: ${escapeHtml(err.message)} — coba pilih lagi.</p>`;
      tombol.forEach(b => { b.disabled = false; b.classList.remove('pg-dipilih'); });
    }
  }

  function lanjut() { quiz.pos++; renderSoal(); }

  function selesaiLevel() {
    renderHasil(quiz.level, false);
  }

  // ---------------- HASIL LEVEL ----------------
  function renderHasil(L, dariPeta) {
    quiz = null;
    const g = golAktif;
    const jw = progres[g] || {};
    const benar = L.soal.filter(q => jw[q] && jw[q].b === 1).length;
    const nilai = nilaiLevel(g, L);
    bunyiTuntas();
    if (nilai >= 70) konfeti();
    const tp = totalPoin();
    const pk = pangkatSekarang();
    const berikut = POTENSI_PANGKAT.find(x => x.min > tp);
    const infoPk = berikut
      ? `${berikut.ikon} ${berikut.min - tp} poin lagi menuju <b>${berikut.nama}</b>`
      : '🏅 Pangkat tertinggi game tercapai — hebat sekali!';
    const idx = POTENSI_LEVELS[g].findIndex(x => x.id === L.id);
    const next = POTENSI_LEVELS[g][idx + 1];
    $('pg-topbar-judul').textContent = `Hasil Level ${idx + 1}: ${L.judul}`;
    $('pg-body').innerHTML = `
      <div class="pg-hasil">
        <div class="pg-hasil-medali">${bintang(nilai)}</div>
        <h3>${L.ikon} Level ${idx + 1}: ${L.judul}</h3>
        <div class="pg-hasil-nilai">${nilai}</div>
        <p>Nilai kamu • Benar ${benar} dari ${L.soal.length} soal</p>
        ${nilai >= 70 ? '<p class="pg-pujian">Hebat! Kamu siap naik ke materi berikutnya 🎉</p>' : '<p class="pg-pujian">Terus belajar lewat materi di bawah, lalu buktikan lagi! 💪</p>'}
        <p class="pg-pangkat-menuju">${pk.ikon} Pangkatmu: <b>${pk.nama}</b> (${tp} poin) • ${infoPk}</p>
        <div class="pg-hasil-aksi">
          <button class="btn pg-btn-secondary" onclick="PotensiGame.kembaliPeta()">🗺️ Peta Level</button>
          <button class="btn pg-btn-secondary" onclick="PotensiGame.mulaiArena('${L.id}')">♾️ Main Ulang Level Ini — Soal Baru</button>
          ${next ? `<button class="btn pg-btn-main" onclick="PotensiGame.mulaiLevel('${next.id}')">▶ Level Berikut: ${next.judul}</button>` : '<button class="btn pg-btn-main" onclick="PotensiGame.kembaliPeta()">🏁 Golongan ini tuntas!</button>'}
        </div>
      </div>`;
  }

  function kembaliPeta() { renderPetaLevel(); }

  // ---------------- ARENA SOAL TAK TERBATAS [v3.7.0] ----------------
  let arena = null; // { ke }

  async function mulaiArena(levelId) {
    arena = { ke: 0, level: String(levelId || "") };
    await muatArenaSoal();
  }

  async function muatArenaSoal() {
    const g = golAktif;
    const body = $('pg-body');
    body.innerHTML = `<p class="pg-memeriksa">⏳ Menyiapkan soal baru dari server...</p>`;
    try {
      const s = await callAPI('getPotensiSoalAcak', [sessionToken, g, arena.level], { cache: false });
      arena.ke++;
      renderArenaSoal(s);
    } catch (err) {
      body.innerHTML = `<p class="pg-error">${escapeHtml(err.message)}</p><br><div style="text-align:center;"><button class="btn pg-btn-secondary" onclick="PotensiGame.kembaliPeta()">🗺️ Kembali</button> <button class="btn pg-btn-main" style="width:auto;" onclick="PotensiGame.mulaiArena(PotensiGame.levelArenaAktif())">↻ Coba Lagi</button></div>`;
    }
  }

  function renderArenaSoal(s) {
    const g = golAktif;
    $('pg-topbar-judul').textContent = `♾️ Arena Tak Terbatas — Penggalang ${POTENSI_GOLONGAN[g].label}`;
    $('pg-body').innerHTML = `
      <div class="pg-quiz-progress">${arena.level ? `♾️ Arena Level ${arena.level} — ` : '♾️ Arena Golongan — '}Soal ke-${arena.ke} <span id="pg-streak" class="pg-streak">${streak >= 2 ? `🔥 ${streak}x beruntun!` : ''}</span><span class="pg-quiz-poin">+10 poin • kejar 1000!</span></div>
      <div class="pg-bar"><div class="pg-bar-fill" style="width:100%;"></div></div>
      <div class="pg-kartu-soal">
        <p class="pg-soal-teks">${escapeHtml(s.t)}</p>
        <div class="pg-opsi-wrap">
          ${['a', 'b', 'c', 'd'].map(k => `<button class="pg-opsi" data-key="${k}" onclick="PotensiGame.jawabArena('${s.qid}','${k}')">${escapeHtml(s.o[k])}</button>`).join("")}
        </div>
        <div id="pg-umpan-balik"></div>
      </div>
      <p class="pg-catatan">♾️ Setiap soal selalu baru — jawab terus untuk menaikkan poin &amp; pangkat. <button class="pg-topbar-btn" onclick="PotensiGame.kembaliPeta()">🏁 Berhenti &amp; Kembali</button></p>`;
  }

  async function jawabArena(qid, pilihKey) {
    const g = golAktif;
    const tombol = document.querySelectorAll('.pg-opsi');
    tombol.forEach(b => { b.disabled = true; if (b.dataset.key === pilihKey) b.classList.add('pg-dipilih'); });
    const fb = $('pg-umpan-balik');
    fb.innerHTML = `<p class="pg-memeriksa">⏳ Memeriksa jawaban...</p>`;
    try {
      const res = await callAPI('savePotensiJawab', [sessionToken, g, qid, pilihKey], { cache: false });
      if (!progres[g]) progres[g] = {};
      const A = progres[g]._arena || (progres[g]._arena = { dijawab: 0, benar: 0, poin: 0 });
      A.dijawab++; if (res.benar) A.benar++; A.poin += (res.poin_didapat || 0);
      if (res.benar) { streak++; bunyiBenar(); } else { streak = 0; bunyiSalah(); }
      const st = $('pg-streak');
      if (st) st.textContent = streak >= 2 ? `🔥 ${streak}x beruntun!` : '';
      tombol.forEach(b => {
        if (b.dataset.key === res.kunci) b.classList.add('pg-benar');
        else if (b.dataset.key === pilihKey && !res.benar) b.classList.add('pg-salah');
      });
      const tp = totalPoin(); const pk = pangkatSekarang();
      const bx = POTENSI_PANGKAT.find(x => x.min > tp);
      fb.innerHTML = `
        <div class="pg-verdik ${res.benar ? 'pg-verdik-benar' : 'pg-verdik-salah'}">${res.benar ? `✅ Benar! +${res.poin_didapat} poin` : '❌ Belum tepat — coba soal berikutnya!'}</div>
        <div class="pg-pembahasan"><b>📖 Pembahasan:</b> ${escapeHtml(res.pembahasan || '-')}</div>
        <div class="pg-pangkat-menuju" style="text-align:center; margin-bottom:10px;">${pk.ikon} Total <b>${tp}</b> poin • ${bx ? `${bx.min - tp} poin lagi menuju <b>${bx.nama}</b>` : 'Pangkat tertinggi tercapai!'}</div>
        <button class="btn pg-btn-main" onclick="PotensiGame.soalBerikutnya()">Soal Berikutnya ▶</button>`;
    } catch (err) {
      fb.innerHTML = `<p class="pg-error">${escapeHtml(err.message)}</p>`;
      tombol.forEach(b => { b.disabled = false; b.classList.remove('pg-dipilih'); });
    }
  }

  function soalBerikutnya() { muatArenaSoal(); }

  // ---------------- MATERI DRIVE ----------------
  async function bukaMateri() {
    const g = golAktif, info = POTENSI_GOLONGAN[g];
    const box = $('pg-materi-isi');
    $('pg-materi-judul').textContent = `📖 Materi Penggalang ${info.label}`;
    box.innerHTML = `<p class="pg-memeriksa">⏳ Mengambil daftar materi dari Drive...</p>`;
    $('pg-modal-materi').style.display = 'flex';
    try {
      const res = await callAPI('getPotensiMateriList', [sessionToken, g]);
      if (!res.files || res.files.length === 0) {
        box.innerHTML = `<p class="pg-catatan">${escapeHtml(res.pesan || 'Belum ada file materi.')}</p>
        <p class="pg-catatan">ℹ️ Cara menyiapkan: buka folder Drive milik gudep, buat subfolder berisi kata <b>${info.label}</b> (contoh: <i>Materi ${info.label}</i>), lalu unggah file materi ke dalamnya.</p>`;
        return;
      }
      box.innerHTML = `<ul class="pg-materi-daftar">` + res.files.map((f, i) =>
        `<li><a href="${f.url}" target="_blank" rel="noopener">📄 ${escapeHtml(f.nama)}</a></li>`
      ).join("") + `</ul>`;
    } catch (err) {
      box.innerHTML = `<p class="pg-error">${escapeHtml(err.message)}</p>`;
    }
  }

  function tutupMateri() { $('pg-modal-materi').style.display = 'none'; }

  // ---------------- PAPAN SKOR ----------------
  async function bukaPapanSkor() {
    const box = $('pg-papan-isi');
    $('pg-modal-papan').style.display = 'flex';
    box.innerHTML = `<p class="pg-memeriksa">⏳ Mengambil papan skor...</p>`;
    try {
      const daftar = await callAPI('getPotensiPapanSkor', [sessionToken]);
      if (!daftar || daftar.length === 0) {
        box.innerHTML = `<p class="pg-catatan">Belum ada yang bermain. Jadilah yang pertama! 🚀</p>`;
        return;
      }
      const medali = ['🥇', '🥈', '🥉'];
      box.innerHTML = `<table class="pg-papan-tabel"><thead><tr><th>#</th><th>Nama</th><th>Poin</th><th>Benar</th></tr></thead><tbody>` +
        daftar.map((d, i) => `<tr class="${d.user_id === userId ? 'pg-baris-aku' : ''}"><td>${medali[i] || (i + 1)}</td><td>${escapeHtml(d.nama)}</td><td><b>${d.total_skor}</b></td><td>${d.jumlah_benar}/${d.jumlah_soal}</td></tr>`).join("") +
        `</tbody></table>`;
    } catch (err) {
      box.innerHTML = `<p class="pg-error">${escapeHtml(err.message)}</p>`;
    }
  }

  function tutupPapanSkor() { $('pg-modal-papan').style.display = 'none'; }

  // ---------------- PANTAUAN ADMIN (sheet "potensi") ----------------
  async function bukaPantau() {
    const box = $('pg-pantau-isi');
    $('pg-modal-pantau').style.display = 'flex';
    box.innerHTML = `<p class="pg-memeriksa">⏳ Menyusun rekap kemampuan siswa...</p>`;
    try {
      const res = await callAPI('getPotensiMonitor', [sessionToken]);
      const daftar = (res && res.list) || [];
      if (daftar.length === 0) {
        box.innerHTML = `<p class="pg-catatan">Belum ada data pengerjaan game. Rekap otomatis terisi setelah siswa mulai bermain.</p>`;
        return;
      }
      box.innerHTML = `
        <p class="pg-catatan" style="text-align:left;">Rekap sama persis tersimpan di sheet <b>potensi</b> (Google Sheet gudep) — siap dipantau kapan saja.</p>
        <div style="overflow-x:auto;"><table class="pg-papan-tabel">
          <thead><tr><th>#</th><th>Nama (Role)</th><th>Ramu</th><th>Rakit</th><th>Terap</th><th>Poin</th><th>Nilai</th><th>Pangkat</th><th>Terakhir Main</th></tr></thead>
          <tbody>` +
        daftar.map((d, i) => `<tr>
            <td>${i + 1}</td>
            <td><b>${escapeHtml(d.nama_lengkap)}</b><br><small style="opacity:.7;">${escapeHtml(d.user_id)} • ${escapeHtml(d.role)}</small></td>
            <td>${escapeHtml(d.progres_ramu)}</td>
            <td>${escapeHtml(d.progres_rakit)}</td>
            <td>${escapeHtml(d.progres_terap)}</td>
            <td><b>${d.total_poin}</b></td>
            <td>${d.nilai_persen}</td>
            <td>${escapeHtml(d.pangkat)}</td>
            <td>${escapeHtml(String(d.terakhir_aktivitas || '-').substring(0, 16))}</td>
          </tr>`).join("") +
        `</tbody></table></div>`;
    } catch (err) {
      box.innerHTML = `<p class="pg-error">${escapeHtml(err.message)}</p>`;
    }
  }

  function tutupPantau() { $('pg-modal-pantau').style.display = 'none'; }

  // ---------------- BANK SOAL ADMIN (sheet "potensi_soal") [v3.8.0] ----------------
  async function bukaBank() {
    $('pg-modal-bank').style.display = 'flex';
    await muatBankList();
  }
  function tutupBank() { $('pg-modal-bank').style.display = 'none'; }

  async function muatBankList() {
    const box = $('pgs-daftar');
    box.innerHTML = `<p class="pg-memeriksa">⏳ Memuat bank soal...</p>`;
    try {
      const res = await callAPI('getPotensiSoalKelola', [sessionToken]);
      const daftar = (res && res.list) || [];
      const jml = $('pgs-jumlah');
      if (jml) jml.textContent = daftar.length + ' soal di bank';
      if (daftar.length === 0) { box.innerHTML = `<p class="pg-catatan" style="text-align:left;">Bank soal masih kosong — tambahkan soal pertama lewat formulir di atas. Soal bank otomatis dipakai arena (diprioritaskan sebelum soal generator).</p>`; return; }
      box.innerHTML = daftar.map(d => `
        <div class="pgs-item">
          <div><b>${escapeHtml(d.pertanyaan)}</b><br>
          <small>${escapeHtml(d.golongan)} • ${escapeHtml(d.level)} • kunci ${escapeHtml(d.kunci.toUpperCase())} — A: ${escapeHtml(d.opsi_a)} | B: ${escapeHtml(d.opsi_b)} | C: ${escapeHtml(d.opsi_c)} | D: ${escapeHtml(d.opsi_d)}</small></div>
          <button class="pg-topbar-btn pg-topbar-tutup" onclick="PotensiGame.hapusBankSoal('${d.id_soal}')">🗑️</button>
        </div>`).join("");
    } catch (err) {
      box.innerHTML = `<p class="pg-error">${escapeHtml(err.message)}</p>`;
    }
  }

  async function simpanBankSoal() {
    const payload = {
      golongan: $('pgs-golongan').value,
      level: $('pgs-level').value,
      pertanyaan: $('pgs-tanya').value.trim(),
      opsi_a: $('pgs-a').value.trim(),
      opsi_b: $('pgs-b').value.trim(),
      opsi_c: $('pgs-c').value.trim(),
      opsi_d: $('pgs-d').value.trim(),
      kunci: $('pgs-kunci').value,
      pembahasan: $('pgs-bahas').value.trim()
    };
    if (!payload.pertanyaan || !payload.opsi_a || !payload.opsi_b || !payload.opsi_c || !payload.opsi_d) {
      alert("Pertanyaan dan keempat opsi wajib diisi."); return;
    }
    try {
      const res = await callAPI('savePotensiSoal', [sessionToken, payload], { cache: false });
      showToast(res.message || "Soal tersimpan.");
      ['pgs-tanya', 'pgs-a', 'pgs-b', 'pgs-c', 'pgs-d', 'pgs-bahas'].forEach(id => { $(id).value = ''; });
      await muatBankList();
    } catch (err) { alert(err.message); }
  }

  async function hapusBankSoal(id) {
    if (!confirm("Hapus soal ini dari bank soal?")) return;
    try {
      const res = await callAPI('deletePotensiSoal', [sessionToken, id], { cache: false });
      showToast(res.message || "Soal dihapus.");
      await muatBankList();
    } catch (err) { alert(err.message); }
  }

  function levelArenaAktif() { return arena ? arena.level : ""; }

  // Pulihkan setelah HP terkunci / berpindah aplikasi
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && quiz && $('pg-overlay').style.display !== 'none') {
      const catatan = document.querySelector('.pg-quiz-progress');
      if (catatan && !catatan.textContent.includes('Selamat datang kembali')) {
        catatan.insertAdjacentHTML('afterend', `<p class="pg-catatan">👋 Selamat datang kembali! Progres tetap aman — lanjutkan menjawab.</p>`);
      }
    }
  });

  return { init, buka, tutup, mulaiLevel, jawab, lanjut, selesaiLevel, kembaliPeta, bukaMateri, tutupMateri, bukaPapanSkor, tutupPapanSkor, mulaiKuisDariBekal, toggleSuara, bukaPantau, tutupPantau, aktifkanLewatFolder, mulaiArena, jawabArena, soalBerikutnya, bukaBank, tutupBank, simpanBankSoal, hapusBankSoal, levelArenaAktif };
})();

// [v3.6.4] pgToggleArsip dihapus bersama fitur penugasan.
