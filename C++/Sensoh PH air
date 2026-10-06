// --- PIN SENSOR PH AIR ANALOG ---
#define PH_PIN 35  // GPIO 35 ESP32 (ADC1 - Khusus Input Analog)

// --- KALIBRASI PH ---
// Ubah nilai offset ini jika pembacaan belum pas dengan cairan kalibrasi (pH 4 / pH 7)
float phOffset = 0.0; 

// Variabel Global Data pH
float nilaipH = 0.0;


// ============================================================
// SINGLE VOID: BACA & TAMPILKAN SENSOR PH
// ============================================================
void ph() {
  int totalADC = 0;
  int jumlahSampel = 10;

  // 1. Ambil 10 sampel pembacaan ADC agar data lebih stabil
  for (int i = 0; i < jumlahSampel; i++) {
    totalADC += analogRead(PH_PIN);
    delay(10);
  }

  // 2. Hitung rata-rata ADC (ESP32 ADC = 0 hingga 4095)
  float rataADC = (float)totalADC / jumlahSampel;

  // 3. Konversi ADC ke Tegangan (Volt) -> Asumsi Vref ESP32 = 3.3V
  float tegangan = rataADC * (3.3 / 4095.0);

  // 4. Rumus Konversi Tegangan ke Nilai pH
  // Standar modul pH: 2.5V ≈ pH 7
  nilaipH = 3.5 * tegangan + phOffset;

  // 5. Tampilkan ke Serial Monitor
  Serial.print("[pH AIR] ADC: ");
  Serial.print(rataADC, 0);
  Serial.print(" | Tegangan: ");
  Serial.print(tegangan, 2);
  Serial.print(" V | Nilai pH: ");
  Serial.print(nilaipH, 2);
  
  // Indikator sederhana kondisi air
  if (nilaipH < 6.5) {
    Serial.println(" (Asam)");
  } else if (nilaipH > 8.5) {
    Serial.println(" (Basa)");
  } else {
    Serial.println(" (Netral/Normal)");
  }
}


// ============================================================
// SETUP & LOOP
// ============================================================
void setup() {
  Serial.begin(115200);

  // Set resolusi ADC ESP32 ke 12-bit (0-4095)
  analogReadResolution(12);

  Serial.println("\n--- Pengujian Sensor pH Air Analog (GPIO 35) ---");
}

void loop() {
  // Cukup panggil 1 void ini saja
  ph();

  delay(2000); // Pembacaan ulang tiap 2 detik
}
