// ============================================
// VINLAGER OPTÆLLING 2026 - APP.JS v98
// ============================================
console.log('========================================');
console.log('=== APP.JS SCRIPT START ===');
console.log('Version: v101 - SIMPLIFICERET: Import funktion tilbage til simpel version');
console.log('Timestamp:', new Date().toISOString());
console.log('========================================');

// Global state
let allWines = [];
let allOlVand = []; // Øl & Vand produkter
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

// KRITISK: IndexedDB backup (større kapacitet end localStorage)
// DEFINERET TIDLIGT så den kan bruges i DOMContentLoaded
let idbDB = null;
async function initIndexedDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn('⚠️ IndexedDB ikke tilgængelig - bruger kun localStorage');
      resolve(null);
      return;
    }
    const request = indexedDB.open('VinlagerBackup', 1);
    request.onerror = () => {
      console.warn('⚠️ IndexedDB ikke tilgængelig - bruger kun localStorage');
      resolve(null);
    };
    request.onsuccess = () => {
      idbDB = request.result;
      console.log('✅ IndexedDB initialiseret');
      resolve(idbDB);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('wines')) {
        db.createObjectStore('wines', { keyPath: 'backupId' });
      }
      if (!db.objectStoreNames.contains('reports')) {
        db.createObjectStore('reports', { keyPath: 'reportId' });
      }
    };
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

// Start auto-opdatering (polling hver 10 sekunder)
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;

