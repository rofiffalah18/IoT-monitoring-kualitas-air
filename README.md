Berikut adalah perbaruan berkas **README / Dokumentasi Pinout & Power Distribution Matrix** yang disesuaikan dengan semua kesepakatan hardware dan komponen terbaru kita (termasuk **Mini560 Step-Down Fixed 5V**, **Logic Level Converter 4-Channel**, dan **ESP32 30-Pin**):

---

# # IoT-monitoring-kualitas-air

Monitoring Kualitas Air (pH, Suhu 3 Kedalaman, Kedalaman Air, dan Oksigen Terlarut / DO)

# 🔌 Pinout & Power Distribution Matrix

Tabel berikut merangkum seluruh pemetaan pinout, koneksi sinyal, dan distribusi jalur daya untuk sistem monitoring berbasis **ESP32 (30-Pin)**.

---

### 📋 Tabel Master Koneksi System

| Modul / Komponen | Pin Modul | Sambungan Ke | Tegangan / Sumber Daya | Keterangan & Catatan Khusus |
| --- | --- | --- | --- | --- |
| **Adaptor 12V DC** | Output (+) 12V | IN (+) Mini560 Step-Down | **12V DC (Utama)** | Sumber listrik utama seluruh sistem |
|  | Output (-) GND | **Common GND** | **0V (GND)** | **Wajib disambung ke semua GND komponen** |
| **Step-Down Mini560** *(Fixed 5V)* | IN (+ / -) | Out (+ / -) Adaptor 12V | 12V DC Input | Menurunkan tegangan dari 12V ke 5V stabil (Arus s.d 3A) |
|  | OUT (+) / VOUT+ | **Rel VCC 5V Utama** | **5.0V DC Output** | Menyuplai VIN ESP32, Sensor & Modul 5V |
|  | OUT (-) / VOUT- | **Common GND** | **0V (GND)** | Ground Step-Down |
| **ESP32 Board** *(30-Pin)* | VIN / 5V | Out (+) Mini560 (5V Rail) | **5V DC** | Catu daya utama board ESP32 |
|  | GND | **Common GND** | **0V (GND)** | Ground ESP32 (GND1/GND2/GND3 saling terhubung internal) |
|  | 3.3V Out | **LV Pin Logic Level Converter** | **3.3V DC** | Hanya sebagai tegangan acuan Sisi Low Logic (LV) LLC |
| **3x DS18B20** *(Suhu)* | VCC (Merah) | Terminal Block VCC (5V Rail) | **5V DC** | VCC sensor terhubung secara paralel |
|  | GND (Hitam) | Terminal Block GND | **0V (GND)** | Ground sensor terhubung secara paralel |
|  | DATA (Kuning/Putih) | **GPIO 4 ESP32** | 3.3V / 5V Logic | **Wajib pasang Resistor Pull-Up 4.7kΩ ke VCC (5V) di Terminal Block** |
| **AJ-SR04M** *(Kedalaman)* | VCC | Rel VCC 5V Utama | **5V DC** | Butuh daya 5V agar jangkauan pembacaan maksimal |
|  | GND | **Common GND** | **0V (GND)** | Ground Ultrasonik |
|  | TRIG | **GPIO 5 ESP32** | 3.3V Digital Output | Sinyal Pemicu Pulsa (Direct ke ESP32) |
|  | ECHO | **Pin HV1 LLC** | 5V Digital Output | Sinyal Echo 5V diturunkan lewat LLC Channel 1 |
| **Logic Level Converter** *(LLC 4-CH)* | HV (High Voltage) | Rel VCC 5V Utama | **5V DC** | Tegangan referensi Sisi High Voltage |
|  | LV (Low Voltage) | Pin 3.3V Out ESP32 | **3.3V DC** | Tegangan referensi Sisi Low Voltage |
|  | GND | **Common GND** | **0V (GND)** | Ground Bersama Modul LLC |
|  | HV1 / LV1 | ECHO (5V) $\rightarrow$ **GPIO 18 ESP32** | 5V $\rightarrow$ 3.3V Shift | Konversi Sinyal Echo Ultrasonik ke 3.3V |
|  | HV2 / LV2 | RO (5V) $\rightarrow$ **GPIO 16 ESP32** | 5V $\rightarrow$ 3.3V Shift | Konversi Sinyal RO MAX485 (RX2) ke 3.3V |
|  | HV3-4 / LV3-4 | *Kosong / Unused* | - | Saluran cadangan (Spare) |
| **Sensor DO** *(RS485)* | VCC (Merah) | Rel VCC 5V Utama | **5V DC** | Daya Sensor DO RS485 |
|  | GND (Hitam) | **Common GND** | **0V (GND)** | Ground Sensor DO |
|  | A (Kuning) | Pin A Modul MAX485 | RS485 Differential | Bus Data RS485 A (+) |
|  | B (Hijau) | Pin B Modul MAX485 | RS485 Differential | Bus Data RS485 B (-) |
| **Modul MAX485** *(TTL RS485)* | VCC | Rel VCC 5V Utama | **5V DC** | Daya Modul Transceiver RS485 |
|  | GND | **Common GND** | **0V (GND)** | Ground MAX485 |
|  | RO | **Pin HV2 LLC** | Serial Logic (5V) | Transmit sinyal 5V menuju LLC CH2 $\rightarrow$ GPIO 16 (RX2) |
|  | DI | **GPIO 17 ESP32** | Serial Logic (TX2) | Driver In dari ESP32 Hardware Serial 2 (Direct 3.3V) |
|  | DE & RE | **GPIO 15 ESP32** *(Jumper)* | Digital Output | Kontrol Direction Transmit/Receive RS485 |
| **Modul Sensor pH** *(3-Pin)* | VCC / V | Rel VCC 5V Utama | **5V DC** | Catu daya modul penguat (Op-Amp) pH |
|  | GND / G | **Common GND** | **0V (GND)** | Ground Modul pH |
|  | Signal / A / Po | **Pin A0 ADS1115** | Analog Voltage (mV) | Sinyal Analog pH ke ADC ADS1115 |
| **Modul ADS1115** *(ADC 16-Bit)* | VDD | Rel VCC 5V Utama | **5V DC** | Daya Modul ADC 16-Bit |
|  | GND | **Common GND** | **0V (GND)** | Ground ADS1115 |
|  | ADDR | **Common GND** | 0V (GND) | Mengunci alamat I2C ke `0x48` |
|  | SDA | **GPIO 21 ESP32** | I2C Data | Bus I2C Hardware ESP32 |
|  | SCL | **GPIO 22 ESP32** | I2C Clock | Bus I2C Hardware ESP32 |
|  | A0 (AIN0) | Pin Signal Modul pH | Analog Input | Membaca Sinyal pH dengan Presisi High-Resolution |

---

> [!IMPORTANT]
> **Catatan Penting Pemasangan Hardware:**
> 1. **Common Ground (GND Bersama):** Seluruh titik GND dari Adaptor 12V, Mini560, ESP32, MAX485, ADS1115, LLC, Modul pH, Sensor DO, dan Terminal Block DS18B20 **WAJIB** terhubung menjadi satu jalur (*Common Ground*).
> 2. **Pull-Up Resistor DS18B20:** Pasang 1 buah resistor **4.7kΩ** antara pin **DATA (GPIO 4)** dan **VCC (5V)** langsung pada slot Terminal Block 3-Pin.
> 3. **Perlindungan GPIO ESP32:** Sinyal 5V dari pin **ECHO (AJ-SR04M)** dan **RO (MAX485)** wajib dilewatkan melalui **Logic Level Converter (LLC)** agar turun menjadi 3.3V sebelum masuk ke GPIO ESP32.
> 4. **Pin 3.3V ESP32:** Hanya dihubungkan ke pin **LV Modul LLC** sebagai tegangan referensi logika. Jangan gunakan pin 3.3V ESP32 untuk memberi daya ke sensor-sensor utama.
> 
>
