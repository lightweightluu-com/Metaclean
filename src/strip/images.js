// Entfernt eingebettete Metadaten aus Bildern (EXIF, GPS, XMP, IPTC, Kommentare).
// Bildinhalt und Farbprofil bleiben unverändert.

/**
 * JPEG: APP1 (EXIF/XMP), APP13 (Photoshop/IPTC), APP3–APP12, APP15 und COM entfernen.
 * Behalten: APP0 (JFIF), APP2 (ICC-Farbprofil), APP14 (Adobe, nötig für CMYK-Farben).
 * Gibt null zurück, wenn nichts zu entfernen war oder die Datei kein gültiges JPEG ist.
 */
export function cleanJpeg(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const keep = [bytes.subarray(0, 2)];
  let i = 2;
  let removed = 0;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return null; // unerwartete Struktur → nicht anfassen
    const marker = bytes[i + 1];
    if (marker === 0xff) { i++; continue; } // Füllbytes
    if (marker === 0xda || marker === 0xd9) { // Start of Scan / End → Rest unverändert
      keep.push(bytes.subarray(i));
      i = bytes.length;
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { // Marker ohne Länge
      keep.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2 || i + 2 + len > bytes.length) return null;
    const seg = bytes.subarray(i, i + 2 + len);
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const keepApp = marker === 0xe0 || marker === 0xe2 || marker === 0xee;
    if ((isApp && !keepApp) || marker === 0xfe) removed++;
    else keep.push(seg);
    i += 2 + len;
  }
  if (i < bytes.length) keep.push(bytes.subarray(i));
  if (!removed) return null;
  return concat(keep);
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

/** PNG: Text-Chunks (Autor, Software, Kommentar), EXIF und Zeitstempel entfernen. */
export function cleanPng(bytes) {
  if (bytes.length < 8 || PNG_SIG.some((b, k) => bytes[k] !== b)) return null;
  const keep = [bytes.subarray(0, 8)];
  let i = 8;
  let removed = 0;
  while (i + 12 <= bytes.length) {
    const len = ((bytes[i] << 24) >>> 0) + (bytes[i + 1] << 16) + (bytes[i + 2] << 8) + bytes[i + 3];
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    const end = i + 12 + len;
    if (end > bytes.length) return null;
    if (PNG_DROP.has(type)) removed++;
    else keep.push(bytes.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  if (!removed) return null;
  return concat(keep);
}

/** Wählt den passenden Reiniger anhand der Signatur. */
export function cleanImage(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return cleanJpeg(bytes);
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return cleanPng(bytes);
  return null;
}

function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
