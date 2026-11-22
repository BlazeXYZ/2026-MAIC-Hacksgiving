# Infrastructure situation

Snapshot from the hackathon laptop on 21 November 2026. This is what is actually running, and what the phrase `baby deploy up dev` does.

The click-by-click Kubernetes guide is [deploy/KUBERNETES.md](../deploy/KUBERNETES.md). The phrase itself is defined for agents in [.cursor/skills/local-kubernetes/SKILL.md](../.cursor/skills/local-kubernetes/SKILL.md).

## Cloud

No cloud account is in use.

- The AWS CLI is not installed on this laptop.
- Terraform state is a local file in each environment directory (`backend "local"`). Those files are gitignored. There is no remote state bucket and no shared cloud account in the repo.
- Only `deploy/terraform/envs/dev` has been applied. Its state records `target = "local"`, cluster `comforce-dev`, images `comforce-api:local` and `comforce-web:local`.
- `deploy/terraform/envs/qa` and `deploy/terraform/envs/prod` have no state file on this machine, and kind has no `comforce-qa` or `comforce-prod` cluster.
- Ingress is off. There is no public hostname, load balancer, or DNS record for the app.

`deploy/terraform/modules/stack/cluster_aws.tf` can create cloud resources when an environment's `terraform.tfvars` sets `target = "aws"`. Every environment defaults to `target = "local"`. That AWS apply has not been run, so there is no VPC, EKS cluster, EBS volume, or ECR repository from this repo. The production section of the root README and section 5 of [deploy/KUBERNETES.md](../deploy/KUBERNETES.md) describe that future apply, including the cost of leaving an EKS control plane and one worker up (about $3 to $4 per day). They describe a procedure, and that procedure has not been used.

`target = "existing"` would install the same app onto a kubeconfig you already have. That target is unused too.

## What the Terraform can create

Dev, qa, and prod are three roots. Each has its own state, so applying one does not create the others.

| | dev | qa | prod |
| :--- | :--- | :--- | :--- |
| Directory | `deploy/terraform/envs/dev` | `deploy/terraform/envs/qa` | `deploy/terraform/envs/prod` |
| Cluster and namespace | `comforce-dev` | `comforce-qa` | `comforce-prod` |
| Kubeconfig, local target | `~/.kube/comforce-dev.yaml` | `~/.kube/comforce-qa.yaml` | `~/.kube/comforce-prod.yaml` |
| Host port for `svc/web` | 8080, or 18080 if 8080 is taken | 8081, or 18081 | 8082, or 18082 |
| API / web replicas | 1 / 1 | 1 / 1 | 2 / 2 |
| Database disk | 1Gi | 2Gi | 5Gi |
| `APP_ENV` | `development` | `qa` | `production` |

