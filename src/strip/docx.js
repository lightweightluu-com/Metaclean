// Bereinigt Word-Dokumente (.docx) vollständig im Speicher.
// Entfernt: Dokumenteigenschaften, Kommentare samt Autoren, Änderungsverfolgung
// (wird angenommen), Bearbeitungs-IDs (rsid), Vorlagenpfad, Dokument-IDs,
// SharePoint-/customXml-Daten, Vorschaubild, Bild-EXIF und ZIP-Zeitstempel.

import JSZip from 'jszip';
import { cleanImage } from './images.js';
import { Report, UserError } from './report.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
// Einheitlicher, neutraler Zeitstempel für alle ZIP-Einträge (Mittag UTC, damit
// keine Zeitzone das Datum vor 1980 verschiebt).
const FIXED_DATE = new Date(Date.UTC(1980, 0, 1, 12, 0, 0));

const CORE_FIELDS = {
  creator: 'Autor',
  lastModifiedBy: 'Zuletzt geändert von',
  created: 'Erstellt am',
  modified: 'Geändert am',
  lastPrinted: 'Zuletzt gedruckt',
  revision: 'Revisionsnummer',
  title: 'Titel',
  subject: 'Betreff',
  keywords: 'Stichwörter',
  description: 'Kommentar',
  category: 'Kategorie',
  contentStatus: 'Status',
  identifier: 'Kennung',
  language: 'Sprache',
  version: 'Version'
};
const APP_FIELDS = {
  Company: 'Firma',
  Manager: 'Manager',
  Template: 'Vorlage',
  TotalTime: 'Bearbeitungszeit (Min.)',
  Application: 'Programm',
  AppVersion: 'Programmversion',
  HyperlinkBase: 'Hyperlink-Basis'
};

const CHANGE_MARKS = [
  'rPrChange', 'pPrChange', 'sectPrChange', 'tblPrChange', 'tblPrExChange',
  'trPrChange', 'tcPrChange', 'tblGridChange', 'numberingChange',
  'cellIns', 'cellDel', 'cellMerge'
];
const RANGE_MARKS = [
  'moveFromRangeStart', 'moveFromRangeEnd', 'moveToRangeStart', 'moveToRangeEnd',
  'customXmlInsRangeStart', 'customXmlInsRangeEnd', 'customXmlDelRangeStart',
  'customXmlDelRangeEnd', 'customXmlMoveFromRangeStart', 'customXmlMoveFromRangeEnd',
  'customXmlMoveToRangeStart', 'customXmlMoveToRangeEnd'
];

