// ==========================================
// KONFIGURASI GLOBAL & URL APPS SCRIPT
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzPcQ6YPapGf37XNUF3TofDkfkWLkMM5ibjBDk301uX7SRv-J9l-ipdxPVhnD2An4XlfQ/exec";

const REFRESH_INTERVAL = 10000;
const COOLDOWN_TIME_MS = 2 * 60 * 1000;

let rawDataSensor = [];
let chartSuhu, chartDO, chartPH, chartKedalaman;
let currentLogPage = 1;
const logRowsPerPage = 10;
let filteredLogData = [];

// ==========================================
// 1. INISIALISASI HALAMAN & EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  fetchData();
  setupFilterListeners();

  checkCooldownState('btnExport', 'cooldown_download', '📥 Download CSV');
  checkCooldownState('btnForceRead', 'cooldown_read', '🔄 Ambil Data Real-Time');

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

// ==========================================
// 2. FETCH DATA DASHBOARD
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

      // 1. FILTER KHUSUS DATA SENSOR (abaikan elemen log web saja)
      const sensorOnlyData = result.filter(item => !item.is_log_only && item.suhu1 !== undefined);

      if (sensorOnlyData.length > 0) {
        const latestSensorData = sensorOnlyData[sensorOnlyData.length - 1];

        updateLastUpdateTime(latestSensorData.timestamp);
        updateSensorCards(latestSensorData); 

        const ika = calculateWaterQualityIndex(latestSensorData);
        const valIka = document.getElementById("val-indeks-kualitas");
        const statusBadge = document.getElementById("status-badge");
        if (valIka) valIka.innerText = ika.score;
        if (statusBadge) {
          statusBadge.innerText = ika.status;
          statusBadge.style.backgroundColor = ika.color;
        }

        updateSystemRecommendation(latestSensorData);
      }

      checkESP32Status(result);
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
// 3. PARSER TANGGAL & STATUS KONEKSI (HEARTBEAT)
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

