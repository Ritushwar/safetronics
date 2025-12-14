# SafeTronics Dashboard (`4_dashboard`)

This folder contains the Node.js/Express backend and frontend for the SafeTronics real-time worker safety dashboard. It provides APIs, WebSocket support, and a web UI for monitoring worker health, alerts, and history.

## Features
- REST API and WebSocket server for real-time updates
- MySQL/MariaDB database integration via Sequelize ORM
- Modular code: separate folders for models, functions, and config
- Responsive dashboard UI (HTML/CSS/JS in `public/`)
- Scripts for data population and testing

## Folder Structure
```
4_dashboard/
├── package.json              # Project manifest (dependencies, scripts)
├── package-lock.json         # Exact dependency versions
├── scripts/                  # Data population and utility scripts
├── src/                      # Main backend source code
│   ├── index.js              # Entry point (Express + Socket.io server)
│   ├── config/               # Database config
│   ├── functions/            # Business logic (alerts, health, measurements, workers)
│   └── models/               # Sequelize models (tables)
├── public/                   # Frontend (static files)
│   ├── index.html            # Dashboard UI
│   ├── css/                  # Stylesheets
│   └── js/                   # Client-side JS (app logic, socket)
└── README.md                 # This file
```

## Prerequisites
- Node.js v18+ and npm
- MySQL or MariaDB server (local or remote)
- (Optional) Python backend for BLE data ingestion

## Setup & Run
1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd safetronics/4_dashboard
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure database:**
   - Create a `.env` file in `4_dashboard/` or `src/` with:
     ```ini
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=
     DB_NAME=safetronics
     PORT=3000
     ```
   - Import the provided SQL schema if needed.
4. **Start the server:**
   ```bash
   npm start
   # or for auto-reload during development:
   npm run dev
   ```
5. **Open the dashboard:**
   - Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Usage
- The dashboard will show real-time worker vitals, alerts, and history.
- Data is updated via WebSocket (see `public/js/socket.js`).
- Use the scripts in `scripts/` to populate or sync data for testing.

## Customization
- Edit `src/config/db.config.js` for advanced DB settings.
- Add/modify models in `src/models/` to match your schema.
- Extend business logic in `src/functions/` as needed.
- Update frontend in `public/` for UI changes.

## Troubleshooting
- Ensure MySQL/MariaDB is running and accessible.
- Check `.env` for correct DB credentials.
- Use `npm run dev` for verbose error output.
- If you change models, run migrations or sync scripts as needed.

## License
MIT

---
Last updated: 2025-12-14
