/* ============================================================
   SolarMap CO — app.js
   Dashboard de viabilidad fotovoltaica · Colombia
   ============================================================ */

// ── REGION COLORS ────────────────────────────────────────────
const REGION_COLORS = {
  'Caribe':    '#f5a623',
  'Andina':    '#4ecdc4',
  'Amazonia':  '#56c568',
  'Orinoco':   '#e05c5c',
  'Orinoquía': '#e05c5c', // alias
  'Pacifico':  '#9b7fe8',
  'Pacífico':  '#9b7fe8', // alias con tilde
};

const REGION_LABELS = [
  { key: 'Caribe',    label: 'Caribe' },
  { key: 'Andina',    label: 'Andina' },
  { key: 'Amazonia',  label: 'Amazonia' },
  { key: 'Orinoco',   label: 'Orinoquía' },
  { key: 'Pacifico',  label: 'Pacífico' },
];

// Efficiency factor for PV system (temperature, shading, conversion losses)
const EFFICIENCY_FACTOR = 0.8;

// ── ECONOMIC CONSTANTS (Colombia 2025) ───────────────────────
// Fuente: Superintendencia de Servicios Públicos · abril 2025
// Promedio 11 principales distribuidoras: $937.81 COP/kWh
const TARIFA_KWH_COP = 938;

// Fuente: volting.com.co / integracionsolar.co 2025
// Rango sistema completo (paneles + inversor + instalación): $1.000.000–$1.200.000 COP/kWp
const COSTO_KWP_COP = 1_100_000;

// Vida útil garantizada de paneles solares
const VIDA_UTIL_ANIOS = 25;

// ── APPLIANCE CATEGORIES ─────────────────────────────────────
const APPLIANCE_CATEGORIES = [
  'Aire acondicionado', 'Bombillo LED', 'Ducha eléctrica',
  'Lavadora', 'Licuadora', 'Microondas', 'Nevera / Refrigerador',
  'Plancha', 'Portátil / Computador', 'Secadora', 'Televisor',
  'Ventilador', 'Horno eléctrico', 'Calentador de agua', 'Otro',
];

// ── MAP INIT ─────────────────────────────────────────────────
let map;

function initMap() {
  map = L.map('map', {
    center: [4.5709, -74.2973],
    zoom: 6,
    zoomControl: true,
  });

  // Dark tile layer (CartoDB Dark Matter)
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> | &copy; OpenStreetMap',
      subdomains: 'abcd',
      maxZoom: 19,
    }
  ).addTo(map);
}

// ── LOAD CSV & PLACE MARKERS ──────────────────────────────────
function loadCSVAndPlot() {
  Papa.parse('data.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      const rows = results.data;
      buildLegend(rows);
      rows.forEach(row => addMarker(row));
    },
    error: function (err) {
      console.error('Error al cargar data.csv:', err);
      showMapError();
    }
  });
}

function addMarker(row) {
  const lat  = parseFloat(row['Latitud']);
  const lng  = parseFloat(row['Longitud']);
  const rad  = parseFloat(row['Radiacion_kWh_m2_dia'] || row['Radiación_kWh_m2_día'] || 0);
  const region = (row['Region'] || row['Región'] || '').trim();
  const depto  = (row['Departamento'] || '').trim();
  const muni   = (row['Municipio']    || '').trim();

  if (isNaN(lat) || isNaN(lng)) return;

  const color = getRegionColor(region);

  // Custom circle marker
  const marker = L.circleMarker([lat, lng], {
    radius: 8,
    fillColor: color,
    color: '#0d0f14',
    weight: 1.5,
    fillOpacity: 0.9,
    opacity: 1,
  }).addTo(map);

  // Popup content
  const popupHTML = `
    <div class="popup-region" style="color:${color}">${region.toUpperCase()}</div>
    <div class="popup-title">${muni}</div>
    <div class="popup-row">
      <span>Departamento</span>
      <span>${depto}</span>
    </div>
    <div class="popup-row">
      <span>Coordenadas</span>
      <span>${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
    </div>
    <div class="popup-rad">
      <div>
        <div class="popup-rad-val">${rad.toFixed(2)}</div>
        <div class="popup-rad-lbl">kWh/m²/día</div>
      </div>
      <div style="text-align:right; font-size:10px; color:#8a90a8; line-height:1.5">
        Radiación<br/>solar promedio
      </div>
    </div>
  `;

  marker.bindPopup(popupHTML, {
    maxWidth: 240,
    className: 'solar-popup',
  });

  // Hover effect
  marker.on('mouseover', function () {
    this.setStyle({ radius: 11, weight: 2 });
    this.openPopup();
  });
  marker.on('mouseout', function () {
    this.setStyle({ radius: 8, weight: 1.5 });
    this.closePopup();
  });
  marker.on('click', function () {
    this.openPopup();
    // Pre-fill radiation input
    document.getElementById('radiacion').value = rad.toFixed(2);
  });
}

