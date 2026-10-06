#include <Wire.h>
#include <Adafruit_ADS1X15.h>

// Inisialisasi Objek ADS
Adafruit_ADS1115 ads;

// --- KALIBRASI PH ---
// Ubah offset ini jika hasil pembacaan pH belum pas dengan cairan kalibrasi
float phOffset = 0.0; 

// Variabel Global Data pH
float nilaipH = 0.0;
float teganganpH = 0.0;


// ============================================================
// VOID PH (Membaca Sensor pH melalui Modul ADS Channel A0)
// ============================================================
void ph() {
  int32_t totalRaw = 0;
  int jumlahSampel = 10;

  // 1. Ambil 10 sampel pembacaan dari Channel A0 ADS agar data stabil
  for (int i = 0; i < jumlahSampel; i++) {
    totalRaw += ads.readADC_SingleEnded(0); // Read A0
    delay(10);
  }

  // 2. Hitung rata-rata RAW ADC
  int16_t avgRaw = totalRaw / jumlahSampel;

  // 3. Hitung Tegangan Presisi dari ADS (Volt)
  teganganpH = ads.computeVolts(avgRaw);

  // 4. Rumus Konversi Tegangan ke Nilai pH (Standar: 2.5V = pH 7)
  nilaipH = 3.5 * teganganpH + phOffset;

  // 5. Tampilkan ke Serial Monitor
  Serial.print("[pH via ADS] Raw ADC: ");
  Serial.print(avgRaw);
  Serial.print(" | Tegangan: ");
  Serial.print(teganganpH, 4); // 4 digit presisi
  Serial.print(" V | Nilai pH: ");
  Serial.println(nilaipH, 2);
}
