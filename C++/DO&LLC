#include <Arduino.h>

#define RX2_PIN 16
#define TX2_PIN 17
#define DE_RE_PIN 15

// Command Frame Modbus RTU Remond RMD-ISDTY105 (Slave ID: 0x01, Read Holding Registers: 0x03)
const byte requestFrameDO[] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B};

// Void helper untuk membaca dan mencetak data DO dari sensor Remond
void bacaDanCetakDORemondLLC(const char* label) {
  byte responseBuffer[11];

  Serial.println(label);

  // 1. Set MAX485 ke Mode Transmit (Kirim Request ke Sensor)
  digitalWrite(DE_RE_PIN, HIGH);
  delay(5);
  Serial2.write(requestFrameDO, sizeof(requestFrameDO));
  Serial2.flush();

  // 2. Set MAX485 ke Mode Receive (Terima Balasan via LLC Channel 2)
  digitalWrite(DE_RE_PIN, LOW);
  delay(5);

  // 3. Tunggu data balasan dari sensor DO (timeout 500ms)
  unsigned long startTime = millis();
  while (Serial2.available() < 9 && millis() - startTime < 500) {
    delay(1);
  }

  // 4. Jika data masuk lengkap (9 Byte response)
  if (Serial2.available() >= 9) {
    for (int i = 0; i < 9; i++) {
      responseBuffer[i] = Serial2.read();
    }

    // Parsing data integer 16-bit dari buffer Modbus Remond
    int16_t rawValue = (responseBuffer[3] << 8) | responseBuffer[4];
    float kadarDO = rawValue / 100.0; // Konversi pembagian 100 untuk skala 0.00 - 20.00 mg/L

    Serial.print("Kadar Oksigen Terlarut (DO) : ");
    Serial.print(kadarDO, 2);
    Serial.println(" mg/L (ppm)");

    // Evaluasi Kelayakan Air Kolam
    if (kadarDO < 3.0) {
      Serial.println("Status Kualitas Air         : BAHAYA / ANOSIA ⚠️");
    } else if (kadarDO < 5.0) {
      Serial.println("Status Kualitas Air         : WASPADA ⚠️");
    } else {
      Serial.println("Status Kualitas Air         : IDEAL / SEHAT ✅");
    }
  } else {
    Serial.println("⚠️ Status Error: TIMEOUT / TIDAK ADA RESPON DARI SENSOR REMOND");
    Serial.println("   Cek: VCC 12V Sensor, Common GND, atau tukar posisi Kabel Biru (A) & Putih (B).");
    while (Serial2.available()) Serial2.read(); // Clear buffer sisa
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(DE_RE_PIN, OUTPUT);
  digitalWrite(DE_RE_PIN, LOW);

  // Inisialisasi UART2 Serial pada Baudrate 9600
  Serial2.begin(9600, SERIAL_8N1, RX2_PIN, TX2_PIN);

  Serial.println("================================================");
  Serial.println("  SYSTEM UTAMA: SENSOR DO REMOND VIA LLC & MAX485");
  Serial.println("================================================");
}

void loop() {
  bacaDanCetakDORemondLLC("--- HASIL PEMBACAAN SENSOR DO REMOND ---");
  Serial.println("----------------------------------------\n");
  delay(2000);
}