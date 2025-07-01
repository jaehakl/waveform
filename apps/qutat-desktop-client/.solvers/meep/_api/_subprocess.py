# Copyright (C) 2023 Jaehak Lee

import uuid
import socketserver
from matform.meta_singleton import MetaSingleton
from matform.stdRV import StdRV

MAX_PACKET_SIZE = 4000 #limit: ~4K

class ServerDoc(metaclass=MetaSingleton):
    def __init__(self):
        self.rv = {}

class ServerAPI(socketserver.BaseRequestHandler):
    def setup(self):
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
        return StdRV.decode(data)

    def __sendObj(self, data):
        totalData = StdRV.encode(data)
        size = len(totalData)
        self.__sendSeg(str(size))
        div, mod = divmod(size,MAX_PACKET_SIZE)
        nDiv = div + 1
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
        print("Closing Local Server")
        self.shutdown()
        self.server_close()     

class AbstractSubprocessModel():
    def execute_task(self, command, *args):
        if command == "initialize":
            return self.initialize(*args)
        elif command == "run":
            return self.run(*args)
        elif command == "get_update":
            return self.send_update(*args)
        return "unknown_command"
    def initailize(self,*args):
        pass
    def run(self,*args):
        pass
    def send_update(self,*args):
        pass

def execute_socket_server(subprocess_model_cls, port):
    print("Socket server open, Port:",port)
    try:
        server = Server(("localhost",int(port)), ServerAPI)
        ServerDoc().model = subprocess_model_cls()
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
        server.server_close()
        print('Socket server (Port: '+port+') Closed')

