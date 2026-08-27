@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

REM Install dsh-flow-canvas plugin to DSH

echo Installing dsh-flow-canvas plugin...

REM DSH profiles directory
set "DSH_PROFILES_DIR=%USERPROFILE%\.dsh\profiles"

REM Check if DSH is installed
if not exist "%DSH_PROFILES_DIR%" (
    echo Error: DSH profiles directory not found at %DSH_PROFILES_DIR%
    echo Please install DSH first: npm install -g @deepseek-ai\dsh
    exit /b 1
)

REM Get plugin directory (remove trailing backslash)
set "PLUGIN_DIR=%~dp0"
if "%PLUGIN_DIR:~-1%"=="\" set "PLUGIN_DIR=%PLUGIN_DIR:~0,-1%"

REM Check if dsh command exists
where dsh >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: dsh command not found in PATH
    echo Please install DSH first: npm install -g @deepseek-ai\dsh
    exit /b 1
)

REM Add plugin to desktop profile
echo Adding plugin to desktop profile...
cd /d "%DSH_PROFILES_DIR%"
dsh plugin --profile desktop add "%PLUGIN_DIR%"
if %errorlevel% neq 0 (
    echo Warning: Failed to add plugin via dsh command, trying manual method...
)

REM Update cordis.patch.yml to enable the plugin
set "PATCH_FILE=%DSH_PROFILES_DIR%\desktop\cordis.patch.yml"

REM Check if patch file already has flow-canvas entry
if exist "%PATCH_FILE%" (
    findstr /C:"flow-canvas" "%PATCH_FILE%" >nul 2>&1
    if !errorlevel!==0 (
        echo Plugin already enabled in cordis.patch.yml
        goto :done
    )
)

REM Append flow-canvas entry to existing cordis.patch.yml
echo Enabling plugin in cordis.patch.yml...
if exist "%PATCH_FILE%" (
    REM File exists, append to it
    echo. >> "%PATCH_FILE%"
    echo     - id: flow-canvas >> "%PATCH_FILE%"
    echo       name: 'dsh-flow-canvas' >> "%PATCH_FILE%"
    echo       config: >> "%PATCH_FILE%"
    echo         enabled: true >> "%PATCH_FILE%"
) else (
    REM File doesn't exist, create new one
    (
        echo # Your patch layer for this dsh profile, applied after every bundle layer:
        echo # a top-level YAML array of loader patch entries ^(id-targeted config
        echo # overrides, disables, and insert lists; `!!js` expressions allowed^).
        echo - insert:
        echo     - id: flow-canvas
        echo       name: 'dsh-flow-canvas'
        echo       config:
        echo         enabled: true
    ) > "%PATCH_FILE%"
)

:done
echo.
echo [OK] dsh-flow-canvas plugin installed successfully!
echo.
echo To use the plugin:
echo   1. Start DSH: dsh --profile desktop
echo   2. Use the flow_canvas tool to open the visual editor
echo.
echo Keyboard shortcuts:
echo   Ctrl+S      - Save workflow
echo   Ctrl+E      - Export workflow
echo   Ctrl+D      - Duplicate node
echo   Ctrl+G      - Auto layout
echo   Ctrl+1      - Fit view
echo   Delete      - Delete selected
echo.

endlocal
