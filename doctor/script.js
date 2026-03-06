// ════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════
const readings = { thermo: null, bp: null, spo2: null, glucose: null };
const connectionType = { thermo: null, bp: null, spo2: null, glucose: null };
const simIntervals = {};
const wavePoints = { thermo: [], bp: [], spo2: [], glucose: [] };

// BLE UUIDs (standard GATT health profiles)
const BLE_CONFIG = {
  thermo: {
    service: '00001809-0000-1000-8000-00805f9b34fb',
    char: '00002a1c-0000-1000-8000-00805f9b34fb',
    name: 'Health Thermometer'
  },
  bp: {
    service: '00001810-0000-1000-8000-00805f9b34fb',
    char: '00002a35-0000-1000-8000-00805f9b34fb',
    name: 'Blood Pressure'
  },
  spo2: {
    service: '00001822-0000-1000-8000-00805f9b34fb',
    char: '00002a5f-0000-1000-8000-00805f9b34fb',
    name: 'Pulse Oximeter'
  },
  glucose: {
    service: '00001808-0000-1000-8000-00805f9b34fb',
    char: '00002a18-0000-1000-8000-00805f9b34fb',
    name: 'Glucose'
  }
};

// Normal ranges for color coding
const NORMAL = {
  thermo: { min: 97.0, max: 99.5, absMin: 93, absMax: 108 },
  bp_sys: { min: 90, max: 130 },
  bp_dia: { min: 60, max: 85 },
  spo2: { min: 95, max: 100, absMin: 80, absMax: 100 },
  hr: { min: 60, max: 100, absMin: 30, absMax: 200 },
  glucose: { min: 70, max: 100, absMin: 40, absMax: 500 }
};

// ════════════════════════════════════════════
// SYMPTOMS
// ════════════════════════════════════════════
const SYMS = ["Fever","Headache","Fatigue","Cough","Sore Throat","Chest Pain",
  "Shortness of Breath","Dizziness","Nausea","Vomiting","Diarrhea",
  "Abdominal Pain","Back Pain","Joint Pain","Muscle Aches","Rash",
  "Swelling","Palpitations","Chills","Night Sweats","Loss of Appetite",
  "Excessive Thirst","Frequent Urination","Confusion","Blurred Vision",
  "Runny Nose","Weakness","Numbness","Anxiety","Weight Loss"];

const selectedSyms = new Set();
const tagsCont = document.getElementById('symTags');
SYMS.forEach(s => {
  const t = document.createElement('div');
  t.className = 'stag';
  t.textContent = s;
  t.onclick = () => {
    if (selectedSyms.has(s)) { selectedSyms.delete(s); t.classList.remove('on'); }
    else { selectedSyms.add(s); t.classList.add('on'); }
  };
  tagsCont.appendChild(t);
});

// ════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ════════════════════════════════════════════
// UI HELPERS
// ════════════════════════════════════════════
function setCardState(id, state) {
  const card = document.getElementById(`card-${id}`);
  card.className = `instrument-card ${state}`;
  const stateEl = document.getElementById(`state-${id}`);
  const labels = { connected:'Connected', reading:'Reading...', done:'Done', error:'Error', simulated:'Simulated', '':'Disconnected' };
  stateEl.textContent = labels[state] || state;
  stateEl.className = `inst-state ${state}`;
}

function setReadingDisplay(id, html) {
  document.getElementById(`display-${id}`).innerHTML = html;
}

function updateBar(id, pct, color) {
  const bar = document.getElementById(`bar-${id}`);
  bar.style.width = Math.min(100, Math.max(0, pct)) + '%';
  bar.style.background = color;
}

function updateReadiness(id, state) {
  const dot = document.getElementById(`rd-${id}`);
  dot.className = `r-dot ${state}`;
}

function setSystemStatus(state, text) {
  document.getElementById('systemDot').className = `status-dot ${state}`;
  document.getElementById('systemStatusText').textContent = text;
}

