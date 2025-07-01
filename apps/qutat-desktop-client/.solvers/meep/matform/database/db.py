# Copyright (C) 2024 Jaehak Lee

import sqlite3 as dbEngine
from .table import Table

class DB():
    def __init__(self,db_path_prop):
        db_path = db_path_prop.get()
        if db_path:
            self.db_path_prop = db_path_prop                
            self.conn = dbEngine.connect(db_path_prop.get())
        else:
            self.conn = None
            print("DB file is not set")

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
            self.db_path_prop.updated.emit(self.db_path_prop)

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
        for column_name in model.keys():
            self.table(column_name).create(model[column_name])
        
    