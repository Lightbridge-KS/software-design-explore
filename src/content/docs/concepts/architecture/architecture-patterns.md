---
title: "Software Architecture Patterns — A Tour"
description: A tour of Software Architecture Patterns
---


Mark Richards' chart is famous for a reason: it forces you to see architecture as a set of **trade-offs**, not a "best" choice. Before diving into each pattern, let's establish a mental map.

## Youtube

0 [Think Like an Architect](https://youtu.be/W7Krz__jJUg?si=F_EYe1s1zb3numyl)

## High-Level Overview

The 8 patterns roughly fall on a spectrum from **monolithic** (one deployable unit) to **distributed** (many independently deployed services):

```
  MONOLITHIC  ◄──────────────────────────────────────────►  DISTRIBUTED
  
  Layered   Modular    Microkernel  │ Service-  Micro-    SOA    Event-    Space-
            Monolith                │ based     services         driven   based
            
  └── One deployable ───┘  └──────── Multiple deployables ─────────────────┘
  └── Simple, cheap ────┘  └──────── Scalable, complex ─────────────────────┘
```

Think of it like imaging modalities: a plain film (layered) is simple and cheap; an MRI (microservices) is powerful but complex, expensive, and needs a whole team to run well. Neither is "better" — it depends on the clinical question.

Another useful axis — **what each pattern optimizes for**:

```
  Pattern              Primary Strength             Primary Weakness
  ─────────────────────────────────────────────────────────────────
  Layered              Simplicity, low cost          Poor scalability, agility
  Modular Monolith     Simplicity + modularity       Still one deployable
  Microkernel          Extensibility (plugins)       Hard to scale
  Microservices        Agility, scalability          High cost, complexity
  Service-based        Pragmatic middle ground       Limited elasticity
  SOA                  Enterprise integration        Heavy, slow, complex
  Event-driven         Responsiveness, decoupling    Hard to reason about
  Space-based          Extreme elasticity            Very expensive, complex
```

Now let's go one by one — skipping modular monolith and microservices since you know those.

---

## 1. Layered Architecture (n-Tier)

**The classic.** This is what most developers write by default. The system is sliced horizontally into layers, each with a single responsibility. A request flows top-to-bottom; a response flows bottom-to-top.

```
  ┌──────────────────────────────────────┐
  │      Presentation Layer              │   ← UI, controllers
  │      (what the user sees)            │
  ├──────────────────────────────────────┤
  │      Business Layer                  │   ← domain rules, workflows
  │      (what the app does)             │
  ├──────────────────────────────────────┤
  │      Persistence Layer               │   ← repositories, ORM
  │      (how data is saved/loaded)      │
  ├──────────────────────────────────────┤
  │      Database Layer                  │   ← actual DB engine
  └──────────────────────────────────────┘
  
  Request flow:   ▼ (down through closed layers)
  Response flow:  ▲
```

**Key idea: layers are "closed"** — you can't skip from Presentation directly to Persistence. This enforces separation of concerns but can create inefficiency (the "architecture sinkhole" anti-pattern, where layers just pass data through without adding value).

**When to use:** small to medium apps, CRUD-heavy systems, teams starting out, low-budget projects. It's the Shiny app of the architecture world — easy to reason about, but doesn't scale organizationally or technically.

---

## 2. Microkernel (Plugin Architecture)

**Think VS Code, Eclipse, or a PACS viewer with measurement plugins.** There's a small, stable **core system** that knows nothing about features. Features are packaged as **plug-ins** that register themselves with the core.

```
                    ┌───────────────┐
                    │               │
           ┌────────┤   Core        ├────────┐
           │        │   System      │        │
           │        │               │        │
           │        └───────┬───────┘        │
           │                │                │
       ┌───▼───┐        ┌───▼───┐        ┌───▼───┐
       │Plug-  │        │Plug-  │        │Plug-  │
       │in A   │        │in B   │        │in C   │
       └───────┘        └───────┘        └───────┘
       (e.g.           (e.g.            (e.g.
        DICOM           Measurement      AI inference
        loader)         tool)            module)
```

The core provides a **plug-in contract** (an interface). Plug-ins implement that contract. The core discovers plug-ins at startup (or runtime) and delegates work to them.

**Radiology analogy:** imagine a viewer where the core handles pixel rendering and UI, but lung nodule detection, bone age assessment, and fracture detection are all plug-ins — each developed independently, each deployable without touching the core.

**When to use:** product-based apps, systems with a stable core but varying feature sets per customer, IDE-like tools.

---

## 3. Service-Based Architecture

**The pragmatic compromise.** It looks like microservices but with fewer, larger services (usually 4–12) and often a **shared database**. This is the pattern Mark Richards explicitly recommends as a "sweet spot" for most teams.

```
              ┌────────────────┐
              │   User / UI    │
              └────────┬───────┘
                       │
              ┌────────▼───────┐
              │   API Gateway  │
              └────────┬───────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
   │Patient  │    │Imaging  │    │Reporting│
   │Service  │    │Service  │    │Service  │
   └────┬────┘    └────┬────┘    └────┬────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
              ┌────────▼───────┐
              │ Shared DB      │  ← often a single DB
              │ (or a few)     │    or logically partitioned
              └────────────────┘
```

**Key difference from microservices:** services are **coarse-grained** (a whole domain, not a single function), and data is often shared. This means less coordination overhead but also less independence.

**When to use:** when microservices feel like overkill but the layered monolith is cracking. Great for mid-sized systems where you want **deployability** and **testability** without a full distributed-systems tax.

---

## 4. Service-Oriented Architecture (SOA)

**The enterprise grandparent.** SOA was the dominant pattern in the 2000s for large enterprises (banks, telecoms, hospitals). Its hallmark is a central **Enterprise Service Bus (ESB)** that handles orchestration, transformation, and routing between services.

```
   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │Business │   │Business │   │Business │   │Business │
   │Service 1│   │Service 2│   │Service 3│   │Service 4│
   └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘
        │             │             │             │
        └─────────────┴──┬──────────┴─────────────┘
                         │
              ┌──────────▼───────────┐
              │  Enterprise Service  │  ← orchestration,
              │        Bus (ESB)     │    transformation,
              └──────────┬───────────┘    routing, protocol
                         │                 mediation
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼─────┐    ┌─────▼────┐     ┌─────▼────┐
   │Legacy    │    │External  │     │Partner   │
   │Mainframe │    │CRM       │     │API       │
   └──────────┘    └──────────┘     └──────────┘
```

The ESB is both SOA's strength (integrates anything with anything) and its curse (becomes a bottleneck, a single point of failure, and a "god object"). This is why SOA scores high on **abstraction** and **integration** but poorly on **simplicity** and **agility** in the chart.

**When to use:** large enterprises with many heterogeneous legacy systems that must talk to each other. Rarely chosen for greenfield projects today — microservices or event-driven architectures have largely replaced it.

---

## 5. Event-Driven Architecture

**Reactive, asynchronous, decoupled.** Instead of services calling each other directly, they publish and subscribe to **events**. No component knows about its consumers.

There are two main flavors. Here's the **broker topology** (common):

```
     ┌──────────┐   publishes         ┌──────────┐
     │Producer A├────────────────────►│          │
     └──────────┘  "OrderPlaced"      │          │
                                      │  Event   │
     ┌──────────┐   publishes         │  Broker  │
     │Producer B├────────────────────►│  (Kafka, │
     └──────────┘  "ImageUploaded"    │  RabbitMQ│
                                      │   etc.)  │
                                      │          │
                  ┌───────────────────┤          │
                  │ subscribes        │          │
                  ▼                   └────┬─────┘
            ┌──────────┐                   │
            │Consumer 1│                   │ subscribes
            │(Billing) │                   ▼
            └──────────┘             ┌──────────┐
                                     │Consumer 2│
                                     │(Email)   │
                                     └──────────┘
```

**Radiology analogy:** when a CT scan completes, it publishes `ScanCompleted`. Three independent consumers react: the reporting worklist updates, the AI triage engine runs inference, the patient gets an SMS. The scanner doesn't know these consumers exist.

**Strength:** supreme decoupling, high scalability, natural for async workflows.
**Weakness:** debugging is hard (no linear call stack), eventual consistency, ordering is tricky.

**When to use:** real-time systems, IoT, workflow orchestration, any system where "things happen" and multiple parties need to react.

---

## 6. Space-Based Architecture

**Built for extreme, unpredictable load** — think Ticketmaster on concert release day, or a sports betting site during the Super Bowl. The bottleneck in most architectures is the **database**. Space-based removes the database from the request path.

The name comes from **tuple space** — a shared in-memory data grid that all processing units read and write to.

```
    ┌─────────────────────────────────────────────────────┐
    │              Load Balancer / Router                 │
    └──────┬───────────────┬──────────────┬───────────────┘
           │               │              │
      ┌────▼────┐     ┌────▼────┐    ┌────▼────┐
      │Processing│    │Processing│   │Processing│
      │  Unit 1  │    │  Unit 2  │   │  Unit N  │   ← spun up/down
      │          │    │          │   │          │     elastically
      │ ┌──────┐ │    │ ┌──────┐ │   │ ┌──────┐ │
      │ │In-Mem│ │    │ │In-Mem│ │   │ │In-Mem│ │   ← each has a
      │ │ Data │◄├────┤►│ Data │◄├───┤►│ Data │ │     replicated
      │ │ Grid │ │    │ │ Grid │ │   │ │ Grid │ │     data grid
      │ └──────┘ │    │ └──────┘ │   │ └──────┘ │
      └──────────┘    └──────────┘   └──────────┘
                            │
                            │ async, eventually
                            ▼
                   ┌─────────────────┐
                   │   Database      │   ← updated in
                   │  (eventual)     │     background
                   └─────────────────┘
```

Each **processing unit** holds a copy of the data in memory. Writes propagate among units through the grid; the actual database is updated asynchronously, out of band. To scale, you just launch more processing units.

**When to use:** very high concurrent user load with unpredictable spikes. Overkill for 99% of systems — this is the "nuclear option" of scalability.

---

## How to Think About Choosing

The chart's real lesson: **every "star" you gain somewhere, you lose somewhere else.** For example, microservices give you 5 stars on scalability and agility — but only 1 star on cost and simplicity.

A rough decision compass:

```
   "I need it fast, cheap, simple"       →  Layered / Modular Monolith
   "I need plugins / extensibility"       →  Microkernel
   "Monolith is breaking, not ready       →  Service-based
    for microservices"
   "Multiple teams, independent deploy"   →  Microservices
   "Legacy enterprise integration"        →  SOA
   "Async, reactive, decoupled"           →  Event-driven
   "Millions of users, elastic spikes"    →  Space-based
```
