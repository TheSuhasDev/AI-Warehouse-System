# NEXUS WMS

AI-powered warehouse operations.

NEXUS WMS is a local warehouse operations application that combines a React/Vite control center, an Express/MongoDB warehouse API, and a FastAPI service for camera-based tool recognition with Ultralytics YOLO.

## 1. Project Overview

The application manages a small warehouse catalog of tools. Operators can review warehouse activity, receive stock through the AI camera, create dispatch orders, record payments, manage order status, inspect current inventory, and review stock movements.

The repository contains three services:

- **Frontend**: React 19 and Vite.
- **Backend**: Node.js, Express, Mongoose, and MongoDB.
- **AI service**: FastAPI, Uvicorn, Pillow, and Ultralytics YOLO.

## 2. Key Features

- Dashboard metrics for products, units, low-stock products, today's dispatch count, and recent movements.
- Camera-based product recognition for receiving and dispatch order creation.
- Detection stabilization across three frames with a 70% confidence threshold.
- Stock receiving and dispatch movement history.
- Inventory search and product details.
- Dispatch order creation with manual product selection or AI-detected products.
- Client/company details including name, phone, address, and optional GSTIN.
- Order lifecycle management: processing, advance received, packed, dispatched, and cancelled.
- Advance, partial, and full payment recording.
- Print-friendly invoice preview.

## 3. AI Product Recognition

The browser camera captures a frame every 1.2 seconds while a scanner is active. The frontend sends the image to FastAPI at `POST /predict`. The AI service loads the configured YOLO weights, filters detections by product class, confidence, box size, box area, and scan region, and returns accepted detections.

The frontend accepts a detection after it remains stable for **3 frames** and has confidence of at least **70%**. Receiving adds one unit and records a receive movement. Dispatch adds the recognized product to a temporary order cart; stock is reduced only when a fully paid packed order is dispatched.

Supported model classes:

- `drill`
- `hammer`
- `pliers`
- `screwdriver`
- `wrench`

The camera requires browser permission and works with the local frontend origins configured in the FastAPI CORS middleware.

## 4. Dashboard

The Dashboard page displays:

- Total product count.
- Total stock units.
- Low-stock product count.
- Today's dispatch movement count.
- Recent stock movements.
- An inventory overview with current stock and status.

Low stock is calculated when a product's `stock` is less than or equal to its `minimumStock`.

## 5. Receive Stock

The Receive page provides an AI receiving station:

1. Start the camera and place one supported tool in the scan region.
2. Wait for three stable frames at or above the confidence threshold.
3. The recognized SKU is matched to a catalog product.
4. One unit is added through the backend.
5. A `RECEIVE` stock movement is recorded.

The page also shows the latest recognized product, confidence, and updated stock.

## 6. Dispatch

The Dispatch page creates a temporary order cart from AI detections or manual product selection. Operators can:

- Add products.
- Change quantities.
- Remove cart items.
- Enter client/company name, phone, delivery address, and optional GSTIN.
- Review the order total.
- Create the order.
- Open the generated invoice preview.

Creating an order does not reduce stock. Stock is deducted later by the order dispatch endpoint after the order is packed, fully paid, and has sufficient inventory.

## 7. Inventory

The Inventory page displays catalog products with:

- Name.
- SKU.
- Current stock.
- Minimum stock.
- Storage location.
- Selling price.
- Stock status.

Products can be searched by name, SKU, or location. The backend also supports creating a product with `POST /api/products`.

## 8. Orders

The Orders page lists orders and supports the current order lifecycle:

`PROCESSING` → `ADVANCE_RECEIVED` → `PACKED` → `DISPATCHED`

Orders may also be `CANCELLED`. An advance is required before packing, and full payment is required before dispatch. Order details include client information, items, totals, payment status, and payment history.

## 9. Payments

Payments are recorded against an order. Supported payment types are:

- `ADVANCE`
- `PARTIAL`
- `FULL`

Supported payment methods are:

- `CASH`
- `CARD`
- `UPI`
- `BANK_TRANSFER`
- `OTHER`

