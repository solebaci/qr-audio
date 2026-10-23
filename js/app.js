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
    resultado = await Drive.guardar(archivo, etiqueta);
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
recibirCompartido();
