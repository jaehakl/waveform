export type Tensor = number | readonly Tensor[]
export type Vars = Readonly<Record<string, Tensor>>
export type Vec3 = readonly [number, number, number]
export type CartesianBasis = readonly [Vec3, Vec3, Vec3]
export const IDENTITY_CARTESIAN_BASIS: CartesianBasis
export type Rotation = Readonly<{ axis: Vec3; angle: number }>
export type StructureGroupMap = Readonly<Record<string, readonly string[]>>
export type VarsSchemaEntry = Readonly<{
  min: Tensor
  max: Tensor
}>
export type ExperimentTarget = `${'experiment' | 'structure'}.${'geometry' | 'surface'}.${string}`
export type DataDType =
  | 'bool'
  | 'string'
  | 'int8'
  | 'int16'
  | 'int32'
  | 'int64'
  | 'uint8'
  | 'uint16'
  | 'uint32'
  | 'uint64'
  | 'float16'
  | 'float32'
  | 'float64'
export type FloatDataDType = Extract<DataDType, `float${number}`>
export type NonFloatDataDType = Exclude<DataDType, FloatDataDType>
export type IntegerDataDType = Exclude<NonFloatDataDType, 'bool' | 'string'>
export type UcumUnit = string
export type QuantityKindName =
  | 'APIGravity'
  | 'AbsoluteActivity'
  | 'AbsoluteHumidity'
  | 'AbsoluteTypographicMeasurement'
  | 'AbsorbedDose'
  | 'AbsorbedDoseRate'
  | 'Absorptance'
  | 'Acceleration'
  | 'AccelerationOfGravity'
  | 'AcceptorDensity'
  | 'AcceptorIonizationEnergy'
  | 'Acidity'
  | 'AcousticImpedance'
  | 'Action'
  | 'ActionTime'
  | 'ActiveEnergy'
  | 'ActivePower'
  | 'Activity'
  | 'ActivityCoefficient'
  | 'ActivityConcentration'
  | 'ActivityRelatedByMass'
  | 'ActivityThresholds'
  | 'Adaptation'
  | 'Admittance'
  | 'AlphaDisintegrationEnergy'
  | 'Altitude'
  | 'AmbientPressure'
  | 'AmountOfBiologicallyActiveSubstance'
  | 'AmountOfCloudCover'
  | 'AmountOfSubstance'
  | 'AmountOfSubstanceConcentration'
  | 'AmountOfSubstanceFraction'
  | 'AmountOfSubstanceIonConcentration'
  | 'AmountOfSubstancePerMass'
  | 'AmountOfSubstancePerMassPressure'
  | 'AmountOfSubstancePerVolume'
  | 'Angle'
  | 'AngleOfAttack'
  | 'AngleOfOpticalRotation'
  | 'AngularAcceleration'
  | 'AngularCrossSection'
  | 'AngularDistance'
  | 'AngularFrequency'
  | 'AngularImpulse'
  | 'AngularMomentum'
  | 'AngularMomentumPerAngle'
  | 'AngularReciprocalLatticeVector'
  | 'AngularVelocity'
  | 'AngularWavenumber'
  | 'ApogeeRadius'
  | 'ApparentEnergy'
  | 'ApparentPower'
  | 'ApparentThermalInertia'
  | 'Area'
  | 'AreaAngle'
  | 'AreaBitDensity'
  | 'AreaChargeDensity'
  | 'AreaMass'
  | 'AreaPerLength'
  | 'AreaPerPower'
  | 'AreaPerTime'
  | 'AreaRatio'
  | 'AreaTemperature'
  | 'AreaThermalExpansion'
  | 'AreaTime'
  | 'AreaTimeTemperature'
  | 'AreicChargeDensityOrElectricFluxDensityOrElectricPolarization'
  | 'AreicDataVolume'
  | 'AreicEnergyFlow'
  | 'AreicHeatFlowRate'
  | 'AreicMass'
  | 'AreicTorque'
  | 'Asset'
  | 'AtmosphericHydroxylationRate'
  | 'AtmosphericPressure'
  | 'AtomScatteringFactor'
  | 'AtomicAttenuationCoefficient'
  | 'AtomicCharge'
  | 'AtomicEnergy'
  | 'AtomicMass'
  | 'AtomicNumber'
  | 'AtomicStoppingPower'
  | 'AttenuationCoefficient'
  | 'AuditoryThresholds'
  | 'AuxillaryMagneticField'
  | 'AverageEnergyLossPerElementaryChargeProduced'
  | 'AverageHeadEndPressure'
  | 'AverageLogarithmicEnergyDecrement'
  | 'AverageSpecificImpulse'
  | 'AverageVacuumThrust'
  | 'Azimuth'
  | 'BandwidthDistanceProduct'
  | 'BandwidthLengthProduct'
  | 'Basicity'
  | 'BatteryCapacity'
  | 'BendingMomentOfForce'
  | 'BetaDisintegrationEnergy'
  | 'BevelGearPitchAngle'
  | 'BinaryLogarithmicMedianInformationFlow'
  | 'BindingFraction'
  | 'BioconcentrationFactor'
  | 'BiodegredationHalfLife'
  | 'BiogeochemicalRate'
  | 'BitDataVolume'
  | 'BitRate'
  | 'BitTransmissionRate'
  | 'BloodGlucoseLevel'
  | 'BloodGlucoseLevel_Mass'
  | 'BodyMassIndex'
  | 'BoilingPoint'
  | 'BraggAngle'
  | 'Breadth'
  | 'BucklingFactor'
  | 'BulkModulus'
  | 'BurgersVector'
  | 'BurnRate'
  | 'BurnTime'
  | 'BurstFactor'
  | 'ByteDataVolume'
  | 'ByteRate'
  | 'ByteTransmissionRate'
  | 'CENTER-OF-GRAVITY_X'
  | 'CENTER-OF-GRAVITY_Y'
  | 'CENTER-OF-GRAVITY_Z'
  | 'CENTER-OF-MASS'
  | 'CO2Equivalent'
  | 'CONTRACT-END-ITEM-SPECIFICATION-MASS'
  | 'CONTROL-MASS'
  | 'CanonicalPartitionFunction'
  | 'Capacitance'
  | 'Capacity'
  | 'CarrierLifetime'
  | 'CartesianArea'
  | 'CartesianCoordinates'
  | 'CartesianVolume'
  | 'CatalyticActivity'
  | 'CatalyticActivityConcentration'
  | 'CationExchangeCapacity'
  | 'CelsiusTemperature'
  | 'CenterOfGravity_X'
  | 'CenterOfGravity_Y'
  | 'CenterOfGravity_Z'
  | 'CharacteristicAcousticImpedance'
  | 'CharacteristicNumber'
  | 'CharacteristicVelocity'
  | 'ChargeNumber'
  | 'ChemicalAffinity'
  | 'ChemicalConsumptionPerMass'
  | 'ChemicalPotential'
  | 'Chromaticity'
  | 'Circulation'
  | 'ClosestApproachRadius'
  | 'CoefficientOfHeatTransfer'
  | 'CoefficientOfPerformance'
  | 'Coercivity'
  | 'CoherenceLength'
  | 'ColdReceptorThreshold'
  | 'CombinedNonEvaporativeHeatTransferCoefficient'
  | 'CommonLogarithmicMedianInformationFlow'
  | 'ComplexFrequency_Imaginary'
  | 'ComplexFrequency_Real'
  | 'ComplexPower'
  | 'CompoundPlaneAngle'
  | 'Compressibility'
  | 'CompressibilityFactor'
  | 'Concentration'
  | 'Conductance'
  | 'ConductionSpeed'
  | 'ConductiveHeatTransferRate'
  | 'Conductivity'
  | 'ConductivityVariance'
  | 'ConductivityVariance_NEON'
  | 'Constringence'
  | 'ConvectiveHeatTransfer'
  | 'CoolingPerformanceRatio'
  | 'CorrelatedColorTemperature'
  | 'CostPerArea'
  | 'CostPerEnergy'
  | 'CostPerMass'
  | 'CostPerPower'
  | 'Count'
  | 'CountRate'
  | 'CouplingFactor'
  | 'CrossSection'
  | 'CrossSectionalArea'
  | 'CubicElectricDipoleMomentPerSquareEnergy'
  | 'CubicExpansionCoefficient'
  | 'CurieTemperature'
  | 'Currency'
  | 'CurrencyPerFlight'
  | 'CurrencyPerTime'
  | 'CurrentLinkage'
  | 'CurrentOfTheAmountOfSubstance'
  | 'Curvature'
  | 'CurvatureFromRadius'
  | 'CutoffCurrentRating'
  | 'CyclotronAngularFrequency'
  | 'DELTA-V'
  | 'DRY-MASS'
  | 'DataRate'
  | 'DataTransmissionRate'
  | 'DatasetOfBits'
  | 'DatasetOfBytes'
  | 'Debye-WallerFactor'
  | 'DebyeAngularFrequency'
  | 'DebyeAngularWavenumber'
  | 'DebyeTemperature'
  | 'DebyeWallerFactor'
  | 'DecayConstant'
  | 'DegreeOfDissociation'
  | 'Density'
  | 'DensityInCombustionChamber'
  | 'DensityOfStates'
  | 'Depth'
  | 'DewPointTemperature'
  | 'Diameter'
  | 'DiastolicBloodPressure'
  | 'DiffusionArea'
  | 'DiffusionCoefficient'
  | 'DiffusionCoefficientForFluenceRate'
  | 'DiffusionLength'
  | 'DigitRate'
  | 'Dimensionless'
  | 'DimensionlessRatio'
  | 'Displacement'
  | 'DisplacementCurrent'
  | 'DisplacementCurrentDensity'
  | 'DisplacementVectorOfIon'
  | 'Dissipance'
  | 'Distance'
  | 'DistanceTraveledDuringBurn'
  | 'DonorDensity'
  | 'DonorIonizationEnergy'
  | 'DoseEquivalent'
  | 'DoseEquivalentQualityFactor'
  | 'DoseEquivalentRate'
  | 'DotsPerInch'
  | 'DragCoefficient'
  | 'DragForce'
  | 'DryBulbTemperature'
  | 'DryVolume'
  | 'DutyCycle'
  | 'Duv'
  | 'DynamicFriction'
  | 'DynamicFrictionCoefficient'
  | 'DynamicPressure'
  | 'DynamicViscosity'
  | 'EarthquakeMagnitude'
  | 'EccentricityOfOrbit'
  | 'EffectiveMass'
  | 'EffectiveMultiplicationFactor'
  | 'Efficiency'
  | 'EinsteinCoefficients'
  | 'EinsteinTransitionProbability'
  | 'EinsteinTransitionProbabilityForSpontaneousOrInducedEmissionAndAbsorption'
  | 'ElectricCharge'
  | 'ElectricChargeDensity'
  | 'ElectricChargeLineDensity'
  | 'ElectricChargeLinearDensity'
  | 'ElectricChargePerAmountOfSubstance'
  | 'ElectricChargePerArea'
  | 'ElectricChargePerMass'
  | 'ElectricChargeSurfaceDensity'
  | 'ElectricChargeVolumeDensity'
  | 'ElectricConductivity'
  | 'ElectricCurrent'
  | 'ElectricCurrentDensity'
  | 'ElectricCurrentImbalance'
  | 'ElectricCurrentPerAngle'
  | 'ElectricCurrentPerEnergy'
  | 'ElectricCurrentPerLength'
  | 'ElectricCurrentPerTemperature'
  | 'ElectricCurrentPhasor'
  | 'ElectricDipoleMoment'
  | 'ElectricDipoleMoment_CubicPerEnergy_Squared'
  | 'ElectricDipoleMoment_QuarticPerEnergy_Cubic'
  | 'ElectricDisplacement'
  | 'ElectricDisplacementField'
  | 'ElectricEnergy'
  | 'ElectricField'
  | 'ElectricFieldStrength'
  | 'ElectricFlux'
  | 'ElectricFluxDensity'
  | 'ElectricPolarizability'
  | 'ElectricPolarization'
  | 'ElectricPotential'
  | 'ElectricPotentialDifference'
  | 'ElectricPower'
  | 'ElectricQuadrupoleMoment'
  | 'ElectricSusceptibility'
  | 'ElectricalConductance'
  | 'ElectricalPowerToMassRatio'
  | 'ElectricalResistance'
  | 'ElectrolyticConductivity'
  | 'ElectromagneticEnergyDensity'
  | 'ElectromagneticPermeability'
  | 'ElectromagneticPermeabilityRatio'
  | 'ElectromagneticWavePhaseSpeed'
  | 'ElectromotiveForce'
  | 'ElectronAffinity'
  | 'ElectronDensity'
  | 'ElectronMeanFreePath'
  | 'ElectronMobility'
  | 'ElectronRadius'
  | 'ElevationRelativeToNAP'
  | 'Emissivity'
  | 'Energy'
  | 'EnergyContent'
  | 'EnergyDensity'
  | 'EnergyDensityOfStates'
  | 'EnergyExpenditure'
  | 'EnergyFluence'
  | 'EnergyFluenceRate'
  | 'EnergyImparted'
  | 'EnergyInternal'
  | 'EnergyKinetic'
  | 'EnergyLevel'
  | 'EnergyPerArea'
  | 'EnergyPerAreaElectricCharge'
  | 'EnergyPerElectricCharge'
  | 'EnergyPerMagneticFluxDensity_Squared'
  | 'EnergyPerMassAmountOfSubstance'
  | 'EnergyPerSquareMagneticFluxDensity'
  | 'EnergyPerTemperature'
  | 'Energy_Squared'
  | 'Enthalpy'
  | 'Entropy'
  | 'EquilibriumConstant'
  | 'EquilibriumConstantBasedOnConcentration'
  | 'EquilibriumConstantBasedOnPressure'
  | 'EquilibriumConstantOnConcentrationBasis'
  | 'EquilibriumConstantOnPressureBasis'
  | 'EquilibriumPositionVectorOfIon'
  | 'EquivalenceDoseOutput'
  | 'EquivalentAbsorptionArea'
  | 'EquivalentConcentration'
  | 'EquivalentDensity'
  | 'Equivalent_Mass'
  | 'Equivalent_Molar'
  | 'EvaporativeHeatTransfer'
  | 'EvaporativeHeatTransferCoefficient'
  | 'ExchangeIntegral'
  | 'ExpansionRatio'
  | 'Exposure'
  | 'ExposureOfIonizingRadiation'
  | 'ExposureRate'
  | 'ExposureRateOfIonizingRadiation'
  | 'ExtentOfReaction'
  | 'FLIGHT-PERFORMANCE-RESERVE-PROPELLANT-MASS'
  | 'FUEL-BIAS'
  | 'FahrenheitTemperature'
  | 'FailureRate'
  | 'FastFissionFactor'
  | 'FermiAngularWavenumber'
  | 'FermiEnergy'
  | 'FermiTemperature'
  | 'FinalOrCurrentVehicleMass'
  | 'FirstMomentOfArea'
  | 'FishBiotransformationHalfLife'
  | 'FissionCoreRadiusToHeightRatio'
  | 'FissionFuelUtilizationFactor'
  | 'FissionMultiplicationFactor'
  | 'FlashPoint'
  | 'FlightPathAngle'
  | 'FloatingPointCalculationCapability'
  | 'Fluidity'
  | 'Flux'
  | 'Force'
  | 'ForceConstant'
  | 'ForceMagnitude'
  | 'ForcePerAngle'
  | 'ForcePerArea'
  | 'ForcePerAreaTime'
  | 'ForcePerElectricCharge'
  | 'ForcePerLength'
  | 'Frequency'
  | 'Friction'
  | 'FrictionCoefficient'
  | 'Fugacity'
  | 'FundamentalLatticeVector'
  | 'FundamentalReciprocalLatticeVector'
  | 'GFactorOfNucleus'
  | 'GROSS-LIFT-OFF-WEIGHT'
  | 'Gain'
  | 'GapEnergy'
  | 'GasLeakRate'
  | 'GaugePressure'
  | 'GeneFamilyAbundance'
  | 'GeneralizedCoordinate'
  | 'GeneralizedForce'
  | 'GeneralizedMomentum'
  | 'GeneralizedVelocity'
  | 'GibbsEnergy'
  | 'Gradient'
  | 'GrandCanonicalPartitionFunction'
  | 'GravitationalAttraction'
  | 'Gravity_API'
  | 'GrossTonnage'
  | 'GroupSpeedOfSound'
  | 'GrowingDegreeDay'
  | 'GrowingDegreeDay_Cereal'
  | 'GruneisenParameter'
  | 'GustatoryThreshold'
  | 'GyromagneticRatio'
  | 'Half-Life'
  | 'Half-ValueThickness'
  | 'HalfLife'
  | 'HalfValueThickness'
  | 'HallCoefficient'
  | 'HamiltonFunction'
  | 'HeadEndPressure'
  | 'HeartRate'
  | 'Heat'
  | 'HeatCapacity'
  | 'HeatCapacityRatio'
  | 'HeatFlowRate'
  | 'HeatFlowRatePerArea'
  | 'HeatFluxDensity'
  | 'HeatingValue'
  | 'Height'
  | 'HelmholtzEnergy'
  | 'HenrysLawVolatilityConstant'
  | 'HoleDensity'
  | 'HorizontalVelocity'
  | 'HydraulicPermeability'
  | 'HyperfineStructureQuantumNumber'
  | 'INERT-MASS'
  | 'IgnitionIntervalTime'
  | 'Illuminance'
  | 'Impedance'
  | 'Impulse'
  | 'Incidence'
  | 'IncidenceProportion'
  | 'IncidenceRate'
  | 'Inductance'
  | 'InductanceBasedTimeConstant'
  | 'InfiniteMultiplicationFactor'
  | 'InformationContent'
  | 'InformationContentExpressedAsALogarithmToBase10'
  | 'InformationContentExpressedAsALogarithmToBase2'
  | 'InformationContentExpressedAsALogarithmToBaseE'
  | 'InformationEntropy'
  | 'InformationFlowRate'
  | 'InitialExpansionRatio'
  | 'InitialVehicleMass'
  | 'InitialVelocity'
  | 'InstantaneousPower'
  | 'InternalConversionFactor'
  | 'InternalEnergy'
  | 'IntinsicCarrierDensity'
  | 'IntrinsicCarrierDensity'
  | 'InverseAmountOfSubstance'
  | 'InverseArea'
  | 'InverseEnergy'
  | 'InverseEnergy_Squared'
  | 'InverseLength'
  | 'InverseLengthTemperature'
  | 'InverseMagneticFlux'
  | 'InverseMass'
  | 'InverseMass_Squared'
  | 'InversePermittivity'
  | 'InversePressure'
  | 'InverseSquareEnergy'
  | 'InverseSquareMass'
  | 'InverseSquareTime'
  | 'InverseTemperature'
  | 'InverseTime'
  | 'InverseTimeTemperature'
  | 'InverseTime_Squared'
  | 'InverseVolume'
  | 'IonConcentration'
  | 'IonCurrent'
  | 'IonDensity'
  | 'IonTransportNumber'
  | 'IonicCharge'
  | 'IonicStrength'
  | 'IonizationEnergy'
  | 'Irradiance'
  | 'IsentropicCompressibility'
  | 'IsentropicExponent'
  | 'IsothermalCompressibility'
  | 'IsothermalMoistureCapacity'
  | 'Kerma'
  | 'KermaRate'
  | 'KinematicViscosity'
  | 'KinematicViscosityOrDiffusionConstantOrThermalDiffusivity'
  | 'KineticEnergy'
  | 'KineticOrThermalEnergy'
  | 'LagrangeFunction'
  | 'Landau-GinzburgNumber'
  | 'LandauGinzburgNumber'
  | 'LandeGFactor'
  | 'LarmorAngularFrequency'
  | 'LatticePlaneSpacing'
  | 'LatticeVector'
  | 'LeakageFactor'
  | 'Length'
  | 'LengthByForce'
  | 'LengthEnergy'
  | 'LengthMass'
  | 'LengthMolarEnergy'
  | 'LengthPerElectricCurrent'
  | 'LengthRatio'
  | 'LengthTemperature'
  | 'LengthTemperatureTime'
  | 'Lethargy'
  | 'LevelWidth'
  | 'LiftCoefficient'
  | 'LiftForce'
  | 'LinearAbsorptionCoefficient'
  | 'LinearAcceleration'
  | 'LinearAttenuationCoefficient'
  | 'LinearBitDensity'
  | 'LinearCompressibility'
  | 'LinearDensity'
  | 'LinearElectricCharge'
  | 'LinearElectricChargeDensity'
  | 'LinearElectricCurrent'
  | 'LinearElectricCurrentDensity'
  | 'LinearEnergyTransfer'
  | 'LinearExpansionCoefficient'
  | 'LinearForce'
  | 'LinearIonization'
  | 'LinearLogarithmicRatio'
  | 'LinearMass'
  | 'LinearMomentum'
  | 'LinearNumberDensity'
  | 'LinearPower'
  | 'LinearResistance'
  | 'LinearStiffness'
  | 'LinearStrain'
  | 'LinearThermalExpansion'
  | 'LinearTorque'
  | 'LinearVelocity'
  | 'LinearVoltageCoefficient'
  | 'LineicCharge'
  | 'LineicDataVolume'
  | 'LineicLogarithmicRatio'
  | 'LineicMass'
  | 'LineicPower'
  | 'LineicQuantity'
  | 'LineicResistance'
  | 'LineicResolution'
  | 'LineicTorque'
  | 'LinkedFlux'
  | 'LiquidLevel'
  | 'LiquidVolume'
  | 'Log10FrequencyInterval'
  | 'Log10Ratio'
  | 'LogERatio'
  | 'LogOctanolAirPartitionCoefficient'
  | 'LogOctanolWaterPartitionCoefficient'
  | 'LogarithmRatioToBase10'
  | 'LogarithmRatioToBaseE'
  | 'LogarithmicFrequencyInterval'
  | 'LogarithmicFrequencyIntervalToBase10'
  | 'LogarithmicMedianInformationFlow_SourceToBase10'
  | 'LogarithmicMedianInformationFlow_SourceToBase2'
  | 'LogarithmicMedianInformationFlow_SourceToBaseE'
  | 'LondonPenetrationDepth'
  | 'Long-RangeOrderParameter'
  | 'LongRangeOrderParameter'
  | 'LorenzCoefficient'
  | 'LossAngle'
  | 'LossFactor'
  | 'Loudness'
  | 'LoudnessLevel'
  | 'LowerCriticalMagneticFluxDensity'
  | 'Luminance'
  | 'LuminousEfficacy'
  | 'LuminousEmittance'
  | 'LuminousEnergy'
  | 'LuminousExitance'
  | 'LuminousExposure'
  | 'LuminousFlux'
  | 'LuminousFluxPerArea'
  | 'LuminousFluxRatio'
  | 'LuminousIntensity'
  | 'LuminousIntensityDistribution'
  | 'MASS-DELIVERED'
  | 'MASS-GROWTH-ALLOWANCE'
  | 'MASS-MARGIN'
  | 'MASS-PROPERTY-UNCERTAINTY'
  | 'MOMENT-OF-INERTIA_Y'
  | 'MOMENT-OF-INERTIA_Z'
  | 'MachNumber'
  | 'MacroscopicCrossSection'
  | 'MacroscopicTotalCrossSection'
  | 'MadelungConstant'
  | 'MagneticAreaMoment'
  | 'MagneticDipoleMoment'
  | 'MagneticDipoleMomentOfAMolecule'
  | 'MagneticField'
  | 'MagneticFieldStrength'
  | 'MagneticFieldStrength_H'
  | 'MagneticFlux'
  | 'MagneticFluxDensity'
  | 'MagneticFluxDensityOrMagneticPolarization'
  | 'MagneticFluxPerLength'
  | 'MagneticMoment'
  | 'MagneticPolarization'
  | 'MagneticQuantumNumber'
  | 'MagneticReluctivity'
  | 'MagneticSusceptability'
  | 'MagneticTension'
  | 'MagneticVectorPotential'
  | 'Magnetization'
  | 'MagnetizationField'
  | 'MagnetomotiveForce'
  | 'Mass'
  | 'MassAbsorptionCoefficient'
  | 'MassAmountOfSubstance'
  | 'MassAmountOfSubstanceTemperature'
  | 'MassAttenuationCoefficient'
  | 'MassBasedBloodGlucoseLevel'
  | 'MassConcentration'
  | 'MassConcentrationOfWater'
  | 'MassConcentrationOfWaterVapour'
  | 'MassConcentrationRateOfChange'
  | 'MassDefect'
  | 'MassDensity'
  | 'MassEnergyTransferCoefficient'
  | 'MassEquivalent'
  | 'MassExcess'
  | 'MassFlowRate'
  | 'MassFluxDensity'
  | 'MassFraction'
  | 'MassFractionOfDryMatter'
  | 'MassFractionOfWater'
  | 'MassNumber'
  | 'MassOfElectricalPowerSupply'
  | 'MassOfSolidBooster'
  | 'MassOfTheEarth'
  | 'MassPerArea'
  | 'MassPerAreaTime'
  | 'MassPerElectricCharge'
  | 'MassPerEnergy'
  | 'MassPerLength'
  | 'MassPerTime'
  | 'MassRatio'
  | 'MassRatioOfWaterToDryMatter'
  | 'MassRatioOfWaterVapourToDryGas'
  | 'MassRelatedElectricalCurrent'
  | 'MassSpecificBiogeochemicalRate'
  | 'MassStoppingPower'
  | 'MassTemperature'
  | 'MassicActivity'
  | 'MassicElectricCurrent'
  | 'MassicHeatCapacity'
  | 'MassicPower'
  | 'MassicTorque'
  | 'MassieuFunction'
  | 'MaxExpectedOperatingThrust'
  | 'MaxOperatingThrust'
  | 'MaxSeaLevelThrust'
  | 'MaximumBeta-ParticleEnergy'
  | 'MaximumBetaParticleEnergy'
  | 'MaximumExpectedOperatingPressure'
  | 'MaximumOperatingPressure'
  | 'MeanEnergyImparted'
  | 'MeanFreePath'
  | 'MeanLifetime'
  | 'MeanLinearRange'
  | 'MeanMassRange'
  | 'MechanicalEnergy'
  | 'MechanicalImpedance'
  | 'MechanicalMobility'
  | 'MechanicalSurfaceImpedance'
  | 'MechanicalTension'
  | 'MeltingPoint'
  | 'MicroCanonicalPartitionFunction'
  | 'MicrobialFormation'
  | 'MigrationArea'
  | 'MigrationLength'
  | 'Mobility'
  | 'MobilityRatio'
  | 'ModulusOfAdmittance'
  | 'ModulusOfElasticity'
  | 'ModulusOfImpedance'
  | 'ModulusOfLinearSubgradeReaction'
  | 'ModulusOfRotationalSubgradeReaction'
  | 'ModulusOfSubgradeReaction'
  | 'MoistureDiffusivity'
  | 'MolalityOfSolute'
  | 'MolarAbsorptionCoefficient'
  | 'MolarAngularMomentum'
  | 'MolarAttenuationCoefficient'
  | 'MolarConductivity'
  | 'MolarDensity'
  | 'MolarEnergy'
  | 'MolarEntropy'
  | 'MolarEquivalent'
  | 'MolarFlowRate'
  | 'MolarFluxDensity'
  | 'MolarFluxDensityVariance'
  | 'MolarFluxDensityVariance_NEON'
  | 'MolarHeatCapacity'
  | 'MolarInternalEnergy'
  | 'MolarMass'
  | 'MolarOpticalRotationalAbility'
  | 'MolarOpticalRotatoryPower'
  | 'MolarRefractivity'
  | 'MolarThermalCapacity'
  | 'MolarThermodynamicEnergy'
  | 'MolarVolume'
  | 'MoleFraction'
  | 'MolecularConcentration'
  | 'MolecularMass'
  | 'MolecularViscosity'
  | 'MomentOfForce'
  | 'MomentOfInertia'
  | 'MomentOfInertia_Y'
  | 'MomentOfInertia_Z'
  | 'Momentum'
  | 'MomentumPerAngle'
  | 'MorbidityRate'
  | 'MortalityRate'
  | 'MotorConstant'
  | 'MultiplicationFactor'
  | 'MutualInductance'
  | 'NOMINAL-ASCENT-PROPELLANT-MASS'
  | 'NapierianAbsorbance'
  | 'NaturalLogarithmicMedianInformationFlow'
  | 'NeelTemperature'
  | 'NetTonnage'
  | 'NeutralRatio'
  | 'NeutronDiffusionCoefficient'
  | 'NeutronDiffusionLength'
  | 'NeutronNumber'
  | 'NeutronYieldPerAbsorption'
  | 'NeutronYieldPerFission'
  | 'Non-LeakageProbability'
  | 'NonActivePower'
  | 'NonLeakageProbability'
  | 'NonNegativeLength'
  | 'NormalStress'
  | 'NormalizedDimensionlessRatio'
  | 'NuclearEnergy'
  | 'NuclearQuadrupoleMoment'
  | 'NuclearRadius'
  | 'NuclearSpinQuantumNumber'
  | 'NucleonNumber'
  | 'NumberDensity'
  | 'NumberOfElectricalPhases'
  | 'NumberOfParticles'
  | 'OlfactoryThreshold'
  | 'OpeningRatio'
  | 'OrbitalAngularMomentumPerMass'
  | 'OrbitalAngularMomentumQuantumNumber'
  | 'OrbitalRadialDistance'
  | 'OrderOfReflection'
  | 'OsmoticCoefficient'
  | 'OsmoticConcentration'
  | 'OsmoticPressure'
  | 'OverRangeDistance'
  | 'PREDICTED-MASS'
  | 'PRODUCT-OF-INERTIA'
  | 'PRODUCT-OF-INERTIA_X'
  | 'PRODUCT-OF-INERTIA_Y'
  | 'PRODUCT-OF-INERTIA_Z'
  | 'Pace'
  | 'PackingFraction'
  | 'PartialPressure'
  | 'ParticleCurrent'
  | 'ParticleCurrentDensity'
  | 'ParticleFluence'
  | 'ParticleFluenceRate'
  | 'ParticleNumberDensity'
  | 'ParticlePositionVector'
  | 'ParticleSourceDensity'
  | 'PathLength'
  | 'PayloadMass'
  | 'PayloadRatio'
  | 'PeltierCoefficient'
  | 'Period'
  | 'Permeability'
  | 'PermeabilityRatio'
  | 'Permeance'
  | 'Permittivity'
  | 'PermittivityRatio'
  | 'PhaseCoefficient'
  | 'PhaseDifference'
  | 'PhaseSpeedOfSound'
  | 'PhononMeanFreePath'
  | 'PhotoThresholdOfAwarenessFunction'
  | 'PhotonIntensity'
  | 'PhotonLuminance'
  | 'PhotonRadiance'
  | 'PhotosyntheticPhotonFlux'
  | 'PhotosyntheticPhotonFluxDensity'
  | 'PictureElement'
  | 'Piece'
  | 'PlanarForce'
  | 'PlanckFunction'
  | 'PlaneAngle'
  | 'PlasmaLevel'
  | 'PoissonRatio'
  | 'PolarMomentOfInertia'
  | 'Polarizability'
  | 'PolarizationField'
  | 'Population'
  | 'PositionVector'
  | 'PositiveDimensionlessRatio'
  | 'PositiveLength'
  | 'PositivePlaneAngle'
  | 'PotentialEnergy'
  | 'Power'
  | 'PowerArea'
  | 'PowerAreaPerSolidAngle'
  | 'PowerConstant'
  | 'PowerDensity'
  | 'PowerFactor'
  | 'PowerPerArea'
  | 'PowerPerAreaAngle'
  | 'PowerPerAreaQuarticTemperature'
  | 'PowerPerElectricCharge'
  | 'PowerPerVolume'
  | 'PoyntingVector'
  | 'Pressure'
  | 'PressureBasedAmountOfSubstanceConcentration'
  | 'PressureBasedDensity'
  | 'PressureBasedDynamicViscosity'
  | 'PressureBasedElectricCurrent'
  | 'PressureBasedElectricVoltage'
  | 'PressureBasedKinematicViscosity'
  | 'PressureBasedLength'
  | 'PressureBasedMass'
  | 'PressureBasedMassFlow'
  | 'PressureBasedMolality'
  | 'PressureBasedQuantity'
  | 'PressureBasedTemperature'
  | 'PressureBasedVelocity'
  | 'PressureBasedVolume'
  | 'PressureBasedVolumeFlow'
  | 'PressureBurningRateConstant'
  | 'PressureBurningRateIndex'
  | 'PressureCoefficient'
  | 'PressureGradient'
  | 'PressureInRelationToVolumeFlow'
  | 'PressureInRelationToVolumeFlowRate'
  | 'PressureLossPerLength'
  | 'PressureRatio'
  | 'Prevalence'
  | 'PrincipalQuantumNumber'
  | 'ProductOfInertia'
  | 'ProductOfInertia_X'
  | 'ProductOfInertia_Y'
  | 'ProductOfInertia_Z'
  | 'PropagationCoefficient'
  | 'QualityFactor'
  | 'QuantityOfLight'
  | 'QuantumNumber'
  | 'QuarticElectricDipoleMomentPerCubicEnergy'
  | 'RESERVE-MASS'
  | 'RF-Power'
  | 'RFPower'
  | 'RadialDistance'
  | 'Radiance'
  | 'RadianceFactor'
  | 'RadiantEmmitance'
  | 'RadiantEnergy'
  | 'RadiantEnergyDensity'
  | 'RadiantEnergyExposure'
  | 'RadiantExposure'
  | 'RadiantFluence'
  | 'RadiantFluenceRate'
  | 'RadiantFlux'
  | 'RadiantIntensity'
  | 'RadiativeHeatTransfer'
  | 'RadioactiveDecay'
  | 'Radioactivity'
  | 'Radiosity'
  | 'Radius'
  | 'RadiusOfCurvature'
  | 'RankineTemperature'
  | 'RateOfChange'
  | 'RateOfChangeOfFrequency'
  | 'RateOfRiseOfOffStateVoltage'
  | 'RateOfRiseOfVoltage'
  | 'Ratio'
  | 'RatioOfSpecificHeatCapacities'
  | 'Reactance'
  | 'ReactionEnergy'
  | 'ReactiveCharge'
  | 'ReactiveChargePerMass'
  | 'ReactiveEnergy'
  | 'ReactivePower'
  | 'Reactivity'
  | 'ReactorTimeConstant'
  | 'ReciprocalElectricResistance'
  | 'ReciprocalEnergy'
  | 'ReciprocalPlaneAngle'
  | 'ReciprocalVoltage'
  | 'RecombinationCoefficient'
  | 'Reflectance'
  | 'ReflectanceFactor'
  | 'Reflectivity'
  | 'RefractiveIndex'
  | 'RelativeAtomicMass'
  | 'RelativeHumidity'
  | 'RelativeMassConcentrationOfVapour'
  | 'RelativeMassDefect'
  | 'RelativeMassDensity'
  | 'RelativeMassExcess'
  | 'RelativeMassRatioOfVapour'
  | 'RelativeMolecularMass'
  | 'RelativePartialPressure'
  | 'RelativePermittivity'
  | 'RelativePressureCoefficient'
  | 'RelaxationTIme'
  | 'RelaxationTime'
  | 'Reluctance'
  | 'Repetency'
  | 'ResidualResistivity'
  | 'Resistance'
  | 'ResistanceBasedInductance'
  | 'ResistanceRatio'
  | 'Resistivity'
  | 'ResonanceEnergy'
  | 'ResonanceEscapeProbability'
  | 'ResonanceEscapeProbabilityForFission'
  | 'RespiratoryRate'
  | 'RestEnergy'
  | 'RestMass'
  | 'ReverberationTime'
  | 'ReynoldsNumber'
  | 'RichardsonConstant'
  | 'RiseOfOffStateVoltage'
  | 'Rotary-TranslatoryMotionConversion'
  | 'RotaryShock'
  | 'RotaryTranslatoryMotionConversion'
  | 'RotationalFrequency'
  | 'RotationalMass'
  | 'RotationalStiffness'
  | 'RotationalVelocity'
  | 'ScalarMagneticPotential'
  | 'SecondAxialMomentOfArea'
  | 'SecondMomentOfArea'
  | 'SecondOrderReactionRateConstant'
  | 'SecondPolarMomentOfArea'
  | 'SecondRadiationConstant'
  | 'SectionAreaIntegral'
  | 'SectionModulus'
  | 'SeebeckCoefficient'
  | 'SerumLevel'
  | 'SerumOrPlasmaLevel'
  | 'ServiceFactor'
  | 'ShannonDiversityIndex'
  | 'ShearModulus'
  | 'ShearStrain'
  | 'ShearStress'
  | 'Short-RangeOrderParameter'
  | 'ShortRangeOrderParameter'
  | 'SignalDetectionThreshold'
  | 'SignalStrength'
  | 'Slowing-DownArea'
  | 'Slowing-DownDensity'
  | 'Slowing-DownLength'
  | 'SlowingDownArea'
  | 'SlowingDownDensity'
  | 'SlowingDownLength'
  | 'SoilAdsorptionCoefficient'
  | 'SolidAngle'
  | 'SolidStateDiffusionLength'
  | 'Solubility_Water'
  | 'SoundEnergyDensity'
  | 'SoundExposure'
  | 'SoundExposureLevel'
  | 'SoundIntensity'
  | 'SoundParticleAcceleration'
  | 'SoundParticleDisplacement'
  | 'SoundParticleVelocity'
  | 'SoundPower'
  | 'SoundPowerLevel'
  | 'SoundPressure'
  | 'SoundPressureLevel'
  | 'SoundReductionIndex'
  | 'SoundVolumeVelocity'
  | 'SourceVoltage'
  | 'SourceVoltageBetweenSubstances'
  | 'SpatialSummationFunction'
  | 'SpecificAcousticImpedance'
  | 'SpecificActivity'
  | 'SpecificElectricCharge'
  | 'SpecificElectricCurrent'
  | 'SpecificEnergy'
  | 'SpecificEnergyImparted'
  | 'SpecificEnthalpy'
  | 'SpecificEntropy'
  | 'SpecificGibbsEnergy'
  | 'SpecificHeatCapacity'
  | 'SpecificHeatCapacityAtConstantPressure'
  | 'SpecificHeatCapacityAtConstantVolume'
  | 'SpecificHeatCapacityAtSaturation'
  | 'SpecificHeatPressure'
  | 'SpecificHeatVolume'
  | 'SpecificHeatsRatio'
  | 'SpecificHelmholtzEnergy'
  | 'SpecificHumidity'
  | 'SpecificImpulse'
  | 'SpecificImpulseByMass'
  | 'SpecificImpulseByWeight'
  | 'SpecificInternalEnergy'
  | 'SpecificModulus'
  | 'SpecificOpticalRotationalAbility'
  | 'SpecificOpticalRotatoryPower'
  | 'SpecificPower'
  | 'SpecificSurfaceArea'
  | 'SpecificThrust'
  | 'SpecificVolume'
  | 'SpecificWeight'
  | 'SpectralAngularCrossSection'
  | 'SpectralConcentrationOfRadiantEnergyDensity'
  | 'SpectralConcentrationOfVibrationalModes'
  | 'SpectralCrossSection'
  | 'SpectralDensityOfVibrationalModes'
  | 'SpectralEmittance'
  | 'SpectralIrradiance'
  | 'SpectralLuminousEfficiency'
  | 'SpectralRadiance'
  | 'SpectralRadiantEnergyDensity'
  | 'SpectralRadiantEnergyDensityInTermsOfWavelength'
  | 'Speed'
  | 'SpeedOfLight'
  | 'SpeedOfSound'
  | 'SpeedRatio'
  | 'SphericalIlluminance'
  | 'Spin'
  | 'SpinQuantumNumber'
  | 'SquareEnergy'
  | 'SquareTime'
  | 'StandardAbsoluteActivity'
  | 'StandardChemicalPotential'
  | 'StandardGravitationalParameter'
  | 'StateDensity'
  | 'StateDensityAsExpressionOfAngularFrequency'
  | 'StateOfCharge'
  | 'StaticFriction'
  | 'StaticFrictionCoefficient'
  | 'StaticPressure'
  | 'StatisticalWeight'
  | 'StochasticProcess'
  | 'StoichiometricNumber'
  | 'Strain'
  | 'StrainEnergyDensity'
  | 'StrainEnergyReleaseRate'
  | 'Stress'
  | 'StressIntensityFactor'
  | 'StressOpticCoefficient'
  | 'StructuralEfficiency'
  | 'StructureFactor'
  | 'SunProtectionFactorOfAProduct'
  | 'SuperconductionTransitionTemperature'
  | 'SuperconductorEnergyGap'
  | 'SurfaceActivityDensity'
  | 'SurfaceCoefficientOfHeatTransfer'
  | 'SurfaceDensity'
  | 'SurfaceRelatedVolumeFlow'
  | 'SurfaceRelatedVolumeFlowRate'
  | 'SurfaceTension'
  | 'SurgeImpedanceOfTheMedium'
  | 'Susceptance'
  | 'SymbolTransmissionRate'
  | 'SystolicBloodPressure'
  | 'TARGET-BOGIE-MASS'
  | 'Temperature'
  | 'TemperatureAmountOfSubstance'
  | 'TemperatureBasedAmountOfSubstanceConcentration'
  | 'TemperatureBasedDensity'
  | 'TemperatureBasedDynamicViscosity'
  | 'TemperatureBasedKinematicViscosity'
  | 'TemperatureBasedLength'
  | 'TemperatureBasedMass'
  | 'TemperatureBasedMassFlowRate'
  | 'TemperatureBasedQuantity'
  | 'TemperatureBasedVelocity'
  | 'TemperatureBasedVolumeFlowRate'
  | 'TemperatureDifference'
  | 'TemperatureGradient'
  | 'TemperaturePerMagneticFluxDensity'
  | 'TemperaturePerSquareTime'
  | 'TemperaturePerTime'
  | 'TemperaturePerTime_Squared'
  | 'TemperatureRateOfChange'
  | 'TemperatureRatio'
  | 'TemperatureRelatedMolarMass'
  | 'TemperatureRelatedVolume'
  | 'TemperatureVariance'
  | 'TemperatureVariance_NEON'
  | 'TemporalSummationFunction'
  | 'Tension'
  | 'ThermalAdmittance'
  | 'ThermalCapacitance'
  | 'ThermalCoefficientOfLinearExpansion'
  | 'ThermalConductance'
  | 'ThermalConductivity'
  | 'ThermalDiffusionFactor'
  | 'ThermalDiffusionRatio'
  | 'ThermalDiffusionRatioCoefficient'
  | 'ThermalDiffusivity'
  | 'ThermalEfficiency'
  | 'ThermalEnergy'
  | 'ThermalEnergyLength'
  | 'ThermalExpansionCoefficient'
  | 'ThermalInertia'
  | 'ThermalInsulance'
  | 'ThermalInsulation'
  | 'ThermalPower'
  | 'ThermalResistance'
  | 'ThermalResistivity'
  | 'ThermalTransmittance'
  | 'ThermalUtilizationFactor'
  | 'ThermalUtilizationFactorForFission'
  | 'ThermodynamicCriticalMagneticFluxDensity'
  | 'ThermodynamicEnergy'
  | 'ThermodynamicEntropy'
  | 'ThermodynamicTemperature'
  | 'Thickness'
  | 'ThomsonCoefficient'
  | 'Thrust'
  | 'ThrustCoefficient'
  | 'ThrustToMassRatio'
  | 'ThrustToWeightRatio'
  | 'Tilt'
  | 'Time'
  | 'TimeAveragedSoundIntensity'
  | 'TimeConstant_Inductance'
  | 'TimePerCount'
  | 'TimeRatio'
  | 'TimeRelatedLogarithmicRatio'
  | 'TimeTemperature'
  | 'Time_Squared'
  | 'Torque'
  | 'TorqueConstant'
  | 'TorquePerAngle'
  | 'TorquePerLength'
  | 'TorsionalRigidity'
  | 'TorsionalSpringConstant'
  | 'TotalAngularMomentum'
  | 'TotalAngularMomentumQuantumNumber'
  | 'TotalAtomicStoppingPower'
  | 'TotalCrossSection'
  | 'TotalCurrent'
  | 'TotalCurrentDensity'
  | 'TotalIonization'
  | 'TotalLinearStoppingPower'
  | 'TotalMassStoppingPower'
  | 'TotalPressure'
  | 'TotalRadiance'
  | 'TouchThresholds'
  | 'TrafficIntensity'
  | 'TransmissionRatioBetweenRotationAndTranslation'
  | 'Transmittance'
  | 'TransmittanceDensity'
  | 'Turbidity'
  | 'Turns'
  | 'Unbalance'
  | 'Unknown'
  | 'UpperCriticalMagneticFluxDensity'
  | 'VacuumThrust'
  | 'VaporPermeability'
  | 'VaporPermeance'
  | 'VaporPressure'
  | 'VapourPermeability'
  | 'VapourPermeance'
  | 'VapourPressure'
  | 'Velocity'
  | 'VentilationRatePerFloorArea'
  | 'VerticalVelocity'
  | 'VibrationalDensityOfStates'
  | 'VideoFrameRate'
  | 'Viscosity'
  | 'VisibleRadiantEnergy'
  | 'VisionThresholds'
  | 'Voltage'
  | 'VoltageImbalance'
  | 'VoltagePhasor'
  | 'VoltageRatio'
  | 'Volume'
  | 'VolumeDensityOfCharge'
  | 'VolumeFlowRate'
  | 'VolumeFlowRate_SurfaceRelated'
  | 'VolumeFlowRatio'
  | 'VolumeFraction'
  | 'VolumeOrSectionModulus'
  | 'VolumePerArea'
  | 'VolumePerTime'
  | 'VolumeStrain'
  | 'VolumeThermalExpansion'
  | 'VolumetricBitDensity'
  | 'VolumetricElectricCharge'
  | 'VolumetricEntityDensity'
  | 'VolumetricFlux'
  | 'VolumetricHeatCapacity'
  | 'VolumetricOutputPower'
  | 'VolumicAmountOfSubstance'
  | 'VolumicDataQuantity'
  | 'VolumicElectromagneticEnergy'
  | 'VolumicOutput'
  | 'Vorticity'
  | 'WarmReceptorThreshold'
  | 'WarpingConstant'
  | 'WarpingMoment'
  | 'WaterHorsepower'
  | 'WaterSolubility'
  | 'WaterVaporDiffusionCoefficient'
  | 'WaterVapourDiffusionCoefficient'
  | 'WaterVapourPermeability'
  | 'Wavelength'
  | 'Wavenumber'
  | 'WebTime'
  | 'WebTimeAveragePressure'
  | 'WebTimeAverageThrust'
  | 'Weight'
  | 'WetBulbTemperature'
  | 'Width'
  | 'Work'
  | 'WorkFunction'
  | 'ZenithAngle'
