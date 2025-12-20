# Daily Quotes Traffic Simulator

> Professional traffic simulation system for testing and analytics using realistic user behaviors, geo-matched proxies, and diverse device fingerprints.

## 🎯 Purpose

This automation framework simulates realistic read traffic on the Daily Quotes website to:
- Test infrastructure under load
- Generate realistic analytics data
- Validate user experience across devices and locations
- Stress test Supabase database performance

## 🏗️ Architecture
```
automation/
├── src/
│   ├── types/           # TypeScript interfaces and type definitions
│   ├── config/          # Configuration loaders and validators
│   ├── core/            # Core simulation engine
│   ├── behaviors/       # User behavior patterns
│   ├── utils/           # Helper functions and utilities
│   └── index.ts         # Main entry point
├── config/
│   ├── proxies.example.json
│   ├── users.example.json
│   └── devices.json
├── logs/                # Session logs and metrics
└── dist/                # Compiled JavaScript (ignored by git)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x or higher
- npm or yarn
- TypeScript 5.x

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd automation

# Install dependencies
npm install

# Copy example configs
cp config/proxies.example.json config/proxies.json
cp config/users.example.json config/users.json

# Edit with your actual data
nano config/proxies.json
nano config/users.json
```

### Configuration

1. **Proxies** (`config/proxies.json`):
```json
[
  {
    "ip": "192.168.1.1",
    "port": 8080,
    "username": "proxy_user",
    "password": "proxy_pass",
    "city": "Karachi",
    "state": "Sindh",
    "zip": "75500"
  }
]
```

2. **Users** (`config/users.json`):
```json
[
  {
    "email": "user1@example.com",
    "username": "john_doe",
    "zip": "75500",
    "city": "Karachi"
  }
]
```

### Running the Simulator
```bash
# Development mode (with hot reload)
npm run dev

# Production build and run
npm run build
npm start

# Quick simulation
npm run simulate
```

## ⚙️ Configuration Options

The simulator supports various configuration parameters:

- **concurrentUsers**: Number of simultaneous users (default: 5)
- **targetUrl**: Your website URL
- **headless**: Run browser in headless mode (true/false)
- **defaultBehavior**: User behavior patterns (scroll depth, time on page, etc.)

## 📊 Features

- ✅ Geo-matched proxy rotation (user zip → proxy zip)
- ✅ Realistic device fingerprinting (Windows, macOS, Linux, iOS, Android)
- ✅ Human-like behavior patterns (scrolling, reading, clicking)
- ✅ Stealth mode (anti-bot detection)
- ✅ Comprehensive logging and metrics
- ✅ Scalable architecture (5 → 100+ concurrent users)

## 🔐 Security

- Never commit `config/proxies.json` or `config/users.json`
- Keep `.env` file out of version control
- Use example files for documentation only

## 📝 License

MIT License - Feel free to use for testing purposes

## 👥 Authors

- Makhdoom - Lead Developer
- [Your Friend's Name] - Co-Developer

## 🤝 Contributing

This is a private project for testing purposes. Contact the team before making changes.

---

**Status**: 🚧 In Development  
**Version**: 1.0.0  
**Last Updated**: December 2024