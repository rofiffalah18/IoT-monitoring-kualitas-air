#include <OneWire.h>
#include <DallasTemperature.h>

#define ONE_WIRE_BUS 4

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// ============================================================================
// ISI ALAMAT ROM FISIK MASING-MASING SENSOR (Hasil Scan Serial Monitor)
// ============================================================================
// Ganti kode HEX di bawah ini dengan alamat asli sensor kamu!
DeviceAddress sensorSurface = { 0x28, 0xFF, 0x64, 0x1E, 0x82, 0x17, 0x04, 0x5D };
DeviceAddress sensorMiddle  = { 0x28, 0xFF, 0x31, 0x1E, 0x82, 0x17, 0x05, 0xA1 };
DeviceAddress sensorBottom  = { 0x28, 0xFF, 0x90, 0x1E, 0x82, 0x17, 0x06, 0x22 };

void bacaDanCetakSuhu(const char* label, DeviceAddress address) {
  float suhu = sensors.getTempC(address);
  
  Serial.print(label);
  Serial.print(" : ");
  
  if (suhu == DEVICE_DISCONNECTED_C) {
    Serial.println("ERROR / TERPUTUS (-127°C)");
  } else {
    Serial.print(suhu);
    Serial.println(" °C");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("================================================");
  Serial.println("   MONITORING SUHU DENGAN ROM ADDRESS LOCKED    ");
  Serial.println("================================================");

  sensors.begin();
  
  // Set resolusi pembacaan (9-12 bit). 10-bit atau 11-bit lebih cepat dibanding 12-bit
  sensors.setResolution(sensorSurface, 11);
  sensors.setResolution(sensorMiddle, 11);
  sensors.setResolution(sensorBottom, 11);

  Serial.println("Perangkat berhasil diinisialisasi secara terkunci!\n");
}

void loop() {
  sensors.requestTemperatures();

  Serial.println("--- HASIL PEMBACAAN SUHU ---");
  
  // Pembacaan dipanggil murni berdasarkan Alamat ROM Permanen
  bacaDanCetakSuhu("Suhu 1 (Surface)", sensorSurface);
  bacaDanCetakSuhu("Suhu 2 (Middle) ", sensorMiddle);
  bacaDanCetakSuhu("Suhu 3 (Bottom) ", sensorBottom);

  Serial.println("----------------------------\n");

  delay(2000);
}