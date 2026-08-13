#include <ModbusMaster.h>

// --- PIN MODBUS RS485 (Serial2 ESP32) ---
#define RX2_PIN      26   // Hardware Serial 2 RX
#define TX2_PIN      27   // Hardware Serial 2 TX
#define MAX485_DE_RE 14   // Pin Kontrol Transmit/Receive MAX485

// Inisialisasi ModbusMaster
ModbusMaster node;

// Variabel Global Data DO
float nilaiDO = 0.0;
float suhuDO = 0.0;

// Callback untuk mengubah mode MAX485 ke Transmit (Kirim Data)
void preTransmission() {
  digitalWrite(MAX485_DE_RE, HIGH);
}

// Callback untuk mengubah mode MAX485 ke Receive (Terima Data)
void postTransmission() {
  digitalWrite(MAX485_DE_RE, LOW);
}


// ============================================================
// SINGLE VOID: BACA & TAMPILKAN SENSOR DO RS485
// ============================================================
void doSensor() {
  uint8_t result;

  // Membaca 2 Holding Register mulai dari alamat 0x0000 (Slave ID Default: 1)
  result = node.readHoldingRegisters(0x0000, 2);

  if (result == node.ku8MBSuccess) {
    // Kebanyakan sensor DO RS485 mengirimkan data dalam bentuk integer * 100
    uint16_t rawDO = node.getResponseBuffer(0);   // Register 0x0000 (Nilai DO)
    uint16_t rawSuhu = node.getResponseBuffer(1); // Register 0x0001 (Suhu Sensor)

    nilaiDO = rawDO / 100.0;   // Contoh: raw 785 -> 7.85 mg/L
    suhuDO = rawSuhu / 10.0;   // Contoh: raw 255 -> 25.5 °C

    Serial.print("[DO RS485] Oksigen Terlarut: ");
    Serial.print(nilaiDO, 2);
    Serial.print(" mg/L | Suhu Sensor: ");
    Serial.print(suhuDO, 1);
    Serial.println(" °C");

  } else {
    Serial.print("[DO RS485] Error Komunikasi Modbus! Kode: 0x");
    Serial.println(result, HEX);
  }
}


// ============================================================
// SETUP & LOOP
// ============================================================
void setup() {
  Serial.begin(115200);

  // Setup Pin Control MAX485
  pinMode(MAX485_DE_RE, OUTPUT);
  digitalWrite(MAX485_DE_RE, LOW); // Set mode awal ke Receive

  // Inisialisasi Hardware Serial 2 ESP32 (Baudrate Modbus bawaan pabrik biasanya 9600)
  Serial2.begin(9600, SERIAL_8N1, RX2_PIN, TX2_PIN);

  // Inisialisasi Modbus Master pada Slave ID 1
  node.begin(1, Serial2);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);

  Serial.println("\n--- Pengujian Sensor DO RS485 Modbus RTU (GPIO 26 & 27) ---");
}

void loop() {
  // Cukup panggil 1 void ini saja
  doSensor();

  delay(2000); // Pembacaan ulang tiap 2 detik
}
