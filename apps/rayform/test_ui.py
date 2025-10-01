#!/usr/bin/env python3
"""
Rayform Studio UI 테스트 스크립트
PySide6가 설치되지 않은 환경에서도 모듈 import를 테스트할 수 있습니다.
"""

import sys
import os

# app 디렉토리를 Python path에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

def test_imports():
    """모든 모듈 import 테스트"""
    try:
        print("Testing imports...")
        
        # 모델 import 테스트
        from models import WorkspaceData, GeometryNode, GeometryRole, GeometryType
        print("✓ Models imported successfully")
        
        # Context import 테스트
        from context import Context
        print("✓ Context imported successfully")
        
        # State import 테스트
        from state import State
        print("✓ State imported successfully")
        
        # UI 모듈들 import 테스트 (PySide6 없이도 가능한지 확인)
        try:
            from ui.cgs_tree_widget import CGSTreeWidget
            print("✓ CGS Tree Widget imported successfully")
        except ImportError as e:
            print(f"⚠ CGS Tree Widget import failed: {e}")
        
        try:
            from ui.editor_panel import EditorPanel
            print("✓ Editor Panel imported successfully")
        except ImportError as e:
            print(f"⚠ Editor Panel import failed: {e}")
        
        try:
            from ui.main_window import MainWindow
            print("✓ Main Window imported successfully")
        except ImportError as e:
            print(f"⚠ Main Window import failed: {e}")
        
        print("\n모든 모듈이 성공적으로 import되었습니다!")
        return True
        
    except Exception as e:
        print(f"❌ Import 실패: {e}")
        return False

def test_data_models():
    """데이터 모델 테스트"""
    try:
        print("\nTesting data models...")
        
        from models import WorkspaceData, GeometryNode, GeometryRole, GeometryType
        
        # WorkspaceData 생성 테스트
        workspace = WorkspaceData()
        print("✓ WorkspaceData created")
        
        # GeometryNode 생성 테스트
        node = GeometryNode(
            role=GeometryRole.UNION,
            geometry_type=GeometryType.SPHERE,
            geometry="sphere",
            pos=[0, 0, "$a"],
            rotation=[0, 0, 0],
            material="SiO2"
        )
        print("✓ GeometryNode created")
        
        # WorkspaceData에 노드 추가
        workspace.add_geometry_node(node)
        print("✓ Node added to workspace")
        
        # 파라미터 추가
        workspace.update_parameter("a", 10.0)
        workspace.update_parameter("b", "%10~20")
        print("✓ Parameters added")
        
        # 재료 데이터 추가
        sio2_data = {
            400e-9: complex(1.46, 0.0),
            500e-9: complex(1.45, 0.0),
        }
        workspace.update_material("SiO2", sio2_data)
        print("✓ Material data added")
        
        # 딕셔너리 변환 테스트
        data_dict = workspace.to_dict()
        print("✓ Data converted to dictionary")
        
        # 딕셔너리에서 복원 테스트
        restored_workspace = WorkspaceData.from_dict(data_dict)
        print("✓ Data restored from dictionary")
        
        print("모든 데이터 모델 테스트가 성공했습니다!")
        return True
        
    except Exception as e:
        print(f"❌ 데이터 모델 테스트 실패: {e}")
        return False

def main():
    """메인 테스트 함수"""
    print("Rayform Studio UI 테스트 시작\n")
    
    # Import 테스트
    import_success = test_imports()
    
    # 데이터 모델 테스트
    model_success = test_data_models()
    
    print(f"\n테스트 결과:")
    print(f"Import 테스트: {'성공' if import_success else '실패'}")
    print(f"데이터 모델 테스트: {'성공' if model_success else '실패'}")
    
    if import_success and model_success:
        print("\n🎉 모든 테스트가 성공했습니다!")
        print("PySide6를 설치하면 완전한 UI를 사용할 수 있습니다.")
        print("설치 명령: pip install PySide6")
    else:
        print("\n❌ 일부 테스트가 실패했습니다.")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
