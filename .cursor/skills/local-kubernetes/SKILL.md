---
name: local-kubernetes
description: >-
  Spin up ComForce on a local kind cluster. Use when the user says "baby
  deploy up dev", "baby deploy up qa", or "baby deploy up prod", or asks to
  launch, start, deploy, or spin up that environment locally on Kubernetes or
  kind, or to redeploy that local cluster after code changes. Local laptop
  only. Do not use this skill for AWS, EKS, or any cloud deploy.
---

# Local Kubernetes

The phrase names one environment. Run this skill for that environment only.

| Phrase | Environment |
| :--- | :--- |
| `baby deploy up dev` | dev |
| `baby deploy up qa` | qa |
| `baby deploy up prod` | prod |

Each environment is its own Terraform root, kind cluster, namespace, kubeconfig, and password. Applying one does not create or change the others.

| | dev | qa | prod |
| :--- | :--- | :--- | :--- |
| Directory | `deploy/terraform/envs/dev` | `deploy/terraform/envs/qa` | `deploy/terraform/envs/prod` |
| Cluster | `comforce-dev` | `comforce-qa` | `comforce-prod` |
| Namespace | `comforce-dev` | `comforce-qa` | `comforce-prod` |
| Kubeconfig | `~/.kube/comforce-dev.yaml` | `~/.kube/comforce-qa.yaml` | `~/.kube/comforce-prod.yaml` |
| Host port | 8080 | 8081 | 8082 |
| Port if that one is taken | 18080 | 18081 | 18082 |
| `environment` in `/api/health` | `development` | `qa` | `production` |
| API / web replicas | 1 / 1 | 1 / 1 | 2 / 2 |

## Ports

The browser uses one host port per environment. That port-forward lands on `svc/web` port 80. Nginx on that Service serves the React app and proxies `/api` to the API, so health is `http://127.0.0.1:<host port>/api/health`, not a separate host port.

| What | dev | qa | prod |
| :--- | :--- | :--- | :--- |
| Laptop URL | http://127.0.0.1:8080 | http://127.0.0.1:8081 | http://127.0.0.1:8082 |
| Fallback URL if that port is taken | http://127.0.0.1:18080 | http://127.0.0.1:18081 | http://127.0.0.1:18082 |
| Port-forward | `svc/web` `8080:80` | `svc/web` `8081:80` | `svc/web` `8082:80` |

Inside every namespace the Service ports are the same:

| Service | Port | Where it is |
| :--- | :--- | :--- |
| `web` | 80 | nginx. The only Service you forward to the laptop. |
| `api` | 8000 | FastAPI. Reached from nginx as `http://api:8000`. Not published on the laptop. |
| `db` | 5432 | Postgres. Headless Service. The API uses `db:5432`. Not published on the laptop. |

Docker Compose is a different stack and can stay running. It publishes web on `localhost:3000`, the API on `localhost:8000`, and Postgres on `localhost:5432`. Do not bind the kind port-forward to 3000, 8000, or 5432, and do not treat those Compose ports as the Kubernetes app.

Human steps and the cloud write-up are in [deploy/KUBERNETES.md](../../../deploy/KUBERNETES.md). This skill does not change application code and does not set `target` to `aws`.

Stay on this laptop. Do not push images, state, or secrets to a registry or cluster you did not create here. Do not apply a directory the phrase did not name.

Run Docker, kind, kubectl, and Terraform outside the sandbox. The Docker socket and `~/.kube` are not visible inside it.

Below, `<env>` is `dev`, `qa`, or `prod`.

## Outcome

- Cluster `comforce-<env>` is Ready.
- Namespace `comforce-<env>` has `db-0` plus every `api` and `web` replica Running.
- `GET /api/health` through the web Service returns `"database": "up"` and the `environment` value from the table.
- The web Service is forwarded to the host port in the table. If that port is already listening, use the fallback port and say so.

If that cluster and those checks already pass, do not destroy or recreate it. Report the URL. Leave the other two environments alone.

## 1. Tools

