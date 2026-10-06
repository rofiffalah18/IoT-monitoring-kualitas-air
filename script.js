// ==========================================
// CONFIGURATION & GLOBAL VARIABLES
// ==========================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOC0765Q0jINi5kOR5QyvA_nUyAyEp5g0oFE64U-sLyx8IgtdPZlOqbbVZ5kSYAm-O1w/exec";

let chartSuhu, chartDO, chartPH, chartKedalaman;
let globalAllData = [];

// Variabel Paginasi Tabel Riwayat
let currentPage = 1;
const rowsPerPage = 15;

// Filter aktif untuk masing-masing grafik (default: 'jam')
const chartFilters = {
  suhu: 'jam',
  do: 'jam',
  ph: 'jam',
  kedalaman: 'jam'
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Helper 1: Mendapatkan Judul Sumbu X berdasarkan filter
function getXAxisTitle(timeframe) {
  if (timeframe === 'jam') return 'Menit Ke-';
  if (timeframe === 'hari') return 'Jam Ke-';
  if (timeframe === 'minggu') return 'Hari';
  if (timeframe === 'bulan') return 'Tanggal';
  return '';
}

// Helper 2: Formatter Label Sumbu X Dinamis
function formatTimeLabels(dataArr, timeframe) {
  const namaHariFull = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  return dataArr.map(d => {
    const dateObj = new Date(d.timestamp);
    const isValidDate = !isNaN(dateObj.getTime());

    if (timeframe === 'jam') {
      return isValidDate ? dateObj.getMinutes() : String(d.timestamp);
    } else if (timeframe === 'hari') {
      return isValidDate ? dateObj.getHours() : String(d.timestamp);
    } else if (timeframe === 'minggu') {
      return isValidDate ? namaHariFull[dateObj.getDay()] : String(d.timestamp);
    } else if (timeframe === 'bulan') {
      return isValidDate ? dateObj.getDate() : String(d.timestamp);
    }
    return String(d.timestamp);
  });
}

// Helper 3: Filter Rentang Data Grafik
function getFilteredDataByTimeframe(timeframe) {
  if (!globalAllData || globalAllData.length === 0) return [];
  const now = new Date();

  if (timeframe === 'jam') {
    const oneHourAgo = new Date(now.getTime() - (1 * 60 * 60 * 1000));
    const recent = globalAllData.filter(d => new Date(d.timestamp) >= oneHourAgo);
    return recent.length > 0 ? recent : globalAllData.slice(-12);
  } else if (timeframe === 'hari') {
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    return globalAllData.filter(d => new Date(d.timestamp) >= twentyFourHoursAgo);
  } else if (timeframe === 'minggu') {
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    return globalAllData.filter(d => new Date(d.timestamp) >= sevenDaysAgo);
  } else if (timeframe === 'bulan') {
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    return globalAllData.filter(d => new Date(d.timestamp) >= thirtyDaysAgo);
  }
  return globalAllData.slice(-12);
}

// Helper 4: Opsi Standar Chart.js
function createChartOptions(yAxisTitle) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: 'Menit Ke-',
          font: { weight: 'bold', size: 11 }
        },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
      },
      y: {
        title: {
          display: true,
          text: yAxisTitle,
          font: { weight: 'bold', size: 11 }
        }
      }
    }
  };
}

// Helper 5: Pengecekan Status ESP32 (Termasuk Jam Kerja 06:00 - 18:00)
function checkESP32Status(lastTimestamp) {
  const statusDot = document.getElementById('connection-status-dot');
  if (!statusDot || !lastTimestamp) return;

  const now = new Date();
  const currentHour = now.getHours();

  // Cek jika di luar jam operasional (18.00 sore - 06.00 pagi)
  if (currentHour < 6 || currentHour >= 18) {
    statusDot.className = "status-indicator offline";
    statusDot.innerText = "ESP32 Standby (Luar Jam Kerja)";
    return;
  }

  // Jika dalam jam kerja (06.00 - 18.00), cek toleransi keterlambatan 35 menit
  const lastDataTime = new Date(lastTimestamp);
  const diffInMinutes = (now - lastDataTime) / (1000 * 60);

  if (diffInMinutes > 35 || isNaN(diffInMinutes)) {
    statusDot.className = "status-indicator offline";
    statusDot.innerText = "ESP32 Offline";
  } else {
    statusDot.className = "status-indicator online";
    statusDot.innerText = "ESP32 Online";
  }
}

