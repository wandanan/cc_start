@echo off
setlocal

set "BASH=D:\IDE\Git\Git\usr\bin\bash.exe"
if not exist "%BASH%" set "BASH=C:\Program Files\Git\bin\bash.exe"
if not exist "%BASH%" set "BASH=C:\Program Files (x86)\Git\bin\bash.exe"

if not exist "%BASH%" (
    echo Error: Git Bash not found.
    exit /b 1
)

"%BASH%" -lic "\"$(cygpath -u '%~dp0ccs')\" $*" -- %*
