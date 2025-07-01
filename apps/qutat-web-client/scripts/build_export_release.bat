call _config.bat

call export_release.bat

rmdir %cPath%\build\ /s /q
mkdir %cPath%\build\
cd %cPath%\bin\client\
rmdir %cPath%\bin\client\.next\

call npm run build

cd %cPath%
xcopy %cPath%\bin\client\.next\ %cPath%\build\client\.next\ /eY
copy %cPath%\bin\client\package.json %cPath%\build\client\
cd %cPath%\build\
tar -czf client.tar.gz .\client
cd %cPath%
copy %cPath%\build\client.tar.gz %cPath%\release\