export type TensorQuantityKindName =
  | 'Acceleration'
  | 'AngularAcceleration'
  | 'AngularImpulse'
  | 'AngularMomentum'
  | 'AngularMomentumPerAngle'
  | 'AngularReciprocalLatticeVector'
  | 'AngularVelocity'
  | 'AreicChargeDensityOrElectricFluxDensityOrElectricPolarization'
  | 'AuxillaryMagneticField'
  | 'AverageVacuumThrust'
  | 'BurgersVector'
  | 'CENTER-OF-MASS'
  | 'CartesianCoordinates'
  | 'Conductivity'
  | 'Debye-WallerFactor'
  | 'DebyeWallerFactor'
  | 'DiffusionCoefficient'
  | 'DiffusionCoefficientForFluenceRate'
  | 'Displacement'
  | 'DisplacementCurrentDensity'
  | 'DisplacementVectorOfIon'
  | 'DragForce'
  | 'ElectricConductivity'
  | 'ElectricCurrentDensity'
  | 'ElectricDipoleMoment'
  | 'ElectricDisplacement'
  | 'ElectricDisplacementField'
  | 'ElectricField'
  | 'ElectricFieldStrength'
  | 'ElectricFluxDensity'
  | 'ElectricPolarizability'
  | 'ElectricPolarization'
  | 'ElectricQuadrupoleMoment'
  | 'ElectricSusceptibility'
  | 'ElectrolyticConductivity'
  | 'ElectromagneticPermeability'
  | 'ElectromagneticPermeabilityRatio'
  | 'ElectronMobility'
  | 'EquilibriumPositionVectorOfIon'
  | 'Force'
  | 'ForcePerElectricCharge'
  | 'FundamentalLatticeVector'
  | 'FundamentalReciprocalLatticeVector'
  | 'Gradient'
  | 'GravitationalAttraction'
  | 'HeatFlowRatePerArea'
  | 'HeatFluxDensity'
  | 'HydraulicPermeability'
  | 'Impulse'
  | 'InitialVelocity'
  | 'InversePermittivity'
  | 'KinematicViscosityOrDiffusionConstantOrThermalDiffusivity'
  | 'LatticeVector'
  | 'LiftForce'
  | 'LinearAcceleration'
  | 'LinearElectricCurrentDensity'
  | 'LinearMomentum'
  | 'LinearVelocity'
  | 'MagneticAreaMoment'
  | 'MagneticDipoleMoment'
  | 'MagneticDipoleMomentOfAMolecule'
  | 'MagneticField'
  | 'MagneticFieldStrength'
  | 'MagneticFieldStrength_H'
  | 'MagneticFluxDensity'
  | 'MagneticFluxDensityOrMagneticPolarization'
  | 'MagneticMoment'
  | 'MagneticPolarization'
  | 'MagneticReluctivity'
  | 'MagneticSusceptability'
  | 'MagneticVectorPotential'
  | 'Magnetization'
  | 'MagnetizationField'
  | 'MassFluxDensity'
  | 'MechanicalMobility'
  | 'Mobility'
  | 'MoistureDiffusivity'
  | 'MolarAngularMomentum'
  | 'MolarConductivity'
  | 'MolarFluxDensity'
  | 'MomentOfForce'
  | 'MomentOfInertia'
  | 'Momentum'
  | 'MomentumPerAngle'
  | 'NeutronDiffusionCoefficient'
  | 'NuclearQuadrupoleMoment'
  | 'OrbitalAngularMomentumPerMass'
  | 'ParticleCurrentDensity'
  | 'ParticlePositionVector'
  | 'PeltierCoefficient'
  | 'Permeability'
  | 'PermeabilityRatio'
  | 'Permittivity'
  | 'PermittivityRatio'
  | 'Polarizability'
  | 'PolarizationField'
  | 'PositionVector'
  | 'PoyntingVector'
  | 'PressureGradient'
  | 'RelativePermittivity'
  | 'ResidualResistivity'
  | 'Resistivity'
  | 'SeebeckCoefficient'
  | 'SoundIntensity'
  | 'SoundParticleAcceleration'
  | 'SoundParticleDisplacement'
  | 'SoundParticleVelocity'
  | 'Spin'
  | 'Strain'
  | 'Stress'
  | 'TemperatureGradient'
  | 'ThermalConductivity'
  | 'ThermalDiffusionRatioCoefficient'
  | 'ThermalDiffusivity'
  | 'ThermalExpansionCoefficient'
  | 'ThermalResistivity'
  | 'Thrust'
  | 'TimeAveragedSoundIntensity'
  | 'Torque'
  | 'TotalAngularMomentum'
  | 'TotalCurrentDensity'
  | 'VacuumThrust'
  | 'VaporPermeability'
  | 'VapourPermeability'
  | 'Velocity'
  | 'VolumetricFlux'
  | 'Vorticity'
  | 'WaterVaporDiffusionCoefficient'
  | 'WaterVapourDiffusionCoefficient'
  | 'WebTimeAverageThrust'
  | 'Weight'
