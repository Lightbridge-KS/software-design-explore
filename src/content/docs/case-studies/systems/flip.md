---
title: "FLIP Architecture"
description: FLIP Architecture and OOP Guide
---

<!--
    Copyright (c) 2026 Guy's and St Thomas' NHS Foundation Trust & King's College London
    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
        http://www.apache.org/licenses/LICENSE-2.0
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
-->

# FLIP Architecture and OOP Guide

This guide explains the FLIP monorepo from the top down. It is intentionally written as an onboarding map: start with
the C4-style architecture diagrams, then use the folder map and OOP notes to decide where to read code next.

The current implementation is service-oriented rather than domain-object-heavy. Most "OOP" in the Python services is
made of SQLModel/SQLAlchemy entities, Pydantic request/response schemas, settings objects, and a few external gateway
classes. Business behavior mostly lives in FastAPI router functions and service functions.

## C4 Level 1: System Context

FLIP lets researchers and administrators coordinate federated learning projects across healthcare Trusts without
moving patient-level data out of the local Trust environment.

```mermaid
flowchart LR
    researcher["Researcher / Model Developer"]
    admin["FLIP Administrator"]
    browser["Web Browser"]

    flip["FLIP Platform\nCentral coordination for projects, cohort discovery, file upload, FL orchestration"]

    cognito["AWS Cognito\nUser identity and MFA"]
    s3["AWS S3\nModel files, FL apps, training artefacts"]
    ses["AWS SES\nOperational email"]
    flbase["flip-fl-base / flip-fl-base-flower\nFederated learning runtime images"]

    trust["Trust Secure Enclave\nLocal cohort query, imaging cache, FL client"]
    omop["OMOP CDM Database\nLocal clinical and imaging metadata"]
    pacs["PACS / Orthanc\nDICOM source"]
    xnat["XNAT\nLocal research imaging cache"]

    researcher -->|"manages projects, queries cohorts, uploads models"| browser
    admin -->|"approves projects, manages users and deployment state"| browser
    browser -->|"uses HTTPS API and static UI"| flip

    flip -->|"verifies tokens and MFA"| cognito
    flip -->|"stores and retrieves files"| s3
    flip -->|"sends invitations and access notifications"| ses
    flip -->|"bundles and starts training jobs"| flbase

    trust -->|"polls for encrypted tasks and reports results"| flip
    trust -->|"executes read-only cohort SQL"| omop
    trust -->|"queries and imports DICOM studies"| pacs
    trust -->|"creates projects, users, cached resources"| xnat
```

## C4 Level 2: Containers

A bounded context is a part of the system where terms have one agreed meaning. In this repo the strongest context
seams are Project/Cohort, Imaging/XNAT, Federated Training, Identity/Access, and Trust Task Orchestration. These seams
mostly map to deployable services.

