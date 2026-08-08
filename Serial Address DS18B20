#include <OneWire.h>
#include <DallasTemperature.h>

#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

DeviceAddress tempDeviceAddress;

void setup() {
  Serial.begin(115200);
  sensors.begin();
  
  int numberOfDevices = sensors.getDeviceCount();
  Serial.print("Jumlah sensor terdeteksi: ");
  Serial.println(numberOfDevices);

  for (int i = 0; i < numberOfDevices; i++) {
    if (sensors.getAddress(tempDeviceAddress, i)) {
      Serial.print("Sensor ");
      Serial.print(i + 1);
      Serial.print(" Address: ");
      printAddress(tempDeviceAddress);
      Serial.println();
    }
  }
}

void loop() {}

void printAddress(DeviceAddress deviceAddress) {
  for (uint8_t i = 0; i < 8; i++) {
    if (deviceAddress[i] < 16) Serial.print("0");
    Serial.print(deviceAddress[i], HEX);
    if (i < 7) Serial.print(", 0x");
  }
}
