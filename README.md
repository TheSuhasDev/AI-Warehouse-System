# AI Warehouse Management System

AI-powered industrial warehouse management and product recognition system.

## Overview

AI Warehouse Management System combines a React frontend, Node.js/Express backend, MongoDB, and a FastAPI service running an Ultralytics YOLO model. The browser camera recognizes warehouse tools without requiring a QR code or barcode, then connects detections to receiving, dispatch, inventory, and stock-history workflows.

The seeded product catalogue currently supports:

- Drill
- Hammer
- Pliers
- Screwdriver
- Wrench

This repository is an MVP/prototype. Model quality and operational behavior depend on the training data, camera conditions, and local service configuration.

## Features

### Dashboard

- Total product and unit counts
- Low-stock alerts based on each product's minimum stock
- Today's dispatch movement count
- Recent stock activity
- Inventory overview

### AI product recognition

- Browser-camera capture for receiving and dispatch
- FastAPI `/predict` endpoint backed by Ultralytics YOLO
- Product name, confidence score, and bounding-box detections
- Detection locking to avoid repeatedly counting a stable object in view

### Receive stock

- Starts the browser camera
- Sends captured frames to the AI service
- Adds one unit for each newly detected, stable product
- Records a `RECEIVE` movement

### Dispatch

- Scans products into a temporary dispatch cart
- Supports manual product additions and quantity changes
- Collects client/company name, phone, address, and optional GSTIN
- Validates and deducts stock only after confirmation
- Records `DISPATCH` movements
- Generates a print-friendly invoice

### Inventory and stock history

- Product, SKU, stock, minimum stock, location, selling price, and status
- Search by product, SKU, or location
- Auditable receive and dispatch movement history with quantities and timestamps

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 |
| Backend | Node.js + Express 5 |
| Database | MongoDB + Mongoose 9 |
| AI service | Python + FastAPI + Uvicorn |
| Object detection | Ultralytics YOLO |
| Image processing | Pillow |
| Styling | Plain CSS |
| Development | VS Code |

## Architecture

```text
Browser
   |
   v
React / Vite frontend
   |                         |
   v                         v
Node/Express API        FastAPI AI API
   |                         |
   v                         v
MongoDB                  YOLO model
   |
Products, stock, and movements
```

- **Frontend**: renders the warehouse control center, requests camera access, sends frames to the AI service, and calls backend inventory APIs.
- **Backend**: validates stock operations, manages products and movements, runs dispatch transactions, and serves the REST API.
- **MongoDB**: stores product records and stock movement history.
- **AI service**: accepts an image upload, runs YOLO inference, and returns product labels, confidence values, and boxes.

## Project structure

```text
AI-Warehouse-System/
├── ai-model/
│   ├── api.py
│   ├── train.py
│   ├── requirements.txt
│   └── dataset/
├── backend/
│   ├── src/
│   │   ├── config/database.js
│   │   ├── models/Product.js
│   │   ├── models/StockMovement.js
│   │   ├── routes/productRoutes.js
│   │   ├── seed.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   └── warehouse-system/
│       ├── src/
│       ├── package.json
│       └── .env.example
├── .gitignore
└── README.md
```

## Product catalogue

The backend seed data and frontend detection mapping use these products and SKUs:

| Product | SKU |
|---|---|
| Drill | DRL001 |
| Hammer | HAM001 |
| Pliers | PLR001 |
| Screwdriver | SCR001 |
| Wrench | WRC001 |

## Prerequisites

- Node.js and npm
- Python 3 and pip
- A running MongoDB instance or MongoDB Atlas database
- Git
- A modern browser with camera access
- A compatible YOLO model weight file
- NVIDIA GPU/CUDA is optional; the AI service falls back to CPU when `CUDA_VISIBLE_DEVICES` is not set

## Setup

### Clone

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd AI-Warehouse-System
```

### Backend

```bash
cd backend
npm install
copy .env.example .env
```

Set `MONGO_URI` in `backend/.env` to your own MongoDB connection string. Never commit that file.

Start the backend:

```bash
npm run dev
```

The API listens on `http://localhost:5000` by default. To load the five seed products into an empty database, run `node src/seed.js` from `backend`.

### AI service

```bash
cd ai-model
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Set `AI_MODEL_PATH` in `ai-model/.env` to a model file available on your machine. Model weights are intentionally ignored by Git.

Start the service:

```bash
uvicorn api:app --host 127.0.0.1 --port 8001
```

The health endpoint is `GET http://127.0.0.1:8001/`.

### Frontend

```bash
cd frontend/warehouse-system
npm install
copy .env.example .env
npm run dev
```

Vite normally serves the frontend at `http://localhost:5173`. The frontend defaults to the backend and AI URLs shown in `.env.example`.

## Run the full system

Open three terminals:

### Terminal 1 — Backend

```bash
cd backend
npm run dev
```

### Terminal 2 — AI service

```bash
cd ai-model
venv\Scripts\activate
uvicorn api:app --host 127.0.0.1 --port 8001
```

### Terminal 3 — Frontend

```bash
cd frontend/warehouse-system
npm run dev
```

Allow camera access when using Receive or Dispatch. The browser captures camera frames and sends them to FastAPI for detection.

## API

### Backend (`http://localhost:5000`)

| Method | Route | Purpose |
|---|---|---|
| GET | `/` | Backend health response |
| GET | `/api/products` | List products |
| POST | `/api/products` | Create a product |
| GET | `/api/products/dashboard` | Return dashboard metrics and recent movements |
| PATCH | `/api/products/:id/receive` | Add stock and record a receive movement |
| PATCH | `/api/products/:id/dispatch` | Deduct stock and record a dispatch movement |
| POST | `/api/products/dispatch/transaction` | Atomically dispatch multiple items for a client |
| GET | `/api/products/movements/history` | List stock movements |

### AI service (`http://127.0.0.1:8001`)

| Method | Route | Purpose |
|---|---|---|
| GET | `/` | AI service health and configured threshold |
| POST | `/predict` | Upload an image as `file` and receive YOLO detections |

## Workflows

### Receive

```text
Camera → image capture → FastAPI → YOLO detection
→ product/SKU mapping → Node API → MongoDB
→ stock increment → RECEIVE movement
```

### Dispatch

```text
Camera → YOLO detection → dispatch cart → client details
→ confirmation → Node API transaction → MongoDB
→ stock deduction → DISPATCH movement → invoice
```

## Screenshots

Screenshots can be added here.

## Security

- Never commit `.env` files, credentials, or API keys.
- Never commit model weights unless they are intentionally hosted and approved.
- Keep secrets in environment variables.
- Stock quantities and available stock are validated by the backend before updates.

## Limitations

- Detection quality depends on lighting, camera angle, object appearance, and training data.
- Model weights are not included in Git and must be supplied separately.
- The current implementation is intended as an MVP/prototype rather than a complete production deployment.
- Authentication, authorization, and multi-user access controls are not implemented.

## Future improvements

Potential future work includes:

- User authentication and role-based access
- Multiple warehouse support
- Supplier management
- Advanced analytics and reporting
- More warehouse-specific training images
- Cloud deployment
- Barcode/QR integration
- Advanced invoice and export reporting

## License

License to be added.