export type ScalarQuantityKindName = Exclude<QuantityKindName, TensorQuantityKindName>
type QuantityBasisMetadata<Name extends QuantityKindName> =
  [Name] extends [ScalarQuantityKindName]
    ? Readonly<{ basis?: never }>
    : [Name] extends [TensorQuantityKindName]
      ? Readonly<{ basis: CartesianBasis }>
      : Readonly<{ basis?: CartesianBasis }>
export type QuantityMetadata<Name extends QuantityKindName = QuantityKindName> = Readonly<{
  unit: UcumUnit
  quantityKind: Name
}> & QuantityBasisMetadata<Name>
type DataAxisBase = Readonly<{
  length: number
  name?: string
  ticks?: readonly (number | string)[]
}>
export type DataAxis = DataAxisBase & Readonly<
  | { unit: UcumUnit; quantityKind: ScalarQuantityKindName }
  | { unit?: never; quantityKind?: never }
>
type DataValueDescriptorBase = Readonly<{
  axes?: readonly DataAxis[]
  value: boolean | string | number | readonly unknown[]
}>
export type DataValueDescriptor = DataValueDescriptorBase & Readonly<
  | ({
    dtype: FloatDataDType
  } & (
    QuantityMetadata<ScalarQuantityKindName>
    | QuantityMetadata<TensorQuantityKindName>
  ))
  | {
    dtype: NonFloatDataDType
    unit?: never
    quantityKind?: never
    basis?: never
  }
