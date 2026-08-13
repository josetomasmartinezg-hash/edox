# Edox · Control de Maquinaria

App web/PWA para empresas de transporte y maquinaria. Incluye parte diario en terreno (QR + combustible + foto offline) y **panel admin** con roles.

## Acceso

- **Administrador:** `admin@soinver.cl` / `admin1234`
- **Principal:** `josetomasmartinezg@gmail.com` / `Edox2026!`

En la pantalla de login puedes tocar **Administrador** o **Principal** para cargar las credenciales.

## Perfiles

- Administrador
- Supervisor
- Operador
- Mecánico
- Operador surtidor

## Módulos admin

- **Maquinaria**: marca, modelo, año, sigla, capacidad estanque + generar QR
- **Usuarios**: crear/editar perfiles y accesos
- **Mantenimiento**: equipo (sigla), tipo del formulario papel, horómetro y checklist de lo realizado por el mecánico

## Terreno (offline)

- Escaneo QR de máquina
- Litros en estanque vs litros cargados + foto
- Guardado local y sync automático al recuperar señal

## Desarrollo

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

## Producción

```bash
npm run build
npm start
```

Abre `http://localhost:3001`

## Despliegue en Render

El proyecto incluye un [Blueprint](https://render.com/docs/blueprint-spec) en `render.yaml` para un **Web Service** Node que sirve API + frontend en un solo proceso.

### Opción A — Blueprint (recomendada)

1. Sube el repo a GitHub (rama `cursor/fuel-tracking-app-14f0` o la que uses en producción).
2. En [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**.
3. Conecta el repositorio `edox` y confirma el servicio `edox-maquinaria`.
4. Render creará automáticamente:
   - `EDOX_JWT_SECRET` (aleatorio)
   - Disco persistente de 10 GB en `/var/data` (datos JSON + uploads)

> **Importante:** no definas `NODE_ENV=production` como variable de entorno en Render antes del build. Eso hace que `npm install` omita devDependencies y falle `tsc` / `vite build`. El script `npm start` ya activa producción al arrancar.

### Opción B — Web Service manual

| Campo | Valor |
|-------|--------|
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check | `/api/health` |

Variables de entorno obligatorias:

| Variable | Valor |
|----------|--------|
| `EDOX_JWT_SECRET` | cadena larga aleatoria |
| `EDOX_DATA_DIR` | `/var/data` (con disco persistente montado ahí) |

No agregues `NODE_ENV` manualmente; `npm start` lo define al ejecutar el servidor.

### Si el deploy falla

- **Build:** revisa que el build instale devDependencies (`npm ci`, no `npm install --production`).
- **Start:** confirma que `EDOX_JWT_SECRET` exista en Environment.
- **Disco:** plan Starter o superior; monta el disco en `/var/data`.
- Tras el primer deploy, entra con **Principal** o **Administrador** (credenciales del seed en `server/seed.js`).
- Cambia las contraseñas demo en producción desde el módulo Usuarios.
- La app terreno funciona como PWA; ábrela desde la URL de Render en el celular y “Agregar a pantalla de inicio”.
