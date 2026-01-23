// ============================================
// VINLAGER OPTÆLLING 2026 - APP.JS v57
// ============================================
console.log('========================================');
console.log('=== APP.JS SCRIPT START ===');
console.log('Version: v57 - Fiks tidsstempler, rapporter visning, dashboard opdatering');
console.log('Timestamp:', new Date().toISOString());
console.log('========================================');

// Global state
let allWines = [];
let currentWine = null;
let currentCount = null;

// ============================================
// DEBUG: Tjek om scriptet er indlæst
// ============================================
console.log('========================================');
console.log('=== APP.JS START LOADING ===');
console.log('Version: v43');
console.log('Timestamp:', new Date().toISOString());
console.log('========================================');

// Tjek om CONFIG er defineret
if (typeof CONFIG === 'undefined') {
  console.error('❌ FEJL: CONFIG er ikke defineret! Tjek at config.js er indlæst før app.js');
  // Prøv at definere en fallback
  const CONFIG = {
    API_URL: 'https://vinlager-opt-lling-2026.onrender.com',
    TIMEOUT: 10000
  };
  window.CONFIG = CONFIG;
  console.warn('⚠️  Bruger fallback CONFIG:', CONFIG);
} else {
  console.log('✅ CONFIG er defineret:', CONFIG);
  // Sørg for at CONFIG også er tilgængelig globalt
  window.CONFIG = CONFIG;
}

// Helper funktion til at få CONFIG (sikrer altid at vi har en)
function getConfig() {
  return window.CONFIG || (typeof CONFIG !== 'undefined' ? CONFIG : {
    API_URL: 'https://vinlager-opt-lling-2026.onrender.com',
    TIMEOUT: 10000
  });
}

// Formatér tal i dansk format (punktum som tusindseperator, komma som decimalseparator)
// Eksempel: 137505.00 -> "137.505,00"
function formatDanskPris(amount) {
  const parts = amount.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimalPart = parts[1] || '00';
  return `${integerPart},${decimalPart}`;
}

// Auto-opdatering variabel
let autoUpdateInterval = null;

// Start auto-opdatering (polling hver 5 sekunder)
function startAutoUpdate() {
  // Stop eksisterende interval hvis der er et
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
  }
  
  // Start nyt interval - opdater hver 5 sekunder
  autoUpdateInterval = setInterval(() => {
    // Opdater kun hvis brugeren er logget ind og ikke er i scanner mode
    if (auth && auth.isLoggedIn && auth.isLoggedIn()) {
      // Opdater dashboard hvis vi er på dashboard siden
      const currentPage = document.querySelector('.page.active')?.id;
      if (currentPage === 'dashboard' || currentPage === 'lager') {
        loadWines();
      }
      
      // Opdater rapporter hvis vi er på rapporter siden - ALTID hent fra backend
      if (currentPage === 'rapporter') {
        // Force refresh fra backend hver gang
        if (typeof loadReportsHistory === 'function') {
          loadReportsHistory();
        }
      }
      
      // Tjek for ny rapport fra mobil (opdaterer også rapporter)
      checkForNewReport();
    }
  }, 5000); // 5 sekunder
  
  console.log('✅ Auto-opdatering startet (hver 5 sekunder)');
}

// Stop auto-opdatering
function stopAutoUpdate() {
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
    autoUpdateInterval = null;
    console.log('⏹ Auto-opdatering stoppet');
  }
}

// Eksporter QR-funktioner globalt umiddelbart (før DOMContentLoaded)
if (typeof window !== 'undefined') {
  window.showScannerQRModal = function() {
    const modal = document.getElementById('scanner-qr-modal');
    if (modal) {
      modal.style.display = 'flex';
      if (typeof generateScannerQR === 'function') {
        generateScannerQR();
      } else {
        // Vent lidt hvis funktionen ikke er klar endnu
        setTimeout(() => {
          if (typeof generateScannerQR === 'function') {
            generateScannerQR();
          }
        }, 100);
      }
    }
  };
  
  window.closeScannerQRModal = function() {
    const modal = document.getElementById('scanner-qr-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  };
}

// Initialiser app
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initialiserer app...');
  
  // Vent lidt så alle scripts er indlæst
  setTimeout(() => {
    // Initialiser auth system først
    if (typeof auth !== 'undefined' && auth.initUsersStorage) {
      auth.initUsersStorage();
    } else {
      console.error('auth.js ikke indlæst!');
      const errorDiv = document.getElementById('login-error');
      if (errorDiv) {
        errorDiv.textContent = 'Fejl: auth.js kunne ikke indlæses. Tjek browser console.';
        errorDiv.style.display = 'block';
      }
    }
    
    // Tjek login status
    checkLoginStatus();
    
    setupNavigation();
    
    // Vent lidt før vi loader data, så HTML er helt klar
    setTimeout(() => {
      if (auth && auth.isLoggedIn()) {
        loadWines();
        // Start auto-opdatering
        startAutoUpdate();
        // Tjek om der er ny rapport fra mobil
        checkForNewReport();
      }
    }, 100);
    
    setupFileInput();
    
    // setupScanInput kun hvis funktionen findes
    if (typeof setupScanInput === 'function') {
      setupScanInput();
    }
    
    // Stop auto-opdatering når siden lukkes
    window.addEventListener('beforeunload', () => {
      stopAutoUpdate();
    });
  }, 50);
});

// Tjek login status og vis korrekt skærm
function checkLoginStatus() {
  const loginScreen = document.getElementById('login-screen');
  const mainHeader = document.getElementById('main-header');
  const mainContent = document.getElementById('main-content');
  
  if (!loginScreen || !mainHeader || !mainContent) {
    console.error('Login screen eller main content ikke fundet!');
    // Vis login screen hvis elementer mangler
    if (loginScreen) {
      loginScreen.style.display = 'flex';
    }
    return;
  }
  
  // Tjek om auth er tilgængelig
  if (typeof auth === 'undefined' || !auth) {
    console.error('auth ikke defineret! Tjek at auth.js er indlæst.');
    // Vis login screen hvis auth ikke er tilgængelig
    loginScreen.style.display = 'flex';
    mainHeader.style.display = 'none';
    mainContent.style.display = 'none';
    
    // Vis fejlbesked
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
      errorDiv.textContent = 'Fejl: Authentication system ikke tilgængelig. Tjek browser console.';
      errorDiv.style.display = 'block';
    }
    return;
  }
  
  if (auth.isLoggedIn && auth.isLoggedIn()) {
    // Bruger er logget ind - vis app
    loginScreen.style.display = 'none';
    mainHeader.style.display = 'block';
    mainContent.style.display = 'block';
    
    // Vis admin knap hvis admin
    if (auth.isAdmin && auth.isAdmin()) {
      const adminBtn = document.getElementById('admin-nav-btn');
      if (adminBtn) adminBtn.style.display = 'inline-block';
    }
  } else {
    // Bruger ikke logget ind - vis login
    loginScreen.style.display = 'flex';
    mainHeader.style.display = 'none';
    mainContent.style.display = 'none';
  }
}

// Handle login
function handleLogin(event) {
  event.preventDefault();
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const errorDiv = document.getElementById('login-error');
  
  if (!usernameInput || !passwordInput) {
    console.error('Login input felter ikke fundet!');
    return;
  }
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  
  if (!errorDiv) {
    console.error('Error div ikke fundet!');
    return;
  }
  
  // Tjek om auth er tilgængelig
  if (typeof auth === 'undefined' || !auth) {
    errorDiv.textContent = 'Fejl: Authentication system ikke tilgængelig. Tjek at auth.js er indlæst korrekt.';
    errorDiv.style.display = 'block';
    console.error('auth ikke defineret!');
    return;
  }
  
  if (!auth.login) {
    errorDiv.textContent = 'Fejl: Login funktion ikke tilgængelig. Tjek at auth.js er indlæst korrekt.';
    errorDiv.style.display = 'block';
    console.error('auth.login ikke defineret!');
    return;
  }
  
  // Valider input
  if (!username || !password) {
    errorDiv.textContent = 'Indtast venligst både brugernavn og password.';
    errorDiv.style.display = 'block';
    return;
  }
  
  try {
    // Tjek om auth er klar
    if (typeof auth === 'undefined' || !auth || !auth.login) {
      errorDiv.textContent = 'Fejl: Authentication system ikke klar. Vent venligst et øjeblik og prøv igen.';
      errorDiv.style.display = 'block';
      console.error('auth ikke klar:', typeof auth, auth);
      
      // Prøv igen efter 1 sekund
      setTimeout(() => {
        if (typeof auth !== 'undefined' && auth && auth.login) {
          handleLogin(event);
        }
      }, 1000);
      return;
    }
    
    const result = auth.login(username, password);
    
    if (result && result.success) {
      // Ryd fejlbesked
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
      
      // Ryd password felt
      passwordInput.value = '';
      
      // Opdater UI
      checkLoginStatus();
      
      // Load data efter login
      setTimeout(() => {
        if (typeof loadWines === 'function') {
          loadWines();
          // Start auto-opdatering efter login
          startAutoUpdate();
        }
      }, 100);
    } else {
      errorDiv.textContent = result?.error || 'Login fejlede. Tjek brugernavn og password.';
      errorDiv.style.display = 'block';
      // Ryd password felt ved fejl
      passwordInput.value = '';
    }
  } catch (error) {
    console.error('Login fejl:', error);
    errorDiv.textContent = 'Fejl ved login: ' + error.message;
    errorDiv.style.display = 'block';
    // Ryd password felt ved fejl
    passwordInput.value = '';
  }
}

// Handle logout
function handleLogout() {
  // Stop auto-opdatering ved logout
  stopAutoUpdate();
  
  if (auth && auth.logout) {
    auth.logout();
    checkLoginStatus();
    // Clear input fields
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
  }
}

// Show password reset (forbedret)
function showPasswordReset() {
  const emailOrUsername = prompt('Indtast din email eller brugernavn:');
  if (!emailOrUsername) return;
  
  if (auth && auth.requestPasswordReset) {
    const result = auth.requestPasswordReset(emailOrUsername);
    alert(result.message || 'Hvis emailen/brugernavnet findes, er et reset link sendt.\n\nKontakt admin for at få password nulstillet.');
  } else {
    alert('Password reset funktion ikke tilgængelig. Kontakt admin.');
  }
}

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
  
  // Tjek om siden findes før vi prøver at vise den
  const pageElement = document.getElementById(pageId);
  const navButton = document.querySelector(`[data-page="${pageId}"]`);
  
  if (!pageElement) {
    console.error(`Side med id "${pageId}" ikke fundet!`);
    // Vis dashboard i stedet hvis siden ikke findes
    const dashboardPage = document.getElementById('dashboard');
    const dashboardBtn = document.querySelector(`[data-page="dashboard"]`);
    if (dashboardPage) {
      dashboardPage.classList.add('active');
      if (dashboardBtn) dashboardBtn.classList.add('active');
      updateDashboard();
    }
    return;
  }
  
  pageElement.classList.add('active');
  if (navButton) {
    navButton.classList.add('active');
  }

  // Load data når visning ændres
  if (pageId === 'dashboard') {
    updateDashboard();
  } else if (pageId === 'lager') {
    renderLager();
  } else if (pageId === 'labels') {
    loadLabelsFilters();
  } else if (pageId === 'rapporter') {
    loadReportsHistory();
  } else if (pageId === 'admin') {
    loadAdminPanel();
  }
}

// API calls
async function apiCall(endpoint, options = {}) {
  // Sikr at CONFIG er tilgængelig
  const config = getConfig();
  if (!config || !config.API_URL) {
    console.error('❌ CONFIG er ikke defineret!');
    throw new Error('Backend konfiguration mangler');
  }
  try {
    const response = await fetch(`${config.API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      // Tjek om responsen er JSON eller HTML
      const contentType = response.headers.get('content-type');
      let errorMessage = `API fejl: ${response.status} ${response.statusText}`;
      
      if (contentType && contentType.includes('application/json')) {
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          // Hvis JSON parsing fejler, brug standard fejlbesked
        }
      } else {
        // Hvis det er HTML (fx 404 side), læs teksten men brug ikke den
        const text = await response.text();
        if (response.status === 404) {
          errorMessage = `API endpoint ikke fundet: ${endpoint}. Backend serveren mangler denne rute.`;
        } else {
          errorMessage = `Server fejl (${response.status}): ${response.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }

    // Tjek om responsen er JSON før parsing
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      // Hvis ikke JSON, returner tekst
      const text = await response.text();
      console.warn('⚠️ Backend returnerede ikke JSON, men:', contentType);
      return text;
    }
  } catch (error) {
    console.error('API fejl:', error);
    console.error('Endpoint:', endpoint);
    throw error;
  }
}

