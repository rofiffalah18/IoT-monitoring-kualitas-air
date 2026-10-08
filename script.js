const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzPcQ6YPapGf37XNUF3TofDkfkWLkMM5ibjBDk301uX7SRv-J9l-ipdxPVhnD2An4XlfQ/exec"; 

// Auto-refresh data tiap 10 detik
const REFRESH_INTERVAL = 10000; 

let rawDataSensor = [];
let chartSuhu, chartDO, chartPH, chartKedalaman;

// ==========================================
// 1. INISIALISASI HALAMAN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  fetchData();
  
  // Pasang listener pada dropdown filter grafik
  setupFilterListeners();

  setInterval(fetchData, REFRESH_INTERVAL);
});

function setupFilterListeners() {
  const filterSuhu = document.getElementById("filter-suhu");
  const filterDO = document.getElementById("filter-do");
  const filterPH = document.getElementById("filter-ph");
  const filterKedalaman = document.getElementById("filter-kedalaman");

  if (filterSuhu) filterSuhu.addEventListener("change", () => updateSingleChart("suhu"));
  if (filterDO) filterDO.addEventListener("change", () => updateSingleChart("do"));
  if (filterPH) filterPH.addEventListener("change", () => updateSingleChart("ph"));
  if (filterKedalaman) filterKedalaman.addEventListener("change", () => updateSingleChart("kedalaman"));
}

function filterDataByTime(data, filterValue) {
  if (!data || data.length === 0) return [];
  if (filterValue === "all") return data;

  const now = new Date();
  
  return data.filter(item => {
    const itemDate = parseCustomDate(item.timestamp);
    
    if (filterValue === "1h") {
      return (now - itemDate) <= (1 * 60 * 60 * 1000); // 1 Jam terakhir
    } 
    if (filterValue === "today") {
      return itemDate.toDateString() === now.toDateString(); // Hari Ini
    } 
    if (filterValue === "7d") {
      return (now - itemDate) <= (7 * 24 * 60 * 60 * 1000); // 7 Hari
    } 
    if (filterValue === "30d") {
      return (now - itemDate) <= (30 * 24 * 60 * 60 * 1000); // 30 Hari
    }
    return true;
  });
}

// ==========================================
// 2. FUNGSI FETCH DATA (REPAIR KONEKSI)
// ==========================================
async function fetchData() {
  try {
    // Tambahkan redirect: "follow" agar tidak diblokir Google Apps Script
    const response = await fetch(SCRIPT_URL, { redirect: "follow" });
    
    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }

    const result = await response.json();

    if (Array.isArray(result) && result.length > 0) {
      rawDataSensor = result;
      const latestData = result[result.length - 1];

      // Update UI Dashboard
      updateLastUpdateTime(latestData.timestamp);
      checkESP32Status(latestData);
      updateSensorCards(latestData);
      calculateWaterQualityIndex(latestData);
      updateChartData(result);
      renderActivityHistory(result);
    } else {
      showEmptyState();
    }
  } catch (error) {
    console.error("Gagal mengambil data dari server:", error);
    
    // Tampilan Status Error Koneksi
    const txtStatus = document.getElementById('txt-status');
    const statusContainer = document.getElementById('connection-status');
    if (txtStatus && statusContainer) {
      statusContainer.className = "status-pill offline";
      txtStatus.innerText = "Error Koneksi Server";
    }
  }
}

// ==========================================
// 3. PARSER TANGGAL & CHECK STATUS ESP32
// ==========================================
function parseCustomDate(str) {
  if (!str) return new Date();
  
  // Hapus tanda petik satu jika terbawa dari spreadsheet
  const cleanStr = str.replace("'", "").trim();
  
  if (cleanStr.includes("/")) {
    const parts = cleanStr.split(", ");
    const dateParts = parts[0].split("/");
    const timeParts = parts[1] ? parts[1].split(":") : [0, 0, 0];
    
    return new Date(
      parseInt(dateParts[2]), 
      parseInt(dateParts[1]) - 1, 
      parseInt(dateParts[0]), 
      parseInt(timeParts[0]), 
      parseInt(timeParts[1]), 
      parseInt(timeParts[2]) || 0
    );
  }
  return new Date(cleanStr);
}

