const MAX_FRAC_BITS = 20;
const HEX_CHARS = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];

let currentMode = 'from-decimal';
let results = { dec:'—', bin:'—', hex:'—', oct:'—' };
let stepsOpen = { dec:false, bin:false, hex:false, oct:false };
let currentIntPart = null;
let currentFracPart = null;
let hasDecimalPart = false;
let currentIsNegative = false;

const modeConfig = {
  'from-decimal': {
    label: 'Ingresá el número decimal',
    placeholder: 'Ej: 6,625 o -13 o 255',
    hint: true,
    validate: v => /^-?\d+([.,]\d+)?$/.test(v.trim()),
    errMsg: 'Formato inválido. Ejemplo: 6,625 o -13 o 255',
    parse: v => parseFloat(v.trim().replace(',','.')),
  },
  'from-binary': {
    label: 'Ingresá el número binario',
    placeholder: 'Ej: 110,101 o 11111111',
    hint: true,
    validate: v => /^[01]+([.,][01]+)?$/.test(v.trim()),
    errMsg: 'Solo se permiten 0 y 1 (usá coma o punto para decimales)',
    parse: v => parseBinaryFloat(v.trim().replace(',','.')),
  },
  'from-hex': {
    label: 'Ingresá el número hexadecimal',
    placeholder: 'Ej: FF o A,8',
    hint: false,
    validate: v => /^[0-9a-fA-F]+([.,][0-9a-fA-F]+)?$/.test(v.trim()),
    errMsg: 'Solo se permiten 0-9 y A-F',
    parse: v => parseHexFloat(v.trim().replace(',','.')),
  },
  'from-octal': {
    label: 'Ingresá el número octal',
    placeholder: 'Ej: 377 o 6,5',
    hint: true,
    validate: v => /^[0-7]+([.,][0-7]+)?$/.test(v.trim()),
    errMsg: 'Solo se permiten dígitos del 0 al 7',
    parse: v => parseOctalFloat(v.trim().replace(',','.')),
  },
};

// ── PARSERS ──

function parseBinaryFloat(str) {
  if (!str.includes('.')) return parseInt(str, 2);
  const [intPart, fracPart] = str.split('.');
  let val = parseInt(intPart, 2) || 0;
  fracPart.split('').forEach((b, i) => { val += parseInt(b) * Math.pow(2, -(i+1)); });
  return val;
}

function parseHexFloat(str) {
  if (!str.includes('.')) return parseInt(str, 16);
  const [intPart, fracPart] = str.split('.');
  let val = parseInt(intPart, 16) || 0;
  fracPart.split('').forEach((d, i) => { val += parseInt(d, 16) * Math.pow(16, -(i+1)); });
  return val;
}

function parseOctalFloat(str) {
  if (!str.includes('.')) return parseInt(str, 8);
  const [intPart, fracPart] = str.split('.');
  let val = parseInt(intPart, 8) || 0;
  fracPart.split('').forEach((d, i) => { val += parseInt(d) * Math.pow(8, -(i+1)); });
  return val;
}

// ── CONVERSIÓN CON PARTE FRACCIONARIA ──

function convertFracPart(frac, base) {
  const digits = [];
  const steps = [];
  let current = frac;
  let iterations = 0;
  while (current > 0 && iterations < MAX_FRAC_BITS) {
    const product = current * base;
    const intPart = Math.floor(product);
    const newFrac = product - intPart;
    steps.push({ frac: current, product, intPart, digit: base === 16 ? HEX_CHARS[intPart] : intPart });
    digits.push(base === 16 ? HEX_CHARS[intPart] : intPart);
    current = parseFloat(newFrac.toPrecision(15));
    iterations++;
  }
  return { digits, steps, isApprox: current > 0 };
}

function convertNumber(value, base) {
  const intPart = Math.floor(Math.abs(value));
  const fracPart = Math.abs(value) - intPart;
  const sign = value < 0 ? '-' : '';
  let intStr = intPart.toString(base).toUpperCase();
  if (fracPart === 0) return sign + intStr;
  const { digits, isApprox } = convertFracPart(fracPart, base);
  const fracStr = digits.join('');
  return sign + intStr + ',' + fracStr + (isApprox ? '…' : '');
}

// ── HELPER PARA COMPLEMENTO A 2 EN PASOS DE NEGATIVOS ──

