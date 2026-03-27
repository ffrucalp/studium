# Studium - Guía de Deploy en Cloudflare

## Prerequisitos

1. Cuenta en Cloudflare (gratis): https://dash.cloudflare.com/sign-up
2. Node.js instalado (ya lo tenés)
3. Tu API key de OpenRouter

## Paso 1: Instalar Wrangler (CLI de Cloudflare)

```bash
npm install -g wrangler
```

## Paso 2: Loguearte en Cloudflare

```bash
wrangler login
```
Se abre el navegador, autorizás y listo.

## Paso 3: Deployar el Worker (API backend)

```bash
cd studium/worker

# Configurar tu API key de OpenRouter como secret
wrangler secret put OPENROUTER_API_KEY
# Te pide el valor → pegás tu key de OpenRouter

# Deployar el Worker
wrangler deploy
```

Esto te va a dar una URL tipo:
`https://studium-api.TU-USUARIO.workers.dev`

**Copiá esa URL, la necesitás para el paso siguiente.**

## Paso 4: Configurar y buildear el frontend

```bash
cd studium  # (volvé a la raíz del proyecto)

# Crear archivo .env con la URL del Worker
echo "VITE_API_URL=https://studium-api.TU-USUARIO.workers.dev" > .env

# Buildear
npm run build
```

## Paso 5: Deployar el frontend en Cloudflare Pages

```bash
npx wrangler pages deploy dist --project-name=studium
```

La primera vez te pregunta el nombre del proyecto. Después te da la URL:
`https://studium.pages.dev`

## Paso 6 (opcional): Restringir CORS al dominio del frontend

Editá `worker/wrangler.toml` y descomentá:
```toml
ALLOWED_ORIGIN = "https://studium.pages.dev"
```

Y re-deployá el Worker:
```bash
cd worker && wrangler deploy
```

## Resumen de comandos (copia y pega)

```bash
# 1. Login
wrangler login

# 2. Worker
cd worker
wrangler secret put OPENROUTER_API_KEY
wrangler deploy
cd ..

# 3. Frontend (reemplazá la URL!)
echo "VITE_API_URL=https://studium-api.TU-USUARIO.workers.dev" > .env
npm run build
npx wrangler pages deploy dist --project-name=studium
```

## Dominio personalizado (opcional)

En el dashboard de Cloudflare Pages podés agregar un dominio personalizado,
por ejemplo: `studium.gobernanzadedatos.com` o similar.

## Actualizar después de cambios

```bash
# Si cambiaste el Worker:
cd worker && wrangler deploy && cd ..

# Si cambiaste el frontend:
npm run build && npx wrangler pages deploy dist --project-name=studium
```
