data "aws_availability_zones" "available" {
  count = var.target == "aws" ? 1 : 0

  state = "available"

  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

data "aws_eks_cluster_auth" "this" {
  count = var.target == "aws" ? 1 : 0
  name  = one(module.eks[*].cluster_name)
}

# Public subnets only. Nodes get public IPs and reach ECR through the internet
# gateway, so this stack does not create a NAT gateway.
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.16"
  count   = var.target == "aws" ? 1 : 0

  name = "${local.cluster_name}-vpc"
  cidr = "10.0.0.0/16"

  azs            = slice(data.aws_availability_zones.available[0].names, 0, 2)
  public_subnets = ["10.0.1.0/24", "10.0.2.0/24"]

  enable_nat_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true

  map_public_ip_on_launch = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }

  tags = {
    Project     = "comforce"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.36"
  count   = var.target == "aws" ? 1 : 0

  cluster_name    = local.cluster_name
  cluster_version = var.kubernetes_version

  vpc_id     = module.vpc[0].vpc_id
  subnet_ids = module.vpc[0].public_subnets

  cluster_endpoint_public_access           = true
  enable_cluster_creator_admin_permissions = true

  eks_managed_node_groups = {
    app = {
      instance_types = [var.aws_node_instance_type]
      min_size       = 1
      max_size       = 2
      desired_size   = 1
      # Public IP so the node can reach ECR and the control plane without a NAT gateway.
      network_interfaces = [{
        associate_public_ip_address = true
      }]
    }
  }

  tags = {
    Project     = "comforce"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "ebs_csi_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.47"
  count   = var.target == "aws" ? 1 : 0

  role_name             = "${local.cluster_name}-ebs-csi"
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks[0].oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }

  tags = {
    Project     = "comforce"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_eks_addon" "ebs_csi" {
  count = var.target == "aws" ? 1 : 0

  cluster_name                = module.eks[0].cluster_name
  addon_name                  = "aws-ebs-csi-driver"
  service_account_role_arn    = module.ebs_csi_irsa[0].iam_role_arn
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  depends_on = [module.eks]
}

resource "aws_ecr_repository" "api" {
  count = var.target == "aws" ? 1 : 0

  name                 = "${local.cluster_name}-api"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  tags = {
    Project     = "comforce"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_ecr_repository" "web" {
  count = var.target == "aws" ? 1 : 0

  name                 = "${local.cluster_name}-web"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  tags = {
    Project     = "comforce"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "kubernetes_storage_class_v1" "ebs" {
  count = var.target == "aws" ? 1 : 0

  metadata {
    name = "comforce-gp3"
    annotations = {
      "storageclass.kubernetes.io/is-default-class" = "true"
    }
  }

  storage_provisioner    = "ebs.csi.aws.com"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true

  parameters = {
    type      = "gp3"
    encrypted = "true"
  }

  depends_on = [aws_eks_addon.ebs_csi]
}
