"""
LSTM Time-Series Battery Degradation Forecaster
Trains a sequence-to-one LSTM that predicts SoH from the last 30 telemetry readings.
Uses PyTorch. Falls back to numpy-only if PyTorch unavailable.
Saves: ml/models/lstm_model.pkl (weights + scaler)
"""
import numpy as np
import os
import json
import joblib
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split

SEED = 42
np.random.seed(SEED)

SEQ_LEN = 30          # 30 time-steps of input
N_SEQUENCES = 3000    # training samples
FEATURES = ["soc", "temp", "current", "voltage", "c_rate", "ambient_temp"]
N_FEAT = len(FEATURES)

print("Generating LSTM training sequences...")

def physics_soh(cycles, dod, c_rate, temp, age_days, fc_pct):
    import math
    Ea, A, B = 0.60, 0.003, 0.0015
    T = temp + 273.15
    T_ref = 298.15
    R = 8.314
    arr = math.exp(Ea * (1/T_ref - 1/T) * 1000 / R)
    cal = A * arr * math.sqrt(max(1, age_days) / 365)
    cyc = B * ((dod/100)**1.2) * (1 + 0.05 * max(0, c_rate - 1)) * cycles / 1000
    fc_pen = fc_pct * 0.0003
    return max(60.0, min(100.0, (1 - cal - cyc - fc_pen) * 100))

# Build sequences
X_seqs = []
y_targets = []

for _ in range(N_SEQUENCES):
    age_days = np.random.randint(50, 2500)
    cycles = int(age_days * np.random.uniform(0.3, 0.8))
    dod = np.random.uniform(30, 90)
    c_rate = np.random.uniform(0.2, 2.5)
    fc_pct = np.random.uniform(0, 50)
    base_temp = np.random.uniform(15, 45)
    soh_true = physics_soh(cycles, dod, c_rate, base_temp, age_days, fc_pct)

    seq = []
    for t in range(SEQ_LEN):
        soc = np.random.uniform(20, 90)
        temp = base_temp + np.random.normal(0, 3)
        current = np.random.uniform(-100, 150)
        voltage = 350 + soc * 0.5 + np.random.normal(0, 2)
        amb = base_temp - np.random.uniform(3, 12)
        seq.append([soc, temp, current, voltage, c_rate, amb])

    X_seqs.append(seq)
    y_targets.append(soh_true + np.random.normal(0, 1.5))

X = np.array(X_seqs, dtype=np.float32)   # (N, SEQ_LEN, N_FEAT)
y = np.array(y_targets, dtype=np.float32)

# Scale features
scaler_X = MinMaxScaler()
X_flat = X.reshape(-1, N_FEAT)
scaler_X.fit(X_flat)
X_scaled = scaler_X.transform(X_flat).reshape(X.shape)

scaler_y = MinMaxScaler()
y_scaled = scaler_y.fit_transform(y.reshape(-1, 1)).ravel()

X_train, X_test, y_train, y_test = train_test_split(X_scaled, y_scaled, test_size=0.2, random_state=SEED)

print(f"Train: {X_train.shape}, Test: {X_test.shape}")

# Try PyTorch LSTM
try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset

    class BatteryLSTM(nn.Module):
        def __init__(self, input_size, hidden_size=64, num_layers=2, dropout=0.2):
            super().__init__()
            self.lstm = nn.LSTM(input_size, hidden_size, num_layers,
                                batch_first=True, dropout=dropout)
            self.attention = nn.Linear(hidden_size, 1)
            self.fc = nn.Sequential(
                nn.Linear(hidden_size, 32),
                nn.ReLU(),
                nn.Dropout(0.1),
                nn.Linear(32, 1),
            )

        def forward(self, x):
            out, _ = self.lstm(x)          # (B, T, H)
            attn = torch.softmax(self.attention(out), dim=1)  # (B, T, 1)
            context = (attn * out).sum(dim=1)                 # (B, H)
            return self.fc(context).squeeze(-1)

    torch.manual_seed(SEED)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    X_tr = torch.tensor(X_train).to(device)
    y_tr = torch.tensor(y_train).to(device)
    X_te = torch.tensor(X_test).to(device)
    y_te = torch.tensor(y_test).to(device)

    ds = TensorDataset(X_tr, y_tr)
    dl = DataLoader(ds, batch_size=64, shuffle=True)

    model = BatteryLSTM(N_FEAT).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=3e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(opt, patience=3, factor=0.5)
    loss_fn = nn.MSELoss()

    best_val_loss = float("inf")
    for epoch in range(30):
        model.train()
        train_loss = 0
        for xb, yb in dl:
            opt.zero_grad()
            pred = model(xb)
            loss = loss_fn(pred, yb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            train_loss += loss.item()

        model.eval()
        with torch.no_grad():
            val_pred = model(X_te)
            val_loss = loss_fn(val_pred, y_te).item()

        scheduler.step(val_loss)
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

        if (epoch + 1) % 10 == 0:
            # MAE in SoH %
            val_pred_np = scaler_y.inverse_transform(val_pred.cpu().numpy().reshape(-1,1)).ravel()
            y_te_np = scaler_y.inverse_transform(y_te.cpu().numpy().reshape(-1,1)).ravel()
            mae = np.mean(np.abs(val_pred_np - y_te_np))
            print(f"  Epoch {epoch+1:3d} | val_loss={val_loss:.5f} | MAE={mae:.3f}% SoH")

    model.load_state_dict(best_state)

    os.makedirs("models", exist_ok=True)
    torch.save({
        "model_state": model.state_dict(),
        "architecture": {"input_size": N_FEAT, "hidden_size": 64, "num_layers": 2},
        "seq_len": SEQ_LEN,
        "features": FEATURES,
    }, "models/lstm_model.pt")

    joblib.dump({"scaler_X": scaler_X, "scaler_y": scaler_y}, "models/lstm_scalers.pkl")
    print("LSTM model (PyTorch) saved to models/lstm_model.pt")

except ImportError:
    print("PyTorch not available — saving GRU-equivalent numpy model (sklearn pipeline)")
    # Fallback: use GBM trained on flattened sequences
    from sklearn.ensemble import GradientBoostingRegressor
    X_flat_tr = X_train.reshape(len(X_train), -1)
    X_flat_te = X_test.reshape(len(X_test), -1)
    gbm = GradientBoostingRegressor(n_estimators=100, max_depth=4, random_state=SEED)
    gbm.fit(X_flat_tr, y_train)
    y_pred = gbm.predict(X_flat_te)
    pred_soh = scaler_y.inverse_transform(y_pred.reshape(-1,1)).ravel()
    true_soh = scaler_y.inverse_transform(y_test.reshape(-1,1)).ravel()
    mae = np.mean(np.abs(pred_soh - true_soh))
    print(f"  GBM-sequence MAE: {mae:.3f}% SoH")

    os.makedirs("models", exist_ok=True)
    joblib.dump({
        "model": gbm,
        "scaler_X": scaler_X,
        "scaler_y": scaler_y,
        "seq_len": SEQ_LEN,
        "features": FEATURES,
        "type": "gbm_sequence",
    }, "models/lstm_model.pkl")
    print("GBM-sequence model saved to models/lstm_model.pkl")

print("LSTM training complete.")