export async function stripDocx(input) {
  let zip;
  try {
    zip = await JSZip.loadAsync(input);
  } catch {
    throw new UserError('Die Datei ist kein gültiges Word-Dokument (.docx). Ältere .doc-Dateien bitte zuerst in Word als .docx speichern.');
  }
  if (!zip.file('[Content_Types].xml') || !zip.file('word/document.xml')) {
    throw new UserError('Die Datei ist kein Word-Dokument im .docx-Format.');
  }
  if (zip.file('EncryptedPackage') || zip.file('EncryptionInfo')) {
    throw new UserError('Das Dokument ist mit einem Passwort geschützt. Bitte den Schutz in Word entfernen und erneut versuchen.');
  }

  const report = new Report();
  const pkg = new Package(zip);
  await pkg.load();

  // 1 · Dokumenteigenschaften lesen (für den Bericht) und entfernen
  const core = await pkg.xml('docProps/core.xml');
  if (core) {
    for (const el of Array.from(core.documentElement.childNodes)) {
      if (el.nodeType !== 1) continue;
      const label = CORE_FIELDS[el.localName] || el.localName;
      report.found(label, formatIsoDate(el.textContent));
    }
  }
  const app = await pkg.xml('docProps/app.xml');
  if (app) {
    for (const el of Array.from(app.documentElement.childNodes)) {
      if (el.nodeType !== 1 || !APP_FIELDS[el.localName]) continue;
      report.found(APP_FIELDS[el.localName], el.textContent);
    }
  }
  const custom = await pkg.xml('docProps/custom.xml');
  if (custom) {
    for (const p of Array.from(custom.getElementsByTagNameNS('*', 'property'))) {
      report.found(`Eigene Eigenschaft «${p.getAttribute('name')}»`, p.textContent);
    }
  }
  for (const path of pkg.paths()) {
    if (path.startsWith('docProps/')) {
      if (/thumbnail/i.test(path)) report.action('Vorschaubild entfernt');
      pkg.removePart(path);
    }
  }

  // 2 · Kommentare: Autoren sammeln, Teile entfernen
  const authors = new Set();
  const comments = await pkg.xml('word/comments.xml');
  let commentCount = 0;
  if (comments) {
    for (const c of Array.from(comments.getElementsByTagNameNS(W, 'comment'))) {
      commentCount++;
      addName(authors, c.getAttributeNS(W, 'author'));
    }
  }
  const people = await pkg.xml('word/people.xml');
  if (people) {
    for (const p of Array.from(people.getElementsByTagNameNS('*', 'person'))) {
      addName(authors, p.getAttributeNS('*', 'author') || attrByLocal(p, 'author'));
    }
  }
  for (const path of pkg.paths()) {
    if (/^word\/(comments[A-Za-z]*|people)\.xml$/.test(path)) pkg.removePart(path);
  }
  if (commentCount) report.action(`${commentCount} ${commentCount === 1 ? 'Kommentar' : 'Kommentare'} entfernt`);

  // 3 · Inhaltsteile: Änderungen annehmen, Kommentar-Anker und Bearbeitungsspuren entfernen
  let changeCount = 0;
  const contentParts = pkg.paths().filter((p) =>
    /^word\/(glossary\/)?(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(p));
  for (const path of contentParts) {
    const doc = await pkg.xml(path);
    changeCount += acceptChanges(doc, authors);
    removeCommentAnchors(doc);
    scrubAttributes(doc, authors);
    pkg.save(path, doc);
  }
  if (changeCount) report.action(`${changeCount} nachverfolgte ${changeCount === 1 ? 'Änderung' : 'Änderungen'} angenommen`);

  for (const path of pkg.paths()) {
    if (!/^word\/(glossary\/)?(styles|numbering|stylesWithEffects)\.xml$/.test(path)) continue;
    const doc = await pkg.xml(path);
    removeAll(doc, ['rsid', ...CHANGE_MARKS]);
    scrubAttributes(doc, authors);
    pkg.save(path, doc);
  }

  // 4 · Einstellungen: Vorlagenpfad, Sitzungs-IDs, Dokumentvariablen entfernen
  for (const path of ['word/settings.xml', 'word/glossary/settings.xml']) {
    const settings = await pkg.xml(path);
    if (!settings) continue;
    const root = settings.documentElement;
    const tpl = first(root, W, 'attachedTemplate');
    if (tpl) {
      const relId = tpl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const target = await pkg.relTarget(path, relId);
      if (target) report.found('Vorlagenpfad', target);
      tpl.parentNode.removeChild(tpl);
    }
    if (first(root, W, 'docVars')) report.action('Dokumentvariablen entfernt');
    for (const name of ['rsids', 'docVars', 'savePreviewPicture']) {
      for (const el of Array.from(root.getElementsByTagNameNS(W, name))) el.parentNode.removeChild(el);
    }
    for (const el of Array.from(root.childNodes)) {
      if (el.nodeType === 1 && el.localName === 'docId') root.removeChild(el); // w14/w15:docId
    }
    ensurePrivacyFlags(settings);
    await pkg.removeRelsOfType(path, /\/attachedTemplate$/);
    pkg.save(path, settings);
  }

  // 5 · customXml (z. B. SharePoint-Eigenschaften, Bearbeiter) entfernen
  const customXml = pkg.paths().filter((p) => p.startsWith('customXml/'));
  if (customXml.length) {
    for (const p of customXml) pkg.removePart(p);
    report.action('Zusätzliche Eigenschaften (customXml/SharePoint) entfernt');
  }

  // 6 · Bilder: EXIF/GPS/XMP entfernen
  let imgCount = 0;
  for (const path of pkg.paths()) {
    if (!/^word\/media\/.+\.(jpe?g|png)$/i.test(path)) continue;
    const cleaned = cleanImage(await pkg.bytes(path));
    if (cleaned) { pkg.saveBytes(path, cleaned); imgCount++; }
  }
  if (imgCount) report.action(`Metadaten aus ${imgCount} ${imgCount === 1 ? 'Bild' : 'Bildern'} entfernt (EXIF, GPS, Kamera)`);

  if (pkg.paths().some((p) => p.startsWith('word/embeddings/'))) {
    report.warn('Das Dokument enthält eingebettete Objekte (z. B. Excel-Tabellen). Deren eigene Eigenschaften wurden nicht verändert.');
  }

  for (const a of authors) report.found('Name in Kommentaren/Änderungen', a);
  report.action('Bearbeitungs-IDs und Zeitstempel entfernt');

  const bytes = await pkg.build();
  return { bytes, report: report.toJSON() };
}

// ——— Änderungsverfolgung ———

function acceptChanges(doc, authors) {
  let count = 0;
  const collect = (el) => {
    addName(authors, el.getAttributeNS(W, 'author'));
    count++;
  };

  // Gelöschte Tabellenzeilen entfernen
  for (const del of byName(doc, 'del')) {
    if (del.parentNode?.localName === 'trPr') {
      collect(del);
      const tr = closest(del, 'tr');
      if (tr) tr.parentNode.removeChild(tr);
    }
  }
  // Markierungen an Absatzmarken / Zeilen (w:pPr/w:rPr/w:del|ins, w:trPr/w:ins)
  const emptiedParas = [];
  for (const name of ['del', 'ins', 'moveFrom', 'moveTo']) {
    for (const el of byName(doc, name)) {
      const parent = el.parentNode?.localName;
      if (parent === 'rPr' || parent === 'trPr') {
        collect(el);
        if (name === 'del' || name === 'moveFrom') {
          const p = closest(el, 'p');
          if (p) emptiedParas.push(p);
        }
        el.parentNode.removeChild(el);
      }
    }
  }
  // Gelöschter/verschobener Inhalt fällt weg
  for (const name of ['del', 'moveFrom']) {
    for (const el of byName(doc, name)) {
      if (!el.parentNode) continue;
      collect(el);
      el.parentNode.removeChild(el);
    }
  }
  // Eingefügter Inhalt bleibt, nur die Markierung fällt weg
  for (const name of ['ins', 'moveTo']) {
    for (const el of byName(doc, name)) {
      if (!el.parentNode) continue;
      collect(el);
      unwrap(el);
    }
  }
  for (const el of byNames(doc, CHANGE_MARKS)) {
    collect(el);
    el.parentNode.removeChild(el);
  }
  removeAll(doc, RANGE_MARKS);

  // Absätze, deren Absatzmarke gelöscht wurde und die jetzt leer sind, entfernen
  for (const p of emptiedParas) {
    if (!p.parentNode || hasContent(p)) continue;
    const pPr = firstChild(p, 'pPr');
    if (pPr && firstChild(pPr, 'sectPr')) continue;
    const siblings = Array.from(p.parentNode.childNodes).filter((n) => n.localName === 'p');
    if (siblings.length > 1) p.parentNode.removeChild(p);
  }
  return count;
}

function hasContent(p) {
  const names = ['t', 'drawing', 'pict', 'object', 'tab', 'br', 'sym', 'fldSimple', 'instrText'];
  return names.some((n) => p.getElementsByTagNameNS(W, n).length > 0);
}

function removeCommentAnchors(doc) {
  removeAll(doc, ['commentRangeStart', 'commentRangeEnd']);
  for (const ref of byName(doc, 'commentReference')) {
    const run = ref.parentNode;
    run.removeChild(ref);
    if (run.localName === 'r' && Array.from(run.childNodes).every((n) => n.nodeType !== 1 || n.localName === 'rPr')) {
      run.parentNode?.removeChild(run);
    }
  }
}

// Entfernt rsid-Attribute (Bearbeitungssitzungen) und verbliebene Autor/Datum-Angaben
function scrubAttributes(doc, authors) {
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (!el.attributes || !el.attributes.length) continue;
    for (const attr of Array.from(el.attributes)) {
      const n = attr.localName;
      if (attr.namespaceURI === W && (n.startsWith('rsid') || n === 'date' || n === 'initials')) {
        el.removeAttributeNode(attr);
      } else if (attr.namespaceURI === W && n === 'author') {
        addName(authors, attr.value);
        el.removeAttributeNode(attr);
      }
    }
  }
}

