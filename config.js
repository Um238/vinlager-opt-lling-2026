// Backend konfiguration
// Til lokalt kørsel: http://localhost:3000
// Til cloud: sæt din backend URL her
const CONFIG = {
  API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://din-backend-url.herokuapp.com', // Ændre til din cloud backend URL
  TIMEOUT: 10000
};

