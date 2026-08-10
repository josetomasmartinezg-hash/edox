# ADVAULT

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

Sirve el `dist/` y las rutas `/api/telegram/*` en el mismo puerto (`PORT`, default 8787).

## Bot de Telegram

1. Creá el bot con [@BotFather](https://t.me/BotFather) y copiá el token.
2. Obtené tu `CHAT_ID` (escribile al bot y mirá `getUpdates`, o usá un grupo).
3. Poné en `.env`:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
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

Editá wallets / PayPal en `src/config.ts`.