// Load wines
async function loadWines() {
  try {
    const wines = await apiCall('/api/wines');
    
    // Opdater allWines hvis vi fik data
    if (wines && Array.isArray(wines)) {
      allWines = wines;
    } else {
      // Hvis API fejler, behold eksisterende data
      console.warn('⚠️ API returnerede ikke gyldig data. Beholder eksisterende lager.');
      if (allWines.length === 0) {
        showError('Kunne ikke hente vine. Tjek at backend kører.');
        return;
      }
    }
    
    // Opdater minimum til 24 for alle vine der ikke har det sat
    const needsUpdate = allWines.filter(w => !w.minAntal || w.minAntal === 0);
    if (needsUpdate.length > 0) {
      console.log(`Opdaterer ${needsUpdate.length} vine til minimum 24...`);
      for (const wine of needsUpdate) {
        try {
          wine.minAntal = 24;
          await apiCall(`/api/wines/${wine.vinId}`, {
            method: 'PUT',
            body: JSON.stringify(wine)
          });
        } catch (err) {
          console.error(`Fejl ved opdatering af ${wine.vinId}:`, err);
        }
      }
      // Genhent efter opdatering
      try {
        const updatedWines = await apiCall('/api/wines');
        if (updatedWines && Array.isArray(updatedWines)) {
          allWines = updatedWines;
        }
      } catch (err) {
        console.error('Fejl ved genhentning efter opdatering:', err);
      }
    }
    
    updateDashboard();
    populateFilters();
    
    // Setup scan input autocomplete efter vine er indlæst
    if (document.getElementById('scan-input')) {
      setupScanInput();
    }
  } catch (error) {
    console.error('Fejl ved indlæsning af vine:', error);
    // VIGTIGT: Nulstil IKKE allWines ved fejl - behold eksisterende data
    if (allWines.length === 0) {
      showError('Kunne ikke hente vine. Tjek at backend kører.');
    } else {
      console.warn('⚠️ API fejl, men beholder eksisterende lager data.');
    }
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
  
  // Generer QR-kode til scanner link
  generateScannerQR();

  // Opdater dashboard elementer hvis de findes
  const statAntVine = document.getElementById('stat-ant-vine');
  const statLavt = document.getElementById('stat-lavt');
  const statVærdi = document.getElementById('stat-værdi');
  
  if (statAntVine) statAntVine.textContent = antVine;
  if (statLavt) {
    statLavt.textContent = lavtLager;
    // Opdater farve baseret på antal
    if (lavtLager > 0) {
      statLavt.classList.add('warning');
    } else {
      statLavt.classList.remove('warning');
    }
  }
  if (statVærdi) statVærdi.textContent = `${formatDanskPris(totalVærdi)} kr.`;
  
  // QR-kode genereres når modal åbnes
}

// Vis vine oversigt modal
function showVineOversigt(type) {
  const modal = document.getElementById('vine-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalStats = document.getElementById('modal-stats');
  const modalTbody = document.getElementById('modal-vine-tbody');
  
  if (!modal) return;
  
  // Filtrer vine
  let filteredWines = [];
  if (type === 'lavt') {
    filteredWines = allWines.filter(w => w.antal < w.minAntal);
    modalTitle.textContent = 'Lavt Lager - Oversigt';
  } else {
    filteredWines = allWines;
    modalTitle.textContent = 'Alle Vine - Oversigt';
  }
  
  // Beregn statistikker
  const statType = {};
  const statLand = {};
  const statReol = {};
  
  filteredWines.forEach(wine => {
    // Type statistik
    const type = wine.type || 'Ukendt';
    statType[type] = (statType[type] || 0) + 1;
    
    // Land statistik
    const land = wine.land || 'Ukendt';
    statLand[land] = (statLand[land] || 0) + 1;
    
    // Reol statistik
    const reol = wine.reol || 'Ukendt';
    statReol[reol] = (statReol[reol] || 0) + 1;
  });
  
  // Vis statistikker
  const typeList = Object.entries(statType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');
  
  const landList = Object.entries(statLand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([land, count]) => `${land}: ${count}`)
    .join(', ');
  
  const reolList = Object.keys(statReol).sort().join(', ');
  
  modalStats.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
      <div>
        <strong>Total antal:</strong> ${filteredWines.length} vine
      </div>
      <div>
        <strong>Type:</strong> ${typeList || 'Ingen data'}
      </div>
      <div>
        <strong>Top lande:</strong> ${landList || 'Ingen data'}
      </div>
      <div>
        <strong>Reoler:</strong> ${reolList || 'Ingen data'}
      </div>
    </div>
  `;
  
  // Vis vine i tabel
  modalTbody.innerHTML = '';
  filteredWines.sort((a, b) => {
    // Sorter først efter reol, så hylde, så navn
    if (a.reol !== b.reol) {
      return (a.reol || '').localeCompare(b.reol || '');
    }
    if (a.hylde !== b.hylde) {
      return (a.hylde || '').localeCompare(b.hylde || '');
    }
    return (a.navn || '').localeCompare(b.navn || '');
  });
  
  filteredWines.forEach(wine => {
    const row = document.createElement('tr');
    const lavtLagerClass = wine.antal < wine.minAntal ? ' style="background: #fee;"' : '';
    row.innerHTML = `
      <td${lavtLagerClass}>${wine.navn || ''}</td>
      <td${lavtLagerClass}>${wine.type || ''}</td>
      <td${lavtLagerClass}>${wine.land || ''}</td>
      <td${lavtLagerClass}>${wine.reol || ''}</td>
      <td${lavtLagerClass}>${wine.hylde || ''}</td>
      <td${lavtLagerClass} class="text-right">${wine.antal || 0}</td>
      <td${lavtLagerClass} class="text-right">${wine.minAntal || 24}</td>
    `;
    modalTbody.appendChild(row);
  });
  
  modal.style.display = 'block';
  modal.style.setProperty('display', 'block', 'important');
  document.body.style.overflow = 'hidden'; // Forhindre scroll på body når modal er åben
}

// Luk modal
function closeVineModal() {
  const modal = document.getElementById('vine-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.style.setProperty('display', 'none', 'important');
    document.body.style.overflow = ''; // Tillad scroll på body igen
  }
}

// Luk modal når man klikker uden for (tjek om der allerede er en onclick handler)
document.addEventListener('click', function(event) {
  const modal = document.getElementById('vine-modal');
  if (modal && event.target === modal) {
    closeVineModal();
  }
});

// Lager visning
function populateFilters() {
  const lokationer = [...new Set(allWines.map(w => w.lokation).filter(Boolean))].sort();
  const reoler = [...new Set(allWines.map(w => w.reol).filter(Boolean))].sort();
  const hylder = [...new Set(allWines.map(w => w.hylde).filter(Boolean))].sort();

  const lokationSelect = document.getElementById('filter-lokation');
  const reolSelect = document.getElementById('filter-reol');
  const hyldeSelect = document.getElementById('filter-hylde');
  const labelLokation = document.getElementById('label-lokation');
  const labelReol = document.getElementById('label-reol');
  const labelHylde = document.getElementById('label-hylde');

  [lokationSelect, labelLokation].forEach(select => {
    if (select) {
      select.innerHTML = '<option value="">Alle lokationer</option>';
      lokationer.forEach(l => {
        select.innerHTML += `<option value="${l}">${l}</option>`;
      });
    }
  });

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
  document.getElementById('filter-lokation').value = '';
  document.getElementById('filter-reol').value = '';
  document.getElementById('filter-hylde').value = '';
  renderLager();
}

function renderLager() {
  // Tjek om allWines er tom eller undefined
  if (!allWines || allWines.length === 0) {
    console.warn('⚠️ allWines er tom - prøver at hente data igen...');
    const tbody = document.getElementById('lager-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="14" style="text-align: center; padding: 20px; color: #999;">Ingen vine fundet. Prøver at hente data...</td></tr>';
    }
    // Prøv at hente data igen
    loadWines().then(() => {
      // Kald renderLager igen efter data er hentet
      setTimeout(() => renderLager(), 500);
    });
    return;
  }
  
  const lokationFilter = document.getElementById('filter-lokation').value;
  const reolFilter = document.getElementById('filter-reol').value;
  const hyldeFilter = document.getElementById('filter-hylde').value;

  let filtered = allWines;

  if (lokationFilter) {
    filtered = filtered.filter(w => w.lokation === lokationFilter);
  }
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
    const minAntal = wine.minAntal || 24; // Standard minimum er 24 flasker
    const antal = wine.antal || 0;
    let statusClass = '';
    let statusIcon = '';
    let advarsel = '';
    
    // Farvekodning baseret på ANTAL (ikke minimum)
    // Grøn: 24 eller flere flasker
    // Gul: 13-23 flasker  
    // Rød: 12 eller færre flasker
    if (antal >= 24) {
      statusClass = 'status-green';
      statusIcon = '🟢';
    } else if (antal >= 13) {
      statusClass = 'status-orange';
      statusIcon = '🟠';
    } else {
      statusClass = 'status-red';
      statusIcon = '🔴';
      advarsel = ' ⚠️ Lavt lager!';
    }
    
    const lavtLager = wine.antal < wine.minAntal ? ' style="background: #fee;"' : '';
    row.innerHTML = `
      <td>${wine.vinId || ''}</td>
      <td>${wine.varenummer || ''}</td>
      <td>${wine.navn || ''}</td>
      <td>${wine.type || ''}</td>
      <td>${wine.land || ''}</td>
      <td>${wine.region || ''}</td>
      <td>${wine.årgang || ''}</td>
      <td><span style="background: #e6f7e6; color: #060; padding: 2px 6px; border-radius: 3px; font-size: 0.9em;">${wine.lokation || 'Ukendt'}</span></td>
      <td>${wine.reol || ''}</td>
      <td>${wine.hylde || ''}</td>
      <td class="text-right antal-cell"${lavtLager}>${wine.antal || 0}</td>
      <td class="text-right" data-status-cell="true">
        <div class="${statusClass}" style="padding: 2px 5px; border-radius: 3px; display: inline-block;">
          <span class="status-icon-${wine.vinId}">${statusIcon}</span>
          <input type="number" 
                 class="min-antal-input" 
                 value="${minAntal}" 
                 data-vinid="${wine.vinId}"
                 min="0"
                 style="width: 60px; text-align: right; border: 1px solid #ddd; padding: 2px 5px; background: white;">
        </div>
        ${advarsel ? `<div style="color: red; font-size: 0.8em; margin-top: 2px;">${advarsel}</div>` : ''}
      </td>
      <td class="text-right">
        <input type="number" 
               class="pris-input" 
               value="${wine.indkøbspris || ''}" 
               data-vinid="${wine.vinId}"
               step="0.01"
               min="0"
               placeholder="0,00"
               style="width: 80px; text-align: right; border: 1px solid #ddd; padding: 2px 5px; background: white;">
        ${wine.indkøbspris ? ' kr.' : ''}
      </td>
      <td style="text-align: center; vertical-align: middle;">
        <input type="file" 
               accept="image/*" 
               id="image-input-${wine.vinId}"
               style="display: none;"
               onchange="if(typeof window !== 'undefined' && window.uploadWineImage) { window.uploadWineImage(this, '${wine.vinId}'); } else { console.error('uploadWineImage ikke fundet'); alert('Upload funktion ikke fundet. Tryk Ctrl+Shift+R for at genindlæse.'); }">
        ${wine.billede ? `
          <div onclick="const input = document.getElementById('image-input-${wine.vinId}'); if(input) input.click();" style="cursor: pointer; display: inline-block; position: relative;">
            <img src="${getConfig().API_URL}/uploads/images/${wine.billede}" 
                 alt="${wine.navn}" 
                 style="width: 60px; height: 60px; object-fit: cover; border: 2px solid #007bff; border-radius: 4px;"
                 onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div style="display: none; border: 2px dashed #ccc; padding: 12px 16px; text-align: center; border-radius: 4px; background: #fafafa;">
              <div style="font-size: 20px; color: #999;">+</div>
              <div style="font-size: 11px; color: #666;">Billede</div>
            </div>
            <button onclick="event.stopPropagation(); if(window.deleteWineImage) { if(confirm('Slet billede?')) window.deleteWineImage('${wine.vinId}'); }" 
                    style="position: absolute; top: -6px; right: -6px; background: red; color: white; border: none; border-radius: 50%; width: 18px; height: 18px; cursor: pointer; font-size: 12px; line-height: 1; padding: 0;">×</button>
          </div>
        ` : `
          <div onclick="const input = document.getElementById('image-input-${wine.vinId}'); if(input) input.click();" 
               style="border: 2px dashed #ccc; padding: 12px 16px; text-align: center; cursor: pointer; border-radius: 4px; background: #fafafa; display: inline-block;">
            <div style="font-size: 20px; color: #999; margin-bottom: 2px;">+</div>
            <div style="font-size: 11px; color: #666;">Billede</div>
          </div>
        `}
      </td>
    `;
    tbody.appendChild(row);
    
    // Tilføj event listeners til input EFTER det er sat i DOM
    const minAntalInput = row.querySelector('.min-antal-input');
    if (minAntalInput) {
      minAntalInput.addEventListener('change', function() {
        const newValue = parseInt(this.value) || 0;
        updateMinAntalAndStatus(this.dataset.vinid, newValue, this);
      });
      minAntalInput.addEventListener('blur', function() {
        const newValue = parseInt(this.value) || 0;
        updateMinAntalAndStatus(this.dataset.vinid, newValue, this);
      });
    }
    
    // Tilføj event listeners til pris input
    const prisInput = row.querySelector('.pris-input');
    if (prisInput) {
      prisInput.addEventListener('change', function() {
        updatePris(this.dataset.vinid, this.value);
      });
      prisInput.addEventListener('blur', function() {
        updatePris(this.dataset.vinid, this.value);
      });
    }
  });
}

// Opdater pris
async function updatePris(vinId, newPris) {
  try {
    const wine = allWines.find(w => w.vinId === vinId);
    if (!wine) throw new Error('Vin ikke fundet lokalt');

    const pris = newPris ? parseFloat(newPris) : null;
    wine.indkøbspris = pris;

    await apiCall(`/api/wines/${vinId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...wine, indkøbspris: pris })
    });

    // Opdater visningen
    updateDashboard();
    showSuccess('Pris opdateret!');
  } catch (error) {
    console.error('Fejl ved opdatering af pris:', error);
    showError('Kunne ikke opdatere pris');
    renderLager(); // Genindlæs for at få korrekt værdi tilbage
  }
}

