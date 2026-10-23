#include <Arduino.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "time.h"

// ============================================================================
// 1. CONFIGURATION & HARDWARE PINOUT
// ============================================================================
WiFiMulti wifiMulti;

// URL Web App Google Apps Script
const char* serverURL = "HTTPS://SCRIPT.GOOGLE.COM/MACROS/S/YOUR_SCRIPT_ID/EXEC";

// Server NTP untuk Sinkronisasi Waktu
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 7 * 3600; // GMT+7 (WIB)
const int   daylightOffset_sec = 0;

// Definisi Pin ESP32 (30-Pin)
#define ONE_WIRE_BUS 4
#define TRIG_PIN     5
#define ECHO_PIN     18
#define RX2_PIN      16
#define TX2_PIN      17
#define DE_RE_PIN    15

// Inisialisasi Bus & Sensor
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
Adafruit_ADS1115 ads;

// Alamat Hardware ROM DS18B20 Terkunci
DeviceAddress sensorSurface = { 0x28, 0xFF, 0x64, 0x1E, 0x82, 0x17, 0x04, 0x5D };
DeviceAddress sensorMiddle  = { 0x28, 0xFF, 0x31, 0x1E, 0x82, 0x17, 0x05, 0xA1 };
DeviceAddress sensorBottom  = { 0x28, 0xFF, 0x90, 0x1E, 0x82, 0x17, 0x06, 0x22 };

// Kalibrasi Nilai Parameter
const float TINGGI_MAX_KOLAM = 200.0; // cm
const float TEGANGAN_PH_7   = 1500.0; // mV
const float PH_PER_MV       = 0.0035;

// Command Frame Modbus RTU Remond RMD-ISDTY105
const byte requestFrameDO[] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B};

// Flag Kontrol Jadwal Transmisi
bool sudahKirimMenit00 = false;
bool sudahKirimMenit30 = false;

// ============================================================================
// 2. HELPER FUNCTIONS PEMBACAAN HARDWARE SENSOR & DETEKSI ERROR
// ============================================================================

void bacaSuhuAll(float &s1, float &s2, float &s3) {
  sensors.requestTemperatures();
  s1 = sensors.getTempC(sensorSurface);
  s2 = sensors.getTempC(sensorMiddle);
  s3 = sensors.getTempC(sensorBottom);

  if (s1 == DEVICE_DISCONNECTED_C) s1 = -127.0;
  if (s2 == DEVICE_DISCONNECTED_C) s2 = -127.0;
  if (s3 == DEVICE_DISCONNECTED_C) s3 = -127.0;
}

float bacaKedalamanAir() {
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

float bacaPHAir() {
  Wire.beginTransmission(0x48);
  if (Wire.endTransmission() != 0) {
    return -1.0;
  }

  int16_t adc0 = ads.readADC_SingleEnded(0);
  float teganganMV = ads.computeVolts(adc0) * 1000.0;
  float nilaiPH = 7.0 + ((TEGANGAN_PH_7 - teganganMV) * PH_PER_MV);

  if (nilaiPH < 0.0) nilaiPH = 0.0;
  if (nilaiPH > 14.0) nilaiPH = 14.0;
  return nilaiPH;
}

float bacaDORemond() {
  byte responseBuffer[11];

  digitalWrite(DE_RE_PIN, HIGH);
  delay(5);
  Serial2.write(requestFrameDO, sizeof(requestFrameDO));
  Serial2.flush();

  digitalWrite(DE_RE_PIN, LOW);
  delay(5);

  unsigned long startTime = millis();
  while (Serial2.available() < 9 && millis() - startTime < 500) {
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
// 3. WAKTU, NETWORK, & TRANSMISI JSON DENGAN CATATAN ERROR
// ============================================================================

void initMultiWiFi() {
  wifiMulti.addAP("WiFi_Kolam_Utama", "password123");
  wifiMulti.addAP("WiFi_Backup_Router", "password456");
  wifiMulti.addAP("Hotspot_Modem_USB", "internet123");

  Serial.println("Mencari & Menghubungkan ke jaringan Wi-Fi...");
  
  int timeout = 0;
  while (wifiMulti.run() != WL_CONNECTED && timeout < 20) {
    delay(500);
    Serial.print(".");
    timeout++;
  }

  if (wifiMulti.run() == WL_CONNECTED) {
    Serial.println("\n✅ Terhubung ke Wi-Fi!");
    Serial.print("SSID Connected : "); Serial.println(WiFi.SSID());
    Serial.print("IP Address     : "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n⚠️ Wi-Fi tidak terhubung, akan terus dicoba pada background.");
  }
}

void kirimDataJSON(float s1, float s2, float s3, float kedalaman, float ph, float doVal) {
  if (wifiMulti.run() == WL_CONNECTED) {
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
    doc["suhu1"]      = s1;
    doc["suhu2"]      = s2;
    doc["suhu3"]      = s3;
    doc["kedalaman"]  = kedalaman;
    doc["ph"]         = ph;
    doc["do"]         = doVal;
    doc["device_id"]  = "ESP32_POND_MONITOR_01";
    doc["status_log"] = statusLog;

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
      String response = http.getString();
      Serial.print("Response Web App: ");
      Serial.println(response);
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
// 4. MAIN SETUP & SCHEDULED LOOP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("==================================================");
  Serial.println(" SYSTEM MONITORING KUALITAS AIR INTERAKSI SERVER ");
  Serial.println("==================================================");

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(DE_RE_PIN, OUTPUT);
  digitalWrite(DE_RE_PIN, LOW);

  Serial2.begin(9600, SERIAL_8N1, RX2_PIN, TX2_PIN);
  Wire.begin(21, 22);
  sensors.begin();

  if (!ads.begin(0x48)) {
    Serial.println("⚠️ Warning: ADS1115 Tidak Terdeteksi!");
  }

  initMultiWiFi();

  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("Menyesuaikan waktu via NTP...");
}

void loop() {
  wifiMulti.run();

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Gagal mendapatkan waktu NTP! Mencoba lagi...");
    delay(2000);
    return;
  }

  int menitSekarang = timeinfo.tm_min;
  int detikSekarang = timeinfo.tm_sec;

  // Transmisi Real-Time di Menit :00 dan :30
  if ((menitSekarang == 0 && !sudahKirimMenit00) || (menitSekarang == 30 && !sudahKirimMenit30)) {
    
    float suhu1, suhu2, suhu3;
    bacaSuhuAll(suhu1, suhu2, suhu3);
    float kedalaman = bacaKedalamanAir();
    float ph        = bacaPHAir();
    float doVal     = bacaDORemond();

    Serial.printf("\n[WAKTU REAL-TIME: %02d:%02d:%02d]\n", timeinfo.tm_hour, menitSekarang, detikSekarang);
    Serial.printf("Suhu Surface : %.2f °C | Middle : %.2f °C | Bottom : %.2f °C\n", suhu1, suhu2, suhu3);
    Serial.printf("Kedalaman    : %.2f cm\n", kedalaman);
    Serial.printf("pH Air       : %.2f\n", ph);
    Serial.printf("DO Remond    : %.2f mg/L\n", doVal);

    kirimDataJSON(suhu1, suhu2, suhu3, kedalaman, ph, doVal);

    if (menitSekarang == 0)  sudahKirimMenit00 = true;
    if (menitSekarang == 30) sudahKirimMenit30 = true;
  }

  if (menitSekarang != 0)  sudahKirimMenit00 = false;
  if (menitSekarang != 30) sudahKirimMenit30 = false;

  delay(1000);
}