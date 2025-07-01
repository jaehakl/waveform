@echo off
call _config.bat

rem tar -zxf ./src.tar.gz -C ./

rem setup node client
xcopy %cPath%\src\client\ %cPath%\bin\client\ /eYq
cd %cPath%\bin\client\
call npm i --force
cd %cPath%

rem setup python server
python -m virtualenv --copies %cPath%\venv\server\
call %cPath%\venv\server\Scripts\activate.bat
xcopy %cPath%\src\server\ %cPath%\bin\server\ /eYq
pip install -r %cPath%\bin\server\requirements.txt
python %cPath%\bin\server\manage.py makemigrations
python %cPath%\bin\server\manage.py migrate
python %cPath%\bin\server\manage.py createsuperuser
call %cPath%\venv\server\Scripts\deactivate.bat


rem setup python desktop
python -m virtualenv --copies %cd%\venv\
call %cd%\venv\Scripts\activate.bat
xcopy %cd%\src\ %cd%\bin\ /eYq
pip install -r %cd%\bin\requirements.txt
rem call %cPath%\venv\desktop\Scripts\deactivate.bat