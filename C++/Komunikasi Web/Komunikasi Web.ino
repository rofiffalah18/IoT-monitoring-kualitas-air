#include <Arduino.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============================================================================
// 1. KREDENSIAL MULTI-WIFI & URL GOOGLE APPS SCRIPT
// ============================================================================
WiFiMulti wifiMulti;

// Ganti URL ini dengan Web App URL dari Google Apps Script kamu
const char* serverURL = "HTTPS://SCRIPT.GOOGLE.COM/MACROS/S/YOUR_SCRIPT_ID/EXEC";

// ============================================================================
// 2. FUNGSI INISIALISASI MULTI-WIFI
// ============================================================================
void initMultiWiFi() {
  // Tambahkan beberapa daftar jaringan Wi-Fi (Wi-Fi Utama, Backup, Modem USB/Hotspot)
  wifiMulti.addAP("WiFi_Kolam_Utama", "password123");
  wifiMulti.addAP("WiFi_Backup_Router", "password456");
  wifiMulti.addAP("Hotspot_Modem_USB", "internet123");

  Serial.println("Mencari & Menghubungkan ke jaringan Wi-Fi terkuat...");
  
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
    Serial.println("\n⚠️ Gagal terhubung ke seluruh Wi-Fi! Mencoba lagi di background...");
  }
}

// ============================================================================
// 3. FUNGSI GENERATE DATA DUMMY & KIRIM JSON HTTP POST
// ============================================================================
void kirimDataDummyJSON() {
  // Pastikan koneksi Wi-Fi aktif
  if (wifiMulti.run() == WL_CONNECTED) {
    HTTPClient http;
    
    // Generasi Angka Simulasi / Dummy Sensor (Sesuai Batas Normal Kualitas Air)
    float dummySuhu1     = random(270, 300) / 10.0; // 27.0 - 30.0 °C
    float dummySuhu2     = random(265, 290) / 10.0; // 26.5 - 29.0 °C
    float dummySuhu3     = random(250, 280) / 10.0; // 25.0 - 28.0 °C
    float dummyKedalaman = random(1200, 1800) / 10.0; // 120.0 - 180.0 cm
    float dummyPH        = random(68, 82) / 10.0;    // 6.8 - 8.2 pH
    float dummyDO        = random(55, 85) / 10.0;    // 5.5 - 8.5 mg/L

    // Buat Payload JSON
    StaticJsonDocument<300> doc;
    doc["suhu1"]      = dummySuhu1;
    doc["suhu2"]      = dummySuhu2;
    doc["suhu3"]      = dummySuhu3;
    doc["kedalaman"]  = dummyKedalaman;
    doc["ph"]         = dummyPH;
    doc["do"]         = dummyDO;
    doc["device_id"]  = "ESP32_TEST_DUMMY_01";

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    Serial.println("\n--- Mengirim Payload JSON Dummy ---");
    Serial.println(jsonPayload);

    // Mulai koneksi HTTP
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    
    // Wajib untuk Google Apps Script agar menangani auto-redirect (302)
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

    // Kirim HTTP POST
    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      Serial.print("