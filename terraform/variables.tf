variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "europe-west1"
}

variable "gcp_zone" {
  description = "GCP zone"
  type        = string
  default     = "europe-west1-b"
}

variable "gcp_credentials_file" {
  description = "Path to GCP service account JSON key file (leave empty to use ADC)"
  type        = string
  default     = ""
}

variable "machine_type" {
  description = "GCE machine type (e2-standard-2 recommended for Swarm workloads)"
  type        = string
  default     = "e2-standard-2"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 40
}

variable "ssh_public_key" {
  description = "SSH public key to inject into the instance (optional)"
  type        = string
  default     = ""
}