function getC2BitWidth(magnitude) {
  if (magnitude === 0) return 8;
  const bits = Math.floor(Math.log2(magnitude)) + 2; // +1 para el valor, +1 para el bit de signo
  return Math.ceil(bits / 8) * 8;
}

// ── MODO ──

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.tab-btn').forEach((t, i) => {
    t.classList.toggle('active', ['from-decimal','from-binary','from-hex','from-octal'][i] === mode);
  });
  const cfg = modeConfig[mode];
  document.getElementById('input-label').textContent = cfg.label;
  document.getElementById('main-input').placeholder = cfg.placeholder;
  document.getElementById('input-hint').style.display = cfg.hint ? '' : 'none';
  clearInput();
  document.getElementById('main-input').focus();
}

// ── HANDLE INPUT ──

function handleInput() {
  const input = document.getElementById('main-input');
  const val = input.value;
  const errEl = document.getElementById('error-msg');

  if (!val.trim()) { clearResults(); errEl.textContent = ''; input.classList.remove('error'); return; }

  // El usuario todavía está escribiendo el signo negativo
  if (val.trim() === '-') { clearResults(); errEl.textContent = ''; input.classList.remove('error'); return; }

  const cfg = modeConfig[currentMode];
  if (!cfg.validate(val)) {
    input.classList.add('error'); errEl.textContent = cfg.errMsg; clearResults(); return;
  }

  input.classList.remove('error'); errEl.textContent = '';
  const floatValue = cfg.parse(val);
  if (!isFinite(floatValue)) { errEl.textContent = 'Número inválido'; clearResults(); return; }

  currentIsNegative = floatValue < 0;
  currentIntPart    = Math.floor(Math.abs(floatValue));
  currentFracPart   = Math.abs(floatValue) - currentIntPart;
  hasDecimalPart    = currentFracPart > 1e-12;

  results.dec = convertNumber(floatValue, 10).replace('.', ',');
  results.bin = convertNumber(floatValue, 2).replace('.', ',');
  results.hex = convertNumber(floatValue, 16).replace('.', ',');
  results.oct = convertNumber(floatValue, 8).replace('.', ',');

  document.getElementById('res-dec').textContent = results.dec;
  document.getElementById('res-bin').textContent = results.bin;
  document.getElementById('res-hex').textContent = results.hex;
  document.getElementById('res-oct').textContent = results.oct;

  ['dec','bin','hex','oct'].forEach(t => { if (stepsOpen[t]) buildSteps(t); });
}

function clearResults() {
  currentIntPart = currentFracPart = null;
  hasDecimalPart = false;
  currentIsNegative = false;
  results = { dec:'—', bin:'—', hex:'—', oct:'—' };
  ['dec','bin','hex','oct'].forEach(k => {
    document.getElementById('res-' + k).textContent = '—';
    if (stepsOpen[k]) {
      stepsOpen[k] = false;
      document.getElementById('steps-' + k).classList.remove('open');
      document.getElementById('steps-btn-' + k).classList.remove('active-steps');
    }
    document.getElementById('steps-body-' + k).innerHTML = '';
  });
}

function clearInput() {
  document.getElementById('main-input').value = '';
  document.getElementById('main-input').classList.remove('error');
  document.getElementById('error-msg').textContent = '';
  clearResults();
}

// ── TOGGLE STEPS ──

function toggleSteps(type) {
  if (results[type] === '—') return;
  stepsOpen[type] = !stepsOpen[type];
  document.getElementById('steps-' + type).classList.toggle('open', stepsOpen[type]);
  document.getElementById('steps-btn-' + type).classList.toggle('active-steps', stepsOpen[type]);
  if (stepsOpen[type]) buildSteps(type);
}

function buildSteps(type) {
  const container = document.getElementById('steps-body-' + type);
  if (type === 'dec')      container.innerHTML = buildDecSteps();
  else if (type === 'bin') container.innerHTML = buildBaseSteps(2,  'bin');
  else if (type === 'hex') container.innerHTML = buildBaseSteps(16, 'hex');
  else if (type === 'oct') container.innerHTML = buildBaseSteps(8,  'oct');
}

// ── DECIMAL STEPS ──

