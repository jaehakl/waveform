@echo off
REM 백엔드 실행 (새 창)
cd ./apps/waveform-server
start cmd /k "call run.bat"
cd ../..

REM 프론트엔드 실행 (새 창)
cd ./apps/waveform-web   
start cmd /k "call run.bat"
cd ../..


REM 데스크탑 클라이언트 실행 (새 창)
cd ./apps/qutat-desktop-client  
start cmd /k "call run.bat"
cd ../..






