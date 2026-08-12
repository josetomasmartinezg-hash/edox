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
