variable "target" {
  description = "Where to create the cluster: local (kind), aws (EKS), or existing."
  type        = string
  default     = "local"

  validation {
    condition     = contains(["local", "aws", "existing"], var.target)
    error_message = "target must be local, aws, or existing."
  }
}

variable "cluster_name" {
  description = "Kind or EKS cluster name. Null uses comforce-qa."
  type        = string
  default     = null
}

variable "kind_kubeconfig_path" {
  description = "Kubeconfig written for the local kind cluster. Null uses ~/.kube/comforce-qa.yaml."
  type        = string
  default     = null
}

variable "kind_node_image" {
  description = "kind node image. Null lets kind pick its current default."
  type        = string
  default     = null
}

variable "aws_region" {
  description = "AWS region for the EKS cluster, VPC, and ECR repositories."
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Named AWS CLI profile. Null uses the default credential chain."
  type        = string
  default     = null
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version."
  type        = string
  default     = "1.35"
}

variable "aws_node_instance_type" {
  description = "EC2 type for the single EKS worker node."
  type        = string
  default     = "t3.medium"
}

variable "image_tag" {
  description = "Tag pushed to ECR when api_image and web_image are left unset on AWS."
  type        = string
  default     = "local"
}

variable "kubeconfig_path" {
  description = "Kubeconfig file used when target is existing."
  type        = string
  default     = null
}

variable "kubeconfig_context" {
  description = "Context name inside the kubeconfig. Leave null to use the current context."
  type        = string
  default     = null
}

variable "namespace" {
  description = "Namespace for the app. Null uses comforce-qa."
  type        = string
  default     = null
}

variable "api_image" {
  description = "FastAPI image. Null uses comforce-api:local on a laptop and the ECR repository URL on AWS."
  type        = string
  default     = null
}

variable "web_image" {
  description = "React image. Null uses comforce-web:local on a laptop and the ECR repository URL on AWS."
  type        = string
  default     = null
}

variable "image_pull_policy" {
  description = "Kubernetes image pull policy."
  type        = string
  default     = "IfNotPresent"
}

variable "api_replicas" {
  description = "Number of API pods."
  type        = number
  default     = 1
}

variable "web_replicas" {
  description = "Number of web pods."
  type        = number
  default     = 1
}

variable "db_user" {
  description = "PostgreSQL role name."
  type        = string
  default     = "comforce"
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "comforce"
}

variable "db_password" {
  description = "PostgreSQL password. Set this in terraform.tfvars, which stays out of git."
  type        = string
  sensitive   = true
  nullable    = false
}

variable "db_storage_size" {
  description = "Persistent volume size for PostgreSQL."
  type        = string
  default     = "2Gi"
}

variable "db_storage_class" {
  description = "StorageClass for Postgres. Null uses the kind default locally and comforce-gp3 on AWS."
  type        = string
  default     = null
}

variable "ingress_enabled" {
  description = "Create an Ingress for the web service."
  type        = bool
  default     = false
}

variable "ingress_class_name" {
  description = "IngressClass name."
  type        = string
  default     = "nginx"
}

variable "ingress_host" {
  description = "Hostname for the Ingress rule. Null uses comforce-qa.local."
  type        = string
  default     = null
}

variable "app_env" {
  description = "APP_ENV in the API container. Null uses qa."
  type        = string
  default     = null
}

variable "local_port" {
  description = "Host port for kubectl port-forward. Null uses 8081."
  type        = number
  default     = null
}
