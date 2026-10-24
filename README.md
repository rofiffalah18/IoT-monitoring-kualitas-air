# 🌊 IoT Water Quality Monitoring System (ESP32)

Sistem pemantauan kualitas air kolam/tambak secara *real-time* berbasis **ESP32 Dev Board (30-Pin)**. Sistem ini dirancang untuk mengukur 4 parameter utama kualitas air secara presisi dan mengirimkan data secara otomatis dengan proteksi sirkuit tingkat tinggi.

---

## 📌 Fitur Utama Sistem

- **Multi-Layer Temperature Monitoring:** Membaca suhu air di 3 kedalaman berbeda (*Surface, Middle, Bottom*) menggunakan 3x sensor waterproof DS18B20 pada satu bus *OneWire*.
- **High-Precision pH Measurement:** Menggunakan sensor pH dengan penguat Op-Amp yang dikonversi oleh ADC 16-Bit eksternal (**ADS1115**) via bus I2C untuk pembacaan milivolt yang bebas *noise*.
- **Optical Dissolved Oxygen (DO) Sensing:** Membaca kadar Oksigen Terlarut ($0.00 - 20.00 \text{ mg/L}$) dari sensor industri **Remond RMD-ISDTY105 (12V DC)** berbasis komunikasi RS485 Modbus RTU.
- **Ultrasonic Water Depth Sensing:** Mengukur tingkat kedalaman air kolam menggunakan sensor kedalaman waterproof **AJ-SR04M** yang dilengkapi algoritma *moving average filter*.
- **Hardware Signal Level Shifting:** Perlindungan penuh pada pin GPIO ESP32 dari lonjakan tegangan 5V menggunakan **4-Channel Bi-Directional Logic Level Converter (LLC)**.
- **Multi-Network Failover & Multi-Triggering:** Mendukung failover otomatis 3 jaringan Wi-Fi, transmisi rutin 30 menit (sinkronisasi NTP), pemicu darurat Touch Sensor TTP223, Serial Command, serta On-Demand Web Trigger.

---

## 🎯 Tujuan & Fungsi Utama Perangkat

1. **Deteksi Stratifikasi Suhu:** Memantau dinamika suhu air pada tiga lapisan kedalaman yang berbeda untuk mendeteksi *thermal stratification* atau turnover air kolam yang berpotensi memicu racun dari dasar kolam naik ke permukaan.
2. **Monitoring Kadar Oksigen Terlarut (DO):** Mengukur tingkat ketersediaan oksigen terlarut dalam satuan $mg/L$ secara presisi menggunakan sensor tingkat industri guna mengantisipasi kondisi **anoksia/hipoksia** (kekurangan oksigen) pada malam dan subuh hari.
3. **Uji Keasaman (pH) Terbaca Stabil:** Mengukur keasaman air tanpa terganggu oleh lonjakan tegangan atau *electrical noise* dari peralatan sekitar (seperti kincir/pompa).
4. **Kontrol Fluktuasi Kedalaman Air:** Memantau tingkat kebiasaan kebocoran, penguapan, atau luapan air kolam akibat cuaca ekstrem.
5. **Transmisi Data Terjadwal & Darurat:** Mengirimkan data sensor secara rutin tiap 30 menit ke backend *Google Sheets* dan *Dashboard Web Responsive*, serta mampu memicu pengiriman instan via **Touch Sensor (TTP223)** atau tombol di website.

---

## 📊 Parameter Kualitas Air yang Diukur

