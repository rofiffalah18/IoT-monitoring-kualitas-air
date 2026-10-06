#define TINY_GSM_MODEM_SIM800  // Harus ditulis sebelum #include <TinyGsmClient.h>

#include <HardwareSerial.h>
#include <TinyGsmClient.h>
#include <PubSubClient.h>

// --- PIN SERIAL SIM800L ---
#define SIM800_RX_PIN 17  // ESP32 RX1 -> Ke TX SIM800L
#define SIM800_TX_PIN 4   // ESP32 TX1 -> Ke RX SIM800L

// --- CONFIG OPERATOR & BROKER ---
const char apn[]      = "internet"; // Ganti sesuai kartu SIM Anda
const char gprsUser[] = "";
const char gprsPass[] = "";

const char* mqttBroker = "broker.hivemq.com";
const int   mqttPort   = 1883;
const char* mqttTopic  = "test/esp32_sim800l/status"; // Topik untuk uji coba

HardwareSerial simSerial(1);
TinyGsm        modem(simSerial);
TinyGsmClient  client(modem);
PubSubClient   mqtt(client);

// ============================================================
// UJI COBA KONEKSI GPRS (INTERNET)
// ============================================================
bool hubungkanGPRS() {
  Serial.print("[GPRS] Mengubungkan ke APN: ");
  Serial.println(apn);

  if (!modem.gprsConnect(apn, gprsUser, gprsPass)) {
    Serial.println("❌ [GPRS] Gagal Konek Internet! Cek kuota/pulsa/APN.");
    return false;
  }
  Serial.println("✅ [GPRS] Terhubung ke Internet!");
  return true;
}

// ============================================================
// UJI COBA KONEKSI & PUBLISH MQTT
// ============================================================
void tesKirimMQTT() {
  // 1. Cek Koneksi GPRS
  if (!modem.isGprsConnected()) {
    if (!hubungkanGPRS()) return;
  }

  // 2. Hubungkan ke Broker MQTT jika belum terhubung
  if (!mqtt.connected()) {
    Serial.print("[MQTT] Menghubungkan ke Broker ");
    Serial.print(mqttBroker);
    Serial.println("...");

    String clientId = "ESP32_Test_" + String(random(0xffff), HEX);

    if (mqtt.connect(clientId.c_str())) {
      Serial.println("✅ [MQTT] Terhubung ke Broker!");
    } else {
      Serial.print("❌ [MQTT] Gagal Konek! Kode Error: ");
      Serial.println(mqtt.state());
      return;
    }
  }

  // 3. Buat Pesan Uji Coba (Format JSON)
  String pesan = "{\"status\":\"online\", \"pesan\":\"Uji Coba MQTT SIM800L Berhasil!\", \"rssi\":" + String(modem.getSignalQuality()) + "}";

  Serial.print("[MQTT] Mempublikasikan ke Topik: ");
  Serial.println(mqttTopic);
  Serial.print("[MQTT] Isi Pesan: ");
  Serial.println(pesan);

  // 4. Kirim / Publish Data
  if (mqtt.publish(mqttTopic, pesan.c_str())) {
    Serial.println("🎉 [SUKSES] Data MQTT Berhasil Terkirim ke Broker!\n");
  } else {
    Serial.println("❌ [GAGAL] Pesan Gagal Terkirim ke Broker!\n");
  }

  mqtt.loop();
}

// ============================================================
// SETUP & LOOP
// ============================================================
void setup() {
  Serial.begin(115200);

  // Start Serial SIM800L
  simSerial.begin(9600, SERIAL_8N1, SIM800_RX_PIN, SIM800_TX_PIN);

  Serial.println("\n==========================================");
  Serial.println("     UJI COBA KONEKSI MQTT VIA SIM800L    ");
  Serial.println("==========================================");
  
  Serial.println("Menginisialisasi modem...");
  modem.restart(); // Restart modul SIM800L
  
  String modemInfo = modem.getModemInfo();
  Serial.print("Modem Info: ");
  Serial.println(modemInfo);

  // Set Broker MQTT
  mqtt.setServer(mqttBroker, mqttPort);

  // Jalankan Uji Coba Pertama
  tesKirimMQTT();
}

void loop() {
  // Jalankan pengujian ulang setiap 15 detik
  tesKirimMQTT();
  
  delay(15000); 
}