function startAutoUpdate() {
  // Stop eksisterende interval hvis der er et
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
  }
  
  // Reset error counter
  consecutiveErrors = 0;
  
  // Start nyt interval - opdater hver 10 sekunder (mindre aggressivt for at undgå spam)
  autoUpdateInterval = setInterval(() => {
    const authObj = auth || window.auth;
    if (authObj && authObj.isLoggedIn && authObj.isLoggedIn()) {
      // KRITISK: Stop hvis for mange fejl i træk
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.warn('⚠️ For mange fejl i træk - stopper auto-opdatering');
        clearInterval(autoUpdateInterval);
        return;
      }
      
      // OPDATER ALTID LAGER DATA - så dashboard og tabel opdateres efter scanning
      if (typeof loadWines === 'function') {
        loadWines().then(() => {
          consecutiveErrors = 0; // Reset ved success
          // FORCE opdater dashboard og tabel - uanset hvad
          if (typeof updateDashboard === 'function') {
            updateDashboard();
          }
          if (typeof renderLager === 'function') {
            renderLager();
          }
        }).catch((err) => {
          consecutiveErrors++;
          // Log kun hver 3. fejl for at undgå spam
          if (consecutiveErrors % 3 === 0) {
            console.warn(`⚠️ Auto-update fejl (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err.message);
          }
          // Hvis fejl, opdater alligevel med eksisterende data
          if (typeof updateDashboard === 'function') updateDashboard();
          if (typeof renderLager === 'function') renderLager();
        });
      }
      
      // Opdater også Øl & Vand
      if (typeof loadOlVand === 'function') {
        loadOlVand().then(() => {
          if (typeof updateDashboardOlVand === 'function') {
            updateDashboardOlVand();
          }
          if (typeof renderOlVandLager === 'function') {
            renderOlVandLager();
          }
        }).catch((err) => {
          // Log kun hver 3. fejl
          if (consecutiveErrors % 3 === 0) {
            console.warn('⚠️ Auto-update Øl & Vand fejl:', err.message);
          }
          if (typeof updateDashboardOlVand === 'function') updateDashboardOlVand();
          if (typeof renderOlVandLager === 'function') renderOlVandLager();
        });
      }
      
      // Opdater rapporter hvis vi er på rapporter siden
      const currentPage = document.querySelector('.page.active')?.id;
      if (currentPage === 'rapporter' && typeof loadReportsHistory === 'function') {
        loadReportsHistory();
      }
      
      // Tjek for ny rapport fra mobil
      checkForNewReport();
    }
  }, 10000); // Opdater hver 10 sekunder (mindre spam)
  
  console.log('✅ Auto-opdatering startet (hver 10 sekunder)');
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
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, initialiserer app...');
  
  // KRITISK: Initialiser IndexedDB backup med det samme
  await initIndexedDB();
  
  // Vent lidt så alle scripts er indlæst
  setTimeout(() => {
    // Initialiser auth system først
    console.log('🔐 Initialiserer auth system...');
    const authObj = auth || window.auth;
    
    if (typeof authObj !== 'undefined' && authObj && authObj.initUsersStorage) {
      authObj.initUsersStorage();
      console.log('✅ Auth system initialiseret');
    } else {
      console.error('❌ auth.js ikke indlæst eller initUsersStorage mangler!');
      console.log('  typeof auth:', typeof auth);
      console.log('  typeof window.auth:', typeof window.auth);
      console.log('  auth:', auth);
      console.log('  window.auth:', window.auth);
      
      const errorDiv = document.getElementById('login-error');
      if (errorDiv) {
        errorDiv.textContent = 'Fejl: auth.js kunne ikke indlæses. Genindlæs siden (Ctrl+Shift+R).';
        errorDiv.style.display = 'block';
      }
      
      // Prøv at vente lidt og tjek igen
      setTimeout(() => {
        const retryAuth = auth || window.auth;
        if (typeof retryAuth !== 'undefined' && retryAuth && retryAuth.initUsersStorage) {
          retryAuth.initUsersStorage();
          console.log('✅ Auth system initialiseret (retry)');
          if (errorDiv) {
            errorDiv.style.display = 'none';
          }
        }
      }, 1000);
    }
    
    // KRITISK: Vent lidt så auth.js er helt indlæst
    setTimeout(() => {
      // Tjek login status
      checkLoginStatus();
      
      setupNavigation();
      
      // Sikr at login form handler er sat op
      const loginForm = document.getElementById('login-form');
      if (loginForm) {
        // Fjern eksisterende handlers for at undgå duplikater
        const newForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newForm, loginForm);
        
        // Tilføj ny handler
        const form = document.getElementById('login-form');
        if (form) {
          form.onsubmit = function(e) {
            e.preventDefault();
            handleLogin(e);
            return false;
          };
          console.log('✅ Login form handler sat op');
        }
      }
    }, 100);
    
    // KRITISK: Load data MED DET SAMME hvis logget ind
    console.log('🔍 Tjekker login status...');
    // Brug samme authObj som deklarerede tidligere i denne scope
    if (typeof authObj !== 'undefined' && authObj && authObj.isLoggedIn && authObj.isLoggedIn()) {
      console.log('✅ Bruger er logget ind - loader data NU...');
      // Load data med det samme
      if (typeof loadWines === 'function') {
        loadWines().catch(err => {
          console.error('❌ KRITISK FEJL i loadWines():', err);
          alert('FEJL: Kunne ikke hente data. Tjek console (F12)');
        });
      } else {
        console.error('❌ loadWines funktion mangler!');
        alert('SYSTEM FEJL: loadWines funktion mangler!');
      }
      // Start auto-opdatering
      if (typeof startAutoUpdate === 'function') {
        startAutoUpdate();
      }
      // Tjek om der er ny rapport fra mobil
      if (typeof checkForNewReport === 'function') {
        checkForNewReport();
      }
    } else {
      console.warn('⚠️ Bruger er IKKE logget ind');
    }
    
    setupFileInput();
    
    // Populér label filtre for både Vin og Øl & Vand
    populateLabelFilters();
    populateLabelFiltersOlVand();
    
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
  
  // Tjek om auth er tilgængelig (prøv både auth og window.auth)
  const authObj = auth || window.auth;
  
  if (typeof authObj === 'undefined' || !authObj) {
    console.error('❌ auth ikke defineret! Tjek at auth.js er indlæst.');
    // Vis login screen hvis auth ikke er tilgængelig
    loginScreen.style.display = 'flex';
    mainHeader.style.display = 'none';
    mainContent.style.display = 'none';
    
    // Vis fejlbesked
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
      errorDiv.textContent = 'Fejl: Authentication system ikke tilgængelig. Genindlæs siden (Ctrl+Shift+R).';
      errorDiv.style.display = 'block';
    }
    return;
  }
  
  if (authObj.isLoggedIn && authObj.isLoggedIn()) {
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
  if (event) {
    event.preventDefault();
  }
  
  console.log('🔐 handleLogin() kaldt');
  
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const errorDiv = document.getElementById('login-error');
  
  if (!usernameInput || !passwordInput) {
    console.error('❌ Login input felter ikke fundet!');
    if (errorDiv) {
      errorDiv.textContent = 'Fejl: Login formular ikke fundet. Genindlæs siden.';
      errorDiv.style.display = 'block';
    }
    return;
  }
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  
  if (!errorDiv) {
    console.error('❌ Error div ikke fundet!');
    alert('Fejl: Login fejlbesked område ikke fundet. Genindlæs siden.');
    return;
  }
  
  // Valider input først
  if (!username || !password) {
    errorDiv.textContent = 'Indtast venligst både brugernavn og password.';
    errorDiv.style.display = 'block';
    return;
  }
  
  // Tjek om auth er tilgængelig
  console.log('🔍 Tjekker auth objekt...');
  console.log('  typeof auth:', typeof auth);
  console.log('  window.auth:', typeof window.auth);
  console.log('  auth:', auth);
  
  // Prøv både auth og window.auth
  const authObj = auth || window.auth;
  
  if (typeof authObj === 'undefined' || !authObj) {
    errorDiv.textContent = 'Fejl: Authentication system ikke tilgængelig. Vent venligst et øjeblik og prøv igen.';
    errorDiv.style.display = 'block';
    console.error('❌ auth ikke defineret! Prøver igen om 1 sekund...');
    
    // Prøv igen efter 1 sekund
    setTimeout(() => {
      console.log('🔄 Prøver login igen...');
      handleLogin(null); // Prøv igen uden event
    }, 1000);
    return;
  }
  
  if (!authObj.login) {
    errorDiv.textContent = 'Fejl: Login funktion ikke tilgængelig. Genindlæs siden (Ctrl+Shift+R).';
    errorDiv.style.display = 'block';
    console.error('❌ auth.login ikke defineret!');
    console.log('  authObj keys:', Object.keys(authObj || {}));
    return;
  }
  
  console.log('✅ Auth objekt fundet, kalder login...');
  
  try {
    const result = authObj.login(username, password);
    console.log('📥 Login resultat:', result);
    
    if (result && result.success) {
      console.log('✅ Login succesfuld!');
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
        }
        if (typeof loadOlVand === 'function') {
          loadOlVand();
        }
        // Start auto-opdatering efter login
        if (typeof startAutoUpdate === 'function') {
          startAutoUpdate();
        }
      }, 100);
    } else {
      console.warn('⚠️ Login fejlede:', result?.error);
      errorDiv.textContent = result?.error || 'Login fejlede. Tjek brugernavn og password.';
      errorDiv.style.display = 'block';
      // Ryd password felt ved fejl
      passwordInput.value = '';
      // Fokusér på password felt
      passwordInput.focus();
    }
  } catch (error) {
    console.error('❌ Login exception:', error);
    errorDiv.textContent = 'Fejl ved login: ' + (error.message || 'Ukendt fejl');
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
  
  const authObj = auth || window.auth;
  if (authObj && authObj.requestPasswordReset) {
    const result = authObj.requestPasswordReset(emailOrUsername);
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

// Lokal tid som YYYY-MM-DD HH:MM:SS (Danmark) – ikke UTC
function toLocalDateTimeString(d) {
  d = d || new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// API calls – 60s timeout for Render cold start
async function apiCall(endpoint, options = {}) {
  const config = getConfig();
  if (!config || !config.API_URL) {
    console.error('❌ CONFIG er ikke defineret!');
    throw new Error('Backend konfiguration mangler');
  }
  const ms = options.timeout ?? config.TIMEOUT ?? 60000;
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), ms);
  try {
    const { signal: _s, timeout: _t, ...rest } = options;
    
    // KRITISK: Hent auth token
    let authToken = null;
    if (typeof auth !== 'undefined' && auth && auth.getToken) {
      authToken = auth.getToken();
    } else {
      // Fallback: Prøv localStorage
      authToken = localStorage.getItem('auth_token') || localStorage.getItem('jwt_token');
    }
    
    const headers = {
      'Content-Type': 'application/json',
      ...(rest.headers || {})
    };
    
    // Tilføj auth token hvis det findes
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(`${config.API_URL}${endpoint}`, {
      ...rest,
      signal: ac.signal,
      headers: headers
    });

    if (!response.ok) {
      // 404 fejl skal håndteres stille (ikke forstyrrende)
      if (response.status === 404) {
        // Returner tom array for rapporter og wines hvis de ikke findes
        if (endpoint.includes('/reports/') || endpoint.includes('/wines')) {
          console.warn(`404 for ${endpoint} - returnerer tom array`);
          return [];
        }
        // For andre endpoints, throw kun hvis det er kritisk
        console.warn(`404 for ${endpoint}`);
        return null;
      }
      
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
        // Hvis det er HTML, læs ikke (forstyrrer ikke)
        errorMessage = `Server fejl (${response.status}): ${response.statusText}`;
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
    if (error.name === 'AbortError') {
      throw new Error('Backend svarer ikke (timeout). Render cold start? Prøv igen om 1 minut.');
    }
    console.error('API fejl:', error);
    console.error('Endpoint:', endpoint);
    throw error;
  } finally {
    clearTimeout(tid);
  }
}

// Load wines
// Hent optalte vine i dag (for markering)
let countedWinesToday = new Set();

async function loadCountedWinesToday() {
  try {
    // Hent alle counts fra i dag - prøv at hente fra alle rapporter i dag
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    // Hvis der ikke er en dedikeret endpoint, brug rapporter fra i dag
    const reports = await apiCall('/api/reports/history');
    if (reports && Array.isArray(reports)) {
      const todayReports = reports.filter(r => {
        const reportDate = r.date || r.created;
        return reportDate && reportDate.startsWith(today);
      });
      // Hent alle vinId'er fra rapporter i dag (hvis de har det)
      // For nu, marker alle vine der er blevet opdateret i dag
      console.log('📊 Rapporter i dag:', todayReports.length);
    }
    // Alternativ: Marker vine der er blevet opdateret i dag baseret på allWines
    // Dette er en workaround indtil vi har en bedre endpoint
  } catch (error) {
    console.warn('Kunne ikke hente optalte vine:', error);
  }
}

const WINES_BACKUP_KEY = 'vinlager_wines_backup';
const WINES_BACKUP_KEY_INDEXEDDB = 'vinlager_wines_backup_idb';

// Gem lager backup - MULTIPLE BACKUP STRATEGY
async function saveWinesBackup(wines) {
  if (!wines || !Array.isArray(wines) || wines.length === 0) {
    return;
  }
  
  const backupData = {
    wines: wines,
    timestamp: new Date().toISOString(),
    count: wines.length
  };
  
  // BACKUP 1: localStorage (hurtig, begrænset størrelse)
  try {
    localStorage.setItem(WINES_BACKUP_KEY, JSON.stringify(wines));
    localStorage.setItem(WINES_BACKUP_KEY + '_date', new Date().toISOString());
    console.log('💾 Backup 1 (localStorage):', wines.length, 'vine');
  } catch (e) {
    console.warn('⚠️ localStorage backup fejlede:', e);
  }
  
  // BACKUP 2: IndexedDB (større kapacitet)
  try {
    if (!idbDB) {
      await initIndexedDB();
    }
    if (idbDB) {
      const transaction = idbDB.transaction(['wines'], 'readwrite');
      const store = transaction.objectStore('wines');
      await new Promise((resolve, reject) => {
        const request = store.put({
          backupId: 'latest',
          ...backupData
        });
        request.onsuccess = () => {
          console.log('💾 Backup 2 (IndexedDB):', wines.length, 'vine');
          resolve();
        };
        request.onerror = () => {
          console.warn('⚠️ IndexedDB backup fejlede');
          resolve(); // Fortsæt alligevel
        };
      });
    }
  } catch (e) {
    console.warn('⚠️ IndexedDB backup fejlede:', e);
  }
  
  // BACKUP 3: SessionStorage (ekstra sikkerhed)
  try {
    sessionStorage.setItem(WINES_BACKUP_KEY, JSON.stringify(wines));
    sessionStorage.setItem(WINES_BACKUP_KEY + '_date', new Date().toISOString());
    console.log('💾 Backup 3 (sessionStorage):', wines.length, 'vine');
  } catch (e) {
    console.warn('⚠️ sessionStorage backup fejlede:', e);
  }
}

// Gendan lager fra backup - MULTIPLE RESTORE STRATEGY
async function restoreWinesFromBackup() {
  let wines = null;
  let source = '';
  
  // RESTORE 1: Prøv localStorage først (hurtigst)
  try {
    const saved = localStorage.getItem(WINES_BACKUP_KEY);
    if (saved) {
      wines = JSON.parse(saved);
      if (Array.isArray(wines) && wines.length > 0) {
        source = 'localStorage';
        console.log(`✅ Backup fundet i ${source}:`, wines.length, 'vine');
      }
    }
  } catch (e) {
    console.warn('⚠️ localStorage restore fejlede:', e);
  }
  
  // RESTORE 2: Prøv IndexedDB hvis localStorage ikke havde data
  if (!wines || wines.length === 0) {
    try {
      if (!idbDB) {
        await initIndexedDB();
      }
      if (idbDB) {
        const transaction = idbDB.transaction(['wines'], 'readonly');
        const store = transaction.objectStore('wines');
        const request = store.get('latest');
        await new Promise((resolve) => {
          request.onsuccess = () => {
            if (request.result && request.result.wines && Array.isArray(request.result.wines) && request.result.wines.length > 0) {
              wines = request.result.wines;
              source = 'IndexedDB';
              console.log(`✅ Backup fundet i ${source}:`, wines.length, 'vine');
            }
            resolve();
          };
          request.onerror = () => {
            console.warn('⚠️ IndexedDB restore fejlede');
            resolve();
          };
        });
      }
    } catch (e) {
      console.warn('⚠️ IndexedDB restore fejlede:', e);
    }
  }
  
  // RESTORE 3: Prøv sessionStorage hvis stadig ingen data
  if (!wines || wines.length === 0) {
    try {
      const saved = sessionStorage.getItem(WINES_BACKUP_KEY);
      if (saved) {
        wines = JSON.parse(saved);
        if (Array.isArray(wines) && wines.length > 0) {
          source = 'sessionStorage';
          console.log(`✅ Backup fundet i ${source}:`, wines.length, 'vine');
        }
      }
    } catch (e) {
      console.warn('⚠️ sessionStorage restore fejlede:', e);
    }
  }
  
  // Hvis vi fandt data, opdater allWines og vis status
  if (wines && Array.isArray(wines) && wines.length > 0) {
    allWines = wines;
    updateDashboard();
    populateFilters();
    renderLager();
    if (document.getElementById('scan-input')) setupScanInput();
    showBackupStatus();
    console.log(`✅ Lager gendannet fra ${source}:`, wines.length, 'vine');
    
    // KRITISK: Automatisk upload til backend hvis backend er tom
    try {
      const backendWines = await apiCall('/api/wines');
      if (!backendWines || !Array.isArray(backendWines) || backendWines.length === 0) {
        console.log('🔄 Backend er tom - uploader gendannet data automatisk...');
        await autoRestoreToBackend(wines);
      }
    } catch (e) {
      console.warn('⚠️ Kunne ikke tjekke/upload til backend:', e);
    }
    
    return wines.length;
  }
  
  return 0;
}

// Automatisk upload gendannet data til backend
async function autoRestoreToBackend(wines) {
  if (!wines || !Array.isArray(wines) || wines.length === 0) {
    return;
  }
  
  console.log(`🔄 Uploader ${wines.length} vine til backend...`);
  let successCount = 0;
  let errorCount = 0;
  
  for (const wine of wines) {
    try {
      // Prøv at oprette vin i backend
      await apiCall('/api/wines', {
        method: 'POST',
        body: JSON.stringify(wine)
      });
      successCount++;
    } catch (e) {
      // Hvis vin allerede findes, prøv at opdatere
      try {
        await apiCall(`/api/wines/${wine.vinId}`, {
          method: 'PUT',
          body: JSON.stringify(wine)
        });
        successCount++;
      } catch (e2) {
        errorCount++;
        console.warn(`⚠️ Kunne ikke upload vin ${wine.vinId}:`, e2.message);
      }
    }
  }
  
  console.log(`✅ Auto-restore færdig: ${successCount} uploadet, ${errorCount} fejl`);
  
  if (successCount > 0) {
    showSuccess(`✅ ${successCount} vine automatisk gendannet til backend!`);
    // Genhent data fra backend for at sikre synkronisering
    setTimeout(() => {
      if (typeof loadWines === 'function') {
        loadWines();
      }
    }, 1000);
  }
}

async function gendanLagerFraBackup() {
  const n = await restoreWinesFromBackup();
  const msg = document.getElementById('backup-actions-msg');
  if (msg) {
    if (n > 0) {
      msg.textContent = `✅ ${n} vine gendannet fra backup. Importér via Import-siden for at gemme til backend.`;
      msg.style.color = '#060';
    } else {
      msg.textContent = 'Ingen lager-backup fundet. Importér først via Import.';
      msg.style.color = '#c00';
    }
    setTimeout(() => { msg.textContent = ''; }, 8000);
  }
  if (n > 0) showSuccess(`${n} vine gendannet fra backup.`);
  else showError('Ingen lager-backup fundet.');
}

function hentRapporterFraBackup() {
  const saved = localStorage.getItem('reportsHistory');
  if (!saved) {
    showError('Ingen rapporter i backup. Gem en rapport først.');
    const msg = document.getElementById('backup-actions-msg');
    if (msg) {
      msg.textContent = 'Ingen rapporter i backup.';
      msg.style.color = '#c00';
      setTimeout(() => { msg.textContent = ''; }, 5000);
    }
    return;
  }
  try {
    reportsHistory = JSON.parse(saved);
    updateLocationFilter();
    renderReportsTable();
    showBackupStatus();
    showSuccess(`${reportsHistory.length} rapporter hentet fra backup.`);
    const msg = document.getElementById('backup-actions-msg');
    if (msg) {
      msg.textContent = `✅ ${reportsHistory.length} rapporter hentet fra backup.`;
      msg.style.color = '#060';
      setTimeout(() => { msg.textContent = ''; }, 6000);
    }
  } catch (e) {
    showError('Kunne ikke læse backup.');
    console.error(e);
  }
}

function downloadLagerBackupCSV() {
  let wines = [];
  try {
    const saved = localStorage.getItem(WINES_BACKUP_KEY);
    if (saved) wines = JSON.parse(saved) || [];
  } catch (e) {}
  if (!wines.length) {
    wines = allWines;
  }
  if (!wines.length) {
    showError('Ingen lager at downloade. Importér først eller gendan fra backup.');
    return;
  }
  const headers = ['VIN-ID','Varenummer','Navn','Type','Land','Region','Årgang','Lokation','Reol','Hylde','Antal','Min. Antal','Indkøbspris'];
  const rows = wines.map(w => [
    w.vinId || '', w.varenummer || '', w.navn || '', w.type || '', w.land || '', w.region || '', w.årgang || '',
    w.lokation || '', w.reol || '', w.hylde || '', w.antal ?? '', w.minAntal ?? 24, w.indkøbspris ?? ''
  ]);
  const csv = [headers.join(';'), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))].join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vinlager_backup_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showSuccess('Lager backup downloadet som CSV. Gem filen og importér via Import for at gendanne.');
  const msg = document.getElementById('backup-actions-msg');
  if (msg) {
    msg.textContent = '✅ CSV downloadet. Brug Import for at gendanne til backend.';
    msg.style.color = '#060';
    setTimeout(() => { msg.textContent = ''; }, 6000);
  }
}

async function loadWines() {
  try {
    console.log('🔄 Henter VIN fra backend...');
    
    // KRITISK: Prøv at hente data selv uden token (backend kan være åben)
    const token = localStorage.getItem('auth_token') || localStorage.getItem('jwt_token');
    if (!token) {
      console.warn('⚠️ Ingen auth token - prøver alligevel at hente data');
    }
    
    const allProducts = await apiCall('/api/wines');
    console.log('📦 Modtaget fra backend:', allProducts ? allProducts.length : 0, 'produkter');
    
    // KRITISK FIX: Filtrer kun VIN ud (ikke øl & vand)
    // VIN er ALT der IKKE er øl, vand, sodavand, fadøl, flaske- eller dåseøl
    const wines = (allProducts || []).filter(p => {
      const kategori = (p.kategori || p.type || '').toLowerCase();
      const navn = (p.navn || '').toLowerCase();
      const vinId = (p.vinId || '').toLowerCase();
      
      // Hvis det starter med "OL-" eller "W" og er et nummer, er det øl & vand
      if (vinId.startsWith('ol-') || /^w\d{4,}$/.test(vinId)) {
        return false;
      }
      
      // Filtrer øl & vand produkter ud
      const isOlVand = kategori.includes('øl') || kategori.includes('vand') || kategori.includes('sodavand') ||
                      kategori.includes('fadøl') || kategori.includes('flaske') || kategori.includes('dåse') ||
                      navn.includes('øl') || navn.includes('vand') || navn.includes('cola') || navn.includes('tonic') ||
                      navn.includes('ginger') || navn.includes('lemon') || navn.includes('appelsin') ||
                      kategori === 'ol' || kategori === 'vand' || kategori === 'sodavand';
      
      return !isOlVand; // Returner kun VIN (ikke øl & vand)
    });
    
    console.log(`✅ Filtreret til ${wines.length} VIN (fra ${allProducts ? allProducts.length : 0} produkter)`);
    
    // Hent optalte vine i dag (ikke blokerende)
    loadCountedWinesToday().catch(() => {});
    
    // KRITISK FIX: Opdater allWines hvis vi fik data fra backend
    // MEN: Hvis backend returnerer tom array, BEHOLD kun eksisterende data hvis vi har noget
    if (wines && Array.isArray(wines) && wines.length > 0) {
      // Vi fik data - OPDATER ALTID (dette sikrer at opdateringer fra mobil vises!)
      // KRITISK: Konverter antal til tal for at sikre korrekt sammenligning
      wines.forEach(w => {
        w.antal = parseInt(w.antal) || 0;
        w.minAntal = parseInt(w.minAntal) || 24;
      });
      allWines = wines;
      console.log(`✅ Hentet ${wines.length} vine fra backend`);
      console.log(`✅ allWines opdateret til ${allWines.length} vine`);
      
      // KRITISK: Gem backup MED DET SAMME
      await saveWinesBackup(wines);
      console.log('✅ Backup gemt (multi-layer)');
      
      // KRITISK: Opdater tabel og dashboard MED DET SAMME
      if (typeof renderLager === 'function') {
        renderLager();
        console.log('✅ Tabel opdateret');
      }
      if (typeof updateDashboard === 'function') {
        updateDashboard();
        console.log('✅ Dashboard opdateret');
      }
    } else if (wines === null || (Array.isArray(wines) && wines.length === 0)) {
      // Backend returnerer null eller tom array
      // BEHOLD kun eksisterende data hvis vi har noget OG det er første gang vi loader
      // Hvis vi allerede har data, kan det være at backend lige er tom efter deploy
      if (allWines && allWines.length > 0) {
        // Vi har eksisterende data - BEHOLD det kun hvis backend er tom
        console.log(`⚠️ Backend tom/null, men beholder ${allWines.length} eksisterende vine.`);
        await saveWinesBackup(allWines); // Sikr backup er opdateret
      } else {
        // Ingen data - prøv backup
        const n = await restoreWinesFromBackup();
        if (n > 0) {
          console.log(`✅ Lager tomt på backend. Gendannet ${n} vine fra backup.`);
        } else {
          console.log('⚠️ Ingen vine i backend og ingen backup.');
        }
      }
    } else {
      // API fejl eller ugyldig data - BEHOLD eksisterende data
      console.warn('⚠️ API returnerede ikke gyldig data. Beholder eksisterende lager.');
      if (allWines && allWines.length > 0) {
        saveWinesBackup(allWines);
        console.log(`✅ Beholder ${allWines.length} eksisterende vine.`);
      } else {
        const n = await restoreWinesFromBackup();
        if (n > 0) {
          console.log(`✅ Gendannet ${n} vine fra backup.`);
        }
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
          await saveWinesBackup(updatedWines);
        }
      } catch (err) {
        console.error('Fejl ved genhentning efter opdatering:', err);
      }
    }
    
    // KRITISK: Opdater dashboard og tabel EFTER data er indlæst
    // Dette sikrer at opdateringer fra mobil vises korrekt
    if (typeof updateDashboard === 'function') {
      updateDashboard();
      console.log('✅ Dashboard opdateret i loadWines()');
    }
    if (typeof populateFilters === 'function') {
      populateFilters();
    }
    if (typeof renderLager === 'function') {
      renderLager();
      console.log('✅ Tabel opdateret i loadWines()');
    }
    
    // Setup scan input autocomplete efter vine er indlæst
    if (document.getElementById('scan-input')) {
      setupScanInput();
    }
  } catch (error) {
    console.error('❌ Fejl ved indlæsning af vine:', error.message);
    // KRITISK: Ved fejl, BEHOLD altid eksisterende data
    if (allWines && allWines.length > 0) {
      // BEHOLD eksisterende data - ikke overskriv med tom array!
      console.warn(`⚠️ API fejl, men beholder ${allWines.length} eksisterende vine.`);
      await saveWinesBackup(allWines);
    } else {
      // Kun hvis vi ikke har noget, prøv backup
      const n = await restoreWinesFromBackup();
      if (n > 0) {
        console.log(`✅ Gendannet ${n} vine fra backup efter fejl.`);
      } else {
        console.warn('⚠️ Ingen vine og ingen backup efter fejl.');
      }
    }
    // OPDATER ALLIGEVEL dashboard og tabel med eksisterende data
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof populateFilters === 'function') populateFilters();
    if (typeof renderLager === 'function') renderLager();
  }
}

// Dashboard
function updateDashboard() {
  // KRITISK FIX: OVERSKRIV ALDRIG allWines med tom array hvis den allerede har data!
  // Kun initialiser hvis den virkelig ikke eksisterer
  if (typeof allWines === 'undefined') {
    // Prøv at hente fra backup først
    const saved = localStorage.getItem('winesBackup');
    if (saved) {
      try {
        allWines = JSON.parse(saved);
        console.log(`✅ Gendannet ${allWines.length} vine fra backup i updateDashboard`);
      } catch (e) {
        allWines = [];
      }
    } else {
      allWines = [];
    }
  }
  if (!Array.isArray(allWines)) {
    // Hvis den ikke er array, prøv at gendanne fra backup
    const saved = localStorage.getItem('winesBackup');
    if (saved) {
      try {
        allWines = JSON.parse(saved);
        console.log(`✅ Gendannet ${allWines.length} vine fra backup (ikke array)`);
      } catch (e) {
        allWines = [];
      }
    } else {
      allWines = [];
    }
  }
  // Hvis allWines allerede er en array (tom eller med data), BEHOLD den!
  
  const antVine = allWines.length;
  // Beregn lavt lager korrekt - tjek både antal og minAntal
  const lavtLager = allWines.filter(w => {
    const antal = w.antal || 0;
    const minAntal = w.minAntal || 24;
    return antal < minAntal;
  }).length;
  
  // Log for debugging
  if (lavtLager > 0) {
    console.log(`⚠️ ${lavtLager} vine i lavt lager (antal < minAntal)`);
  }
  
  let totalVærdi = 0;
  allWines.forEach(w => {
    totalVærdi += (w.antal || 0) * (w.indkøbspris || 0);
  });
  
  // Generer QR-kode til scanner link
  if (typeof generateScannerQR === 'function') {
    generateScannerQR();
  }

  // Opdater dashboard elementer hvis de findes
  const statAntVine = document.getElementById('stat-ant-vine');
  const statLavt = document.getElementById('stat-lavt');
  const statVærdi = document.getElementById('stat-værdi');
  
  if (statAntVine) statAntVine.textContent = antVine;
  if (statLavt) {
    statLavt.textContent = lavtLager;
    // Opdater farve baseret på antal - TYDELIG markering
    if (lavtLager > 0) {
      statLavt.classList.add('warning');
      statLavt.style.color = '#c00';
      statLavt.style.fontWeight = 'bold';
      statLavt.style.fontSize = '1.2em';
      statLavt.style.cursor = 'pointer';
      // Gør klikbar for at vise oversigt
      statLavt.onclick = () => {
        if (typeof showVineOversigt === 'function') {
          showVineOversigt('lavt');
        }
      };
      statLavt.title = 'Klik for at se oversigt over vine i lavt lager';
    } else {
      statLavt.classList.remove('warning');
      statLavt.style.color = '';
      statLavt.style.fontWeight = '';
      statLavt.style.fontSize = '';
      statLavt.style.cursor = '';
      statLavt.onclick = null;
      statLavt.title = '';
    }
  }
  if (statVærdi) {
    if (typeof formatDanskPris === 'function') {
      statVærdi.textContent = `${formatDanskPris(totalVærdi)} kr.`;
    } else {
      statVærdi.textContent = `${totalVærdi.toFixed(2)} kr.`;
    }
  }
}

// Vis vine oversigt modal
function showVineOversigt(type) {
  const modal = document.getElementById('vine-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalStats = document.getElementById('modal-stats');
  const modalTbody = document.getElementById('modal-vine-tbody');
  
  if (!modal) return;
  
  // SIKR at allWines er defineret
  if (!allWines || !Array.isArray(allWines)) {
    allWines = [];
  }
  
  // KRITISK FIX: Filtrer øl & vand fra allWines (kun VIN skal vises)
  const onlyWines = allWines.filter(w => {
    const kategori = (w.kategori || w.type || '').toLowerCase();
    const navn = (w.navn || '').toLowerCase();
    const vinId = (w.vinId || '').toLowerCase();
    
    // Hvis det starter med "OL-" eller "W" og er et nummer, er det øl & vand
    if (vinId.startsWith('ol-') || /^w\d{4,}$/.test(vinId)) {
      return false;
    }
    
    // Filtrer øl & vand produkter ud
    const isOlVand = kategori.includes('øl') || kategori.includes('vand') || kategori.includes('sodavand') ||
                    kategori.includes('fadøl') || kategori.includes('flaske') || kategori.includes('dåse') ||
                    navn.includes('øl') || navn.includes('vand') || navn.includes('cola') || navn.includes('tonic') ||
                    navn.includes('ginger') || navn.includes('lemon') || navn.includes('appelsin') ||
                    kategori === 'ol' || kategori === 'vand' || kategori === 'sodavand';
    
    return !isOlVand; // Returner kun VIN
  });
  
  // Filtrer vine
  let filteredWines = [];
  if (type === 'lavt') {
    // Filtrer korrekt - tjek både antal og minAntal
    // KRITISK FIX: Brug parseInt for at sikre tal sammenligning
    filteredWines = onlyWines.filter(w => {
      const antal = parseInt(w.antal) || 0;
      const minAntal = parseInt(w.minAntal) || 24;
      return antal < minAntal;
    });
    if (modalTitle) modalTitle.textContent = `Lavt Lager - Oversigt (${filteredWines.length} vine)`;
    console.log(`📊 Viser ${filteredWines.length} VIN i lavt lager`);
  } else {
    filteredWines = onlyWines;
    if (modalTitle) modalTitle.textContent = `Alle Vine - Oversigt (${filteredWines.length} vine)`;
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
    // KRITISK FIX: Brug parseInt for at sikre tal sammenligning
    const antal = parseInt(wine.antal) || 0;
    const minAntal = parseInt(wine.minAntal) || 24;
    const lavtLagerClass = antal < minAntal ? ' style="background: #fee;"' : '';
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
  console.log('=== RENDERLAGER START ===');
  console.log('allWines:', allWines);
  console.log('allWines type:', typeof allWines);
  console.log('allWines er array:', Array.isArray(allWines));
  console.log('allWines.length:', allWines ? allWines.length : 'allWines er undefined');
  
  // Tjek om allWines er tom eller undefined
  if (!allWines || !Array.isArray(allWines) || allWines.length === 0) {
    console.warn('⚠️ allWines er tom - prøver at hente data eller gendanne fra backup...');
    const tbody = document.getElementById('lager-tbody');
    if (!tbody) {
      console.error('❌ lager-tbody element ikke fundet!');
      return;
    }
    
    let hint = '';
    try {
      if (localStorage.getItem(WINES_BACKUP_KEY)) {
        hint = ' Gå til Rapporter og klik "Gendan lager fra backup" hvis du har backup.';
      }
    } catch (e) {
      console.error('Fejl ved tjek af backup:', e);
    }
    
    tbody.innerHTML = '<tr><td colspan="14" style="text-align: center; padding: 20px; color: #c00; background: #fee; font-weight: bold;">⚠️ INGEN DATA FUNDET!<br><br>1. Tjek om du er logget ind<br>2. Prøv at klikke på "Opdater" knappen<br>3. Eller gå til Import og importer data' + hint + '</td></tr>';
    
    // Prøv at hente data én gang
    if (typeof loadWines === 'function') {
      console.log('🔄 Kalder loadWines()...');
      loadWines().then(() => {
        console.log('✅ loadWines() færdig, kalder renderLager() igen...');
        setTimeout(() => {
          if (allWines && allWines.length > 0) {
            renderLager();
          } else {
            console.error('❌ allWines stadig tom efter loadWines()');
          }
        }, 500);
      }).catch(err => {
        console.error('❌ Fejl i loadWines():', err);
        tbody.innerHTML = '<tr><td colspan="14" style="text-align: center; padding: 20px; color: #c00; background: #fee; font-weight: bold;">❌ FEJL VED HENTNING AF DATA!<br><br>Fejl: ' + (err.message || 'Ukendt fejl') + '<br><br>Tjek browser console for detaljer.</td></tr>';
      });
    } else {
      console.error('❌ loadWines funktion ikke fundet!');
      tbody.innerHTML = '<tr><td colspan="14" style="text-align: center; padding: 20px; color: #c00; background: #fee; font-weight: bold;">❌ SYSTEM FEJL: loadWines funktion mangler!<br><br>Genindlæs siden (Ctrl+Shift+R)</td></tr>';
    }
    return;
  }
  
  console.log(`✅ Rendering ${allWines.length} vine...`);
  
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
  if (!tbody) {
    console.error('❌ lager-tbody element ikke fundet i renderLager()!');
    return;
  }
  tbody.innerHTML = '';
  console.log('✅ Tabel tømt, starter rendering...');

  filtered.forEach(wine => {
    const row = document.createElement('tr');
    const minAntal = parseInt(wine.minAntal) || 24; // Standard minimum er 24 flasker
    const antal = parseInt(wine.antal) || 0;
    let statusClass = '';
    let statusIcon = '';
    let advarsel = '';
    
    // KRITISK FIX: Farvekodning baseret på sammenligning med minAntal
    // Grøn: antal >= minAntal (ok)
    // Gul: antal >= minAntal * 0.5 (advarsel)
    // Rød: antal < minAntal * 0.5 (kritisk lavt)
    const threshold50 = Math.floor(minAntal * 0.5);
    if (antal >= minAntal) {
      statusClass = 'status-green';
      statusIcon = '🟢';
    } else if (antal >= threshold50) {
      statusClass = 'status-orange';
      statusIcon = '🟠';
      advarsel = ' ⚠️ Lavt lager!';
    } else {
      statusClass = 'status-red';
      statusIcon = '🔴';
      advarsel = ' ⚠️ Kritisk lavt lager!';
    }
    
    // Tjek om lavt lager (antal < minAntal)
    const isLowStock = antal < minAntal;
    const lavtLagerStyle = isLowStock ? ' style="background: #fee; border-left: 4px solid #c00;"' : '';
    const antalBold = isLowStock ? '<strong style="color: #c00;">' : '';
    const antalBoldEnd = isLowStock ? '</strong>' : '';
    
    // Markér optalte vine i dag med prik
    const isCountedToday = countedWinesToday.has(wine.vinId);
    const countedMarker = isCountedToday ? '<span style="color: #4CAF50; font-weight: bold; margin-right: 3px;" title="Optalt i dag">•</span>' : '';
    
    row.innerHTML = `
      <td${lavtLagerStyle}>${countedMarker}${wine.vinId || ''}</td>
      <td${lavtLagerStyle}>${wine.varenummer || ''}</td>
      <td${lavtLagerStyle}>${wine.navn || ''}</td>
      <td${lavtLagerStyle}>${wine.type || ''}</td>
      <td${lavtLagerStyle}>${wine.land || ''}</td>
      <td${lavtLagerStyle}>${wine.region || ''}</td>
      <td${lavtLagerStyle}>${wine.årgang || ''}</td>
      <td${lavtLagerStyle}><span style="background: #e6f7e6; color: #060; padding: 2px 6px; border-radius: 3px; font-size: 0.9em;">${wine.lokation || 'Ukendt'}</span></td>
      <td${lavtLagerStyle}>${wine.reol || ''}</td>
      <td${lavtLagerStyle}>${wine.hylde || ''}</td>
      <td class="text-right antal-cell"${lavtLagerStyle}>${antalBold}${wine.antal || 0}${antalBoldEnd}</td>
      <td class="text-right" data-status-cell="true">
        <div class="${statusClass}" style="padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px; min-width: 80px; justify-content: center; ${statusClass === 'status-red' ? 'background-color: #fee !important; color: #c00 !important;' : statusClass === 'status-orange' ? 'background-color: #ffe4cc !important; color: #f60 !important;' : statusClass === 'status-green' ? 'background-color: #e6f7e6 !important; color: #060 !important;' : ''}">
          <span class="status-icon-${wine.vinId}" style="font-size: 1.2em;">${statusIcon}</span>
          <input type="number" 
                 class="min-antal-input" 
                 value="${minAntal}" 
                 data-vinid="${wine.vinId}"
                 min="0"
                 style="width: 60px; text-align: right; border: 1px solid #ddd; padding: 2px 5px; background: white;">
        </div>
        ${advarsel ? `<div style="color: red; font-size: 0.85em; margin-top: 4px; font-weight: bold;">${advarsel}</div>` : ''}
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
  
  console.log(`✅ ${filtered.length} rækker renderet i tabellen`);
  
  // KRITISK FIX: Opdater dashboard EFTER tabel er renderet
  // Dette sikrer at dashboard altid viser korrekt antal i lavt lager
  if (typeof updateDashboard === 'function') {
    updateDashboard();
    console.log('✅ Dashboard opdateret i renderLager()');
  } else {
    console.warn('⚠️ updateDashboard funktion mangler');
  }
  
  console.log('=== RENDERLAGER SLUT ===');
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
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof renderLager === 'function') renderLager();
    showSuccess('Pris opdateret!');
  } catch (error) {
    console.error('Fejl ved opdatering af pris:', error);
    showError('Kunne ikke opdatere pris');
    if (typeof renderLager === 'function') renderLager(); // Genindlæs for at få korrekt værdi tilbage
    if (typeof updateDashboard === 'function') updateDashboard();
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
    
    // Opdater lokalt data
    const localWine = allWines.find(w => w.vinId === vinId);
    if (localWine) {
      localWine.minAntal = minAntal;
    }
    
    // Opdater visningen
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof renderLager === 'function') renderLager();
    showSuccess('Minimum opdateret!');
  } catch (error) {
    console.error('Fejl ved opdatering af minimum:', error);
    showError('Kunne ikke opdatere minimum antal');
    // Genindlæs for at få korrekt værdi tilbage
    if (typeof renderLager === 'function') renderLager();
    if (typeof updateDashboard === 'function') updateDashboard();
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
    
    // KRITISK: Opdater dashboard og tabel efter optælling
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof renderLager === 'function') renderLager();
    saveWinesBackup(allWines); // Gem backup

    // Ryd input og scan-input så scanneren er klar til næste scan
    document.getElementById('count-input').value = '';
    document.getElementById('scan-input').value = '';
    
    // KRITISK: Opdater lager visning (inkl. farvekodning baseret på nyt antal)
    // Vent lidt så backend kan gemme, så hent opdateret data
    setTimeout(async () => {
      try {
        await loadWines();
      } catch (err) {
        // Hvis fejl, opdater alligevel med lokale data
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderLager === 'function') renderLager();
      }
    }, 500);
    
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
  // Setup Vin file input
  const fileInputVin = document.getElementById('file-input-vin');
  if (fileInputVin) {
    fileInputVin.addEventListener('change', (e) => {
      const fileNameEl = document.getElementById('file-name-vin');
      if (fileNameEl) {
        fileNameEl.textContent = e.target.files[0]?.name || '';
      }
    });
  }
  
  // Setup Øl & Vand file input
  const fileInputOlVand = document.getElementById('file-input-ol-vand');
  if (fileInputOlVand) {
    fileInputOlVand.addEventListener('change', (e) => {
      const fileNameEl = document.getElementById('file-name-ol-vand');
      if (fileNameEl) {
        fileNameEl.textContent = e.target.files[0]?.name || '';
      }
    });
  }
  
  // Backward compatibility - old file-input
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const fileName = e.target.files[0]?.name || '';
      const fileNameEl = document.getElementById('file-name');
      if (fileNameEl) {
        fileNameEl.textContent = fileName;
      }
    });
  }
}

