#define TINY_GSM_MODEM_SIM800 // PENTING: Wajib di paling atas!

#include <Wire.h>
#include <RTClib.h>
#include <HardwareSerial.h>
#include <TinyGsmClient.h>
#include <PubSubClient.h>

// ============================================================
// 1. CONFIG PIN & PARAMETER
// ============================================================
// Pin I2C (RTC DS3231)
#define SDA_PIN 21
#define SCL_PIN 22

// Pin Serial SIM800L
#define SIM800_RX_PIN 17  // ESP32 RX1 -> TX SIM800L
#define SIM800_TX_PIN 4   // ESP32 TX1 -> RX SIM800L

// Config Provider (APN) & MQTT Broker
const char apn[]      = "internet"; // Ganti sesuai kartu SIM Anda
const char gprsUser[] = "";
const char gprsPass[] = "";

const char* mqttBroker = "broker.hivemq.com";
const int   mqttPort   = 1883;
const char* mqttTopic  = "monitoring/kualitas_air/data";

// ============================================================
// 2. INISIALISASI OBJEK
// ============================================================
RTC_DS3231 rtc;
HardwareSerial simSerial(1);
TinyGsm        modem(simSerial);
TinyGsmClient  client(modem);
PubSubClient   mqtt(client);

// Variabel Kontrol Waktu
int jamSekarang = 0;
bool statusAktif = false;


// ============================================================
// VOID 1: KONEKSI GPRS SIM800L
// ============================================================
bool konekGPRS() {
  if (modem.isGprsConnected()) return true;

  Serial.print("[SIM800L] Menghubungkan ke APN GPRS: ");
  Serial.println(apn);

  if (!modem.gprsConnect(apn, gprsUser, gprsPass)) {
    Serial.println("❌ [SIM800L] Gagal Konek GPRS!");
    return false;
  }
  Serial.println("✅ [SIM800L] Terhubung ke Internet GPRS!");
  return true;
}


// ============================================================
// VOID 2: KONEKSI & PUBLISH MQTT
// ============================================================
void kirimMQTT(String payloadJSON) {
  // Pastikan GPRS terhubung
  if (!konekGPRS()) return;

  // Pastikan Broker MQTT terhubung
  if (!mqtt.connected()) {
    Serial.print("[MQTT] Menghubungkan ke Broker ");
    Serial.print(mqttBroker);
    Serial.println("...");

    String clientId = "ESP32_Control_" + String(random(0xffff), HEX);

    if (mqtt.connect(clientId.c_str())) {
      Serial.println("✅ [MQTT] Terhubung ke MQTT Broker!");
    } else {
      Serial.print("❌ [MQTT] Gagal Konek Broker, Error rc=");
      Serial.println(mqtt.state());
      return;
    }
  }

  // Publish Data ke Broker
  Serial.print("[MQTT] Mempublikasikan Data: ");
  Serial.println(payloadJSON);

  if (mqtt.publish(mqttTopic, payloadJSON.c_str())) {
    Serial.println("🎉 [SUKSES] Data Berhasil Terkirim via MQTT!");
  } else {
    Serial.println("❌ [GAGAL] Pengiriman Data MQTT Gagal!");
  }

  mqtt.loop();
}


// ============================================================
// VOID 3: CEK JADWAL OPERASIONAL RTC
// ============================================================
void rtcJadwal() {
  DateTime now = rtc.now();
  jamSekarang = now.hour();

  // Tampilkan Waktu
  Serial.print("\n[RTC WAKTU] ");
  if (now.hour() < 10) Serial.print('0');
  Serial.print(now.hour()); Serial.print(':');
  if (now.minute() < 10) Serial.print('0');
  Serial.print(now.minute()); Serial.print(':');
  if (now.second() < 10) Serial.print('0');
  Serial.println(now.second());

  // Logika Jam Kerja: 08:00 sampai 18:00 (Jam >= 8 dan Jam < 18)
  if (jamSekarang >= 8 && jamSekarang < 18) {
    statusAktif = true;
    Serial.println("🟢 STATUS: ALAT AKTIF (Mode Kerja 08.00 - 18.00)");
  } else {
    statusAktif = false;
    Serial.println("🔴 STATUS: ALAT STANDBY / MATI (Luar Jam Kerja)");
  }
}


// ============================================================
// SETUP PROGRAM
// ============================================================
void setup() {
  Serial.begin(115200);

  // 1. Setup RTC DS3231 (I2C GPIO 21 & 22)
  Wire.begin(SDA_PIN, SCL_PIN);
  if (!rtc.begin()) {
    Serial.println("❌ RTC DS3231 Tidak Terdeteksi!");
  } else {
    Serial.println("✅ RTC DS3231 Siap.");
    if (rtc.lostPower()) {
      rtc.adjust(DateTime(F(__DATE__), F(__TIME__))); // Auto sync ke waktu laptop saat compile
    }
  }

  // 2. Setup SIM800L
  simSerial.begin(9600, SERIAL_8N1, SIM800_RX_PIN, SIM800_TX_PIN);
  Serial.println("[SIM800L] Restarting Modem...");
  modem.restart();

  // 3. Setup Client MQTT
  mqtt.setServer(mqttBroker, mqttPort);

  Serial.println("\n==============================================");
  Serial.println("   SISTEM KONTROL RTC & SIM800L MQTT (ESP32)  ");
  Serial.println("==============================================");
}


// ============================================================
// LOOP UTAMA
// ============================================================
void loop() {
  // 1. Cek Jadwal Waktu
  rtcJadwal();

  // 2. Eksekusi Pengiriman jika dalam Jam Kerja
  if (statusAktif) {
    // Simulasi Payload Data (Nanti diganti variabel sensor asli)
    String dummyData = "{\"status\":\"AKTIF\", \"jam\":" + String(jamSekarang) + "}";
    
    // Panggil fungsi kirim data
    kirimMQTT(dummyData);
  } else {
    Serial.println("[SYSTEM] Menghemat daya & kuota. Tidak ada pengiriman data.");
  }

  Serial.println("----------------------------------------------");
  delay(10000); // Evaluasi ulang setiap 10 detik
}
