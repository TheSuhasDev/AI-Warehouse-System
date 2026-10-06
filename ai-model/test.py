import argparse
from ultralytics import YOLO

MODEL_PATH = r"C:\Users\suhas\runs\detect\warehouse_tools2\weights\best.pt"

parser = argparse.ArgumentParser(description="Compare warehouse-tool detections at several thresholds.")
parser.add_argument("image", nargs="?", help="Path to a controlled test image")
args = parser.parse_args()
image = args.image or input("Enter image path: ").strip().strip('"')
model = YOLO(MODEL_PATH)

for threshold in (0.65, 0.70, 0.75):
    print(f"\nConfidence threshold: {threshold:.2f}")
    results = model.predict(source=image, conf=threshold, device="cpu", verbose=False)
    for result in results:
        if result.boxes is None or len(result.boxes) == 0:
            print("  No product detected")
            continue
        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            coordinates = [round(float(value), 2) for value in box.xyxy[0]]
            print(f"  {model.names[class_id]}: {confidence:.2%} box={coordinates}")