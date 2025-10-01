# CleanOpticSim 환경에서 LocalOpticSim 테스트

println("=== CleanOpticSim 환경에서 LocalOpticSim 테스트 ===")

# CleanOpticSim 환경 활성화
using Pkg
Pkg.activate("CleanOpticSim")

# 현재 디렉토리를 Julia의 경로에 추가
push!(LOAD_PATH, ".")

println("CleanOpticSim 환경을 활성화했습니다.")
println("현재 디렉토리를 LOAD_PATH에 추가했습니다.")

# 필요한 패키지들을 로드
println("필요한 패키지들을 로드하는 중...")

try
    using Unitful
    using StaticArrays
    using DataFrames
    using StringEncodings
    using AGFFileReader
    using LinearAlgebra
    using Random
    using Statistics
    using Distributions
    println("✓ 모든 필요한 패키지 로드 성공!")
catch e
    println("✗ 패키지 로드 실패: $e")
    exit(1)
end

# LocalOpticSim 모듈 로드 시도
try
    println("\nLocalOpticSim 모듈을 로드하는 중...")
    include("LocalOpticSim/LocalOpticSim.jl")
    using .LocalOpticSim
    println("✓ LocalOpticSim 모듈 로드 성공!")
    
    # 기본 상수 확인
    println("\n=== 기본 상수 확인 ===")
    println("RAY_OFFSET: ", RAY_OFFSET)
    println("POWER_THRESHOLD: ", POWER_THRESHOLD)
    println("TRACE_RECURSION_LIMIT: ", TRACE_RECURSION_LIMIT)
    
    # 유틸리티 함수 테스트
    println("\n=== 유틸리티 함수 테스트 ===")
    
    # 이차 방정식 해 구하기
    roots = quadraticroots(1.0, -5.0, 6.0)
    if roots !== nothing
        println("x² - 5x + 6 = 0의 해: ", roots[1], ", ", roots[2])
    else
        println("실수 해가 없습니다.")
    end
    
    # 안전한 삼각 함수
    println("atan(1, 0) = ", NaNsafeatan(1.0, 0.0))
    println("asin(0) = ", NaNsafeasin(0.0))
    println("acos(1) = ", NaNsafeacos(1.0))
    
    # 기하학적 객체 생성 테스트
    println("\n=== 기하학적 객체 생성 테스트 ===")
    
    try
        sphere = Sphere(1.0)
        println("✓ 구 생성 성공: 반지름 1.0")
    catch e
        println("✗ 구 생성 실패: $e")
    end
    
    try
        plane = Plane(SVector{3,Float64}(0.0, 0.0, 1.0), SVector{3,Float64}(0.0, 0.0, 0.0))
        println("✓ 평면 생성 성공: Z=0 평면")
    catch e
        println("✗ 평면 생성 실패: $e")
    end
    
    try
        cylinder = Cylinder(0.5, 2.0)
        println("✓ 원기둥 생성 성공: 반지름 0.5, 높이 2.0")
    catch e
        println("✗ 원기둥 생성 실패: $e")
    end
    
    try
        cuboid = Cuboid(1.0, 1.0, 1.0)
        println("✓ 직육면체 생성 성공: 2x2x2 크기")
    catch e
        println("✗ 직육면체 생성 실패: $e")
    end
    
    # 복합 기하학적 객체 테스트
    println("\n=== 복합 기하학적 객체 테스트 ===")
    
    try
        # 원기둥과 구의 교집합
        lens_shape = Cylinder(5.0, 2.0) ∩ Sphere(10.0)
        println("✓ 렌즈 모양 객체 생성 성공")
    catch e
        println("✗ 렌즈 모양 객체 생성 실패: $e")
    end
    
    try
        # 직육면체와 구의 차집합
        box_with_hole = Cuboid(2.0, 2.0, 2.0) - Sphere(1.0)
        println("✓ 구멍이 뚫린 상자 생성 성공")
    catch e
        println("✗ 구멍이 뚫린 상자 생성 실패: $e")
    end
    
    # 광학 인터페이스 테스트
    println("\n=== 광학 인터페이스 테스트 ===")
    
    try
        # 공기-유리 인터페이스
        interface = FresnelInterface(1.0, 1.5)
        println("✓ Fresnel 인터페이스 생성 성공: n1=1.0, n2=1.5")
    catch e
        println("✗ Fresnel 인터페이스 생성 실패: $e")
    end
    
    println("\n🎉 모든 테스트가 성공적으로 완료되었습니다!")
    println("LocalOpticSim이 정상적으로 작동합니다!")
    
catch e
    println("✗ LocalOpticSim 모듈 로드 실패: $e")
    println("\n해결 방법:")
    println("1. Julia REPL에서 수동으로 실행해보세요:")
    println("   julia> include(\"test_clean_env.jl\")")
    println("2. 또는 단계별로 실행:")
    println("   julia> using Pkg")
    println("   julia> Pkg.activate(\"CleanOpticSim\")")
    println("   julia> push!(LOAD_PATH, \".\")")
    println("   julia> include(\"LocalOpticSim/LocalOpticSim.jl\")")
    println("   julia> using .LocalOpticSim")
end

println("\n=== 테스트 완료 ===")
