"""Train thermal prediction model."""
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
import joblib
import os

np.random.seed(42)
N = 4000

current = np.random.uniform(10, 300, N)
r_int = np.random.uniform(0.003, 0.025, N)
ambient = np.random.uniform(-20, 50, N)
soc = np.random.uniform(10, 100, N)
cooling = np.random.uniform(0, 2000, N)

# Physics: Q = I^2 * R, cooling ~ (T_cell - T_amb) / R_th
R_th = np.random.uniform(0.08, 0.20, N)
C_th = np.random.uniform(3000, 7000, N)
Q_gen = current**2 * r_int
T_steady = ambient + Q_gen * R_th - cooling * R_th / 3600
noise = np.random.normal(0, 2, N)
T_steady = (T_steady + noise).clip(-15, 120)

X = np.column_stack([current, r_int, ambient, soc, cooling, R_th, C_th])
y = T_steady

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
model = RandomForestRegressor(n_estimators=200, max_depth=8, random_state=42)
model.fit(X_train, y_train)
mae = mean_absolute_error(y_test, model.predict(X_test))
print(f"Thermal model MAE: {mae:.2f}C")

os.makedirs("models", exist_ok=True)
joblib.dump(model, "models/thermal_model.pkl")
print("Thermal model saved")
