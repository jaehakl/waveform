# Material Parameter Catalog v0.1 (Draft)

Total canonical property keys: **260**

## Rules

- **canonical_key**: domain.property; do not encode direction, component, temperature, pressure, frequency, wavelength, species, phase, or model branch in the key
- **quantity_kind**: QUDT QuantityKind is an attribute, not the primary key. mdb:* denotes a small local QuantityKind extension where QUDT has no exact kind.
- **value_representation**: A property may be scalar, vector, tensor, complex, curve, table, or function.
- **model_parameters**: Constitutive-model coefficients belong under model.<model>.<parameter>, not in this flat physical-property catalog.
- **interface_properties**: interface.* records belong to a material/phase pair, not to one bulk material.

## Canonical keys

### acoustic (6)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `acoustic.characteristic_impedance` | 특성 음향 임피던스 | `qudt:CharacteristicAcousticImpedance` | extension | bulk | scalar_or_complex |
| `acoustic.impedance` | 음향 임피던스 | `qudt:AcousticImpedance` | extension | bulk | complex_curve |
| `acoustic.attenuation_coefficient` | 음향 감쇠계수 | `qudt:AttenuationCoefficient` | extension | bulk | curve |
| `acoustic.absorption_coefficient` | 흡음률 | `qudt:Absorptance` | extension | surface_or_assembly | curve |
| `acoustic.loss_factor` | 음향 손실계수 | `qudt:LossFactor` | extension | bulk | curve |
| `acoustic.flow_resistivity` | 유동저항률 | `mdb:FlowResistivity` | extension | bulk | scalar |

### chemical (13)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `chemical.ph` | pH | `qudt:Acidity` | extension | bulk | scalar |
| `chemical.ionic_strength` | 이온강도 | `qudt:IonicStrength` | extension | bulk | scalar |
| `chemical.first_order_rate_constant` | 1차 반응속도상수 | `qudt:InverseTime` | extension | bulk | scalar |
| `chemical.second_order_rate_constant` | 2차 반응속도상수 | `qudt:SecondOrderReactionRateConstant` | extension | bulk | scalar |
| `chemical.activation_energy` | 활성화에너지 | `qudt:MolarEnergy` | extension | bulk | scalar |
| `chemical.heat_of_reaction` | 반응열 | `qudt:MolarEnergy` | extension | bulk | scalar |
| `chemical.standard_enthalpy_of_formation` | 표준 생성 엔탈피 | `qudt:MolarEnergy` | extension | bulk | scalar |
| `chemical.standard_gibbs_energy_of_formation` | 표준 생성 깁스에너지 | `qudt:MolarEnergy` | extension | bulk | scalar |
| `chemical.standard_molar_entropy` | 표준 몰 엔트로피 | `qudt:MolarEntropy` | extension | bulk | scalar |
| `chemical.heating_value` | 발열량 | `qudt:HeatingValue` | extension | bulk | scalar |
| `chemical.flash_point` | 인화점 | `qudt:FlashPoint` | extension | bulk | scalar |
| `chemical.autoignition_temperature` | 자연발화온도 | `qudt:ThermodynamicTemperature` | extension | bulk | scalar |
| `chemical.catalytic_activity` | 촉매 활성 | `qudt:CatalyticActivity` | extension | bulk | scalar |

### combustion (3)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `combustion.laminar_flame_speed` | 층류 화염속도 | `qudt:Speed` | extension | bulk | table_or_function |
| `combustion.lower_flammability_limit` | 하한 가연한계 | `qudt:DimensionlessRatio` | extension | bulk | scalar |
| `combustion.upper_flammability_limit` | 상한 가연한계 | `qudt:DimensionlessRatio` | extension | bulk | scalar |

### coupled (8)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `coupled.piezoelectric_charge_coefficient` | 압전 전하계수 | `mdb:PiezoelectricChargeCoefficient` | extension | bulk | tensor |
| `coupled.piezoelectric_voltage_coefficient` | 압전 전압계수 | `mdb:PiezoelectricVoltageCoefficient` | extension | bulk | tensor |
| `coupled.piezoelectric_stress_coefficient` | 압전 응력계수 | `mdb:PiezoelectricStressCoefficient` | extension | bulk | tensor |
| `coupled.pyroelectric_coefficient` | 초전계수 | `mdb:PyroelectricCoefficient` | extension | bulk | vector |
| `coupled.piezoresistive_coefficient` | 압저항계수 | `mdb:PiezoresistiveCoefficient` | extension | bulk | tensor |
| `coupled.magnetostriction` | 자왜율 | `qudt:DimensionlessRatio` | extension | bulk | tensor_or_curve |
| `coupled.electrostriction_coefficient` | 전왜계수 | `mdb:ElectrostrictionCoefficient` | extension | bulk | tensor |
| `coupled.magnetoelectric_coefficient` | 자기전기 결합계수 | `mdb:MagnetoelectricCoefficient` | extension | bulk | tensor |

