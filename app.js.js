
/**
 * app.js — STABILIZED (LOGIN FIRST)
 * Rules:
 * - Nothing runs before login is confirmed
 * - All DOM access is guarded
 * - Single controlled initialization
 * - Safe on GitHub Pages
 */

'use strict';

function $(id) { return document.getElementById(id); }
function exists(id) { return !!document.getElementById(id); }
function safe(fn) { try { fn(); } catch (e) { console.error(e); } }

let APP_READY = false;
let LOGGED_IN = false;

async function ensureLogin() {
  if (typeof checkLoginStatus === 'function') {
    await checkLoginStatus();
  }
  const loginScreen = $('login-screen');
  LOGGED_IN = !loginScreen || loginScreen.style.display === 'none';
  return LOGGED_IN;
}

async function initApp() {
  if (APP_READY) return;
  const ok = await ensureLogin();
  if (!ok) {
    console.warn('⛔ Login required. App init halted.');
    return;
  }
  APP_READY = true;
  console.log('✅ Login confirmed. Initializing app…');

  safe(() => typeof setupNavigation === 'function' && setupNavigation());
  safe(() => typeof setupFileInput === 'function' && setupFileInput());

  safe(async () => {
    if (typeof loadWines === 'function') await loadWines();
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof renderLager === 'function') renderLager();
  });

  safe(async () => {
    if (typeof loadOlVand === 'function') await loadOlVand();
    if (typeof updateDashboardOlVand === 'function') updateDashboardOlVand();
    if (typeof renderOlVandLager === 'function') renderOlVandLager();
  });
}

const _renderLager = window.renderLager;
window.renderLager = function () {
  if (!APP_READY) return;
  if (!exists('lager')) return;
  if (!exists('lager-tbody')) return;
  return _renderLager && _renderLager();
};

const _renderOlVandLager = window.renderOlVandLager;
window.renderOlVandLager = function () {
  if (!APP_READY) return;
  if (!exists('ol-vand')) return;
  if (!exists('ol-vand-lager-tbody')) return;
  return _renderOlVandLager && _renderOlVandLager();
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready. Waiting for login…');
  const t = setInterval(async () => {
    if (await ensureLogin()) {
      clearInterval(t);
      initApp();
    }
  }, 500);
});
