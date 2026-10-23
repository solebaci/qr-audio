// qr.js — Generador de códigos QR propio, sin dependencias externas.
// Modo byte, corrección de errores Q o H, versiones 1 a 12 (alcanza para links de Drive).
(function (root) {
  'use strict';

  // ---- Matemática de Reed-Solomon (campo de Galois 256) ----
  const EXP = new Array(512), LOG = new Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 285; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

  function generador(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const s = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) { s[j] ^= g[j]; s[j + 1] ^= gmul(g[j], EXP[i]); }
      g = s;
    }
    return g;
  }
  function rs(datos, n) {
    const g = generador(n), r = datos.concat(new Array(n).fill(0));
    for (let i = 0; i < datos.length; i++) {
      const c = r[i];
      if (c) for (let j = 0; j < g.length; j++) r[i + j] ^= gmul(g[j], c);
    }
    return r.slice(datos.length);
  }

  // ---- Tablas: [cantidad de bloques, palabras totales, palabras de datos, ...] por versión 1..12 ----
  const BLOQUES = {
    Q: [[1,26,13],[1,44,22],[2,35,17],[2,50,24],[2,33,15,2,34,16],[4,43,19],[2,32,14,4,33,15],
        [4,40,18,2,41,19],[4,36,16,4,37,17],[6,43,19,2,44,20],[4,50,22,4,51,23],[4,46,20,6,47,21]],
    H: [[1,26,9],[1,44,16],[2,35,13],[4,25,9],[2,33,11,2,34,12],[4,43,15],[4,39,13,1,40,14],
        [4,40,14,2,41,15],[4,36,12,4,37,13],[6,43,15,2,44,16],[3,36,12,8,37,13],[7,42,14,4,43,15]]
  };
  const ALINEACION = [[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58]];
  const BITS_NIVEL = { Q: 3, H: 2 };

  function expandir(nivel, v) {
    const t = BLOQUES[nivel][v - 1], out = [];
    for (let i = 0; i < t.length; i += 3) for (let k = 0; k < t[i]; k++) out.push({ total: t[i + 1], datos: t[i + 2] });
    return out;
  }

  function bch(valor, gen, grado) {
    const dig = (x) => { let n = 0; while (x) { n++; x >>>= 1; } return n; };
    let d = valor << grado;
    while (dig(d) - dig(gen) >= 0) d ^= gen << (dig(d) - dig(gen));
    return (valor << grado) | d;
  }

  const MASCARAS = [
    (i, j) => (i + j) % 2 === 0,
    (i) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
    (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0
  ];

  function codificar(texto, nivel) {
    const bytes = Array.from(new TextEncoder().encode(texto));
    // elegir versión
    let v = 1;
    for (; v <= 12; v++) {
      const cap = expandir(nivel, v).reduce((s, b) => s + b.datos, 0);
      if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= cap * 8) break;
    }
    if (v > 12) throw new Error('El texto es demasiado largo para este QR');
    const bloques = expandir(nivel, v);
    const capacidad = bloques.reduce((s, b) => s + b.datos, 0);

    // bits de datos
    const bits = [];
    const poner = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    poner(4, 4); poner(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach((b) => poner(b, 8));
    for (let i = 0; i < 4 && bits.length < capacidad * 8; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const cw = [];
    for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (let p = 0; cw.length < capacidad; p++) cw.push(p % 2 ? 0x11 : 0xEC);

    // dividir en bloques y calcular corrección
    let pos = 0;
    const datosB = [], ecB = [];
    bloques.forEach((b) => {
      const d = cw.slice(pos, pos + b.datos); pos += b.datos;
      datosB.push(d); ecB.push(rs(d, b.total - b.datos));
    });
    const final = [];
    const maxD = Math.max(...datosB.map((d) => d.length));
    for (let i = 0; i < maxD; i++) datosB.forEach((d) => { if (i < d.length) final.push(d[i]); });
    const maxE = Math.max(...ecB.map((d) => d.length));
    for (let i = 0; i < maxE; i++) ecB.forEach((d) => { if (i < d.length) final.push(d[i]); });
    return { v, final };
  }

  function construir(v, final, nivel, mascara) {
    const n = 17 + 4 * v;
    const m = Array.from({ length: n }, () => new Array(n).fill(null));
    const buscador = (r, c) => {
      for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
        if (r + i < 0 || c + j < 0 || r + i >= n || c + j >= n) continue;
        m[r + i][c + j] = (i >= 0 && i <= 6 && (j === 0 || j === 6)) || (j >= 0 && j <= 6 && (i === 0 || i === 6)) ||
          (i >= 2 && i <= 4 && j >= 2 && j <= 4);
      }
    };
    buscador(0, 0); buscador(n - 7, 0); buscador(0, n - 7);
    const pos = ALINEACION[v - 1];
    pos.forEach((r) => pos.forEach((c) => {
      if (m[r][c] !== null) return;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++)
        m[r + i][c + j] = Math.max(Math.abs(i), Math.abs(j)) !== 1;
    }));
    for (let i = 8; i < n - 8; i++) { if (m[i][6] === null) m[i][6] = i % 2 === 0; if (m[6][i] === null) m[6][i] = i % 2 === 0; }
    // información de formato
    const fmt = bch((BITS_NIVEL[nivel] << 3) | mascara, 0x537, 10) ^ 0x5412;
    for (let i = 0; i < 15; i++) {
      const b = ((fmt >> i) & 1) === 1;
      if (i < 6) m[i][8] = b; else if (i < 8) m[i + 1][8] = b; else m[n - 15 + i][8] = b;
      if (i < 8) m[8][n - i - 1] = b; else if (i < 9) m[8][15 - i] = b; else m[8][14 - i] = b;
    }
    m[n - 8][8] = true;
    if (v >= 7) {
      const info = bch(v, 0x1F25, 12);
      for (let i = 0; i < 18; i++) {
        const b = ((info >> i) & 1) === 1;
        m[Math.floor(i / 3)][(i % 3) + n - 11] = b;
        m[(i % 3) + n - 11][Math.floor(i / 3)] = b;
      }
    }
    // colocar datos en zigzag
    let inc = -1, fila = n - 1, bit = 7, byte = 0;
    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (;;) {
        for (let c = 0; c < 2; c++) {
          if (m[fila][col - c] === null) {
            let oscuro = byte < final.length ? ((final[byte] >>> bit) & 1) === 1 : false;
            if (MASCARAS[mascara](fila, col - c)) oscuro = !oscuro;
            m[fila][col - c] = oscuro;
            if (--bit < 0) { byte++; bit = 7; }
          }
        }
        fila += inc;
        if (fila < 0 || fila >= n) { fila -= inc; inc = -inc; break; }
      }
    }
    return m;
  }

  function penalidad(m) {
    const n = m.length; let p = 0;
    for (let t = 0; t < 2; t++) {
      for (let a = 0; a < n; a++) {
        let racha = 1;
        for (let b = 1; b < n; b++) {
          const x = t ? m[b][a] : m[a][b], y = t ? m[b - 1][a] : m[a][b - 1];
          if (x === y) { racha++; if (racha === 5) p += 3; else if (racha > 5) p++; } else racha = 1;
        }
      }
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const s = m[r][c] + m[r][c + 1] + m[r + 1][c] + m[r + 1][c + 1];
      if (s === 0 || s === 4) p += 3;
    }
    const pat = [1,0,1,1,1,0,1,0,0,0,0], inv = pat.slice().reverse();
    for (let t = 0; t < 2; t++) for (let a = 0; a < n; a++) for (let b = 0; b <= n - 11; b++) {
      let o1 = true, o2 = true;
      for (let k = 0; k < 11; k++) {
        const x = (t ? m[b + k][a] : m[a][b + k]) ? 1 : 0;
        if (x !== pat[k]) o1 = false; if (x !== inv[k]) o2 = false;
      }
      if (o1 || o2) p += 40;
    }
    let oscuros = 0; m.forEach((f) => f.forEach((x) => { if (x) oscuros++; }));
    p += Math.floor(Math.abs((oscuros * 100) / (n * n) - 50) / 5) * 10;
    return p;
  }

  // ---- API pública ----
  function crearQR(texto, nivel) {
    nivel = nivel === 'Q' ? 'Q' : 'H';
    const { v, final } = codificar(texto, nivel);
    let mejor = null, mejorP = Infinity;
    for (let k = 0; k < 8; k++) {
      const m = construir(v, final, nivel, k), p = penalidad(m);
      if (p < mejorP) { mejorP = p; mejor = m; }
    }
    return { version: v, nivel, modulos: mejor.length, matriz: mejor };
  }

  // Dibuja en un canvas: negro sobre blanco, margen de 4 módulos, mínimo `minPx` píxeles de lado
  function dibujar(canvas, qr, minPx, margen) {
    margen = margen == null ? 4 : margen;
    const total = qr.modulos + margen * 2;
    const escala = Math.max(1, Math.ceil((minPx || 1200) / total));
    canvas.width = canvas.height = total * escala;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let r = 0; r < qr.modulos; r++) for (let c = 0; c < qr.modulos; c++)
      if (qr.matriz[r][c]) ctx.fillRect((c + margen) * escala, (r + margen) * escala, escala, escala);
    return canvas;
  }

  function aSVG(qr, margen) {
    margen = margen == null ? 4 : margen;
    const total = qr.modulos + margen * 2; let d = '';
    for (let r = 0; r < qr.modulos; r++) for (let c = 0; c < qr.modulos; c++)
      if (qr.matriz[r][c]) d += 'M' + (c + margen) + ' ' + (r + margen) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total +
      '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  const API = { crearQR, dibujar, aSVG };
  if (typeof module !== 'undefined') module.exports = API; else root.QR = API;
})(typeof self !== 'undefined' ? self : this);
