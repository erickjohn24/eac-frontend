#!/usr/bin/env bash
# Bootstrap a local Postgres 16 database for tz-compliance (no Docker required).
set -euo pipefail

if ! pg_isready -q 2>/dev/null; then
  echo "Starting PostgreSQL service..."
  sudo service postgresql start
  sleep 2
fi

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='tz'" | grep -q 1 ||
  sudo -u postgres psql -c "CREATE ROLE tz WITH LOGIN PASSWORD 'tz' CREATEDB;"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='tz_compliance'" | grep -q 1 ||
  sudo -u postgres psql -c "CREATE DATABASE tz_compliance OWNER tz;"

echo "Database ready: postgres://tz:tz@localhost:5432/tz_compliance"
