# Studium - Setup del Repositorio GitHub

## 1. Crear el repo en GitHub

Andá a https://github.com/new y creá un repo:
- **Name**: `studium`  
- **Private** (recomendado por ahora)
- **NO** inicialices con README (ya tenemos uno)

## 2. Subir el proyecto

Desde la carpeta `studium/`:

```bash
git init
git add .
git commit -m "feat: Studium v1 - Tutor IA UCALP"
git branch -M main
git remote add origin https://github.com/ffrucalp/studium.git
git push -u origin main
```

## 3. Proteger secrets

El `.gitignore` ya excluye `.env` y `node_modules`.
NUNCA subas tu `.env` con API keys.

## 4. Deploy automático (opcional)

Podés conectar el repo a Cloudflare Pages desde el dashboard:
1. Dashboard → Pages → tu proyecto → Settings → Builds & deployments
2. Connect to Git → seleccionás el repo
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment variables: `VITE_API_URL = https://studium-api.francisco-fernandezr.workers.dev`

Así cada push a `main` deploya automáticamente.
