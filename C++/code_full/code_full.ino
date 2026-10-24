#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "time.h"
#include "esp_eap_client.h" // Library EAP Enterprise Terbaru

// ============================================================================
// 1. KONFIGURASI GLOBAL & PINOUT
// ============================================================================

// URL Web App Google Apps Script
const char* serverURL = "https://script.google.com/macros/s/AKfycbzPcQ6YPapGf37XNUF3TofDkfkWLkMM5ibjBDk301uX7SRv-J9l-ipdxPVhnD2An4XlfQ/exec";

// Server NTP untuk Sinkronisasi Waktu
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 7 * 3600;  // GMT+7 (WIB)
const int daylightOffset_sec = 0;

// KREDENSIAL 3 JARINGAN WI-FI
// ----------------------------------------------------------------------------
// Wi-Fi 1: Router Utama / Home (WPA2 Personal)
const char* WIFI_HOME_SSID = "";
const char* WIFI_HOME_PASS = "";

// Wi-Fi 2: Hotspot Modem USB / HP (WPA2 Personal)
const char* WIFI_MODEM_SSID = "";
const char* WIFI_MODEM_PASS = "";

// Wi-Fi 3: GTC IPB Enterprise (WPA2 Enterprise / PEAP)
#define EAP_IDENTITY ""
#define EAP_PASSWORD ""
// ----------------------------------------------------------------------------

// Definisi Pin ESP32 (30-Pin)
#define ONE_WIRE_BUS 4
#define TRIG_PIN     5
#define ECHO_PIN     18
#define RX2_PIN      16
#define TX2_PIN      17
#define DE_RE_PIN    15
#define TOUCH_PIN    13 // Pin Touch Sensor TTP223

// Inisialisasi Bus & Sensor
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
Adafruit_ADS1115 ads;

// Alamat Hardware ROM DS18B20 Terkunci
DeviceAddress sensorSurface = {};
DeviceAddress sensorMiddle  = {};
DeviceAddress sensorBottom  = {};

// Konstanta Kalibrasi Sensor
const float TINGGI_MAX_KOLAM = 200.0;  // cm
const float TEGANGAN_PH_7    = 1500.0; // mV
const float PH_PER_MV        = 0.0035;

// Frame Modbus RTU Remond RMD-ISDTY105 (DO Sensor)
const byte requestFrameDO[] = { 0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B };

// Flag Kontrol Jadwal, Active Network & Mode Manual
bool sudahKirimMenit00 = false;
bool sudahKirimMenit30 = false;

String activeWiFiName = "Wi-Fi 1"; // Menyimpan "Wi-Fi 1", "Wi-Fi 2", atau "Wi-Fi 3"

bool modeManual = false;
float manual_s1 = 25.0, manual_s2 = 25.0, manual_s3 = 25.0;
float manual_kedalaman = 150.0, manual_ph = 7.0, manual_do = 6.5;

// Prototype Fungsi
void kirimDataJSON(float s1, float s2, float s3, float kedalaman, float ph, float doVal, String triggerType);
void voidMaintainWiFi();

// ============================================================================
// 2. VOID SENSOR 1: SUHU DS18B20 (PERMUKAAN, TENGAH, DASAR)
// ============================================================================

void voidBacaSuhu(float& s1, float& s2, float& s3) {
  sensors.requestTemperatures();
  s1 = sensors.getTempC(sensorSurface);
  s2 = sensors.getTempC(sensorMiddle);
  s3 = sensors.getTempC(sensorBottom);

  if (s1 == DEVICE_DISCONNECTED_C) s1 = -127.0;
  if (s2 == DEVICE_DISCONNECTED_C) s2 = -127.0;
  if (s3 == DEVICE_DISCONNECTED_C) s3 = -127.0;
}

// ============================================================================
// 3. VOID SENSOR 2: KEDALAMAN AIR (ULTRASONIK AJ-SR04M)
// ============================================================================

float voidBacaKedalaman() {
  float totalJarak = 0.0;
  int sampelValid = 0;

  for (int i = 0; i < 5; i++) {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    long durasi = pulseIn(ECHO_PIN, HIGH, 30000);
    float jarak = (durasi * 0.034) / 2.0;

    if (jarak >= 2.0 && jarak <= 400.0) {
      totalJarak += jarak;
      sampelValid++;
    }
    delay(20);
  }

  if (sampelValid > 0) {
    float jarakKeAir = totalJarak / sampelValid;
    float kedalaman = TINGGI_MAX_KOLAM - jarakKeAir;
    return (kedalaman < 0) ? 0 : kedalaman;
  }
  return -1.0;
}

