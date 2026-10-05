from ultralytics import YOLO


def main():
    model = YOLO("yolo11n.pt")

    model.train(
        data="dataset/data.yaml",
        epochs=10,
        imgsz=640,
        batch=8,
        device=0,
        workers=0,
        name="warehouse_tools"
    )


if __name__ == "__main__":
    main()
    