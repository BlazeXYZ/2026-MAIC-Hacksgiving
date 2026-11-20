terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.95"
    }
    kind = {
      source  = "tehcyx/kind"
      version = "0.13.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.35"
    }
  }
}

# Local plans never call AWS. Dummy keys keep the provider from looking up
# credentials or the instance metadata service.
provider "aws" {
  region                      = var.aws_region
  profile                     = var.target == "aws" ? var.aws_profile : null
  skip_credentials_validation = var.target != "aws"
  skip_requesting_account_id  = var.target != "aws"
  skip_metadata_api_check     = var.target != "aws"
  access_key                  = var.target == "aws" ? null : "local"
  secret_key                  = var.target == "aws" ? null : "local"
}

provider "kind" {}

# One provider block for every target. Local and AWS values are unknown until
# the cluster exists, so the app resources wait and a single apply can create
# the cluster and install Comforce. An existing cluster uses kubeconfig only.
provider "kubernetes" {
  host                   = local.k8s_host
  cluster_ca_certificate = local.k8s_ca
  client_certificate     = local.k8s_client_cert
  client_key             = local.k8s_client_key
  token                  = local.k8s_token
  config_path            = local.k8s_config_path
  config_context         = local.k8s_config_context
}
