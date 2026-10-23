#include <Arduino.h>

#define PIN_PH_ANALOG 34

const float TEGANGAN_PH_7 = 1500.0;
const float PH_PER_MV     = 0.004;

// Void khusus untuk membaca dan mencetak pH dari pin analog bawaan ESP32
void bacaDanCetakPHDirect(const char* label, uint8_t pin) {
  int adcRaw = analogRead(pin);
  float teganganMV = (adcRaw / 4095.0) * 3300.0;
  
  float nilaiPH = 7.0 + ((TEGANGAN_PH_7 - teganganMV) * PH_PER_MV);
  if (nilaiPH < 0.0) nilaiPH = 0.0;
  if (nilaiPH > 14.0) nilaiPH = 14.0;

  Serial.println(label);
  Serial.print("ADC Raw ESP32 : ");
  Serial.println(adcRaw);

  Serial.print("Tegangan      : ");
  Serial.print(teganganMV, 1);
  Serial.println(" mV");

  Serial.print("Nilai pH      : ");
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

  analogReadResolution(12);
  
  Serial.println("================================================");
  Serial.println("   UJI SENSOR pH DIRECT (PIN ANALOG GPIO 34)   ");
  Serial.println("================================================");
}

void loop() {
  bacaDanCetakPHDirect("--- BACA pH DIRECT GPIO 34 ---", PIN_PH_ANALOG);
  Serial.println("------------------------------\n");
  delay(1000);
}