// ════════════════════════════════════════════
// READING RENDERER
// ════════════════════════════════════════════
function renderReading(id, data) {
  readings[id] = data;
  setCardState(id, 'done');

  let html = '';
  let pct = 50;
  let color = 'var(--green)';
  let abnormal = false;

  if (id === 'thermo') {
    const f = data.tempF;
    abnormal = f < NORMAL.thermo.min || f > NORMAL.thermo.max;
    if (f > 103) color = 'var(--red)';
    else if (abnormal) color = 'var(--yellow)';
    pct = ((f - NORMAL.thermo.absMin) / (NORMAL.thermo.absMax - NORMAL.thermo.absMin)) * 100;
    html = `<div><div class="reading-value" style="color:${abnormal ? color : 'var(--cyan)'}">${f.toFixed(1)}</div><div class="reading-unit">°F (${((f-32)*5/9).toFixed(1)} °C)</div></div>`;
  }
  else if (id === 'bp') {
    const s = data.sys, d = data.dia;
    const sAbn = s < NORMAL.bp_sys.min || s > NORMAL.bp_sys.max;
    const dAbn = d < NORMAL.bp_dia.min || d > NORMAL.bp_dia.max;
    abnormal = sAbn || dAbn;
    if (s > 160 || d > 100) color = 'var(--red)';
    else if (abnormal) color = 'var(--yellow)';
    pct = ((s - 60) / (200 - 60)) * 100;
    html = `<div><div class="reading-value" style="color:${abnormal ? color : 'var(--cyan)'};font-size:1.6rem">${s}/${d}</div><div class="reading-unit">mmHg · Pulse: ${data.pulse} bpm</div></div>`;
  }
  else if (id === 'spo2') {
    const sp = data.spo2, hr = data.hr;
    abnormal = sp < NORMAL.spo2.min;
    if (sp < 90) color = 'var(--red)';
    else if (sp < 95) color = 'var(--yellow)';
    pct = ((sp - 80) / 20) * 100;
    html = `<div><div class="reading-value" style="color:${abnormal ? color : 'var(--cyan)'}">${sp}%</div><div class="reading-unit">SpO₂ · HR: ${hr} bpm</div></div>`;
  }
  else if (id === 'glucose') {
    const g = data.glucose;
    abnormal = g < NORMAL.glucose.min || g > NORMAL.glucose.max;
    if (g > 200 || g < 60) color = 'var(--red)';
    else if (abnormal) color = 'var(--yellow)';
    pct = ((g - 40) / (300 - 40)) * 100;
    html = `<div><div class="reading-value" style="color:${abnormal ? color : 'var(--cyan)'}">${g}</div><div class="reading-unit">mg/dL (fasting)</div></div>`;
  }

  setReadingDisplay(id, html);
  updateBar(id, pct, color);
  updateReadiness(id, abnormal ? 'warn' : 'ok');
  checkAllReady();
}

function checkAllReady() {
  const allDone = Object.values(readings).every(r => r !== null);
  const someData = Object.values(readings).some(r => r !== null);
  if (allDone) {
    setSystemStatus('ready', 'ALL SENSORS READY');
    toast('✓ All instruments connected — Ready to diagnose', 'success');
  } else if (someData) {
    setSystemStatus('scanning', 'PARTIAL DATA');
  }
}

// ════════════════════════════════════════════
// BLE CONNECTION
// ════════════════════════════════════════════
async function connectBLE(id) {
  if (!navigator.bluetooth) {
    toast('⚠ Web Bluetooth not supported. Use Chrome on PC/Android', 'error-t');
    return;
  }
  try {
    setSystemStatus('scanning', `SCANNING BLE — ${id.toUpperCase()}`);
    setCardState(id, 'reading');
    document.getElementById(`proto-${id}`).textContent = 'Bluetooth BLE';
    toast(`Scanning for ${BLE_CONFIG[id].name} device...`);

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [BLE_CONFIG[id].service] }],
      optionalServices: [BLE_CONFIG[id].service]
    });

    toast(`Connecting to ${device.name || 'device'}...`);
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(BLE_CONFIG[id].service);
    const char = await service.getCharacteristic(BLE_CONFIG[id].char);

    connectionType[id] = 'BLE';
    document.getElementById(`ble-${id}`).classList.add('active');

    await char.startNotifications();
    char.addEventListener('characteristicvaluechanged', (e) => {
      const raw = parseBLEValue(id, e.target.value);
      if (raw) renderReading(id, raw);
    });

    setCardState(id, 'connected');
    toast(`✓ ${device.name || 'Device'} connected via BLE`, 'success');

  } catch(err) {
    setCardState(id, 'error');
    setSystemStatus('error', 'BLE ERROR');
    console.error(err);
    if (err.name === 'NotFoundError') toast('No device selected', '');
    else toast(`BLE Error: ${err.message}`, 'error-t');
  }
}