// Opdater minimum og opdater status farve/ikon dynamisk
async function updateMinAntalAndStatus(vinId, minAntal, inputElement) {
  try {
    // Opdater status visuelt først (instant feedback)
    const row = inputElement.closest('tr');
    const statusCell = row.querySelector('[data-status-cell]');
    const statusIcon = row.querySelector(`.status-icon-${vinId}`);
    
    // Hent antal fra rækken (ikke fra input)
    const antalCell = row.querySelector('td.antal-cell');
    const antal = parseInt(antalCell ? antalCell.textContent.trim() : '0') || 0;
    
    // Beregn ny status baseret på ANTAL (ikke minimum)
    let statusClass = '';
    let statusIconChar = '';
    let advarsel = '';
    
    if (antal >= 24) {
      statusClass = 'status-green';
      statusIconChar = '🟢';
    } else if (antal >= 13) {
      statusClass = 'status-orange';
      statusIconChar = '🟠';
    } else {
      statusClass = 'status-red';
      statusIconChar = '🔴';
      advarsel = ' ⚠️ Lavt lager!';
    }
    
    // Opdater visuelt med det samme
    if (statusCell) {
      const statusDiv = statusCell.querySelector('div');
      if (statusDiv) {
        statusDiv.className = statusClass;
        statusDiv.style.cssText = 'padding: 2px 5px; border-radius: 3px; display: inline-block;';
      }
    }
    if (statusIcon) {
      statusIcon.textContent = statusIconChar;
    }
    
    // Opdater advarsel hvis nødvendigt
    let advarselDiv = statusCell.querySelector('.lager-advarsel');
    if (antal < 13) {
      if (!advarselDiv) {
        advarselDiv = document.createElement('div');
        advarselDiv.className = 'lager-advarsel';
        advarselDiv.style.cssText = 'color: red; font-size: 0.8em; margin-top: 2px;';
        statusCell.appendChild(advarselDiv);
      }
      advarselDiv.textContent = '⚠️ Lavt lager!';
    } else if (advarselDiv) {
      advarselDiv.remove();
    }
    
    // Gem i backend
    const wine = await apiCall(`/api/wines/${vinId}`);
    wine.minAntal = minAntal;
    
    await apiCall(`/api/wines/${vinId}`, {
      method: 'PUT',
      body: JSON.stringify(wine)
    });
    
    showSuccess('Minimum opdateret!');
  } catch (error) {
    console.error('Fejl ved opdatering af minimum:', error);
    showError('Kunne ikke opdatere minimum antal');
    // Genindlæs for at få korrekt værdi tilbage
    renderLager();
  }
}

// QR Scanning og optælling
function setupScanInput() {
  const input = document.getElementById('scan-input');
  if (!input) {
    console.warn('scan-input element ikke fundet - skip setup');
    return;
  }
  
  const dropdown = document.getElementById('autocomplete-dropdown');
  if (!dropdown) {
    console.warn('autocomplete-dropdown element ikke fundet - skip autocomplete');
    // Fortsæt uden autocomplete, men tillad stadig scanning
    return;
  }
  
  let selectedIndex = -1;
  let currentMatches = [];
  
  // Input event for autocomplete
  input.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    
    if (query.length < 1) {
      dropdown.style.display = 'none';
      return;
    }
    
    // Søg i vine
    currentMatches = allWines.filter(wine => {
      const vinId = (wine.vinId || '').toLowerCase();
      const varenummer = (wine.varenummer || '').toLowerCase();
      const navn = (wine.navn || '').toLowerCase();
      
      return vinId.includes(query) || 
             varenummer.includes(query) || 
             navn.includes(query);
    }).slice(0, 10); // Begræns til 10 matches
    
    if (currentMatches.length > 0) {
      renderAutocomplete(currentMatches);
      dropdown.style.display = 'block';
      selectedIndex = -1;
    } else {
      dropdown.style.display = 'none';
    }
  });
  
  // Render autocomplete dropdown
  function renderAutocomplete(matches) {
    dropdown.innerHTML = '';
    matches.forEach((wine, index) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.style.cssText = 'padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;';
      item.innerHTML = `
        <div style="font-weight: bold;">${wine.vinId || ''} - ${wine.navn || ''}</div>
        <div style="font-size: 0.9em; color: #666;">Varenummer: ${wine.varenummer || 'N/A'} | Antal: ${wine.antal || 0}</div>
      `;
      
      item.addEventListener('mouseenter', () => {
        selectedIndex = index;
        updateSelection();
      });
      
      item.addEventListener('click', () => {
        selectWine(wine);
      });
      
      dropdown.appendChild(item);
    });
    updateSelection();
  }
  
  // Update selected item styling
  function updateSelection() {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.style.backgroundColor = '#e3f2fd';
      } else {
        item.style.backgroundColor = 'white';
      }
    });
  }
  
  // Select wine from autocomplete
  function selectWine(wine) {
    input.value = wine.vinId || wine.varenummer || '';
    dropdown.style.display = 'none';
    scanQR();
  }
  
  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    if (dropdown.style.display === 'none') {
      if (e.key === 'Enter') {
        scanQR();
      }
      return;
    }
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentMatches.length - 1);
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection();
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectWine(currentMatches[selectedIndex]);
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
    }
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
  
  // Original Enter key handler (når dropdown er lukket)
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && dropdown.style.display === 'none') {
      scanQR();
    }
  });
}

let qrStream = null;
let qrScanning = false;

// Start QR scanner med kamera
async function startQRScanner() {
  const video = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');
  const btn = document.getElementById('start-camera-btn');
  
  if (qrScanning) {
    // Stop scanning
    if (qrStream) {
      qrStream.getTracks().forEach(track => track.stop());
      qrStream = null;
    }
    video.style.display = 'none';
    qrScanning = false;
    btn.textContent = '📷 Start kamera scanner';
    return;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } // Back camera på mobil
    });
    qrStream = stream;
    video.srcObject = stream;
    video.style.display = 'block';
    qrScanning = true;
    btn.textContent = '⏹ Stop scanner';
    
    video.play();
    
    // Scan loop
    function scanFrame() {
      if (!qrScanning) return;
      
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        if (typeof jsQR !== 'undefined') {
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            document.getElementById('scan-input').value = code.data;
            scanQR();
            // FORTSÆT SCANNING - ikke stop scanner
            // stopQRScanner(); // Fjernet - scanner fortsætter
          }
        }
      }
      requestAnimationFrame(scanFrame);
    }
    scanFrame();
  } catch (error) {
    console.error('Kamera fejl:', error);
    showError('Kunne ikke tilgå kamera. Tjek tilladelser.');
  }
}

// Stop QR scanner
function stopQRScanner() {
  if (qrStream) {
    qrStream.getTracks().forEach(track => track.stop());
    qrStream = null;
  }
  document.getElementById('qr-video').style.display = 'none';
  qrScanning = false;
  document.getElementById('start-camera-btn').textContent = '📷 Start kamera scanner';
}

