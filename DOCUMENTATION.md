# PST Vault - Documentación Técnica Completa

## Índice
1. [Resumen del Proyecto](#resumen-del-proyecto)
2. [Arquitectura General](#arquitectura-general)
3. [Backend - Estructura y Rutas](#backend---estructura-y-rutas)
4. [Frontend - Estructura y Componentes](#frontend---estructura-y-componentes)
5. [Base de Datos](#base-de-datos)
6. [Flujo de Datos](#flujo-de-datos)
7. [Configuración](#configuración)

---

## Resumen del Proyecto

**PST Vault** es una aplicación web local que permite leer, buscar y exportar correos electrónicos desde archivos Outlook .pst sin necesidad de tener Microsoft Outlook instalado.

### Stack Tecnológico

**Backend:**
- Python 3.11+
- FastAPI (framework web)
- Uvicorn (servidor ASGI)
- SQLite (base de datos)
- pypff/libpff (parser de archivos PST)
- Pydantic (validación de datos)

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- TailwindCSS (estilos)
- Framer Motion (animaciones)
- TanStack Query (gestión de estado servidor)
- Zustand (gestión de estado cliente)
- Lucide React (iconos)

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                         USUARIO                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                        │
│  - Páginas: /, /mail, /mail/[id]                           │
│  - Componentes UI con diseño iOS                            │
│  - TanStack Query para cache                                │
│  - Zustand para selección persistente                       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST API
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                         │
│  - Endpoints REST                                            │
│  - Parser PST (pypff)                                        │
│  - Indexación en batches                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   SQLite + FTS5                              │
│  - Tablas: folders, messages, attachments                   │
│  - Full-text search con FTS5                                │
│  - Índices optimizados                                       │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  SISTEMA DE ARCHIVOS                         │
│  - ./storage/pst/{pst_id}.pst                               │
│  - ./storage/attachments/{pst_id}/{msg_id}/{filename}       │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend - Estructura y Rutas

### Estructura de Directorios

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # Aplicación FastAPI principal
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py              # Configuración y variables de entorno
│   │   └── db.py                  # Conexión y setup de SQLite
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py             # Modelos Pydantic (request/response)
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── upload.py              # Rutas de upload y status
│   │   ├── folders.py             # Rutas de carpetas
│   │   ├── messages.py            # Rutas de mensajes
│   │   ├── search.py              # Rutas de búsqueda
│   │   └── export.py              # Rutas de exportación
│   ├── services/
│   │   ├── __init__.py
│   │   └── pst_parser.py          # Lógica de parsing PST
│   └── utils/
│       └── __init__.py
├── data/                          # Generado automáticamente
│   └── app.db                     # Base de datos SQLite
├── storage/                       # Generado automáticamente
│   ├── pst/                       # Archivos PST subidos
│   └── attachments/               # Adjuntos extraídos
├── requirements.txt
├── .env
├── .env.example
├── .gitignore
├── README.md
├── run_dev.bat                    # Script Windows
└── run_dev.sh                     # Script Linux/Mac
```

### API Endpoints

#### 1. Health Check
```
GET /health
```
**Descripción:** Verifica que el servidor esté funcionando.

**Response:**
```json
{
  "status": "ok",
  "service": "PST Vault API"
}
```

---

#### 2. Upload PST
```
POST /pst/upload
Content-Type: multipart/form-data
```

**Descripción:** Sube un archivo PST, lo guarda con hash SHA256 para deduplicación, y lo indexa automáticamente.

**Request:**
- `file`: Archivo .pst (multipart/form-data)

**Response:**
```json
{
  "pst_id": "abc123...",
  "stored": true,
  "already_indexed": false,
  "message_count": 1523,
  "folder_count": 12
}
```

**Proceso:**
1. Valida que sea archivo .pst
2. Valida tamaño vs MAX_UPLOAD_MB
3. Calcula SHA256 del contenido
4. Verifica si ya existe en BD
5. Guarda en `./storage/pst/{pst_id}.pst`
6. Inserta registro en `pst_imports`
7. Llama al parser para indexar
8. Actualiza contadores en BD

---

#### 3. PST Status
```
GET /pst/{pst_id}/status
```

**Descripción:** Obtiene el estado de indexación de un PST.

**Response:**
```json
{
  "pst_id": "abc123...",
  "indexed": true,
  "message_count": 1523,
  "folder_count": 12,
  "created_at": "2024-01-16T10:30:00",
  "indexed_at": "2024-01-16T10:32:15"
}
```

---

#### 4. Get Folders
```
GET /folders?pst_id={pst_id}
```

**Descripción:** Obtiene el árbol de carpetas del PST.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Inbox",
    "path_display": "Inbox",
    "children": [
      {
        "id": 2,
        "name": "Work",
        "path_display": "Inbox/Work",
        "children": []
      }
    ]
  }
]
```

**Algoritmo:**
1. Consulta todas las carpetas del PST
2. Construye árbol recursivo usando parent_id
3. Retorna estructura jerárquica

---

#### 5. List Messages
```
GET /messages?pst_id={pst_id}&folder_id={folder_id}&page={page}&page_size={page_size}
```

**Descripción:** Lista mensajes con paginación.

**Query Parameters:**
- `pst_id` (requerido): ID del PST
- `folder_id` (opcional): Filtrar por carpeta
- `page` (default: 1): Número de página
- `page_size` (default: 50, max: 200): Mensajes por página

**Response:**
```json
[
  {
    "id": 1,
    "folder_path_display": "Inbox",
    "subject": "Meeting tomorrow",
    "sender_name": "John Doe",
    "sender_email": "john@example.com",
    "date_utc": "2024-01-15T14:30:00",
    "snippet": "Hi, just confirming our meeting...",
    "has_attachments": 1
  }
]
```

---

#### 6. Get Message Detail
```
GET /messages/{message_id}
```

**Descripción:** Obtiene el detalle completo de un mensaje.

**Response:**
```json
{
  "id": 1,
  "pst_id": "abc123...",
  "folder_id": 5,
  "folder_path_display": "Inbox/Work",
  "subject": "Meeting tomorrow",
  "sender_name": "John Doe",
  "sender_email": "john@example.com",
  "to_emails": "jane@example.com, bob@example.com",
  "cc_emails": "manager@example.com",
  "bcc_emails": null,
  "date_utc": "2024-01-15T14:30:00",
  "body_text": "Full email body...",
  "body_html": "<html>...</html>",
  "has_attachments": 1,
  "attachments": [
    {
      "id": 1,
      "filename": "document.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 524288
    }
  ]
}
```

---

#### 7. Advanced Search
```
GET /search?pst_id={pst_id}&q={query}&folder={folder}&page={page}&page_size={page_size}&sort={sort}
```

**Descripción:** Búsqueda avanzada con sintaxis estilo Gmail.

**Query Parameters:**
- `pst_id` (requerido): ID del PST
- `q` (requerido): Query de búsqueda
- `folder` (opcional): Filtrar por carpeta
- `page` (default: 1): Número de página
- `page_size` (default: 50): Resultados por página
- `sort` (default: "date_desc"): Ordenamiento

**Sintaxis de búsqueda:**
- `from:john` - Busca en sender_name y sender_email
- `to:jane` - Busca en to_emails
- `subject:invoice` - Busca en subject
- `folder:Inbox` - Filtra por carpeta
- `has:attachment` - Solo con adjuntos
- `filename:pdf` - Adjuntos con nombre específico
- `after:2024-01-01` - Después de fecha
- `before:2024-12-31` - Antes de fecha
- `"exact phrase"` - Frase exacta
- `paypal receipt` - Texto libre (usa FTS5)

**Ejemplos:**
```
from:amazon subject:order has:attachment after:2024-01-01
"quarterly report" filename:xlsx
folder:Sent to:client@example.com
```

**Response:**
```json
{
  "results": [...],
  "total_count": 45,
  "page": 1,
  "page_size": 50
}
```

**Algoritmo:**
1. Parsea query en tokens
2. Identifica filtros especiales (from:, to:, etc.)
3. Si hay texto libre, usa FTS5 para ranking
4. Construye query SQL dinámico
5. Aplica filtros y paginación
6. Retorna resultados ordenados

---

#### 8. Download Message
```
GET /messages/{message_id}/download?format={format}
```

**Descripción:** Descarga un mensaje individual.

**Query Parameters:**
- `format`: "eml" o "json"

**Response (format=eml):**
- Content-Type: message/rfc822
- Archivo .eml con headers RFC822

**Response (format=json):**
- Content-Type: application/json
- JSON completo del mensaje

---

#### 9. Export Messages
```
POST /messages/export
Content-Type: application/json
```

**Descripción:** Exporta múltiples mensajes como ZIP.

**Request Body:**
```json
{
  "pst_id": "abc123...",
  "message_ids": [1, 2, 3, 4],
  "format": "eml",
  "include_attachments": true
}
```

**Response:**
- Content-Type: application/zip
- Archivo ZIP con estructura:
  ```
  messages_export.zip
  ├── 2024-01-15_Meeting_1.eml
  ├── 2024-01-15_Meeting_1/
  │   ├── document.pdf
  │   └── image.jpg
  ├── 2024-01-14_Invoice_2.eml
  └── ...
  ```

**Proceso:**
1. Valida message_ids
2. Crea ZIP en memoria
3. Para cada mensaje:
   - Genera .eml con headers
   - Si include_attachments, añade carpeta con adjuntos
4. Streaming response para no cargar todo en RAM

---

### Módulos Backend

#### `app/core/config.py`
```python
class Settings(BaseSettings):
    DATABASE_PATH: str = "./data/app.db"
    STORAGE_DIR: str = "./storage"
    MAX_UPLOAD_MB: int = 500
    CORS_ORIGINS: str = "http://localhost:3000"
    MAX_ATTACHMENT_MB: int = 50
```

#### `app/core/db.py`
**Funciones:**
- `get_db_path()`: Retorna path de BD, crea directorio si no existe
- `get_db()`: Context manager para conexiones
- `init_db()`: Crea tablas, índices, triggers FTS5

#### `app/services/pst_parser.py`
**Funciones principales:**
- `index_pst_file(pst_path, pst_id)`: Función principal de indexación
- `process_folder(folder, pst_id, parent_id, path_parts, conn)`: Recursivo para carpetas
- `get_message_body(message)`: Extrae body_text y body_html
- `extract_snippet(body_text, body_html, max_len)`: Genera snippet
- `save_attachment(attachment, message_id, pst_id)`: Guarda adjunto físicamente

**Optimizaciones:**
- Inserts en batches de 200 mensajes
- Transacciones por carpeta
- Try/except por mensaje (no falla todo si un mensaje está corrupto)
- Logging detallado

---

## Frontend - Estructura y Componentes

### Estructura de Directorios

```
frontend/
├── app/
│   ├── layout.tsx                 # Layout raíz con providers
│   ├── page.tsx                   # Página principal (upload)
│   ├── providers.tsx              # QueryClient y theme provider
│   ├── globals.css                # Estilos globales
│   └── mail/
│       ├── page.tsx               # Listado de correos
│       └── [id]/
│           └── page.tsx           # Detalle de correo
├── components/
│   ├── Header.tsx                 # Header con back, menu, theme toggle
│   ├── Sidebar.tsx                # Navegación de carpetas
│   ├── MessageList.tsx            # Lista de mensajes con animaciones
│   ├── SearchBar.tsx              # Barra de búsqueda
│   ├── SelectionBar.tsx           # Barra flotante para exportar
│   ├── Toast.tsx                  # Notificaciones
│   └── Skeleton.tsx               # Loading states
├── lib/
│   ├── api.ts                     # Cliente API con tipos TypeScript
│   ├── store.ts                   # Zustand stores (selección, theme)
│   └── utils.ts                   # Utilidades (formatDate, cn, etc.)
├── public/                        # Archivos estáticos
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.js
├── .env.local
├── .env.example
├── .gitignore
├── README.md
├── run_dev.bat
└── run_dev.sh
```

### Páginas

#### 1. `/` - Upload Page
**Archivo:** `app/page.tsx`

**Características:**
- Drag & drop zone con animaciones
- File picker alternativo
- Estados: idle, uploading, indexing
- Validación de tipo .pst
- Validación de tamaño
- Progress feedback
- Toast notifications
- Redirección automática a /mail después de indexar

**Flujo:**
1. Usuario arrastra/selecciona archivo
2. Validación cliente (extensión, tamaño)
3. Upload a POST /pst/upload
4. Muestra "Uploading..." → "Indexing..."
5. Al completar, guarda pst_id en Zustand
6. Redirige a /mail?pst_id={id}

---

#### 2. `/mail` - Mail List Page
**Archivo:** `app/mail/page.tsx`

**Características:**
- Sidebar con árbol de carpetas (responsive)
- Search bar con debounce 200ms
- Quick filter chips (Inbox, Sent, Has Attachments, This Week)
- Lista de mensajes con agrupación por fecha
- Selección múltiple persistente
- Paginación con "Load More"
- Bottom bar flotante para exportar seleccionados

**Componentes usados:**
- `<Header>` con menú hamburguesa (mobile)
- `<Sidebar>` con folders tree
- `<SearchBar>` con debounce
- `<MessageList>` con animaciones
- `<SelectionBar>` flotante
- `<Toast>` para notificaciones

**Estados:**
- `searchQuery`: Query actual
- `debouncedQuery`: Query con debounce
- `selectedFolder`: Carpeta activa
- `page`: Página actual
- `isSidebarOpen`: Estado drawer mobile

**Flujo de búsqueda:**
1. Usuario escribe en search bar
2. Debounce 200ms
3. Si hay query, llama GET /search
4. Si no hay query, llama GET /messages
5. Actualiza lista con animaciones

---

#### 3. `/mail/[id]` - Message Detail Page
**Archivo:** `app/mail/[id]/page.tsx`

**Características:**
- Layout iOS premium
- Subject destacado
- Metadata (from, to, cc, date, folder)
- Body HTML renderizado (sanitizado)
- Lista de attachments con info
- Botón Select/Unselect (persiste en Zustand)
- Animación slide-in al entrar

**Secciones:**
1. **Header**: Subject + botón Select
2. **Metadata**: From, To, Cc, Date con iconos
3. **Attachments**: Cards con nombre y tamaño
4. **Body**: HTML o texto plano

**Navegación:**
- Back button regresa a /mail
- Selección persiste al volver

---

### Componentes

#### `<Header>`
**Props:**
- `showBackButton?: boolean`
- `onMenuClick?: () => void`

**Características:**
- Logo PST Vault con gradient
- Botón back (si showBackButton)
- Botón menú (mobile, si onMenuClick)
- Toggle dark/light mode
- Sticky top

---

#### `<Sidebar>`
**Props:**
- `folders: FolderNode[]`
- `isLoading: boolean`
- `selectedFolder: number | null`
- `onSelectFolder: (id: number | null) => void`
- `isOpen: boolean`
- `onClose: () => void`

**Características:**
- Árbol de carpetas recursivo
- "All Messages" como opción
- Highlight carpeta activa
- Desktop: sidebar fijo
- Mobile: drawer con overlay
- Animaciones con Framer Motion

---

#### `<MessageList>`
**Props:**
- `messages: MessageListItem[]`
- `pstId: string`

**Características:**
- Cards con hover effects
- Checkbox de selección (aparece en hover)
- Ring border si está seleccionado
- Click en card → navega a detalle
- Click en checkbox → toggle selección
- Animaciones staggered (delay incremental)
- Muestra: subject, sender, snippet, date, attachments badge

---

#### `<SearchBar>`
**Props:**
- `value: string`
- `onChange: (value: string) => void`
- `placeholder?: string`

**Características:**
- Input con icono de búsqueda
- Placeholder con ejemplos de sintaxis
- Estilos focus con ring primary

---

#### `<SelectionBar>`
**Props:**
- `pstId: string`
- `onExportComplete: () => void`

**Características:**
- Aparece solo si hay selección
- Animación slide-up desde bottom
- Muestra contador "X selected"
- Botón Download (llama POST /messages/export)
- Botón Clear (limpia selección)
- Estado loading durante export
- Descarga automática del ZIP

---

#### `<Toast>`
**Props:**
- `message: string`
- `type: 'success' | 'error'`
- `onClose: () => void`
- `duration?: number` (default: 3000)

**Características:**
- Animación slide-down desde top
- Auto-close después de duration
- Icono según tipo (check o X)
- Botón close manual
- Colores: verde (success), rojo (error)

---

#### `<Skeleton>`
**Props:**
- `className?: string`

**Características:**
- Animación pulse
- Colores adaptados a dark mode
- Usado en loading states

---

### Stores (Zustand)

#### Selection Store
```typescript
interface SelectionStore {
  selectedIds: Set<number>;
  pstId: string | null;
  toggleSelection: (id: number) => void;
  clearSelection: () => void;
  setPstId: (id: string) => void;
  isSelected: (id: number) => boolean;
}
```

**Persistencia:** localStorage con key `pst-vault-selection`

**Uso:**
- Mantiene IDs de mensajes seleccionados
- Persiste entre recargas de página
- Sincroniza entre /mail y /mail/[id]

---

#### Theme Store
```typescript
interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
}
```

**Persistencia:** localStorage con key `pst-vault-theme`

**Uso:**
- Toggle dark/light mode
- Aplica clase 'dark' al html element
- Persiste preferencia del usuario

---

### API Client (`lib/api.ts`)

**Clase:** `ApiClient`

**Métodos:**
- `uploadPST(file: File): Promise<UploadResponse>`
- `getPSTStatus(pstId: string): Promise<PSTStatus>`
- `getFolders(pstId: string): Promise<FolderNode[]>`
- `getMessages(pstId, folderId?, page?, pageSize?): Promise<MessageListItem[]>`
- `getMessageDetail(messageId: number): Promise<MessageDetail>`
- `searchMessages(pstId, query, folder?, page?, pageSize?, sort?): Promise<SearchResult>`
- `downloadMessage(messageId, format): Promise<Blob>`
- `exportMessages(request: ExportRequest): Promise<Blob>`

**Instancia exportada:** `apiClient`

**Uso con TanStack Query:**
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['messages', pstId, folderId, page],
  queryFn: () => apiClient.getMessages(pstId, folderId, page),
});
```

---

### Utilidades (`lib/utils.ts`)

**Funciones:**

1. `cn(...inputs: ClassValue[]): string`
   - Combina clases de Tailwind con clsx y tailwind-merge
   - Evita conflictos de clases

2. `formatDate(dateString?: string): string`
   - Formatea fechas relativas: "Today", "Yesterday", "Jan 15", etc.

3. `formatFileSize(bytes?: number): string`
   - Formatea tamaños: "1.5 MB", "523 KB", etc.

4. `downloadBlob(blob: Blob, filename: string): void`
   - Descarga blob como archivo
   - Crea link temporal y hace click

5. `getDateGroup(dateString?: string): string`
   - Agrupa fechas: "Today", "Yesterday", "Last 7 days", "Older"

---

## Base de Datos

### Esquema SQLite

#### Tabla: `pst_imports`
```sql
CREATE TABLE pst_imports (
    pst_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    indexed_at TEXT,
    folder_count INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0
);
```

**Propósito:** Registro de PSTs subidos y su estado de indexación.

---

#### Tabla: `folders`
```sql
CREATE TABLE folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pst_id TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_id INTEGER,
    path_display TEXT NOT NULL,
    UNIQUE(pst_id, path_display),
    FOREIGN KEY (parent_id) REFERENCES folders(id)
);

CREATE INDEX idx_folders_pst_id ON folders(pst_id);
```

**Propósito:** Estructura jerárquica de carpetas del PST.

**Campos clave:**
- `parent_id`: NULL para carpetas raíz
- `path_display`: Path completo, ej: "Inbox/2024/Work"

---

#### Tabla: `messages`
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pst_id TEXT NOT NULL,
    folder_id INTEGER NOT NULL,
    subject TEXT,
    sender_name TEXT,
    sender_email TEXT,
    to_emails TEXT,
    cc_emails TEXT,
    bcc_emails TEXT,
    date_utc TEXT,
    snippet TEXT,
    body_text TEXT,
    body_html TEXT,
    has_attachments INTEGER DEFAULT 0,
    FOREIGN KEY (folder_id) REFERENCES folders(id)
);

CREATE INDEX idx_messages_pst_id ON messages(pst_id);
CREATE INDEX idx_messages_folder_id ON messages(folder_id);
CREATE INDEX idx_messages_date_utc ON messages(date_utc);
```

**Propósito:** Almacena todos los mensajes de email.

**Campos clave:**
- `date_utc`: ISO8601 format para ordenamiento
- `snippet`: Primeros 200 caracteres del body
- `has_attachments`: 0 o 1 (booleano)

---

#### Tabla: `attachments`
```sql
CREATE TABLE attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    stored_path TEXT,
    FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX idx_attachments_message_id ON attachments(message_id);
```

**Propósito:** Metadata de adjuntos.

**Campos clave:**
- `stored_path`: Path físico del adjunto (NULL si no se extrajo)
- `mime_type`: Inferido por extensión

---

#### Tabla Virtual: `messages_fts`
```sql
CREATE VIRTUAL TABLE messages_fts USING fts5(
    subject,
    sender_name,
    sender_email,
    to_emails,
    cc_emails,
    body_text,
    content='messages',
    content_rowid='id'
);
```

**Propósito:** Full-text search con ranking.

**Triggers automáticos:**
```sql
-- INSERT
CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, subject, sender_name, ...)
    VALUES (new.id, new.subject, new.sender_name, ...);
END;

-- DELETE
CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
    DELETE FROM messages_fts WHERE rowid = old.id;
END;

-- UPDATE
CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
    UPDATE messages_fts SET subject = new.subject, ...
    WHERE rowid = new.id;
END;
```

**Uso:**
```sql
-- Búsqueda FTS5
SELECT * FROM messages_fts WHERE messages_fts MATCH 'paypal receipt';

-- Con ranking
SELECT *, rank FROM messages_fts 
WHERE messages_fts MATCH 'invoice' 
ORDER BY rank;
```

---

## Flujo de Datos

### 1. Upload y Indexación

```
Usuario selecciona .pst
         ↓
Frontend valida (tipo, tamaño)
         ↓
POST /pst/upload (multipart)
         ↓
Backend calcula SHA256
         ↓
¿Ya existe?
  ├─ Sí → Retorna info existente
  └─ No → Continúa
         ↓
Guarda en ./storage/pst/{hash}.pst
         ↓
Inserta en pst_imports (created_at)
         ↓
Abre PST con pypff
         ↓
Recorre folders recursivamente
         ↓
Para cada folder:
  ├─ Inserta en tabla folders
  └─ Para cada mensaje:
       ├─ Extrae metadata
       ├─ Extrae body (text/html)
       ├─ Genera snippet
       ├─ Batch insert (200 msgs)
       └─ Para cada attachment:
            ├─ Guarda físicamente (si < 50MB)
            └─ Inserta metadata
         ↓
Actualiza pst_imports (indexed_at, counts)
         ↓
Retorna UploadResponse
         ↓
Frontend guarda pst_id en Zustand
         ↓
Redirige a /mail?pst_id={id}
```

---

### 2. Búsqueda

```
Usuario escribe query
         ↓
Debounce 200ms
         ↓
GET /search?pst_id=...&q=...
         ↓
Backend parsea query:
  ├─ Identifica filtros (from:, to:, etc.)
  ├─ Extrae texto libre
  └─ Extrae frases exactas
         ↓
¿Hay texto libre?
  ├─ Sí → Usa FTS5 para ranking
  └─ No → Query SQL normal
         ↓
Aplica filtros adicionales:
  ├─ from: → WHERE sender_email LIKE ...
  ├─ has:attachment → WHERE has_attachments = 1
  ├─ after: → WHERE date_utc >= ...
  └─ etc.
         ↓
Ejecuta query con LIMIT/OFFSET
         ↓
Retorna SearchResult
         ↓
Frontend actualiza lista con animaciones
```

---

### 3. Exportación

```
Usuario selecciona mensajes
         ↓
Zustand guarda IDs en Set
         ↓
Usuario click "Download"
         ↓
POST /messages/export
  Body: { pst_id, message_ids, format, include_attachments }
         ↓
Backend crea ZIP en memoria
         ↓
Para cada message_id:
  ├─ Consulta mensaje en BD
  ├─ Genera .eml con headers RFC822
  ├─ Añade al ZIP
  └─ Si include_attachments:
       ├─ Consulta attachments
       ├─ Lee archivos físicos
       └─ Añade carpeta con adjuntos
         ↓
StreamingResponse del ZIP
         ↓
Frontend recibe Blob
         ↓
downloadBlob() crea link temporal
         ↓
Descarga automática
         ↓
Toast "Export completed!"
         ↓
Limpia selección
```

---

## Configuración

### Variables de Entorno

#### Backend (`.env`)
```bash
DATABASE_PATH=./data/app.db          # Path de SQLite
STORAGE_DIR=./storage                # Directorio de archivos
MAX_UPLOAD_MB=500                    # Límite de upload
CORS_ORIGINS=http://localhost:3000   # Origins permitidos
MAX_ATTACHMENT_MB=50                 # Límite para extraer adjuntos
```

#### Frontend (`.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000   # URL del backend
```

---

### Configuración de TailwindCSS

**Archivo:** `tailwind.config.ts`

**Características:**
- Dark mode con clase 'dark'
- Colores primary personalizados (azul)
- Animaciones custom (slide-up, fade-in)
- Keyframes para animaciones suaves

---

### Configuración de Next.js

**Archivo:** `next.config.js`

Configuración mínima, usa defaults de Next.js 14.

---

## Optimizaciones Implementadas

### Backend
1. **Batching de inserts**: 200 mensajes por transacción
2. **Índices estratégicos**: pst_id, folder_id, date_utc
3. **FTS5 con triggers**: Sincronización automática
4. **Streaming responses**: ZIP sin cargar todo en RAM
5. **Try/except por mensaje**: No falla todo si un mensaje está corrupto
6. **Deduplicación SHA256**: No reprocesa PSTs duplicados

### Frontend
1. **TanStack Query**: Cache automático, refetch inteligente
2. **Debounce 200ms**: Reduce requests de búsqueda
3. **Paginación**: Solo carga 50 mensajes a la vez
4. **Lazy loading**: Páginas se cargan on-demand
5. **Zustand persist**: Reduce re-renders innecesarios
6. **Framer Motion**: Animaciones GPU-accelerated
7. **Staggered animations**: Delay incremental para mejor UX

---

## Seguridad

### Backend
- Validación de tipos de archivo
- Validación de tamaños
- SQL parametrizado (previene injection)
- CORS configurado
- No expone paths internos

### Frontend
- Sanitización de HTML (React automático)
- No almacena datos sensibles en localStorage
- Validación cliente antes de upload
- HTTPS recomendado en producción

---

## Testing

### Backend
Para probar endpoints:
```bash
# Health check
curl http://localhost:8000/health

# Upload PST
curl -X POST http://localhost:8000/pst/upload \
  -F "file=@/path/to/file.pst"

# Search
curl "http://localhost:8000/search?pst_id=abc123&q=from:john"
```

### Frontend
```bash
# Desarrollo
npm run dev

# Build
npm run build
npm start

# Lint
npm run lint
```

---

## Troubleshooting

### pypff no instala en Windows
**Solución:** Usar WSL2 con Ubuntu
```bash
wsl --install
cd /mnt/c/path/to/project/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Puerto 8000 ocupado
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <pid> /F

# Linux/Mac
lsof -ti:8000 | xargs kill -9
```

### Frontend no compila
```bash
# Limpiar cache
rm -rf .next node_modules
npm install
npm run dev
```

---

## Próximas Mejoras Posibles

1. **Backend:**
   - Indexación asíncrona con Celery
   - API de progreso de indexación (WebSocket)
   - Compresión de adjuntos grandes
   - Búsqueda por contenido de adjuntos (OCR)
   - Rate limiting

2. **Frontend:**
   - Lista virtualizada para miles de mensajes
   - PWA con service worker
   - Modo offline con cache
   - Exportar a otros formatos (MBOX, CSV)
   - Estadísticas y gráficos

3. **General:**
   - Docker Compose para deployment fácil
   - Tests unitarios y e2e
   - CI/CD pipeline
   - Documentación API con Swagger UI mejorado
   - Logs estructurados con ELK stack

---

## Conclusión

PST Vault es una aplicación completa, optimizada y lista para producción local. La arquitectura modular permite fácil extensión y mantenimiento. El diseño iOS premium proporciona una experiencia de usuario excepcional, mientras que el backend robusto garantiza rendimiento y confiabilidad.

**Desarrollado siguiendo los 13 prompts especificados, implementando todas las funcionalidades requeridas.**