>
export type ScalarValue = boolean | string | number
export type ExperimentParameter = ScalarValue | DataValueDescriptor
export type ExperimentParameters = Readonly<Record<string, ExperimentParameter>>
type RecordedDataResultAxisBase = Readonly<{
  length?: number
  name?: string
  ticks?: readonly (number | string)[]
}>
export type RecordedDataResultAxis = RecordedDataResultAxisBase & Readonly<
  | { unit: UcumUnit; quantityKind: ScalarQuantityKindName }
  | { unit?: never; quantityKind?: never }
>
type RecordedDataResultBase = Readonly<{
  axes?: readonly RecordedDataResultAxis[]
}>
export type RecordedDataResult = RecordedDataResultBase & Readonly<
  | ({
    dtype: FloatDataDType
  } & (
    QuantityMetadata<ScalarQuantityKindName>
    | QuantityMetadata<TensorQuantityKindName>
  ))
  | {
    dtype: NonFloatDataDType
    unit?: never
    quantityKind?: never
    basis?: never
  }
>
export type ExperimentRule<TParameters extends ExperimentParameters = ExperimentParameters> = Readonly<{
  target: readonly ExperimentTarget[]
  label: string
  methodId: string
  parameters: TParameters
}>
export type RecordedDataRule<TParameters extends ExperimentParameters = ExperimentParameters> = Readonly<
  ExperimentRule<TParameters> & { result: RecordedDataResult }
