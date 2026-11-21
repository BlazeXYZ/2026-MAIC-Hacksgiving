resource "kubernetes_ingress_v1" "web" {
  count = var.ingress_enabled ? 1 : 0

  metadata {
    name      = "web"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }

  spec {
    ingress_class_name = var.ingress_class_name

    rule {
      host = local.ingress_host

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service_v1.web.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }
}
