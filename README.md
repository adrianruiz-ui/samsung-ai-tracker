# Samsung MX · AI Visibility Tracker

Herramienta interna para medir cómo aparece Samsung vs sus competidores en respuestas de IA generativa (Claude, equivalente conceptual a lo que harías en ChatGPT o Perplexity) enfocada al mercado mexicano.

## Stack

- **Frontend** — HTML/JS plano servido desde GitHub Pages
- **Backend** — Cloudflare Worker como proxy seguro a la API de Anthropic
- **Modelo** — Claude Sonnet 4.6 con web search activo

## Pre-requisitos

1. Cuenta de GitHub
2. Cuenta de Cloudflare (gratuita — el plan free incluye 100k requests/día)
3. API key de Anthropic — sácala en https://console.anthropic.com/settings/keys

---

## Setup en ~15 minutos

### Paso 1 · Subir el repo a GitHub

1. Crea un repo nuevo en GitHub. Recomendación: **privado** si tienes plan pagado, para que el `APP_SECRET` no quede expuesto. Si es público, ver nota de seguridad al final.
2. Sube los tres archivos: `index.html`, `worker.js`, `README.md`.
3. Activa GitHub Pages:
   - Settings → Pages
   - Source: **Deploy from a branch**
   - Branch: `main` / Folder: `/ (root)` → Save
4. Espera 1-2 minutos. Tu URL pública será algo como `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`

### Paso 2 · Crear el Cloudflare Worker

1. Entra a https://dash.cloudflare.com → **Workers & Pages**
2. Click **Create** → **Hello World** template → nómbralo `samsung-ai-tracker` → **Deploy**
3. Una vez desplegado, click **Edit Code** (esquina superior derecha)
4. Borra todo el contenido del editor y pega el contenido completo de `worker.js`
5. Click **Save and Deploy**
6. **Copia la URL del Worker** que aparece arriba (algo como `https://samsung-ai-tracker.tu-cuenta.workers.dev`)

### Paso 3 · Configurar las variables del Worker

En la pantalla del Worker → **Settings** → **Variables and Secrets** → **Add**:

| Variable | Tipo | Valor |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Secret** | Tu API key (empieza con `sk-ant-…`) |
| `APP_SECRET` | **Secret** | Un string random largo. Genera uno con `openssl rand -hex 32` en terminal, o usa https://www.uuidgenerator.net/ y junta dos UUIDs |
| `ALLOWED_ORIGINS` | **Text** | La URL de tu GitHub Pages **sin slash final**. Ej: `https://tu-usuario.github.io` |

Después de agregar las tres, click **Deploy** otra vez para que tomen efecto.

> Si tu URL de Pages es `https://tu-usuario.github.io/nombre-repo/`, el origin sigue siendo `https://tu-usuario.github.io` (sin el path).

### Paso 4 · Conectar el HTML con el Worker

Edita `index.html` y busca el bloque `CONFIG` (está cerca de la línea ~280, marcado con `⚙️`):

```javascript
const CONFIG = {
  WORKER_URL: 'https://samsung-ai-tracker.TU-SUBDOMINIO.workers.dev',
  APP_SECRET: 'CAMBIA-ESTE-VALOR-POR-UN-STRING-LARGO-Y-RANDOM',
  MODEL: 'claude-sonnet-4-6',
  MAX_TOKENS: 1500,
};
```

Reemplaza:
- `WORKER_URL` — la URL exacta del Worker que copiaste en el Paso 2
- `APP_SECRET` — exactamente el mismo string que pusiste en `APP_SECRET` del Worker

Commit y push. GitHub Pages redespliega solo en ~1 min.

### Paso 5 · Probar

1. Abre tu URL de GitHub Pages
2. La franja amarilla de "Configuración incompleta" debe haber desaparecido
3. Click en una categoría → click en un prompt → **Ejecutar consulta**
4. Si todo está bien, en ~10-20 segundos verás la respuesta con menciones de marca resaltadas

---

## Uso de la herramienta

