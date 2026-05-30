"""Fleet Intelligence — Enterprise Battery Analytics Engine."""
import random
import statistics
import uuid
from typing import Dict, Any, List
from datetime import datetime, timezone
from app.services.telemetry.simulator import get_fleet_snapshot


class FleetAnalyticsEngine:

    def get_fleet_dashboard(self, fleet_id: str = "FLEET-001",
                             num_vehicles: int = 10) -> Dict[str, Any]:
        """Generate comprehensive fleet analytics."""
        vehicles = get_fleet_snapshot(num_vehicles)

        sohs = [v["state_of_health"] for v in vehicles]
        temps = [v["temperature_avg"] for v in vehicles]
        anomalies = [v["anomaly_score"] for v in vehicles]
        thermal_risks = [v["thermal_risk_score"] for v in vehicles]

        critical_vehicles = [
            v for v in vehicles
            if v["anomaly_score"] > 0.6 or v["thermal_risk_score"] > 0.5
        ]

        leaderboard = sorted(vehicles, key=lambda x: x["state_of_health"], reverse=True)

        return {
            "fleet_id": fleet_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_vehicles": num_vehicles,
            "summary": {
                "avg_soh": round(statistics.mean(sohs), 2),
                "min_soh": round(min(sohs), 2),
                "max_soh": round(max(sohs), 2),
                "avg_temperature": round(statistics.mean(temps), 2),
                "critical_count": len(critical_vehicles),
                "healthy_count": sum(1 for v in vehicles if v["state_of_health"] >= 85),
                "degraded_count": sum(1 for v in vehicles if v["state_of_health"] < 75),
            },
            "risk_distribution": {
                "low": sum(1 for a in anomalies if a < 0.3),
                "medium": sum(1 for a in anomalies if 0.3 <= a < 0.6),
                "high": sum(1 for a in anomalies if a >= 0.6),
            },
            "critical_vehicles": [
                {
                    "vehicle_id": v["vehicle_id"],
                    "soh": v["state_of_health"],
                    "anomaly_score": v["anomaly_score"],
                    "thermal_risk": v["thermal_risk_score"],
                    "scenario": v["scenario"],
                    "recommended_action": "Immediate inspection" if v["anomaly_score"] > 0.8
                                          else "Schedule maintenance",
                }
                for v in critical_vehicles
            ],
            "health_leaderboard": [
                {
                    "rank": i + 1,
                    "vehicle_id": v["vehicle_id"],
                    "soh": v["state_of_health"],
                    "scenario": v["scenario"],
                    "chemistry": v["chemistry"],
                }
                for i, v in enumerate(leaderboard[:5])
            ],
            "maintenance_predictions": self._maintenance_schedule(vehicles),
            "charging_abuse_ranking": self._charging_abuse_ranking(vehicles),
            "thermal_hotspots": [
                {"vehicle_id": v["vehicle_id"], "temperature": v["temperature_avg"]}
                for v in sorted(vehicles, key=lambda x: x["temperature_avg"], reverse=True)[:3]
            ],
            "vehicles": vehicles,
        }

    def _maintenance_schedule(self, vehicles: List[Dict]) -> List[Dict]:
        schedule = []
        for v in vehicles:
            if v["state_of_health"] < 80 or v["anomaly_score"] > 0.5:
                days = max(1, int((v["state_of_health"] - 70) * 2))
                schedule.append({
                    "vehicle_id": v["vehicle_id"],
                    "priority": "URGENT" if v["state_of_health"] < 75 else "SCHEDULED",
                    "days_until": days,
                    "reason": "Low SoH" if v["state_of_health"] < 80 else "Anomaly detected",
                })
        return sorted(schedule, key=lambda x: x["days_until"])[:5]

    def _charging_abuse_ranking(self, vehicles: List[Dict]) -> List[Dict]:
        """Rank vehicles by charging abuse score."""
        ranked = []
        for v in vehicles:
            abuse_score = v["thermal_risk_score"] * 0.4 + v["anomaly_score"] * 0.3 + (
                1 - v["state_of_health"] / 100
            ) * 0.3
            ranked.append({
                "vehicle_id": v["vehicle_id"],
                "abuse_score": round(abuse_score, 3),
                "fast_charge_events": random.randint(0, 50),
                "deep_discharge_events": random.randint(0, 20),
            })
        return sorted(ranked, key=lambda x: x["abuse_score"], reverse=True)[:5]


fleet_engine = FleetAnalyticsEngine()
