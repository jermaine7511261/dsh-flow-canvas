@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

REM Uninstall dsh-flow-canvas plugin from DSH

echo Uninstalling dsh-flow-canvas plugin...

REM DSH profiles directory
set "DSH_PROFILES_DIR=%USERPROFILE%\.dsh\profiles"

REM Check if DSH is installed
if not exist "%DSH_PROFILES_DIR%" (
    echo Error: DSH profiles directory not found at %DSH_PROFILES_DIR%
    exit /b 1
)

REM Check if dsh command exists
where dsh >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: dsh command not found in PATH
    exit /b 1
)

REM Remove plugin from desktop profile
echo Removing plugin from desktop profile...
cd /d "%DSH_PROFILES_DIR%"
dsh plugin --profile desktop remove dsh-flow-canvas

REM Update cordis.patch.yml to disable the plugin
set "PATCH_FILE=%DSH_PROFILES_DIR%\desktop\cordis.patch.yml"

REM Create empty patch file
(
    echo # Your patch layer for this dsh profile, applied after every bundle layer:
    echo # a top-level YAML array of loader patch entries ^(id-targeted config
    echo # overrides, disables, and insert lists; `!!js` expressions allowed^).
    echo []
) > "%PATCH_FILE%"

echo.
echo [OK] dsh-flow-canvas plugin uninstalled successfully!
echo.

endlocal
