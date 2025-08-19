from functools import partial
import matform as mf

from lib.physics.structure.geometry_painter import GeometryPainterWidget

from qleaf.core.abstract_comp import AbstractComp

from ..state import State


class Input3Dview(GeometryPainterWidget):
    def __init__(self,parent=None):
        super().__init__(parent)
        State().input_vars_defined.updated.connect(self.connect_data)
        self.connect_data()

    def connect_data(self):
        def setSpaceData(*args):
            form_prop = State().data_form_dicts["settings"]
            if State().display["space"].get():           
                self.show_space(form_prop.get())
            else:
                self.show_space(None)

        def setStructureData(*args):
            data = State().structure_evaluated.get()
            self.show_geometry("structure",data)

        def setRegion(table_name, color, *args):
            if State().display[table_name].get():           
                model = State().data_table_models[table_name].get()
                data_df = model.exportDataFrame()            
                data_df["color"] = mf.write_vectors([color])
                data = data_df.to_dict(orient="records")
                self.show_geometry(table_name, data)
            else:
                self.show_geometry(table_name,[])

        State().data_form_dicts["settings"].updated.connect(setSpaceData)
        State().data_form_dicts["settings"].updated.connect(setStructureData)

        setSpaceData()
        State().display["space"].updated.connect(setSpaceData)
        State().structure_evaluated.updated.connect(setStructureData)
        setStructureData()

        for table_name in State().color_regions_rendered.keys():
            color = State().color_regions_rendered[table_name]
            State().data_form_dicts["settings"].updated.connect(
                partial(setRegion, table_name, color))
            State().data_table_models[table_name].get().dataChanged.connect(
                partial(setRegion, table_name, color))
            State().display[table_name].updated.connect(
                partial(setRegion, table_name, color))
            setRegion(table_name, color)
