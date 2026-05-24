@echo off
setlocal EnableDelayedExpansion
set "PS_CMD=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

echo.
echo ===================================
echo    CC Start Installer
echo ===================================
echo.

:: Check Node.js
set "NODE_OK=0"
node -v >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%a in ('node -v') do (
        echo [OK] Node.js: %%a
        set "NODE_OK=1"
    )
)

if "%NODE_OK%"=="0" (
    echo [WARN] Node.js not found, attempting auto-install...

    :: Try winget first
    where winget >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Installing Node.js LTS via winget...
        winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements >nul 2>&1
        if not errorlevel 1 (
            :: Prepend Node.js dir to PATH (do not replace entire PATH)
            if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;!PATH!"
            node -v >nul 2>&1
            if not errorlevel 1 (
                for /f "tokens=*" %%a in ('node -v') do echo [OK] Node.js: %%a (installed via winget)
                set "NODE_OK=1"
            )
        )
    )

    if "!NODE_OK!"=="0" (
        :: Fallback: download MSI via PowerShell
        echo [INFO] Trying direct download...
        set "NODE_MSI=%TEMP%\node-lts.msi"
        "!PS_CMD!" -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.2/node-v20.18.2-x64.msi' -OutFile $env:NODE_MSI -UseBasicParsing } catch { exit 1 }"
        if exist "!NODE_MSI!" (
            echo [INFO] Installing Node.js...
            msiexec /i "!NODE_MSI!" /qn /norestart >nul 2>&1
            if not errorlevel 1 (
                :: Prepend Node.js dir to PATH
                if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;!PATH!"
                node -v >nul 2>&1
                if not errorlevel 1 (
                    for /f "tokens=*" %%a in ('node -v') do echo [OK] Node.js: %%a (installed via MSI)
                    set "NODE_OK=1"
                )
            )
            del "!NODE_MSI!" >nul 2>&1
        )
    )

    if "!NODE_OK!"=="0" (
        echo [ERROR] Auto-install failed. Please install Node.js manually:
        echo         https://nodejs.org/
        pause
        exit /b 1
    )
)

:: Check Claude Code
set "CLAUDE_OK=0"
where claude >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%v in ('claude --version 2^>nul') do (
        if not "%%v"=="" (
            echo [OK] Claude Code: %%v
            set "CLAUDE_OK=1"
        )
    )
)
if "!CLAUDE_OK!"=="0" (
    echo [WARN] Claude Code not found, installing...
    call npm install -g @anthropic-ai/claude-code
    if errorlevel 1 (
        echo [ERROR] Failed to install Claude Code
        pause
        exit /b 1
    )
    :: Verify installation succeeded
    for /f "tokens=*" %%v in ('claude --version 2^>nul') do (
        if not "%%v"=="" (
            echo [OK] Claude Code: %%v
            set "CLAUDE_OK=1"
        )
    )
    if "!CLAUDE_OK!"=="0" (
        echo [ERROR] Claude Code installed but not working
        pause
        exit /b 1
    )
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
"!PS_CMD!" -NoProfile -Command "$cfgDir=Join-Path $env:USERPROFILE '.claude\models'; if(Test-Path $cfgDir){ $c=0; ls $cfgDir\*.json -ea 0|ForEach-Object{ $t=[IO.File]::ReadAllText($_.FullName); if($t.Contains('skipWebFetchPreflight')){ Write-Host ('[OK] Already ok: '+$_.Name) }else{ $t=$t.TrimEnd() -replace '\}\s*$', ([char]44+[char]10+'  '+[char]34+'skipWebFetchPreflight'+[char]34+': true'+[char]10+'}'); [IO.File]::WriteAllText($_.FullName,$t); Write-Host ('[OK] Updated: '+$_.Name); $c++ }}; if($c -eq 0){ Write-Host '[INFO] All configs already have skipWebFetchPreflight' } } else { Write-Host '[INFO] No existing configs to check' }"

:: Update PATH
echo.
echo [INFO] Updating PATH...
"!PS_CMD!" -NoProfile -Command "$d='%INSTALL_DIR%'; $p=[Environment]::GetEnvironmentVariable('Path','User'); $clean=$p -split ';' | Where-Object{$_ -ne '' -and $_ -ne $d}; $new=@($d)+@($clean) -join ';'; [Environment]::SetEnvironmentVariable('Path',$new,'User'); Write-Host '[OK] PATH updated'; Write-Host '[IMPORTANT] Please reopen terminal to use cc/ccs'"

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
