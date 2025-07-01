#!/bin/sh
export HOME_PATH=/home/ubuntu

apt update
apt-get install nginx

apt install snapd
snap install --classic certbot
ln -s /snap/bin/certbot /usr/bin/certbot
certbot --nginx


#도메인 바뀔 시 nginx.conf 수정 필수
#certbot --nginx 까지 실행시킨 후, 
#default.bak 을 참고하여 nginx.conf 수정
cp /etc/nginx/conf.d/default /etc/nginx/conf.d/default.bak
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
cp $HOME_PATH/nginx.conf /etc/nginx/
nginx -s reload

apt install python3-pip
#apt install libglu1-mesa-dev