// Download Excel skabelon
async function downloadTemplate(category = 'vin') {
  try {
    if (category === 'ol-vand') {
      // Generer Excel skabelon for Øl & Vand lokalt
      await downloadOlVandTemplate();
      return;
    }
    
    // Vin template fra backend
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
    
    showSuccess('Excel skabelon downloadet! Filen hedder: vinlager_skabelon.xlsx');
  } catch (error) {
    console.error('Fejl ved download af skabelon:', error);
    showError('Kunne ikke downloade skabelon: ' + error.message);
  }
}

// Generer Excel skabelon for Øl & Vand lokalt
async function downloadOlVandTemplate() {
  try {
    // Alle produkter fra brugerens liste
    const produkter = [
      // FADØL
      { navn: 'Pilsner – 20 L', kategori: 'Fadøl', type: 'Pilsner', størrelse: '20 L' },
      { navn: 'Pilsner – 25 L', kategori: 'Fadøl', type: 'Pilsner', størrelse: '25 L' },
      { navn: 'Pilsner – 30 L', kategori: 'Fadøl', type: 'Pilsner', størrelse: '30 L' },
      { navn: 'Pilsner – 50 L', kategori: 'Fadøl', type: 'Pilsner', størrelse: '50 L' },
      { navn: 'Classic – 20 L', kategori: 'Fadøl', type: 'Classic', størrelse: '20 L' },
      { navn: 'Classic – 25 L', kategori: 'Fadøl', type: 'Classic', størrelse: '25 L' },
      { navn: 'Classic – 30 L', kategori: 'Fadøl', type: 'Classic', størrelse: '30 L' },
      { navn: 'IPA – 20 L', kategori: 'Fadøl', type: 'IPA', størrelse: '20 L' },
      { navn: 'IPA – 25 L', kategori: 'Fadøl', type: 'IPA', størrelse: '25 L' },
      { navn: 'Hvedeøl – 20 L', kategori: 'Fadøl', type: 'Hvedeøl', størrelse: '20 L' },
      { navn: 'Hvedeøl – 30 L', kategori: 'Fadøl', type: 'Hvedeøl', størrelse: '30 L' },
      { navn: 'Sæsonøl / Special – 20 L', kategori: 'Fadøl', type: 'Sæsonøl / Special', størrelse: '20 L' },
      // FLASKE- & DÅSEØL
      { navn: 'Pilsner – 33 cl', kategori: 'Flaske- & Dåseøl', type: 'Pilsner', størrelse: '33 cl' },
      { navn: 'Pilsner – 50 cl', kategori: 'Flaske- & Dåseøl', type: 'Pilsner', størrelse: '50 cl' },
      { navn: 'Classic – 33 cl', kategori: 'Flaske- & Dåseøl', type: 'Classic', størrelse: '33 cl' },
      { navn: 'Classic – 50 cl', kategori: 'Flaske- & Dåseøl', type: 'Classic', størrelse: '50 cl' },
      { navn: 'IPA – 33 cl', kategori: 'Flaske- & Dåseøl', type: 'IPA', størrelse: '33 cl' },
      { navn: 'IPA – 44 cl', kategori: 'Flaske- & Dåseøl', type: 'IPA', størrelse: '44 cl' },
      { navn: 'Pale Ale – 33 cl', kategori: 'Flaske- & Dåseøl', type: 'Pale Ale', størrelse: '33 cl' },
      { navn: 'Hvedeøl – 50 cl', kategori: 'Flaske- & Dåseøl', type: 'Hvedeøl', størrelse: '50 cl' },
      { navn: 'Brown Ale – 33 cl', kategori: 'Flaske- & Dåseøl', type: 'Brown Ale', størrelse: '33 cl' },
      { navn: 'Stout / Porter – 33 cl', kategori: 'Flaske- & Dåseøl', type: 'Stout / Porter', størrelse: '33 cl' },
      { navn: 'Sour – 33 cl', kategori: 'Flaske- & Dåseøl', type: 'Sour', størrelse: '33 cl' },
      { navn: 'Alkoholfri pilsner – 33 cl', kategori: 'Flaske- & Dåseøl', type: 'Alkoholfri pilsner', størrelse: '33 cl' },
      { navn: 'Alkoholfri IPA – 33 cl', kategori: 'Flaske- & Dåseøl', type: 'Alkoholfri IPA', størrelse: '33 cl' },
      // VAND – UDEN BRUS
      { navn: 'Kildevand – 25 cl', kategori: 'Vand – Uden brus', type: 'Kildevand', størrelse: '25 cl' },
      { navn: 'Kildevand – 50 cl', kategori: 'Vand – Uden brus', type: 'Kildevand', størrelse: '50 cl' },
      { navn: 'Kildevand – 75 cl', kategori: 'Vand – Uden brus', type: 'Kildevand', størrelse: '75 cl' },
      { navn: 'Kildevand – 1,0 L', kategori: 'Vand – Uden brus', type: 'Kildevand', størrelse: '1,0 L' },
      { navn: 'Still water (import) – 75 cl', kategori: 'Vand – Uden brus', type: 'Still water (import)', størrelse: '75 cl' },
      // VAND – MED BRUS
      { navn: 'Danskvand – 25 cl', kategori: 'Vand – Med brus', type: 'Danskvand', størrelse: '25 cl' },
      { navn: 'Danskvand – 50 cl', kategori: 'Vand – Med brus', type: 'Danskvand', størrelse: '50 cl' },
      { navn: 'Mineralvand – 75 cl', kategori: 'Vand – Med brus', type: 'Mineralvand', størrelse: '75 cl' },
      { navn: 'Mineralvand – 1,0 L', kategori: 'Vand – Med brus', type: 'Mineralvand', størrelse: '1,0 L' },
      { navn: 'Sparkling water (import) – 75 cl', kategori: 'Vand – Med brus', type: 'Sparkling water (import)', størrelse: '75 cl' },
      // SODAVAND
      { navn: 'Cola – 25 cl', kategori: 'Sodavand', type: 'Cola', størrelse: '25 cl' },
      { navn: 'Cola Zero – 25 cl', kategori: 'Sodavand', type: 'Cola Zero', størrelse: '25 cl' },
      { navn: 'Cola – 33 cl', kategori: 'Sodavand', type: 'Cola', størrelse: '33 cl' },
      { navn: 'Lemon – 25 cl', kategori: 'Sodavand', type: 'Lemon', størrelse: '25 cl' },
      { navn: 'Appelsinvand – 25 cl', kategori: 'Sodavand', type: 'Appelsinvand', størrelse: '25 cl' },
      { navn: 'Tonic – 20 cl', kategori: 'Sodavand', type: 'Tonic', størrelse: '20 cl' },
      { navn: 'Tonic – 25 cl', kategori: 'Sodavand', type: 'Tonic', størrelse: '25 cl' },
      { navn: 'Ginger Beer – 20 cl', kategori: 'Sodavand', type: 'Ginger Beer', størrelse: '20 cl' },
      { navn: 'Ginger Ale – 25 cl', kategori: 'Sodavand', type: 'Ginger Ale', størrelse: '25 cl' }
    ];
    
    // Lokationer for Øl & Vand
    const lokationer = ['Restaurant 1', 'Restaurant 2', 'Køleren Øl & vand 1', 'Køleren Øl & vand 2', 'Bar 1', 'Bar 2'];
    
    // Realistiske indkøbspriser for Øl & Vand (i kr.)
    const getPris = (produkt) => {
      const navn = produkt.navn.toLowerCase();
      const størrelse = produkt.størrelse || '';
      
      // Fadøl priser (20-50L)
      if (produkt.kategori === 'Fadøl') {
        if (størrelse.includes('20 L')) return '450.00'; // 20L fadøl
        if (størrelse.includes('25 L')) return '550.00'; // 25L fadøl
        if (størrelse.includes('30 L')) return '650.00'; // 30L fadøl
        if (størrelse.includes('50 L')) return '950.00'; // 50L fadøl
        return '500.00'; // Default fadøl
      }
      
      // Flaske- & Dåseøl priser (33-50cl)
      if (produkt.kategori === 'Flaske- & Dåseøl') {
        if (størrelse.includes('33 cl')) return '8.50'; // 33cl flaske
        if (størrelse.includes('44 cl')) return '10.00'; // 44cl flaske
        if (størrelse.includes('50 cl')) return '12.00'; // 50cl flaske
        return '9.00'; // Default flaske
      }
      
      // Vand – Uden brus (25cl-1L)
      if (produkt.kategori === 'Vand – Uden brus') {
        if (størrelse.includes('25 cl')) return '3.50';
        if (størrelse.includes('50 cl')) return '5.00';
        if (størrelse.includes('75 cl')) return '6.50';
        if (størrelse.includes('1,0 L') || størrelse.includes('1.0 L')) return '8.00';
        return '5.00';
      }
      
      // Vand – Med brus (25cl-1L)
      if (produkt.kategori === 'Vand – Med brus') {
        if (størrelse.includes('25 cl')) return '4.00';
        if (størrelse.includes('50 cl')) return '5.50';
        if (størrelse.includes('75 cl')) return '7.00';
        if (størrelse.includes('1,0 L') || størrelse.includes('1.0 L')) return '9.00';
        return '5.50';
      }
      
      // Sodavand (20-33cl)
      if (produkt.kategori === 'Sodavand') {
        if (størrelse.includes('20 cl')) return '4.50';
        if (størrelse.includes('25 cl')) return '5.00';
        if (størrelse.includes('33 cl')) return '6.00';
        return '5.00';
      }
      
      return '5.00'; // Default pris
    };
    
    // Generer CSV indhold
    const headers = ['VIN-ID', 'Varenummer', 'Navn', 'Kategori', 'Type', 'Størrelse', 'Lokation', 'Reol', 'Hylde', 'Antal', 'Min. Antal', 'Indkøbspris'];
    const rows = [];
    
    // Fordel produkter på forskellige lokationer med realistiske data
    produkter.forEach((p, index) => {
      const vinId = `OL-${String(index + 1).padStart(4, '0')}`;
      const varenummer = `W${String(index + 1000).padStart(4, '0')}`;
      
      // Vælg lokation (fordel jævnt)
      const lokation = lokationer[index % lokationer.length];
      
      // Generer reol (A, B, C, D, E, F)
      const reol = String.fromCharCode(65 + (index % 6)); // A-F
      
      // Generer hylde (1-4)
      const hylde = (index % 4) + 1; // 1-4
      
      // Generer antal (24-72 stk)
      const antal = 24 + Math.floor(Math.random() * 48); // 24-72
      
      // Hent pris
      const pris = getPris(p);
      
      rows.push([
        vinId,
        varenummer,
        p.navn,
        p.kategori,
        p.type,
        p.størrelse,
        lokation,
        reol,
        hylde.toString(),
        antal.toString(),
        '24', // Min. Antal
        pris.replace('.', ',') // Dansk format (komma)
      ]);
      
      // Nogle produkter skal have flere lokationer (ca. 20%)
      if (Math.random() < 0.2 && index < produkter.length - 5) {
        const secondLokation = lokationer[(index + 3) % lokationer.length];
        const secondReol = String.fromCharCode(65 + ((index + 2) % 6));
        const secondHylde = ((index + 1) % 4) + 1;
        const secondAntal = 24 + Math.floor(Math.random() * 24);
        
        rows.push([
          vinId, // Samme VIN-ID
          varenummer, // Samme varenummer
          p.navn,
          p.kategori,
          p.type,
          p.størrelse,
          secondLokation,
          secondReol,
          secondHylde.toString(),
          secondAntal.toString(),
          '24',
          pris.replace('.', ',')
        ]);
      }
    });
    
    // Konverter til CSV format (med semikolon separator for Excel kompatibilitet)
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => {
        const cellValue = String(cell || '');
        // Hvis cellen indeholder semikolon, komma eller anførselstegn, wrap i anførselstegn
        if (cellValue.includes(';') || cellValue.includes(',') || cellValue.includes('"')) {
          return `"${cellValue.replace(/"/g, '""')}"`;
        }
        return cellValue;
      }).join(';'))
    ].join('\r\n');
    
    // Opret CSV fil med UTF-8 BOM for korrekt encoding i Excel
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ol_vand_skabelon.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showSuccess('Excel skabelon for Øl & Vand downloadet! Filen hedder: ol_vand_skabelon.csv');
  } catch (error) {
    console.error('Fejl ved generering af Øl & Vand skabelon:', error);
    showError('Kunne ikke generere skabelon: ' + error.message);
  }
}

