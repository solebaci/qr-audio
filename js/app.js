// app.js — navegación, reproductor, recepción desde WhatsApp y pantalla del QR.
const $ = (s) => document.querySelector(s);
let archivo = null, urlAudio = null, resultado = null, qr = null;

function ir(id) {
  document.querySelectorAll('.pantalla').forEach((s) => (s.hidden = s.id !== id));
  $('#atras').hidden = id === 'inicio';
  window.scrollTo(0, 0);
}
let tt;
function aviso(msg, error) {
  const t = $('#toast'); t.textContent = msg; t.className = error ? 'error' : ''; t.style.display = 'block';
  clearTimeout(tt); tt = setTimeout(() => (t.style.display = 'none'), error ? 6000 : 2500);
}
const tamanio = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const tiempo = (s) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');

function cargar(f) {
  archivo = f;
  if (urlAudio) URL.revokeObjectURL(urlAudio);
  urlAudio = URL.createObjectURL(f);
  const r = $('#reproductor'); r.src = urlAudio;
  $('#a-nombre').textContent = f.name;
  $('#a-datos').textContent = tamanio(f.size) + ' · calculando duración…';
  r.onloadedmetadata = () => ($('#a-datos').textContent = tamanio(f.size) + ' · duración ' + tiempo(r.duration));
  r.onerror = () => ($('#a-datos').textContent = tamanio(f.size) + ' · este celular no pudo reproducir el audio');
  $('#etiqueta').value = ''; $('#estado').textContent = ''; $('#b-guardar').disabled = false;
  ir('audio');
}

// Audio que llega desde WhatsApp (el Service Worker lo deja guardado un momento)
async function recibirCompartido() {
  if (!location.search.includes('compartido')) return;
  history.replaceState(null, '', location.pathname);
  try {
    const c = await caches.open('compartido'), r = await c.match('archivo');
    if (!r) return aviso('No llegó ningún audio. Probá con "Abrir audio".', true);
    const blob = await r.blob();
    await c.delete('archivo');
    cargar(new File([blob], decodeURIComponent(r.headers.get('X-Nombre') || 'audio.opus'), { type: blob.type }));
  } catch (e) { aviso('No se pudo abrir el audio compartido. Probá con "Abrir audio".', true); }
}

function bajar(blob, nombre) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const aBlob = (tipo) => new Promise((ok) => $('#lienzo').toBlob(ok, tipo, 1));
const baseNombre = () => resultado.nombre.replace(/\.[a-z0-9]+$/i, '');

async function guardar() {
  const etiqueta = $('#etiqueta').value.trim();
  if (!etiqueta) { aviso('Escribí el nombre del cliente o una etiqueta.', true); return $('#etiqueta').focus(); }
  const b = $('#b-guardar'); b.disabled = true; $('#estado').textContent = '⏳ Guardando en Drive… no cierres la app.';
  try {
    resultado = await Drive.guardar(archivo, etiqueta); resultado.etiqueta = etiqueta;
    qr = QR.crearQR(resultado.link, CONFIG.NIVEL_QR);
    QR.dibujar($('#lienzo'), qr, 1200, 4);
    $('#q-nombre').textContent = resultado.nombre;
    const r = $('#q-registro');
    r.hidden = resultado.registroOk;
    r.textContent = '⚠️ El audio se guardó bien, pero no se pudo actualizar registro_llaveros.csv. Anotá este link por las dudas.';
    ir('qr');
  } catch (e) { $('#estado').textContent = ''; aviso(e.message, true); }
  b.disabled = false;
}

