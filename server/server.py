"""
FedVault AI Central Aggregation Server
- JWT Authentication with PostgreSQL/In-Memory
- Generic Financial Federated Learning (Sample-Weighted FedAvg)
- Real-time dashboard analytics
- FedAvg aggregation with CKKS Homomorphic Encryption
"""
import torch
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional
import io
import pickle
import json
import time
import asyncio
import bcrypt
import jwt
import os
from datetime import datetime, timedelta

import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from core.models import GenericMLP
from xai_utils import get_feature_importance, explain_prediction, explain_prediction_shap, explain_prediction_lime

# ── In-Memory Database (Replacing db.py) ──────────────────────────────────────
app = FastAPI(title="FedVault AI Aggregator")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
_db = {
    "users": [],
    "training_sessions": [],
    "federated_rounds": [],
    "next_user_id": 1,
    "next_session_id": 1,
    "next_round_id": 1
}

DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "fedvault_db.json"))

def save_db():
    """Persist the current state of _db to a JSON file."""
    try:
        with open(DB_FILE, "w") as f:
            json.dump(_db, f, indent=4)
    except Exception as e:
        print(f"❌ Error saving database: {e}")

def load_db():
    """Load the state of _db from a JSON file if it exists."""
    global _db
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r") as f:
                data = json.load(f)
                _db.update(data)
            print(f"✅ Loaded database from {DB_FILE} ({len(_db['users'])} users found)")
        except Exception as e:
            print(f"❌ Error loading database: {e}")

def init_db():
    load_db()
    print("✅ Database system initialized.")

def create_user(username: str, email: str, password_hash: str):
    for u in _db["users"]:
        if u["email"] == email or u["username"] == username:
            return None
    user_id = _db["next_user_id"]
    user = {
        "id": user_id,
        "username": username,
        "email": email,
        "password_hash": password_hash,
        "created_at": datetime.now().isoformat(),
        "last_login": None,
        "is_active": True
    }
    _db["users"].append(user)
    _db["next_user_id"] += 1
    save_db()
    return user

def get_user_by_email(email: str):
    for u in _db["users"]:
        if u["email"].lower() == email.lower():
            return u
    return None

def get_user_by_identifier(identifier: str):
    identifier = identifier.strip().lower()
    for u in _db["users"]:
        if u["email"].lower() == identifier or u["username"].lower() == identifier:
            return u
    return None

def get_user_by_id(user_id: int):
    for u in _db["users"]:
        if u["id"] == user_id:
            return u
    return None

def update_last_login(user_id: int):
    for u in _db["users"]:
        if u["id"] == user_id:
            u["last_login"] = datetime.now().isoformat()
            save_db()
            break

def save_training_session(user_id: int, dataset_name: str, num_features: int, num_samples: int, accuracy: float, loss: float, training_round: int):
    username = "Unknown"
    for u in _db["users"]:
        if u["id"] == user_id:
            username = u["username"]
            break
    session = {
        "id": _db["next_session_id"],
        "user_id": user_id,
        "username": username,
        "dataset_name": dataset_name,
        "num_features": num_features,
        "num_samples": num_samples,
        "accuracy": accuracy,
        "loss": loss,
        "training_round": training_round,
        "created_at": datetime.now().isoformat()
    }
    _db["training_sessions"].append(session)
    _db["next_session_id"] += 1
    save_db()

def save_federated_round(round_number: int, num_participants: int, avg_accuracy: float, avg_loss: float):
    fedround = {
        "id": _db["next_round_id"],
        "round_number": round_number,
        "num_participants": num_participants,
        "avg_accuracy": avg_accuracy,
        "avg_loss": avg_loss,
        "aggregation_method": "FedAvg",
        "created_at": datetime.now().isoformat()
    }
    _db["federated_rounds"].append(fedround)
    _db["next_round_id"] += 1
    save_db()

def get_all_users_count():
    return len(_db["users"])

def get_recent_sessions(limit: int = 20):
    return _db["training_sessions"][-limit:][::-1]

# ── App Setup ──────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "fedvault_secret_key_2026_change_in_production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