```mermaid
flowchart TB
    subgraph Users["Users"]
        browser["Browser"]
    end

    subgraph CentralHub["Central Hub"]
        ui["flip-ui\nVue 3, TypeScript, Pinia"]
        api["flip-api\nFastAPI central API"]
        hubdb["flip-db / RDS PostgreSQL\nHub state"]
        flapi["fl-api-net-N\nFL admin API"]
        flserver["fl-server-net-N\nFL aggregation server"]
        scheduler["APScheduler\nHub background jobs"]
    end

    subgraph AWS["AWS Managed Services"]
        cognito["Cognito"]
        s3["S3 buckets"]
        ses["SES"]
        cloudfront["CloudFront + WAF\nProduction UI and /api routing"]
        alb["ALB\n/api/* to flip-api"]
        nlb["NLB\nFL server TCP"]
    end

    subgraph TrustSite["Each Trust"]
        trustapi["trust-api\nOutbound poller and task dispatcher"]
        dataapi["data-access-api\nOMOP query API"]
        imagingapi["imaging-api\nXNAT/PACS gateway"]
        omop["omop-db\nPostgreSQL OMOP CDM"]
        orthanc["Orthanc\nMock PACS"]
        xnat["XNAT\nImaging cache"]
        flclient["fl-client-net-N\nTrust FL worker"]
        logs["Loki / Alloy / Grafana\nTrust observability"]
    end

    browser -->|"loads static assets"| ui
    browser -->|"calls /api with Cognito access token"| api
    cloudfront -->|"serves UI from S3"| ui
    cloudfront -->|"forwards /api/*"| alb
    alb -->|"targets port 8000"| api

    api -->|"reads and writes hub state"| hubdb
    api -->|"validates access tokens and MFA"| cognito
    api -->|"creates pre-signed URLs, bundles apps, reads results"| s3
    api -->|"sends email notifications"| ses
    api -->|"schedules jobs and recovery loops"| scheduler
    scheduler -->|"runs queued FL jobs and task recovery"| api

    api -->|"starts and monitors training through HTTP"| flapi
    flapi -->|"submits jobs to"| flserver
    flclient -->|"connects during training"| flserver
    nlb -->|"public TCP entrypoint for FL clients"| flserver

    trustapi -->|"polls pending TrustTask records"| api
    trustapi -->|"runs cohort tasks"| dataapi
    trustapi -->|"runs imaging tasks"| imagingapi
    dataapi -->|"read-only SQL"| omop
    imagingapi -->|"queries accession ids when importing"| dataapi
    imagingapi -->|"creates projects, users, imports studies, downloads resources"| xnat
    xnat -->|"DICOM query/retrieve"| orthanc
    flclient -->|"requests dataframes"| dataapi
    flclient -->|"downloads/uploads imaging resources"| imagingapi
    trustapi -->|"emits structured logs"| logs
    dataapi -->|"emits structured logs"| logs
    imagingapi -->|"emits structured logs"| logs
```

Production AWS deployment changes the hosting substrate but not the service responsibilities: `flip-ui` is static S3
content behind CloudFront, `flip-api` and FL services run as ECS Fargate tasks in private subnets, and Trust services run
on a Trust EC2 host or an on-premises host with outbound-only communication.

## C4 Level 3: Main Components

### `flip-api` Central Hub

```mermaid
flowchart TB
    main["main.py\nFastAPI app and router registration"]

    routers["Endpoint modules\ncohort_services, project_services, model_services,\nfile_services, fl_services, user_services, private_services"]
    auth["auth/\nCognito JWT verification, MFA gate,\npermission and access checks, API-key dependencies"]
    services["service functions\nproject/model/FL/cohort workflows"]
    schemas["domain/schemas and domain/interfaces\nPydantic DTOs and enums"]
    orm["db/models\nSQLModel table classes"]
    db["db/database.py\nSQLModel Session over PostgreSQL"]
    ext["utils external gateways\nS3Client, Cognito helpers, SES, HTTP, encryption"]
    aps["scheduler/apscheduler_runner.py\nruns job queue, FL keepalive, stale TrustTask recovery"]

    main -->|"mounts"| routers
    main -->|"starts"| aps
    routers -->|"depend on"| auth
    routers -->|"call"| services
    routers -->|"validate with"| schemas
    services -->|"use"| orm
    services -->|"open sessions through"| db
    services -->|"call"| ext
    db -->|"persists"| orm
```

Key code paths:

| Area | Entry points | Main service code | Main data classes |
| --- | --- | --- | --- |
| Projects | `project_services/*.py`, `step_functions_services/approve_project_step_function.py` | `project_services/services/project_services.py`, `project_services/services/image_service.py` | `Projects`, `ProjectTrustIntersect`, `ProjectUserAccess`, `XNATProjectStatus` |
| Cohort queries | `cohort_services/save_cohort_query.py`, `cohort_services/submit_cohort_query.py` | Trust task queue in `submit_cohort_query.py`; aggregation in `private_services/receive_cohort_results.py` | `Queries`, `QueryResult`, `QueryStats`, `TrustTask` |
| Models and files | `model_services/*.py`, `file_services/*.py` | `model_services/services/model_service.py`, `utils/s3_client.py` | `Model`, `UploadedFiles`, `ModelTrustIntersect`, `ModelsAudit` |
| FL jobs | `fl_services/*.py` | `fl_services/services/fl_scheduler_service.py`, `fl_services/services/fl_service.py` | `FLNets`, `FLScheduler`, `FLJob`, `FLMetrics`, `FLLogs` |
| Users and access | `user_services/*.py`, `role_services/get_roles.py` | `auth/access_manager.py`, `auth/auth_utils.py`, `utils/cognito_helpers.py` | `Role`, `Permission`, `UserRole`, `RolePermission`, Cognito user schemas |
| Trust tasks | `private_services/trust_tasks.py`, `trusts_services/start_project_imaging_creation.py` | `private_services/stale_task_recovery.py`, task producer code in service modules | `Trust`, `TrustTask` |