>
export type RecordedDataAxis = Readonly<{
  ticks?: readonly (number | string)[]
}>
export type RecordedDataTensor = Readonly<{
  value: boolean | string | number | readonly unknown[]
  axes?: readonly RecordedDataAxis[]
}>
export type RecordedData = Readonly<Record<string, RecordedDataTensor>>

export type BoxAttributes = Readonly<{
  size: Vec3
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
}>

export type CylinderAttributes = Readonly<{
  radius: number
  radius_2?: number
  height: number
  segments?: number
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
}>

export type CurvedEdgeCylinderFourierMode = Readonly<{
  amplitude: number
  phase: number
}>
export type CurvedEdgeCylinderTaylorCurve = Readonly<{
  origin: number
  coefficients: readonly number[]
}>
export type CurvedEdgeCylinderAttributes = Readonly<{
  height: number
  azimuthalCurve: readonly CurvedEdgeCylinderFourierMode[]
  verticalCurve: CurvedEdgeCylinderTaylorCurve
  azimuthalSegments?: number
  verticalSegments?: number
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
}>

export type CurvedSurfaceSphereFourierMode = Readonly<{
  amplitude: number
  phase: number
}>
export type CurvedSurfaceSphereAttributes = Readonly<{
  azimuthalCurve: readonly CurvedSurfaceSphereFourierMode[]
  polarCurve: readonly CurvedSurfaceSphereFourierMode[]
  azimuthalSegments?: number
  polarSegments?: number
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
}>

