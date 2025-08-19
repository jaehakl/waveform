from django.db import models
from users.models import User
#from django.dispatch import receiver
#from django.utils.translation import ugettext_lazy as _

class Setup(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    id = models.CharField(max_length=200, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)    
    title = models.CharField(max_length=200)
    solver = models.TextField()
    setup_data = models.FileField(upload_to='setup/json/')
    public = models.BooleanField(default=False)
    work_request = models.IntegerField(default=0)
    description = models.TextField(null=True,blank=True)
    thumbnail = models.ImageField(upload_to='setup/image/',null=True,blank=True)

class Input(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    id = models.CharField(max_length=200, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200, default="Untitled")
    setup = models.ForeignKey(Setup, on_delete=models.CASCADE, db_index=True)
    file = models.FileField(upload_to='input/json/',null=True,blank=True)
    public = models.BooleanField(default=False)
    process_exist = models.BooleanField(default=False)
    results_exist = models.BooleanField(default=False, db_index=True)
    description = models.TextField(null=True,blank=True)
    thumbnail = models.ImageField(upload_to='result/image/',null=True,blank=True)

class Output2(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    id = models.CharField(max_length=200, primary_key=True) 
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200, default="Untitled")
    input = models.ForeignKey(Input, on_delete=models.CASCADE)
    public = models.BooleanField(default=False)
    description = models.TextField(null=True,blank=True)
    thumbnail = models.ImageField(upload_to='result/image/',null=True,blank=True)

class ImageFile(models.Model):
    id = models.CharField(max_length=200, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    file = models.ImageField(upload_to='etc/image/')

class Output2File(models.Model):
    id = models.CharField(max_length=200, primary_key=True)
    output = models.ForeignKey(Output2, on_delete=models.CASCADE)
    file = models.FileField(upload_to='result/json/')

class Process2(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    id = models.CharField(max_length=200, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    ip_address = models.CharField(max_length=200)
    input = models.ForeignKey(Input, null=True, blank=True, on_delete=models.CASCADE)
    status = models.CharField(null=True, blank=True, max_length=200)
    preview = models.ImageField(upload_to='process/image/',null=True,blank=True)

class ResultFile(models.Model):
    id = models.CharField(max_length=200, primary_key=True)
    input = models.ForeignKey(Input, on_delete=models.CASCADE, db_index=True)
    file = models.FileField(upload_to='result/json/')