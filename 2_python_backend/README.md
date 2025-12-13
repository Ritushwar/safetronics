# SafeTronics — Python Backend (BLE + Processing)

This folder contains the Python backend used by the SafeTronics project. It is responsible for:

- Connecting to the ESP32 over BLE and receiving notifications
- Pre-processing and enriching incoming sensor data
- Running the risk-prediction model
- Pushing measurements and alerts into the MySQL dashboard database

This README describes the files, dependencies, how to run the backend, expected database schema, and troubleshooting tips.

## Contents

Files in this folder and a short description of each:

- `connect.py` — BLE communication helper. Implements `BLEClient` that connects to the ESP32 and listens for notifications, decoding JSON payloads and forwarding them into a thread-safe queue.
- `required.py` — Shared imports and small bootstrap (asyncio, bleak client import, threading, queue, warnings filter). Many modules import from here to avoid repeating imports.
- `processor.py` — `DataProcessor` thread class. Consumes payloads from the queue, runs business logic: detect fall/SOS, fetch worker info, call prediction, push alerts and measurements to DB.
- `predict_from_data.py` — Loads the trained neural network (PyTorch) and a scaler (joblib). Converts incoming data into the model input, returns a dict with `worker_ID`, `probability` and `prediction` (0/1).
- `push_to_measurements.py` — Inserts measurement rows into the MySQL `measurements` table (fields used: `worker_id`, `body_temp`, `pulse_rate`, `spo2`, `hrv`, `prediction`, `probability`, `createdAt`, `updatedAt`).
- `push_alerts.py` — Inserts alerts into the `alerts` table (fields used: `worker_id`, `acknowledged`, `type`, `createdAt`, `updatedAt`).
- `fetch_worker_info.py` — Retrieves additional worker information from the `workers` table (used for model features such as age, gender, weight, height, BMI, etc.).
- `main.py` — Simple entrypoint that wires the queue, starts the `DataProcessor` thread and then runs the BLE listener (`BLEClient`) with `asyncio`.
- `health_history.py` — (utility) functions to read/prepare historical data (used elsewhere in the project). Review file for concrete functions.
- `README.md` — (this file) documentation for this folder.

There is also a `__pycache__/` directory containing compiled bytecode.

## Expected Database Schema (summary)

The backend expects a MySQL database named `safetronics` with at least these tables (column names used by the Python code):

- `workers` — used by `fetch_worker_info.py` to get worker metadata (id, age, gender, weight, height, bmi, etc.). Query example: `SELECT * FROM workers WHERE id = %s`.
- `measurements` — used by `push_to_measurements.py`.
	- Expected columns: `worker_id`, `body_temp`, `pulse_rate`, `spo2`, `hrv`, `prediction`, `probability`, `createdAt`, `updatedAt`.
- `alerts` — used by `push_alerts.py`.
	- Expected columns: `worker_id`, `acknowledged` (or `ack`), `type`, `createdAt`, `updatedAt`.

If you imported the SQL dump in the repository (`safetronics.sql` / `safetronics.sql` under the A_Dashboard folder) the tables/columns should already match. Otherwise adapt the INSERT queries in `push_to_measurements.py` and `push_alerts.py` to match your schema.

## Dependencies

The code uses the following Python packages (create a venv and install these):

- Python 3.10+ (3.11 recommended)
- bleak — BLE communication
- mysql-connector-python — MySQL client used by push modules and fetch
- torch (PyTorch) — model inference (ensure correct CUDA/CPU wheel for your environment)
- scikit-learn — scaler / auxiliary utilities
- joblib — load saved scaler
- numpy, pandas — numeric utilities

Suggested quick install (in a virtual environment):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install bleak mysql-connector-python torch scikit-learn joblib numpy pandas
```

Note: PyTorch installation is platform-dependent — see https://pytorch.org/ for the correct pip/conda command for your system (CPU vs CUDA).

## Configuration

- BLE MAC and characteristic UUID: open `main.py` and set `ESP32_MAC` and `CHAR_UUID` accordingly.
- Model and scaler paths: `predict_from_data.py` currently references the model and scaler at:
	- `/home/ritu/safetronics/Neural Model/NeuralModel.pth`
	- `/home/ritu/safetronics/Neural Model/Neural_Scaler.joblib`

	Update these paths if your models are stored in a different location.

- Database connection: `push_to_measurements.py`, `push_alerts.py` and `fetch_worker_info.py` each open MySQL connections with `host="localhost", user="root", password="", database="safetronics"`. Change these connection parameters if your database uses different credentials.

## How to run (development)

1. Create and activate a virtual environment and install dependencies as shown above.
2. (Optional) Verify the model/scaler paths are correct and that the database is available.
3. Start the backend:

```bash
cd 2_python_backend
source .venv/bin/activate   # if using venv
python main.py
```

`main.py` will start the `DataProcessor` thread and then connect to the BLE device. Incoming BLE notification payloads (expected as JSON) are consumed and processed.

## Testing without BLE

If you don't have the physical ESP32 available you can still test the processing flow by pushing a sample payload into the queue. Example quick test snippet to drop into a Python REPL or a small script:

```python
from required import *
from processor import DataProcessor
import queue

q = queue.Queue()
proc = DataProcessor(q)
proc.start()

sample = {
		"ID": 1,
		"heartRate": 78,
		"bodyTemp": 36.8,
		"spo2": 97,
		"mpuStatus": "OK",
		"sosStatus": "OK"
}

q.put(sample)
```

This will walk the payload through `DataProcessor` and (if configured) insert to the database.

## Notes & Troubleshooting

- BLE: ensure BlueZ and system BLE support are available on Linux. Run `bluetoothctl` to check adapter status. `bleak` may require extra system packages on some platforms.
- Permissions: On Linux, you might need to run BLE code as root or give appropriate capabilities to the Python interpreter.
- Database errors: confirm MySQL/MariaDB is running and the `safetronics` database exists. If push functions fail, check exception output — common causes are mismatched column names or missing tables.
- Model inference: make sure the scaler and model are compatible (same features/order). The model expects the same preprocessing used during training.

## Extending / Integration

- If you want to forward measurements to the Node.js dashboard instead of writing directly to MySQL, create an HTTP endpoint on the dashboard and call it from the Python code (e.g. `requests.post(...)`) in place of `push_to_measurements`.
- To persist the BLE connection across reads (connect once, read many), see the `connect.py` BLEClient implementation which reconnects automatically. You can modify it to keep a persistent `BleakClient` instance and expose a safe read API.

## Contact / Next steps

If you'd like, I can:

- Add a `requirements.txt` file and a simple `start.sh` script to make launching easier.
- Replace direct DB inserts with an HTTP bridge to the Node.js dashboard server (recommended when the dashboard and backend are deployed on different machines).
- Add unit tests for preprocessing and a small CLI demo for offline testing.

---

Last updated: 2025-12-13

