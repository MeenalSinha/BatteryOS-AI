# BatteryOS AI — Battery Physics Model Documentation

## Electrochemical Models Implemented

### 1. Arrhenius Calendar Aging Model

Battery capacity fade from calendar aging follows:

```
Q_cal(t, T) = A * exp(-Ea / R * (1/T - 1/T_ref)) * SOC_stress * sqrt(t / t_ref)
```

Where:
- `Ea` = Activation energy (chemistry-dependent, 0.45–0.65 eV)
- `R` = Universal gas constant (8.314 J/mol·K)
- `T` = Cell temperature (Kelvin)
- `T_ref` = Reference temperature (298.15 K = 25°C)
- `SOC_stress` = State-of-charge stress factor: `1 + k * (SOC_avg - 50)`

### 2. Cycle Aging (Empirical Stress Model)

```
Q_cyc(N, DoD, C_rate) = B * (DoD/100)^1.2 * C_stress * N / 1000
```

Where:
- `N` = Cycle count
- `DoD` = Depth of Discharge (%)
- `C_stress` = C-rate stress: `1 + 0.05 * max(0, C_rate - 1)`

### 3. Total SoH Prediction

```
SoH(t) = 1 - Q_cal(t) - Q_cyc(N) - FC_penalty
```

Where `FC_penalty = fast_charge_frequency * 0.0003` per charging event.

### 4. Lumped Thermal Model

First-order thermal model (Newton's law of cooling + Joule heating):

```
C_th * dT/dt = Q_gen - Q_cool
Q_gen = I^2 * R_int + T_entropic * I
Q_cool = (T_cell - T_amb) / R_th - P_active_cooling
```

Where:
- `C_th` = Thermal capacitance (J/K), 3000–7000 for pack-level
- `R_th` = Thermal resistance (K/W), 0.08–0.20 for pack-level
- `Q_gen` = Heat generation (W)
- `Q_cool` = Total heat dissipation (W)

### 5. Thermal Runaway Risk Model

Risk score uses a sigmoid mapped to onset/critical temperature thresholds:

```
risk(T) = sigmoid(10 * (x - 0.5)) where x = (T - 0.6*T_onset) / (T_critical - 0.6*T_onset)
```

Chemistry-specific thresholds:
| Chemistry | Onset (°C) | Propagation (°C) | Critical (°C) |
|---|---|---|---|
| NMC | 130 | 170 | 200 |
| LFP | 195 | 240 | 270 |
| NCA | 120 | 155 | 185 |
| LTO | 210 | 260 | 300 |

### 6. Cell Voltage Model (Simplified Nernst)

```
V_cell(SOC) = V_OCV(SOC) - I * R_int
V_OCV ≈ V_nom + a * ln(SOC/(1-SOC))  [simplified Nernst equation]
```

## AI/ML Model Architecture

### Degradation Model
- **Algorithm**: Gradient Boosting Regressor (300 estimators, depth=5)
- **Features**: cycles, DoD_avg, C_rate_avg, temperature_avg, SOC_avg, age_days, fast_charge_pct
- **Target**: State-of-Health (%)
- **Training**: 5,000 synthetic samples via physics model + Gaussian noise
- **MAE**: ~1.2% SoH

### Thermal Model
- **Algorithm**: Random Forest Regressor (200 estimators)
- **Features**: current, R_int, T_ambient, SOC, cooling_power, R_th, C_th
- **Target**: Steady-state cell temperature (°C)
- **MAE**: ~1.8°C

### Anomaly Detector
- **Algorithm**: Isolation Forest (200 trees, contamination=0.045)
- **Features**: SOC, SoH, temperature, gradient, current, voltage, charging_kw, degradation_index
- **Augmentation**: Rule-based boosting for critical thresholds
- **Detection rate**: >90% on injected anomalies