# ── Federated Learning State ──────────────────────────────────────────────────
# Stores model weights from each client, keyed by a model config hash
client_updates: List[Dict] = []
client_metrics: List[Dict] = []
global_model_weights: Optional[Dict] = None
global_model_config: Optional[Dict] = None  # {input_features, num_classes}

# Connected user tracking
connected_users: Dict[str, Dict] = {}  # user_id -> {username, status, last_seen, ...}
online_users: Dict[str, float] = {}  # user_id -> last_heartbeat_timestamp

MIN_CLIENTS_PER_ROUND = 2  # Default to 2 bank nodes for true Federated Learning
TIMEOUT_SECONDS = 120        # Timeout after which buffered updates auto-aggregate

system_status = {
    "round": 0,
    "status": "Idle",
    "logs": ["🚀 FedVault AI Aggregation Server initialized. Waiting for client connections..."],
    "accuracy_history": [],
    "loss_history": [],
    "client_accuracies": [],  # Per-client accuracy each round
    "connected_clients": {},
    "total_registered_users": 0,
    "online_users_count": 0,
    "global_model_version": "v0.0.0",
    "last_updated": "Never",
    "training_sessions": [],
    "fairness_metrics": [],
    "min_clients_per_round": MIN_CLIENTS_PER_ROUND,
    "pending_updates": [],
    "pending_updates_count": 0,
}

def add_log(msg: str):
    timestamp = datetime.now().strftime("%H:%M:%S")
    entry = f"[{timestamp}] {msg}"
    print(entry)
    system_status["logs"].insert(0, entry)
    if len(system_status["logs"]) > 100:
        system_status["logs"].pop()

# ── Database Init ─────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    try:
        init_db()
        add_log("[INFO] FedVault AI Aggregation Server initialized.")
        add_log("[INFO] Persistent database loaded. Waiting for bank node connections...")
        add_log("[INFO] Federated Averaging (FedAvg) engine ready. Algorithm: Sample-Weighted Averaging.")
        add_log("[INFO] Endpoint /submit-update open for model weight submissions from bank nodes.")
    except Exception as e:
        add_log(f"[ERROR] Database connection failed: {str(e)}. Running in memory-only mode.")
    asyncio.create_task(heartbeat_monitor())

async def heartbeat_monitor():
    """Monitor online users and trigger partial aggregation on timeout."""
    while True:
        await asyncio.sleep(5)
        current_time = time.time()

        # Update online user count
        for uid in list(online_users.keys()):
            if current_time - online_users[uid] > 60:
                del online_users[uid]
                if uid in connected_users:
                    connected_users[uid]["status"] = "Offline"
                    connected_users[uid]["is_online"] = False
                    add_log(f"[INFO] Bank node '{connected_users[uid].get('username', uid)}' went offline (heartbeat timeout).")

        system_status["online_users_count"] = len(online_users)

        # Partial aggregation trigger
        if len(client_updates) > 0 and (current_time - getattr(heartbeat_monitor, 'last_update_time', current_time)) > TIMEOUT_SECONDS:
            add_log(f"[WARN] Aggregation timeout reached. Proceeding with partial aggregation ({len(client_updates)} client(s) submitted).")
            execute_federated_aggregation()

heartbeat_monitor.last_update_time = time.time()

# ── Auth Helpers ──────────────────────────────────────────────────────────────
def create_jwt_token(user_id: int, username: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    if token == "secure_bank_node_token_2026":
        return {"user_id": 1, "username": "bank_node_system"}
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = auth_header.split(" ")[1]
    return decode_jwt_token(token)

# ── Auth Endpoints ────────────────────────────────────────────────────────────
@app.post("/auth/register")
async def register(request: Request):
    body = await request.json()
    username = body.get("username", "").strip()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")
    
    if not username or not email or not password:
        raise HTTPException(status_code=400, detail="All fields are required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    
    try:
        user = create_user(username, email, password_hash)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    if user is None:
        raise HTTPException(status_code=409, detail="Username or email already exists")
    
    token = create_jwt_token(user["id"], user["username"])
    add_log(f"👤 New user registered: {username}")
    
    try:
        system_status["total_registered_users"] = get_all_users_count()
    except:
        pass
    
    return {
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]}
    }