export type SphereAttributes = Readonly<{
  radius: number
  segments?: number
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
}>

export type FiberFourierMode = Readonly<{ amplitude: number; phase: number }>
export type FiberHelix = Readonly<{
  turns: number
  phase?: number
  radius: number | ((u: number, theta: number) => number)
}>
export type FiberAttributes = Readonly<{
  from: Vec3
  to: Vec3
  basePath?: (t: number) => Vec3
  radius: number | ((s: number) => number)
  helix?: FiberHelix
  fourier?: readonly FiberFourierMode[]
  envelopePower?: number
  up?: Vec3
  pathSegments?: number
  radialSegments?: number
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
}>

export type ArrayAttributes = Readonly<{
  shape: readonly [number, number, number]
  period: Vec3
  axes?: Readonly<{ x: Vec3; y: Vec3; z: Vec3 }>
  inject?: Readonly<Record<string, Tensor | Readonly<{ axis: Tensor; angle: Tensor }>>>
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
  children?: unknown
}>

export type ShellAttributes = Readonly<{
  offsets: readonly number[]
  pos?: Vec3
  rotate?: Rotation
  scale?: Vec3
  children?: unknown
}>

export type GeometryAttributes<P extends object = object> = Readonly<
  P & {
    id: string
    materials?: readonly Material[]
    pos?: Vec3
    rotate?: Rotation
    scale?: Vec3
    children?: unknown
  }
