# biconvex_lens_example.jl
# LocalOpticSim.jl을 사용하여 양면 볼록 렌즈를 통해 평행광을 집속시키는 예제입니다.


# CleanOpticSim 환경 활성화
using Pkg
Pkg.activate("CleanOpticSim")
#Pkg.add(["Unitful", "Images", "FileIO"])

# 현재 디렉토리를 Julia의 경로에 추가
push!(LOAD_PATH, ".")
println("CleanOpticSim 환경을 활성화했습니다.")

# 필요한 패키지들을 로드
using Unitful
using StaticArrays
using DataFrames
using StringEncodings
using AGFFileReader
using LinearAlgebra
using Random
using Statistics
using Distributions
using Images
using FileIO

println("✓ 모든 필요한 패키지 로드 성공!")

# LocalOpticSim 모듈 로드
println("\nLocalOpticSim 모듈을 로드하는 중...")
include("LocalOpticSim/LocalOpticSim.jl")
using .LocalOpticSim



const LOS = LocalOpticSim

# 1) 얇은 렌즈 (f=50, 중심 z=0)
lens = LOS.ParaxialLensRect(50.0, 10.0, 10.0,
                        SVector{3,Float64}(0,0,1),
                        SVector{3,Float64}(0,0,0))

                        # 2) 검출기: 불투명 인터페이스 + 초점면 z≈50
det = LOS.Rectangle(20.0, 20.0, SVector{3,Float64}(0,0,1), SVector{3,Float64}(0,0,50.0);
                    interface = LOS.opaqueinterface(Float64))

# 3) 시스템 (거울 제거)
assm = LOS.LensAssembly(lens)
sys  = LOS.CSGOpticalSystem(assm, det, 800, 800, Float32; temperature=20.0, pressure=1.0)

# 4) 평행광 레이 다발 (전력 1.0 명시)
for x in -5.0:0.5:5.0, y in -5.0:0.5:5.0
    r = LOS.OpticalRay(SVector{3,Float64}(x,y,-50.0), SVector{3,Float64}(0,0,1.0), 1.0, 0.55)
    LOS.trace(sys, r)
end

img = LOS.detectorimage(sys)  # 초점 스팟이 선명히 찍힙니다.


# 이미지를 0과 1 사이로 정규화
max_val = maximum(img)
if max_val > 0
    normalized_image = img ./ max_val
else
    normalized_image = img
end

# PNG 파일로 저장
save("focused_spot.png", Gray.(normalized_image'))

println("\nDone! Result saved to 'focused_spot.png'.")
