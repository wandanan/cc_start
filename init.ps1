<#
.SYNOPSIS
    CC Start PowerShell 会话初始化脚本
.DESCRIPTION
    在当前 PowerShell 会话中注册 cc 和 ccs 命令，无需全局安装即可使用。
    运行方式：. .\init.ps1
    注意：点 sourcing（. 前缀）是必需的，否则函数不会在父会话中生效。
#>

$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

# 注册 cc 全局函数
function global:cc {
    [CmdletBinding()]
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )
    & "$ScriptDir\cc.cmd" @Arguments
}

# 注册 ccs 全局函数
function global:ccs {
    [CmdletBinding()]
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )
    & "$ScriptDir\ccs.cmd" @Arguments
}

Write-Host ""
Write-Host "===================================" -ForegroundColor Green
Write-Host "   CC Start PowerShell Initialized" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""
Write-Host "Commands registered for this session:" -ForegroundColor Cyan
Write-Host "  cc, ccs" -ForegroundColor White
Write-Host ""
Write-Host "Usage:" -ForegroundColor Gray
Write-Host "  cc              Interactive model selection"
Write-Host "  cc <model>      Start specified model"
Write-Host "  cc add          Add new model config"
Write-Host "  cc ls           List all models"
Write-Host ""
Write-Host "Note: This is session-only." -ForegroundColor Yellow
Write-Host "      New windows need to re-run: . .\init.ps1" -ForegroundColor Yellow
Write-Host "      Or run .\install.bat for global installation." -ForegroundColor Yellow
Write-Host ""
