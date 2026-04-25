#!/usr/bin/env pwsh
# CC Start PowerShell wrapper
# Calls cc.cmd in the same directory

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

& "$ScriptDir\cc.cmd" @args
