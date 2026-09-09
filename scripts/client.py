import torch
import torch.nn as nn
import torch.optim as optim
import requests
import pickle
import io
import argparse
import sys
import os
from torch.utils.data import DataLoader

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from core.models import BankingFraudNN
from core.he_utils import setup_tenseal_context, encode_and_encrypt

# Setup TenSEAL locally for the client to encrypt sensitive data
context = setup_tenseal_context()

def run_client(client_id, server_url, width_scale):
    print(f"--- Bank Branch Node {client_id} (Compute Scale: {width_scale}) ---")
    
    # 1. Dummy tabular banking batch
    num_samples = 100
    dummy_x = torch.randn(num_samples, 9)
    dummy_y = torch.randint(0, 2, (num_samples,))
    
    dataset = torch.utils.data.TensorDataset(dummy_x, dummy_y)
    train_loader = DataLoader(dataset, batch_size=16, shuffle=True)
    test_loader = DataLoader(dataset, batch_size=32, shuffle=False)
    
    # Auth Headers
    headers = {"Authorization": "Bearer secure_bank_node_token_2026"}
    
    model = BankingFraudNN(input_features=9, num_classes=2, width_scale=width_scale)
    
    # Evaluate current baseline
    model.eval()
    criterion = nn.CrossEntropyLoss()
    total_loss = 0
    with torch.no_grad():
        for inputs, targets in test_loader:
            outputs = model(inputs)
            total_loss += criterion(outputs, targets).item() * inputs.size(0)
            
    eval_loss = total_loss / num_samples
    print(f"Bank Node {client_id} baseline loss evaluated: {eval_loss:.4f}")
    
    # Train locally on private bank records
    print(f"Training securely on Private Bank Node {client_id} Financial Data...")
    model.train()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    for ep in range(3): # 3 local epochs
        for inputs, targets in train_loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            
    # Prepare updates & encrypt final classification layer
    local_state = model.state_dict()
    print("Encrypting sensitive banking classification matrix with Homomorphic Encryption...")
    enc_fc3_weight = encode_and_encrypt(context, local_state['fc3.weight'])
    enc_fc3_bias = encode_and_encrypt(context, local_state['fc3.bias'])
    
    print(f"Bank Node {client_id} update completed securely.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", type=int, required=True)
    parser.add_argument("--url", type=str, default="http://localhost:8000")
    parser.add_argument("--scale", type=float, default=1.0)
    args = parser.parse_args()
    
    run_client(args.id, args.url, args.scale)
