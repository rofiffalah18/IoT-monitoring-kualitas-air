const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzPcQ6YPapGf37XNUF3TofDkfkWLkMM5ibjBDk301uX7SRv-J9l-ipdxPVhnD2An4XlfQ/exec"; 

const REFRESH_INTERVAL = 10000; // Auto-refresh data tiap 10 detik

let rawDataSensor = [];
let chartSuhu, chartDO, chartPH, chartKedalaman;

// ==========================================
// 1. INISIALISASI HALAMAN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  fetchData();
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
      return (now - itemDate) <= (1 * 60 * 60 * 1000);
    } 
    if (filterValue === "today") {
      return itemDate.toDateString() === now.toDateString();
    } 
    if (filterValue === "7d") {
      return (now - itemDate) <= (7 * 24 * 60 * 60 * 1000);
    } 
    if (filterValue === "30d") {
      return (now - itemDate) <= (30 * 24 * 60 * 60 * 1000);
    }
    return true;
  });
}

// ==========================================
// 2. FUNGSI FETCH DATA DARI SERVER
// ==========================================
async function fetchData() {
  try {
    const response = await fetch(SCRIPT_URL, { redirect: "follow" });
    
    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }

    const result = await response.json();

    if (Array.isArray(result) && result.length > 0) {
      rawDataSensor = result;
      const latestData = result[result.length - 1];

      updateLastUpdateTime(latestData.timestamp);
      checkESP32Status(latestData);
      updateSensorCards(latestData);

      // Update Indeks Kualitas Air (0 - 100)
      const ika = calculateWaterQualityIndex(latestData);
      const valIka = document.getElementById("val-ika");
      const statusBadge = document.getElementById("status-badge");
      if (valIka) valIka.innerText = ika.score;
      if (statusBadge) {
        statusBadge.innerText = ika.status;
        statusBadge.style.backgroundColor = ika.color;
      }

      // Update Peringatan & Rekomendasi
      updateSystemRecommendation(latestData);

      // Update Grafik & Tabel Log
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
      txtStatus.innerText = "OFFLINE";
    }
  }
}

// ==========================================
// 3. PARSER TANGGAL & STATUS ONLINE/OFFLINE
// ==========================================
function parseCustomDate(str) {
  if (!str) return new Date();
  
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

  const isDummy = latestData.catatan && latestData.catatan.includes("[DUMMY]");
  const maxTolerance = isDummy ? 2 : 31;

  if (diffInMinutes <= maxTolerance) {
    statusContainer.className = "status-pill online";
    txtStatus.innerText = "ONLINE";
  } else {
    statusContainer.className = "status-pill offline";
    txtStatus.innerText = "OFFLINE";
  }
}

function updateLastUpdateTime(timestamp) {
  const elem = document.getElementById("last-update-time");
  if (elem) elem.innerText = `Update Terakhir: ${timestamp}`;
}

