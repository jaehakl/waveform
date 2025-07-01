@echo off
rem wsl --install -d Ubuntu-22.04
set CONDA_QUTAT=qutat-miniconda
set ENV_QUTAT=qutat
wsl bash wsl_setup.sh %CONDA_QUTAT% %ENV_QUTAT%