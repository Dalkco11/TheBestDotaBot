# Octarine SDK — Utility Script Reference

This document describes the architecture and patterns of the **Lasthit Marker** script as a reference for writing utility scripts on the Octarine wrapper SDK.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Entry Point Pattern](#entry-point-pattern)
- [Event System](#event-system)
- [Menu System](#menu-system)
- [Translations (Localization)](#translations-localization)
- [Entity Filtering](#entity-filtering)
- [Model / Data Layer](#model--data-layer)
- [GUI / Rendering](#gui--rendering)
- [Ability Management](#ability-management)
- [Key SDK APIs](#key-sdk-apis)
- [Conventions & Style](#conventions--style)

---

## Project Structure

```
my-script/
├── src/
│   ├── index.ts          # Entry point — event wiring & main class
│   ├── menu.ts           # Menu UI definition
│   ├── model.ts          # Data model wrapping game entities
│   ├── gui.ts            # Rendering / drawing logic
│   ├── manager.ts        # Domain logic (e.g. ability filtering)
│   └── translations.ts   # Localization loader (side-effect import)
├── scripts_files/
│   ├── icons/            # SVG icons for menu entries
│   │   └── token.svg
│   └── translations/     # Translation JSON files
│       ├── en.json
│       ├── ru.json
│       └── cn.json
├── package.json          # main: "src/index.ts", devDependencies only
├── tsconfig.json
└── .editorconfig
```

Key points:
- `package.json` field `"main": "src/index.ts"` declares the script entry point.
- All runtime dependencies come from the wrapper SDK import path.
- `devDependencies` include TypeScript, ESLint, Prettier — no runtime packages.
- Static assets (icons, translations) live under `scripts_files/`.

---

## Entry Point Pattern

The entry point uses an **anonymous class instantiated immediately** — no exported module, no `main()` function:

```ts
// src/index.ts
import "./translations"  // side-effect: registers localization

import {
  DOTAGameState,
  DOTAGameUIState,
  Entity,
  EventsSDK,
  GameRules,
  GameState,
  Unit
} from "github.com/octarine-public/wrapper/index"

import { MenuManager } from "./menu"

new (class CMyScript {
  private readonly menu = new MenuManager()

  constructor() {
    EventsSDK.on("Draw", this.Draw.bind(this))
    EventsSDK.on("EntityCreated", this.EntityCreated.bind(this))
    EventsSDK.on("EntityDestroyed", this.EntityDestroyed.bind(this))
    EventsSDK.on("GameEnded", this.GameEnded.bind(this))
  }

  protected Draw() {
    if (GameState.UIState !== DOTAGameUIState.DOTA_GAME_UI_DOTA_INGAME) {
      return
    }
    // rendering logic
  }

  protected EntityCreated(entity: Entity) {
    // track new entities
  }

  protected EntityDestroyed(entity: Entity) {
    // clean up tracked entities
  }

  protected GameEnded() {
    // reset state
  }
})()
```

Rules:
1. **Wrap the class in `new (class ClassName { ... })()`** — this is the standard bootstrap pattern.
2. **Bind all event handlers** in the constructor via `.bind(this)`.
3. **Side-effect imports** (like translations) go at the very top.
4. **Guard rendering** — always check `GameState.UIState` and `GameRules.GameState` before drawing.

---

## Event System

Subscribe to SDK events in the constructor via `EventsSDK.on(eventName, callback)`.

### Commonly used events

| Event | Signature | Purpose |
|---|---|---|
| `Draw` | `() => void` | Render each frame (rendering only!) |
| `EntityCreated` | `(entity: Entity) => void` | Entity entered the world |
| `EntityDestroyed` | `(entity: Entity) => void` | Entity removed from the world |
| `EntityVisibleChanged` | `(entity: Entity) => void` | Visibility toggled |
| `LifeStateChanged` | `(entity: Entity) => void` | Alive/dead state changed |
| `UnitItemsChanged` | `(entity: Unit) => void` | Unit's inventory changed |
| `UnitAbilitiesChanged` | `(entity: Unit) => void` | Unit's spell list changed |
| `UnitPropertyChanged` | `(entity: Unit) => void` | Generic property update on a unit |
| `GameStarted` | `() => void` | Game lobby begins |
| `GameEnded` | `() => void` | Game finished |

### Pattern: maintaining an entity list

```ts
private readonly units: BaseModel[] = []

protected EntityCreated(entity: Entity) {
  if (this.shouldTrack(entity) && this.isValid(entity)) {
    if (!this.units.some(x => x.Base === entity)) {
      this.units.push(new BaseModel(entity))
    }
  }
}

protected EntityDestroyed(entity: Entity) {
  this.units.removeCallback(x => x.Base === entity)
}

protected LifeStateChanged(entity: Entity) {
  if (!entity.IsAlive) {
    this.units.removeCallback(x => x.Base === entity)
  }
}

protected EntityVisibleChanged(entity: Entity) {
  if (this.isValid(entity)) {
    // add if not already tracked
  } else {
    this.units.removeCallback(x => x.Base === entity)
  }
}
```

> **Note:** The SDK extends `Array` with `.removeCallback(predicate)` and `.remove(item)` helpers.

---

## Menu System

Menu entries are created through `Menu.AddEntry()` and chained node methods.

```ts
import { Color, GameState, Menu } from "github.com/octarine-public/wrapper/index"

export class MenuManager {
  public readonly State: Menu.Toggle

  private readonly path = "github.com/octarine-public/my-script/scripts_files"
  private readonly entry = Menu.AddEntry("Visual")  // top-level category
  private readonly icon = this.path + "/icons/token.svg"
  private readonly node = this.entry.AddNode("My Script", this.icon)

  constructor() {
    this.node.SortNodes = false
    this.State = this.node.AddToggle("State", true)
    // more controls...
  }
}
```

### Available menu controls

| Method | Type | Example |
|---|---|---|
| `AddToggle(name, default)` | `Menu.Toggle` | On/off switch |
| `AddSlider(name, default, min, max, precision?, tooltip?)` | `Menu.Slider` | Numeric slider |
| `AddColorPicker(name, defaultColor)` | `Menu.ColorPicker` | Color selection |
| `AddNode(name, icon?)` | `Menu.Node` | Sub-folder/section |
| `AddImageSelector(name, values[])` | `Menu.ImageSelector` | Image-based multi-select |
| `AddShortDescription(title, body)` | `Menu.ShortDescription` | Info text |
| `AddKeyBind(name, defaultKey)` | `Menu.KeyBind` | Hotkey binding |
| `AddDropdown(name, options[], default?)` | `Menu.Dropdown` | Dropdown list |

### Dynamic visibility

Toggle visibility of controls at runtime:

```ts
this.abilityState.OnValue(call => {
  this.Rounding.IsHidden = !call.value
  this.AbilitySize.IsHidden = !call.value
  this.node.Update()  // always call Update() after changing visibility
})
```

### Grouped colors (sub-node)

```ts
const colorsNode = this.node.AddNode("Colors")
this.AllyInactive  = colorsNode.AddColorPicker("Ally inactive",  new Color(0, 100, 0))
this.AllyActive    = colorsNode.AddColorPicker("Ally active",    new Color(124, 252, 0))
this.EnemyInactive = colorsNode.AddColorPicker("Enemy inactive", new Color(139, 0, 0))
this.EnemyActive   = colorsNode.AddColorPicker("Enemy active",   new Color(255, 69, 0))
```

---

## Translations (Localization)

Create JSON files under `scripts_files/translations/` keyed by the exact strings used in menu labels:

```json
// scripts_files/translations/ru.json
{
  "State": "Состояние",
  "My Script": "Мой скрипт",
  "Colors": "Цвета"
}
```

Load them via a side-effect module:

```ts
// src/translations.ts
import { Menu, Utils } from "github.com/octarine-public/wrapper/index"

function Load(name: string) {
  return new Map<string, string>(
    Object.entries(Utils.readJSON(`translations/${name}.json`))
  )
}

Menu.Localization.AddLocalizationUnit("russian", Load("ru"))
Menu.Localization.AddLocalizationUnit("english", Load("en"))
Menu.Localization.AddLocalizationUnit("chinese", Load("cn"))
```

Import it at the top of `index.ts` as a bare import:

```ts
import "./translations"
```

Supported language keys: `"russian"`, `"english"`, `"chinese"`.

---

## Entity Filtering

Use `instanceof` checks and entity property flags to decide which entities to track:

```ts
private shouldUnit(entity: Entity): entity is Unit {
  if (!(entity instanceof Unit) || entity.IsRoshan || entity.IsCourier) {
    return false
  }
  if (entity instanceof Miniboss || entity instanceof Outpost) {
    return false
  }
  if (entity instanceof TwinGate || entity instanceof Lantern) {
    return false
  }
  // Filter by name for edge cases
  if (this.excludedEntities.has(entity.Name)) {
    return false
  }
  return entity.IsCreep || entity.IsBuilding
}
```

### Useful Unit properties for filtering

| Property | Type | Description |
|---|---|---|
| `IsValid` | `boolean` | Entity exists and is valid |
| `IsAlive` | `boolean` | Not dead |
| `IsVisible` | `boolean` | Currently visible on map |
| `IsSpawned` | `boolean` | Has spawned into the world |
| `IsMyHero` | `boolean` | Is the local player's hero |
| `IsCreep` | `boolean` | Is a lane/jungle creep |
| `IsBuilding` | `boolean` | Is a tower/barracks/ancient |
| `IsRoshan` | `boolean` | Is Roshan |
| `IsCourier` | `boolean` | Is a courier |
| `IsEnemy(target?)` | `boolean` | Enemy relative to local player or target |
| `IsDeniable` | `boolean` | Can be denied by allies |
| `HasNoHealthBar` | `boolean` | Health bar is hidden |

### Available entity classes for `instanceof`

`Unit`, `Hero`, `Building`, `Miniboss`, `Outpost`, `TwinGate`, `Lantern`, `npc_dota_brewmaster_fire`, etc.

---

## Model / Data Layer

Wrap game entities in a model class to encapsulate business logic and keep rendering code clean:

```ts
import { Ability, ATTACK_DAMAGE_STRENGTH, Unit } from "github.com/octarine-public/wrapper/index"

export class BaseModel {
  private static readonly minRange = 2500
  private abilities: Ability[] = []

  constructor(public readonly Base: Unit) {}

  public get HP()           { return this.Base.HP }
  public get IsDeniable()   { return this.Base.IsDeniable }
  public get HasNoHealthBar() { return this.Base.HasNoHealthBar }

  public IsEnemy(ent?: BaseModel) {
    return this.Base.IsEnemy(ent?.Base)
  }

  public MinDamage(target: BaseModel) {
    return this.Base.GetAttackDamage(target.Base, ATTACK_DAMAGE_STRENGTH.DAMAGE_MIN)
  }

  public AvgDamage(target: BaseModel) {
    return this.Base.GetAttackDamage(target.Base, ATTACK_DAMAGE_STRENGTH.DAMAGE_AVG)
  }

  public UnitAbilitiesChanged(abilities: Ability[]) {
    this.abilities = abilities
  }

  protected Distance2D(target: BaseModel) {
    return this.Base.Distance2D(target.Base)
  }

  protected CanAttack(target: BaseModel) {
    return this.Distance2D(target) <=
      this.Base.GetAttackRange(target.Base, BaseModel.minRange)
  }
}
```

Key SDK methods used:
- `Unit.GetAttackDamage(target, damageType)` — calculates attack damage accounting for armor, damage type, etc.
- `Unit.GetAttackRange(target?, bonusRange?)` — returns effective attack range.
- `Unit.Distance2D(target)` — distance between two entities.
- `Ability.GetDamage(target)` — ability damage against a target.
- `Ability.CanBeCasted()` — checks cooldown, mana, silence, etc.

---

## GUI / Rendering

All drawing happens inside the `Draw` event handler. Use `RendererSDK` for 2D drawing and `GUIInfo` for screen scaling.

```ts
import {
  Color,
  GUIInfo,
  Rectangle,
  RendererSDK,
  Vector2
} from "github.com/octarine-public/wrapper/index"

export class GUIMarker {
  private readonly position = new Rectangle()
  private readonly size = new Vector2()

  public Update(
    position: Nullable<Vector2>,
    healthBarSize: Vector2,
    additionalSize: number
  ) {
    if (position === undefined) return false
    const size = 17 + additionalSize * 4
    this.position.pos1.CopyFrom(position)
    this.position.pos2.CopyFrom(position.Add(healthBarSize))
    this.size.CopyFrom(GUIInfo.ScaleVector(size, size))
    return true
  }

  public DrawBar(pos1: Vector2, size: Vector2, color: Color) {
    RendererSDK.FilledRect(pos1, size, color)
  }

  public DrawIcon(texture: string, pos: Vector2, size: Vector2, rounding: number) {
    RendererSDK.Image(texture, pos, rounding, size, Color.White)
  }
}
```

### Key rendering APIs

| Method | Description |
|---|---|
| `RendererSDK.FilledRect(pos, size, color)` | Draw a filled rectangle |
| `RendererSDK.RectRounded(pos, size, rounding, fillColor, borderColor, borderWidth)` | Rounded rect with border |
| `RendererSDK.Image(texture, pos, rounding, size, color)` | Draw a texture/image |
| `GUIInfo.ScaleVector(x, y)` | Scale a size vector for current resolution |
| `GUIInfo.ScaleHeight(v)` | Scale a single value by screen height |
| `Unit.HealthBarPosition()` | Get the screen-space position of a unit's HP bar |
| `Unit.HealthBarSize` | Get the size of the HP bar in screen-space |

### Pattern: position icons above health bars

```ts
const size = target.Base.HealthBarSize
const position = target.Base.HealthBarPosition()
if (position === undefined) continue

// icons go above the health bar
const iconY = position.y - iconSize.y - border * 2
const iconX = position.x + (size.x + border) / 2
```

---

## Ability Management

Filter and expose hero abilities/items for display:

```ts
import { Ability, DAMAGE_TYPES, Unit } from "github.com/octarine-public/wrapper/index"

export class AbilityManager {
  constructor(private readonly menu: MenuManager) {}

  public Get(source: Unit): Ability[] {
    if (!source.IsMyHero) return []
    const abilities: Ability[] = []

    for (const ability of source.Spells) {
      if (this.shouldDrawable(ability)) {
        abilities.push(ability)
        this.menu.AddItem(ability.Name)
      }
    }
    for (const item of source.Items) {
      if (this.shouldDrawable(item)) {
        abilities.push(item)
        this.menu.AddItem(item.Name)
      }
    }
    return abilities
  }

  private shouldDrawable(abil: Nullable<Ability>): abil is Ability {
    if (abil === undefined || !abil.IsValid) return false
    if (!abil.IsNuke() || abil.IsUltimate || abil.IsPassive) return false
    return abil.ShouldBeDrawable && abil.DamageType !== DAMAGE_TYPES.DAMAGE_TYPE_NONE
  }
}
```

### Useful Ability properties

| Property / Method | Description |
|---|---|
| `IsValid` | Ability exists and is valid |
| `IsNuke()` | Has active targeted/AoE damage |
| `IsUltimate` | Is an ultimate ability |
| `IsPassive` | Is a passive ability |
| `ShouldBeDrawable` | SDK-determined flag for drawable abilities |
| `DamageType` | `DAMAGE_TYPES` enum (PHYSICAL, MAGICAL, PURE, NONE) |
| `CanBeCasted()` | Ready to use (off cooldown, has mana, not silenced) |
| `GetDamage(target)` | Calculate damage against a specific target |
| `TexturePath` | Path to the ability's icon texture |
| `Name` | Internal name (e.g. `"item_dagon_5"`, `"zuus_arc_lightning"`) |

---

## Key SDK APIs

### Imports

All SDK types are imported from a single path:

```ts
import { ... } from "github.com/octarine-public/wrapper/index"
```

### Common types

| Type | Description |
|---|---|
| `Entity` | Base class for all game objects |
| `Unit` | Entity with health, abilities, movement |
| `Ability` | Spell or item ability |
| `Color` | RGB color (`new Color(r, g, b)`) |
| `Vector2` / `Vector3` | 2D/3D vectors |
| `Rectangle` | 2D rectangle with `pos1`, `pos2`, `Width`, `Height`, `Size` |
| `Nullable<T>` | `T | undefined` — SDK-wide nullable pattern |

### Game state

| API | Description |
|---|---|
| `GameState.UIState` | Current UI state (`DOTAGameUIState` enum) |
| `GameState.RawGameTime` | Game clock in seconds |
| `GameRules` | Nullable game rules object |
| `GameRules.GameState` | Current game phase (`DOTAGameState` enum) |

### Entity access

| API | Description |
|---|---|
| `Unit.Spells` | Array of the unit's abilities |
| `Unit.Items` | Array of the unit's items |
| `Unit.HP` | Current health |
| `Unit.MaxHP` | Maximum health |
| `Unit.HPPercentDecimal` | HP as a 0–1 fraction |

### Array extensions (SDK-provided)

| Method | Description |
|---|---|
| `.remove(item)` | Remove first occurrence |
| `.removeCallback(predicate)` | Remove first match by predicate |
| `.orderBy(selector)` | Sort in-place |
| `.clear()` | Empty the array |

---

## Conventions & Style

- **Indentation:** Tabs (4-space width), as defined in `.editorconfig`.
- **Quotes:** Single quotes for `.ts` files (enforced by Prettier/ESLint).
- **Semicolons:** None (no-semicolons style).
- **Line endings:** LF.
- **Naming:** `PascalCase` for classes and public methods, `camelCase` for local variables and private fields.
- **Constants:** `UPPER_CASE` or `PascalCase` static readonly fields.
- **No runtime dependencies** — only `devDependencies` in `package.json`.
- **Translations:** All user-facing menu strings should have entries in translation JSONs.
- **Icons:** SVG format, stored in `scripts_files/icons/`.
- **Module paths:** Use the full `"github.com/octarine-public/wrapper/index"` import path.
