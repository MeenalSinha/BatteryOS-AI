"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('vehicles',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('vin', sa.String(17), nullable=False),
        sa.Column('make', sa.String(100), nullable=True),
        sa.Column('model', sa.String(100), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('battery_capacity_kwh', sa.Float(), nullable=True),
        sa.Column('chemistry', sa.String(50), nullable=True),
        sa.Column('fleet_id', sa.String(100), nullable=True),
        sa.Column('owner_id', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('vin'),
    )
    op.create_index('ix_vehicles_vin', 'vehicles', ['vin'])
    op.create_index('ix_vehicles_fleet_id', 'vehicles', ['fleet_id'])

    op.create_table('telemetry_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('vehicle_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.Column('state_of_charge', sa.Float(), nullable=True),
        sa.Column('state_of_health', sa.Float(), nullable=True),
        sa.Column('voltage', sa.Float(), nullable=True),
        sa.Column('current', sa.Float(), nullable=True),
        sa.Column('power_kw', sa.Float(), nullable=True),
        sa.Column('temperature_avg', sa.Float(), nullable=True),
        sa.Column('temperature_max', sa.Float(), nullable=True),
        sa.Column('temperature_min', sa.Float(), nullable=True),
        sa.Column('temperature_gradient', sa.Float(), nullable=True),
        sa.Column('cell_voltages', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('cell_temperatures', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('speed_kmh', sa.Float(), nullable=True),
        sa.Column('elevation_m', sa.Float(), nullable=True),
        sa.Column('ambient_temp', sa.Float(), nullable=True),
        sa.Column('regenerative_braking_w', sa.Float(), nullable=True),
        sa.Column('is_charging', sa.Boolean(), nullable=True),
        sa.Column('charging_rate_kw', sa.Float(), nullable=True),
        sa.Column('charger_type', sa.String(20), nullable=True),
        sa.Column('degradation_index', sa.Float(), nullable=True),
        sa.Column('thermal_risk_score', sa.Float(), nullable=True),
        sa.Column('anomaly_score', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_telemetry_vehicle_id', 'telemetry_records', ['vehicle_id'])
    op.create_index('ix_telemetry_timestamp', 'telemetry_records', ['timestamp'])

    op.create_table('battery_passports',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('vehicle_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('certificate_id', sa.String(64), nullable=True),
        sa.Column('issued_at', sa.DateTime(), nullable=True),
        sa.Column('valid_until', sa.DateTime(), nullable=True),
        sa.Column('overall_health_score', sa.Float(), nullable=True),
        sa.Column('capacity_retention_pct', sa.Float(), nullable=True),
        sa.Column('total_cycles', sa.Integer(), nullable=True),
        sa.Column('fast_charge_events', sa.Integer(), nullable=True),
        sa.Column('thermal_events', sa.Integer(), nullable=True),
        sa.Column('deep_discharge_events', sa.Integer(), nullable=True),
        sa.Column('predicted_lifespan_months', sa.Float(), nullable=True),
        sa.Column('resale_confidence_score', sa.Float(), nullable=True),
        sa.Column('ai_risk_rating', sa.String(20), nullable=True),
        sa.Column('blockchain_hash', sa.String(128), nullable=True),
        sa.Column('ipfs_cid', sa.String(128), nullable=True),
        sa.Column('raw_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('vehicle_id'),
        sa.UniqueConstraint('certificate_id'),
    )

    op.create_table('alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('vehicle_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('alert_type', sa.String(50), nullable=True),
        sa.Column('severity', sa.String(20), nullable=True),
        sa.Column('title', sa.String(200), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('probability', sa.Float(), nullable=True),
        sa.Column('acknowledged', sa.Boolean(), nullable=True),
        sa.Column('resolved', sa.Boolean(), nullable=True),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_alerts_vehicle_id', 'alerts', ['vehicle_id'])


def downgrade() -> None:
    op.drop_table('alerts')
    op.drop_table('battery_passports')
    op.drop_table('telemetry_records')
    op.drop_table('vehicles')