async function doImport(category = 'vin') {
  const fileInputId = category === 'ol-vand' ? 'file-input-ol-vand' : 'file-input-vin';
  const fileInput = document.getElementById(fileInputId);
  const file = fileInput?.files[0];
  
  if (!file) {
    alert('Vælg venligst en fil');
    return;
  }

  const modeSelector = category === 'ol-vand' ? 'input[name="import-mode-ol-vand"]' : 'input[name="import-mode-vin"]';
  const mode = document.querySelector(modeSelector + ':checked')?.value || 'opdater';
  
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
  const resultsDivId = category === 'ol-vand' ? 'import-results-ol-vand' : 'import-results-vin';
  const resultsContentId = category === 'ol-vand' ? 'import-results-content-ol-vand' : 'import-results-content-vin';
  const resultsDiv = document.getElementById(resultsDivId);
  const contentDiv = document.getElementById(resultsContentId);
  
  // KRITISK FIX: Tjek om elementerne eksisterer før vi prøver at ændre style
  if (resultsDiv) {
    resultsDiv.style.display = 'block';
  }
  if (contentDiv) {
    contentDiv.innerHTML = '<p>Importerer... Vent venligst.</p>';
  } else {
    console.warn(`⚠️ Element ${resultsContentId} ikke fundet - opretter det...`);
    // Opret element hvis det mangler
    if (resultsDiv) {
      const newContentDiv = document.createElement('div');
      newContentDiv.id = resultsContentId;
      resultsDiv.appendChild(newContentDiv);
      newContentDiv.innerHTML = '<p>Importerer... Vent venligst.</p>';
    }
  }
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);
  formData.append('category', category); // Tilføj kategori til backend
  
  // KRITISK: Hvis kategori er 'ol-vand', sørg for at alle produkter får kategori sat
  // Backend skal håndtere dette, men vi sender det med alligevel
  console.log(`📤 Importerer ${category === 'ol-vand' ? 'Øl & Vand' : 'Vin'} fil:`, file.name);

  try {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const endpoint = isExcel ? '/api/import/excel' : '/api/import/csv';
    
    // KRITISK: Hent auth token for authentication
    const token = localStorage.getItem('auth_token') || localStorage.getItem('jwt_token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`📤 Uploader til ${endpoint} med kategori: ${category}, mode: ${mode}`);

    const response = await fetch(`${getConfig().API_URL}${endpoint}`, {
      method: 'POST',
      headers: headers,
      body: formData
    });

    if (!response.ok) {
      let errorMessage = 'Import fejlede';
      try {
        const error = await response.json();
        errorMessage = error.error || error.message || `HTTP ${response.status}`;
      } catch (e) {
        // Hvis response ikke er JSON, prøv at læse som tekst
        try {
          const errorText = await response.text();
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
        } catch (e2) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
      }
      console.error('❌ Import fejl:', errorMessage);
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    // KRITISK FIX: Brug korrekte element IDs baseret på kategori
    const resultsDiv = document.getElementById(resultsDivId);
    let resultsContent = document.getElementById(resultsContentId);
    
    // Opret element hvis det mangler
    if (!resultsContent && resultsDiv) {
      resultsContent = document.createElement('div');
      resultsContent.id = resultsContentId;
      resultsDiv.appendChild(resultsContent);
    }
    
    if (resultsDiv) {
      resultsDiv.style.display = 'block';
    }
    if (resultsContent) {
      resultsContent.innerHTML = `
        <div class="success-message">
          <p><strong>Import gennemført!</strong></p>
          <p>Importeret: ${result.importeret || 0}</p>
          <p>Opdateret: ${result.opdateret || 0}</p>
          ${result.fejl && result.fejl.length > 0 ? `<p>Fejl: ${result.fejl.length}</p>` : ''}
          <p style="margin-top: 10px; color: #4CAF50;"><strong>✅ Varelageret er nu opdateret!</strong></p>
        </div>
      `;
    }

    // Reload data - FORCE refresh fra backend
    console.log('🔄 Genindlæser varelager efter import...');
    if (category === 'ol-vand') {
      // KRITISK: Vent lidt så backend kan gemme data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // KRITISK: Tjek om loadOlVand er defineret
      if (typeof loadOlVand === 'function') {
        console.log('📥 Kalder loadOlVand()...');
        await loadOlVand();
        console.log(`✅ loadOlVand() færdig. allOlVand har nu ${allOlVand ? allOlVand.length : 0} produkter`);
        
        // KRITISK: Opdater tabel og dashboard MED DET SAMME
        if (typeof renderOlVandLager === 'function') {
          console.log('🎨 Renderer Øl & Vand tabel...');
          renderOlVandLager();
          console.log('✅ Tabel renderet');
        }
        
        if (typeof updateDashboardOlVand === 'function') {
          updateDashboardOlVand();
        }
        
        if (typeof populateFiltersOlVand === 'function') {
          populateFiltersOlVand();
        }
      } else {
        console.error('❌ loadOlVand er ikke defineret!');
        // Prøv at hente data direkte
        try {
          console.log('📥 Henter data direkte...');
          const allProducts = await apiCall('/api/wines');
          console.log(`📦 Modtaget ${allProducts ? allProducts.length : 0} produkter fra backend`);
          
          const olVand = (allProducts || []).filter(p => {
            const kategori = (p.kategori || p.type || '').toLowerCase();
            const vinId = (p.vinId || '').toLowerCase();
            return vinId.startsWith('ol-') || /^w\d{4,}$/.test(vinId) ||
                   kategori.includes('øl') || kategori.includes('vand') || kategori.includes('sodavand');
          });
          
          console.log(`✅ Filtreret til ${olVand.length} Øl & Vand produkter`);
          allOlVand = olVand.map(p => {
            p.antal = parseInt(p.antal) || 0;
            p.minAntal = parseInt(p.minAntal) || 24;
            return p;
          });
          
          if (typeof renderOlVandLager === 'function') {
            renderOlVandLager();
            console.log('✅ Tabel renderet (direkte)');
          }
          if (typeof updateDashboardOlVand === 'function') {
            updateDashboardOlVand();
          }
          if (typeof populateFiltersOlVand === 'function') {
            populateFiltersOlVand();
          }
        } catch (e) {
          console.error('❌ Fejl ved direkte hentning af Øl & Vand:', e);
        }
      }
    } else {
      await loadWines();
      if (typeof renderLager === 'function') {
        renderLager();
      }
      if (typeof updateDashboard === 'function') {
        updateDashboard();
      }
    }
    console.log('✅ Varelager genindlæst');
  } catch (error) {
    const resultsDiv = document.getElementById(resultsDivId);
    let resultsContent = document.getElementById(resultsContentId);
    
    // KRITISK FIX: Opret element hvis det mangler
    if (!resultsContent && resultsDiv) {
      resultsContent = document.createElement('div');
      resultsContent.id = resultsContentId;
      resultsDiv.appendChild(resultsContent);
    }
    
    if (resultsDiv) {
      resultsDiv.style.display = 'block';
    }
    if (resultsContent) {
      resultsContent.innerHTML = `<div class="error-message">Fejl: ${error.message}</div>`;
    } else {
      // Fallback hvis intet virker
      alert(`Import fejl: ${error.message}`);
    }
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

// Generate labels function med category parameter
async function generateLabels(category = 'vin') {
  console.log(`🎨 Genererer labels for ${category === 'ol-vand' ? 'Øl & Vand' : 'Vin'}...`);
  
  // KRITISK: Brug korrekte element IDs baseret på kategori
  const lokationId = category === 'ol-vand' ? 'label-lokation-ol-vand' : 'label-lokation';
  const reolId = category === 'ol-vand' ? 'label-reol-ol-vand' : 'label-reol';
  const hyldeId = category === 'ol-vand' ? 'label-hylde-ol-vand' : 'label-hylde';
  const containerId = category === 'ol-vand' ? 'labels-container-ol-vand' : 'labels-container';
  
  const lokationFilter = document.getElementById(lokationId)?.value || '';
  const reolFilter = document.getElementById(reolId)?.value || '';
  const hyldeFilter = document.getElementById(hyldeId)?.value || '';

  // KRITISK: Brug korrekt data array baseret på kategori
  let filtered = category === 'ol-vand' ? (allOlVand || []) : (allWines || []);
  
  console.log(`📦 Starter med ${filtered.length} produkter (${category})`);

  if (lokationFilter) {
    filtered = filtered.filter(w => w.lokation === lokationFilter);
  }
  if (reolFilter) {
    filtered = filtered.filter(w => w.reol === reolFilter);
  }
  if (hyldeFilter) {
    filtered = filtered.filter(w => w.hylde === hyldeFilter);
  }
  
  console.log(`✅ Filtreret til ${filtered.length} produkter`);

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`❌ Container ${containerId} ikke fundet!`);
    alert(`Fejl: Container for ${category === 'ol-vand' ? 'Øl & Vand' : 'Vin'} labels ikke fundet.`);
    return;
  }
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">Ingen produkter fundet med de valgte filtre.</p>';
    return;
  }

  filtered.forEach((item, index) => {
    const wine = item; // For kompatibilitet
    const label = document.createElement('div');
    label.className = 'label';
    const qrId = `qr-${wine.vinId}-${index}-${Date.now()}`;
    const displayInfo = category === 'ol-vand' 
      ? `<div>${wine.kategori || wine.type || ''} ${wine.størrelse || ''}</div>`
      : `<div>${wine.land || ''} ${wine.årgang || ''}</div>`;
    
    label.innerHTML = `
      <div class="label-info">
        <strong>${wine.navn || ''}</strong>
        ${displayInfo}
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
  
  console.log(`✅ ${filtered.length} labels genereret for ${category === 'ol-vand' ? 'Øl & Vand' : 'Vin'}`);
  showSuccess(`${filtered.length} labels genereret for ${category === 'ol-vand' ? 'Øl & Vand' : 'Vin'}!`);
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

// Upload billede for Øl & Vand
async function uploadOlVandImage(input, vinId) {
  if (!input || !input.files || !input.files[0]) {
    console.error('Ingen fil valgt');
    return;
  }
  
  const file = input.files[0];
  console.log('Uploader billede:', file.name, 'til Øl & Vand:', vinId);
  
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
    await loadOlVand(); // Genhent alle Øl & Vand produkter
    renderOlVandLager();
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
function printLabels(category = 'vin') {
  console.log(`🖨️ Printer labels for ${category === 'ol-vand' ? 'Øl & Vand' : 'Vin'}...`);
  
  // KRITISK: Brug korrekt container baseret på kategori
  const containerId = category === 'ol-vand' ? 'labels-container-ol-vand' : 'labels-container';
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.error(`❌ Container ${containerId} ikke fundet!`);
    alert(`Fejl: Container for ${category === 'ol-vand' ? 'Øl & Vand' : 'Vin'} labels ikke fundet.`);
    return;
  }
  
  if (container.children.length === 0) {
    alert(`Ingen labels genereret endnu. Klik på "Generer labels" først.`);
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
  // ALTID opdater rapporter fra backend
  if (typeof loadReportsHistory === 'function') {
    loadReportsHistory().catch(() => {}); // Ignorer fejl
  }
  
  // KRITISK: Opdater lager EFTER rapporter - vent længere så backend har tid
  setTimeout(() => {
    if (typeof loadWines === 'function') {
      loadWines().then(() => {
        // FORCE opdater dashboard og tabel - uanset hvad
        console.log('🔄 Opdaterer dashboard og tabel efter mobil optælling...');
        if (typeof updateDashboard === 'function') {
          updateDashboard();
          console.log('✅ Dashboard opdateret');
        }
        if (typeof renderLager === 'function') {
          renderLager();
          console.log('✅ Tabel opdateret');
        }
      }).catch((err) => {
        console.error('❌ Fejl ved opdatering:', err);
        // Hvis fejl, opdater alligevel med eksisterende data
        if (typeof updateDashboard === 'function') {
          updateDashboard();
          console.log('✅ Dashboard opdateret (efter fejl)');
        }
        if (typeof renderLager === 'function') {
          renderLager();
          console.log('✅ Tabel opdateret (efter fejl)');
        }
      });
    }
  }, 5000); // Vent 5 sekunder for at backend kan gemme data fra mobil scanning
  
  // Fjern flag hvis det er sat
  if (localStorage.getItem('newReportAvailable') === 'true') {
    localStorage.removeItem('newReportAvailable');
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
    
    // KRITISK: Hent FØRST fra localStorage (sikker backup)
    const saved = localStorage.getItem('reportsHistory');
    let localReports = [];
    if (saved) {
      try {
        localReports = JSON.parse(saved);
        console.log(`📦 Fundet ${localReports.length} rapporter i localStorage backup`);
      } catch (e) {
        console.warn('⚠️ Fejl ved parsing af localStorage:', e);
        localReports = [];
      }
    }
    
    // Prøv at hente fra backend
    let backendReports = [];
    try {
      backendReports = await apiCall('/api/reports/history');
      console.log(`📦 Hentet ${backendReports ? backendReports.length : 0} rapporter fra backend`);
    } catch (error) {
      console.warn('⚠️ Kunne ikke hente rapporter fra backend, bruger localStorage:', error.message);
      backendReports = [];
    }
    
    if (backendReports && Array.isArray(backendReports) && backendReports.length > 0) {
      // Backend har rapporter - merge med localStorage
      const backendIds = new Set(backendReports.map(r => (r.id || r.reportId || r.report_id || '').toString()));
      const uniqueLocalReports = localReports.filter(r => {
        const localId = (r.id || '').toString();
        return localId && !backendIds.has(localId);
      });
      
      console.log(`📊 Merging: ${backendReports.length} fra backend + ${uniqueLocalReports.length} unikke fra localStorage`);
      
      reportsHistory = [
        ...backendReports.map(r => ({
          id: (r.id || r.reportId || r.report_id || '').toString(),
          date: r.date || r.created || r.created_at,
          name: r.name || r.report_name || 'Ukendt rapport',
          type: r.type || r.report_type || 'lager',
          wineCount: r.wineCount || r.wine_count || 0,
          totalValue: r.totalValue || r.total_value || 0,
          location: r.location || 'Mobil Optælling',
          archived: r.archived === 1 || r.archived === true || false
        })),
        ...uniqueLocalReports
      ];
      
      // Sorter efter dato (nyeste først)
      reportsHistory.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
      });
      
      // KRITISK: Gem ALTID i localStorage som backup (selv hvis backend har data)
      localStorage.setItem('reportsHistory', JSON.stringify(reportsHistory));
      console.log(`✅ Gemt ${reportsHistory.length} rapporter i localStorage backup`);
    } else {
      // Backend tom eller ingen rapporter – brug localStorage backup
      console.log('⚠️ Backend tom - bruger localStorage backup');
      if (localReports.length > 0) {
        reportsHistory = localReports;
        console.log(`✅ Gendannet ${reportsHistory.length} rapporter fra localStorage backup`);
      } else {
        reportsHistory = [];
        console.log('⚠️ Ingen rapporter i backup');
      }
    }
    
    // KRITISK: ALTID opdater tabel uanset hvad
    if (typeof updateLocationFilter === 'function') {
      updateLocationFilter();
    }
    if (typeof renderReportsTable === 'function') {
      renderReportsTable();
    }
    
    // Opdater backup status
    if (typeof showBackupStatus === 'function') {
      showBackupStatus();
    }
  } catch (error) {
    console.error('❌ Fejl ved indlæsning af rapport historik:', error);
    // Prøv at bruge localStorage som sidste fallback
    const saved = localStorage.getItem('reportsHistory');
    if (saved) {
      try {
        reportsHistory = JSON.parse(saved);
        console.log(`✅ Gendannet ${reportsHistory.length} rapporter fra localStorage efter fejl`);
        if (typeof updateLocationFilter === 'function') {
          updateLocationFilter();
        }
        if (typeof renderReportsTable === 'function') {
          renderReportsTable();
        }
      } catch (parseError) {
        console.error('❌ Fejl ved parsing af localStorage:', parseError);
        reportsHistory = [];
      }
    } else {
      reportsHistory = [];
      console.log('⚠️ Ingen rapporter i backup efter fejl');
    }
  }
}

// Gem rapport i historik
async function saveReportToHistory(reportName, reportType, wineCount, totalValue) {
  const dateStr = toLocalDateTimeString(); // Lokal tid – ikke UTC
  
  const report = {
    reportId: Date.now().toString(),
    date: dateStr, // Send korrekt tidsstempel til backend
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
  
  // Gem også i localStorage som backup (tokens)
  const reportForLocalStorage = {
    id: report.reportId,
    date: dateStr,
    name: report.name,
    type: report.type,
    wineCount: report.wineCount,
    totalValue: report.totalValue,
    location: report.location,
    archived: report.archived,
    backupDate: new Date().toISOString() // Ekstra backup timestamp
  };
  
  reportsHistory.unshift(reportForLocalStorage); // Tilføj øverst
  if (reportsHistory.length > 100) {
    reportsHistory = reportsHistory.slice(0, 100); // Begræns til 100 rapporter
  }
  
  localStorage.setItem('reportsHistory', JSON.stringify(reportsHistory));
  localStorage.setItem('reportsBackup_' + report.reportId, JSON.stringify(reportForLocalStorage)); // Ekstra backup per rapport
  
  // Vis backup status
  showBackupStatus();
  
  updateLocationFilter(); // Opdater lokation filter når ny rapport tilføjes
  renderReportsTable();
}

// Vis backup status
function showBackupStatus() {
  const backupCount = Object.keys(localStorage).filter(k => k.startsWith('reportsBackup_')).length;
  const reportsHistoryCount = reportsHistory.length;
  let winesCount = 0;
  try {
    const w = localStorage.getItem(WINES_BACKUP_KEY);
    if (w) winesCount = (JSON.parse(w) || []).length;
  } catch (e) {}
  const backupInfo = document.getElementById('backup-status');
  if (backupInfo) {
    const parts = [];
    if (winesCount > 0) parts.push(`${winesCount} vine`);
    if (backupCount > 0) parts.push(`${backupCount} rapporter`);
    if (reportsHistoryCount > 0) parts.push(`${reportsHistoryCount} i historik`);
    if (parts.length > 0) {
      backupInfo.textContent = '💾 Backup: ' + parts.join(' + ');
      backupInfo.style.display = 'block';
      backupInfo.style.background = '#e6f7e6';
      backupInfo.style.color = '#060';
    } else {
      backupInfo.style.display = 'none';
    }
  }
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
    // Håndter SQLite format: "2026-01-23 15:29:30" (gemt som localtime)
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      // SQLite gemmer tid i localtime format, så vi skal parse det direkte
      // Format: "YYYY-MM-DD HH:MM:SS" - dette er allerede lokal tid
      const parts = dateStr.split(/[\s-:]/);
      if (parts.length >= 5) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Måneder er 0-indexeret
        const day = parseInt(parts[2], 10);
        const hours = parseInt(parts[3], 10);
        const minutes = parseInt(parts[4], 10);
        
        // Opret Date objekt med lokal tid (ikke UTC)
        const date = new Date(year, month, day, hours, minutes);
        if (!isNaN(date.getTime())) {
          // Formatér til dansk: "23.01.2026 15:29"
          const dayStr = String(date.getDate()).padStart(2, '0');
          const monthStr = String(date.getMonth() + 1).padStart(2, '0');
          const yearStr = date.getFullYear();
          const hoursStr = String(date.getHours()).padStart(2, '0');
          const minutesStr = String(date.getMinutes()).padStart(2, '0');
          return `${dayStr}.${monthStr}.${yearStr} ${hoursStr}:${minutesStr}`;
        }
      }
      // Fallback: Prøv standard parsing
      let isoStr = dateStr;
      if (!dateStr.includes('T') && dateStr.includes(' ')) {
        isoStr = dateStr.replace(' ', 'T');
      }
      const date = new Date(isoStr);
      if (!isNaN(date.getTime())) {
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
    // KRITISK FIX: Brug allWines direkte i stedet for backend!
    let wines = [];
    if (allWines && Array.isArray(allWines) && allWines.length > 0) {
      console.log('✅ Bruger allWines direkte:', allWines.length, 'vine');
      wines = allWines;
    } else {
      console.warn('⚠️ allWines er tom - prøver backend...');
      try {
        wines = await apiCall('/api/reports/lager');
        console.log('✅ Hentet fra backend:', wines ? wines.length : 0, 'vine');
      } catch (error) {
        console.error('❌ Fejl ved hentning af vine-data:', error);
        alert(`Fejl ved hentning af data: ${error.message}`);
        return;
      }
    }
    
    if (!wines || !Array.isArray(wines) || wines.length === 0) {
      console.warn('⚠️ Ingen vine-data fundet!');
      alert('Ingen vine-data fundet. Klik på "Opdater" knappen eller importer data først.');
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
    // Formatér tidsstempel korrekt
    let reportDateStr = '';
    if (report.date) {
      if (report.date.match(/^\d{4}-\d{2}-\d{2}/)) {
        const date = new Date(report.date.replace(' ', 'T'));
        if (!isNaN(date.getTime())) {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          reportDateStr = `${day}.${month}.${year} ${hours}:${minutes}`;
        } else {
          reportDateStr = report.date;
        }
      } else {
        reportDateStr = report.date;
      }
    } else {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      reportDateStr = `${day}.${month}.${year} ${hours}:${minutes}`;
    }
    doc.text('Genereret: ' + reportDateStr, 14, y);
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
    
    const headers = ['Varenummer', 'Navn', 'Type', 'Land', 'Antal', 'Min', 'Pris'];
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
        // KRITISK FIX: Brug varenummer i stedet for vinId, og brug * i stedet for ★ for at undgå encoding problemer
        const varenummer = wine.varenummer || wine.vinId || '';
        const varenummerMarked = '* ' + varenummer;
        // Markér hele rækken med fed skrift for optalte vine
        doc.setFont(undefined, 'bold');
        const row = [
          varenummerMarked,
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
        // Gendan normal skrift efter optalte vine
        doc.setFont(undefined, 'normal');
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
    
    // KRITISK FIX: Brug allWines direkte i stedet for backend!
    let wines = [];
    if (allWines && Array.isArray(allWines) && allWines.length > 0) {
      console.log('✅ Bruger allWines direkte:', allWines.length, 'vine');
      wines = allWines;
    } else {
      console.warn('⚠️ allWines er tom - prøver backend...');
      wines = await apiCall('/api/reports/lager');
    }
    
    if (!wines || !Array.isArray(wines) || wines.length === 0) {
      console.warn('⚠️ Ingen vine-data fundet!');
      alert('Ingen vine-data fundet. Klik på "Opdater" knappen eller importer data først.');
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
    // Formatér tidsstempel korrekt
    let reportDateStr = '';
    if (report.date) {
      if (report.date.match(/^\d{4}-\d{2}-\d{2}/)) {
        const date = new Date(report.date.replace(' ', 'T'));
        if (!isNaN(date.getTime())) {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          reportDateStr = `${day}.${month}.${year} ${hours}:${minutes}`;
        } else {
          reportDateStr = report.date;
        }
      } else {
        reportDateStr = report.date;
      }
    } else {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      reportDateStr = `${day}.${month}.${year} ${hours}:${minutes}`;
    }
    doc.text('Genereret: ' + reportDateStr, 14, y);
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
    
    const headers = ['Varenummer', 'Navn', 'Type', 'Land', 'Antal', 'Min', 'Pris'];
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
        // KRITISK FIX: Brug varenummer i stedet for vinId, og brug * i stedet for ★ for at undgå encoding problemer
        const varenummer = wine.varenummer || wine.vinId || '';
        const varenummerMarked = '* ' + varenummer;
        // Markér hele rækken med fed skrift for optalte vine
        doc.setFont(undefined, 'bold');
        const row = [
          varenummerMarked,
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
        // Gendan normal skrift efter optalte vine
        doc.setFont(undefined, 'normal');
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
  console.log('=== GENERER LAV STATUS RAPPORT START ===');
  
  try {
    // Tjek at alle nødvendige funktioner findes
    if (typeof apiCall !== 'function') {
      throw new Error('apiCall funktion ikke fundet');
    }
    if (typeof toLocalDateTimeString !== 'function') {
      throw new Error('toLocalDateTimeString funktion ikke fundet');
    }
    if (typeof formatDanskPris !== 'function') {
      throw new Error('formatDanskPris funktion ikke fundet');
    }
    
    console.log('✅ Alle nødvendige funktioner fundet');
    
    // KRITISK FIX: Brug allWines direkte i stedet for at kalde backend!
    // Backend returnerer tom data selvom frontend har data
    console.log('📦 Tjekker allWines...');
    console.log('  allWines:', allWines);
    console.log('  allWines.length:', allWines ? allWines.length : 'undefined');
    
    let wines = [];
    
    // FØRST: Prøv at bruge allWines direkte (data er allerede i frontend!)
    if (allWines && Array.isArray(allWines) && allWines.length > 0) {
      console.log('✅ Bruger allWines direkte:', allWines.length, 'vine');
      wines = allWines;
    } else {
      // FALLBACK: Hvis allWines er tom, prøv at hente fra backend
      console.log('⚠️ allWines er tom - prøver at hente fra backend...');
      try {
        wines = await apiCall('/api/reports/lager');
        console.log('📦 Hentet fra backend:', wines ? wines.length : 0, 'vine');
      } catch (apiError) {
        console.error('❌ API FEJL:', apiError);
        alert('FEJL: Kunne ikke hente data. Prøv at klikke på "Opdater" knappen først.');
        return;
      }
    }
    
    if (!wines || !Array.isArray(wines) || wines.length === 0) {
      console.warn('⚠️ Ingen vine fundet');
      alert('Ingen vine fundet. Klik på "Opdater" knappen eller importer data først.');
      return;
    }
    
    console.log('✅', wines.length, 'vine fundet - genererer rapport...');
    
    // Beregn total værdi
    let totalVærdi = 0;
    wines.forEach((w, i) => {
      const antal = parseInt(w.antal) || 0;
      const pris = parseFloat(w.indkøbspris) || 0;
      const værdi = antal * pris;
      totalVærdi += værdi;
      if (i < 3) {
        console.log(`  Vin ${i+1}: antal=${antal}, pris=${pris}, værdi=${værdi}`);
      }
    });
    
    console.log(`💰 Total værdi: ${totalVærdi}`);
    
    // Opret rapport objekt
    const dateStr = toLocalDateTimeString();
    const reportId = Date.now().toString();
    
    const report = {
      reportId: reportId,
      date: dateStr,
      name: 'OPTA-' + reportId.slice(-6),
      type: 'lager',
      wineCount: wines.length,
      totalValue: totalVærdi,
      location: 'Lokal',
      archived: false
    };
    
    console.log('💾 Rapport objekt:', report);
    
    // SIKKER: Gem i localStorage FØRST
    const reportForStorage = {
      id: report.reportId,
      date: report.date,
      name: report.name,
      type: report.type,
      wineCount: report.wineCount,
      totalValue: report.totalValue,
      location: report.location,
      archived: report.archived
    };
    
    // Hent eksisterende rapporter
    let existingReports = [];
    try {
      const saved = localStorage.getItem('reportsHistory');
      if (saved) {
        existingReports = JSON.parse(saved);
        if (!Array.isArray(existingReports)) {
          existingReports = [];
        }
      }
    } catch (e) {
      console.warn('⚠️ Fejl ved læsning af localStorage:', e);
      existingReports = [];
    }
    
    // Tilføj ny rapport
    existingReports.unshift(reportForStorage);
    if (existingReports.length > 200) {
      existingReports = existingReports.slice(0, 200);
    }
    
    // Gem i localStorage
    try {
      localStorage.setItem('reportsHistory', JSON.stringify(existingReports));
      console.log('✅ Gemt i localStorage:', existingReports.length, 'rapporter');
    } catch (e) {
      console.error('❌ Fejl ved gemning i localStorage:', e);
      alert('FEJL: Kunne ikke gemme i localStorage');
      return;
    }
    
    // Opdater global variabel
    if (typeof reportsHistory !== 'undefined') {
      reportsHistory = existingReports;
    }
    
    // Prøv at gemme i backend (ikke kritisk)
    try {
      await apiCall('/api/reports/save', {
        method: 'POST',
        body: JSON.stringify(report)
      });
      console.log('✅ Gemt i backend');
    } catch (e) {
      console.warn('⚠️ Kunne ikke gemme i backend (fortsætter alligevel):', e);
    }
    
    // Opdater UI
    try {
      if (typeof showBackupStatus === 'function') {
        showBackupStatus();
      }
    } catch (e) {
      console.warn('⚠️ showBackupStatus fejlede:', e);
    }
    
    try {
      if (typeof updateLocationFilter === 'function') {
        updateLocationFilter();
      }
    } catch (e) {
      console.warn('⚠️ updateLocationFilter fejlede:', e);
    }
    
    try {
      if (typeof renderReportsTable === 'function') {
        renderReportsTable();
      }
    } catch (e) {
      console.warn('⚠️ renderReportsTable fejlede:', e);
    }
    
    // Vis success
    const successMsg = `Rapport genereret! ${wines.length} vine, ${formatDanskPris(totalVærdi)} kr.`;
    console.log('✅ SUCCESS:', successMsg);
    alert(successMsg);
    
    if (typeof showSuccess === 'function') {
      showSuccess(successMsg);
    }
    
  } catch (error) {
    console.error('❌ KRITISK FEJL:', error);
    console.error('❌ Stack trace:', error.stack);
    const errorMsg = 'FEJL: ' + (error.message || 'Ukendt fejl');
    alert(errorMsg);
    
    if (typeof showError === 'function') {
      showError(errorMsg);
    }
  }
  
  console.log('=== GENERER LAV STATUS RAPPORT SLUT ===');
}

async function generateLagerReport(category = 'vin') {
  try {
    // KRITISK FIX: Brug korrekt data baseret på kategori
    let wines = [];
    if (category === 'ol-vand') {
      // Brug allOlVand for Øl & Vand
      if (allOlVand && Array.isArray(allOlVand) && allOlVand.length > 0) {
        console.log('✅ Bruger allOlVand direkte:', allOlVand.length, 'Øl & Vand produkter');
        wines = allOlVand;
      } else {
        console.warn('⚠️ allOlVand er tom - prøver at hente...');
        await loadOlVand();
        wines = allOlVand || [];
      }
    } else {
      // Brug allWines for VIN (filtreret)
      if (allWines && Array.isArray(allWines) && allWines.length > 0) {
        // Filtrer øl & vand fra
        wines = allWines.filter(w => {
          const kategori = (w.kategori || w.type || '').toLowerCase();
          const navn = (w.navn || '').toLowerCase();
          const vinId = (w.vinId || '').toLowerCase();
          if (vinId.startsWith('ol-') || /^w\d{4,}$/.test(vinId)) return false;
          const isOlVand = kategori.includes('øl') || kategori.includes('vand') || kategori.includes('sodavand') ||
                          kategori.includes('fadøl') || kategori.includes('flaske') || kategori.includes('dåse') ||
                          navn.includes('øl') || navn.includes('vand') || navn.includes('cola') || navn.includes('tonic') ||
                          navn.includes('ginger') || navn.includes('lemon') || navn.includes('appelsin') ||
                          kategori === 'ol' || kategori === 'vand' || kategori === 'sodavand';
          return !isOlVand;
        });
        console.log('✅ Bruger allWines direkte (filtreret):', wines.length, 'VIN');
      } else {
        console.warn('⚠️ allWines er tom - prøver backend...');
        wines = await apiCall('/api/reports/lager');
      }
    }
    
    if (!wines || !Array.isArray(wines) || wines.length === 0) {
      alert(`Ingen ${category === 'ol-vand' ? 'Øl & Vand' : 'vine'} fundet. Klik på "Opdater" knappen eller importer data først.`);
      return;
    }
    
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
    const headers = ['Varenummer', 'Navn', 'Type', 'Land', 'Antal', 'Min', 'Pris'];
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
    // KRITISK FIX: Brug allWines direkte!
    let wines = allWines && Array.isArray(allWines) && allWines.length > 0 ? allWines : await apiCall('/api/reports/lager');
    if (!wines || !Array.isArray(wines) || wines.length === 0) {
      alert('Ingen vine fundet. Klik på "Opdater" knappen eller importer data først.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let y = 20;
    doc.setFontSize(16);
    doc.text('Lagerrapport', 14, y);
    y += 10;

    doc.setFontSize(10);
    doc.text('Genereret: ' + new Date().toLocaleString('da-DK'), 14, y);
    y += 10;

    const headers = ['Varenummer', 'Navn', 'Type', 'Land', 'Antal', 'Min', 'Pris'];
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
      // KRITISK FIX: Brug varenummer i stedet for vinId
      const varenummer = wine.varenummer || wine.vinId || '';
      const row = [
        varenummer,
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
    // KRITISK FIX: Brug allWines direkte!
    let wines = allWines && Array.isArray(allWines) && allWines.length > 0 ? allWines : await apiCall('/api/reports/lager');
    if (!wines || !Array.isArray(wines) || wines.length === 0) {
      alert('Ingen vine fundet. Klik på "Opdater" knappen eller importer data først.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let y = 20;
  doc.setFontSize(16);
  doc.text('Lagerrapport', 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.text('Genereret: ' + new Date().toLocaleString('da-DK'), 14, y);
  y += 10;

  const headers = ['Varenummer', 'Navn', 'Type', 'Land', 'Antal', 'Min', 'Pris'];
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

async function generateVærdiReport(category = 'vin') {
  try {
    // KRITISK FIX: Brug korrekt data baseret på kategori
    let wines = [];
    if (category === 'ol-vand') {
      if (allOlVand && Array.isArray(allOlVand) && allOlVand.length > 0) {
        wines = allOlVand;
      } else {
        await loadOlVand();
        wines = allOlVand || [];
      }
    } else {
      // Filtrer kun VIN
      if (allWines && Array.isArray(allWines) && allWines.length > 0) {
        wines = allWines.filter(w => {
          const kategori = (w.kategori || w.type || '').toLowerCase();
          const navn = (w.navn || '').toLowerCase();
          const vinId = (w.vinId || '').toLowerCase();
          if (vinId.startsWith('ol-') || /^w\d{4,}$/.test(vinId)) return false;
          const isOlVand = kategori.includes('øl') || kategori.includes('vand') || kategori.includes('sodavand') ||
                          kategori.includes('fadøl') || kategori.includes('flaske') || kategori.includes('dåse') ||
                          navn.includes('øl') || navn.includes('vand') || navn.includes('cola') || navn.includes('tonic') ||
                          navn.includes('ginger') || navn.includes('lemon') || navn.includes('appelsin') ||
                          kategori === 'ol' || kategori === 'vand' || kategori === 'sodavand';
          return !isOlVand;
        });
      } else {
        const report = await apiCall('/api/reports/værdi');
        wines = report.wines || [];
      }
    }
    
    if (!wines || !Array.isArray(wines) || wines.length === 0) {
      alert(`Ingen ${category === 'ol-vand' ? 'Øl & Vand' : 'vine'} fundet.`);
      return;
    }
    
    // Beregn total værdi
    let totalVærdi = 0;
    wines.forEach(w => {
      const antal = parseInt(w.antal) || 0;
      const pris = parseFloat(w.indkøbspris) || 0;
      totalVærdi += antal * pris;
    });
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let y = 20;
    doc.setFontSize(16);
    doc.text(category === 'ol-vand' ? 'Værdirapport - Øl & Vand' : 'Værdirapport - Vin', 14, y);
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

  const headers = ['Varenummer', 'Navn', 'Antal', 'Pris', 'Værdi'];
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
    // KRITISK FIX: Brug varenummer i stedet for vinId
    const varenummer = wine.varenummer || wine.vinId || '';
    const row = [
      varenummer,
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
  window.uploadOlVandImage = uploadOlVandImage;
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
    // KRITISK FIX: Brug allWines direkte i stedet for backend!
    let wines = allWines && Array.isArray(allWines) && allWines.length > 0 ? allWines : await apiCall('/api/reports/lager');
    if (!wines || !Array.isArray(wines) || wines.length === 0) {
      console.warn('⚠️ Ingen vine fundet til rapport');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let y = 20;
    doc.setFontSize(16);
    doc.text('Lagerrapport - Optælling Afsluttet', 14, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.text('Genereret: ' + new Date().toLocaleString('da-DK'), 14, y);
    y += 10;
    
    const headers = ['Varenummer', 'Navn', 'Type', 'Land', 'Antal', 'Min', 'Pris'];
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
      // KRITISK FIX: Brug varenummer i stedet for vinId
      const varenummer = wine.varenummer || wine.vinId || '';
      const row = [
        varenummer,
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

// ============================================
// ØL & VAND FUNKTIONER
// ============================================

// Load Øl & Vand produkter (filtreret fra allWines baseret på kategori)
async function loadOlVand() {
  try {
    console.log('🔄 Henter Øl & Vand produkter...');
    
    // KRITISK: Prøv at hente data selv uden token (backend kan være åben)
    const token = localStorage.getItem('auth_token') || localStorage.getItem('jwt_token');
    if (!token) {
      console.warn('⚠️ Ingen auth token - prøver alligevel at hente Øl & Vand data');
    }
    
    // Hent alle produkter og filtrer efter kategori
    const allProducts = await apiCall('/api/wines');
    console.log('📦 Modtaget fra backend:', allProducts ? allProducts.length : 0, 'produkter');
    
    // Filtrer kun Øl & Vand (kategori = 'Øl' eller 'Vand' eller 'Sodavand' eller 'Fadøl' eller 'Flaske- & Dåseøl')
    // KRITISK: Tjek også vinId prefix (OL- eller WXXXX)
    const olVand = (allProducts || []).filter(p => {
      const kategori = (p.kategori || p.type || '').toLowerCase();
      const navn = (p.navn || '').toLowerCase();
      const vinId = (p.vinId || '').toLowerCase();
      
      // Hvis det starter med "OL-" eller "W" og er et nummer, er det øl & vand
      if (vinId.startsWith('ol-') || /^w\d{4,}$/.test(vinId)) {
        return true;
      }
      
      // Tjek både kategori og navn for at fange alle varianter
      return kategori.includes('øl') || kategori.includes('vand') || kategori.includes('sodavand') ||
             kategori.includes('fadøl') || kategori.includes('flaske') || kategori.includes('dåse') ||
             navn.includes('øl') || navn.includes('vand') || navn.includes('cola') || navn.includes('tonic') ||
             navn.includes('ginger') || navn.includes('lemon') || navn.includes('appelsin') ||
             kategori === 'ol' || kategori === 'vand' || kategori === 'sodavand';
    });
    
    allOlVand = olVand.map(p => {
      p.antal = parseInt(p.antal) || 0;
      p.minAntal = parseInt(p.minAntal) || 24;
      return p;
    });
    
    console.log(`✅ Hentet ${allOlVand.length} Øl & Vand produkter`);
    console.log('📋 Eksempel produkter:', allOlVand.slice(0, 3).map(p => ({
      vinId: p.vinId,
      navn: p.navn,
      kategori: p.kategori,
      antal: p.antal
    })));
    
    // Gem backup
    await saveOlVandBackup(allOlVand);
    
    // KRITISK: Opdater dashboard og tabel MED DET SAMME
    if (typeof updateDashboardOlVand === 'function') {
      updateDashboardOlVand();
      console.log('✅ Dashboard Øl & Vand opdateret');
    }
    if (typeof populateFiltersOlVand === 'function') {
      populateFiltersOlVand();
    }
    if (typeof populateLabelFiltersOlVand === 'function') {
      populateLabelFiltersOlVand();
    }
    if (typeof renderOlVandLager === 'function') {
      renderOlVandLager();
      console.log('✅ Tabel Øl & Vand opdateret');
    }
  } catch (error) {
    console.error('❌ Fejl ved indlæsning af Øl & Vand:', error.message);
    if (allOlVand && allOlVand.length > 0) {
      console.warn(`⚠️ API fejl, men beholder ${allOlVand.length} eksisterende produkter.`);
    }
    updateDashboardOlVand();
    renderOlVandLager();
  }
}

// Dashboard for Øl & Vand
function updateDashboardOlVand() {
  if (!allOlVand || !Array.isArray(allOlVand)) {
    allOlVand = [];
  }
  
  const antOlVand = allOlVand.length;
  const totalVærdi = allOlVand.reduce((sum, p) => {
    const pris = parseFloat(p.indkøbspris) || 0;
    const antal = parseInt(p.antal) || 0;
    return sum + (pris * antal);
  }, 0);
  
  const lavtLager = allOlVand.filter(p => {
    const antal = parseInt(p.antal) || 0;
    const minAntal = parseInt(p.minAntal) || 24;
    return antal < minAntal;
  }).length;
  
  const statAntOlVand = document.getElementById('stat-ant-ol-vand');
  const statVærdiOlVand = document.getElementById('stat-værdi-ol-vand');
  const statLavtOlVand = document.getElementById('stat-lavt-ol-vand');
  
  if (statAntOlVand) statAntOlVand.textContent = antOlVand;
  if (statVærdiOlVand) {
    if (typeof formatDanskPris === 'function') {
      statVærdiOlVand.textContent = `${formatDanskPris(totalVærdi)} kr.`;
    } else {
      statVærdiOlVand.textContent = `${totalVærdi.toFixed(2)} kr.`;
    }
  }
  if (statLavtOlVand) {
    statLavtOlVand.textContent = lavtLager;
    if (lavtLager > 0) {
      statLavtOlVand.classList.add('warning');
      statLavtOlVand.style.color = '#c00';
      statLavtOlVand.style.fontWeight = 'bold';
      statLavtOlVand.style.cursor = 'pointer';
      statLavtOlVand.onclick = () => showOlVandOversigt('lavt');
      statLavtOlVand.title = 'Klik for at se oversigt over Øl & Vand i lavt lager';
    } else {
      statLavtOlVand.classList.remove('warning');
      statLavtOlVand.style.color = '';
      statLavtOlVand.style.fontWeight = '';
      statLavtOlVand.style.cursor = '';
      statLavtOlVand.onclick = null;
      statLavtOlVand.title = '';
    }
  }
}

// Vis Øl & Vand oversigt modal
function showOlVandOversigt(type) {
  const modal = document.getElementById('vine-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalStats = document.getElementById('modal-stats');
  const modalTbody = document.getElementById('modal-vine-tbody');
  
  if (!modal) return;
  
  if (!allOlVand || !Array.isArray(allOlVand)) {
    allOlVand = [];
  }
  
  let filtered = allOlVand;
  if (type === 'lavt') {
    filtered = allOlVand.filter(p => {
      const antal = parseInt(p.antal) || 0;
      const minAntal = parseInt(p.minAntal) || 24;
      return antal < minAntal;
    });
  }
  
  modalTitle.textContent = type === 'lavt' ? 'Øl & Vand i lavt lager' : 'Alle Øl & Vand';
  modalStats.innerHTML = `<strong>${filtered.length}</strong> produkter`;
  
  modalTbody.innerHTML = '';
  filtered.forEach(p => {
    const antal = parseInt(p.antal) || 0;
    const minAntal = parseInt(p.minAntal) || 24;
    const status = antal < minAntal ? '🔴 Lavt' : antal < minAntal * 1.5 ? '🟡 OK' : '🟢 Godt';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${p.varenummer || p.vinId || ''}</td>
      <td>${p.navn || ''}</td>
      <td>${p.kategori || p.type || ''}</td>
      <td>${p.lokation || ''}</td>
      <td>${antal}</td>
      <td>${minAntal}</td>
      <td>${status}</td>
    `;
    modalTbody.appendChild(row);
  });
  
  modal.style.display = 'flex';
}