### `trust-api`

`trust-api` is deliberately small. Its public surface is mostly `/health`; its real job is a background polling loop.

```mermaid
flowchart LR
    lifespan["main.py lifespan"]
    poller["services/task_poller.py\nheartbeat, poll, decrypt, dispatch, report"]
    handlers["services/task_handlers.py\nTASK_HANDLERS registry"]
    hub["flip-api /api/tasks/..."]
    dataapi["data-access-api /cohort"]
    imagingapi["imaging-api /projects, /retrieval, /users"]

    lifespan -->|"starts asyncio task"| poller
    poller -->|"GET pending tasks, POST heartbeat/result"| hub
    poller -->|"dispatches by task_type"| handlers
    handlers -->|"cohort_query"| dataapi
    handlers -->|"create/delete/status/reimport/update profile"| imagingapi
```

This polling model is central to the security architecture: the hub does not make inbound calls to Trust networks.
Trusts initiate outbound HTTPS/API calls and authenticate to the hub with per-trust API keys.

### `data-access-api`

```mermaid
flowchart TB
    router["routers/cohort.py\n/cohort, /cohort/dataframe, /cohort/accession-ids"]
    auth["utils/internal_auth.py\ntrust-internal shared key"]
    parser["sqlglot parse and re-emit\nsingle read-only SELECT statement"]
    service["services/cohort.py\nvalidate, execute, aggregate stats"]
    cache["services/query_cache.py\nin-memory bounded result cache"]
    omop["OMOP PostgreSQL\nread-only DB role"]

    router -->|"requires"| auth
    router -->|"normalizes SQL through"| parser
    parser -->|"safe SQL string"| service
    service -->|"checks cache"| cache
    service -->|"runs pandas.read_sql"| omop
    service -->|"stores copies"| cache
```

Important guardrails are split across layers: API-level query validation, SQL AST normalization with `sqlglot`, an
OMOP-only schema rule, literal-only `LIMIT`/`OFFSET`, a cohort-size threshold, and the database read-only role.

### `imaging-api`

```mermaid
flowchart TB
    routers["routers\nprojects, imaging, retrieval, download, upload, users"]
    auth["utils/internal_auth.py\ntrust-internal shared key"]
    xauth["utils/auth.py + XnatTokenFactory\ncached XNAT service-account token"]
    services["services\nprojects, imaging, retrieval, download, upload, users"]
    dataext["services_external/data_access.py\naccession-id lookup"]
    xnat["XNAT REST APIs"]
    pacs["PACS via XNAT DQR / Orthanc"]
    xnatdb["XNAT PostgreSQL tables\nqueued/executed PACS request status"]
    files["BASE_IMAGES_DOWNLOAD_DIR\nshared image volume for FL clients"]

    routers -->|"require"| auth
    routers -->|"inject"| xauth
    routers -->|"call"| services
    services -->|"call"| xnat
    services -->|"query/import"| pacs
    services -->|"ask for accession ids"| dataext
    dataext -->|"POST /cohort/accession-ids"| dataapi["data-access-api"]
    services -->|"read import state"| xnatdb
    services -->|"download/unzip resources"| files
```

### `flip-ui`

```mermaid
flowchart TB
    app["App.vue and layouts"]
    pages["pages/\nfile-based Vue routes"]
    partials["partials/\nfeature views for projects, models, cohort queries, users"]
    components["components/Ai*\nshared design system"]
    stores["store/\nPinia auth, project, trust, site, health state"]
    services["services/*-service.ts\nAPI-specific typed functions"]
    http["services/api.ts\nHttp wrapper over Axios"]
    auth["utils/auth.ts + store/auth.ts\nAmplify/Cognito auth and MFA routing"]
    backend["flip-api /api"]

    app --> pages
    pages --> partials
    partials --> components
    pages --> stores
    partials --> stores
    stores --> services
    partials --> services
    services --> http
    http -->|"adds Bearer token, handles 401 signout"| auth
    http -->|"calls"| backend
```

