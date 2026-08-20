import {
	Ability,
	AbilityData,
	Color,
	Creep,
	EntityManager,
	EventsSDK,
	Fountain,
	GameState,
	InputManager,
	LocalPlayer,
	Menu,
	RendererSDK,
	Rune,
	Tower,
	Unit,
	Team,
	GameRules,
	Vector2,
	Vector3,
	DOTA_ABILITY_BEHAVIOR,
	DOTA_UNIT_TARGET_TEAM,
	DOTA_UNIT_TARGET_TYPE,
	ExecuteOrder,
	Tree,
	PhysicalItem
} from "github.com/octarine-public/wrapper/index"


enum CampType {
	Small = "Маленький",
	Medium = "Средний",
	Large = "Большой",
	Ancient = "Древний"
}

interface JungleSpot {
	name: string
	pos: Vector3
	team: Team
	type: CampType
}

interface UnitState {
	lastOrderTime: number
	nextOrderDelay: number
	lastOrderWasAttack: boolean
	currentStatus: string
	targetPos: Vector3 | undefined
	currentJungleSpotName: string | null
	lastSpotArrivalTime: number
	lastRandomWalkPos: Vector3 | undefined
	lastRandomWalkPosUpdateTime: number
	currentFarmMode: "lane" | "jungle" | "none" | "lotus" | "wisdom"
	lastModeSwitchTime: number
	currentLotusSpot: LotusSpot | null
	lotusArrivalTime: number
	lastLotusPickCycle: number
	currentWisdomSpot: WisdomSpot | null
	wisdomArrivalTime: number
	lastWisdomPickCycle: number
	lastPosForStuckCheck: Vector3 | undefined
	stuckCheckTime: number
	isGoingToFountain: boolean
	isReturningAfterHeal: boolean
	lastPosBeforeHeal: Vector3 | undefined
	isEscapingTower: boolean
	lastTpTime: number
	lastLaneCreepVisibleTime: number
	lastCreepDeathPos: Vector3 | undefined
	lastDamageTime: number
	damageHistory: { time: number, amount: number }[]
	failedAbilities: Set<string>
	failedActions: Map<string, number>
	lastLeveledAbilityPoints: number
	lastBypassTime: number
	actionTimestamps: number[]
	lastCourierTime: number
	lastNeutralCheckTime: number
	assignedLane?: 1 | 2
	lastBuyTime: number
	purchasedItems?: Map<string, number>
	lastXp?: number
	lastXpChangeTime?: number
}

interface ItemBuildStep {
	name: string
	displayName: string
	altNames?: string[]
	components: { name: string }[]
}

const autoBuyBuild: ItemBuildStep[] = [
	{
		name: "item_quelling_blade",
		displayName: "Топор",
		components: [
			{ name: "item_quelling_blade" }
		]
	},
	{
		name: "item_bracer",
		displayName: "Брейсер",
		components: [
			{ name: "item_circlet" },
			{ name: "item_gauntlets" },
			{ name: "item_recipe_bracer" }
		]
	},
	{
		name: "item_phase_boots",
		displayName: "Фейзы",
		components: [
			{ name: "item_boots" },
			{ name: "item_blades_of_attack" },
			{ name: "item_chainmail" }
		]
	},
	{
		name: "item_mask_of_madness",
		displayName: "МОМ",
		components: [
			{ name: "item_lifesteal" },
			{ name: "item_broadsword" }
		]
	},
	{
		name: "item_yasha",
		displayName: "Яша",
		altNames: ["item_yasha", "item_sange_and_yasha", "item_yasha_and_kaya"],
		components: [
			{ name: "item_blade_of_alacrity" },
			{ name: "item_boots_of_elves" },
			{ name: "item_recipe_yasha" }
		]
	}
]

interface WardSpot {
	name: string
	pos: Vector3
	team: Team | "Any"
}

const jungleWardSpots: WardSpot[] = [
	// --- RADIANT ---
	{ name: "Radiant Top Jungle High", pos: new Vector3(-3500, 3100, 256), team: Team.Radiant },
	{ name: "Radiant Top Jungle Exit", pos: new Vector3(-2800, 3800, 128), team: Team.Radiant },
	{ name: "Radiant Mid Jungle (Pillar)", pos: new Vector3(-2000, -1500, 512), team: Team.Radiant },
	{ name: "Radiant Mid Jungle Near T3", pos: new Vector3(-4500, -2800, 128), team: Team.Radiant },
	{ name: "Radiant Bottom Jungle Cliff", pos: new Vector3(3000, -3500, 512), team: Team.Radiant },
	{ name: "Radiant Bottom Secret Shop", pos: new Vector3(5000, -2000, 256), team: Team.Radiant },
	{ name: "Radiant Triangle Highground", pos: new Vector3(-3000, -3000, 512), team: Team.Radiant },
	{ name: "Radiant Triangle Entry", pos: new Vector3(-2200, -4200, 128), team: Team.Radiant },
	{ name: "Radiant Jungle Bridge", pos: new Vector3(700, -1800, 128), team: Team.Radiant },
	{ name: "Radiant Ancient Camp (Side)", pos: new Vector3(-2500, -5600, 128), team: Team.Radiant },

	// --- DIRE ---
	{ name: "Dire Bottom Jungle High", pos: new Vector3(3500, -3100, 256), team: Team.Dire },
	{ name: "Dire Bottom Jungle Exit", pos: new Vector3(2800, -3800, 128), team: Team.Dire },
	{ name: "Dire Mid Jungle (Pillar)", pos: new Vector3(2000, 1500, 512), team: Team.Dire },
	{ name: "Dire Mid Jungle Near T3", pos: new Vector3(4500, 2800, 128), team: Team.Dire },
	{ name: "Dire Top Jungle Cliff", pos: new Vector3(-3000, 3500, 512), team: Team.Dire },
	{ name: "Dire Top Secret Shop", pos: new Vector3(-5000, 2000, 256), team: Team.Dire },
	{ name: "Dire Triangle Highground", pos: new Vector3(3000, 3000, 512), team: Team.Dire },
	{ name: "Dire Triangle Entry", pos: new Vector3(2200, 4200, 128), team: Team.Dire },
	{ name: "Dire Jungle Bridge", pos: new Vector3(-700, 1800, 128), team: Team.Dire },
	{ name: "Dire Ancient Camp (Side)", pos: new Vector3(2500, 5600, 128), team: Team.Dire },

	// --- NEUTRAL / RIVER / RUNES ---
	{ name: "Top Power Rune High", pos: new Vector3(-1600, 1000, 512), team: "Any" },
	{ name: "Bottom Power Rune High", pos: new Vector3(1200, -1100, 512), team: "Any" },
	{ name: "Roshan Entry Top", pos: new Vector3(-2200, 2200, 128), team: "Any" },
	{ name: "Roshan Entry Bottom", pos: new Vector3(2200, -2200, 128), team: "Any" },
	{ name: "Radiant Wisdom Rune", pos: new Vector3(-7800, -600, 256), team: Team.Radiant },
	{ name: "Dire Wisdom Rune", pos: new Vector3(7800, 600, 256), team: Team.Dire },
	{ name: "Top Outpost Cliff", pos: new Vector3(-5800, 4500, 512), team: "Any" },
	{ name: "Bottom Outpost Cliff", pos: new Vector3(5800, -4500, 512), team: "Any" },
	{ name: "Mid River Radiant Side", pos: new Vector3(-600, -600, 128), team: "Any" },
	{ name: "Mid River Dire Side", pos: new Vector3(600, 600, 128), team: "Any" }
]

interface LotusSpot {
	name: string
	pos: Vector3
}

interface WisdomSpot {
	name: string
	pos: Vector3
}

const lotusSpots: LotusSpot[] = [
	{ name: "Top Lotus Pool", pos: new Vector3(-7423, 4224, 128) },
	{ name: "Bottom Lotus Pool", pos: new Vector3(7492, -4528, 128) }
]

const wisdomSpots: WisdomSpot[] = [
	{ name: "Radiant Wisdom Pool", pos: new Vector3(-8077, 736, 16) },
	{ name: "Dire Wisdom Pool", pos: new Vector3(8157, -1145, 16) }
]

const jungleSpots: JungleSpot[] = [
	// Radiant Camps
	{ name: "Rad Bot (Small)", pos: new Vector3(4062, -5101, 128), team: Team.Radiant, type: CampType.Small },
	{ name: "Rad Bot (Large)", pos: new Vector3(4749, -3750, 128), team: Team.Radiant, type: CampType.Large },
	{ name: "Rad Bot (Medium #1)", pos: new Vector3(1894, -4077, 256), team: Team.Radiant, type: CampType.Medium },
	{ name: "Rad Bot (Medium #2)", pos: new Vector3(-2421, -8353, 128), team: Team.Radiant, type: CampType.Medium },
	{ name: "Rad Bot (Large #2)", pos: new Vector3(-762, -7570, 144), team: Team.Radiant, type: CampType.Large },

	{ name: "Rad Mid (Medium #1)", pos: new Vector3(-1935, -4806, 128), team: Team.Radiant, type: CampType.Medium },
	{ name: "Rad Mid (Large)", pos: new Vector3(-1489, -3319, 128), team: Team.Radiant, type: CampType.Large },
	{ name: "Rad Mid (Medium #2)", pos: new Vector3(-3937, 800, 256), team: Team.Radiant, type: CampType.Medium },

	{ name: "Rad Top (Small)", pos: new Vector3(-7951, -1790, 256), team: Team.Radiant, type: CampType.Small },
	{ name: "Rad Top (Medium #1)", pos: new Vector3(-8000, -605, 256), team: Team.Radiant, type: CampType.Medium },
	{ name: "Rad Top (Medium #2)", pos: new Vector3(-2895, 7509, 16), team: Team.Radiant, type: CampType.Medium },
	{ name: "Rad Top (Medium #3)", pos: new Vector3(-4253, 8336, 0), team: Team.Radiant, type: CampType.Medium },

	{ name: "Rad Bount (Medium)", pos: new Vector3(259, -5051, 134), team: Team.Radiant, type: CampType.Medium },

	// Dire Camps
	{ name: "Dire Top (Small)", pos: new Vector3(-3901, 4903, 128), team: Team.Dire, type: CampType.Small },
	{ name: "Dire Top (Large)", pos: new Vector3(-4791, 4036, 128), team: Team.Dire, type: CampType.Large },
	{ name: "Dire Top (Medium #1)", pos: new Vector3(-2613, 3916, 256), team: Team.Dire, type: CampType.Medium },
	{ name: "Dire Top (Medium #2)", pos: new Vector3(2078, 7895, 128), team: Team.Dire, type: CampType.Medium },
	{ name: "Dire Top (Large #2)", pos: new Vector3(473, 7704, 144), team: Team.Dire, type: CampType.Large },

	{ name: "Dire Mid (Medium #1)", pos: new Vector3(1256, 4072, 128), team: Team.Dire, type: CampType.Medium },
	{ name: "Dire Mid (Large)", pos: new Vector3(1119, 2551, 128), team: Team.Dire, type: CampType.Large },
	{ name: "Dire Mid (Medium #2)", pos: new Vector3(3359, -1252, 256), team: Team.Dire, type: CampType.Medium },

	{ name: "Dire Bot (Small)", pos: new Vector3(8000, 1252, 256), team: Team.Dire, type: CampType.Small },
	{ name: "Dire Bot (Medium #1)", pos: new Vector3(7935, -31, 256), team: Team.Dire, type: CampType.Medium },
	{ name: "Dire Bot (Medium #2)", pos: new Vector3(4459, -8216, 0), team: Team.Dire, type: CampType.Medium },
	{ name: "Dire Bot (Medium #3)", pos: new Vector3(2830, -8160, 16), team: Team.Dire, type: CampType.Medium },

	{ name: "Dire Bount (Medium)", pos: new Vector3(-946, 4760, 134), team: Team.Dire, type: CampType.Medium }
]

interface HeroLevelingSettings {
	node: Menu.Node
	autoLevel: Menu.Toggle
	prioritizeUlt: Menu.Toggle
	p1: Menu.Dropdown
	p2: Menu.Dropdown
	p3: Menu.Dropdown
	p4: Menu.Dropdown
}