The backend prevents payments that exceed the order balance, duplicate non-empty payment references, or payments on dispatched/cancelled orders. The Orders page displays payment state and payment history.

## 10. Billing / Invoice

When an order is created from the Dispatch page, the frontend builds and opens a print-friendly invoice preview. The invoice includes:

- Seller details configured in the current frontend.
- Client details.
- Order number and date.
- Items, quantities, unit prices, and totals.
- Payment status and balance.
- Amount in words.

The invoice is a frontend preview; there is no separate invoice storage endpoint in the current backend.

## 11. Stock History

The Stock history page lists auditable stock movements with product, SKU, movement type, quantity, and timestamp. The current movement types are:

- `RECEIVE`
- `DISPATCH`

## 12. Low Stock Monitoring

Each product has a `minimumStock` value. A product is considered low stock when:

```text
stock <= minimumStock
```

The Dashboard reports the number of low-stock products and the Inventory page shows each product's stock status.

## 13. Technology Stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, React DOM 19, Vite 8 |
| Frontend styling | Plain CSS |
| Backend | Node.js, Express 5, CORS, dotenv |
| Database | MongoDB with Mongoose 9 |
| AI API | FastAPI, Uvicorn |
| Computer vision | Ultralytics YOLO, Pillow |
| Dataset format | YOLO object-detection dataset |
| Development tools | npm, nodemon, ESLint |

## 14. System Architecture

```text
                         ┌─────────────────────────┐
                         │ React + Vite frontend    │
                         │ localhost:5173           │
                         └───────────┬─────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
       ┌────────────────────────┐       ┌────────────────────────┐
       │ Node.js + Express       │       │ FastAPI + Uvicorn       │
       │ localhost:5000          │       │ 127.0.0.1:8001         │
       └────────────┬───────────┘       └────────────┬───────────┘
                    │                                │
                    ▼                                ▼
       ┌────────────────────────┐       ┌────────────────────────┐
       │ MongoDB                │       │ Ultralytics YOLO model  │
       │ products, orders,      │       │ image detections        │
       │ payments, movements    │       └────────────────────────┘
       └────────────────────────┘
```

The frontend calls the Express API for warehouse data and calls FastAPI directly for image predictions. The backend stores products, orders, payments, and stock movements in MongoDB.

## 15. Actual Project Structure

```text
AI-Warehouse-System/
├── ai-model/
│   ├── api.py
│   ├── requirements.txt
│   ├── test.py
│   ├── train.py
│   ├── .env.example
│   └── dataset/
│       ├── data.yaml
│       ├── train/
│       ├── valid/
│       └── test/
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example
│   └── src/
│       ├── server.js
│       ├── seed.js
│       ├── config/
│       │   ├── database.js
│       │   └── orderSettings.js
│       ├── models/
│       │   ├── Product.js
│       │   ├── StockMovement.js
│       │   ├── Order.js
│       │   └── Payment.js
│       └── routes/
│           ├── productRoutes.js
│           └── orderRoutes.js
├── frontend/
│   └── warehouse-system/
│       ├── package.json
│       ├── package-lock.json
│       ├── .env.example
│       ├── index.html
│       ├── vite.config.js
│       ├── public/
│       └── src/
│           ├── main.jsx
│           ├── App.jsx
│           ├── App.css
│           ├── index.css
│           └── assets/
├── .gitignore
└── README.md
```

## 16. AI Model Information

The AI service uses `ultralytics.YOLO` and loads the file configured by `AI_MODEL_PATH`. The training script starts from `yolo11n.pt` and trains against `ai-model/dataset/data.yaml` for the five classes listed above.

The runtime model must be compatible with those five class names. Model weights (`*.pt`) are intentionally ignored by Git, so a new checkout must receive a compatible weights file separately.

The AI service defaults to CPU inference. Set `CUDA_VISIBLE_DEVICES` in the process environment when CUDA inference is available.

## 17. Product Catalog

The backend seed script creates these products:

| Product | SKU | Initial stock | Minimum stock | Location |
| --- | --- | ---: | ---: | --- |
| Drill | `DRL001` | 10 | 3 | Rack A - Shelf 01 |
| Hammer | `HAM001` | 20 | 5 | Rack A - Shelf 02 |
| Pliers | `PLR001` | 15 | 5 | Rack B - Shelf 01 |
| Screwdriver | `SCR001` | 25 | 5 | Rack B - Shelf 02 |
| Wrench | `WRC001` | 15 | 5 | Rack C - Shelf 01 |

Run the seed script only when you intentionally want to clear existing products and stock movements and recreate the five seed products.

## 18. Actual API Endpoints

### Backend: `http://localhost:5000`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | Backend health response |
| GET | `/api/products` | List products |
| POST | `/api/products` | Create a product |
| GET | `/api/products/dashboard` | Dashboard metrics and recent movements |
| PATCH | `/api/products/:id/receive` | Add stock and record a receive movement |
| PATCH | `/api/products/:id/dispatch` | Deduct stock and record a dispatch movement |
| POST | `/api/products/dispatch/transaction` | Transactionally dispatch multiple products |
| GET | `/api/products/movements/history` | List stock movements |
| POST | `/api/orders` | Create an order |
| GET | `/api/orders` | List orders, optionally filtered by status |
| GET | `/api/orders/payments/history` | List all payments |
| GET | `/api/orders/:id` | Get one order with payments |
| GET | `/api/orders/:id/payments` | List payments for an order |
| POST | `/api/orders/:id/payments` | Record a payment |
| PATCH | `/api/orders/:id/pack` | Move an eligible order to packed |
| PATCH | `/api/orders/:id/confirm-payment` | Confirm an eligible advance |
| PATCH | `/api/orders/:id/start-packing` | Move an advance-received order to packed |
| PATCH | `/api/orders/:id/complete-packing` | Move an advance-received order to packed |
| PATCH | `/api/orders/:id/ready` | Keep a packed order packed |
| PATCH | `/api/orders/:id/ready-for-dispatch` | Keep a packed order packed |
| PATCH | `/api/orders/:id/cancel` | Cancel an order |
| PATCH | `/api/orders/:id/dispatch` | Fully paid packed order dispatch |

### AI service: `http://127.0.0.1:8001`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | AI service health, model path, threshold, and scan region |
| POST | `/predict` | Upload an image in form field `file` and receive accepted detections |

## 19. Complete New Device Setup

These instructions assume a new Windows computer and a PowerShell terminal. Run each service in its own terminal.

### Prerequisites

Install:

- Git.
- Node.js with npm. Use a current LTS release.
- Python 3 with `pip`.
- MongoDB Community Server running locally, or a MongoDB Atlas database.
- A modern browser with camera support.
- A compatible YOLO weights file trained with the five current class names.

### 1. Clone the repository

**Terminal 1 — setup:**

```powershell
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd AI-Warehouse-System
```

### 2. Install frontend dependencies

**Terminal 1 — setup:**

```powershell
cd frontend\warehouse-system
npm install
Copy-Item .env.example .env
```

### 3. Install backend dependencies

**Terminal 1 — setup:**

```powershell
cd ..\..\backend
npm install
Copy-Item .env.example .env
```

### 4. Configure environment variables