### electrical (15)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `electrical.conductivity` | 전기전도도 | `qudt:ElectricConductivity` | core | bulk | scalar_or_tensor_or_complex |
| `electrical.resistivity` | 비저항 | `qudt:Resistivity` | core | bulk | scalar_or_tensor_or_complex |
| `electrical.permittivity` | 유전율 | `qudt:Permittivity` | core | bulk | scalar_or_tensor_or_complex |
| `electrical.relative_permittivity` | 상대유전율 | `qudt:RelativePermittivity` | core | bulk | scalar_or_tensor_or_complex |
| `electrical.susceptibility` | 전기 감수율 | `qudt:ElectricSusceptibility` | extension | bulk | scalar_or_tensor_or_complex |
| `electrical.dielectric_strength` | 절연 파괴 전계강도 | `qudt:ElectricFieldStrength` | extension | bulk | scalar |
| `electrical.loss_tangent` | 유전 손실탄젠트 | `qudt:LossFactor` | extension | bulk | curve |
| `electrical.loss_angle` | 유전 손실각 | `qudt:LossAngle` | extension | bulk | curve |
| `electrical.polarization` | 전기 분극 | `qudt:ElectricPolarization` | extension | bulk | vector_or_curve |
| `electrical.work_function` | 일함수 | `qudt:WorkFunction` | extension | bulk | scalar |
| `electrical.hall_coefficient` | 홀 계수 | `qudt:HallCoefficient` | extension | bulk | scalar |
| `electrical.seebeck_coefficient` | 제벡 계수 | `qudt:SeebeckCoefficient` | extension | bulk | scalar_or_tensor |
| `electrical.peltier_coefficient` | 펠티에 계수 | `qudt:PeltierCoefficient` | extension | bulk | scalar_or_tensor |
| `electrical.surface_resistance` | 표면저항 | `qudt:Resistance` | extension | surface | scalar |
| `electrical.dielectric_relaxation_time` | 유전 완화시간 | `qudt:RelaxationTime` | extension | bulk | scalar |

### electrochemical (14)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `electrochemical.ionic_conductivity` | 이온전도도 | `qudt:ElectrolyticConductivity` | extension | bulk | scalar_or_tensor |
| `electrochemical.molar_conductivity` | 몰 전도도 | `qudt:MolarConductivity` | extension | bulk | scalar |
| `electrochemical.ion_diffusion_coefficient` | 이온 확산계수 | `qudt:DiffusionCoefficient` | extension | bulk | scalar_or_tensor |
| `electrochemical.transport_number` | 이온 수송수 | `qudt:IonTransportNumber` | extension | bulk | scalar |
| `electrochemical.open_circuit_potential` | 개방회로전위 | `qudt:ElectricPotential` | extension | bulk | curve |
| `electrochemical.equilibrium_potential` | 평형전위 | `qudt:ElectricPotential` | extension | bulk | curve |
| `electrochemical.exchange_current_density` | 교환전류밀도 | `qudt:ElectricCurrentDensity` | extension | bulk | table_or_function |
| `electrochemical.double_layer_capacitance_per_area` | 면적당 이중층 정전용량 | `mdb:CapacitancePerArea` | extension | interface | scalar |
| `electrochemical.specific_capacity` | 비용량 | `qudt:SpecificElectricCharge` | extension | bulk | scalar |
| `electrochemical.volumetric_capacity` | 체적용량 | `qudt:ElectricChargeDensity` | extension | bulk | scalar |
| `electrochemical.maximum_species_concentration` | 최대 종 농도 | `qudt:AmountOfSubstanceConcentration` | extension | bulk | scalar |
| `electrochemical.charge_transfer_coefficient` | 전하이동계수 | `qudt:Dimensionless` | extension | bulk | scalar |
| `electrochemical.entropic_potential_coefficient` | 전위 엔트로피 계수 | `mdb:ElectricPotentialPerTemperature` | extension | bulk | curve |
| `electrochemical.active_specific_surface_area` | 활성 비표면적 | `qudt:SpecificSurfaceArea` | extension | bulk | scalar |

