# Deploy

The same three processes run everywhere: PostgreSQL (`db`), FastAPI (`api`), and the React app behind nginx (`web`). Nginx sends `/api` to the API, so the browser uses one origin.

| Where | How |
| :--- | :--- |
| Laptop, containers only | Docker Compose |
| Dev, qa, or prod on a laptop | That environment's Terraform root, with `target = "local"` |
| Dev, qa, or prod on AWS | The same root, with `target = "aws"` |

Dev, qa, and prod are separate Terraform roots. Each has its own state, kind or EKS cluster, and namespace. Applying dev does not create qa or prod. A cluster you already have still works with `target = "existing"`. The step-by-step is [KUBERNETES.md](KUBERNETES.md).

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

Follow [KUBERNETES.md](KUBERNETES.md). Short version for the dev laptop cluster, from the repository root:

```bash
docker build -f deploy/docker/Dockerfile.api -t comforce-api:local .
docker build -f deploy/docker/Dockerfile.web -t comforce-web:local .
cd deploy/terraform/envs/dev
cp terraform.tfvars.example terraform.tfvars
# Set db_password. Leave target = "local".
terraform init
terraform apply
export KUBECONFIG=$HOME/.kube/comforce-dev.yaml
kubectl -n comforce-dev port-forward svc/web 8080:80
```

Open http://localhost:8080. QA is `deploy/terraform/envs/qa` (port 8081). Prod is `deploy/terraform/envs/prod` (port 8082). For AWS, set `target = "aws"` in the tfvars of the one environment you are deploying, using an account you choose. Read the cost note in the guide before that apply, and run `terraform destroy` in that same directory when you are finished.

The API talks to Postgres at `db:5432` inside the namespace. A StatefulSet keeps the database on a persistent volume.