| Parameter | Sensor yang Digunakan | Jangkauan Ukur | Ambang Batas Aman | Dampak Jika Di Luar Batas |
| :--- | :--- | :--- | :--- | :--- |
| **Suhu Permukaan** | DS18B20 #1 | $-55^\circ\text{C} \text{ s.d. } +125^\circ\text{C}$ | $25.0 - 32.0^\circ\text{C}$ | Perubahan suhu ekstrem memicu stres dan menurunkan imun biologi air. |
| **Suhu Tengah** | DS18B20 #2 | $-55^\circ\text{C} \text{ s.d. } +125^\circ\text{C}$ | $25.0 - 32.0^\circ\text{C}$ | Beda suhu > $1.5^\circ\text{C}$ antar-lapisan menandakan stratifikasi berbahaya. |
| **Suhu Dasar** | DS18B20 #3 | $-55^\circ\text{C} \text{ s.d. } +125^\circ\text{C}$ | $25.0 - 32.0^\circ\text{C}$ | Suhu dasar terlalu dingin menurunkan aktivitas mikroba pengurai limbah. |
| **Oksigen Terlarut (DO)** | Remond RMD-ISDTY105 | $0.00 - 20.00 \text{ mg/L}$ | $\ge 4.5 \text{ mg/L}$ | $\text{DO} < 3.0 \text{ mg/L}$ memicu kematian massal ikan/udang (anoksia). |
| **Derajat Keasaman (pH)** | Probe pH + ADS1115 | $0.0 - 14.0 \text{ pH}$ | $6.5 - 8.5 \text{ pH}$ | $\text{pH} < 5.5$ (asam) atau $> 8.5$ (basa) merusak jaringan insang dan organ. |
| **Kedalaman Air** | AJ-SR04M (Ultrasonik) | $20 - 200 \text{ cm}$ | $\ge 80 \text{ cm}$ | Kedalaman terlalu dangkal mempercepat kenaikan suhu dan memicu penguapan. |

---

## 🔌 Matrix Pinout & Distribusi Daya Lengkap

Tabel di bawah ini mengintegrasikan seluruh titik penyambungan kabel, modul, proteksi *level shifter*, dan penyuplaian daya sistem:

