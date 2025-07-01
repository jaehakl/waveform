# Copyright (C) 2024 Jaehak Lee

import pandas as pd

class Item():
    def __init__(self,id,table_name,parent_db):
        self.id = id
        self.table_name = table_name
        self.db = parent_db

    def get(self,depth=0,depth_max=2):
        id = self.id
        table_name = self.table_name
        row = pd.read_sql_query("SELECT * FROM "+table_name+" WHERE id="+str(id), self.db.conn)
        result = row.to_dict(orient='records')[0]

        if depth >= depth_max:
            return result

        for ref_column in self.db._get("PRAGMA foreign_key_list("+table_name+")"):
            ref_table_name = ref_column[2]
            ref_column_name = ref_column[3]
            ref_id = row[ref_column_name][0]
            result[ref_column_name] = self.db.table(ref_table_name).item(ref_id).get(depth+1)

        for other_table_name in [v[0] for v in self.db.tables()]:
            for ref_column in self.db._get("PRAGMA foreign_key_list("+other_table_name+")"):
                if ref_column[2] == table_name:
                    ref_column_name = ref_column[3]
                    for ref_row in self.db._get("SELECT * FROM "+other_table_name+" WHERE "+ref_column_name+"="+str(id)):
                        ref_row_id = ref_row[0]
                        result["("+ref_column_name+")"+other_table_name] = self.db.table(other_table_name).item(ref_row_id).get(depth+1)
        return result

    def delete(self,cascade=True):
        id = self.id
        table_name = self.table_name
        if cascade:
            for other_table_name in [v[0] for v in self.db.tables()]:
                for ref_column in self.db._get("PRAGMA foreign_key_list("+other_table_name+")"):
                    if ref_column[2] == table_name:
                        ref_column_name = ref_column[3]
                        for ref_row in self.db._get("SELECT * FROM "+other_table_name+" WHERE "+ref_column_name+"="+str(id)):
                            ref_row_id = ref_row[0]
                            self.db.table(other_table_name).item(ref_row_id).delete()
        self.db._commit("DELETE FROM "+table_name+" WHERE id="+str(id))