async function scanQR() {
  const searchValue = document.getElementById('scan-input').value.trim();
  if (!searchValue) {
    showError('Indtast venligst en VIN-ID eller varenummer');
    return;
  }

  try {
    // Backend søger nu automatisk på både vinId og varenummer
    currentWine = await apiCall(`/api/wines/${encodeURIComponent(searchValue)}`);
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
    imgContainer.innerHTML = `<img src="${getConfig().API_URL}/uploads/images/${wine.billede}" alt="${wine.navn}">`;
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

// Opdater status farve baseret på antal
function updateStatusColor(row, antal) {
  const statusCell = row.querySelector('[data-status-cell]');
  const statusIcon = row.querySelector(`.status-icon-${row.querySelector('.min-antal-input')?.dataset.vinid || ''}`);
  
  if (!statusCell) return;
  
  let statusClass = '';
  let statusIconChar = '';
  let advarsel = '';
  
  if (antal >= 24) {
    statusClass = 'status-green';
    statusIconChar = '🟢';
  } else if (antal >= 13) {
    statusClass = 'status-orange';
    statusIconChar = '🟠';
  } else {
    statusClass = 'status-red';
    statusIconChar = '🔴';
    advarsel = '⚠️ Lavt lager!';
  }
  
  const statusDiv = statusCell.querySelector('div');
  if (statusDiv) {
    statusDiv.className = statusClass;
  }
  if (statusIcon) {
    statusIcon.textContent = statusIconChar;
  }
  
  // Opdater advarsel
  let advarselDiv = statusCell.querySelector('.lager-advarsel');
  if (antal < 13) {
    if (!advarselDiv) {
      advarselDiv = document.createElement('div');
      advarselDiv.className = 'lager-advarsel';
      advarselDiv.style.cssText = 'color: red; font-size: 0.8em; margin-top: 2px;';
      statusCell.appendChild(advarselDiv);
    }
    advarselDiv.textContent = '⚠️ Lavt lager!';
  } else if (advarselDiv) {
    advarselDiv.remove();
  }
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

    // Ryd input og scan-input så scanneren er klar til næste scan
    document.getElementById('count-input').value = '';
    document.getElementById('scan-input').value = '';
    
    // Hvis scanner kører, fortsæt scanning (ikke stop)
    // Scanner fortsætter automatisk

    updateDashboard();
    // Opdater lager visning (inkl. farvekodning baseret på nyt antal)
    await loadWines();
    renderLager();

    // Ryd input
    document.getElementById('count-input').value = '';
    document.getElementById('scan-input').value = '';
    
    // Opdater auto-opdatering efter gem
    // (loadWines kalder allerede updateDashboard, så data er opdateret)
    
    setTimeout(() => {
      document.getElementById('count-status').innerHTML = '';
    }, 3000);
  } catch (error) {
    document.getElementById('count-status').innerHTML = 
      `<div class="error-message">Fejl: ${error.message}</div>`;
  }
}

function showSuccess(message) {
  let successDiv = document.getElementById('success-message');
  if (!successDiv) {
    successDiv = document.createElement('div');
    successDiv.id = 'success-message';
    successDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 1rem; border-radius: 4px; z-index: 10000; display: block;';
    document.body.appendChild(successDiv);
  }
  successDiv.textContent = message;
  successDiv.style.display = 'block';
  setTimeout(() => {
    successDiv.style.display = 'none';
  }, 3000);
}

function showError(message) {
  const errorDiv = document.getElementById('scan-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('wine-details').style.display = 'none';
  } else {
    alert(message);
  }
}

// Import
function setupFileInput() {
  const fileInput = document.getElementById('file-input');
  if (!fileInput) {
    console.warn('file-input element ikke fundet - skip setup');
    return;
  }
  fileInput.addEventListener('change', (e) => {
    const fileName = e.target.files[0]?.name || '';
    const fileNameEl = document.getElementById('file-name');
    if (fileNameEl) {
      fileNameEl.textContent = fileName;
    }
  });
}

// Download Excel skabelon
async function downloadTemplate() {
  try {
    const config = getConfig();
    const response = await fetch(`${config.API_URL}/api/import/template`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP fejl: ${response.status}`);
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vinlager_skabelon.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    // Vis success besked
    showSuccess('Excel skabelon downloadet! Filen hedder: vinlager_skabelon.xlsx');
  } catch (error) {
    console.error('Fejl ved download af skabelon:', error);
    showError('Kunne ikke downloade skabelon: ' + error.message);
  }
}

async function doImport() {
  const fileInput = document.getElementById('file-input');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Vælg venligst en fil');
    return;
  }

  const mode = document.querySelector('input[name="import-mode"]:checked').value;
  
  // Advarsel hvis overskriv mode er valgt
  if (mode === 'overskriv') {
    const confirmed = confirm('⚠️ ADVARSEL: Du er ved at overskrive hele lageret!\n\nDette vil slette alle eksisterende vine og erstatte dem med data fra filen.\n\nEr du helt sikker?');
    if (!confirmed) {
      return;
    }
    // Dobbel bekræftelse
    const confirmed2 = confirm('⚠️ SIDSTE ADVARSEL!\n\nDette vil PERMANENT slette alle eksisterende vine!\n\nEr du 100% sikker?');
    if (!confirmed2) {
      return;
    }
  }
  
  // Vis loading
  const resultsDiv = document.getElementById('import-results');
  if (resultsDiv) {
    resultsDiv.style.display = 'block';
    document.getElementById('import-results-content').innerHTML = '<p>Importerer... Vent venligst.</p>';
  }
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);

  try {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const endpoint = isExcel ? '/api/import/excel' : '/api/import/csv';

    const response = await fetch(`${getConfig().API_URL}${endpoint}`, {
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
        <p>Importeret: ${result.importeret || 0}</p>
        <p>Opdateret: ${result.opdateret || 0}</p>
        ${result.fejl && result.fejl.length > 0 ? `<p>Fejl: ${result.fejl.length}</p>` : ''}
        <p style="margin-top: 10px; color: #4CAF50;"><strong>✅ Varelageret er nu opdateret!</strong></p>
      </div>
    `;

    // Reload wines - FORCE refresh fra backend
    console.log('🔄 Genindlæser varelager efter import...');
    await loadWines();
    renderLager();
    console.log('✅ Varelager genindlæst');
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

// Hjælpefunktion til QR canvas generering
function tryCanvasGeneration(container, text, qrLib) {
  try {
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    qrLib.toCanvas(canvas, text, {
      width: 100,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }, (canvasErr) => {
      if (canvasErr) {
        console.error('QR canvas fejl:', canvasErr);
        container.innerHTML = `<div style="padding: 10px; border: 1px solid #000; text-align: center; font-size: 0.8em;">VIN-ID: ${text}</div>`;
      }
    });
  } catch (e) {
    console.error('QR canvas exception:', e);
    container.innerHTML = `<div style="padding: 10px; border: 1px solid #000; text-align: center; font-size: 0.8em;">VIN-ID: ${text}</div>`;
  }
}

async function generateLabels() {
  const lokationFilter = document.getElementById('label-lokation').value;
  const reolFilter = document.getElementById('label-reol').value;
  const hyldeFilter = document.getElementById('label-hylde').value;

  let filtered = allWines;

  if (lokationFilter) {
    filtered = filtered.filter(w => w.lokation === lokationFilter);
  }
  if (reolFilter) {
    filtered = filtered.filter(w => w.reol === reolFilter);
  }
  if (hyldeFilter) {
    filtered = filtered.filter(w => w.hylde === hyldeFilter);
  }

  const container = document.getElementById('labels-container');
  container.innerHTML = '';

  filtered.forEach((wine, index) => {
    const label = document.createElement('div');
    label.className = 'label';
    const qrId = `qr-${wine.vinId}-${index}-${Date.now()}`;
    label.innerHTML = `
      <div class="label-info">
        <strong>${wine.navn || ''}</strong>
        <div>${wine.land || ''} ${wine.årgang || ''}</div>
        <div><strong>Lokation:</strong> ${wine.lokation || 'Ukendt'}</div>
        <div>Reol ${wine.reol || ''} - Hylde ${wine.hylde || ''}</div>
      </div>
      <div class="label-qr" id="${qrId}"></div>
    `;
    container.appendChild(label);

    // Generer QR kode (bruger vinId til QR scanning) - vent lidt så DOM er klar
    setTimeout(() => {
      const qrDiv = document.getElementById(qrId);
      if (!qrDiv) return;
      
      // Prøv qrcodejs først (QRCode constructor)
      if (typeof QRCode !== 'undefined' && QRCode.prototype) {
        // qrcodejs bibliotek - brug constructor
        qrDiv.innerHTML = '';
        try {
          new QRCode(qrDiv, {
            text: wine.vinId,
            width: 100,
            height: 100,
            colorDark: '#000000',
            colorLight: '#FFFFFF',
            correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 1
          });
          return;
        } catch (e) {
          console.warn('QRCode constructor fejlede:', e);
        }
      }
      
      // Tjek om qrcode (node-qrcode) er tilgængelig
      const QRCodeLib = window.QRCode || (typeof qrcode !== 'undefined' ? qrcode : null);
      
      if (QRCodeLib && typeof QRCodeLib.toDataURL === 'function') {
        // Prøv med toDataURL først
        QRCodeLib.toDataURL(wine.vinId, {
          width: 100,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        }, (err, url) => {
          if (err) {
            console.error('QR toDataURL fejl:', err);
            // Prøv med canvas
            tryCanvasGeneration(qrDiv, wine.vinId, QRCodeLib);
          } else {
            // Brug data URL til at oprette img
            const img = document.createElement('img');
            img.src = url;
            img.style.display = 'block';
            img.style.margin = '0 auto';
            img.style.maxWidth = '100px';
            img.style.maxHeight = '100px';
            qrDiv.innerHTML = '';
            qrDiv.appendChild(img);
          }
        });
      } else if (typeof QRCodeLib.toCanvas === 'function') {
        // Prøv direkte med canvas
        tryCanvasGeneration(qrDiv, wine.vinId, QRCodeLib);
      } else {
        console.warn('QRCode bibliotek ikke fundet. Tjekket:', {
          QRCode: typeof QRCode,
          windowQRCode: typeof window.QRCode,
          qrcode: typeof qrcode,
          'QRCode.prototype': typeof QRCode !== 'undefined' ? typeof QRCode.prototype : 'undefined'
        });
        qrDiv.innerHTML = `<div style="padding: 10px; border: 1px solid #000; text-align: center; font-size: 0.8em;">VIN-ID: ${wine.vinId}</div>`;
      }
    }, index * 50); // Lidt delay for hver label
  });
}

// Opdater minimum antal (for bagudkompatibilitet)
async function updateMinAntal(vinId, minAntal) {
  const inputElement = document.querySelector(`[data-vinid="${vinId}"].min-antal-input`);
  if (inputElement) {
    await updateMinAntalAndStatus(vinId, parseInt(minAntal) || 0, inputElement);
  }
}

// Upload billede til vin
async function uploadWineImage(input, vinId) {
  if (!input || !input.files || !input.files[0]) {
    console.error('Ingen fil valgt');
    return;
  }
  
  const file = input.files[0];
  console.log('Uploader billede:', file.name, 'til vin:', vinId);
  
  const formData = new FormData();
  formData.append('billede', file);
  
  try {
    const url = `${getConfig().API_URL}/api/wines/${vinId}/image`;
    console.log('Upload URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      throw new Error(errorData.error || `Upload fejlede: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Upload resultat:', result);
    
    // Opdater visningen
    await loadWines(); // Genhent alle vine
    renderLager();
    showSuccess('Billede uploadet!');
    
    // Reset file input så man kan uploade samme fil igen
    if (input) input.value = '';
  } catch (error) {
    console.error('Fejl ved upload:', error);
    alert('Fejl ved upload af billede: ' + error.message);
    showError('Kunne ikke uploade billede: ' + error.message);
  }
}

// Slet billede
async function deleteWineImage(vinId) {
  if (!confirm('Er du sikker på, at du vil slette billedet?')) return;
  
  try {
    // Hent vin først
    const wine = await apiCall(`/api/wines/${vinId}`);
    
    // Opdater vin uden billede
    wine.billede = null;
    
    await apiCall(`/api/wines/${vinId}`, {
      method: 'PUT',
      body: JSON.stringify(wine)
    });
    
    // Genhent vine og opdater visning
    await loadWines();
    renderLager();
    showSuccess('Billede slettet!');
  } catch (error) {
    console.error('Fejl ved sletning:', error);
    showError('Kunne ikke slette billede');
  }
}

// Vis billede i modal
function showImageModal(imageUrl) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; align-items: center; justify-content: center; cursor: pointer;';
  modal.innerHTML = `<img src="${imageUrl}" style="max-width: 90%; max-height: 90%;">`;
  modal.onclick = () => modal.remove();
  document.body.appendChild(modal);
}

// Print kun labels
function printLabels() {
  const container = document.getElementById('labels-container');
  if (!container || container.children.length === 0) {
    showError('Ingen labels at printe. Generer labels først.');
    return;
  }
  
  // Vis labels siden
  showPage('labels');
  
  // Vent lidt så siden er vist
  setTimeout(() => {
    window.print();
  }, 100);
}

// Rapporter
let reportsHistory = [];

// Tjek for ny rapport fra mobil scanner
function checkForNewReport() {
  // ALTID opdater rapporter fra backend (ikke kun hvis localStorage flag er sat)
  // Dette sikrer at rapporter fra mobil vises på PC
  if (typeof loadReportsHistory === 'function') {
    loadReportsHistory();
  }
  
  // OPDATER OGSÅ LAGER DATA - så dashboard opdateres efter scanning
  // Vent lidt først så backend har tid til at gemme data
  setTimeout(() => {
    if (typeof loadWines === 'function') {
      loadWines(); // Dette opdaterer allWines og kalder updateDashboard()
    }
  }, 1000); // Vent 1 sekund
  
  // Vis notifikation hvis localStorage flag er sat (for bagudkompatibilitet)
  const newReportAvailable = localStorage.getItem('newReportAvailable');
  if (newReportAvailable === 'true') {
    // Vis notifikation
    const notification = document.createElement('div');
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 10000; max-width: 300px;';
    notification.innerHTML = `
      <h3 style="margin: 0 0 10px 0;">✅ Ny rapport tilgængelig!</h3>
      <p style="margin: 0 0 15px 0;">Optælling fra mobil er afsluttet.</p>
      <button onclick="showReportsPage(); this.parentElement.remove(); localStorage.removeItem('newReportAvailable'); loadReportsHistory();" style="background: white; color: #4CAF50; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-right: 10px;">Se rapport</button>
      <button onclick="this.parentElement.remove(); localStorage.removeItem('newReportAvailable');" style="background: transparent; color: white; border: 1px solid white; padding: 8px 15px; border-radius: 4px; cursor: pointer;">Luk</button>
    `;
    document.body.appendChild(notification);
    
    // Auto-fjern efter 10 sekunder
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }
}

// Vis rapporter side
function showReportsPage() {
  showPage('rapporter');
  // Opdater rapporter - ALTID hent fra backend så vi får nye rapporter fra mobil
  if (typeof loadReportsHistory === 'function') {
    loadReportsHistory();
  }
}

// Indlæs rapport historik
async function loadReportsHistory() {
  try {
    console.log('🔄 Henter rapporter fra backend...');
    // ALTID hent fra backend først (så vi får rapporter fra mobil)
    try {
      const backendReports = await apiCall('/api/reports/history');
      console.log('📊 Backend returnerede:', backendReports?.length || 0, 'rapporter');
      console.log('📊 Første rapport:', backendReports?.[0]);
      
      if (backendReports && Array.isArray(backendReports)) {
        // Brug backend data - dette sikrer at rapporter fra mobil også vises
        reportsHistory = backendReports.map(r => ({
          id: r.id || r.reportId || r.report_id,
          date: r.date || r.created || r.created_at,
          name: r.name || r.report_name,
          type: r.type || r.report_type || 'lager',
          wineCount: r.wineCount || r.wine_count || r.wineCount || 0,
          totalValue: r.totalValue || r.total_value || r.totalValue || 0,
          location: r.location || 'Mobil Optælling',
          archived: r.archived === 1 || r.archived === true || false
        }));
        // Sorter efter dato (nyeste først)
        reportsHistory.sort((a, b) => {
          const dateA = new Date(a.date || 0);
          const dateB = new Date(b.date || 0);
          return dateB - dateA;
        });
        // Gem også i localStorage som backup
        localStorage.setItem('reportsHistory', JSON.stringify(reportsHistory));
        console.log('✅ Rapporter hentet fra backend:', reportsHistory.length);
        if (reportsHistory.length > 0) {
          console.log('📋 Eksempel rapport:', reportsHistory[0]);
          console.log('📋 Alle rapporter:', reportsHistory.map(r => ({ id: r.id, name: r.name, date: r.date, location: r.location })));
        } else {
          console.warn('⚠️ Ingen rapporter fundet i backend!');
        }
      } else {
        // Hvis backend returnerer tom array, brug den alligevel (så vi ikke bruger gammel localStorage data)
        reportsHistory = [];
        localStorage.setItem('reportsHistory', JSON.stringify(reportsHistory));
        console.log('✅ Backend returnerede tom liste - nulstiller rapporter');
      }
    } catch (backendError) {
      console.error('❌ Fejl ved hentning fra backend:', backendError);
      console.error('❌ Fejl detaljer:', backendError.message, backendError.stack);
      // Fallback til localStorage kun hvis backend fejler
      const saved = localStorage.getItem('reportsHistory');
      if (saved) {
        try {
          reportsHistory = JSON.parse(saved);
          console.log('⚠️ Bruger localStorage backup:', reportsHistory.length, 'rapporter');
        } catch (parseError) {
          console.error('Fejl ved parsing af localStorage:', parseError);
          reportsHistory = [];
        }
      } else {
        reportsHistory = [];
      }
      // Prøv at hente fra backend igen efter 3 sekunder
      setTimeout(() => {
        loadReportsHistory();
      }, 3000);
    }
    // Opdater lokation filter før vi renderer tabellen
    updateLocationFilter();
    renderReportsTable();
  } catch (error) {
    console.error('Fejl ved indlæsning af rapport historik:', error);
    // Prøv at bruge localStorage som sidste fallback
    const saved = localStorage.getItem('reportsHistory');
    if (saved) {
      try {
        reportsHistory = JSON.parse(saved);
        updateLocationFilter();
        renderReportsTable();
      } catch (parseError) {
        console.error('Fejl ved parsing af localStorage:', parseError);
      }
    }
  }
}

// Gem rapport i historik
async function saveReportToHistory(reportName, reportType, wineCount, totalValue) {
  const report = {
    reportId: Date.now().toString(),
    date: new Date().toLocaleString('da-DK'),
    name: reportName,
    type: reportType,
    wineCount: wineCount,
    totalValue: totalValue,
    location: 'Lokal',
    archived: false
  };
  
  // Gem i backend
  try {
    await apiCall('/api/reports/save', {
      method: 'POST',
      body: JSON.stringify(report)
    });
    console.log('✅ Rapport gemt i backend');
  } catch (error) {
    console.error('Fejl ved gemning i backend:', error);
  }
  
  // Gem også i localStorage som backup
  const reportForLocalStorage = {
    id: report.reportId,
    date: report.date,
    name: report.name,
    type: report.type,
    wineCount: report.wineCount,
    totalValue: report.totalValue,
    location: report.location,
    archived: report.archived
  };
  
  reportsHistory.unshift(reportForLocalStorage); // Tilføj øverst
  if (reportsHistory.length > 100) {
    reportsHistory = reportsHistory.slice(0, 100); // Begræns til 100 rapporter
  }
  
  localStorage.setItem('reportsHistory', JSON.stringify(reportsHistory));
  updateLocationFilter(); // Opdater lokation filter når ny rapport tilføjes
  renderReportsTable();
}

// Opdater lokation filter dropdown
function updateLocationFilter() {
  const locationSelect = document.getElementById('report-location');
  if (!locationSelect) return;
  
  // Hent alle unikke lokationer fra rapporterne
  const locations = [...new Set(reportsHistory.map(r => r.location).filter(l => l))];
  
  // Gem aktuelt valgte værdi
  const currentValue = locationSelect.value;
  
  // Opdater options
  locationSelect.innerHTML = '<option value="all">Alle</option>';
  locations.sort().forEach(location => {
    const option = document.createElement('option');
    option.value = location;
    option.textContent = location;
    locationSelect.appendChild(option);
  });
  
  // Gendan valgte værdi (hvis den stadig findes)
  if (locations.includes(currentValue)) {
    locationSelect.value = currentValue;
  } else {
    locationSelect.value = 'all';
  }
}

// Formatér dato til dansk format
function formatDanskDato(dateStr) {
  if (!dateStr) return '';
  
  try {
    // Håndter SQLite format: "2026-01-23 15:29:30"
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      let isoStr = dateStr;
      if (!dateStr.includes('T') && dateStr.includes(' ')) {
        isoStr = dateStr.replace(' ', 'T');
      }
      const date = new Date(isoStr);
      if (!isNaN(date.getTime())) {
        // Formatér til dansk: "23.01.2026 15:29"
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}`;
      }
    }
    // Hvis allerede formateret, returnér som det er
    return dateStr;
  } catch (e) {
    console.warn('Fejl ved formatering af dato:', dateStr, e);
    return dateStr;
  }
}

// Render rapport tabel
function renderReportsTable() {
  const tbody = document.getElementById('reports-tbody');
  if (!tbody) return;
  
  const periodFilter = document.getElementById('report-period')?.value || 'all';
  const locationFilter = document.getElementById('report-location')?.value || 'all';
  const archivedFilter = document.getElementById('report-archived-filter')?.value || 'active';
  
  // Opdater lokation dropdown med faktiske lokationer
  updateLocationFilter();
  
  // Start med alle rapporter
  let filtered = [...reportsHistory];
  
  // Filtrer efter periode
  if (periodFilter !== 'all') {
    const now = new Date();
    const originalCount = filtered.length;
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🔍 FILTER VERSION v43 - Starter periode filter "${periodFilter}"`);
    console.log(`📊 Starter med ${originalCount} rapporter`);
    console.log(`📅 Nuværende dato: ${now.toISOString()}`);
    console.log('═══════════════════════════════════════════════════════');
    
    filtered = filtered.filter(r => {
      // Parse dato - håndter forskellige formater
      let reportDate;
      try {
        const dateStr = r.date || '';
        if (!dateStr) {
          console.warn('Rapport mangler dato:', r);
          return false;
        }
        
        // Prøv ISO format først (fra backend): "2026-01-22 08:30:00" eller "2026-01-22T08:30:00"
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          // Håndter både "2026-01-22 08:30:00" og "2026-01-22T08:30:00"
          let isoStr = dateStr;
          if (!dateStr.includes('T') && dateStr.includes(' ')) {
            isoStr = dateStr.replace(' ', 'T');
          }
          reportDate = new Date(isoStr);
          // Hvis parsing fejler, prøv med kun dato del
          if (isNaN(reportDate.getTime())) {
            const dateOnly = dateStr.split(/[\sT]/)[0]; // Få kun dato delen "2026-01-22"
            reportDate = new Date(dateOnly + 'T00:00:00');
          }
          // Verificer at dato er korrekt
          if (isNaN(reportDate.getTime())) {
            console.warn('Kunne ikke parse ISO dato:', dateStr);
            return false;
          }
        }
        // Prøv dansk format: "20.1.2026, 08.28.13" eller "20.1.2026"
        else if (dateStr.includes('.')) {
          const dateOnly = dateStr.replace(/,.*$/, ''); // Fjern tid del
          const parts = dateOnly.split('.');
          if (parts.length === 3) {
            // Format: dd.mm.yyyy eller d.m.yyyy
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            reportDate = new Date(year, month, day);
          } else {
            reportDate = new Date(dateStr);
          }
        }
        // Fallback til standard parsing
        else {
          reportDate = new Date(r.date);
        }
      } catch (e) {
        console.warn('Kunne ikke parse dato:', r.date, e);
        return false; // Ugyldig dato - udelad fra filter
      }
      
      if (isNaN(reportDate.getTime())) {
        console.warn('Ugyldig dato:', r.date);
        return false; // Ugyldig dato
      }
      
      // Normaliser rapport dato til start af dagen for alle sammenligninger
      const reportDay = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
      reportDay.setHours(0, 0, 0, 0);
      const reportDayTime = reportDay.getTime();
      
      if (periodFilter === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();
        const matches = reportDayTime === todayTime;
        if (!matches) {
          console.log('Today filter - ikke match:', { reportDate: r.date, reportDayTime, todayTime });
        }
        return matches;
      } else if (periodFilter === 'week') {
        // Sidste uge = sidste kalenderuge (mandag til søndag)
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        today.setHours(0, 0, 0, 0);
        
        // Find sidste mandag (start af sidste uge)
        const dayOfWeek = today.getDay(); // 0 = søndag, 1 = mandag, osv.
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Konverter til mandag = 0
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - daysFromMonday - 7); // Gå tilbage til sidste mandag
        lastMonday.setHours(0, 0, 0, 0);
        
        // Sidste søndag (slut af sidste uge)
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6); // Mandag + 6 dage = søndag
        lastSunday.setHours(23, 59, 59, 999);
        
        const lastMondayTime = lastMonday.getTime();
        const lastSundayTime = lastSunday.getTime();
        
        const isInRange = reportDayTime >= lastMondayTime && reportDayTime <= lastSundayTime;
        
        console.log('Week filter (sidste kalenderuge):', {
          reportDate: r.date,
          reportDay: reportDay.toISOString().split('T')[0],
          lastMonday: lastMonday.toISOString().split('T')[0],
          lastSunday: lastSunday.toISOString().split('T')[0],
          reportDayTime,
          lastMondayTime,
          lastSundayTime,
          isInRange: isInRange ? '✅ MATCH' : '❌ IKKE MATCH'
        });
        
        return isInRange;
      } else if (periodFilter === 'thisMonth') {
        // Denne måned = nuværende kalendermåned
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const thisMonthStart = new Date(currentYear, currentMonth, 1);
        thisMonthStart.setHours(0, 0, 0, 0);
        const thisMonthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
        return reportDayTime >= thisMonthStart.getTime() && reportDayTime <= thisMonthEnd.getTime();
      } else if (periodFilter === 'lastMonth') {
        // Sidste måned = forrige kalendermåned (ikke sidste 30 dage)
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
        lastMonthStart.setHours(0, 0, 0, 0);
        const lastMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
        return reportDayTime >= lastMonthStart.getTime() && reportDayTime <= lastMonthEnd.getTime();
      }
      // Hvis vi når hertil uden at matche nogen periode, returner false
      console.warn('Ukendt periode filter:', periodFilter, 'for rapport:', r.date);
      return false;
    });
    console.log(`✅ Periode filter "${periodFilter}": ${originalCount} → ${filtered.length} rapporter`);
  }
  
  // Filtrer efter lokation
  if (locationFilter !== 'all') {
    filtered = filtered.filter(r => r.location === locationFilter);
  }
  
  // Filtrer efter arkiveret status
  if (archivedFilter === 'active') {
    filtered = filtered.filter(r => !r.archived);
  } else if (archivedFilter === 'archived') {
    filtered = filtered.filter(r => r.archived);
  }
  // Hvis archivedFilter === 'all', vis alle (ingen filter)
  
  tbody.innerHTML = '';
  
  console.log('📊 RenderReportsTable - Filteret resultat:', filtered.length, 'af', reportsHistory.length, 'rapporter');
  console.log('📊 Filterede rapporter:', filtered.map(r => ({ id: r.id, name: r.name, date: r.date })));
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding: 1rem; text-align: center; color: #999;">Ingen rapporter fundet</td></tr>';
    return;
  }
  
  filtered.forEach(report => {
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid #eee';
    
    // Dato kolonne - formatér korrekt
    const dateCell = document.createElement('td');
    dateCell.style.padding = '0.75rem';
    dateCell.textContent = formatDanskDato(report.date);
    row.appendChild(dateCell);
    
    // Navn kolonne
    const nameCell = document.createElement('td');
    nameCell.style.padding = '0.75rem';
    nameCell.innerHTML = `${report.name} <span style="background: #e6f7e6; color: #060; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin-left: 0.5rem;">${report.location}</span>`;
    row.appendChild(nameCell);
    
    // Værdi kolonne
    const valueCell = document.createElement('td');
    valueCell.style.padding = '0.75rem';
    valueCell.textContent = `${report.wineCount} linjer — ${formatDanskPris(report.totalValue)} kr.`;
    row.appendChild(valueCell);
    
    // Antal kolonne
    const countCell = document.createElement('td');
    countCell.style.padding = '0.75rem';
    countCell.textContent = report.wineCount;
    row.appendChild(countCell);
    
    // Lokation kolonne
    const locationCell = document.createElement('td');
    locationCell.style.padding = '0.75rem';
    locationCell.textContent = report.location;
    row.appendChild(locationCell);
    
    // Handlinger kolonne
    const actionsCell = document.createElement('td');
    actionsCell.style.padding = '0.75rem';
    
    // Vis PDF knap
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn-secondary';
    viewBtn.textContent = 'Vis PDF';
    viewBtn.style.cssText = 'margin-right: 0.25rem; padding: 0.25rem 0.5rem; font-size: 0.9em;';
    viewBtn.onclick = () => viewReportPDF(report.id);
    actionsCell.appendChild(viewBtn);
    
    // Download knap
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn-secondary';
    downloadBtn.textContent = '📥 Download';
    downloadBtn.style.cssText = 'margin-right: 0.25rem; padding: 0.25rem 0.5rem; font-size: 0.9em;';
    downloadBtn.onclick = () => downloadReport(report.id);
    actionsCell.appendChild(downloadBtn);
    
    // Arkiver/Gendan knap - ALTID vis denne knap
    const archiveBtn = document.createElement('button');
    archiveBtn.className = 'btn-secondary';
    if (report.archived === undefined || !report.archived) {
      archiveBtn.textContent = '📦 Arkiver';
      archiveBtn.style.cssText = 'background: #f97316; color: white; padding: 0.25rem 0.5rem; font-size: 0.9em; border: none; cursor: pointer;';
      archiveBtn.onclick = () => archiveReport(report.id);
    } else {
      archiveBtn.textContent = '↩️ Gendan';
      archiveBtn.style.cssText = 'background: #4CAF50; color: white; padding: 0.25rem 0.5rem; font-size: 0.9em; border: none; cursor: pointer;';
      archiveBtn.onclick = () => unarchiveReport(report.id);
    }
    actionsCell.appendChild(archiveBtn);
    
    row.appendChild(actionsCell);
    tbody.appendChild(row);
  });
}

