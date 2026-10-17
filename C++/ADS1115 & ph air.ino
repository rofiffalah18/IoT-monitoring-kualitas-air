#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>

Adafruit_ADS1115 ads;

// Nilai Kalibrasi
const float TEGANGAN_PH_7 = 1500.0; 
const float PH_PER_MV     = 0.004;  // Diubah dari 0.0035 ke 0.004

// Helper Function untuk kalkulasi nilai pH
float hitungNilaiPH() {
  int16_t adc0 = ads.readADC_SingleEnded(0);
  float teganganMV = ads.computeVolts(adc0) * 1000.0;

  float nilaiPH = 7.0 + ((TEGANGAN_PH_7 - teganganMV) * PH_PER_MV);
  if (nilaiPH < 0.0) nilaiPH = 0.0;
  if (nilaiPH > 14.0) nilaiPH = 14.0;

  return nilaiPH;
}

// Helper Function untuk cetak pembacaan
void bacaDanCetakPH(const char* label) {
  int16_t adc0 = ads.readADC_SingleEnded(0);
  float teganganMV = ads.computeVolts(adc0) * 1000.0;
  float nilaiPH = hitungNilaiPH();

  Serial.println(label);
  Serial.print("ADC 16-Bit Raw : ");
  Serial.println(adc0);
  Serial.print("Tegangan Po    : ");
  Serial.print(teganganMV, 1);
  Serial.println(" mV");
  Serial.print("Nilai pH Air   : ");
  Serial.print(nilaiPH, 2);

  if (nilaiPH < 6.5) {
    Serial.println(" (ASAM ⚠️)");
  } else if (nilaiPH > 8.5) {
    Serial.println(" (BASA ⚠️)");
  } else {
    Serial.println(" (IDEAL / NETRAL ✅)");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("================================================");
  Serial.println("   SYSTEM GABUNGAN: SENSOR pH VIA ADS1115 ADC  ");
  Serial.println("================================================");

  Wire.begin(21, 22);

  if (!ads.begin(0x48)) {
    Serial.println("❌ Gagal mendeteksi ADS1115! Periksa koneksi I2C.");
    while (1) { delay(1000); }
  }

  Serial.println("✅ ADS1115 Terdeteksi & Siap Membaca pH!\n");
}

void loop() {
  bacaDanCetakPH("--- HASIL PEMBACAAN KUALITAS pH AIR ---");
  Serial.println("---------------------------------------\n");
  delay(2000);
}