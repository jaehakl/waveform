#!/bin/sh
source ./_config.sh

source $PYTHON_VENV_PATH/bin/activate

nohup uwsgi --ini ~/bin/server/backend/uwsgi.ini & 
#nohup python ~/bin/server/manage.py runserver 0:8001 & #runserver
