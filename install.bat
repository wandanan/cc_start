@echo off
setlocal EnableDelayedExpansion

echo.
echo ===================================
echo    CC Start Installer
echo ===================================
echo.

:: Check Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo [WARN] Node.js not found, please install manually.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%a in ('node -v') do echo [OK] Node.js: %%a

:: Check Claude Code
where claude >nul 2>&1
if errorlevel 1 (
    echo [WARN] Claude Code not found, installing...
    call npm install -g @anthropic-ai/claude-code
    if errorlevel 1 (
        echo [ERROR] Failed to install Claude Code
        pause
        exit /b 1
    )
    echo [OK] Claude Code installed
) else (
    echo [OK] Claude Code found
)

:: Set installation directory
set "INSTALL_DIR=%USERPROFILE%\.local\bin"

if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%" 2>nul
    if errorlevel 1 (
        echo [ERROR] Failed to create install directory
        pause
        exit /b 1
    )
)

:: Copy scripts
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

if "%SKIP_SCRIPTS%"=="1" (
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
    copy /Y "%~dp0cc" "%INSTALL_DIR%\ccs" >nul
    copy /Y "%~dp0ccs.cmd" "%INSTALL_DIR%\ccs.cmd" >nul
    copy /Y "%~dp0init.ps1" "%INSTALL_DIR%\init.ps1" >nul
    echo [OK] Scripts installed
    echo [OK] Commands available: cc and ccs
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
            echo [SKIP] Config exists: !filename!
        ) else (
            copy "%%f" "!CONFIG_DIR!\" >nul
            echo [OK] Copied: !filename!
        )
    )
)

:: Check and fix skipWebFetchPreflight in existing configs
echo.
echo Checking WebFetch preflight config...
powershell.exe -NoProfile -Command "$cfgDir=Join-Path $env:USERPROFILE '.claude\models'; if(Test-Path $cfgDir){ $c=0; ls $cfgDir\*.json -ea 0|ForEach-Object{ $t=[IO.File]::ReadAllText($_.FullName); if($t.Contains('skipWebFetchPreflight')){ Write-Host ('[OK] Already ok: '+$_.Name) }else{ $t=$t.TrimEnd() -replace '\}\s*$', ([char]44+[char]10+'  '+[char]34+'skipWebFetchPreflight'+[char]34+': true'+[char]10+'}'); [IO.File]::WriteAllText($_.FullName,$t); Write-Host ('[OK] Updated: '+$_.Name); $c++ }}; if($c -eq 0){ Write-Host '[INFO] All configs already have skipWebFetchPreflight' } } else { Write-Host '[INFO] No existing configs to check' }"

:: Update PATH
echo.
echo [INFO] Updating PATH...
powershell.exe -NoProfile -Command "$d='%INSTALL_DIR%'; $p=[Environment]::GetEnvironmentVariable('Path','User'); $clean=$p -split ';' | Where-Object{$_ -ne '' -and $_ -ne $d}; $new=@($d)+@($clean) -join ';'; [Environment]::SetEnvironmentVariable('Path',$new,'User'); Write-Host '[OK] PATH updated'; Write-Host '[IMPORTANT] Please reopen terminal to use cc/ccs'"

:: Finish
echo.
echo ===================================
echo    Installation Complete!
echo ===================================
echo.
echo Usage:
echo   cc / ccs              - Interactive model selection
echo   cc / ccs ^<model^>     - Start specified model
echo   cc / ccs add          - Add new model config
echo   cc / ccs remove       - Remove model config
echo   cc / ccs reset        - Reset all configs
echo.
echo Config files location:
echo   %%USERPROFILE%%\.claude\models\
echo.
echo [IMPORTANT] Please run "cc add" or "ccs add" to add model config
echo.
pause
