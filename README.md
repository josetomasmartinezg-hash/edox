# Stackd

Landing + checkout para Business Managers verificados, conectada a un bot de Telegram.

## Desarrollo

```bash
cp .env.example .env
# completá TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_BOT_USERNAME
npm install
npm run dev
```

- Front: Vite (`http://localhost:5173`)
- API Telegram: Express (`http://localhost:8787`)
- El front proxea `/api` al servidor

## Producción

```bash
npm run build
npm start
```

Sirve el `dist/` y las rutas `/api/*` en el mismo puerto (`PORT`, default 8787).

### Dominio `www.stackdbm.com` (Namecheap + Render)

1. Entrá a [Render](https://render.com) → **New** → **Blueprint** (usa `render.yaml`) o **Web Service** desde este repo.
2. Build: `npm install && npm run build` · Start: `npm start`
3. Cargá las env vars (token Telegram, chat id, wallets, PayPal, `ADMIN_PASSWORD`).
4. Con disco: `DATA_DIR=/var/data` (ya viene en `render.yaml`).
5. En Render → **Settings → Custom Domains** → agregá `www.stackdbm.com`.
6. En Namecheap → **Domain List** → `stackdbm.com` → **Advanced DNS**:

| Type | Host | Value |
|------|------|--------|
| CNAME Record | `www` | `TU-SERVICIO.onrender.com` (el que te da Render) |
| URL Redirect Record | `@` | `https://www.stackdbm.com/` (Unmasked) |

7. Esperá la propagación DNS (puede tardar desde minutos hasta unas horas) y activá HTTPS en Render.
8. Sitio: `https://www.stackdbm.com` · Admin: `https://www.stackdbm.com/admin`

## Bot de Telegram

1. Creá el bot con [@BotFather](https://t.me/BotFather) y copiá el token.
2. Agregá el bot al grupo de confirmaciones (ej. `Stackd_bot`) y dale admin si hace falta.
3. Poné en `.env`:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID` (id del grupo, suele ser negativo)
   - `TELEGRAM_BOT_USERNAME` / `VITE_TELEGRAM_BOT_USERNAME`
4. (Opcional, en un dominio HTTPS) configurá el webhook:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://TU_DOMINIO/api/telegram/webhook"
```

### Flujo

1. Cliente completa compra → la web notifica al chat admin vía Bot API.
2. Se abre `t.me/<bot>?start=order_<ID>` para conectar al cliente con el bot.
3. Comentarios en la web → notificación al admin + apertura del bot con `?start=comment`.
4. Si el webhook está activo, el bot responde al `/start` y reenvía mensajes al admin.

## Pagos

Editá wallets / PayPal en `src/config.ts` o variables `VITE_USDT_*` / `VITE_PAYPAL_*`.

## Panel admin

1. Arrancá `npm run dev` o `npm start`
2. Abrí `/admin`
3. Entrá con `ADMIN_PASSWORD` (default: `stackd-admin`)
4. Editá precio, precio anterior y stock → Guardar

Los cambios se guardan en `data/products.json` y se ven al toque en la tienda.
