// @ts-nocheck

import { writeVectors, parseVectors } from './textExpression';

// 3x3 단위행렬 생성
function createIdentityMatrix() {
    return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];
}

// 행렬 곱셈
function matrixMultiply(a, b) {
    const result = [];
    for (let i = 0; i < a.length; i++) {
        result[i] = [];
        for (let j = 0; j < b[0].length; j++) {
            result[i][j] = 0;
            for (let k = 0; k < b.length; k++) {
                result[i][j] += a[i][k] * b[k][j];
            }
        }
    }
    return result;
}

// 벡터와 행렬 곱셈
function vectorMatrixMultiply(vector, matrix) {
    const result = [];
    for (let i = 0; i < matrix[0].length; i++) {
        result[i] = 0;
        for (let j = 0; j < vector.length; j++) {
            result[i] += vector[j] * matrix[j][i];
        }
    }
    return result;
}

// 벡터 덧셈
function vectorAdd(a, b) {
    return a.map((val, i) => val + b[i]);
}

// 벡터 스칼라 곱셈
function vectorScalarMultiply(vector, scalar) {
    let result = [];
    for (let i = 0; i < vector.length; i++) {
        result[i] = vector[i] * scalar[i];
    }
    return result;
}

// 회전 행렬 생성 (축과 각도로부터)
function rotationMatrixFromAxisAndAngle(axis, angle) {
    const norm = Math.sqrt(axis[0]**2 + axis[1]**2 + axis[2]**2);
    axis = axis.map(val => val / norm);
    
    const rad = angle * Math.PI / 180 / 2;
    const a = Math.cos(rad);
    const b = -axis[0] * Math.sin(rad);
    const c = -axis[1] * Math.sin(rad);
    const d = -axis[2] * Math.sin(rad);
    
    return [
        [a*a+b*b-c*c-d*d, 2*(b*c-a*d), 2*(b*d+a*c)],
        [2*(b*c+a*d), a*a+c*c-b*b-d*d, 2*(c*d-a*b)],
        [2*(b*d-a*c), 2*(c*d+a*b), a*a+d*d-b*b-c*c]
    ];
}

// 역회전 축 계산
function rotatedAxisFromAxisAndAngleInv(rotations, axis = createIdentityMatrix()) {
    let result = axis;
    for (const rotation of rotations) {
        const rotAxis = rotation.slice(0, -1);
        const rotAngle = -rotation[rotation.length - 1]; // 역회전
        const rotMatrix = rotationMatrixFromAxisAndAngle(rotAxis, rotAngle);
        result = matrixMultiply(rotMatrix, result);
    }
    return result;
}

// 수식 평가 함수
function evalF(f, size = null, props = null, material = null) {
    const fStr = String(f);
    if (fStr[0] === '$') {
        // 수식 평가 (Sin, Cos 등)
        const expression = fStr.substring(1);
        // 간단한 수식만 지원 (실제로는 더 복잡한 파서 필요)
        return eval(expression);
    } else if (fStr[0] === '%') {
        // 랜덤 값 생성
        const [xmin, xmax] = fStr.substring(1).split('~');
        return Math.random() * (parseFloat(xmax) - parseFloat(xmin)) + parseFloat(xmin);
    } else {
        return f;
    }
}

// 엔티티 파싱
function parseEntity(entity) {
    const entityParsed = { ...entity };
    entityParsed.position = parseVectors(entity.position, 3, 1);
    entityParsed.rotation = parseVectors(entity.rotation, 4);
    entityParsed.array = parseVectors(entity.array, 3, 2);
    entityParsed.size = parseVectors(entity.size, 3, 1);
    entityParsed.props = parseVectors(entity.props);
    entityParsed.material = parseVectors(entity.material, 3, 1);
    return entityParsed;
}

// 엔티티를 문자열로 변환
function writeEntity(entityParsed) {
    const entity = { ...entityParsed };
    entity.position = writeVectors(entityParsed.position);
    entity.rotation = writeVectors(entityParsed.rotation);
    entity.array = writeVectors(entityParsed.array);
    entity.size = writeVectors(entityParsed.size);
    entity.props = writeVectors(entityParsed.props);
    entity.material = writeVectors(entityParsed.material);
    return entity;
}

