resource "kubernetes_service_v1" "db" {
  metadata {
    name      = "db"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
    labels = {
      app = "db"
    }
  }

  spec {
    cluster_ip = "None"
    selector = {
      app = "db"
    }
    port {
      name        = "postgres"
      port        = 5432
      target_port = 5432
    }
  }
}

resource "kubernetes_stateful_set_v1" "db" {
  depends_on = [kubernetes_storage_class_v1.ebs]

  metadata {
    name      = "db"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
    labels = {
      app = "db"
    }
  }

  spec {
    service_name = kubernetes_service_v1.db.metadata[0].name
    replicas     = 1

    selector {
      match_labels = {
        app = "db"
      }
    }

    template {
      metadata {
        labels = {
          app = "db"
        }
      }

      spec {
        security_context {
          fs_group = 999
        }

        container {
          name  = "postgres"
          image = "postgres:16-alpine"

          port {
            container_port = 5432
            name           = "postgres"
          }

          env {
            name = "POSTGRES_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.db.metadata[0].name
                key  = "POSTGRES_USER"
              }
            }
          }

          env {
            name = "POSTGRES_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.db.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          env {
            name = "POSTGRES_DB"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.db.metadata[0].name
                key  = "POSTGRES_DB"
              }
            }
          }

          # A subdirectory avoids the "directory not empty" startup error on a fresh volume.
          env {
            name  = "PGDATA"
            value = "/var/lib/postgresql/data/pgdata"
          }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/postgresql/data"
          }

          readiness_probe {
            exec {
              command = ["pg_isready", "-U", var.db_user, "-d", var.db_name]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 5
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              memory = "512Mi"
            }
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name = "data"
      }

      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = local.db_storage_class

        resources {
          requests = {
            storage = var.db_storage_size
          }
        }
      }
    }
  }
}