function checkESP32Status(latestData) {
  const txtStatus = document.getElementById('txt-status');
  const statusContainer = document.getElementById('connection-status');
  if (!txtStatus || !statusContainer || !latestData) return;

  const now = new Date();
  const lastDataTime = parseCustomDate(latestData.timestamp);
  const diffInMinutes = Math.floor((now - lastDataTime) / (1000 * 60));

  // Otomatis: Toleransi 2 menit jika DUMMY, Toleransi 31 menit jika ESP32 ASLI
  const isDummy = latestData.catatan && latestData.catatan.includes("[DUMMY]");
  const maxTolerance = isDummy ? 2 : 31;

  if (diffInMinutes <= maxTolerance) {
    statusContainer.className = "status-pill online";
    txtStatus.innerText = isDummy ? "ESP32 ONLINE (DUMMY)" : "ESP32 ONLINE";
  } else {
    statusContainer.className = "status-pill offline";
    txtStatus.innerText = "ESP32 OFFLINE";
  }
}

function updateLastUpdateTime(timestamp) {
  const elem = document.getElementById("last-update-time");
  if (elem) elem.innerText = timestamp;
}

// ==========================================
// 4. KARTU SENSOR & WARNA MERAH (BORDER DANGER)
// ==========================================
function updateSensorCards(data) {
  if (!data) return;

  // 1. Update Nilai Angka Sensor
  setElementText("val-suhu1", data.suhu1);
  setElementText("val-suhu2", data.suhu2);
  setElementText("val-suhu3", data.suhu3);
  setElementText("val-do", data.do);
  setElementText("val-ph", data.ph);
  setElementText("val-kedalaman", data.kedalaman);

  // 2. Evaluasi Kondisi Masing-Masing Sensor
  const bedaSuhu = Math.abs(data.suhu1 - data.suhu3);
  
  // Suhu dianggap bahaya jika nilainya 0 atau beda strukturnya tinggi
  const isSuhu1Danger = data.suhu1 === 0 || bedaSuhu >= 1.5;
  const isSuhu2Danger = data.suhu2 === 0;
  const isSuhu3Danger = data.suhu3 === 0 || bedaSuhu >= 1.5;
  const isDODanger = data.do < 4.0; // Nilai 0 pasti masuk ke sini
  const isPHDanger = data.ph < 5.5 || data.ph > 8.5; // Nilai 0 pasti masuk ke sini
  const isKedalamanDanger = data.kedalaman < 0.8; // Nilai 0 pasti masuk ke sini

  // Status Teks
  const statusSuhu = isSuhu1Danger ? (data.suhu1 === 0 ? "Bahaya (0°C)" : "Waspada (Beda Tinggi)") : "Normal";
  const statusDO = isDODanger ? "Bahaya (Rendah)" : "Normal";
  
  let statusPH = "Normal";
  if (data.ph < 5.5) statusPH = "Bahaya (Asam)";
  else if (data.ph > 8.5) statusPH = "Bahaya (Basa)";

  let statusKedalaman = isKedalamanDanger ? "Waspada (Dangkal)" : "Normal";

  // 3. Update Teks Kondisi di HTML
  setConditionText("status-suhu1", statusSuhu);
  setConditionText("status-suhu2", data.suhu2 === 0 ? "Bahaya (0°C)" : "Normal");
  setConditionText("status-suhu3", statusSuhu);
  setConditionText("status-do", statusDO);
  setConditionText("status-ph", statusPH);
  setConditionText("status-kedalaman", statusKedalaman);

  // 4. Efek Border Merah (Toggle Class "card-danger")
  toggleCardDangerByClass("card-suhu1", isSuhu1Danger);
  toggleCardDangerByClass("card-suhu2", isSuhu2Danger);
  toggleCardDangerByClass("card-suhu3", isSuhu3Danger);
  toggleCardDangerByClass("card-do", isDODanger);
  toggleCardDangerByClass("card-ph", isPHDanger);
  toggleCardDangerByClass("card-kedalaman", isKedalamanDanger);
}

