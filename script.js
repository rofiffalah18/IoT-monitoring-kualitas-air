const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOC0765Q0jINi5kOR5QyvA_nUyAyEp5g0oFE64U-sLyx8IgtdPZlOqbbVZ5kSYAm-O1w/exec";

let chartSuhu, chartDO, chartPH, chartKedalaman;

function initCharts() {
  const defaultLabels = ['--:--', '--:--', '--:--', '--:--'];

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
    options: { responsive: true, maintainAspectRatio: false }
  });

  chartDO = new Chart(document.getElementById('chartDO'), {
    type: 'line',
    data: {
      labels: defaultLabels,
      datasets: [{ label: 'Oksigen (ppm)', data: [0, 0, 0, 0], borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  chartPH = new Chart(document.getElementById('chartPH'), {
    type: 'line',
    data: {
      labels: defaultLabels,
      datasets: [{ label: 'pH', data: [0, 0, 0, 0], borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  chartKedalaman = new Chart(document.getElementById('chartKedalaman'), {
    type: 'line',
    data: {
      labels: defaultLabels,
      datasets: [{ label: 'Kedalaman (m)', data: [0, 0, 0, 0], borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.3 }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

async function loadDataFromGoogleSheets() {
  if (!GOOGLE_SCRIPT_URL) return;

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    const result = await response.json();
    const dataArr = result.data;

    if (!dataArr || dataArr.length === 0) return;

    // Ambil data terbaru (baris paling bawah)
    const lastData = dataArr[dataArr.length - 1];

    // Cek Indikator Online / Offline
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

    // Update Teks Update Terakhir & Kartu Sensor
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

    // Update Dataset Grafik (15 Data Terakhir)
    const recentData = dataArr.slice(-15);
    const timeLabels = recentData.map(d => {
      const t = String(d.timestamp);
      return t.includes(' ') ? t.split(' ')[1] : t;
    });

    chartSuhu.data.labels = timeLabels;
    chartSuhu.data.datasets[0].data = recentData.map(d => Number(d.suhu1) || 0);
    chartSuhu.data.datasets[1].data = recentData.map(d => Number(d.suhu2) || 0);
    chartSuhu.data.datasets[2].data = recentData.map(d => Number(d.suhu3) || 0);
    chartSuhu.update();

    chartDO.data.labels = timeLabels;
    chartDO.data.datasets[0].data = recentData.map(d => Number(d.do) || 0);
    chartDO.update();

    chartPH.data.labels = timeLabels;
    chartPH.data.datasets[0].data = recentData.map(d => Number(d.ph) || 0);
    chartPH.update();

    chartKedalaman.data.labels = timeLabels;
    chartKedalaman.data.datasets[0].data = recentData.map(d => Number(d.kedalaman) || 0);
    chartKedalaman.update();

    // Render Tabel Log
    renderLogTable(dataArr.slice().reverse().slice(0, 10));

  } catch (err) {
    console.error("Gagal memuat data dari Google Sheets:", err);
  }
}

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

window.onload = () => {
  initCharts();
  loadDataFromGoogleSheets();
  setInterval(loadDataFromGoogleSheets, 10000);
};