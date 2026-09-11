# CodeAtlas AI

Map. Understand. Predict.

V1 supports **public GitHub repositories only**. Private repositories and GitHub OAuth are intentionally deferred.

## Current implementation
- React + TypeScript frontend scaffold
- FastAPI backend
- Public GitHub URL validation
- Repository cloning into a temporary workspace
- Basic repository scanner: files, LOC, languages
- REST endpoint for repository analysis

## Run locally

### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal.
