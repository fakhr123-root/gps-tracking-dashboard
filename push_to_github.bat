@echo off
title Push Project to GitHub
cd /d "C:\Users\Owner\.gemini\antigravity\scratch\google_maps_3d_extractor"
echo ======================================================================
echo Uploading Google Maps 3D Extractor + Admin Panel to GitHub...
echo (If a GitHub sign-in window opens, click "Sign in with your browser")
echo ======================================================================
echo.
git add .
git commit -m "Update project files for Render"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/fakhr123-root/gps-tracking-dashboard.git
git push -u origin main --force
echo.
echo ======================================================================
echo DONE! Now go to Render and click Deploy.
echo ======================================================================
pause