// ---- Botones ----
const elegir = () => $('#archivo').click();
$('#b-abrir').onclick = elegir; $('#b-nuevo').onclick = elegir;
$('#b-mis').onclick = () => aviso('"Mis audios" se agrega en la próxima etapa.');
$('#b-hoja').onclick = () => aviso('La "Hoja de impresión" se agrega en la próxima etapa.');
$('#archivo').onchange = (e) => { if (e.target.files[0]) cargar(e.target.files[0]); e.target.value = ''; };
$('#atras').onclick = () => { $('#reproductor').pause(); ir('inicio'); };
$('#b-guardar').onclick = guardar;
$('#b-otro').onclick = () => ir('inicio');
$('#d-png').onclick = async () => bajar(await aBlob('image/png'), baseNombre() + '.png');
$('#d-jpg').onclick = async () => bajar(await aBlob('image/jpeg'), baseNombre() + '.jpg');
$('#d-svg').onclick = () => bajar(new Blob([QR.aSVG(qr, 4)], { type: 'image/svg+xml' }), baseNombre() + '.svg');
$('#b-probar').onclick = () => window.open(resultado.link, '_blank');
$('#b-copiar').onclick = async () => {
  try { await navigator.clipboard.writeText(resultado.link); aviso('Link copiado ✅'); } catch (e) { aviso(resultado.link); }
};
$('#b-compartir').onclick = async () => {
  try {
    const f = new File([await aBlob('image/png')], baseNombre() + '.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'QR ' + resultado.nombre });
    else await navigator.share({ title: 'QR ' + resultado.nombre, text: resultado.link });
  } catch (e) { if (e.name !== 'AbortError') aviso('Este celular no permite compartir desde acá. Usá Descargar.', true); }
};

// ---- Hoja de impresión y Mis audios ----
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const tamDe = (n) => +document.querySelector('input[name=' + n + ']:checked').value;
const actualizarInicio = () => ($('#b-hoja small').textContent = Hoja.contador());
function agregarAHoja(items, tam) {
  const r = Hoja.agregar(items, tam); actualizarInicio();
  if (r) aviso(r.agregados ? 'Agregado a la hoja ✅ ' + Hoja.contador() : 'Ese QR ya estaba en la hoja.');
}
$('#b-hoja-add').onclick = () => agregarAHoja([{ fileId: resultado.fileId, link: resultado.link,
  texto: resultado.etiqueta + ' · ' + String(resultado.numero).padStart(3, '0') }], tamDe('tam'));

let pagina = 0;
function pintarHoja() {
  const e = Hoja.estado(); pagina = Math.max(0, Math.min(pagina, e.paginas - 1));
  $('#h-cont').textContent = Hoja.contador(); $('#h-tam').value = e.tam;
  $('#h-pag').textContent = 'Página ' + (pagina + 1) + ' de ' + e.paginas;
  const cv = Hoja.canvas(pagina, 70, $('#h-guias').checked), v = $('#h-canvas');
  v.width = cv.width; v.height = cv.height; v.getContext('2d').drawImage(cv, 0, 0);
  $('#h-items').innerHTML = e.items.map((it, i) => '<div class="item"><span>' + (i + 1) + '</span><input type="text" data-t="' + i + '" value="' + esc(it.texto) +
    '"><button data-up="' + i + '">▲</button><button data-dn="' + i + '">▼</button><button data-x="' + i + '">✕</button></div>').join('') ||
    '<div class="dato">La hoja está vacía. Agregá QR desde "Nuevo llavero" o "Mis audios".</div>';
  actualizarInicio();
}
$('#b-hoja').onclick = () => { pintarHoja(); ir('hoja'); };
$('#h-guias').onchange = pintarHoja;
$('#h-prev').onclick = () => { pagina--; pintarHoja(); };
$('#h-next').onclick = () => { pagina++; pintarHoja(); };
$('#h-tam').onchange = (e) => {
  if (Hoja.estado().items.length && !confirm('¿Cambiar el tamaño de TODA la hoja?')) return pintarHoja();
  Hoja.setTam(+e.target.value); pintarHoja();
};
$('#h-items').onclick = (e) => {
  const d = e.target.dataset; if (!d) return;
  if (d.x !== undefined) Hoja.quitar(+d.x); else if (d.up !== undefined) Hoja.mover(+d.up, -1); else if (d.dn !== undefined) Hoja.mover(+d.dn, 1); else return;
  pintarHoja();
};
$('#h-items').onchange = (e) => { if (e.target.dataset.t !== undefined) { Hoja.setTexto(+e.target.dataset.t, e.target.value); pintarHoja(); } };
$('#h-vaciar').onclick = () => { if (confirm('¿Vaciar toda la hoja? Los audios en Drive no se tocan.')) { Hoja.vaciar(); pagina = 0; pintarHoja(); } };
const hojaVacia = () => (Hoja.estado().items.length ? false : (aviso('La hoja está vacía.', true), true));
const nombreHoja = () => 'hoja-qr-' + Hoja.estado().tam + 'x' + Hoja.estado().tam;
$('#h-pdf').onclick = async () => { if (hojaVacia()) return; try { bajar(await Hoja.pdf(), nombreHoja() + '.pdf'); } catch (e) { aviso('No se pudo armar el PDF: ' + e.message, true); } };
async function bajarImagenes(tipo) {
  if (hojaVacia()) return;
  for (let p = 0; p < Hoja.estado().paginas; p++) {
    const blob = await new Promise((ok) => Hoja.canvas(p, 300, $('#h-guias').checked).toBlob(ok, tipo, 1));
    bajar(blob, nombreHoja() + '-p' + (p + 1) + (tipo === 'image/png' ? '.png' : '.jpg'));
  }
}
$('#h-png').onclick = () => bajarImagenes('image/png');
$('#h-jpg').onclick = () => bajarImagenes('image/jpeg');
$('#h-share').onclick = async () => {
  if (hojaVacia()) return;
  try { const f = new File([await Hoja.pdf()], nombreHoja() + '.pdf', { type: 'application/pdf' }); await navigator.share({ files: [f], title: 'Hoja de QR' }); }
  catch (e) { if (e.name !== 'AbortError') aviso('Este celular no permite compartir desde acá. Usá Descargar PDF.', true); }
};

let audios = [], elegidos = new Set();
function pintarLista() {
  const t = $('#buscar').value.trim().toLowerCase();
  const html = audios.map((a, i) => ({ a, i })).filter(({ a }) => (a.etiqueta + ' ' + a.fecha + ' ' + a.numero).toLowerCase().includes(t))
    .map(({ a, i }) => '<div class="item"><input type="checkbox" data-s="' + i + '"' + (elegidos.has(i) ? ' checked' : '') + '><span class="nom">' + esc(a.etiqueta) +
      '<small>' + a.fecha + ' · ' + a.numero + '</small></span><button data-qr="' + i + '">QR</button><button data-pl="' + i + '">▶</button></div>').join('');
  $('#lista').innerHTML = html || '<div class="dato">No hay audios para mostrar.</div>';
  $('#m-n').textContent = elegidos.size + ' seleccionados';
}
async function abrirMis() {
  ir('mis'); $('#lista').innerHTML = '<div class="dato">⏳ Cargando desde Drive…</div>';
  try { audios = await Drive.listar(); elegidos.clear(); pintarLista(); }
  catch (e) { $('#lista').innerHTML = ''; aviso(e.message, true); }
}
$('#b-mis').onclick = abrirMis;
$('#buscar').oninput = pintarLista;
$('#lista').onclick = (e) => {
  const d = e.target.dataset, a = audios[+(d.qr || d.pl)];
  if (d.s !== undefined) { elegidos.has(+d.s) ? elegidos.delete(+d.s) : elegidos.add(+d.s); $('#m-n').textContent = elegidos.size + ' seleccionados'; }
  else if (d.pl !== undefined) window.open(a.link, '_blank');
  else if (d.qr !== undefined) {
    resultado = { fileId: a.id, link: a.link, nombre: a.name, numero: a.numero, etiqueta: a.etiqueta, registroOk: true };
    qr = QR.crearQR(a.link, CONFIG.NIVEL_QR); QR.dibujar($('#lienzo'), qr, 1200, 4);
    $('#q-nombre').textContent = a.name; $('#q-registro').hidden = true; ir('qr');
  }
};
$('#m-add').onclick = () => {
  if (!elegidos.size) return aviso('Tildá al menos un audio.', true);
  agregarAHoja([...elegidos].sort((x, y) => y - x).map((i) => audios[i]).map((a) => ({ fileId: a.id, link: a.link, texto: a.etiqueta + ' · ' + a.numero })), tamDe('tam2'));
  elegidos.clear(); pintarLista();
};
actualizarInicio();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
recibirCompartido();
