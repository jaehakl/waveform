# 깨끗한 Julia 환경 생성 스크립트

println("=== 깨끗한 Julia 환경 생성 ===")

using Pkg

# 새로운 환경 생성
println("새로운 Julia 환경을 생성합니다...")
Pkg.generate("CleanOpticSim")

println("✓ CleanOpticSim 환경 생성 완료")

# 환경 활성화
println("환경을 활성화합니다...")
Pkg.activate("CleanOpticSim")

# 필요한 패키지들 설치
packages = [
    "Unitful",
    "StaticArrays", 
    "DataFrames",
    "StringEncodings",
    "AGFFileReader",
    "Distributions"
]

println("필요한 패키지들을 설치합니다...")

for pkg in packages
    try
        println("설치 중: $pkg")
        Pkg.add(pkg)
        println("✓ $pkg 설치 완료")
    catch e
        println("✗ $pkg 설치 실패: $e")
    end
end

println("\n=== 환경 생성 완료 ===")
println("이제 CleanOpticSim 환경에서 LocalOpticSim을 사용할 수 있습니다!")
