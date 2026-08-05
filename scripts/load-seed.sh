#!/bin/bash
export PGPASSWORD="postgres"
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed/seed_dev.sql