## Repository Structure

| Path | Responsibility |
| --- | --- |
| `flip-api/` | Central Hub API. Contains FastAPI app, hub domain schemas, SQLModel tables, project/cohort/model/file/FL/user service modules, scheduler, and AWS/S3/Cognito helpers. |
| `flip-ui/` | Vue 3 frontend. Pages and layouts are route-oriented; reusable UI lives in `src/components`; feature widgets live in `src/partials`; typed API clients live in `src/services`; Pinia state lives in `src/store`. |
| `trust/trust-api/` | Trust-side outbound polling service. It fetches encrypted tasks from the hub, dispatches to local Trust services, and reports results back. |
| `trust/data-access-api/` | Trust-side OMOP query API. It validates SQL, executes read-only queries, returns cohort statistics/dataframes/accession IDs, and enforces trust-internal authentication. |
| `trust/imaging-api/` | Trust-side imaging gateway. It creates XNAT projects/users, queries PACS through XNAT DQR, tracks imports, downloads resources for FL clients, and uploads derived resources. |
| `trust/omop-db/` | Mock OMOP PostgreSQL service and update scripts used for local/dev Trust environments. |
| `trust/orthanc/` | Mock PACS service for DICOM storage/retrieval. |
| `trust/xnat/` | XNAT stack, nginx/postgres support, and anonymization-related tests. |
| `trust/observability/` | Shared logging middleware plus Loki, Alloy, and Grafana config for Trust services. |
| `deploy/` | Docker Compose entrypoints and FL backend overlays. `compose.development.yml` defines hub services; `compose.*.flower.yml` and `compose.*.nvflare.yml` add FL services. |
| `deploy/providers/AWS/` | Terraform/OpenTofu and Ansible for production/staging AWS: CloudFront, WAF, ALB, NLB, ECS, EFS, RDS, Cognito, SES, S3, VPC endpoints, Trust EC2. |
| `deploy/providers/local/` | Ansible path for on-prem Trust deployment. |
| `docs/` | Sphinx user/admin/deployment documentation. |
| `_docs/` | Agent-oriented architecture and codebase guides. This file lives here. |
| `scripts/` | Root utility scripts for env validation and secret scanning. |

## Dynamic View: Cohort Query

```mermaid
sequenceDiagram
    actor User
    participant UI as flip-ui
    participant Hub as flip-api
    participant HubDB as hub PostgreSQL
    participant Trust as trust-api poller
    participant Data as data-access-api
    participant OMOP as OMOP DB

    User->>UI: Submit cohort SQL for a project
    UI->>Hub: POST /api/step/cohort or /api/cohort/submit
    Hub->>Hub: Check project access and SQL pre-validation
    Hub->>HubDB: Save Queries and queue TrustTask per Trust
    Trust->>Hub: GET /api/tasks/{trust}/pending
    Hub-->>Trust: Encrypted cohort_query task
    Trust->>Trust: Decrypt task payload
    Trust->>Data: POST /cohort with trust-internal key
    Data->>Data: Parse, validate, normalize SQL
    Data->>OMOP: Execute read-only SELECT
    OMOP-->>Data: Cohort rows
    Data-->>Trust: Aggregated statistics
    Trust->>Hub: POST /api/cohort/results with trust API key
    Hub->>HubDB: Store QueryResult and aggregated QueryStats
    UI->>Hub: GET /api/cohort/{query_id}
    Hub-->>UI: 202 pending or 200 aggregated results
```

## Dynamic View: Project Approval and Image Import