### fluid (8)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `fluid.dynamic_viscosity` | 동적 점도(점성계수) | `qudt:DynamicViscosity` | core | bulk | scalar_or_tensor |
| `fluid.kinematic_viscosity` | 동점도 | `qudt:KinematicViscosity` | core | bulk | scalar |
| `fluid.bulk_viscosity` | 체적점도 | `qudt:DynamicViscosity` | extension | bulk | scalar |
| `fluid.fluidity` | 유동도 | `qudt:Fluidity` | extension | bulk | scalar |
| `fluid.isothermal_compressibility` | 등온 압축률 | `qudt:IsothermalCompressibility` | core | bulk | scalar |
| `fluid.isentropic_compressibility` | 등엔트로피 압축률 | `qudt:IsentropicCompressibility` | core | bulk | scalar |
| `fluid.speed_of_sound` | 음속 | `qudt:SpeedOfSound` | core | bulk | curve |
| `fluid.yield_stress` | 유변학적 항복응력 | `qudt:Stress` | extension | bulk | scalar |

### general (14)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `general.mass_density` | 질량 밀도 | `qudt:MassDensity` | core | bulk | scalar |
| `general.specific_volume` | 비체적 | `qudt:SpecificVolume` | core | bulk | scalar |
| `general.molar_mass` | 몰 질량 | `qudt:MolarMass` | core | bulk | scalar |
| `general.porosity` | 공극률 | `qudt:DimensionlessRatio` | core | bulk | scalar |
| `general.mass_fraction` | 질량분율 | `qudt:MassFraction` | core | bulk | scalar |
| `general.mole_fraction` | 몰분율 | `qudt:MoleFraction` | core | bulk | scalar |
| `general.volume_fraction` | 체적분율 | `qudt:DimensionlessRatio` | core | bulk | scalar |
| `general.number_density` | 수 밀도 | `qudt:NumberDensity` | core | bulk | scalar |
| `general.molar_concentration` | 몰 농도 | `qudt:AmountOfSubstanceConcentration` | core | bulk | scalar |
| `general.mass_concentration` | 질량 농도 | `qudt:MassConcentration` | core | bulk | scalar |
| `general.specific_surface_area` | 비표면적 | `qudt:SpecificSurfaceArea` | core | bulk | scalar |
| `general.moisture_mass_fraction` | 수분 질량분율 | `qudt:MassFractionOfWater` | extension | bulk | scalar |
| `general.water_to_dry_mass_ratio` | 건조질량 기준 함수비 | `qudt:MassRatioOfWaterToDryMatter` | extension | bulk | scalar |
| `general.packing_fraction` | 충진율 | `qudt:PackingFraction` | extension | bulk | scalar |

### interface (15)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `interface.static_friction_coefficient` | 정지마찰계수 | `qudt:StaticFrictionCoefficient` | core | interface | scalar |
| `interface.dynamic_friction_coefficient` | 동마찰계수 | `qudt:DynamicFrictionCoefficient` | core | interface | scalar |
| `interface.contact_angle` | 접촉각 | `qudt:PlaneAngle` | extension | interface | scalar |
| `interface.interfacial_tension` | 계면장력 | `qudt:SurfaceTension` | extension | interface | scalar |
| `interface.interfacial_energy` | 계면에너지 | `qudt:EnergyPerArea` | extension | interface | scalar |
| `interface.adhesion_energy` | 접착에너지 | `qudt:EnergyPerArea` | extension | interface | scalar |
| `interface.cohesive_strength` | 계면 응집강도 | `qudt:Stress` | extension | interface | scalar |
| `interface.normal_stiffness_per_area` | 면적당 법선 접촉강성 | `mdb:StiffnessPerArea` | extension | interface | scalar |
| `interface.tangential_stiffness_per_area` | 면적당 접선 접촉강성 | `mdb:StiffnessPerArea` | extension | interface | scalar |
| `interface.critical_normal_separation` | 임계 법선 분리거리 | `qudt:Length` | extension | interface | scalar |
| `interface.critical_tangential_separation` | 임계 접선 분리거리 | `qudt:Length` | extension | interface | scalar |
| `interface.thermal_contact_conductance` | 열접촉 컨덕턴스 | `qudt:CoefficientOfHeatTransfer` | extension | interface | scalar |
| `interface.thermal_contact_resistance_per_area` | 면적 열접촉저항 | `mdb:ThermalResistancePerArea` | extension | interface | scalar |
| `interface.electrical_contact_resistance` | 전기 접촉저항 | `qudt:Resistance` | extension | interface | scalar |
| `interface.mass_transfer_coefficient` | 계면 물질전달계수 | `qudt:Speed` | extension | interface | scalar |

