# Kubernetes: dev, qa, and prod

`deploy/terraform/modules/stack` is the cluster and the app. Dev, qa, and prod each have their own root under `deploy/terraform/envs/`. Each root has its own state, so applying one environment does not create or change the others.

| | dev | qa | prod |
| :--- | :--- | :--- | :--- |
| Directory | `deploy/terraform/envs/dev` | `deploy/terraform/envs/qa` | `deploy/terraform/envs/prod` |
| Cluster | `comforce-dev` | `comforce-qa` | `comforce-prod` |
| Namespace | `comforce-dev` | `comforce-qa` | `comforce-prod` |
| Kubeconfig | `~/.kube/comforce-dev.yaml` | `~/.kube/comforce-qa.yaml` | `~/.kube/comforce-prod.yaml` |
| Port-forward | 8080 | 8081 | 8082 |
| API / web replicas | 1 / 1 | 1 / 1 | 2 / 2 |
| Database disk | 1Gi | 2Gi | 5Gi |
| `APP_ENV` | `development` | `qa` | `production` |

`environment` is fixed in that directory's `main.tf`. A tfvars file cannot point the dev root at prod.

`target` chooses the machines:

| `target` | What Terraform creates |
| :--- | :--- |
| `local` | A [kind](https://kind.sigs.k8s.io/) cluster on your laptop |
| `aws` | A small Amazon EKS cluster, a VPC, an EBS volume driver, and two ECR repositories |
| `existing` | Nothing for the cluster. The app installs onto a kubeconfig you already have |

All three environments default to `local`. Use `aws` only in the environment you mean, and only with an AWS account you choose for this project.

Docker Compose (`deploy/docker-compose.yml`) is a separate path and can stay running. Compose uses ports 3000, 8000, and 5432. The dev Kubernetes app is reached with a port-forward on port 8080.

## 1. Install the tools

You need these on the machine that runs Terraform.

| Tool | Used for | Check |
| :--- | :--- | :--- |
| Docker | kind, and building images | `docker info` |
| kind | `target = "local"` | `kind version` |
| kubectl | every environment | `kubectl version --client` |
| Terraform 1.5 or newer | every environment | `terraform version` |
| AWS CLI v2 | `target = "aws"` | `aws --version` |

`docker info` should succeed without sudo. On Fedora, install Docker and add your user to the `docker` group, then open a new shell.

kind, kubectl, and Terraform if the package manager does not already have them (Linux amd64):

```bash
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.33.0/kind-linux-amd64
chmod +x ./kind
sudo install ./kind /usr/local/bin/kind

curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo install ./kubectl /usr/local/bin/kubectl
```

Install Terraform from [the HashiCorp install page](https://developer.hashicorp.com/terraform/install). Install the AWS CLI from [the AWS CLI install page](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) when you are deploying to AWS.

## 2. Build the images

From the repository root:

```bash
docker build -f deploy/docker/Dockerfile.api -t comforce-api:local .
docker build -f deploy/docker/Dockerfile.web -t comforce-web:local .
```

On a laptop cluster, Terraform loads these two tags into kind during apply. On AWS, the same tags are what you push to ECR after the repositories exist.

## 3. Dev on the laptop

```bash
cd deploy/terraform/envs/dev
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`. Set `db_password` to at least 8 characters using letters, numbers, `_`, or `-`. Leave `target = "local"`.

`terraform.tfvars` and `terraform.tfstate` stay off git. The state file holds the database password and cluster credentials. Use a different password in qa and prod.

```bash
cd deploy/terraform/envs/dev
terraform init
terraform apply
```

`terraform init` downloads the providers once. `terraform apply` creates a one-node kind cluster named `comforce-dev`, writes `~/.kube/comforce-dev.yaml`, loads the two local images, and installs Postgres, the API, and the web app into the `comforce-dev` namespace. The first apply usually takes a few minutes. Let it finish.

Point kubectl at that file and wait until the three pods are `Running`:

```bash
export KUBECONFIG=$HOME/.kube/comforce-dev.yaml
kubectl -n comforce-dev get pods
```

Postgres can sit on `ContainerCreating` for a minute while the volume comes up. When `api` and `web` are `Running`:

```bash
kubectl -n comforce-dev port-forward svc/web 8080:80
```

Open http://localhost:8080. The API readiness payload is `GET /api/health` and should report `"database": "up"` and `"environment": "development"`.

kind also adds a context named `kind-comforce-dev` to `~/.kube/config`. `export KUBECONFIG=...` keeps kubectl on the file Terraform manages.

Apply again after code changes:

```bash
docker build -f deploy/docker/Dockerfile.api -t comforce-api:local .
docker build -f deploy/docker/Dockerfile.web -t comforce-web:local .
cd deploy/terraform/envs/dev
terraform apply
kubectl -n comforce-dev rollout restart deployment/api deployment/web
```

`terraform apply` loads the new images. The rollout makes the pods pick them up. `:local` tags are not pulled from a registry.

Remove the dev cluster when you are done. This deletes the dev kind nodes and the dev database volume. It does not touch qa or prod:

```bash
cd deploy/terraform/envs/dev
terraform destroy
```

## 4. QA and prod

QA and prod use the same commands in their own directories. They default to a local kind cluster with the names in the table above. Apply one only when you mean to create that cluster.

```bash
cd deploy/terraform/envs/qa
cp terraform.tfvars.example terraform.tfvars
# Set a password that is not the dev password. Leave target = "local".
terraform init
terraform apply
export KUBECONFIG=$HOME/.kube/comforce-qa.yaml
kubectl -n comforce-qa port-forward svc/web 8081:80
```

Prod is the same path under `deploy/terraform/envs/prod`, with kubeconfig `~/.kube/comforce-prod.yaml`, namespace `comforce-prod`, and port 8082. Prod runs two API replicas and two web replicas, and the API's `APP_ENV` is `production`.

## 5. AWS

EKS bills until the cluster is deleted. A new cluster is about **$0.10 per hour** for the control plane plus one `t3.medium` worker (about **$0.04 per hour** in `us-east-1`), so a cluster left up is on the order of **$3 to $4 per day**. This configuration uses public subnets and does not create a NAT gateway. Run `terraform destroy` in that environment's directory at the end of the day and confirm in the AWS console that the EKS cluster is gone.

Set `target = "aws"` in the tfvars of the one environment you are putting on AWS. Dev can stay on the laptop while prod uses AWS, because they do not share state. Use an account, region, and profile you choose for this project.

Use a Kubernetes version still in standard support. Extended support is several times the hourly control-plane rate. Before apply:

```bash
aws eks describe-cluster-versions \
  --query 'clusterVersions[?defaultVersion==`true`].clusterVersion' \
  --output text
```

If that prints a version other than `1.35`, set `kubernetes_version` in that environment's `terraform.tfvars` to a version from the list.

### 5.1 Credentials

```bash
aws configure
aws sts get-caller-identity
```

Use an IAM user or role that can create EKS, VPC, IAM roles, and ECR. `aws_profile` in tfvars selects a named profile. Leave it unset to use the default credential chain.

### 5.2 Create the cluster and install the app

From the environment directory, for example prod:

```bash
cd deploy/terraform/envs/prod
terraform init
terraform apply
```

Apply creates the VPC, the EKS control plane, one worker node, the EBS CSI driver (so Postgres gets a disk), two ECR repositories, and the app manifests. The control plane alone often takes 10 to 15 minutes. Leave the apply running.

The pods will show `ImagePullBackOff` or `ErrImagePull` until you push the images. The repository URLs do not exist until this apply finishes, so the push is the next step.

### 5.3 Push the images

From the repository root, after apply, run the output commands in the same environment directory:

```bash
cd deploy/terraform/envs/prod
REGISTRY=$(terraform output -raw ecr_registry)
API_IMAGE=$(terraform output -raw api_image)
WEB_IMAGE=$(terraform output -raw web_image)
REGION=$(terraform output -raw aws_region)

aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

docker tag comforce-api:local "$API_IMAGE"
docker tag comforce-web:local "$WEB_IMAGE"
docker push "$API_IMAGE"
docker push "$WEB_IMAGE"
```

The worker node role can pull from ECR in the same account. Restart the deployments so they pull the tag you just pushed:

```bash
aws eks update-kubeconfig \
  --name "$(terraform output -raw cluster_name)" \
  --region "$(terraform output -raw aws_region)"
kubectl -n comforce-prod rollout restart deployment/api deployment/web
kubectl -n comforce-prod get pods
```

Use `comforce-qa` as the namespace when the directory you applied was qa.

### 5.4 Open the app

```bash
kubectl -n comforce-prod port-forward svc/web 8082:80
```

Open http://localhost:8082.

### 5.5 Shut it down

```bash
cd deploy/terraform/envs/prod
terraform destroy
```

`force_delete` is set on the ECR repositories so destroy removes them even after you have pushed images. Then check the EKS and EC2 consoles. The cluster and the worker node should be gone. EBS volumes created for Postgres are deleted with the PVC when destroy removes the StatefulSet. Destroy in this directory leaves the other environments in place.

## 6. A cluster you already have

In that environment's `terraform.tfvars`:

```hcl
target          = "existing"
kubeconfig_path = "~/.kube/config"
db_password     = "replace-with-a-real-password"
api_image       = "ghcr.io/your-org/comforce-api:latest"
web_image       = "ghcr.io/your-org/comforce-web:latest"
```

`kubeconfig_context` selects a context inside that file. Leave it unset to use the current context. The cluster has to pull `api_image` and `web_image` itself. kind load and ECR are skipped for this target.

Set `namespace` if that cluster already has another environment installed and you need a different name than `comforce-<environment>`. Set `db_storage_class` if the cluster's default StorageClass is not the one you want. Set `ingress_enabled = true` and `ingress_host` when an ingress controller is already installed. The class name defaults to `nginx`.

## 7. What to check when a pod stays pending

```bash
export KUBECONFIG=$HOME/.kube/comforce-dev.yaml
kubectl -n comforce-dev get pods
kubectl -n comforce-dev describe pod -l app=db
kubectl -n comforce-dev describe pvc
```

- **ImagePullBackOff** on AWS means the push in step 5.3 has not happened yet, or the tag does not match `terraform output -raw api_image`.
- **ImagePullBackOff** on a laptop means the image was not built before apply. Build it, run `terraform apply` again, then `kubectl rollout restart`.
- **Pending PVC** on AWS means the EBS addon is still starting. Wait a minute and describe the PVC again. The StorageClass name is `comforce-gp3`.
- **CrashLoopBackOff** on `api` with a database error means Postgres is not ready yet. `kubectl logs statefulset/db` shows the database, and `kubectl logs deploy/api` shows the API. In prod, `APP_ENV=production` makes the API exit if the database is down at startup. Dev keeps the process up and reports the database as down.