```mermaid
sequenceDiagram
    actor Admin
    participant UI as flip-ui
    participant Hub as flip-api
    participant HubDB as hub PostgreSQL
    participant Trust as trust-api
    participant Imaging as imaging-api
    participant Data as data-access-api
    participant XNAT as XNAT
    participant PACS as Orthanc/PACS

    Admin->>UI: Approve staged project for selected Trusts
    UI->>Hub: POST /api/step/project/{project_id}/approve
    Hub->>HubDB: Mark ProjectTrustIntersect approved and project APPROVED
    Hub->>HubDB: Queue CREATE_IMAGING TrustTask
    Trust->>Hub: Poll pending tasks
    Hub-->>Trust: create_imaging task
    Trust->>Imaging: POST /projects/create-project-from-central-hub-project
    Imaging->>XNAT: Create project and user access
    Imaging->>Data: POST /cohort/accession-ids
    Data-->>Imaging: accession_id list only
    Imaging->>PACS: Query and queue DICOM import through XNAT DQR
    Imaging->>XNAT: Configure project import and optional DICOM-to-NIfTI pipeline
    Trust->>Hub: Report XNAT project creation result
    Hub->>HubDB: Track XNATProjectStatus and later GET_IMAGING_STATUS task results
```

## Dynamic View: Training Start

```mermaid
sequenceDiagram
    actor User
    participant UI as flip-ui
    participant Hub as flip-api
    participant S3 as S3 buckets
    participant HubDB as hub PostgreSQL
    participant FLAPI as fl-api-net-N
    participant FLServer as fl-server-net-N
    participant FLClient as fl-client-net-N
    participant Data as data-access-api
    participant Imaging as imaging-api

    User->>UI: Upload model code and start training
    UI->>Hub: Request pre-signed upload URLs
    Hub->>S3: Generate short-lived PUT URLs
    UI->>S3: Upload model files directly
    UI->>Hub: POST /api/fl/initiate/{model_id}
    Hub->>HubDB: Add FLJob and reserve available FLScheduler
    Hub->>S3: Bundle FL app from base app plus uploaded files
    Hub->>FLAPI: Upload app metadata and bundle URLs
    FLAPI->>FLServer: Submit backend job
    FLClient->>FLServer: Join federated training
    FLClient->>Data: Request project dataframe with trust-internal key
    FLClient->>Imaging: Download images by accession with trust-internal key
    FLServer->>Hub: Report logs, metrics, and results using internal service key
    Hub->>HubDB: Store FLLogs, FLMetrics, model status
```

## OOP Architecture

### High-level style

FLIP's backend style is closer to "transaction script plus data classes" than classic rich-domain OOP.

| Layer | Style in this repo | Examples |
| --- | --- | --- |
| API boundary | FastAPI router modules with dependency injection | `flip-api/src/flip_api/project_services/create_project.py`, `trust/data-access-api/data_access_api/routers/cohort.py` |
| Application behavior | Module-level service functions; explicit `Session` parameters; commits/rollbacks inside functions | `project_services/services/project_services.py`, `fl_services/services/fl_scheduler_service.py`, `data_access_api/services/cohort.py` |
| Domain data | SQLModel/SQLAlchemy ORM classes and Pydantic DTOs; little behavior on entities | `db/models/main_models.py`, `domain/schemas/*.py`, `domain/interfaces/*.py` |
| External gateways | Small wrapper classes/functions around SDKs and HTTP clients | `S3Client`, `XnatTokenFactory`, frontend `Http` |
| Configuration | Pydantic `BaseSettings` classes per service | `flip_api.config.Settings`, `trust_api.config.Settings`, `imaging_api.config.Settings`, `data_access_api.config.Settings` |
| Frontend | Composition API plus Pinia stores and typed service functions; one Axios wrapper class | `src/store/auth.ts`, `src/services/api.ts`, `src/services/*-service.ts` |

The practical result: when looking for "where behavior lives", search functions first, not methods. When looking for
"what the system knows", inspect the SQLModel and Pydantic classes.

### Central Hub domain model