| Modul / Komponen | Pin / Warna Kabel | Sambungan Tujuan | Tegangan Operasional | Catatan Kritis & Proteksi |
| :--- | :--- | :--- | :--- | :--- |
| **Adaptor Utama** | Output (+) 12V | IN (+) Mini560 & VCC Sensor DO | **12V DC Utama** | Sumber listrik pusat seluruh sistem. |
| | Output (-) GND | **Common GND System** | **0V (GND)** | **Wajib di-jumper ke seluruh titik Ground komponen!** |
| **Step-Down Mini560** | IN (+ / -) | Adaptor 12V (+ / -) | 12V DC Input | Menurunkan tegangan dari 12V ke 5V konstan. |
| | OUT (+ / VOUT+) | **Rel VCC 5V Utama** | **5.0V DC Output** | Menyuplai VIN ESP32, ADS1115, Sensor, LLC, dll. |
| | OUT (- / VOUT-) | **Common GND System** | **0V (GND)** | Ground Step-Down terhubung ke bus utama. |
| **ESP32 Dev Board** | VIN / 5V | Rel VCC 5V Utama | **5.0V DC** | Jalur pasokan listrik utama board ESP32. |
| | GND | **Common GND System** | **0V (GND)** | Seluruh pin GND internal ESP32 saling terhubung. |
| | 3.3V Out | **Pin LV LLC 4-Channel** | **3.3V DC** | Hanya sebagai referensi tegangan Sisi Low (3.3V). |
| | **GPIO 13** | **SIG Touch Sensor (TTP223)** | 3.3V Logic | Digital Input pemicu paksa transmisi data instan. |
| **3x DS18B20** *(Suhu)* | VCC (Merah) | Terminal Block VCC (5V Rail) | **5.0V DC** | Dipasang secara paralel pada terminal block. |
| | GND (Hitam) | Terminal Block GND | **0V (GND)** | Ground paralel. |
| | DATA (Kuning/Putih) | **GPIO 4 ESP32** | 3.3V / 5V Logic | **Wajib Resistor Pull-Up 4.7kΩ dari Data ke VCC (5V).** |
| **AJ-SR04M** *(Kedalaman)* | VCC | Rel VCC 5V Utama | **5.0V DC** | Membutuhkan pasokan 5V murni agar pemancar kuat. |
| | GND | **Common GND System** | **0V (GND)** | Ground Ultrasonik. |
| | TRIG | **GPIO 5 ESP32** | 3.3V Logic | Pulsa pemicu digital (Direct dari ESP32 GPIO 5). |
| | ECHO | **Pin HV1 (LLC CH1)** | 5V Logic Output | Sinyal Echo 5V diturunkan via **LV1 $\rightarrow$ GPIO 18**. |
| **Logic Level Converter** | HV (High Voltage) | Rel VCC 5V Utama | **5.0V DC** | Referensi Sisi Tegangan Tinggi (5V). |
| | LV (Low Voltage) | Pin 3.3V Out ESP32 | **3.3V DC** | Referensi Sisi Tegangan Rendah (3.3V). |
| | GND | **Common GND System** | **0V (GND)** | Ground referensi sinyal LLC. |
| | HV1 / LV1 | ECHO (5V) $\rightarrow$ **GPIO 18 ESP32** | 5V $\rightarrow$ 3.3V Level Shift | Menjaga GPIO 18 dari bahaya overload tegangan 5V. |
| | HV2 / LV2 | RO (5V) $\rightarrow$ **GPIO 16 ESP32** | 5V $\rightarrow$ 3.3V Level Shift | Menjaga GPIO 16 (RX2) dari tegangan 5V MAX485. |
| **Sensor DO (Remond)** | **Merah** (VCC) | **Output (+) Adaptor 12V** | **12V DC** | **WAJIB 12V! Jangan dihubungkan ke Rel 5V.** |
| | **Hitam** (GND) | **Common GND System** | **0V (GND)** | Ground catu daya sensor. |
| | **Abu-abu** (Shield) | **Common GND System** | **0V (GND)** | Pelindung gelombang *electro-magnetic interference* (EMI). |
| | **Biru** (RS485-A) | Terminal **A** MAX485 | RS485 Differential | Komunikasi data diferensial positif (A+). |
| | **Putih** (RS485-B) | Terminal **B** MAX485 | RS485 Differential | Komunikasi data diferensial negatif (B-). |
| **Modul MAX485** | VCC | Rel VCC 5V Utama | **5.0V DC** | Catu daya modul IC MAX485. |
| | GND | **Common GND System** | **0V (GND)** | Ground Modul MAX485. |
| | RO (Receiver Out) | **Pin HV2 (LLC CH2)** | 5V Logic Output | Mengirim sinyal RS485 via **LV2 $\rightarrow$ GPIO 16 (RX2)**. |
| | DI (Driver In) | **GPIO 17 (TX2) ESP32** | 3.3V Logic Input | Sinyal data pancar langsung dari UART2 ESP32. |
| | DE & RE | **GPIO 15 ESP32** *(Jumper)* | 3.3V Logic | Mengontrol mode Transmit (`HIGH`) / Receive (`LOW`). |
| **Modul Sensor pH** | VCC / V | Rel VCC 5V Utama | **5.0V DC** | Daya modul penguat Op-Amp BNC pH. |
| | GND / G | **Common GND System** | **0V (GND)** | Ground modul pH. |
| | Signal / A / Po | **Pin A0 (AIN0) ADS1115** | Analog Output ($mV$) | Mengirimkan milivolt analog pH ke ADC eksternal. |
| **Modul ADS1115** | VDD | Rel VCC 5V Utama | **5.0V DC** | Catu daya utama IC ADC 16-Bit. |
| | GND | **Common GND System** | **0V (GND)** | Ground utama ADS1115. |
| | ADDR | **Common GND System** | **0V (GND)** | Pengunci Alamat Bus I2C pada kode `0x48`. |
| | SDA | **GPIO 21 ESP32** | 3.3V I2C Data | Jalur data I2C (Sudah aman di VDD 5V karena I2C ESP32 Tolerant). |
| | SCL | **GPIO 22 ESP32** | 3.3V I2C Clock | Jalur clock I2C Hardware. |
| | A0 (AIN0) | Pin **Po** Modul pH | Analog Input ($mV$) | Mengonversi tegangan analog pH ke nilai digital 16-Bit. |

---

## ⚠️ Peringatan Penting & Panduan Keselamatan Sirkuit

