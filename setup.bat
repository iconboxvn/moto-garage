@echo off
echo ================================
echo   MOTO GARAGE - Android Setup
echo ================================
echo.

echo [1/5] Installing packages...
call npm install
if %errorlevel% neq 0 (
  echo ERROR: npm install failed
  pause
  exit /b 1
)
echo     Done!
echo.

echo [2/5] Creating www folder...
if not exist "www" mkdir www
echo     Done!
echo.

echo [3/5] Copying HTML files...
copy index.html www\index.html
copy index_en.html www\index_en.html
copy index_vn.html www\index_vn.html
if exist sw.js copy sw.js www\sw.js
if exist manifest.json copy manifest.json www\manifest.json
if exist icons xcopy icons www\icons /E /I /Y
echo     Done!
echo.

echo [4/5] Adding Android platform...
call npx cap add android
if %errorlevel% neq 0 (
  echo ERROR: Failed to add Android platform
  pause
  exit /b 1
)
echo     Done!
echo.

echo [5/5] Syncing files...
call npx cap sync android
echo     Done!
echo.

echo ================================
echo   Setup complete!
echo   Next: npx cap open android
echo ================================
pause
