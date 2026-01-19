// Global state
let allWines = [];
let currentWine = null;
let currentCount = null;

// Initialiser app
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  loadWines();
  setupFileInput();
  setupScanInput();
});

// Navigation
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      showPage(page);
    });
  });
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  document.getElementById(pageId).classList.add('active');
  document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

  // Load data når visning ændres
  if (pageId === 'dashboard') {
    updateDashboard();
  } else if (pageId === 'lager') {
    renderLager();
  } else if (pageId === 'labels') {
    loadLabelsFilters();
  }
}

// API calls
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Fejl ved API kald');
    }

    return await response.json();
  } catch (error) {
    console.error('API fejl:', error);
    throw error;
  }
}

// Load wines
async function loadWines() {
  try {
    allWines = await apiCall('/api/wines');
    updateDashboard();
    populateFilters();
  } catch (error) {
    console.error('Fejl ved indlæsning af vine:', error);
    alert('Kunne ikke hente vine. Tjek at backend kører.');
  }
}

// Dashboard
function updateDashboard() {
  const antVine = allWines.length;
  const lavtLager = allWines.filter(w => w.antal < w.minAntal).length;
  
  let totalVærdi = 0;
  allWines.forEach(w => {
    totalVærdi += (w.antal || 0) * (w.indkøbspris || 0);
  });
  const kroner = Math.floor(totalVærdi);
  const øre = Math.round((totalVærdi - kroner) * 100);

  document.getElementById('stat-ant-vine').textContent = antVine;
  document.getElementById('stat-lavt').textContent = lavtLager;
  document.getElementById('stat-værdi').textContent = `${kroner} kr. ${øre} øre`;
}

// Lager visning
function populateFilters() {
  const reoler = [...new Set(allWines.map(w => w.reol).filter(Boolean))].sort();
  const hylder = [...new Set(allWines.map(w => w.hylde).filter(Boolean))].sort();

  const reolSelect = document.getElementById('filter-reol');
  const hyldeSelect = document.getElementById('filter-hylde');
  const labelReol = document.getElementById('label-reol');
  const labelHylde = document.getElementById('label-hylde');

  [reolSelect, labelReol].forEach(select => {
    if (select) {
      select.innerHTML = '<option value="">Alle reoler</option>';
      reoler.forEach(r => {
        select.innerHTML += `<option value="${r}">${r}</option>`;
      });
    }
  });

  [hyldeSelect, labelHylde].forEach(select => {
    if (select) {
      select.innerHTML = '<option value="">Alle hylder</option>';
      hylder.forEach(h => {
        select.innerHTML += `<option value="${h}">${h}</option>`;
      });
    }
  });
}

function applyFilter() {
  renderLager();
}

function clearFilter() {
  document.getElementById('filter-reol').value = '';
  document.getElementById('filter-hylde').value = '';
  renderLager();
}

function renderLager() {
  const reolFilter = document.getElementById('filter-reol').value;
  const hyldeFilter = document.getElementById('filter-hylde').value;

  let filtered = allWines;

  if (reolFilter) {
    filtered = filtered.filter(w => w.reol === reolFilter);
  }
  if (hyldeFilter) {
    filtered = filtered.filter(w => w.hylde === hyldeFilter);
  }

  const tbody = document.getElementById('lager-tbody');
  tbody.innerHTML = '';

  filtered.forEach(wine => {
    const row = document.createElement('tr');
    const lavtLager = wine.antal < wine.minAntal ? ' style="background: #fee;"' : '';
    row.innerHTML = `
      <td>${wine.vinId || ''}</td>
      <td>${wine.navn || ''}</td>
      <td>${wine.type || ''}</td>
      <td>${wine.land || ''}</td>
      <td>${wine.region || ''}</td>
      <td>${wine.årgang || ''}</td>
      <td>${wine.reol || ''}</td>
      <td>${wine.hylde || ''}</td>
      <td class="text-right"${lavtLager}>${wine.antal || 0}</td>
      <td class="text-right">${wine.minAntal || 0}</td>
      <td class="text-right">${wine.indkøbspris ? wine.indkøbspris.toFixed(2) : ''}</td>
    `;
    tbody.appendChild(row);
  });
}

// QR Scanning og optælling
function setupScanInput() {
  const input = document.getElementById('scan-input');
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      scanQR();
    }
  });
}

