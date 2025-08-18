

# **Setup and Run Apps**

## Install Prerequisites

```
npm install -g pnpm
```
```
pip install poetry
```
(Optional) To let .venv be in each app directories.
```
poetry config virtualenvs.in-project true
```

## qutat-cloud-django

@ \apps\qutat-cloud-django\app\

```
poetry install
poetry run python -m manage.py runserver
```


## qutat-desktop-client

@ \apps\qutat-desktop-client\app

```
poetry install
poetry run python -m main_window.py
```

## qutat-web-client
@ \
```
pnpm install
pnpm run dev
```

# **How to use Internal Packages**


## Python Packages

### 1. Registration

Python packages are managed through **pyproject.toml** file in each package directories.  

### 2. Import

In each **app directories**, add following line.

```
[tool.poetry.dependencies]
my_python_package = { path = "../../packages/python/my_python_package", develop = true }
```

Then let poetry create the link .

```
poetry install
```

Then the internal package can be imported from the app scripts.  
Modifications of the packages are immediatly applied to the app.
```
import my_python_package
```

## Javascript Packages

### 1. List up components


@ packages\javascript\my_js_package\src\index.js

```
import MyComponent from './my_component';
export { MyComponent };
```

### 2. Update package.json
```
{
  "name": "[package_name]",
  "version": "0.0.0",
  "type": "module",
  "description": "",
  "main": "./dist/[package_name].umd.js",
  "module": "./dist/[package_name].es.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc && vite build",
    ...
  },
  ...
  "files": ["dist", ...],
  "repository": { ... },
  "dependencies": { ... },
  "devDependencies": { ... }
}
```

### 3. Update **vite.config.ts** 

Check entry, name and fileName.
```
...
    lib: {
      entry: path.resolve(__dirname, 'src/index.js'),      
      name: '[package_name]',       
      formats: ['es', 'umd'],
      fileName: (format) => `[package_name].${format}.js`,
    },
...
```

### 4. Build and Link

```
pnpm --filter [package_name] build
pnpm add [package_name]@workspace:* --filter [app_name]
```

Note : [package_name] and [app_name] are defined in package.json file in each project directories.

### 5. Import

Then the internal package can be imported from the app scripts.  
Modifications of the packages will **not** be applied to the app before re-building.


# **Publish**

#### (!!!) Internal Package versions must be updated for every modifications.

### **Checklist**
 
- [ ] 패키지의 책임과 경계가 명확한가?
- [ ] `pyproject.toml`을 사용하여 의존성을 관리하는가?
- [ ] 패키지의 의존성은 추상적(`>=`), 앱의 의존성은 구체적(`==`)인가?
- [ ] `pytest`를 이용한 테스트 코드가 존재하는가?
- [ ] GitHub Actions 등 CI를 통해 테스트가 자동화되어 있는가?
- [ ] 유의적 버전(SemVer) 규칙에 따라 버전을 관리하는가?
- [ ] 모든 공개 함수/클래스에 Docstring이 작성되어 있는가?
- [ ] `README.md`에 설치 및 사용법이 잘 설명되어 있는가?


### 패스워드 등 민감 정보 관리

#### **1: `.gitignore`를 이용한 원천 차단**

#### **2: `.env.example` 템플릿 파일 제공**

#### **3:  코드에서 로드


### **CI/CD를 통한 배포 자동화**

#### !!! Github Repository Secrets 에 PYPI_API_TOKEN 및 NPM_ACCESS_TOKEN 등록

**`.github/workflows/dynamic-publish.yml` 

`v0.1.1` 같은 태그 달아 Push 하면, PyPI 및 npm 배포가 자동으로 완료