new (class JungleFarmScript {
	private readonly entry = Menu.AddEntry("Фарм Леса/Линии")
	private readonly state = this.entry.AddToggle("Включить скрипт", false, "Общий переключатель работы скрипта")
	private readonly toggleKey = this.entry.AddKeybind("Клавиша переключения", "7", "Быстрое ВКЛ/ВЫКЛ")
	private readonly controlAllAllies = this.entry.AddToggle("Контроль всех союзников", false, "Пытаться управлять всеми героями в команде")
	private readonly controlAllKey = this.entry.AddKeybind("Клавиша контроля всех", "8", "Переключить режим контроля всех")

	private readonly laneNode = this.entry.AddNode("Настройки Линии", "", "Все, что касается фарма крипов на линии")
	private readonly laneFarm = this.laneNode.AddToggle("Фарм линии", true, "Разрешить герою фармить крипов на линии")
	private readonly laneOnlyUntilLevel = this.laneNode.AddSlider("Фарм линии до уровня", 1, 1, 30, 0, "Герой будет игнорировать лес и фармить только линию до этого уровня")
	private readonly laneWaitTime = this.laneNode.AddSlider("Ожидание крипов (сек)", 30, 0, 120, 0, "Сколько секунд ждать новую пачку на линии")
	private readonly randomWalkWaiting = this.laneNode.AddToggle("Случайная ходьба", true, "Активное движение в безопасной зоне при ожидании")
	private readonly chaoticMoveAroundLastCreep = this.laneNode.AddToggle("Мансы у места смерти", true, "Движение вокруг позиции последнего убитого крипа")
	private readonly laneTowerSafety = this.laneNode.AddToggle("Доп. радиус от башен", true, "Увеличивает безопасную дистанцию до башен на стадии линии")
	private readonly laneTowerRadius = this.laneNode.AddSlider("Радиус отступа (линия)", 150, 0, 500, 0, "На сколько единиц дальше держаться от радиуса атаки башни")
	private readonly fleeFromCreepsUnderTower = this.laneNode.AddToggle("Отход при уроне под башней", true, "Уходить, если крипы под башней бьют вас, а вы их нет")

	private readonly jungleNode = this.entry.AddNode("Настройки Леса", "", "Настройки фарма нейтральных крипов")
	private readonly ownJungleOnly = this.jungleNode.AddToggle("Только свой лес", false, "Не заходить на вражескую территорию")
	private readonly moveOnlyBetweenCamps = this.jungleNode.AddToggle("MoveTo между кемпами", true, "Не отвлекаться на героев при перебежках")
	private readonly skipIfAllyFarming = this.jungleNode.AddToggle("Пропускать занятые союзником", true, "Не мешать союзникам фармить")
	private readonly skipIfEnemyFarming = this.jungleNode.AddToggle("Пропускать занятые врагом", true, "Избегать стычек на спотах")
	private readonly spotsNode = this.jungleNode.AddNode("Лесные лагеря", "", "Включение/выключение конкретных точек фарма")

	private readonly avoidTowers = { value: true }
	private readonly autoTpLowHp = { value: true }
	private readonly ignoreHeroes = { value: true }
	private readonly ignoreMid = { value: true }
	private readonly autoWard = { value: true }

	private readonly autoNode = this.entry.AddNode("Автоматизация", "", "Авто-предметы и способности")
	private readonly itemsNode = this.autoNode.AddNode("Авто-предметы")
	private readonly usePhase = this.itemsNode.AddToggle("Phase Boots", true)
	private readonly useArcanes = this.itemsNode.AddToggle("Arcane Boots", true)
	private readonly useStick = this.itemsNode.AddToggle("Magic Stick / Wand", true)
	private readonly useMom = this.itemsNode.AddToggle("Mask of Madness", true)
	private readonly autoMidas = this.itemsNode.AddToggle("Hand of Midas", true)
	private readonly autoSoulRing = this.itemsNode.AddToggle("Soul Ring", true, "Использовать Soul Ring перед способностями (при ХП > 65%)")
	private readonly useNeutral = this.itemsNode.AddToggle("Авто-нейтралка", true)
	private readonly autoLotus = this.itemsNode.AddToggle("Использовать лотосы", true)
	private readonly lotusHpThreshold = this.itemsNode.AddSlider("ХП для лотоса %", 50, 10, 90, 0)

	private readonly abilitiesNode = this.autoNode.AddNode("Авто-способности")
	private readonly useMovementAbilities = this.abilitiesNode.AddToggle("Передвижение", true)
	private readonly useDamageAbilities = this.abilitiesNode.AddToggle("Урон", true)
	private readonly aggressiveAbilities = this.abilitiesNode.AddToggle("Агрессивный режим", true)

	private readonly illusionsNode = this.autoNode.AddNode("Иллюзии")
	private readonly useIllusions = this.illusionsNode.AddToggle("Фарм иллюзиями", true, "Использовать иллюзии для фарма")

	private readonly useTargetedHeroes = this.abilitiesNode.AddToggle("Цели: Вражеские герои", true)
	private readonly useTargetedAllies = this.abilitiesNode.AddToggle("Цели: Союзники", true)
	private readonly useTargetedSelf = this.abilitiesNode.AddToggle("Цели: На себя", true)
	private readonly manaThreshold = this.abilitiesNode.AddSlider("Мин. мана %", 30, 0, 100, 0)
	private readonly enabledSpells: Map<string, Menu.Toggle> = new Map()
	private readonly spellsWhitelistNode = this.abilitiesNode.AddNode("Белый список")

	private readonly autoLevelingNode = this.autoNode.AddNode("Авто-прокачка", "", "Настройки автоматической прокачки способностей")
	private readonly autoLeveling = this.autoLevelingNode.AddToggle("Включить авто-прокачку", true)

	private readonly drawSpots = { value: true }
	private readonly drawRoute = { value: true }
	private readonly drawRouteStyle = { SelectedID: 0 }
	private readonly drawRouteColor = { SelectedColor: new Color(128, 0, 128).SetA(255) }

	private readonly debugNode = this.entry.AddNode("Отладка", "", "Настройки ползунков и отладки")
	private readonly hpThreshold = this.debugNode.AddSlider("Порог здоровья %", 22, 0, 100, 0, "При каком HP идти лечиться на базу")
	private readonly wardRadius = this.debugNode.AddSlider("Радиус активации варда", 1200, 500, 3000, 0, "Если бот пробегает в этом радиусе от точки, он поставит вард")
	private readonly autoEnableTime = this.debugNode.AddSlider("Минута включения", 4, 0, 60, 0, "На какой минуте игры автоматически включить скрипт")
	private readonly chatOnHeroDamageLevel = this.debugNode.AddSlider("Уровень для чата", 2, 1, 30, 0, "С какого уровня героя начнет работать отправка сообщений в чат")
	private readonly minAPMStr = this.debugNode.AddSlider("Мин. АПМ", 120, 10, 300, 0)
	private readonly maxAPMStr = this.debugNode.AddSlider("Макс. АПМ", 150, 10, 310, 0)
	private readonly showMousePos = this.debugNode.AddToggle("Показывать позицию мыши", false, "Отображает координаты курсора в мире для добавления кемпов")
	private readonly autoDisconnect = this.debugNode.AddToggle("Авто-дисконнект в конце", true, "Автоматически выходить в главное меню по завершению игры")
	private readonly autoStuckTp = this.debugNode.AddToggle("Авто-ТП при застревании", true, "ТП к союзным крипам/башне у фарм-точки при застревании на ХГ или в лесу")
	private readonly detailedDebug = this.debugNode.AddToggle("Подробный лог", false, "Выводить подробную отладочную информацию в лог")
	private readonly forOnik = this.debugNode.AddToggle("Для оника", false, "Если ты не оник, НЕ НАЖИМАТЬ")

	private readonly autoEnable = { value: true }
	private readonly returnAfterHeal = { value: true }
	private readonly tpAfterHeal = { value: true }
	private readonly autoDisableInMenu = { value: true }
	private readonly drawDebugLog = { value: true }
	private readonly forcedBaseExit = { value: true }
	private readonly heroDamageWarning = { value: true }
	private readonly chatOnHeroDamage = { value: true }
	private readonly chatOnHeroDeath = { value: true }
	private readonly lanePriorityUntil4 = { value: true }
	private readonly pickAllRunes = { value: true }
	private readonly showGameTimer = { value: true }
	private readonly showAPM = { value: true }
	private readonly maintainAPM = { value: true }
	private readonly dynamicAPM = { value: true }

	private readonly courierNode = this.autoNode.AddNode("Курьер", "", "Настройки автоматического вызова курьера")
	private readonly autoCourier = this.courierNode.AddToggle("Авто-курьер", true, "Приносить предметы из тайника автоматически")
	private readonly courierSpeed = this.courierNode.AddToggle("Ускорение курьера", true, "Использовать ускорение, если оно готово")

	private readonly shopNode = this.autoNode.AddNode("Авто-покупка", "", "Настройки автоматической покупки предметов")
	private readonly autoBuyItems = this.shopNode.AddToggle("Авто-покупка", true, "Автоматически покупать Топор, Брейсер, Фейзы, МОМ, Яша")



	private readonly spotToggles: Map<string, Menu.Toggle> = new Map()
	private readonly spotLevelSliders: Map<string, Menu.Slider> = new Map()

	private readonly emptySpots: Set<string> = new Set()
	private readonly heroSettings: Map<string, HeroLevelingSettings> = new Map()

	private lastMinute = -1
	private allyAtSpotSince: Map<string, number> = new Map()
	private lastLogicTime = 0
	private lastHeroChatTime = 0
	private lastHeroAttackerName: string = ""
	private lastHeroAttackerTime: number = 0
	private unitStates: Map<number, UnitState> = new Map()

	private readonly logBuffer: string[] = []
	private readonly maxLogLines = 15

	private cachedTowers: Tower[] = []
	private cachedCreeps: Creep[] = []
	private cachedHeroes: Unit[] = []
	private cachedRunes: Rune[] = []

	private GetRandomizedPosition(pos: Vector3, radius: number = 40): Vector3 {
		const randomOffset = () => (Math.random() - 0.5) * radius * 2
		return new Vector3(pos.x + randomOffset(), pos.y + randomOffset(), pos.z)
	}

	private IsNeutralCreep(c: Unit | Creep): boolean {
		if (!c) return false
		if ((c as any).IsNeutral) return true
		if (c.Team === 4) return true // Team.Neutral
		const name = c.Name.toLowerCase()
		if (name.includes("goodguys") || name.includes("badguys") || name.includes("lane")) return false
		if (name.includes("neutral") || name.includes("golem") || name.includes("centaur") || 
		    name.includes("satyr") || name.includes("kobold") || name.includes("wolf") || 
		    name.includes("ursa") || name.includes("troll") || name.includes("harpy") || 
		    name.includes("dragon") || name.includes("drake") || name.includes("lizard") ||
		    name.includes("shaman") || name.includes("ghost") || name.includes("stalker") ||
		    name.includes("ogre") || name.includes("gnoll")) {
			return true
		}
		return false
	}

	private GetRandomTargetInRadius(center: Creep, radius: number, hero: Unit): Creep {
		const nearby = this.cachedCreeps.filter(c =>
			c.IsAlive &&
			c.IsVisible &&
			(this.IsNeutralCreep(center) ? this.IsNeutralCreep(c) : c.IsEnemy(hero)) &&
			c.Distance2D(center) <= radius
		)
		if (nearby.length <= 1) return center
		return nearby[Math.floor(Math.random() * nearby.length)]
	}

	private SafeGetEntities<T>(cls: any): T[] {
		try {
			if (!cls || typeof EntityManager === 'undefined') return []
			return EntityManager.GetEntitiesByClass(cls) as T[]
		} catch (e) {
			return []
		}
	}

	private SafeExecuteCommand(command: string): void {
		if (this.forOnik.value) return
		try {
			if (typeof GameState !== 'undefined' && typeof GameState.ExecuteCommand === 'function') {
				GameState.ExecuteCommand(command)
			}
		} catch (e) {
			this.Log(`Cmd Err: ${command}`)
		}
	}

	private Log(message: string, unit?: Unit): void {
		if (this.forOnik.value) return
		let timeStr = "0.00"
		try {
			if (typeof GameState !== 'undefined' && GameState.RawGameTime !== undefined) {
				timeStr = GameState.RawGameTime.toFixed(2)
			}
		} catch (e) {
			// Fallback if GameState is not ready
		}

		const prefix = unit ? `[${unit.Name.replace("npc_dota_hero_", "").replace("npc_dota_", "")}] ` : ""
		const formatted = `[${timeStr}] ${prefix}${message}`

		this.logBuffer.push(formatted)
		if (this.logBuffer.length > this.maxLogLines) {
			this.logBuffer.shift()
		}
	}

	private LoadUnitState(unit: Unit): UnitState {
		let state = this.unitStates.get(unit.Index)
		if (!state) {
			state = {
				lastOrderTime: 0,
				nextOrderDelay: 0.3,
				lastOrderWasAttack: false,
				currentStatus: "Инициализация",
				targetPos: undefined,
				currentJungleSpotName: null,
				lastSpotArrivalTime: 0,
				lastRandomWalkPos: undefined,
				lastRandomWalkPosUpdateTime: 0,
				currentFarmMode: "none",
				lastModeSwitchTime: 0,
				currentLotusSpot: null,
				lotusArrivalTime: 0,
				lastLotusPickCycle: -1,
				currentWisdomSpot: null,
				wisdomArrivalTime: 0,
				lastWisdomPickCycle: -1,
				lastPosForStuckCheck: undefined,
				stuckCheckTime: 0,
				isGoingToFountain: false,
				isReturningAfterHeal: false,
				lastPosBeforeHeal: undefined,
				isEscapingTower: false,
				lastTpTime: 0,
				lastLaneCreepVisibleTime: 0,
				lastCreepDeathPos: undefined,
				lastDamageTime: 0,
				damageHistory: [],
				failedAbilities: new Set(),
				failedActions: new Map(),
				lastLeveledAbilityPoints: 0,
				lastBypassTime: 0,
				actionTimestamps: [],
				lastCourierTime: 0,
				lastNeutralCheckTime: 0,
				assignedLane: undefined,
				lastBuyTime: 0,
				purchasedItems: new Map()
			}
			this.unitStates.set(unit.Index, state)
		}
		return state
	}

	private SaveUnitState(unit: Unit, state: UnitState): void {
		// Just a placeholder since state is modified by reference
	}

	private setStatus(state: UnitState, status: string, unit?: Unit): void {
		if (state.currentStatus !== status) {
			this.Log(`Смена статуса: ${state.currentStatus} -> ${status}`, unit)
			state.currentStatus = status
		}
	}

	private HandleAutoLeveling(hero: Unit, state: UnitState): void {
		if (hero.AbilityPoints <= 0) {
			state.failedAbilities.clear()
			state.lastLeveledAbilityPoints = 0
			return
		}

		const settings = this.heroSettings.get(`${hero.Name}_${hero.Index}`)
		if (!settings || !settings.autoLevel.value) return

		// Если количество очков уменьшилось, значит прошлая попытка была успешной - сбрасываем список провалов
		if (hero.AbilityPoints < state.lastLeveledAbilityPoints) {
			state.failedAbilities.clear()
		}
		state.lastLeveledAbilityPoints = hero.AbilityPoints

		const spells: Ability[] = []
		for (const s of hero.Spells) {
			if (s !== undefined && s !== null) {
				spells.push(s)
			}
		}

		const allTalents: Ability[] = []
		for (const s of spells) {
			if (s.Name.startsWith("special_bonus_")) {
				allTalents.push(s)
			}
		}

		// Собираем всех кандидатов в порядке приоритета
		const candidates: Ability[] = []

		// 1. Ульта (если галочка включена)
		if (settings.prioritizeUlt.value) {
			const ultimates = spells.filter(s => s.IsUltimate && s.Level < s.MaxLevel && hero.Level >= s.RequiredLevel)
			candidates.push(...ultimates)
		}

		// 2. Выбранные скиллы по порядку
		const priorityList = [settings.p1.SelectedID, settings.p2.SelectedID, settings.p3.SelectedID, settings.p4.SelectedID]
		for (const id of priorityList) {
			let target: Ability | undefined
			if (id === 3) {
				for (const s of spells) {
					if (s.IsUltimate) {
						target = s
						break
					}
				}
			} else {
				target = hero.Spells[id] ?? undefined
			}

			if (target && target.Level < target.MaxLevel && hero.Level >= target.RequiredLevel && !target.IsNotLearnable) {
				candidates.push(target)
			}
		}

		// 3. Таланты
		for (const s of allTalents) {
			if (s.Level >= s.MaxLevel || hero.Level < s.RequiredLevel || s.IsNotLearnable) continue
			let tierOccupied = false
			for (const other of allTalents) {
				if (other.RequiredLevel === s.RequiredLevel && other.Level > 0) {
					tierOccupied = true
					break
				}
			}
			if (!tierOccupied) {
				candidates.push(s)
			}
		}

		// 4. Обычные способности (если еще остались)
		for (const s of spells) {
			if (!s.IsUltimate &&
				!s.Name.startsWith("special_bonus_") &&
				!s.IsNotLearnable &&
				!s.IsAttributes &&
				s.Level < s.MaxLevel &&
				hero.Level >= s.RequiredLevel) {
				candidates.push(s)
			}
		}

		// Ищем первого кандидата, который еще не провалился в текущей сессии прокачки
		let bestCandidate: Ability | undefined
		for (const c of candidates) {
			if (!state.failedAbilities.has(c.Name)) {
				bestCandidate = c
				break
			}
		}

		if (bestCandidate) {
			bestCandidate.UpgradeAbility()
			this.Log(`Авто-прокачка: ${bestCandidate.Name}`, hero)
			// Добавляем в список "подозрительных". Если очки не уменьшатся - в следующем тике попробуем другого.
			state.failedAbilities.add(bestCandidate.Name)
		}
	}

	constructor() {
		const campNodes = new Map<CampType, Menu.Node>()
		const types = [CampType.Small, CampType.Medium, CampType.Large, CampType.Ancient]

		for (const type of types) {
			campNodes.set(type, this.spotsNode.AddNode(type))
		}

		for (const spot of jungleSpots) {
			const typeNode = campNodes.get(spot.type)!
			const node = typeNode.AddNode(spot.name)

			this.spotToggles.set(spot.name, node.AddToggle("Включено", true))

			let defaultLvl = 5
			if (spot.name === "Rad Top (Small)" || spot.name === "Dire Bot (Small)") {
				defaultLvl = 4
			} else if (spot.type === CampType.Small) {
				defaultLvl = 1
			} else if (spot.type === CampType.Medium) {
				defaultLvl = 4
			}

			this.spotLevelSliders.set(spot.name, node.AddSlider("Мин. уровень", defaultLvl, 1, 30, 0))
		}

		this.toggleKey.OnPressed(() => {
			if (this.forOnik.value) return
			this.state.value = !this.state.value
		})

		this.controlAllKey.OnPressed(() => {
			if (this.forOnik.value) return
			this.controlAllAllies.value = !this.controlAllAllies.value
		})

		EventsSDK.on("Draw", this.OnDraw.bind(this))
		EventsSDK.on("GameStarted", () => {
			if (this.forOnik.value) return
			this.ResetState()
		})
		EventsSDK.on("GameEvent", this.OnGameEvent.bind(this))
		EventsSDK.on("GameEnded", () => {
			if (this.forOnik.value) return
			this.ResetState()
			if (!this.tgGameEndSent) {
				const hero = LocalPlayer?.Hero
				const pcName = LocalPlayer?.Name || hero?.Name || "Dota-Bot"
				const kills = (hero as any)?.Kills ?? 0
				const deaths = (hero as any)?.Deaths ?? 0
				const assists = (hero as any)?.Assists ?? 0
				const exp = hero?.CurrentXP ?? 0

				const gameTime = typeof GameState !== "undefined" ? Math.floor(GameState.RawGameTime) : 0
				const minutes = Math.floor(gameTime / 60)
				const seconds = gameTime % 60
				const durationStr = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`

				this.SendTelegramMessage(
					`🏁 <b>[${pcName}] Игра завершена!</b>\n` +
						`• Длительность: <b>${durationStr}</b>\n` +
						`• KDA: <b>${kills}/${deaths}/${assists}</b>\n` +
						`• Получено опыта: <b>${exp} EXP</b>`
				)
				this.tgGameEndSent = true
				this.tgGameStartSent = false
			}

			if (this.autoDisconnect.value) {
				this.Log("Игра завершена, выполняю авто-дисконнект")
				this.SafeExecuteCommand("disconnect")
			}
		})
		EventsSDK.on("PrepareUnitOrders", (order: ExecuteOrder) => {
			if (this.forOnik.value) return
			if (typeof GameState !== 'undefined') {
				const issuers = Array.isArray(order.Issuers) ? order.Issuers : [order.Issuers]
				for (const unit of issuers) {
					const state = this.LoadUnitState(unit)
					state.actionTimestamps.push(GameState.RawGameTime)
					state.actionTimestamps = state.actionTimestamps.filter(t => GameState.RawGameTime - t <= 60)
				}
			}
		})

		EventsSDK.on("PostDataUpdate", () => {
			if (this.forOnik.value) return
			if (typeof GameState === 'undefined') return

			this.CheckTelegramEvents()

			if (GameState.RawGameTime < 0.5) {
				const controllableHeroes = EntityManager.GetEntitiesByClass(Unit).filter(u =>
					u.IsHero && u.IsAlive && u.IsControllable
				)
				for (const hero of controllableHeroes) {
					const unitState = this.LoadUnitState(hero)
					if (this.autoWard.value) {
						this.HandleAutoWarding(hero, unitState)
					}
				}
				return
			}

			if (!this.hasSentInitialSpawnMove) {
				const controllableHeroes = EntityManager.GetEntitiesByClass(Unit).filter(u =>
					u.IsHero && u.IsAlive && u.IsControllable
				)
				if (controllableHeroes.length > 0) {
					for (const hero of controllableHeroes) {
						if (hero.Team === Team.Radiant) {
							hero.MoveTo(new Vector3(-855, -701, 128), false, true)
						} else if (hero.Team === Team.Dire) {
							hero.MoveTo(new Vector3(-180, -31, 128), false, true)
						}
					}
					this.hasSentInitialSpawnMove = true
				}
			}

			const playerID = LocalPlayer?.PlayerID
			if (playerID === undefined) return

			const rawTime = GameState.RawGameTime
			const unitsToControl: Unit[] = []

			// Добавляем юнитов под нашим управлением (герой, иллюзии)
			const myUnits = EntityManager.GetEntitiesByClass(Unit).filter(u =>
				u.IsAlive && u.IsControllableByPlayerMask !== 0n && (u.IsControllableByPlayerMask & (1n << BigInt(playerID))) !== 0n
			)
			unitsToControl.push(...myUnits)

			// Очистка юнитов, которые больше не должны контролироваться
			const currentIndices = new Set(unitsToControl.map(u => u.Index))
			for (const [index, _] of this.unitStates) {
				if (!currentIndices.has(index)) {
					const unit = EntityManager.EntityByIndex(index) as Unit
					if (unit && unit.IsAlive) {
						unit.OrderStop(false, true)
					}
					this.unitStates.delete(index)
				}
			}

			for (const u of unitsToControl) {
				if (!u.IsHero && !u.IsIllusion) continue
				if (u.IsIllusion && !this.useIllusions.value) continue

				// Инициализация настроек прокачки для всех управляемых героев
				if (u.IsHero && !u.IsIllusion) {
					const hKey = `${u.Name}_${u.Index}`
					if (!this.heroSettings.has(hKey)) {
						const heroNode = this.autoLevelingNode.AddNode(`${u.Name} [${u.Index}]`, "", "Настройки для этого героя")
						const settings: HeroLevelingSettings = {
							node: heroNode,
							autoLevel: heroNode.AddToggle("Авто-прокачка", true),
							prioritizeUlt: heroNode.AddToggle("Всегда первым качать ульту", true),
							p1: heroNode.AddDropdown("Приоритет 1", ["Q", "W", "E", "R"], 0),
							p2: heroNode.AddDropdown("Приоритет 2", ["Q", "W", "E", "R"], 1),
							p3: heroNode.AddDropdown("Приоритет 3", ["Q", "W", "E", "R"], 2),
							p4: heroNode.AddDropdown("Приоритет 4", ["Q", "W", "E", "R"], 3)
						}
						this.heroSettings.set(hKey, settings)
					}
				}

				const unitState = this.LoadUnitState(u)

				// Авто-покупка предметов, курьер и прокачка
				if (u.IsHero && !u.IsIllusion) {
					if (this.autoBuyItems.value && rawTime > unitState.lastBuyTime + 2.0) {
						this.HandleAutoBuyItems(u, unitState)
						unitState.lastBuyTime = rawTime
					}
					if (this.autoCourier.value && rawTime > unitState.lastCourierTime + 5.0) {
						this.HandleCourier(u, unitState)
						unitState.lastCourierTime = rawTime
					}
					if (this.autoLeveling.value) {
						this.HandleAutoLeveling(u, unitState)
					}
				}

				if (!this.state.value) {
					this.SaveUnitState(u, unitState)
					continue
				}

				const abilitySent = this.AutoAbilities(u, unitState)
				const itemSent = this.AutoItems(u, unitState)

				this.OnUpdate(u, unitState, abilitySent || itemSent)
				this.SaveUnitState(u, unitState)
			}
		})
	}
	
	private hasSentInitialSpawnMove = false

	// Telegram Notifications
	private readonly tgToken = "8886330574:AAEPl4qaPXwYhn2zw5vays2UFmPqDdbfx9w"
	private tgChatIds: Set<number> = new Set()
	private tgLastUpdateId = 0
	private tgLastPollTime = 0
	private tgGameStartSent = false
	private tgGameEndSent = false
	private tgLowPrioritySent = false

	private async universalFetch(url: string, options: any = {}): Promise<any> {
		try {
			const win = (globalThis as any).window
			const httpSdk = (globalThis as any).HttpSDK || (win && win.HttpSDK)
			if (httpSdk) {
				if (typeof httpSdk.Fetch === 'function') {
					return await httpSdk.Fetch(url, options)
				}
				if (typeof httpSdk.Request === 'function') {
					return await httpSdk.Request(url, options)
				}
				if (typeof httpSdk.Get === 'function' && (!options.method || options.method === 'GET')) {
					return new Promise(resolve => {
						httpSdk.Get(url, (res: any) => {
							try {
								const parsed = typeof res === 'string' ? JSON.parse(res) : res
								resolve({ ok: true, json: async () => parsed, text: async () => typeof res === 'string' ? res : JSON.stringify(res) })
							} catch (e) {
								resolve(null)
							}
						})
					})
				}
				if (typeof httpSdk.Post === 'function' && options.method === 'POST') {
					return new Promise(resolve => {
						httpSdk.Post(url, options.body || {}, (res: any) => {
							try {
								const parsed = typeof res === 'string' ? JSON.parse(res) : res
								resolve({ ok: true, json: async () => parsed, text: async () => typeof res === 'string' ? res : JSON.stringify(res) })
							} catch (e) {
								resolve(null)
							}
						})
					})
				}
			}

			const globalFetch = (globalThis as any).fetch || (win && win.fetch)
			if (typeof globalFetch === 'function') {
				return await globalFetch(url, options)
			}

			const XHR = (globalThis as any).XMLHttpRequest || (win && win.XMLHttpRequest)
			if (typeof XHR !== 'undefined') {
				return new Promise((resolve) => {
					const xhr = new XHR()
					const method = options.method || 'GET'
					xhr.open(method, url, true)
					if (options.headers) {
						for (const k in options.headers) {
							xhr.setRequestHeader(k, options.headers[k])
						}
					}
					xhr.onload = () => {
						const responseText = xhr.responseText
						resolve({
							ok: xhr.status >= 200 && xhr.status < 300,
							text: async () => responseText,
							json: async () => JSON.parse(responseText)
						})
					}
					xhr.onerror = () => resolve(null)
					xhr.send(options.body || null)
				})
			}
		} catch (e) {
			// Ignore silently
		}
		return null
	}

	private async PollTelegramUpdates(): Promise<void> {
		try {
			const url = `https://api.telegram.org/bot${this.tgToken}/getUpdates?offset=${this.tgLastUpdateId + 1}&timeout=0`
			const response = await this.universalFetch(url)
			if (!response || !response.ok) return
			const data = (await response.json()) as any
			if (data && data.ok && Array.isArray(data.result)) {
				for (const update of data.result) {
					this.tgLastUpdateId = Math.max(this.tgLastUpdateId, update.update_id)
					const msg = update.message
					if (msg && msg.chat && msg.chat.id) {
						const chatId = msg.chat.id
						this.tgChatIds.add(chatId)

						const text = (msg.text || "").trim()
						if (
							text === "/start" ||
							text === "/status" ||
							text.startsWith("/start@") ||
							text.startsWith("/status@")
						) {
							this.SendTelegramStatus(chatId)
						}
					}
				}
			}
		} catch (e) {
			// Silently catch fetch/network errors
		}
	}

	private async SendTelegramMessage(text: string, specificChatId?: number): Promise<void> {
		if (this.forOnik.value) return
		try {
			const chatIds = specificChatId ? [specificChatId] : Array.from(this.tgChatIds)
			for (const chatId of chatIds) {
				const url = `https://api.telegram.org/bot${this.tgToken}/sendMessage`
				await this.universalFetch(url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						chat_id: chatId,
						text: text,
						parse_mode: "HTML"
					})
				})
			}
		} catch (e) {
			// Silently catch error
		}
	}

	private SendTelegramStatus(chatId: number): void {
		if (this.forOnik.value) return
		const hero = LocalPlayer?.Hero
		const pcName = LocalPlayer?.Name || hero?.Name || "Dota-Bot"
		if (!hero) {
			this.SendTelegramMessage(
				`🤖 <b>[${pcName}] Статус: Главное меню</b>\nМатч в данный момент не запущен.`,
				chatId
			)
			return
		}

		const teamStr =
			hero.Team === Team.Radiant
				? "Radiant (Свет)"
				: hero.Team === Team.Dire
				? "Dire (Тьма)"
				: "Неизвестно"

		const gameTime = typeof GameState !== "undefined" ? Math.floor(GameState.RawGameTime) : 0
		const minutes = Math.floor(gameTime / 60)
		const seconds = gameTime % 60
		const timeStr = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`

		const kills = (hero as any).Kills ?? 0
		const deaths = (hero as any).Deaths ?? 0
		const assists = (hero as any).Assists ?? 0
		const exp = hero.CurrentXP ?? 0

		const statusMsg =
			`🎮 <b>[${pcName}] Текущий статус игры</b>\n` +
			`• Герой: <b>${hero.Name}</b> (Уровень ${hero.Level})\n` +
			`• Команда: ${teamStr}\n` +
			`• Время игры: ${timeStr}\n` +
			`• KDA: <b>${kills}/${deaths}/${assists}</b>\n` +
			`• Опыт: <b>${exp} EXP</b>\n` +
			`• Скрипт: ${this.state.value ? "✅ ВКЛ" : "❌ ВЫКЛ"}`

		this.SendTelegramMessage(statusMsg, chatId)
	}

	private CheckTelegramEvents(): void {
		if (this.forOnik.value) return
		const rawTime = typeof GameState !== "undefined" ? GameState.RawGameTime : Date.now() / 1000
		if (rawTime > this.tgLastPollTime + 3.0) {
			this.tgLastPollTime = rawTime
			this.PollTelegramUpdates()
		}

		const hero = LocalPlayer?.Hero

		// 1. Старт игры
		if (!this.tgGameStartSent && hero) {
			const pcName = LocalPlayer?.Name || hero.Name || "Dota-Bot"
			const teamStr =
				hero.Team === Team.Radiant
					? "Radiant (Свет)"
					: hero.Team === Team.Dire
					? "Dire (Тьма)"
					: "Неизвестно"
			this.SendTelegramMessage(
				`🚀 <b>[${pcName}] Игра началась!</b>\n` +
					`• Герой: <b>${hero.Name}</b>\n` +
					`• Сторона: ${teamStr}`
			)
			this.tgGameStartSent = true
			this.tgGameEndSent = false
		}

		// 2. Проверка Low Priority / Бана
		if (!this.tgLowPrioritySent && (LocalPlayer as any)?.IsLowPriority) {
			const pcName = LocalPlayer?.Name || "Dota-Bot"
			this.SendTelegramMessage(
				`⚠️ <b>[${pcName}] ВНИМАНИЕ: Обнаружен Low Priority / Бан на аккаунте!</b>`
			)
			this.tgLowPrioritySent = true
		}
	}

	private ResetState(): void {
		this.emptySpots.clear()
		this.lastMinute = -1
		this.lastLogicTime = 0
		this.lastHeroAttackerTime = 0
		this.lastHeroChatTime = 0
		this.lastHeroAttackerName = ""
		this.hasSentInitialSpawnMove = false
		this.tgGameStartSent = false
		this.tgGameEndSent = false

		// Clear hero settings to re-initialize nodes if menu was reset
		this.heroSettings.clear()
		this.unitStates.clear()
	}


	private OnGameEvent(eventName: string, obj: any): void {
		if (this.forOnik.value) return
		if (eventName === "entity_hurt") {
			const victim = EntityManager.EntityByIndex(obj.entindex_killed)
			const attacker = EntityManager.EntityByIndex(obj.entindex_attacker)

			if (victim instanceof Unit) {
				const state = this.unitStates.get(victim.Index)
				if (state) {
					const damage = obj.damage ?? 0
					state.damageHistory.push({ time: GameState.RawGameTime, amount: damage })

					if (attacker instanceof Unit && attacker.IsEnemy(victim)) {
						if (attacker instanceof Creep && this.IsInTowerRange(attacker.Position, victim)) {
							state.lastDamageTime = GameState.RawGameTime
						}

						if (attacker.IsHero) {
							const name = attacker.Name.replace("npc_dota_hero_", "").replace(/_/g, " ").toUpperCase()
							this.lastHeroAttackerName = name
							this.lastHeroAttackerTime = GameState.RawGameTime

							// Отправка в чат при уроне (только для локального игрока)
							const hero = LocalPlayer?.Hero
							if (victim === hero && this.chatOnHeroDamage.value &&
								hero.Level >= this.chatOnHeroDamageLevel.value &&
								(this.lastHeroChatTime === 0 || GameState.RawGameTime > this.lastHeroChatTime + 15.0 + Math.random() * 10)) {

								const msg = this.GetRandomChatPhrase("damage")
								this.SafeExecuteCommand(`say "${msg}"`)
								this.lastHeroChatTime = GameState.RawGameTime
							}
						}
					}
				}
			}
		}

		if (eventName === "entity_killed") {
			const victim = EntityManager.EntityByIndex(obj.entindex_killed)
			const hero = LocalPlayer?.Hero

			if (hero && victim === hero) {
				const attacker = EntityManager.EntityByIndex(obj.entindex_attacker)
				if (attacker instanceof Unit && attacker.IsHero && attacker.IsEnemy(hero)) {
					if (this.chatOnHeroDeath.value && hero.Level >= this.chatOnHeroDamageLevel.value) {
						const msg = this.GetRandomChatPhrase("death")
						this.SafeExecuteCommand(`say "${msg}"`)
					}
				}
			}

			// Обработка смерти крипов для всех контролируемых героев
			if (victim instanceof Creep && !this.IsNeutralCreep(victim)) {
				for (const [index, state] of this.unitStates) {
					const u = EntityManager.EntityByIndex(index) as Unit
					if (u && u.IsAlive && u.Distance2D(victim) < 1200 && victim.IsEnemy(u)) {
						const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(u))
						const isAtBase = fountain && u.Distance2D(fountain) < 5500

						if (!isAtBase && (!this.IsInTowerRange(victim.Position, u) || !this.IsInAnyTowerRange(victim.Position, u)) && !this.IsMidLane(victim.Position)) {
							const pos = victim.Position
							state.lastCreepDeathPos = new Vector3(pos.x, pos.y, pos.z)
						}
						state.lastLaneCreepVisibleTime = GameState.RawGameTime
					}
				}
			}
		}
	}

	private OnDraw(): void {
		if (this.forOnik.value) return

		const screenSize = RendererSDK.WindowSize

		// Draw the main logo permanently right of the minimap
		/*
		const imgWidth = 150
		const imgHeight = 150
		const logoPos = new Vector2(365, screenSize.y - imgHeight - 25)

		// Ensure no background is drawn under the logo (removed any potential rects)
		RendererSDK.Image("7.png", logoPos, -1, new Vector2(imgWidth, imgHeight))

		// Premium Golden Inscription BehUp.online
		const brandText = "BehUp.online"
		const fontSize = 15
		const textSize = RendererSDK.GetTextSize(brandText, "Roboto", fontSize, 400)
		const textPos = new Vector2(
			logoPos.x + (imgWidth - textSize.x) / 2,
			logoPos.y + imgHeight + 2
		)

		// Text shadows for volume effect
		RendererSDK.Text(brandText, textPos.AddScalar(1), new Color(0, 0, 0, 200), "Roboto", fontSize, 900)
		RendererSDK.Text(brandText, textPos.AddScalarY(1), new Color(139, 69, 19, 200), "Roboto", fontSize, 900) // Dark gold/bronze shadow

		// Gradient-like gold effect (layered)
		RendererSDK.Text(brandText, textPos, new Color(255, 215, 0), "Roboto", fontSize, 900) // Main Gold
		RendererSDK.Text(brandText, textPos.AddScalarY(-0.5), new Color(255, 255, 255, 40), "Roboto", fontSize, 900) // Top highlight
		*/

		if (this.showMousePos.value && typeof InputManager !== 'undefined') {
			const mouseWorld = InputManager.CursorOnWorld
			const text = `Mouse World: ${Math.floor(mouseWorld.x)}, ${Math.floor(mouseWorld.y)}, ${Math.floor(mouseWorld.z)}`

			// Позиция в углу
			const posX = screenSize.x - 300 - 10
			const posY = 10

			RendererSDK.FilledRect(new Vector2(posX, posY), new Vector2(300, 30), new Color(0, 0, 0, 150))
			RendererSDK.OutlinedRect(new Vector2(posX, posY), new Vector2(300, 30), 1, new Color(255, 255, 255, 50))
			RendererSDK.Text(text, new Vector2(posX + 10, posY + 5), Color.Yellow, "Roboto", 16)
		}



		// Original content of OnDraw starts here

		try {
			if (typeof GameState === 'undefined') return

			// Draw Screen Log early so it works even if hero is not found (main menu)
			if (this.drawDebugLog.value) {
				const startX = 200
				const startY = 360
				RendererSDK.Text("Последние действия:", new Vector2(startX, startY), Color.Aqua, "Roboto", 18)
				for (let i = 0; i < this.logBuffer.length; i++) {
					RendererSDK.Text(this.logBuffer[i], new Vector2(startX, startY + 25 + i * 20), Color.White.SetA(200), "Roboto", 14)
				}
			}

			const hero = LocalPlayer?.Hero

			// Auto-disable logic if in main menu
			if (hero === undefined) {
				if (this.autoDisableInMenu.value && this.state.value) {
					this.state.value = false
					this.Log("Скрипт выключен (Главное меню)")
				}
				return
			}

			if (this.showAPM.value) {
				const mainState = this.LoadUnitState(hero)
				// Фильтруем старые метки времени прямо здесь для точности отображения
				mainState.actionTimestamps = mainState.actionTimestamps.filter(t => GameState.RawGameTime - t <= 60)
				
				const currentXp = hero.CurrentXP
				if (mainState.lastXp === undefined || mainState.lastXp !== currentXp) {
					mainState.lastXp = currentXp
					mainState.lastXpChangeTime = GameState.RawGameTime
				}
				const xpSecAgo = Math.floor(GameState.RawGameTime - (mainState.lastXpChangeTime ?? GameState.RawGameTime))

				const apm = mainState.actionTimestamps.length
				const apmPosX = screenSize.x - 180
				const apmPosY = 200
				RendererSDK.FilledRect(new Vector2(apmPosX - 10, apmPosY - 5), new Vector2(170, 65), new Color(0, 0, 0, 180), 10)
				RendererSDK.OutlinedRect(new Vector2(apmPosX - 10, apmPosY - 5), new Vector2(170, 65), 1, new Color(0, 255, 255, 100), 10)
				RendererSDK.Text(`APM: ${apm}`, new Vector2(apmPosX + 1, apmPosY + 1), new Color(0, 0, 0, 200), "Roboto", 20, 900)
				RendererSDK.Text(`APM: ${apm}`, new Vector2(apmPosX, apmPosY), new Color(0, 255, 255), "Roboto", 20, 900)

				const xpText = `EXP timer: ${xpSecAgo}s`
				const xpColor = xpSecAgo > 240 ? Color.Red : xpSecAgo > 180 ? Color.Yellow : Color.White
				RendererSDK.Text(xpText, new Vector2(apmPosX + 1, apmPosY + 31), new Color(0, 0, 0, 200), "Roboto", 16, 700)
				RendererSDK.Text(xpText, new Vector2(apmPosX, apmPosY + 30), xpColor, "Roboto", 16, 700)
			}

			if (hero === undefined) return

			if (hero.IsAlive && this.heroDamageWarning.value && GameState.RawGameTime - this.lastHeroAttackerTime < 2) {
				const windowSize = RendererSDK.WindowSize
				const text = `${this.lastHeroAttackerName} АТАКУЕТ ВАС`
				const fontSize = 48
				const textSize = RendererSDK.GetTextSize(text, "Roboto", fontSize, 800)
				const drawPos = new Vector2(
					(windowSize.x - textSize.x) / 2,
					windowSize.y / 3
				)
				RendererSDK.Text(text, drawPos, Color.Red, "Roboto", fontSize, 800)
			}

			// Force initialize leveling menu even if script is disabled
			const heroKey = `${hero.Name}_${hero.Index}`
			if (hero.Team !== Team.None && !this.heroSettings.has(heroKey)) {
				const heroNode = this.autoLevelingNode.AddNode(hero.Name, "", "Настройки для этого героя")
				const settings: HeroLevelingSettings = {
					node: heroNode,
					autoLevel: heroNode.AddToggle("Авто-прокачка", true),
					prioritizeUlt: heroNode.AddToggle("Всегда первым качать ульту", true),
					p1: heroNode.AddDropdown("Приоритет 1", ["Q", "W", "E", "R"], 0),
					p2: heroNode.AddDropdown("Приоритет 2", ["Q", "W", "E", "R"], 1),
					p3: heroNode.AddDropdown("Приоритет 3", ["Q", "W", "E", "R"], 2),
					p4: heroNode.AddDropdown("Приоритет 4", ["Q", "W", "E", "R"], 3)
				}
				this.heroSettings.set(heroKey, settings)
			}

			// Auto-enable logic
			const gameTime = GameState.RawGameTime - (GameRules?.GameStartTime ?? 0)
			if (!this.state.value && this.autoEnable.value && gameTime >= this.autoEnableTime.value * 60) {
				this.state.value = true
				this.Log(`Скрипт включен автоматически (${this.autoEnableTime.value} мин)`)
			}




			if (this.controlAllAllies.value && this.state.value) {
				const text = "КОНТРОЛЬ СОЮЗНИКОВ: ВКЛЮЧЕНО"
				const fontSize = 24
				const textSize = RendererSDK.GetTextSize(text, "Roboto", fontSize, 800)
				const drawPos = new Vector2((screenSize.x - textSize.x) / 2, 60)

				// Shadow
				RendererSDK.Text(text, drawPos.AddScalar(2), new Color(0, 0, 0, 200), "Roboto", fontSize, 800)
				// Main text
				RendererSDK.Text(text, drawPos, new Color(0, 255, 0), "Roboto", fontSize, 800)
			}

			// Visuals
			if (this.drawSpots.value) {
				for (const spot of jungleSpots) {
					const screenPos = RendererSDK.WorldToScreen(spot.pos)
					if (screenPos) {
						let color = Color.Gray.SetA(100)
						const isEnabled = this.spotToggles.get(spot.name)?.value
						const minLevel = this.spotLevelSliders.get(spot.name)?.value ?? 1
						const isTeamValid = !this.ownJungleOnly.value || spot.team === hero.Team
						const isLevelValid = hero.Level >= minLevel

						if (this.emptySpots.has(spot.name)) {
							color = Color.Red.SetA(150)
						} else if (!isEnabled || !isTeamValid || !isLevelValid) {
							color = Color.Gray.SetA(150)
						} else {
							color = Color.Green.SetA(150)
						}

						// Premium Marker: Diamond shape with outline
						const markerPos = screenPos.Subtract(new Vector2(6, 6))
						const markerSize = new Vector2(12, 12)

						// Shadow/Glow effect
						RendererSDK.FilledRect(markerPos.Subtract(new Vector2(1, 1)), markerSize.Add(new Vector2(2, 2)), new Color(0, 0, 0, 150), 45)

						// Main Marker
						RendererSDK.FilledRect(markerPos, markerSize, color, 45)
						RendererSDK.OutlinedRect(markerPos, markerSize, 1, color.SetA(255), 45)

						// Labels with shadows
						const nameText = spot.name
						const statusText = !isLevelValid ? `[LVL ${minLevel}+]` : (this.emptySpots.has(spot.name) ? "PУСТО" : "READY")

						const nameColor = color.SetA(255)
						const statusColor = this.emptySpots.has(spot.name) ? Color.Red.SetA(200) : (isLevelValid ? Color.Green.SetA(200) : Color.Gray.SetA(200))

						// Draw Name
						RendererSDK.Text(nameText, screenPos.AddScalarY(14).AddScalarX(1), Color.Black, "Roboto", 11, 600)
						RendererSDK.Text(nameText, screenPos.AddScalarY(14), nameColor, "Roboto", 11, 600)

						// Draw Status
						RendererSDK.Text(statusText, screenPos.AddScalarY(26).AddScalarX(1), Color.Black, "Roboto", 9, 400)
						RendererSDK.Text(statusText, screenPos.AddScalarY(26), statusColor, "Roboto", 9, 400)
					}
				}
			}

			const heroState = this.unitStates.get(hero.Index)
			if (this.drawRoute.value && heroState?.targetPos) {
				const heroScreen = RendererSDK.WorldToScreen(hero.Position)
				const targetScreen = RendererSDK.WorldToScreen(heroState.targetPos)
				if (heroScreen && targetScreen) {
					const lineColor = this.drawRouteColor.SelectedColor
					const arrowSize = new Vector2(15, 5)
					const arrowInterval = 40

					if (this.drawRouteStyle.SelectedID === 1) { // 1 means "Стрелки"
						const lineVector = targetScreen.Subtract(heroScreen)
						const angle = Math.atan2(lineVector.y, lineVector.x) * 180 / Math.PI
						const distance = lineVector.Length
						const normalizedLineVector = lineVector.Normalize()

						for (let i = 0; i < distance; i += arrowInterval) {
							const arrowCenter = heroScreen.Add(normalizedLineVector.MultiplyScalar(i))
							RendererSDK.FilledRect(arrowCenter, arrowSize, lineColor, angle)
						}
						RendererSDK.OutlinedCircle(targetScreen, new Vector2(25, 25), lineColor)

					} else { // 0 means "Линия"
						RendererSDK.Line(heroScreen, targetScreen, lineColor, 4)
						RendererSDK.OutlinedCircle(targetScreen, new Vector2(25, 25), lineColor)
					}
				}
			}

			let yOffset = 200
			const commonStatus = `Пустые лагеря: ${this.emptySpots.size}/${jungleSpots.length}`
			RendererSDK.Text(commonStatus, new Vector2(200, yOffset), Color.White, "Roboto", 20)
			yOffset += 30

			for (const [index, state] of this.unitStates) {
				const unit = EntityManager.EntityByIndex(index) as Unit
				if (!unit || !unit.IsAlive) continue

				const playerID = LocalPlayer?.PlayerID
				const isControllable = playerID !== undefined &&
					unit.IsControllableByPlayerMask !== 0n &&
					(unit.IsControllableByPlayerMask & (1n << BigInt(playerID))) !== 0n

				const heroName = unit.Name.replace("npc_dota_hero_", "").replace(/_/g, " ").toUpperCase()

				let color = isControllable ? Color.White : Color.Red
				let prefix = isControllable ? `[${heroName}]` : `[${heroName}] НЕТУ КОНТРОЛЯ`

				if (unit.IsIllusion) {
					prefix = `[Иллюзия ${heroName}]`
					if (isControllable) color = Color.Gray.SetA(200)
				}

				const unitStatus = `${prefix} ${state.currentStatus}`
				RendererSDK.Text(unitStatus, new Vector2(200, yOffset), color, "Roboto", 16)
				yOffset += 20
			}

			const teamText = `Команда: ${hero.Team === Team.Radiant ? "Свет" : hero.Team === Team.Dire ? "Тьма" : "Неизвестно"} | Только свой лес: ${this.ownJungleOnly.value ? "Да" : "Нет"}`
			const targetEnt = hero.Target
			const targetText = `Цель: ${targetEnt?.Name ?? "Нет"} [ID: ${targetEnt?.Index ?? "Нет"}] | Атакует: ${hero.IsAttacking ? "Да" : "Нет"}`
			const pointsText = `Очки способностей: ${hero.AbilityPoints} | Уровень: ${hero.Level}`
			const stateText = `Скрипт ${this.state.value ? "ВКЛЮЧЕН" : "ВЫКЛЮЧЕН"}`

			RendererSDK.Text(teamText, new Vector2(200, yOffset + 10), Color.White, "Roboto", 20)
			RendererSDK.Text(targetText, new Vector2(200, yOffset + 40), Color.White, "Roboto", 20)
			RendererSDK.Text(pointsText, new Vector2(200, yOffset + 70), Color.Yellow, "Roboto", 20)
			RendererSDK.Text(stateText, new Vector2(200, yOffset + 100), this.state.value ? Color.Green : Color.Red, "Roboto", 20)

			if (this.showGameTimer.value) {
				const time = Math.floor(GameState.RawGameTime - (GameRules?.GameStartTime ?? 0))
				const absTime = Math.abs(time)
				const mins = Math.floor(absTime / 60)
				const secs = absTime % 60
				const timeStr = `${time < 0 ? "-" : ""}${mins}:${secs.toString().padStart(2, "0")}`
				RendererSDK.Text(`Время игры: ${timeStr}`, new Vector2(200, yOffset + 130), Color.White.SetA(200), "Roboto", 20)
			}


			// Отрисовка точек для вардинга
			this.DrawWardSpots(hero)
		} catch (e) {
			this.Log(`Draw Error: ${e}`)
		}

	}

	private DrawWardSpots(hero: Unit): void {
		if (!this.autoWard.value) return

		const observer = hero.GetItemByName("item_ward_observer")
		const sentry = hero.GetItemByName("item_ward_sentry")
		if (!observer && !sentry) return

		for (const spot of jungleWardSpots) {
			const screenPos = RendererSDK.WorldToScreen(spot.pos)
			if (screenPos) {
				const dist = hero.Distance2D(spot.pos)
				const isNearby = dist < this.wardRadius.value

				// Если рядом - светим ярко желтым/синим, если далеко - тускло белым
				const color = isNearby ? new Color(255, 255, 0, 200) : new Color(255, 255, 255, 60)

				RendererSDK.OutlinedCircle(screenPos, new Vector2(15, 15), color, 2)
				RendererSDK.Text("WARD", screenPos.AddScalarY(-20), color, "Roboto", 10, 600)

				if (isNearby) {
					RendererSDK.Text(spot.name, screenPos.AddScalarY(20), color, "Roboto", 10, 400)
				}
			}
		}
	}

	private OnUpdate(hero: Unit, state: UnitState, justActed: boolean = false): void {
		try {
			if (typeof GameState === 'undefined') return

			if (!hero.IsAlive) {
				state.isGoingToFountain = false
				state.isReturningAfterHeal = false
				state.currentLotusSpot = null
				state.currentWisdomSpot = null
				state.lotusArrivalTime = 0
				state.wisdomArrivalTime = 0
				state.targetPos = undefined
				return
			}

			// Блокируем любые новые приказы во время ченнелинга (ТП, каст скиллов)
			if (hero.IsChanneling) {
				state.nextOrderDelay = 0.3
				return
			}

			if (hero.IsStunned || hero.IsHexed || hero.IsNightmared) {
				state.nextOrderDelay = 0.3
				return
			}

			const rawTime = GameState.RawGameTime
			state.actionTimestamps = state.actionTimestamps.filter(t => rawTime - t <= 60)

			// Cache entities
			this.cachedTowers = this.SafeGetEntities<Tower>(Tower)
			this.cachedCreeps = this.SafeGetEntities<Creep>(Creep)
			this.cachedRunes = this.pickAllRunes.value ? this.SafeGetEntities<Rune>(Rune) : []
			this.cachedHeroes = this.SafeGetEntities<Unit>(Unit).filter(u => u.IsHero && u.IsAlive && u.IsVisible && u !== hero)

			// Если только что использован скилл или предмет, даем время на завершение анимации каста
			if (justActed) {
				state.nextOrderDelay = 0.35
				state.lastOrderTime = rawTime
				return
			}
			
			// Авто-курьер (раз в 5 сек)
			if (this.autoCourier.value && rawTime > state.lastCourierTime + 5.0) {
				this.HandleCourier(hero, state)
				state.lastCourierTime = rawTime
			}

			// Авто-покупка предметов (раз в 2 сек)
			if (this.autoBuyItems.value && rawTime > state.lastBuyTime + 2.0) {
				this.HandleAutoBuyItems(hero, state)
				state.lastBuyTime = rawTime
			}

			// Нейтральные предметы (раз в 2 сек)
			if (rawTime > state.lastNeutralCheckTime + 2.0) {
				this.HandleNeutralItems(hero, state)
				state.lastNeutralCheckTime = rawTime
			}
			
			if (rawTime < state.lastOrderTime + state.nextOrderDelay) return

			// Динамический расчет задержки для поддержания АПМ
			if (this.maintainAPM.value) {
				const currentAPM = state.actionTimestamps.length
				let min = this.minAPMStr.value
				let max = this.maxAPMStr.value

				if (this.dynamicAPM.value) {
					if (state.currentStatus.includes("Ожидание") || state.currentStatus.includes("Путь в лес")) {
						min = Math.max(10, min - 60)
						max = Math.max(60, max - 60)
					}
					if (hero.IsAttacking || state.currentStatus.includes("Побег")) {
						min += 30
						max += 30
					}
				}

				if (currentAPM < min) {
					state.nextOrderDelay = 0.05 + Math.random() * 0.1
				} else if (currentAPM > max) {
					state.nextOrderDelay = 0.6 + Math.random() * 0.4
				} else {
					state.nextOrderDelay = 0.2 + Math.random() * 0.2
				}
			} else {
				state.nextOrderDelay = 0.05 + Math.random() * 0.1
			}

			// Глобальное отслеживание фарма союзников
			this.TrackGlobalJungleStatus(hero)

			// Авто-вардинг
			this.HandleAutoWarding(hero, state)

			const gameTime = GameState.RawGameTime - (GameRules?.GameStartTime ?? 0)
			const currentMinute = Math.floor(gameTime / 60)

			if (this.lastMinute === -1) this.lastMinute = currentMinute
			if (currentMinute !== this.lastMinute) {
				this.emptySpots.clear()
				this.allyAtSpotSince.clear()
				this.lastMinute = currentMinute
				this.Log(`Минута прошла (${currentMinute}:00), сбрасываю пустые лагеря`)
			}

			if (this.ignoreHeroes.value && hero.IsAttacking) {
				const target = hero.Target
				if (target instanceof Unit && target.IsHero && target.IsEnemy(hero)) {
					hero.OrderStop(false, true)
					this.setStatus(state, "Остановка (Игнор героев)", hero)
					state.lastOrderTime = rawTime
					return
				}
			}

			const nearbyCreep = this.cachedCreeps.find(c =>
				!c.IsNeutral && c.IsAlive && c.IsVisible && hero.Distance2D(c) < 2500 && !this.IsInTowerRange(c.Position, hero) &&
				!this.IsMidLane(c.Position) && this.IsOnSelectedLane(c.Position, hero, state)
			)
			if (nearbyCreep) {
				state.lastCreepDeathPos = nearbyCreep.Position
			}

			const hpPercent = hero.HPPercentDecimal * 100
			if (hpPercent < this.hpThreshold.value) {
				if (!state.isGoingToFountain) {
					const pos = hero.Position
					state.lastPosBeforeHeal = new Vector3(pos.x, pos.y, pos.z)
					this.Log(`HP ниже порога (${hpPercent.toFixed(1)}%), запоминаю позицию: ${state.lastPosBeforeHeal.x.toFixed(0)}, ${state.lastPosBeforeHeal.y.toFixed(0)}`, hero)
				}
				state.isGoingToFountain = true
				state.isReturningAfterHeal = false

				if (this.autoTpLowHp.value && rawTime > state.lastTpTime + 10) {
					const tp = hero.GetItemByName("item_tpscroll") ?? (hero.Inventory ? (hero.Inventory.GetItem(15) ?? hero.Inventory.Items.find(i => i?.Name === "item_tpscroll")) : null)
					if (tp && tp.IsReady) {
						const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
						if (fountain) {
							hero.CastPosition(tp, fountain.Position, false, true)
							state.lastTpTime = rawTime
							state.lastOrderTime = rawTime + 0.5
							state.nextOrderDelay = 3.5
							this.setStatus(state, "Телепортация на базу", hero)
							this.Log("Использую ТП на базу (Low HP)", hero)
							return
						}
					}
				}
			} else if (hpPercent > 95) {
				const canFarmJungle = hero.Level >= this.laneOnlyUntilLevel.value
				// Возврат после хила работает только до 4 уровня включительно
				if (state.isGoingToFountain && this.returnAfterHeal.value && state.lastPosBeforeHeal && !canFarmJungle && hero.Level <= 4) {
					state.isReturningAfterHeal = true
					this.Log(`Здоровье восстановлено, возвращаюсь на позицию: ${state.lastPosBeforeHeal.x.toFixed(0)}, ${state.lastPosBeforeHeal.y.toFixed(0)}`, hero)
					this.TryTpAfterHeal(hero, state)
				} else if (state.isGoingToFountain && (canFarmJungle || hero.Level > 4)) {
					const reason = hero.Level > 4 ? "уровень > 4" : "уровень позволяет фармить лес"
					this.Log(`Здоровье восстановлено, ${reason}, возврат на линию пропущен`, hero)
				}
				state.isGoingToFountain = false
			}

			// Если только что нажали ТП на базу, не сбиваем его шагом
			if (rawTime < state.lastTpTime + 3.2 && hero.IsChanneling) {
				return
			}

			if (state.isGoingToFountain) {
				this.setStatus(state, "Возврат на базу", hero)
				this.GoToFountain(hero, state)
				return
			}

			if (state.isReturningAfterHeal && state.lastPosBeforeHeal) {
				const canFarmJungle = hero.Level >= this.laneOnlyUntilLevel.value
				const dist = hero.Distance2D(state.lastPosBeforeHeal)

				if (canFarmJungle || hero.Level > 4) {
					state.isReturningAfterHeal = false
					this.Log(`Возврат отменен: ${hero.Level > 4 ? "уровень > 4" : "уровень позволяет фармить лес"}`, hero)
				} else if (dist < 300) {
					state.isReturningAfterHeal = false
					this.Log("Вернулся на исходную позицию", hero)
				}
			}

			if (this.fleeFromCreepsUnderTower.value && this.IsInTowerRange(hero.Position, hero) && rawTime < state.lastDamageTime + 3.0) {
				const target = hero.Target
				const isSafeToHit = target instanceof Creep && target.HP < hero.AttackDamageMax * 2

				if (!target || !target.IsAlive || !isSafeToHit) {
					this.Flee(hero, state, "Отход (Урон под башней)")
					return
				}
			}

			// Логика предотвращения урона от крипов на стадии лайнинга
			if (hero.Level < this.laneOnlyUntilLevel.value) {
				state.damageHistory = state.damageHistory.filter((d: { time: number, amount: number }) => rawTime - d.time <= 5.0)
				const totalRecentDamage = state.damageHistory.reduce((sum: number, d: { time: number, amount: number }) => sum + d.amount, 0)
				const damageThreshold = hero.MaxHP * 0.1

				if (totalRecentDamage > damageThreshold) {
					const targetingMe = this.cachedCreeps.find(c =>
						c.IsEnemy(hero) && c.IsAlive && c.IsVisible && hero.Distance2D(c) < 600 && c.TargetIndex_ === hero.Index
					)
					const inAllyTowerRange = this.cachedTowers.some(t => !t.IsEnemy(hero) && t.IsAlive && hero.Distance2D(t) < 850 + 200)

					if (targetingMe && !inAllyTowerRange) {
						this.Flee(hero, state, "Кайтинг крипов (Laning)")
						state.lastOrderTime = rawTime
						state.damageHistory = []
						return
					}
				}
			}

			let mainOrderSent = this.Farm(hero, state)

			// Если основная логика не отправила приказ, но АПМ слишком низкий - шлем "филлер"
			// Не сбиваем текущую атаку, ченнелинг или движение
			if (!mainOrderSent && this.maintainAPM.value && state.actionTimestamps.length < this.minAPMStr.value && !hero.IsAttacking && !hero.IsChanneling) {
				const target = hero.Target ?? state.targetPos
				if (target) {
					if (target instanceof Vector3) {
						hero.MoveTo(this.GetRandomizedPosition(target, 40), false, true)
					} else if (target instanceof Unit && !this.IsInTowerRange(target.Position, hero)) {
						hero.AttackTarget(target, false, true)
					}
					state.lastOrderTime = rawTime
					mainOrderSent = true
				}
			}
		} catch (e) {
			this.Log(`Update Error: ${e}`, hero)
		}
	}

	private HandleCourier(hero: Unit, state: UnitState): void {
		if (!this.autoCourier.value) return
		
		// Проверяем наличие предметов в стэше (слоты 9-14)
		let hasItemsInStash = false
		for (let i = 9; i <= 14; i++) {
			const item = hero.Inventory.GetItem(i)
			if (item && item.Name !== "item_tpscroll") {
				hasItemsInStash = true
				break
			}
		}

		if (hasItemsInStash) {
			this.SafeExecuteCommand("dota_courier_deliver")
			if (this.courierSpeed.value) {
				// Пытаемся прожать ускорение через консоль или API если возможно
				this.SafeExecuteCommand("dota_courier_burst") 
			}
			state.lastCourierTime = GameState.RawGameTime
		}
	}

	private HasItemInInventoryOrStash(hero: Unit, itemNames: string | string[], state?: UnitState): boolean {
		const names = Array.isArray(itemNames) ? itemNames : [itemNames]

		// 1. Проверяем инвентарь, тайник и рюкзак героя (слоты 0-16)
		for (let i = 0; i <= 16; i++) {
			const item = hero.Inventory?.GetItem(i)
			if (item && names.includes(item.Name)) return true
		}

		// 2. Проверяем курьеров нашей команды (через Unit с проверкой имени "courier")
		try {
			const couriers = EntityManager.GetEntitiesByClass(Unit).filter(u => u && u.IsAlive && u.Name.includes("courier") && !u.IsEnemy(hero))
			for (const courier of couriers) {
				for (let i = 0; i <= 8; i++) {
					const item = courier.Inventory?.GetItem(i)
					if (item && names.includes(item.Name)) return true
				}
			}
		} catch (e) {
			// Безопасная обработка в случае ошибок API
		}

		// 3. Проверяем кэш недавних покупок (чтобы не покупать повторно во время доставки)
		if (state && state.purchasedItems) {
			const rawTime = GameState.RawGameTime
			for (const name of names) {
				const buyTime = state.purchasedItems.get(name)
				if (buyTime && rawTime < buyTime + 6.0) {
					return true
				}
			}
		}

		return false
	}

	private GetItemCost(itemName: string): number {
		const data = AbilityData.GetAbilityByName(itemName)
		return data?.Cost ?? 0
	}

	private GetHeroGold(hero: Unit): number {
		const customData = hero.Player?.PlayerCustomData ?? LocalPlayer?.PlayerCustomData
		if (customData) {
			return (customData.ReliableGold ?? 0) + (customData.UnreliableGold ?? 0)
		}
		return -1
	}

	private GetItemId(itemName: string): number {
		const data = AbilityData.GetAbilityByName(itemName)
		if (data && typeof data.ID === "number" && data.ID > 0) {
			return data.ID
		}
		return -1
	}

	private HandleAutoBuyItems(hero: Unit, state: UnitState): void {
		if (!this.autoBuyItems.value) return

		for (const step of autoBuyBuild) {
			// Проверяем, есть ли у нас уже готовый предмет (или его апгрейд)
			const checkNames = step.altNames ?? [step.name]
			if (this.HasItemInInventoryOrStash(hero, checkNames, state)) {
				continue
			}

			// Если готового предмета нет, ищем первый недостающий компонент
			for (const comp of step.components) {
				if (!this.HasItemInInventoryOrStash(hero, comp.name, state)) {
					const itemCost = this.GetItemCost(comp.name)
					const heroGold = this.GetHeroGold(hero)

					// Проверка на золото перед покупкой (не отправляем запрос, если золота не хватает)
					if (heroGold >= 0 && itemCost > 0 && heroGold < itemCost) {
						return
					}

					const itemId = this.GetItemId(comp.name)
					if (itemId > 0) {
						this.Log(`Авто-покупка: покупка ${comp.name} (${step.displayName}) [ID:${itemId}, Золото:${heroGold}/${itemCost}]`, hero)
						hero.PurchaseItem(itemId)
						if (!state.purchasedItems) state.purchasedItems = new Map()
						state.purchasedItems.set(comp.name, GameState.RawGameTime)
					} else {
						this.Log(`Ошибка авто-покупки: не найден ID для ${comp.name}`, hero)
					}
					return // Покупаем только 1 предмет за итерацию
				}
			}
		}
	}

	private GetBestNeutralItemsForHero(hero: Unit): string[] {
		// 0: STR, 1: AGI, 2: INT, 3: UNI
		const primaryAttr = (hero as any).PrimaryAttribute ?? 0

		if (primaryAttr === 1) { // AGI
			return [
				// Tier 5
				"item_apex", "item_stygian_desolator", "item_pirate_hat", "item_giants_ring", "item_mirror_shield",
				// Tier 4
				"item_ninja_gear", "item_mind_breaker", "item_penta_edged_sword", "item_ascetic_cap", "item_telescope",
				// Tier 3
				"item_paladin_sword", "item_elven_tunic", "item_nemesis_curse", "item_titan_sliver", "item_vindicators_axe",
				// Tier 2
				"item_vambrace", "item_orb_of_destruction", "item_ring_of_aquila", "item_pupils_gift", "item_dragon_scale",
				// Tier 1
				"item_broom_handle", "item_duelist_gloves", "item_spark_of_courage", "item_seeds_of_serenity", "item_occult_bracelet"
			]
		} else if (primaryAttr === 2 || primaryAttr === 3) { // INT / UNI
			return [
				// Tier 5
				"item_book_of_the_dead", "item_mirror_shield", "item_apex", "item_ex_machina", "item_book_of_shadows",
				// Tier 4
				"item_timeless_relic", "item_spell_prism", "item_telescope", "item_ninja_gear", "item_stormcrafter",
				// Tier 3
				"item_psychic_headband", "item_ceremonial_robe", "item_quickening_charm", "item_elven_tunic", "item_shako_stuff",
				// Tier 2
				"item_philosophers_stone", "item_pupils_gift", "item_bullwhip", "item_vambrace", "item_gossamer_cape",
				// Tier 1
				"item_arcane_ring", "item_fairy_trinket", "item_occult_bracelet", "item_trusty_shovel", "item_seeds_of_serenity"
			]
		} else { // STR (Default)
			return [
				// Tier 5
				"item_apex", "item_giants_ring", "item_stygian_desolator", "item_unwavering_condition", "item_mirror_shield",
				// Tier 4
				"item_havoc_hammer", "item_mind_breaker", "item_ascetic_cap", "item_aviana_feather", "item_ninja_gear",
				// Tier 3
				"item_ogre_seal_totem", "item_paladin_sword", "item_craggy_coat", "item_titan_sliver", "item_elven_tunic",
				// Tier 2
				"item_vambrace", "item_dragon_scale", "item_pupils_gift", "item_orb_of_destruction", "item_ring_of_aquila",
				// Tier 1
				"item_occult_bracelet", "item_spark_of_courage", "item_seeds_of_serenity", "item_broom_handle", "item_trusty_shovel"
			]
		}
	}

	private HandleNeutralItems(hero: Unit, state: UnitState): void {
		const rawTime = GameState.RawGameTime

		// 1. Автоматический подбор выпавших жетонов/нейтралок с земли
		const itemOnGround = EntityManager.GetEntitiesByClass(PhysicalItem).find(u =>
			u && u.IsVisible && hero.Distance2D(u) < 450 &&
			(u.Name.includes("item_tier") || u.Name.includes("token") || (u as any).IsNeutral)
		)
		if (itemOnGround) {
			hero.PickupItem(itemOnGround, false, true)
			return
		}

		// 2. Поиск нейтральных жетонов (tokens) в инвентаре/тайнике и их активация
		const token = hero.Inventory.Items.find(i => i && i.Name.includes("item_tier") && i.Name.includes("token"))
		if (token && token.IsReady && rawTime > state.lastOrderTime + 1.0) {
			this.Log(`Авто-выбор нейтралки: открываю жетон ${token.Name}`, hero)
			token.UseAbility()
			state.lastOrderTime = rawTime
			return
		}

		// 3. Экипировка лучшего нейтрального предмета в нейтральный слот (16)
		const currentNeutral = hero.Inventory.GetItem(16)
		const bestItems = this.GetBestNeutralItemsForHero(hero)

		// Поиск доступных нейтральных предметов у героя
		const availableNeutrals = hero.Inventory.Items.filter(i =>
			i && i.IsNeutral &&
			!i.Name.includes("token") &&
			(i as any).Slot !== 16
		)

		if (availableNeutrals.length > 0) {
			// Сортируем нейтралки по рейтингу приоритета для героя
			const sorted = availableNeutrals.sort((a, b) => {
				const indexA = bestItems.indexOf(a.Name)
				const indexB = bestItems.indexOf(b.Name)
				const rankA = indexA !== -1 ? indexA : 999
				const rankB = indexB !== -1 ? indexB : 999
				return rankA - rankB
			})

			const bestAvailable = sorted[0]
			if (bestAvailable) {
				const currentRank = currentNeutral ? bestItems.indexOf(currentNeutral.Name) : 9999
				const bestRank = bestItems.indexOf(bestAvailable.Name) !== -1 ? bestItems.indexOf(bestAvailable.Name) : 999

				// Если слота нет или нашлась нейтралка лучше текущей — экипируем
				if (!currentNeutral || bestRank < currentRank) {
					this.Log(`Авто-нейтралка: экипирую ${bestAvailable.Name}`, hero)
					if (typeof (bestAvailable as any).MoveItem === "function") {
						;(bestAvailable as any).MoveItem(16)
					} else if (typeof (bestAvailable as any).SwapItems === "function" && currentNeutral) {
						;(bestAvailable as any).SwapItems(currentNeutral)
					} else {
						bestAvailable.UseAbility()
					}
					state.lastOrderTime = rawTime
					return
				}
			}
		}

		// 4. Отправка лишних неиспользуемых нейтралок в тайник
		for (const extra of availableNeutrals) {
			if (currentNeutral && extra !== currentNeutral) {
				if (typeof (extra as any).TransferToStash === "function") {
					;(extra as any).TransferToStash()
				}
			}
		}
	}

	private GetRandomChatPhrase(type: "damage" | "death"): string {
		const damagePhrases = [
			"ай, больно же",
			"не бей",
			"слыш, не надо",
			"плз не трогай",
			"лагает жесть",
			"дай пофармить плз",
			"зачем...",
			"хватит бить",
			"чел, я просто фармлю"
		]
		const deathPhrases = [
			"ну за что...",
			"понял.",
			"капец ты сильный",
			"удалю доту пожалуй",
			"ггвп",
			"ладно.",
			"ясно.",
			"чел..."
		]
		const list = type === "damage" ? damagePhrases : deathPhrases
		return list[Math.floor(Math.random() * list.length)]
	}

	private AutoItems(hero: Unit, state: UnitState): boolean {
		if (state.currentStatus === "Возврат на базу" || state.currentStatus === "Побег от башни") return false

		// Экстренное исцеление (Лотосы, Сыр) - Самый высокий приоритет
		if (this.autoLotus.value && hero.HPPercent < this.lotusHpThreshold.value) {
			const healItem = hero.GetItemByName(/item_(healing_lotus|great_healing_lotus|greater_healing_lotus|famango|great_famango|greater_famango|cheese)/)
			if (healItem?.IsReady && (!state.failedActions.has(healItem.Name) || state.failedActions.get(healItem.Name)! <= GameState.RawGameTime)) {
				this.Log(`Использование ${healItem.Name.replace("item_", "")} на ${Math.floor(hero.HPPercent)}% ХП`, hero)
				hero.CastNoTarget(healItem, false, true)
				state.failedActions.set(healItem.Name, GameState.RawGameTime + 1.0)
				state.lastOrderTime = GameState.RawGameTime
				return true
			}
		}

		if (this.usePhase.value && (hero.IsMoving || hero.IsAttacking)) {
			const phase = hero.GetItemByName("item_phase_boots")
			if (phase?.IsReady && (!state.failedActions.has(phase.Name) || state.failedActions.get(phase.Name)! <= GameState.RawGameTime)) {
				hero.CastNoTarget(phase, false, true)
				state.failedActions.set(phase.Name, GameState.RawGameTime + 1.0)
				state.lastOrderTime = GameState.RawGameTime
				return true
			}
		}

		const manaPercent = hero.ManaPercent
		const nearbyAllies = this.cachedHeroes.filter(h => !h.IsEnemy(hero) && h.IsAlive && h.IsVisible && hero.Distance2D(h) < 1200)
		const anyAllyNeedsMana = nearbyAllies.some(h => h.ManaPercent < 40)

		if (this.useArcanes.value && (manaPercent < 70 || anyAllyNeedsMana)) {
			const arcanes = hero.GetItemByName("item_arcane_boots")
			if (arcanes?.IsReady && (!state.failedActions.has(arcanes.Name) || state.failedActions.get(arcanes.Name)! <= GameState.RawGameTime)) {
				hero.CastNoTarget(arcanes, false, true)
				state.failedActions.set(arcanes.Name, GameState.RawGameTime + 1.0)
				state.lastOrderTime = GameState.RawGameTime
				return true
			}
		}

		const anyAllyNeedsHeal = nearbyAllies.some(h => h.HPPercent < 50)
		const mek = hero.GetItemByName(/item_mekansm|item_guardian_greaves/)
		if (mek?.IsReady && (hero.HPPercent < 45 || anyAllyNeedsHeal)) {
			if (!state.failedActions.has(mek.Name) || state.failedActions.get(mek.Name)! <= GameState.RawGameTime) {
				hero.CastNoTarget(mek, false, true)
				state.failedActions.set(mek.Name, GameState.RawGameTime + 1.0)
				state.lastOrderTime = GameState.RawGameTime
				return true
			}
		}

		const pipe = hero.GetItemByName("item_pipe")
		if (pipe?.IsReady && (anyAllyNeedsHeal || this.aggressiveAbilities.value)) {
			if (!state.failedActions.has(pipe.Name) || state.failedActions.get(pipe.Name)! <= GameState.RawGameTime) {
				hero.CastNoTarget(pipe, false, true)
				state.failedActions.set(pipe.Name, GameState.RawGameTime + 1.0)
				state.lastOrderTime = GameState.RawGameTime
				return true
			}
		}

		if (this.useStick.value) {
			const stick = hero.GetItemByName(/item_magic_stick|item_magic_wand/)
			if (stick?.IsReady && (stick as any).CurrentCharges > 10 && (hero.HPPercent < 30 || hero.ManaPercent < 20) && (!state.failedActions.has(stick.Name) || state.failedActions.get(stick.Name)! <= GameState.RawGameTime)) {
				hero.CastNoTarget(stick, false, true)
				state.failedActions.set(stick.Name, GameState.RawGameTime + 1.0)
				state.lastOrderTime = GameState.RawGameTime
				return true
			}

			const locket = hero.GetItemByName("item_holy_locket")
			if (locket?.IsReady && (locket as any).CurrentCharges > 0 && (!state.failedActions.has(locket.Name) || state.failedActions.get(locket.Name)! <= GameState.RawGameTime)) {
				// Сначала проверяем союзников
				if (this.useTargetedAllies.value) {
					const lowHpAlly = this.cachedHeroes.find(h => !h.IsEnemy(hero) && h.IsAlive && h.IsVisible && h.HPPercent < 50 && hero.Distance2D(h) < locket.CastRange + 150)
					if (lowHpAlly) {
						hero.CastTarget(locket, lowHpAlly, false, true)
						state.failedActions.set(locket.Name, GameState.RawGameTime + 1.0)
						state.lastOrderTime = GameState.RawGameTime
						return true
					}
				}
				// Если союзников нет, но самому плохо
				if (hero.HPPercent < 40 || hero.ManaPercent < 15) {
					hero.CastNoTarget(locket, false, true)
					state.failedActions.set(locket.Name, GameState.RawGameTime + 1.0)
					state.lastOrderTime = GameState.RawGameTime
					return true
				}
			}
		}

		// Использование предметов на спасение союзников
		if (this.useTargetedAllies.value) {
			const saves = [
				{ name: "item_force_staff", hp: 30 },
				{ name: "item_glimmer_cape", hp: 40 },
				{ name: "item_solar_crest", hp: 60 },
				{ name: "item_lotus_orb", hp: 50 },
				{ name: "item_pavise", hp: 55 }
			]

			for (const s of saves) {
				const item = hero.GetItemByName(s.name)
				if (item?.IsReady && (!state.failedActions.has(item.Name) || state.failedActions.get(item.Name)! <= GameState.RawGameTime)) {
					const target = this.cachedHeroes.find(h => !h.IsEnemy(hero) && h.IsAlive && h.IsVisible && h.HPPercent < s.hp && hero.Distance2D(h) < item.CastRange + 150)
					if (target) {
						this.Log(`Спасение: ${s.name} на ${target.Name.replace("npc_dota_hero_", "")}`, hero)
						hero.CastTarget(item, target, false, true)
						state.failedActions.set(item.Name, GameState.RawGameTime + 1.0)
						state.lastOrderTime = GameState.RawGameTime
						return true
					}
				}
			}
		}

		if (this.useMom.value && hero.IsAttacking && (state.currentStatus === "Фарм леса" || state.currentStatus === "Фарм линии")) {
			const mom = hero.GetItemByName("item_mask_of_madness")
			if (mom?.IsReady && (!state.failedActions.has(mom.Name) || state.failedActions.get(mom.Name)! <= GameState.RawGameTime)) {
				hero.CastNoTarget(mom, false, true)
				state.failedActions.set(mom.Name, GameState.RawGameTime + 1.0)
				state.lastOrderTime = GameState.RawGameTime
				return true
			}
		}

		if (this.autoMidas.value) {
			const midas = hero.GetItemByName("item_hand_of_midas")
			if (midas?.IsReady && (!state.failedActions.has(midas.Name) || state.failedActions.get(midas.Name)! <= GameState.RawGameTime)) {
				const target = this.cachedCreeps.find(
					c => this.IsNeutralCreep(c) && c.IsAlive && c.IsVisible && !c.IsInvulnerable && hero.Distance2D(c) < 600
				)
				if (target) {
					hero.CastTarget(midas, target, false, true)
					state.failedActions.set(midas.Name, GameState.RawGameTime + 1.0)
					state.lastOrderTime = GameState.RawGameTime
					return true
				}
			}
		}

		// Расходники (Bottle, Mango, Clarity, Flask)
		const consumeThreshold = 85
		const isTakingDamage = GameState.RawGameTime < state.lastDamageTime + 3.0

		// Bottle usage
		const bottle = hero.GetItemByName("item_bottle")
		if (bottle?.IsReady && (bottle as any).CurrentCharges > 0 && (!state.failedActions.has(bottle.Name) || state.failedActions.get(bottle.Name)! <= GameState.RawGameTime)) {
			if (hero.HPPercent < consumeThreshold || hero.ManaPercent < consumeThreshold) {
				if (!hero.Buffs.some(b => b.Name === "modifier_bottle_regeneration")) {
					hero.CastNoTarget(bottle, false, true)
					state.failedActions.set(bottle.Name, GameState.RawGameTime + 0.5)
					state.lastOrderTime = GameState.RawGameTime
					return true
				}
			}

			// Использование ботла на союзника (CTRL+Cast)
			if (this.useTargetedAllies.value) {
				const thirstyAlly = this.cachedHeroes.find(h => !h.IsEnemy(hero) && h.IsAlive && h.IsVisible && (h.HPPercent < 70 || h.ManaPercent < 60) && hero.Distance2D(h) < 300)
				if (thirstyAlly && !thirstyAlly.Buffs.some(b => b.Name === "modifier_bottle_regeneration")) {
					// В данном API для использования на союзника обычно достаточно CastTarget
					hero.CastTarget(bottle, thirstyAlly, false, true)
					state.failedActions.set(bottle.Name, GameState.RawGameTime + 0.5)
					state.lastOrderTime = GameState.RawGameTime
					return true
				}
			}
		}

		// Mango usage (Instant mana)
		const mango = hero.GetItemByName("item_enchanted_mango")
		if (mango?.IsReady && hero.ManaPercent < 60 && (!state.failedActions.has(mango.Name) || state.failedActions.get(mango.Name)! <= GameState.RawGameTime)) {
			hero.CastNoTarget(mango, false, true)
			state.failedActions.set(mango.Name, GameState.RawGameTime + 0.5)
			state.lastOrderTime = GameState.RawGameTime
			return true
		}

		// Clarity & Flask (Restoration over time, skip if taking damage)
		if (!isTakingDamage && !hero.IsAttacking) {
			const clarity = hero.GetItemByName("item_clarity")
			if (clarity?.IsReady && hero.ManaPercent < consumeThreshold && !hero.Buffs.some(b => b.Name === "modifier_clarity_regeneration")) {
				hero.CastNoTarget(clarity, false, true)
				state.failedActions.set(clarity.Name, GameState.RawGameTime + 0.5)
				state.lastOrderTime = GameState.RawGameTime
				return true
			}

			const flask = hero.GetItemByName("item_flask")
			if (flask?.IsReady && hero.HPPercent < 75 && !hero.Buffs.some(b => b.Name === "modifier_flask_regeneration")) {
				hero.CastNoTarget(flask, false, true)
				state.failedActions.set(flask.Name, GameState.RawGameTime + 0.5)
				state.lastOrderTime = GameState.RawGameTime
				return true
			}
		}

		// Tango usage (Eat trees for HP < 80%)
		if (hero.HPPercent < 80 && !hero.Buffs.some(b => b.Name.toLowerCase().includes("tango"))) {
			const tango = hero.GetItemByName(/item_tango|item_tango_single/)
			if (tango?.IsReady && (!state.failedActions.has(tango.Name) || state.failedActions.get(tango.Name)! <= GameState.RawGameTime)) {
				const trees = EntityManager.GetEntitiesByClass(Tree).filter(t => t.IsAlive && hero.Distance2D(t) < 250)
				const nearestTree = trees.orderByFirst(t => hero.Distance2D(t))
				if (nearestTree) {
					hero.CastTarget(tango, nearestTree, false, true)
					state.failedActions.set(tango.Name, GameState.RawGameTime + 0.5)
					state.lastOrderTime = GameState.RawGameTime
					return true
				}
			}
		}

		return false
	}

	private AutoAbilities(hero: Unit, state: UnitState): boolean {
		const manaPercentThreshold = this.manaThreshold.value
		if (hero.ManaPercent < manaPercentThreshold) return false

		// Обновляем белый список способностей
		for (const s of hero.Spells) {
			if (s && s.Level > 0 && s.IsActivated && !s.IsPassive && !s.IsHidden && !s.IsInnate && !s.Name.includes("special_bonus") && !this.enabledSpells.has(s.Name)) {
				this.enabledSpells.set(s.Name, this.spellsWhitelistNode.AddToggle(s.Name, true))
			}
		}

		const spells = hero.Spells.filter((s): s is Ability =>
			s !== undefined &&
			s.Level > 0 &&
			s.IsActivated &&
			s.IsReady &&
			!s.IsNotLearnable &&
			!s.IsPassive &&
			!s.IsHidden &&
			this.enabledSpells.get(s.Name)?.value === true
		)

		if (spells.length === 0) return false

		const target = hero.Target
		const isAttackingCreep = target instanceof Creep && target.IsAlive && hero.Distance2D(target) < 1000

		// Блинк/Лип для движения
		if (this.useMovementAbilities.value && state.targetPos && hero.Distance2D(state.targetPos) > 800) {
			const blink = spells.find(s => s.Name.includes("blink") || s.Name.includes("time_walk") || s.Name.includes("leap"))
			if (blink && (!state.failedActions.has(blink.Name) || state.failedActions.get(blink.Name)! <= GameState.RawGameTime)) {
				this.UseSoulRing(hero)
				hero.CastPosition(blink, state.targetPos, false, true)
				state.failedActions.set(blink.Name, GameState.RawGameTime + 1.0)
				state.lastOrderTime = GameState.RawGameTime
				return true
			}
		}

		for (const spell of spells) {
			if (state.failedActions.has(spell.Name) && state.failedActions.get(spell.Name)! > GameState.RawGameTime) continue

			const behavior = spell.AbilityBehaviorMask
			const isNoTarget = (behavior & DOTA_ABILITY_BEHAVIOR.DOTA_ABILITY_BEHAVIOR_NO_TARGET) !== 0n
			const isUnitTarget = (behavior & DOTA_ABILITY_BEHAVIOR.DOTA_ABILITY_BEHAVIOR_UNIT_TARGET) !== 0n
			const isPoint = (behavior & DOTA_ABILITY_BEHAVIOR.DOTA_ABILITY_BEHAVIOR_POINT) !== 0n
			const isToggle = (behavior & DOTA_ABILITY_BEHAVIOR.DOTA_ABILITY_BEHAVIOR_TOGGLE) !== 0n

			if (isToggle) {
				if (!spell.IsToggled && isAttackingCreep) {
					this.UseSoulRing(hero)
					spell.UseAbility(undefined, false, true)
					state.failedActions.set(spell.Name, GameState.RawGameTime + 1.0)
					state.lastOrderTime = GameState.RawGameTime
					return true
				}
				continue
			}

			if (isNoTarget) {
				if (this.useDamageAbilities.value && isAttackingCreep) {
					this.UseSoulRing(hero)
					spell.UseAbility()
					state.failedActions.set(spell.Name, GameState.RawGameTime + 1.0)
					state.lastOrderTime = GameState.RawGameTime
					if (!this.aggressiveAbilities.value) return true
				}
				continue
			}

			if (isUnitTarget) {
				const bestTarget = this.GetBestTargetForAbility(hero, spell)
				if (bestTarget) {
					this.UseSoulRing(hero)
					spell.UseAbility(bestTarget)
					state.failedActions.set(spell.Name, GameState.RawGameTime + 1.0)
					state.lastOrderTime = GameState.RawGameTime
					if (!this.aggressiveAbilities.value) return true
				}
			}

			if (isPoint && isAttackingCreep) {
				if (this.useDamageAbilities.value) {
					this.UseSoulRing(hero)
					spell.UseAbility(target.Position)
					state.failedActions.set(spell.Name, GameState.RawGameTime + 1.0)
					state.lastOrderTime = GameState.RawGameTime
					if (!this.aggressiveAbilities.value) return true
				}
			}
		}

		return false
	}

	private UseSoulRing(hero: Unit): void {
		if (!this.autoSoulRing.value) return
		if (hero.HPPercent < 65) return

		const soulRing = hero.GetItemByName("item_soul_ring")
		if (soulRing?.IsReady) {
			hero.CastNoTarget(soulRing, false, true)
		}
	}


	private GetBestTargetForAbility(hero: Unit, ability: Ability): Unit | undefined {
		const teamMask = ability.TargetTeamMask
		const typeMask = ability.TargetTypeMask
		const range = ability.CastRange + 150 // Буфер

		// Враги
		if ((teamMask & DOTA_UNIT_TARGET_TEAM.DOTA_UNIT_TARGET_TEAM_ENEMY) !== 0n ||
			(teamMask & DOTA_UNIT_TARGET_TEAM.DOTA_UNIT_TARGET_TEAM_BOTH) !== 0n) {

			// Приоритет героям
			if (this.useTargetedHeroes.value && (typeMask & DOTA_UNIT_TARGET_TYPE.DOTA_UNIT_TARGET_HERO) !== 0n) {
				const enemyHero = this.cachedHeroes.find(h =>
					h.IsEnemy(hero) && h.IsAlive && h.IsVisible && !h.IsInvulnerable &&
					hero.Distance2D(h) < range &&
					(!h.IsMagicImmune || ability.CanHitSpellImmuneEnemy)
				)
				if (enemyHero) return enemyHero
			}

			// Крипы
			if ((typeMask & DOTA_UNIT_TARGET_TYPE.DOTA_UNIT_TARGET_CREEP) !== 0n ||
				(typeMask & DOTA_UNIT_TARGET_TYPE.DOTA_UNIT_TARGET_BASIC) !== 0n) {
				const creep = this.cachedCreeps.find(c =>
					(c.IsEnemy(hero) || this.IsNeutralCreep(c)) && c.IsAlive && c.IsVisible && !c.IsInvulnerable &&
					hero.Distance2D(c) < range &&
					(!c.IsMagicImmune || ability.CanHitSpellImmuneEnemy) &&
					!this.IsIgnoredUnit(c)
				)
				if (creep) return creep
			}
		}

		// Союзники и Селф
		if ((teamMask & DOTA_UNIT_TARGET_TEAM.DOTA_UNIT_TARGET_TEAM_FRIENDLY) !== 0n ||
			(teamMask & DOTA_UNIT_TARGET_TEAM.DOTA_UNIT_TARGET_TEAM_BOTH) !== 0n) {

			// Сами на себя (если бафф или хилл)
			if (this.useTargetedSelf.value) {
				const isLowHp = hero.HPPercent < 50
				const isLowMana = hero.ManaPercent < 30
				const isRestore = ability.IsHealthRestore() || ability.IsManaRestore()
				const isBuff = ability.IsBuff() || ability.IsShield()

				if ((isRestore && (isLowHp || isLowMana)) || isBuff) {
					if (!hero.Buffs.some(b => b.Name === ability.Name)) {
						return hero
					}
				}
			}

			// Другие союзники
			if (this.useTargetedAllies.value && (typeMask & DOTA_UNIT_TARGET_TYPE.DOTA_UNIT_TARGET_HERO) !== 0n) {
				const allyHero = this.cachedHeroes.find(h =>
					!h.IsEnemy(hero) && h !== hero && h.IsAlive && h.IsVisible && !h.IsInvulnerable &&
					hero.Distance2D(h) < range &&
					(!h.IsMagicImmune || ability.CanHitSpellImmuneAlly) &&
					(h.HPPercent < 60 || ability.IsBuff()) // Упрощенное условие для союзников
				)
				if (allyHero) return allyHero
			}
		}

		return undefined
	}

	private GoToFountain(hero: Unit, state: UnitState): void {
		const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
		if (fountain) {
			state.targetPos = fountain.Position
			const dist = hero.Distance2D(fountain)
			if (dist > 300) {
				const rawTime = GameState.RawGameTime
				if (!hero.IsMoving || rawTime > state.lastOrderTime + 1.5) {
					const movePos = this.GetSafeMovePos(hero.Position, fountain.Position, hero, state)
					hero.MoveTo(this.GetRandomizedPosition(movePos, 50), false, true)
					state.lastOrderTime = rawTime
				}
			}
		}
	}

	private Flee(hero: Unit, state: UnitState, status: string): void {
		this.setStatus(state, status, hero)
		const alliedTowers = this.cachedTowers.filter(t => t.IsAlive && !t.IsEnemy(hero))
		const nearestAllyTower = alliedTowers.sort((a, b) => hero.Distance2D(a) - hero.Distance2D(b))[0]

		const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
		const basePos = fountain?.Position ?? hero.Position

		const fleeTarget = (nearestAllyTower && hero.Distance2D(nearestAllyTower) < 4000)
			? nearestAllyTower.Position
			: basePos

		const dir = fleeTarget.Subtract(hero.Position).Normalize()
		const movePos = hero.Position.Add(dir.MultiplyScalar(150))

		hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
		state.lastOrderTime = GameState.RawGameTime
	}

	private Farm(hero: Unit, state: UnitState): boolean {
		try {
			const rawTime = GameState.RawGameTime

			if (rawTime < state.lastOrderTime + state.nextOrderDelay) return false

			state.nextOrderDelay = 0.1 + Math.random() * 0.7 // Рандом от 0.1 до 0.8 для следующего клика

			// Разрешаем пробегать под башней к своей цели, не запуская принудительный Flee
			state.isEscapingTower = false

			// Логика стакания лагерей в X:53
			const gameTime = GameState.RawGameTime - (GameRules?.GameStartTime ?? 0)


			// Логика подбора лотосов каждые 3 минуты (3, 6, 9...)
			if (gameTime > 180) {
				const cycle = Math.floor(gameTime / 180)

				// Если мы в режиме лотоса, продолжаем сбор
				if (state.currentFarmMode === "lotus" && state.currentLotusSpot) {
					// Если цикл уже прошел, сбрасываем режим
					if (state.lastLotusPickCycle >= cycle) {
						state.currentFarmMode = "none"
						state.currentLotusSpot = null
						state.lotusArrivalTime = 0
					} else {
						const dist = hero.Distance2D(state.currentLotusSpot.pos)
						state.targetPos = state.currentLotusSpot.pos

						if (dist > 250) {
							this.setStatus(state, `Сбор лотоса: ${state.currentLotusSpot.name}`, hero)
							state.lotusArrivalTime = 0
							if (!hero.IsMoving || rawTime > state.lastOrderTime + 1.5) {
								hero.MoveTo(state.currentLotusSpot.pos, false, true)
								state.lastOrderTime = rawTime
							}
							return true
						} else {
							if (state.lotusArrivalTime === 0) {
								state.lotusArrivalTime = rawTime
							}

							if (rawTime < state.lotusArrivalTime + 3.1) {
								this.setStatus(state, `Ожидание лотоса (3 сек): ${Math.max(0, Math.ceil(3.1 - (rawTime - state.lotusArrivalTime)))}с`, hero)
								return true
							} else {
								this.Log(`Лотос собран в цикле ${cycle}`, hero)
								state.lastLotusPickCycle = cycle
								state.currentFarmMode = "none"
								state.currentLotusSpot = null
								state.lotusArrivalTime = 0
							}
						}
					}
				} else if (state.lastLotusPickCycle < cycle) {
					// Ищем ближайший лотос для начала сбора (радиус 1500)
					for (const spot of lotusSpots) {
						if (hero.Distance2D(spot.pos) < 1500) {
							state.currentLotusSpot = spot
							state.currentFarmMode = "lotus"
							state.lastModeSwitchTime = rawTime
							state.lotusArrivalTime = 0
							this.setStatus(state, `Сбор лотоса: ${spot.name}`, hero)
							hero.MoveTo(spot.pos, false, true)
							state.lastOrderTime = rawTime
							return true
						}
					}
				}
			}

			// Логика подбора бассейнов опыта каждые 7 минут (7, 14, 21...)
			if (gameTime > 420) {
				const cycle = Math.floor(gameTime / 420)

				if (state.currentFarmMode === "wisdom" && state.currentWisdomSpot) {
					// Если цикл уже прошел, сбрасываем режим
					if (state.lastWisdomPickCycle >= cycle) {
						state.currentFarmMode = "none"
						state.currentWisdomSpot = null
						state.wisdomArrivalTime = 0
					} else {
						const dist = hero.Distance2D(state.currentWisdomSpot.pos)
						state.targetPos = state.currentWisdomSpot.pos

						if (dist > 250) {
							this.setStatus(state, `Сбор опыта: ${state.currentWisdomSpot.name}`, hero)
							state.wisdomArrivalTime = 0
							if (!hero.IsMoving || rawTime > state.lastOrderTime + 1.5) {
								hero.MoveTo(state.currentWisdomSpot.pos, false, true)
								state.lastOrderTime = rawTime
							}
							return true
						} else {
							if (state.wisdomArrivalTime === 0) {
								state.wisdomArrivalTime = rawTime
							}

							if (rawTime < state.wisdomArrivalTime + 4.1) {
								this.setStatus(state, `Сбор опыта (4 сек): ${Math.max(0, Math.ceil(4.1 - (rawTime - state.wisdomArrivalTime)))}с`, hero)
								return true
							} else {
								this.Log(`Опыт собран в цикле ${cycle}`, hero)
								state.lastWisdomPickCycle = cycle
								state.currentFarmMode = "none"
								state.currentWisdomSpot = null
								state.wisdomArrivalTime = 0
							}
						}
					}
				} else if (state.lastWisdomPickCycle < cycle) {
					// Ищем ближайший руну мудрости (радиус 2500)
					for (const spot of wisdomSpots) {
						if (hero.Distance2D(spot.pos) < 2500) {
							state.currentWisdomSpot = spot
							state.currentFarmMode = "wisdom"
							state.lastModeSwitchTime = rawTime
							state.wisdomArrivalTime = 0
							this.setStatus(state, `Сбор опыта: ${spot.name}`, hero)
							hero.MoveTo(spot.pos, false, true)
							state.lastOrderTime = rawTime
							return true
						}
					}
				}
			}

			if (this.pickAllRunes.value) {
				const rune = this.cachedRunes.find(r =>
					hero.Distance2D(r) < 1500 &&
					!this.IsInTowerRange(r.Position, hero)
				)
				if (rune) {
					this.setStatus(state, `Подбор руны: ${rune.Name.replace("rune_", "")}`, hero)
					state.targetPos = rune.Position
					hero.PickupRune(rune, false, true)
					state.lastOrderTime = rawTime
					return true
				}
			}

			const closestLaneCreep = this.laneFarm.value ? this.GetNearestLaneCreep(hero, state) : undefined
			let targetCreep = closestLaneCreep

			const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
			const isAtBase = fountain && hero.Distance2D(fountain) < 5500

			const hasValidLaneCreep = closestLaneCreep !== undefined
			const timeSinceLastCreep = rawTime - state.lastLaneCreepVisibleTime
			const withinWaitTime = timeSinceLastCreep < this.laneWaitTime.value
			const belowLevelThreshold = hero.Level < this.laneOnlyUntilLevel.value

			const waitingOnLane = this.laneFarm.value &&
				!hasValidLaneCreep &&
				withinWaitTime &&
				(belowLevelThreshold || (this.lanePriorityUntil4.value && hero.Level < 4)) &&
				!isAtBase

			if (this.detailedDebug.value && !hasValidLaneCreep && this.laneFarm.value && !isAtBase && belowLevelThreshold) {
				this.Log(`Ожидание на линии: Крип:${hasValidLaneCreep} Время:${timeSinceLastCreep.toFixed(1)}/${this.laneWaitTime.value} Lvl:${belowLevelThreshold}`, hero)
			}

			const forceLanePriority = this.lanePriorityUntil4.value && hero.Level < 4
			const canFarmJungle = hero.Level >= this.laneOnlyUntilLevel.value || forceLanePriority
			const nearestSpot = (canFarmJungle && !waitingOnLane) ? this.GetNearestEnabledSpot(hero, state) : null

			// Логика выбора режима (Линия или Лес) с гистерезисом 300
			let shouldFarmLane = false
			if (closestLaneCreep) {
				const distToCreep = hero.Distance2D(closestLaneCreep)
				const distToJungle = nearestSpot ? hero.Distance2D(nearestSpot.pos) : Infinity

				if (forceLanePriority || !nearestSpot) {
					shouldFarmLane = true
				} else {
					const hysteresis = 300
					const modeSwitchCooldown = 3.0 // 3 секунды задержка на смену режима

					if (state.currentFarmMode === "lane") {
						// Если уже на линии, переходим в лес только если он значительно ближе и прошло время КД
						const canSwitch = rawTime > state.lastModeSwitchTime + modeSwitchCooldown
						shouldFarmLane = !canSwitch || (distToCreep < distToJungle + (2 * hysteresis))
					} else if (state.currentFarmMode === "jungle") {
						// Если уже в лесу, возвращаемся на линию только если она значительно ближе и прошло время КД
						const canSwitch = rawTime > state.lastModeSwitchTime + modeSwitchCooldown
						shouldFarmLane = canSwitch && (distToCreep < distToJungle)
					} else {
						// Начальный выбор
						shouldFarmLane = distToCreep < distToJungle
					}
				}
			}

			if (shouldFarmLane && targetCreep) {
				const isCreepInEnemyTowerRange = this.IsInTowerRange(targetCreep.Position, hero)
				if (!isCreepInEnemyTowerRange) {
					if (state.currentFarmMode !== "lane") {
						state.currentFarmMode = "lane"
						state.lastModeSwitchTime = rawTime
					}
					this.setStatus(state, "Фарм линии", hero)

					// Не переключаем цель случайным образом каждый кадр, если текущая цель жива и рядом
					const currentTarget = hero.Target
					let finalTarget: Creep = targetCreep
					if (currentTarget instanceof Creep && currentTarget.IsAlive && currentTarget.IsVisible && currentTarget.IsEnemy(hero) && !this.IsInTowerRange(currentTarget.Position, hero) && hero.Distance2D(currentTarget) < 900) {
						finalTarget = currentTarget
					}

					state.targetPos = finalTarget.Position

					const isAttackingSame = hero.TargetIndex_ === finalTarget.Index && (hero.IsAttacking || hero.IsMoving)

					if (!isAttackingSame) {
						hero.AttackTarget(finalTarget, false, true)
						state.lastOrderTime = GameState.RawGameTime
						return true
					}
					return false
				}
			}

			if (waitingOnLane) {
				this.setStatus(state, `Ожидание крипов (${Math.ceil(this.laneWaitTime.value - (rawTime - state.lastLaneCreepVisibleTime))}сек)`, hero)

				if (this.randomWalkWaiting.value || (this.chaoticMoveAroundLastCreep.value && state.lastCreepDeathPos)) {
					let centerPos = state.lastCreepDeathPos

					// Если нет точки смерти или она в миду, выбираем позицию на боковой линии принудительно
					if (!centerPos || this.IsMidLane(centerPos)) {
						centerPos = this.GetDefaultLanePos(hero, state)
					}

					if (this.IsInTowerRange(centerPos, hero) || this.IsMidLane(centerPos)) {
						centerPos = this.GetDefaultLanePos(hero, state)
					}

					const distToCenter = hero.Distance2D(centerPos)

					if (distToCenter > 800) {
						const movePos = this.GetSafeMovePos(hero.Position, centerPos, hero, state)
						if (movePos.Distance2D(hero.Position) > 100) {
							hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
							state.lastOrderTime = rawTime
							return true
						}
					}

					if (rawTime > state.lastRandomWalkPosUpdateTime + 0.5) {
						let attempts = 0
						let foundValidPos = false

						while (attempts < 10 && !foundValidPos) {
							const angle = Math.random() * Math.PI * 2
							const radius = 100 + Math.random() * 300
							const randomPos = new Vector3(
								centerPos.x + Math.cos(angle) * radius,
								centerPos.y + Math.sin(angle) * radius,
								centerPos.z
							)

							if (!this.IsInTowerRange(randomPos, hero) && !this.IsMidLane(randomPos)) {
								state.lastRandomWalkPos = randomPos
								foundValidPos = true
							}
							attempts++
						}

						if (!foundValidPos) {
							state.lastRandomWalkPos = centerPos
						}
						state.lastRandomWalkPosUpdateTime = rawTime
					}

					if (state.lastRandomWalkPos && rawTime > state.lastOrderTime + 0.25) {
						if (!this.IsInTowerRange(state.lastRandomWalkPos, hero)) {
							const movePos = this.GetSafeMovePos(hero.Position, state.lastRandomWalkPos, hero, state)
							hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
							state.lastOrderTime = rawTime
						} else {
							state.lastRandomWalkPosUpdateTime = 0
						}
					}
					return true
				}
				return false
			}

			if (nearestSpot) {
				if (state.currentFarmMode !== "jungle") {
					state.currentFarmMode = "jungle"
					state.lastModeSwitchTime = rawTime
				}
				state.targetPos = nearestSpot.pos

				const neutralsInSpot = this.cachedCreeps.filter(
					c =>
						this.IsNeutralCreep(c) &&
						c.IsAlive &&
						c.Health > 0 &&
						!c.IsDormant &&
						c.IsSpawned &&
						c.IsVisible &&
						!c.IsPhantom &&
						!c.IsInvulnerable &&
						(c.Distance2D(nearestSpot.pos) < 1400 || (hero.Distance2D(nearestSpot.pos) < 1400 && hero.Distance2D(c) < 1000))
				)

				if (neutralsInSpot.length > 0) {
					const closestNeutral = neutralsInSpot.sort((a, b) => hero.Distance2D(a) - hero.Distance2D(b))[0]
					const currentTarget = hero.Target
					let neutral: Creep = closestNeutral
					if (currentTarget instanceof Creep && currentTarget.IsAlive && currentTarget.Health > 0 && currentTarget.IsVisible && this.IsNeutralCreep(currentTarget) && (currentTarget.Distance2D(nearestSpot.pos) < 1400 || hero.Distance2D(currentTarget) < 1000)) {
						neutral = currentTarget
					}

					this.setStatus(state, "Фарм леса", hero)
					state.targetPos = neutral.Position

					hero.AttackTarget(neutral, false, true)
					state.lastOrderTime = GameState.RawGameTime
					return true
				}

				const dist = hero.Distance2D(nearestSpot.pos)

				if (rawTime > state.stuckCheckTime + 8.0) {
					if (state.lastPosForStuckCheck && hero.Distance2D(state.lastPosForStuckCheck) < 75) {
						if (this.autoStuckTp.value && rawTime > state.lastTpTime + 15) {
							if (this.TryTpToFarmSpot(hero, state, nearestSpot.pos)) {
								state.lastPosForStuckCheck = undefined
								state.stuckCheckTime = rawTime
								return true
							}
						}
						if (dist < 300) {
							this.Log(`Спот ${nearestSpot.name} помечен пустым (Застревание, dist: ${Math.floor(dist)})`, hero)
							this.emptySpots.add(nearestSpot.name)
							state.currentJungleSpotName = null
							state.lastOrderTime = 0
							state.lastSpotArrivalTime = 0
							state.lastPosForStuckCheck = undefined
							state.stuckCheckTime = rawTime
							return true
						}
					}
					state.lastPosForStuckCheck = hero.Position
					state.stuckCheckTime = rawTime
				}

				if (dist <= 400) {
					this.setStatus(state, `Спот пуст: ${nearestSpot.name}`, hero)
					this.emptySpots.add(nearestSpot.name)
					state.currentJungleSpotName = null
					state.lastOrderTime = 0
					state.lastSpotArrivalTime = 0
					return true
				} else {
					this.setStatus(state, `Путь в лес: ${nearestSpot.name}`, hero)
					state.lastSpotArrivalTime = 0
					const movePos = this.GetSafeMovePos(hero.Position, nearestSpot.pos, hero, state)
					hero.AttackMove(this.GetRandomizedPosition(movePos), false, true)
					state.lastOrderTime = GameState.RawGameTime
					return true
				}
			} else {
				if (state.isReturningAfterHeal && state.lastPosBeforeHeal) {
					this.setStatus(state, "Возврат после хила", hero)
					const movePos = this.GetSafeMovePos(hero.Position, state.lastPosBeforeHeal, hero, state)
					if (hero.Distance2D(movePos) > 150) {
						hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
						state.lastOrderTime = rawTime
						return true
					}
				}

				if (this.laneFarm.value && state.lastCreepDeathPos && !this.IsMidLane(state.lastCreepDeathPos)) {
					this.setStatus(state, "Возврат на линию", hero)
					let target = state.lastCreepDeathPos

					// Если точка смерти крипа под ВРАЖЕСКОЙ башней, находим безопасную точку перед ней
					if (this.IsInTowerRange(target, hero)) {
						const tower = this.cachedTowers.find(t => t.IsAlive && t.IsEnemy(hero) && t.Distance2D(target) < 1000)
						if (tower) {
							const dirFromTower = target.Subtract(tower.Position).Normalize()
							target = tower.Position.Add(dirFromTower.MultiplyScalar(900)) // Граница башни 850 + запас
						}
					}

					const movePos = this.GetSafeMovePos(hero.Position, target, hero, state)
					if (hero.Distance2D(movePos) > 150) {
						hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
						state.lastOrderTime = GameState.RawGameTime
						return true
					}
				}
				this.setStatus(state, "Нет доступных целей", hero)
				state.currentFarmMode = "none"
				state.targetPos = undefined

				const distToFountain = fountain ? hero.Distance2D(fountain) : 10000
				if (distToFountain < 6000 && !state.isReturningAfterHeal) {
					const targetPos = this.GetDefaultLanePos(hero, state)
					this.setStatus(state, "Выход на линию", hero)
					state.targetPos = targetPos
					if (!hero.IsMoving || rawTime > state.lastOrderTime + 1.5) {
						const movePos = this.GetSafeMovePos(hero.Position, targetPos, hero, state)
						hero.MoveTo(movePos, false, true)
						state.lastOrderTime = GameState.RawGameTime
					}
					return true
				}

				return false
			}
		} catch (e) {
			this.Log(`Farm Error: ${e}`, hero)
			return false
		}
	}

	private TryTpAfterHeal(hero: Unit, state: UnitState): boolean {
		if (!this.tpAfterHeal.value) return false
		const rawTime = GameState.RawGameTime
		if (rawTime < state.lastTpTime + 15.0) return false

		const tpScroll = hero.Inventory.GetItem(15) ?? hero.GetItemByName("item_tpscroll")
		if (!tpScroll || !tpScroll.IsReady) return false

		// Ищем союзных крипов на нашей линии
		const allies = this.cachedCreeps.filter(c =>
			!c.IsEnemy(hero) &&
			!c.IsNeutral &&
			c.IsAlive &&
			c.IsVisible &&
			!c.IsPhantom &&
			!c.IsInvulnerable &&
			this.IsOnSelectedLane(c.Position, hero, state)
		)

		let tpTarget: Unit | undefined

		if (allies.length > 0) {
			if (state.lastPosBeforeHeal) {
				tpTarget = allies.sort((a, b) => a.Distance2D(state.lastPosBeforeHeal!) - b.Distance2D(state.lastPosBeforeHeal!))[0]
			} else {
				tpTarget = allies.sort((a, b) => b.Distance2D(hero.Position) - a.Distance2D(hero.Position))[0]
			}
		}

		if (!tpTarget) {
			tpTarget = this.GetFurthestAlliedTower(hero, state)
		}

		if (tpTarget) {
			const targetName = tpTarget.Name.replace("npc_dota_", "")
			this.Log(`ТП после хила: телепортация к ${targetName}`, hero)
			hero.CastTarget(tpScroll, tpTarget, false, true)
			state.lastTpTime = rawTime
			state.lastOrderTime = rawTime + 0.5
			state.nextOrderDelay = 3.5
			return true
		}

		return false
	}

	private TryTpToFarmSpot(hero: Unit, state: UnitState, targetPos?: Vector3): boolean {
		const rawTime = GameState.RawGameTime
		if (rawTime < state.lastTpTime + 15.0) return false

		const tpScroll = hero.Inventory.GetItem(15) ?? hero.GetItemByName("item_tpscroll")
		if (!tpScroll || !tpScroll.IsReady) return false

		const dest = targetPos ?? hero.Position

		// 1. Ищем союзных крипов наиболее близких к целевой точке фарма
		const allies = this.cachedCreeps.filter(c =>
			!c.IsEnemy(hero) &&
			!c.IsNeutral &&
			c.IsAlive &&
			c.IsVisible &&
			!c.IsPhantom &&
			!c.IsInvulnerable
		)

		let tpTarget: Unit | undefined

		if (allies.length > 0) {
			tpTarget = allies.sort((a, b) => a.Distance2D(dest) - b.Distance2D(dest))[0]
		}

		if (!tpTarget) {
			tpTarget = this.GetFurthestAlliedTower(hero, state)
		}

		if (tpTarget) {
			const targetName = tpTarget.Name.replace("npc_dota_", "")
			this.Log(`Авто-ТП при застревании: телепортация к ${targetName}`, hero)
			hero.CastTarget(tpScroll, tpTarget, false, true)
			state.lastTpTime = rawTime
			state.lastOrderTime = rawTime + 0.5
			state.nextOrderDelay = 3.5
			return true
		}

		// Если нет ни крипов, ни башен — ТП на базу
		const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
		if (fountain) {
			hero.CastPosition(tpScroll, fountain.Position, false, true)
			state.lastTpTime = rawTime
			state.lastOrderTime = rawTime + 0.5
			state.nextOrderDelay = 3.5
			this.Log("Авто-ТП при застревании: телепортация на базу", hero)
			return true
		}

		return false
	}

	private IsSpotOccupied(spot: JungleSpot, hero: Unit): boolean {
		if (this.emptySpots.has(spot.name)) return true

		if (this.skipIfAllyFarming.value) {
			const allyNearby = this.cachedHeroes.some(h =>
				h.Index !== hero.Index &&
				!h.IsEnemy(hero) &&
				!h.IsIllusion &&
				h.IsAlive &&
				h.Distance2D(spot.pos) < 850
			)
			if (allyNearby) return true
		}

		if (this.skipIfEnemyFarming.value) {
			const enemyNearby = this.cachedHeroes.some(h =>
				h.IsEnemy(hero) &&
				!h.IsIllusion &&
				h.IsAlive &&
				h.IsVisible &&
				h.Distance2D(spot.pos) < 850
			)
			if (enemyNearby) return true
		}

		return false
	}

	private GetNearestEnabledSpot(hero: Unit, state: UnitState): JungleSpot | null {
		const targetLane = this.GetTargetLane(hero, state)

		let enabledSpots = jungleSpots.filter(spot => {
			if (!this.spotToggles.get(spot.name)?.value) return false
			const minLevel = this.spotLevelSliders.get(spot.name)?.value ?? 1
			if (hero.Level < minLevel) return false
			if (this.ownJungleOnly.value && spot.team !== hero.Team) return false
			if (this.IsSpotOccupied(spot, hero)) return false

			// Строго ограничиваем споты стороной нашей линии!
			const isSpotTop = spot.pos.y > spot.pos.x
			const isSpotBot = spot.pos.x > spot.pos.y
			if (targetLane === 1 && !isSpotTop) return false
			if (targetLane === 2 && !isSpotBot) return false

			return true
		})

		// На стадии лайнинга или ранней игре ограничение 3500 от героя
		if (hero.Level < this.laneOnlyUntilLevel.value || hero.Level < 6) {
			enabledSpots = enabledSpots.filter(spot => hero.Distance2D(spot.pos) < 3500)
		}

		if (enabledSpots.length === 0) {
			state.currentJungleSpotName = null
			return null
		}

		// Если уже выбрали спот и он еще не занят союзником/врагом, продолжаем путь к нему
		if (state.currentJungleSpotName) {
			const current = enabledSpots.find(s => s.name === state.currentJungleSpotName)
			if (current) return current
		}

		const sorted = enabledSpots.sort((a, b) => hero.Distance2D(a.pos) - hero.Distance2D(b.pos))
		const nearest = sorted[0]
		state.currentJungleSpotName = nearest.name
		return nearest
	}

	private GetNearestLaneCreep(hero: Unit, state: UnitState): Creep | undefined {
		const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
		const isAtBase = fountain && hero.Distance2D(fountain) < 5500
		const maxDist = (isAtBase || state.isReturningAfterHeal) ? 4000 : 3500

		if (this.detailedDebug.value && state.isReturningAfterHeal) {
			this.Log(`Поиск (HeroTeam:${hero.Team} Base:${isAtBase} Return:true)`, hero)
		}

		const creeps = this.cachedCreeps.filter(
			c => {
				const isEnemy = c.IsEnemy(hero)
				const isNotNeutral = !c.IsNeutral
				const isAlive = c.IsAlive
				const isVisible = c.IsVisible
				const isNotPhantom = !c.IsPhantom
				const isNotInvulnerable = !c.IsInvulnerable
				const dist = hero.Distance2D(c)
				const distValid = dist < maxDist
				const laneValid = this.IsOnSelectedLane(c.Position, hero, state)
				const notIgnored = !this.IsIgnoredUnit(c)

				const allValid = isEnemy && isNotNeutral && isAlive && isVisible && isNotPhantom && isNotInvulnerable && distValid && laneValid && notIgnored

				return allValid
			}
		)

		if (creeps.length > 0) {
			state.lastLaneCreepVisibleTime = GameState.RawGameTime
		}

		return creeps.sort((a, b) => hero.Distance2D(a) - hero.Distance2D(b))[0]
	}

	private TrackGlobalJungleStatus(hero: Unit): void {
		// Отслеживание союзников на спотах без принудительной пометки пустым
	}

	private IsIgnoredUnit(unit: Unit): boolean {
		const name = unit.Name
		if (name.includes("_spider")) return true
		if (name.includes("_bear")) return true
		if (name.includes("_eidolon")) return true
		if (name.includes("_treant")) return true
		if (name.includes("_wolf")) return true
		if (name.includes("_golem")) return true
		if (name.includes("beastmaster_hawk") || name.includes("beastmaster_boar")) return true
		if (unit.IsIllusion) return true
		return false
	}

	private IsMidLane(pos: Vector3): boolean {
		// Мид в Доте идет по диагонали от (~ -6000, -6000) до (~ 6000, 6000)
		return Math.abs(pos.x - pos.y) < 1200 && Math.abs(pos.x) < 6000 && Math.abs(pos.y) < 6000
	}

	private GetTargetLane(hero: Unit, state?: UnitState): 1 | 2 {
		if (state && state.assignedLane) {
			return state.assignedLane
		}

		let lane: 1 | 2
		if (hero.Position.y > hero.Position.x + 800) {
			lane = 1
		} else if (hero.Position.x > hero.Position.y + 800) {
			lane = 2
		} else {
			const topAllies = this.cachedHeroes.filter(h => !h.IsEnemy(hero) && h.Position.y > h.Position.x && !this.IsMidLane(h.Position)).length
			const botAllies = this.cachedHeroes.filter(h => !h.IsEnemy(hero) && h.Position.y < h.Position.x && !this.IsMidLane(h.Position)).length
			lane = topAllies <= botAllies ? 1 : 2
		}

		if (state) {
			state.assignedLane = lane
		}
		return lane
	}

	private IsOnSelectedLane(pos: Vector3, hero: Unit, state?: UnitState): boolean {
		if (this.IsMidLane(pos)) return false

		const targetLane = this.GetTargetLane(hero, state)
		if (targetLane === 1) return pos.y > pos.x + 800 // Top/Left side
		if (targetLane === 2) return pos.x > pos.y + 800 // Bot/Right side

		return false
	}

	private IsInTowerRange(pos: Vector3, hero: Unit, additionalRadius = 0): boolean {
		const tower = this.cachedTowers.find(t => t.IsAlive && t.IsEnemy(hero) && t.Distance2D(pos) < 700 + 150 + additionalRadius)
		if (tower) return true

		if (this.laneTowerSafety.value && hero.Level < 10) {
			const extra = this.laneTowerRadius.value
			const towerExtra = this.cachedTowers.find(t => t.IsAlive && t.IsEnemy(hero) && t.Distance2D(pos) < 700 + 150 + extra + additionalRadius)
			if (towerExtra) return true
		}

		return false
	}

	private IsInAnyTowerRange(pos: Vector3, hero: Unit): boolean {
		const tower = this.cachedTowers.find(t => t.IsAlive && t.Distance2D(pos) < 700 + 150)
		return tower !== undefined
	}

	private GetFurthestAlliedTower(hero: Unit, state?: UnitState): Tower | undefined {
		const alliedTowers = this.cachedTowers.filter(t => t.IsAlive && !t.IsEnemy(hero))
		if (alliedTowers.length === 0) return undefined

		const targetLane = this.GetTargetLane(hero, state)

		const isTop = (t: Tower) => t.Position.y > t.Position.x
		const isBot = (t: Tower) => t.Position.y < t.Position.x

		const laneTowers = alliedTowers.filter(t => {
			if (targetLane === 1) return isTop(t) && !this.IsMidLane(t.Position)
			if (targetLane === 2) return isBot(t) && !this.IsMidLane(t.Position)
			return true
		})

		if (laneTowers.length === 0) return alliedTowers.sort((a, b) => hero.Distance2D(b.Position) - hero.Distance2D(a.Position))[0]

		const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
		if (!fountain) return laneTowers.sort((a, b) => hero.Distance2D(b.Position) - hero.Distance2D(a.Position))[0]

		// Сортируем по дистанции от фонтана, берем самую дальнюю
		return laneTowers.sort((a, b) => fountain.Distance2D(b.Position) - fountain.Distance2D(a.Position))[0]
	}

	private HandleAutoWarding(hero: Unit, state: UnitState): void {
		if (!this.autoWard.value) return

		const observer = hero.GetItemByName("item_ward_observer")
		const sentry = hero.GetItemByName("item_ward_sentry")
		if (!observer && !sentry) return

		const ward = (observer && observer.IsReady) ? observer : ((sentry && sentry.IsReady) ? sentry : null)
		if (!ward) return

		const rawTime = GameState.RawGameTime
		if (rawTime < state.lastOrderTime + 1.0) return // Задержка между любыми ордерами

		for (const spot of jungleWardSpots) {
			const dist = hero.Distance2D(spot.pos)
			if (dist < this.wardRadius.value) {
				// Проверяем, нет ли уже нашего варда в этой точке (радиус 400)
				const existingWards = this.SafeGetEntities<Unit>(Unit).filter(u =>
					(u.Name === "npc_dota_observer_wards" || u.Name === "npc_dota_sentry_wards") &&
					!u.IsEnemy(hero) &&
					u.Distance2D(spot.pos) < 400
				)

				if (existingWards.length === 0) {
					this.Log(`Авто-вардинг: Ставлю вард в точку ${spot.name}`, hero)
					hero.CastPosition(ward, spot.pos, false, true)
					state.lastOrderTime = rawTime
					state.nextOrderDelay = 0.5
					return // Только один вард за раз
				}
			}
		}
	}

	private GetDefaultLanePos(hero: Unit, state?: UnitState): Vector3 {
		const isRadiant = hero.Team === Team.Radiant
		const targetLane = this.GetTargetLane(hero, state)

		if (targetLane === 1) { // Верх
			return isRadiant ? new Vector3(-6800, 1500, 256) : new Vector3(1500, 6800, 256)
		} else { // Низ
			return isRadiant ? new Vector3(1500, -6800, 256) : new Vector3(6800, 1500, 256)
		}
	}

	private GetSafeMovePos(start: Vector3, end: Vector3, hero: Unit, state: UnitState): Vector3 {
		return end
	}
})()
