@echo off
setlocal

cd /d "%~dp0apps\caemble\ui"

if not exist node_modules (
  echo Installing caemble UI dependencies...
  call npm install
  if errorlevel 1 goto fail
)

call npm run dev
if errorlevel 1 goto fail
goto end

:fail
echo.
echo Failed to start caemble UI.
pause

:end
endlocal
