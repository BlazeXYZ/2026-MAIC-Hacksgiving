locals {
  kind_kubeconfig = pathexpand(var.kind_kubeconfig_path)

  # one() is null when that cluster was not created. Both branches of a
  # conditional are evaluated, so unused clusters stay null instead of [0].
  k8s_host = var.target == "local" ? one(kind_cluster.local[*].endpoint) : (
    var.target == "aws" ? one(module.eks[*].cluster_endpoint) : null
  )
  k8s_ca = var.target == "local" ? one(kind_cluster.local[*].cluster_ca_certificate) : (
    var.target == "aws" ? try(base64decode(one(module.eks[*].cluster_certificate_authority_data)), null) : null
  )
  k8s_client_cert = one(kind_cluster.local[*].client_certificate)
  k8s_client_key  = one(kind_cluster.local[*].client_key)
  k8s_token       = one(data.aws_eks_cluster_auth.this[*].token)

  k8s_config_path    = var.target == "existing" ? var.kubeconfig_path : null
  k8s_config_context = var.target == "existing" ? var.kubeconfig_context : null

  # Repository URLs exist only on AWS. try() turns the empty local case into null.
  aws_api_image = try("${one(aws_ecr_repository.api[*].repository_url)}:${var.image_tag}", null)
  aws_web_image = try("${one(aws_ecr_repository.web[*].repository_url)}:${var.image_tag}", null)

  api_image = coalesce(var.api_image, local.aws_api_image, "comforce-api:local")
  web_image = coalesce(var.web_image, local.aws_web_image, "comforce-web:local")

  db_storage_class = var.db_storage_class != null ? var.db_storage_class : (
    var.target == "aws" ? "comforce-gp3" : null
  )
}

check "existing_kubeconfig" {
  assert {
    condition     = var.target != "existing" || var.kubeconfig_path != null
    error_message = "Set kubeconfig_path in terraform.tfvars when target is existing."
  }
}
