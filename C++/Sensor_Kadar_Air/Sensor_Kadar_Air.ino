#include <Arduino.h>

#define RX2_PIN 16
#define TX2_PIN 17
#define DE_RE_PIN 15

// Void helper untuk menguji alur kontrol direction MAX485
void ujiKomunikasiMAX485(const char* label) {
  Serial.println(label);

  // 1. Set mode Transmit (DE & RE = HIGH)
  digitalWrite(DE_RE_PIN, HIGH);
  delay(5);
  Serial2.print("PING_REMOND_RS485");
  Serial2.flush(); // Tunggu data selesai dikirim

  // 2. Set mode Receive (DE & RE = LOW)
  digitalWrite(DE_RE_PIN, LOW);
  delay(5);

  Serial.println("Sinyal Ping dikirim via TX2 (GPIO 17)...");
  Serial.println("Status MAX485 saat ini : READY RECEIVE (RX2 GPIO 16)");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(DE_RE_PIN, OUTPUT);
  digitalWrite(DE_RE_PIN, LOW); // Mode awal = Receive

  // Inisialisasi UART2 pada baudrate 9600 (Standard Remond)
  Serial2.begin(9600, SERIAL_8N1, RX2_PIN, TX2_PIN);

  Serial.println("================================================");
  Serial.println("   UJI MODE TRANSCEIVER TTL MAX485 (DIRECT)    ");
  Serial.println("================================================");
}

void loop() {
  ujiKomunikasiMAX485("--- UJI KONTROL DE/RE MAX485 ---");
  Serial.println("--------------------------------\n");
  delay(2000);
}