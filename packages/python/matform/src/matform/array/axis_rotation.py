# Copyright (C) 2024 Jaehak Lee

import numpy as np

def get_rotated_axis(e3_new,e1_old=[1,0,0],e2_old=[0,1,0],e3_old=[0,0,1]):
    ox, oy, oz = e3_new
    if (np.dot(e3_new,e3_old)/np.linalg.norm(e3_new) > 0.99999):
        e1 = e1_old
        e2 = e2_old
        e3 = e3_old
    else:
        ori_vec = np.array([ox,oy,oz])/np.linalg.norm([ox,oy,oz])
        rot_axis = np.cross([0,0,1],ori_vec)
        rot_angle = np.arccos(np.dot([0,0,1],ori_vec))*180/np.pi
        rotation_matrix = rontation_matrix_from_axis_and_angle(rot_axis,rot_angle)            
        e1 = list(np.dot(np.array(e1_old),rotation_matrix))
        e2 = list(np.dot(np.array(e2_old),rotation_matrix))
        e3 = list(np.dot(np.array(e3_old),rotation_matrix))
    return e1, e2, e3

def rotated_axis_from_axis_and_angle(rotations, axis=np.eye(3)):
    for rotation in rotations:
        rot_axis = rotation[:-1]
        rot_angle = rotation[-1]
        axis = np.matmul(rontation_matrix_from_axis_and_angle(rot_axis,rot_angle),axis)
    return axis

def rotated_axis_from_axis_and_angle_inv(rotations, axis=np.eye(3)):
    for rotation in rotations:
        rot_axis = rotation[:-1]
        rot_angle = rotation[-1]
        axis = np.matmul(rontation_matrix_from_axis_and_angle(rot_axis,-rot_angle),axis)
    return axis

def rontation_matrix_from_axis_and_angle(axis,angle):
    axis = axis/np.linalg.norm(axis)
    a = np.cos(angle/180*np.pi/2)
    b, c, d = -axis*np.sin(angle/180*np.pi/2)
    return np.array([[a*a+b*b-c*c-d*d, 2*(b*c-a*d), 2*(b*d+a*c)],
                    [2*(b*c+a*d), a*a+c*c-b*b-d*d, 2*(c*d-a*b)],
                    [2*(b*d-a*c), 2*(c*d+a*b), a*a+d*d-b*b-c*c]])