function buildDecSteps() {
  const mode = currentMode;
  let html = '';

  if (mode === 'from-decimal') {
    html += `<div class="steps-title">Proceso</div>`;
    if (currentIsNegative) {
      html += `<div class="neg-note">⚠ Número negativo: <strong>−${currentIntPart}${hasDecimalPart ? ',' + currentFracPart.toFixed(10).replace(/0+$/, '').replace('0.', '') : ''}</strong>. El valor ya está en base 10.</div>`;
    } else {
      html += `<div class="formula-line">El valor ingresado ya está en base 10.</div>`;
    }
    return html;
  }

  if (mode === 'from-binary') {
    const intStr  = currentIntPart.toString(2);
    const bits    = intStr.split('');
    const n       = bits.length;
    html += `<div class="steps-title">Binario → Decimal</div>`;

    html += `<div class="formula-line" style="margin-bottom:8px">Parte entera — potencias de 2:</div>`;
    html += `<div class="powers-wrap">`;
    bits.forEach((b, i) => {
      const exp = n - 1 - i;
      const v   = b === '1' ? Math.pow(2, exp) : 0;
      html += `<div class="power-chip ${b==='1'?'bit-1':'bit-0'}">
        <span class="bit">${b}</span>
        <span class="pos">2<sup style="font-size:7px">${exp}</sup></span>
        <span class="val">${b==='1' ? v : '—'}</span>
      </div>`;
    });
    html += `</div>`;
    const activeTerms = bits.map((b,i)=>b==='1'?Math.pow(2,n-1-i):null).filter(v=>v!==null);
    html += `<div class="sum-line">Suma: <span>${activeTerms.join(' + ')} = ${currentIntPart}</span></div>`;

    if (hasDecimalPart) {
      html += `<hr class="steps-section-sep">`;
      html += `<div class="formula-line" style="margin-bottom:8px">Parte fraccionaria — potencias negativas de 2:</div>`;
      const inputVal = document.getElementById('main-input').value.replace(',','.').trim();
      const fracBits = inputVal.includes('.') ? inputVal.split('.')[1].split('') : [];
      const fracTerms = fracBits.map((b,i)=> b==='1' ? `1×2<sup>-${i+1}</sup> (${(Math.pow(2,-(i+1))).toFixed(6).replace(/0+$/,'')})` : null).filter(v=>v!==null);
      html += `<div class="formula-line">${fracTerms.length ? fracTerms.join('<br>') : '—'}</div>`;
      const fracVal = fracBits.reduce((acc,b,i)=> acc + parseInt(b)*Math.pow(2,-(i+1)), 0);
      html += `<div class="sum-line" style="margin-top:8px">Suma fraccionaria: <span>${fracVal.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')}</span></div>`;
      html += `<div class="sum-line">Total: <span>${currentIntPart} + ${fracVal.toFixed(8).replace(/0+$/, '')} = ${(currentIntPart+fracVal).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')}</span></div>`;
    }
    return html;
  }

  if (mode === 'from-hex') {
    const hexStr  = currentIntPart.toString(16).toUpperCase();
    const digits  = hexStr.split('');
    const n       = digits.length;
    html += `<div class="steps-title">Hexadecimal → Decimal</div>`;
    html += `<div class="nibble-wrap">`;
    digits.forEach((d, i) => {
      const dv = parseInt(d, 16);
      const exp = n - 1 - i;
      html += `<div class="nibble-chip">
        <div class="hex-digit">${d}</div>
        <div class="nibble-sub">= ${dv}<br>× 16<sup>${exp}</sup><br>= ${dv * Math.pow(16,exp)}</div>
      </div>`;
    });
    html += `</div>`;
    const terms = digits.map((d,i)=>parseInt(d,16)*Math.pow(16,n-1-i));
    html += `<div class="sum-line">Suma: <span>${terms.join(' + ')} = ${currentIntPart}</span></div>`;

    if (hasDecimalPart) {
      html += `<hr class="steps-section-sep">`;
      html += `<div class="formula-line" style="margin-bottom:6px">Parte fraccionaria hex:</div>`;
      const inputVal = document.getElementById('main-input').value.replace(',','.').trim();
      const fracDigits = inputVal.includes('.') ? inputVal.split('.')[1].toUpperCase().split('') : [];
      const lines = fracDigits.map((d,i)=>{
        const dv = parseInt(d,16); const partial = dv*Math.pow(16,-(i+1));
        return `<span class="hl">${d}</span>(=${dv}) × 16<sup>-${i+1}</sup> = <span class="hl">${partial.toFixed(8).replace(/0+$/,'')}</span>`;
      });
      html += `<div class="formula-line">${lines.join('<br>')}</div>`;
      const fracVal = fracDigits.reduce((acc,d,i)=>acc+parseInt(d,16)*Math.pow(16,-(i+1)),0);
      html += `<div class="sum-line" style="margin-top:8px">Total: <span>${currentIntPart} + ${fracVal.toFixed(8).replace(/0+$/,'')} = ${(currentIntPart+fracVal).toFixed(8).replace(/0+$/,'')}</span></div>`;
    }
    return html;
  }

  if (mode === 'from-octal') {
    const octStr  = currentIntPart.toString(8);
    const digits  = octStr.split('');
    const n       = digits.length;
    html += `<div class="steps-title">Octal → Decimal</div>`;
    const lines = digits.map((d,i)=>{
      const exp = n-1-i; const partial = parseInt(d)*Math.pow(8,exp);
      return `<span class="hl">${d}</span> × 8<sup>${exp}</sup> = <span class="hl">${partial}</span>`;
    });
    html += `<div class="formula-line">${lines.join('<br>')}</div>`;
    const total = digits.map((d,i)=>parseInt(d)*Math.pow(8,n-1-i)).reduce((a,b)=>a+b,0);
    html += `<div class="sum-line" style="margin-top:8px">Suma: <span>${total}</span></div>`;

    if (hasDecimalPart) {
      html += `<hr class="steps-section-sep">`;
      const inputVal = document.getElementById('main-input').value.replace(',','.').trim();
      const fracDigits = inputVal.includes('.') ? inputVal.split('.')[1].split('') : [];
      html += `<div class="formula-line" style="margin-bottom:6px">Parte fraccionaria octal:</div>`;
      const flines = fracDigits.map((d,i)=>{
        const partial = parseInt(d)*Math.pow(8,-(i+1));
        return `<span class="hl">${d}</span> × 8<sup>-${i+1}</sup> = <span class="hl">${partial.toFixed(8).replace(/0+$/,'')}</span>`;
      });
      html += `<div class="formula-line">${flines.join('<br>')}</div>`;
      const fracVal = fracDigits.reduce((acc,d,i)=>acc+parseInt(d)*Math.pow(8,-(i+1)),0);
      html += `<div class="sum-line" style="margin-top:8px">Total: <span>${currentIntPart} + ${fracVal.toFixed(8).replace(/0+$/,'')} = ${(currentIntPart+fracVal).toFixed(8).replace(/0+$/,'')}</span></div>`;
    }
    return html;
  }
  return html;
}