function getRegionColor(region) {
  const clean = region.trim();
  return REGION_COLORS[clean] || '#ffffff';
}

// ── LEGEND ───────────────────────────────────────────────────
function buildLegend(rows) {
  const found = new Set(rows.map(r => (r['Region'] || r['Región'] || '').trim()));
  const container = document.getElementById('legendItems');
  container.innerHTML = '';

  REGION_LABELS.forEach(({ key, label }) => {
    if (![...found].some(f => f === key || f === label || normalizeRegion(f) === normalizeRegion(key))) return;
    const color = REGION_COLORS[key];
    const item  = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-dot" style="background:${color}"></span>
      <span>${label}</span>
    `;
    container.appendChild(item);
  });
}

function normalizeRegion(str) {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

function showMapError() {
  const mapEl = document.getElementById('map');
  mapEl.style.display = 'flex';
  mapEl.style.alignItems = 'center';
  mapEl.style.justifyContent = 'center';
  mapEl.style.color = '#e05c5c';
  mapEl.style.fontFamily = 'Space Mono, monospace';
  mapEl.style.fontSize = '13px';
  mapEl.innerHTML = '⚠ No se pudo cargar data.csv — asegúrate de servir desde un servidor HTTP';
}

// ── APPLIANCE TABLE LOGIC ─────────────────────────────────────
const numElectroSelect  = document.getElementById('numElectro');
const electrosContainer = document.getElementById('electrosContainer');
const electrosRows      = document.getElementById('electrosRows');
const btnCalc           = document.getElementById('btnCalc');
const resultados        = document.getElementById('resultados');

numElectroSelect.addEventListener('change', function () {
  const n = parseInt(this.value);
  if (isNaN(n) || n < 1) {
    electrosContainer.classList.add('hidden');
    btnCalc.classList.add('hidden');
    resultados.classList.add('hidden');
    return;
  }
  buildApplianceRows(n);
  electrosContainer.classList.remove('hidden');
  btnCalc.classList.remove('hidden');
  resultados.classList.add('hidden');
});

function buildApplianceRows(n) {
  electrosRows.innerHTML = '';
  for (let i = 1; i <= n; i++) {
    const row = document.createElement('div');
    row.className = 'electro-row';
    row.style.animationDelay = `${(i - 1) * 30}ms`;

    // Category select
    const catOptions = APPLIANCE_CATEGORIES
      .map(c => `<option value="${c}">${c}</option>`)
      .join('');

    row.innerHTML = `
      <select class="e-cat">
        ${catOptions}
      </select>
      <input type="number" class="e-qty"   placeholder="1"    min="1"   step="1"   value="1" />
      <input type="number" class="e-power" placeholder="W"    min="1"   step="1"   />
      <input type="number" class="e-hours" placeholder="h/d"  min="0.1" step="0.1" />
    `;
    electrosRows.appendChild(row);
  }
}

// ── CALCULATION ───────────────────────────────────────────────
btnCalc.addEventListener('click', calcularViabilidad);

function calcularViabilidad() {
  // Inputs
  const radiacion        = parseFloat(document.getElementById('radiacion').value);
  const potenciaInstalada = parseFloat(document.getElementById('potenciaInstalada').value);

  if (isNaN(radiacion) || radiacion <= 0) {
    alert('Por favor ingresa la radiación solar obtenida del mapa (kWh/m²/día).');
    return;
  }
  if (isNaN(potenciaInstalada) || potenciaInstalada <= 0) {
    alert('Por favor ingresa la potencia instalada del sistema fotovoltaico (kWp).');
    return;
  }

  // ── Consumo mensual ─────────────────────────────────────
  // Consumo mensual (kWh) = Σ [Potencia_i (W) × Horas_i (h/día) × 30] / 1000
  const rows    = document.querySelectorAll('.electro-row');
  let consumoMensual = 0;
  let valid = true;

  rows.forEach((row, i) => {
    const qty   = parseFloat(row.querySelector('.e-qty').value)   || 1;
    const power = parseFloat(row.querySelector('.e-power').value);
    const hours = parseFloat(row.querySelector('.e-hours').value);

    if (isNaN(power) || isNaN(hours)) {
      valid = false;
      row.querySelectorAll('input').forEach(inp => {
        if (isNaN(parseFloat(inp.value))) inp.style.borderColor = '#e05c5c';
      });
    } else {
      row.querySelectorAll('input').forEach(inp => inp.style.borderColor = '');
      consumoMensual += qty * power * hours * 30 / 1000;
    }
  });

  if (!valid) {
    alert('Completa la potencia (W) y las horas de uso de cada electrodoméstico.');
    return;
  }

  // ── Generación mensual ──────────────────────────────────
  // Generación diaria (kWh) = Potencia instalada (kWp) × HPS × Factor eficiencia
  // HPS ≈ radiación solar (kWh/m²/día)
  const generacionDiaria  = potenciaInstalada * radiacion * EFFICIENCY_FACTOR;
  const generacionMensual = generacionDiaria * 30;

  // ── Cobertura ───────────────────────────────────────────
  const coberturaPct = consumoMensual > 0
    ? Math.min((generacionMensual / consumoMensual) * 100, 999)
    : 100;

  // ── Inversión & ROI ─────────────────────────────────────
  // kWp necesarios para cubrir el consumo real del hogar
  // kWp = Consumo mensual (kWh) / (Radiación × 30 días × Factor eficiencia)
  const kWpNecesarios = consumoMensual / (radiacion * 30 * EFFICIENCY_FACTOR);

  // Inversión inicial = kWp necesarios × costo promedio por kWp (Colombia 2025)
  const inversionInicial = kWpNecesarios * COSTO_KWP_COP;

  // Ahorro mensual = kWh generados que reemplazan red × tarifa COP/kWh
  // Solo contamos la energía que efectivamente cubre consumo (no el excedente)
  const kWhCubiertos  = Math.min(generacionMensual, consumoMensual);
  const ahorroMensual = kWhCubiertos * TARIFA_KWH_COP;
  const ahorroAnual   = ahorroMensual * 12;

  // ROI en meses y años
  const roiMeses = ahorroMensual > 0 ? inversionInicial / ahorroMensual : Infinity;
  const roiAnios = roiMeses / 12;

  // Ahorro total vida útil (25 años) descontando inversión
  const ahorroNeto25 = (ahorroAnual * VIDA_UTIL_ANIOS) - inversionInicial;

  // ── Display energía ─────────────────────────────────────
  document.getElementById('resConsumo').textContent    = consumoMensual.toFixed(1);
  document.getElementById('resGeneracion').textContent = generacionMensual.toFixed(1);
  document.getElementById('resCobertura').textContent  = coberturaPct.toFixed(1) + '%';

  // Coverage bar
  const bar = document.getElementById('coverageBar');
  const pctCapped = Math.min(coberturaPct, 100);
  bar.style.width = '0%';
  setTimeout(() => { bar.style.width = pctCapped + '%'; }, 50);
  bar.className = 'coverage-bar-fill';
  if (coberturaPct >= 80)      bar.classList.add('high');
  else if (coberturaPct >= 40) bar.classList.add('medium');
  else                         bar.classList.add('low');

  // ── Display económico ───────────────────────────────────
  document.getElementById('resKwpNec').textContent      = kWpNecesarios.toFixed(2);
  document.getElementById('resInversion').textContent   = formatCOP(inversionInicial);
  document.getElementById('resAhorroMes').textContent   = formatCOP(ahorroMensual);
  document.getElementById('resAhorroAnio').textContent  = formatCOP(ahorroAnual);
  document.getElementById('resRoiMeses').textContent    = isFinite(roiMeses) ? Math.ceil(roiMeses) + ' meses' : '—';
  document.getElementById('resRoiAnios').textContent    = isFinite(roiAnios) ? roiAnios.toFixed(1) + ' años' : '—';
  document.getElementById('resNeto25').textContent      = formatCOP(ahorroNeto25);

  // ROI bar (max reference = VIDA_UTIL_ANIOS)
  const roiBar = document.getElementById('roiBar');
  const roiPct = isFinite(roiAnios) ? Math.min((roiAnios / VIDA_UTIL_ANIOS) * 100, 100) : 100;
  roiBar.style.width = '0%';
  setTimeout(() => { roiBar.style.width = roiPct + '%'; }, 80);
  roiBar.className = 'coverage-bar-fill';
  if (roiAnios <= 4)      roiBar.classList.add('high');
  else if (roiAnios <= 7) roiBar.classList.add('medium');
  else                    roiBar.classList.add('low');

  // Veredicto
  const veredictoEl  = document.getElementById('resVeredicto');
  const veredictoLbl = document.getElementById('resVeredictoLbl');
  veredictoEl.className = 'result-val result-veredicto';

  if (coberturaPct >= 80) {
    veredictoEl.textContent = '✓ VIABLE';
    veredictoEl.classList.add('veredicto-alto');
    veredictoLbl.textContent = 'El sistema solar cubre la mayor parte del consumo del hogar. Excelente retorno de inversión esperado.';
  } else if (coberturaPct >= 40) {
    veredictoEl.textContent = '~ PARCIAL';
    veredictoEl.classList.add('veredicto-medio');
    veredictoLbl.textContent = 'El sistema cubre una porción significativa del consumo. Considera ampliar la potencia instalada.';
  } else {
    veredictoEl.textContent = '✗ INSUFICIENTE';
    veredictoEl.classList.add('veredicto-bajo');
    veredictoLbl.textContent = 'La generación es baja en relación al consumo. Aumenta la potencia instalada o reduce el consumo.';
  }

  resultados.classList.remove('hidden');

  // Smooth scroll to results
  resultados.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── HELPERS ───────────────────────────────────────────────────
function formatCOP(value) {
  return '$' + Math.round(value).toLocaleString('es-CO') + ' COP';
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadCSVAndPlot();
});