function parseBLEValue(id, dataView) {
  try {
    if (id === 'thermo') {
      const flags = dataView.getUint8(0);
      let temp = (dataView.getUint8(1) | (dataView.getUint8(2) << 8) | (dataView.getUint8(3) << 16));
      const exp = dataView.getInt8(4);
      const celsius = temp * Math.pow(10, exp);
      return { tempF: celsius * 9/5 + 32, tempC: celsius };
    }
    if (id === 'bp') {
      const flags = dataView.getUint8(0);
      const sys = dataView.getUint16(1, true);
      const dia = dataView.getUint16(3, true);
      const pulse = dataView.getUint16(14, true);
      return { sys, dia, pulse };
    }
    if (id === 'spo2') {
      const flags = dataView.getUint8(0);
      const spo2 = dataView.getUint8(1);
      const hr = dataView.getUint16(3, true);
      return { spo2, hr };
    }
    if (id === 'glucose') {
      const glucose = Math.round(dataView.getFloat32(3, true) * 100000);
      return { glucose };
    }
  } catch(e) { console.warn('BLE parse error', e); return null; }
}

// ════════════════════════════════════════════
// WEB SERIAL (USB)
// ════════════════════════════════════════════
async function connectSerial(id) {
  if (!navigator.serial) {
    toast('⚠ Web Serial requires Chrome on PC. Try USB with Chrome browser.', 'error-t');
    return;
  }
  try {
    setCardState(id, 'reading');
    setSystemStatus('scanning', `USB SERIAL — ${id.toUpperCase()}`);
    document.getElementById(`proto-${id}`).textContent = 'USB Serial';
    toast(`Select USB port for ${id}...`);

    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    connectionType[id] = 'SERIAL';
    document.getElementById(`ser-${id}`).classList.add('active');
    setCardState(id, 'connected');
    toast(`✓ USB Serial connected for ${id}`, 'success');

    const reader = port.readable.getReader();
    let buffer = '';

    (async () => {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += new TextDecoder().decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const parsed = parseSerialLine(id, line.trim());
          if (parsed) renderReading(id, parsed);
        }
      }
    })();

  } catch(err) {
    setCardState(id, 'error');
    if (err.name !== 'NotFoundError') toast(`Serial Error: ${err.message}`, 'error-t');
    else toast('No port selected', '');
  }
}

function parseSerialLine(id, line) {
  // Expected JSON format from microcontroller: {"temp":98.6} or {"sys":120,"dia":80,"pulse":72}
  try {
    const data = JSON.parse(line);
    if (id === 'thermo' && data.temp) return { tempF: data.temp, tempC: (data.temp - 32) * 5/9 };
    if (id === 'bp' && data.sys) return { sys: data.sys, dia: data.dia, pulse: data.pulse || 72 };
    if (id === 'spo2' && data.spo2) return { spo2: data.spo2, hr: data.hr || 75 };
    if (id === 'glucose' && data.glucose) return { glucose: data.glucose };
  } catch(e) {
    // Try plain value format: "98.6" or "120/80"
    if (id === 'thermo') { const v = parseFloat(line); if (v > 90 && v < 110) return { tempF: v, tempC:(v-32)*5/9 }; }
    if (id === 'spo2') { const v = parseInt(line); if (v > 50 && v <= 100) return { spo2: v, hr: 75 }; }
    if (id === 'glucose') { const v = parseInt(line); if (v > 30 && v < 600) return { glucose: v }; }
    if (id === 'bp' && line.includes('/')) {
      const [s, d] = line.split('/').map(Number);
      if (s > 50 && s < 250) return { sys: s, dia: d, pulse: 72 };
    }
  }
  return null;
}

