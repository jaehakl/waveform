#!/bin/sh
source ./_config.sh

rm -rf ~/bin/client/.next/
rm ~/bin/client/package.json

tar -xvf ~/client.tar.gz -C ~/bin/

cd ~/bin/client
npm install --force
cd ~