// Helper untuk toggle warna merah
function toggleCardDangerByClass(className, isDanger) {
  const cardElem = document.querySelector(`.${className}`);
  if (cardElem) {
    if (isDanger) {
      cardElem.classList.add("card-danger");
    } else {
      cardElem.classList.remove("card-danger");
    }
  }
}

// Helper untuk toggle border danger berdasarkan Class nama kartu
function toggleCardDangerByClass(className, isDanger) {
  const cardElem = document.querySelector(`.${className}`);
  if (cardElem) {
    if (isDanger) {
      cardElem.classList.add("card-danger");
    } else {
      cardElem.classList.remove("card-danger");
    }
  }
}

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

function setElementText(id, text) {
  const elem = document.getElementById(id);
  if (elem) elem.innerText = text;
}

// ==========================================
// 5. KALKULASI INDEKS KUALITAS AIR
// ==========================================
function calculateWaterQualityIndex(data) {
  if (!data) return;

  let score = 100;
  
  // Hitung Pengurangan Skor
  if (data.do < 4.0) score -= 30;
  if (data.ph < 5.5 || data.ph > 8.5) score -= 25;
  if (Math.abs(data.suhu1 - data.suhu3) >= 1.5) score -= 20;

  score = Math.max(score, 0);

  // 1. Update Angka IKA
  const ikaElem = document.getElementById("val-ika") || document.querySelector(".index-value");
  if (ikaElem) ikaElem.innerText = score;

  // 2. Update Status Teks IKA (BAIK / WASPADA / BAHAYA)
  const statusBadge = document.getElementById("status-badge") || document.querySelector(".index-status");
  if (statusBadge) {
    if (score >= 80) {
      statusBadge.innerText = "SANGAT BAIK";
      statusBadge.className = "index-status badge-success";
    } else if (score >= 60) {
      statusBadge.innerText = "WASPADA";
      statusBadge.className = "index-status badge-warning";
    } else {
      statusBadge.innerText = "BAHAYA";
      statusBadge.className = "index-status badge-danger";
    }
  }

  // 3. Panggil Pembuat Pesan Peringatan & Rekomendasi
  renderAlerts(data, score);
}

// ==========================================
// TAMPILKAN PERINGATAN & REKOMENDASI SISTEM
// ==========================================
function renderAlerts(data, score) {
  // Cari container peringatan di HTML
  const container = document.getElementById("alert-container") || 
                    document.getElementById("recommendation-box") || 
                    document.querySelector(".alert-box") ||
                    document.querySelector("[class*='peringatan']");

  if (!container) return;

  let alerts = [];

  // Pengecekan Kondisi Sensor
  if (data.do < 4.0) {
    alerts.push("⚠️ <b>Oksigen Terlarut (DO) Rendah:</b> Tambahkan aerasi/kincir air segera.");
  }
  if (data.ph < 5.5) {
    alerts.push("⚠️ <b>pH Air Terlalu Asam:</b> Lakukan pengapuran pada kolam.");
  } else if (data.ph > 8.5) {
    alerts.push("⚠️ <b>pH Air Terlalu Basa:</b> Lakukan pergantian air bertahap.");
  }
  
  const bedaSuhu = Math.abs(data.suhu1 - data.suhu3);
  if (bedaSuhu >= 1.5) {
    alerts.push(`⚠️ <b>Stratifikasi Suhu (${bedaSuhu.toFixed(1)}°C):</b> Gunakan pompa sirkulasi air.`);
  }

  // Render Pesan ke HTML
  if (alerts.length > 0) {
    container.innerHTML = alerts.map(msg => `<div class="alert-item warning-item">${msg}</div>`).join("");
  } else {
    container.innerHTML = `<div class="alert-item success-item">✅ <b>Kondisi Air Normal:</b> Semua parameter kualitas air berada dalam batas aman.</div>`;
  }
}

