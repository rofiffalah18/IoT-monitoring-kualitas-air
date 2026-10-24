// ==========================================
// KONFIGURASI NAMA SHEET & TIMEZONE
// ==========================================
const SHEET_SENSOR = "Data Feeder"; // Tab sheet data sensor utama
const SHEET_LOG = "Log Koneksi";     // Tab sheet log koneksi
const TIME_ZONE = "Asia/Jakarta";    // WIB (GMT+7)

// ==========================================
// 1. ENDPOINT UTAMA (POST & GET)
// ==========================================
function doPost(e) {
  return handleIncomingData(e);
}

function doGet(e) {
  if (e && e.parameter) {
    // 1. Action untuk request data dashboard
    if (e.parameter.action === "read") {
      return getDashboardData();
    }

    // 2. Action untuk download CSV (1 Bulan)
    if (e.parameter.action === "downloadCSV") {
      var data = getWaterDataOneMonth();
      return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Action untuk buat data dummy
    if (e.parameter.action === "dummy") {
      isiDataDummy();
      return ContentService.createTextOutput("Data dummy berhasil dibuat!")
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // 4. Pengiriman data dari ESP32 via HTTP GET
    if (e.parameter.suhu1) {
      return handleIncomingData(e);
    }
  }

  // Default response jika tidak ada parameter khusus
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

    // Inisialisasi Sheet Data Monitoring Sensor (Urutan 9 Kolom Sesuai row[0] s/d row[8])
    let sheetSensor = ss.getSheetByName(SHEET_SENSOR);
    if (!sheetSensor) {
      sheetSensor = ss.insertSheet(SHEET_SENSOR);
      sheetSensor.appendRow([
        "Timestamp", "Suhu Surface (°C)", "Suhu Middle (°C)", "Suhu Bottom (°C)",
        "DO (mg/L)", "pH Air", "Kedalaman (cm)", "Device ID", "Status Log / Catatan"
      ]);
    }

    // Inisialisasi Sheet Log Koneksi
    let sheetLog = ss.getSheetByName(SHEET_LOG);
    if (!sheetLog) {
      sheetLog = ss.insertSheet(SHEET_LOG);
      sheetLog.appendRow(["Timestamp", "Device ID", "Status Koneksi", "Detail Catatan"]);
    }

    let params = {};
    if (e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      params = e.parameter;
    }

    const deviceId = params.device_id || "ESP32_POND_MONITOR_01";
    const suhu1 = (params.suhu1 !== undefined) ? parseFloat(params.suhu1) : -127.0;
    const suhu2 = (params.suhu2 !== undefined) ? parseFloat(params.suhu2) : -127.0;
    const suhu3 = (params.suhu3 !== undefined) ? parseFloat(params.suhu3) : -127.0;
    const doVal = (params.do !== undefined) ? parseFloat(params.do) : -1.0;
    const phVal = (params.ph !== undefined) ? parseFloat(params.ph) : -1.0;
    const kedalaman = (params.kedalaman !== undefined) ? parseFloat(params.kedalaman) : -1.0;

    // Evaluasi Status Kualitas Air (NORMAL, WASPADA, BAHAYA)
    let statusKualitas = "NORMAL";
    let catatan = [];

    if (suhu1 === -127.0 || suhu2 === -127.0 || suhu3 === -127.0 || kedalaman === -1.0 || phVal === -1.0 || doVal === -1.0) {
      statusKualitas = "BAHAYA";
      catatan.push("Sensor Terputus/Error");
    } else {
      if (doVal < 3.0 || phVal < 5.5 || phVal > 8.5) {
        statusKualitas = "BAHAYA";
        if (doVal < 3.0) catatan.push("DO Kritis (Anoksia)");
        if (phVal < 5.5 || phVal > 8.5) catatan.push("pH Ekstrem");
      } else if (doVal < 4.5 || phVal < 6.5 || phVal > 7.8 || Math.abs(suhu1 - suhu3) >= 1.5) {
        statusKualitas = "WASPADA";
        if (doVal < 4.5) catatan.push("DO Rendah");
        if (phVal < 6.5 || phVal > 7.8) catatan.push("pH Sub-optimal");
        if (Math.abs(suhu1 - suhu3) >= 1.5) catatan.push("Stratifikasi Suhu");
      }
    }

    const pesanCatatan = catatan.length > 0 ? catatan.join(", ") : "Transmisi Berhasil";
    const timestampStr = Utilities.formatDate(new Date(), TIME_ZONE, "dd/MM/yyyy, HH:mm:ss");
    const timestamp = "'" + timestampStr;

    // 1. Simpan ke Sheet Data Monitoring (Susunan: row[0]=Timestamp, row[1]=Suhu1, ..., row[7]=DeviceId, row[8]=Catatan)
    sheetSensor.appendRow([
      timestamp, suhu1, suhu2, suhu3, doVal, phVal, kedalaman, deviceId, statusKualitas + " (" + pesanCatatan + ")"
    ]);

    // 2. Evaluasi Status Aktivitas Koneksi (Mengirim data vs Terhubung kembali)
    let aktivitasKoneksi = "Mengirim data";
    if (sheetLog.getLastRow() > 1) {
      let lastTimestampStr = sheetLog.getRange(sheetLog.getLastRow(), 1).getValue().toString().replace("'", "");
      if (lastTimestampStr.includes("/")) {
        let parts = lastTimestampStr.split(", ");
        let dateParts = parts[0].split("/");
        let timeParts = parts[1] ? parts[1].split(":") : [0, 0, 0];
        let lastLogTime = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]);
        let currentTime = new Date();

        let diffMinutes = (currentTime - lastLogTime) / (1000 * 60);
        if (diffMinutes > 31) {
          aktivitasKoneksi = "Terhubung kembali & kirim data";
        }
      }
    }

    sheetLog.appendRow([
      timestamp, deviceId, "ONLINE / HEALTHY", aktivitasKoneksi
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data sensor & log koneksi berhasil disimpan!",
      timestamp: timestampStr
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
  const sheet = ss.getSheetByName(SHEET_SENSOR);

  if (!sheet) return createJsonResponse([]);

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return createJsonResponse([]);

  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    let formattedTime = "";
    if (row[0] instanceof Date) {
      formattedTime = Utilities.formatDate(row[0], TIME_ZONE, "dd/MM/yyyy, HH:mm:ss");
    } else {
      formattedTime = row[0] ? row[0].toString().replace("'", "") : "";
    }

    // Pemetaan Indeks Array Presisi (Sesuai Posisi Kolom Tabel)
    result.push({
      timestamp: formattedTime,            // row[0]
      suhu1: parseFloat(row[1]) || 0,      // row[1] Suhu Surface
      suhu2: parseFloat(row[2]) || 0,      // row[2] Suhu Middle
      suhu3: parseFloat(row[3]) || 0,      // row[3] Suhu Bottom
      do: parseFloat(row[4]) || 0,         // row[4] DO
      ph: parseFloat(row[5]) || 0,         // row[5] pH Air
      kedalaman: parseFloat(row[6]) || 0,  // row[6] Kedalaman
      device_id: row[7],                   // row[7] Device ID
      catatan: row[8]                      // row[8] Catatan / Status Log
    });
  }

  return createJsonResponse(result);
}

function getWaterDataOneMonth() {
  // Pastikan nama sheet sesuai dengan yang ada di Google Sheets kamu
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SENSOR);
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) return [];

  var headers = data[0];
  var result = [];

  var now = new Date();
  var oneMonthAgo = new Date();
  oneMonthAgo.setDate(now.getDate() - 30);

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowDate = new Date(row[0]);

    if (!isNaN(rowDate.getTime()) && rowDate >= oneMonthAgo) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        if (row[j] instanceof Date) {
          obj[headers[j]] = Utilities.formatDate(row[j], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        } else {
          obj[headers[j]] = row[j];
        }
      }
      result.push(obj);
    }
  }
  return result;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 4. GENERATOR DATA DUMMY
