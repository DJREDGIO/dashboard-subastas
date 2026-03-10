@echo off
echo ===================================================
echo   INICIANDO DASHBOARD DE GESTION TECNICA (v1.0)
echo ===================================================
echo.
echo Cargando sistema optimizado...
echo.

:: Navigate to the script's directory
cd /d "%~dp0"

:: Open the browser immediately (it will connect when server is ready)
start "" "http://localhost:3000"

:: Start the production serve
echo Servidor iniciado en puerto 3000.
echo NO CIERRES ESTA VENTANA mientras uses el tablero.
echo.
npm run preview -- --port 3000 --strictPort --host

pause