// ==========================================
// 6. INIT & UPDATE CHART.JS
// ==========================================
function initCharts() {
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: false } }
  };

  const ctxSuhu = document.getElementById("chartSuhu");
  if (ctxSuhu) {
    chartSuhu = new Chart(ctxSuhu, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "Permukaan", data: [], borderColor: "#ea580c", tension: 0.3 },
          { label: "Tengah", data: [], borderColor: "#dc2626", tension: 0.3 },
          { label: "Dasar", data: [], borderColor: "#be123c", tension: 0.3 }
        ]
      },
      options: commonOptions
    });
  }

  const ctxDO = document.getElementById("chartDO");
  if (ctxDO) {
    chartDO = new Chart(ctxDO, {
      type: "line",
      data: { labels: [], datasets: [{ label: "DO (ppm)", data: [], borderColor: "#2563eb", tension: 0.3, fill: true }] },
      options: commonOptions
    });
  }

  const ctxPH = document.getElementById("chartPH");
  if (ctxPH) {
    chartPH = new Chart(ctxPH, {
      type: "line",
      data: { labels: [], datasets: [{ label: "pH Air", data: [], borderColor: "#16a34a", tension: 0.3, fill: true }] },
      options: commonOptions
    });
  }

  const ctxKedalaman = document.getElementById("chartKedalaman");
  if (ctxKedalaman) {
    chartKedalaman = new Chart(ctxKedalaman, {
      type: "line",
      data: { labels: [], datasets: [{ label: "Kedalaman (m)", data: [], borderColor: "#0891b2", tension: 0.3, fill: true }] },
      options: commonOptions
    });
  }
}

function updateChartData(data) {
  if (!data || data.length === 0) return;
  rawDataSensor = data;

  updateSingleChart("suhu");
  updateSingleChart("do");
  updateSingleChart("ph");
  updateSingleChart("kedalaman");
}

function updateSingleChart(type) {
  const selectElem = document.getElementById(`filter-${type}`);
  const filterVal = selectElem ? selectElem.value : "today";
  
  // Filter data sesuai opsi dropdown
  const filteredData = filterDataByTime(rawDataSensor, filterVal);

  // Ubah tampilan label sumbu X sesuai aturan filter
  const labels = filteredData.map(item => {
    if (!item.timestamp) return "";
    const cleanStr = item.timestamp.replace("'", "").trim(); // "dd/MM/yyyy, HH:mm:ss"
    const parts = cleanStr.split(", ");
    
    const dateParts = parts[0] ? parts[0].split("/") : ["01", "01", "2026"]; // [dd, MM, yyyy]
    const timeParts = parts[1] ? parts[1].split(":") : ["00", "00", "00"]; // [HH, mm, ss]

    if (filterVal === "1h") {
      // 1. Pilih Jam -> Munculin MENIT saja (misal: "15'")
      return `${timeParts[1]}'`;
    } 
    else if (filterVal === "today") {
      // 2. Pilih Hari Ini -> Munculin JAM saja tanpa menit detik (misal: "14:00")
      return `${timeParts[0]}:00`;
    } 
    else if (filterVal === "7d") {
      // 3. Pilih Minggu -> Munculin NAMA HARI saja (misal: "Senin", "Selasa")
      const itemDate = parseCustomDate(cleanStr);
      const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      return namaHari[itemDate.getDay()];
    } 
    else if (filterVal === "30d") {
      // 4. Pilih Bulan -> Munculin TANGGAL dan BULAN saja (misal: "08/10")
      return `${dateParts[0]}/${dateParts[1]}`;
    }

    return parts[1] || parts[0];
  });

  // Update grafik spesifik
  if (type === "suhu" && chartSuhu) {
    chartSuhu.data.labels = labels;
    chartSuhu.data.datasets[0].data = filteredData.map(item => item.suhu1);
    chartSuhu.data.datasets[1].data = filteredData.map(item => item.suhu2);
    chartSuhu.data.datasets[2].data = filteredData.map(item => item.suhu3);
    chartSuhu.update();
  } else if (type === "do" && chartDO) {
    chartDO.data.labels = labels;
    chartDO.data.datasets[0].data = filteredData.map(item => item.do);
    chartDO.update();
  } else if (type === "ph" && chartPH) {
    chartPH.data.labels = labels;
    chartPH.data.datasets[0].data = filteredData.map(item => item.ph);
    chartPH.update();
  } else if (type === "kedalaman" && chartKedalaman) {
    chartKedalaman.data.labels = labels;
    chartKedalaman.data.datasets[0].data = filteredData.map(item => item.kedalaman);
    chartKedalaman.update();
  }
}

