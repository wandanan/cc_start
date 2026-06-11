@echo off
setlocal EnableDelayedExpansion
set "PS_CMD=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

echo.
echo ===================================
echo    CC Start Uninstaller
echo ===================================
echo.

set "INSTALL_DIR=%USERPROFILE%\.local\bin"
set "APP_DIR=%USERPROFILE%\.local\share\cc-start"
set "CONFIG_DIR=%USERPROFILE%\.claude\models"

:: ── 检查是否已安装 ──────────────────────────────────────────
if not exist "%INSTALL_DIR%\cc.cmd" (
    echo [WARN] CC Start not found at %INSTALL_DIR%
    echo Nothing to uninstall.
    pause
    exit /b 0
)

:: ── 确认 ─────────────────────────────────────────────────────
echo The following will be removed:
echo.
echo   Scripts : %INSTALL_DIR%\cc, cc.cmd, ccs, ccs.cmd, init.ps1
echo   Runtime : %APP_DIR%
echo   Configs : %CONFIG_DIR% (will ask)
echo.
set /p confirm="Proceed with uninstall? (y/N): "
if /i not "!confirm!"=="y" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.

:: ── 1. 移除脚本 ──────────────────────────────────────────────
echo [INFO] Removing scripts...
del /F /Q "%INSTALL_DIR%\cc" >nul 2>&1
echo   [OK] Removed cc
del /F /Q "%INSTALL_DIR%\cc.cmd" >nul 2>&1
echo   [OK] Removed cc.cmd
del /F /Q "%INSTALL_DIR%\ccs" >nul 2>&1
echo   [OK] Removed ccs
del /F /Q "%INSTALL_DIR%\ccs.cmd" >nul 2>&1
echo   [OK] Removed ccs.cmd
del /F /Q "%INSTALL_DIR%\init.ps1" >nul 2>&1
echo   [OK] Removed init.ps1

:: Remove empty install directory if nothing else left
dir /b "%INSTALL_DIR%" 2>nul | findstr /r "." >nul 2>&1
if errorlevel 1 rmdir "%INSTALL_DIR%" >nul 2>&1

:: ── 2. 移除运行时文件 ────────────────────────────────────────
echo [INFO] Removing runtime files...
if exist "%APP_DIR%" (
    rmdir /S /Q "%APP_DIR%" >nul 2>&1
    if errorlevel 1 (
        :: Sometimes files are locked; try a final sweep
        del /F /Q "%APP_DIR%\dist\*" >nul 2>&1
        rmdir /S /Q "%APP_DIR%\dist" >nul 2>&1
    )
    echo   [OK] Removed runtime files
)

:: ── 3. 询问是否移除模型配置 ──────────────────────────────────
echo.
set /p remove_configs="Remove model configs at %CONFIG_DIR%? (y/N): "
if /i "!remove_configs!"=="y" (
    if exist "%CONFIG_DIR%" rmdir /S /Q "%CONFIG_DIR%" >nul 2>&1
    echo   [OK] Model configs removed
) else (
    echo   [SKIP] Model configs kept at %CONFIG_DIR%
)

:: ── 4. 从 PATH 中移除安装目录 ────────────────────────────────
echo [INFO] Removing %INSTALL_DIR% from PATH...
"!PS_CMD!" -NoProfile -Command "$d='%INSTALL_DIR%'; $p=[Environment]::GetEnvironmentVariable('Path','User'); $entries=$p -split ';' | Where-Object{$_ -ne '' -and $_ -ne $d -and $_.TrimEnd('\') -ne $d.TrimEnd('\')}; [Environment]::SetEnvironmentVariable('Path',($entries -join ';'),'User'); Write-Host '  [OK] PATH cleaned'"

:: ── 完成 ─────────────────────────────────────────────────────
echo.
echo ===================================
echo    Uninstall Complete!
echo ===================================
echo.
echo [INFO] Please reopen terminal for PATH changes to take effect.
echo.
pause
endlocal
