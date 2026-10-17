// ==========================================
// KONFIGURASI NAMA SHEET
// ==========================================
const SHEET_SENSOR = "Data Feeder"; // Samakan persis dengan nama tab sheet sensor
const SHEET_LOG = "Log Koneksi";       // Samakan persis dengan nama tab sheet log koneksi

// ==========================================
// 1. ENDPOINT UTAMA (POST & GET)
// ==========================================
function doPost(e) {
  return handleIncomingData(e);
}

function doGet(e) {
  if (e.parameter) {
    if (e.parameter.action === "read") {
      return getDashboardData();
    }
    if (e.parameter.action === "dummy") {
      isiDataDummy();
      return ContentService.createTextOutput("Data dummy berhasil dibuat!")
        .setMimeType(ContentService.MimeType.TEXT);
    }
    if (e.parameter.suhu1) {
      return handleIncomingData(e);
    }
  }
  
  return getDashboardData();
}

// ==========================================
// 2. OLAH DATA MASUK DARI ESP32 (POST/GET)
// ==========================================
function handleIncomingData(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const timeZone = Session.getScriptTimeZone();
    
    // Inisialisasi Sheet Data Sensor
    let sheetSensor = ss.getSheetByName(SHEET_SENSOR);
    if (!sheetSensor) {
      sheetSensor = ss.insertSheet(SHEET_SENSOR);
      sheetSensor.appendRow([
        "Timestamp", "Suhu Permukaan", "Suhu Tengah", "Suhu Dasar", 
        "DO", "pH", "Kedalaman", "Status", "Catatan"
      ]);
    }

    // Inisialisasi Sheet Log Koneksi
    let sheetLog = ss.getSheetByName(SHEET_LOG);
    if (!sheetLog) {
      sheetLog = ss.insertSheet(SHEET_LOG);
      sheetLog.appendRow(["Timestamp", "Status Perangkat", "Status ESP", "Keterangan"]);
    }

    let params = {};
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      params = e.parameter;
    }

    const suhu1 = parseFloat(params.suhu1) || 0;
    const suhu2 = parseFloat(params.suhu2) || 0;
    const suhu3 = parseFloat(params.suhu3) || 0;
    const doVal = parseFloat(params.do) || 0;
    const phVal = parseFloat(params.ph) || 0;
    const kedalaman = parseFloat(params.kedalaman) || 0;

    // Evaluasi Status Sensor
    let statusLog = "NORMAL";
    let catatan = [];

    if (doVal < 4.0) { statusLog = "WARNING"; catatan.push("DO Rendah"); }
    if (phVal < 5.5 || phVal > 8.5) { statusLog = "WARNING"; catatan.push("pH Ekstrem"); }
    if (Math.abs(suhu1 - suhu3) >= 1.5) { statusLog = "WARNING"; catatan.push("Stratifikasi Suhu"); }

    // Teks Timestamp Murni tanpa Timezone (pakai tanda petik satu di depan)
    const timestamp = "'" + Utilities.formatDate(new Date(), timeZone, "dd/MM/yyyy, HH:mm:ss");
    const pesanCatatan = catatan.length > 0 ? catatan.join(", ") : "Transmisi Berhasil";

    // 1. Simpan ke Sheet Sensor
    sheetSensor.appendRow([
      timestamp, suhu1, suhu2, suhu3, doVal, phVal, kedalaman, statusLog, pesanCatatan
    ]);

    // 2. Simpan ke Sheet Log Koneksi
    sheetLog.appendRow([
      timestamp, "Aktif", "Online", "Transmisi data berhasil"
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data sensor & log koneksi berhasil disimpan!",
      timestamp: timestamp.replace("'", "")
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 3. BACA DATA UNTUK WEB DASHBOARD (JSON)
// ==========================================
function getDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timeZone = Session.getScriptTimeZone();
  const sheet = ss.getSheetByName(SHEET_SENSOR);

  if (!sheet) return createJsonResponse([]);

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return createJsonResponse([]);

  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    let formattedTime = "";
    if (row[0] instanceof Date) {
      formattedTime = Utilities.formatDate(row[0], timeZone, "dd/MM/yyyy, HH:mm:ss");
    } else {
      // Hapus tanda petik satu jika dibaca sebagai string
      formattedTime = row[0] ? row[0].toString().replace("'", "") : "";
    }

    result.push({
      timestamp: formattedTime,
      suhu1: row[1],
      suhu2: row[2],
      suhu3: row[3],
      do: row[4],
      ph: row[5],
      kedalaman: row[6],
      status: row[7],
      catatan: row[8]
    });
  }

  return createJsonResponse(result);
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 4. GENERATOR DATA DUMMY (MODE UJI COBA 1 MENIT)
// ==========================================
function isiDataDummy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timeZone = Session.getScriptTimeZone();
  
  let sheetSensor = ss.getSheetByName(SHEET_SENSOR);
  if (!sheetSensor) {
    sheetSensor = ss.insertSheet(SHEET_SENSOR);
    sheetSensor.appendRow([
      "Timestamp", "Suhu Permukaan", "Suhu Tengah", "Suhu Dasar", 
      "DO", "pH", "Kedalaman", "Status", "Catatan"
    ]);
  }

  let sheetLog = ss.getSheetByName(SHEET_LOG);
  if (!sheetLog) {
    sheetLog = ss.insertSheet(SHEET_LOG);
    sheetLog.appendRow(["Timestamp", "Status Perangkat", "Status ESP", "Keterangan"]);
  }

  // Ambil waktu saat ini (Realtime)
  const now = new Date();
  const formattedTime = "'" + Utilities.formatDate(now, timeZone, "dd/MM/yyyy, HH:mm:ss");

  // Acak nilai sensor
  const suhu1 = parseFloat((27.5 + Math.random() * 2.5).toFixed(1));
  const suhu2 = parseFloat((26.8 + Math.random() * 2.0).toFixed(1));
  const suhu3 = parseFloat((25.5 + Math.random() * 2.0).toFixed(1));
  const doVal = parseFloat((4.5 + Math.random() * 3.5).toFixed(1));
  const phVal = parseFloat((6.8 + Math.random() * 1.2).toFixed(1));
  const kedalaman = parseFloat((1.2 + Math.random() * 0.3).toFixed(2));

  let statusLog = "NORMAL";
  let catatan = "[DUMMY] Simulasi Tes";

  if (doVal < 4.0 || phVal < 5.5 || phVal > 8.5) {
    statusLog = "WARNING";
    catatan = "[DUMMY] Parameter Di Luar Batas";
  }

  // Tambahkan Tepat 1 Baris ke Sheet Sensor
  sheetSensor.appendRow([
    formattedTime, suhu1, suhu2, suhu3, doVal, phVal, kedalaman, statusLog, catatan
  ]);

  // Tambahkan Tepat 1 Baris ke Sheet Log
  sheetLog.appendRow([
    formattedTime, "Aktif", "Online", "[DUMMY] Mode Uji Coba 1 Menit"
  ]);

  Logger.log("Berhasil menambahkan 1 baris data dummy!");
}

// ==========================================
// 5. PEMBERSIH AUTOMATIS
// ==========================================
function cleanDataSheetSensor() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SENSOR);
  if (sheet && sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
    Logger.log("Sheet Data Sensor berhasil dibersihkan!");
  }
}

function cleanDataSheetLog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LOG);
  if (sheet && sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
    Logger.log("Sheet Log Koneksi berhasil dibersihkan!");
  }
}