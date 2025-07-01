# Copyright (C) 2024 Jaehak Lee

import pandas as pd
from .item import Item

class Table():
    def __init__(self,table_name,parent_db):
        self.table_name = table_name
        self.db = parent_db

    def item(self,id):
        return Item(id,self.table_name,self.db)

    def create(self,columns=[]):
        table_name = self.table_name
        sql = "CREATE TABLE IF NOT EXISTS "+table_name+" ("
        for column_sql in columns:
            sql += column_sql+","            
        sql = sql[:-1]
        sql += ")"
        self.db._commit(sql)

    def delete(self):
        table_name = self.table_name
        sql = "DROP TABLE "+table_name
        self.db._commit(sql)

    def get(self):
        table_name = self.table_name
        if self.db.conn:            
            if table_name in [v[0] for v in self.db.tables()]:
                df = pd.read_sql_query("SELECT * FROM "+table_name, self.db.conn)
                return df
            else:
                return pd.DataFrame()

    def insert(self,values):
        table_name = self.table_name        
        table_columns = values.keys()
        query = "INSERT INTO " + table_name +" ("+",".join(table_columns)+") VALUES ('"+"','".join(values.values())+"')"
        self.db._commit(query)


    def set(self,df):
        table_name = self.table_name
        for ref_column in self.db._get("PRAGMA foreign_key_list("+table_name+")"):
            ref_column_name = ref_column[3]
            ref_table_name = ref_column[2]
            for i in range(len(df)):
                ref_id = df[ref_column_name][i]
                if not self.db._get("SELECT * FROM "+ref_table_name+" WHERE id="+str(ref_id)):
                    self.db.table(ref_table_name).append(ref_id)

        current_table = self.get()
        for col in current_table.dtypes.index:
            try:
                df[col] = df[col].astype(current_table.dtypes[col])
            except:
                return
        self.db._commit("DELETE FROM "+table_name)
        df.to_sql(table_name, self.db.conn, if_exists='append', index=False)
        self.db._commit()

    def append(self,id=None):
        #get_default_values
        table_name = self.table_name
        default_values = {}
        sql = "PRAGMA table_info("+table_name+")"
        table_columns = self.db._get(sql)
        for column in table_columns:
            default_values[column[1]] = column[4]

        for ref_column in self.db._get("PRAGMA foreign_key_list("+table_name+")"):
            ref_column_name = ref_column[3]
            ref_id = default_values[ref_column_name]
            ref_table_name = ref_column[2]
            if not self.db._get("SELECT * FROM "+ref_table_name+" WHERE id="+str(ref_id)):
                self.db.table(ref_table_name).append(ref_id)

        if id:
            self.db._commit("INSERT INTO "+table_name+" (id) VALUES ("+str(id)+")")
        else:
            self.db._commit("INSERT INTO "+table_name+" DEFAULT VALUES")