### magnetic (17)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `magnetic.permeability` | 투자율 | `qudt:ElectromagneticPermeability` | core | bulk | scalar_or_tensor_or_complex |
| `magnetic.relative_permeability` | 상대투자율 | `qudt:ElectromagneticPermeabilityRatio` | core | bulk | scalar_or_tensor_or_complex |
| `magnetic.susceptibility` | 자기 감수율 | `qudt:MagneticSusceptability` | extension | bulk | scalar_or_tensor |
| `magnetic.coercivity` | 보자력 | `qudt:Coercivity` | extension | bulk | scalar |
| `magnetic.remanent_flux_density` | 잔류 자속밀도 | `qudt:MagneticFluxDensity` | extension | bulk | scalar |
| `magnetic.saturation_flux_density` | 포화 자속밀도 | `qudt:MagneticFluxDensity` | extension | bulk | scalar |
| `magnetic.remanent_magnetization` | 잔류 자화 | `qudt:Magnetization` | extension | bulk | scalar |
| `magnetic.saturation_magnetization` | 포화 자화 | `qudt:Magnetization` | extension | bulk | scalar |
| `magnetic.b_h_curve` | B-H 곡선 | `qudt:MagneticFluxDensity` | extension | bulk | curve |
| `magnetic.curie_temperature` | 퀴리 온도 | `qudt:CurieTemperature` | extension | bulk | scalar |
| `magnetic.neel_temperature` | 닐 온도 | `qudt:NeelTemperature` | extension | bulk | scalar |
| `magnetic.lower_critical_flux_density` | 하부 임계 자속밀도 | `qudt:LowerCriticalMagneticFluxDensity` | extension | bulk | scalar |
| `magnetic.upper_critical_flux_density` | 상부 임계 자속밀도 | `qudt:UpperCriticalMagneticFluxDensity` | extension | bulk | scalar |
| `magnetic.superconducting_transition_temperature` | 초전도 전이온도 | `qudt:SuperconductionTransitionTemperature` | extension | bulk | scalar |
| `magnetic.london_penetration_depth` | 런던 침투깊이 | `qudt:LondonPenetrationDepth` | extension | bulk | scalar |
| `magnetic.coherence_length` | 결맞음 길이 | `qudt:CoherenceLength` | extension | bulk | scalar |
| `magnetic.hysteresis_loss_density` | 자기 이력 손실 에너지밀도 | `qudt:EnergyDensity` | extension | bulk | scalar |

### mechanical (35)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `mechanical.young_modulus` | 영률 | `qudt:ModulusOfElasticity` | core | bulk | scalar_or_tensor_components |
| `mechanical.poisson_ratio` | 푸아송비 | `qudt:PoissonRatio` | core | bulk | scalar_or_tensor_components |
| `mechanical.shear_modulus` | 전단 탄성률 | `qudt:ShearModulus` | core | bulk | scalar_or_tensor_components |
| `mechanical.bulk_modulus` | 체적 탄성률 | `qudt:BulkModulus` | core | bulk | scalar |
| `mechanical.compressibility` | 압축률 | `qudt:Compressibility` | core | bulk | scalar |
| `mechanical.lame_first_parameter` | 라메 제1상수 | `qudt:Stress` | extension | bulk | scalar |
| `mechanical.elastic_stiffness_tensor` | 탄성 강성 텐서 | `qudt:ModulusOfElasticity` | core | bulk | tensor |
| `mechanical.elastic_compliance_tensor` | 탄성 컴플라이언스 텐서 | `qudt:InversePressure` | core | bulk | tensor |
| `mechanical.yield_strength` | 항복강도 | `qudt:Stress` | core | bulk | scalar |
| `mechanical.tensile_strength` | 인장강도 | `qudt:Stress` | core | bulk | scalar |
| `mechanical.compressive_strength` | 압축강도 | `qudt:Stress` | core | bulk | scalar |
| `mechanical.shear_strength` | 전단강도 | `qudt:ShearStress` | core | bulk | scalar |
| `mechanical.flexural_strength` | 굽힘강도 | `qudt:Stress` | extension | bulk | scalar |
| `mechanical.fatigue_strength` | 피로강도 | `qudt:Stress` | extension | bulk | scalar |
| `mechanical.endurance_limit` | 피로한도 | `qudt:Stress` | extension | bulk | scalar |
| `mechanical.hardness` | 경도 | `qudt:Pressure` | extension | bulk | scalar |
| `mechanical.tangent_modulus` | 접선 탄성률 | `qudt:ModulusOfElasticity` | extension | bulk | scalar |
| `mechanical.hardening_modulus` | 경화계수 | `qudt:ModulusOfElasticity` | extension | bulk | scalar |
| `mechanical.strength_coefficient` | 강도계수 | `qudt:Stress` | extension | bulk | scalar |
| `mechanical.strain_hardening_exponent` | 가공경화 지수 | `qudt:Dimensionless` | extension | bulk | scalar |
| `mechanical.plastic_strain_ratio` | 소성변형비 | `qudt:DimensionlessRatio` | extension | bulk | scalar |
| `mechanical.elongation_at_break` | 파단 연신율 | `qudt:Strain` | core | bulk | scalar |
| `mechanical.fracture_strain` | 파단 변형률 | `qudt:Strain` | extension | bulk | scalar |
| `mechanical.reduction_of_area` | 단면 수축률 | `qudt:DimensionlessRatio` | extension | bulk | scalar |
| `mechanical.fracture_toughness` | 파괴인성 | `qudt:StressIntensityFactor` | core | bulk | scalar |
| `mechanical.critical_energy_release_rate` | 임계 에너지 방출률 | `qudt:StrainEnergyReleaseRate` | core | bulk | scalar |
| `mechanical.fracture_energy` | 파괴에너지 | `qudt:EnergyPerArea` | core | bulk | scalar |
| `mechanical.relaxation_modulus` | 완화 탄성률 | `qudt:ModulusOfElasticity` | extension | bulk | curve |
| `mechanical.creep_compliance` | 크리프 컴플라이언스 | `qudt:InversePressure` | extension | bulk | curve |
| `mechanical.relaxation_time` | 완화시간 | `qudt:RelaxationTime` | core | bulk | scalar |
| `mechanical.storage_modulus` | 저장 탄성률 | `qudt:ModulusOfElasticity` | extension | bulk | curve_or_complex_component |
| `mechanical.loss_modulus` | 손실 탄성률 | `qudt:ModulusOfElasticity` | extension | bulk | curve_or_complex_component |
| `mechanical.loss_factor` | 기계 손실계수 | `qudt:LossFactor` | extension | bulk | scalar |
| `mechanical.damping_ratio` | 감쇠비 | `qudt:DimensionlessRatio` | extension | bulk | scalar |
| `mechanical.quality_factor` | 기계 품질계수 | `qudt:QualityFactor` | extension | bulk | scalar |

