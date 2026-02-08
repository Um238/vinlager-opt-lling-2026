function renderLager() {
  console.log('=== RENDERLAGER START ===');

  if (!Array.isArray(allWines)) {
    console.warn('⚠️ allWines er ikke et array – afbryder renderLager');
    return;
  }

  const tbody = document.getElementById('lager-tbody');
  if (!tbody) {
    console.error('❌ lager-tbody element ikke fundet – renderLager afbrudt');
    return;
  }

  // 🔒 SIKKER DOM-ADGANG (DEN VIGTIGE RETTELSE)
  const lokationEl = document.getElementById('filter-lokation');
  const reolEl     = document.getElementById('filter-reol');
  const hyldeEl    = document.getElementById('filter-hylde');

  const lokationFilter = lokationEl ? lokationEl.value : '';
  const reolFilter     = reolEl ? reolEl.value : '';
  const hyldeFilter    = hyldeEl ? hyldeEl.value : '';

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

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="14" style="text-align:center;padding:20px;color:#666;">
          Ingen vine matcher filtrene
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(wine => {
    const row = document.createElement('tr');

    const antal = parseInt(wine.antal) || 0;
    const minAntal = parseInt(wine.minAntal) || 24;

    row.innerHTML = `
      <td>${wine.vinId || ''}</td>
      <td>${wine.varenummer || ''}</td>
      <td>${wine.navn || ''}</td>
      <td>${wine.type || ''}</td>
      <td>${wine.land || ''}</td>
      <td>${wine.region || ''}</td>
      <td>${wine.årgang || ''}</td>
      <td>${wine.lokation || ''}</td>
      <td>${wine.reol || ''}</td>
      <td>${wine.hylde || ''}</td>
      <td class="text-right">${antal}</td>
      <td class="text-right">${minAntal}</td>
      <td class="text-right">${wine.indkøbspris || ''}</td>
      <td></td>
    `;

    tbody.appendChild(row);
  });

  console.log(`✅ renderLager færdig (${filtered.length} vine)`);
}