// ============================================================================
// 4. VOID SENSOR 3: pH AIR (SENSING BNC + ADS1115 ADC I2C)
// ============================================================================

float voidBacaPH() {
  Wire.beginTransmission(0x48);
  if (Wire.endTransmission() != 0) {
    return -1.0;
  }

  int16_t adc0 = ads.readADC_SingleEnded(0);
  float teganganMV = ads.computeVolts(adc0) * 1000.0;
  float nilaiPH = 7.0 + ((TEGANGAN_PH_7 - teganganMV) / PH_PER_MV);

  if (nilaiPH < 0.0) nilaiPH = 0.0;
  if (nilaiPH > 14.0) nilaiPH = 14.0;
  return nilaiPH;
}

// ============================================================================
// 5. VOID SENSOR 4: DO REMOND (MAX485 MODBUS RTU VIA RS485)
// ============================================================================

float voidBacaDORemond() {
  byte responseBuffer[11];

  digitalWrite(DE_RE_PIN, HIGH);
  delay(5);
  Serial2.write(requestFrameDO, sizeof(requestFrameDO));
  Serial2.flush();

  digitalWrite(DE_RE_PIN, LOW);
  delay(5);

  unsigned long startTime = millis();
  while (Serial2.available() < 9 && (millis() - startTime < 500)) {
    delay(1);
  }

  if (Serial2.available() >= 9) {
    for (int i = 0; i < 9; i++) {
      responseBuffer[i] = Serial2.read();
    }
    int16_t rawValue = (responseBuffer[3] << 8) | responseBuffer[4];
    return rawValue / 100.0;
  }

  while (Serial2.available()) Serial2.read();
  return -1.0;
}

// ============================================================================
// 6. VOID MANUAL TRIGGER: TOUCH SENSOR TTP223 (GPIO 13)
// ============================================================================

void voidCekTouchSensor() {
  if (digitalRead(TOUCH_PIN) == HIGH) {
    delay(50); // Debounce
    if (digitalRead(TOUCH_PIN) == HIGH) {
      Serial.println("\n👉 [TOUCH SENSOR DISENTUH] Mengirim data instan...");

      float s1, s2, s3, k, p, d;
      if (modeManual) {
        s1 = manual_s1; s2 = manual_s2; s3 = manual_s3;
        k = manual_kedalaman; p = manual_ph; d = manual_do;
      } else {
        voidBacaSuhu(s1, s2, s3);
        k = voidBacaKedalaman();
        p = voidBacaPH();
        d = voidBacaDORemond();
      }

      kirimDataJSON(s1, s2, s3, k, p, d, "TOUCH_SENSOR");

      // Tahan proses sampai sentuhan dilepas
      while (digitalRead(TOUCH_PIN) == HIGH) {
        delay(10);
      }
    }
  }
}

// ============================================================================
// 7. VOID UJI COBA SERIAL MONITOR (INPUT KEYBOARD)
// ============================================================================

void voidUjiCobaSerial() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.startsWith("SET:")) {
      String dataStr = input.substring(4);
      int idx1 = dataStr.indexOf(',');
      int idx2 = dataStr.indexOf(',', idx1 + 1);
      int idx3 = dataStr.indexOf(',', idx2 + 1);
      int idx4 = dataStr.indexOf(',', idx3 + 1);
      int idx5 = dataStr.indexOf(',', idx4 + 1);

      if (idx5 != -1) {
        manual_s1 = dataStr.substring(0, idx1).toFloat();
        manual_s2 = dataStr.substring(idx1 + 1, idx2).toFloat();
        manual_s3 = dataStr.substring(idx2 + 1, idx3).toFloat();
        manual_kedalaman = dataStr.substring(idx3 + 1, idx4).toFloat();
        manual_ph = dataStr.substring(idx4 + 1, idx5).toFloat();
        manual_do = dataStr.substring(idx5 + 1).toFloat();

        modeManual = true;
        Serial.println("\n✅ [MODE SIMULASI AKTIF] Data uji coba diset!");
      }
    }
    else if (input == "KIRIM") {
      Serial.println("\n🚀 Memaksa pengiriman data sekarang...");
      if (modeManual) {
        kirimDataJSON(manual_s1, manual_s2, manual_s3, manual_kedalaman, manual_ph, manual_do, "SERIAL_FORCE");
      } else {
        float s1, s2, s3, k, p, d;
        voidBacaSuhu(s1, s2, s3);
        k = voidBacaKedalaman();
        p = voidBacaPH();
        d = voidBacaDORemond();
        kirimDataJSON(s1, s2, s3, k, p, d, "SERIAL_FORCE");
      }
    }
    else if (input == "AUTO") {
      modeManual = false;
      Serial.println("\n🔄 Mode simulasi dimatikan. Kembali ke sensor fisik.");
    }
  }
}

