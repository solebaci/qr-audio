// print.js — Hoja de impresión A4: grilla, capacidad, PDF vectorial (pdf-lib) y JPG/PNG a 300 DPI.
// Medidas en milímetros. Márgenes 10 mm (útil 190×277). Cada celda: 3 mm de aire por lado + 5 mm abajo para la etiqueta.
const Hoja = (() => {
  const CLAVE = 'qra_hoja', M = 10, UTIL_W = 190, UTIL_H = 277, ESPERADO = { 3: 30, 4: 20 };
  let est = { tam: 3, items: [] };
  try { const g = JSON.parse(localStorage.getItem(CLAVE)); if (g && Array.isArray(g.items) && ESPERADO[g.tam]) est = g; } catch (e) {}
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(est)); } catch (e) {} };
  const cache = new Map();
  const qrDe = (it) => { if (!cache.has(it.link)) cache.set(it.link, QR.crearQR(it.link, CONFIG.NIVEL_QR)); return cache.get(it.link); };

  function geom(tam) {
    const cw = tam * 10 + 6, ch = tam * 10 + 11;
    const cols = Math.floor(UTIL_W / cw), filas = Math.floor(UTIL_H / ch);
    if (cols * filas !== ESPERADO[tam]) throw new Error('La capacidad de la hoja no coincide con la prevista');
    return { cw, ch, cols, filas, cap: cols * filas };
  }
  const cap = () => geom(est.tam).cap;
  const paginas = () => Math.max(1, Math.ceil(est.items.length / cap()));

  function contador() {
    const n = est.items.length, p = paginas(), enUltima = n - (p - 1) * cap();
    return (p > 1 ? 'Página ' + p + ': ' : '') + 'Llevás ' + enUltima + ' de ' + cap() + ' QR (tamaño ' + est.tam + '×' + est.tam + ' cm)' +
      (p > 1 ? ' · ' + n + ' en total' : '');
  }

  function celdas(p) {
    const g = geom(est.tam), t = est.tam * 10;
    return est.items.slice(p * g.cap, (p + 1) * g.cap).map((it, i) => {
      const x0 = M + (i % g.cols) * g.cw, y0 = M + Math.floor(i / g.cols) * g.ch;
      return { it, x0, y0, qx: x0 + 3, qy: y0 + 3, t, cw: g.cw, ch: g.ch };
    });
  }
  const ajustar = (texto, ancho, medir) => {
    if (medir(texto) <= ancho) return texto;
    let t = texto; while (t.length > 1 && medir(t + '…') > ancho) t = t.slice(0, -1);
    return t.trim() + '…';
  };
  const REGLA = 'Regla de control: esta línea mide 10 cm. Si no, imprimí al 100 % (tamaño real).';

  // ---- Imagen (vista previa y JPG/PNG) ----
  function canvas(p, dpi, guias) {
    const px = (mm) => (mm * dpi) / 25.4;
    const cv = document.createElement('canvas');
    cv.width = Math.round(px(210)); cv.height = Math.round(px(297));
    const x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
    x.font = Math.round((6 * dpi) / 72) + 'px Arial, Helvetica, sans-serif'; x.textAlign = 'center';
    celdas(p).forEach((c) => {
      if (guias) { x.strokeStyle = '#bbb'; x.lineWidth = Math.max(1, px(0.15)); x.strokeRect(px(c.x0), px(c.y0), px(c.cw), px(c.ch)); }
      const q = qrDe(c.it), m = c.t / (q.modulos + 4);
      x.fillStyle = '#000';
      for (let r = 0; r < q.modulos; r++) for (let k = 0; k < q.modulos; k++) if (q.matriz[r][k]) {
        const xa = Math.round(px(c.qx + (2 + k) * m)), xb = Math.round(px(c.qx + (3 + k) * m));
        const ya = Math.round(px(c.qy + (2 + r) * m)), yb = Math.round(px(c.qy + (3 + r) * m));
        x.fillRect(xa, ya, xb - xa, yb - ya);
      }
      x.fillText(ajustar(c.it.texto, px(c.cw - 2), (s) => x.measureText(s).width), px(c.x0 + c.cw / 2), px(c.qy + c.t + 6.5));
    });
    x.strokeStyle = '#000'; x.lineWidth = px(0.3); x.beginPath();
    x.moveTo(px(M), px(285)); x.lineTo(px(M + 100), px(285));
    for (let k = 0; k <= 10; k++) { x.moveTo(px(M + k * 10), px(285)); x.lineTo(px(M + k * 10), px(k % 5 === 0 ? 282.5 : 283.5)); }
    x.stroke(); x.fillStyle = '#000'; x.textAlign = 'left'; x.fillText(REGLA, px(M), px(281));
    return cv;
  }

  // ---- PDF vectorial: tamaño exacto, módulos nítidos ----
  async function pdf() {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc = await PDFDocument.create(), fuente = await doc.embedFont(StandardFonts.Helvetica);
    const pt = (mm) => (mm * 72) / 25.4, limpiar = (s) => s.replace(/[^\x20-\x7E\xA0-\xFF…]/g, '?');
    for (let p = 0; p < paginas(); p++) {
      const pg = doc.addPage([pt(210), pt(297)]), Y = (mm) => pt(297 - mm);
      celdas(p).forEach((c) => {
        pg.drawRectangle({ x: pt(c.x0), y: Y(c.y0 + c.ch), width: pt(c.cw), height: pt(c.ch), borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.4 });
        const q = qrDe(c.it), m = c.t / (q.modulos + 4);
        for (let r = 0; r < q.modulos; r++) {
          for (let k = 0; k < q.modulos; k++) {
            if (!q.matriz[r][k]) continue;
            let fin = k; while (fin + 1 < q.modulos && q.matriz[r][fin + 1]) fin++;
            pg.drawRectangle({ x: pt(c.qx + (2 + k) * m), y: Y(c.qy + (3 + r) * m), width: pt((fin - k + 1) * m), height: pt(m), color: rgb(0, 0, 0) });
            k = fin;
          }
        }
        const txt = ajustar(limpiar(c.it.texto), pt(c.cw - 2), (s) => fuente.widthOfTextAtSize(s, 6));
        pg.drawText(txt, { x: pt(c.x0 + c.cw / 2) - fuente.widthOfTextAtSize(txt, 6) / 2, y: Y(c.qy + c.t + 6.5), size: 6, font: fuente });
      });
      pg.drawLine({ start: { x: pt(M), y: Y(285) }, end: { x: pt(M + 100), y: Y(285) }, thickness: 0.85, color: rgb(0, 0, 0) });
      for (let k = 0; k <= 10; k++) pg.drawLine({ start: { x: pt(M + k * 10), y: Y(285) }, end: { x: pt(M + k * 10), y: Y(k % 5 === 0 ? 282.5 : 283.5) }, thickness: 0.85, color: rgb(0, 0, 0) });
      pg.drawText(limpiar(REGLA), { x: pt(M), y: Y(281), size: 6, font: fuente });
    }
    return new Blob([await doc.save()], { type: 'application/pdf' });
  }

  // ---- Edición de la lista ----
  function agregar(nuevos, tam) {
    if (est.items.length && est.tam !== tam) {
      if (confirm('La hoja actual es de ' + est.tam + '×' + est.tam + ' cm. ¿Cambiar el tamaño de TODA la hoja a ' + tam + '×' + tam + ' cm?\n\nAceptar = cambiar todo\nCancelar = ver otra opción')) est.tam = tam;
      else if (confirm('¿Empezar una hoja nueva de ' + tam + '×' + tam + ' cm? Se vacía la hoja actual.')) est = { tam, items: [] };
      else return false;
    } else est.tam = tam;
    let agregados = 0, avisada = false;
    for (const it of nuevos) {
      if (est.items.some((x) => x.fileId === it.fileId)) continue;
      if (est.items.length && est.items.length % cap() === 0 && !avisada) {
        if (!confirm('La página está llena (' + cap() + ' QR). ¿Seguir en una página nueva?')) break;
        avisada = true;
      }
      est.items.push({ fileId: it.fileId, link: it.link, texto: it.texto }); agregados++;
    }
    guardar(); return { agregados };
  }
  const quitar = (i) => { est.items.splice(i, 1); guardar(); };
  const mover = (i, d) => { const j = i + d; if (j < 0 || j >= est.items.length) return; [est.items[i], est.items[j]] = [est.items[j], est.items[i]]; guardar(); };
  const setTexto = (i, t) => { est.items[i].texto = t; guardar(); };
  const setTam = (t) => { est.tam = t; guardar(); };
  const vaciar = () => { est.items = []; guardar(); };
  const estado = () => ({ tam: est.tam, items: est.items, paginas: paginas(), cap: cap() });

  return { agregar, quitar, mover, setTexto, setTam, vaciar, estado, contador, canvas, pdf };
})();
