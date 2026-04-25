@echo off
setlocal

set "BASH=D:\IDE\Git\Git\usr\bin\bash.exe"
if not exist "%BASH%" set "BASH=C:\Program Files\Git\bin\bash.exe"
if not exist "%BASH%" set "BASH=C:\Program Files (x86)\Git\bin\bash.exe"

if not exist "%BASH%" (
    echo Error: Git Bash not found.
    exit /b 1
)

:: 切换到脚本所在目录，使用相对路径避免 cygpath 中文路径问题
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%" 2>nul
if errorlevel 1 (
    echo Error: Failed to change to script directory
    exit /b 1
)

if not exist "cc" (
    echo Error: cc script not found in %SCRIPT_DIR%
    exit /b 1
)

"%BASH%" -li "cc" %*
