---
title: "Microkernel (Plugin) Architecture"
description: How the microkernel pattern separates a stable core from feature-providing plugins via a contract — with real-world examples (VS Code, Eclipse, OsiriX) and the trade-offs.
---

## The Core Idea

The **microkernel** pattern separates a system into two parts:

1. **Core system** — provides the minimal, stable machinery (plugin registration, lifecycle, shared services) and knows *nothing* about specific features.
2. **Plugins** — independent modules that implement a well-defined contract and supply the actual features.

The coupling flows through the **contract (interface)**, not through concrete types. The core depends on the abstraction; plugins depend on the abstraction. This is the **Dependency Inversion Principle** applied at the architectural scale.

Real-world examples: VS Code extensions, Eclipse IDE, web browsers, Photoshop filters, OsiriX/Horos DICOM viewer plugins, even the Linux kernel's module system.

## Architectural Diagram

```
             ┌────────────────────────────────────────────┐
             │              CORE SYSTEM                   │
             │             (Microkernel)                  │
             │                                            │
             │   ┌─────────────────────────────────┐      │
             │   │   Plugin Registry / Loader      │      │
             │   │   - register()                  │      │
             │   │   - discover() at startup       │      │
             │   │   - dispatch(name, input)       │      │
             │   └──────────────┬──────────────────┘      │
             │                  │ depends on              │
             │                  ▼                         │
             │   ┌─────────────────────────────────┐      │
             │   │   IPlugin  (Contract)           │      │  ◄── STABLE
             │   │   + Name                        │      │      BOUNDARY
             │   │   + Execute(input)              │      │
             │   └─────────────────────────────────┘      │
             └───────────▲──────────▲──────────▲──────────┘
                         │          │          │
                         │  implements (each plugin)
                         │          │          │
                ┌────────┴──┐  ┌────┴─────┐  ┌─┴────────┐
                │ Plugin A  │  │ Plugin B │  │ Plugin C │
                │ Grayscale │  │  Invert  │  │ Sharpen  │
                └───────────┘  └──────────┘  └──────────┘

                 ◄───── replaceable / extensible ─────►
```

Notice the arrows: both the core *and* the plugins point at the contract. Nobody points at a concrete plugin. That's what keeps the core stable while the plugin ecosystem grows.

## When to Reach for It

Good fit when you have a **stable core domain** but expect **open-ended feature extension** — often by third parties or by yourself over time. Poor fit when features are tightly coupled and must share lots of internal state.

## C# Example — Image Filter Pipeline

A stubbed `ImageProcessor` that knows how to run filters but has zero knowledge of which filters exist.

### 1. The Plugin Contract (the only thing both sides agree on)

```csharp
// Core defines this. Plugins implement it.
public interface IImageFilter
{
    string Name { get; }
    byte[] Apply(byte[] imageData);
}
```

### 2. Plugin Implementations (interchangeable, independently developed)

```csharp
public class GrayscaleFilter : IImageFilter
{
    public string Name => "grayscale";

    public byte[] Apply(byte[] imageData)
    {
        Console.WriteLine("[Grayscale] converting to luminance...");
        // real pixel math would go here
        return imageData;
    }
}

public class InvertFilter : IImageFilter
{
    public string Name => "invert";

    public byte[] Apply(byte[] imageData)
    {
        Console.WriteLine("[Invert] flipping pixel values...");
        return imageData;
    }
}
```

### 3. The Core (Microkernel) — no knowledge of specific filters

```csharp
public class ImageProcessor
{
    private readonly Dictionary<string, IImageFilter> _filters =
        new(StringComparer.OrdinalIgnoreCase);

    // Registration — the "plug in" step
    public void Register(IImageFilter filter)
    {
        _filters[filter.Name] = filter
            ?? throw new ArgumentNullException(nameof(filter));
    }

    // Delegation — the core never does the work itself
    public byte[] Process(string filterName, byte[] data)
    {
        if (!_filters.TryGetValue(filterName, out var filter))
            throw new InvalidOperationException(
                $"No plugin registered for '{filterName}'. " +
                $"Available: {string.Join(", ", _filters.Keys)}");

        return filter.Apply(data);
    }

    public IReadOnlyCollection<string> AvailableFilters => _filters.Keys;
}
```

### 4. Wiring It Up (plugin discovery)

The simplest form — manual registration at startup:

```csharp
var processor = new ImageProcessor();

// Discovery step: in real systems this might scan a /plugins folder,
// read a config file, or be done via DI container registration.
processor.Register(new GrayscaleFilter());
processor.Register(new InvertFilter());

var dicomPixels = new byte[] { 10, 20, 30, 40 };
var result = processor.Process("grayscale", dicomPixels);

Console.WriteLine($"Available filters: {string.Join(", ", processor.AvailableFilters)}");
```

## Scaling Up: Runtime Discovery

In production systems, step 4 is often **automated** so you can drop a new DLL into a `plugins/` folder and the core picks it up without recompiling. Sketch:

```csharp
// Pseudocode — scan an assembly and auto-register every IImageFilter
foreach (var type in assembly.GetTypes()
             .Where(t => typeof(IImageFilter).IsAssignableFrom(t)
                         && !t.IsInterface && !t.IsAbstract))
{
    var plugin = (IImageFilter)Activator.CreateInstance(type)!;
    processor.Register(plugin);
}
```

With .NET's `System.Composition` (MEF) or a DI container like `Microsoft.Extensions.DependencyInjection`, you get this declaratively.

## Key Properties to Internalize

The pattern gives you four things worth naming explicitly. **Openness**: new features arrive without touching the core (Open/Closed Principle at architecture scale). **Isolation**: a buggy plugin can't corrupt the core's internals because it only sees the contract. **Independent evolution**: plugins can be versioned, shipped, and deployed separately. **Testability**: the core is trivial to test with fake `IImageFilter` stubs; each plugin is tested in isolation against the contract.

The cost is the contract itself — once it's public, changing it breaks every plugin. So design the interface carefully and keep it **narrow and stable**. That's the real engineering work in this pattern.