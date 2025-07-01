# QUTAT - Multiphysics Simulation Platform
# Copyright (C) 2023 Jaehak Lee
# SPDX-License-Identifier: GPL-3.0-only

import subprocess
from io import BytesIO
import pandas as pd

def get_freer_gpu():
    #time.sleep(10*np.random.rand())
    gpu_stats = subprocess.check_output(["nvidia-smi", "--format=csv", "--query-gpu=memory.used,memory.free"])
    gpu_df = pd.read_csv(BytesIO(gpu_stats),names=['memory.used', 'memory.free'],skiprows=1)
    gpu_df['memory.free'] = gpu_df['memory.free'].map(lambda x: int(x.rstrip(' [MiB]')))
    idx = gpu_df['memory.free'].idxmax()
    print('Use GPU{} with {} free MiB'.format(idx, gpu_df.iloc[idx]['memory.free']))
    return idx