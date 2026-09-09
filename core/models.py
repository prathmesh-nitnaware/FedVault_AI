import torch
import torch.nn as nn

class GenericMLP(nn.Module):
    """
    A flexible Multi-Layer Perceptron that adapts to any tabular dataset.
    Input features and output classes are configured dynamically based on the uploaded data.
    """
    def __init__(self, input_features, num_classes, hidden_sizes=None):
        super(GenericMLP, self).__init__()
        
        if hidden_sizes is None:
            # Auto-scale hidden layers based on input size
            h1 = max(32, input_features * 2)
            h2 = max(16, input_features)
            hidden_sizes = [h1, h2]
        
        layers = []
        prev_size = input_features
        
        for h in hidden_sizes:
            layers.append(nn.Linear(prev_size, h))
            layers.append(nn.LayerNorm(h))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(0.3))
            prev_size = h
        
        layers.append(nn.Linear(prev_size, num_classes))
        self.network = nn.Sequential(*layers)
    
    def forward(self, x):
        return self.network(x)


class BankingFraudNN(nn.Module):
    """
    Deep Neural Network optimized for Banking Systems (Fraud Detection & Credit Risk Scoring).
    Supports width scaling for heterogeneous bank branch compute nodes.
    """
    def __init__(self, input_features=9, num_classes=2, width_scale=1.0):
        super(BankingFraudNN, self).__init__()
        self.width_scale = width_scale
        
        h1 = max(16, int(64 * width_scale))
        h2 = max(8, int(32 * width_scale))
        
        self.fc1 = nn.Linear(input_features, h1)
        self.ln1 = nn.LayerNorm(h1)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.3)
        self.fc2 = nn.Linear(h1, h2)
        self.ln2 = nn.LayerNorm(h2)
        self.fc3 = nn.Linear(h2, num_classes)
        
    def forward(self, x):
        x = self.dropout(self.relu(self.ln1(self.fc1(x))))
        x = self.relu(self.ln2(self.fc2(x)))
        x = self.fc3(x)
        return x


def extract_submodel_weights(global_state_dict, width_scale, input_features=9, num_classes=2):
    target_model = BankingFraudNN(input_features=input_features, num_classes=num_classes, width_scale=width_scale)
    target_state = target_model.state_dict()
    sub_state = {}
    for key in target_state.keys():
        global_tensor = global_state_dict[key]
        target_tensor = target_state[key]
        if len(target_tensor.shape) == 2:
            sub_state[key] = global_tensor[:target_tensor.shape[0], :target_tensor.shape[1]]
        elif len(target_tensor.shape) == 1:
            sub_state[key] = global_tensor[:target_tensor.shape[0]]
    return sub_state

def insert_submodel_weights(global_state_dict, sub_state_dict):
    padded_update = {}
    for key, sub_tensor in sub_state_dict.items():
        global_tensor = global_state_dict[key]
        padded_update[key] = torch.zeros_like(global_tensor)
        if len(sub_tensor.shape) == 2:
            padded_update[key][:sub_tensor.shape[0], :sub_tensor.shape[1]] = sub_tensor
        elif len(sub_tensor.shape) == 1:
            padded_update[key][:sub_tensor.shape[0]] = sub_tensor
    return padded_update