>
export type Geometry<P extends object = object> = (props: GeometryAttributes<P>) => unknown

export type MaterialDataValueDescriptor = Readonly<
  | (DataValueDescriptorBase & {
    dtype: FloatDataDType
    errorRate: number
  } & (
    QuantityMetadata<ScalarQuantityKindName>
    | QuantityMetadata<TensorQuantityKindName>
  ))
  | (DataValueDescriptorBase & {
    dtype: NonFloatDataDType
    errorRate?: never
    unit?: never
    quantityKind?: never
    basis?: never
  })
>
export type MaterialVariable = ScalarValue | MaterialDataValueDescriptor
export type MaterialVariables = Readonly<
  Record<string, MaterialVariable> & { color?: string }
>
export type ResolvedMaterialVariables = Readonly<
  Record<string, ScalarValue | DataValueDescriptor> & { color?: string }
>
export type SolverParameterValue = ScalarValue | DataValueDescriptor
export type SolverParameters = Readonly<Record<string, SolverParameterValue>>
export type ExperimentSolver = Readonly<{
  name: string
  version: string
  parameters: () => SolverParameters
}>
export type ResolvedExperimentSolver = Readonly<{
  name: string
  version: string
  parameters: SolverParameters
}>

export class CadModelError extends Error {
  constructor(message: string)
}