// ============================================================================
// 8. VOID WI-FI FAILOVER BERTIAT (HOME ➔ MODEM ➔ GTC IPB)
// ============================================================================

bool connectWPA2Personal(const char* ssid, const char* pass, int timeoutSec = 6) {
  WiFi.disconnect(true);
  delay(50);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, pass);

  Serial.printf("[WiFi] Mencoba terhubung ke [%s]...", ssid);
  int counter = 0;
  while (WiFi.status() != WL_CONNECTED && counter < (timeoutSec * 2)) {
    delay(500);
    Serial.print(".");
    counter++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ [WiFi] Terhubung!");
    return true;
  }
  Serial.println("\n❌ [WiFi] Gagal.");
  return false;
}

bool connectGTCIPB(int timeoutSec = 8) {
  WiFi.disconnect(true);
  delay(50);
  WiFi.mode(WIFI_STA);

  esp_eap_client_set_identity((uint8_t *)EAP_IDENTITY, strlen(EAP_IDENTITY));
  esp_eap_client_set_username((uint8_t *)EAP_IDENTITY, strlen(EAP_IDENTITY));
  esp_eap_client_set_password((uint8_t *)EAP_PASSWORD, strlen(EAP_PASSWORD));
  esp_wifi_sta_enterprise_enable();

  WiFi.begin("GTC", NULL, 0, NULL, false);

  Serial.print("[WiFi] Mencoba koneksi Enterprise [GTC IPB]...");
  int counter = 0;
  while (WiFi.status() != WL_CONNECTED && counter < (timeoutSec * 2)) {
    delay(500);
    Serial.print(".");
    counter++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ [WiFi] Terhubung ke GTC IPB!");
    return true;
  }
  
  esp_wifi_sta_enterprise_disable();
  Serial.println("\n❌ [WiFi] Gagal koneksi GTC IPB.");
  return false;
}

void voidMaintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("\n==================================================");
  Serial.println("⚠️ Wi-Fi Terputus! Memulai Auto-Refresh Failover...");
  Serial.println("==================================================");

  // 1. Cek Wi-Fi 1 (Home/Router Utama)
  if (connectWPA2Personal(WIFI_HOME_SSID, WIFI_HOME_PASS)) {
    activeWiFiName = "Wi-Fi 1";
    return;
  }
  // 2. Cek Wi-Fi 2 (Hotspot Modem USB)
  else if (connectWPA2Personal(WIFI_MODEM_SSID, WIFI_MODEM_PASS)) {
    activeWiFiName = "Wi-Fi 2";
    return;
  }
  // 3. Cek Wi-Fi 3 (GTC IPB Campus)
  else if (connectGTCIPB()) {
    activeWiFiName = "Wi-Fi 3";
    return;
  }

  Serial.println("\n🔴 [WiFi] Seluruh opsi koneksi gagal.\n");
}

// ============================================================================
// 9. VOID TRANSMISI HTTP POST DATA JSON KE GOOGLE APPS SCRIPT
// ============================================================================