// ==========================================
function isiDataDummy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheetSensor = ss.getSheetByName(SHEET_SENSOR);
  if (!sheetSensor) {
    sheetSensor = ss.insertSheet(SHEET_SENSOR);
    sheetSensor.appendRow([
      "Timestamp", "Suhu Surface (°C)", "Suhu Middle (°C)", "Suhu Bottom (°C)",
      "DO (mg/L)", "pH Air", "Kedalaman (cm)", "Device ID", "Status Log / Catatan"
    ]);
  }

  let sheetLog = ss.getSheetByName(SHEET_LOG);
  if (!sheetLog) {
    sheetLog = ss.insertSheet(SHEET_LOG);
    sheetLog.appendRow(["Timestamp", "Device ID", "Status Koneksi", "Detail Catatan"]);
  }

  const now = new Date();
  const formattedTime = "'" + Utilities.formatDate(now, TIME_ZONE, "dd/MM/yyyy, HH:mm:ss");

  const suhu1 = parseFloat((28.0 + Math.random() * 1.5).toFixed(1));
  const suhu2 = parseFloat((27.2 + Math.random() * 1.5).toFixed(1));
  const suhu3 = parseFloat((26.0 + Math.random() * 1.5).toFixed(1));
  const doVal = parseFloat((5.5 + Math.random() * 2.0).toFixed(1));
  const phVal = parseFloat((7.0 + Math.random() * 0.8).toFixed(1));
  const kedalaman = parseFloat((120.0 + Math.random() * 20.0).toFixed(1));

  let statusLog = "NORMAL (Transmisi Berhasil)";
  if (doVal < 4.0 || phVal < 5.5 || phVal > 8.5) {
    statusLog = "WARNING (Parameter Di Luar Batas)";
  }

  sheetSensor.appendRow([
    formattedTime, suhu1, suhu2, suhu3, doVal, phVal, kedalaman, "ESP32_DUMMY_DEV", statusLog
  ]);

  sheetLog.appendRow([
    formattedTime, "ESP32_DUMMY_DEV", "ONLINE / HEALTHY", "[DUMMY] Mode Uji Coba 1 Menit"
  ]);

  Logger.log("Berhasil menambahkan 1 baris data dummy!");
}

// ==========================================
// 5. AUTOMATED CLEANUP TRIGGERS
// ==========================================
function autoCleanDataMonitoring() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SENSOR);
  if (sheet && sheet.getLastRow() > 3000) {
    sheet.deleteRows(2, sheet.getLastRow() - 3000);
  }
}

function autoCleanLogKoneksi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LOG);
  if (sheet && sheet.getLastRow() > 1000) {
    sheet.deleteRows(2, sheet.getLastRow() - 1000);
  }
}