### microstructure (11)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `microstructure.mean_grain_size` | 평균 결정립 크기 | `qudt:Length` | extension | bulk | scalar |
| `microstructure.mean_particle_size` | 평균 입자 크기 | `qudt:Length` | extension | bulk | scalar |
| `microstructure.mean_pore_size` | 평균 공극 크기 | `qudt:Length` | extension | bulk | scalar |
| `microstructure.phase_fraction` | 상 분율 | `qudt:DimensionlessRatio` | extension | bulk | scalar |
| `microstructure.crystallinity_fraction` | 결정화도 | `qudt:DimensionlessRatio` | extension | bulk | scalar |
| `microstructure.dislocation_density` | 전위 밀도 | `qudt:InverseArea` | extension | bulk | scalar |
| `microstructure.defect_number_density` | 결함 수 밀도 | `qudt:NumberDensity` | extension | bulk | scalar |
| `microstructure.lattice_parameter` | 격자상수 | `qudt:Length` | extension | bulk | vector_or_tensor |
| `microstructure.lattice_plane_spacing` | 격자면 간격 | `qudt:LatticePlaneSpacing` | extension | bulk | scalar |
| `microstructure.burgers_vector` | 버거스 벡터 | `qudt:BurgersVector` | extension | bulk | vector |
| `microstructure.crystal_orientation` | 결정방위 | `qudt:PlaneAngle` | extension | bulk | orientation |

### optical (13)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `optical.refractive_index` | 굴절률 | `qudt:RefractiveIndex` | core | bulk | scalar_or_tensor_or_complex |
| `optical.extinction_coefficient` | 소광계수 | `qudt:Dimensionless` | extension | bulk | scalar_or_tensor |
| `optical.absorption_coefficient` | 광 흡수계수 | `qudt:LinearAbsorptionCoefficient` | extension | bulk | curve |
| `optical.attenuation_coefficient` | 광 감쇠계수 | `qudt:AttenuationCoefficient` | extension | bulk | curve |
| `optical.scattering_coefficient` | 광 산란계수 | `qudt:InverseLength` | extension | bulk | curve |
| `optical.molar_absorption_coefficient` | 몰 흡광계수 | `qudt:MolarAbsorptionCoefficient` | extension | bulk | curve |
| `optical.reflectance` | 반사율 | `qudt:Reflectance` | extension | surface | curve |
| `optical.transmittance` | 투과율 | `qudt:Transmittance` | extension | sample | curve |
| `optical.absorptance` | 흡수율 | `qudt:Absorptance` | extension | surface | curve |
| `optical.abbe_number` | 아베수 | `qudt:Constringence` | extension | bulk | scalar |
| `optical.phase_coefficient` | 위상계수 | `qudt:PhaseCoefficient` | extension | bulk | curve |
| `optical.specific_rotatory_power` | 비선광도 | `qudt:SpecificOpticalRotatoryPower` | extension | bulk | scalar |
| `optical.nonlinear_refractive_index` | 비선형 굴절률 | `qudt:AreaPerPower` | extension | bulk | scalar |