// ════════════════════════════════════════════
// WiFi HTTP POLLING
// ════════════════════════════════════════════
async function connectWiFi(id) {
  const ip = prompt(`Enter device IP address for ${id.toUpperCase()} (e.g. 192.168.1.105):`, '192.168.1.100');
  if (!ip) return;

  const port = prompt('Enter port (default 80):', '80');
  const endpoint = `http://${ip}:${port || 80}/data`;

  setCardState(id, 'reading');
  setSystemStatus('scanning', `WIFI POLLING — ${id.toUpperCase()}`);
  document.getElementById(`proto-${id}`).textContent = `WiFi · ${ip}`;
  document.getElementById(`wifi-${id}`).classList.add('active');
  toast(`Connecting to ${endpoint}...`);

  let failCount = 0;
  connectionType[id] = 'WiFi';

  const pollInterval = setInterval(async () => {
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();

      failCount = 0;
      setCardState(id, 'connected');

      const parsed = parseWiFiData(id, data);
      if (parsed) renderReading(id, parsed);

    } catch(err) {
      failCount++;
      if (failCount >= 3) {
        clearInterval(pollInterval);
        setCardState(id, 'error');
        toast(`WiFi device ${id} unreachable`, 'error-t');
      }
    }
  }, 2000);

  simIntervals[`wifi-${id}`] = pollInterval;
}

function parseWiFiData(id, data) {
  if (id === 'thermo') return data.temp ? { tempF: data.temp, tempC: (data.temp-32)*5/9 } : null;
  if (id === 'bp') return data.sys ? { sys: data.sys, dia: data.dia, pulse: data.pulse || 72 } : null;
  if (id === 'spo2') return data.spo2 ? { spo2: data.spo2, hr: data.hr || 75 } : null;
  if (id === 'glucose') return data.glucose ? { glucose: data.glucose } : null;
  return null;
}

// ════════════════════════════════════════════
// SIMULATION (Demo Mode)
// ════════════════════════════════════════════
const SIM_VALUES = {
  thermo: () => ({ tempF: +(98 + Math.random() * 3.5).toFixed(1) }),
  bp: () => {
    const sys = Math.round(110 + Math.random() * 50);
    const dia = Math.round(65 + Math.random() * 30);
    return { sys, dia, pulse: Math.round(60 + Math.random() * 50) };
  },
  spo2: () => ({ spo2: Math.round(92 + Math.random() * 8), hr: Math.round(58 + Math.random() * 50) }),
  glucose: () => ({ glucose: Math.round(75 + Math.random() * 100) })
};

function simulateDevice(id) {
  if (simIntervals[id]) {
    clearInterval(simIntervals[id]);
    delete simIntervals[id];
  }

  setCardState(id, 'reading');
  document.getElementById(`proto-${id}`).textContent = 'Simulation Mode';
  connectionType[id] = 'SIMULATED';
  toast(`⚡ Simulating ${id} sensor readings...`);

  // Animate waveform
  startWaveform(id);

  // First reading
  setTimeout(() => {
    const data = SIM_VALUES[id]();
    data._simulated = true;
    renderReading(id, data);

    // Continuous live updates
    simIntervals[id] = setInterval(() => {
      const live = SIM_VALUES[id]();
      live._simulated = true;
      renderReading(id, live);
    }, 4000);

    updateReadiness(id, 'sim');
  }, 1200);
}