| `target` | What an apply creates |
| :--- | :--- |
| `local` | A one-node [kind](https://kind.sigs.k8s.io/) cluster on the laptop, then Postgres, the API, and nginx in that cluster's namespace |
| `aws` | A VPC with public subnets and no NAT gateway, an EKS cluster, one `t3.medium` worker, the EBS CSI driver, StorageClass `comforce-gp3`, two ECR repositories, then the same app |
| `existing` | No cluster. The app installs onto `kubeconfig_path` |

On `local`, the images stay on the laptop. Apply loads `comforce-api:local` and `comforce-web:local` into the kind node. Nothing is pushed to a registry.

Inside every namespace the Service ports are the same: `web` on 80 (nginx), `api` on 8000, `db` on 5432. Nginx is the only Service forwarded to the laptop. It serves the built React app and proxies `/api` to `http://api:8000`.

## What is running on this laptop

| Piece | State on 21 November 2026 |
| :--- | :--- |
| kind cluster `comforce-dev` | Up. Namespace `comforce-dev` has `db-0`, `api`, and `web` Running. Image `comforce-api:local`, `APP_ENV=development`. |
| Kubeconfig | `~/.kube/comforce-dev.yaml` |
| Kind web URL | `http://127.0.0.1:18080/`. Port 8080 is already taken by another local program, so the forward is the fallback. `GET /` returns the ComForce page. |
| Vite | Listening on `0.0.0.0:3000`. `http://127.0.0.1:3000/` returns HTTP 200. |
| Host API | `src/server/main.py` is listening on `0.0.0.0:8000`. `GET /` returns `"environment": "development"` and `"database": "connected"`. |
| qa and prod | Not created. |
| AWS | Not created. |

Two APIs are up, and they are not the same process.

The kind API is the older `comforce-api:local` image. Inside that pod, `GET /` returns `"status": "healthy"` and `"environment": "development"`, and it does not report a database field. `GET /api/health`, `/healthz`, and `/ready` on that image return 404. Through nginx, `http://127.0.0.1:18080/api/health` is the same 404.

The process on port 8000 is the current working tree. It implements `GET /healthz`, `GET /ready`, and the `/api/...` copies of those paths. Vite's `/api` proxy points at this process (`http://localhost:8000` in `src/client/vite.config.ts`), so a phone that opens the Vite port is talking to the host API, while a browser on port 18080 is talking to the kind stack.

The agent skill still checks `GET /api/health` and expects `"database": "up"`. The current server does not serve that path. Readiness on the current tree is `GET /api/ready` (`"database": "connected"`) and liveness is `GET /api/healthz`.

## What `baby deploy up dev` does

The phrase is local. It brings up the **dev** kind cluster and the Vite client on this computer. It does not set `target` to `aws`, and it does not create qa or prod.

`baby deploy up qa` and `baby deploy up prod` are the same skill pointed at the other two roots. Those phrases were not part of this snapshot. Those clusters are absent.

When someone says `baby deploy up dev`, the work is:

1. Use Docker, kind, kubectl, and Terraform 1.5 or newer. Stop if Docker or Terraform is missing. Do not install Docker.
2. From the repository root, build `comforce-api:local` and `comforce-web:local` with `deploy/docker/Dockerfile.api` and `deploy/docker/Dockerfile.web` when the tags are missing or the source changed. Skip that rebuild when the ask is only to start a cluster that already has both tags.
3. Work in `deploy/terraform/envs/dev`. If `terraform.tfvars` is missing, copy `terraform.tfvars.example`, set `db_password` to at least 8 characters from `[A-Za-z0-9_-]`, and leave `target = "local"`. If the file already exists, keep its password. Do not print the password, and do not commit `terraform.tfvars` or `terraform.tfstate`.
4. Run `terraform init` and `terraform apply -auto-approve`. Apply creates kind cluster `comforce-dev` when it is absent, writes `~/.kube/comforce-dev.yaml`, loads the two local images into that node, and installs Postgres, the API, and the web app in namespace `comforce-dev`.
5. Wait until `db-0` and every API and web pod are Running. Postgres can sit on `ContainerCreating` while its volume attaches.
6. Forward `svc/web` to `127.0.0.1:8080`. If that port is already listening, use `18080`. Leave the forward running. The page is `http://127.0.0.1:<port>/`.
7. Start the Vite dev client from `src/client` on `0.0.0.0:3000` when it is not already listening on all interfaces (`npm run dev -- --port 3000 --strictPort`). Leave it running. `http://127.0.0.1:3000/` should return HTTP 200. When Tailscale has an IPv4 address, the phone uses `http://<that-address>:3000/`.

If the cluster is already up and the pods are Ready, the phrase does not destroy or recreate it. It still starts Vite when port 3000 is not listening on all interfaces.

After application source changes, the same phrase rebuilds both images, applies the dev root again, and restarts `deployment/api` and `deployment/web`. A client-only change is served by Vite and does not need an image rebuild. `:local` is not pulled from a registry. A cluster you did not apply still has its previous image.

Docker Compose is a separate stack (host ports 3000, 8000, and 5432). The phrase does not start Compose. If Compose is already publishing port 3000, that publish has to stop before Vite binds the port.

## What the phrase leaves alone

- qa and prod directories, clusters, and passwords
- AWS, ECR, and any registry
- application source
- a cluster that is already healthy (no `terraform destroy` to "refresh" it)
