---
title: "Communication Patterns: From Tight to Loose"
description: "A spectrum of software-system communication patterns, from in-process calls to batch/file exchange, ordered by latency, coupling, and resilience."
---

Software systems communicate across a spectrum. At one end, modules call each other inside the same process: extremely fast, but tightly coupled. At the other end, systems exchange files or batches hours later: slower, but far more independent and resilient.

The general rule:

> **Tighter coupling = faster and simpler, but less flexible.**  
> **Looser coupling = slower and more operationally complex, but more resilient.**

## The Spectrum

```text
TIGHT / FAST                                                   LOOSE / SLOW

 ns ─────────── μs ─────────── ms ─────────── s ─────────── hours
 │              │              │              │              │
[1][2][3]       [4]            [5]            [6]            [7]
in-process      same-host      network sync   network async  batch/file
```

This spectrum is not a ranking from good to bad. It is a set of trade-offs. A well-designed system often uses several of these patterns at once.

---

## [1] Direct Function / Method Calls — Nanoseconds

Same binary, same address space, compiler or interpreter links them together. In compiled languages, the compiler can sometimes inline the call away entirely.

```text
┌────────────── Process ──────────────┐
│                                     │
│  Module A ─────── call ───────▶ Module B
│  (same memory, same stack)          │
│                                     │
└─────────────────────────────────────┘
```

Examples:

- calling a function in the same Python module
- calling a method on a C# class in the same assembly
- one domain object invoking another object directly

This is the tightest form of coupling. If `Module B` changes its function signature, `Module A` may break immediately — sometimes at compile time, sometimes at runtime.

Use this when the collaborating code belongs to the same deployable unit and should evolve together.

---

## [2] Interface / Virtual Dispatch — Nanoseconds

Same process and same memory, but the caller talks through an abstraction: an interface, abstract class, trait, protocol, function pointer, or callback.

```text
               ┌──────────────────────┐
Module A ───▶  │ IRepository           │
               │ (interface/contract)  │
               └──────────▲───────────┘
                          │ implements
              ┌───────────┴───────────┐
              │                       │
          SqlRepo                 MemoryRepo
```

This adds one layer of indirection — for example, a vtable lookup — but it enables:

- dependency injection
- test doubles and mocking
- swapping implementations
- separating policy from detail
- depending on contracts rather than concrete classes

This is the **SOLID / Dependency Inversion Principle sweet spot**: nearly the same runtime speed as direct calls, but looser coupling at the source-code level.

Use this when you want modularity inside one process without paying network or serialization costs.

---

## [3] Dynamic Loading / Plugins — Nanoseconds After Load

Plugins are code modules loaded at runtime: shared libraries, assemblies, extensions, or packages discovered dynamically.

Once loaded, calls can be nearly as fast as static calls. The main complexity is not latency; it is **compatibility**.

```text
┌──────────────────── Host Application ────────────────────┐
│                                                          │
│  Stable Core ───▶ Plugin Contract ───▶ Loaded Plugin A   │
│                                 └────▶ Loaded Plugin B   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Examples:

- Python C extensions, such as NumPy internals
- .NET assembly loading
- VS Code extensions
- Photoshop plugins
- OsiriX / Horos DICOM viewer plugins
- browser extensions

The hard part is keeping the contract stable. If the plugin API or ABI changes, older plugins may break even though they are loaded successfully.

Use this when you need a stable core with open-ended extension points.

---

## [4] Inter-Process Communication on the Same Host — Microseconds

Here, two processes run on the same machine. They do not share the same stack or heap by default, so the operating system mediates communication.

```text
┌─────────────┐                       ┌─────────────┐
│ Process A   │ ─────── IPC ───────▶  │ Process B   │
└─────────────┘                       └─────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ IPC mechanisms                                           │
│                                                          │
│ • shared memory        fastest, hardest                  │
│ • Unix domain sockets  fast, common on Unix-like systems │
│ • named pipes          simple, stream-based              │
│ • mmap files           shared via filesystem             │
│ • local TCP            convenient, slightly more overhead│
└──────────────────────────────────────────────────────────┘
```

Examples:

- PostgreSQL backend processes communicating locally
- Docker CLI talking to the Docker daemon
- system services on macOS or Linux
- a desktop app communicating with a local helper process
- AI inference workers isolated from a web/API process

PostgreSQL, for example, can use Unix sockets for local connections and TCP for remote connections.

Use same-host IPC when you want process isolation, crash boundaries, privilege separation, or independent runtime environments, but still want lower latency than remote networking.

---

## [5] Synchronous Network RPC — Milliseconds

This is where most service-to-service communication lives. The caller sends a request over the network and waits for a response.

```text
Client ─────────── request ───────────▶ Server
       ◀────────── response ──────────
          caller blocks until reply
