"""
CAN Bus Simulator — Generates synthetic OBD-II PID frames.
Real CAN implementation would use python-can + a hardware adapter.
"""
import struct
import time
import random
from dataclasses import dataclass
from typing import List, Tuple

# Standard OBD-II PIDs relevant to EV battery
PID_SOC = 0x5B          # Hybrid/EV battery pack remaining charge
PID_BATTERY_TEMP = 0x5C # Hybrid battery pack temperature
PID_VOLTAGE = 0x42      # Module voltage
PID_CURRENT = 0x78      # Transmission actual gear

@dataclass
class CANFrame:
    arbitration_id: int
    data: bytes
    timestamp: float

    def __str__(self):
        hex_data = " ".join(f"{b:02X}" for b in self.data)
        return f"[{self.timestamp:.3f}] ID={self.arbitration_id:04X} DATA={hex_data}"


class EVCANSimulator:
    """Simulates EV battery CAN bus messages."""

    def __init__(self, vehicle_id: str = "VH-0001"):
        self.vehicle_id = vehicle_id
        self.soc = 80.0
        self.temp = 25.0
        self.voltage = 400.0
        self.current = 50.0

    def generate_frames(self) -> List[CANFrame]:
        frames = []
        t = time.time()

        # SoC frame (0x7E8 response to 0x5B query)
        soc_val = int(self.soc * 2.55)  # Scaled 0-255
        frames.append(CANFrame(0x7E8, bytes([0x03, 0x41, PID_SOC, soc_val, 0x00, 0x00, 0x00, 0x00]), t))

        # Temperature frame
        temp_val = int(self.temp + 40)  # Offset by 40
        frames.append(CANFrame(0x7E8, bytes([0x03, 0x41, PID_BATTERY_TEMP, temp_val, 0x00, 0x00, 0x00, 0x00]), t))

        # Voltage frame (voltage / 0.001 as 2 bytes)
        v_int = int(self.voltage * 4)
        frames.append(CANFrame(0x7E8, bytes([0x04, 0x41, PID_VOLTAGE, (v_int >> 8) & 0xFF, v_int & 0xFF, 0x00, 0x00, 0x00]), t))

        # Drift state
        self.soc = max(5, min(100, self.soc + random.uniform(-0.2, 0.2)))
        self.temp = max(15, min(80, self.temp + random.gauss(0, 0.3)))
        self.voltage = max(300, min(450, self.voltage + random.gauss(0, 0.5)))

        return frames

    def stream(self, interval: float = 0.1):
        """Yield CAN frames continuously."""
        while True:
            for frame in self.generate_frames():
                yield frame
            time.sleep(interval)


if __name__ == "__main__":
    sim = EVCANSimulator("VH-0001")
    print("CAN Bus Simulator — BatteryOS AI")
    print("=" * 50)
    for i, frame in enumerate(sim.stream(0.5)):
        print(frame)
        if i > 20:
            break