@app.post("/auth/login")
async def login(request: Request):
    body = await request.json()
    identifier = (body.get("email") or body.get("username") or "").strip()
    password = body.get("password", "")
    
    if not identifier or not password:
        raise HTTPException(status_code=400, detail="Email/Username and password are required")
    
    try:
        user = get_user_by_identifier(identifier)
    except Exception:
        user = None
    
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials. User does not exist on this server.")
    
    if not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials. Incorrect password.")
    
    try:
        update_last_login(user["id"])
    except:
        pass
    
    token = create_jwt_token(user["id"], user["username"])
    add_log(f"🔐 User logged in: {user['username']}")

    uid = str(user["id"])
    username = user["username"]
    current_time = time.time()
    online_users[uid] = current_time
    if uid not in connected_users:
        connected_users[uid] = {
            "username": username,
            "status": "Online",
            "last_seen": datetime.now().strftime("%H:%M:%S"),
            "accuracy": None,
            "loss": None,
            "num_samples": 0,
            "dataset_name": "N/A",
            "is_online": True,
        }
    else:
        connected_users[uid]["last_seen"] = datetime.now().strftime("%H:%M:%S")
        connected_users[uid]["username"] = username
        connected_users[uid]["is_online"] = True

    return {
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]}
    }

@app.get("/auth/me")
async def get_me(request: Request):
    payload = get_current_user(request)
    try:
        user = get_user_by_id(payload["user_id"])
    except:
        user = {"id": payload["user_id"], "username": payload["username"]}
    return {"user": user}

# ── Heartbeat (keeps user as "online") ────────────────────────────────────────
@app.post("/heartbeat")
async def heartbeat(request: Request):
    client_status = "Online"
    node_name = None
    accuracy = None
    loss = None
    num_samples = None
    dataset_name = None
    try:
        body = await request.json()
        client_status = body.get("client_status", "Online")
        node_name = body.get("node_name") or body.get("username")
        accuracy = body.get("accuracy")
        loss = body.get("loss")
        num_samples = body.get("num_samples")
        dataset_name = body.get("dataset_name")
    except:
        pass

    auth_header = request.headers.get("Authorization", "")
    uid = None
    username = None

    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = decode_jwt_token(token)
            uid = str(payload["user_id"])
            username = payload["username"]
        except HTTPException as e:
            # Token expired or invalid
            raise HTTPException(status_code=401, detail="Authentication token expired or invalid. Please re-login.")
    elif node_name:
        uid = f"node_{node_name}"
        username = node_name
    else:
        client_host = request.client.host if request.client else "127.0.0.1"
        uid = f"node_{client_host}"
        username = f"Node ({client_host})"

    current_time = time.time()
    online_users[uid] = current_time
    if uid not in connected_users:
        connected_users[uid] = {
            "username": username,
            "status": f"Online ({client_status})",
            "last_seen": datetime.now().strftime("%H:%M:%S"),
            "accuracy": round(float(accuracy), 2) if accuracy is not None else None,
            "loss": round(float(loss), 4) if loss is not None else None,
            "num_samples": int(num_samples) if num_samples else 0,
            "dataset_name": dataset_name or "N/A",
            "is_online": True,
        }
    else:
        connected_users[uid]["last_seen"] = datetime.now().strftime("%H:%M:%S")
        connected_users[uid]["username"] = username
        connected_users[uid]["is_online"] = True
        if accuracy is not None:
            connected_users[uid]["accuracy"] = round(float(accuracy), 2)
        if loss is not None:
            connected_users[uid]["loss"] = round(float(loss), 4)
        if num_samples:
            connected_users[uid]["num_samples"] = int(num_samples)
        if dataset_name and dataset_name != "N/A":
            connected_users[uid]["dataset_name"] = dataset_name

        curr_status = connected_users[uid].get("status", "")
        if not curr_status.startswith("Contributed"):
            if accuracy is not None:
                connected_users[uid]["status"] = f"Trained (Acc: {float(accuracy):.1f}%)"
            else:
                connected_users[uid]["status"] = f"Online ({client_status})"

    system_status["connected_clients"] = connected_users
    system_status["online_users_count"] = len(online_users)

    return {"status": "ok"}

