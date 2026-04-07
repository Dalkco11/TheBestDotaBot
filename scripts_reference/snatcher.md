# Octarine SDK Utility Script Reference

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript project using the Octarine public wrapper SDK. Uses Yarn as the package manager.

**IMPORTANT:** `github.com/octarine-public/wrapper/index` is a **local path on disk**, NOT a URL to fetch from the internet. The wrapper SDK source code is located at `C:\github.com\octarine-public\wrapper`. Do NOT attempt to fetch it from the web — read the files directly from disk at that path.

## SDK Reference

The `AGENTS.md` file in the wrapper SDK (`C:\github.com\octarine-public\wrapper\AGENTS.md`) contains documentation and context for the API. When writing new scripts or features, read this file directly from disk for available APIs, types, and usage patterns.

## Commands

- **Install dependencies:** `yarn install`
- **Type check:** `yarn check-types`
- **Lint:** `yarn lint`
- **Check circular deps:** `yarn check-circular`

## Conventions

- **TypeScript:** Strict mode enabled, experimental decorators enabled, ESNext target.
- **Formatting:** 2 spaces for indentation, UTF-8, LF line endings, trailing newline (see `.editorconfig`).
- **Imports:** Modules use path-style imports from the Octarine wrapper (e.g., `import { ... } from "github.com/octarine-public/wrapper/index"`).

---

## How to Write a Utility Script

This section describes the architecture and patterns used to build utility scripts on top of the Octarine SDK. Use the `snatcher` project as the canonical reference implementation.

### Project Structure

```
my-script/
├── package.json          # name, main: "src/index.ts", devDependencies
├── tsconfig.json         # strict, ESNext, experimentalDecorators, noEmit
├── .editorconfig         # 2 spaces, LF, UTF-8
├── .eslintrc.json        # linting config
├── src/
│   ├── index.ts          # Entry point — instantiates main class
│   ├── translations.ts   # Localization loader (optional)
│   ├── menu.ts           # MenuManager — all menu configuration
│   ├── manager.ts        # Business logic manager
│   ├── gui/              # GUI rendering classes (optional)
│   └── models/           # Data models, entity models, helpers
└── scripts_files/        # Runtime assets (images, particles, translations)
```

### Entry Point Pattern (`src/index.ts`)

The entry point is an **immediately-instantiated anonymous class**. The constructor wires up all event subscriptions and creates managers.

```typescript
import "./translations"

import {
  Entity,
  EventsSDK,
  InputEventSDK,
  LocalPlayer,
  Unit,
  VMouseKeys
} from "github.com/octarine-public/wrapper/index"

import { MenuManager } from "./menu"
import { MyManager } from "./manager"

new (class CMyScript {
  private readonly menu = new MenuManager()
  private readonly manager = new MyManager(this.menu)

  constructor() {
    // Core lifecycle events
    EventsSDK.on("PostDataUpdate", this.PostDataUpdate.bind(this))
    EventsSDK.on("Draw", this.Draw.bind(this))
    EventsSDK.on("GameEnded", this.GameEnded.bind(this))

    // Entity lifecycle
    EventsSDK.on("EntityCreated", this.EntityCreated.bind(this))
    EventsSDK.on("EntityDestroyed", this.EntityDestroyed.bind(this))

    // Game events
    EventsSDK.on("GameEvent", this.GameEvent.bind(this))
    EventsSDK.on("ChatEvent", this.ChatEvent.bind(this))

    // Unit state changes
    EventsSDK.on("LifeStateChanged", this.LifeStateChanged.bind(this))
    EventsSDK.on("UnitAbilitiesChanged", this.UnitAbilitiesChanged.bind(this))
    EventsSDK.on("UnitItemsChanged", this.UnitItemsChanged.bind(this))
    EventsSDK.on("UnitPropertyChanged", this.UnitPropertyChanged.bind(this))
    EventsSDK.on("HumanizerStateChanged", this.HumanizerStateChanged.bind(this))

    // Order interception
    EventsSDK.on("PrepareUnitOrders", this.PrepareUnitOrders.bind(this))

    // Input
    InputEventSDK.on("MouseKeyDown", this.MouseKeyDown.bind(this))
    InputEventSDK.on("MouseKeyUp", this.MouseKeyUp.bind(this))

    // Menu change callback
    this.menu.MenuChanged(() => this.reset())
  }

  private get hasLocalHero() {
    return LocalPlayer?.Hero !== undefined
  }

  // Implement event handlers...
})()
```

### Event Lifecycle

