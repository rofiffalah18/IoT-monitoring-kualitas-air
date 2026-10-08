const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVMXtRzgmnlgWF3-zHaUWbZNhUpa4kUZMSZKVedLo0X2jeReBgU2I1hCwj4lzRkVK47Q/exec";
const IS_TESTING_MODE = false;
const FETCH_INTERVAL_MS = 10000; // Web menarik data dari Google Sheets tiap 10 detik
const rowsPerPage = 10;
let waterChart = null;

// ==========================================
// INISIALISASI SAAT HALAMAN WEB DIMUAT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  fetchData();
  setInterval(fetchData, FETCH_INTERVAL_MS);
});

// ==========================================
// 1. FETCH DATA DARI GOOGLE APPS SCRIPT
// ==========================================
async function fetchData() {
  try {
    const response = await fetch(SCRIPT_URL);
    const result = await response.json();

    if (result && result.length > 0) {
      const latestData = result[result.length - 1];

      // Update UI Dashboard
      updateLastUpdateTime(latestData.timestamp);
      checkESP32Status(latestData.timestamp);
      updateSensorCards(latestData);
      calculateWaterQualityIndex(latestData);
      renderAlerts(latestData);
      updateChartData(result);
      renderActivityHistory(result);
    } else {
      showEmptyState();
    }
  } catch (error) {
    console.error("Gagal mengambil data dari server:", error);
    const txtStatus = document.getElementById('txt-status');
    const statusContainer = document.getElementById('connection-status');
    if (txtStatus && statusContainer) {
      statusContainer.className = "status-pill offline";
      txtStatus.innerText = "Error Koneksi Server";
    }
  }
}

// ==========================================
// 2. CEK STATUS KONEKSI ESP32 (HEARTBEAT)
// ==========================================
function checkESP32Status(lastTimestamp) {
  const statusContainer = document.getElementById('connection-status');
  const txtStatus = document.getElementById('txt-status');
  if (!statusContainer || !txtStatus || !lastTimestamp) return;

  const now = new Date();
  const lastDataTime = new Date(lastTimestamp);
  const diffInMinutes = (now - lastDataTime) / (1000 * 60);

  // Toleransi waktu: 31 menit untuk produksi, 1.5 menit untuk testing
  const maxToleranceMinutes = IS_TESTING_MODE ? 1.5 : 31;

  if (diffInMinutes > maxToleranceMinutes || isNaN(diffInMinutes)) {
    statusContainer.className = "status-pill offline";
    txtStatus.innerText = "ESP32 Terputus (Offline)";
  } else {
    statusContainer.className = "status-pill online";
    txtStatus.innerText = "ESP32 Terhubung (Online)";
  }
}

function updateLastUpdateTime(timestampStr) {
  const el = document.getElementById('last-update-time');
  if (el) el.innerText = `Update Terakhir: ${timestampStr || '-'}`;
}

// ==========================================
// 3. UPDATE KARTU SENSOR & DETEKSI FISIK ERROR
// ==========================================
function updateSensorCards(data) {
  const s1 = Number(data.suhu1) || 0;
  const s2 = Number(data.suhu2) || 0;
  const s3 = Number(data.suhu3) || 0;
  const doVal = Number(data.do) || 0;
  const phVal = Number(data.ph) || 0;
  const kedalaman = Number(data.kedalaman) || 0;

  // Render Angka ke HTML
  document.getElementById('val-suhu1').innerText = s1.toFixed(1);
  document.getElementById('val-suhu2').innerText = s2.toFixed(1);
  document.getElementById('val-suhu3').innerText = s3.toFixed(1);
  document.getElementById('val-do').innerText = doVal.toFixed(1);
  document.getElementById('val-ph').innerText = phVal.toFixed(1);
  document.getElementById('val-kedalaman').innerText = kedalaman.toFixed(1);

  // Evaluasi Fisik Sensor & Tambah Class Danger Jika Error
  evaluateSensorHealth('.card-suhu1', 'status-suhu1', s1 <= 0 || s1 >= 50, "Sensor Terputus!", "Normal");
  evaluateSensorHealth('.card-suhu2', 'status-suhu2', s2 <= 0 || s2 >= 50, "Sensor Terputus!", "Normal");
  evaluateSensorHealth('.card-suhu3', 'status-suhu3', s3 <= 0 || s3 >= 50, "Sensor Terputus!", "Normal");
  evaluateSensorHealth('.card-do', 'status-do', doVal < 3.0 || doVal > 9.0, doVal < 3.0 ? "DO Kritis (Rendah)!" : "DO Sangat Tinggi", "Normal");
  evaluateSensorHealth('.card-ph', 'status-ph', phVal < 4.0 || phVal > 9.0, "pH Ekstrem (Bahaya)!", "Normal");
  evaluateSensorHealth('.card-kedalaman', 'status-kedalaman', kedalaman <= 0, "Sensor Bermasalah!", "Normal");
}

