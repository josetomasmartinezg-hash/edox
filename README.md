# edox — plano a 3D

Visor web que convierte el plano arquitectónico vectorial (PDF) en un volumen 3D navegable.

## Flujo

1. **Extraer geometría** del PDF (líneas de muro, cristalería, escala por rejilla 1.5 m).
2. **Extruir** muros a 2.7 m de altura en Three.js.
3. **Proyectar** el plano en el suelo como referencia.

## Desarrollo

```bash
npm install
npm run dev
```

Re-extraer desde el PDF (requiere `pymupdf`):

```bash
npm run extract -- /ruta/al/plano.pdf
```

## Qué hay en el modelo

- Casa en dos alas (encuentro a 45°)
- Muros sólidos a partir de dobles líneas del plano
- Paneles de vidrio (líneas finas largas)
- Losa y cubierta opcional
- Textura del plano original alineada al modelo

## Próximos pasos posibles

- Forjado/cubierta con la huella real (no solo bbox)
- Mobiliario y tabiques interiores con más detalle
- Exportación glTF para Blender / Unreal
- Alturas por zona (doble altura, pérgolas)
