const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOC0765Q0jINi5kOR5QyvA_nUyAyEp5g0oFE64U-sLyx8IgtdPZlOqbbVZ5kSYAm-O1w/exec";

let chartSuhu, chartDO, chartPH, chartKedalaman;
let globalAllData = []; // Menyimpan seluruh data dari Apps Script
let currentFilter = 'hari'; // Default filter

// 1. INISIALISASI GRAFIK
function initCharts() {
  const defaultLabels = ['--:--', '--:--', '--:--', '--:--'];

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: {
          maxRotation: 0, // Mencegah teks miring panjang
          autoSkip: true,
          maxTicksLimit: 10
        }
      }
    }
  };

  chartSuhu = new Chart(document.getElementById('chartSuhu'), {
    type: 'line',
    data: {
      labels: defaultLabels,
      datasets: [
        { label: 'Suhu Permukaan (°C)', data: [0, 0, 0, 0], borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 },
        { label: 'Suhu Kolom (°C)', data: [0, 0, 0, 0], borderColor: '#0d9488', backgroundColor: 'rgba(13, 148, 136, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 },
        { label: 'Suhu Dasar (°C)', data: [0, 0, 0, 0], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 }
      ]
    },
    options: commonOptions
  });

  chartDO = new Chart(document.getElementById('chartDO'), {
    type: 'line',
    data: {
      labels: defaultLabels,
      datasets: [{ label: 'Oksigen (ppm)', data: [0, 0, 0, 0], borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 }]
    },
    options: commonOptions
  });

  chartPH = new Chart(document.getElementById('chartPH'), {
    type: 'line',
    data: {
      labels: defaultLabels,
      datasets: [{ label: 'pH', data: [0, 0, 0, 0], borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 }]
    },
    options: commonOptions
  });

  chartKedalaman = new Chart(document.getElementById('chartKedalaman'), {
    type: 'line',
    data: {
      labels: defaultLabels,
      datasets: [{ label: 'Kedalaman (m)', data: [0, 0, 0, 0], borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 }]
    },
    options: commonOptions
  });
}

// 2. FUNGSI AMBIL DATA DARI GOOGLE APPS SCRIPT
async function loadDataFromGoogleSheets() {
  if (!GOOGLE_SCRIPT_URL) return;

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    const result = await response.json();
    globalAllData = result.data || [];

    if (globalAllData.length === 0) return;

    // Data Terbaru (Baris Paling Bawah)
    const lastData = globalAllData[globalAllData.length - 1];

    // Status Online/Offline ESP32
    const lastTime = new Date(lastData.timestamp).getTime();
    const nowTime = new Date().getTime();
    const diffMinutes = (nowTime - lastTime) / (1000 * 60);

    const dot = document.getElementById('connection-status-dot');
    if (dot) {
      if (isNaN(diffMinutes) || diffMinutes > 5) {
        dot.className = "status-indicator offline";
        dot.innerText = "ESP32 Offline";
      } else {
        dot.className = "status-indicator online";
        dot.innerText = "ESP32 Online";
      }
    }

    // Update Kartu Sensor
    if (document.getElementById('txt-last-update')) {
      document.getElementById('txt-last-update').innerText = "TERAKHIR DIPERBARUI: " + lastData.timestamp;
    }
    if (document.getElementById('val-suhu1')) document.getElementById('val-suhu1').innerText = lastData.suhu1 ?? 0;
    if (document.getElementById('val-suhu2')) document.getElementById('val-suhu2').innerText = lastData.suhu2 ?? 0;
    if (document.getElementById('val-suhu3')) document.getElementById('val-suhu3').innerText = lastData.suhu3 ?? 0;
    if (document.getElementById('val-do')) document.getElementById('val-do').innerText = lastData.do ?? 0;
    if (document.getElementById('val-ph')) document.getElementById('val-ph').innerText = lastData.ph ?? 0;
    if (document.getElementById('val-kedalaman')) document.getElementById('val-kedalaman').innerText = lastData.kedalaman ?? 0;

    // Update Status Badge & Saran
    const badge = document.getElementById('badge-status');
    if (badge && lastData.status) {
      badge.innerText = lastData.status;
      badge.className = "badge-status " + String(lastData.status).toLowerCase();
    }

    if (document.getElementById('txt-saran-oksigen') && lastData.saran_oksigen) {
      document.getElementById('txt-saran-oksigen').innerText = lastData.saran_oksigen;
    }
    if (document.getElementById('txt-saran-suhu') && lastData.saran_suhu) {
      document.getElementById('txt-saran-suhu').innerText = lastData.saran_suhu;
    }

    // Update Grafik Berdasarkan Filter yang Aktif
    updateChartsByFilter();

    // Render Tabel Log Aktivitas
    renderLogTable(globalAllData.slice().reverse().slice(0, 10));

  } catch (err) {
    console.error("Gagal memuat data dari Google Sheets:", err);
  }
}

