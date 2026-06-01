# SABOREO

Plataforma de análisis sensorial infantil basada en inteligencia artificial. Combina reconocimiento de voz y análisis de expresiones faciales para medir la aceptación de alimentos en niños, sin requerir que el niño explique verbalmente su preferencia.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React + TanStack Start/Router, Tailwind CSS v4, shadcn/ui |
| Backend | Node.js + Express + TypeScript |
| Base de datos | PostgreSQL 16 |
| IA | Anthropic Claude (análisis de resultados y chat asistente) |
| Infraestructura | Docker + Docker Compose |

---

## Funcionalidades principales

- **Encuestas sensoriales** — Creación y gestión de paneles con escala hedónica facial, múltiples muestras y atributos configurables
- **Grabación de video** — Captura de reacciones del niño al probar cada muestra (opcional por encuesta)
- **Análisis IA multimodal** — Fusión de señales de voz, expresión facial e índice SABOREO (0–100)
- **Dashboard de resultados** — Gráficos por muestra, distribución de escala, demografía, exportación a CSV/JSON
- **SaBot** — Chat asistente powered by Claude para interpretar resultados en lenguaje natural
- **Consentimientos informados** — Formularios digitales configurables por investigación
- **Autenticación JWT** — Registro e inicio de sesión para investigadores

---

## Requisitos previos

- [Docker](https://docs.docker.com/get-docker/) y Docker Compose v2+
- Una API key de [Anthropic](https://console.anthropic.com) (para las funciones de IA)

---

## Instalación y uso

```bash
# 1. Clonar el repositorio
git clone https://github.com/cghidalgos/saboreo.git
cd saboreo

# 2. Crear el archivo de variables de entorno
cp .env.example .env

# 3. Editar .env con tus valores reales
#    (mínimo: ANTHROPIC_API_KEY y cambiar contraseñas en producción)
nano .env

# 4. Levantar todos los servicios
docker compose up -d --build

# 5. Verificar que todo esté corriendo
docker compose ps
```

La aplicación estará disponible en:
- **Frontend:** http://localhost:9020
- **Backend API:** http://localhost:9021

---

## Variables de entorno

Copia `.env.example` como `.env` y completa los valores. Las variables más importantes:

| Variable | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | API key de Anthropic para funciones de IA |
| `JWT_SECRET` | Secreto para firmar tokens JWT — genera con `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | Contraseña de la base de datos |
| `FRONTEND_URL` | URL pública del frontend (para CORS) |
| `VITE_API_URL` | URL pública del backend |

---

## Estructura del proyecto

```
saboreo/
├── backend/          # API REST — Express + TypeScript
│   └── src/
│       ├── routes/   # Endpoints: auth, encuestas, resultados, sesiones…
│       ├── lib/      # JWT, Claude API
│       └── db.ts     # Conexión PostgreSQL
├── frontend/         # SPA — React + TanStack Start
│   └── src/
│       ├── routes/   # Páginas: landing, dashboard, editor de encuestas, resultados…
│       └── components/saboreo/  # Componentes propios
├── database/         # SQL: init + migraciones
├── .env.example      # Plantilla de variables de entorno
└── docker-compose.yml
```

---

## Despliegue en producción

Para un servidor con dominio propio, actualiza en `.env`:

```env
FRONTEND_URL=https://tudominio.com
VITE_API_URL=https://api.tudominio.com
JWT_SECRET=<cadena aleatoria larga>
POSTGRES_PASSWORD=<contraseña segura>
```

Se recomienda poner un reverse proxy (nginx o Caddy) delante para servir HTTPS en el puerto 443.

---

## Licencia

Proyecto desarrollado para investigación en la Universidad de San Buenaventura Cali.  
Contacto: Diana Paola Navia Porras — dpnavia@usbcali.edu.co
