// --- PIN SENSOR AJ-SR04M ---
#define TRIG_PIN 18     // GPIO 18 ESP32 -> Ke TRIG AJ-SR04M
#define ECHO_PIN 19     // GPIO 19 ESP32 -> Ke ECHO AJ-SR04M

// ============================================================
// SINGLE VOID: BACA & TAMPILKAN JARAK SENSOR AJ-SR04M
// ============================================================
void ultrasonik() {
  // 1. Kirim sinyal trigger 10us
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // 2. Baca durasi pantulan echo (timeout 30ms ~ maks 5 meter)
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  // 3. Hitung jarak (cm) & Tampilkan ke Serial Monitor
  if (duration == 0) {
    Serial.println("[AJ-SR04M] Error: Objek terlalu dekat (<20cm), di luar jangkauan (>5m), atau tidak ada pantulan!");
  } else {
    float jarak = (duration * 0.034) / 2.0; // Rumus kecepatan suara (0.034 cm/us)
    
    Serial.print("[AJ-SR04M] Jarak Terdeteksi: ");
    Serial.print(jarak, 1);
    Serial.println(" cm");
  }
}

// ============================================================
// SETUP & LOOP
// ============================================================
void setup() {
  Serial.begin(115200);

  // Konfigurasi Mode Pin
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  Serial.println("\n--- Pengujian Sensor Ultrasonik AJ-SR04M ---");
}

void loop() {
  // Panggil 1 void ini saja
  ultrasonik();

  delay(2000); // Pembacaan ulang tiap 2 detik
}
