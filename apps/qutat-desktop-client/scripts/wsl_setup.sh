#!/bin/bash
cd ~
wget https://repo.continuum.io/miniconda/Miniconda3-latest-Linux-x86_64.sh -O miniconda.sh
bash miniconda.sh -b -p $1
export PATH=$1/bin:$PATH
source ~/$1/etc/profile.d/conda.sh
conda create -n $2 -c conda-forge python=3.10 pymeep pymeep-extras pandas -y
conda activate $2
pip install opencv-python
conda list
echo 'wsl setup completed'