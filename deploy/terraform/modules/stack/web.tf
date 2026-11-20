resource "kubernetes_service_v1" "web" {
  metadata {
    name      = "web"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
    labels = {
      app = "web"
    }
  }

  spec {
    selector = {
      app = "web"
    }
    port {
      name        = "http"
      port        = 80
      target_port = 80
    }
  }
}

resource "kubernetes_deployment_v1" "web" {
  depends_on = [kind_load.images]

  metadata {
    name      = "web"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
    labels = {
      app = "web"
    }
  }

  spec {
    replicas = var.web_replicas

    selector {
      match_labels = {
        app = "web"
      }
    }

    template {
      metadata {
        labels = {
          app = "web"
        }
      }

      spec {
        container {
          name              = "web"
          image             = local.web_image
          image_pull_policy = var.image_pull_policy

          port {
            container_port = 80
            name           = "http"
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 3
            period_seconds        = 10
          }

          resources {
            requests = {
              cpu    = "50m"
              memory = "64Mi"
            }
            limits = {
              memory = "128Mi"
            }
          }
        }
      }
    }
  }
}