void kirimDataJSON(float s1, float s2, float s3, float kedalaman, float ph, float doVal, String triggerType) {
  voidMaintainWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    String statusLog = "";
    if (s1 == -127.0) statusLog += "[ERR: Suhu Surface] ";
    if (s2 == -127.0) statusLog += "[ERR: Suhu Middle] ";
    if (s3 == -127.0) statusLog += "[ERR: Suhu Bottom] ";
    if (kedalaman == -1.0) statusLog += "[ERR: Kedalaman] ";
    if (ph == -1.0) statusLog += "[ERR: Sensor pH/ADS1115] ";
    if (doVal == -1.0) statusLog += "[ERR: Sensor DO RS485] ";

    if (statusLog == "") {
      statusLog = "NORMAL";
    }

    StaticJsonDocument<400> doc;
    doc["suhu1"]        = s1;
    doc["suhu2"]        = s2;
    doc["suhu3"]        = s3;
    doc["kedalaman"]    = kedalaman;
    doc["ph"]           = ph;
    doc["do"]           = doVal;
    doc["device_id"]    = "ESP32_POND_MONITOR_01";
    doc["status_log"]   = statusLog;
    doc["trigger_type"] = triggerType;    // Tipe pemicu dikirim ke GS
    doc["wifi_name"]    = activeWiFiName; // Menyimpan "Wi-Fi 1", "Wi-Fi 2", atau "Wi-Fi 3"

    String jsonString;
    serializeJson(doc, jsonString);

    Serial.println("\n==================================================");
    Serial.println(">>> MENGIRIM DATA MONITORING KE SPREADSHEET <<<");
    Serial.println(jsonString);

    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

    int httpResponseCode = http.POST(jsonString);

    if (httpResponseCode > 0) {
      Serial.print("✅ Status Kirim Sukses | Code: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("❌ Gagal Mengirim | Error: ");
      Serial.println(httpResponseCode);
    }

    http.end();
  } else {
    Serial.println("⚠️ Gagal Mengirim: Wi-Fi Terputus!");
  }
}

// ============================================================================
// 10. MAIN SETUP & SCHEDULED LOOP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==================================================");
  Serial.println(" SYSTEM MONITORING KUALITAS AIR - FULL SKETCH ");
  Serial.println("==================================================");

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(DE_RE_PIN, OUTPUT);
  pinMode(TOUCH_PIN, INPUT); // Mode Input Touch Sensor TTP223
  digitalWrite(DE_RE_PIN, LOW);

  Serial2.begin(9600, SERIAL_8N1, RX2_PIN, TX2_PIN);
  Wire.begin(21, 22);
  sensors.begin();

  if (!ads.begin(0x48)) {
    Serial.println("⚠️ Warning: ADS1115 Tidak Terdeteksi!");
  }

  // Koneksi Awal Wi-Fi
  voidMaintainWiFi();

  // Sinkronisasi Waktu NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("Menyesuaikan waktu via NTP...");
}

void loop() {
  // 1. Cek pemicu manual Touch Sensor (GPIO 13)
  voidCekTouchSensor();

  // 2. Cek perintah keyboard dari Serial Monitor
  voidUjiCobaSerial();

  // 3. Pastikan koneksi Wi-Fi tetap aktif (Auto-Failover)
  voidMaintainWiFi();

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    delay(500);
    return;
  }

  int menitSekarang = timeinfo.tm_min;
  int detikSekarang = timeinfo.tm_sec;

  // 4. Jadwal Transmisi Otomatis di Menit :00 dan :30
  if ((menitSekarang == 0 && !sudahKirimMenit00) || (menitSekarang == 30 && !sudahKirimMenit30)) {

    float suhu1, suhu2, suhu3, kedalaman, ph, doVal;

    if (modeManual) {
      suhu1 = manual_s1;
      suhu2 = manual_s2;
      suhu3 = manual_s3;
      kedalaman = manual_kedalaman;
      ph = manual_ph;
      doVal = manual_do;
    } else {
      voidBacaSuhu(suhu1, suhu2, suhu3);
      kedalaman = voidBacaKedalaman();
      ph = voidBacaPH();
      doVal = voidBacaDORemond();
    }

    Serial.printf("\n[WAKTU REAL-TIME: %02d:%02d:%02d]\n", timeinfo.tm_hour, menitSekarang, detikSekarang);
    kirimDataJSON(suhu1, suhu2, suhu3, kedalaman, ph, doVal, "SCHEDULED_30MIN");

    if (menitSekarang == 0)  sudahKirimMenit00 = true;
    if (menitSekarang == 30) sudahKirimMenit30 = true;
  }

  if (menitSekarang != 0)  sudahKirimMenit00 = false;
  if (menitSekarang != 30) sudahKirimMenit30 = false;

  delay(500);
}