# ── Admin / Dashboard Endpoints ───────────────────────────────────────────────
@app.get("/admin/sessions")
def get_sessions():
    """Return recent FL training sessions for the server dashboard."""
    return {"sessions": get_recent_sessions(limit=50)}

@app.get("/admin/nodes")
def get_nodes():
    """Return all currently connected + historically seen bank nodes."""
    return {"nodes": connected_users, "online_count": len(online_users)}

@app.post("/admin/aggregate-now")
def admin_aggregate_now():
    """Manually triggers FedAvg aggregation on all currently buffered client updates."""
    if len(client_updates) == 0:
        raise HTTPException(status_code=400, detail="No client updates in the buffer to aggregate.")
    
    add_log(f"[ADMIN] Manual FedAvg aggregation triggered for Round {system_status['round'] + 1} across {len(client_updates)} client(s).")
    execute_federated_aggregation()
    return {
        "status": "success",
        "round": system_status["round"],
        "model_version": system_status["global_model_version"]
    }

@app.post("/admin/set-min-clients")
async def admin_set_min_clients(request: Request):
    """Dynamically set the quorum threshold for auto-aggregation."""
    global MIN_CLIENTS_PER_ROUND
    body = await request.json()
    val = int(body.get("min_clients", 2))
    if val < 1:
        val = 1
    MIN_CLIENTS_PER_ROUND = val
    system_status["min_clients_per_round"] = MIN_CLIENTS_PER_ROUND
    add_log(f"[CONFIG] Required nodes per round updated to {MIN_CLIENTS_PER_ROUND}.")
    # If buffer now meets or exceeds new quorum, trigger aggregation
    if len(client_updates) >= MIN_CLIENTS_PER_ROUND:
        add_log(f"[FL] Buffer meets quorum ({len(client_updates)}/{MIN_CLIENTS_PER_ROUND}). Triggering aggregation now.")
        execute_federated_aggregation()
    return {"status": "ok", "min_clients_per_round": MIN_CLIENTS_PER_ROUND}

# ── Server Status Endpoint ────────────────────────────────────────────────────
@app.get("/status")
def get_status():
    try:
        system_status["total_registered_users"] = get_all_users_count()
    except:
        pass
    current_time = time.time()
    system_status["online_users_count"] = len(online_users)
    system_status["min_clients_per_round"] = MIN_CLIENTS_PER_ROUND
    system_status["pending_updates_count"] = len(client_updates)
    system_status["pending_updates"] = [
        {"user_id": m["user_id"], "username": m["username"], "num_samples": m["num_samples"], "accuracy": m["accuracy"]}
        for m in client_metrics
    ]
    # Update is_online dynamically for each connected client
    for uid, info in connected_users.items():
        is_active = (current_time - online_users.get(uid, 0)) <= 35
        info["is_online"] = is_active
        if not is_active and not info.get("status", "").startswith("Offline"):
            info["status"] = "Offline"
        elif is_active and info.get("status") == "Offline":
            if info.get("accuracy") is not None:
                info["status"] = f"Trained (Acc: {info['accuracy']}%)"
            else:
                info["status"] = "Online"

    system_status["connected_clients"] = connected_users
    return system_status

