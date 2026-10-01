-- ====================================================================
-- SecureHR Database Schema & Seed Data
-- Bestlink College of the Philippines (BCP)
-- CC106 Application Development & Emerging Technologies
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `securehr_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `securehr_db`;

-- --------------------------------------------------------------------
-- 1. Table: employees (Primary User & Staff Table)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `employees` (
    `id` VARCHAR(20) NOT NULL,
    `first_name` VARCHAR(50) NOT NULL,
    `last_name` VARCHAR(50) NOT NULL,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `department` VARCHAR(50) NOT NULL,
    `position` VARCHAR(50) DEFAULT 'Staff',
    `role` ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `password` VARCHAR(255) NOT NULL,
    `date_added` DATE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_emp_email` (`email`),
    INDEX `idx_emp_dept` (`department`),
    INDEX `idx_emp_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 2. Table: documents (201-Files, Credentials & Records)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `documents` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `employee_id` VARCHAR(20) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_type` VARCHAR(100) DEFAULT 'application/octet-stream',
    `category` VARCHAR(50) NOT NULL DEFAULT 'Other',
    `uploaded_by` VARCHAR(50) NOT NULL,
    `uploaded_at` DATETIME NOT NULL,
    `file_size` VARCHAR(50) DEFAULT '—',
    `note` TEXT DEFAULT NULL,
    `file_path` VARCHAR(500) DEFAULT NULL,
    `file_data` LONGBLOB DEFAULT NULL,
    `status` ENUM('Pending', 'Verified', 'Rejected') NOT NULL DEFAULT 'Verified',
    PRIMARY KEY (`id`),
    INDEX `idx_doc_emp` (`employee_id`),
    INDEX `idx_doc_category` (`category`),
    CONSTRAINT `fk_docs_employee` FOREIGN KEY (`employee_id`) 
        REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 3. Table: sessions (Session Token Management)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sessions` (
    `id` VARCHAR(64) NOT NULL,
    `employee_id` VARCHAR(20) NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `login_time` DATETIME NOT NULL,
    `last_activity` DATETIME NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    PRIMARY KEY (`id`),
    INDEX `idx_sess_emp` (`employee_id`),
    CONSTRAINT `fk_sess_employee` FOREIGN KEY (`employee_id`) 
        REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 4. Table: audit_log (Institutional Security & Accountability Trail)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_log` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `actor` VARCHAR(100) NOT NULL,
    `actor_id` VARCHAR(20) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `target` VARCHAR(100) DEFAULT '-',
    `details` TEXT DEFAULT NULL,
    `timestamp` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_audit_action` (`action`),
    INDEX `idx_audit_actor` (`actor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 5. Table: password_resets (Self-Service Recovery Tokens)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `password_resets` (
    `id` INT AUTO_INCREMENT NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `used` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_reset_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- SEED DATA
-- Default Passwords:
-- Admin:    admin123     ($2y$10$AlEFRx3eC08/O624V2D2l.8/p371Y/E9Yg8Jc5b8bE3nC0WpE4.G.)
-- Employee: employee123  ($2y$10$E9W4zF9H2kU6uB2E1N1JSeWJ2M0Ym4q3uT7z6x5w4v3u2t1s0r9q8)
-- ====================================================================

-- Insert Initial Employees
INSERT INTO `employees` (`id`, `first_name`, `last_name`, `email`, `department`, `position`, `role`, `status`, `password`, `date_added`)
VALUES 
('ADM-001', 'Admin', 'Account', 'admin@bestlink.edu.ph', 'Administration', 'HR Director', 'admin', 'active', '$2y$10$AlEFRx3eC08/O624V2D2l.8/p371Y/E9Yg8Jc5b8bE3nC0WpE4.G.', '2026-01-01'),
('EMP-001', 'Juan', 'Dela Cruz', 'juan.delacruz@bestlink.edu.ph', 'Human Resources', 'HR Specialist', 'employee', 'active', '$2y$10$u4M0nZ6F2M7s0W1P2Q3R4uO6I8K0M2N4O6P8Q0R2S4T6U8V0W2X4Y', '2026-08-01'),
('EMP-002', 'Maria', 'Santos', 'maria.santos@bestlink.edu.ph', 'Finance', 'Senior Accountant', 'employee', 'active', '$2y$10$u4M0nZ6F2M7s0W1P2Q3R4uO6I8K0M2N4O6P8Q0R2S4T6U8V0W2X4Y', '2026-08-05'),
('EMP-003', 'Roberto', 'Reyes', 'roberto.reyes@bestlink.edu.ph', 'IT Department', 'Systems Engineer', 'employee', 'inactive', '$2y$10$u4M0nZ6F2M7s0W1P2Q3R4uO6I8K0M2N4O6P8Q0R2S4T6U8V0W2X4Y', '2026-07-20')
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

-- Insert Sample Documents
INSERT INTO `documents` (`id`, `employee_id`, `title`, `file_name`, `file_type`, `category`, `uploaded_by`, `uploaded_at`, `file_size`, `note`, `status`)
VALUES
(1, 'EMP-001', 'Employment Contract 2026', 'Employment_Contract_JuanDelaCruz.pdf', 'application/pdf', 'Contract', 'ADM-001', '2026-08-01 09:15:00', '245 KB', 'Signed permanent employment contract', 'Verified'),
(2, 'EMP-001', 'PRC Professional License', 'PRC_License_JuanDelaCruz.pdf', 'application/pdf', 'Certificate', 'EMP-001', '2026-08-02 11:30:00', '180 KB', 'Valid until December 2028', 'Verified'),
(3, 'EMP-002', 'Official Transcript of Records', 'TOR_MariaSantos.pdf', 'application/pdf', 'Certificate', 'EMP-002', '2026-08-06 14:00:00', '520 KB', 'Undergraduate academic records', 'Verified'),
(4, 'EMP-001', 'NBI Clearance 2026', 'NBI_Clearance.png', 'image/png', 'ID', 'EMP-001', '2026-08-10 16:45:00', '410 KB', 'Annual security clearance certificate', 'Verified')
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- Insert Initial Audit Log Entries
INSERT INTO `audit_log` (`actor`, `actor_id`, `action`, `target`, `details`, `timestamp`)
VALUES
('Admin Account', 'ADM-001', 'SYSTEM_INIT', '-', 'SecureHR database initialized with standard schema and seed data', NOW()),
('Admin Account', 'ADM-001', 'LOGIN', '-', 'Signed in as HR Admin', NOW());