async function scanQR() {
  const vinId = document.getElementById('scan-input').value.trim();
  if (!vinId) {
    showError('Indtast venligst en VIN-ID');
    return;
  }

  try {
    currentWine = await apiCall(`/api/wines/${vinId}`);
    showWineDetails(currentWine);
    currentCount = currentWine.antal;
    document.getElementById('count-input').value = '';
  } catch (error) {
    showError('Vin ikke fundet: ' + error.message);
    document.getElementById('wine-details').style.display = 'none';
  }
}

function showWineDetails(wine) {
  document.getElementById('wine-navn').textContent = wine.navn || '';
  document.getElementById('wine-vinId').textContent = wine.vinId || '';
  document.getElementById('wine-type').textContent = wine.type || '';
  document.getElementById('wine-land').textContent = wine.land || '';
  document.getElementById('wine-region').textContent = wine.region || '';
  document.getElementById('wine-årgang').textContent = wine.årgang || '';
  document.getElementById('wine-reol').textContent = wine.reol || '';
  document.getElementById('wine-hylde').textContent = wine.hylde || '';
  document.getElementById('wine-antal').textContent = wine.antal || 0;
  currentCount = wine.antal || 0;

  // Vis billede hvis tilgængelig
  const imgContainer = document.getElementById('wine-billede-container');
  if (wine.billede) {
    imgContainer.innerHTML = `<img src="${CONFIG.API_URL}${wine.billede}" alt="${wine.navn}">`;
  } else {
    imgContainer.innerHTML = '';
  }

  document.getElementById('wine-details').style.display = 'block';
  document.getElementById('scan-error').style.display = 'none';
  document.getElementById('count-status').innerHTML = '';
}

function updateCount(change) {
  const directInput = document.getElementById('count-input').value;
  if (directInput) {
    currentCount = parseInt(directInput);
  } else {
    currentCount += change;
  }
  document.getElementById('wine-antal').textContent = currentCount;
}