// ==========================================
// 4. KARTU SENSOR & EFEK BORDER DANGER
// ==========================================
function updateSensorCards(data) {
  if (!data) return;

  setElementText("val-suhu1", data.suhu1 === -127 ? "ERR" : data.suhu1);
  setElementText("val-suhu2", data.suhu2 === -127 ? "ERR" : data.suhu2);
  setElementText("val-suhu3", data.suhu3 === -127 ? "ERR" : data.suhu3);
  setElementText("val-do", data.do === -1 ? "ERR" : data.do);
  setElementText("val-ph", data.ph === -1 ? "ERR" : data.ph);
  setElementText("val-kedalaman", data.kedalaman === -1 ? "ERR" : data.kedalaman);

  const isSuhu1Danger = data.suhu1 === -127 || data.suhu1 < 25.0 || data.suhu1 > 32.0;
  const isSuhu2Danger = data.suhu2 === -127 || data.suhu2 < 25.0 || data.suhu2 > 32.0;
  const isSuhu3Danger = data.suhu3 === -127 || data.suhu3 < 25.0 || data.suhu3 > 32.0;
  const isDODanger    = data.do === -1 || data.do < 3.0;
  const isPHDanger    = data.ph === -1 || data.ph < 5.5 || data.ph > 8.5;
  const isKedalamanDanger = data.kedalaman === -1 || data.kedalaman < 80.0; // < 80 cm

  setConditionText("status-suhu1", isSuhu1Danger ? "Bahaya / Anomali" : "Normal");
  setConditionText("status-suhu2", isSuhu2Danger ? "Bahaya / Anomali" : "Normal");
  setConditionText("status-suhu3", isSuhu3Danger ? "Bahaya / Anomali" : "Normal");
  setConditionText("status-do", isDODanger ? "Bahaya (Anoksia/Rendah)" : "Normal");
  setConditionText("status-ph", isPHDanger ? "Bahaya (Ekstrem)" : "Normal");
  setConditionText("status-kedalaman", isKedalamanDanger ? "Waspada (Dangkal)" : "Normal");

  toggleCardDangerByClass("card-suhu1", isSuhu1Danger);
  toggleCardDangerByClass("card-suhu2", isSuhu2Danger);
  toggleCardDangerByClass("card-suhu3", isSuhu3Danger);
  toggleCardDangerByClass("card-do", isDODanger);
  toggleCardDangerByClass("card-ph", isPHDanger);
  toggleCardDangerByClass("card-kedalaman", isKedalamanDanger);
}

function setConditionText(id, text) {
  const elem = document.getElementById(id);
  if (elem) elem.innerText = `Kondisi: ${text}`;
}

function toggleCardDangerByClass(className, isDanger) {
  const cardElem = document.querySelector(`.${className}`);
  if (cardElem) {
    if (isDanger) {
      cardElem.classList.add("card-sensor-danger");
    } else {
      cardElem.classList.remove("card-sensor-danger");
    }
  }
}

function setElementText(id, text) {
  const elem = document.getElementById(id);
  if (elem) elem.innerText = text;
}

// ==========================================
// 5. KALKULASI INDEKS KUALITAS AIR (0-100)
// ==========================================
function calculateWaterQualityIndex(data) {
  if (!data) return { score: 0, status: "TIDAK ADA DATA", color: "#9ca3af" };

  let totalPenalty = 0;

  if (data.suhu1 === -127 || data.suhu1 < 25.0 || data.suhu1 > 32.0) totalPenalty += 15;
  if (data.suhu2 === -127 || data.suhu2 < 25.0 || data.suhu2 > 32.0) totalPenalty += 15;
  if (data.suhu3 === -127 || data.suhu3 < 25.0 || data.suhu3 > 32.0) totalPenalty += 15;

  if (data.do === -1 || data.do < 3.0) {
    totalPenalty += 25;
  } else if (data.do < 4.5) {
    totalPenalty += 15;
  }

  if (data.ph === -1 || data.ph < 5.5 || data.ph > 8.5) {
    totalPenalty += 25;
  } else if (data.ph < 6.5 || data.ph > 7.8) {
    totalPenalty += 15;
  }

  if (data.kedalaman === -1 || data.kedalaman < 80.0) totalPenalty += 15;

  const finalScore = Math.max(0, 100 - totalPenalty);

  let status = "NORMAL / BAIK";
  let color = "#10b981";

  if (finalScore < 50) {
    status = "BAHAYA / BURUK";
    color = "#ef4444";
  } else if (finalScore < 75) {
    status = "WASPADA / CUKUP";
    color = "#f59e0b";
  }

  return { score: finalScore, status: status, color: color };
}

