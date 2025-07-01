# Copyright (C) 2024 Jaehak Lee

#Standard library modules
import base64
import json
import io

#Third-party modules
import numpy as np
import pandas as pd
from .array.labeledTensor import LabeledTensor

#Custom modules
class StdRV():
	def encode(var):
		return json.dumps(StdRV.encodeElement(var))		

	def encodeElement(var):
		varType = type(var).__name__
		if varType == "dict":
			rv = StdRV.encodeDict(var)
		elif varType == "list":
			rv = StdRV.encodeList(var)
		elif varType in ["int","int64"]:
			rv = StdRV.encodeInt(var)
		elif varType in ["float","float64"]:
			rv = StdRV.encodeFloat(var)
		elif varType in ["complex","complex128"]:
			rv = StdRV.encodeComplex(var)
		elif varType == "str":
			rv = StdRV.encodeStr(var)
		elif varType == "bytes":
			rv = StdRV.encodeBytes(var)
		elif varType == "DataFrame":
			rv = StdRV.encodeDataFrame(var)
		elif varType == "ndarray":
			rv = StdRV.encodeNdarray(var)
		elif varType == "LabeledTensor":
			rv = StdRV.encodeLabeledTensor(var)
		else:
			print(var, varType)
			rv = None
		return rv

	def encodeDict(dict_var):
		rv = {"type":"dict","value":{}}
		for varName in dict_var.keys():
			rv["value"][varName] = StdRV.encodeElement(dict_var[varName])
		return rv

	def encodeList(list_var):
		rv = {"type":"list","value":[]}
		for var in list_var:
			rv["value"].append(StdRV.encodeElement(var))
		return rv

	def encodeInt(n_var):
		rv = {"type":"int","value":str(n_var)}
		return rv

	def encodeFloat(d_var):
		rv = {"type":"float","value":str(float(d_var))}
		return rv

	def encodeComplex(d_var):
		rv = {"type":"complex","value":str(complex(d_var))}
		return rv

	def encodeStr(s_var):
		rv = {"type":"str","value":s_var}
		return rv

	def encodeBytes(b_var):
		b64str_var = base64.b64encode(b_var).decode('ascii')
		rv = {"type":"bytes","value":b64str_var}
		return rv

	def encodeDataFrame(df_var):
		df_json = df_var.to_json()
		rv = {"type":"DataFrame","value":df_json}
		return rv

	def encodeNdarray(arr_var):
		dtype = arr_var.dtype
		array = np.ascontiguousarray(arr_var).astype(dtype)
		b64str_var = base64.b64encode(array).decode('ascii')
		rv = {"type":"ndarray","value":b64str_var,"shape":array.shape,
			  "dtype":str(dtype.name)}
		return rv

	def encodeLabeledTensor(lt_var):
		rv = {"type":"LabeledTensor","value":lt_var.to_b64_np_dict()}
		return rv

	def decode(json_var):
		var = json.loads(json_var)
		return StdRV.decodeElement(var)

	def decodeElement(var):
		varType = var["type"]
		if varType == "dict":
			rv = StdRV.decodeDict(var)
		elif varType == "list":
			rv = StdRV.decodeList(var)
		elif varType == "int":
			rv = StdRV.decodeInt(var)
		elif varType == "float":
			rv = StdRV.decodeFloat(var)
		elif varType == "complex":
			rv = StdRV.decodeComplex(var)
		elif varType == "str":
			rv = StdRV.decodeStr(var)
		elif varType == "bytes":
			rv = StdRV.decodeBytes(var)
		elif varType == "DataFrame":
			rv = StdRV.decodeDataFrame(var)
		elif varType == "ndarray":
			rv = StdRV.decodeNdarray(var)
		elif varType == "LabeledTensor":
			rv = StdRV.decodeLabeledTensor(var)
		else:
			print(var, varType)
			rv = None
		return rv

	def decodeDict(var):
		dict_var = var["value"]
		rv = {}
		for varName in dict_var.keys():
			rv[varName] = StdRV.decodeElement(dict_var[varName])
		return rv

	def decodeList(var):
		list_var = var["value"]
		rv = []
		for var_el in list_var:
			rv.append(StdRV.decodeElement(var_el))
		return rv

	def decodeInt(var):		
		return int(var["value"])

	def decodeFloat(var):
		rv = float(var["value"])
		return rv

	def decodeComplex(var):
		rv = complex(var["value"])
		return rv

	def decodeStr(var):
		return str(var["value"])

	def decodeBytes(var):
		b64_str_value = var["value"]
		rv = base64.decodebytes(b64_str_value.encode('ascii'))
		return rv

	def decodeDataFrame(var):
		data = io.StringIO(var["value"])
		df = pd.read_json(data)
		return df

	def decodeNdarray(var):
		b64_str_value = var["value"]
		shape = var["shape"]

		dtype_name = var["dtype"]
		if dtype_name == "float":
			dtype = float
		elif dtype_name == "float64":
			dtype = np.float64
		elif dtype_name == "complex":
			dtype = complex
		elif dtype_name == "complex128":
			dtype = np.complex128

		s = np.frombuffer(
			base64.decodebytes(b64_str_value.encode('ascii')),
			dtype=dtype)
		
		arr = s.reshape(*shape)
		return arr
	
	def decodeLabeledTensor(var):
		lt = LabeledTensor.from_b64_np_dict(var["value"])
		return lt