// Vis rapport PDF i browser (ikke download)
async function viewReportPDF(reportId) {
  const report = reportsHistory.find(r => r.id === reportId);
  if (!report) {
    alert('Rapport ikke fundet');
    return;
  }
  
  // ALTID generer fuld PDF med vine-data for ALLE rapporter
  await generateFullReportPDF(report);
}

// Generer fuld PDF rapport med vine-data (for mobil rapporter)
async function generateFullReportPDF(report) {
  try {
    console.log('📄 Genererer fuld PDF for rapport:', report);
    
    // Hent vine-data fra backend (samme som mobil scanneren gjorde)
    console.log('🔍 Henter vine-data fra backend...');
    const wines = await apiCall('/api/reports/lager');
    console.log('✅ Hentet vine-data:', wines ? wines.length : 0, 'vine');
    
    if (!wines || !Array.isArray(wines) || wines.length === 0) {
      console.warn('⚠️ Ingen vine-data fundet!');
      alert('Ingen vine-data fundet. Tjek om lageret indeholder vine.');
      return;
    }
    
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      throw new Error('jsPDF bibliotek ikke fundet');
    }
    
    const doc = new jsPDF();
    
    let y = 20;
    doc.setFontSize(16);
    doc.text(report.name || 'Lagerrapport - Optælling Afsluttet', 14, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.text('Genereret: ' + (report.date || new Date().toLocaleString('da-DK')), 14, y);
    y += 10;
    
    // Grupper vine efter lokation
    const winesByLocation = {};
    wines.forEach(wine => {
      // Tjek både 'lokation' og 'location' (forskellige API'er kan bruge forskellige navne)
      const location = wine.lokation || wine.location || 'Ukendt lokation';
      if (!winesByLocation[location]) {
        winesByLocation[location] = [];
      }
      winesByLocation[location].push(wine);
    });
    
    console.log('📍 Grupperet vine efter lokation:', Object.keys(winesByLocation).map(loc => ({
      lokation: loc,
      antal: winesByLocation[loc].length
    })));
    
    const headers = ['VIN-ID', 'Navn', 'Type', 'Land', 'Antal', 'Min', 'Pris'];
    const colWidths = [30, 60, 25, 25, 15, 15, 30];
    
    let grandTotalVærdi = 0;
    let grandTotalWineCount = 0;
    const locationTotals = {};
    
    // Gennemgå hver lokation
    Object.keys(winesByLocation).sort().forEach((location, locIndex) => {
      const locationWines = winesByLocation[location];
      let locationTotalVærdi = 0;
      let locationWineCount = 0;
      
      // Tjek om vi skal tilføje ny side
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      // Lokation header
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Lokation: ${location}`, 14, y);
      y += 8;
      
      // Tabel header
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      let x = 14;
      headers.forEach((header, i) => {
        doc.text(header, x, y);
        x += colWidths[i];
      });
      y += 6;
      
      // Vine i denne lokation
      locationWines.forEach(wine => {
        if (y > 280) {
          doc.addPage();
          y = 20;
          // Genprint header
          x = 14;
          doc.setFontSize(8);
          headers.forEach((header, i) => {
            doc.text(header, x, y);
            x += colWidths[i];
          });
          y += 6;
        }
        
        const pris = wine.indkøbspris || 0;
        const værdi = pris * (wine.antal || 0);
        locationTotalVærdi += værdi;
        locationWineCount++;
        
        x = 14;
        // Tilføj prik (•) foran VIN-ID for at markere optalte vine
        const vinIdMarked = '• ' + (wine.vinId || '');
        const row = [
          vinIdMarked,
          wine.navn || '',
          wine.type || '',
          wine.land || '',
          wine.antal || 0,
          wine.minAntal || 24,
          pris.toFixed(2)
        ];
        
        row.forEach((cell, i) => {
          doc.text(String(cell).substring(0, 25), x, y);
          x += colWidths[i];
        });
        y += 6;
      });
      
      // Lokation total
      y += 3;
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text(`Total ${location}: ${locationWineCount} vine, ${formatDanskPris(locationTotalVærdi)} kr.`, 14, y);
      y += 8;
      
      locationTotals[location] = {
        værdi: locationTotalVærdi,
        antal: locationWineCount
      };
      grandTotalVærdi += locationTotalVærdi;
      grandTotalWineCount += locationWineCount;
    });
    
    console.log(`✅ Tilføjet ${grandTotalWineCount} vine til PDF fra ${Object.keys(winesByLocation).length} lokationer`);
    
    // Grand total
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    y += 5;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    // Brug enkelte karakterer i stedet for special characters for bedre encoding
    doc.text('=======================================', 14, y);
    y += 7;
    doc.text(`SAMLET TOTAL: ${grandTotalWineCount} vine, ${formatDanskPris(grandTotalVærdi)} kr.`, 14, y);
    y += 7;
    doc.text('=======================================', 14, y);
    y += 10;
    
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Rapport ID: ' + report.id, 14, y);
    
    // Vis PDF i browser
    console.log('📄 Åbner PDF i browser...');
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
    console.log('✅ PDF åbnet');
  } catch (error) {
    console.error('❌ Fejl ved generering af fuld PDF:', error);
    console.error('Fejl detaljer:', error.stack);
    alert('Kunne ikke vise rapport. Fejl: ' + error.message + '\n\nTjek console for flere detaljer.');
  }
}

// Generer PDF fra gemt rapport data (ikke fra nuværende lager) - for lokale rapporter
function generateReportPDFFromData(report) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let y = 20;
    doc.setFontSize(16);
    doc.text(report.name || 'Rapport', 14, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.text('Type: ' + (report.type === 'lager' ? 'Lagerrapport' : 'Værdirapport'), 14, y);
    y += 7;
    doc.text('Dato: ' + (report.date || 'Ukendt'), 14, y);
    y += 7;
    doc.text('Lokation: ' + (report.location || 'Ukendt'), 14, y);
    y += 7;
    doc.text('Antal vine: ' + (report.wineCount || 0), 14, y);
    y += 7;
    const totalValue = typeof report.totalValue === 'number' ? report.totalValue : parseFloat(report.totalValue) || 0;
    doc.text('Total værdi: ' + totalValue.toLocaleString('da-DK', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' kr.', 14, y);
    y += 15;
    
    doc.setFontSize(8);
    doc.text('Note: Dette er en gemt rapport.', 14, y);
    y += 7;
    doc.text('Rapport ID: ' + report.id, 14, y);
    
    // Vis PDF i browser (samme metode som de andre view-only funktioner)
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } catch (error) {
    console.error('Fejl ved generering af PDF fra data:', error);
    alert('Kunne ikke vise rapport. Fejl: ' + error.message);
  }
}

// Download rapport
async function downloadReport(reportId) {
  const report = reportsHistory.find(r => r.id === reportId);
  if (!report) {
    alert('Rapport ikke fundet');
    return;
  }
  
  // ALTID generer fuld PDF med vine-data for ALLE rapporter
  await generateFullReportPDFForDownload(report);
}

// Generer fuld PDF rapport med vine-data til download (for mobil rapporter)
async function generateFullReportPDFForDownload(report) {
  try {
    console.log('📥 Downloader fuld PDF for rapport:', report);
    
    // Hent vine-data fra backend (samme som mobil scanneren gjorde)
    const wines = await apiCall('/api/reports/lager');
    console.log('✅ Hentet vine-data:', wines ? wines.length : 0, 'vine');
    
    if (!wines || !Array.isArray(wines) || wines.length === 0) {
      console.warn('⚠️ Ingen vine-data fundet!');
      alert('Ingen vine-data fundet. Tjek om lageret indeholder vine.');
      return;
    }
    
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      throw new Error('jsPDF bibliotek ikke fundet');
    }
    
    const doc = new jsPDF();
    
    let y = 20;
    doc.setFontSize(16);
    doc.text(report.name || 'Lagerrapport - Optælling Afsluttet', 14, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.text('Genereret: ' + (report.date || new Date().toLocaleString('da-DK')), 14, y);
    y += 10;
    
    // Grupper vine efter lokation
    const winesByLocation = {};
    wines.forEach(wine => {
      // Tjek både 'lokation' og 'location' (forskellige API'er kan bruge forskellige navne)
      const location = wine.lokation || wine.location || 'Ukendt lokation';
      if (!winesByLocation[location]) {
        winesByLocation[location] = [];
      }
      winesByLocation[location].push(wine);
    });
    
    console.log('📍 Grupperet vine efter lokation:', Object.keys(winesByLocation).map(loc => ({
      lokation: loc,
      antal: winesByLocation[loc].length
    })));
    
    const headers = ['VIN-ID', 'Navn', 'Type', 'Land', 'Antal', 'Min', 'Pris'];
    const colWidths = [30, 60, 25, 25, 15, 15, 30];
    
    let grandTotalVærdi = 0;
    let grandTotalWineCount = 0;
    const locationTotals = {};
    
    // Gennemgå hver lokation
    Object.keys(winesByLocation).sort().forEach((location, locIndex) => {
      const locationWines = winesByLocation[location];
      let locationTotalVærdi = 0;
      let locationWineCount = 0;
      
      // Tjek om vi skal tilføje ny side
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      // Lokation header
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Lokation: ${location}`, 14, y);
      y += 8;
      
      // Tabel header
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      let x = 14;
      headers.forEach((header, i) => {
        doc.text(header, x, y);
        x += colWidths[i];
      });
      y += 6;
      
      // Vine i denne lokation
      locationWines.forEach(wine => {
        if (y > 280) {
          doc.addPage();
          y = 20;
          // Genprint header
          x = 14;
          doc.setFontSize(8);
          headers.forEach((header, i) => {
            doc.text(header, x, y);
            x += colWidths[i];
          });
          y += 6;
        }
        
        const pris = wine.indkøbspris || 0;
        const værdi = pris * (wine.antal || 0);
        locationTotalVærdi += værdi;
        locationWineCount++;
        
        x = 14;
        // Tilføj prik (•) foran VIN-ID for at markere optalte vine
        const vinIdMarked = '• ' + (wine.vinId || '');
        const row = [
          vinIdMarked,
          wine.navn || '',
          wine.type || '',
          wine.land || '',
          wine.antal || 0,
          wine.minAntal || 24,
          pris.toFixed(2)
        ];
        
        row.forEach((cell, i) => {
          doc.text(String(cell).substring(0, 25), x, y);
          x += colWidths[i];
        });
        y += 6;
      });
      
      // Lokation total
      y += 3;
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text(`Total ${location}: ${locationWineCount} vine, ${formatDanskPris(locationTotalVærdi)} kr.`, 14, y);
      y += 8;
      
      locationTotals[location] = {
        værdi: locationTotalVærdi,
        antal: locationWineCount
      };
      grandTotalVærdi += locationTotalVærdi;
      grandTotalWineCount += locationWineCount;
    });
    
    // Grand total
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    y += 5;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    // Brug enkelte karakterer i stedet for special characters for bedre encoding
    doc.text('=======================================', 14, y);
    y += 7;
    doc.text(`SAMLET TOTAL: ${grandTotalWineCount} vine, ${formatDanskPris(grandTotalVærdi)} kr.`, 14, y);
    y += 7;
    doc.text('=======================================', 14, y);
    y += 10;
    
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Rapport ID: ' + report.id, 14, y);
    
    // Download PDF
    const fileName = (report.name || 'rapport').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
    doc.save(fileName);
    console.log('✅ PDF downloadet:', fileName);
  } catch (error) {
    console.error('❌ Fejl ved generering af fuld PDF:', error);
    console.error('Fejl detaljer:', error.stack);
    alert('Kunne ikke downloade rapport. Fejl: ' + error.message + '\n\nTjek console for flere detaljer.');
  }
}

