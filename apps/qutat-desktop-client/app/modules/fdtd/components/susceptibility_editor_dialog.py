# Copyright (C) 2023 Jaehak Lee

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Qt5Agg')
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg
from matplotlib.figure import Figure

from PySide6.QtWidgets import QDialog, QHBoxLayout, QVBoxLayout, QPushButton

from qleaf.comp.basic.table import TableEditorModel, TableView
from ..service import material
from ..state import State
import matform as mf


class SusceptibilityEditorDialog(QDialog):
    def __init__(self, material_id, nsus_index, parent):
        super().__init__(parent)

        self.material_id = material_id
        self.nsus_index = nsus_index

        sus_df = State().material_sus.get()
        if len(sus_df) == 0:
            sus_df_material = pd.DataFrame(columns= material.NEW_SUSCEPTIBILITY.keys())
        else:
            sus_df_material = sus_df[sus_df["material_id"]==material_id]

        defaultRowDict = material.NEW_SUSCEPTIBILITY.copy()
        del defaultRowDict["material_id"]

        model = TableEditorModel(defaultRowDict=defaultRowDict)
        model.importDataFrame(sus_df_material.drop("material_id",axis=1))
        model.dataChanged.connect(self.showEpsilon)

        layout = QHBoxLayout()

        self.table = TableView()
        self.table.setModel(model)
        layout.addWidget(self.table)

        right_layout = QVBoxLayout()

        self.chart = FigureCanvasQTAgg(Figure())
        saveButton = QPushButton("Save & Exit")
        saveButton.clicked.connect(self.saveClose)

        right_layout.addWidget(self.chart)
        right_layout.addWidget(saveButton)

        layout.addLayout(right_layout)

        self.setLayout(layout)

        self.setWindowTitle("Material Susceptibility")
        self.resize(1400, 700)
        self.table.resizeColumnsToContents()        

        self.showEpsilon()
        self.exec_()

    def saveClose(self):
        table_df = self.table.model().exportDataFrame()
        table_df["material_id"] = self.material_id
        sus_df = State().material_sus.get()
        sus_df = sus_df[sus_df["material_id"]!=self.material_id]
        if len(table_df) > 0:
            sus_df = pd.concat([sus_df,table_df])
        State().material_sus.set(sus_df)
        State().material_table_model.get().setData(self.nsus_index, len(table_df))
        self.close()

    def showEpsilon(self):
        def get_Lorentz(freq, freq_0, gamma, sigma):
            return sigma*(freq_0**2)/(freq_0**2-freq**2-1j*freq*gamma)            
        
        def get_Drude(freq, freq_0, gamma, sigma):
            return 1j*sigma*(freq_0**2)/(freq*(gamma-1j*freq))

        freqs = np.linspace(0.1, 0.8, 100)

        material = State().material_table_model.get().exportDataFrame().iloc[self.nsus_index.row()]
        eps = mf.parse_vectors(material.eps)
        cond = mf.parse_vectors(material.cond)

        epsilon_names = ["eps_00","eps_11","eps_22","eps_01","eps_02","eps_12"]
        epsilons = []
        for i_diag in [0,1]:
            for i_dir in [0,1,2]:
                amp_cond = (1+1j*cond[i_diag][i_dir]/(2*np.pi*freqs))
                eps_sum = eps[i_diag][i_dir]
                table_df = self.table.model().exportDataFrame()
                for i in range(len(table_df)):
                    el = table_df.iloc[i]
                    sigma = mf.parse_vectors(el["sigma"])

                    freq_0 = el["frequency"]
                    gamma = el["gamma"]

                    if el["sus_class"] == "LorentzianSusceptibility":
                        eps_sum += get_Lorentz(freqs, freq_0, gamma, sigma[i_diag][i_dir])
                    elif el["sus_class"] == "DrudeSusceptibility":
                        eps_sum += get_Drude(freqs, freq_0, gamma, sigma[i_diag][i_dir])
                epsilons.append(amp_cond*eps_sum)

        self.chart.figure.clf()
        for i , name in enumerate(epsilon_names):
            plot = self.chart.figure.add_subplot(2,3,i+1)
            epsilon = epsilons[i]
            plot.plot(freqs, np.real(epsilon),label="Re")
            plot.plot(freqs, np.imag(epsilon),label="Im")
            plot.set_title(name)
            plot.set_xlabel("Frequency (PHz)")
            plot.legend()
        self.chart.figure.tight_layout()
        self.chart.draw()