function ensurePrivacyFlags(settings) {
  const root = settings.documentElement;
  if (first(root, W, 'removePersonalInformation') && first(root, W, 'removeDateAndTime')) return;
  // Reihenfolge laut Schema: writeProtection, view, zoom, removePersonalInformation, removeDateAndTime …
  let anchor = null;
  for (const el of Array.from(root.childNodes)) {
    if (el.nodeType === 1 && el.namespaceURI === W && ['writeProtection', 'view', 'zoom'].includes(el.localName)) anchor = el;
  }
  const insertAfter = (node, ref) => {
    const next = ref ? ref.nextSibling : firstElement(root);
    root.insertBefore(node, next);
    return node;
  };
  let ref = anchor;
  let rpi = first(root, W, 'removePersonalInformation');
  if (!rpi) rpi = insertAfter(settings.createElementNS(W, 'w:removePersonalInformation'), ref);
  ref = rpi;
  if (!first(root, W, 'removeDateAndTime')) insertAfter(settings.createElementNS(W, 'w:removeDateAndTime'), ref);
}

// ——— Paket-Helfer ———

class Package {
  constructor(zip) {
    this.zip = zip;
    this.files = new Map(); // path → { bytes | doc | null (gelöscht) }
    this.order = [];
  }

  async load() {
    this.zip.forEach((path, entry) => { if (!entry.dir) this.order.push(path); });
  }

