// ==========================================
// KONFIGURASI GLOBAL & EMAIL PENERIMA
// ==========================================
const SHEET_SENSOR  = ""; 
const SHEET_LOG     = "";  
const TIME_ZONE     = ""; 
const EMAIL_PENERIMA = ""; 

// ==========================================
// 1. ENDPOINT UTAMA (GET & POST)
// ==========================================
function doPost(e) {
  return handleIncomingData(e);
}

function doGet(e) {
  const action = e.parameter.action;
  const scriptProperties = PropertiesService.getScriptProperties();

  // 1. ESP32 mengecek apakah ada perintah baca dari Web
  if (action === "checkTrigger") {
    const isTriggered = scriptProperties.getProperty("FLAG_READ_TRIGGER") === "TRUE";
    if (isTriggered) {
      // Reset kembali flag agar tidak berulang terus-menerus
      scriptProperties.setProperty("FLAG_READ_TRIGGER", "FALSE");
    }
    return ContentService.createTextOutput(JSON.stringify({ trigger: isTriggered }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Web Dashboard mengeset perintah baca saat tombol diklik
if (action === "setReadTrigger") {
    scriptProperties.setProperty("FLAG_READ_TRIGGER", "TRUE");
    
    // Catat riwayat bahwa tombol web baru saja diklik
    logWebActivity("WEB_TRIGGER_SENT", "WEB_MANUAL_READ");

    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS_FLAG_SET" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Aksi baru: Catat Log jika ESP32 tidak merespons (Timeout/Offline)
  if (action === "logWebTimeout") {
    logWebActivity("ESP32_NO_RESPONSE_OFFLINE", "WEB_MANUAL_READ_FAILED");
    return ContentService.createTextOutput(JSON.stringify({ status: "TIMEOUT_LOGGED" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 3. Aksi Download CSV 30 Hari
  if (action === "downloadCSV") {
    return getWaterDataOneMonth();
  }

  // Default: Ambil data untuk Dashboard Web
  return getDashboardData();
}

// ==========================================
// 2. PENANGANAN DATA MASUK DARI ESP32
// ==========================================
function handleIncomingData(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Inisialisasi Sheet Data Feeder
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
      sheetLog.appendRow(["Timestamp", "Jenis Aktivitas", "Status Log", "Detail Jaringan / Keterangan"]);
    }

    let params = {};
    if (e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      params = e.parameter;
    }

    const timestampStr = Utilities.formatDate(new Date(), TIME_ZONE, "dd/MM/yyyy, HH:mm:ss");
    const timestampFormatted = "'" + timestampStr;

    const deviceId    = params.device_id || "ESP32_POND_MONITOR_01";
    const triggerType = params.trigger_type || "SCHEDULED_30MIN";
    const wifiName    = params.wifi_name || "Wi-Fi 1"; // Wi-Fi 1 / Wi-Fi 2 / Wi-Fi 3
    const statusLog   = params.status_log || "NORMAL";

    // A. JIKA PAKET BERISI DATA SENSOR
    if (params.suhu1 !== undefined) {
      const suhu1     = parseFloat(params.suhu1);
      const suhu2     = parseFloat(params.suhu2);
      const suhu3     = parseFloat(params.suhu3);
      const doVal     = parseFloat(params.do);
      const phVal     = parseFloat(params.ph);
      const kedalaman = parseFloat(params.kedalaman);

      // Simpan ke Sheet Data Feeder
      sheetSensor.appendRow([
        timestampFormatted, suhu1, suhu2, suhu3, doVal, phVal, kedalaman, deviceId, statusLog
      ]);
    }

    // B. SIMPAN KE SHEET LOG KONEKSI
    var statusKoneksi = (statusLog === "NORMAL") ? "SUCCESS" : "WARNING";
    var rincianPesan  = "Koneksi: " + wifiName + " | Status: " + statusLog;

    if (triggerType === "RECONNECTED_WIFI" || triggerType === "SWITCHING_WIFI") {
      rincianPesan = "Peralihan Jaringan ke " + wifiName;
      statusKoneksi = "SUCCESS";
    }

    sheetLog.appendRow([
      timestampFormatted, triggerType, statusKoneksi, rincianPesan
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data berhasil disimpan!",
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
// 3. CATAT AKTIVITAS BACA DARI WEB DASHBOARD
// ==========================================
function catatLogWebRead() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetLog = ss.getSheetByName(SHEET_LOG);
  if (sheetLog) {
    const timestampStr = "'" + Utilities.formatDate(new Date(), TIME_ZONE, "dd/MM/yyyy, HH:mm:ss");
    sheetLog.appendRow([
      timestampStr, "WEB_MANUAL_READ", "SUCCESS", "Permintaan Baca Data Real-time via Dashboard Web"
    ]);
  }
}

// ==========================================
// 4. AMBIL DATA UNTUK DASHBOARD WEB
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

    result.push({
      timestamp: formattedTime,
      suhu1: parseFloat(row[1]) || 0,
      suhu2: parseFloat(row[2]) || 0,
      suhu3: parseFloat(row[3]) || 0,
      do: parseFloat(row[4]) || 0,
      ph: parseFloat(row[5]) || 0,
      kedalaman: parseFloat(row[6]) || 0,
      device_id: row[7] || "ESP32",
      catatan: row[8] || "NORMAL"
    });
  }

  return createJsonResponse(result);
}

function getWaterDataOneMonth() {
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
          obj[headers[j]] = Utilities.formatDate(row[j], TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
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
// 5. EMAIL OTOMATIS BULANAN & RESET DATA
// ==========================================
function autoSendMonthlyReportAndReset() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetData = ss.getSheetByName(SHEET_SENSOR);
  var data = sheetData.getDataRange().getValues();

  if (data.length <= 1) return;

  var headers = data[0];
  var csvContent = headers.join(",") + "\n";

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var formattedRow = row.map(function(item) {
      if (item instanceof Date) {
        return Utilities.formatDate(item, TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
      }
      return item;
    });
    csvContent += formattedRow.join(",") + "\n";
  }

  var lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  var periodName = Utilities.formatDate(lastMonthDate, TIME_ZONE, "yyyy-MM");
  
  var blob = Utilities.newBlob(csvContent, "text/csv", "Laporan_KualitasAir_" + periodName + ".csv");

  var subject = "📊 [AUTOREPORT] Laporan Bulanan Kualitas Air - Periode " + periodName;
  var body = "Halo Admin,\n\nTerlampir laporan data monitoring kualitas air bulanan untuk periode " + periodName + " sebelum sistem melakukan reset data.\n\nSalam,\nESP32 Water Quality Monitoring System";
  
  MailApp.sendEmail(EMAIL_PENERIMA, subject, body, {
    attachments: [blob]
  });

  // Kosongkan Sheet Data Feeder (Menyisakan Header)
  if (data.length > 1) {
    sheetData.deleteRows(2, data.length - 1);
  }

  // Catat Kejadian ke LogKoneksi
  var sheetLog = ss.getSheetByName(SHEET_LOG);
  if (sheetLog) {
    sheetLog.appendRow([
      "'" + Utilities.formatDate(new Date(), TIME_ZONE, "dd/MM/yyyy, HH:mm:ss"),
      "AUTO_MONTHLY_RESET",
      "SUCCESS",
      "Laporan CSV terkirim ke " + EMAIL_PENERIMA + " & Data Feeder di-reset"
    ]);
  }
}

// JALANKAN FUNGSI INI SEKALI DI EDITOR UNTUK MEMASANG TRIGGER
function createMonthlyTrigger() {
  ScriptApp.newTrigger('autoSendMonthlyReportAndReset')
    .timeBased()
    .onMonthDay(1)
    .atHour(0)
    .nearMinute(5)
    .create();
}

function logWebActivity(statusMsg, triggerType) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetLog = ss.getSheetByName("Log Koneksi"); // <-- Pastikan ejaan nama tab sama persis
    if (!sheetLog) {
      Logger.log("Sheet Log Koneksi tidak ditemukan!");
      return;
    }

    const now = new Date();
    const formattedTime = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    
    sheetLog.appendRow([formattedTime, "WEB_DASHBOARD", statusMsg, triggerType, "DASHBOARD_HTTP"]);
  } catch (err) {
    Logger.log("Gagal catat log web: " + err.toString());
  }
}

// ==========================================
// 6. GENERATOR DATA DUMMY
// ==========================================
function isiDataDummy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetSensor = ss.getSheetByName(SHEET_SENSOR);
  let sheetLog    = ss.getSheetByName(SHEET_LOG);

  const now = new Date();
  const formattedTime = "'" + Utilities.formatDate(now, TIME_ZONE, "dd/MM/yyyy, HH:mm:ss");

  const suhu1 = parseFloat((28.0 + Math.random() * 1.5).toFixed(1));
  const suhu2 = parseFloat((27.2 + Math.random() * 1.5).toFixed(1));
  const suhu3 = parseFloat((26.0 + Math.random() * 1.5).toFixed(1));
  const doVal = parseFloat((5.5 + Math.random() * 2.0).toFixed(1));
  const phVal = parseFloat((7.0 + Math.random() * 0.8).toFixed(1));
  const kedalaman = parseFloat((120.0 + Math.random() * 20.0).toFixed(1));

  sheetSensor.appendRow([
    formattedTime, suhu1, suhu2, suhu3, doVal, phVal, kedalaman, "ESP32_DUMMY_DEV", "NORMAL"
  ]);

  sheetLog.appendRow([
    formattedTime, "DUMMY_TEST", "SUCCESS", "[DUMMY] Mode Uji Coba Data"
  ]);
}