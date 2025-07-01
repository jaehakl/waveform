#!/bin/bash
echo 'subproc start'
echo 'port:' $1

source ~/qutat-miniconda/etc/profile.d/conda.sh
conda activate qutat

python solvers/meep/script.py $1
echo 'subproc done'