### radiation (16)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `radiation.linear_attenuation_coefficient` | 선형 감쇠계수 | `qudt:LinearAttenuationCoefficient` | extension | bulk | curve |
| `radiation.mass_attenuation_coefficient` | 질량 감쇠계수 | `qudt:MassAttenuationCoefficient` | extension | bulk | curve |
| `radiation.mass_absorption_coefficient` | 질량 흡수계수 | `qudt:MassAbsorptionCoefficient` | extension | bulk | curve |
| `radiation.molar_attenuation_coefficient` | 몰 감쇠계수 | `qudt:MolarAttenuationCoefficient` | extension | bulk | curve |
| `radiation.microscopic_cross_section` | 미시적 단면적 | `qudt:CrossSection` | extension | bulk | curve |
| `radiation.macroscopic_cross_section` | 거시적 단면적 | `qudt:MacroscopicCrossSection` | extension | bulk | curve |
| `radiation.total_cross_section` | 총 단면적 | `qudt:TotalCrossSection` | extension | bulk | curve |
| `radiation.linear_stopping_power` | 선형 저지능 | `qudt:TotalLinearStoppingPower` | extension | bulk | curve |
| `radiation.mass_stopping_power` | 질량 저지능 | `qudt:TotalMassStoppingPower` | extension | bulk | curve |
| `radiation.half_life` | 반감기 | `qudt:HalfLife` | extension | bulk | scalar |
| `radiation.decay_constant` | 붕괴상수 | `qudt:DecayConstant` | extension | bulk | scalar |
| `radiation.specific_activity` | 비방사능 | `qudt:SpecificActivity` | extension | bulk | scalar |
| `radiation.neutron_diffusion_coefficient` | 중성자 확산계수 | `qudt:NeutronDiffusionCoefficient` | extension | bulk | curve |
| `radiation.neutron_diffusion_length` | 중성자 확산길이 | `qudt:NeutronDiffusionLength` | extension | bulk | scalar |
| `radiation.mean_free_path` | 평균 자유행로 | `qudt:MeanFreePath` | extension | bulk | curve |
| `radiation.mass_energy_transfer_coefficient` | 질량 에너지 전달계수 | `qudt:MassEnergyTransferCoefficient` | extension | bulk | curve |

### radiative (2)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `radiative.emissivity` | 방사율 | `qudt:Emissivity` | core | surface | scalar_or_curve |
| `radiative.reflectivity` | 고유 반사율 | `qudt:Reflectivity` | extension | surface | curve |

### semiconductor (15)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `semiconductor.band_gap_energy` | 밴드갭 에너지 | `qudt:GapEnergy` | extension | bulk | scalar |
| `semiconductor.electron_affinity` | 전자친화도 | `qudt:ElectronAffinity` | extension | bulk | scalar |
| `semiconductor.electron_mobility` | 전자 이동도 | `qudt:ElectronMobility` | extension | bulk | scalar_or_tensor |
| `semiconductor.hole_mobility` | 정공 이동도 | `qudt:Mobility` | extension | bulk | scalar_or_tensor |
| `semiconductor.electron_density` | 전자 밀도 | `qudt:ElectronDensity` | extension | bulk | scalar |
| `semiconductor.hole_density` | 정공 밀도 | `qudt:HoleDensity` | extension | bulk | scalar |
| `semiconductor.intrinsic_carrier_density` | 고유 캐리어 밀도 | `qudt:IntrinsicCarrierDensity` | extension | bulk | curve |
| `semiconductor.donor_density` | 도너 농도 | `qudt:DonorDensity` | extension | bulk | scalar |
| `semiconductor.acceptor_density` | 억셉터 농도 | `qudt:AcceptorDensity` | extension | bulk | scalar |
| `semiconductor.carrier_lifetime` | 캐리어 수명 | `qudt:CarrierLifetime` | extension | bulk | scalar |
| `semiconductor.recombination_coefficient` | 재결합계수 | `qudt:RecombinationCoefficient` | extension | bulk | scalar |
| `semiconductor.electron_effective_mass` | 전자 유효질량 | `qudt:EffectiveMass` | extension | bulk | scalar_or_tensor |
| `semiconductor.hole_effective_mass` | 정공 유효질량 | `qudt:EffectiveMass` | extension | bulk | scalar_or_tensor |
| `semiconductor.saturation_velocity` | 캐리어 포화속도 | `qudt:Speed` | extension | bulk | scalar |
| `semiconductor.impact_ionization_coefficient` | 충돌 이온화계수 | `qudt:InverseLength` | extension | bulk | curve |

