CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  slug varchar(100) UNIQUE NOT NULL,
  logo_url text,
  timezone varchar(50) DEFAULT 'Asia/Shanghai',
  currency varchar(3) DEFAULT 'CNY',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT NOW(),
  updated_at timestamp with time zone DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) NOT NULL,
  email varchar(255) UNIQUE NOT NULL,
  name varchar(100) NOT NULL,
  role varchar(20) DEFAULT 'member',
  avatar_url text,
  settings jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_company_id_idx ON users(company_id);
CREATE INDEX IF NOT EXISTS users_company_role_idx ON users(company_id, role);