// ── PASOS PARA CONVERSIÓN A BINARIO / HEX / OCTAL ──

function buildBaseSteps(base, type) {
  const baseLabels = { bin:'Binario (base 2)', hex:'Hexadecimal (base 16)', oct:'Octal (base 8)' };
  let html = `<div class="steps-title">Decimal → ${baseLabels[type]}</div>`;

  if (currentIsNegative) {
    html += `<div class="neg-note">⚠ <strong>Número negativo</strong> — se convierte el valor absoluto <strong>${currentIntPart}${hasDecimalPart ? '…' : ''}</strong> y se antepone el signo −.</div>`;
  }

  // ── PARTE ENTERA: divisiones sucesivas ──
  if (currentIntPart === 0) {
    html += `<div class="formula-line">Parte entera: <span class="hl">0</span></div>`;
  } else {
    html += `<div class="formula-line" style="margin-bottom:8px">① Parte entera — divisiones sucesivas por ${base}:</div>`;
    const steps = [];
    let n = currentIntPart;
    while (n > 0) {
      const q = Math.floor(n / base);
      const r = n % base;
      steps.push({ dividend:n, quotient:q, remainder:r });
      n = q;
    }
    html += `<table class="division-table"><thead><tr><th>Dividendo</th><th>Cociente</th><th>Resto ★</th></tr></thead><tbody>`;
    steps.forEach(s => {
      const rd = base === 16 ? HEX_CHARS[s.remainder] : s.remainder;
      html += `<tr><td>${s.dividend}</td><td>${s.quotient}</td><td class="highlight-rem">${rd}</td></tr>`;
    });
    html += `</tbody></table>`;
    const rems = steps.map(s => base===16 ? HEX_CHARS[s.remainder] : s.remainder);
    html += `<div class="read-order">📖 Leé los restos de <strong>abajo ↑ hacia arriba</strong>:<br>
      <span style="color:var(--text);font-weight:700;letter-spacing:2px">${rems.slice().reverse().join(' ')}</span>
      &nbsp;→&nbsp;<span style="color:var(--text)">${currentIsNegative ? '−' : ''}${rems.slice().reverse().join('')}</span>
    </div>`;
  }

  // ── PARTE FRACCIONARIA: multiplicaciones sucesivas ──
  if (hasDecimalPart) {
    html += `<hr class="steps-section-sep">`;
    html += `<div class="formula-line" style="margin-bottom:8px">② Parte fraccionaria — multiplicaciones sucesivas por ${base}:</div>`;
    const { steps, digits, isApprox } = convertFracPart(currentFracPart, base);
    html += `<table class="mult-table"><thead><tr><th>Fracción</th><th>× ${base}</th><th>Resultado</th><th>Dígito ★</th></tr></thead><tbody>`;
    steps.forEach(s => {
      html += `<tr>
        <td>${s.frac.toPrecision(6)}</td>
        <td>${base}</td>
        <td>${s.product.toPrecision(6)}</td>
        <td class="highlight-int">${s.digit}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    html += `<div class="read-order">📖 Leé los dígitos de <strong>arriba ↓ hacia abajo</strong>:<br>
      <span style="color:var(--text);font-weight:700;letter-spacing:2px">${digits.join(' ')}</span>
      &nbsp;→&nbsp;<span style="color:var(--text)">,${digits.join('')}</span>
    </div>`;
    if (isApprox) {
      html += `<div class="approx-note">⚠ Representación aproximada (límite de ${MAX_FRAC_BITS} dígitos). Este número no tiene representación exacta y finita en base ${base}.</div>`;
    }

    const intStr = currentIntPart.toString(base).toUpperCase();
    const fracStr = digits.join('');
    html += `<div class="sum-line" style="margin-top:10px">Resultado final: <span>${currentIsNegative ? '−' : ''}${intStr},${fracStr}${isApprox?'…':''}</span></div>`;

    if (type === 'bin' && !isApprox) {
      const intTerms = currentIntPart.toString(2).split('').map((b,i,a)=>b==='1'?Math.pow(2,a.length-1-i):0).filter(v=>v>0);
      const fracTerms = digits.map((d,i)=> parseInt(d)===1 ? Math.pow(2,-(i+1)) : 0).filter(v=>v>0);
      const allTerms = [...intTerms,...fracTerms];
      html += `<div class="formula-line" style="margin-top:8px">✅ Verificación: <span class="hl">${allTerms.join(' + ')} = ${(currentIntPart+currentFracPart).toFixed(10).replace(/0+$/, '').replace(/\.$/, '')}</span></div>`;
    }
  }

  // ── COMPLEMENTO A 2 para binario negativo (solo parte entera) ──
  if (type === 'bin' && currentIsNegative && !hasDecimalPart && currentIntPart > 0) {
    const bitWidth = getC2BitWidth(currentIntPart);
    const magnBin  = currentIntPart.toString(2).padStart(bitWidth, '0');
    const c1       = magnBin.split('').map(b => b === '0' ? '1' : '0').join('');
    const c2       = complement2(currentIntPart.toString(2), bitWidth);

    html += `<hr class="steps-section-sep">`;
    html += `<div class="formula-line" style="margin-bottom:8px">③ Representación en <strong>Complemento a 2</strong> (${bitWidth} bits) — para usar en operaciones binarias:</div>`;
    html += `<div class="c2-step">
      Magnitud:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="hl">${magnBin}</span>  (= ${currentIntPart})<br>
      Complemento a 1:&nbsp;<span class="hl-y">${c1}</span>  (invertir cada bit)<br>
      Sumar&nbsp;1:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="hl-y">+&nbsp;${'0'.repeat(bitWidth-1)}1</span><br>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${'─'.repeat(bitWidth+2)}<br>
      Complemento&nbsp;a&nbsp;2:&nbsp;<span class="hl-g">${c2}</span>&nbsp;&nbsp;→ representa <span class="hl-g">−${currentIntPart}</span>
    </div>
    <div class="read-order" style="margin-top:8px">💡 Podés usar <strong>${c2}</strong> como operando en la sección de Operaciones Binarias para representar −${currentIntPart}.</div>`;
  }

  return html;
}

// ── COPY ──

async function copyResult(type) {
  const val = results[type];
  if (val === '—') return;
  try { await navigator.clipboard.writeText(val); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = val; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }
  const btn = document.getElementById('copy-' + type + '-btn');
  btn.textContent = '✓';
  setTimeout(() => { btn.textContent = '⎘'; }, 1500);
  showToast();
}

function showToast() {
  const t = document.getElementById('toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

function buildRefTable() {
  const tbody = document.getElementById('ref-tbody');
  for (let i = 0; i <= 15; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i}</td><td>${i.toString(2).padStart(4,'0')}</td><td>${i.toString(16).toUpperCase()}</td><td>${i.toString(8)}</td>`;
    tbody.appendChild(tr);
  }
}

function toggleRef() {
  document.getElementById('ref-table-wrap').classList.toggle('open');
  document.getElementById('ref-toggle').classList.toggle('open');
}

document.getElementById('main-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleInput();
});

buildRefTable();

// ══════════════════════════════════════════════
//  OPERACIONES BINARIAS
// ══════════════════════════════════════════════

let currentOp = 'sum';
let opStepsOpen = false;

const OP_SYMBOLS = { sum:'＋', sub:'－', mul:'×' };

function setOp(op) {
  currentOp = op;
  document.querySelectorAll('.op-tab').forEach((t, i) => {
    t.classList.toggle('active', ['sum','sub','mul'][i] === op);
  });
  document.getElementById('op-symbol').textContent = OP_SYMBOLS[op];
  document.getElementById('op-result-wrap').classList.remove('show');
  document.getElementById('op-error').textContent = '';
  document.getElementById('op-a').classList.remove('error');
  document.getElementById('op-b').classList.remove('error');
  if (opStepsOpen) toggleOpSteps();
}

function validateBin(val) { return /^[01]+$/.test(val.trim()); }

function calculate() {
  const aRaw = document.getElementById('op-a').value.trim();
  const bRaw = document.getElementById('op-b').value.trim();
  const errEl = document.getElementById('op-error');
  const inA = document.getElementById('op-a');
  const inB = document.getElementById('op-b');

  inA.classList.remove('error'); inB.classList.remove('error'); errEl.textContent = '';

  if (!aRaw || !bRaw) { errEl.textContent = 'Completá ambos operandos.'; return; }
  if (!validateBin(aRaw)) { inA.classList.add('error'); errEl.textContent = 'Operando A: solo se permiten 0 y 1.'; return; }
  if (!validateBin(bRaw)) { inB.classList.add('error'); errEl.textContent = 'Operando B: solo se permiten 0 y 1.'; return; }

  let resultBin, stepsHTML;

  if (currentOp === 'sum') {
    const { result, steps } = binaryAdd(aRaw, bRaw);
    resultBin = result; stepsHTML = buildSumSteps(aRaw, bRaw, result, steps);
  } else if (currentOp === 'sub') {
    const { result, steps } = binarySub(aRaw, bRaw);
    resultBin = result; stepsHTML = buildSubSteps(aRaw, bRaw, result, steps);
  } else {
    const { result, steps } = binaryMul(aRaw, bRaw);
    resultBin = result; stepsHTML = buildMulSteps(aRaw, bRaw, result, steps);
  }

  const decResult = parseInt(resultBin.replace(/^-/, ''), 2) * (resultBin.startsWith('-') ? -1 : 1);
  document.getElementById('op-res-bin').textContent = resultBin;
  document.getElementById('op-res-dec').textContent = `Decimal: ${decResult}`;
  document.getElementById('op-steps-body').innerHTML = stepsHTML;
  document.getElementById('op-result-wrap').classList.add('show');

  if (opStepsOpen) {
    opStepsOpen = false;
    document.getElementById('op-steps-wrap').classList.remove('open');
    document.getElementById('op-steps-toggle').classList.remove('open');
  }
}

function toggleOpSteps() {
  opStepsOpen = !opStepsOpen;
  document.getElementById('op-steps-wrap').classList.toggle('open', opStepsOpen);
  document.getElementById('op-steps-toggle').classList.toggle('open', opStepsOpen);
}

// ── SUMA BINARIA ──

function binaryAdd(aStr, bStr) {
  const len = Math.max(aStr.length, bStr.length) + 1;
  const a = aStr.padStart(len, '0').split('').map(Number).reverse();
  const b = bStr.padStart(len, '0').split('').map(Number).reverse();

  const resultBits = [];
  const carries = [0];
  for (let i = 0; i < len; i++) {
    const sum = (a[i] || 0) + (b[i] || 0) + carries[i];
    resultBits.push(sum % 2);
    carries.push(Math.floor(sum / 2));
  }

  const result = resultBits.reverse().join('').replace(/^0+/, '') || '0';
  return { result, steps: { a, b, resultBits, carries, len } };
}

function buildSumSteps(aStr, bStr, result, steps) {
  const len = Math.max(aStr.length, bStr.length) + 1;
  const aPad = aStr.padStart(len, '0');
  const bPad = bStr.padStart(len, '0');
  const resPad = result.padStart(len, '0');
  const { a, b, resultBits, carries } = steps;

  let html = `<div class="steps-title">Suma bit a bit (de derecha a izquierda)</div>`;
  html += `<table class="bit-table">
    <thead><tr><th>Pos</th><th>Acarreo</th><th>A</th><th>B</th><th>Suma</th><th>Bit res.</th><th>Nuevo acarreo</th></tr></thead><tbody>`;

  for (let i = 0; i < len; i++) {
    const ai = a[i] || 0, bi = b[i] || 0, ci = carries[i] || 0;
    const sum = ai + bi + ci;
    const bit = sum % 2, newCarry = Math.floor(sum / 2);
    html += `<tr>
      <td style="color:var(--text-muted)">${i}</td>
      <td class="bit-carry">${ci}</td>
      <td>${ai}</td>
      <td style="color:#a78bfa">${bi}</td>
      <td style="color:var(--accent3)">${sum}</td>
      <td class="bit-result">${bit}</td>
      <td class="bit-carry">${newCarry}</td>
    </tr>`;
  }
  html += `</tbody></table>`;
  html += `<div class="c2-step">
    &nbsp;&nbsp;<span class="hl">${aPad}</span>  (A = ${parseInt(aStr,2)})<br>
    ＋&nbsp;<span class="hl" style="color:#a78bfa">${bPad}</span>  (B = ${parseInt(bStr,2)})<br>
    ${'─'.repeat(len+4)}<br>
    &nbsp;&nbsp;<span class="hl-g">${resPad}</span>  = ${parseInt(result,2)}
  </div>`;
  return html;
}

// ── RESTA (COMPLEMENTO A 2) ──

function complement2(binStr, len) {
  const padded = binStr.padStart(len, '0');
  const c1 = padded.split('').map(b => b === '0' ? '1' : '0').join('');
  const { result } = binaryAdd(c1, '1');
  return result.padStart(len, '0');
}

function binarySub(aStr, bStr) {
  const len = Math.max(aStr.length, bStr.length) + 1;
  const c2b = complement2(bStr, len);
  const { result: sumResult, steps: sumSteps } = binaryAdd(aStr.padStart(len,'0'), c2b);

  let finalResult, negative;
  if (sumResult.length > len) {
    finalResult = sumResult.slice(sumResult.length - len).replace(/^0+/, '') || '0';
    negative = false;
  } else {
    if (sumResult[0] === '1') {
      finalResult = '-' + complement2(sumResult, len).replace(/^0+/, '') || '0';
      negative = true;
    } else {
      finalResult = sumResult.replace(/^0+/, '') || '0';
      negative = false;
    }
  }

  return { result: finalResult, steps: { aStr, bStr, len, c2b, sumResult, negative } };
}

function buildSubSteps(aStr, bStr, result, steps) {
  const { len, c2b, sumResult, negative } = steps;
  const aPad = aStr.padStart(len, '0');
  const bPad = bStr.padStart(len, '0');
  const c1 = bPad.split('').map(b => b === '0' ? '1' : '0').join('');

  let html = `<div class="steps-title">Resta por Complemento a 2</div>`;
  html += `<div class="c2-step">
    <strong style="color:var(--text-muted);font-size:9px;letter-spacing:2px">PASO 1 — Convertir B a Complemento a 2</strong><br><br>
    B original:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="hl">${bPad}</span>  (= ${parseInt(bStr,2)})<br>
    Complemento a 1:&nbsp;<span class="hl-y">${c1}</span>  (invertir cada bit)<br>
    Sumar 1:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="hl-y">+&nbsp;${'0'.repeat(len-1)}1</span><br>
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${'─'.repeat(len+2)}<br>
    Complemento a 2:&nbsp;<span class="hl-g">${c2b.padStart(len,'0')}</span><br><br>
    <strong style="color:var(--text-muted);font-size:9px;letter-spacing:2px">PASO 2 — Sumar A + C2(B)</strong><br><br>
    &nbsp;&nbsp;<span class="hl">${aPad}</span>  (A = ${parseInt(aStr,2)})<br>
    ＋&nbsp;<span class="hl-g">${c2b.padStart(len,'0')}</span>  (C2(B))<br>
    ${'─'.repeat(len+4)}<br>
    &nbsp;&nbsp;<span style="color:var(--accent3)">${sumResult.padStart(len+1,'0')}</span><br><br>
    <strong style="color:var(--text-muted);font-size:9px;letter-spacing:2px">PASO 3 — Descartar bit de overflow</strong><br><br>
    ${sumResult.length > len
      ? `Se descarta el bit más significativo (overflow positivo).<br>Resultado: <span class="hl-g">${result.padStart(len,'0')}</span>  = ${parseInt(result,2)}`
      : negative
        ? `El bit más significativo es 1 → resultado negativo.<br>Se aplica C2 nuevamente para obtener la magnitud.<br>Resultado: <span style="color:var(--error)">${result}</span>`
        : `Resultado: <span class="hl-g">${result.padStart(len,'0')}</span>  = ${parseInt(result.replace('-',''),2)}`
    }
  </div>`;
  return html;
}

// ── MULTIPLICACIÓN ──

function binaryMul(aStr, bStr) {
  const partials = [];
  const bRev = bStr.split('').reverse();

  bRev.forEach((bit, i) => {
    if (bit === '1') {
      partials.push({ bits: aStr + '0'.repeat(i), shift: i, isZero: false });
    } else {
      partials.push({ bits: '0'.repeat(aStr.length + i), shift: i, isZero: true });
    }
  });

  let acc = '0';
  partials.forEach(p => { if (!p.isZero) { acc = binaryAdd(acc, p.bits).result; } });
  const result = acc || '0';

  return { result, steps: { partials, aStr, bStr } };
}

function buildMulSteps(aStr, bStr, result, steps) {
  const { partials } = steps;
  const decA = parseInt(aStr, 2), decB = parseInt(bStr, 2);
  const maxLen = result.length;

  let html = `<div class="steps-title">Multiplicación — Productos parciales</div>`;
  html += `<div class="c2-step" style="margin-bottom:12px">
    A = <span class="hl">${aStr}</span> (${decA}) &nbsp;×&nbsp; B = <span class="hl" style="color:#a78bfa">${bStr}</span> (${decB})
  </div>`;

  html += `<div class="partial-wrap">`;
  html += `<div class="partial-row"><span class="partial-label" style="color:var(--text-muted);font-size:9px">BIT B</span><span style="font-family:'Space Mono';font-size:9px;color:var(--text-muted)">PRODUCTO PARCIAL</span><span style="font-family:'Space Mono';font-size:9px;color:var(--text-muted);margin-left:auto">DESPLAZ.</span></div>`;

  partials.forEach((p, i) => {
    const bitVal = bStr[bStr.length - 1 - i];
    const displayBits = p.bits.padStart(maxLen, '0');
    html += `<div class="partial-row">
      <span class="partial-label">b[${i}] = ${bitVal}</span>
      <span class="partial-bits ${p.isZero ? 'zero' : ''}">${displayBits}</span>
      <span style="font-family:'Space Mono';font-size:9px;color:var(--text-muted);margin-left:auto">&lt;&lt;${i}</span>
    </div>`;
  });

  html += `<div class="partial-row">
    <span class="partial-label" style="color:var(--accent4)">RESULTADO</span>
    <span class="partial-bits total">${result.padStart(maxLen,'0')}</span>
    <span style="font-family:'Space Mono';font-size:9px;color:var(--accent4);margin-left:auto">= ${parseInt(result,2)}</span>
  </div>`;
  html += `</div>`;

  html += `<div class="c2-step">
    Verificación: ${decA} × ${decB} = <span class="hl-g">${decA * decB}</span>
    &nbsp;→&nbsp; Binario: <span class="hl-g">${(decA * decB).toString(2)}</span>
  </div>`;
  return html;
}

['op-a','op-b'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') calculate();
  });
});