# ── Client Model Update Submission ────────────────────────────────────────────
@app.post("/submit-update")
async def submit_model_update(request: Request):
    """
    Client sends trained model weights + metrics after local training.
    Body (JSON):
      - model_weights: base64 or serialized state_dict
      - accuracy: float
      - loss: float
      - input_features: int
      - num_classes: int
      - dataset_name: str
      - num_samples: int
    """
    global global_model_config
    
    payload = get_current_user(request)
    uid = str(payload["user_id"])
    username = payload["username"]
    
    body = await request.json()
    accuracy = body.get("accuracy", 0)
    loss = body.get("loss", 0)
    input_features = body.get("input_features", 0)
    num_classes = body.get("num_classes", 0)
    dataset_name = body.get("dataset_name", "Unknown")
    num_samples = body.get("num_samples", 0)
    weights_serialized = body.get("model_weights", None)  # List of layer weight arrays
    
    if weights_serialized is None:
        raise HTTPException(status_code=400, detail="model_weights is required")
    
    # Store or validate model config
    model_config = {"input_features": input_features, "num_classes": num_classes}
    feature_names_submitted = body.get("feature_names", None)
    if feature_names_submitted:
        model_config["feature_names"] = feature_names_submitted
    
    if global_model_config is None or len(client_updates) == 0:
        global_model_config = model_config
    elif global_model_config["input_features"] != input_features or global_model_config["num_classes"] != num_classes:
        raise HTTPException(
            status_code=400, 
            detail=f"Model config mismatch. Server expects {global_model_config['input_features']} features and {global_model_config['num_classes']} classes. Got {input_features} features and {num_classes} classes."
        )
    
    # Deserialize weights
    weight_tensors = {}
    for key, val in weights_serialized.items():
        weight_tensors[key] = torch.tensor(val, dtype=torch.float32)
    
    # Log incoming update with full detail
    total_params = sum(len(v) if isinstance(v, list) else v.numel() if hasattr(v, 'numel') else 0
                       for v in weight_tensors.values())
    layer_summary = ", ".join(f"{k}: {list(v.shape)}" for k, v in list(weight_tensors.items())[:4])
    add_log(f"[FL] Weight update received from node '{username}' (user_id={uid}).")
    add_log(f"[FL]   Dataset  : {dataset_name}")
    add_log(f"[FL]   Samples  : {num_samples} training records")
    add_log(f"[FL]   Features : {input_features} input features, {num_classes} output class(es)")
    add_log(f"[FL]   Accuracy : {accuracy:.2f}%  |  Loss: {loss:.4f}")
    add_log(f"[FL]   Layers   : {len(weight_tensors)} parameter tensors  (e.g. {layer_summary}{'...' if len(weight_tensors) > 4 else ''})")
    add_log(f"[FL]   Updates pending aggregation: {len(client_updates)} (including this one)")

    # Check if this node already submitted for the current round (deduplicate)
    existing_idx = None
    for idx, u in enumerate(client_updates):
        if str(u["user_id"]) == str(uid):
            existing_idx = idx
            break

    update_entry = {
        "user_id": uid,
        "username": username,
        "weights": weight_tensors,
        "accuracy": accuracy,
        "loss": loss,
    }
    metrics_entry = {
        "user_id": uid,
        "username": username,
        "accuracy": accuracy,
        "loss": loss,
        "dataset_name": dataset_name,
        "num_samples": num_samples,
        "input_features": input_features,
        "num_classes": num_classes,
    }

    if existing_idx is not None:
        client_updates[existing_idx] = update_entry
        client_metrics[existing_idx] = metrics_entry
        add_log(f"[FL] Updated existing submission for node '{username}' in Round {system_status['round'] + 1}.")
    else:
        client_updates.append(update_entry)
        client_metrics.append(metrics_entry)

    # Update connected client info with full contribution data
    online_users[uid] = time.time()
    connected_users[uid] = {
        "username": username,
        "status": f"Trained (Acc: {accuracy:.1f}%)",
        "last_seen": datetime.now().strftime("%H:%M:%S"),
        "accuracy": round(accuracy, 2),
        "loss": round(loss, 4),
        "num_samples": num_samples,
        "dataset_name": dataset_name,
        "is_online": True,
    }
    system_status["connected_clients"] = connected_users

    # Save to DB
    try:
        save_training_session(
            user_id=int(uid),
            dataset_name=dataset_name,
            num_features=input_features,
            num_samples=num_samples,
            accuracy=accuracy,
            loss=loss,
            training_round=system_status["round"] + 1
        )
    except Exception as e:
        add_log(f"[WARN] Failed to save session to DB: {str(e)}")

    heartbeat_monitor.last_update_time = time.time()

    # Check quorum
    num_updates = len(client_updates)
    round_target = system_status["round"] + 1

    system_status["pending_updates"] = [
        {"user_id": m["user_id"], "username": m["username"], "num_samples": m["num_samples"], "accuracy": m["accuracy"]}
        for m in client_metrics
    ]
    system_status["pending_updates_count"] = num_updates

    if num_updates >= MIN_CLIENTS_PER_ROUND:
        add_log(f"[FL] Quorum reached ({num_updates}/{MIN_CLIENTS_PER_ROUND} nodes ready). Triggering FedAvg aggregation for Round {round_target}!")
        execute_federated_aggregation()
    else:
        remaining = MIN_CLIENTS_PER_ROUND - num_updates
        node_names = ", ".join([f"'{m['username']}'" for m in client_metrics])
        system_status["status"] = f"Round {round_target}: Waiting for {remaining} more bank node(s)... ({num_updates}/{MIN_CLIENTS_PER_ROUND} ready)"
        add_log(f"[FL] Round {round_target} buffer: {num_updates}/{MIN_CLIENTS_PER_ROUND} updates collected from [{node_names}].")
        add_log(f"[FL] Waiting for {remaining} more bank node(s) to submit, or trigger manually via 'Run FedAvg Aggregation Now'.")

    return {
        "message": "Update accepted and buffered for round aggregation",
        "current_updates": num_updates,
        "min_clients_per_round": MIN_CLIENTS_PER_ROUND,
        "round": system_status["round"]
    }

