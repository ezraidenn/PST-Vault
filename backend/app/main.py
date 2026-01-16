from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.db import init_db
from .routes import upload, folders, messages, search, export


app = FastAPI(title="PST Vault API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "PST Vault API"}


app.include_router(upload.router, prefix="/pst", tags=["upload"])
app.include_router(folders.router, prefix="/folders", tags=["folders"])
app.include_router(messages.router, prefix="/messages", tags=["messages"])
app.include_router(search.router, prefix="/search", tags=["search"])
app.include_router(export.router, prefix="/messages", tags=["export"])
