from fastapi import FastAPI

app = FastAPI(
    title="VIA EVENTS API",
    version="0.0.1",
    description="VIA EVENTS backend API"
)


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "via-events-api",
        "version": "0.0.1"
    }
