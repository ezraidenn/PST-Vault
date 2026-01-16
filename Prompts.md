prompt 0

Quiero construir una web app local (localhost) llamada "PST Vault" (nombre temporal) que permite subir archivos Outlook .pst y leerlos SIN usar Outlook. Debe ser mobile-first, responsive para desktop, estilo iOS (clean, premium), con colores llamativos fáciles de entender y animaciones fluidas.

FUNCIONALIDADES:

1. Subir un archivo .pst desde la UI (drag & drop + botón).
2. El backend lo parsea, indexa e inserta todo en SQLite local.
3. Mostrar carpetas (Inbox, Sent, etc) y listado de correos.
4. Buscador "OP" estilo Gmail (from:, to:, subject:, has:attachment, filename:, folder:, before:, after:, texto libre, y frases con comillas).
5. Ver el correo completo (subject, from, to, cc, fecha, body text o html) y adjuntos.
6. Selección persistente de correos: puedo marcar correos desde el listado y desde el detalle. Si entro a un correo y regreso, los marcados se mantienen. Debe existir botón "Clear selection".
7. Descargar un correo individual (formato .eml o .json) y descargar múltiples seleccionados en un ZIP con estructura ordenada.
8. Optimización: búsqueda instantánea con SQLite FTS5, paginación, debounce, lista virtualizada si hay miles.
9. UI iOS vibe: tarjetas redondeadas, sombras suaves, bottom bar para selección, transitions smooth.

STACK OBLIGATORIO:
Backend: Python + FastAPI + Uvicorn + SQLite + FTS5.
Parser PST: pypff (libpff).
Frontend: Next.js (App Router) + TailwindCSS + Framer Motion + TanStack Query + Zustand (persistencia localStorage).
Sin Docker, sin cloud, sin servicios externos.

ENTREGABLE:
Genera el proyecto completo con estructura de carpetas, código listo, comandos para correr backend y frontend, y un README con pasos de instalación.

Crea 2 carpetas: /backend y /frontend.
Todo debe correr en Windows/Mac/Linux (idealmente con soporte para WSL si pypff complica en Windows).

Empieza generando la estructura completa y el código base funcional (upload + hello endpoints + layout base en frontend).


prompt 1

Crea el backend completo en /backend usando FastAPI.

REQUISITOS:

* Python 3.11+
* FastAPI + Uvicorn
* SQLite como archivo local en /backend/data/app.db
* Migración simple: al iniciar, crear tablas si no existen.
* Debe existir un archivo .env con:

  * DATABASE_PATH=./data/app.db
  * STORAGE_DIR=./storage
  * MAX_UPLOAD_MB=500 (default)
  * CORS_ORIGINS=[http://localhost:3000](http://localhost:3000)

TABLAS SQL:

1. folders:

* id INTEGER PK
* pst_id TEXT
* name TEXT
* parent_id INTEGER NULL
* path_display TEXT
* UNIQUE(pst_id, path_display)

2. messages:

* id INTEGER PK
* pst_id TEXT
* folder_id INTEGER FK
* subject TEXT
* sender_name TEXT
* sender_email TEXT
* to_emails TEXT
* cc_emails TEXT
* bcc_emails TEXT
* date_utc TEXT (ISO8601)
* snippet TEXT
* body_text TEXT
* body_html TEXT
* has_attachments INTEGER DEFAULT 0

3. attachments:

* id INTEGER PK
* message_id INTEGER FK
* filename TEXT
* mime_type TEXT
* size_bytes INTEGER
* stored_path TEXT

FTS5:

* message_fts(subject, sender_name, sender_email, to_emails, cc_emails, body_text)
* triggers para mantener sincronizado.

ARQUITECTURA:

* app/main.py
* app/core/config.py
* app/core/db.py
* app/models/ (pydantic schemas)
* app/routes/ (upload, folders, messages, search, export)
* app/services/ (pst_parser, indexing, export_zip)
* app/utils/ (helpers)

GENERA:

* requirements.txt
* README con run instructions
* Código para inicializar DB y FTS5 en startup
* Health endpoint /health

No implementes aún el parsing pst, solo prepara toda la base sólida.



prompt 2
Implementa el endpoint POST /pst/upload en FastAPI.

REQUISITOS:

* Acepta multipart/form-data con file (solo .pst)
* Valida tamaño vs MAX_UPLOAD_MB
* Guarda el archivo en STORAGE_DIR/pst/{pst_id}.pst
* pst_id debe ser un hash SHA256 del contenido del archivo (para deduplicación)
* Si el PST ya existe, NO lo vuelvas a guardar, solo responde con pst_id y counts si ya está indexado
* Regresa JSON:
  {
  "pst_id": "...",
  "stored": true/false,
  "already_indexed": true/false,
  "message_count": number,
  "folder_count": number
  }

Además:

* endpoint GET /pst/{pst_id}/status para saber si ya está indexado y conteos.

TODAVÍA no parsees el PST, solo guarda y responde con status.


prompt 3

Ahora implementa el servicio real de indexación PST usando pypff.

OBJETIVO:
Cuando se sube un PST nuevo, el backend debe parsearlo e insertarlo en SQLite (folders + messages + attachments metadata) con mucha optimización.

REQUISITOS:

* Implementa app/services/pst_parser.py
* Recorre folders recursivo y guarda:

  * folders.name
  * folders.parent_id
  * folders.path_display (ej: "Inbox/2024/Work")
* Para cada mensaje guarda:

  * subject
  * sender_name
  * sender_email
  * to_emails (texto unido)
  * cc_emails, bcc_emails
  * date_utc en ISO8601
  * snippet (primera parte del body)
  * body_text (si existe)
  * body_html (si existe)
  * has_attachments (0/1)
* Para attachments solo guardar metadata:

  * filename
  * size_bytes si disponible
  * mime_type si puedes inferir por extensión
  * stored_path = NULL (por ahora)

OPTIMIZACIÓN:

* Inserta en batches de 200 mensajes por transacción.
* Usa índices en columnas clave (pst_id, folder_id, date_utc).
* Asegúrate que FTS5 se alimente con triggers o bulk insert.
* Si falla un mensaje corrupto, sigue con el resto (try/except por mensaje).
* Implementa logging claro.

FLUJO:

* Al terminar, marca pst_id como "indexed" en una tabla pst_imports:

  * pst_id TEXT PK
  * created_at TEXT
  * indexed_at TEXT
  * folder_count INTEGER
  * message_count INTEGER

ACTUALIZA:

* POST /pst/upload debe iniciar la indexación inmediatamente después de guardar (síncrono por ahora).
* GET /pst/{pst_id}/status debe devolver progreso final (indexed true/false).

Entrega código completo funcional.


prompt 4

Implementa el buscador avanzado estilo Gmail sobre SQLite + FTS5.

ENDPOINT:
GET /search

PARAMS:

* pst_id (obligatorio)
* q (string de búsqueda)
* folder (opcional, folder_id o path_display)
* page (default 1)
* page_size (default 50)
* sort ("date_desc" o "relevance")

QUERY SYNTAX:
Debe soportar:

* texto libre: paypal recibo
* frases: "estado de cuenta"
* from:xxx (match sender_email y sender_name)
* to:xxx (match to_emails)
* subject:xxx
* folder:Inbox o folder:"Inbox/2024"
* has:attachment
* filename:pdf (match attachments.filename)
* after:YYYY-MM-DD
* before:YYYY-MM-DD

COMPORTAMIENTO:

* Si hay tokens de texto libre o frases, usa FTS5 para ranking.
* Si solo hay filtros (from:, after:, etc) usa SQL normal.
* Debe devolver resultados con:

  * id, folder_path_display, subject, sender_name, sender_email, date_utc, snippet, has_attachments
* total_count
* page, page_size

Asegura que sea MUY rápido con índices y con LIMIT/OFFSET.

Incluye tests rápidos (aunque sean simples) o al menos una función de parsing de query con ejemplos.


prompt 5

Implementa endpoints para navegar:

1. GET /folders?pst_id=...
   Devuelve árbol de folders:
   [
   { "id": 1, "name": "Inbox", "path_display": "Inbox", "children": [...] }
   ]

2. GET /messages?pst_id=...&folder_id=...&page=...&page_size=...
   Devuelve listado paginado ordenado por date_utc desc.

3. GET /messages/{id}
   Devuelve detalle completo:

* subject, from, to, cc, date, body_text, body_html
* attachments (id, filename, size)

Asegura que /messages/{id} incluya el folder_path_display también para mostrarlo en UI.


prompt 6

Implementa export/download de correos.

REQUISITOS:

1. GET /messages/{id}/download?format=eml|json

* json: devuelve JSON completo del mensaje
* eml: genera un archivo EML con headers básicos y el body (texto o html)

2. POST /messages/export
   Body:
   {
   "pst_id": "...",
   "message_ids": [1,2,3],
   "format": "eml",
   "include_attachments": true
   }
   Devuelve un ZIP descargable:

* Contiene los .eml
* Si include_attachments true: crea carpeta por correo con attachments (si stored_path existe)
* Como en este punto attachments stored_path puede ser NULL, solo exporta EMLs por ahora.

IMPORTANTE:

* El ZIP debe tener nombres seguros, sin caracteres raros
* Ordena los correos por date_utc
* La API debe responder como file streaming (FastAPI StreamingResponse) sin cargar todo a memoria.

Entrega todo bien hecho.



prompt 7

Crea el frontend en /frontend con Next.js (App Router) + Tailwind + Framer Motion.

REQUISITOS DE DISEÑO:

* Mobile-first, iOS style (rounded, clean, premium)
* Colores llamativos pero elegantes (accent fuerte)
* Animaciones fluidas (transiciones suaves al navegar)
* Debe ser responsive para desktop

PÁGINAS:

1. / (Upload)

* Drag & drop card
* botón Choose file
* Progreso al subir/indexar

2. /mail (Listado)

* Search bar sticky
* chips filtros
* lista de correos

3. /mail/[id] (Detalle)

* ver correo completo
* botón para marcar/desmarcar

COMPONENTES:

* Header
* Bottom selection bar (aparece si hay selected > 0)
* Toasts (success/error)
* Skeleton loading bonito

STACK:

* TanStack Query para requests
* Zustand para selección persistente en localStorage

Incluye:

* api client con baseURL desde env NEXT_PUBLIC_API_URL
* .env.local ejemplo (NEXT_PUBLIC_API_URL=[http://localhost:8000](http://localhost:8000))


prompt 8

Implementa el flujo de upload desde la UI.

REQUISITOS:

* En / (Upload), drag&drop y file picker
* Al subir, llama POST /pst/upload
* Muestra estados:

  * Uploading...
  * Indexing...
* Cuando termine y already_indexed o stored, redirige a /mail?pst_id=...

Además:

* Si el PST ya estaba indexado, no repitas pasos, solo redirige.
* Maneja errores y muestra toast.


prompt 9

Implementa /mail

REQUISITOS:

* Lee pst_id de query param
* Carga folders (sidebar en desktop, drawer en mobile)
* Carga mensajes con GET /messages o /search según haya query q
* Search bar sticky con debounce 200ms
* Chips rápidos:

  * Inbox, Sent, Has Attachments, This week
  * que actualicen el query automáticamente usando sintaxis OP (ej: has:attachment after:YYYY-MM-DD)

LISTA:

* Cada item muestra subject, sender, snippet, date
* Checkbox para selección (modo multi select)
* Debe ser rápido con lista virtualizada si hay muchos (TanStack Virtual)

PAGINACIÓN:

* infinite scroll o botones "Load more"
* sin recargar la página completa

SELECCIÓN:

* Persistente con Zustand
* Si marco uno, queda marcado aunque navegue a detalle y regrese

Bottom bar:

* aparece si selected > 0
* muestra "X selected"
* botón Download
* botón Clear

Download:

* llama POST /messages/export con message_ids
* baja ZIP automáticamente en el navegador


prompt 10

Implementa /mail/[id]

REQUISITOS:

* Carga GET /messages/{id}
* Muestra layout iOS:

  * subject grande
  * from/to/cc/date en bloque
  * body (si hay html úsalo en un contenedor seguro)
  * attachments cards si hay
* Botón arriba o flotante:

  * "Mark selected" o "Unmark"
  * Esto usa Zustand store para añadir/remover el message id
* Al volver atrás, la selección del listado sigue intacta

Incluye animación slide-in/out al entrar y salir.


prompt 11

Mejora la app para que se sienta premium.

REQUISITOS:

* Skeletons modernos
* Animaciones con Framer Motion (spring)
* Focus states y accesibilidad
* Dark mode opcional (toggle)
* Optimiza requests con caching (TanStack Query)
* Manejo perfecto de loading/error/empty states
* Cuando se descargue el ZIP, mostrar toast "Export completed"

Además:

* Haz que el listado agrupe visualmente por fecha:

  * Today / Yesterday / Last 7 days / Older
    (Si es complejo, hazlo como headers simples basados en date_utc)


prompt 12

Genera un README final en la raíz del repo con:

* Requisitos (Python, Node, pip, npm)
* Instalación backend:

  * crear venv
  * pip install -r requirements.txt
  * uvicorn app.main:app --reload --port 8000
* Instalación frontend:

  * npm install
  * npm run dev (3000)
* Notas sobre pypff en Windows y recomendación WSL si falla
* Ejemplos de búsquedas OP:

  * from:amazon subject:factura has:attachment after:2025-01-01
  * "estado de cuenta" filename:pdf
* Estructura del proyecto

Además incluye scripts:

* backend: run_dev.bat y run_dev.sh (opcional)
* frontend: npm scripts estándar

Todo debe quedar listo para producción local.


prompt 13

Agrega soporte para extraer adjuntos físicamente durante indexación.

REQUISITOS:

* En pst_parser, cuando detectes attachment:

  * guardarlo en STORAGE_DIR/attachments/{pst_id}/{message_id}/{filename}
  * stored_path se llena con ese path
* Manejar nombres duplicados (agregar sufijo)
* Límite opcional: no guardar adjuntos > 50MB (config en .env)
* Export ZIP con include_attachments=true debe incluir esos archivos dentro de carpeta por correo.


