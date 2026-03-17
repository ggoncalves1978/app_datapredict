@echo off
echo Starting git... > git_output.txt
git add . >> git_output.txt 2>&1
git commit -m "Fix: Replace hardcoded localhost API URL with central config and VITE_API_URL" >> git_output.txt 2>&1
git push origin main >> git_output.txt 2>&1
echo Done! >> git_output.txt
