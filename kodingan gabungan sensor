#include <OneWire.h>
#include <DallasTemperature.h>
#include <ModbusMaster.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>

// ============================================================
// 1. CONFIG PIN SENSOR
// ============================================================
// Pin Suhu DS18B20
#define ONE_WIRE_BUS 16

// Pin Ultrasonik AJ-SR04M
#define TRIG_PIN 18
#define ECHO_PIN 19

// Pin Modbus RS485 (DO Sensor)
#define RX2_PIN      26
#define TX2_PIN      27
#define MAX485_DE_RE 14

// Pin I2C ADS1115 (pH Sensor)
#define SDA_PIN 21
#define SCL_PIN 22


// ============================================================
// 2. INISIALISASI OBJEK & ALAMAT
// ============================================================
// Objek DS18B20
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// Alamat HEX Sensor Suhu (GANTI DENGAN KODE ANDA)
DeviceAddress sensor1Addr = { 0x28, 0xFF, 0x64, 0x1E, 0x82, 0x17, 0x04, 0x56 };
DeviceAddress sensor2Addr = { 0x28, 0xFF, 0x33, 0x21, 0x82, 0x17, 0x05, 0x89 };
DeviceAddress sensor3Addr = { 0x28, 0xFF, 0x12, 0x10, 0x82, 0x17, 0x01, 0x12 };

// Objek Modbus RS485 (DO)
ModbusMaster node;

// Objek ADS1115 (pH)
Adafruit_ADS1115 ads;

// ============================================================
// 3. VARIABEL GLOBAL DATA SENSOR
// ============================================================
float suhu1 = 0.0, suhu2 = 0.0, suhu3 = 0.0;
float jarakAir = 0.0;
float nilaiDO = 0.0, suhuDO = 0.0;
float nilaipH = 0.0, teganganpH = 0.0;
float phOffset = 0.0; // Sesuaikan untuk kalibrasi pH


// ============================================================
// CALLBACK MAX485 (TRANSMIT / RECEIVE)
// ============================================================
void preTransmission()  { digitalWrite(MAX485_DE_RE, HIGH); }
void postTransmission() { digitalWrite(MAX485_DE_RE, LOW);  }


// ============================================================
// VOID 1: BACA 3 SENSOR SUHU (DS18B20)
// ============================================================
void suhu() {
  sensors.requestTemperatures();

  suhu1 = sensors.getTempC(sensor1Addr);
  suhu2 = sensors.getTempC(sensor2Addr);
  suhu3 = sensors.getTempC(sensor3Addr);

  Serial.print("[SUHU] S1: ");
  if (suhu1 == DEVICE_DISCONNECTED_C) Serial.print("Err"); else { Serial.print(suhu1, 1); Serial.print(" °C"); }

  Serial.print(" | S2: ");
  if (suhu2 == DEVICE_DISCONNECTED_C) Serial.print("Err"); else { Serial.print(suhu2, 1); Serial.print(" °C"); }

  Serial.print(" | S3: ");
  if (suhu3 == DEVICE_DISCONNECTED_C) Serial.print("Err"); else { Serial.print(suhu3, 1); Serial.print(" °C"); }

  Serial.println();
}


// ============================================================
// VOID 2: BACA KEDALAMAN (AJ-SR04M)
// ============================================================
void kedalaman() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    jarakAir = -1;
    Serial.println("[KEDALAMAN] Error / Di luar jangkauan");
  } else {
    jarakAir = (duration * 0.034) / 2.0;
    Serial.print("[KEDALAMAN] Jarak Air: ");
    Serial.print(jarakAir, 1);
    Serial.println(" cm");
  }
}


// ============================================================
// VOID 3: BACA DO SENSOR RS485
// ============================================================
void doSensor() {
  uint8_t result = node.readHoldingRegisters(0x0000, 2);

  if (result == node.ku8MBSuccess) {
    uint16_t rawDO = node.getResponseBuffer(0);
    uint16_t rawSuhu = node.getResponseBuffer(1);

    nilaiDO = rawDO / 100.0;
    suhuDO = rawSuhu / 10.0;

    Serial.print("[DO RS485] Oksigen: ");
    Serial.print(nilaiDO, 2);
    Serial.print(" mg/L | Suhu Probe: ");
    Serial.print(suhuDO, 1);
    Serial.println(" °C");
  } else {
    Serial.print("[DO RS485] Error Modbus Kode: 0x");
    Serial.println(result, HEX);
  }
}


// ============================================================
// VOID 4: BACA PH VIA ADS1115 (A0)
// ============================================================
void ph() {
  int32_t totalRaw = 0;
  int jumlahSampel = 10;

  for (int i = 0; i < jumlahSampel; i++) {
    totalRaw += ads.readADC_SingleEnded(0); // A0
    delay(10);
  }

  int16_t avgRaw = totalRaw / jumlahSampel;
  teganganpH = ads.computeVolts(avgRaw);
  nilaipH = 3.5 * teganganpH + phOffset;

  Serial.print("[pH ADS1115] Tegangan: ");
  Serial.print(teganganpH, 3);
  Serial.print(" V | Nilai pH: ");
  Serial.println(nilaipH, 2);
}


// ============================================================
// SETUP PROGRAM
// ============================================================
void setup() {
  Serial.begin(115200);

  // 1. Setup DS18B20
  sensors.begin();
  sensors.setResolution(sensor1Addr, 12);
  sensors.setResolution(sensor2Addr, 12);
  sensors.setResolution(sensor3Addr, 12);

  // 2. Setup AJ-SR04M
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  // 3. Setup DO RS485
  pinMode(MAX485_DE_RE, OUTPUT);
  digitalWrite(MAX485_DE_RE, LOW);
  Serial2.begin(9600, SERIAL_8N1, RX2_PIN, TX2_PIN);
  node.begin(1, Serial2);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);

  // 4. Setup ADS1115 (pH)
  Wire.begin(SDA_PIN, SCL_PIN);
  if (!ads.begin(0x48, &Wire)) {
    Serial.println("❌ ADS1115 Tidak Terdeteksi!");
  } else {
    ads.setGain(GAIN_ONE); // Multiplier +/- 4.096V
  }

  Serial.println("\n==============================================");
  Serial.println("   SISTEM PEMBACAAN 4 SENSOR GABUNGAN (ESP32)  ");
  Serial.println("==============================================");
}


// ============================================================
// LOOP UTAMA
// ============================================================
void loop() {
  Serial.println("\n--- PEMBACAAN DATA SENSOR ---");
  
  suhu();       // Baca Suhu DS18B20
  kedalaman();  // Baca Ultrasonik
  doSensor();   // Baca DO RS485
  ph();         // Baca pH via ADS1115

  Serial.println("----------------------------------------------");
  delay(3000); // Pembacaan ulang setiap 3 detik
}