```

| Protocol | Format | Notes |
|---|---|---|
| gRPC | Protobuf over HTTP/2 | Fast, strongly typed, streaming, polyglot |
| REST / HTTP | JSON over HTTP/1.1 or HTTP/2 | Ubiquitous, human-readable, weakly typed by default |
| GraphQL | JSON over HTTP | Client selects fields, usually one endpoint |
| WebSocket | Any payload over TCP | Bidirectional, persistent connection |
| SOAP | XML over HTTP | Legacy enterprise systems |
| DICOMweb / DIMSE | DICOM over HTTP / TCP | PACS, imaging, radiology workflows |

Typical latency:

- same LAN: roughly sub-millisecond to a few milliseconds
- same cloud region: often a few milliseconds
- cross-region or public internet: tens to hundreds of milliseconds

Coupling moves from code signatures to **API contracts**. The caller and server can be written in different languages and deployed separately, but they must still agree on request shape, response shape, errors, versioning, and availability.

Use synchronous RPC when the caller truly needs an answer now: authentication, validation, query results, command acknowledgement, or interactive user-facing workflows.

---

## [6] Asynchronous Messaging — Milliseconds to Seconds

The sender publishes a message to a broker. A receiver consumes it later. The sender does not need to wait, and often does not even know which service will consume the message.

```text
                 ┌────────────── Broker ──────────────┐
Producer ─────▶  │ [msg] [msg] [msg]                   │ ─────▶ Consumer A
                 │ queue / topic / stream              │ ─────▶ Consumer B
                 └─────────────────────────────────────┘
```

Two main shapes:

1. **Queue / point-to-point** — one message is handled by one consumer.
2. **Topic / publish-subscribe** — one event can be observed by many consumers.

Common tools:

| Tool | Common shape | Notes |
|---|---|---|
| RabbitMQ | Queue / pub-sub | Flexible routing, classic message broker |
| Kafka | Log / stream | Durable ordered event log, replayable consumers |
| NATS | Pub-sub / request-reply | Lightweight, fast, cloud-native messaging |
| Redis Streams | Stream | Useful when Redis is already present |
| AWS SQS / SNS | Queue / pub-sub | Managed cloud primitives |
| Google Pub/Sub | Pub-sub | Managed event distribution |
| Azure Service Bus | Queue / topics | Enterprise messaging on Azure |

Async messaging changes the design vocabulary. Instead of asking, “What function do I call?”, you ask:

- What event happened?
- Who owns the event schema?
- Can the event be replayed?
- Is message handling idempotent?
- What happens if the consumer is down?
- How do we trace a workflow across services?

The benefits are resilience and decoupling. Producers and consumers can scale independently. Temporary failures can be absorbed by queues. New consumers can be added without changing the producer.

The costs are operational complexity: retries, duplicate delivery, ordering, poison messages, schema evolution, observability, and eventual consistency.

Use asynchronous messaging when work can happen later, when multiple consumers may care about the same event, or when you need to buffer spikes between services.

---

## [7] Batch / File-Based Exchange — Seconds to Hours

The loosest form of communication is not a call at all. One system writes data somewhere; another system picks it up later.

```text
System A ───── writes file/export ─────▶ Shared location
                                             │
                                             ▼
System B ◀──── reads/import later ──────────┘
```

Examples:

- CSV or Excel exports
- nightly ETL jobs
- SFTP drops
- object-storage handoff through S3, GCS, or Azure Blob
- DICOM studies arriving into a watched folder
- HL7 batch interfaces
- data lake ingestion
- research datasets exported for offline analysis

This pattern is slow, but it is extremely useful. It works across organizations, firewalls, legacy systems, and weak integration environments. Many hospital and enterprise systems still rely on this style because it is inspectable, recoverable, and operationally simple.

The main risks are stale data, unclear ownership, duplicate imports, partial files, naming conventions, schema drift, and weak observability.

Use batch/file exchange when real-time interaction is unnecessary, when systems are organizationally far apart, or when reliability and auditability matter more than immediacy.

---

## Coupling Changes Shape as You Move Right

The further right you go, the less the systems are coupled by code — but coupling never disappears. It changes form.

| Level | Coupled by | Typical failure mode |
|---|---|---|
| Direct call | function signature | compile/runtime break |
| Interface | contract in source code | incompatible implementation |
| Plugin | ABI/API and lifecycle | plugin load failure |
| Same-host IPC | local protocol and OS resources | deadlocks, permissions, process crash |
| Sync RPC | network API contract | timeout, 5xx, version mismatch |
| Async messaging | event schema and broker semantics | duplicate events, ordering, poison messages |
| Batch/file | file format, location, schedule | stale data, partial imports, schema drift |

This is the key mental model: **decoupling is not free**. You are moving coupling from one place to another.

---

## How to Choose

A practical decision guide:

| If you need... | Prefer... |
|---|---|
| maximum speed inside one deployable unit | direct calls |
| testability and replaceable implementations | interfaces / dependency injection |
| third-party or optional extension points | plugins |
| process isolation on one machine | same-host IPC |
| immediate answer from another service | synchronous RPC |
| resilience, buffering, fan-out, or event workflows | asynchronous messaging |
| cross-organization exchange or offline workflows | batch/file exchange |

A simple heuristic:

> Start as tight as your ownership boundary allows.  
> Loosen communication when deployment, resilience, scaling, ownership, or organizational boundaries demand it.

Do not turn every method call into a network call. Do not turn every event into a batch job. Architecture is mostly about placing the boundary in the right place.

---

## The Architecture Lesson

Communication patterns are not just transport choices. They define the shape of the system.

- Direct calls create a **modular codebase**.
- Interfaces create **replaceable internals**.
- Plugins create an **extension ecosystem**.
- IPC creates **local process boundaries**.
- RPC creates **distributed services**.
- Messaging creates **event-driven systems**.
- Batch exchange creates **data pipelines and institutional handoffs**.

The more distributed the system becomes, the more the design shifts from function calls to contracts, schemas, retries, observability, and operational discipline.

That is the trade: speed and simplicity on one side, independence and resilience on the other.