function evaluateSensorHealth(cardSelector, statusId, isErrorCondition, errorMsg, normalMsg) {
  const cardEl = document.querySelector(cardSelector);
  const statusEl = document.getElementById(statusId);
  if (!cardEl || !statusEl) return;

  if (isErrorCondition) {
    cardEl.classList.add('card-sensor-danger');
    statusEl.innerText = `Kondisi: ⚠️ ${errorMsg}`;
    statusEl.style.color = '#b91c1c';
  } else {
    cardEl.classList.remove('card-sensor-danger');
    statusEl.innerText = `Kondisi: ${normalMsg}`;
    statusEl.style.color = '#64748b';
  }
}

// ==========================================
// 4. LOGIKA BOBOT PENALTI INDEKS KUALITAS AIR
// ==========================================
function calculateWaterQualityIndex(data) {
  let score = 100;

  const doVal = Number(data.do) || 0;
  const phVal = Number(data.ph) || 0;
  const s1 = Number(data.suhu1) || 0;
  const s3 = Number(data.suhu3) || 0;
  const diffSuhu = Math.abs(s1 - s3);

  // 1. Bahaya Tingkat 1 (Kritis): Oksigen Terlarut (DO)
  if (doVal < 4.0 || doVal > 8.0) {
    score -= 35;
  }

  // 2. Bahaya Tingkat 2 (Kimia): pH Air
  if (phVal < 4.0 || phVal > 9.0) {
    score -= 40; // Ekstrem
  } else if (phVal < 5.5 || phVal > 8.5) {
    score -= 25; // Di luar rentang aman
  }

  // 3. Bahaya Tingkat 3 (Fisik): Stratifikasi Suhu
  if (diffSuhu >= 1.5) {
    score -= 15;
  }

  // Batasi skor di rentang 0 - 100
  score = Math.max(0, Math.min(100, score));

  // Render ke UI
  const elIndexValue = document.getElementById('val-indeks-kualitas');
  const badgeStatus = document.getElementById('badge-status');

  if (elIndexValue && badgeStatus) {
    elIndexValue.innerText = score.toFixed(0);

    if (score >= 85) {
      badgeStatus.className = "badge badge-success";
      badgeStatus.innerText = "Optimal";
    } else if (score >= 65) {
      badgeStatus.className = "badge badge-waspada";
      badgeStatus.innerText = "Waspada";
    } else {
      badgeStatus.className = "badge badge-danger";
      badgeStatus.innerText = "Bahaya";
    }
  }
}

// ==========================================
// 5. RENDER ALERT & REKOMENDASI DINAMIS
// ==========================================
function renderAlerts(data) {
  const alertContainer = document.getElementById('alert-container');
  if (!alertContainer) return;

  const doVal = Number(data.do) || 0;
  const phVal = Number(data.ph) || 0;
  const diffSuhu = Math.abs((Number(data.suhu1) || 0) - (Number(data.suhu3) || 0));

  let alertsHTML = '';

  if (doVal < 4.0) {
    alertsHTML += `<div class="alert-item danger">⚠️ <strong>Bahaya DO Rendah:</strong> Kadar oksigen (${doVal} ppm) kritis. Segera nyalakan kincir/aerator!</div>`;
  }
  if (phVal < 5.5 || phVal > 8.5) {
    alertsHTML += `<div class="alert-item warning">⚠️ <strong>Peringatan pH:</strong> Nilai pH (${phVal}) di luar batas aman (6.5 - 8.5). Lakukan pengondisian air!</div>`;
  }
  if (diffSuhu >= 1.5) {
    alertsHTML += `<div class="alert-item warning">⚠️ <strong>Stratifikasi Suhu:</strong> Selisih suhu permukaan & dasar ${diffSuhu.toFixed(1)}°C. Perlu sirkulasi/pengadukan air!</div>`;
  }

  if (alertsHTML === '') {
    alertsHTML = `<div class="alert-item success">✅ <strong>Kondisi Kolam Aman:</strong> Seluruh parameter kualitas air berada pada rentang ideal.</div>`;
  }

  alertContainer.innerHTML = alertsHTML;
}

