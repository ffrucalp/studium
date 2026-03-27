# Google Cloud - Configuración para Studium

## 1. Crear proyecto en Google Cloud Console

1. Ir a https://console.cloud.google.com/
2. Crear nuevo proyecto: "Studium UCALP"

## 2. Habilitar APIs

En "APIs & Services" → "Enable APIs":
- Google Calendar API
- Gmail API  
- Google Drive API

## 3. Configurar pantalla de consentimiento OAuth

En "APIs & Services" → "OAuth consent screen":
- User Type: **External** (después podés pasar a Internal si tenés Workspace)
- App name: "Studium"
- User support email: tu email
- Authorized domains: `studium-6hw.pages.dev` y `pages.dev`
- Scopes: agregar:
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/gmail.send`
  - `https://www.googleapis.com/auth/drive.file`
  - `email`
  - `profile`

## 4. Crear credenciales OAuth 2.0

En "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID":
- Application type: **Web application**
- Name: "Studium Web"
- Authorized JavaScript origins:
  - `https://studium-6hw.pages.dev`
  - `http://localhost:5173` (para dev)
- Authorized redirect URIs:
  - `https://studium-6hw.pages.dev/auth/callback`
  - `http://localhost:5173/auth/callback`

## 5. Copiar credenciales

Te va a dar:
- **Client ID**: algo como `123456789-abc.apps.googleusercontent.com`
- **Client Secret**: algo como `GOCSPX-xxxxx`

El Client ID va en el `.env` del frontend:
```
VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

El Client Secret va como secret en el Worker:
```bash
cd worker
wrangler secret put GOOGLE_CLIENT_SECRET
```

## 6. Restricción de dominio (importante)

Para restringir solo a @ucalpvirtual.edu.ar:
- En la pantalla de OAuth consent, si tenés Google Workspace, usá "Internal"
- Si no, la restricción se hace en el código (ya implementado)
