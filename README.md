# ADVAULT

Landing page para venta de Business Managers verificados de Facebook con API de WhatsApp.

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Configurar pagos

Editá `src/config.ts` con tus datos reales:

- Telegram de soporte
- Wallets USDT TRC20 / BEP20
- PayPal.me y email de cobro

Flujo: carrito → datos del cliente → USDT o PayPal → confirmar por Telegram.

Stack: Vite + React + TypeScript.
