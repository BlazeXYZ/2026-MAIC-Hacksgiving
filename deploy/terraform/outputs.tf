output "target" {
  description = "Cluster target this state is managing."
  value       = var.target
}

output "cluster_name" {
  description = "Kind or EKS cluster name."
  value       = var.cluster_name
}

output "aws_region" {
  description = "AWS region from variables. Used when target is aws."
  value       = var.aws_region
}

output "namespace" {
  description = "Namespace the stack was installed into."
  value       = kubernetes_namespace_v1.app.metadata[0].name
}

output "port_forward" {
  description = "Open the web app when Ingress is off."
  value       = "kubectl -n ${kubernetes_namespace_v1.app.metadata[0].name} port-forward svc/web 8080:80"
}

output "ingress_host" {
  description = "Hostname on the Ingress, when ingress_enabled is true."
  value       = var.ingress_enabled ? var.ingress_host : null
}

output "kubeconfig" {
  description = "Command that points kubectl at this cluster."
  value = var.target == "local" ? "export KUBECONFIG=${local.kind_kubeconfig}" : (
    var.target == "aws" ? "aws eks update-kubeconfig --name ${var.cluster_name} --region ${var.aws_region}" : "kubectl config current-context"
  )
}

output "api_image" {
  description = "Image the API deployment runs."
  value       = local.api_image
}

output "web_image" {
  description = "Image the web deployment runs."
  value       = local.web_image
}

output "ecr_registry" {
  description = "ECR registry host, when target is aws."
  value       = try(split("/", one(aws_ecr_repository.api[*].repository_url))[0], null)
}
