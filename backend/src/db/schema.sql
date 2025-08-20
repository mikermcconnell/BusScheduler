-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS shift_assignments CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS union_rules CASCADE;
DROP TABLE IF EXISTS operators CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS service_bands CASCADE;
DROP TABLE IF EXISTS time_point_travel_times CASCADE;
DROP TABLE IF EXISTS time_points CASCADE;
DROP TABLE IF EXISTS schedule_versions CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS day_type CASCADE;
DROP TYPE IF EXISTS schedule_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS shift_status CASCADE;

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'scheduler', 'operator', 'viewer');
CREATE TYPE schedule_status AS ENUM ('draft', 'active', 'archived', 'expired');
CREATE TYPE day_type AS ENUM ('weekday', 'saturday', 'sunday');
CREATE TYPE shift_status AS ENUM ('draft', 'published', 'assigned', 'completed');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role user_role DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens for JWT
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    replaced_by VARCHAR(500)
);

-- Routes table
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_number VARCHAR(50) NOT NULL,
    route_name VARCHAR(255) NOT NULL,
    direction VARCHAR(100),
    description TEXT,
    color VARCHAR(7), -- Hex color for UI
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(route_number, direction)
);

-- Schedules table
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    effective_date DATE NOT NULL,
    expiration_date DATE,
    status schedule_status DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    cycle_time_minutes INTEGER,
    number_of_buses INTEGER,
    automate_block_start_times BOOLEAN DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Schedule versions for history tracking
CREATE TABLE schedule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    data JSONB NOT NULL, -- Store complete schedule data
    changed_by UUID REFERENCES users(id),
    change_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schedule_id, version_number)
);

-- Time points table
CREATE TABLE time_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    stop_id VARCHAR(100),
    sequence_number INTEGER NOT NULL,
    is_timing_point BOOLEAN DEFAULT true,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schedule_id, sequence_number)
);

-- Time point travel times
CREATE TABLE time_point_travel_times (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    from_time_point_id UUID REFERENCES time_points(id) ON DELETE CASCADE,
    to_time_point_id UUID REFERENCES time_points(id) ON DELETE CASCADE,
    day_type day_type NOT NULL,
    time_period VARCHAR(50) NOT NULL, -- e.g., "07:00 - 07:29"
    percentile_25 INTEGER, -- Travel time in minutes
    percentile_50 INTEGER,
    percentile_80 INTEGER,
    percentile_90 INTEGER,
    scheduled_time INTEGER,
    is_outlier BOOLEAN DEFAULT false,
    outlier_type VARCHAR(10), -- 'high' or 'low'
    outlier_deviation DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_time_point_id, to_time_point_id, day_type, time_period)
);

-- Service bands
CREATE TABLE service_bands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    day_type day_type NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    color VARCHAR(7), -- Hex color
    travel_time_multiplier DECIMAL(3, 2) DEFAULT 1.0,
    description TEXT,
    total_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blocks (bus blocks)
CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    block_number INTEGER NOT NULL,
    day_type day_type NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    pull_out_time TIME,
    pull_in_time TIME,
    total_hours DECIMAL(5, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schedule_id, block_number, day_type)
);

-- Trips
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    block_id UUID REFERENCES blocks(id) ON DELETE SET NULL,
    trip_number INTEGER NOT NULL,
    day_type day_type NOT NULL,
    service_band_id UUID REFERENCES service_bands(id),
    departure_time TIME NOT NULL,
    arrival_time TIME NOT NULL,
    recovery_minutes INTEGER,
    deadhead_before_minutes INTEGER,
    deadhead_after_minutes INTEGER,
    trip_data JSONB, -- Store detailed stop times
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schedule_id, trip_number, day_type)
);

-- Operators
CREATE TABLE operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    badge_number VARCHAR(50),
    seniority_date DATE,
    home_zone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    qualifications JSONB, -- Store certifications, endorsements
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Union rules configuration
CREATE TABLE union_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(100) NOT NULL, -- 'shift_length', 'break_time', 'rest_period', etc.
    min_value INTEGER,
    max_value INTEGER,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    applies_to_day_type day_type[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shifts (Tod Shifts)
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    shift_number VARCHAR(50) NOT NULL,
    day_type day_type NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_start TIME,
    break_duration_minutes INTEGER,
    meal_start TIME,
    meal_duration_minutes INTEGER,
    zone VARCHAR(50),
    status shift_status DEFAULT 'draft',
    total_hours DECIMAL(5, 2),
    is_split_shift BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schedule_id, shift_number, day_type)
);

-- Shift assignments
CREATE TABLE shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES operators(id),
    assigned_date DATE NOT NULL,
    assigned_by UUID REFERENCES users(id),
    is_confirmed BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shift_id, assigned_date)
);

-- Audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_routes_route_number ON routes(route_number);
CREATE INDEX idx_schedules_route_id ON schedules(route_id);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedules_effective_date ON schedules(effective_date);
CREATE INDEX idx_time_points_schedule_id ON time_points(schedule_id);
CREATE INDEX idx_trips_schedule_id ON trips(schedule_id);
CREATE INDEX idx_trips_block_id ON trips(block_id);
CREATE INDEX idx_trips_day_type ON trips(day_type);
CREATE INDEX idx_blocks_schedule_id ON blocks(schedule_id);
CREATE INDEX idx_shifts_schedule_id ON shifts(schedule_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_points_updated_at BEFORE UPDATE ON time_points FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_bands_updated_at BEFORE UPDATE ON service_bands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_operators_updated_at BEFORE UPDATE ON operators FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();