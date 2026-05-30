"""Train Isolation Forest anomaly detection model."""
import numpy as np
from sklearn.ensemble import IsolationForest
import joblib
import os

np.random.seed(42)

# Normal operating conditions
normal = np.column_stack([
    np.random.uniform(20, 90, 3000),   # soc
    np.random.uniform(85, 100, 3000),  # soh
    np.random.uniform(15, 40, 3000),   # temp_avg
    np.random.uniform(0, 5, 3000),     # temp_gradient
    np.random.uniform(10, 120, 3000),  # current
    np.random.uniform(340, 420, 3000), # voltage
    np.random.uniform(0, 150, 3000),   # charging_kw
    np.random.uniform(0, 0.15, 3000),  # degradation_index
])

# Anomalous conditions (thermal, deep discharge, etc.)
anomalies = np.column_stack([
    np.random.uniform(5, 15, 150),     # very low soc
    np.random.uniform(60, 75, 150),    # low soh
    np.random.uniform(55, 90, 150),    # high temp
    np.random.uniform(12, 30, 150),    # high gradient
    np.random.uniform(200, 400, 150),  # very high current
    np.random.uniform(290, 320, 150),  # low voltage
    np.random.uniform(150, 300, 150),  # very high charging
    np.random.uniform(0.2, 0.4, 150),  # high degradation
])

X = np.vstack([normal, anomalies])
model = IsolationForest(n_estimators=200, contamination=0.045, random_state=42)
model.fit(X)

preds = model.predict(X)
detected = sum(1 for i, p in enumerate(preds) if i >= 3000 and p == -1)
print(f"Anomaly detection rate on injected anomalies: {detected}/150 = {detected/150*100:.1f}%")

os.makedirs("models", exist_ok=True)
joblib.dump(model, "models/anomaly_model.pkl")
print("Anomaly model saved")