```mermaid
classDiagram
    class Projects {
        UUID id
        string name
        string description
        UUID owner_id
        ProjectStatus status
        bool deleted
        bool dicom_to_nifti
    }

    class Queries {
        UUID id
        string name
        string query
        UUID project_id
    }

    class QueryResult {
        UUID id
        UUID query_id
        UUID trust_id
        string data
    }

    class QueryStats {
        UUID id
        UUID query_id
        string stats
    }

    class Model {
        UUID id
        string name
        ModelStatus status
        UUID project_id
        UUID owner_id
        bool deleted
    }

    class UploadedFiles {
        UUID id
        string name
        FileUploadStatus status
        UUID model_id
    }

    class Trust {
        UUID id
        string name
        datetime last_heartbeat
    }

    class TrustTask {
        UUID id
        UUID trust_id
        TaskType task_type
        string payload
        TaskStatus status
        string result
        int retry_count
    }

    class ProjectTrustIntersect {
        UUID project_id
        UUID trust_id
        bool approved
    }

    class ModelTrustIntersect {
        UUID model_id
        UUID trust_id
        TrustIntersectStatus status
        string fl_client_endpoint
    }

    class FLNets {
        UUID id
        string name
        string endpoint
    }

    class FLScheduler {
        UUID id
        UUID net_id
        NetStatus status
        UUID job_id
    }

    class FLJob {
        UUID id
        UUID model_id
        JobStatus status
        list clients
        string fl_backend_job_id
    }

    class FLMetrics {
        UUID model_id
        string trust
        int global_round
        string label
        float result
    }

    class FLLogs {
        UUID model_id
        bool success
        string trust_name
        string log
    }

    class XNATProjectStatus {
        UUID project_id
        UUID trust_id
        UUID xnat_project_id
        XNATImageStatus retrieve_image_status
        int reimport_count
    }

    Projects "1" --> "*" Queries : has
    Projects "1" --> "*" Model : owns
    Projects "1" --> "*" ProjectTrustIntersect : staged or approved for
    Trust "1" --> "*" ProjectTrustIntersect : participates in
    Trust "1" --> "*" TrustTask : polls
    Trust "1" --> "*" ModelTrustIntersect : trains
    Model "1" --> "*" UploadedFiles : uses
    Model "1" --> "*" ModelTrustIntersect : selected Trusts
    Model "1" --> "*" FLJob : queued as
    Model "1" --> "*" FLMetrics : reports
    Model "1" --> "*" FLLogs : logs
    Queries "1" --> "*" QueryResult : per-Trust result
    Queries "1" --> "1" QueryStats : aggregate
    FLNets "1" --> "*" FLScheduler : has
    FLScheduler "1" --> "0..1" FLJob : runs
    Projects "1" --> "*" XNATProjectStatus : tracks per Trust
    Trust "1" --> "*" XNATProjectStatus : local XNAT project
```

### Identity and authorization model

```mermaid
classDiagram
    class CognitoUser {
        external_identity_source
        UUID sub
        string email
        mfa_settings
    }

    class UserRole {
        UUID user_id
        UUID role_id
    }

    class Role {
        UUID id
        string name
        string description
    }

    class RolePermission {
        UUID role_id
        UUID permission_id
    }

    class Permission {
        UUID id
        string permission_name
    }

    class PermissionRef {
        CAN_ACCESS_ADMIN_PANEL
        CAN_APPROVE_PROJECTS
        CAN_CREATE_PROJECTS
        CAN_MANAGE_USERS
        CAN_MANAGE_PROJECTS
    }

    CognitoUser "1" --> "*" UserRole : local role mapping by sub
    UserRole "*" --> "1" Role : assigns
    Role "1" --> "*" RolePermission : grants
    RolePermission "*" --> "1" Permission : references
    PermissionRef ..> Permission : seeded canonical IDs
```

`CognitoUser` is not a local table. The local hub database stores role and permission mappings keyed by the Cognito
`sub` UUID. Request authentication is split into two parts:

- `auth/dependencies.py` verifies Cognito JWTs and enforces the application-layer MFA gate.
- `auth/access_manager.py` and `auth/auth_utils.py` check project/model/query ownership, membership, and role-derived
  permissions.
- `auth/access_manager.py` also contains API-key dependencies for Trust-to-hub and FL-server-to-hub service calls.

### Data transfer objects and entity classes

