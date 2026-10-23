#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>

Adafruit_ADS1115 ads;

// Void khusus untuk membaca dan mencetak tegangan mV dari ADS1115
void bacaDanCetakTeganganADS(const char* label, uint8_t channel) {
  int16_t adcRaw = ads.readADC_SingleEnded(channel);
  float teganganMV = ads.computeVolts(adcRaw) * 1000.0;

  Serial.println(label);
  Serial.print("Data ADC Mentah Channel A");
  Serial.print(channel);
  Serial.print(" : ");
  Serial.println(adcRaw);

  Serial.print("Tegangan Terbaca       : ");
  Serial.print(teganganMV, 2);
  Serial.println(" mV");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("================================================");
  Serial.println("      UJI KONEKSI & BACA TEGANGAN ADS1115       ");
  Serial.println("================================================");

  Wire.begin(21, 22);

  if (!ads.begin(0x48)) {
    Serial.println("❌ Modul ADS1115 tidak terdeteksi! Cek kabel I2C.");
    while (1) { delay(1000); }
  }

  Serial.println("✅ Modul ADS1115 Berhasil Terhubung (Alamat 0x48)!\n");
}

void loop() {
  bacaDanCetakTeganganADS("--- BACA TEGANGAN A0 ADS1115 ---", 0);
  Serial.println("--------------------------------\n");
  delay(1000);
}