// ════════════════════════════════════════════
// WAVEFORM ANIMATION
// ════════════════════════════════════════════
function startWaveform(id) {
  const canvas = document.getElementById(`wave-${id}`);
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 300;
  canvas.height = 36;

  wavePoints[id] = [];
  let x = 0;

  const waveInterval = setInterval(() => {
    if (!document.getElementById(`card-${id}`).classList.contains('reading') &&
        !document.getElementById(`card-${id}`).classList.contains('done')) {
      clearInterval(waveInterval);
      return;
    }

    x++;
    const y = 18 + Math.sin(x * 0.3) * 10 + (Math.random() - 0.5) * 4;
    wavePoints[id].push({ x: (x % (canvas.width / 2)) * 2, y });
    if (wavePoints[id].length > canvas.width / 2) wavePoints[id].shift();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(0,229,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    wavePoints[id].forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }, 60);
}

// ════════════════════════════════════════════
// DIAGNOSIS
// ════════════════════════════════════════════
const STAGES = [
  'PARSING VITAL READINGS...',
  'CROSS-REFERENCING SYMPTOM MATRIX...',
  'RUNNING DIFFERENTIAL DIAGNOSIS...',
  'EVALUATING COMPLICATION RISKS...',
  'COMPILING CLINICAL REPORT...'
];

async function runDiagnosis() {
  const hasAny = Object.values(readings).some(r => r !== null);
  if (!hasAny) {
    toast('⚠ Connect at least one instrument or use Demo mode', 'error-t');
    return;
  }

  document.getElementById('btnDiagnose').disabled = true;

  // Show loading
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('visible');
  let si = 0;
  const stageInterval = setInterval(() => {
    document.getElementById('loadStageText').textContent = STAGES[si % STAGES.length];
    si++;
  }, 1200);

  // Build prompt
  const thermo = readings.thermo;
  const bp = readings.bp;
  const spo2 = readings.spo2;
  const glucose = readings.glucose;
  const simNote = Object.entries(connectionType).filter(([,v]) => v === 'SIMULATED').map(([k]) => k).join(', ');

  const vitalsBlock = [
    thermo ? `- Body Temperature: ${thermo.tempF.toFixed(1)}°F (${thermo.tempC ? thermo.tempC.toFixed(1) : ((thermo.tempF-32)*5/9).toFixed(1)}°C)` : null,
    bp ? `- Blood Pressure: ${bp.sys}/${bp.dia} mmHg  |  Pulse: ${bp.pulse} bpm` : null,
    spo2 ? `- SpO₂: ${spo2.spo2}%  |  Heart Rate: ${spo2.hr} bpm` : null,
    glucose ? `- Blood Glucose: ${glucose.glucose} mg/dL` : null,
  ].filter(Boolean).join('\n');

  const prompt = `You are an expert AI medical diagnostic system with access to real-time instrument data. Analyze all readings carefully and provide a thorough clinical assessment.

PATIENT PROFILE:
- Name: ${document.getElementById('patName').value || 'Not provided'}
- Age: ${document.getElementById('patAge').value || 'Not provided'}
- Gender: ${document.getElementById('patGender').value || 'Not provided'}
- Known Conditions/Medications: ${document.getElementById('patHistory').value || 'None reported'}

INSTRUMENT READINGS (auto-captured from medical hardware):
${vitalsBlock || 'No readings captured'}
${simNote ? `[Note: Simulated data for: ${simNote}]` : '[Source: Live hardware instruments]'}

SYMPTOMS REPORTED BY PATIENT:
${[...selectedSyms].join(', ') || 'None selected'}

PATIENT DESCRIPTION:
${document.getElementById('symText').value || 'No additional description provided'}

─────────────────────────────────────
Please provide a structured clinical diagnostic report with these sections:

**PRIMARY DIAGNOSIS** — State the most likely condition(s). Be specific.

**SEVERITY** — One word: LOW, MODERATE, or HIGH

**VITAL SIGNS ANALYSIS** — Analyze each instrument reading. Flag all abnormal values and explain clinical significance.

**CLINICAL REASONING** — How do the vitals + symptoms together point to this diagnosis?

**DIFFERENTIAL DIAGNOSES** — List 2–3 alternative possibilities to consider.

**RECOMMENDED INVESTIGATIONS** — Specific tests (lab, imaging, etc.) to confirm diagnosis.

**IMMEDIATE MANAGEMENT** — What the patient should do RIGHT NOW.

**EMERGENCY RED FLAGS** — Signs that require immediate ER visit.

Be detailed, clinically accurate, and use accessible language. Do not hedge excessively.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await res.json();
    const text = data.content?.map(b => b.text || '').join('\n') || 'Unable to generate report.';

    clearInterval(stageInterval);
    overlay.classList.remove('visible');

    displayResults(text);

  } catch(err) {
    clearInterval(stageInterval);
    overlay.classList.remove('visible');
    document.getElementById('btnDiagnose').disabled = false;
    toast('Connection error. Please retry.', 'error-t');
    console.error(err);
  }
}

function displayResults(text) {
  // Parse severity
  let sev = 'moderate', sevText = 'Moderate Risk', sevClass = 'sev-moderate';
  if (/SEVERITY[:\s*]+LOW/i.test(text)) { sev='low'; sevText='Low Risk'; sevClass='sev-low'; }
  else if (/SEVERITY[:\s*]+HIGH/i.test(text)) { sev='high'; sevText='High Risk ⚠'; sevClass='sev-high'; }

  // Parse diagnosis name
  let diagName = 'Diagnostic Assessment';
  const dm = text.match(/PRIMARY DIAGNOSIS[^:]*:\s*\*?\*?([^\n*]+)/i);
  if (dm) diagName = dm[1].trim().replace(/\*+/g,'');

  // Timestamp
  const now = new Date();
  const ts = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) + ' · ' +
             now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

  document.getElementById('rDiagName').textContent = diagName;
  document.getElementById('rTimestamp').textContent = `Generated ${ts}`;

  const pill = document.getElementById('rSeverity');
  pill.textContent = sevText;
  pill.className = `severity-pill ${sevClass}`;

  // Vitals chips
  const chips = document.getElementById('rVitalsChips');
  chips.innerHTML = '';

  const makeChip = (val, label, src, abnormal, borderline) => {
    const chip = document.createElement('div');
    chip.className = `vchip ${abnormal ? 'abnormal' : borderline ? 'borderline' : ''}`;
    chip.innerHTML = `<div class="vchip-val">${val}</div><div class="vchip-label">${label}</div><div class="vchip-src">${src}</div>`;
    chips.appendChild(chip);
  };

  if (readings.thermo) {
    const f = readings.thermo.tempF;
    makeChip(`${f.toFixed(1)}°F`, 'Temperature', connectionType.thermo, f > 103 || f < 96, f > 99.5 || f < 97);
  }
  if (readings.bp) {
    const abn = readings.bp.sys > 140 || readings.bp.dia > 90 || readings.bp.sys < 90;
    makeChip(`${readings.bp.sys}/${readings.bp.dia}`, 'BP mmHg', connectionType.bp, abn, readings.bp.sys > 130);
    makeChip(`${readings.bp.pulse} bpm`, 'Pulse', connectionType.bp, readings.bp.pulse > 100 || readings.bp.pulse < 60, false);
  }
  if (readings.spo2) {
    makeChip(`${readings.spo2.spo2}%`, 'SpO₂', connectionType.spo2, readings.spo2.spo2 < 90, readings.spo2.spo2 < 95);
    makeChip(`${readings.spo2.hr} bpm`, 'Heart Rate', connectionType.spo2, readings.spo2.hr > 100 || readings.spo2.hr < 60, false);
  }
  if (readings.glucose) {
    const g = readings.glucose.glucose;
    makeChip(`${g} mg/dL`, 'Glucose', connectionType.glucose, g > 200 || g < 60, g > 100 || g < 70);
  }

  // Format content
  const formatted = text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  document.getElementById('rContent').innerHTML = formatted;

  const resultsSection = document.getElementById('resultsSection');
  resultsSection.classList.add('visible');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('btnDiagnose').disabled = false;
  toast('✓ Diagnosis complete', 'success');
  setSystemStatus('ready', 'DIAGNOSIS COMPLETE');
}

// ════════════════════════════════════════════
// RESET
// ════════════════════════════════════════════
function resetAll() {
  // Clear simulations
  Object.keys(simIntervals).forEach(k => { clearInterval(simIntervals[k]); delete simIntervals[k]; });

  // Reset readings
  Object.keys(readings).forEach(k => readings[k] = null);
  Object.keys(connectionType).forEach(k => connectionType[k] = null);

  // Reset cards
  ['thermo','bp','spo2','glucose'].forEach(id => {
    setCardState(id, '');
    setReadingDisplay(id, '<div class="reading-placeholder">——— Awaiting Device ———</div>');
    updateBar(id, 0, 'var(--green)');
    document.getElementById(`proto-${id}`).textContent = 'BLE · USB · WiFi';
    document.querySelectorAll(`[id$=-${id}]`).forEach(b => b.classList.remove('active'));
    document.getElementById(`rd-${id}`).className = 'r-dot';
    wavePoints[id] = [];
  });

  // Reset symptoms
  selectedSyms.clear();
  document.querySelectorAll('.stag').forEach(t => t.classList.remove('on'));
  document.getElementById('symText').value = '';

  // Reset patient
  ['patName','patAge','patHistory'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('patGender').value = '';

  // Hide results
  document.getElementById('resultsSection').classList.remove('visible');

  setSystemStatus('', 'SYSTEM IDLE');
  document.getElementById('btnDiagnose').disabled = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast('System reset — ready for new patient');
}