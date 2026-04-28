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

:: Check dependencies
echo.
echo Checking dependencies...

:: Check Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo [WARN] Node.js not found, attempting to install via winget...
    winget -v >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] winget not available, please install Node.js manually
        echo Download from: https://nodejs.org/
        pause
        exit /b 1
    )
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        echo [ERROR] Failed to install Node.js automatically
        echo Please install manually: https://nodejs.org/
        pause
        exit /b 1
    )
    echo [OK] Node.js installed

    :: Refresh PATH from registry so the current session can use node/npm
    for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul ^| find "PATH"') do set "SYS_PATH=%%b"
    for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul ^| find "PATH"') do set "USER_PATH=%%b"
    set "PATH=%SYS_PATH%;%USER_PATH%"

    :: Verify node is accessible after PATH refresh
    node -v >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Node.js installed but not available in current session
        echo This is a known Windows limitation. Please restart the terminal
        echo and re-run install.bat, or install Node.js manually from:
        echo https://nodejs.org/
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%a in ('node -v') do echo [OK] Node.js: %%a

:: Check Claude Code
:: 必须使用 CALL，否则调用 claude.cmd 会转移控制权且不返回
CALL claude --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [WARN] Claude Code not found, attempting to install via npm...
    call npm install -g @anthropic-ai/claude-code
    if errorlevel 1 (
        echo [ERROR] Failed to install Claude Code
        echo Please run manually: npm install -g @anthropic-ai/claude-code
        pause
        exit /b 1
    )
    echo [OK] Claude Code installed
) else (
    for /f "tokens=*" %%a in ('claude --version') do echo [OK] Claude Code: %%a
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
    copy /Y "%~dp0init.ps1" "%INSTALL_DIR%\init.ps1" >nul
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
echo All new terminal windows (CMD / PowerShell) can use cc/ccs directly.
echo.
echo For currently open terminals:
echo   CMD:     Reopen the window
echo   PowerShell: . "$env:USERPROFILE\.local\bin\init.ps1"
echo.
echo Without installation (current directory only):
echo   PowerShell: . .\init.ps1
echo.
echo Config files location:
echo   %%USERPROFILE%%\.claude\models\
echo.
echo [IMPORTANT] Please run "cc add" or "ccs add" to add model config
echo.
pause