// Helper 6: Rekomendasi & Analisis Kualitas Air Dinamis
function updateStatusRecommendation(lastData) {
  const doVal = Number(lastData.do) || 0;
  const suhu1 = Number(lastData.suhu1) || 0;
  const suhu3 = Number(lastData.suhu3) || 0;

  // Analisis Oksigen Terlarut (DO)
  const elMsgDO = document.getElementById('msg-oksigen');
  if (elMsgDO) {
    if (doVal < 4.0) {
      elMsgDO.innerText = `Kadar oksigen rendah (${doVal} ppm). Segera nyalakan/tambah kecepatan aerator!`;
      elMsgDO.style.color = '#dc2626';
    } else if (doVal >= 4.0 && doVal <= 6.5) {
      elMsgDO.innerText = `Kadar oksigen normal (${doVal} ppm). Kondisi air optimal.`;
      elMsgDO.style.color = '#16a34a';
    } else {
      elMsgDO.innerText = `Kadar oksigen terlalu tinggi (${doVal} ppm). Kurangi kecepatan aerator/kincir air!`;
      elMsgDO.style.color = '#d97706';
    }
  }

  // Analisis Stratifikasi Suhu
  const elMsgSuhu = document.getElementById('msg-stratifikasi');
  if (elMsgSuhu) {
    const diffSuhu = Math.abs(suhu1 - suhu3);
    if (diffSuhu >= 1.5) {
      elMsgSuhu.innerText = `Terjadi stratifikasi suhu kolam (Selisih: ${diffSuhu.toFixed(1)} °C). Perlu pengadukan air!`;
      elMsgSuhu.style.color = '#dc2626';
    } else {
      elMsgSuhu.innerText = `Tidak ada stratifikasi suhu signifikan. Air kolam tercampur baik.`;
      elMsgSuhu.style.color = '#16a34a';
    }
  }
}

// ==========================================
// CHART INITIALIZATION & RENDERING
// ==========================================

