# FedVault AI: Privacy-Preserving Federated Learning for Banking Systems

**FedVault AI** is a high-performance, decentralized financial AI platform designed to enable collaborative machine learning between banking institutions and financial nodes (e.g., for Fraud Detection and Credit Risk Assessment) without sharing raw banking customer records. By combining **Sample-Weighted Federated Averaging (FedAvg)** with **Explainable AI (XAI)** and **Homomorphic Encryption**, it enables the creation of robust global financial models while maintaining strict regulatory compliance and data privacy.

---

## 🌟 Key Features

- **🔐 Privacy-First Financial Architecture**: Banking customer records and transaction histories never leave the bank branch's local environment. Only encrypted model weight updates are transmitted to the aggregator.
- **📊 Pure Federated Learning Accuracy**:
  - **Sample-Weighted FedAvg Aggregation**: Parameter updates \( W_i \) from bank nodes are weighted proportionally by their local transaction sample counts \( n_i / N_{total} \).
  - **Global Federated Accuracy**: System-wide accuracy is evaluated strictly according to FL principles: \( \text{FL\_Accuracy} = \frac{\sum n_i \cdot \text{Accuracy}_i}{\sum n_i} \).
- **🧠 Explainable AI (XAI)**: 
  - **Local Saliency & Attribution Maps**: Visualize feature-level attribution (CreditScore, Balance, TransactionAmount, Salary, Tenure) for risk predictions.
  - **Global Feature Importance**: Real-time insights into which financial markers the aggregated global FL model values most.
- **⚡ Modern Dashboards**: 
  - **Aggregator Admin**: Monitor banking network convergence, active bank nodes, weighted FL accuracy, and model consistency.
  - **Bank Client Node**: Multi-step workflow for financial dataset ingestion, local model training, global model validation, and risk assessment.

---

## 🏗️ Tech Stack

- **Backend**: Python 3.10+, FastAPI (Asynchronous API), PyTorch (Deep Learning).
- **Frontend**: React 18, Tailwind CSS, Lucide-React (Iconography), Chart.js (Convergence Plots).
- **Aggregation**: Sample-Weighted FedAvg for federated model consolidation.
- **Security**: JWT-based Authentication, Bcrypt password hashing, CKKS Homomorphic Encryption (TenSEAL).

---

## 🚀 Getting Started

### 1. Prerequisites

Ensure you have **Python 3.10+** and **Node.js 18+** installed.

```powershell
# Install dependencies
pip install torch fast-api uvicorn pandas scikit-learn requests bcrypt pyjwt tenseal shap lime
```

### 2. Launch the Banking Network

You can run the full network using the unified launcher:

```powershell
python scripts/run_all.py
```

Or run individual components:

#### Start the Financial Aggregator Server
```powershell
cd server
uvicorn server:app --port 8000 --host 0.0.0.0
```
- **Admin Aggregator Dashboard**: [http://localhost:8000](http://localhost:8000)

#### Start a Bank Node (Client)
```powershell
cd client
uvicorn client_app:app --port 8001
```
- **Bank Node Dashboard**: [http://localhost:8001](http://localhost:8001)

---

## 📂 Project Structure

- `server/`: Central financial aggregator logic and static admin dashboard.
- `client/`: Bank-node client application, dataset loader, and local training module.
- `core/`: Neural network architectures (`GenericMLP`, `BankingFraudNN`) and dataset utilities.
- `data/`: Sample banking transaction dataset (`sample_banking.csv`).
- `server-dashboard/`: React source code for the aggregator admin UI.
- `client-dashboard/`: React source code for the bank node provider UI.
- `scripts/`: Automation launcher (`run_all.py`), Bank Node simulation (`client.py`), and DLG attack simulation (`attack_simulation.py`).

---

**Developed by prathmesh-nitnaware | Banking Systems Federated Governance & Secure AI**
