# Deploy

The same three processes run everywhere: PostgreSQL (`db`), FastAPI (`api`), and the React app behind nginx (`web`). Nginx sends `/api` to the API, so the browser uses one origin.

| Where | How |
| :--- | :--- |
| Laptop, containers only | Docker Compose |
| Laptop Kubernetes, or AWS | The same Terraform. Set `target` to `local` or `aws` |

Terraform creates a kind cluster on the laptop or an EKS cluster on AWS, then installs this app onto it. A cluster you already have still works with `target = "existing"`. The step-by-step is [KUBERNETES.md](KUBERNETES.md).

## Local Docker

From the repository root:

```bash
docker compose -f deploy/docker-compose.yml up --build
```

- Web: http://localhost:3000
- API: http://localhost:8000
- Postgres: `localhost:5432`, database `comforce`, user `comforce`, password `comforce-dev`

That password is for the local compose file only. Stop the stack with `docker compose -f deploy/docker-compose.yml down`.

The header on the web app should read `API healthy · database up`. `GET /api/services` returns the placeholder rows the API seeds on an empty database.

## Kubernetes with Terraform

Follow [KUBERNETES.md](KUBERNETES.md). Short version for a laptop cluster, from the repository root:

```bash
docker build -f deploy/docker/Dockerfile.api -t comforce-api:local .
docker build -f deploy/docker/Dockerfile.web -t comforce-web:local .
cd deploy/terraform
cp terraform.tfvars.example terraform.tfvars
# Set db_password. Leave target = "local".
terraform init
terraform apply
export KUBECONFIG=$HOME/.kube/comforce-kind.yaml
kubectl -n comforce port-forward svc/web 8080:80
```

Open http://localhost:8080. For AWS, set `target = "aws"` in the same directory. That apply creates the EKS cluster. Read the cost note in the guide before you apply, and run `terraform destroy` when you are finished.

The API talks to Postgres at `db:5432` inside the namespace. A StatefulSet keeps the database on a persistent volume.
