#!/usr/bin/env pwsh
# CC Start PowerShell wrapper (ccs variant)
# Calls ccs.cmd in the same directory

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

& "$ScriptDir\ccs.cmd" @args