  paths() {
    return this.order.filter((p) => this.files.get(p) !== null);
  }

  async bytes(path) {
    const f = this.files.get(path);
    if (f?.bytes) return f.bytes;
    const entry = this.zip.file(path);
    return entry ? entry.async('uint8array') : null;
  }

  async text(path) {
    if (this.files.get(path) === null) return null;
    const f = this.files.get(path);
    if (f?.doc) return serialize(f.doc);
    const entry = this.zip.file(path);
    return entry ? entry.async('string') : null;
  }

  async xml(path) {
    if (this.files.get(path) === null) return null;
    const cached = this.files.get(path);
    if (cached?.doc) return cached.doc;
    const text = await this.text(path);
    if (text == null) return null;
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return null;
    this.files.set(path, { doc });
    return doc;
  }

  save(path, doc) { this.files.set(path, { doc }); }
  saveBytes(path, bytes) { this.files.set(path, { bytes }); }

  removePart(path) {
    this.files.set(path, null);
    this.pendingRemovals = this.pendingRemovals || [];
    this.pendingRemovals.push(path);
  }

  async relTarget(partPath, relId) {
    if (!relId) return null;
    const rels = await this.xml(relsPathFor(partPath));
    if (!rels) return null;
    for (const r of Array.from(rels.getElementsByTagNameNS(REL, 'Relationship'))) {
      if (r.getAttribute('Id') === relId) return decodeURIComponentSafe(r.getAttribute('Target'));
    }
    return null;
  }

  async removeRelsOfType(partPath, typeRe) {
    const relsPath = relsPathFor(partPath);
    const rels = await this.xml(relsPath);
    if (!rels) return;
    for (const r of Array.from(rels.getElementsByTagNameNS(REL, 'Relationship'))) {
      if (typeRe.test(r.getAttribute('Type') || '')) r.parentNode.removeChild(r);
    }
    this.save(relsPath, rels);
  }

