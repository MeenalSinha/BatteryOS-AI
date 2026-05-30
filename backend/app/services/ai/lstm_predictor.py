"""
LSTM Time-Series Battery Predictor — inference service.
Loads the trained sequence model and predicts SoH from recent telemetry history.
"""
import logging
import numpy as np
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

SEQ_LEN = 30
FEATURES = ["soc", "temp", "current", "voltage", "c_rate", "ambient_temp"]


class LSTMPredictor:
    def __init__(self):
        self.model = None
        self.scaler_X = None
        self.scaler_y = None
        self.model_type = None  # "pytorch" | "gbm_sequence"
        self._loaded = False

    def load(self, path: str):
        try:
            import joblib
            bundle = joblib.load(path)
            self.scaler_X = bundle["scaler_X"]
            self.scaler_y = bundle["scaler_y"]
            self.model = bundle["model"]
            self.model_type = bundle.get("type", "gbm_sequence")
            self._loaded = True
            logger.info(f"LSTM/sequence model loaded ({self.model_type}) from {path}")
        except Exception as e:
            logger.warning(f"Could not load LSTM model: {e}")

    def predict_from_history(self, telemetry_history: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Predict SoH from the last SEQ_LEN telemetry frames.
        Returns None if model not loaded or insufficient history.
        """
        if not self._loaded or not telemetry_history:
            return None

        # Build feature matrix from history
        frames = telemetry_history[-SEQ_LEN:]
        # Pad with first frame if not enough data
        while len(frames) < SEQ_LEN:
            frames = [frames[0]] + frames

        seq = []
        for f in frames:
            row = [
                float(f.get("state_of_charge", 50)),
                float(f.get("temperature_avg", 25)),
                float(f.get("current", 50)),
                float(f.get("voltage", 380)),
                float(abs(f.get("current", 50)) / max(187.5, 1)),  # c_rate approx
                float(f.get("ambient_temp", 20)),
            ]
            seq.append(row)

        X = np.array(seq, dtype=np.float32)  # (SEQ_LEN, N_FEAT)

        try:
            # Scale
            X_flat = X.reshape(-1, len(FEATURES))
            X_scaled = self.scaler_X.transform(X_flat).reshape(1, SEQ_LEN, len(FEATURES))

            if self.model_type == "gbm_sequence":
                X_input = X_scaled.reshape(1, -1)
                y_scaled = self.model.predict(X_input)
            else:
                # PyTorch path
                import torch
                with torch.no_grad():
                    tensor = torch.tensor(X_scaled, dtype=torch.float32)
                    y_scaled = self.model(tensor).numpy()

            y_pred = float(self.scaler_y.inverse_transform(
                np.array(y_scaled).reshape(-1, 1)
            )[0, 0])
            y_pred = max(50.0, min(100.0, y_pred))

            return {
                "soh_lstm": round(y_pred, 2),
                "model_type": self.model_type,
                "sequence_length": len(frames),
                "confidence": 0.83,
            }
        except Exception as e:
            logger.warning(f"LSTM inference error: {e}")
            return None


lstm_predictor = LSTMPredictor()
