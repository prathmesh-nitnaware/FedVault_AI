import torch
import numpy as np
try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    shap = None
    SHAP_AVAILABLE = False

try:
    import lime
    import lime.lime_tabular
    LIME_AVAILABLE = True
except ImportError:
    lime = None
    LIME_AVAILABLE = False

import warnings
warnings.filterwarnings("ignore")

def get_feature_importance(model, feature_names=None):
    """
    Simple XAI: Feature importance based on first-layer weights.
    For an MLP, the magnitude of the weights in the first linear layer 
    indicates how much each feature contributes to the network's internal representation.
    """
    try:
        # Get the first weight matrix (input -> first hidden layer)
        first_layer_name = None
        for name, module in model.network.named_modules():
            if isinstance(module, torch.nn.Linear):
                first_layer_name = name
                break
        
        if first_layer_name is None:
            return {"error": "No linear layer found in the model."}
        
        weights = model.network[0].weight.data.abs().cpu().numpy() # [hidden_size, input_features]
        importance = np.mean(weights, axis=0) # Average weight magnitude per feature
        
        # Normalize to sum to 1.0 (or just scale for visualization)
        total = np.sum(importance)
        if total > 0:
            importance = importance / total
            
        result = []
        for i, val in enumerate(importance):
            name = feature_names[i] if feature_names and i < len(feature_names) else f"Feature {i}"
            result.append({"feature": name, "importance": float(val)})
            
        # Sort by importance
        result.sort(key=lambda x: x["importance"], reverse=True)
        return result
    except Exception as e:
        return {"error": str(e)}

def explain_prediction(model, input_tensor, feature_names=None):
    """
    XAI: Saliency map (gradients of output with respect to input).
    Shows how much a small change in each input feature would change the output prediction.
    """
    try:
        model.eval()
        x = input_tensor.clone().detach().requires_grad_(True)
        
        output = model(x)
        target_class = output.argmax(dim=1)
        
        output[0, target_class].backward()
        
        gradients = x.grad.abs().detach().cpu().numpy()[0]
        
        total = np.sum(gradients)
        if total > 0:
            gradients = gradients / total
            
        result = []
        for i, val in enumerate(gradients):
            name = feature_names[i] if feature_names and i < len(feature_names) else f"Feature {i}"
            result.append({"feature": name, "score": float(val)})
            
        result.sort(key=lambda item: item["score"], reverse=True)
        return result
    except Exception as e:
        return [{"feature": "Saliency Error", "score": 0.0, "error": str(e)}]

def explain_prediction_shap(model, input_tensor, background_data=None, feature_names=None):
    """
    XAI: SHAP (SHapley Additive exPlanations).
    Uses DeepExplainer for PyTorch models.
    """
    try:
        num_features = input_tensor.shape[1]
        if background_data is None:
            background_data = torch.zeros((10, num_features))
        
        model.eval()
        clean_input = input_tensor.clone().detach()
        clean_bg = background_data.clone().detach()
        
        explainer = shap.DeepExplainer(model, clean_bg)
        shap_values = explainer.shap_values(clean_input, check_additivity=False)
        
        with torch.no_grad():
            output = model(clean_input)
            pred_class = torch.argmax(output).item()
            
        if isinstance(shap_values, list):
            class_shap = shap_values[pred_class][0]
        elif isinstance(shap_values, np.ndarray):
            if shap_values.ndim == 3:  # (samples, features, classes)
                class_shap = shap_values[0, :, pred_class]
            elif shap_values.ndim == 2:
                class_shap = shap_values[0]
            else:
                class_shap = shap_values.flatten()
        else:
            class_shap = np.array(shap_values).flatten()

        result = []
        for i in range(min(num_features, len(class_shap))):
            name = feature_names[i] if feature_names and i < len(feature_names) else f"Feature {i}"
            result.append({"feature": name, "score": float(class_shap[i])})
            
        result.sort(key=lambda item: abs(item["score"]), reverse=True)
        return result
    except Exception as e:
        return [{"feature": "SHAP Error", "score": 0.0, "error": str(e)}]

def explain_prediction_lime(model, input_tensor, feature_names=None):
    """
    XAI: LIME (Local Interpretable Model-Agnostic Explanations).
    Generates a local linear approximation of the model around the sample.
    """
    try:
        num_features = input_tensor.shape[1]
        clean_input = input_tensor.clone().detach().cpu().numpy()[0]
        training_data = np.random.normal(0, 1, size=(50, num_features))
        feat_names = feature_names[:num_features] if feature_names else [f"Feature {i}" for i in range(num_features)]
        
        explainer = lime.lime_tabular.LimeTabularExplainer(
            training_data,
            feature_names=feat_names,
            mode='classification'
        )
        
        def predict_fn(x):
            t = torch.tensor(x, dtype=torch.float32)
            with torch.no_grad():
                logits = model(t)
                probs = torch.nn.functional.softmax(logits, dim=1)
            return probs.cpu().numpy()
        
        exp = explainer.explain_instance(clean_input, predict_fn, num_samples=100)
        
        result = []
        for desc, weight in exp.as_list():
            result.append({"feature": desc, "score": float(weight)})
        return result
    except Exception as e:
        return [{"feature": "LIME Error", "score": 0.0, "error": str(e)}]
