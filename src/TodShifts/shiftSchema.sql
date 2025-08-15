-- Master Schedule Requirements
CREATE TABLE master_schedule_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_type VARCHAR(20) NOT NULL, -- 'weekday', 'saturday', 'sunday'
    time_slot TIME NOT NULL, -- 15-minute intervals
    zone VARCHAR(20) NOT NULL, -- 'North', 'South', 'Floater'
    required_buses INTEGER NOT NULL,
    effective_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Union Rules Configuration
CREATE TABLE union_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(20) NOT NULL, -- 'required', 'preferred'
    category VARCHAR(50), -- 'shift_length', 'breaks', 'rest_periods'
    min_value DECIMAL(10,2),
    max_value DECIMAL(10,2),
    unit VARCHAR(20), -- 'hours', 'minutes'
    is_active BOOLEAN DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shifts Table
CREATE TABLE shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_code VARCHAR(20) UNIQUE NOT NULL, -- 'Bus 01', 'Bus 02', etc.
    schedule_type VARCHAR(20) NOT NULL, -- 'weekday', 'saturday', 'sunday'
    zone VARCHAR(20) NOT NULL, -- 'North', 'South', 'Floater'
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    total_hours DECIMAL(4,2),
    break_start TIME,
    break_end TIME,
    break_duration INTEGER, -- in minutes
    meal_break_start TIME,
    meal_break_end TIME,
    is_split_shift BOOLEAN DEFAULT 0,
    created_by VARCHAR(50),
    union_compliant BOOLEAN DEFAULT 1,
    compliance_warnings TEXT, -- JSON array of warnings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Union Rule Violations
CREATE TABLE union_violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER,
    rule_id INTEGER,
    violation_type VARCHAR(20), -- 'error', 'warning'
    violation_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shift_id) REFERENCES shifts(id),
    FOREIGN KEY (rule_id) REFERENCES union_rules(id)
);

-- Insert default union rules
INSERT INTO union_rules (rule_name, rule_type, category, min_value, max_value, unit, description) VALUES
('Maximum Driving Time', 'required', 'shift_length', 0, 8, 'hours', 'Maximum 8 hours of driving time per shift'),
('Maximum On-Duty Time', 'required', 'shift_length', 0, 10, 'hours', 'Maximum 10 hours total on-duty time'),
('Minimum Rest Between Shifts', 'required', 'rest_periods', 8, NULL, 'hours', 'Minimum 8 consecutive hours off-duty'),
('Break After Continuous Driving', 'required', 'breaks', 3, 4, 'hours', '15-minute break required after 3-4 hours'),
('Meal Break Requirement', 'required', 'breaks', 6, NULL, 'hours', '30-minute meal break for shifts over 6 hours'),
('Weekly Maximum Hours', 'preferred', 'shift_length', 0, 40, 'hours', 'Preferred maximum 40 hours per week'),
('Natural Relief Points', 'preferred', 'breaks', NULL, NULL, NULL, 'Breaks should occur at terminals or major stops');