
# Qutat Desktop

본 프로그램은 빠르고 적은 비용으로 다중물리 시뮬레이션을 수행할 수 있는 플랫폼으로 고안되었다.

본 프로그램은 컴퓨터 기반 공학 설계 (CAD/CAE) 프로그램의 일종으로서 구조 설계와 해석(시뮬레이션) 기능을 제공한다.

본 프로그램은 이러한 설계와 해석을 편리하게 수행할 수 있도록 하기 위하여, 
시뮬레이션 입력 데이터를 작성하고 검토할 수 있는 그래픽 유저 인터페이스(GUI)를 제공한다.
입력 데이터의 작성은 '폼 레이아웃' 및 '테이블' 의 값을 직접 변경하거나
엑셀 등 스프레드시트 프로그램에서 복사-붙여넣기를 통해 입력할 수 있으며,
데이터가 입력되면 즉시 3D 모델링을 통해 시각화되는 것을 확인할 수 있다.

또한 본 프로그램에서는 사용자들이 직접 각자의 분야에 맞는 서드파티 모듈을 추가하며 
활용하는 것을 권장한다. 이를 위하여 시뮬레이션을 서브프로세스에서 수행하고 메인 프로세스와 
소켓 통신으로 상호작용할 수 있도록 하였으며, 이러한 서브프로세스 프로그램을 개발하기 위한
템플릿과 API 를 제공한다. 또한 'lib' 폴더 내의 다양한 라이브러리 코드를 활용하여
각 모듈에서 필요한 GUI 컴포넌트 배치, HTTP 통신, 서브프로세스 관리 등을 간편하게 수행할 수 있다.
각 모듈은 'module'폴더 내에 추가될 수 있다.            

현 버전에서는 기본적으로 전자기학 유한차분시간영역법(FDTD) 시뮬레이션 모듈(fdtd)을 활용할 수 있다.

본 프로그램은 오픈소스로, 사용, 수정 및 재배포 등에 있어 GPL3 정책을 따른다.
        
# 주요 기능
- 시뮬레이션 입력 데이터 편집
    - Space (시뮬레이션 공간 및 시간)
    - Geometry (시뮬레이션 공간 물체)
    - Source (광원)
    - Detector (스펙트럼 측정 영역)
- 유한차분시간영역 시뮬레이션(FDTD) 해석
    - MEEP 라이브러리를 WSL 환경에서 서브프로세스로 구동하여 시뮬레이션을 수행한다.
- 시뮬레이션 데이터 시각화
    - 시뮬레이션 입력 데이터를 3D 모델링을 통해 제공한다.
    - 시뮬레이션 결과 데이터를 그래프로 시각화하여 제공한다.
- 데이터 입출력
    - 클라우드 서버에 접속하고, 저장된 입력 데이터를 선택하여 바로 적용할 수 있다.
    - 시뮬레이션 입력 데이터를 로컬 저장소에 json 파일로 저장할 수 있다.
    - 시뮬레이션 결과 데이터를 로컬 저장소에 엑셀 파일로 저장할 수 있다.
    

# 사용 방법

## 설치 및 실행

## 기본 설치 및 실행
1. 압축 파일을 다운로드 받는다.
2. `setup.bat` 을 실행하여 설치한다.
3. `qutat.bat` 으로 실행.

## Linux 관련 모듈 설치(Optional)
* [MEEP](https://meep.readthedocs.io/en/latest/) 기반 시뮬레이션을 PC에서 수행하기 위해서는 이 과정이 필요합니다.
* [Windows Subsystem for Linux](https://learn.microsoft.com/en-us/windows/wsl/)(WSL) Windows에서 리눅스 커널을 이용할 수 있도록 MS 에서 제공하는 소프트웨어 입니다.
1. WSL 을 설치한다.
* 콘솔에서 `wsl --install` ([공식 문서](https://learn.microsoft.com/en-us/windows/wsl/install) 참조)
2. `wsl_setup.bat` 을 실행하여 wsl 관련 모듈 설치 진행.

## Qutat.net 로그인(Optional)
1. [ Qutat.net](http://www.qutat.net/qutat) 사용자 등록
2. `메뉴바 > Qutat.net > Login` 으로 로그인
3. 24시간 이내 재실행 시 자동 로그인

# 사용자 인터페이스


## 입력 데이터 가져오기/내보내기
### 로컬 파일 시스템
* 내보내기 : `메뉴바 > File > Save Experiment` - 현재 데이터 저장
* 가져오기 : `메뉴바 > File > Load Expermient` - 현재 데이터로 적용

### Qutat.net
* 내보내기 : 로그인 상태에서 `메뉴바 > Qutat.net > Upload Experiment` 하면 현재 데이터 업로드 후 죄측 Input List 에서 확인가능
* 또한 Qutat.net 웹에서도 확인 가능
* 가져오기 : 로그인하면 좌측 Input List 위젯에 클라우드 저장 데이터 목록 표시 > 선택하면 즉시 적용

## 입력 데이터 편집
* 우측 Data 위젯에서 탭 선택

### Space
* 시뮬레이션 공간의 크기, resolution, 단위 길이와 시간 등 설정
### Geometry
* 새 geometry 추가 : 테이블에서 `우클릭 > Add Unit`
### Source
* 새 Source  추가 : 테이블에서 `우클릭 > Add Unit`
### Detector
* 새 Detector 추가 : 테이블에서 `우클릭 > Add Unit`

## 시뮬레이션 수행
* MEEP 으로 계산하기 (WSL 관련 모듈 설치 필수) : `툴바> Run on MEEP`

## 시뮬레이션 결과 확인
* 우측 Data 위젯에서 탭 선택

### Update
* 시뮬레이션 공간의 중심을 지나는 x, y, z 축을 따라 분포된 전기장의 세기를 실시간으로 업데이트

### Result
* 시뮬레이션 공간의 중심을 지나는 xy 평면상의 전기장 분포
* 각 Detector 들에서 측정된 spectrum

## 결과 데이터 내보내기
* `툴바 > Save Spectra` - 엑셀 파일로 저장됨.


사용 OS
    Windows NT,Windows XP,Windows Vista,Windows 7,Windows 8,Windows 10,Windows Svr
    2000,Windows Svr 2003,Windows Svr 2008,Windows Svr 2012,Mac OS,Mac OS
    X,LINUX,Ubuntu,Fedora,CentOS,Redhat

사용 언어
     -Python

필요한 프로그램
    - (윈도우즈에서 실행 시) : WSL2