  // Beziehungen und Content-Type-Einträge auf entfernte Teile bereinigen
  async finalizeRemovals() {
    const removed = new Set(this.pendingRemovals || []);
    if (!removed.size) return;
    for (const path of this.paths()) {
      if (!path.endsWith('.rels')) continue;
      const rels = await this.xml(path);
      if (!rels) continue;
      let changed = false;
      for (const r of Array.from(rels.getElementsByTagNameNS(REL, 'Relationship'))) {
        if (r.getAttribute('TargetMode') === 'External') continue;
        if (removed.has(resolveTarget(path, r.getAttribute('Target')))) {
          r.parentNode.removeChild(r);
          changed = true;
        }
      }
      if (changed) this.save(path, rels);
    }
    // .rels-Dateien entfernter Teile ebenfalls löschen
    for (const p of removed) {
      const rp = relsPathFor(p);
      if (this.order.includes(rp)) this.files.set(rp, null);
    }
    const ct = await this.xml('[Content_Types].xml');
    for (const o of Array.from(ct.getElementsByTagNameNS(CT, 'Override'))) {
      const part = (o.getAttribute('PartName') || '').replace(/^\//, '');
      if (removed.has(part)) o.parentNode.removeChild(o);
    }
    this.save('[Content_Types].xml', ct);
  }

  async build() {
    await this.finalizeRemovals();
    const out = new JSZip();
    const paths = this.paths().sort((a, b) =>
      (a === '[Content_Types].xml' ? -1 : 0) - (b === '[Content_Types].xml' ? -1 : 0));
    for (const path of paths) {
      const f = this.files.get(path);
      let data;
      if (f?.doc) data = XML_DECL + serialize(f.doc);
      else if (f?.bytes) data = f.bytes;
      else data = await this.zip.file(path).async('uint8array');
      out.file(path, data, { date: FIXED_DATE, createFolders: false });
    }
    return out.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  }
}

function relsPathFor(partPath) {
  const i = partPath.lastIndexOf('/');
  const dir = i >= 0 ? partPath.slice(0, i + 1) : '';
  return `${dir}_rels/${partPath.slice(i + 1)}.rels`;
}

function resolveTarget(relsPath, target) {
  if (!target) return '';
  target = decodeURIComponentSafe(target);
  if (target.startsWith('/')) return target.slice(1);
  // relsPath: dir/_rels/name.rels → Basis: dir/
  const base = relsPath.replace(/_rels\/[^/]+$/, '');
  const parts = (base + target).split('/');
  const stack = [];
  for (const p of parts) {
    if (p === '..') stack.pop();
    else if (p !== '.' && p !== '') stack.push(p);
  }
  return stack.join('/');
}

function serialize(doc) {
  return new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
}

// ——— DOM-Helfer ———

function byName(doc, local) { return Array.from(doc.getElementsByTagNameNS(W, local)); }
function byNames(doc, names) { return names.flatMap((n) => byName(doc, n)); }
function removeAll(doc, names) { for (const el of byNames(doc, names)) el.parentNode?.removeChild(el); }
function first(root, ns, local) { return root.getElementsByTagNameNS(ns, local)[0] || null; }
function firstChild(el, local) { return Array.from(el.childNodes).find((n) => n.localName === local) || null; }
function firstElement(el) { return Array.from(el.childNodes).find((n) => n.nodeType === 1) || null; }
function closest(el, local) {
  let n = el.parentNode;
  while (n && n.nodeType === 1) { if (n.localName === local && n.namespaceURI === W) return n; n = n.parentNode; }
  return null;
}
function unwrap(el) {
  const parent = el.parentNode;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}
function attrByLocal(el, local) {
  for (const a of Array.from(el.attributes || [])) if (a.localName === local) return a.value;
  return '';
}
function formatIsoDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec((s || '').trim());
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : s;
}
function addName(set, name) { if (name && name.trim()) set.add(name.trim()); }
function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch { return s; } }