1. **Common Ground (GND Bersama) Adalah Mutlak:**
   Seluruh poin GND (Adaptor 12V, Step-Down Mini560, ESP32, Sensor DO, Sensor pH, ADS1115, dan MAX485) **wajib terhubung pada satu jalur bus GND yang sama**. Tanpa *common ground*, sinyal komunikasi I2C, RS485, dan data analog akan kacau (*floating/corrupted*).
2. **Bahaya Overvoltage pada Pin GPIO ESP32 (Maksimal 3.3V):**
   Pin GPIO ESP32 **tidak aman terhadap tegangan 5V** (*Not 5V Tolerant*). Sinyal keluaran 5V dari pin **ECHO (AJ-SR04M)** dan pin **RO (MAX485)** *harus* diturunkan ke 3.3V menggunakan modul **Logic Level Converter (LLC)** sebelum masuk ke GPIO 18 dan GPIO 16.
3. **Pemisahan Jalur VCC Sensor DO (12V):**
   Jangan pernah menyambungkan kabel daya sensor DO (Merah) ke jalur 5V atau 3.3V. Sensor DO **membutuhkan pasokan tegangan 12V DC langsung dari Adaptor Utama** agar transmitter optiknya dapat menyala dan merespons query Modbus.
4. **Resistor Pull-Up 4.7kΩ pada Bus OneWire (DS18B20):**
   Meskipun menggunakan 3 sensor suhu secara paralel, gunakan **cukup 1 buah resistor pull-up 4.7kΩ** antara jalur DATA (GPIO 4) dan VCC (5V). Memasang resistor berlebihan dapat merusak impedansi bus komunikasi OneWire.
5. **Grounded Cable Shielding pada Sensor DO:**
   Kabel abu-abu (*shield wire*) pada sensor DO berfungsi menetralisir arus induksi statis di air kolam. Sambungkan kabel abu-abu ini ke Common GND agar pembacaan nilai $mg/L$ bebas dari fluktuasi liar.

---

## 🚀 Alur Kerja Transmisi Data Sistem
[ Sensor Fisik ] ───► [ ADS1115 / LLC / MAX485 ] ───► [ ESP32 Dev Board ]
│
┌──────────────┴──────────────┐
▼                             ▼
[ Mode Rutin / NTP ]           [ Pemicu Instan ]
(Setiap :00 & :30)             (Touch Sensor GPIO 13 /
Manual Serial / Web Read)
│                             │
└──────────────┬──────────────┘
▼
[ Auto WiFi Failover ]
(Wi-Fi 1 ➔ Wi-Fi 2 ➔ Wi-Fi 3)
│
▼
[ Google Apps Script ]
│
┌──────────────┴──────────────┐
▼                             ▼
[ Sheet Data Feeder ]        [ Sheet LogKoneksi ]
│                             │
└──────────────┬──────────────┘
▼
[ Web Dashboard System ]
1. **Pembacaan Sensor:** ESP32 mengambil sampel dari 3x Suhu (DS18B20), Kedalaman (AJ-SR04M), pH (via ADS1115 I2C), dan DO (via RS485 Modbus).
2. **Evaluasi Status:** ESP32 menganalisis apakah ada sensor yang terputus atau mengalami anomali nilai.
3. **Pemeriksaan Koneksi (Auto-Failover):** ESP32 secara otomatis memilih jaringan Wi-Fi aktif terdekat (**Wi-Fi 1 Home**, **Wi-Fi 2 Modem**, atau **Wi-Fi 3 GTC IPB**) dengan membawa identitas nama jaringan sederhana (`wifi_name`).
4. **Transmisi HTTP POST:** Data dikirimkan dalam format JSON mencakup parameter sensor, `device_id`, `status_log`, dan `trigger_type` (`SCHEDULED_30MIN`, `TOUCH_SENSOR`, `SERIAL_FORCE`, atau `RECONNECTED_WIFI`).
5. **Pencatatan Backend & Visualisasi Web:** Google Apps Script memisah data ke tab `Data Feeder` dan `Log Koneksi`, yang kemudian secara *real-time* diperbarui pada *Dashboard Web Responsive* (lengkap dengan grafik Chart.js, indikator bahaya, dan tabel riwayat log terpaginasi).