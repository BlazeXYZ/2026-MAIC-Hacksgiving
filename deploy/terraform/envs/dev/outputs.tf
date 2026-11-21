output "environment" {
  value = module.stack.environment
}

output "target" {
  value = module.stack.target
}

output "cluster_name" {
  value = module.stack.cluster_name
}

output "namespace" {
  value = module.stack.namespace
}

output "app_env" {
  value = module.stack.app_env
}

output "local_port" {
  value = module.stack.local_port
}

output "kubeconfig" {
  value = module.stack.kubeconfig
}

output "port_forward" {
  value = module.stack.port_forward
}

output "ingress_host" {
  value = module.stack.ingress_host
}

output "api_image" {
  value = module.stack.api_image
}

output "web_image" {
  value = module.stack.web_image
}

output "aws_region" {
  value = module.stack.aws_region
}

output "ecr_registry" {
  value = module.stack.ecr_registry
}