```mermaid
classDiagram
    class BaseModel {
        pydantic_validation
        json_serialization
    }

    class SQLModel {
        pydantic_model
        sqlalchemy_table_mapping
    }

    class SubmitCohortQuery {
        UUID project_id
        UUID query_id
        string name
        string query
    }

    class IProjectResponse {
        UUID id
        string name
        ProjectStatus status
    }

    class IModelResponse {
        UUID model_id
        string model_name
        UUID project_id
    }

    class TrustTaskResponse {
        UUID id
        TaskType task_type
        string payload
        TaskStatus status
    }

    class Projects {
        table_projects
    }

    class Model {
        table_model
    }

    class TrustTask {
        table_trust_task
    }

    BaseModel <|-- SubmitCohortQuery
    BaseModel <|-- IProjectResponse
    BaseModel <|-- IModelResponse
    BaseModel <|-- TrustTaskResponse
    SQLModel <|-- Projects
    SQLModel <|-- Model
    SQLModel <|-- TrustTask
```

The `domain/interfaces/` naming looks TypeScript-inspired: most classes are Pydantic DTOs used as typed request or
response shapes, not abstract interfaces in the Java/C# sense. `domain/schemas/` contains similar DTOs plus status
enums used across routes and services.

### Gateway and utility classes

```mermaid
classDiagram
    class Settings {
        base_settings
        environment_driven_config
    }

    class DevSettings {
        development_secrets_from_env
    }

    class ProdSettings {
        production_secrets_from_aws
    }

    class S3Client {
        boto3 client
        get_presigned_url()
        get_put_presigned_url()
        delete_object()
        get_object()
        object_exists()
    }

    class XnatTokenFactory {
        url
        username
        password
        xnat_cookie
        get_xnat_cookie()
        is_token_valid()
    }

    class Http {
        AxiosInstance instance
        get()
        post()
        put()
        delete()
    }

    class CacheEntry {
        DataFrame df
        datetime created_at
    }

    class AmplifyAuth {
        fetchAuthSession()
    }

    class QueryCacheModule {
        dict cache
        get_cached_result()
        set_cached_result()
    }

    Settings <|-- DevSettings
    Settings <|-- ProdSettings
    S3Client ..> Settings : reads AWS region and buckets
    XnatTokenFactory ..> Settings : built from XNAT credentials
    Http ..> AmplifyAuth : adds Bearer token
    QueryCacheModule --> CacheEntry : stores
```

These are the few places where objects wrap behavior:

- `flip-api/src/flip_api/utils/s3_client.py` centralizes S3 SDK calls and avoids logging sensitive pre-signed URLs.
- `trust/imaging-api/imaging_api/utils/xnat_token.py` caches and refreshes the XNAT service-account token.
- `flip-ui/src/services/api.ts` wraps Axios, injects Cognito access tokens, and handles global 401 sign-out behavior.
- `trust/data-access-api/data_access_api/services/query_cache.py` uses a small dataclass for cached DataFrame entries.

## Cross-Service Security Boundaries

| Boundary | Mechanism | Code |
| --- | --- | --- |
| Browser to hub | Cognito access token, verified by JWKS; app-layer TOTP MFA gate | `flip-api/src/flip_api/auth/dependencies.py`, `flip-ui/src/store/auth.ts`, `flip-ui/src/utils/auth.ts` |
| Trust to hub | Per-trust API key header; hub stores SHA-256 hashes and compares in constant time | `flip-api/src/flip_api/auth/access_manager.py`, `trust/trust-api/trust_api/services/task_poller.py` |
| FL server to hub | Internal service key header; used for logs, metrics, status, results | `flip-api/src/flip_api/auth/access_manager.py`, FL server images from sibling repos |
| Trust internal calls | Per-trust shared secret header for trust-api, imaging-api, data-access-api, fl-client | `trust/*/utils/internal_auth.py`, `trust/trust-api/trust_api/services/task_handlers.py` |
| Hub task payloads | AES-encrypted payloads for TrustTask polling | `flip-api/src/flip_api/utils/encryption.py`, `trust/trust-api/trust_api/utils/encryption.py` |
| OMOP query execution | API validation plus read-only DB user and cohort-size threshold | `trust/data-access-api/data_access_api/routers/cohort.py`, `trust/data-access-api/data_access_api/services/cohort.py` |
| File uploads | Short-lived S3 pre-signed URLs; direct browser-to-S3 upload | `flip-api/src/flip_api/file_services/presigned_url_for_upload.py`, `flip-api/src/flip_api/utils/s3_client.py` |

