@echo off
SETLOCAL EnableDelayedExpansion
echo Starting batch file...
echo.

REM Get script directory
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

echo Script directory: %SCRIPT_DIR%
echo.

REM Check Node.js
echo Checking Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found
    goto :end
)

echo Node.js version:
call node --version

echo.
echo npm version:
call npm --version

echo.
echo Versions displayed successfully
echo.
echo ========================================
echo Step 1: Install CLIENT dependencies
echo ========================================
echo.

REM Change to client directory
cd /d "%SCRIPT_DIR%\client"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Cannot access client directory
    goto :end
)

echo Current directory: %CD%
echo Running npm install...
echo.

call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install failed for client
    goto :end
)

echo.
echo Client dependencies installed!
echo.

REM Change to server directory
echo ========================================
echo Step 2: Install SERVER dependencies
echo ========================================
echo.

cd /d "%SCRIPT_DIR%\server"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Cannot access server directory
    goto :end
)

echo Current directory: %CD%
echo Running npm install...
echo.

call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install failed for server
    goto :end
)

echo.
echo Server dependencies installed!
echo.

REM Start applications
echo ========================================
echo Step 3: Starting applications
echo ========================================
echo.

echo Starting server...
start "HR Server" cmd /k "cd /d "%SCRIPT_DIR%\server" && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting client...
start "HR Client" cmd /k "cd /d "%SCRIPT_DIR%\client" && npm run dev"

echo.
echo ========================================
echo Applications started!
echo ========================================
echo.
echo Server: http://localhost:3000
echo Client: http://localhost:5173
echo.
echo Two windows have been opened.
echo.

:end
echo.
echo Press any key to close this window...
pause >nul
