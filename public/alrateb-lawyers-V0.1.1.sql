-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.4.3 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.8.0.6908
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Dumping structure for table lawyer.admin_permissions
CREATE TABLE IF NOT EXISTS `admin_permissions` (
  `admin_permissions_id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`admin_permissions_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.admin_permissions: ~0 rows (approximately)

-- Dumping structure for table lawyer.admin_users
CREATE TABLE IF NOT EXISTS `admin_users` (
  `admin_users_id` int NOT NULL AUTO_INCREMENT,
  `law_firm_id` int DEFAULT NULL,
  `name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_general_ci DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`admin_users_id`),
  UNIQUE KEY `email` (`email`),
  KEY `law_firm_id` (`law_firm_id`),
  CONSTRAINT `admin_users_ibfk_1` FOREIGN KEY (`law_firm_id`) REFERENCES `law_firms` (`law_firm_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.admin_users: ~0 rows (approximately)

-- Dumping structure for table lawyer.admin_user_permissions
CREATE TABLE IF NOT EXISTS `admin_user_permissions` (
  `admin_user_permissions_id` int NOT NULL AUTO_INCREMENT,
  `admin_user_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `granted_by` int DEFAULT NULL,
  `granted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`admin_user_permissions_id`),
  KEY `admin_user_id` (`admin_user_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `admin_user_permissions_ibfk_1` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`admin_users_id`) ON DELETE CASCADE,
  CONSTRAINT `admin_user_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `admin_permissions` (`admin_permissions_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.admin_user_permissions: ~0 rows (approximately)

-- Dumping structure for table lawyer.audit_logs
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `audit_logs_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `object_type` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `object_id` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ip_address` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_agent` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`audit_logs_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`users_id`) ON DELETE SET NULL,
  CONSTRAINT `audit_logs_chk_1` CHECK (json_valid(`details`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.audit_logs: ~0 rows (approximately)

-- Dumping structure for table lawyer.cases
CREATE TABLE IF NOT EXISTS `cases` (
  `case_id` int NOT NULL AUTO_INCREMENT,
  `law_firm_id` int DEFAULT NULL,
  `client_id` int DEFAULT NULL,
  `case_type_id` int DEFAULT NULL,
  `reference_number` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `title` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `status` enum('open','closed','on_hold','archived') COLLATE utf8mb4_general_ci DEFAULT 'open',
  `priority` enum('low','medium','high') COLLATE utf8mb4_general_ci DEFAULT 'medium',
  `assigned_to` int DEFAULT NULL,
  `opened_at` date DEFAULT NULL,
  `closed_at` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`case_id`),
  UNIQUE KEY `reference_number` (`reference_number`),
  KEY `law_firm_id` (`law_firm_id`),
  KEY `case_type_id` (`case_type_id`),
  KEY `assigned_to` (`assigned_to`),
  KEY `idx_cases_client` (`client_id`),
  CONSTRAINT `cases_ibfk_1` FOREIGN KEY (`law_firm_id`) REFERENCES `law_firms` (`law_firm_id`) ON DELETE SET NULL,
  CONSTRAINT `cases_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE SET NULL,
  CONSTRAINT `cases_ibfk_3` FOREIGN KEY (`case_type_id`) REFERENCES `case_types` (`case_type_id`) ON DELETE SET NULL,
  CONSTRAINT `cases_ibfk_4` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`users_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.cases: ~0 rows (approximately)

-- Dumping structure for table lawyer.case_events
CREATE TABLE IF NOT EXISTS `case_events` (
  `case_event_id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `event_type` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `event_date` datetime DEFAULT NULL,
  `location` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`case_event_id`),
  KEY `case_id` (`case_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `case_events_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `cases` (`case_id`) ON DELETE CASCADE,
  CONSTRAINT `case_events_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`users_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.case_events: ~0 rows (approximately)

-- Dumping structure for table lawyer.case_types
CREATE TABLE IF NOT EXISTS `case_types` (
  `case_type_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`case_type_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.case_types: ~0 rows (approximately)

-- Dumping structure for table lawyer.clients
CREATE TABLE IF NOT EXISTS `clients` (
  `client_id` int NOT NULL AUTO_INCREMENT,
  `law_firm_id` int DEFAULT NULL,
  `client_code` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `type` enum('individual','company','government','bank','insurance_company','finance_company','non_profit','real-estate','other') COLLATE utf8mb4_general_ci DEFAULT 'individual',
  `others_type` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tax_id` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`client_id`),
  UNIQUE KEY `client_code` (`client_code`),
  KEY `law_firm_id` (`law_firm_id`),
  CONSTRAINT `clients_ibfk_1` FOREIGN KEY (`law_firm_id`) REFERENCES `law_firms` (`law_firm_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.clients: ~0 rows (approximately)

-- Dumping structure for table lawyer.client_contacts
CREATE TABLE IF NOT EXISTS `client_contacts` (
  `client_contact_id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `role` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `preferred` tinyint(1) DEFAULT '0',
  `notes` text COLLATE utf8mb4_general_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`client_contact_id`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `client_contacts_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.client_contacts: ~0 rows (approximately)

-- Dumping structure for table lawyer.documents
CREATE TABLE IF NOT EXISTS `documents` (
  `document_id` int NOT NULL AUTO_INCREMENT,
  `case_id` int DEFAULT NULL,
  `file_path` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `uploaded_by` int DEFAULT NULL,
  `title` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `filename` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mime_type` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_size` bigint DEFAULT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`document_id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_documents_case` (`case_id`),
  CONSTRAINT `documents_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `cases` (`case_id`) ON DELETE SET NULL,
  CONSTRAINT `documents_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`users_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.documents: ~0 rows (approximately)

-- Dumping structure for table lawyer.document_versions
CREATE TABLE IF NOT EXISTS `document_versions` (
  `document_version_id` int NOT NULL AUTO_INCREMENT,
  `document_id` int NOT NULL,
  `version_number` int NOT NULL DEFAULT '1',
  `filename` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mime_type` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_path` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_size` bigint DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`document_version_id`),
  KEY `document_id` (`document_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `document_versions_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE,
  CONSTRAINT `document_versions_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`users_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.document_versions: ~0 rows (approximately)

-- Dumping structure for table lawyer.invoices
CREATE TABLE IF NOT EXISTS `invoices` (
  ` invoice_id` int NOT NULL AUTO_INCREMENT,
  `law_firm_id` int DEFAULT NULL,
  `client_id` int DEFAULT NULL,
  `case_id` int DEFAULT NULL,
  `invoice_number` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('draft','sent','paid','overdue','cancelled') COLLATE utf8mb4_general_ci DEFAULT 'draft',
  `issue_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `total_amount` decimal(15,2) DEFAULT '0.00',
  `balance` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (` invoice_id`),
  UNIQUE KEY `invoice_number` (`invoice_number`),
  KEY `law_firm_id` (`law_firm_id`),
  KEY `client_id` (`client_id`),
  KEY `case_id` (`case_id`),
  CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`law_firm_id`) REFERENCES `law_firms` (`law_firm_id`) ON DELETE SET NULL,
  CONSTRAINT `invoices_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON DELETE SET NULL,
  CONSTRAINT `invoices_ibfk_3` FOREIGN KEY (`case_id`) REFERENCES `cases` (`case_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.invoices: ~0 rows (approximately)

-- Dumping structure for table lawyer.law_firms
CREATE TABLE IF NOT EXISTS `law_firms` (
  `law_firm_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `firm_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `registration_number` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `website` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`law_firm_id`),
  KEY `law_firms_user_fk` (`user_id`),
  CONSTRAINT `law_firms_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`users_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.law_firms: ~0 rows (approximately)

-- Dumping structure for table lawyer.permissions
CREATE TABLE IF NOT EXISTS `permissions` (
  `permission_id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.permissions: ~0 rows (approximately)
INSERT INTO `permissions` (`permission_id`, `slug`, `name`, `description`, `created_at`, `updated_at`) VALUES
	(5, 'view_law_firm', 'View Law Firm', 'Can view law firm details', '2025-11-25 06:14:09', NULL),
	(6, 'view_cases', 'View Cases', 'Can view case details', '2025-11-25 06:14:09', NULL),
	(7, 'create_case', 'Create Case', 'Can create new cases', '2025-11-25 06:14:09', NULL),
	(8, 'edit_case', 'Edit Case', 'Can edit existing cases', '2025-11-25 06:14:09', NULL),
	(9, 'delete_case', 'Delete Case', 'Can delete cases', '2025-11-25 06:14:09', NULL),
	(10, 'view_clients', 'View Clients', 'Can view client details', '2025-11-25 06:14:09', NULL),
	(11, 'create_client', 'Create Client', 'Can add new clients', '2025-11-25 06:14:09', NULL),
	(12, 'edit_client', 'Edit Client', 'Can edit client information', '2025-11-25 06:14:09', NULL),
	(13, 'delete_client', 'Delete Client', 'Can remove clients', '2025-11-25 06:14:09', NULL),
	(14, 'view_documents', 'View Documents', 'Can view documents', '2025-11-25 06:14:09', NULL),
	(15, 'upload_document', 'Upload Document', 'Can upload new documents', '2025-11-25 06:14:09', NULL),
	(16, 'edit_document', 'Edit Document', 'Can edit document metadata', '2025-11-25 06:14:09', NULL),
	(17, 'delete_document', 'Delete Document', 'Can delete documents', '2025-11-25 06:14:09', NULL),
	(18, 'view_invoices', 'View Invoices', 'Can view invoices', '2025-11-25 06:14:09', NULL),
	(19, 'create_invoice', 'Create Invoice', 'Can create invoices', '2025-11-25 06:14:09', NULL),
	(20, 'edit_invoice', 'Edit Invoice', 'Can edit invoices', '2025-11-25 06:14:09', NULL),
	(21, 'delete_invoice', 'Delete Invoice', 'Can delete invoices', '2025-11-25 06:14:09', NULL),
	(22, 'view_time_entries', 'View Time Entries', 'Can view time entries', '2025-11-25 06:14:09', NULL),
	(23, 'create_time_entry', 'Create Time Entry', 'Can log time entries', '2025-11-25 06:14:09', NULL),
	(24, 'edit_time_entry', 'Edit Time Entry', 'Can edit time entries', '2025-11-25 06:14:09', NULL),
	(25, 'delete_time_entry', 'Delete Time Entry', 'Can delete time entries', '2025-11-25 06:14:09', NULL),
	(26, 'manage_users', 'Manage Users', 'Can manage user accounts', '2025-11-25 06:14:09', NULL),
	(27, 'manage_roles', 'Manage Roles', 'Can manage roles and permissions', '2025-11-25 06:14:09', NULL),
	(28, 'view_audit_logs', 'View Audit Logs', 'Can view audit logs', '2025-11-25 06:14:09', NULL);

-- Dumping structure for table lawyer.roles
CREATE TABLE IF NOT EXISTS `roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `law_firm_id` int DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `name` (`name`),
  KEY `roles_law_firm_fk` (`law_firm_id`),
  CONSTRAINT `roles_law_firm_fk` FOREIGN KEY (`law_firm_id`) REFERENCES `law_firms` (`law_firm_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.roles: ~0 rows (approximately)

-- Dumping structure for table lawyer.role_permissions
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_permission_id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`role_permission_id`),
  KEY `role_id` (`role_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`permission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.role_permissions: ~0 rows (approximately)

-- Dumping structure for table lawyer.time_entries
CREATE TABLE IF NOT EXISTS `time_entries` (
  `time_entrie_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `case_id` int DEFAULT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `duration_minutes` int DEFAULT NULL,
  `billable` tinyint(1) DEFAULT '1',
  `rate` decimal(10,2) DEFAULT '0.00',
  `amount` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`time_entrie_id`),
  KEY `case_id` (`case_id`),
  KEY `idx_timeentries_user` (`user_id`),
  CONSTRAINT `time_entries_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`users_id`) ON DELETE CASCADE,
  CONSTRAINT `time_entries_ibfk_2` FOREIGN KEY (`case_id`) REFERENCES `cases` (`case_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.time_entries: ~0 rows (approximately)

-- Dumping structure for table lawyer.users
CREATE TABLE IF NOT EXISTS `users` (
  `users_id` int NOT NULL AUTO_INCREMENT,
  `user_type` enum('firm_owner','lawyer','client','paralegal','accountant','external') COLLATE utf8mb4_general_ci NOT NULL,
  `role_id` int DEFAULT NULL,
  `name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `image` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `status` tinyint DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`users_id`),
  UNIQUE KEY `email` (`email`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.users: ~1 rows (approximately)
INSERT INTO `users` (`user_type`, `role_id`, `name`, `email`, `phone`, `password`, `image`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
	('firm_owner', NULL, 'Demo Firm Owner', 'owner@gmail.com', NULL, '$argon2id$v=19$m=65536,t=3,p=4$accYGfX1X9sG4gQyn81VpQ$a87punXf/ncryPXpxOO52XJLW0M2v1ndwGszHnWlNKQ', '', 0, '2025-11-25 06:14:09', NULL, NULL);

-- Dumping structure for table lawyer.user_roles
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_role_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `role_id` int NOT NULL,
  `assigned_by` int DEFAULT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_role_id`),
  KEY `user_id` (`user_id`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `user_roles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`users_id`) ON DELETE CASCADE,
  CONSTRAINT `user_roles_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table lawyer.user_roles: ~0 rows (approximately)

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
