import './style.css';

// Datenschutz-Grundsatz: Dateien werden nur im Arbeitsspeicher dieses Tabs verarbeitet.
// Es gibt keinen Netzwerkzugriff (CSP: connect-src 'none'), keine Cookies und keinen
// lokalen Speicher. «Liste leeren» oder das Schliessen des Tabs verwirft alles.

const MAX_BYTES = 200 * 1024 * 1024;
const pick = document.getElementById('pick');
const drop = document.getElementById('drop');
const list = document.getElementById('results');
const wrap = document.getElementById('results-wrap');
const tpl = document.getElementById('card-tpl');
const net = document.getElementById('net');
const isAppleTouch = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const preferShare = isAppleTouch || matchMedia('(pointer: coarse)').matches;

const urls = new Set();
let focusResult = false;

// ——— Eingabe ———

pick.addEventListener('change', () => {
  handle(pick.files);
  pick.value = '';
});

for (const ev of ['dragenter', 'dragover']) {
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); });
}
for (const ev of ['dragleave', 'dragend', 'drop']) {
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); });
}
drop.addEventListener('drop', (e) => handle(e.dataTransfer?.files));
// Dateien ausserhalb der Zone nicht vom Browser öffnen lassen
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

document.getElementById('clear').addEventListener('click', clearAll);

async function handle(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  wrap.hidden = false;
  // Neueste Auswahl oben, innerhalb der Auswahl in der gewählten Reihenfolge
  const jobs = files.slice().reverse().map((f) => ({ file: f, card: createCard(f) })).reverse();
  focusResult = files.length === 1;
  jobs[0].card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  for (const job of jobs) await processFile(job.file, job.card); // nacheinander, schont Speicher
}

// ——— Verarbeitung ———

function detectType(file, head) {
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  const name = file.name.toLowerCase();
  if (isPdf || (name.endsWith('.pdf') && !isZip)) return 'pdf';
  if (isZip && name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.doc')) return 'doc';
  if (isZip && /\.(xlsx|pptx)$/.test(name)) return 'office-other';
  return 'unknown';
}

async function processFile(file, card) {
  // Spinner erst nach 300 ms zeigen, damit kurze Vorgänge nicht flackern
  const slow = setTimeout(() => card.classList.add('is-slow'), 300);
  try {
    if (file.size > MAX_BYTES) throw userError('Die Datei ist grösser als 200 MB und kann auf diesem Gerät nicht sicher verarbeitet werden.');
    let input = new Uint8Array(await file.arrayBuffer());
    const type = detectType(file, input);
    setBadge(card, type);
    if (type === 'doc') throw userError('Alte .doc-Dateien werden nicht unterstützt. Bitte in Word öffnen und als .docx speichern.');
    if (type === 'office-other') throw userError('Excel und PowerPoint folgen später. Im Moment gehen .docx und .pdf.');
    if (type === 'unknown') throw userError('Dieses Format wird nicht unterstützt. Möglich sind .docx und .pdf.');

    const { stripDocx } = type === 'docx' ? await import('./strip/docx.js') : {};
    const { stripPdf } = type === 'pdf' ? await import('./strip/pdf.js') : {};
    const { bytes, report } = type === 'docx' ? await stripDocx(input) : await stripPdf(input);
    input = null; // Original nicht länger im Speicher halten

    const mime = type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const out = new File([bytes], file.name, { type: mime, lastModified: Date.UTC(1980, 0, 1) });
    renderDone(card, file, out, report);
  } catch (err) {
    if (!err?.user) console.error(err);
    renderError(card, file, err);
  } finally {
    clearTimeout(slow);
    card.classList.remove('is-slow');
  }
}

function userError(msg) { const e = new Error(msg); e.user = true; return e; }

// ——— Darstellung ———

function createCard(file) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.querySelector('.name').textContent = file.name;
  node.querySelector('.meta').textContent = `${formatSize(file.size)} · wird bereinigt …`;
  node.querySelector('.badge').textContent = (file.name.split('.').pop() || '?').slice(0, 4).toUpperCase();
  node.setAttribute('aria-busy', 'true');
  list.prepend(node);
  return node;
}

function setBadge(card, type) {
  const b = card.querySelector('.badge');
  b.dataset.type = type;
  if (type === 'pdf') b.textContent = 'PDF';
  if (type === 'docx') b.textContent = 'DOCX';
}

