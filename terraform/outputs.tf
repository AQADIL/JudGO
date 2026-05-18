output "instance_public_ip" {
  description = "Static public IP address of the JudGO server"
  value       = google_compute_address.judgo_static_ip.address
}

output "instance_id" {
  description = "GCE instance id"
  value       = google_compute_instance.judgo_server.instance_id
}

output "instance_name" {
  description = "GCE instance name"
  value       = google_compute_instance.judgo_server.name
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh ubuntu@${google_compute_address.judgo_static_ip.address}"
}
