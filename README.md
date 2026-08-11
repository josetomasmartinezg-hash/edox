# Edox · Control de Maquinaria

App móvil/web para empresas de transporte y maquinaria. Digitaliza el formulario papel **MAQUINARIA**: escaneo QR de la máquina, litros en estanque vs litros cargados, foto de respaldo, y sincronización automática cuando vuelve la señal.

## Características

- Escaneo de código QR de la máquina (o ingreso manual)
- Formulario completo: chequeo diario, horómetro, viajes, mantenimiento, observaciones y firmas
- Combustible: **litros en estanque** + **litros cargados** + Nº guía
- Foto de respaldo (boleta / medidor)
- Modo offline con IndexedDB; subida automática al recuperar conexión
- PWA instalable en el celular

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

La API sirve también el frontend desde `dist/` en el puerto `PORT` (por defecto `3001`).

## Flujo de uso

1. Abrir **Nuevo registro**
2. Escanear QR de la máquina
3. Completar litros en estanque / litros cargados y tomar foto
4. Guardar — queda local si no hay señal
5. Al volver la conexión, se sincroniza solo (o con **Sincronizar ahora**)