// Render Øl & Vand lager tabel
function renderOlVandLager() {
  console.log('🎨 renderOlVandLager() kaldt');
  console.log(`📊 allOlVand har ${allOlVand ? allOlVand.length : 0} produkter`);
  
  if (!allOlVand || !Array.isArray(allOlVand)) {
    console.warn('⚠️ allOlVand er ikke et array - initialiserer til tom array');
    allOlVand = [];
  }
  
  const tbody = document.getElementById('ol-vand-lager-tbody');
  if (!tbody) {
    console.error('❌ ol-vand-lager-tbody element ikke fundet!');
    return;
  }
  
  console.log(`📋 Renderer ${allOlVand.length} produkter i tabel...`);
  
  const lokationFilter = document.getElementById('filter-lokation-ol-vand')?.value || '';
  const reolFilter = document.getElementById('filter-reol-ol-vand')?.value || '';
  const hyldeFilter = document.getElementById('filter-hylde-ol-vand')?.value || '';
  
  let filtered = allOlVand;
  
  if (lokationFilter) {
    filtered = filtered.filter(p => p.lokation === lokationFilter);
  }
  if (reolFilter) {
    filtered = filtered.filter(p => p.reol === reolFilter);
  }
  if (hyldeFilter) {
    filtered = filtered.filter(p => p.hylde === hyldeFilter);
  }
  
  tbody.innerHTML = '';
  
  if (filtered.length === 0) {
    if (allOlVand.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 20px; color: #999;">Ingen Øl & Vand produkter fundet. Importer data først.</td></tr>';
      console.log('⚠️ Ingen produkter at vise (tom array)');
    } else {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 20px; color: #999;">Ingen produkter matcher de valgte filtre. Prøv at rydde filtrene.</td></tr>';
      console.log(`⚠️ ${allOlVand.length} produkter i array, men ingen matcher filtrene`);
    }
    return;
  }
  
  console.log(`✅ Renderer ${filtered.length} produkter...`);
  
  filtered.forEach(p => {
    const antal = parseInt(p.antal) || 0;
    const minAntal = parseInt(p.minAntal) || 24;
    const status = antal < minAntal ? 'low' : antal < minAntal * 1.5 ? 'medium' : 'good';
    
    const row = document.createElement('tr');
    row.className = status;
    row.innerHTML = `
      <td>${p.vinId || ''}</td>
      <td>${p.varenummer || ''}</td>
      <td>${p.navn || ''}</td>
      <td>${p.type || ''}</td>
      <td>${p.kategori || ''}</td>
      <td>${p.lokation || ''}</td>
      <td>${p.reol || ''}</td>
      <td>${p.hylde || ''}</td>
      <td class="text-right">${antal}</td>
      <td class="text-right">${minAntal}</td>
      <td class="text-right">${(p.indkøbspris || 0).toFixed(2)}</td>
      <td>
        ${p.billede ? `<img src="${p.billede}" style="max-width: 50px; max-height: 50px; cursor: pointer;" onclick="showImageModal('${p.billede}')">` : 
          `<div onclick="const input = document.getElementById('image-input-${p.vinId}'); if(input) input.click();" 
               style="border: 2px dashed #ccc; padding: 8px; text-align: center; cursor: pointer; border-radius: 4px; background: #fafafa; display: inline-block;">
            <div style="font-size: 16px; color: #999;">+</div>
            <div style="font-size: 10px; color: #666;">Billede</div>
          </div>
          <input type="file" id="image-input-${p.vinId}" accept="image/*" style="display: none;" 
                 onchange="uploadOlVandImage(this, '${p.vinId}')">`}
      </td>
    `;
    tbody.appendChild(row);
  });
  
  console.log(`✅ Tabel opdateret med ${filtered.length} rækker`);
}