async function saveCount() {
  if (!currentWine) return;

  const directInput = document.getElementById('count-input').value;
  let body = {};

  if (directInput) {
    body.nytAntal = parseInt(directInput);
  } else {
    const ændring = currentCount - currentWine.antal;
    body.ændring = ændring;
  }

  try {
    const result = await apiCall(`/api/count/${currentWine.vinId}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    document.getElementById('count-status').innerHTML = 
      `<div class="success-message">Antal opdateret: ${result.nytAntal} (${result.ændring > 0 ? '+' : ''}${result.ændring})</div>`;
    
    // Opdater lokal data
    currentWine.antal = result.nytAntal;
    const index = allWines.findIndex(w => w.vinId === currentWine.vinId);
    if (index !== -1) {
      allWines[index].antal = result.nytAntal;
    }

    updateDashboard();
    renderLager();

    // Ryd input
    document.getElementById('count-input').value = '';
    document.getElementById('scan-input').value = '';
    
    setTimeout(() => {
      document.getElementById('count-status').innerHTML = '';
    }, 3000);
  } catch (error) {
    document.getElementById('count-status').innerHTML = 
      `<div class="error-message">Fejl: ${error.message}</div>`;
  }
}

function showError(message) {
  const errorDiv = document.getElementById('scan-error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  document.getElementById('wine-details').style.display = 'none';
}

// Import
function setupFileInput() {
  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', (e) => {
    const fileName = e.target.files[0]?.name || '';
    document.getElementById('file-name').textContent = fileName;
  });
}

async function doImport() {
  const fileInput = document.getElementById('file-input');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Vælg venligst en fil');
    return;
  }

  const mode = document.querySelector('input[name="import-mode"]:checked').value;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);

  try {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const endpoint = isExcel ? '/api/import/excel' : '/api/import/csv';

    const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Import fejlede');
    }

    const result = await response.json();
    
    document.getElementById('import-results').style.display = 'block';
    document.getElementById('import-results-content').innerHTML = `
      <div class="success-message">
        <p><strong>Import gennemført!</strong></p>
        <p>Importeret: ${result.importeret}</p>
        <p>Opdateret: ${result.opdateret}</p>
        ${result.fejl && result.fejl.length > 0 ? `<p>Fejl: ${result.fejl.length}</p>` : ''}
      </div>
    `;

    // Reload wines
    await loadWines();
    renderLager();
  } catch (error) {
    document.getElementById('import-results').style.display = 'block';
    document.getElementById('import-results-content').innerHTML = 
      `<div class="error-message">Fejl: ${error.message}</div>`;
  }
}

// Labels
function loadLabelsFilters() {
  populateFilters();
}

async function generateLabels() {
  const reolFilter = document.getElementById('label-reol').value;
  const hyldeFilter = document.getElementById('label-hylde').value;

  let filtered = allWines;

  if (reolFilter) {
    filtered = filtered.filter(w => w.reol === reolFilter);
  }
  if (hyldeFilter) {
    filtered = filtered.filter(w => w.hylde === hyldeFilter);
  }

  const container = document.getElementById('labels-container');
  container.innerHTML = '';

  filtered.forEach(wine => {
    const label = document.createElement('div');
    label.className = 'label';
    const qrId = `qr-${wine.vinId}-${Date.now()}`;
    label.innerHTML = `
      <div><strong>${wine.navn || ''}</strong></div>
      <div>${wine.land || ''} ${wine.årgang || ''}</div>
      <div>${wine.reol || ''} / ${wine.hylde || ''}</div>
      <div id="${qrId}"></div>
    `;
    container.appendChild(label);

    // Generer QR kode
    const qrDiv = document.getElementById(qrId);
    if (qrDiv) {
      QRCode.toCanvas(qrDiv, wine.vinId, {
        width: 150,
        margin: 2
      }, (err) => {
        if (err) {
          console.error('QR fejl:', err);
          qrDiv.innerHTML = wine.vinId;
        }
      });
    }
  });
}

// Rapporter
async function generateLagerReport() {
  try {
    const wines = await apiCall('/api/reports/lager');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

  let y = 20;
  doc.setFontSize(16);
  doc.text('Lagerrapport', 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.text('Genereret: ' + new Date().toLocaleString('da-DK'), 14, y);
  y += 10;

  const headers = ['VIN-ID', 'Navn', 'Type', 'Land', 'Årgang', 'Reol', 'Hylde', 'Antal', 'Min'];
  const colWidths = [25, 50, 25, 25, 15, 15, 15, 15, 15];
  let x = 14;

  // Header
  doc.setFontSize(8);
  headers.forEach((header, i) => {
    doc.text(header, x, y);
    x += colWidths[i];
  });
  y += 6;

  // Rows
  wines.forEach(wine => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }

    x = 14;
    const row = [
      wine.vinId || '',
      wine.navn || '',
      wine.type || '',
      wine.land || '',
      wine.årgang || '',
      wine.reol || '',
      wine.hylde || '',
      wine.antal || 0,
      wine.minAntal || 0
    ];

    row.forEach((cell, i) => {
      doc.text(String(cell).substring(0, 20), x, y);
      x += colWidths[i];
    });
    y += 6;
  });

  doc.save('lagerrapport.pdf');
  } catch (error) {
    alert('Fejl ved generering af rapport: ' + error.message);
  }
}

async function generateVærdiReport() {
  try {
    const report = await apiCall('/api/reports/værdi');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let y = 20;
    doc.setFontSize(16);
    doc.text('Værdirapport', 14, y);
    y += 10;

    doc.setFontSize(12);
    doc.text(`Samlet lagerværdi: ${report.total.formateret}`, 14, y);
    y += 10;

    doc.setFontSize(10);
    doc.text('Genereret: ' + new Date().toLocaleString('da-DK'), 14, y);
    y += 10;

    const headers = ['VIN-ID', 'Navn', 'Antal', 'Pris', 'Værdi'];
    const colWidths = [30, 70, 20, 30, 30];
    let x = 14;

    // Header
    doc.setFontSize(8);
    headers.forEach((header, i) => {
      doc.text(header, x, y);
      x += colWidths[i];
    });
    y += 6;

    // Rows
    report.vine.forEach(wine => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }

      x = 14;
      const værdi = (wine.antal || 0) * (wine.indkøbspris || 0);
      const row = [
        wine.vinId || '',
        wine.navn || '',
        wine.antal || 0,
        (wine.indkøbspris || 0).toFixed(2),
        værdi.toFixed(2)
      ];

      row.forEach((cell, i) => {
        doc.text(String(cell).substring(0, 25), x, y);
        x += colWidths[i];
      });
      y += 6;
    });

    doc.save('værdirapport.pdf');
  } catch (error) {
    alert('Fejl ved generering af rapport: ' + error.message);
  }
}

