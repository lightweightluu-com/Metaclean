// Bereinigt PDF-Dateien vollständig im Speicher.
// Entfernt: Dokumentinfo (Autor, Titel, Programm, Daten), XMP-Metadaten auf allen
// Ebenen, Programm-Privatdaten (PieceInfo), Dokument-ID, Autoren und Daten in
// Kommentaren/Anmerkungen, Daten von Dateianhängen, Bild-EXIF sowie alte
// Bearbeitungsstände (inkrementelle Speicherungen) und unbenutzte Objekte.

import {
  PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFStream, PDFRawStream,
  PDFString, PDFHexString, PDFNumber, decodePDFRawStream
} from 'pdf-lib';
import { cleanJpeg } from './images.js';
import { Report, UserError } from './report.js';

const N = (s) => PDFName.of(s);
const INFO_LABELS = {
  Title: 'Titel',
  Author: 'Autor',
  Subject: 'Betreff',
  Keywords: 'Stichwörter',
  Creator: 'Erstellt mit',
  Producer: 'PDF erzeugt von',
  CreationDate: 'Erstellt am',
  ModDate: 'Geändert am',
  Trapped: 'Überfüllung'
};
const XMP_TAGS = [
  ['dc:creator', 'Autor (XMP)'],
  ['xmp:CreatorTool', 'Erstellt mit (XMP)'],
  ['pdf:Producer', 'PDF erzeugt von (XMP)'],
  ['xmp:CreateDate', 'Erstellt am (XMP)'],
  ['xmp:ModifyDate', 'Geändert am (XMP)'],
  ['photoshop:AuthorsPosition', 'Position des Autors'],
  ['xmpMM:DocumentID', 'Dokument-ID (XMP)']
];

export async function stripPdf(input) {
  let doc;
  try {
    doc = await PDFDocument.load(input, { updateMetadata: false, throwOnInvalidObject: false });
  } catch (err) {
    if (/encrypt/i.test(String(err?.message || err))) {
      throw new UserError('Das PDF ist verschlüsselt oder geschützt. Bitte eine ungeschützte Version verwenden (z. B. «Drucken als PDF»).');
    }
    throw new UserError('Die Datei konnte nicht als PDF gelesen werden. Ist sie beschädigt?');
  }

  const report = new Report();
  const ctx = doc.context;

  // 1 · Dokumentinfo auslesen und entfernen
  const info = ctx.lookup(ctx.trailerInfo.Info);
  if (info instanceof PDFDict) {
    for (const [key, value] of info.entries()) {
      const k = key.decodeText();
      const text = pdfText(value);
      const label = INFO_LABELS[k] || `Eigenes Feld «${k}»`;
      report.found(label, /Date$/.test(k) ? formatPdfDate(text) : text);
    }
  }
  ctx.trailerInfo.Info = undefined;
  ctx.trailerInfo.ID = undefined;

  // 2 · Alle Objekte durchgehen
  let xmpCount = 0;
  let pieceInfo = false;
  let annotAuthors = 0;
  let imageCount = 0;
  let hasSignature = false;
  let hasAttachments = false;

  const scrubDict = (dict) => {
    const xmp = dict.get(N('Metadata'));
    if (xmp) {
      const stream = xmp instanceof PDFRef ? ctx.lookup(xmp) : xmp;
      if (stream instanceof PDFStream) readXmp(stream, report);
      dict.delete(N('Metadata'));
      xmpCount++;
    }
    if (dict.has(N('PieceInfo'))) { dict.delete(N('PieceInfo')); pieceInfo = true; }
    dict.delete(N('LastModified'));

    const type = nameOf(dict.get(N('Type')));
    const subtype = nameOf(dict.get(N('Subtype')));
    if (type === 'Sig' || nameOf(dict.get(N('FT'))) === 'Sig') hasSignature = true;
    if (type === 'EmbeddedFile' || type === 'Filespec') hasAttachments = true;

    // Anmerkungen/Kommentare: Autor und Daten entfernen
    if (dict.has(N('Rect')) && subtype) {
      if (subtype !== 'Widget' && subtype !== 'Link') {
        const author = pdfText(dict.get(N('T')));
        if (author) { report.found('Autor einer Anmerkung', author); annotAuthors++; }
        dict.delete(N('T'));
        dict.delete(N('CreationDate'));
      }
      dict.delete(N('M'));
    }
    // Dateianhänge: Erstell-/Änderungsdatum
    if (type === 'EmbeddedFile') {
      const params = ctx.lookup(dict.get(N('Params')));
      if (params instanceof PDFDict) {
        params.delete(N('CreationDate'));
        params.delete(N('ModDate'));
      }
    }
  };

  const walkDirect = (obj, depth = 0) => {
    if (depth > 64) return;
    if (obj instanceof PDFStream) obj = obj.dict;
    if (obj instanceof PDFDict) {
      scrubDict(obj);
      for (const [, v] of obj.entries()) if (!(v instanceof PDFRef)) walkDirect(v, depth + 1);
    } else if (obj instanceof PDFArray) {
      for (let i = 0; i < obj.size(); i++) {
        const v = obj.get(i);
        if (!(v instanceof PDFRef)) walkDirect(v, depth + 1);
      }
    }
  };

  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    walkDirect(obj);
    // JPEG-Bilder: EXIF/GPS/XMP im Bild selbst entfernen
    if (obj instanceof PDFRawStream && nameOf(obj.dict.get(N('Subtype'))) === 'Image' && isOnlyDct(obj.dict.get(N('Filter')))) {
      const cleaned = cleanJpeg(obj.contents);
      if (cleaned) {
        obj.dict.set(N('Length'), PDFNumber.of(cleaned.length));
        ctx.assign(ref, PDFRawStream.of(obj.dict, cleaned));
        imageCount++;
      }
    }
  }

  // 3 · Nicht mehr erreichbare Objekte löschen (alte Versionen, entfernte XMP-Streams)
  const removed = collectGarbage(ctx);

  if (xmpCount) report.action(`XMP-Metadaten entfernt (${xmpCount} ${xmpCount === 1 ? 'Block' : 'Blöcke'})`);
  if (pieceInfo) report.action('Private Programmdaten (z. B. von Illustrator/InDesign) entfernt');
  if (annotAuthors) report.action(`Autoren aus ${annotAuthors} ${annotAuthors === 1 ? 'Anmerkung' : 'Anmerkungen'} entfernt`);
  if (imageCount) report.action(`Metadaten aus ${imageCount} ${imageCount === 1 ? 'Bild' : 'Bildern'} entfernt (EXIF, GPS, Kamera)`);
  if (removed) report.action('Frühere Bearbeitungsstände und unbenutzte Daten entfernt');
  report.action('Dokument-ID und Zeitstempel entfernt');
  if (hasSignature) report.warn('Das PDF enthielt eine digitale Signatur. Sie ist nach dem Bereinigen nicht mehr gültig.');
  if (hasAttachments) report.warn('Das PDF enthält Dateianhänge. Deren Inhalt wurde nicht bereinigt.');

  const bytes = await doc.save({ updateFieldAppearances: false, addDefaultPage: false });
  return { bytes, report: report.toJSON() };
}