// Populate filters for Øl & Vand
function populateFiltersOlVand() {
  if (!allOlVand || !Array.isArray(allOlVand)) {
    return;
  }
  
  const lokationSelect = document.getElementById('filter-lokation-ol-vand');
  const reolSelect = document.getElementById('filter-reol-ol-vand');
  const hyldeSelect = document.getElementById('filter-hylde-ol-vand');
  
  if (lokationSelect) {
    const lokationer = [...new Set(allOlVand.map(p => p.lokation).filter(Boolean))].sort();
    lokationSelect.innerHTML = '<option value="">Alle lokationer</option>';
    lokationer.forEach(loc => {
      const option = document.createElement('option');
      option.value = loc;
      option.textContent = loc;
      lokationSelect.appendChild(option);
    });
  }
  
  if (reolSelect) {
    const reoler = [...new Set(allOlVand.map(p => p.reol).filter(Boolean))].sort();
    reolSelect.innerHTML = '<option value="">Alle reoler</option>';
    reoler.forEach(reol => {
      const option = document.createElement('option');
      option.value = reol;
      option.textContent = reol;
      reolSelect.appendChild(option);
    });
  }
  
  if (hyldeSelect) {
    const hylder = [...new Set(allOlVand.map(p => p.hylde).filter(Boolean))].sort();
    hyldeSelect.innerHTML = '<option value="">Alle hylder</option>';
    hylder.forEach(hylde => {
      const option = document.createElement('option');
      option.value = hylde;
      option.textContent = hylde;
      hyldeSelect.appendChild(option);
    });
  }
}

