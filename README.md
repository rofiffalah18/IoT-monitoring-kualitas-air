# IoT-monitoring-kualitas-air
pH, suhu, kedalaman (menggunakan ultrasonik), dan kadar oksigen

# 🔌 Pinout & Power Distribution Matrix

Tabel berikut merangkum seluruh pemetaan pinout, koneksi sinyal, dan distribusi jalur daya untuk sistem monitoring berbasis **ESP32**.

---

### 📋 Tabel Master Koneksi System

| Modul / Komponen | Pin Modul | Sambungan Ke | Tegangan / Sumber Daya | Keterangan & Catatan Khusus |
| :--- | :--- | :--- | :--- | :--- |
| **Adaptor 12V DC** | Output (+) 12V | Input (+) Step-Down & VCC Sensor DO | **12V DC (Utama)** | Sumber listrik utama seluruh sistem |
| | Output (-) GND | **Common GND** | **0V (GND)** | **Wajib disambung ke semua GND komponen** |
| **Step-Down LM2596** *(Set 4.0V)* | IN (+ / -) | Out (+ / -) Adaptor 12V | 12V DC Input | Menurunkan tegangan dari 12V ke 4.0V |
| | OUT (+) | **VCC SIM800L** *(Anoda Dioda)* | **4.0V DC Output** | Mampu menangani lonjakan arus hingga 2A (Peak GSM) |
| | OUT (-) | **Common GND** | 0V (GND) | Ground Step-Down |
| **Dioda 1N4007** *(Opsional)* | Anoda (+) | Out (+) Step-Down 4.0V | 4.0V DC | Dipasang seri jika Out Step-Down di-set 4.7V |
| | Katoda (-) | VCC SIM800L | **~4.0V DC** | Menurunkan tegangan (~0.7V drop) & cegah arus balik |
| **ESP32 Board** | VIN / 5V | Power USB / Out 5V External | **5V DC** | Daya utama microkontroller ESP32 |
| | GND | **Common GND** | 0V (GND) | Ground ESP32 |
| | 3.3V Out | VCC DS18B20, ADS1115, RTC | **3.3V DC** | Daya logika internal sensor |
| **3x DS18B20** *(Suhu)* | VCC (Merah) | 3.3V ESP32 | 3.3V DC | VCC dipasang secara paralel |
| | GND (Hitam) | Common GND | 0V (GND) | Ground dipasang secara paralel |
| | DATA (Kuning)| **GPIO 16 ESP32** | 3.3V Logic | **Wajib pasang Resistor Pull-Up 4.7kΩ ke 3.3V** |
| **AJ-SR04M** *(Kedalaman)* | VCC | VIN (5V ESP32) | 5V DC | Butuh daya 5V agar jangkauan pembacaan maksimal |
| | GND | Common GND | 0V (GND) | Ground Ultrasonik |
| | TRIG | **GPIO 18 ESP32** | 3.3V/5V Logic | Sinyal Pemicu Pulsa |
| | ECHO | **GPIO 19 ESP32** | 3.3V/5V Logic | Sinyal Terima Pantulan |
| **Sensor DO** *(RS485)* | VCC (Merah) | Out (+) Adaptor 12V | **12V DC** | Sensor DO membutuhkan daya eksternal 12V |
| | GND (Hitam) | Common GND | 0V (GND) | Ground Sensor DO |
| | A (Kuning) | Pin A Modul MAX485 | RS485 Differential | Bus Data RS485 A (+) |
| | B (Hijau) | Pin B Modul MAX485 | RS485 Differential | Bus Data RS485 B (-) |
| **Modul MAX485** | VCC | VIN (5V ESP32) | 5V DC | Daya Modul Transceiver RS485 |
| | GND | Common GND | 0V (GND) | Ground MAX485 |
| | RO | **GPIO 26 ESP32** | Serial Logic (RX2) | Receiver Out ke ESP32 Hardware Serial 2 |
| | DI | **GPIO 27 ESP32** | Serial Logic (TX2) | Driver In dari ESP32 Hardware Serial 2 |
| | DE & RE | **GPIO 14 ESP32** *(Jumper)* | Digital Output | Kontrol Direction Transmit/Receive RS485 |
| **Modul Sensor pH** | VCC | VIN (5V ESP32) | 5V DC | Daya Op-Amp Modul pH |
| | GND | Common GND | 0V (GND) | Ground Modul pH |
| | Po / AOUT | **Pin A0 ADS1115** | Analog Voltage (mV) | Output Sinyal Analog pH ke ADC ADS1115 |
| **Modul ADS1115** *(ADC)* | VDD | 3.3V ESP32 | 3.3V DC | Daya Modul ADC 16-Bit |
| | GND / ADDR | Common GND | 0V (GND) | ADDR ke GND = Set Alamat I2C `0x48` |
| | SDA | **GPIO 21 ESP32** | I2C Data | Bus I2C (Paralel dengan RTC DS3231) |
| | SCL | **GPIO 22 ESP32** | I2C Clock | Bus I2C (Paralel dengan RTC DS3231) |
| | A0 (AIN0) | Pin Po Modul pH | Analog Input | Membaca Sinyal pH dengan Presisi 16-Bit |
| **RTC DS3231** *(Clock)* | VCC | 3.3V ESP32 | 3.3V DC | Daya Modul Real-Time Clock |
| | GND | Common GND | 0V (GND) | Ground RTC |
| | SDA | **GPIO 21 ESP32** | I2C Data | Bus I2C (Paralel dengan ADS1115) |
| | SCL | **GPIO 22 ESP32** | I2C Clock | Bus I2C (Paralel dengan ADS1115) |
| **SIM800L** *(GSM/GPRS)*| VCC | Out Step-Down / Dioda | **3.7V - 4.2V DC** | **Wajib 4.0V terregulasi (Peak Current 2A)** |
| | GND | Common GND | 0V (GND) | Ground SIM800L |
| | TX | **GPIO 17 ESP32** | Serial Logic (RX1) | ESP32 Menerima Data dari SIM800L |
| | RX | **GPIO 4 ESP32** | Serial Logic (TX1) | ESP32 Mengirim Data ke SIM800L |

---

> [!IMPORTANT]
> **Catatan Penting Pemasangan Hardware:**
> 1. **Common Ground (GND Bersama):** Seluruh titik GND dari Adaptor 12V, Step-Down, ESP32, MAX485, ADS1115, Sensor pH, Sensor DO, dan SIM800L **WAJIB** terhubung menjadi satu jalur (*Common Ground*).
> 2. **Tegangan SIM800L:** Sebelum menghubungkan VCC SIM800L, ukur dan pastikan output Step-Down menggunakan Multimeter berada di kisaran **4.0V - 4.2V**.
> 3. **Pull-Up Resistor:** Pasang 1 buah resistor $4.7\text{k}\Omega$ antara pin **DATA (GPIO 16)** dan **VCC (3.3V)** pada bus sensor suhu DS18B20.