export function normalizeUcumUnit(value: unknown, path: string): UcumUnit
export function convertUcumValue(
  value: number,
  fromUnit: UcumUnit | undefined,
  toUnit: UcumUnit | undefined,
  path?: string,
): number
export function assertUcumUnitComparable(
  unit: UcumUnit | undefined,
  expectedUnit: UcumUnit | undefined,
  path: string,
): void
export function isFloatDType(dtype: DataDType): boolean

export class Material {
  constructor(symbol: string)
  constructor(symbol: string, variables: MaterialVariables)
  constructor(symbol: string, version: string)
  constructor(symbol: string, version: string, variables: MaterialVariables)
  readonly symbol: string
  readonly version?: string
  readonly variables: MaterialVariables
}

export class Structure {
  constructor(options: {
    geometry: () => unknown
    lengthUnit: UcumUnit
    varsSchema: Record<string, VarsSchemaEntry>
    geometryGroup?: StructureGroupMap
    surfaceGroup?: StructureGroupMap
  })
  readonly geometry: () => unknown
  readonly lengthUnit: UcumUnit
  readonly varsSchema: Readonly<Record<string, VarsSchemaEntry>>
  readonly geometryGroup: StructureGroupMap
  readonly surfaceGroup: StructureGroupMap
  randomVars(seed?: number): Vars
}

export class Experiment<
  TInitializationParameters extends ExperimentParameters = ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters = ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters = ExperimentParameters,
> extends Structure {
  constructor(options: {
    solver: ExperimentSolver
    geometry: () => unknown
    lengthUnit: UcumUnit
    varsSchema: Record<string, VarsSchemaEntry>
    geometryGroup?: StructureGroupMap
    surfaceGroup?: StructureGroupMap
    initializations?: () => readonly ExperimentRule<TInitializationParameters>[]
    boundaryConditions?: () => readonly ExperimentRule<TBoundaryConditionParameters>[]
    recordedData?: () => readonly RecordedDataRule<TRecordedDataParameters>[]
  })
  readonly solver: ExperimentSolver
  readonly initializations: () => readonly ExperimentRule<TInitializationParameters>[]
  readonly boundaryConditions: () => readonly ExperimentRule<TBoundaryConditionParameters>[]
  readonly recordedData: () => readonly RecordedDataRule<TRecordedDataParameters>[]
}

export abstract class VariableObject<TObject extends Structure> {
  protected constructor(object: TObject, partialVars?: Record<string, Tensor>)
  readonly object: TObject
  readonly vars: Vars
}

export class Sample extends VariableObject<Structure> {
  constructor(structure: Structure, partialVars?: Record<string, Tensor>)
  readonly structure: Structure
}

export class Setup<
  TInitializationParameters extends ExperimentParameters = ExperimentParameters,
  TBoundaryConditionParameters extends ExperimentParameters = ExperimentParameters,
  TRecordedDataParameters extends ExperimentParameters = ExperimentParameters,
> extends VariableObject<Experiment<
    TInitializationParameters,
    TBoundaryConditionParameters,
    TRecordedDataParameters
  >> {
  constructor(
    experiment: Experiment<
      TInitializationParameters,
      TBoundaryConditionParameters,
      TRecordedDataParameters
    >,
    partialVars?: Record<string, Tensor>,
  )
  readonly experiment: Experiment<
    TInitializationParameters,
    TBoundaryConditionParameters,
    TRecordedDataParameters
  >
}