// Generer PDF fra gemt rapport data til download (for lokale rapporter)
function generateReportPDFFromDataForDownload(report) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let y = 20;
    doc.setFontSize(16);
    doc.text(report.name || 'Rapport', 14, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.text('Type: ' + (report.type === 'lager' ? 'Lagerrapport' : 'Værdirapport'), 14, y);
    y += 7;
    doc.text('Dato: ' + (report.date || 'Ukendt'), 14, y);
    y += 7;
    doc.text('Lokation: ' + (report.location || 'Ukendt'), 14, y);
    y += 7;
    doc.text('Antal vine: ' + (report.wineCount || 0), 14, y);
    y += 7;
    const totalValue = typeof report.totalValue === 'number' ? report.totalValue : parseFloat(report.totalValue) || 0;
    doc.text('Total værdi: ' + totalValue.toLocaleString('da-DK', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' kr.', 14, y);
    y += 15;
    
    doc.setFontSize(8);
    doc.text('Note: Dette er en gemt rapport.', 14, y);
    y += 7;
    doc.text('Rapport ID: ' + report.id, 14, y);
    
    // Download PDF
    const fileName = (report.name || 'rapport').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
    doc.save(fileName);
  } catch (error) {
    console.error('Fejl ved generering af PDF fra data:', error);
    alert('Kunne ikke downloade rapport. Fejl: ' + error.message);
  }
}

// Arkiver rapport
async function archiveReport(reportId) {
  const report = reportsHistory.find(r => r.id === reportId);
  if (!report) {
    alert('Rapport ikke fundet');
    return;
  }
  
  try {
    // Opdater i backend
    await apiCall(`/api/reports/${reportId}`, {
      method: 'PUT',
      body: JSON.stringify({ archived: true })
    });
    
    // Opdater lokalt
    report.archived = true;
    localStorage.setItem('reportsHistory', JSON.stringify(reportsHistory));
    renderReportsTable();
    console.log('✅ Rapport arkiveret i backend');
  } catch (error) {
    console.error('Fejl ved arkivering:', error);
    console.error('Fejl detaljer:', error.message);
    // Fallback: Gem kun lokalt hvis backend fejler
    report.archived = true;
    localStorage.setItem('reportsHistory', JSON.stringify(reportsHistory));
    renderReportsTable();
    alert('⚠️ Rapport arkiveret lokalt, men kunne ikke gemmes i backend. Tjek console for fejl.');
  }
}

// Gendan (unarchive) rapport
async function unarchiveReport(reportId) {
  const report = reportsHistory.find(r => r.id === reportId);
  if (!report) {
    alert('Rapport ikke fundet');
    return;
  }
  
  try {
    // Opdater i backend
    await apiCall(`/api/reports/${reportId}`, {
      method: 'PUT',
      body: JSON.stringify({ archived: false })
    });
    
    // Opdater lokalt
    report.archived = false;
    localStorage.setItem('reportsHistory', JSON.stringify(reportsHistory));
    renderReportsTable();
    console.log('✅ Rapport gendannet i backend');
  } catch (error) {
    console.error('Fejl ved gendannelse:', error);
    console.error('Fejl detaljer:', error.message);
    // Fallback: Gem kun lokalt hvis backend fejler
    report.archived = false;
    localStorage.setItem('reportsHistory', JSON.stringify(reportsHistory));
    renderReportsTable();
    alert('⚠️ Rapport gendannet lokalt, men kunne ikke gemmes i backend. Tjek console for fejl.');
  }
}

