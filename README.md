# 2026 MAIC Hacksgiving: AI for Good

This repository holds our team project for the **4th Annual MAIC Hacksgiving Hackathon**, hosted by the **MSOE Artificial Intelligence Club (MAIC)** at the **Milwaukee School of Engineering (MSOE)** in Dwight and Dian Diercks Hall.

Our partner for this year is **ComforceMKE** (Community Task Force MKE). As the announcement stated, "With our partner, ComforceMKE, we will be helping the Milwaukee Community in times of trouble!"

---

## Quick Links

- [Kubernetes setup](deploy/KUBERNETES.md) — dev, qa, and prod on a local kind cluster or EKS
- [Project Ideas & Brainstorming](IDEAS.md)
- [Contributing & Style Guide](CONTRIBUTING.md)
- [Project Documentation](docs/README.md)
- [Jupyter Notebooks](notebooks/README.md)

---

## Table of Contents

- [Project Overview](#project-overview)
- [The Partner & Community Mission](#the-partner--community-mission)
- [Platform Architecture](#platform-architecture)
- [Core Features & Modular Communities](#core-features--modular-communities)
- [Milwaukee Data Sources](#milwaukee-data-sources)
- [Repository Structure](#repository-structure)
- [Local Development Guide](#local-development-guide)
  - [Prerequisites](#prerequisites)
  - [Option 1: Native Process Development (Fastest Iteration)](#option-1-native-process-development-fastest-iteration)
  - [Option 2: One-Command Docker Compose](#option-2-one-command-docker-compose)
  - [Option 3: Local Kubernetes with Kind](#option-3-local-kubernetes-with-kind)
- [Posting to Production (Deployment Guide)](#posting-to-production-deployment-guide)
  - [1. AWS Cloud Deployment with EKS & Terraform (Recommended)](#1-aws-cloud-deployment-with-eks--terraform-recommended)
  - [2. Existing Kubernetes Cluster Deployment](#2-existing-kubernetes-cluster-deployment)
  - [3. Single-Node Production Deployment with Docker Compose](#3-single-node-production-deployment-with-docker-compose)
  - [4. Mobile App Production Release (Android & iOS)](#4-mobile-app-production-release-android--ios)
- [Hackathon Schedule](#hackathon-schedule)
- [Submission Checklist](#submission-checklist)
- [Team Members](#team-members)
- [Acknowledgments](#acknowledgments)

---

## Project Overview

- **Project Title:** ComForce MKE Community Hub
- **Summary:** A combined web and mobile application (exported through Capacitor) that makes connecting with ComforceMKE initiatives interactive and responsive instead of just filling out static web forms.
- **Client Stack:** React, TypeScript, Vite, Capacitor (iOS and Android export), OpenStreetMap, Tailwind CSS
- **Server Stack:** Python 3.10+, FastAPI, PostgreSQL, `uv` package manager, Uvicorn
- **Deploy:** Docker Compose locally. Terraform keeps dev, qa, and prod in separate state. Each one can run as a local Kubernetes cluster or, when you choose an account, on AWS EKS.
- **AI Models:** Transformer-based need heatmaps, small classifier for content moderation and triage, and LLM recommendations

---

## The Partner & Community Mission

ComforceMKE is a resident-led group founded in 2014 that works 24/7 on crisis response, violence interruption, missing persons searches, family grief support, and emergency food and housing across Milwaukee.

Right now, many organizations rely on static web forms that feel slow and impersonal during an emergency. Our platform brings ComforceMKE's services into an interactive, community-driven interface accessible on both desktop web browsers and mobile phones.

---

## Platform Architecture

The project lives in a single GitHub repository with separate `client` and `server` folders under `src/`:

```
[Web Browser & Capacitor Mobile Client] (src/client)
  ├── Modular Community Selector (Domestic Safety, Missing Persons, Pantries)
  ├── Urgent Priority Alert Banner (Overrides screens during critical searches)
  ├── Safe Route Planner (Routes to MSOE Public Safety or Sojourner Peace Center)
  ├── Volunteer Support Ticket Board (Claim tickets, review priority tasks)
  └── District Statistics Dashboard (Third Ward, Juneautown, Near West Side)
            │
            ▼ HTTP / REST / JSON
[FastAPI Python Backend] (src/server, managed with uv)
  ├── AI Moderation & Question Finding (Cleans messages, links to verified aid)
  ├── Smart Volunteer Dispatch (Identifies who can help without blasting spam)
  ├── Safe Path Generator (Calculates verified routes to public services)
  ├── Heatmap & Google API Ingestion (Processes location & need density)
  └── Pantry Stocking Advisor (LLM recommendations for high-need supplies)
```

---

## Core Features & Modular Communities

The platform is designed around **Modular Communities**. Every community shares core tools (threads, maps, verified posts, and volunteer tickets), but each community can enable custom tools:

### 1. Domestic Abuse Support (Initial Flagship Community)
* **Safe Walk & Routing:** If you are on the MSOE campus, it automatically plans a route along lit paths to MSOE Public Safety at 1025 N Broadway. In the city, it directs to Sojourner Family Peace Center.
* **Confidential Support Tickets:** Residents can request discrete check-ins without sharing their full contact details publicly.

### 2. Missing Persons Search Network
* **Priority Alert Override:** When an active search begins, an urgent banner appears across the app, alerting nearby volunteers regardless of which community tab they are viewing.
* **Search Grid Coordinator:** Volunteers can join search parties and mark map sectors as "searching," "cleared," or "lead found" in real time.

### 3. Food Pantry & Mutual Aid
* **Interactive Pantry Finder:** Displays open emergency pantries, mobile markets, and hours pulled from local open data.
* **Pantry Owner AI Advisor:** An LLM reviews district need patterns and recommends what high-demand items pantry coordinators should stock (such as infant formula or warm winter clothing).

### 4. Smart Volunteer Dispatch & District Dashboard
* **Targeted Notification AI:** Instead of sending annoying push notifications to hundreds of inactive volunteers, an AI filter identifies which volunteers are active and close enough to help.
* **Coordinator Dashboard:** Visualizes open aid requests by Milwaukee district (such as Juneautown versus the Third Ward) so coordinators can see where resources are needed most.

---

## Milwaukee Data Sources

Our team is reviewing real Milwaukee open data to ground the app in actual local resources:

1. **IMPACT 2-1-1 & Milwaukee Food Environment GIS:** Public ArcGIS datasets covering every emergency food pantry, meal site, and grocery access point in Milwaukee County.
2. **Hunger Task Force Site Data:** Verified locations and operating hours of emergency food sites and mobile food markets.
3. **Domestic Violence Crisis Services:** Verified coordinates and 24/7 hotline numbers for Sojourner Family Peace Center and the Milwaukee Women's Center.
4. **City of Milwaukee Open Data Portal:** Civic neighborhood boundaries (Juneautown, Historic Third Ward, Near West Side) and community centers.
5. **Google Places API:** Community points of interest, public libraries, and verified public service facilities.
6. **MSOE Campus Geography:** Campus walkways, Diercks Hall (1025 N Milwaukee St), and MSOE Public Safety (1025 N Broadway).

---

## Repository Structure

```text
2026-MAIC-Hacksgiving/
├── .github/                  # Pull request and issue templates
├── data/                     # Sample data and schemas
│   ├── raw/                  # Raw sample files (git-ignored)
│   └── processed/            # Cleaned mock data for testing
├── deploy/                   # Images and Terraform for Kubernetes
│   ├── docker/               # API and web Dockerfiles, nginx proxy
│   ├── KUBERNETES.md         # Step-by-step dev, qa, and prod on kind or EKS
│   └── terraform/            # Shared stack, with a separate root for dev, qa, and prod
├── docs/                     # Pitch notes, slides, and diagrams
├── notebooks/                # Jupyter notebooks for data tests and prompt trials
├── src/
│   ├── client/               # React + TypeScript + Vite + Capacitor app
│   │   ├── src/              # React UI components and views
│   │   ├── capacitor.config.ts  # Capacitor mobile build settings
│   │   ├── package.json      # Client dependencies
│   │   └── vite.config.ts    # Vite bundler config with API proxy
│   └── server/               # FastAPI Python backend managed with uv
│       ├── core/             # Settings and configuration
│       ├── pyproject.toml    # Modern Python dependencies for uv
│       └── main.py           # FastAPI entry point and routes
├── tests/                    # Backend unit tests
├── .env.example              # Template for API keys and environment variables
├── .gitignore                # Git ignore rules for virtualenvs, keys, and data
├── CONTRIBUTING.md           # Branch rules, commit styles, and code conventions
├── IDEAS.md                  # Project brainstorms and idea submission template
├── requirements.txt          # Python dependencies (pip fallback)
└── README.md                 # Main project guide
```

---

## Local Development Guide

### Prerequisites
* **Python 3.10+** (with [`uv`](https://github.com/astral-sh/uv) or standard `pip`)
* **Node.js 18+** (with npm)
* **Docker or Podman** (for containerized local dev or Kubernetes)
* **Git** installed and configured

---

### Option 1: Native Process Development (Fastest Iteration)

Running services directly on your host machine offers the fastest feedback loop, hot module reloading (HMR) for frontend components, and instant Python debugger attachment.

#### 1. Backend Server Setup (FastAPI + SQLite)

1. Switch to the server directory:
   ```bash
   cd src/server
   ```
2. Using `uv` (recommended):
   ```bash
   # Create and sync virtual environment
   uv venv
   uv sync

   # Run backend development server
   uv run python main.py
   ```
   *Alternative with standard pip:*
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\Activate.ps1
   pip install -r ../../requirements.txt
   python main.py
   ```
3. **Database initialization & automatic table creation:**
   The backend automatically initializes an embedded SQLite database (`sqlite:///dev.db`) on startup when `DATABASE_URL` is unset, so no external database server is required.
4. **Seed sample Milwaukee community data:**
   In another terminal, populate the local database with verified safe places, 11 emergency food pantries, and sample support tickets:
   ```bash
   uv run python -m src.server.seed
   ```
   *The API will be running at `http://localhost:8000` with interactive Swagger docs at `http://localhost:8000/docs`.*

#### 2. Frontend Client Setup (React + Vite + Capacitor)

1. In a separate terminal, switch to the client directory:
   ```bash
   cd src/client
   ```
2. Install frontend dependencies and start Vite dev server:
   ```bash
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser. API requests to `/api` are automatically proxied to the backend at `http://localhost:8000`.

#### 3. Mobile Device Sync (Capacitor)

Compile the web assets and synchronize with native mobile wrappers:
```bash
cd src/client
npm run build
npx cap sync
```
To launch in native emulators:
```bash
npm run cap:android  # Opens Android Studio
npm run cap:ios      # Opens Xcode (macOS only)
```

---

### Option 2: One-Command Docker Compose

Launch the complete full-stack environment (PostgreSQL 16, FastAPI backend with live reload, and React frontend served via Nginx reverse proxy) with a single command from the project root:

```bash
docker compose up
```

#### Services & Standardized Ports:
- **Client (Web):** `http://localhost:3000` (Nginx serving compiled React client with reverse proxy to `/api`)
- **API (FastAPI Backend):** `http://localhost:8000` (Runs with `--reload` and volume-mounted `./src/server` for live code reload)
- **Database (PostgreSQL 16):** `localhost:5432` (`comforce:comforce-dev@localhost:5432/comforce` with persistent `pgdata` volume)

#### Seed Data Inside Container:
```bash
docker compose exec api python -m src.server.seed
```

#### Verification:
```bash
# Check that all three containers are healthy and running
docker compose ps

# Test API connectivity from client network
curl http://localhost:8000/
```

To stop containers:
```bash
docker compose down
```

---

### Option 3: Local Kubernetes with Kind

Test production-style Kubernetes manifests and Terraform configurations locally on a one-node [kind](https://kind.sigs.k8s.io/) cluster.

1. **Build local container images:**
   ```bash
   docker build -f deploy/docker/Dockerfile.api -t comforce-api:local .
   docker build -f deploy/docker/Dockerfile.web -t comforce-web:local .
   ```
2. **Deploy to local kind cluster with Terraform:**
   ```bash
   cd deploy/terraform/envs/dev
   cp terraform.tfvars.example terraform.tfvars
   terraform init
   terraform apply
   ```
3. **Connect and view:**
   ```bash
   export KUBECONFIG=$HOME/.kube/comforce-dev.yaml
   kubectl -n comforce-dev get pods
   kubectl -n comforce-dev port-forward svc/web 8080:80
   ```
   Open `http://localhost:8080` in your browser.

---

## Posting to Production (Deployment Guide)

ComForce MKE supports multiple production deployment targets depending on your infrastructure.

### 1. AWS Cloud Deployment with EKS & Terraform (Recommended)

Production infrastructure is provisioned as code using Terraform under `deploy/terraform/envs/prod`. It creates a dedicated VPC, an Amazon EKS Kubernetes cluster, an Amazon ECR container registry, and EBS persistent storage for PostgreSQL.

#### Step 1: Configure AWS CLI & Permissions
Ensure your AWS CLI v2 is authenticated with credentials that have permissions to create VPC, EKS, IAM roles, and ECR:
```bash
aws configure
aws sts get-caller-identity
```

#### Step 2: Configure Production Terraform Variables
```bash
cd deploy/terraform/envs/prod
cp terraform.tfvars.example terraform.tfvars
```
Edit `terraform.tfvars`:
```hcl
target      = "aws"
aws_region  = "us-east-1"
db_password = "ChooseAStrongSecureProductionPassword123!"
```
*(Note: `terraform.tfvars` and `*.tfstate` are excluded from git for security).*

#### Step 3: Provision AWS Infrastructure
```bash
terraform init
terraform apply
```
*This provisions the VPC, public subnets, internet gateway, EKS control plane, managed worker node group, EBS CSI driver with `comforce-gp3` StorageClass, and ECR repositories. (Takes ~10–15 minutes).*

#### Step 4: Build & Push Production Images to Amazon ECR
From the repository root, tag and push the production images using the outputs from Terraform:
```bash
cd deploy/terraform/envs/prod
REGISTRY=$(terraform output -raw ecr_registry)
API_IMAGE=$(terraform output -raw api_image)
WEB_IMAGE=$(terraform output -raw web_image)
REGION=$(terraform output -raw aws_region)

# Authenticate Docker to Amazon ECR
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

# Build and push production images
docker build -f deploy/docker/Dockerfile.api -t "$API_IMAGE" .
docker build -f deploy/docker/Dockerfile.web -t "$WEB_IMAGE" .
docker push "$API_IMAGE"
docker push "$WEB_IMAGE"
```

#### Step 5: Rollout Deployments and Verify
Update your local kubeconfig to point to the new production cluster and trigger a rolling update:
```bash
aws eks update-kubeconfig --name "$(terraform output -raw cluster_name)" --region "$REGION"
kubectl -n comforce-prod rollout restart deployment/api deployment/web
kubectl -n comforce-prod get pods -w
```

#### Step 6: Access Production Services
```bash
# Port-forward to verify live production service:
kubectl -n comforce-prod port-forward svc/web 8082:80
```
Open `http://localhost:8082`. When ready for public domain traffic, configure your Ingress controller or Route 53 DNS pointing to the Application Load Balancer.

#### Step 7: Tearing Down Production (To Avoid Cloud Costs)
```bash
cd deploy/terraform/envs/prod
terraform destroy
```

---

### 2. Existing Kubernetes Cluster Deployment

If deploying to an existing Kubernetes cluster (e.g., GKE, Azure AKS, or an internal on-premises cluster):

1. Set `target = "existing"` in `deploy/terraform/envs/prod/terraform.tfvars`:
   ```hcl
   target          = "existing"
   kubeconfig_path = "~/.kube/config"
   db_password     = "<production-database-password>"
   api_image       = "ghcr.io/your-org/comforce-api:latest"
   web_image       = "ghcr.io/your-org/comforce-web:latest"
   ```
2. Run `terraform apply` to install the `comforce-prod` namespace, database StatefulSet, secrets, and deployments directly to your existing cluster.

---

### 3. Single-Node Production Deployment with Docker Compose

For deploying on a single cloud VPS (e.g., AWS EC2, DigitalOcean Droplet, Linode, or Hetzner):

1. Clone the repository on the server:
   ```bash
   git clone https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving.git /opt/comforce
   cd /opt/comforce
   ```
2. Create a secure production environment:
   ```bash
   export POSTGRES_PASSWORD='<strong-password>'
   ```
   Compose requires that secret to be supplied by the deployment environment. Do not put the production password in the checked-in Compose file or commit a production `.env`.

   Then start with the production override:
   ```env
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```
   The production override sets `APP_ENV=production`, `DEBUG=False`, disables reload, removes the source-volume mount, and keeps PostgreSQL private on the Compose network. Database credentials are read from `POSTGRES_PASSWORD` and no database port is published.
3. Verify the resolved production configuration before deployment:
   ```bash
   POSTGRES_PASSWORD='<strong-password>' docker compose -f docker-compose.yml -f docker-compose.prod.yml config
   docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
   ```
4. Configure Nginx with Let's Encrypt / Certbot on the host to provide HTTPS and proxy traffic to port 3000 (web) and 8000 (api).

---

### 4. Mobile App Production Release (Android & iOS)

To post the Capacitor mobile application to public app stores:

#### Google Play Store (Android)
1. Build the production web bundle and sync:
   ```bash
   cd src/client
   npm run build
   npx cap sync android
   npx cap open android
   ```
2. In Android Studio:
   - Configure version code and version name in `android/app/build.gradle`.
   - Select **Build > Generate Signed Bundle / APK**.
   - Select **Android App Bundle (.aab)** and sign with your production upload keystore.
   - Upload the generated `.aab` file to the [Google Play Console](https://play.google.com/console).

#### Apple App Store (iOS)
1. Build the production web bundle and sync:
   ```bash
   cd src/client
   npm run build
   npx cap sync ios
   npx cap open ios
   ```
2. In Xcode:
   - Configure Bundle Identifier and Version in the project settings.
   - Select your registered Apple Developer Team under **Signing & Capabilities**.
   - Select target device **Any iOS Device (arm64)**.
   - Click **Product > Archive**.
   - In the Organizer window, click **Distribute App** and submit to **TestFlight** and **App Store Connect**.

---

## Hackathon Schedule

All times are in Central Time at Diercks Hall:

| Date & Time | Event | Focus |
| :--- | :--- | :--- |
| **Thursday, Nov 19 (6:30 PM - 7:30 PM)** | **Kick-off** | Partner problem details, team check-in, scope lock |
| **Friday, Nov 20 (3:00 PM - 7:00 PM)** | **Hacking Day 1** | Wireframe client, implement API endpoints, load sample data |
| **Saturday, Nov 21 (10:00 AM - 2:00 PM)** | **Hacking Day 2** | AI model integration, mobile build test, ticket flow |
| **Sunday, Nov 22 (10:00 AM - 4:00 PM)** | **Finals & Expo** | Code freeze, rehearse pitch, live judge demos |

---

## Submission Checklist

Before the Sunday deadline:

- [ ] Both `src/client` and `src/server` run cleanly following these instructions.
- [ ] A 2-minute backup video demo is recorded showing the web and mobile views.
- [ ] Presentation slides are exported to PDF and saved in `docs/`.
- [ ] No API keys, passwords, or private resident data are in the git history.
- [ ] The live demo shows both community ticket claiming and safe route planning.

---

## Team Members

| Name | Role | Responsibilities | Contact |
| :--- | :--- | :--- | :--- |
| **Avery B** | ... | ... | `@Akiisqt` |
| **Chris B** | ... | ... | `@BlazeXYZ` |
| **Hayden F** | ... | ... | `@Fonsh19` |
| **Paxson G** | ... | ... | `@TNTwise` |
| **Sam F** | ... | ... | `@samfreund` |

---

## Acknowledgments

* **MSOE Artificial Intelligence Club (MAIC)** for hosting Hacksgiving.
* **Milwaukee School of Engineering (MSOE)** for providing Diercks Hall and Rosie compute access.
* **ComforceMKE** for partnering with MSOE students to build tools for the Milwaukee community.
