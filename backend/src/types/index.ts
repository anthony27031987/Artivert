export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role_id: number;
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Employee {
  id: string;
  user_id: string;
  employee_number: string;
  hire_date: Date;
  contract_type: string;
  hourly_rate: number;
  manager_id?: string;
}

export interface Site {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  client_name: string;
  description?: string;
  status: string;
  created_at: Date;
}

export interface WorkHours {
  id: string;
  employee_id: string;
  site_id?: string;
  clock_in: Date;
  clock_out?: Date;
  latitude_in: number;
  longitude_in: number;
  latitude_out?: number;
  longitude_out?: number;
  duration_minutes?: number;
  notes?: string;
}

export interface JWTPayload {
  id: string;
  email: string;
  role_id: number;
  iat?: number;
  exp?: number;
}

export interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: Date;
}
