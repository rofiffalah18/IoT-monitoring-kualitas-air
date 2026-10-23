#include <Wire.h>
#include <RTClib.h>
#include <Adafruit_ADS1X15.h>

// Objek I2C
RTC_DS3231 rtc;
Adafruit_ADS1115 ads;

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22); // Inisialisasi I2C (SDA=21, SCL=22)

  // Inisialisasi RTC
  if (!rtc.begin()) {
    Serial.println("RTC tidak terdeteksi!");
    while (1);
  }

  // Jika RTC kehilangan daya (baterai habis/baru pasang), set ke waktu kompilasi
  if (rtc.lostPower()) {
    Serial.println("RTC kehilangan daya, mengatur waktu...");
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }

  // Inisialisasi ADS
  if (!ads.begin()) {
    Serial.println("ADS1115 tidak terdeteksi!");
    while (1);
  }
}

void loop() {
  DateTime now = rtc.now(); // Baca waktu saat ini dari RTC

  int jamSekarang = now.hour(); // Mengambil nilai jam (0-23)

  // Tampilkan waktu saat ini di Serial Monitor
  Serial.print("Waktu Saat Ini: ");
  Serial.print(now.hour()); Serial.print(':');
  Serial.print(now.minute()); Serial.print(':');
  Serial.println(now.second());

  // Logika Aktif Jam 08.00 - 18.00 (Jam >= 8 DAN Jam < 18)
  if (jamSekarang >= 8 && jamSekarang < 18) {
    Serial.println("==========================================");
    Serial.println("STATUS: ALAT AKTIF (Mode Kerja 08:00 - 18:00)");
    Serial.println("==========================================");
    
    // Panggil fungsi pembacaan sensor-sensor Anda di sini
    bacaSemuaSensor(); 

  } else {
    Serial.println("------------------------------------------");
    Serial.println("STATUS: ALAT NON-AKTIF / STANDBY (Luar Jam Kerja)");
    Serial.println("------------------------------------------");
    
    // Di sini bisa dikosongkan, atau buat ESP32 masuk Deep Sleep
  }

  delay(5000); // Tunda pembacaan 5 detik
}

void bacaSemuaSensor() {
  // Contoh pembacaan pH via ADS
  int16_t adc0 = ads.readADC_SingleEnded(0);
  float volts0 = ads.computeVolts(adc0);
  float ph = 3.5 * volts0;

  Serial.print("Data pH: ");
  Serial.println(ph, 2);

  // Masukkan juga logika pembacaan Suhu, DO, dan Kedalaman di sini...
}
