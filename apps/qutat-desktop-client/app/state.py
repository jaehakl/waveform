# Copyright (C) 2023 Jaehak Lee

import uuid
import matform as mf
from qleaf.core.prop import Prop

DB_MODEL = {
    "Account":[
        "id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE",
        "uuid TEXT NOT NULL UNIQUE",
        "name TEXT NOT NULL",
        "local_data_path TEXT NOT NULL"
    ],
    "Setup":[
        "id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE",
        "uuid TEXT NOT NULL UNIQUE",
        "name TEXT NOT NULL",
        "solver TEXT NOT NULL",
        "setup_data_path TEXT NOT NULL",
        "thumbnail_image_path TEXT NOT NULL",
    ],
    "Result":[
        "id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE",
        "uuid TEXT NOT NULL UNIQUE",
        "setup TEXT NOT NULL",
        "result_data_path TEXT NOT NULL",
        "FOREIGN KEY (setup) REFERENCES Setup(uuid)",
    ]
}

class MainState(metaclass=mf.MetaSingleton):
    def __init__(self):
        super().__init__()
        self.main_window = None
        self.sub_windows = {}

        self.account_id = Prop(None)
        self.account_id.set(uuid.uuid1().hex)
        account_name = self.account_id.get()[:10]

        #self.db = mf.database.DB("database.sqlite3")
        #self.db.create_tables(DB_MODEL)
        #self.db.table("Account").insert({"uuid":self.account_id.get(),"name":account_name,"local_data_path":"./data/"+account_name+"/"}) 




