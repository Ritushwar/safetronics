# this module received data from communication module, predict the health risk status and
# transfer data to push module which push the data to database

# lets takes the sample data from the communication module and predict the result
from required import *
import torch
import torch.nn as nn
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
# defining model structure
class PredictRisk(nn.Module):
  def __init__(self, input_dim):
    super(PredictRisk, self).__init__()
    self.net = nn.Sequential(
        nn.Linear(input_dim,16),
        nn.ReLU(),
        nn.Dropout(p=0.4),

        nn.Linear(16,8),
        nn.ReLU(),
        nn.Dropout(p=0.4),

        nn.Linear(8,4),
        nn.ReLU(),
        nn.Dropout(p=0.4),

        nn.Linear(4,1),
        nn.Sigmoid()
    )

  def forward(self, x):
    return self.net(x)
# 

def prediction(received_data, add_info):
   # data unpack
   ID = add_info["id"]
   HR = received_data["heartRate"]
   BT = received_data["bodyTemp"]
   OS = received_data["spo2"]
   A = add_info["age"]
   G = 0 if add_info["gender"] == "female" else 1
   W = add_info["weight_kg"]
   H = add_info["height_m"]
   HRV = 0.067
   BMI = add_info["bmi"]

   # instances the model and load the scaler
   model_path = "/home/ritu/safetronics/Neural Model/NeuralModel.pth"
   scaler_path = "/home/ritu/safetronics/Neural Model/Neural_Scaler.joblib"
   scaler = joblib.load(scaler_path)
   input_dim = 9
   model = PredictRisk(input_dim = input_dim)

   # convert to tensor
   model_data = np.array([[HR,BT,OS,A,G,W,H,HRV,BMI]])
   model_data_scaled = scaler.transform(model_data)
   x = torch.tensor(model_data_scaled, dtype=torch.float32)

   # load the state dict
   state = torch.load(model_path)
   model.load_state_dict(state)

   # predict
   model.eval()
   with torch.no_grad():
      prob = model(x)
      prob = prob.numpy().ravel()
      pred_class = (prob > 0.5).astype(int)

   result = {
     "worker_ID": ID,
     "probability": prob[0].item(),
     "prediction": pred_class[0].item()
   }
   return result