function renderDone(card, original, out, report) {
  card.dataset.state = 'done';
  card.removeAttribute('aria-busy');
  const found = report.found || [];
  card.querySelector('.meta').innerHTML = '';
  card.querySelector('.meta').append(
    icon('i-check', 'ok-icon'),
    text(` Bereinigt · ${formatSize(original.size)} → ${formatSize(out.size)}`)
  );

  const body = card.querySelector('.card-body');
  body.replaceChildren();

  if (found.length) {
    const h = el('p', 'section-label', `${found.length} ${found.length === 1 ? 'Angabe' : 'Angaben'} gefunden und entfernt`);
    const dl = el('dl', 'found');
    found.forEach((item, i) => {
      const row = el('div', 'found-row');
      if (i >= 6) row.classList.add('is-extra');
      row.append(el('dt', '', item.label), el('dd', '', ''));
      const del = el('del', '', item.value);
      row.lastChild.append(del);
      dl.append(row);
    });
    body.append(h, dl);
    if (found.length > 6) {
      const more = el('button', 'link', `${found.length - 6} weitere anzeigen`);
      more.type = 'button';
      more.setAttribute('aria-expanded', 'false');
      more.addEventListener('click', () => {
        const open = dl.classList.toggle('show-all');
        more.setAttribute('aria-expanded', String(open));
        more.textContent = open ? 'Weniger anzeigen' : `${found.length - 6} weitere anzeigen`;
      });
      body.append(more);
    }
  } else {
    body.append(el('p', 'section-label', 'Keine Dokumenteigenschaften gefunden – die Datei wurde trotzdem neu und ohne Spuren geschrieben.'));
  }

  if (report.actions?.length) {
    const ul = el('ul', 'actions');
    for (const a of report.actions) {
      const li = el('li');
      li.append(icon('i-check'), text(a));
      ul.append(li);
    }
    body.append(ul);
  }

  for (const w of report.warnings || []) {
    const p = el('p', 'warning');
    p.append(icon('i-warn'), text(w));
    body.append(p);
  }

  const url = URL.createObjectURL(out);
  urls.add(url);
  const row = el('div', 'card-actions');
  const canShare = preferShare && navigator.canShare?.({ files: [out] });
  const save = el(canShare ? 'button' : 'a', 'primary');
  if (canShare) {
    save.type = 'button';
    save.append(icon('i-share'), text('Datei sichern'));
    save.addEventListener('click', async () => {
      try {
        await navigator.share({ files: [out] });
      } catch (e) {
        if (e?.name !== 'AbortError') fallbackDownload(url, out.name);
      }
    });
  } else {
    save.href = url;
    save.download = out.name;
    save.append(icon('i-save'), text('Datei herunterladen'));
  }
  row.append(save);
  body.append(row);
  if (canShare) body.append(el('p', 'hint', 'Im Teilen-Menü «In Dateien sichern» wählen.'));
  if (focusResult) save.focus({ preventScroll: true });
}

function renderError(card, file, err) {
  card.dataset.state = 'error';
  card.removeAttribute('aria-busy');
  const msg = err?.user
    ? err.message
    : 'Die Datei konnte nicht bereinigt werden. Sie ist möglicherweise beschädigt oder in einem ungewöhnlichen Format gespeichert.';
  const meta = card.querySelector('.meta');
  meta.replaceChildren(icon('i-x', 'err-icon'), text(` Nicht bereinigt · ${formatSize(file.size)}`));
  const body = card.querySelector('.card-body');
  const p = el('p', 'error-text', msg);
  const again = el('button', 'secondary', 'Andere Datei wählen');
  again.type = 'button';
  again.addEventListener('click', () => pick.click());
  body.replaceChildren(p, el('div', 'card-actions'));
  body.lastChild.append(again);
}

function fallbackDownload(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
}

function clearAll() {
  for (const u of urls) URL.revokeObjectURL(u);
  urls.clear();
  list.replaceChildren();
  wrap.hidden = true;
  pick.focus();
}

// Beim Verlassen alle Download-Links freigeben
window.addEventListener('pagehide', () => { for (const u of urls) URL.revokeObjectURL(u); });

// ——— Helfer ———

function el(tag, cls = '', content = '') {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (content) n.textContent = content;
  return n;
}
function text(s) { return document.createTextNode(s); }
function icon(id, cls = '') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `icon ${cls}`.trim());
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}
function formatSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

// ——— Status ———

function renderNet() {
  net.dataset.state = navigator.onLine ? 'online' : 'offline';
  net.textContent = navigator.onLine ? 'Läuft auf diesem Gerät' : 'Offline · läuft auf diesem Gerät';
}
window.addEventListener('online', renderNet);
window.addEventListener('offline', renderNet);
renderNet();
