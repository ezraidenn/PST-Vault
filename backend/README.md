# PST Vault Backend

FastAPI backend for parsing and indexing Outlook .pst files.

## Requirements

- Python 3.11+
- pip

## Installation

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

## API Endpoints

- `GET /health` - Health check
- `POST /pst/upload` - Upload PST file
- `GET /pst/{pst_id}/status` - Check indexing status
- `GET /folders` - Get folder tree
- `GET /messages` - List messages
- `GET /messages/{id}` - Get message detail
- `GET /search` - Advanced search
- `GET /messages/{id}/download` - Download single message
- `POST /messages/export` - Export multiple messages as ZIP
