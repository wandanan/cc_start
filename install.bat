@echo off
setlocal EnableDelayedExpansion
set "PS_CMD=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set "NPM_REGISTRY=https://registry.npmmirror.com"
set "NPM_NO_PROXY=--proxy=false --https-proxy=false"

:: Do not let npm package installs inherit terminal proxy settings.
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "http_proxy="
set "https_proxy="
set "ALL_PROXY="
set "all_proxy="

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

:: Check Claude Code - npm global bin may not be in PATH, resolve via prefix
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
:: PATH check failed, try via npm prefix directly
if "!CLAUDE_OK!"=="0" (
    for /f "tokens=*" %%p in ('npm config get prefix 2^>nul') do set "NPM_PREFIX=%%p"
    if defined NPM_PREFIX if exist "!NPM_PREFIX!\claude.cmd" (
        for /f "tokens=*" %%v in ('"!NPM_PREFIX!\claude.cmd" --version 2^>nul') do (
            if not "%%v"=="" (
                echo [OK] Claude Code: %%v ^(via npm prefix^)
                set "CLAUDE_OK=1"
            )
        )
    )
)
if "!CLAUDE_OK!"=="0" (
    echo [WARN] Claude Code not found, installing...
    echo [INFO] Using npm registry: !NPM_REGISTRY!
    call npm install -g @anthropic-ai/claude-code@2.1.233 --registry=!NPM_REGISTRY! !NPM_NO_PROXY!
    if errorlevel 1 (
        echo [ERROR] Failed to install Claude Code
        pause
        exit /b 1
    )
    :: Verify installation - npm global bin may not be in PATH, so resolve via prefix
    for /f "tokens=*" %%p in ('npm config get prefix') do set "NPM_PREFIX=%%p"
    if exist "!NPM_PREFIX!\claude.cmd" (
        for /f "tokens=*" %%v in ('"!NPM_PREFIX!\claude.cmd" --version 2^>nul') do (
            if not "%%v"=="" (
                echo [OK] Claude Code: %%v
                set "CLAUDE_OK=1"
            )
        )
    )
    if "!CLAUDE_OK!"=="0" (
        echo [ERROR] Claude Code installed but not working
        echo [INFO] npm prefix: !NPM_PREFIX!
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
    echo [OK] Wrapper scripts installed
    echo [OK] Commands available: cc and ccs
)

:: Build and install TypeScript CLI
if exist "%~dp0package.json" (
    echo.
    echo [INFO] Building TypeScript CLI...
    pushd "%~dp0" >nul
    if not exist "node_modules\typescript\bin\tsc" (
        echo [INFO] Using npm registry: !NPM_REGISTRY!
        call npm install --registry=!NPM_REGISTRY! !NPM_NO_PROXY!
        if errorlevel 1 (
            popd >nul
            echo [ERROR] Failed to install TypeScript build dependencies
            pause
            exit /b 1
        )
    )
    call npm run build
    if errorlevel 1 (
        popd >nul
        echo [ERROR] Failed to build TypeScript CLI
        pause
        exit /b 1
    )
    popd >nul

    set "APP_DIR=%USERPROFILE%\.local\share\cc-start"
    if not exist "!APP_DIR!" mkdir "!APP_DIR!" >nul 2>&1
    if exist "!APP_DIR!\dist" rmdir /S /Q "!APP_DIR!\dist" >nul 2>&1
    if exist "!APP_DIR!\dist" del /F /Q "!APP_DIR!\dist" >nul 2>&1
    mkdir "!APP_DIR!\dist" >nul 2>&1
    xcopy /E /I /Y "%~dp0dist" "!APP_DIR!\dist" >nul
    if errorlevel 1 (
        echo [ERROR] Failed to install TypeScript CLI files
        pause
        exit /b 1
    )
    echo [OK] TypeScript CLI installed
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
"!PS_CMD!" -NoProfile -Command "$cfgDir=Join-Path $env:USERPROFILE '.claude\models'; if(Test-Path $cfgDir){ $c=0; ls $cfgDir\*.json -ea 0|Where-Object{ $_.Name -notlike '.*' }|ForEach-Object{ $t=[IO.File]::ReadAllText($_.FullName); if($t.Contains('skipWebFetchPreflight')){ Write-Host ('[OK] Already ok: '+$_.Name) }else{ $t=$t.TrimEnd() -replace '\}\s*$', ([char]44+[char]10+'  '+[char]34+'skipWebFetchPreflight'+[char]34+': true'+[char]10+'}'); [IO.File]::WriteAllText($_.FullName,$t); Write-Host ('[OK] Updated: '+$_.Name); $c++ }}; if($c -eq 0){ Write-Host '[INFO] All configs already have skipWebFetchPreflight' } } else { Write-Host '[INFO] No existing configs to check' }"

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
echo   cc doctor             - Validate and repair model configs
echo   cc doctor --repair     - Auto-fix model configs
echo.
echo Config files location:
echo   %%USERPROFILE%%\.claude\models\
echo.
echo [IMPORTANT] Please run "cc add" or "ccs add" to add model config
echo.
pause
