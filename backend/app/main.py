from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.api import api_router
from app.db.session import engine
from app.db.base import Base

app = FastAPI(title="Rental Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    try:
        Base.metadata.create_all(bind=engine)
        print("Database connection & tables initialized successfully.")
    except Exception as e:
        print(f"Warning: Database connection failed during startup: {e}")

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Rental Intelligence API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
