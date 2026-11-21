resource "terraform_data" "kube_dir" {
  count = var.target == "local" ? 1 : 0

  provisioner "local-exec" {
    command = "mkdir -p \"${dirname(local.kind_kubeconfig)}\""
  }
}

resource "kind_cluster" "local" {
  count = var.target == "local" ? 1 : 0

  name            = local.cluster_name
  node_image      = var.kind_node_image
  wait_for_ready  = true
  kubeconfig_path = local.kind_kubeconfig

  depends_on = [terraform_data.kube_dir]

  timeouts {
    create = "10m"
    delete = "5m"
  }
}

# kind cannot see images that only exist in the laptop's Docker daemon.
# Build comforce-api:local and comforce-web:local before apply.
resource "kind_load" "images" {
  for_each = var.target == "local" ? toset([local.api_image, local.web_image]) : toset([])

  cluster_name = local.cluster_name
  image        = each.value

  depends_on = [kind_cluster.local]
}
