terraform {
  required_version = ">= 1.5.0"

  backend "local" {
    path = "terraform.tfstate"
  }
}

# This directory applies dev only. qa and prod have their own state.
module "stack" {
  source = "../../modules/stack"

  environment            = "dev"
  target                 = var.target
  cluster_name           = var.cluster_name
  kind_kubeconfig_path   = var.kind_kubeconfig_path
  kind_node_image        = var.kind_node_image
  aws_region             = var.aws_region
  aws_profile            = var.aws_profile
  kubernetes_version     = var.kubernetes_version
  aws_node_instance_type = var.aws_node_instance_type
  image_tag              = var.image_tag
  kubeconfig_path        = var.kubeconfig_path
  kubeconfig_context     = var.kubeconfig_context
  namespace              = var.namespace
  api_image              = var.api_image
  web_image              = var.web_image
  image_pull_policy      = var.image_pull_policy
  api_replicas           = var.api_replicas
  web_replicas           = var.web_replicas
  db_user                = var.db_user
  db_name                = var.db_name
  db_password            = var.db_password
  db_storage_size        = var.db_storage_size
  db_storage_class       = var.db_storage_class
  ingress_enabled        = var.ingress_enabled
  ingress_class_name     = var.ingress_class_name
  ingress_host           = var.ingress_host
  app_env                = var.app_env
  local_port             = var.local_port
}
