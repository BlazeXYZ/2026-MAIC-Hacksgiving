# Kubernetes: laptop or AWS, one Terraform

`deploy/terraform` creates the cluster and installs the same app on it. PostgreSQL, the FastAPI API, and the React app are the resources in `postgres.tf`, `api.tf`, and `web.tf`. The cluster around them changes with one variable:

| `target` | What Terraform creates |
| :--- | :--- |
| `local` | A [kind](https://kind.sigs.k8s.io/) cluster on your laptop (Kubernetes inside Docker) |
| `aws` | A small Amazon EKS cluster, a VPC, an EBS volume driver, and two ECR repositories |
| `existing` | Nothing for the cluster. The app installs onto a kubeconfig you already have |

One state file tracks one cluster. Destroy the current cluster before you change `target`.

Docker Compose (`deploy/docker-compose.yml`) is a separate path and can stay running. Compose uses ports 3000, 8000, and 5432. The Kubernetes app is reached with a port-forward on port 8080.

## 1. Install the tools

You need these on the machine that runs Terraform.

| Tool | Used for | Check |
| :--- | :--- | :--- |
| Docker | kind, and building images | `docker info` |
| kind | `target = "local"` | `kind version` |
| kubectl | both targets | `kubectl version --client` |
| Terraform 1.5 or newer | both targets | `terraform version` |
| AWS CLI v2 | `target = "aws"` | `aws --version` |

`docker info` should succeed without sudo. On Fedora, install Docker and add your user to the `docker` group, then open a new shell.

kind, kubectl, and Terraform if the package manager does not already have them (Linux amd64):

```bash
curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
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

## 3. Choose a target

```bash
cd deploy/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`. Set `db_password` to at least 8 characters using letters, numbers, `_`, or `-`. Leave `target = "local"` for a laptop cluster, or follow the AWS section below.

`terraform.tfvars` and `terraform.tfstate` stay off git. The state file holds the database password and cluster credentials.

## 4. Local cluster

```bash
cd deploy/terraform
terraform init
terraform apply
```

`terraform init` downloads the providers once. `terraform apply` creates a one-node kind cluster, writes `~/.kube/comforce-kind.yaml`, loads the two local images, and installs Postgres, the API, and the web app. The first apply usually takes a few minutes. Let it finish.

Point kubectl at that file and wait until the three pods are `Running`:

```bash
export KUBECONFIG=$HOME/.kube/comforce-kind.yaml
kubectl -n comforce get pods
```

Postgres can sit on `ContainerCreating` for a minute while the volume comes up. When `api` and `web` are `Running`:

```bash
kubectl -n comforce port-forward svc/web 8080:80
```

Open http://localhost:8080. The header should read `API healthy · database up`.

kind also adds a context named `kind-comforce` to `~/.kube/config`. `export KUBECONFIG=...` keeps kubectl on the file Terraform manages.

Apply again after code changes:

```bash
docker build -f deploy/docker/Dockerfile.api -t comforce-api:local .
docker build -f deploy/docker/Dockerfile.web -t comforce-web:local .
cd deploy/terraform
terraform apply
kubectl -n comforce rollout restart deployment/api deployment/web
```

`terraform apply` loads the new images. The rollout makes the pods pick them up. `:local` tags are not pulled from a registry.

Remove the cluster when you are done. This deletes the kind nodes and the database volume on your laptop:

```bash
cd deploy/terraform
terraform destroy
```

## 5. AWS cluster

EKS bills until the cluster is deleted. A new cluster is about **$0.10 per hour** for the control plane plus one `t3.medium` worker (about **$0.04 per hour** in `us-east-1`), so a cluster left up is on the order of **$3 to $4 per day**. This configuration uses public subnets and does not create a NAT gateway. Run `terraform destroy` at the end of the day and confirm in the AWS console that the EKS cluster is gone.

Use a Kubernetes version still in standard support. Extended support is several times the hourly control-plane rate. Before apply:

```bash
aws eks describe-cluster-versions \
  --query 'clusterVersions[?defaultVersion==`true`].clusterVersion' \
  --output text
```

If that prints a version other than `1.35`, set `kubernetes_version` in `terraform.tfvars` to a version from the list. The EKS console shows the same list under Kubernetes version when you start creating a cluster.

### 5.1 Credentials

```bash
aws configure
aws sts get-caller-identity
```

Use an IAM user or role that can create EKS, VPC, IAM roles, and ECR. `aws_profile` in tfvars selects a named profile. Leave it unset to use the default credential chain.

### 5.2 Variables

In `deploy/terraform/terraform.tfvars`:

```hcl
target                 = "aws"
aws_region             = "us-east-1"
kubernetes_version     = "1.35"
aws_node_instance_type = "t3.medium"
db_password            = "replace-with-a-real-password"
```

Destroy a local cluster from this same directory before the first AWS apply, if you already created one. The state file can track one target at a time.

### 5.3 Create the cluster and install the app

```bash
cd deploy/terraform
terraform init
terraform apply
```

Apply creates the VPC, the EKS control plane, one worker node, the EBS CSI driver (so Postgres gets a disk), two ECR repositories, and the app manifests. The control plane alone often takes 10 to 15 minutes. Leave the apply running.

The pods will show `ImagePullBackOff` or `ErrImagePull` until you push the images. The repository URLs do not exist until this apply finishes, so the push is the next step.

### 5.4 Push the images

From the repository root, after apply:

```bash
cd deploy/terraform
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
kubectl -n comforce rollout restart deployment/api deployment/web
kubectl -n comforce get pods
```

### 5.5 Open the app

```bash
kubectl -n comforce port-forward svc/web 8080:80
```

Open http://localhost:8080. The header should read `API healthy · database up`.

### 5.6 Shut it down

```bash
cd deploy/terraform
terraform destroy
```

`force_delete` is set on the ECR repositories so destroy removes them even after you have pushed images. Then check the EKS and EC2 consoles. The cluster and the worker node should be gone. EBS volumes created for Postgres are deleted with the PVC when destroy removes the StatefulSet.

## 6. A cluster you already have

```hcl
target          = "existing"
kubeconfig_path = "~/.kube/config"
db_password     = "replace-with-a-real-password"
api_image       = "ghcr.io/your-org/comforce-api:latest"
web_image       = "ghcr.io/your-org/comforce-web:latest"
```

`kubeconfig_context` selects a context inside that file. Leave it unset to use the current context. The cluster has to pull `api_image` and `web_image` itself. kind load and ECR are skipped for this target.

```bash
cd deploy/terraform
terraform init
terraform apply
kubectl -n comforce port-forward svc/web 8080:80
```

Set `db_storage_class` if the cluster's default StorageClass is not the one you want. Set `ingress_enabled = true` and `ingress_host` when an ingress controller is already installed. The class name defaults to `nginx`.

## 7. What to check when a pod stays pending

```bash
kubectl -n comforce get pods
kubectl -n comforce describe pod -l app=db
kubectl -n comforce describe pvc
```

- **ImagePullBackOff** on AWS means the push in step 5.4 has not happened yet, or the tag does not match `terraform output -raw api_image`.
- **ImagePullBackOff** on a laptop means the image was not built before apply. Build it, run `terraform apply` again, then `kubectl rollout restart`.
- **Pending PVC** on AWS means the EBS addon is still starting. Wait a minute and describe the PVC again. The StorageClass name is `comforce-gp3`.
- **CrashLoopBackOff** on `api` with a database error means Postgres is not ready yet. `kubectl -n comforce logs statefulset/db` shows the database, and `kubectl -n comforce logs deploy/api` shows the API.

## 8. Switching between local and AWS

```bash
cd deploy/terraform
terraform destroy
```

Edit `target` in `terraform.tfvars`, then `terraform apply`. Destroy finishes the old cluster first, so a laptop apply and an AWS apply do not share one state.
