# Studium · UCALP

**Tutor IA para la Licenciatura en Gobernanza de Datos**

Plataforma que conecta a los alumnos con su Campus Virtual (Moodle) y les ofrece herramientas de estudio potenciadas por IA: resúmenes automáticos, cuestionarios de práctica, planificación semanal, chat con tutor, y sincronización con Google Calendar y Gmail.

## Stack

- **Frontend**: React + Vite
- **Estilos**: CSS-in-JS con paleta institucional UCALP
- **Tipografía**: Crimson Pro (headings) + Source Sans 3 (body)
- **IA**: Anthropic Claude API (via Cloudflare Worker proxy)
- **Deploy**: Cloudflare Pages
- **APIs**: Moodle Web Services, Google Calendar, Gmail

## Setup Local

```bash
# 1. Instalar
npm install

# 2. Configurar
cp .env.example .env
# Editar .env con tu VITE_ANTHROPIC_KEY (solo para dev local)

# 3. Iniciar
npm run dev
```

## Deploy en Cloudflare Pages

```bash
# 1. Build
npm run build

# 2. Deploy frontend
npx wrangler pages deploy dist --project-name=studium

# 3. Deploy Worker (AI proxy)
cd worker
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
```

## Estructura

```
src/
├── components/     → Sidebar, UI (Btn, RenderMarkdown), Icons
├── context/        → AppContext (estado global)
├── pages/          → Login, MoodleConnect, Dashboard, CourseDetail, Chat, Planner, Quiz, Settings
├── services/       → ai.js, moodle.js, google.js
├── styles/         → theme.js (paleta UCALP), global.css
├── config.js       → Configuración centralizada
├── App.jsx         → Router principal
└── main.jsx        → Entry point
worker/
├── index.js        → Cloudflare Worker (AI proxy)
└── wrangler.toml   → Config del Worker
```

## Próximos Pasos

1. **Moodle real**: los endpoints están preparados en `services/moodle.js`, falta un Worker CORS proxy
2. **Google OAuth**: restringir a `@ucalpvirtual.edu.ar`, conectar Calendar + Gmail APIs
3. **Procesamiento de materiales**: descargar PDFs de Moodle, extraer texto, generar resúmenes contextualizados

---
Uso interno · UCALP · Dirección de la Lic. en Gobernanza de Datos
