---
title: "highdicom — System & OOP Architecture"
---

> Source: https://github.com/ImagingDataCommons/highdicom (v0.27.0) · Analyzed: 2026-06-14 · Type: **Library / Package**
> See also: [User-Facing API & UX](./highdicom-ux.md)

## 1. Overview

`highdicom` is a pure-Python library that provides a **high-level, object-oriented API on
top of [`pydicom`](https://github.com/pydicom/pydicom)** for working with DICOM medical
imaging files. Its focus is the operations needed for machine learning, computer vision,
and computational image analysis: reading image frames (with the spatial arrangement and
pixel transforms `pydicom` does not handle), and **creating standards-compliant derived
DICOM objects** — segmentations, structured reports, parametric maps, presentation states,
annotations, key-object-selection documents, and secondary captures.

**Repo type — Library (evidence):**
- `pyproject.toml`: `name = "highdicom"`, `[tool.setuptools.packages.find] where = ["src"]`,
  versioned for PyPI; **no** `[project.scripts]` / console entry points.
- The surface is meant to be *imported* (`import highdicom as hd`), not *run*.
- `src/highdicom/py.typed` ships type information for downstream consumers.

**Design philosophy** (from `docs/development.rst`, `docs/overview.rst`):
| Principle | Consequence in the code |
|-----------|-------------------------|
| Interoperate with pydicom | Every SOP class subclasses `pydicom.dataset.Dataset` — no wrapper overhead. |
| Use standard DICOM terminology | Classes/attrs mirror DICOM IOD names even when not intuitive. |
| Strict encoding validation | Objects are *valid on construction*; no invalid intermediate state. |
| Tolerant decoding | Readers accept minor real-world deviations; validate assumptions rather than work around them. |
| Eager type conversion | `from_dataset()` reclasses pydicom datasets (and nested items) into highdicom types. |

**Tech stack:** Python 3.10–3.14; depends on `pydicom>=3.0.1`, `numpy>=1.19`,
`pillow>=8.3`, `pyjpegls`, `typing-extensions`; optional `pylibjpeg*` codecs.

## 2. System Context

Who/what uses the library and what it depends on.

```mermaid
flowchart LR
    dev(["ML / imaging developer<br/>(application code)"])
    subgraph hd["highdicom (library)"]
        api["Public API<br/>hd.imread · hd.seg.Segmentation · …"]
    end
    pydicom["pydicom<br/>(Dataset, file I/O, codecs)"]
    np["numpy / pillow"]
    codecs["pyjpegls · pylibjpeg<br/>(transfer-syntax codecs)"]
    files[("DICOM files / PACS<br/>(PS3.10)")]

    dev -->|import & call| api
    api --> pydicom
    api --> np
    pydicom --> codecs
    pydicom <-->|read / save_as| files
```

highdicom sits **above** pydicom: pydicom owns low-level parsing, encoding, and pixel
codecs; highdicom adds IOD-specific construction, validation, frame arrangement, and pixel
transforms.

## 3. High-Level Structure

The package is organized into a **core layer**, a set of **per-IOD subpackages** that all
follow the same internal shape, **cross-cutting utilities**, and a **private metadata
layer** that drives validation.

```mermaid
flowchart TD
    subgraph core["Core layer"]
        base["base.py — SOPClass"]
        image["image.py — _Image / Image"]
        volume["volume.py — Volume / VolumeGeometry"]
        content["content.py · base_content.py — shared sequences"]
    end
    subgraph iods["Per-IOD subpackages (sop.py + content.py + enum.py)"]
        seg["seg — Segmentation"]
        sr["sr — *SR documents"]
        pm["pm — ParametricMap"]
        pr["pr — Presentation States"]
        sc["sc — SCImage"]
        ko["ko — KeyObjectSelectionDocument"]
        ann["ann — MicroscopyBulkSimpleAnnotations"]
        legacy["legacy — LegacyConvertedEnhanced*"]
    end
    subgraph util["Cross-cutting utilities"]
        spatial["spatial.py"]
        pixels["pixels.py"]
        frame["frame.py"]
        io["io.py — ImageFileReader"]
        coding["coding_schemes.py"]
        color["color.py"]
        enum["enum.py"]
        uid["uid.py — UID"]
        valuerep["valuerep.py · utils.py"]
    end
    subgraph meta["Private metadata layer (validation)"]
        iodsmap["_iods.py — IOD_MODULE_MAP"]
        modules["_modules.py — MODULE_ATTRIBUTE_MAP"]
        modutil["_module_utils.py — checkers"]
    end

    iods --> core
    core --> meta
    iods --> meta
    iods --> util
    core --> util
```

| Path | Responsibility |
|------|----------------|
| `src/highdicom/base.py` | `SOPClass` — root of every SOP instance; file meta + patient/study/series/equipment attrs. |
| `src/highdicom/image.py` | `_Image`/`Image` — frame access, pixel decoding, volume extraction. |
| `src/highdicom/volume.py` | `Volume`, `VolumeGeometry`, `ChannelDescriptor` — 3D array + affine geometry. |
| `src/highdicom/content.py`, `base_content.py` | Reusable sequence/item classes (LUTs, pixel measures, plane position/orientation, specimen, equipment). |
| `src/highdicom/{seg,sr,pm,pr,sc,ko,ann,legacy}/` | One DICOM IOD family each: `sop.py` (SOP class), `content.py` (helpers), `enum.py`. |
| `src/highdicom/{spatial,pixels,frame,io,color,coding_schemes,enum,uid,valuerep,utils}.py` | Cross-cutting concerns. |
| `src/highdicom/_iods.py`, `_modules.py`, `_module_utils.py` | Declarative DICOM module/IOD definitions + validators (private). |

## 4. Components — inside the per-IOD pattern

Every derived-object subpackage repeats the **same three-part shape**, so learning one
(e.g. `seg/`) transfers to all the others. The SOP class composes content helpers and
delegates rule-checking to the private metadata layer.

```mermaid
flowchart TD
    user["caller: hd.seg.Segmentation(...)"]
    sop["seg/sop.py — Segmentation(_Image)"]
    cont["seg/content.py — SegmentDescription,<br/>DimensionIndexSequence"]
    en["seg/enum.py — SegmentationTypeValues, …"]
    shared["content.py — AlgorithmIdentificationSequence,<br/>PixelMeasuresSequence, …"]
    frame["frame.py — encode_frame()"]
    checker["_module_utils.check_required_attributes()"]
    maps["_iods.py / _modules.py — IOD & module maps"]

    user --> sop
    sop --> cont
    sop --> en
    sop --> shared
    sop --> frame
    sop --> checker
    checker --> maps
```

The **data-driven validation** is the architecturally distinctive choice: DICOM module and
IOD rules live as nested dictionaries (`MODULE_ATTRIBUTE_MAP` in `_modules.py`,
`IOD_MODULE_MAP` + `SOP_CLASS_UID_IOD_KEY_MAP` in `_iods.py`). Generic functions in
`_module_utils.py` (`check_required_attributes`, `construct_module_tree`,
`get_module_usage`, `is_attribute_in_iod`) walk that metadata. New IODs are added as data,
not as bespoke validation code.

## 5. OOP & Class Architecture

### 5.1 The SOP inheritance spine

```mermaid
classDiagram
    class Dataset {
        <<pydicom>>
    }
    class SOPClass {
        +transfer_syntax_uid
        +copy_patient_and_study_information()
        +copy_specimen_information()
        #_add_contributing_equipment()
    }
    class _Image {
        +from_dataset(dataset, copy)$
        +get_frame(n)
        +get_volume()
        +pixel_array
        +number_of_frames
    }
    class Image {
        +__init__() ⚠ raises RuntimeError
    }
    Dataset <|-- SOPClass
    SOPClass <|-- _Image
    _Image <|-- Image
```

`SOPClass` (`base.py:27`) is the root. `_Image` (`image.py:1119`) adds image behavior and
the `from_dataset` factory; the public `Image` (`image.py:6386`) deliberately **forbids
direct construction** (`__init__` raises `RuntimeError`) — you obtain one via `imread()` /
`from_dataset()` so the type is always backed by a real dataset.

### 5.2 The derived-object SOP classes

```mermaid
classDiagram
    class SOPClass
    class _Image
    class _SR

    SOPClass <|-- _Image
    _Image <|-- Segmentation
    SOPClass <|-- _SR
    _SR <|-- EnhancedSR
    _SR <|-- ComprehensiveSR
    _SR <|-- Comprehensive3DSR
    SOPClass <|-- ParametricMap
    SOPClass <|-- SCImage
    SOPClass <|-- KeyObjectSelectionDocument
    SOPClass <|-- MicroscopyBulkSimpleAnnotations
    SOPClass <|-- GrayscaleSoftcopyPresentationState
    SOPClass <|-- LegacyConvertedEnhancedCTImage
```

`Segmentation` (`seg/sop.py:160`) extends `_Image` (it *is* an image). The SR documents
share an abstract-ish `_SR` base (`sr/sop.py`). The remaining derived objects extend
`SOPClass` directly. (`pr/sop.py` also defines `PseudoColor…`, `Color…`, and
`AdvancedBlendingPresentationState`; `legacy/sop.py` adds MR and PET variants.)

### 5.3 The geometry hierarchy (ABC)

```mermaid
classDiagram
    class _VolumeBase {
        <<abstract>>
        +spatial_shape*
        +coordinate_system*
        +affine*
        +map_indices_to_reference()*
    }
    class VolumeGeometry {
        +pixel_spacing
        +get_plane_positions()
        +to_patient_orientation()
    }
    class Volume {
        +array
        +channel descriptors
    }
    class ChannelDescriptor
    _VolumeBase <|-- VolumeGeometry
    _VolumeBase <|-- Volume
    Volume o-- ChannelDescriptor : composes
```

`_VolumeBase` (`volume.py:236`) is a true `ABC` with `@abstractmethod` geometry contract.
`VolumeGeometry` carries spatial metadata only; `Volume` adds the numpy array plus
non-spatial `ChannelDescriptor`s — note `Volume` is **not** a DICOM SOP class (it does not
inherit `Dataset`); it is a pure in-memory geometric abstraction.

### 5.4 Patterns in use

| Pattern | Where | Why |
|---------|-------|-----|
| Inheritance from `pydicom.Dataset` | all SOP & many content classes | seamless pydicom interop, zero wrapping. |
| **Factory classmethod** (`from_dataset`, `from_file`) | `_Image` and all SOP classes | eager conversion of existing datasets; defined on the base so subclasses inherit it (`Self` return). |
| **Construction-forbidding base** | `Image.__init__` raises | guarantees the public `Image` is always backed by a dataset. |
| **Data-driven validation** | `_iods`/`_modules`/`_module_utils` | one declarative source of truth for many IODs; no per-class validation code. |
| Abstract base class | `_VolumeBase(ABC)` | enforce geometry interface across `Volume`/`VolumeGeometry`. |
| Composition | `Volume` ↔ `ChannelDescriptor`; SOP classes ↔ content helpers | keep constructors lean, model DICOM sequences as objects. |
| Enum-based type safety | `enum.py` + per-module `enum.py` | accept enum *or* string; normalize to canonical DICOM values. |

## 6. Key Flows

### 6.1 Create & encode a derived object (Segmentation)

```mermaid
sequenceDiagram
    participant U as Caller
    participant S as Segmentation.__init__
    participant V as _module_utils
    participant F as frame.encode_frame
    participant D as pydicom (save_as)

    U->>S: Segmentation(source_images, pixel_array, segment_descriptions, …)
    S->>S: super().__init__() (SOPClass: file meta, UIDs, equipment)
    S->>V: check_required_attributes(IOD map)
    V-->>S: ok / raise on missing
    S->>F: encode frames per transfer syntax
    F-->>S: encoded PixelData
    S-->>U: valid Segmentation (a pydicom Dataset)
    U->>D: seg.save_as("seg.dcm")
```

### 6.2 Read & decode an image

```mermaid
sequenceDiagram
    participant U as Caller
    participant I as imread()
    participant FD as Image.from_dataset
    participant R as ImageFileReader (io.py)
    participant P as pixels.py transforms

    U->>I: hd.imread("ct.dcm", lazy_frame_retrieval=False)
    I->>FD: Image.from_file → from_dataset (reclass dataset)
    FD-->>I: Image instance
    I-->>U: Image
    U->>R: im.get_frame(1, apply_voi_transform=True)
    R->>P: modality LUT → VOI LUT → (palette / ICC)
    P-->>U: numpy frame
```

## 7. Extension Points

- **Subclass `SOPClass`** (or `_Image`) to add a new derived object — follow the
  `sop.py` + `content.py` + `enum.py` triad of an existing subpackage as the template.
- **Register a new IOD** by adding entries to `MODULE_ATTRIBUTE_MAP` / `IOD_MODULE_MAP` /
  `SOP_CLASS_UID_IOD_KEY_MAP`; the generic checkers then validate it for free.
- **Pixel & frame customization** through `pixels.py` (modality/VOI/palette/ICC transforms)
  and `frame.py` (`encode_frame`/`decode_frame`) — codec support flows from pydicom's
  optional `pylibjpeg*`/`pyjpegls` plugins.
- **Coding schemes / terminology** via `coding_schemes.py` and pydicom's `codes` dictionary
  (SNOMED-CT, DCM, UCUM) — passed as `CodedConcept`s into content objects.
- **Lazy I/O** via `io.ImageFileReader` and the `lazy_frame_retrieval=True` flag for large
  multi-frame objects.

## 8. Key Abstractions / Glossary

| Term | Meaning here |
|------|--------------|
| **SOP / SOP Instance** | Service-Object Pair — one DICOM object instance; modeled by `SOPClass`. |
| **SOP Class UID** | Identifies the *kind* of object; maps to an IOD via `SOP_CLASS_UID_IOD_KEY_MAP`. |
| **IOD** | Information Object Definition — the set of modules that compose a SOP class. |
| **Module / Attribute Type** | Group of attributes; type 1/1C/2/2C/3 = required→optional (`AttributeTypeValues`). |
| **Frame of Reference / coordinate system** | `CoordinateSystemNames` (PATIENT vs SLIDE) governing spatial layout. |
| **Coded concept** | A standardized (scheme, code, meaning) triple; `CodedConcept`/pydicom `Code`. |
| **Modality / VOI LUT** | Pixel transforms (rescale, then window/level) applied on read (`pixels.py`). |
| **Volume** | In-memory 3D array + affine geometry; not a DICOM object. |

## 9. Open Questions & Notes

- The exact ordering and optionality of the read-time pixel-transform pipeline (modality →
  VOI → presentation → palette → ICC) is described from `docs/pixel_transforms.rst` and the
  `get_frame`/`get_volume` parameter defaults; the precise interaction of all flags was not
  traced line-by-line in `image.py`'s `_CombinedPixelTransform`.
- `image.py` is very large (~7k lines); this doc covers its public boundary and the
  `_Image`/`Image` split, not every private helper (`_SQLTableDefinition`,
  `_build_luts`, etc.).
- The SR content-tree/template system (`sr/value_types.py`, `sr/templates.py`, TID 1500) is
  rich and only summarized here; the architecture doc treats it as one component — see the
  UX doc and `docs/sr.rst`/`docs/tid1500.rst` for the content-item taxonomy.
- Some `_SR` base is treated as "abstract-ish": it is the shared parent of the three SR SOP
  classes; whether it is a formal `ABC` was not confirmed at the class-declaration level.
