# Git Setup Instructions

## Initial Setup (First Time Only)

### 1. Initialize Git Repository
```bash
# Navigate to your automation folder
cd automation

# Initialize git
git init

# Add all files (except those in .gitignore)
git add .

# First commit
git commit -m "Initial commit: Traffic simulator foundation setup"
```

### 2. Create Example Config Files
```bash
# Create example files (these will be committed)
cp config/proxies.json config/proxies.example.json
cp config/users.json config/users.example.json

# Clear sensitive data from example files manually
# Keep only the structure with dummy data
```

### 3. Connect to Remote Repository
```bash
# Add remote (GitHub/GitLab/Bitbucket)
git remote add origin <your-repository-url>

# Push to remote
git branch -M main
git push -u origin main
```

## Daily Workflow

### Before Starting Work
```bash
# Pull latest changes
git pull origin main
```

### After Making Changes
```bash
# Check what changed
git status

# Add specific files
git add src/config/loader.ts

# Or add all changes
git add .

# Commit with meaningful message
git commit -m "feat: Add proxy geo-matching logic"

# Push to remote
git push origin main
```

## Commit Message Conventions

Use semantic commit messages:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

**Examples:**
```bash
git commit -m "feat: Add device fingerprint rotation"
git commit -m "fix: Resolve proxy connection timeout"
git commit -m "docs: Update README with usage examples"
git commit -m "refactor: Improve session management logic"
```

## Branch Strategy (Optional - For Later)
```bash
# Create feature branch
git checkout -b feature/add-mobile-devices

# Work on feature...

# Merge back to main
git checkout main
git merge feature/add-mobile-devices

# Delete feature branch
git branch -d feature/add-mobile-devices
```

## Important Notes

⚠️ **Never commit:**
- `config/proxies.json` (contains real proxy credentials)
- `config/users.json` (contains real user data)
- `.env` files
- `logs/` directory

✅ **Always commit:**
- `*.example.json` files
- Source code (`src/`)
- Documentation
- Configuration templates

## Emergency: Remove Sensitive File from Git History

If you accidentally committed sensitive data:
```bash
# Remove file from git but keep locally
git rm --cached config/proxies.json

# Commit the removal
git commit -m "chore: Remove sensitive proxy config from git"

# Push
git push origin main
```

---

**Ready to start?** Run the commands in order and you're good to go! 🚀