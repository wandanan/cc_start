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

:: Check PATH - 使用 PowerShell API 避免 setx 中文路径编码损坏
echo.
echo [INFO] Force updating PATH: removing old entry if exists, then re-registering...
powershell.exe -NoProfile -Command "$d='%INSTALL_DIR%'; $p=[Environment]::GetEnvironmentVariable('Path','User'); $clean=$p -split ';' | Where-Object{$_ -ne '' -and $_ -ne $d}; $new=@($d)+@($clean) -join ';'; [Environment]::SetEnvironmentVariable('Path',$new,'User'); Write-Host '[OK] PATH force updated: removed old entry if exists, then re-registered'; Write-Host '[IMPORTANT] Please reopen terminal to use cc/ccs commands'"

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
