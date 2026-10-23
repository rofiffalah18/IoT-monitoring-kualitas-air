#include <Arduino.h>

#define TRIG_PIN 5
#define ECHO_PIN 18

// Kalibrasi Tinggi Maksimal Wadah/Kolam dari Sensor ke Dasar (dalam cm)
const float TINGGI_MAX_KOLAM = 200.0;

// Function helper untuk membaca jarak rata-rata dari sensor ultrasonik
float hitungJarakRataRata(int jumlahSampel) {
  float totalJarak = 0.0;
  int sampelValid = 0;

  for (int i = 0; i < jumlahSampel; i++) {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    long durasi = pulseIn(ECHO_PIN, HIGH, 30000);
    float jarak = (durasi * 0.034) / 2.0;

    if (jarak >= 2.0 && jarak <= 400.0) {
      totalJarak += jarak;
      sampelValid++;
    }
    delay(30);
  }

  if (sampelValid > 0) {
    return totalJarak / sampelValid;
  } else {
    return -1.0; // Return -1 jika sensor timeout / error
  }
}

// Function modular untuk kalkulasi dan cetak kedalaman air
void bacaDanCetakKedalaman(const char* label, float tinggiKolam) {
  float jarakKeAir = hitungJarakRataRata(5);

  Serial.println(label);

  if (jarakKeAir < 0) {
    Serial.println("⚠️ Status: ERROR / TIMEOUT (Out of Range)");
  } else {
    float kedalamanAir = tinggiKolam - jarakKeAir;
    if (kedalamanAir < 0) kedalamanAir = 0;

    Serial.print("Jarak Sensor ke Air : ");
    Serial.print(jarakKeAir, 1);
    Serial.println(" cm");

    Serial.print("Kedalaman Air Kolam  : ");
    Serial.print(kedalamanAir, 1);
    Serial.println(" cm");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  Serial.println("================================================");
  Serial.println("  UJI SENSOR ULTRASONIK KEDALAMAN AIR (AJ-SR04M)");
  Serial.println("================================================");
}

void loop() {
  // Pemanggilan fungsi modular tunggal
  bacaDanCetakKedalaman("--- BACAAN SENSOR KEDALAMAN AIR ---", TINGGI_MAX_KOLAM);

  Serial.println("----------------------------------\n");
  delay(2000);
}