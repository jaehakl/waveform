from models.services.bake_3d_mesh import eval_forest, clean_weld
import models.cgs_tree as cgs_tree
from models.geometry import (
    GeometryNode,
    GeometryRole,
    GeometryType,
    geometry_node_from_dict,
    geometry_node_to_dict,
)

if __name__ == "__main__":
    data = [geometry_node_to_dict(node) for node in cgs_tree.TEST_TREE]
    print(data)
    V, F = eval_forest(data)
    #V, F = clean_weld(V, F)
    print(V, F)