- **Categorías** — están pre-cargadas para el mercado mexicano (Smartphones, Plegables, IA, Cámara, Audífonos, Wearables, Tablets, Comparativas)
- **Prompts custom** — también puedes escribir los tuyos en el textarea
- **Cmd/Ctrl + Enter** — atajo para ejecutar
- **Posición Samsung** — orden de aparición de Samsung en la respuesta vs otras marcas (#1 = primero en mencionarse)
- **SoV agregado** — share of voice acumulado entre todos los runs guardados
- **Exportar CSV** — descarga todo el historial para análisis en Sheets/Excel/Looker
- **Persistencia** — todo se guarda en localStorage del navegador (no se sincroniza entre dispositivos)

## Personalizar

- **Agregar/quitar prompts** — edita el objeto `PROMPT_CATALOG` en `index.html`
- **Agregar/quitar marcas competidoras** — edita el array `BRANDS` en `index.html`. Cada marca tiene `name`, `color` (hex) y `patterns` (array de regex)
- **Cambiar modelo** — edita `CONFIG.MODEL`. Opciones: `claude-sonnet-4-6` (balance), `claude-haiku-4-5-20251001` (más barato), `claude-opus-4-7` (mejor calidad, más caro)
- **Cambiar idioma/mercado** — edita el `systemPrompt` dentro de `queryAI()` para apuntar a otro país o idioma

## Costos estimados

- **GitHub Pages** — Gratis
- **Cloudflare Workers** — Gratis hasta 100k requests/día
- **Anthropic API** (Sonnet 4.6 + web search):
  - ~$0.01-0.03 USD por run
  - 100 runs ≈ $1-3 USD
  - Para testing pesado usa Haiku (~5x más barato)

## Seguridad

El `APP_SECRET` + `ALLOWED_ORIGINS` te protegen contra dos vectores:

1. **CORS (origen)** — el navegador no deja que se llame al Worker desde otra URL que no sea la de tu GitHub Pages
2. **Shared secret** — defensa contra requests fuera del navegador (curl, scripts)

**Si tu repo es público**, el `APP_SECRET` queda visible en el código fuente. En ese caso la única protección real es el `ALLOWED_ORIGINS`, lo cual aún previene abuso casual pero no contra alguien que se tome la molestia de spoofear headers.

**Recomendaciones según escenario:**

- **Uso interno del equipo, repo privado** — basta con esta configuración
- **Repo público o equipo grande** — considera agregar [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/) al Worker (gratis hasta 50 usuarios). Te permite autenticación con email/Google sin exponer secrets
- **Si sospechas abuso** — rota el `APP_SECRET` (genera uno nuevo, actualízalo en ambos lados)

## Troubleshooting

| Síntoma | Causa probable |
|---|---|
| `401: Unauthorized` | `APP_SECRET` no coincide entre HTML y Worker |
| `403: Origin not allowed` | `ALLOWED_ORIGINS` en el Worker no incluye tu URL de Pages (revisa que no tenga slash final) |
| `500: Worker not configured` | Falta `ANTHROPIC_API_KEY` o `APP_SECRET` en las variables del Worker |
| `502: Upstream error` | Problema con la API de Anthropic — revisa que tu API key esté activa y con créditos |
| Banner amarillo no desaparece | `WORKER_URL` aún contiene `TU-SUBDOMINIO` o `APP_SECRET` aún contiene `CAMBIA-ESTE` |
| No detecta menciones que sí están | Agrega el patrón en `BRANDS` (regex en `index.html`) |

## Próximos pasos sugeridos

- **Análisis de sentimiento** — segunda llamada a Claude pidiéndole que clasifique el contexto de cada mención (positivo / neutral / negativo)
- **Detección de citations** — los bloques `web_search_tool_result` traen las URLs que el modelo consultó; podemos guardarlas y rankear los dominios que más cita
- **Multi-modelo** — agregar OpenAI y Google a la mezcla para comparar visibility entre plataformas
- **Sync entre dispositivos** — mover de localStorage a una D1 database en Cloudflare (también gratis en plan free)

---

Construido por Adrian. Última actualización: mayo 2026.
