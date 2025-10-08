@echo off
REM update-cache-version.bat
REM Windows batch script to update cache busting versions

REM Generate new version (current timestamp)
for /f "tokens=2 delims==" %%i in ('wmic os get localdatetime /value') do set dt=%%i
set NEW_VERSION=%dt:~0,12%

echo 🔄 Updating cache busting version to: %NEW_VERSION%

REM Update all HTML files using PowerShell
powershell -Command "(Get-ChildItem -Recurse -Filter '*.html') | ForEach-Object { (Get-Content $_.FullName) -replace '\?v=[^\"'']*', '?v=%NEW_VERSION%' | Set-Content $_.FullName }"

echo ✅ Updated cache busting parameters in all HTML files
echo.
echo 🚀 Ready to commit and push to GitHub Pages!
echo    git add .
echo    git commit -m "Update cache busting version to %NEW_VERSION%"
echo    git push origin main

pause