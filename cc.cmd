@echo off

:: Find Git Bash
set "BASH=C:\Program Files\Git\bin\bash.exe"
if not exist "%BASH%" set "BASH=C:\Program Files (x86)\Git\bin\bash.exe"
if not exist "%BASH%" for /f "delims=" %%i in ('where bash 2^>nul') do set "BASH=%%i"

if not exist "%BASH%" (
    echo Error: Git Bash not found. Please install Git for Windows.
    exit /b 1
)

"%BASH%" "%~dp0cc" %*