Edit the three `.env` files using the safe templates shown in [Environment Variables](#20-environment-variables). Do not commit `.env` files.

### 5. Configure MongoDB

Start MongoDB Community Server, or create a MongoDB Atlas deployment and copy its connection string into `backend\.env` as `MONGO_URI`.

Then, from **Terminal 1 — setup**, seed the catalog if this is a new database:

```powershell
node src\seed.js
```

### 6. Create the Python virtual environment

**Terminal 2 — AI service:**

```powershell
cd <clone-folder>\AI-Warehouse-System\ai-model
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If `py` is not available, use `python -m venv .venv`.

### 7. Install AI dependencies

**Terminal 2 — AI service, with `.venv` active:**

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

### 8. Configure the YOLO model

Place a compatible weights file on the computer and set `AI_MODEL_PATH` in `ai-model\.env`. For a weights file placed directly in `ai-model`, a safe Windows example is:

```text
AI_MODEL_PATH=.\best.pt
```

Use the actual local filename. The file must expose the classes `drill`, `hammer`, `pliers`, `screwdriver`, and `wrench`. Do not place real credentials in any environment file.

### 9. Start the FastAPI AI service

**Terminal 2 — AI service:**

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn api:app --host 127.0.0.1 --port 8001
```

The health URL is `http://127.0.0.1:8001/`.

### 10. Start the Node/Express backend

**Terminal 3 — backend:**

```powershell
cd <clone-folder>\AI-Warehouse-System\backend
npm run dev
```

The backend URL is `http://localhost:5000/`.

### 11. Start the React/Vite frontend

**Terminal 4 — frontend:**

```powershell
cd <clone-folder>\AI-Warehouse-System\frontend\warehouse-system
npm run dev
```

Vite serves the frontend at `http://localhost:5173/` by default.

### 12. Open the application

Open `http://localhost:5173/` in the browser. Allow camera access when using Receive or Dispatch. Keep all three service terminals running while using the application.

## 20. Environment Variables

### `backend/.env`

```text
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/nexus_wms
```

`MONGO_URI` may instead be a MongoDB Atlas connection string with placeholder credentials, for example `mongodb+srv://<user>:<password>@<cluster>/<database>`. Replace placeholders locally and never commit the result.

### `frontend/warehouse-system/.env`

```text
VITE_API_URL=http://localhost:5000/api
VITE_AI_API_URL=http://127.0.0.1:8001
```

The frontend uses `VITE_API_URL` for Express and `VITE_AI_API_URL` (falling back to `VITE_AI_URL`) for FastAPI.

### `ai-model/.env`

```text
AI_MODEL_PATH=.\best.pt
AI_CONFIDENCE=0.70
AI_DEBUG_DETECTIONS=false
AI_SCAN_X_MIN=0.20
AI_SCAN_X_MAX=0.80
AI_SCAN_Y_MIN=0.15
AI_SCAN_Y_MAX=0.85
AI_MIN_BOX_WIDTH_RATIO=0.05
AI_MIN_BOX_HEIGHT_RATIO=0.05
AI_MIN_BOX_AREA_RATIO=0.01
AI_MAX_BOX_AREA_RATIO=0.80
```

`AI_MODEL_PATH` is required for predictions. The remaining AI variables control confidence, optional debug output, scan region, and accepted bounding-box dimensions.

## 21. How to Run the Project

After completing setup, use these commands:

| Terminal | Directory | Command |
| --- | --- | --- |
| 2 | `ai-model` | `.\.venv\Scripts\Activate.ps1; uvicorn api:app --host 127.0.0.1 --port 8001` |
| 3 | `backend` | `npm run dev` |
| 4 | `frontend\warehouse-system` | `npm run dev` |

For a production-style local start, the backend also provides `npm start`. The frontend provides `npm run build` and `npm run preview`.

Useful checks:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/
Invoke-RestMethod http://localhost:5000/
```

## 22. Basic Usage

1. Open the frontend.
2. Use **Dashboard** to review warehouse totals and low-stock status.
3. Use **Receive** to scan supported incoming tools and add stock.
4. Use **Dispatch** to scan or manually add products, enter client details, and create an order.
5. Use **Orders** to record payments, pack eligible orders, and dispatch fully paid orders.
6. Use the invoice preview to review or print billing information.
7. Use **Inventory** to search products and review locations and stock.
8. Use **Stock history** to audit receive and dispatch movements.

## 23. Future Improvements

Potential future improvements include authentication and role-based access, multi-warehouse support, supplier management, richer analytics, expanded model training data, cloud deployment, barcode/QR integration, and persistent invoice/export management.

## 24. License / Project Notes

No root license file is currently included in the repository. The dataset metadata identifies the Roboflow Mechanical Tools dataset as **CC BY 4.0**. Review and preserve the applicable dataset attribution when redistributing or retraining from that dataset.