| Event | When | Typical Use |
|---|---|---|
| `PostDataUpdate(delta)` | Every frame (with delta time) | Main logic loop: check conditions, execute actions |
| `Draw` | Every render frame | GUI rendering only (RendererSDK calls) |
| `EntityCreated(entity)` | Entity appears in game | Track entities in arrays/sets |
| `EntityDestroyed(entity)` | Entity removed from game | Remove from tracked collections |
| `GameEnded` | Match ends | Reset all state |
| `GameEvent(name, obj)` | Game event fires | React to kills, damage, etc. |
| `ChatEvent(msgType)` | Chat message | React to system messages |
| `LifeStateChanged(entity)` | Unit dies or respawns | Update alive/dead tracking |
| `PrepareUnitOrders(order)` | Before an order executes | Block/modify orders, return `false` to cancel |
| `HumanizerStateChanged` | Humanizer toggled | Hide/show menu, reset state |
| `UnitAbilitiesChanged(unit)` | Abilities change | Refresh ability models |
| `UnitItemsChanged(unit)` | Items change | Refresh item tracking |
| `ControllableByPlayerMaskChanged(unit)` | Controllable state changes | Add/remove from controllable list |
| `ParticleCreated(particle)` | Particle spawns | Detect game events via particles |

**Key pattern:** Always guard `PostDataUpdate` and `Draw` with:
```typescript
if (delta === 0 || !this.hasLocalHero || ExecuteOrder.DisableHumanizer) {
  return
}
```

### Menu System Pattern (`src/menu.ts`)

All menu items live in a dedicated `MenuManager` class. The menu tree is built in the constructor.

```typescript
import {
  Color,
  ExecuteOrder,
  ImageData,
  Menu
} from "github.com/octarine-public/wrapper/index"

export class MenuManager {
  // 1. Create the base entry under a category
  private readonly base = Menu.AddEntry("Utility")
  private readonly icon = ImageData.GetItemTexture("item_aegis")
  private readonly tree = this.base.AddNode("My Script", this.icon, undefined, 0)

  // 2. Add controls
  private readonly state: Menu.Toggle
  // ... more controls

  constructor() {
    this.state = this.tree.AddToggle("State", false)

    // Short description (shown when humanizer is off)
    this.tree.AddShortDescription(
      "Required humanizer",
      "Enable (settings -> humanizer)"
    )
  }

  // 3. Expose state via getters
  public get State() {
    return this.state.value && !this.state.IsHidden
  }

  // 4. Humanizer visibility toggling
  public HumanizerStateChanged() {
    const disabled = ExecuteOrder.DisableHumanizer
    this.state.IsHidden = disabled
    this.tree.IconColor = disabled ? Color.Gray : Color.White
    this.tree.Update()
  }

  // 5. Central callback registration for menu changes
  public MenuChanged(callback: () => void) {
    this.state.OnValue(_ => callback())
  }
}
```

**Available Menu Controls:**

| Control | Method | Usage |
|---|---|---|
| Toggle (on/off) | `node.AddToggle(name, default)` | Enable/disable features |
| Dropdown | `node.AddDropdown(name, options)` | Select from list |
| Slider | `node.AddSlider(name, default, min, max)` | Numeric value |
| KeyBind | `node.AddKeybind(name, defaultKey, tooltip)` | Hotkey binding |
| ImageSelector | `node.AddImageSelector(name, images, defaults)` | Select items by icon |
| Sub-node | `node.AddNode(name, icon)` | Nested menu group |
| ShortDescription | `node.AddShortDescription(title, text)` | Info/warning text |

**Menu Persistence:** Changes are automatically saved. Use `Menu.Base.SaveConfigASAP = true` to force immediate save (e.g., after drag operations).

**KeyBind modes:**
- **Toggle:** Press once to enable, press again to disable (`OnPressed`)
- **Hold:** Active only while key is held (`OnPressed` / `OnRelease`)

### Translations Pattern (`src/translations.ts`)

```typescript
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

Translation JSON files go in `scripts_files/translations/`. Keys are menu item names, values are localized strings.

### Entity Tracking Pattern

Track entities in typed arrays. Add on `EntityCreated`, remove on `EntityDestroyed`:

```typescript
private readonly runes: Rune[] = []
private readonly physicalItems: PhysicalItem[] = []
private readonly controllables: BaseUnitModel[] = []

protected EntityCreated(entity: Entity) {
  if (entity instanceof Rune) {
    this.runes.push(entity)
  }
  if (entity instanceof PhysicalItem) {
    this.physicalItems.push(entity)
  }
  if (entity instanceof Unit && entity.IsControllable && !entity.IsEnemy()) {
    this.controllables.push(new BaseUnitModel(entity))
  }
}