// Apply filter for Øl & Vand
function applyFilterOlVand() {
  renderOlVandLager();
}

// Clear filter for Øl & Vand
function clearFilterOlVand() {
  const lokationSelect = document.getElementById('filter-lokation-ol-vand');
  const reolSelect = document.getElementById('filter-reol-ol-vand');
  const hyldeSelect = document.getElementById('filter-hylde-ol-vand');
  
  if (lokationSelect) lokationSelect.value = '';
  if (reolSelect) reolSelect.value = '';
  if (hyldeSelect) hyldeSelect.value = '';
  
  renderOlVandLager();
}

// Backup for Øl & Vand
async function saveOlVandBackup(products) {
  if (!products || !Array.isArray(products) || products.length === 0) {
    return;
  }
  
  try {
    localStorage.setItem('olVandBackup', JSON.stringify(products));
    localStorage.setItem('olVandBackup_date', new Date().toISOString());
    console.log('💾 Øl & Vand backup gemt:', products.length, 'produkter');
  } catch (e) {
    console.warn('⚠️ Kunne ikke gemme Øl & Vand backup:', e);
  }
}

// Generer lav status rapport for Øl & Vand
async function generateLavStatusRapportOlVand() {
  console.log('=== GENERER LAV STATUS RAPPORT ØL & VAND START ===');
  
  try {
    // Hent Øl & Vand data
    if (!allOlVand || !Array.isArray(allOlVand) || allOlVand.length === 0) {
      await loadOlVand();
    }
    
    if (!allOlVand || !Array.isArray(allOlVand) || allOlVand.length === 0) {
      alert('Ingen Øl & Vand produkter fundet. Importer data først.');
      return;
    }
    
    // Filtrer kun lavt lager
    const lavtLager = allOlVand.filter(p => {
      const antal = parseInt(p.antal) || 0;
      const minAntal = parseInt(p.minAntal) || 24;
      return antal < minAntal;
    });
    
    if (lavtLager.length === 0) {
      alert('Ingen Øl & Vand produkter i lavt lager.');
      return;
    }
    
    // Beregn total værdi
    let totalVærdi = 0;
    lavtLager.forEach(p => {
      const antal = parseInt(p.antal) || 0;
      const pris = parseFloat(p.indkøbspris) || 0;
      totalVærdi += antal * pris;
    });
    
    // Generer PDF (samme struktur som vin rapport)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let y = 20;
    doc.setFontSize(16);
    doc.text('Lav Status Rapport - Øl & Vand', 14, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.text('Genereret: ' + new Date().toLocaleString('da-DK'), 14, y);
    y += 10;
    
    const headers = ['Varenummer', 'Navn', 'Kategori', 'Type', 'Antal', 'Min', 'Pris'];
    const colWidths = [30, 60, 30, 30, 15, 15, 30];
    let x = 14;
    
    doc.setFontSize(8);
    headers.forEach((header, i) => {
      doc.text(header, x, y);
      x += colWidths[i];
    });
    y += 6;
    
    lavtLager.forEach(p => {
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
      
      const pris = p.indkøbspris || 0;
      const antal = parseInt(p.antal) || 0;
      
      x = 14;
      const row = [
        p.varenummer || p.vinId || '',
        p.navn || '',
        p.kategori || '',
        p.type || '',
        antal,
        p.minAntal || 24,
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
    saveReportToHistory('OPTA-OL-' + Date.now().toString().slice(-6), 'lager-ol-vand', lavtLager.length, totalVærdi);
    
    // Åbn PDF
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    showSuccess(`Lav status rapport genereret! ${lavtLager.length} Øl & Vand produkter i lavt lager.`);
    
  } catch (error) {
    console.error('❌ FEJL:', error);
    alert('Fejl ved generering af rapport: ' + error.message);
  }
  
  console.log('=== GENERER LAV STATUS RAPPORT ØL & VAND SLUT ===');
}

  // Øl & Vand funktioner
  // Eksporter globalt så den kan bruges i doImport
  window.loadOlVand = loadOlVand;
  if (typeof loadOlVand === 'function') {
    console.log('✅ loadOlVand eksporteret globalt');
  } else {
    console.error('❌ loadOlVand kunne ikke eksporteres!');
  }
  window.updateDashboardOlVand = updateDashboardOlVand;
  window.showOlVandOversigt = showOlVandOversigt;
  window.renderOlVandLager = renderOlVandLager;
  window.populateFiltersOlVand = populateFiltersOlVand;
  window.populateLabelFilters = populateLabelFilters;
  window.populateLabelFiltersOlVand = populateLabelFiltersOlVand;
  window.applyFilterOlVand = applyFilterOlVand;
  window.clearFilterOlVand = clearFilterOlVand;
  
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
  window.gendanLagerFraBackup = gendanLagerFraBackup;
  window.downloadLagerBackupCSV = downloadLagerBackupCSV;
  window.hentRapporterFraBackup = hentRapporterFraBackup;
  window.restoreWinesFromBackup = restoreWinesFromBackup;
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
  
  if (!qrContainer) {
    console.error('QR container ikke fundet!');
    return;
  }
  
  if (!linkText) {
    console.error('Link text element ikke fundet!');
  }
  
  // Få den fulde URL til scanner-siden
  // Brug window.location.href og fjern filnavn, tilføj scanner.html
  let baseUrl = window.location.origin;
  const pathParts = window.location.pathname.split('/').filter(p => p);
  if (pathParts.length > 0) {
    // Fjern sidste del (filnavn)
    pathParts.pop();
    if (pathParts.length > 0) {
      baseUrl += '/' + pathParts.join('/') + '/';
    } else {
      baseUrl += '/';
    }
  } else {
    baseUrl += '/';
  }
  const scannerUrl = baseUrl + 'scanner.html';
  
  console.log('📱 Genererer QR-kode for scanner:', scannerUrl);
  
  // Vis link
  if (linkText) {
    linkText.textContent = scannerUrl;
    linkText.style.wordBreak = 'break-all';
  }
  
  // Generer QR-kode hvis QRCode biblioteket er tilgængelig
  if (typeof QRCode !== 'undefined') {
    try {
      qrContainer.innerHTML = '';
      new QRCode(qrContainer, {
        text: scannerUrl,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 1
      });
      console.log('✅ QR-kode genereret');
    } catch (error) {
      console.error('Fejl ved generering af QR-kode:', error);
      qrContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; border: 2px solid #f00;">
          <p style="color: #c00;">Fejl ved generering af QR-kode</p>
          <p style="font-size: 0.9em; color: #666; margin-top: 10px;">${scannerUrl}</p>
          <p style="font-size: 0.8em; color: #999; margin-top: 5px;">Kopier linket og åbn det manuelt</p>
        </div>
      `;
    }
  } else {
    // Fallback hvis QRCode ikke er indlæst
    console.warn('⚠️ QRCode bibliotek ikke indlæst');
    qrContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; border: 2px solid #f60;">
        <p style="color: #f60;">QR-kode bibliotek indlæser...</p>
        <p style="font-size: 0.9em; color: #666; margin-top: 10px; word-break: break-all;">${scannerUrl}</p>
        <p style="font-size: 0.8em; color: #999; margin-top: 5px;">Kopier linket og åbn det manuelt hvis QR-koden ikke vises</p>
      </div>
    `;
    // Prøv igen efter lidt tid
    setTimeout(() => {
      if (typeof QRCode !== 'undefined') {
        generateScannerQR();
      } else {
        console.error('❌ QRCode bibliotek kunne ikke indlæses');
      }
    }, 2000);
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
