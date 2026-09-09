import sys
import os
import subprocess
import time
import requests

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    server_dir = os.path.join(root_dir, "server")
    client_script = os.path.join(root_dir, "scripts", "client.py")

    print("Starting Banking Systems FL Aggregator (FastAPI)...")
    server_process = subprocess.Popen([sys.executable, "-m", "uvicorn", "server:app", "--port", "8000"], cwd=server_dir)
    
    # Wait for the server to initialize
    time.sleep(5)
    
    rounds = 3
    for r in range(rounds):
        print(f"\n================ BANKING FL ROUND {r+1} ================")
        
        # Simulating 2 bank branches:
        # Bank Node 0: Main Commercial Bank Branch (High Volume, width_scale=1.0)
        # Bank Node 1: Regional Bank Branch (Medium Volume, width_scale=0.5)
        
        print("Starting local training for Bank Node 0 (Main Branch)...")
        c0 = subprocess.Popen([sys.executable, client_script, "--id", "0", "--scale", "1.0"])
        
        print("Starting local training for Bank Node 1 (Regional Branch)...")
        c1 = subprocess.Popen([sys.executable, client_script, "--id", "1", "--scale", "0.5"])
        
        # Wait for clients to finish local training and encrypted transmission
        c0.wait()
        c1.wait()
        
        print("\nTriggering Secure & Fairness-Aware Aggregation on Server...")
        resp = requests.get("http://localhost:8000/aggregate")
        print(f"Aggregation Result: {resp.json()}")
        
        time.sleep(2)
        
    print("\n✅ FL Training Complete.")
    server_process.terminate()

if __name__ == "__main__":
    main()