protected EntityDestroyed(entity: Entity) {
  if (entity instanceof Rune) {
    this.runes.remove(entity)
  }
  if (entity instanceof PhysicalItem) {
    this.physicalItems.remove(entity)
  }
  if (entity instanceof Unit) {
    this.controllables.removeCallback(x => x.BaseUnit === entity)
  }
}
```

**Note:** The SDK extends `Array` with `.remove(item)` and `.removeCallback(predicate)` helper methods.

### Humanizer & Sleep Pattern

Scripts must respect the humanizer system for realistic action timing:

```typescript
import {
  GameState,
  TickSleeper
} from "github.com/octarine-public/wrapper/index"

// Calculate human-like delay
const sleepTime = (): number => {
  const min = GameState.InputLag
  const max = GameState.InputLag + 1 / 30
  let inputLag = Math.randomRange(min, max) * 1000
  if (inputLag >= 150) {
    inputLag /= 3
  }
  return inputLag
}

// Use TickSleeper to prevent action spam
class MyModel {
  private readonly sleeper = new TickSleeper()

  public doAction() {
    if (this.sleeper.Sleeping) {
      return // Still on cooldown
    }
    // Execute action...
    this.sleeper.Sleep(sleepTime())
  }
}
```

**Critical:** Always check `ExecuteOrder.DisableHumanizer` — when `true`, hide the script's menu and disable all logic.

### Order Execution Pattern

Execute orders on units using their built-in methods:

```typescript
// Pick up rune/item
unit.PickupRune(rune, queue: false, showEffects: true)
unit.PickupItem(physicalItem, queue: false, showEffects: true)

// Cast abilities
unit.CastPosition(ability, position, queue: false, showEffects: true)
unit.CastTarget(ability, target, queue: false, showEffects: true)
unit.CastNoTarget(ability, queue: false, showEffects: true)

// Move items in inventory
unit.MoveItem(item, slot)
```

### Order Interception Pattern

`PrepareUnitOrders` lets you intercept and block player/script orders:

```typescript
protected PrepareUnitOrders(order: ExecuteOrder) {
  if (!order.IsPlayerInput) {
    return // Don't interfere with script orders
  }
  // Return false to block the order
  if (this.shouldBlock(order)) {
    return false
  }
  // Return true or undefined to allow
}
```

### GUI Rendering Pattern

All rendering happens in the `Draw` event using `RendererSDK`:

```typescript
import {
  Color,
  GUIInfo,
  ImageData,
  RendererSDK,
  Vector2
} from "github.com/octarine-public/wrapper/index"

protected Draw() {
  if (ExecuteOrder.DisableHumanizer || !this.hasLocalHero) {
    return
  }
  // Images
  const texture = ImageData.GetItemTexture("item_aegis")
  RendererSDK.Image(texture, position, rounding, size, Color.White)

  // Text
  RendererSDK.TextByFlags(text, position, color, fontFlags)

  // Shapes
  RendererSDK.FilledCircle(position, size, Color.Green)
  RendererSDK.FilledRect(position, size, Color.Black.SetA(180))
  RendererSDK.OutlinedRect(position, size, borderWidth, Color.Yellow)

  // World to screen
  const screenPos = RendererSDK.WorldToScreen(worldPosition)
}
```

**Scale your UI elements** using `GUIInfo.ScaleWidth()` / `GUIInfo.ScaleHeight()` / `GUIInfo.ScaleVector()` for resolution independence.

### Model Pattern (Polymorphism)

Use base classes with overridable methods for entity-specific behavior:

```typescript
// Base model — covers the common case
export class BaseUnitModel {
  constructor(public readonly BaseUnit: Unit) {}

  public get IsValid(): boolean {
    return this.BaseUnit.IsValid && this.BaseUnit.IsAlive
  }

  public CanPickup(entity: Entity): boolean {
    // Generic logic
    return true
  }
}

// Specialized model — overrides specific behavior
export class SpiritBearModel extends BaseUnitModel {
  public CanPickup(entity: Entity): boolean {
    if (entity instanceof PhysicalItem && entity.Item instanceof item_aegis) {
      return false // Bears can't pick up Aegis
    }
    return super.CanPickup(entity)
  }
}

