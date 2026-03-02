# Qutat Waveform

 Qutat Waveform is a simulation and data science framework designed to accelerate wave optics research. Along with a GPU-accelerated FDTD (Finite Difference Time Domain) simulator, it provides convenient features for creating and utilizing simulation datasets. Waveform focuses more on creating and using 'simulation datasets' rather than individual simulation results. It offers a modeling method to effectively express randomized structures that can form the input dataset, and SPDM (Simulation Process and Data Management) features to obtain simulation results from each of them, which can form the output dataset.

 On Waveform, machine learning models can be built using the dataset. Additionally, the prediction of simulation results, inverse designs, and optimizations can be conducted using these models. Although it contains a built-in wave optics solver, other user-defined solvers can also be integrated. Any simulation tool with a Python API can be connected and executed as a subprocess from the Waveform user interface. Therefore, many core-algorithm-only solvers can be integrated with several features of Waveform and easily scaled up to expand its functions, computational power, and user base.

<img width="938" height="630" alt="qutat_waveform_mainwindow" src="https://github.com/user-attachments/assets/1f4c3362-719f-446f-a536-98076f23a990" />

### Designed to Design
Declare parameters as range, determine later.

### Maximum H/W Usage
Connect and utilize every computational resource that you already own.

### Extensible
User-defined simulation codes can be integrated.

## Features

#### Modeling
- Generates random structures
- Reuses structures as components
- Defines complex shapes with equations

#### Simulation
- Includes built-in GPU-accelerated FDTD Simulation
- Integrates user-defined simulations with Python API
- Executes multiple simulations on remote computers

#### Cloud Storage
- Structures, Reusable Components and Materials
- Simulation Setups
- Each Randomly Generated Structures and Simulation Results

#### Data Analysis
- User-defined Post Processing
- Correlation Analysis
- Cluster Analysis

#### Optimization
- Parameter Optimization
- Adjoint Optimization
- Neural Network Model for Prediction/Design

![Waveguide-Splitter](https://github.com/user-attachments/assets/7c8ae14c-7623-42d3-8561-6fe910fe19ae)

## License
- GPL3

## Contact
- jaehak@qutat.com

## See Also
[Research Article](https://vixra.org/pdf/2407.0178v1.pdf)

https://github.com/user-attachments/assets/aa7311a6-fe36-49e1-b52b-8fcd91835e64

https://github.com/user-attachments/assets/440f7c1f-d14c-4966-ba64-b262c6d16996