Need `docker info` (no sudo), `kind version`, `kubectl version --client`, and Terraform 1.5 or newer. If `kind` or `kubectl` is missing, install the Linux amd64 binary into `~/.local/bin` (kind v0.33.0 from https://kind.sigs.k8s.io/dl/v0.33.0/kind-linux-amd64, kubectl from the stable release URL) and `chmod +x`. If Terraform is missing, stop and say so. If `docker info` fails, stop. Do not install Docker or change group membership.

## 2. Images

From the repository root, before any apply that loads images:

```bash
docker build -f deploy/docker/Dockerfile.api -t comforce-api:local .
docker build -f deploy/docker/Dockerfile.web -t comforce-web:local .
```

Skip the rebuild when the user asked only to start an existing cluster and the tags `comforce-api:local` and `comforce-web:local` already exist. The same tags are loaded into whichever cluster you apply. Rebuild both tags after source changes, then apply and roll out (section 6).

## 3. Terraform vars

Work in `deploy/terraform/envs/<env>`.

- If `terraform.tfvars` is missing, copy `terraform.tfvars.example` and set `db_password` to at least 8 characters from `[A-Za-z0-9_-]`. Leave `target = "local"`.
- The password must differ from the password in the other environments' `terraform.tfvars`. Do not copy another environment's tfvars file.
- If `terraform.tfvars` exists, keep its password. Do not rotate it.
- Do not commit `terraform.tfvars` or `terraform.tfstate`. Do not print the password.

## 4. Apply

```bash
cd deploy/terraform/envs/<env>
terraform init
terraform apply -auto-approve
```

Apply creates the kind cluster when it is absent, writes `~/.kube/comforce-<env>.yaml`, loads `comforce-api:local` and `comforce-web:local` into that node, and installs Postgres, the API, and the web app. The first apply takes a few minutes. Let it finish.

`kind get clusters` should list `comforce-<env>`. A missing cluster with existing state means the node was removed. Run apply again. Do not `terraform destroy` to recover.

## 5. Check and open

```bash
export KUBECONFIG=$HOME/.kube/comforce-<env>.yaml
kubectl -n comforce-<env> get pods
```

Wait until `db-0` and every `api` and `web` pod are Running and Ready. Postgres can stay `ContainerCreating` while the volume attaches. The API can log name-resolution errors until `db` is up. Those clear on their own. Prod sets `APP_ENV=production`, so the API process exits if the database is down at startup and Kubernetes restarts it. Wait for `db-0` Ready before treating those restarts as a failure.

Confirm:

```bash
kubectl -n comforce-<env> exec deploy/api -- python -c 'import urllib.request; print(urllib.request.urlopen("http://127.0.0.1:8000/api/health").read().decode())'
```

Forward the web Service. Check whether `127.0.0.1` on the host port from the table is already listening before binding it. Another local program (often SearXNG) may own 8080. Use that row's fallback port in that case.

```bash
kubectl -n comforce-<env> port-forward --address 127.0.0.1 svc/web <port>:80
```

Leave the forward running. Then request `http://127.0.0.1:<port>/` (expect HTTP 200 and a ComForce page) and `http://127.0.0.1:<port>/api/health` (expect `"database": "up"` and the `environment` value from the table).

`export KUBECONFIG=$HOME/.kube/comforce-<env>.yaml` keeps kubectl on the file Terraform writes. kind also adds a `kind-comforce-<env>` context to `~/.kube/config`.

## 6. Redeploy after code changes

Redeploy only the environment the user named. Rebuild once, then apply that directory.

```bash
docker build -f deploy/docker/Dockerfile.api -t comforce-api:local .
docker build -f deploy/docker/Dockerfile.web -t comforce-web:local .
cd deploy/terraform/envs/<env>
terraform apply -auto-approve
export KUBECONFIG=$HOME/.kube/comforce-<env>.yaml
kubectl -n comforce-<env> rollout restart deployment/api deployment/web
kubectl -n comforce-<env> rollout status deployment/api
kubectl -n comforce-<env> rollout status deployment/web
```

`:local` is not pulled from a registry. Apply loads the new tags into that cluster. The rollout makes the pods use them. A cluster you did not apply still has the previous image until you apply that environment too.

## When a pod stays unhealthy

```bash
export KUBECONFIG=$HOME/.kube/comforce-<env>.yaml
kubectl -n comforce-<env> describe pod -l app=db
kubectl -n comforce-<env> describe pvc
kubectl -n comforce-<env> logs deploy/api --tail=50
kubectl -n comforce-<env> logs statefulset/db --tail=50
```

- **ImagePullBackOff** means the image was not built before apply. Build it, apply again, then roll out.
- **Pending PVC** means the volume is still attaching. Wait, then describe the PVC again.
- **CrashLoopBackOff** on `api` with a database error means Postgres is not ready yet. Read the logs above. Dev and qa keep the API process up and report the database as down until Postgres accepts connections. Prod exits until Postgres accepts connections.

Do not destroy the cluster to fix a pending pod.

## Tell the user

State the phrase you ran, the cluster name, namespace, kubeconfig path, pod status, the localhost URL, and the health payload. If the preferred port was busy, name the port you used. Do not include the database password.