// Generer lav status rapport (gem i tabellen uden at vise/download)
async function generateLavStatusRapport() {
  try {
    const wines = await apiCall('/api/reports/lager');
    
    // Beregn total værdi
    let totalVærdi = 0;
    wines.forEach(w => {
      totalVærdi += (w.antal || 0) * (w.indkøbspris || 0);
    });
    
    // Gem rapport i historik (uden at vise eller downloade PDF)
    saveReportToHistory('OPTA-' + Date.now().toString().slice(-6), 'lager', wines.length, totalVærdi);
    
    showSuccess('Rapport genereret og tilføjet til historik!');
  } catch (error) {
    console.error('Fejl ved generering af rapport:', error);
    showError('Kunne ikke generere rapport: ' + error.message);
  }
}

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

    // Kun de vigtigste kolonner: VIN-ID, Navn, Type, Land, Antal, Min, Pris
    const headers = ['VIN-ID', 'Navn', 'Type', 'Land', 'Antal', 'Min', 'Pris'];
    const colWidths = [30, 60, 25, 25, 15, 15, 30];
    let x = 14;

    // Header
    doc.setFontSize(8);
    headers.forEach((header, i) => {
      doc.text(header, x, y);
      x += colWidths[i];
    });
    y += 6;

    // Beregn total værdi
    let totalVærdi = 0;

    // Rows
    wines.forEach(wine => {
      if (y > 280) {
        doc.addPage();
        y = 20;
        
        // Tegn header igen på ny side
        x = 14;
        headers.forEach((header, i) => {
          doc.text(header, x, y);
          x += colWidths[i];
        });
        y += 6;
      }

      const pris = wine.indkøbspris || 0;
      const værdi = pris * (wine.antal || 0);
      totalVærdi += værdi;

      x = 14;
      // Kun de vigtigste felter - ingen Årgang, Reol, Hylde, Region, Drue
      const row = [
        wine.vinId || '',
        wine.navn || '',
        wine.type || '',
        wine.land || '',
        wine.antal || 0,
        wine.minAntal || 24,
        pris > 0 ? pris.toFixed(2) + ' kr.' : ''
      ];

      row.forEach((cell, i) => {
        const cellText = String(cell || '');
        // For pris kolonne (sidste, index 6), brug mere plads
        const maxChars = i === 6 ? 18 : Math.floor(colWidths[i] / 2.5);
        let displayText = cellText.length > maxChars ? cellText.substring(0, maxChars - 1) + '...' : cellText;
        doc.text(displayText, x, y);
        x += colWidths[i];
      });
      y += 6;
    });

    // Tilføj total linje - sørg for plads på siden
    if (y > 270) {
      doc.addPage();
      y = 280;
    } else {
      y += 10;
    }
    
    // Linje før total
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(14, y, 196, y);
    y += 8;
    
    // Total tekst - sørg for at den faktisk skrives
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    const totalText = `Total lagerværdi: ${formatDanskPris(totalVærdi)} kr.`;
    doc.text(totalText, 14, y);
    doc.setFont(undefined, 'normal');
    
    console.log('Rapport genereret - Total værdi:', totalVærdi);

    // Gem rapport i historik (brug totalVærdi der allerede er beregnet)
    saveReportToHistory('OPTA-' + Date.now().toString().slice(-6), 'lager', wines.length, totalVærdi);
    
    // Download PDF
    doc.save('lagerrapport.pdf');
  } catch (error) {
    alert('Fejl ved generering af rapport: ' + error.message);
  }
}

// Download lager rapport
async function generateLagerReportDownload() {
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

    const headers = ['VIN-ID', 'Navn', 'Type', 'Land', 'Antal', 'Min', 'Pris'];
    const colWidths = [30, 60, 25, 25, 15, 15, 30];
    let x = 14;

    doc.setFontSize(8);
    headers.forEach((header, i) => {
      doc.text(header, x, y);
      x += colWidths[i];
    });
    y += 6;

    let totalVærdi = 0;

    wines.forEach(wine => {
      if (y > 280) {
        doc.addPage();
        y = 20;
        x = 14;
        headers.forEach((header, i) => {
          doc.text(header, x, y);
          x += colWidths[i];
        });
        y += 6;
      }

      const pris = wine.indkøbspris || 0;
      const værdi = pris * (wine.antal || 0);
      totalVærdi += værdi;

      x = 14;
      const row = [
        wine.vinId || '',
        wine.navn || '',
        wine.type || '',
        wine.land || '',
        wine.antal || 0,
        wine.minAntal || 24,
        pris > 0 ? pris.toFixed(2) + ' kr.' : ''
      ];

      row.forEach((cell, i) => {
        const cellText = String(cell || '');
        const maxChars = i === 6 ? 18 : Math.floor(colWidths[i] / 2.5);
        let displayText = cellText.length > maxChars ? cellText.substring(0, maxChars - 1) + '...' : cellText;
        doc.text(displayText, x, y);
        x += colWidths[i];
      });
      y += 6;
    });

    if (y > 270) {
      doc.addPage();
      y = 280;
    } else {
      y += 10;
    }
    
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(14, y, 196, y);
    y += 8;
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    const totalText = `Total lagerværdi: ${formatDanskPris(totalVærdi)} kr.`;
    doc.text(totalText, 14, y);
    doc.setFont(undefined, 'normal');

    // Gem rapport i historik
    saveReportToHistory('OPTA-' + Date.now().toString().slice(-6), 'lager', wines.length, totalVærdi);
    
    // Download PDF
    doc.save('lagerrapport.pdf');
  } catch (error) {
    alert('Fejl ved generering af rapport: ' + error.message);
  }
}

// Vis lager rapport i browser (ikke download)
async function generateLagerReportViewOnly() {
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

  const headers = ['VIN-ID', 'Navn', 'Type', 'Land', 'Antal', 'Min', 'Pris'];
  const colWidths = [30, 60, 25, 25, 15, 15, 30];
  let x = 14;

  doc.setFontSize(8);
  headers.forEach((header, i) => {
    doc.text(header, x, y);
    x += colWidths[i];
  });
  y += 6;

  let totalVærdi = 0;

  wines.forEach(wine => {
    if (y > 280) {
      doc.addPage();
      y = 20;
      x = 14;
      headers.forEach((header, i) => {
        doc.text(header, x, y);
        x += colWidths[i];
      });
      y += 6;
    }

    const pris = wine.indkøbspris || 0;
    const værdi = pris * (wine.antal || 0);
    totalVærdi += værdi;

    x = 14;
    const row = [
      wine.vinId || '',
      wine.navn || '',
      wine.type || '',
      wine.land || '',
      wine.antal || 0,
      wine.minAntal || 24,
      pris > 0 ? pris.toFixed(2) + ' kr.' : ''
    ];

    row.forEach((cell, i) => {
      const cellText = String(cell || '');
      const maxChars = i === 6 ? 18 : Math.floor(colWidths[i] / 2.5);
      let displayText = cellText.length > maxChars ? cellText.substring(0, maxChars - 1) + '...' : cellText;
      doc.text(displayText, x, y);
      x += colWidths[i];
    });
    y += 6;
  });

  if (y > 270) {
    doc.addPage();
    y = 280;
  } else {
    y += 10;
  }
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);
  y += 8;
  
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  const totalText = `Total lagerværdi: ${formatDanskPris(totalVærdi)} kr.`;
  doc.text(totalText, 14, y);
  doc.setFont(undefined, 'normal');

  // Gem rapport i historik
  saveReportToHistory('OPTA-' + Date.now().toString().slice(-6), 'lager', wines.length, totalVærdi);

  // Åbn PDF i ny fane i stedet for download
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
  
  // Ryd op efter lidt tid
  setTimeout(() => URL.revokeObjectURL(url), 100);
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

    // Gem rapport i historik
    const totalValueStr = report.total.formateret || '0';
    const totalValueNum = parseFloat(totalValueStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    saveReportToHistory('VÆRDI-' + Date.now().toString().slice(-6), 'værdi', report.vine.length, totalValueNum);
    
    // Download PDF
    doc.save('værdirapport.pdf');
  } catch (error) {
    alert('Fejl ved generering af rapport: ' + error.message);
  }
}

// Vis værdi rapport i browser (ikke download)
async function generateVærdiReportViewOnly() {
  try {
    const report = await apiCall('/api/reports/værdi');
    generateVærdiReportPDF(report, false); // Vis i browser
  } catch (error) {
    alert('Fejl ved generering af rapport: ' + error.message);
  }
}

