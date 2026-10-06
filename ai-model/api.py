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
CONFIDENCE_THRESHOLD = float(os.getenv("AI_CONFIDENCE", "0.70"))
VALID_PRODUCTS = {"drill", "hammer", "pliers", "screwdriver", "wrench"}
SCAN_X_MIN = float(os.getenv("AI_SCAN_X_MIN", "0.20"))
SCAN_X_MAX = float(os.getenv("AI_SCAN_X_MAX", "0.80"))
SCAN_Y_MIN = float(os.getenv("AI_SCAN_Y_MIN", "0.15"))
SCAN_Y_MAX = float(os.getenv("AI_SCAN_Y_MAX", "0.85"))
MIN_BOX_WIDTH_RATIO = float(os.getenv("AI_MIN_BOX_WIDTH_RATIO", "0.05"))
MIN_BOX_HEIGHT_RATIO = float(os.getenv("AI_MIN_BOX_HEIGHT_RATIO", "0.05"))
MIN_BOX_AREA_RATIO = float(os.getenv("AI_MIN_BOX_AREA_RATIO", "0.01"))
MAX_BOX_AREA_RATIO = float(os.getenv("AI_MAX_BOX_AREA_RATIO", "0.80"))
DEBUG_DETECTIONS = os.getenv("AI_DEBUG_DETECTIONS", "false").lower() == "true"
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
        "scanRegion": {
            "xMin": SCAN_X_MIN, "xMax": SCAN_X_MAX,
            "yMin": SCAN_Y_MIN, "yMax": SCAN_Y_MAX,
        },
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        detector = get_model()
        results = detector.predict(
            source=image,
            # Keep low-confidence candidates available for server-side rejection
            # and optional debug output; only validated detections are returned.
            conf=0.10,
            device="cuda:0" if os.getenv("CUDA_VISIBLE_DEVICES") else "cpu",
            verbose=False,
        )
    except (FileNotFoundError, OSError, ValueError) as error:
        return JSONResponse(status_code=503 if isinstance(error, FileNotFoundError) else 400, content={"detail": str(error)})

    result = results[0]
    image_width, image_height = image.size
    detections = []
    debug_detections = []

    if result.boxes is not None:
        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            coordinates = [round(float(value), 2) for value in box.xyxy[0]]
            x1, y1, x2, y2 = coordinates
            width = max(0, x2 - x1)
            height = max(0, y2 - y1)
            area_ratio = (width * height) / (image_width * image_height)
            center_x = (x1 + x2) / 2 / image_width
            center_y = (y1 + y2) / 2 / image_height
            product = str(detector.names[class_id]).strip().lower()
            reason = None
            if product not in VALID_PRODUCTS:
                reason = "unknown_product"
            elif confidence < CONFIDENCE_THRESHOLD:
                reason = "confidence_below_threshold"
            elif width / image_width < MIN_BOX_WIDTH_RATIO or height / image_height < MIN_BOX_HEIGHT_RATIO:
                reason = "box_too_small"
            elif area_ratio < MIN_BOX_AREA_RATIO or area_ratio > MAX_BOX_AREA_RATIO:
                reason = "box_area_out_of_range"
            elif not (SCAN_X_MIN <= center_x <= SCAN_X_MAX and SCAN_Y_MIN <= center_y <= SCAN_Y_MAX):
                reason = "outside_scan_region"

            debug_entry = {
                "product": product,
                "confidence": round(confidence, 4),
                "box": {
                    "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                },
                "width": round(width, 2),
                "height": round(height, 2),
                "areaRatio": round(area_ratio, 5),
                "accepted": reason is None,
                "reason": reason,
            }
            debug_detections.append(debug_entry)
            if reason is None:
                detections.append({key: debug_entry[key] for key in ("product", "confidence", "box")})

    response = {
        "detections": detections,
        "count": len(detections),
        "imageWidth": image_width,
        "imageHeight": image_height,
    }
    if DEBUG_DETECTIONS:
        response["debugDetections"] = debug_detections
    return response
