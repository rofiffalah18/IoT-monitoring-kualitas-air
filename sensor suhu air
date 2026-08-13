#include <OneWire.h>
#include <DallasTemperature.h>

// --- PIN DATA DS18B20 (GPIO 16) ---
#define ONE_WIRE_BUS 16

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// ============================================================
// MASUKKAN ALAMAT HEX HASIL SCANNER ANDA DI SINI
// ============================================================
DeviceAddress sensor1Addr = { 0x28, 0xFF, 0x64, 0x1E, 0x82, 0x17, 0x04, 0x56 }; // Ganti dengan Alamat Sensor 1
DeviceAddress sensor2Addr = { 0x28, 0xFF, 0x33, 0x21, 0x82, 0x17, 0x05, 0x89 }; // Ganti dengan Alamat Sensor 2
DeviceAddress sensor3Addr = { 0x28, 0xFF, 0x12, 0x10, 0x82, 0x17, 0x01, 0x12 }; // Ganti dengan Alamat Sensor 3

// Variabel penampung nilai suhu (°C)
float suhu1 = 0.0;
float suhu2 = 0.0;
float suhu3 = 0.0;

// ============================================================
// VOID SUHU (Membaca berdasarkan Alamat Unik HEX)
// ============================================================
void suhu() {
  sensors.requestTemperatures(); // Minta semua sensor mengukur suhu

  // Baca suhu langsung dari alamat spesifiknya
  suhu1 = sensors.getTempC(sensor1Addr);
  suhu2 = sensors.getTempC(sensor2Addr);
  suhu3 = sensors.getTempC(sensor3Addr);

  // Tampilkan Hasil ke Serial Monitor
  Serial.print("[SUHU 1] ");
  if (suhu1 == DEVICE_DISCONNECTED_C) Serial.print("Error/Terputus"); else { Serial.print(suhu1, 1); Serial.print(" °C"); }

  Serial.print(" | [SUHU 2] ");
  if (suhu2 == DEVICE_DISCONNECTED_C) Serial.print("Error/Terputus"); else { Serial.print(suhu2, 1); Serial.print(" °C"); }

  Serial.print(" | [SUHU 3] ");
  if (suhu3 == DEVICE_DISCONNECTED_C) Serial.print("Error/Terputus"); else { Serial.print(suhu3, 1); Serial.print(" °C"); }

  Serial.println();
}

// ============================================================
// SETUP & LOOP
// ============================================================
void setup() {
  Serial.begin(115200);

  // Inisialisasi Sensor Suhu
  sensors.begin();

  // Opsional: Atur resolusi pembacaan (9, 10, 11, atau 12 Bit)
  // 12-Bit = Akurasi paling tinggi (0.0625°C)
  sensors.setResolution(sensor1Addr, 12);
  sensors.setResolution(sensor2Addr, 12);
  sensors.setResolution(sensor3Addr, 12);

  Serial.println("\n--- Pengujian Pembacaan Suhu via Alamat HEX (GPIO 16) ---");
}

void loop() {
  suhu(); // Panggil fungsi void suhu

  delay(2000); // Pembacaan ulang tiap 2 detik
}