// ==========================================
// 6. REKOMENDASI & PERINGATAN SISTEM
// ==========================================
function updateSystemRecommendation(data) {
  const container = document.getElementById("alert-container");
  if (!container) return;

  if (!data) {
    container.innerHTML = "<div class='alert-item success'>Sistem berjalan normal.</div>";
    return;
  }

  const warnings = [];

  if (data.suhu1 === -127 || data.suhu2 === -127 || data.suhu3 === -127) {
    warnings.push("⚠️ <b>Sensor Suhu Error:</b> Terjadi kendala pembacaan pada salah satu sensor DS18B20.");
  }
  if (data.do === -1 || data.do < 3.0) {
    warnings.push(`🚨 <b>Oksigen Terlarut Kritis (${data.do} mg/L):</b> Potensi kematian ikan! Nyalakan kincir air/aerator.`);
  }
  if (data.ph === -1 || data.ph < 5.5 || data.ph > 8.5) {
    warnings.push(`🚨 <b>pH Air Ekstrem (${data.ph}):</b> Lakukan pengapuran (jika asam) atau pergantian air.`);
  }
  if (data.kedalaman === -1 || data.kedalaman < 80.0) {
    warnings.push(`⚠️ <b>Kedalaman Air Dangkal (${data.kedalaman} cm):</b> Tambahkan pasokan air ke kolam.`);
  }

  if (warnings.length === 0) {
    container.innerHTML = "<div class='alert-item success'>✅ Semua parameter kualitas air dalam kondisi normal dan aman.</div>";
  } else {
    container.innerHTML = warnings.map(item => `<div class='alert-item danger'>${item}</div>`).join("");
  }
}