function checkESP32Status(allData) {
  const txtStatus = document.getElementById('txt-status');
  const statusContainer = document.getElementById('connection-status');
  if (!txtStatus || !statusContainer || !allData || allData.length === 0) return;

  // Filter hanya data yang murni berasal dari sensor ESP32 (bukan log web saja)
  const sensorOnlyData = allData.filter(item => !item.is_log_only && item.suhu1 !== undefined);

  if (sensorOnlyData.length === 0) {
    statusContainer.className = "status-pill offline";
    txtStatus.innerText = "OFFLINE";
    return;
  }

  // Ambil data sensor paling baru dari ESP32
  const latestSensorData = sensorOnlyData[sensorOnlyData.length - 1];

  const now = new Date();
  const lastDataTime = parseCustomDate(latestSensorData.timestamp);
  const diffInMinutes = Math.floor((now - lastDataTime) / (1000 * 60));

  // Jika data sensor terakhir sudah lebih dari 35 menit lalu -> OFFLINE
  if (diffInMinutes <= 35) {
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
// 4. KARTU SENSOR & INDIKATOR DANGER
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
  const isDODanger = data.do === -1 || data.do < 3.0;
  const isPHDanger = data.ph === -1 || data.ph < 5.5 || data.ph > 8.5;
  const isKedalamanDanger = data.kedalaman === -1 || data.kedalaman < 80.0;

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
// 5. KALKULASI INDEKS KUALITAS AIR
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
// 7. CHART.JS DENGAN FORMAT TICKS & FILTER INTERVAL
// ==========================================
function initCharts() {
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 10,   // Beri jarak di kiri agar angka sumbu Y tidak mepet
        right: 15,  // Beri jarak di kanan agar grafik simetris di tengah
        top: 10,
        bottom: 5
      }
    },
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          autoSkip: true,
          maxTicksLimit: 6,
          maxRotation: 0,
          minRotation: 0,
          padding: 5,
          font: {
            size: 10
          }
        }
      },
      y: {
        beginAtZero: false,
        ticks: {
          font: {
            size: 10
          }
        }
      }
    }
  };

  const ctxSuhu = document.getElementById("chartSuhu");
  if (ctxSuhu) {
    chartSuhu = new Chart(ctxSuhu, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "Permukaan", data: [], borderColor: "#6FE6FC", backgroundColor: "#6FE6FC", tension: 0.3, pointRadius: 2 },
          { label: "Tengah", data: [], borderColor: "#F7ADAD", backgroundColor: "#F7ADAD", tension: 0.3, pointRadius: 2 },
          { label: "Dasar", data: [], borderColor: "#5003C0", backgroundColor: "#5003C0", tension: 0.3, pointRadius: 2 }
        ]
      },
      options: commonOptions
    });
  }

  const ctxDO = document.getElementById("chartDO");
  if (ctxDO) {
    chartDO = new Chart(ctxDO, {
      type: "line",
      data: { labels: [], datasets: [{ label: "DO (mg/L)", data: [], borderColor: "#D4621A", tension: 0.3, fill: true, pointRadius: 2 }] },
      options: commonOptions
    });
  }

  const ctxPH = document.getElementById("chartPH");
  if (ctxPH) {
    chartPH = new Chart(ctxPH, {
      type: "line",
      data: { labels: [], datasets: [{ label: "pH Air", data: [], borderColor: "#16a34a", tension: 0.3, fill: true, pointRadius: 2 }] },
      options: commonOptions
    });
  }

  const ctxKedalaman = document.getElementById("chartKedalaman");
  if (ctxKedalaman) {
    chartKedalaman = new Chart(ctxKedalaman, {
      type: "line",
      data: { labels: [], datasets: [{ label: "Kedalaman (cm)", data: [], borderColor: "#9333ea", tension: 0.3, fill: true, pointRadius: 2 }] },
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

  const rawFilteredData = filterDataByTime(rawDataSensor, filterVal);
  const uniqueDataMap = new Map();

  rawFilteredData.forEach(item => {
    if (!item.timestamp) return;
    const cleanStr = item.timestamp.replace("'", "").trim();
    const parts = cleanStr.split(", ");
    const dateParts = parts[0] ? parts[0].split("/") : ["01", "01", "2026"];
    const timeParts = parts[1] ? parts[1].split(":") : ["00", "00", "00"];

    let timeKey = "";

    if (filterVal === "1h") {
      timeKey = `${timeParts[0]}:${timeParts[1]}`;
    } else if (filterVal === "today") {
      timeKey = `${timeParts[0]}:${timeParts[1]}`;
    } else if (filterVal === "7d") {
      const itemDate = parseCustomDate(cleanStr);
      const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      timeKey = namaHari[itemDate.getDay()];
    } else if (filterVal === "30d") {
      timeKey = `${dateParts[0]}/${dateParts[1]}`;
    } else {
      timeKey = cleanStr;
    }

    uniqueDataMap.set(timeKey, {
      label: timeKey,
      suhu1: item.suhu1,
      suhu2: item.suhu2,
      suhu3: item.suhu3,
      do: item.do,
      ph: item.ph,
      kedalaman: item.kedalaman
    });
  });

  const finalProcessedData = Array.from(uniqueDataMap.values());
  const labels = finalProcessedData.map(d => d.label);

  if (type === "suhu" && chartSuhu) {
    chartSuhu.data.labels = labels;
    chartSuhu.data.datasets[0].data = finalProcessedData.map(item => item.suhu1);
    chartSuhu.data.datasets[1].data = finalProcessedData.map(item => item.suhu2);
    chartSuhu.data.datasets[2].data = finalProcessedData.map(item => item.suhu3);
    chartSuhu.update();
  } else if (type === "do" && chartDO) {
    chartDO.data.labels = labels;
    chartDO.data.datasets[0].data = finalProcessedData.map(item => item.do);
    chartDO.update();
  } else if (type === "ph" && chartPH) {
    chartPH.data.labels = labels;
    chartPH.data.datasets[0].data = finalProcessedData.map(item => item.ph);
    chartPH.update();
  } else if (type === "kedalaman" && chartKedalaman) {
    chartKedalaman.data.labels = labels;
    chartKedalaman.data.datasets[0].data = finalProcessedData.map(item => item.kedalaman);
    chartKedalaman.update();
  }
}

function filterDataByTime(data, filterValue) {
  if (!data || data.length === 0) return [];
  if (filterValue === "all") return data;

  const now = new Date();

  return data.filter(item => {
    const itemDate = parseCustomDate(item.timestamp);
    if (filterValue === "1h") return (now - itemDate) <= (1 * 60 * 60 * 1000);
    if (filterValue === "today") return itemDate.toDateString() === now.toDateString();
    if (filterValue === "7d") return (now - itemDate) <= (7 * 24 * 60 * 60 * 1000);
    if (filterValue === "30d") return (now - itemDate) <= (30 * 24 * 60 * 60 * 1000);
    return true;
  });
}

// ==========================================
// 8. TABEL LOG RIWAYAT AKTIVITAS (MAX 200 DATA / 20 HALAMAN)
// ==========================================
function renderActivityHistory(data) {
  if (!data || data.length === 0) return;

  const now = new Date();

  filteredLogData = [...data]
    .reverse()
    .filter(item => {
      const itemDate = parseCustomDate(item.timestamp);
      return (now - itemDate) <= (7 * 24 * 60 * 60 * 1000);
    })
    .slice(0, 200);

  displayLogPage(currentLogPage);
}

function displayLogPage(page) {
  const tbody = document.getElementById("tbody-history");
  if (!tbody) return;

  tbody.innerHTML = "";

  const totalRows = filteredLogData.length;
  let totalPages = Math.ceil(totalRows / logRowsPerPage) || 1;
  if (totalPages > 20) totalPages = 20;

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

      let jenisAktivitas = "SCHEDULED_30MIN";
      if (item.trigger_type) {
        jenisAktivitas = item.trigger_type;
      } else if (item.catatan && item.catatan.includes("WEB_MANUAL_READ")) {
        jenisAktivitas = "WEB_MANUAL_READ";
      }

      tr.innerHTML = `
        <td>${item.timestamp}</td>
        <td><code>${jenisAktivitas}</code></td>
        <td><span class="badge ${isWarning ? 'badge-danger' : 'badge-success'}" style="font-size:10px;">${isWarning ? 'WARNING' : 'SUCCESS'}</span></td>
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

// ==========================================
// 9. TOMBOL WEB ACTION (FETCH, COOLDOWN & TIMEOUT)
// ==========================================
async function triggerWebRead() {
  const btnId = 'btnForceRead';
  const storageKey = 'cooldown_read';
  const defaultText = '🔄 Ambil Data Real-Time';

  if (isCoolingDown(storageKey)) return;

  const btn = document.getElementById(btnId);
  btn.innerText = "⏳ Mengirim Perintah...";
  btn.disabled = true;

  try {
    const oldLatestTimestamp = rawDataSensor.length > 0 ? rawDataSensor[rawDataSensor.length - 1].timestamp : "";

    // 1. Kirim sinyal trigger & catat log WEB_TRIGGER_SENT ke server
    console.log("Mengirim pemicu ke Apps Script...");
    await fetch(`${SCRIPT_URL}?action=setReadTrigger`, { redirect: 'follow' });

    btn.innerText = "⏳ Menunggu Respon ESP32...";

    // 2. Aktifkan cooldown tombol 2 menit
    startCooldown(btnId, storageKey, defaultText);

    // 3. Evaluasi respons setelah 10 detik
    setTimeout(async () => {
      await fetchData();

      const newLatestData = rawDataSensor.length > 0 ? rawDataSensor[rawDataSensor.length - 1] : null;

      if (newLatestData && newLatestData.timestamp !== oldLatestTimestamp) {
        alert(`✅ SUKSES! ESP32 berhasil merespons perintah web.\nData real-time baru telah ditambahkan (${newLatestData.timestamp}).`);
      } else {
        // GAGAL: Panggil API catat log timeout secara eksplisit
        console.log("ESP32 tidak merespons, mengirim log timeout...");
        
        try {
          await fetch(`${SCRIPT_URL}?action=logWebTimeout`, { redirect: 'follow' });
        } catch (errLog) {
          console.error("Gagal kirim log timeout:", errLog);
        }

        alert(`⚠️ PERINGATAN: ESP32 Tidak Merespons / Offline!\n\nRiwayat percobaan ambil data telah dicatat ke Log Koneksi dengan status GAGAL.`);
        
        // Refresh ulang data agar baris log kegagalan baru langsung ter-render di tabel web
        setTimeout(async () => {
          await fetchData();
        }, 1500);
      }
    }, 10000);

  } catch (err) {
    alert("Gagal memicu alat: " + err.message);
    resetButtonImmediate(btnId, defaultText);
  }
}

async function downloadCSV() {
  const btnId = 'btnExport';
  const storageKey = 'cooldown_download';
  const defaultText = '📥 Download CSV';

  if (isCoolingDown(storageKey)) return;

  const btn = document.getElementById(btnId);
  btn.innerText = "⏳ Memproses Data...";
  btn.disabled = true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${SCRIPT_URL}?action=downloadCSV`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error("Gagal terhubung ke server Google Apps Script.");

    const data = await response.json();

    if (!data || data.length === 0) {
      alert("Tidak ada data ditemukan dalam 1 bulan terakhir!");
      resetButtonImmediate(btnId, defaultText);
      return;
    }

    const headers = Object.keys(data[0]);
    let csvContent = headers.join(",") + "\n";

    data.forEach(row => {
      let values = headers.map(header => {
        let val = row[header] === null || row[header] === undefined ? "" : row[header];
        val = val.toString().replace(/"/g, '""');
        if (val.includes(",") || val.includes("\n")) val = `"${val}"`;
        return val;
      });
      csvContent += values.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const monthYear = new Date().toISOString().slice(0, 7);

    link.setAttribute("href", url);
    link.setAttribute("download", `Data_WaterMonitoring_${monthYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    startCooldown(btnId, storageKey, defaultText);

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      alert("⚠️ Waktu tunggu habis! Server Google Apps Script tidak merespons dalam 20 detik.");
    } else {
      alert("Gagal mengunduh data: " + err.message);
    }
    resetButtonImmediate(btnId, defaultText);
  }
}

// ==========================================
// 10. HELPER MANAGEMENT COOLDOWN & TIMER
// ==========================================
function startCooldown(buttonId, storageKey, defaultText) {
  const expireTime = Date.now() + COOLDOWN_TIME_MS;
  localStorage.setItem(storageKey, expireTime);
  checkCooldownState(buttonId, storageKey, defaultText);
}

function isCoolingDown(storageKey) {
  const expireTime = localStorage.getItem(storageKey);
  return expireTime && Date.now() < parseInt(expireTime);
}

function checkCooldownState(buttonId, storageKey, defaultText) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  const expireTime = localStorage.getItem(storageKey);

  if (expireTime) {
    const remainingMs = parseInt(expireTime) - Date.now();

    if (remainingMs > 0) {
      btn.disabled = true;

      const intervalId = setInterval(() => {
        const currentRemaining = parseInt(localStorage.getItem(storageKey)) - Date.now();

        if (currentRemaining <= 0) {
          clearInterval(intervalId);
          localStorage.removeItem(storageKey);
          btn.innerText = defaultText;
          btn.disabled = false;
        } else {
          const totalSeconds = Math.ceil(currentRemaining / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
          btn.innerText = `⏳ Tunggu (${formattedTime})`;
        }
      }, 1000);

    } else {
      localStorage.removeItem(storageKey);
      btn.innerText = defaultText;
      btn.disabled = false;
    }
  } else {
    btn.innerText = defaultText;
    btn.disabled = false;
  }
}

function resetButtonImmediate(buttonId, defaultText) {
  const btn = document.getElementById(buttonId);
  if (btn) {
    btn.innerText = defaultText;
    btn.disabled = false;
  }
}

function showEmptyState() {
  console.warn("Data kosong dari server.");
}