// ==========================================
// 6. RENDER LOG RIWAYAT AKTIVITAS & KONEKSI
// ==========================================
function renderActivityHistory(dataArray) {
  const tableBody = document.getElementById('log-table-body');
  if (!tableBody) return;

  const reversedData = [...dataArray].reverse();
  const paginatedLogs = reversedData.slice(0, rowsPerPage);
  const now = new Date();

  let htmlContent = '';
  paginatedLogs.forEach((item, index) => {
    const itemTime = new Date(item.timestamp);
    const diffMinutes = (now - itemTime) / (1000 * 60);

    // Cek apakah data ini data paling akhir dan sudah lewat toleransi offline
    const maxTol = IS_TESTING_MODE ? 1.5 : 31;
    const isOfflineEvent = (index === 0) && (diffMinutes > maxTol);

    let statusBadge = '';
    let jenisAktivitas = '';
    let keteranganText = '';

    if (isOfflineEvent) {
      jenisAktivitas = `<span style="color: #e11d48; font-weight: 600;">⚠️ Terputus</span>`;
      statusBadge = `<span class="status-pill offline">🔴 Offline</span>`;
      keteranganText = `ESP32 tidak mengirimkan data dalam batas toleransi jadwal.`;
    } else if (item.status === 'WARNING') {
      jenisAktivitas = `<span style="color: #d97706; font-weight: 600;">⚠️ Sensor Warning</span>`;
      statusBadge = `<span class="badge badge-waspada">Ada Masalah</span>`;
      keteranganText = `${item.catatan || 'Data sensor di luar rentang normal.'} (Suhu: ${item.suhu1}°C, DO: ${item.do}, pH: ${item.ph})`;
    } else {
      jenisAktivitas = `<span style="color: #0284c7; font-weight: 600;">📥 Kirim Data</span>`;
      statusBadge = `<span class="badge badge-success">Normal</span>`;
      keteranganText = `Transmisi Berhasil — Suhu: ${item.suhu1}°C | DO: ${item.do} ppm | pH: ${item.ph} | Kedalaman: ${item.kedalaman}m`;
    }

    htmlContent += `
      <tr>
        <td><strong>${item.timestamp || '-'}</strong></td>
        <td>${jenisAktivitas}</td>
        <td>${statusBadge}</td>
        <td>${keteranganText}</td>
      </tr>
    `;
  });

  tableBody.innerHTML = htmlContent;
}

// ==========================================
// VISUALISASI GRAFIK TREN (CHART.JS - FIX FILTER & 6 PARAMETER)
// ==========================================
// Variabel global 4 grafik & penyimpanan data mentah
let chartSuhu, chartDO, chartPH, chartKedalaman;
let rawGlobalData = [];

// Inisialisasi Grafik
function initChart() {
  // 1. Grafik Suhu Khusus dengan 3 Garis
  // Di file script.js
  const ctxSuhu = document.getElementById('chartSuhu');
  if (ctxSuhu) {
    chartSuhu = new Chart(ctxSuhu, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Permukaan',
            data: [],
            borderColor: '#6FE6FC', // Samakan dengan warna .legend-dot Permukaan
            backgroundColor: 'rgba(234, 88, 12, 0.1)',
            tension: 0.3
          },
          {
            label: 'Tengah',
            data: [],
            borderColor: '#F7ADAD', // Samakan dengan warna .legend-dot Tengah
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            tension: 0.3
          },
          {
            label: 'Dasar',
            data: [],
            borderColor: '#5003C0', // Samakan dengan warna .legend-dot Dasar
            backgroundColor: 'rgba(190, 18, 60, 0.1)',
            tension: 0.3
          }
        ]
      },
      // ... options
    });
  }

  // 2. Grafik Single Parameter (DO, pH, Kedalaman)
  chartDO = createSingleChart('chartDO', 'DO (ppm)', '#0284c7', 'rgba(56, 189, 248, 0.15)');
  chartPH = createSingleChart('chartPH', 'pH Air', '#16a34a', 'rgba(74, 222, 128, 0.15)');
  chartKedalaman = createSingleChart('chartKedalaman', 'Kedalaman (m)', '#9333ea', 'rgba(192, 132, 252, 0.15)');
}

function createSingleChart(canvasId, labelText, lineColor, fillColor) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: labelText,
        data: [],
        borderColor: lineColor,
        backgroundColor: fillColor,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: false } }
    }
  });
}

function updateLatestCards(latest) {
  if (!latest) return;
  checkESPConnection(latest.timestamp);
  // 1. Update Nilai Teks Sensor
  setElementText("val-suhu1", `${latest.suhu1} °C`);
  setElementText("val-suhu2", `${latest.suhu2} °C`);
  setElementText("val-suhu3", `${latest.suhu3} °C`);
  setElementText("val-do", `${latest.do} ppm`);
  setElementText("val-ph", latest.ph);
  setElementText("val-kedalaman", `${latest.kedalaman} m`);
  setElementText("last-update-time", latest.timestamp);

  // 2. CEK PERINGATAN & UBAH WARNA CARD JADI MERAH
  // Card DO (Merah jika DO < 4.0)
  toggleCardDanger("card-do", latest.do < 4.0);

  // Card pH (Merah jika pH < 5.5 atau pH > 8.5)
  toggleCardDanger("card-ph", latest.ph < 5.5 || latest.ph > 8.5);

  // Card Suhu (Merah jika ada beda suhu/stratifikasi >= 1.5 °C)
  const bedaSuhu = Math.abs(latest.suhu1 - latest.suhu3);
  toggleCardDanger("card-suhu", bedaSuhu >= 1.5);

  // 3. Kalkulasi Indeks Kualitas Air
  calculateWaterQualityIndex(latest);
}

