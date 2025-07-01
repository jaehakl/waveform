# Copyright (C) 2023 Jaehak Lee

import time, subprocess, uuid, json
import socket, socketserver
from .meta_singleton import MetaSingleton
from .stdRV import StdRV

MAX_PACKET_SIZE = 4000 #limit: ~4K

class ClientAPI():
    def __init__(self, host="localhost", port=None):
        self.proc = None
        self.host = host
        self.port = port

    def __callServer(f):
        def wrapper(self, *args):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                connected = False
                for i in range(10):
                    try:
                        sock.connect((self.host, int(self.port)))
                        connected = True
                        break
                    except ConnectionRefusedError:
                        print("ConnectionRefusedError...("+str(i+1)+"/10)")
                    except OSError:
                        print("socket is busy...("+str(i+1)+"/10)")
                        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    time.sleep(0.3)
                if not connected:
                    print("서버와 접속할 수 없습니다. 접속 요청을 취소합니다.")
                else:
                    self.request = sock
                    returnValues = f(self, *args)
                    sock.close()
                    return returnValues
        return wrapper

    def openLocalServer(self, *args):
        if self.proc:
            print("Local 서버가 이미 열려 있습니다.")
        elif self.host != "localhost":
            print("Local 서버는 localhost에서만 열 수 있습니다.")
        else:
            if self.port is None:
                with socketserver.TCPServer(("localhost", 0), None) as s:
                    free_port = s.server_address[1]
                self.port = str(free_port)         
            print("args:",args)
            self.proc = subprocess.Popen([arg for arg in args] + [str(self.port)])
            return self.port

    @__callServer
    def execute_async_task(self,command,*inputVars):
        self.__sendObj(["execute_async_task",command]+[arg for arg in inputVars])
        task_id = self.__recvObj()
        return task_id

    @__callServer
    def get_return_value(self, task_id):
        self.__sendObj(["get_return_value",task_id])
        return_value = self.__recvObj()
        return return_value

    def execute_sync_task(self,command,*inputVars):
        task_id = self.execute_async_task(command, *inputVars)
        if task_id == "_cancel_":
            #If anyone got _cancel_, cancel the task and return _cancel_
            rv = "_cancel_"
        else:
            rv = self.get_return_value(task_id)
            while rv == "_none_":
                rv = self.get_return_value(task_id)
                time.sleep(0.01)
        return rv
    
    def __recvObj(self):
        seg1 = self.__recieveSeg()
        size = int(seg1)
        nDiv = int((size-1)/MAX_PACKET_SIZE)+1
        if nDiv > 1:
            dataList = []
            for i in range(nDiv):
                seg_i = self.__recieveSeg(MAX_PACKET_SIZE)
                dataList.append(seg_i)
            data = "".join(dataList)
        else:
            data = self.__recieveSeg(size)
        try:
            data_dec = StdRV.decode(data)
        except json.decoder.JSONDecodeError:
            print("JSONDecodeError")
            print(data[-100:],nDiv,size,len(data))
        return data_dec

    def __sendObj(self, data):
        totalData = StdRV.encode(data)
        size = len(totalData)
        self.__sendSeg(str(size))
        nDiv = int((size-1)/MAX_PACKET_SIZE)+1
        if nDiv > 1:
            for i in range(nDiv-1):
                segData = totalData[i*MAX_PACKET_SIZE:(i+1)*MAX_PACKET_SIZE]
                self.__sendSeg(segData)
            segData = totalData[(nDiv-1)*MAX_PACKET_SIZE:]
            self.__sendSeg(segData)
        else:
            segData = totalData
            self.__sendSeg(segData)

    def __recieveSeg(self,segmentSize=1024):
        self.request.send("call".encode(encoding="ascii"))
        seg = self.request.recv(segmentSize).decode("ascii")
        return seg

    def __sendSeg(self,segment):
        self.request.send(segment.encode(encoding="ascii"))
        response = self.request.recv(1024).decode("ascii")

class ServerDoc(metaclass=MetaSingleton):
    def __init__(self):
        self.rv = {}


class ServerAPI(socketserver.BaseRequestHandler):
    def setup(self):
        #print('[%s] 연결됨' % self.client_address[0])
        self.request.settimeout(1.0)

    def finish(self):
        pass

    def handle(self):
        try:
            request = self.__recvObj()
            order = request[0]
            args = [request[i] for i in range(1,len(request))]
            if order == "execute_async_task":
                task_id = str(uuid.uuid1().int)
                command = args[0]
                inputVars = args[1:]
                self.__sendObj(task_id)
                ServerDoc().rv[task_id] = ServerDoc().model.execute_task(command, *inputVars)
            elif order == "get_return_value":
                task_id = args[0]
                if task_id in ServerDoc().rv.keys():
                    self.__sendObj(ServerDoc().rv[task_id])
                    del ServerDoc().rv[task_id]
                else:
                    self.__sendObj("_none_")
        except Exception as e:
            print(e)

    def __recvObj(self):
        seg1 = self.__recieveSeg()
        if seg1:
            size = int(seg1)
            nDiv = int((size-1)/MAX_PACKET_SIZE)+1
            if nDiv>1:
                dataList = []            
                for i in range(nDiv):
                    dataList.append(self.__recieveSeg(MAX_PACKET_SIZE))
                data = "".join(dataList)
            else:
                data = self.__recieveSeg(size)
        else:
            data=None
        rv = StdRV.decode(data)
        return rv

    def __sendObj(self, data):
        totalData = StdRV.encode(data)
        size = len(totalData)
        self.__sendSeg(str(size))
        div, mod = divmod(size,MAX_PACKET_SIZE)
        nDiv = div + 1
        #nDiv = int((size-1)/MAX_PACKET_SIZE)+1
        if nDiv > 1:
            for i in range(nDiv-1):
                self.__sendSeg(totalData[i*MAX_PACKET_SIZE:(i+1)*MAX_PACKET_SIZE])
            self.__sendSeg(totalData[(nDiv-1)*MAX_PACKET_SIZE:])            
        else:
            self.__sendSeg(totalData)

    def __recieveSeg(self,segmentSize=1024):
        seg = self.request.recv(segmentSize).decode("ascii")
        self.request.send("response".encode(encoding="ascii"))
        return seg

    def __sendSeg(self,segment):
        call = self.request.recv(1024).decode("ascii")
        self.request.send(segment.encode(encoding="ascii"))
    
class Server(socketserver.ThreadingTCPServer):
    def __del__(self):
        print("Local 서버를 닫습니다.")
        self.shutdown()
        self.server_close()     

class AbstractSubprocessModel():
    def execute_task(self, command, *inputVars):
        if command == "initialize":
            return self.initialize(*inputVars)
        elif command == "run":
            return self.run(*inputVars)
        elif command == "get_update":
            return self.get_update(*inputVars)
        return "unknown_command"
    def initailize(self,*inputVars):
        pass
    def run(self,*inputVars):
        pass
    def get_update(self,*inputVars):
        pass

def execute_socket_server(subprocess_model_cls, port):
    print("socket server open, port:",port)
    try:
        server = Server(("localhost",int(port)), ServerAPI)
        ServerDoc().model = subprocess_model_cls()
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
        server.server_close()
        print('socket server (port: '+port+') closed')

