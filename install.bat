@echo off
setlocal EnableDelayedExpansion

chcp 936 >nul

echo.
echo ===================================
echo    CC Start Installer
echo ===================================
echo.

if not exist "%~dp0cc" (
    echo [ERROR] cc script not found
    echo Please ensure install.bat and cc are in the same folder
    pause
    exit /b 1
)

set "INSTALL_DIR=%USERPROFILE%\.local\bin"

echo Install dir: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%" 2>nul
    if errorlevel 1 (
        echo [ERROR] Cannot create install directory
        pause
        exit /b 1
    )
)

if exist "%INSTALL_DIR%\cc.cmd" (
    echo.
    echo [INFO] CC Start already installed
    set /p confirm="Overwrite? (y/N): "
    if /i not "!confirm!"=="y" (
        echo Cancelled
        pause
        exit /b 0
    )
)

echo.
echo Copying files...
copy /Y "%~dp0cc" "%INSTALL_DIR%\cc" >nul
if errorlevel 1 (
    echo [ERROR] Copy cc failed
    pause
    exit /b 1
)
copy /Y "%~dp0cc.cmd" "%INSTALL_DIR%\cc.cmd" >nul
if errorlevel 1 (
    echo [ERROR] Copy cc.cmd failed
    pause
    exit /b 1
)
echo [OK] Scripts installed

if not exist "%USERPROFILE%\.claude\models" (
    mkdir "%USERPROFILE%\.claude\models" 2>nul
)
echo [OK] Config dir created

echo.
echo Copying model configs...
if exist "%~dp0models" (
    copy /Y "%~dp0models\*.json" "%USERPROFILE%\.claude\models\" >nul 2>&1
    if not errorlevel 1 echo [OK] Model configs copied
)

echo.
echo Checking PATH...
echo %PATH% | find /i "%INSTALL_DIR%" >nul
if errorlevel 1 (
    echo.
    echo [INFO] Adding to PATH...

    for /f "tokens=2*" %%a in ('reg query HKCU\Environment /v Path 2^>nul ^| findstr Path') do set "USER_PATH=%%b"

    if defined USER_PATH (
        setx PATH "!USER_PATH!;!INSTALL_DIR!" >nul 2>&1
    ) else (
        setx PATH "!INSTALL_DIR!" >nul 2>&1
    )

    if errorlevel 1 (
        echo [WARN] Add PATH failed, please add manually: %INSTALL_DIR%
    ) else (
        echo [OK] PATH updated
    )
    echo.
    echo [IMPORTANT] Please restart terminal to use cc command
) else (
    echo [OK] PATH ok
)

echo.
echo ===================================
echo    Installation Complete!
echo ===================================
echo.
echo Usage:
echo   cc              - Interactive mode
echo   cc ^<model^>     - Start specific model
echo   cc add          - Add new model
echo.
echo Config location:
echo   %%USERPROFILE%%\.claude\models\
echo.
echo Please edit JSON files in above folder to add your API keys
echo.
pause
