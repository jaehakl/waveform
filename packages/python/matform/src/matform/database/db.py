# Copyright (C) 2024 Jaehak Lee

import sqlite3 as dbEngine
from .table import Table

class DB():
    def __init__(self, db_path):
        self.db_path = db_path                
        self.conn = dbEngine.connect(db_path)

    def _get(self, query=None):
        rv = []
        if self.conn:
            if query:
                cursor = self.conn.cursor()
                cursor.execute(query)                
                rv = cursor.fetchall()
                cursor.close()
        return rv

    def _commit(self, query=None):
        if self.conn:
            if query:
                cursor = self.conn.cursor()
                cursor.execute(query)
                cursor.close()
            self.conn.commit()

    def __del__(self):
        if self.conn:
            self.conn.close()

    def table(self,table_name):
        return Table(table_name,self)

    def create(self):
        if self.conn:
            self._commit()

    def tables(self):
        sql = '''SELECT name FROM sqlite_master WHERE type='table'
                  EXCEPT SELECT name FROM sqlite_master WHERE name='sqlite_sequence';
                '''         
        return self._get(sql)

    def create_tables(self, model):
        for table_name in model.keys():
            self.table(table_name).create(model[table_name])
        


##########################################################################################
#Example of model
#model = {
#    "Company":[
#        "id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE",
#        "name TEXT NOT NULL DEFAULT 'Qutat'",
#        "created_at DATETIME NOT NULL DEFAULT (DATETIME('now','localtime'))",
#        "country INTEGER NOT NULL DEFAULT '1'",
#        "FOREIGN KEY (country) REFERENCES Country(id)",
#    ],
#    "Country":[
#        "id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE",
#        "name TEXT NOT NULL DEFAULT 'Korea'",
#        "created_at DATETIME NOT NULL DEFAULT (DATETIME('now','localtime'))",
#    ],
#    "City":[
#        "id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE",
#        "name TEXT NOT NULL DEFAULT 'Daejeon'",
#        "created_at DATETIME NOT NULL DEFAULT (DATETIME('now','localtime'))",
#        "country INTEGER NOT NULL DEFAULT '1'",
#        "FOREIGN KEY (country) REFERENCES Country(id)",
#    ],
#    "Person":[
#        "id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE",
#        "name TEXT NOT NULL DEFAULT 'Jaehak Lee'",
#        "created_at DATETIME NOT NULL DEFAULT (DATETIME('now','localtime'))",
#        "company INTEGER NOT NULL DEFAULT '1'",
#        "city INTEGER NOT NULL DEFAULT '1'",
#        "FOREIGN KEY (company) REFERENCES Company(id)",
#        "FOREIGN KEY (city) REFERENCES City(id)",
#    ]
#}
##########################################################################################

