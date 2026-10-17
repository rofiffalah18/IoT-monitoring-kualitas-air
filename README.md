# 🌊 IoT Water Quality Monitoring System (ESP32)

Sistem pemantauan kualitas air kolam/tambak secara *real-time* berbasis **ESP32 Dev Board (30-Pin)**. Sistem ini dirancang untuk mengukur 4 parameter utama kualitas air secara presisi dan mengirimkan data secara otomatis dengan proteksi sirkuit tingkat tinggi.

---

## 📌 Fitur Utama Sistem

* **Multi-Layer Temperature Monitoring:** Membaca suhu air di 3 kedalaman berbeda (*Surface, Middle, Bottom*) menggunakan 3x sensor waterproof DS18B20 pada satu bus *OneWire*.
* **High-Precision pH Measurement:** Menggunakan sensor pH dengan penguat Op-Amp yang dikonversi oleh ADC 16-Bit eksternal (**ADS1115**) via bus I2C untuk pembacaan milivolt yang bebas *noise*.
* **Optical Dissolved Oxygen (DO) Sensing:** Membaca kadar Oksigen Terlarut ($0.00 - 20.00 \text{ mg/L}$) dari sensor industri **Remond RMD-ISDTY105 (12V DC)** berbasis komunikasi RS485 Modbus RTU.
* **Ultrasonic Water Depth Sensing:** Mengukur tingkat kedalaman air kolam menggunakan sensor kedalaman waterproof **AJ-SR04M** yang dilengkapi algoritma *moving average filter*.
* **Hardware Signal Level Shifting:** Perlindungan penuh pada pin GPIO ESP32 dari lonjakan tegangan 5V menggunakan **4-Channel Bi-Directional Logic Level Converter (LLC)**.
* **Dual-Transmission & Heartbeat Mode:** Mendukung mode transmisi rutin 30 menit (sinkronisasi NTP) dan mode debug/testing 10 detik.

---

## 🔌 Pinout & Power Distribution Matrix

Tabel master berikut merangkum seluruh pemetaan *pinout*, jalur komunikasi data, dan distribusi daya sistem:

| Modul / Komponen | Warna Kabel / Pin | Sambungan Ke | Tegangan / Daya | Keterangan & Catatan Khusus |
| :--- | :--- | :--- | :--- | :--- |
| **Adaptor 12V DC** | Output (+) 12V | IN (+) Mini560 & VCC Sensor DO | **12V DC (Utama)** | Sumber listrik utama seluruh sistem |
| | Output (-) GND | **Common GND** | **0V (GND)** | **Wajib disambung ke semua GND komponen** |
| **Step-Down Mini560** *(Fixed 5V)* | IN (+ / -) | Output Adaptor 12V (+ / -) | 12V DC Input | Menurunkan tegangan 12V ke 5V stabil (Arus s.d 3A) |
| | OUT (+) / VOUT+ | **Rel VCC 5V Utama** | **5.0V DC Output** | Menyuplai VIN ESP32, Sensor & Modul 5V |
| | OUT (-) / VOUT- | **Common GND** | **0V (GND)** | Ground Step-Down |
| **ESP32 Board** *(30-Pin)* | VIN / 5V | Rel VCC 5V Utama | **5V DC** | Catu daya utama board ESP32 |
| | GND | **Common GND** | **0V (GND)** | Ground ESP32 (GND1, GND2, GND3 terhubung internal) |
| | 3.3V Out | **LV Pin Logic Level Converter** | **3.3V DC** | Hanya sebagai acuan Sisi Low Logic (LV) LLC |
| **3x DS18B20** *(Suhu)* | VCC (Merah) | Terminal Block VCC (5V Rail) | **5V DC** | VCC sensor terhubung secara paralel |
| | GND (Hitam) | Terminal Block GND | **0V (GND)** | Ground sensor terhubung secara paralel |
| | DATA (Kuning/Putih)| **GPIO 4 ESP32** | 3.3V / 5V Logic | **Wajib Resistor Pull-Up 4.7kΩ ke VCC (5V) di Terminal Block** |
| **AJ-SR04M** *(Kedalaman)* | VCC | Rel VCC 5V Utama | **5V DC** | Membutuhkan daya 5V agar jarak bacaan maksimal |
| | GND | **Common GND** | **0V (GND)** | Ground Ultrasonik |
| | TRIG | **GPIO 5 ESP32** | 3.3V Digital Output | Sinyal Trigger Pulsa (Direct ke ESP32) |
| | ECHO | **Pin HV1 LLC** | 5V Digital Output | Sinyal Echo 5V diturunkan via LLC CH1 $\rightarrow$ **GPIO 18** |
| **Logic Level Converter** *(LLC 4-CH)* | HV (High Voltage) | Rel VCC 5V Utama | **5V DC** | Tegangan referensi Sisi High Voltage |
| | LV (Low Voltage) | Pin 3.3V Out ESP32 | **3.3V DC** | Tegangan referensi Sisi Low Voltage |
| | GND | **Common GND** | **0V (GND)** | Ground Bersama Modul LLC |
| | HV1 / LV1 | ECHO (5V) $\rightarrow$ **GPIO 18 ESP32** | 5V $\rightarrow$ 3.3V Shift | Konversi Sinyal Echo Ultrasonik ke 3.3V |
| | HV2 / LV2 | RO (5V) $\rightarrow$ **GPIO 16 ESP32** | 5V $\rightarrow$ 3.3V Shift | Konversi Sinyal RO MAX485 (RX2) ke 3.3V |
| | HV3-4 / LV3-4 | *Kosong / Unused* | - | Saluran cadangan (Spare) |
| **Sensor DO (Remond RMD-ISDTY105)** | **Merah** (VCC) | **Output (+) Adaptor 12V** | **12V DC** | **Wajib 12V DC (Ambil langsung dari Adaptor 12V)** |
| | **Hitam** (GND) | **Common GND** | **0V (GND)** | Ground Power Sensor DO |
| | **Abu-abu** (Shield) | **Common GND** | **0V (GND)** | Pelindung interferensi *noise* induksi air kolam |
| | **Biru** (RS485-A) | Terminal **A** MAX485 | RS485 Differential | Sinyal Data Positif RS485 (A+) |
| | **Putih** (RS485-B) | Terminal **B** MAX485 | RS485 Differential | Sinyal Data Negatif RS485 (B-) |
| **Modul MAX485** *(TTL RS485)* | VCC | Rel VCC 5V Utama | **5V DC** | Daya Modul Transceiver RS485 |
| | GND | **Common GND** | **0V (GND)** | Ground Modul |
| | RO (Receiver Out) | **Pin HV2 LLC** | Serial Logic (5V) | Transmit sinyal 5V menuju LLC CH2 $\rightarrow$ **GPIO 16 (RX2)** |
| | DI (Driver In) | **GPIO 17 (TX2) ESP32** | 3.3V Logic | Direct dari Hardware Serial UART2 ESP32 |
| | DE & RE | **GPIO 15 ESP32** *(Jumper)* | Digital Output | Kontrol Direction Transmit/Receive RS485 |
| **Modul Sensor pH** *(3-Pin)* | VCC / V | Rel VCC 5V Utama | **5V DC** | Catu daya modul penguat (Op-Amp) pH |
| | GND / G | **Common GND** | **0V (GND)** | Ground Modul pH |
| | Signal / A / Po | **Pin A0 ADS1115** | Analog Voltage (mV) | Sinyal Analog pH ke ADC ADS11