// 개별 엔티티 평가
function evalEntity(entity, size, props, material, arrayDict = {}) {
    const entityParsed = parseEntity(entity);
    const rv = {};
    const rvRandom = {};
    
    // 기본 속성 복사
    for (const key of Object.keys(entityParsed)) {
        if (!['array', 'position', 'rotation', 'size', 'props', 'material'].includes(key)) {
            rv[key] = entityParsed[key];
        }
    }
    
    // 배열 평가
    if (!('array' in arrayDict)) {
        rv.array = entityParsed.array.map(fList => 
            fList.map(f => evalF(f, size, props, material))
        );
    } else {
        rv.array = arrayDict.array;
    }
    
    // 랜덤 값 체크
    for (let i = 0; i < entityParsed.array.length; i++) {
        for (let j = 0; j < entityParsed.array[0].length; j++) {
            if (String(entityParsed.array[i][j])[0] === '%') {
                rvRandom.array = rv.array;
                break;
            }
        }
    }
    
    const nArray = rv.array[0];
    
    // 배열 속성 평가 함수
    function evalArray(keyword) {
        if (!(keyword in arrayDict)) {
            rv[keyword] = [];
            for (let i_x = 0; i_x < parseInt(nArray[0]); i_x++) {
                rv[keyword][i_x] = [];
                for (let i_y = 0; i_y < parseInt(nArray[1]); i_y++) {
                    rv[keyword][i_x][i_y] = [];
                    for (let i_z = 0; i_z < parseInt(nArray[2]); i_z++) {
                        rv[keyword][i_x][i_y][i_z] = entityParsed[keyword].map(fList =>
                            fList.map(f => evalF(f, size, props, material))
                        );
                    }
                }
            }
        } else {
            rv[keyword] = arrayDict[keyword];
        }
        
        // 랜덤 값 체크
        for (let i = 0; i < entityParsed[keyword].length; i++) {
            for (let j = 0; j < entityParsed[keyword][0].length; j++) {
                if (String(entityParsed[keyword][i][j])[0] === '%') {
                    rvRandom[keyword] = rv[keyword];
                    break;
                }
            }
        }
    }
    
    evalArray('position');
    evalArray('rotation');
    evalArray('size');
    evalArray('props');
    evalArray('material');
    
    return [rv, rvRandom];
}

// 메인 구조 평가 함수
export function evalStructure(structuresDf, componentsDf, arrayAxis = createIdentityMatrix(), address = "", arrayDictsInit = null,
                            parentSize = null, parentProps = null, parentMaterial = null, parsed = false) {
    
    const entityList = [];
    let arrayDicts = arrayDictsInit ? JSON.parse(JSON.stringify(arrayDictsInit)) : {};
    
    for (let i = 0; i < structuresDf.length; i++) {
        const componentAddress = address + "/" + i;
        
        let arrayDict = {};
        if (componentAddress in arrayDicts) {
            arrayDict = arrayDicts[componentAddress];
        }
        const [arrayDictResult, arrayDictRandom] = evalEntity(
            structuresDf[i], parentSize, parentProps, parentMaterial, arrayDict
        );
        arrayDicts[componentAddress] = arrayDictRandom;
        
        const nArray = arrayDictResult.array[0];
        const sizeArray = arrayDictResult.array[1];
        
        for (let i_x = 0; i_x < parseInt(nArray[0]); i_x++) {
            for (let i_y = 0; i_y < parseInt(nArray[1]); i_y++) {
                for (let i_z = 0; i_z < parseInt(nArray[2]); i_z++) {
                    const elementAddress = componentAddress + "(" + i_x + "," + i_y + "," + i_z + ")";
                    
                    const elementDict = JSON.parse(JSON.stringify({
                        component: arrayDictResult.component,
                        component_id: arrayDictResult.component_id,
                        array: arrayDictResult.array,
                        index: [i_x, i_y, i_z],
                        position: arrayDictResult.position[i_x][i_y][i_z],
                        rotation: arrayDictResult.rotation[i_x][i_y][i_z],
                        size: arrayDictResult.size[i_x][i_y][i_z],
                        props: arrayDictResult.props[i_x][i_y][i_z],
                        material: arrayDictResult.material[i_x][i_y][i_z],
                    }));
                    
                    // 위치 계산
                    const centerOffset = [
                        i_x - (nArray[0] - 1) / 2,
                        i_y - (nArray[1] - 1) / 2,
                        i_z - (nArray[2] - 1) / 2
                    ];
                    const offsetVector = vectorScalarMultiply(centerOffset, sizeArray);
                    const transformedOffset = vectorMatrixMultiply(offsetVector, arrayAxis);
                    elementDict.position[0] = vectorAdd(elementDict.position[0], transformedOffset);
                    
                    if (['sphere', 'ellipsoid', 'cone', 'block', 'region', 'region_func', 'so_revol_func'].includes(elementDict.component)) {
                        entityList.push(elementDict);
                    } else if (componentsDf && componentsDf.some(comp => comp.component_id === elementDict.component)) {
                        // 컴포넌트 재귀 처리
                        const componentsUnitDf = componentsDf.filter(comp => comp.component_id === elementDict.component);
                        const elementAxis = rotatedAxisFromAxisAndAngleInv(elementDict.rotation);
                        
                        const [entityListPartial, arrayDictsPartial] = evalStructure(
                            componentsUnitDf, componentsDf, elementAxis, elementAddress, arrayDicts,
                            elementDict.size[0], elementDict.props, elementDict.material[0], true
                        );
                        
                        for (const entity of entityListPartial) {
                            entity.position[0] = vectorAdd(
                                elementDict.position[0],
                                vectorMatrixMultiply(entity.position[0], elementAxis)
                            );
                            entity.rotation = entity.rotation.concat(elementDict.rotation);
                            entityList.push(entity);
                        }
                        
                        // arrayDicts 병합
                        for (const key of Object.keys(arrayDictsPartial)) {
                            arrayDicts[key] = arrayDictsPartial[key];
                        }
                    }
                }
            }
        }
    }
    
    if (!parsed) {
        return [entityList.map(entity => writeEntity(entity)), arrayDicts];
    }
    
    return [entityList, arrayDicts];
} 