### thermal (20)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `thermal.conductivity` | 열전도율 | `qudt:ThermalConductivity` | core | bulk | scalar_or_tensor |
| `thermal.diffusivity` | 열확산도 | `qudt:ThermalDiffusivity` | core | bulk | scalar_or_tensor |
| `thermal.specific_heat_capacity` | 비열 | `qudt:SpecificHeatCapacity` | core | bulk | scalar |
| `thermal.specific_heat_capacity_cp` | 정압 비열 | `qudt:SpecificHeatCapacityAtConstantPressure` | core | bulk | scalar |
| `thermal.specific_heat_capacity_cv` | 정적 비열 | `qudt:SpecificHeatCapacityAtConstantVolume` | core | bulk | scalar |
| `thermal.volumetric_heat_capacity` | 체적 열용량 | `qudt:VolumetricHeatCapacity` | core | bulk | scalar |
| `thermal.heat_capacity_ratio` | 비열비 | `qudt:HeatCapacityRatio` | core | bulk | scalar |
| `thermal.linear_expansion_coefficient` | 선팽창계수 | `qudt:ThermalExpansionCoefficient` | core | bulk | scalar_or_tensor |
| `thermal.volumetric_expansion_coefficient` | 체적팽창계수 | `qudt:CubicExpansionCoefficient` | core | bulk | scalar |
| `thermal.resistivity` | 열저항률 | `qudt:ThermalResistivity` | extension | bulk | scalar |
| `thermal.inertia` | 열관성 | `qudt:ThermalInertia` | extension | bulk | scalar |
| `thermal.melting_temperature` | 융점 | `qudt:MeltingPoint` | core | bulk | scalar |
| `thermal.boiling_temperature` | 비점 | `qudt:BoilingPoint` | core | bulk | scalar |
| `thermal.glass_transition_temperature` | 유리전이온도 | `qudt:ThermodynamicTemperature` | extension | bulk | scalar |
| `thermal.solidus_temperature` | 고상선 온도 | `qudt:ThermodynamicTemperature` | extension | bulk | scalar |
| `thermal.liquidus_temperature` | 액상선 온도 | `qudt:ThermodynamicTemperature` | extension | bulk | scalar |
| `thermal.decomposition_temperature` | 분해온도 | `qudt:ThermodynamicTemperature` | extension | bulk | scalar |
| `thermal.latent_heat_fusion` | 융해 잠열 | `qudt:SpecificEnergy` | core | bulk | scalar |
| `thermal.latent_heat_vaporization` | 기화 잠열 | `qudt:SpecificEnergy` | core | bulk | scalar |
| `thermal.thermal_insulance` | 열관류 저항 | `qudt:ThermalInsulance` | extension | assembly | scalar |

### thermodynamic (16)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `thermodynamic.vapor_pressure` | 증기압 | `qudt:VapourPressure` | core | bulk | curve |
| `thermodynamic.compressibility_factor` | 압축성 계수 | `qudt:CompressibilityFactor` | extension | bulk | scalar |
| `thermodynamic.critical_temperature` | 임계온도 | `qudt:ThermodynamicTemperature` | extension | bulk | scalar |
| `thermodynamic.critical_pressure` | 임계압력 | `qudt:Pressure` | extension | bulk | scalar |
| `thermodynamic.triple_point_temperature` | 삼중점 온도 | `qudt:ThermodynamicTemperature` | extension | bulk | scalar |
| `thermodynamic.specific_enthalpy` | 비엔탈피 | `qudt:SpecificEnthalpy` | core | bulk | table_or_function |
| `thermodynamic.specific_internal_energy` | 비내부에너지 | `qudt:SpecificInternalEnergy` | core | bulk | table_or_function |
| `thermodynamic.specific_entropy` | 비엔트로피 | `qudt:SpecificEntropy` | core | bulk | table_or_function |
| `thermodynamic.specific_gibbs_energy` | 비깁스에너지 | `qudt:SpecificGibbsEnergy` | extension | bulk | table_or_function |
| `thermodynamic.specific_helmholtz_energy` | 비헬름홀츠에너지 | `qudt:SpecificHelmholtzEnergy` | extension | bulk | table_or_function |
| `thermodynamic.chemical_potential` | 화학 퍼텐셜 | `qudt:ChemicalPotential` | extension | bulk | scalar |
| `thermodynamic.activity_coefficient` | 활동도 계수 | `qudt:ActivityCoefficient` | extension | bulk | scalar |
| `thermodynamic.fugacity` | 퓨가시티 | `qudt:Fugacity` | extension | bulk | scalar |
| `thermodynamic.equilibrium_constant` | 평형상수 | `qudt:EquilibriumConstant` | extension | bulk | scalar |
| `thermodynamic.osmotic_coefficient` | 삼투계수 | `qudt:OsmoticCoefficient` | extension | bulk | scalar |
| `thermodynamic.osmotic_pressure` | 삼투압 | `qudt:OsmoticPressure` | extension | bulk | scalar |