function initCharts() {
  const defaultLabels = ['0', '5', '10', '15'];

  chartSuhu = new Chart(document.getElementById('chartSuhu'), {
    type: 'line',
    data: {
      labels: defaultLabels,
      datasets: [
        { label: 'Suhu Permukaan', data: [0, 0, 0, 0], borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 },
        { label: 'Suhu Kolom', data: [0, 0, 0, 0], borderColor: '#0d9488', backgroundColor: 'rgba(13, 148, 136, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 },
        { label: 'Suhu Dasar', data: [0, 0, 0, 0], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 }
      ]
    },
    options: createChartOptions('Suhu (°C)')
  });

  chartDO = new Chart(document.getElementById('chartDO'), {
    type: 'line',
    data: {
      labels: defaultLabels,
      datasets: [{ label: 'Oksigen Terlarut', data: [0, 0, 0, 0], borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 }]
    },
    options: createChartOptions('Kadar Oksigen (ppm)')
  });

  chartPH = new Chart(document.getElementById('chartPH'), {
    type: 'line',
    data: {
      labels: defaultLabels,
      datasets: [{ label: 'pH Air', data: [0, 0, 0, 0], borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 }]
    },
    options: createChartOptions('Tingkat Keasaman (pH)')
  });

  chartKedalaman = new Chart(document.getElementById('chartKedalaman'), {
    type: 'line',
    data: {
      labels: defaultLabels,
      datasets: [{ label: 'Kedalaman Air', data: [0, 0, 0, 0], borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 }]
    },
    options: createChartOptions('Kedalaman (Meter)')
  });
}

function renderChartByType(chartType) {
  const timeframe = chartFilters[chartType];
  const dataset = getFilteredDataByTimeframe(timeframe);
  const labels = formatTimeLabels(dataset, timeframe);
  const xAxisTitle = getXAxisTitle(timeframe);

  let targetChart;
  if (chartType === 'suhu') targetChart = chartSuhu;
  else if (chartType === 'do') targetChart = chartDO;
  else if (chartType === 'ph') targetChart = chartPH;
  else if (chartType === 'kedalaman') targetChart = chartKedalaman;

  if (targetChart) {
    targetChart.data.labels = labels;
    targetChart.options.scales.x.title.text = xAxisTitle;

    if (chartType === 'suhu') {
      targetChart.data.datasets[0].data = dataset.map(d => Number(d.suhu1) || 0);
      targetChart.data.datasets[1].data = dataset.map(d => Number(d.suhu2) || 0);
      targetChart.data.datasets[2].data = dataset.map(d => Number(d.suhu3) || 0);
    } else if (chartType === 'do') {
      targetChart.data.datasets[0].data = dataset.map(d => Number(d.do) || 0);
    } else if (chartType === 'ph') {
      targetChart.data.datasets[0].data = dataset.map(d => Number(d.ph) || 0);
    } else if (chartType === 'kedalaman') {
      targetChart.data.datasets[0].data = dataset.map(d => Number(d.kedalaman) || 0);
    }

    targetChart.update();
  }
}

function updateAllCharts() {
  renderChartByType('suhu');
  renderChartByType('do');
  renderChartByType('ph');
  renderChartByType('kedalaman');
}

function filterSingleChart(chartType, timeframe, evt) {
  chartFilters[chartType] = timeframe;
  if (evt && evt.target) {
    const parent = evt.target.closest('.chart-filter-container');
    if (parent) {
      parent.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
      evt.target.classList.add('active');
    }
  }
  renderChartByType(chartType);
}

// ==========================================
// RENDER TABEL LOG & PAGINASI 15 BARIS
// ==========================================

function renderActivityHistory(dataArray) {
  const tableBody = document.getElementById('log-table-body');
  if (!tableBody) return;

  if (!dataArray || dataArray.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: #94a3b8; padding: 12px;">
          Belum ada riwayat aktivitas data.
        </td>
      </tr>`;
    renderPaginationControls(0);
    return;
  }

  const reversedData = [...dataArray].reverse();
  const totalItems = reversedData.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage);

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedLogs = reversedData.slice(startIndex, endIndex);

  const now = new Date();
  const currentHour = now.getHours();
  const isWorkHours = currentHour >= 6 && currentHour < 18;

  let htmlContent = '';
  paginatedLogs.forEach((item, index) => {
    // Deteksi jika data paling atas terjadi di luar jam kerja
    const isLatestAndOff = (index === 0) && !isWorkHours;

    htmlContent += `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">${item.timestamp || '-'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">
          <span style="color:${isLatestAndOff ? '#64748b' : '#0284c7'}; font-weight:600;">
            ${isLatestAndOff ? 'Non-Aktif' : 'Aktif'}
          </span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">
          <span style="color:${isLatestAndOff ? '#d97706' : '#16a34a'}; font-weight:600;">
            ${isLatestAndOff ? 'Standby' : 'Online'}
          </span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">
          ${isLatestAndOff ? 'ESP32 mati (Luar jam operasional 06:00-18:00)' : 'Pengiriman data sensor berhasil'}
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = htmlContent;
  renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
  let paginationContainer = document.getElementById('pagination-container');
  
  if (!paginationContainer) {
    const tableResp = document.querySelector('.table-responsive');
    if (tableResp) {
      paginationContainer = document.createElement('div');
      paginationContainer.id = 'pagination-container';
      paginationContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding: 0 4px;';
      tableResp.after(paginationContainer);
    } else {
      return;
    }
  }

  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }

  paginationContainer.innerHTML = `
    <span style="font-size: 13px; color: #64748b; font-weight: 500;">
      Halaman <b>${currentPage}</b> dari <b>${totalPages}</b>
    </span>
    <div style="display: flex; gap: 8px;">
      <button onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''} 
        style="padding: 6px 12px; font-size: 12px; font-weight: 600; border: 1px solid #cbd5e1; border-radius: 6px; background: ${currentPage === 1 ? '#f1f5f9' : '#ffffff'}; color: ${currentPage === 1 ? '#94a3b8' : '#0f172a'}; cursor: ${currentPage === 1 ? 'not-allowed' : 'pointer'};">
        ← Sblmnya
      </button>
      <button onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''} 
        style="padding: 6px 12px; font-size: 12px; font-weight: 600; border: 1px solid #cbd5e1; border-radius: 6px; background: ${currentPage === totalPages ? '#f1f5f9' : '#ffffff'}; color: ${currentPage === totalPages ? '#94a3b8' : '#0f172a'}; cursor: ${currentPage === totalPages ? 'not-allowed' : 'pointer'};">
        Lanjutnya →
      </button>
    </div>
  `;
}

function changePage(direction) {
  currentPage += direction;
  renderActivityHistory(globalAllData);
}

// ==========================================
// DATA FETCHING FROM GOOGLE SHEETS
// ==========================================

async function loadDataFromGoogleSheets() {
  if (!GOOGLE_SCRIPT_URL) return;

  const tableBody = document.getElementById('log-table-body');
  const statusDot = document.getElementById('connection-status-dot');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(GOOGLE_SCRIPT_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error("Respon server gagal");

    const result = await response.json();
    globalAllData = result.data || [];

    if (globalAllData.length === 0) {
      renderActivityHistory([]);
      if (statusDot) {
        statusDot.className = "status-indicator offline";
        statusDot.innerText = "ESP32 Offline";
      }
      return;
    }

    const lastData = globalAllData[globalAllData.length - 1];

    // Cek Status Online/Standby/Offline
    checkESP32Status(lastData.timestamp);

    // Update Teks Rekomendasi
    updateStatusRecommendation(lastData);

    // Update Teks Terakhir Diperbarui
    const txtLastUpdate = document.getElementById('txt-last-update');
    if (txtLastUpdate) {
      txtLastUpdate.innerText = "TERAKHIR DIPERBARUI: " + (lastData.timestamp || '-');
    }

    // Update Kartu Nilai Sensor Real-time
    if (document.getElementById('val-suhu1')) document.getElementById('val-suhu1').innerText = lastData.suhu1 ?? 0;
    if (document.getElementById('val-suhu2')) document.getElementById('val-suhu2').innerText = lastData.suhu2 ?? 0;
    if (document.getElementById('val-suhu3')) document.getElementById('val-suhu3').innerText = lastData.suhu3 ?? 0;
    if (document.getElementById('val-do')) document.getElementById('val-do').innerText = lastData.do ?? 0;
    if (document.getElementById('val-ph')) document.getElementById('val-ph').innerText = lastData.ph ?? 0;
    if (document.getElementById('val-kedalaman')) document.getElementById('val-kedalaman').innerText = lastData.kedalaman ?? 0;

    // Refresh Grafik & Tabel Riwayat Log
    updateAllCharts();
    renderActivityHistory(globalAllData);

  } catch (err) {
    console.error("Gagal terhubung ke Google Sheets:", err);
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: #ef4444; padding: 12px; font-weight: 600;">
            Gagal terhubung ke server / ESP32 Offline.
          </td>
        </tr>`;
    }
    if (statusDot) {
      statusDot.className = "status-indicator offline";
      statusDot.innerText = "ESP32 Offline";
    }
  }
}

// ==========================================
// APP INITIALIZATION
// ==========================================

window.onload = () => {
  initCharts();
  loadDataFromGoogleSheets();
  setInterval(loadDataFromGoogleSheets, 10000); // Polling data tiap 10 detik
};