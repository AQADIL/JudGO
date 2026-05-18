terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.2.0"
}

provider "google" {
  project     = var.gcp_project_id
  region      = var.gcp_region
  zone        = var.gcp_zone
  credentials = var.gcp_credentials_file != "" ? var.gcp_credentials_file : null
}

resource "google_compute_address" "judgo_static_ip" {
  name   = "judgo-static-ip"
  region = var.gcp_region
}

resource "google_compute_firewall" "judgo_public" {
  name    = "judgo-public-ingress"
  network = "default"
  description = "Allow public HTTP/HTTPS and SSH to judgo-server nodes"

  allow {
    protocol = "tcp"
    ports    = ["22", "80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["judgo-server"]
}

resource "google_compute_firewall" "judgo_internal" {
  name    = "judgo-internal-deny"
  network = "default"
  description = "Block direct public access to internal service ports"
  priority    = 500

  deny {
    protocol = "tcp"
    ports    = ["5432", "9090", "3000", "8081", "8082", "8083", "8084", "8085"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["judgo-server"]
}

resource "google_compute_firewall" "judgo_swarm" {
  name    = "judgo-swarm-internal"
  network = "default"
  description = "Allow Docker Swarm internal communication between nodes"

  allow {
    protocol = "tcp"
    ports    = ["2377", "7946"]
  }
  allow {
    protocol = "udp"
    ports    = ["7946", "4789"]
  }

  source_tags = ["judgo-server"]
  target_tags = ["judgo-server"]
}

resource "google_compute_instance" "judgo_server" {
  name         = "judgo-production-server"
  machine_type = var.machine_type
  zone         = var.gcp_zone

  tags = ["judgo-server"]

  boot_disk {
    initialize_params {
      image = "ubuntu-2204-lts"
      size  = var.disk_size_gb
      type  = "pd-ssd"
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip       = google_compute_address.judgo_static_ip.address
      network_tier = "PREMIUM"
    }
  }

  metadata = {
    ssh-keys               = var.ssh_public_key != "" ? "ubuntu:${var.ssh_public_key}" : ""
    block-project-ssh-keys = "false"
  }

  metadata_startup_script = <<-EOT
    #!/bin/bash
    set -e
    apt-get update -qq
    apt-get install -y --no-install-recommends curl ca-certificates gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    docker swarm init --advertise-addr $(hostname -I | awk '{print $1}')
    echo "Bootstrap complete"
  EOT

  service_account {
    scopes = ["cloud-platform"]
  }

  labels = {
    environment = "production"
    managed-by  = "terraform"
    project     = "judgo"
  }
}
