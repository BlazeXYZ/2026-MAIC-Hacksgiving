resource "kubernetes_namespace_v1" "app" {
  metadata {
    name = var.namespace
    labels = {
      "app.kubernetes.io/part-of" = "comforce"
    }
  }

  depends_on = [
    kind_cluster.local,
    module.eks,
    aws_eks_addon.ebs_csi,
  ]
}

resource "kubernetes_secret_v1" "db" {
  metadata {
    name      = "db"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }

  data = {
    POSTGRES_USER     = var.db_user
    POSTGRES_PASSWORD = var.db_password
    POSTGRES_DB       = var.db_name
    DATABASE_URL      = "postgresql+psycopg://${var.db_user}:${var.db_password}@db:5432/${var.db_name}"
  }
}