// ==========================================
// 7. CHART.JS & FILTER TIMELINE
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
          { label: "Permukaan", data: [], borderColor: "#6FE6FC", backgroundColor: "#6FE6FC", tension: 0.3 },
          { label: "Tengah",     data: [], borderColor: "#F7ADAD", backgroundColor: "#F7ADAD", tension: 0.3 },
          { label: "Dasar",      data: [], borderColor: "#5003C0", backgroundColor: "#5003C0", tension: 0.3 }
        ]
      },
      options: commonOptions
    });
  }

  const ctxDO = document.getElementById("chartDO");
  if (ctxDO) {
    chartDO = new Chart(ctxDO, {
      type: "line",
      data: { labels: [], datasets: [{ label: "DO (mg/L)", data: [], borderColor: "#D4621A", tension: 0.3, fill: true }] },
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
      data: { labels: [], datasets: [{ label: "Kedalaman (cm)", data: [], borderColor: "#9333ea", tension: 0.3, fill: true }] },
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
  
  const filteredData = filterDataByTime(rawDataSensor, filterVal);

  const labels = filteredData.map(item => {
    if (!item.timestamp) return "";
    const cleanStr = item.timestamp.replace("'", "").trim();
    const parts = cleanStr.split(", ");
    
    const dateParts = parts[0] ? parts[0].split("/") : ["01", "01", "2026"];
    const timeParts = parts[1] ? parts[1].split(":") : ["00", "00", "00"];

    if (filterVal === "1h") {
      return `${timeParts[1]}'`;
    } 
    else if (filterVal === "today") {
      return `${timeParts[0]}:${timeParts[1]}`;
    } 
    else if (filterVal === "7d") {
      const itemDate = parseCustomDate(cleanStr);
      const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      return namaHari[itemDate.getDay()];
    } 
    else if (filterVal === "30d") {
      return `${dateParts[0]}/${dateParts[1]}`;
    }

    return parts[1] || parts[0];
  });

  if (type === "suhu" && chartSuhu) {
  chartSuhu.data.labels = labels;
    
    // Dataset 0: Permukaan (#6FE6FC)
    chartSuhu.data.datasets[0].data = filteredData.map(item => item.suhu1);
    chartSuhu.data.datasets[0].borderColor = "#6FE6FC";
    chartSuhu.data.datasets[0].backgroundColor = "#6FE6FC";

    // Dataset 1: Tengah (#F7ADAD)
    chartSuhu.data.datasets[1].data = filteredData.map(item => item.suhu2);
    chartSuhu.data.datasets[1].borderColor = "#F7ADAD";
    chartSuhu.data.datasets[1].backgroundColor = "#F7ADAD";

    // Dataset 2: Dasar (#5003C0)
    chartSuhu.data.datasets[2].data = filteredData.map(item => item.suhu3);
    chartSuhu.data.datasets[2].borderColor = "#5003C0";
    chartSuhu.data.datasets[2].backgroundColor = "#5003C0";
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
// 8. TABEL LOG RIWAYAT (PAGINASI 10 BARIS)
// ==========================================
let currentLogPage = 1;
const logRowsPerPage = 10;
let filteredLogData = [];

function renderActivityHistory(data) {
  if (!data || data.length === 0) return;

  const now = new Date();
  
  filteredLogData = [...data].reverse().filter(item => {
    const itemDate = parseCustomDate(item.timestamp);
    return (now - itemDate) <= (7 * 24 * 60 * 60 * 1000);
  });

  displayLogPage(currentLogPage);
}

function displayLogPage(page) {
  const tbody = document.getElementById("tbody-history") || document.querySelector("table tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const totalRows = filteredLogData.length;
  const totalPages = Math.ceil(totalRows / logRowsPerPage) || 1;

  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  currentLogPage = page;

  const startIndex = (page - 1) * logRowsPerPage;
  const endIndex = Math.min(startIndex + logRowsPerPage, totalRows);
  const pageData = filteredLogData.slice(startIndex, endIndex);

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Tidak ada riwayat log dalam 1 minggu terakhir.</td></tr>`;
  } else {
    pageData.forEach(item => {
      const tr = document.createElement("tr");
      const isWarning = item.catatan && (item.catatan.includes("WARNING") || item.catatan.includes("BAHAYA") || item.catatan.includes("ERR"));

      tr.innerHTML = `
        <td>${item.timestamp}</td>
        <td>Transmisi Sensor</td>
        <td><span class="status-tag ${isWarning ? 'tag-warning' : 'tag-normal'}">${isWarning ? 'WARNING / BAHAYA' : 'NORMAL'}</span></td>
        <td>${item.catatan || 'Transmisi Berhasil'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  const pageInfo = document.getElementById("log-page-info");
  if (pageInfo) pageInfo.innerText = `Halaman ${currentLogPage} dari ${totalPages}`;

  const btnPrev = document.getElementById("btn-prev-log");
  const btnNext = document.getElementById("btn-next-log");
  if (btnPrev) btnPrev.disabled = (currentLogPage === 1);
  if (btnNext) btnNext.disabled = (currentLogPage === totalPages || totalPages === 0);
}

function prevLogPage() {
  if (currentLogPage > 1) displayLogPage(currentLogPage - 1);
}

function nextLogPage() {
  const totalPages = Math.ceil(filteredLogData.length / logRowsPerPage);
  if (currentLogPage < totalPages) displayLogPage(currentLogPage + 1);
}

function showEmptyState() {
  console.warn("Data kosong dari server.");
}

function downloadCSV() {
      const btn = document.getElementById('btnExport');
      btn.innerText = "⏳ Memproses Data...";
      btn.disabled = true;

      // Panggil fungsi Google Apps Script
      google.script.run
        .withSuccessHandler(function(data) {
          if (!data || data.length === 0) {
            alert("Tidak ada data ditemukan dalam 1 bulan terakhir!");
            resetButton();
            return;
          }

          // Format struktur CSV
          const headers = Object.keys(data[0]);
          let csvContent = headers.join(",") + "\n";

          data.forEach(row => {
            let values = headers.map(header => {
              let val = row[header] === null || row[header] === undefined ? "" : row[header];
              val = val.toString().replace(/"/g, '""');
              if (val.includes(",") || val.includes("\n")) {
                val = `"${val}"`;
              }
              return val;
            });
            csvContent += values.join(",") + "\n";
          });

          // Pemicu download otomatis melalui elemen anchor buatan
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          
          const now = new Date();
          const monthYear = now.toISOString().slice(0, 7);
          
          link.setAttribute("href", url);
          link.setAttribute("download", `Data_WaterMonitoring_${monthYear}.csv`);
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          resetButton();
        })
        .withFailureHandler(function(err) {
          alert("Gagal mengunduh: " + err.message);
          resetButton();
        })
        .getWaterDataOneMonth();
    }

    function resetButton() {
      const btn = document.getElementById('btnExport');
      btn.innerText = "📥 Download Data (1 Bulan)";
      btn.disabled = false;
    }