## How to Read the Codebase

1. Start with the runtime boundary.
   - `README.md`
   - `deploy/compose.development.yml`
   - `trust/compose_trust.development.yml`
   - `deploy/compose.development.flower.yml` or `deploy/compose.development.nvflare.yml`

2. Read the Central Hub boot path.
   - `flip-api/src/flip_api/main.py`
   - `flip-api/src/flip_api/config.py`
   - `flip-api/src/flip_api/db/models/main_models.py`
   - `flip-api/src/flip_api/db/models/user_models.py`

3. Follow one workflow end to end.
   - Cohort query: `flip-ui/src/services/cohort-query-service.ts` -> `flip-api/src/flip_api/cohort_services/` ->
     `trust/trust-api/trust_api/services/task_handlers.py` ->
     `trust/data-access-api/data_access_api/routers/cohort.py`
   - Project approval and imaging: `flip-api/src/flip_api/step_functions_services/approve_project_step_function.py` ->
     `flip-api/src/flip_api/trusts_services/start_project_imaging_creation.py` ->
     `trust/imaging-api/imaging_api/routers/projects.py`
   - Training: `flip-api/src/flip_api/fl_services/initiate_training.py` ->
     `flip-api/src/flip_api/fl_services/services/fl_scheduler_service.py` ->
     `flip-api/src/flip_api/fl_services/services/fl_service.py`

4. Read the frontend by feature.
   - API clients: `flip-ui/src/services/`
   - Feature views: `flip-ui/src/partials/`
   - Pages/routes: `flip-ui/src/pages/`
   - Auth state: `flip-ui/src/store/auth.ts`, `flip-ui/src/utils/auth.ts`, `flip-ui/src/services/api.ts`

5. Read tests where behavior is unclear.
   - `flip-api/tests/unit/` and `flip-api/tests/integration/`
   - `trust/*/tests/`
   - `flip-ui/src/**/__tests__/` and `flip-ui/test/cypress/`

## Design Notes and Trade-offs

- The Trust side uses polling instead of inbound hub-to-Trust calls. This is the most important deployment and security
  decision in the current architecture.
- The hub database is the coordination ledger: projects, models, files, FL jobs, Trust heartbeat state, and pending Trust
  tasks all live there.
- Imaging data stays local to each Trust. The hub tracks XNAT project IDs and import state, but image retrieval happens
  inside the Trust through `imaging-api`.
- FL clients do not receive Central Hub credentials. They access local `data-access-api` and `imaging-api` with the
  trust-internal key, and the FL server reports back to the hub with the hub internal service key.
- SQLModel entities are mostly anemic. If future work needs richer domain behavior, introduce it carefully around a
  workflow boundary, not by spreading methods across every table class.
- The service layer currently mixes orchestration, persistence, and external calls in module functions. That keeps the
  code easy to follow for narrow workflows, but large workflows can become harder to test unless dependencies are passed
  in or wrapped behind small gateways.

## Vocabulary

| Term | Meaning in this repo |
| --- | --- |
| Central Hub | Cloud-side coordination plane: UI, `flip-api`, hub DB, S3 artefacts, FL server/admin services. |
| Trust | A participating healthcare institution or local secure environment. In code this is also a `Trust` table row. |
| Secure Enclave | Trust-side runtime boundary containing Trust APIs, OMOP, XNAT, PACS/Orthanc, and FL clients. |
| TrustTask | Hub-side queued command that a Trust polls, decrypts, executes locally, and reports back. |
| FL net | One federated learning network made of central FL API/server plus one client per Trust. |
| XNAT project | Trust-side research imaging cache/project created from an approved hub project. |
| OMOP | Standardized local clinical/imaging metadata database used for cohort discovery. |
| PACS / Orthanc | Clinical imaging source. Orthanc is the local/mock PACS implementation used by the dev stack. |
