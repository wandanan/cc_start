@echo off
setlocal

set "BASH=D:\IDE\Git\Git\usr\bin\bash.exe"
if not exist "%BASH%" set "BASH=C:\Program Files\Git\bin\bash.exe"
if not exist "%BASH%" set "BASH=C:\Program Files (x86)\Git\bin\bash.exe"

if not exist "%BASH%" (
    echo Error: Git Bash not found.
    exit /b 1
)

set "SCRIPT_DIR=%~dp0"

if not exist "%SCRIPT_DIR%cc" (
    echo Error: cc script not found in %SCRIPT_DIR%
    exit /b 1
)

"%BASH%" -li "%SCRIPT_DIR%cc" %*