### transport (19)

| Key | Korean label | QuantityKind | Tier | Scope | Value form |
|---|---|---|---|---|---|
| `transport.diffusion_coefficient` | 확산계수 | `qudt:DiffusionCoefficient` | core | bulk | scalar_or_tensor |
| `transport.binary_diffusion_coefficient` | 이성분 확산계수 | `qudt:DiffusionCoefficient` | extension | bulk | scalar |
| `transport.moisture_diffusivity` | 수분 확산도 | `qudt:DiffusionCoefficient` | extension | bulk | curve |
| `transport.water_vapor_diffusion_coefficient` | 수증기 확산계수 | `qudt:WaterVapourDiffusionCoefficient` | extension | bulk | scalar |
| `transport.thermal_diffusion_factor` | 열확산 인자 | `qudt:ThermalDiffusionFactor` | extension | bulk | scalar |
| `transport.intrinsic_permeability` | 고유투수율 | `qudt:HydraulicPermeability` | core | bulk | scalar_or_tensor |
| `transport.relative_permeability` | 상대투수율 | `qudt:PermeabilityRatio` | extension | bulk | curve |
| `transport.vapor_permeability` | 수증기 투과율 | `qudt:VapourPermeability` | extension | bulk | scalar |
| `transport.vapor_permeance` | 수증기 투과도 | `qudt:VapourPermeance` | extension | assembly | scalar |
| `transport.tortuosity` | 굴곡도 | `qudt:DimensionlessRatio` | extension | bulk | scalar_or_tensor |
| `transport.longitudinal_dispersivity` | 종방향 분산도 | `qudt:Length` | extension | bulk | scalar |
| `transport.transverse_dispersivity` | 횡방향 분산도 | `qudt:Length` | extension | bulk | scalar |
| `transport.solubility` | 용해도 | `qudt:AmountOfSubstanceConcentration` | extension | bulk | curve |
| `transport.henry_constant` | 헨리 상수 | `qudt:HenrysLawVolatilityConstant` | extension | bulk | scalar |
| `transport.partition_coefficient` | 분배계수 | `qudt:DimensionlessRatio` | extension | bulk | scalar |
| `transport.adsorption_coefficient` | 흡착계수 | `qudt:SoilAdsorptionCoefficient` | extension | bulk | scalar |
| `transport.sorption_isotherm` | 흡착 등온선 | `qudt:MassFraction` | extension | bulk | curve |
| `transport.capillary_pressure` | 모세관압 | `qudt:Pressure` | extension | bulk | curve |
| `transport.mobility` | 이동도 | `qudt:Mobility` | extension | bulk | scalar_or_tensor |

## Model namespace examples

- `model.johnson_cook.initial_yield_stress`
- `model.johnson_cook.hardening_coefficient`
- `model.johnson_cook.hardening_exponent`
- `model.johnson_cook.strain_rate_coefficient`
- `model.johnson_cook.thermal_softening_exponent`
- `model.mooney_rivlin.c10`
- `model.mooney_rivlin.c01`
- `model.ogden.mu`
- `model.ogden.alpha`
- `model.prony.shear_fraction`
- `model.prony.bulk_fraction`
- `model.prony.relaxation_time`
- `model.norton.creep_coefficient`
- `model.norton.stress_exponent`
- `model.power_law.consistency_index`
- `model.power_law.flow_behavior_index`
- `model.bingham.yield_stress`
- `model.bingham.plastic_viscosity`
- `model.herschel_bulkley.yield_stress`
- `model.herschel_bulkley.consistency_index`
- `model.herschel_bulkley.flow_behavior_index`
- `model.mohr_coulomb.cohesion`
- `model.mohr_coulomb.friction_angle`
- `model.mohr_coulomb.dilation_angle`
- `model.modified_cam_clay.preconsolidation_pressure`
- `model.modified_cam_clay.compression_index`
- `model.modified_cam_clay.swelling_index`
- `model.van_genuchten.alpha`
- `model.van_genuchten.n`
- `model.butler_volmer.exchange_current_density`
- `model.jiles_atherton.a`
- `model.sellmeier.b`
- `model.sellmeier.c`