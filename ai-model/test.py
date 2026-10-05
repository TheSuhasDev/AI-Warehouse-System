from ultralytics import YOLO

MODEL_PATH = r"C:\Users\suhas\runs\detect\warehouse_tools2\weights\best.pt"

model = YOLO(MODEL_PATH)

image = input("Enter image path: ").strip().strip('"')

results = model.predict(
    source=image,
    conf=0.40,
    save=True,
    device=0
)

for result in results:
    if result.boxes is None or len(result.boxes) == 0:
        print("❌ No product detected")
        continue

    for box in result.boxes:
        class_id = int(box.cls[0])
        confidence = float(box.conf[0])
        name = model.names[class_id]

        print(f"✅ {name}: {confidence:.2%}")

print("\nResult saved in runs/detect/predict/")