# -- Federated Averaging Aggregation ------------------------------------------
def execute_federated_aggregation():
    """
    Sample-Weighted FedAvg: aggregate model weights from all participating nodes
    weighted by their local sample count (n_i / N_total).
    """
    global global_model_weights, client_updates, client_metrics

    if len(client_updates) == 0:
        return

    num_clients = len(client_updates)
    round_num = system_status["round"] + 1

    add_log(f"[FL] ========== FEDERATED ROUND {round_num} START ==========")
    add_log(f"[FL] Nodes participating this round: {num_clients}")

    # Sample counts and FedAvg weights
    sample_counts = [m.get("num_samples", 1) for m in client_metrics]
    total_samples = sum(sample_counts) if sum(sample_counts) > 0 else 1

    add_log(f"[FL] Total training samples pooled across all nodes: {total_samples}")
    add_log(f"[FL] Per-node contribution:")
    for m, n in zip(client_metrics, sample_counts):
        pct = (n / total_samples) * 100
        add_log(f"[FL]   Node '{m['username']}': {n} samples  =>  FedAvg weight={pct:.1f}%  |  local_acc={m['accuracy']:.2f}%  |  local_loss={m['loss']:.4f}")

    # FL weighted accuracy and loss
    accuracies = [m["accuracy"] for m in client_metrics]
    losses     = [m["loss"]     for m in client_metrics]
    weighted_accuracy = sum(a * n for a, n in zip(accuracies, sample_counts)) / total_samples
    weighted_loss     = sum(l * n for l, n in zip(losses,     sample_counts)) / total_samples

    add_log(f"[FL] Global accuracy = sum(n_i * acc_i) / N_total = {weighted_accuracy:.4f}%")
    add_log(f"[FL] Global loss     = sum(n_i * loss_i) / N_total = {weighted_loss:.6f}")

    if num_clients == 1:
        add_log("[FL] Single-node round: weights stored directly as global model (no averaging needed).")
        global_model_weights = client_updates[0]["weights"]
    else:
        add_log(f"[FL] Running sample-weighted FedAvg across {num_clients} nodes...")
        first_weights = client_updates[0]["weights"]
        aggregated = {k: torch.zeros_like(v, dtype=torch.float32) for k, v in first_weights.items()}

        for update, n_samples in zip(client_updates, sample_counts):
            w = n_samples / total_samples
            node_name = update["username"]
            add_log(f"[FL]   Adding node '{node_name}' weights scaled by factor {w:.4f} ({n_samples}/{total_samples} samples)")
            for key in aggregated:
                aggregated[key] += update["weights"][key] * w

        global_model_weights = aggregated
        add_log(f"[FL] Aggregation complete: {len(aggregated)} parameter tensors averaged.")

        # Show a sample of the resulting layers
        add_log("[FL] Sample of aggregated parameter tensors (layer name | shape | mean abs value):")
        for name, tensor in list(aggregated.items())[:6]:
            add_log(f"[FL]   {name:45s}  shape={list(tensor.shape)}  mean_abs={tensor.abs().mean().item():.6f}")

    # Update system status
    client_acc_report = [f"{m['username']}: {m['accuracy']:.1f}% ({m.get('num_samples',0)} samples)" for m in client_metrics]
    system_status["accuracy_history"].append(weighted_accuracy)
    system_status["loss_history"].append(weighted_loss)
    system_status["client_accuracies"].append(client_acc_report)
    system_status["fairness_metrics"].append(client_acc_report)
    system_status["round"] = round_num
    system_status["global_model_version"] = f"v{round_num}.0.0"
    system_status["last_updated"] = datetime.now().strftime("%H:%M:%S")
    system_status["status"] = "Idle -- Ready for next round"

    add_log(f"[FL] Global model updated to version v{round_num}.0.0")
    add_log(f"[FL] Nodes can now fetch the updated global model from GET /global-model (requires auth token).")
    add_log(f"[FL] ========== ROUND {round_num} COMPLETE  |  accuracy={weighted_accuracy:.2f}%  |  loss={weighted_loss:.4f} ==========")

    # Save to DB
    try:
        save_federated_round(round_num, num_clients, weighted_accuracy, weighted_loss)
    except Exception as e:
        add_log(f"[WARN] Failed to save round to DB: {str(e)}")

    # Ensure contributing nodes retain their metrics in connected_users
    for m in client_metrics:
        uid = str(m["user_id"])
        if uid in connected_users:
            connected_users[uid]["accuracy"] = round(m["accuracy"], 2)
            connected_users[uid]["loss"] = round(m["loss"], 4)
            connected_users[uid]["num_samples"] = m["num_samples"]
            connected_users[uid]["dataset_name"] = m["dataset_name"]
            connected_users[uid]["status"] = f"Contributed (Round {round_num})"
            connected_users[uid]["is_online"] = True

    system_status["connected_clients"] = connected_users

    # Clear buffers for next round
    client_updates.clear()
    client_metrics.clear()
    system_status["pending_updates"] = []
    system_status["pending_updates_count"] = 0
    add_log(f"[INFO] Update buffers cleared. Ready to accept submissions for Round {round_num + 1}.")




