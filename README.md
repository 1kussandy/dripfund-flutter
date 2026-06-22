<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/74a1ca8a-fd7c-47fc-89f3-a1043353844d

## Run Locally

**Prerequisites:**  Node.js & PostgreSQL (optional, fallback JSON mode is used automatically if unavailable)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a file named `.env` in the root of the project (copying from `.env.example`) and configure your PostgreSQL database:

```env
GEMINI_API_KEY=your_key_here
DB_HOST=localhost
DB_PORT=5432
DB_USER=sandip
DB_PASSWORD=
DB_NAME=control_tower
```

### 3. Setup Your Local PostgreSQL Database
If you configured a database name (e.g. `control_tower`), make sure you create it first in PostgreSQL before booting the server:

```bash
# Connect to your local psql server
psql -U sandip -d postgres

# Create the database (if it doesn't exist yet)
CREATE DATABASE control_tower;

# Quit the psql shell
\q
```

The server will automatically bootstrap and map all required SQL schemas (`settings`, `departments`, `lines`, `stations`, `associates`, `permissions`, etc.) on its very first start!

### 4. Run the App
```bash
npm run dev
```

---

## Testing Your Setup

To test both performance and concurrency resilience:

1. With the dev server running, open another terminal window.
2. Run the included concurrency pre-check loader:
   ```bash
   node test-concurrency.js
   ```
3. This script will concurrently simulate:
   - **30 Managers** refreshing real-time status feeds
   - **200 Associate scans** firing at a rapid pace of 50 scans/second
4. If it prints `✅ PERFORMANCE CHECK PASSED!` on your terminal, your local PostgreSQL setup handles high-throughput operations perfectly.

---

## Port Warnings ( বেনামী / Vite WebSocket Port Info )
If you see the warning:
`WebSocket server error: Port 24678 is already in use`
This is a standard warning from Vite indicating another local server is using that hot-reload channel. It is **completely harmless** and has no effect on your main application or PostgreSQL connection.
