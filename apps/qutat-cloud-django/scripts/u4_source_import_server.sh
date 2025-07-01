#!/bin/sh
source ./_config.sh

rm -rf ~/bin/server/
rm -rf ~/src/

tar -xvf ~/src.tar.gz -C ~
cp ~/src/server/ ~/bin/server/ -r

python3 -m pip install virtualenv
python3 -m virtualenv --copies $PYTHON_VENV_PATH
source $PYTHON_VENV_PATH/bin/activate
pip install -r ~/bin/server/requirements.txt --no-cache-dir
pip install uwsgi

python ~/bin/server/manage.py makemigrations
python ~/bin/server/manage.py migrate
deactivate