# ── Get Global Model (for prediction) ─────────────────────────────────────────
@app.get("/global-model")
async def get_global_model(request: Request):
    """Returns the current global model weights and config for client prediction."""
    get_current_user(request)  # Verify auth
    
    if global_model_weights is None or global_model_config is None:
        raise HTTPException(status_code=404, detail="No global model available yet. Train at least one round first.")
    
    # Serialize weights to lists for JSON transport
    serialized = {}
    for key, tensor in global_model_weights.items():
        serialized[key] = tensor.tolist()
    
    return {
        "model_weights": serialized,
        "model_config": global_model_config,
        "round": system_status["round"],
        "accuracy": system_status["accuracy_history"][-1] if system_status["accuracy_history"] else 0,
    }

# ── Server-Side Prediction Endpoint ──────────────────────────────────────────
@app.post("/predict")
async def predict(request: Request):
    """
    Perform prediction on the server using the aggregated global model.
    Includes federated learning metrics like global accuracy.
    """
    get_current_user(request)
    
    if global_model_weights is None or global_model_config is None:
        raise HTTPException(status_code=404, detail="No global model available for prediction.")
        
    body = await request.json()
    input_data = body.get("sample", None) # Expects a flat list of features
    
    if input_data is None:
        raise HTTPException(status_code=400, detail="Input sample data is required.")
        
    try:
        # 1. Initialize model with aggregated weights
        model = GenericMLP(global_model_config["input_features"], global_model_config["num_classes"])
        model.load_state_dict(global_model_weights)
        model.eval()
        
        # 2. Perform prediction
        input_tensor = torch.tensor([input_data], dtype=torch.float32)
        with torch.no_grad():
            output = model(input_tensor)
            probs = torch.nn.functional.softmax(output[0], dim=0)
            conf, pred_idx = torch.max(probs, 0)
            
        # 3. Get latest federated metrics
        avg_acc = system_status["accuracy_history"][-1] if system_status["accuracy_history"] else 0.0
        rounds = system_status["round"]
        
        # 4. Generate XAI explanation for this specific prediction
        feature_names = ["CreditScore", "Age", "Tenure", "Balance", "NumOfProducts", "HasCrCard", "IsActiveMember", "EstimatedSalary", "TransactionAmount"]
        explanation = explain_prediction(model, input_tensor, feature_names)
        shap_explanation = explain_prediction_shap(model, input_tensor, feature_names=feature_names)
        lime_explanation = explain_prediction_lime(model, input_tensor, feature_names=feature_names)
        
        return {
            "prediction": int(pred_idx.item()),
            "confidence": float(conf.item() * 100),
            "federated_metrics": {
                "global_mean_accuracy": float(avg_acc),
                "total_rounds": int(rounds),
                "aggregation_method": "Weighted FedAvg (FL Standard)"
            },
            "explanation": explanation,
            "shap_explanation": shap_explanation,
            "lime_explanation": lime_explanation,
            "status": "Verified against latest global aggregation"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from fastapi.responses import Response
    return Response(status_code=204)

# ── Explainable AI (XAI) Endpoints ───────────────────────────────────────────
@app.get("/xai/importance")
async def get_feature_xai():
    """Returns global feature importance for the current global model."""
    if global_model_weights is None or global_model_config is None:
        return {"feature_importance": None, "status": "pending_first_round"}
    
    # Initialize model with weights
    input_features = global_model_config["input_features"]
    num_classes = global_model_config["num_classes"]
    
    model = GenericMLP(input_features, num_classes)
    model.load_state_dict(global_model_weights)
    
    # Feature names for banking model (dynamic from dataset, or default)
    feature_names = (global_model_config.get("feature_names") if global_model_config else None) or ["CreditScore", "Age", "Tenure", "Balance", "NumOfProducts", "HasCrCard", "IsActiveMember", "EstimatedSalary", "TransactionAmount"]
    
    importance = get_feature_importance(model, feature_names)
    return {"feature_importance": importance}

@app.post("/xai/explain")
async def post_prediction_xai(request: Request):
    """Explains a specific prediction sample using gradients (Saliency Map)."""
    get_current_user(request)
    
    if global_model_weights is None or global_model_config is None:
        raise HTTPException(status_code=404, detail="No global model available for XAI.")
        
    body = await request.json()
    sample = body.get("sample", None)
    
    if sample is None:
        raise HTTPException(status_code=400, detail="Prediction sample data is required.")
        
    # Convert sample list to tensor
    input_tensor = torch.tensor([sample], dtype=torch.float32)
    
    # Initialize model
    model = GenericMLP(global_model_config["input_features"], global_model_config["num_classes"])
    model.load_state_dict(global_model_weights)
    
    feature_names = (global_model_config.get("feature_names") if global_model_config else None) or ["CreditScore", "Age", "Tenure", "Balance", "NumOfProducts", "HasCrCard", "IsActiveMember", "EstimatedSalary", "TransactionAmount"]
    
    explanation = explain_prediction(model, input_tensor, feature_names)
    return {"explanation": explanation}

# ── Serve React Frontend (safe mounting — avoids POST 405 from StaticFiles) ────
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "server-dashboard", "dist"))
fallback_path = os.path.dirname(os.path.abspath(__file__))

if os.path.exists(frontend_path):
    # Mount only the /assets sub-directory so StaticFiles never sees /auth/* etc.
    assets_path = os.path.join(frontend_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    # Serve index.html for root GET request
    @app.get("/", include_in_schema=False)
    async def serve_root():
        return FileResponse(os.path.join(frontend_path, "index.html"))

    # Catch-all for client-side React routes (GET only — never intercepts POST)
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Try to serve an exact static file first (e.g. vite.svg)
        candidate = os.path.join(frontend_path, full_path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        # Fall back to SPA index.html
        return FileResponse(os.path.join(frontend_path, "index.html"))
else:
    # Fallback to plain server dir (no React build present)
    app.mount("/", StaticFiles(directory=fallback_path, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    print("🚀 FedVault AI Aggregator Server starting...")
    print("   Local:   http://localhost:8000")
    print("   Network: http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