function collectGarbage(ctx) {
  const reachable = new Set();
  const stack = [ctx.trailerInfo.Root];
  const visit = (obj) => {
    if (obj instanceof PDFRef) stack.push(obj);
    else if (obj instanceof PDFStream) visit(obj.dict);
    else if (obj instanceof PDFDict) for (const [, v] of obj.entries()) visit(v);
    else if (obj instanceof PDFArray) for (let i = 0; i < obj.size(); i++) visit(obj.get(i));
  };
  while (stack.length) {
    const ref = stack.pop();
    if (!(ref instanceof PDFRef)) continue;
    const key = ref.toString();
    if (reachable.has(key)) continue;
    reachable.add(key);
    visit(ctx.lookup(ref));
  }
  let removed = 0;
  for (const [ref] of ctx.enumerateIndirectObjects()) {
    if (!reachable.has(ref.toString())) { ctx.delete(ref); removed++; }
  }
  return removed;
}

function readXmp(stream, report) {
  try {
    const raw = stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents();
    const xml = new TextDecoder('utf-8').decode(raw);
    for (const [tag, label] of XMP_TAGS) {
      const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>|${tag}="([^"]*)"`, 'g');
      let m;
      while ((m = re.exec(xml))) {
        const val = (m[1] ?? m[2] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        report.found(label, /Date$/.test(tag) ? formatIsoDate(val) : decodeEntities(val));
      }
    }
  } catch {
    // unlesbare XMP-Daten werden trotzdem entfernt
  }
}

function pdfText(v) {
  if (v instanceof PDFString || v instanceof PDFHexString) {
    try { return v.decodeText(); } catch { return ''; }
  }
  if (v instanceof PDFName) return v.decodeText();
  return '';
}

function nameOf(v) { return v instanceof PDFName ? v.decodeText() : ''; }

function isOnlyDct(filter) {
  if (filter instanceof PDFName) return filter.decodeText() === 'DCTDecode';
  if (filter instanceof PDFArray && filter.size() === 1) return nameOf(filter.get(0)) === 'DCTDecode';
  return false;
}

function formatPdfDate(s) {
  const m = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(s || '');
  if (!m) return s;
  const [, y, mo = '01', d = '01', h, mi] = m;
  return `${d}.${mo}.${y}${h ? ` ${h}:${mi || '00'}` : ''}`;
}

function formatIsoDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ''}` : s;
}

function decodeEntities(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