// ==========================================
// 7. TABEL RIWAYAT LOG
// ==========================================
let currentLogPage = 1;
const logRowsPerPage = 10;
let filteredLogData = [];

// ==========================================
// RENDER TABEL LOG (OTOMATIS 1 MINGGU TERAKHIR & 10 BARIS/HALAMAN)
// ==========================================
function renderActivityHistory(data) {
  if (!data || data.length === 0) return;

  const now = new Date();
  
  // 1. Kunci data HANYA untuk 1 minggu (7 hari) terakhir & urutkan dari yang terbaru
  filteredLogData = [...data].reverse().filter(item => {
    const itemDate = parseCustomDate(item.timestamp);
    return (now - itemDate) <= (7 * 24 * 60 * 60 * 1000); // Max 7 hari
  });

  // 2. Tampilkan halaman aktif
  displayLogPage(currentLogPage);
}

function displayLogPage(page) {
  const tbody = document.getElementById("tbody-history") || document.querySelector("table tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const totalRows = filteredLogData.length;
  const totalPages = Math.ceil(totalRows / logRowsPerPage) || 1;

  // Jaga-jaga nomor halaman tidak melebihi batas
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  currentLogPage = page;

  // Ambil tepat 10 baris sesuai halaman
  const startIndex = (page - 1) * logRowsPerPage;
  const endIndex = Math.min(startIndex + logRowsPerPage, totalRows);
  const pageData = filteredLogData.slice(startIndex, endIndex);

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Tidak ada riwayat log dalam 1 minggu terakhir.</td></tr>`;
  } else {
    pageData.forEach(item => {
      const tr = document.createElement("tr");
      const isWarning = item.status === "WARNING";

      tr.innerHTML = `
        <td>${item.timestamp}</td>
        <td>Transmisi Sensor</td>
        <td><span class="status-tag ${isWarning ? 'tag-warning' : 'tag-normal'}">${item.status}</span></td>
        <td>${item.catatan}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Update Teks Info Halaman & Tombol
  const pageInfo = document.getElementById("log-page-info");
  if (pageInfo) pageInfo.innerText = `Halaman ${currentLogPage} dari ${totalPages}`;

  const btnPrev = document.getElementById("btn-prev-log");
  const btnNext = document.getElementById("btn-next-log");
  if (btnPrev) btnPrev.disabled = (currentLogPage === 1);
  if (btnNext) btnNext.disabled = (currentLogPage === totalPages || totalPages === 0);
}

// ==========================================
// NAVIGASI TOMBOL PREV & NEXT
// ==========================================
function prevLogPage() {
  if (currentLogPage > 1) {
    displayLogPage(currentLogPage - 1);
  }
}

function nextLogPage() {
  const totalPages = Math.ceil(filteredLogData.length / logRowsPerPage);
  if (currentLogPage < totalPages) {
    displayLogPage(currentLogPage + 1);
  }
}

function showEmptyState() {
  console.warn("Data kosong diterima dari server.");
}