// drive.js — Login con Google (token model) y Google Drive API v3. Scope mínimo: drive.file
const Drive = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const API = 'https://www.googleapis.com/drive/v3';
  const SUBIR = 'https://www.googleapis.com/upload/drive/v3/files';
  let token = null, vence = 0, cliente = null, carpetaId = null;

  function pedirToken() {
    return new Promise((ok, mal) => {
      if (!window.google || !google.accounts) return mal(new Error('No se pudo cargar el login de Google. Revisá tu conexión a internet.'));
      if (CONFIG.CLIENT_ID.startsWith('PEGAR')) return mal(new Error('Falta configurar el Client ID de Google (ver README, paso 1).'));
      if (!cliente) cliente = google.accounts.oauth2.initTokenClient({ client_id: CONFIG.CLIENT_ID, scope: SCOPE, hint: CONFIG.CUENTA, callback: () => {} });
      cliente.callback = (r) => {
        if (r.error) return mal(new Error('No se pudo iniciar sesión con Google (' + r.error + ').'));
        token = r.access_token; vence = Date.now() + (r.expires_in - 60) * 1000; ok(token);
      };
      cliente.error_callback = () => mal(new Error('Se canceló el inicio de sesión de Google.'));
      cliente.requestAccessToken({ prompt: '' });
    });
  }
  const tokenValido = () => (token && Date.now() < vence ? Promise.resolve(token) : pedirToken());

  async function api(url, opts = {}, reintento = true) {
    const t = await tokenValido();
    let res;
    try { res = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + t } }); }
    catch (e) { throw new Error('Sin conexión a internet, o la conexión es muy lenta. Probá de nuevo.'); }
    if (res.status === 401 && reintento) { token = null; return api(url, opts, false); }
    if (!res.ok) {
      const txt = await res.text();
      if (/storageQuotaExceeded/.test(txt)) throw new Error('Tu Google Drive está lleno. Liberá espacio y probá de nuevo.');
      throw new Error('Google Drive devolvió un error (' + res.status + '). Probá de nuevo en un rato.');
    }
    return res;
  }
  const json = async (url, opts) => (await api(url, opts)).json();
  const q = (s) => encodeURIComponent(s);

  function multipart(meta, blob) {
    const b = 'qraudio' + Date.now();
    const body = new Blob(['--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
      '\r\n--' + b + '\r\nContent-Type: ' + (blob.type || 'application/octet-stream') + '\r\n\r\n', blob, '\r\n--' + b + '--']);
    return { body, headers: { 'Content-Type': 'multipart/related; boundary=' + b } };
  }

  async function carpeta() {
    if (carpetaId) return carpetaId;
    const r = await json(API + '/files?fields=files(id)&q=' + q("name='" + CONFIG.CARPETA + "' and mimeType='application/vnd.google-apps.folder' and trashed=false"));
    if (r.files.length) return (carpetaId = r.files[0].id);
    const n = await json(API + '/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: CONFIG.CARPETA, mimeType: 'application/vnd.google-apps.folder' }) });
    return (carpetaId = n.id);
  }

  async function siguienteNumero(carp) {
    let max = 0, pagina = '';
    do {
      const r = await json(API + '/files?pageSize=1000&fields=nextPageToken,files(name)&q=' + q("'" + carp + "' in parents and trashed=false") + pagina);
      r.files.forEach((f) => { const m = /_(\d{3})\.[a-z0-9]+$/i.exec(f.name); if (m) max = Math.max(max, +m[1]); });
      pagina = r.nextPageToken ? '&pageToken=' + r.nextPageToken : '';
    } while (pagina);
    return max + 1;
  }

  const csv = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  async function registrar(carp, fila) {
    const cab = 'id,fecha,cliente_etiqueta,nombre_archivo,file_id,link,estado\n', linea = fila.map(csv).join(',') + '\n';
    const r = await json(API + '/files?fields=files(id)&q=' + q("name='registro_llaveros.csv' and '" + carp + "' in parents and trashed=false"));
    if (!r.files.length) {
      const mp = multipart({ name: 'registro_llaveros.csv', parents: [carp] }, new Blob(['\ufeff' + cab + linea], { type: 'text/csv' }));
      await api(SUBIR + '?uploadType=multipart', { method: 'POST', ...mp });
      return;
    }
    const id = r.files[0].id, actual = await (await api(API + '/files/' + id + '?alt=media')).text();
    await api(SUBIR + '/' + id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'text/csv' }, body: actual + linea });
  }

  const limpio = (s) => s.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-');
  function extension(f) {
    const m = /\.([a-z0-9]{2,5})$/i.exec(f.name);
    if (m) return m[1].toLowerCase();
    return ({ 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav' })[f.type] || 'ogg';
  }
  const mimeDe = (f) => f.type || ({ opus: 'audio/ogg', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav' })[extension(f)] || 'application/octet-stream';

  async function guardar(file, etiqueta) {
    const carp = await carpeta(), n = await siguienteNumero(carp), ext = extension(file);
    const nombre = new Date().toLocaleDateString('sv') + '_' + limpio(etiqueta) + '_' + String(n).padStart(3, '0') + '.' + ext;
    const mp = multipart({ name: nombre, parents: [carp] }, new Blob([file], { type: mimeDe(file) }));
    const sub = await json(SUBIR + '?uploadType=multipart&fields=id', { method: 'POST', ...mp });
    await api(API + '/files/' + sub.id + '/permissions', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'anyone', role: 'reader' }) });
    const link = 'https://drive.google.com/file/d/' + sub.id + '/view';
    let registroOk = true;
    try { await registrar(carp, [String(n).padStart(3, '0'), new Date().toLocaleDateString('sv'), etiqueta.trim(), nombre, sub.id, link, 'ok']); }
    catch (e) { registroOk = false; }
    return { fileId: sub.id, link, nombre, numero: n, registroOk };
  }

  return { guardar };
})();
