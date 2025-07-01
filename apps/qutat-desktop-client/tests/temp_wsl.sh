#!/bin/bash
echo 'subproc start'
source ~/qutat-miniconda/etc/profile.d/conda.sh
conda activate qutat
python ./temp_adjoint.py
echo 'subproc done'