from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import io
import os
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.getenv(
    "AI_MODEL_PATH",
    r"C:\Users\suhas\runs\detect\warehouse_tools2\weights\best.pt",
)
CONFIDENCE_THRESHOLD = float(os.getenv("AI_CONFIDENCE", "0.60"))
model = None


def get_model():
    global model
    if model is None:
        if not Path(MODEL_PATH).exists():
            raise FileNotFoundError(f"YOLO model not found at {MODEL_PATH}")
        model = YOLO(MODEL_PATH)
    return model


@app.get("/")
def home():
    return {
        "message": "Warehouse AI Detection API is running",
        "model": MODEL_PATH,
        "confidenceThreshold": CONFIDENCE_THRESHOLD,
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        detector = get_model()
        results = detector.predict(
            source=image,
            conf=CONFIDENCE_THRESHOLD,
            device="cuda:0" if os.getenv("CUDA_VISIBLE_DEVICES") else "cpu",
            verbose=False,
        )
    except (FileNotFoundError, OSError, ValueError) as error:
        return JSONResponse(status_code=503 if isinstance(error, FileNotFoundError) else 400, content={"detail": str(error)})

    result = results[0]

    detections = []

    if result.boxes is not None:
        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            coordinates = [round(float(value), 2) for value in box.xyxy[0]]

            detections.append({
                "product": detector.names[class_id],
                "confidence": round(confidence, 4),
                "box": {
                    "x1": coordinates[0],
                    "y1": coordinates[1],
                    "x2": coordinates[2],
                    "y2": coordinates[3],
                },
            })

    return {
        "detections": detections,
        "count": len(detections)
    }