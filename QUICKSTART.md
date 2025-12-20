# 🚀 Quick Start Guide

Get the Daily Quotes Traffic Simulator running in 5 minutes!

## Prerequisites

- ✅ Node.js 20.x or higher
- ✅ npm or yarn
- ✅ Paid proxy credentials
- ✅ Your deployed quotes website URL

---

## Step-by-Step Setup

### 1️⃣ Install Dependencies
```bash
npm install
```

Expected output:
```
added 156 packages in 23s
```

### 2️⃣ Create Configuration Files
```bash
# Copy example files
cp config/proxies.example.json config/proxies.json
cp config/users.example.json config/users.json
cp .env.example .env
```

### 3️⃣ Configure Your Proxies

Edit `config/proxies.json` with your REAL proxy credentials:
```json
[
  {
    "ip": "YOUR_PROXY_IP",
    "port": YOUR_PROXY_PORT,
    "username": "YOUR_PROXY_USERNAME",
    "password": "YOUR_PROXY_PASSWORD",
    "city": "Karachi",
    "state": "Sindh",
    "zip": "75500"
  }
  // Add more proxies...
]
```

**Where to get this info?**
- Check your proxy provider's dashboard
- Most providers give you a list in CSV or JSON format
- You need at least 5 proxies for 5 concurrent users

### 4️⃣ Configure Users (Optional)

Edit `config/users.json` or keep the example data:
```json
[
  {
    "email": "user1@example.com",
    "username": "user1",
    "zip": "75500",
    "city": "Karachi"
  }
  // Add more users...
]
```

**Note:** User data is just for simulation. Fake profiles are fine!

### 5️⃣ Update Website URL

Edit `.env` file:
```bash
TARGET_URL=https://your-actual-quotes-website.vercel.app
```

### 6️⃣ Configure Simulation Settings

In `.env`, adjust these based on your needs:
```bash
# How many users to simulate at once
CONCURRENT_USERS=5

# See browsers in action (for debugging)
HEADLESS=false

# Time spent on each page
MIN_TIME_ON_PAGE=10
MAX_TIME_ON_PAGE=45
```

### 7️⃣ Build and Run
```bash
# Build TypeScript
npm run build

# Run simulation
npm start
```

**OR** run in development mode:
```bash
npm run dev
```

---

## Expected Output

When running successfully, you'll see:
```
============================================================
DAILY QUOTES TRAFFIC SIMULATOR
============================================================

📁 Loading configuration files...
✓ Loaded 5 proxies
✓ Loaded 15 users
✓ Loaded 6 device configurations

👥 Creating 5 session configurations...
✓ Created 5 valid sessions

Session Preview:
  1. ahmed_ali -> Karachi (192.168.1.100) -> windows desktop
  2. fatima_k -> Lahore (192.168.1.101) -> macos desktop
  3. hassan_r -> Islamabad (192.168.1.102) -> android mobile
  4. ayesha_m -> Karachi (192.168.1.103) -> ios mobile
  5. bilal_a -> Multan (192.168.1.104) -> linux desktop

============================================================
🚀 Starting simulation...
============================================================

✓ Session 1/5 for ahmed_ali
✓ Session 2/5 for fatima_k
✓ Session 3/5 for hassan_r
✓ Session 4/5 for ayesha_m
✓ Session 5/5 for bilal_a

============================================================
SIMULATION SUMMARY
============================================================
- Active Sessions: 0
- Completed Sessions: 5
- Success Rate: 100%
- Average Duration: 34.5s
- Total Pages Visited: 12
- Uptime: 45.2s
============================================================

✅ Simulation completed successfully!

📊 Check logs at: ./logs
```

---

## Viewing Logs

All activity is logged in the `logs/` directory:
```bash
logs/
├── combined.log    # All logs
├── error.log       # Errors only
└── metrics.log     # Performance data
```

View logs:
```bash
# See latest activity
tail -f logs/combined.log

# See only errors
tail -f logs/error.log

# See metrics
cat logs/metrics.log | grep "metrics"
```

---

## Troubleshooting

### ❌ "No available proxies"
**Solution:** Check that `config/proxies.json` exists and has valid data

### ❌ "Proxy connection failed"
**Solution:** Verify proxy credentials with your provider

### ❌ "Page timeout"
**Solution:** Increase `BROWSER_TIMEOUT` in `.env`

### ❌ "Session failed"
**Solution:** 
- Set `HEADLESS=false` to see what's happening
- Check `logs/error.log` for details
- Ensure your TARGET_URL is correct

### ❌ Browser crashes
**Solution:** 
- Reduce `CONCURRENT_USERS` to 3
- Increase `BROWSER_MEMORY_LIMIT`
- Close other applications

---

## Scaling Up

### Running 10+ Concurrent Users

1. Ensure you have 10+ unique proxies
2. Update `.env`:
```bash
   CONCURRENT_USERS=10
```
3. Adjust resource limits:
```bash
   BROWSER_MEMORY_LIMIT=1024
```

### Running 24/7

Use a VPS and process manager:
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "traffic-sim" -- start

# Auto-restart on crash
pm2 startup
pm2 save
```

---

## Next Steps

✅ Run your first simulation  
✅ Check logs and verify traffic  
✅ Visit your website analytics  
✅ Adjust behavior settings  
✅ Scale up to more users  

**Need help?** Check the main README.md for detailed documentation.

---

**Happy Simulating! 🎉**