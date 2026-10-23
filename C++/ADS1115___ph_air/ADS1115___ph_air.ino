#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>

Adafruit_ADS1115 ads;

const float TEGANGAN_PH_7 = 1500.0;
const float PH_PER_MV     = 0.004;

// Function helper untuk menghitung pH
float hitungNilaiPH(float teganganMV) {
  float nilaiPH = 7.0 + ((TEGANGAN_PH_7 - teganganMV) * PH_PER_MV);
  if (nilaiPH < 0.0) nilaiPH = 0.0;
  if (nilaiPH > 14.0) nilaiPH = 14.0;
  return nilaiPH;
}

// Void khusus pembacaan gabungan pH via ADS1115
void bacaDanCetakPHGabungan(const char* label, uint8_t channel) {
  int16_t adcRaw = ads.readADC_SingleEnded(channel);
  float teganganMV = ads.computeVolts(adcRaw) * 1000.0;
  float nilaiPH = hitungNilaiPH(teganganMV);

  Serial.println(label);
  Serial.print("ADC 16-Bit Raw : ");
  Serial.println(adcRaw);

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
  bacaDanCetakPHGabungan("--- HASIL PEMBACAAN pH AIR (ADS1115) ---", 0);
  Serial.println("----------------------------------------\n");
  delay(2000);
}