// Fungsi Helper untuk Menambah/Melepas Kelas Merah
function toggleCardDanger(cardId, isDanger) {
  const cardElem = document.getElementById(cardId);
  if (cardElem) {
    if (isDanger) {
      cardElem.classList.add("card-danger");
    } else {
      cardElem.classList.remove("card-danger");
    }
  }
}

// Logika Filter Per Tabel
function updateChartByParam(paramType) {
  if (!rawGlobalData || rawGlobalData.length === 0) return;

  let filterValue;
  if (paramType === 'suhu') filterValue = document.getElementById('filter-suhu').value;
  if (paramType === 'do') filterValue = document.getElementById('filter-do').value;
  if (paramType === 'ph') filterValue = document.getElementById('filter-ph').value;
  if (paramType === 'kedalaman') filterValue = document.getElementById('filter-kedalaman').value;

  const now = new Date();

  // Filter rentang waktu
  const filteredData = rawGlobalData.filter(item => {
    if (!item.timestamp) return false;
    const itemDate = new Date(item.timestamp);
    const diffHours = (now - itemDate) / (1000 * 60 * 60);

    if (filterValue === '1h') return diffHours <= 1;
    if (filterValue === 'today') return itemDate.toDateString() === now.toDateString();
    if (filterValue === '7d') return diffHours <= (24 * 7);
    if (filterValue === '30d') return diffHours <= (24 * 30);
    return true;
  });

  const labels = filteredData.map(item => {
    if (!item.timestamp) return '';
    const parts = item.timestamp.split(' ');
    return (filterValue === '7d' || filterValue === '30d') ? item.timestamp : parts[1];
  });

  // Khusus Grafik Suhu: Update 3 dataset sekaligus
  if (paramType === 'suhu' && chartSuhu) {
    chartSuhu.data.labels = labels;
    chartSuhu.data.datasets[0].data = filteredData.map(i => Number(i.suhu1) || 0);
    chartSuhu.data.datasets[1].data = filteredData.map(i => Number(i.suhu2) || 0);
    chartSuhu.data.datasets[2].data = filteredData.map(i => Number(i.suhu3) || 0);
    chartSuhu.update();
  } else if (paramType === 'do' && chartDO) {
    updateDataset(chartDO, labels, filteredData.map(i => Number(i.do) || 0));
  } else if (paramType === 'ph' && chartPH) {
    updateDataset(chartPH, labels, filteredData.map(i => Number(i.ph) || 0));
  } else if (paramType === 'kedalaman' && chartKedalaman) {
    updateDataset(chartKedalaman, labels, filteredData.map(i => Number(i.kedalaman) || 0));
  }
}

function updateDataset(chartObj, labels, dataPoints) {
  if (!chartObj) return;
  chartObj.data.labels = labels;
  chartObj.data.datasets[0].data = dataPoints;
  chartObj.update();
}

function showEmptyState() {
  document.getElementById('log-table-body').innerHTML = `<tr><td colspan="4" class="empty-log">Belum ada data riwayat tersedia.</td></tr>`;
}

// Tambahkan fungsi pengecekan koneksi ini di script.js
function checkESPConnection(latestTimestampStr) {
  const statusBadge = document.getElementById("esp-status-badge"); // Elemen badge status ESP di HTML
  if (!statusBadge || !latestTimestampStr) return;

  // Ubah string "dd/MM/yyyy, HH:mm:ss" jadi objek Date
  const lastDataTime = parseCustomDate(latestTimestampStr);
  const now = new Date();

  // Hitung selisih waktu dalam detik
  const diffInSeconds = Math.floor((now - lastDataTime) / 1000);

  // Jika data terakhir dikirim kurang dari 3 menit (180 detik) yang lalu -> ONLINE
  if (diffInSeconds <= 180) {
    statusBadge.innerText = "ESP32 ONLINE";
    statusBadge.className = "badge badge-success";
  } else {
    // Jika lebih dari 3 menit tidak ada data masuk -> OFFLINE
    statusBadge.innerText = "ESP32 OFFLINE";
    statusBadge.className = "badge badge-danger";
  }
}