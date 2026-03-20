@echo off

:: Find Git Bash
set "BASH=C:\Program Files\Git\bin\bash.exe"
if not exist "%BASH%" set "BASH=C:\Program Files (x86)\Git\bin\bash.exe"
if not exist "%BASH%" for /f "delims=" %%i in ('where bash 2^>nul') do set "BASH=%%i"

if not exist "%BASH%" (
    echo Error: Git Bash not found. Please install Git for Windows.
    exit /b 1
)

:: Get the script name without extension (cc or ccs)
set "SCRIPT_NAME=%~n0"
set "SCRIPT_DIR=%~dp0"
set "BASH_SCRIPT=%SCRIPT_DIR%%SCRIPT_NAME%"

:: Fallback: try User profile .local\bin if not found in script dir
if not exist "%BASH_SCRIPT%" (
    set "BASH_SCRIPT=%USERPROFILE%\.local\bin\%SCRIPT_NAME%"
)

if not exist "%BASH_SCRIPT%" (
    echo Error: %SCRIPT_NAME% script not found.
    echo Expected: %BASH_SCRIPT%
    echo Please reinstall using install.bat
    exit /b 1
)

"%BASH%" "%BASH_SCRIPT%" %*