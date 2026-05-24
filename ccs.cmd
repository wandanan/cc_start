@echo off
setlocal EnableDelayedExpansion

set "BASH=D:\IDE\Git\Git\usr\bin\bash.exe"
if not exist "%BASH%" set "BASH=C:\Program Files\Git\bin\bash.exe"
if not exist "%BASH%" set "BASH=C:\Program Files (x86)\Git\bin\bash.exe"

:: Fallback: check registry for Git install path
if not exist "%BASH%" (
    for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\GitForWindows" /v InstallPath 2^>nul') do (
        if exist "%%b\bin\bash.exe" set "BASH=%%b\bin\bash.exe"
    )
)
if not exist "%BASH%" (
    for /f "tokens=2*" %%a in ('reg query "HKCU\SOFTWARE\GitForWindows" /v InstallPath 2^>nul') do (
        if exist "%%b\bin\bash.exe" set "BASH=%%b\bin\bash.exe"
    )
)

:: Fallback: derive from where git
if not exist "%BASH%" (
    for /f "tokens=*" %%g in ('where git 2^>nul') do (
        set "GIT_CMD=%%~dpg"
        if exist "!GIT_CMD!..\bin\bash.exe" set "BASH=!GIT_CMD!..\bin\bash.exe"
    )
)

if not exist "%BASH%" (
    echo Error: Git Bash not found.
    echo Please install Git from https://git-scm.com/
    exit /b 1
)

set "SCRIPT_DIR=%~dp0"

if not exist "%SCRIPT_DIR%ccs" (
    echo Error: ccs script not found in %SCRIPT_DIR%
    exit /b 1
)

"%BASH%" -l "%SCRIPT_DIR%ccs" %*