// Factory in manager
public GetControllable(unit: Unit): BaseUnitModel | undefined {
  if (unit instanceof SpiritBear) return new SpiritBearModel(unit)
  if (unit instanceof npc_dota_hero_meepo) return new MeepoModel(unit)
  return new BaseUnitModel(unit)
}
```

Same pattern applies for abilities:
```typescript
export class BaseAbilityModel {
  constructor(public readonly BaseAbility: Ability) {}
  public CanBeCasted(): boolean { return this.BaseAbility.CanBeCasted() }
  public CanHit(position: Vector3): boolean { /* generic range check */ }
  public Use(position: Vector3): boolean { /* generic cast */ }
}

// Override for abilities with special cast mechanics
export class LeapModel extends BaseAbilityModel {
  public Use(position: Vector3) {
    // Leap is CastNoTarget, not CastPosition
    this.BaseAbility.Owner?.CastNoTarget(this.BaseAbility, false, true)
    return true
  }
}
```

### Particle Visualization Pattern

Use `ParticlesSDK` for in-world visual indicators:

```typescript
import { ParticlesSDK } from "github.com/octarine-public/wrapper/index"

class MyParticles {
  private readonly pSDK = new ParticlesSDK()

  public DrawLine(entity: Entity, target: Vector3) {
    this.pSDK.DrawAnimationLine(entity, target, distance)
  }

  public Destroy() {
    this.pSDK.DestroyAll()
  }
}
```

### Reset Pattern

Always implement a `reset()` method that cleans up all transient state. Call it on:
- Menu changes
- Humanizer state changes
- Game end

```typescript
private reset() {
  for (const controllable of this.controllables) {
    controllable.InputBlock = false
    controllable.Sleeper.ResetTimer()
  }
  this.particles.DestroyAll()
}

protected GameEnded() {
  this.reset()
}
```

### Draggable Window Pattern

For movable UI panels:

```typescript
private dragging = false
private readonly draggingOffset = new Vector2()

public MouseKeyDown() {
  const mouse = Input.CursorOnScreen
  if (!mouse.IsUnderRectangle(panelX, panelY, panelW, panelH)) {
    return true // Click outside — allow
  }
  this.dragging = true
  mouse.Subtract(panelPos).CopyTo(this.draggingOffset)
  return false // Block click from reaching the game
}

public MouseKeyUp() {
  if (this.dragging) {
    this.dragging = false
    Menu.Base.SaveConfigASAP = true
  }
  return true
}
```

### Checklist for a New Utility Script

1. Create `package.json` with `"main": "src/index.ts"`
2. Copy `tsconfig.json`, `.editorconfig`, `.eslintrc.json` from snatcher
3. Create `src/index.ts` with the anonymous class pattern
4. Create `src/menu.ts` with MenuManager
5. Create `src/translations.ts` if you need localization
6. Subscribe to relevant events in the constructor
7. Guard `PostDataUpdate`/`Draw` with `hasLocalHero` and `DisableHumanizer` checks
8. Track entities in typed arrays via `EntityCreated`/`EntityDestroyed`
9. Use `TickSleeper` for action throttling
10. Implement `reset()` for clean state management
11. Use polymorphic models if you need entity-specific behavior

### Common SDK Imports

```typescript
// Core systems
import {
  EventsSDK,          // Event subscription
  InputEventSDK,      // Mouse/keyboard input
  ExecuteOrder,       // Order execution and interception
  GameState,          // Game time, input lag
  GameRules,          // Game state (pregame, ingame, postgame)
  LocalPlayer,        // Local player reference
  EntityManager,      // Entity lookup by index
} from "github.com/octarine-public/wrapper/index"

// Entity classes
import {
  Entity, Unit, Hero, Ability, Item,
  PhysicalItem, Rune, Roshan, Creep,
  SpiritBear, RoshanSpawner, NetworkedParticle
} from "github.com/octarine-public/wrapper/index"

// Specific items/abilities (for instanceof checks)
import {
  item_aegis, item_bottle, item_gem, item_rapier,
  storm_spirit_ball_lightning, mirana_leap
} from "github.com/octarine-public/wrapper/index"

// UI and rendering
import {
  Menu, RendererSDK, ParticlesSDK,
  ImageData, GUIInfo, CameraSDK, Input,
  Color, Vector2, Vector3, Rectangle
} from "github.com/octarine-public/wrapper/index"

// Utilities
import {
  TickSleeper, Utils, PathData
} from "github.com/octarine-public/wrapper/index"

// Enums
import {
  DOTA_CHAT_MESSAGE,
  DOTA_RUNES,
  DOTAGameState,
  DOTAGameUIState,
  VMouseKeys,
  dotaunitorder_t,
  modifierstate
} from "github.com/octarine-public/wrapper/index"
```