// Download værdi rapport
async function generateVærdiReportDownload() {
  try {
    const report = await apiCall('/api/reports/værdi');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const totalValueStr = report.total.formateret || '0';
    const totalValueNum = parseFloat(totalValueStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    saveReportToHistory('VÆRDI-' + Date.now().toString().slice(-6), 'værdi', report.vine.length, totalValueNum);

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

    doc.setFontSize(8);
    headers.forEach((header, i) => {
      doc.text(header, x, y);
      x += colWidths[i];
    });
    y += 6;

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

// Helper function for værdi rapport PDF generation (for viewing)
async function generateVærdiReportPDF(report, download = false) {
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

  doc.setFontSize(8);
  headers.forEach((header, i) => {
    doc.text(header, x, y);
    x += colWidths[i];
  });
  y += 6;

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

  // Gem rapport i historik
  const totalValueStr = report.total.formateret || '0';
  const totalValueNum = parseFloat(totalValueStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  saveReportToHistory('VÆRDI-' + Date.now().toString().slice(-6), 'værdi', report.vine.length, totalValueNum);

  if (download) {
    doc.save('værdirapport.pdf');
  } else {
    // Åbn PDF i ny fane i stedet for download
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

// Gør funktioner globale så de kan bruges i onclick handlers i HTML
// Dette skal være sidst i filen, efter alle funktioner er defineret
if (typeof window !== 'undefined') {
  window.uploadWineImage = uploadWineImage;
  window.deleteWineImage = deleteWineImage;
  window.showImageModal = showImageModal;
  window.showVineOversigt = showVineOversigt;
  window.closeVineModal = closeVineModal;
  window.generateLavStatusRapport = generateLavStatusRapport;
  window.generateLagerReportViewOnly = generateLagerReportViewOnly;
  window.generateLagerReportDownload = generateLagerReportDownload;
  window.generateVærdiReportViewOnly = generateVærdiReportViewOnly;
  window.updatePris = updatePris;
  window.updateMinAntalAndStatus = updateMinAntalAndStatus;
  window.scanQR = scanQR;
// ============================================
// ADMIN PANEL FUNKTIONER
// ============================================

// Load admin panel data
function loadAdminPanel() {
  if (!auth || !auth.isAdmin()) {
    return;
  }
  
  // Opdater system info
  const apiUrlEl = document.getElementById('admin-api-url');
  if (apiUrlEl && typeof CONFIG !== 'undefined') {
    apiUrlEl.textContent = getConfig().API_URL || 'Ikke sat';
  }
  
  const currentUserEl = document.getElementById('admin-current-user');
  if (currentUserEl && auth.getCurrentUser()) {
    currentUserEl.textContent = auth.getCurrentUser().username;
  }
  
  const totalUsersEl = document.getElementById('admin-total-users');
  if (totalUsersEl) {
    const users = auth.getAllUsers();
    totalUsersEl.textContent = users.length;
  }
  
  const totalLogsEl = document.getElementById('admin-total-logs');
  if (totalLogsEl) {
    const logs = auth.getActivityLogs();
    totalLogsEl.textContent = logs.length;
  }
  
  // Load users og logs
  renderUsers();
  renderActivityLogs();
}

// Switch admin tab
function switchAdminTab(tabName) {
  // Skjul alle tabs
  document.querySelectorAll('.admin-tab-content').forEach(tab => {
    tab.style.display = 'none';
  });
  
  // Fjern active fra alle knapper
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Vis valgt tab
  const tabContent = document.getElementById(`admin-tab-${tabName}`);
  const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
  
  if (tabContent) {
    tabContent.style.display = 'block';
  }
  if (tabBtn) {
    tabBtn.classList.add('active');
  }
  
  // Load data når tab skifter
  if (tabName === 'users') {
    renderUsers();
  } else if (tabName === 'logs') {
    renderActivityLogs();
  }
}

// Render users table
function renderUsers() {
  if (!auth || !auth.isAdmin()) return;
  
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  
  const users = auth.getAllUsers();
  tbody.innerHTML = '';
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding: 1rem; text-align: center; color: #999;">Ingen brugere fundet</td></tr>';
    return;
  }
  
  const currentUser = auth.getCurrentUser();
  
  users.forEach(user => {
    const row = document.createElement('tr');
    const isCurrentUser = currentUser && user.username === currentUser.username;
    const roleDisplay = auth.getRoleDisplayName ? auth.getRoleDisplayName(user.role) : user.role;
    const createdDate = user.created ? new Date(user.created).toLocaleDateString('da-DK') : 'Ukendt';
    
    row.innerHTML = `
      <td style="padding: 0.75rem;">${user.username} ${isCurrentUser ? '<span style="color: #2563eb;">(Dig)</span>' : ''}</td>
      <td style="padding: 0.75rem;">${user.email || '-'}</td>
      <td style="padding: 0.75rem;"><span style="background: #e3f2fd; padding: 2px 8px; border-radius: 3px; font-size: 0.9em;">${roleDisplay}</span></td>
      <td style="padding: 0.75rem;">${createdDate}</td>
      <td style="padding: 0.75rem;">
        ${!isCurrentUser ? `
          <button class="btn-secondary" onclick="editUser('${user.username}')" style="padding: 0.25rem 0.5rem; font-size: 0.9em; margin-right: 0.25rem;">Rediger</button>
          <button class="btn-secondary" onclick="deleteUserConfirm('${user.username}')" style="padding: 0.25rem 0.5rem; font-size: 0.9em; background: #dc2626; color: white;">Slet</button>
        ` : '<span style="color: #999;">-</span>'}
      </td>
    `;
    tbody.appendChild(row);
  });
  
  // Opdater user filter i log tab
  updateLogUserFilter();
}

// Handle create user
function handleCreateUser(event) {
  event.preventDefault();
  
  if (!auth || !auth.isAdmin()) {
    showError('Kun admin kan oprette brugere');
    return;
  }
  
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value;
  const email = document.getElementById('new-email').value.trim();
  const role = document.getElementById('new-role').value;
  
  const messageEl = document.getElementById('create-user-message');
  
  if (!username || !password || !email) {
    messageEl.innerHTML = '<div class="error-message">Alle felter skal udfyldes</div>';
    return;
  }
  
  const result = auth.createUser(username, password, email, role);
  
  if (result.success) {
    messageEl.innerHTML = '<div class="success-message">Bruger oprettet succesfuldt!</div>';
    document.getElementById('create-user-form').reset();
    renderUsers();
    setTimeout(() => {
      messageEl.innerHTML = '';
    }, 3000);
  } else {
    messageEl.innerHTML = `<div class="error-message">${result.error}</div>`;
  }
}

// Edit user
function editUser(username) {
  const users = auth.getAllUsers();
  const user = users.find(u => u.username === username);
  
  if (!user) {
    showError('Bruger ikke fundet');
    return;
  }
  
  const newEmail = prompt('Ny email:', user.email || '');
  if (newEmail === null) return;
  
  const newRole = prompt('Ny rolle (user/overtjener/direktør/admin):', user.role || 'user');
  if (newRole === null) return;
  
  const result = auth.updateUser(username, { email: newEmail, role: newRole });
  
  if (result.success) {
    showSuccess('Bruger opdateret!');
    renderUsers();
  } else {
    showError(result.error);
  }
}

// Delete user confirm
function deleteUserConfirm(username) {
  if (!confirm(`Er du sikker på, at du vil slette brugeren "${username}"?`)) {
    return;
  }
  
  const result = auth.deleteUser(username);
  
  if (result.success) {
    showSuccess('Bruger slettet!');
    renderUsers();
  } else {
    showError(result.error);
  }
}

// Render activity logs
function renderActivityLogs() {
  if (!auth || !auth.isAdmin()) return;
  
  const tbody = document.getElementById('logs-tbody');
  if (!tbody) return;
  
  const usernameFilter = document.getElementById('log-filter-user')?.value || '';
  const actionFilter = document.getElementById('log-filter-action')?.value || '';
  const fromDate = document.getElementById('log-filter-from')?.value || '';
  const toDate = document.getElementById('log-filter-to')?.value || '';
  
  const filter = {};
  if (usernameFilter) filter.username = usernameFilter;
  if (actionFilter) filter.action = actionFilter;
  if (fromDate) filter.fromDate = fromDate;
  if (toDate) filter.toDate = toDate;
  
  const logs = auth.getActivityLogs(filter);
  tbody.innerHTML = '';
  
  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="padding: 1rem; text-align: center; color: #999;">Ingen logs fundet</td></tr>';
    return;
  }
  
  logs.forEach(log => {
    const row = document.createElement('tr');
    const actionDisplay = {
      'login': '🔐 Login',
      'logout': '🚪 Logout',
      'stock_count': '📊 Optælling',
      'user_created': '➕ Bruger oprettet',
      'user_updated': '✏️ Bruger opdateret',
      'user_deleted': '🗑️ Bruger slettet',
      'password_reset': '🔑 Password reset',
      'password_reset_requested': '📧 Password reset anmodet',
      'password_changed': '🔐 Password ændret'
    }[log.action] || log.action;
    
    row.innerHTML = `
      <td style="padding: 0.75rem;">${log.date || log.timestamp}</td>
      <td style="padding: 0.75rem;">${log.username || 'Ukendt'}</td>
      <td style="padding: 0.75rem;">${actionDisplay}</td>
      <td style="padding: 0.75rem; color: #666;">${log.details || '-'}</td>
    `;
    tbody.appendChild(row);
  });
  
  // Opdater user filter
  updateLogUserFilter();
}

// Update log user filter
function updateLogUserFilter() {
  const userSelect = document.getElementById('log-filter-user');
  if (!userSelect) return;
  
  const users = auth.getAllUsers();
  const currentValue = userSelect.value;
  
  userSelect.innerHTML = '<option value="">Alle brugere</option>';
  users.forEach(user => {
    const option = document.createElement('option');
    option.value = user.username;
    option.textContent = `${user.username} (${auth.getRoleDisplayName ? auth.getRoleDisplayName(user.role) : user.role})`;
    userSelect.appendChild(option);
  });
  
  if (users.find(u => u.username === currentValue)) {
    userSelect.value = currentValue;
  }
}

// Clear log filters
function clearLogFilters() {
  document.getElementById('log-filter-user').value = '';
  document.getElementById('log-filter-action').value = '';
  document.getElementById('log-filter-from').value = '';
  document.getElementById('log-filter-to').value = '';
  renderActivityLogs();
}

// Handle password reset
function handlePasswordReset(event) {
  event.preventDefault();
  
  if (!auth || !auth.isAdmin()) {
    showError('Kun admin kan nulstille passwords');
    return;
  }
  
  const identifier = document.getElementById('reset-identifier').value.trim();
  const newPassword = document.getElementById('reset-new-password').value;
  
  const messageEl = document.getElementById('password-reset-message');
  
  if (!identifier || !newPassword) {
    messageEl.innerHTML = '<div class="error-message">Alle felter skal udfyldes</div>';
    return;
  }
  
  if (newPassword.length < 6) {
    messageEl.innerHTML = '<div class="error-message">Password skal være mindst 6 tegn</div>';
    return;
  }
  
  const result = auth.resetPassword(identifier, newPassword);
  
  if (result.success) {
    messageEl.innerHTML = `<div class="success-message">Password nulstillet for bruger: ${result.user.username}</div>`;
    document.getElementById('password-reset-form').reset();
    renderUsers();
    setTimeout(() => {
      messageEl.innerHTML = '';
    }, 3000);
  } else {
    messageEl.innerHTML = `<div class="error-message">${result.error}</div>`;
  }
}

// Export logs
function exportLogs() {
  if (!auth || !auth.isAdmin()) return;
  
  const logs = auth.getActivityLogs();
  const csv = [
    ['Dato/Tid', 'Bruger', 'Handling', 'Detaljer'],
    ...logs.map(log => [
      log.date || log.timestamp,
      log.username || '',
      log.action || '',
      log.details || ''
    ])
  ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `activity_log_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Afslut optælling og generer rapport automatisk
async function finishCounting() {
  if (!confirm('Er du sikker på at du vil afslutte optællingen? En rapport vil blive genereret.')) {
    return;
  }
  
  try {
    // Generer lagerrapport automatisk
    const wines = await apiCall('/api/reports/lager');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let y = 20;
    doc.setFontSize(16);
    doc.text('Lagerrapport - Optælling Afsluttet', 14, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.text('Genereret: ' + new Date().toLocaleString('da-DK'), 14, y);
    y += 10;
    
    const headers = ['VIN-ID', 'Navn', 'Type', 'Land', 'Antal', 'Min', 'Pris'];
    const colWidths = [30, 60, 25, 25, 15, 15, 30];
    let x = 14;
    
    doc.setFontSize(8);
    headers.forEach((header, i) => {
      doc.text(header, x, y);
      x += colWidths[i];
    });
    y += 6;
    
    let totalVærdi = 0;
    
    wines.forEach(wine => {
      if (y > 280) {
        doc.addPage();
        y = 20;
        x = 14;
        headers.forEach((header, i) => {
          doc.text(header, x, y);
          x += colWidths[i];
        });
        y += 6;
      }
      
      const pris = wine.indkøbspris || 0;
      const værdi = pris * (wine.antal || 0);
      totalVærdi += værdi;
      
      x = 14;
      const row = [
        wine.vinId || '',
        wine.navn || '',
        wine.type || '',
        wine.land || '',
        wine.antal || 0,
        wine.minAntal || 24,
        pris.toFixed(2)
      ];
      
      row.forEach((cell, i) => {
        doc.text(String(cell).substring(0, 25), x, y);
        x += colWidths[i];
      });
      y += 6;
    });
    
    // Total
    y += 5;
    doc.setFontSize(10);
    doc.text(`Total lagerværdi: ${formatDanskPris(totalVærdi)} kr.`, 14, y);
    
    // Gem rapport i historik
    saveReportToHistory('OPTÆLLING-' + Date.now().toString().slice(-6), 'lager', wines.length, totalVærdi);
    
    // Vis popup med mulighed for at se eller downloade
    const reportBlob = doc.output('blob');
    const reportUrl = URL.createObjectURL(reportBlob);
    
    // Vis popup
    const popup = document.createElement('div');
    popup.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 10000; max-width: 400px; text-align: center;';
    popup.innerHTML = `
      <h2 style="margin-top: 0;">✅ Optælling afsluttet!</h2>
      <p>Rapport er genereret med ${wines.length} vine.</p>
      <p><strong>Total værdi: ${formatDanskPris(totalVærdi)} kr.</strong></p>
      <div style="margin-top: 20px;">
        <button onclick="window.open('${reportUrl}', '_blank')" class="btn-primary" style="margin: 5px; padding: 10px 20px;">👁️ Vis rapport</button>
        <button onclick="doc.save('lagerrapport_optælling.pdf'); this.parentElement.parentElement.remove();" class="btn-secondary" style="margin: 5px; padding: 10px 20px;">📥 Download</button>
        <button onclick="this.parentElement.parentElement.remove(); URL.revokeObjectURL('${reportUrl}');" class="btn-secondary" style="margin: 5px; padding: 10px 20px;">Luk</button>
      </div>
    `;
    document.body.appendChild(popup);
    
    // Gem doc globalt så download knappen kan bruge den
    window.finishCountingDoc = doc;
    
  } catch (error) {
    alert('Fejl ved generering af rapport: ' + error.message);
  }
}

  window.handleLogin = handleLogin;
  window.handleLogout = handleLogout;
  window.showPasswordReset = showPasswordReset;
  window.checkLoginStatus = checkLoginStatus;
  window.startQRScanner = startQRScanner;
  window.updateCount = updateCount;
  window.saveCount = saveCount;
  window.finishCounting = finishCounting;
  window.importFile = doImport;
  window.generateLabels = generateLabels;
  window.printLabels = printLabels;
  window.generateLagerReport = generateLagerReport;
  window.generateVærdiReport = generateVærdiReport;
  window.applyFilter = applyFilter;
  window.clearFilter = clearFilter;
  window.showPage = showPage;
  window.generateScannerQR = generateScannerQR;
  window.showScannerQRModal = showScannerQRModal;
  window.closeScannerQRModal = closeScannerQRModal;
  window.copyScannerLink = copyScannerLink;
  
  // Sørg for at QR-funktioner er tilgængelige umiddelbart (også før login)
  if (typeof window !== 'undefined') {
    window.showScannerQRModal = showScannerQRModal;
    window.closeScannerQRModal = closeScannerQRModal;
    window.generateScannerQR = generateScannerQR;
  }
  window.showReportsPage = showReportsPage;
  window.checkForNewReport = checkForNewReport;
  window.finishCounting = finishCounting;
  window.viewReportPDF = viewReportPDF;
  window.downloadReport = downloadReport;
  window.archiveReport = archiveReport;
  window.unarchiveReport = unarchiveReport;
  window.generateVærdiReportDownload = generateVærdiReportDownload;
  window.switchAdminTab = switchAdminTab;
  window.handleCreateUser = handleCreateUser;
  window.editUser = editUser;
  window.deleteUserConfirm = deleteUserConfirm;
  window.clearLogFilters = clearLogFilters;
  window.handlePasswordReset = handlePasswordReset;
  window.exportLogs = exportLogs;
  
  console.log('========================================');
  console.log('=== APP.JS v24 FULLY LOADED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Globale funktioner sat:', {
    uploadWineImage: typeof uploadWineImage,
    deleteWineImage: typeof deleteWineImage,
    showImageModal: typeof showImageModal,
    showVineOversigt: typeof showVineOversigt,
    closeVineModal: typeof closeVineModal
  });
  console.log('✅ Billede upload: Korrekt implementeret');
  console.log('✅ Rapport: Simplificeret - kun VIN-ID, Navn, Type, Land, Antal, Min, Pris');
  console.log('✅ Labels: Sticky header fixet');
  console.log('✅ Dashboard: Klikbare statistikker med popup');
  console.log('✅ Autocomplete: Implementeret til søgning');
  console.log('✅ Filtrering: Rettet til kalendermåned');
  console.log('========================================');
} else {
  console.error('❌ ERROR: window is undefined!');
}

// Vis QR-kode modal
function showScannerQRModal() {
  const modal = document.getElementById('scanner-qr-modal');
  if (modal) {
    modal.style.display = 'flex';
    generateScannerQR();
  }
}

// Luk QR-kode modal
function closeScannerQRModal() {
  const modal = document.getElementById('scanner-qr-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Generer QR-kode til scanner link
function generateScannerQR() {
  const qrContainer = document.getElementById('scanner-qr-code');
  const linkText = document.getElementById('scanner-link-text');
  
  if (!qrContainer || !linkText) return;
  
  // Få den fulde URL til scanner-siden
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
  const scannerUrl = baseUrl + 'scanner.html';
  
  // Vis link
  linkText.textContent = scannerUrl;
  
  // Generer QR-kode hvis QRCode biblioteket er tilgængelig
  if (typeof QRCode !== 'undefined') {
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: scannerUrl,
      width: 200,
      height: 200,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    // Fallback hvis QRCode ikke er indlæst
    qrContainer.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <p>QR-kode bibliotek indlæser...</p>
        <p style="font-size: 0.9em; color: #666;">${scannerUrl}</p>
      </div>
    `;
    // Prøv igen efter lidt tid
    setTimeout(() => {
      if (typeof QRCode !== 'undefined') {
        generateScannerQR();
      }
    }, 1000);
  }
}

// Kopiér scanner link
function copyScannerLink() {
  const linkText = document.getElementById('scanner-link-text');
  if (!linkText) return;
  
  const scannerUrl = linkText.textContent;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(scannerUrl).then(() => {
      alert('Link kopieret til udklipsholder!');
    }).catch(() => {
      // Fallback
      copyToClipboardFallback(scannerUrl);
    });
  } else {
    copyToClipboardFallback(scannerUrl);
  }
}

function copyToClipboardFallback(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    alert('Link kopieret til udklipsholder!');
  } catch (err) {
    alert('Kunne ikke kopiere. Link: ' + text);
  }
  document.body.removeChild(textarea);
}
