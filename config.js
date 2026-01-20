// Backend konfiguration
// SIMPEL: Brug altid localhost når du kører lokalt
(function() {
  'use strict';
  window.CONFIG = {
    API_URL: 'https://vinlager-opt-lling-2026.onrender.com',
    TIMEOUT: 10000
  };
  // Sæt også global CONFIG for kompatibilitet
  if (typeof CONFIG === 'undefined') {
    window.CONFIG = window.CONFIG;
  }
})();
