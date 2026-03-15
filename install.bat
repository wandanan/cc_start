@echo off
setlocal EnableDelayedExpansion

chcp 936 >nul

echo.
echo ===================================
echo    CC Start 安装程序
echo ===================================
echo.

:: 检查是否有 cc 文件在当前目录
if not exist "%~dp0cc" (
    echo [错误] 未找到 cc 脚本文件
    echo 请确保 install.bat 和 cc 文件在同一目录
    pause
    exit /b 1
)

:: 设置安装目录
set "INSTALL_DIR=%USERPROFILE%\.local\bin"

echo 安装目录: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%" 2>nul
    if errorlevel 1 (
        echo [错误] 无法创建安装目录
        pause
        exit /b 1
    )
)

:: 检查是否已安装
if exist "%INSTALL_DIR%\cc.cmd" (
    echo.
    echo [提示] CC Start 已安装
    set /p confirm="是否覆盖? (y/N): "
    if /i not "!confirm!=="y" (
        echo 取消安装
        pause
        exit /b 0
    )
)

:: 复制脚本
echo.
echo 正在复制文件...
copy /Y "%~dp0cc" "%INSTALL_DIR%\cc" >nul
if errorlevel 1 (
    echo [错误] 复制 cc 失败
    pause
    exit /b 1
)
copy /Y "%~dp0cc.cmd" "%INSTALL_DIR%\cc.cmd" >nul
if errorlevel 1 (
    echo [错误] 复制 cc.cmd 失败
    pause
    exit /b 1
)
echo [OK] 脚本已安装

:: 创建配置目录
if not exist "%USERPROFILE%\.claude\models" (
    mkdir "%USERPROFILE%\.claude\models" 2>nul
)
echo [OK] 配置目录已创建

:: 复制模型配置
echo.
echo 正在复制模型配置...
if exist "%~dp0models" (
    set "CONFIG_DIR=%USERPROFILE%\.claude\models"
    for %%f in ("%~dp0models\*.json") do (
        set "filename=%%~nxf"
        if exist "!CONFIG_DIR!\!filename!" (
            echo.
            echo [提示] 配置文件已存在: !filename!
            set /p overwrite="是否覆盖? (y/N): "
            if /i "!overwrite!=="y" (
                copy /Y "%%f" "!CONFIG_DIR!\" >nul
                echo [OK] 已覆盖: !filename!
            ) else (
                echo [跳过] 保留原文件: !filename!
            )
        ) else (
            copy "%%f" "!CONFIG_DIR!\" >nul
            echo [OK] 已复制: !filename!
        )
    )
)

:: 检查 PATH
echo.
echo 检查 PATH...
echo %PATH% | find /i "%INSTALL_DIR%" >nul
if errorlevel 1 (
    echo.
    echo [提示] 正在添加到用户 PATH...

    for /f "tokens=2*" %%a in ('reg query HKCU\Environment /v Path 2^>nul ^| findstr Path') do set "USER_PATH=%%b"

    if defined USER_PATH (
        setx PATH "!USER_PATH!;!INSTALL_DIR!" >nul 2>&1
    ) else (
        setx PATH "!INSTALL_DIR!" >nul 2>&1
    )

    if errorlevel 1 (
        echo [警告] 添加 PATH 失败，请手动添加: %INSTALL_DIR%
    ) else (
        echo [OK] PATH 已更新
    )
    echo.
    echo [重要] 请重新打开终端以使用 cc 命令
) else (
    echo [OK] PATH 检查通过
)

:: 完成
echo.
echo ===================================
echo    安装完成!
echo ===================================
echo.
echo 使用方法:
echo   cc              - 交互式选择模型
echo   cc ^<模型名^>     - 直接启动指定模型
echo   cc add          - 添加新模型配置
echo.
echo 配置文件位置:
echo   %%USERPROFILE%%\.claude\models\
echo.
echo [重要] 请重新打开终端，然后运行 cc add 命令添加模型配置
echo.
pause
