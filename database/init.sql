-- ================================================
-- ARTIVERT - Schéma initial base de données
-- ================================================

-- Drop existing tables if needed
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS geolocation_history CASCADE;
DROP TABLE IF EXISTS work_hours CASCADE;
DROP TABLE IF EXISTS absences CASCADE;
DROP TABLE IF EXISTS employee_sites CASCADE;
DROP TABLE IF EXISTS employee CASCADE;
DROP TABLE IF EXISTS sites CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- ================================================
-- ROLES AND PERMISSIONS
-- ================================================

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrateur système'),
  ('gerant', 'Gérant/Directeur'),
  ('chef_equipe', 'Chef d''équipe'),
  ('employe', 'Employé de terrain');

-- ================================================
-- USERS
-- ================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  role_id INTEGER REFERENCES roles(id),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);

-- Insert default users
INSERT INTO users (email, password_hash, first_name, last_name, role_id, is_active)
VALUES
  ('gerant@artivert.fr', '$2b$10$uC6eY.3YcvHE9dJxVKXQ2e7g0bIqG4f.KYqH9wDmO5vRhf5vVZIx.', 'Lénaïk', 'Artivert', 2, true),
  ('chef@artivert.fr', '$2b$10$uC6eY.3YcvHE9dJxVKXQ2e7g0bIqG4f.KYqH9wDmO5vRhf5vVZIx.', 'Chef', 'Equipe', 3, true),
  ('employe@artivert.fr', '$2b$10$uC6eY.3YcvHE9dJxVKXQ2e7g0bIqG4f.KYqH9wDmO5vRhf5vVZIx.', 'Jean', 'Dupont', 4, true);

-- ================================================
-- SITES (Chantiers/Espaces)
-- ================================================

CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  city VARCHAR(100),
  postal_code VARCHAR(10),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  client_name VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sites_status ON sites(status);
CREATE INDEX idx_sites_geom ON sites USING gist (ll_to_earth(latitude, longitude)) WHERE latitude IS NOT NULL;

-- Insert sample sites
INSERT INTO sites (name, address, city, postal_code, latitude, longitude, client_name, description, status)
VALUES
  ('Parc Central', '123 rue des Chênes', 'Paris', '75001', 48.8566, 2.3522, 'Ville de Paris', 'Parc urbain central', 'active'),
  ('Jardins Botaniques', '456 avenue des Fleurs', 'Lyon', '69000', 45.7640, 4.8357, 'Région Auvergne-Rhône-Alpes', 'Jardins botaniques', 'active'),
  ('Espace Vert Résidentiel', '789 boulevard de la Paix', 'Marseille', '13000', 43.2965, 5.3698, 'Copropriété Riviera', 'Espace vert résidentiel', 'active');

-- ================================================
-- EMPLOYEE (Employés)
-- ================================================

CREATE TABLE employee (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id),
  employee_number VARCHAR(20) UNIQUE,
  hire_date DATE,
  contract_type VARCHAR(50),
  hourly_rate DECIMAL(8, 2),
  manager_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employee_user ON employee(user_id);

-- ================================================
-- EMPLOYEE SITES (Affectations)
-- ================================================

CREATE TABLE employee_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employee(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id),
  assigned_date DATE DEFAULT CURRENT_DATE,
  unassigned_date DATE,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employee_sites_employee ON employee_sites(employee_id);
CREATE INDEX idx_employee_sites_site ON employee_sites(site_id);

-- ================================================
-- WORK HOURS (Pointages)
-- ================================================

CREATE TABLE work_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employee(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES sites(id),
  clock_in TIMESTAMP NOT NULL,
  clock_out TIMESTAMP,
  latitude_in DECIMAL(10, 8),
  longitude_in DECIMAL(11, 8),
  latitude_out DECIMAL(10, 8),
  longitude_out DECIMAL(11, 8),
  duration_minutes INTEGER,
  notes TEXT,
  validated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_work_hours_employee ON work_hours(employee_id);
CREATE INDEX idx_work_hours_site ON work_hours(site_id);
CREATE INDEX idx_work_hours_date ON work_hours(clock_in);

-- ================================================
-- GEOLOCATION HISTORY (Historique géolocalisation)
-- ================================================

CREATE TABLE geolocation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employee(id) ON DELETE CASCADE NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(7, 2),
  timestamp TIMESTAMP NOT NULL,
  is_within_site BOOLEAN,
  site_id UUID REFERENCES sites(id),
  expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '90 days',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_geolocation_employee ON geolocation_history(employee_id);
CREATE INDEX idx_geolocation_timestamp ON geolocation_history(timestamp);
CREATE INDEX idx_geolocation_expires ON geolocation_history(expires_at);

-- ================================================
-- ABSENCES
-- ================================================

CREATE TABLE absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employee(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_absences_employee ON absences(employee_id);
CREATE INDEX idx_absences_dates ON absences(start_date, end_date);

-- ================================================
-- AUDIT LOGS (Logs d'audit RGPD)
-- ================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  changes JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  status VARCHAR(50),
  expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '365 days',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ================================================
-- FUNCTIONS
-- ================================================

-- Calcul durée travail
CREATE OR REPLACE FUNCTION calculate_work_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out IS NOT NULL THEN
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_duration
BEFORE INSERT OR UPDATE ON work_hours
FOR EACH ROW
EXECUTE FUNCTION calculate_work_duration();

-- ================================================
-- PERMISSIONS
-- ================================================

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO artivert_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO artivert_user;

echo "✅ Database initialized successfully!"
