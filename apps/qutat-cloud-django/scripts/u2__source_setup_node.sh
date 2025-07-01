#!/bin/sh
source ./_config.sh

wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.36.0/install.sh | bash
source ~/.bashrc
nvm install 18
mkdir ~/bin