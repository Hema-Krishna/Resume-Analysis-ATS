# AI-Powered Job Application Tracker with Resume Analysis
All files are in ONE folder. Needs Node 18+ and MongoDB (local, or a free Atlas URI in .env).

## Run in VS Code
1. File > Open Folder > select this folder.
2. Terminal (Ctrl+`):  npm install   then   npm run dev
3. Open http://localhost:5173

## Push to GitHub
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/job-application-tracker.git
git push -u origin main

## Deploy
Frontend (Vercel/Netlify): build command "npm run build", output "dist", env VITE_API_URL = backend URL.
Backend (Render/Railway): start command "npm run server", env MONGO_URI and JWT_SECRET.

Score = (matched + 0.5 x partial) / required skills x 100 (keyword indicator, not hiring probability).
