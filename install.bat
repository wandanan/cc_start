@echo off
setlocal EnableDelayedExpansion

echo.
echo ===================================
echo    CC Start Installer
echo ===================================
echo.

:: Check if cc file exists in current directory
if not exist "%~dp0cc" (
    echo [ERROR] cc script not found
    echo Please ensure install.bat and cc are in the same directory
    pause
    exit /b 1
)

:: Set installation directory
set "INSTALL_DIR=%USERPROFILE%\.local\bin"

echo Install directory: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%" 2>nul
    if errorlevel 1 (
        echo [ERROR] Failed to create install directory
        pause
        exit /b 1
    )
)

:: Check if already installed
set "SKIP_SCRIPTS=0"
if exist "%INSTALL_DIR%\cc.cmd" (
    echo.
    echo [INFO] CC Start is already installed
    set /p confirm="Overwrite scripts? (y/N): "
    if /i not "!confirm!"=="y" (
        echo [INFO] Keeping existing scripts
        set "SKIP_SCRIPTS=1"
    )
)

:: Copy scripts
if "%SKIP_SCRIPTS%"=="1" (
    echo.
    echo [SKIP] Script copy skipped
) else (
    echo.
    echo Copying files...
    copy /Y "%~dp0cc" "%INSTALL_DIR%\cc" >nul
    if errorlevel 1 (
        echo [ERROR] Failed to copy cc
        pause
        exit /b 1
    )
    copy /Y "%~dp0cc.cmd" "%INSTALL_DIR%\cc.cmd" >nul
    if errorlevel 1 (
        echo [ERROR] Failed to copy cc.cmd
        pause
        exit /b 1
    )
    :: Create ccs copy - both cc and ccs are supported
    copy /Y "%~dp0cc" "%INSTALL_DIR%\ccs" >nul
    copy /Y "%~dp0ccs.cmd" "%INSTALL_DIR%\ccs.cmd" >nul
    echo [OK] Scripts installed
    echo [OK] Commands available: 'cc' and 'ccs'
)

:: Create config directory
if not exist "%USERPROFILE%\.claude\models" (
    mkdir "%USERPROFILE%\.claude\models" 2>nul
)
echo [OK] Config directory created

:: Copy model configs
echo.
echo Copying model configs...
if exist "%~dp0models" (
    set "CONFIG_DIR=%USERPROFILE%\.claude\models"
    for %%f in ("%~dp0models\*.json") do (
        set "filename=%%~nxf"
        if exist "!CONFIG_DIR!\!filename!" (
            echo.
            echo [INFO] Config file exists: !filename!
            set /p overwrite="Overwrite? (y/N): "
            if /i "!overwrite!"=="y" (
                copy /Y "%%f" "!CONFIG_DIR!\" >nul
                echo [OK] Overwritten: !filename!
            ) else (
                echo [SKIP] Kept original: !filename!
            )
        ) else (
            copy "%%f" "!CONFIG_DIR!\" >nul
            echo [OK] Copied: !filename!
        )
    )
)

:: Check PATH
echo.
echo Checking PATH...
echo %PATH% | find /i "%INSTALL_DIR%" >nul
if errorlevel 1 (
    echo.
    echo [INFO] Adding to user PATH...

    for /f "tokens=2*" %%a in ('reg query HKCU\Environment /v Path 2^>nul ^| findstr Path') do set "USER_PATH=%%b"

    if defined USER_PATH (
        setx PATH "!USER_PATH!;!INSTALL_DIR!" >nul 2>&1
    ) else (
        setx PATH "!INSTALL_DIR!" >nul 2>&1
    )

    if errorlevel 1 (
        echo [WARN] Failed to add PATH, please add manually: %INSTALL_DIR%
    ) else (
        echo [OK] PATH updated
    )
    echo.
    echo [IMPORTANT] Please reopen terminal to use cc/ccs commands
) else (
    echo [OK] PATH check passed
)

:: Finish
echo.
echo ===================================
echo    Installation Complete!
echo ===================================
echo.
echo Usage:
echo   cc/ccs              - Interactive model selection
echo   cc/ccs ^<model^>     - Start specified model
echo   cc/ccs add          - Add new model config
echo   cc/ccs remove ^<model^> - Remove model config
echo   cc/ccs reset        - Reset all configs
echo.
echo Note: Both 'cc' and 'ccs' commands are supported
echo.
echo Config files location:
echo   %%USERPROFILE%%\.claude\models\
echo.
echo [IMPORTANT] Please reopen terminal, then run "cc add" or "ccs add" to add model config
echo.
pause
