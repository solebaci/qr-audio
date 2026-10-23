# QR Audio — guía paso a paso (para no programadores)

La app guarda audios en tu Google Drive (**bacigalupoms@gmail.com**) y genera el QR que lleva directo al audio.
Hacé los pasos 1 y 2 **desde una computadora**; el celular es solo para el paso 3 y 4.

## Estado actual
Hecho: instalación en Android, abrir/escuchar audio, compartir desde WhatsApp, guardar en Drive (carpeta
"Audios Llaveros QR", permiso "cualquiera con el enlace", nombre `AAAA-MM-DD_Cliente_NNN.ext`),
registro `registro_llaveros.csv` automático, QR en PNG/JPG/SVG (≥1200 px), compartir, copiar y probar link.
Falta (próximas etapas): Hoja de impresión, Mis audios, Verificar enlaces, respaldo ZIP.

## Paso 0 — Prueba de audio (antes de todo)
1. Subí a mano un audio de WhatsApp (.opus) a tu Drive y compartilo con "Cualquier persona con el enlace".
2. Abrí ese link en un Android, un **iPhone** y una PC. Contame si se escucha en los tres.

## Paso 1 — Google Cloud (gratis)
Los nombres de los menús pueden variar un poco.
1. Entrá a https://console.cloud.google.com con bacigalupoms@gmail.com y creá un **proyecto** nuevo (ej: "QR Audio").
2. Menú **APIs y servicios → Biblioteca** → buscá **Google Drive API** → **Habilitar**.
3. **Pantalla de consentimiento de OAuth** (o "Google Auth Platform"): tipo **Externo**; nombre "QR Audio"; tu mail de contacto.
4. En **Permisos / Scopes** agregá solo `.../auth/drive.file`.
5. **Publicar la app → "En producción"**. NO la dejes en "Prueba" (la sesión caduca a los 7 días).
6. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web.**
7. En **Orígenes autorizados de JavaScript** poné `https://TU-USUARIO.github.io` (solo eso, sin `/qr-audio`).
8. Copiá el **ID de cliente** (termina en `.apps.googleusercontent.com`) y pegalo en `js/config.js`, en `CLIENT_ID`.

## Paso 2 — Publicar en GitHub Pages (gratis)
1. Creá cuenta en https://github.com y un repositorio **público** llamado `qr-audio`.
2. **Add file → Upload files**: subí TODO el contenido de esta carpeta (respetando las carpetas css, js, icons).
3. **Settings → Pages → Deploy from a branch → main / (root) → Save**.
4. En 1–2 minutos queda en `https://TU-USUARIO.github.io/qr-audio/`.

## Paso 3 — Instalar en el Android
1. Abrí esa dirección en **Chrome** → menú ⋮ → **Instalar app** / **Agregar a pantalla de inicio**.
2. Abrila, tocá un audio → **Guardar en Drive**. La primera vez Google te pide permiso: elegí tu cuenta y aceptá.

## Paso 4 — Probar WhatsApp
En un chat: mantené presionado un audio → **Compartir** → **QR Audio**. Si no aparece en la lista, avisame.
Alternativa: **Abrir audio** → en el selector elegir **Audio** o **Recientes**.

## Cuidados importantes (el QR apunta directo a Drive)
- **Nunca borres, reemplaces ni dejes de compartir** los audios de la carpeta. (Renombrar o mover sí es seguro.)
- Entrá a Gmail/Drive seguido: Google puede borrar el contenido de cuentas inactivas por 2 años.
- Activá la verificación en 2 pasos y guardá los códigos de recuperación.
- Cualquiera que tenga el link puede escuchar ese audio. No prometas más que "mantenimiento y respaldo mientras la cuenta esté activa".
- Probá siempre el QR ya sellado con resina, con 2 celulares, antes de entregar el llavero.
- Si cambiás archivos de la app, subí la versión nueva y cambiá `VERSION` en `sw.js` (ej. `qr-audio-v2`).
