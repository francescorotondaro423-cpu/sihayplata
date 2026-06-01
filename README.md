# FinRank AR

Comparador de rendimientos financieros en Argentina. Consolida tasas de FCI money market, cuentas remuneradas, plazos fijos y dólares de las principales apps y bancos digitales, rankeadas en tiempo real contra la tasa BADLAR del BCRA.

Incluye además beneficios en supermercados, descuentos en transporte y precios de combustibles.

---

## Caracteristicas

- **Tasas ARS** — FCI money market, cuentas remuneradas y plazos fijos rankeados por spread sobre BADLAR
- **Tasas USD** — rendimientos en dolares de billeteras y brokers locales
- **Scraper automatico** — Puppeteer raspa TNA de las apps cada 24hs (3 AM ARG); notificacion por email si alguna falla
- **BADLAR en tiempo real** — consumida directamente de la API publica del BCRA (v4.0)
- **Historial de rendimientos** — grafico de TNA calculada sobre BADLAR historico por app
- **Promociones de supermercados** — descuentos por billetera, banco o tarjeta
- **Beneficios de transporte** — SUBE y transporte publico por app, con reporte crowdsourced
- **Precios de combustibles** — actualizacion periodica
- **Tracking de afiliados** — redirect con UTM y codigo de afiliado por app
- **Sistema de anuncios** — impresiones y CTR por banner

---

## Stack

| Capa | Tecnologia |
|---|---|
| Backend | Node.js 18+ / Express |
| Scraping | Puppeteer + node-cron |
| Notificaciones | Nodemailer (Gmail App Password) |
| Fuente BADLAR | API BCRA v4.0 |
| Persistencia | JSON files (sin base de datos) |
| Deploy | Render (free tier) |

---

## Estructura

```
.
├── server.js                  # Entry point, Express + cron jobs
├── scraper/
│   ├── index.js               # Orquestador Puppeteer (8+ apps)
│   ├── sources.js             # Definicion de fuentes por app
│   ├── pipeline.js            # Pipeline de validacion y normalizacion
│   ├── validate.js            # Reglas de validacion de TNA
│   └── notify.js              # Email de alerta ante fallas
├── controllers/
│   ├── promotions/            # CRUD de promociones de supermercados
│   ├── mobility/              # Beneficios de transporte
│   └── fuel/                  # Precios de combustibles
├── services/
│   ├── promotions/
│   ├── mobility/
│   ├── fuel/
│   ├── scraping/
│   ├── supermarkets/
│   └── wallets/
├── jobs/
│   └── promotionSyncJob.js    # Sync periodico de promociones
├── data/
│   ├── ars_rates.json         # Spreads ARS (scraper o POST /api/ars)
│   ├── usd_rates.json         # Tasas USD (actualizacion manual)
│   ├── promotions.json        # Promociones vigentes
│   ├── mobility.json          # Beneficios de transporte
│   ├── fuel.json              # Precios de combustibles
│   └── history.json           # Historial BADLAR
└── public/
    └── index.html             # SPA frontend
```

---

## API

Todos los endpoints viven bajo `/api/`. Los endpoints de escritura requieren el header `x-api-key`.

### Tasas

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/rates` | Tasas ARS + USD con BADLAR actual (cache 1h) |
| GET | `/api/rates/history` | Historial BADLAR para graficos |
| POST | `/api/ars` | Actualizar spread de una app ARS |
| POST | `/api/usd` | Actualizar tasa USD manual |

El POST `/api/ars` acepta `tna` (calcula spread vs BADLAR actual) o `spread` directo.

### Scraper

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/scraper/run` | Disparar scraper manualmente (responde inmediato, corre en background) |
| GET | `/api/scraper/status` | Ultimo run y estado por app |

### Historial de rendimientos

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/rendimientos/historial/:appId` | Snapshots historicos por app |
| GET | `/api/rendimientos/historico/:appId` | TNA calculada sobre BADLAR real del BCRA |
| POST | `/api/rendimientos/snapshot` | Guardar snapshot manual (admin) |

### Otros modulos

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/promotions` | Promociones de supermercados |
| GET | `/api/transporte` | Beneficios de transporte por app |
| POST | `/api/transporte/:id/reportar` | Reportar cambio (crowdsourcing) |
| GET | `/api/mobility` | Datos de movilidad |
| GET | `/api/fuel` | Precios de combustibles |
| GET | `/api/news` | Proxy RSS economia (evita CORS) |
| GET | `/go/:route` | Redirect de afiliado con UTM |

### Sistema

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/health` | Estado del servidor |
| GET | `/api/ads` | Anuncios activos |
| GET | `/api/ads/metrics` | CTR e impresiones |

---

## Variables de entorno

```env
PORT=8080
ADMIN_KEY=tu_api_key_secreta

# Notificaciones por email (Gmail)
EMAIL_USER=tu@gmail.com
EMAIL_PASS=xxxx_xxxx_xxxx_xxxx   # App Password de Gmail (2FA activado)
EMAIL_NOTIFY=destino@gmail.com
```

El `EMAIL_PASS` debe ser un App Password de Gmail (no la contrasena normal). Requiere 2FA activado en la cuenta.

---

## Instalacion local

```bash
git clone https://github.com/tu-usuario/finrank-ar
cd finrank-ar
npm install
cp .env.example .env   # completar las variables
npm run dev
```

El servidor levanta en `http://localhost:8080`.

El scraper corre automaticamente a las 3 AM (hora Argentina). Para dispararlo manualmente:

```bash
curl -X POST http://localhost:8080/api/scraper/run \
  -H "x-api-key: tu_api_key_secreta"
```

---

## Deploy en Render

El archivo `render.yaml` define el servicio. Solo hace falta conectar el repo y configurar las variables de entorno `EMAIL_USER`, `EMAIL_PASS` y `EMAIL_NOTIFY` desde el dashboard de Render (las demas se generan automaticamente).

---

## Logica de tasas ARS

Las tasas ARS no tienen API publica, por eso se usan dos mecanismos:

1. **Scraper automatico (Puppeteer)** — raspa la TNA directamente de cada app. Corre diariamente a las 3 AM ARG. Si una app falla, se mantiene el ultimo valor conocido y se envia email de alerta.

2. **Actualizacion manual** — via `POST /api/ars` con `x-api-key`. Permite ingresar `tna` (se calcula el spread automaticamente contra BADLAR actual) o `spread` directo.

La tasa BADLAR se obtiene en tiempo real de la API del BCRA. El spread almacenado en `data/ars_rates.json` se suma a cada llamada a `/api/rates`.

---

## Licencia

MIT