// 3. FUNGSI FILTER RENTANG WAKTU (Hari, Minggu, Bulan)
function filterData(type) {
  currentFilter = type;

  // Highlight tombol filter yang aktif
  document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');

  updateChartsByFilter();
}

function updateChartsByFilter() {
  if (!globalAllData || globalAllData.length === 0) return;

  const now = new Date();
  let filteredData = [];

  if (currentFilter === 'hari') {
    // Ambil data 24 jam terakhir / 20 data terbaru
    filteredData = globalAllData.slice(-20);
  } else if (currentFilter === 'minggu') {
    // Data 7 hari terakhir
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    filteredData = globalAllData.filter(d => new Date(d.timestamp) >= sevenDaysAgo);
  } else if (currentFilter === 'bulan') {
    // Data 30 hari terakhir
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    filteredData = globalAllData.filter(d => new Date(d.timestamp) >= thirtyDaysAgo);
  }

  if (filteredData.length === 0) filteredData = globalAllData.slice(-20);

  // FORMAT LABEL SUMBU X BERDASARKAN FILTER
  const timeLabels = filteredData.map(d => {
    const rawTime = String(d.timestamp);
    if (currentFilter === 'hari') {
      // Tampilkan Jam:Menit saja (contoh: 14:30)
      if (rawTime.includes('T')) {
        return rawTime.split('T')[1].substring(0, 5);
      } else if (rawTime.includes(' ')) {
        return rawTime.split(' ')[1].substring(0, 5);
      }
      return rawTime;
    } else {
      // Tampilkan Tgl/Bln (contoh: 06/10)
      const dateObj = new Date(d.timestamp);
      if (!isNaN(dateObj.getTime())) {
        return `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      }
      return rawTime.split('T')[0] || rawTime;
    }
  });

  // Update Data Grafik
  chartSuhu.data.labels = timeLabels;
  chartSuhu.data.datasets[0].data = filteredData.map(d => Number(d.suhu1) || 0);
  chartSuhu.data.datasets[1].data = filteredData.map(d => Number(d.suhu2) || 0);
  chartSuhu.data.datasets[2].data = filteredData.map(d => Number(d.suhu3) || 0);
  chartSuhu.update();

  chartDO.data.labels = timeLabels;
  chartDO.data.datasets[0].data = filteredData.map(d => Number(d.do) || 0);
  chartDO.update();

  chartPH.data.labels = timeLabels;
  chartPH.data.datasets[0].data = filteredData.map(d => Number(d.ph) || 0);
  chartPH.update();

  chartKedalaman.data.labels = timeLabels;
  chartKedalaman.data.datasets[0].data = filteredData.map(d => Number(d.kedalaman) || 0);
  chartKedalaman.update();
}

// 4. FUNGSI ISI TABEL LOG
function renderLogTable(logs) {
  const tbody = document.getElementById('log-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  logs.forEach(item => {
    const tr = document.createElement('tr');

    const isOnline = item.status_esp !== 'OFFLINE';
    const badgeClass = isOnline ? 'online' : 'offline';
    const espStatusText = item.status_esp || 'ONLINE';

    tr.innerHTML = `
      <td>${item.timestamp}</td>
      <td><span class="badge-log ${badgeClass}">${isOnline ? 'TERKONEKSI' : 'TERPUTUS'}</span></td>
      <td><span class="badge-log ${badgeClass}">${espStatusText}</span></td>
      <td>${item.keterangan || 'Pengiriman data sensor berhasil'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function downloadCSV() {
  if (GOOGLE_SCRIPT_URL) {
    window.open(GOOGLE_SCRIPT_URL + "?export=csv", "_blank");
  }
}

// Menyimpan status filter masing-masing grafik (Default: hari)
const chartFilters = {
  suhu: 'hari',
  do: 'hari',
  ph: 'hari',
  kedalaman: 'hari'
};

// Fungsi memproses filter per grafik
function filterSingleChart(chartType, timeframe, evt) {
  chartFilters[chartType] = timeframe;

  // Ubah tampilan aktif khusus untuk kelompok tombol grafik ini saja
  if (evt && evt.target) {
    const parentContainer = evt.target.closest('.chart-filter-container');
    if (parentContainer) {
      parentContainer.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
      evt.target.classList.add('active');
    }
  }

  // Update grafik spesifik
  renderChartByType(chartType);
}

// Helper untuk menyaring data berdasarkan waktu
function getFilteredDataByTimeframe(timeframe) {
  if (!globalAllData || globalAllData.length === 0) return [];
  const now = new Date();

  if (timeframe === 'hari') {
    return globalAllData.slice(-20); // 20 data terbaru
  } else if (timeframe === 'minggu') {
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    return globalAllData.filter(d => new Date(d.timestamp) >= sevenDaysAgo);
  } else if (timeframe === 'bulan') {
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    return globalAllData.filter(d => new Date(d.timestamp) >= thirtyDaysAgo);
  }
  return globalAllData.slice(-20);
}

// Helper memperformat label Sumbu X
function formatTimeLabels(dataArr, timeframe) {
  return dataArr.map(d => {
    const rawTime = String(d.timestamp);
    if (timeframe === 'hari') {
      if (rawTime.includes('T')) return rawTime.split('T')[1].substring(0, 5);
      if (rawTime.includes(' ')) return rawTime.split(' ')[1].substring(0, 5);
      return rawTime;
    } else {
      const dateObj = new Date(d.timestamp);
      if (!isNaN(dateObj.getTime())) {
        return `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      }
      return rawTime.split('T')[0] || rawTime;
    }
  });
}

// Fungsi merender grafik sesuai jenisnya secara terpisah
function renderChartByType(chartType) {
  const timeframe = chartFilters[chartType];
  const dataset = getFilteredDataByTimeframe(timeframe);
  const labels = formatTimeLabels(dataset, timeframe);

  if (chartType === 'suhu') {
    chartSuhu.data.labels = labels;
    chartSuhu.data.datasets[0].data = dataset.map(d => Number(d.suhu1) || 0);
    chartSuhu.data.datasets[1].data = dataset.map(d => Number(d.suhu2) || 0);
    chartSuhu.data.datasets[2].data = dataset.map(d => Number(d.suhu3) || 0);
    chartSuhu.update();
  } else if (chartType === 'do') {
    chartDO.data.labels = labels;
    chartDO.data.datasets[0].data = dataset.map(d => Number(d.do) || 0);
    chartDO.update();
  } else if (chartType === 'ph') {
    chartPH.data.labels = labels;
    chartPH.data.datasets[0].data = dataset.map(d => Number(d.ph) || 0);
    chartPH.update();
  } else if (chartType === 'kedalaman') {
    chartKedalaman.data.labels = labels;
    chartKedalaman.data.datasets[0].data = dataset.map(d => Number(d.kedalaman) || 0);
    chartKedalaman.update();
  }
}

// Pemanggilan saat data real-time baru masuk
function updateAllCharts() {
  renderChartByType('suhu');
  renderChartByType('do');
  renderChartByType('ph');
  renderChartByType('kedalaman');
}

window.onload = () => {
  initCharts();
  loadDataFromGoogleSheets();
  setInterval(loadDataFromGoogleSheets, 10000);
};