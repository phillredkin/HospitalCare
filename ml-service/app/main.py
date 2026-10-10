from fastapi import FastAPI

app = FastAPI(
    title="HospitalCare ML API",
    version="1.0.0"
)


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "hospitalcare-ml"
    }