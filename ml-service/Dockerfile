# Same Python as the training environment: the model is a pickle, so versions must match
FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY readmission/ ./readmission/
COPY app/ ./app/
COPY artifacts/ ./artifacts/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
