# Gestor de tareas académicas

Proyecto final del curso Aseguramiento de la Calidad de Software.

## Funcionalidades previstas

- Registrar, consultar, modificar y eliminar tareas académicas.
- Marcar tareas como completadas.
- Filtrar tareas por estado.
- Guardar los datos en SQLite.

## Tecnologías previstas

React, Vite, Node.js, Express y SQLite.

El frontend usa React `19.3.1`, React DOM `19.3.1`, Vite `8.3.5` y
`@vitejs/plugin-react` `6.1.2`. Estas versiones son compatibles con Node
`22.15.1` y Node 24.

## Desarrollo local

Desde la raíz del proyecto, inicia el backend en una primera terminal:

```bash
cd backend
npm ci
npm start
```

En una segunda terminal, inicia el frontend:

```bash
cd frontend
npm ci
npm run dev
```

La interfaz queda en `http://localhost:5173`. Vite mantiene ese puerto de forma
estricta y redirige las solicitudes relativas `/api` al backend en
`http://localhost:3000`.

## Backend

Desde `backend/`, instala y arranca la API:

```bash
npm ci
npm start
```

La API queda disponible en `http://localhost:3000` y usa SQLite. Se puede indicar
otra base con la variable de entorno `DATABASE_PATH`.

Endpoints:

- `GET /api/health`: comprueba el estado del servicio.
- `POST /api/tareas`: crea una tarea.
- `GET /api/tareas`: lista tareas; acepta `?estado=pendiente` o
  `?estado=completada`.
- `PUT /api/tareas/:id`: reemplaza los datos editables de una tarea.
- `PATCH /api/tareas/:id/estado`: cambia únicamente su estado.
- `DELETE /api/tareas/:id`: elimina la tarea.

### Instalación en Hermes

Para `better-sqlite3@13.0.3`, la solución comprobada en Hermes es omitir los
scripts durante esta instalación del backend y verificar el acceso a SQLite con
una base en memoria:

```bash
cd backend
npm ci --ignore-scripts
node --input-type=module -e "import Database from 'better-sqlite3'; const db = new Database(':memory:'); console.log(db.prepare('SELECT 1 AS ok').get()); db.close();"
```

`--ignore-scripts` se aplica solamente a esta instalación del backend en
Hermes; no es una configuración global ni una instrucción general para instalar
el frontend.

## Pruebas

La suite unitaria comprueba directamente los contratos de validación. La suite
de integración ejercita las rutas, el repositorio y SQLite reales con una base
en memoria nueva por prueba; el caso de persistencia usa y limpia su propio
directorio temporal.

```bash
cd backend
npm run test:unit
npm run test:integration
npm test
```

Cada comando usa `vitest run`, sin modo watch. `npm test` ejecuta primero las
pruebas unitarias y después las de integración.

### Pruebas previstas

- E2E: Cypress.
- Carga: k6.
- Automatización: GitHub Actions.
