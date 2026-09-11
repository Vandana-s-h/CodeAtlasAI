from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.repositories import router as repositories_router

app = FastAPI(title="CodeAtlas AI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(repositories_router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok", "service": "codeatlas-api"}
