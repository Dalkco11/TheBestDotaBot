import {
	Ability,
	Color,
	Creep,
	EntityManager,
	EventsSDK,
	Fountain,
	GameState,
	LifeState,
	LocalPlayer,
	MapArea,
	Menu,
	Player,
	PlayerResource,
	RendererSDK,
	TextFlags,
	Tower,
	Unit,
	Team,
	Vector2,
	Vector3
} from "github.com/octarine-public/wrapper/index"

interface JungleSpot {
	name: string
	pos: Vector3
	team: Team
}

const jungleSpots: JungleSpot[] = [
	{ name: "diretoplinespotmalenkiy", pos: new Vector3(-3901, 4903, 128), team: Team.Dire },
	{ name: "diretoplinespotbolwoy", pos: new Vector3(-4791, 4036, 128), team: Team.Dire },
	{ name: "diretopbountyspotsredniy", pos: new Vector3(-2613, 3916, 256), team: Team.Dire },
	{ name: "diretopbountyyawericispot", pos: new Vector3(-946, 4760, 134), team: Team.Dire },
	{ name: "diremidsredniycamp", pos: new Vector3(1256, 4072, 128), team: Team.Dire },
	{ name: "diremidbolwoycamp", pos: new Vector3(1119, 2551, 128), team: Team.Dire },
	{ name: "direbotsredniycampexp", pos: new Vector3(7935, -31, 256), team: Team.Dire },
	{ name: "direbotmalenkiycampexp", pos: new Vector3(8000, 1252, 256), team: Team.Dire },
	{ name: "radbotlinespotmalenkiy", pos: new Vector3(4062, -5101, 128), team: Team.Radiant },
	{ name: "radbotlinespotbolwoy", pos: new Vector3(4749, -3750, 128), team: Team.Radiant },
	{ name: "radbotbountyspotsredniy", pos: new Vector3(1894, -4077, 256), team: Team.Radiant },
	{ name: "radbountyyawericispot", pos: new Vector3(259, -5051, 134), team: Team.Radiant },
	{ name: "radmidsredniycamp", pos: new Vector3(-1935, -4806, 128), team: Team.Radiant },
	{ name: "radmidbolwoycamp", pos: new Vector3(-1489, -3319, 128), team: Team.Radiant },
	{ name: "radtopmalenkiycampexp", pos: new Vector3(-7951, -1790, 256), team: Team.Radiant },
	{ name: "radtopsredniycampexp", pos: new Vector3(-8000, -605, 256), team: Team.Radiant }
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

	private readonly laneNode = this.entry.AddNode("Настройки Линии", "", "Все, что касается фарма крипов на линии")
	private readonly laneFarm = this.laneNode.AddToggle("Фарм линии", true, "Разрешить герою фармить крипов на линии")
	private readonly laneOnlyUntilLevel = this.laneNode.AddSlider("Фарм линии до уровня", 1, 1, 30, 1, "Герой будет игнорировать лес и фармить только линию до этого уровня")
	private readonly laneWaitTime = this.laneNode.AddSlider("Ожидание крипов (сек)", 30, 0, 120, 1, "Сколько секунд ждать новую пачку на линии")
	private readonly lanePriority = this.laneNode.AddDropdown("Приоритет линии", ["Автоматически", "Только Верх", "Только Низ", "Меньше союзников"], 3, "Какую линию фармить в первую очередь (до уровня леса)")
	private readonly randomWalkWaiting = this.laneNode.AddToggle("Случайная ходьба", true, "Активное движение в безопасной зоне при ожидании")
	private readonly chaoticMoveAroundLastCreep = this.laneNode.AddToggle("Мансы у места смерти", true, "Движение вокруг позиции последнего убитого крипа")
	private readonly laneTowerSafety = this.laneNode.AddToggle("Доп. радиус от башен", true, "Увеличивает безопасную дистанцию до башен на стадии линии")
	private readonly laneTowerRadius = this.laneNode.AddSlider("Радиус отступа (линия)", 150, 0, 500, 1, "На сколько единиц дальше держаться от радиуса атаки башни")
	private readonly fleeFromCreepsUnderTower = this.laneNode.AddToggle("Отход при уроне под башней", true, "Уходить, если крипы под башней бьют вас, а вы их нет")

	private readonly jungleNode = this.entry.AddNode("Настройки Леса", "", "Настройки фарма нейтральных крипов")
	private readonly ownJungleOnly = this.jungleNode.AddToggle("Только свой лес", false, "Не заходить на вражескую территорию")
	private readonly moveOnlyBetweenCamps = this.jungleNode.AddToggle("MoveTo между кемпами", true, "Не отвлекаться на героев при перебежках")
	private readonly skipIfAllyFarming = this.jungleNode.AddToggle("Пропускать занятые союзником", true, "Не мешать союзникам фармить")
	private readonly skipIfEnemyFarming = this.jungleNode.AddToggle("Пропускать занятые врагом", true, "Избегать стычек на спотах")
	private readonly spotsNode = this.jungleNode.AddNode("Лесные лагеря", "", "Включение/выключение конкретных точек фарма")

	private readonly safetyNode = this.entry.AddNode("Безопасность", "", "Настройки выживания и фильтры целей")
	private readonly avoidTowers = this.safetyNode.AddToggle("Обходить башни", true, "Автоматический поиск пути в обход радиуса атак башен")
	private readonly hpThreshold = this.safetyNode.AddSlider("Порог здоровья %", 22, 0, 100, 1, "При каком HP идти лечиться на базу")
	private readonly autoTpLowHp = this.safetyNode.AddToggle("Авто-ТП на базу", true, "Использовать свиток телепортации, если HP ниже порога")
	private readonly ignoreHeroes = this.safetyNode.AddToggle("Игнорировать героев", true, "Не атаковать героев при фарме")
	private readonly ignoreMid = this.safetyNode.AddToggle("Игнорировать мид", true, "Не ходить на центральную линию")

	private readonly ignoreUnitsNode = this.entry.AddNode("Игнор юнитов", "", "Список юнитов, которых скрипт будет игнорировать")
	private readonly ignoreBroodlings = this.ignoreUnitsNode.AddToggle("Паучки Бруды", true)
	private readonly ignoreLoneBear = this.ignoreUnitsNode.AddToggle("Медведь Друида", true)
	private readonly ignoreEidolons = this.ignoreUnitsNode.AddToggle("Энигма (Эйдолоны)", true)
	private readonly ignoreTreants = this.ignoreUnitsNode.AddToggle("Фурион (Пеньки)", true)
	private readonly ignoreWolves = this.ignoreUnitsNode.AddToggle("Волки Люкана", true)
	private readonly ignoreGolems = this.ignoreUnitsNode.AddToggle("Големы Варлока", true)
	private readonly ignoreBeastmaster = this.ignoreUnitsNode.AddToggle("Бистмастер (Птица/кОбан)", true)
	private readonly ignoreIllustions = this.ignoreUnitsNode.AddToggle("Все иллюзии", true)

	private readonly autoNode = this.entry.AddNode("Автоматизация", "", "Авто-предметы и способности")
	private readonly itemsNode = this.autoNode.AddNode("Авто-предметы")
	private readonly usePhase = this.itemsNode.AddToggle("Phase Boots", true)
	private readonly useMom = this.itemsNode.AddToggle("Mask of Madness", true)
	private readonly autoMidas = this.itemsNode.AddToggle("Hand of Midas", true)
	private readonly useQuelling = this.itemsNode.AddToggle("Quelling Blade", true)
	private readonly useNeutral = this.itemsNode.AddToggle("Авто-нейтралка", true)

	private readonly abilitiesNode = this.autoNode.AddNode("Авто-способности")
	private readonly useMovementAbilities = this.abilitiesNode.AddToggle("Передвижение", true)
	private readonly useDamageAbilities = this.abilitiesNode.AddToggle("Урон", true)
	private readonly aggressiveAbilities = this.abilitiesNode.AddToggle("Агрессивный режим", true)
	private readonly manaThreshold = this.abilitiesNode.AddSlider("Мин. мана %", 30, 0, 100, 1)
	private readonly enabledSpells: Map<string, Menu.Toggle> = new Map()
	private readonly spellsWhitelistNode = this.abilitiesNode.AddNode("Белый список")

	private readonly autoLevelingNode = this.autoNode.AddNode("Авто-прокачка", "", "Настройки автоматической прокачки способностей")
	private readonly autoLeveling = this.autoLevelingNode.AddToggle("Включить авто-прокачку", true)

	private readonly visualNode = this.entry.AddNode("Визуализация", "", "Отрисовка маршрутов и статусов")
	private readonly drawSpots = this.visualNode.AddToggle("Рисовать споты", true)
	private readonly drawRoute = this.visualNode.AddToggle("Рисовать маршрут", true)
	private readonly lockCamera = this.visualNode.AddToggle("Центрировать камеру", false)

	private readonly testNode = this.entry.AddNode("Тест (Экспериментально)", "", "Функции для тестирования APM и скорости")
	private readonly fastLogic = this.testNode.AddToggle("Быстрая логика", false, "Снижает задержку раздумий до 60мс (вместо 100мс)")
	private readonly fastOrders = this.testNode.AddToggle("Быстрые приказы", false, "Снижает задержку между командами до 0.25с (вместо 0.3с)")
	private readonly spamClick = this.testNode.AddToggle("Спам кликов", false, "Повторно отправлять команду атаки/движения (APM ~240)")
	private readonly jitterMove = this.testNode.AddToggle("Джиттер-движение", false, "Микро-клики вокруг точки назначения (симуляция нервного игрока)")
	private readonly experimentalOrbWalk = this.testNode.AddToggle("Orb-Walking", false, "Экспериментальная отмена анимации после выстрела/удара")

	private readonly debugNode = this.entry.AddNode("Отладка", "", "Технические функции для тестирования")
	private readonly autoEnable = this.debugNode.AddToggle("Авто-включение скрипта", true, "Автоматически включать скрипт, если он выключен, при достижении времени")
	private readonly returnAfterHeal = this.debugNode.AddToggle("Возврат после хила", true, "После лечения возвращаться на позицию, где было мало HP")
	private readonly autoDisableInMenu = this.debugNode.AddToggle("Выключать в главном меню", true, "Автоматически выключать скрипт при выходе в главное меню")
	private readonly disableResetBetweenGames = this.debugNode.AddToggle("Отключить сброс между играми", false, "Не очищать состояние скрипта при начале новой игры (может вызвать баги)")
	private readonly detailedDebug = this.debugNode.AddToggle("Подробный лог", true, "Выводить детальную информацию о фильтрах крипов и причинах ожидания прямо на экран")
	private readonly drawDebugLog = this.debugNode.AddToggle("Показывать лог на экране", true, "Отрисовка последних действий скрипта в углу экрана")
	private readonly forcedBaseExit = this.debugNode.AddToggle("Принудительно уходить с базы", true, "Если герой на базе и нет крипов, идти к самой дальней союзной башне")
	private readonly heroDamageWarning = this.debugNode.AddToggle("Тест урона героев", true, "Показывать уведомление при получении урона от вражеского героя")
	private readonly chatOnHeroDamage = this.debugNode.AddToggle("Чат при уроне", true, "Писать в чат просьбу не бить при получении урона от героя")
	private readonly autoEnableTime = this.debugNode.AddSlider("Минута включения", 4, 0, 60, 1, "На какой минуте игры автоматически включить скрипт")
	private readonly lanePriorityUntil4 = this.debugNode.AddToggle("Приоритет на линии до 4 лвл", true, "Сначала бить крипов на линии, а потом уже идти на кемпы (до 4 уровня)")
	private readonly chatOnHeroDamageLevel = this.debugNode.AddSlider("Уровень для чата", 2, 1, 30, 1, "С какого уровня героя начнет работать отправка сообщений в чат")
	private readonly setSmallCampsLvl = this.debugNode.AddButton("Авто: Маленькие кемпы (1 лвл)", "Установить уровень 1 для всех маленьких лагерей")
	private readonly setMediumCampsLvl = this.debugNode.AddButton("Авто: Средние кемпы (4 лвл)", "Установить уровень 4 для всех средних лагерей")
	private readonly setLargeCampsLvl = this.debugNode.AddButton("Авто: Большие и ост. (5 лвл)", "Установить уровень 5 для всех остальных лагерей")
	private readonly testSayButton = this.debugNode.AddButton("Тест консоли (say)", "Отправить 'Hello World' в чат")

	private readonly devNode = this.entry.AddNode("Dev", "", "Функции в разработке")
	private readonly autoNeutral = this.devNode.AddToggle("Авто-выбор нейтралки", true, "Автоматически открывать и выбирать нейтральный предмет")
	private readonly forceNeutralButton = this.devNode.AddButton("Выбрать нейтралку СЕЙЧАС", "Принудительно попытаться открыть жетон и выбрать предмет")

	private readonly spotToggles: Map<string, Menu.Toggle> = new Map()
	private readonly spotLevelSliders: Map<string, Menu.Slider> = new Map()
	private readonly emptySpots: Set<string> = new Set()
	private readonly heroSettings: Map<string, HeroLevelingSettings> = new Map()

	private readonly visibleSymbol = typeof Panorama !== 'undefined' ? Panorama.MakeSymbol("Visible") : null
	private lastPanoramaTime = 0
	private lastMinute = -1
	private lastLaneCreepVisibleTime = 0
	private lastOrderTime = 0
	private lastOrderWasAttack = false
	private isGoingToFountain = false
	private isReturningAfterHeal = false
	private lastPosBeforeHeal: Vector3 | undefined
	private currentStatus = "Ожидание (Сброс)"
	private targetPos: Vector3 | undefined
	private currentJungleSpotName: string | null = null
	private lastCreepDeathPos: Vector3 | undefined
	private lastRandomWalkPos: Vector3 | undefined
	private lastRandomWalkPosUpdateTime = 0
	private lastSpotArrivalTime = 0
	private lastCameraLock = false
	private lastDamageTime = 0
	private lastLogicTime = 0
	private lastBypassTime = 0
	private lastHeroChatTime = 0
	private lastHeroAttackerName: string = ""
	private lastHeroAttackerTime: number = 0
	private lastLeveledAbilityPoints: number = 0
	private readonly failedAbilities: Set<string> = new Set()
	private isEscapingTower = false
	private lastTpTime = 0
	private readonly logBuffer: string[] = []
	private readonly maxLogLines = 15
	private cachedTowers: Tower[] = []
	private cachedCreeps: Creep[] = []
	private cachedHeroes: Unit[] = []

	private GetRandomizedPosition(pos: Vector3): Vector3 {
		const randomOffset = () => Math.floor(Math.random() * 81) - 40 // От -40 до +40
		return new Vector3(pos.x + randomOffset(), pos.y + randomOffset(), pos.z)
	}

	private GetRandomTargetInRadius(center: Creep, radius: number, hero: Unit): Creep {
		const nearby = this.cachedCreeps.filter(c => 
			c.IsAlive && 
			c.IsVisible && 
			c.IsEnemy(hero) &&
			c.IsNeutral === center.IsNeutral &&
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
		try {
			if (typeof GameState !== 'undefined' && typeof GameState.ExecuteCommand === 'function') {
				GameState.ExecuteCommand(command)
			}
		} catch (e) {
			this.Log(`Cmd Err: ${command}`)
		}
	}

	private Log(message: string): void {
		let timeStr = "0.00"
		try {
			if (typeof GameState !== 'undefined' && GameState.RawGameTime > 0) {
				timeStr = GameState.RawGameTime.toFixed(2)
			} else {
				const now = new Date()
				timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
			}
		} catch (e) {
			// Fallback if GameState is not ready
		}
		
		const formatted = `[${timeStr}] ${message}`
		
		this.logBuffer.push(formatted)
		if (this.logBuffer.length > this.maxLogLines) {
			this.logBuffer.shift()
		}
	}

	private setStatus(status: string): void {
		if (this.currentStatus !== status) {
			this.Log(`Смена статуса: ${this.currentStatus} -> ${status}`)
			this.currentStatus = status
		}
	}

	private HandleAutoLeveling(hero: Unit): void {
		if (hero.AbilityPoints <= 0) {
			this.failedAbilities.clear()
			this.lastLeveledAbilityPoints = 0
			return
		}

		const settings = this.heroSettings.get(`${hero.Name}_${hero.Index}`)
		if (!settings || !settings.autoLevel.value) return

		// Если количество очков уменьшилось, значит прошлая попытка была успешной - сбрасываем список провалов
		if (hero.AbilityPoints < this.lastLeveledAbilityPoints) {
			this.failedAbilities.clear()
		}
		this.lastLeveledAbilityPoints = hero.AbilityPoints

		const spells = hero.Spells.filter(s => s !== undefined && s !== null) as Ability[]
		const allTalents = spells.filter(s => s.Name.startsWith("special_bonus_"))

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
			if (id === 3) { // R
				target = spells.find(s => s.IsUltimate)
			} else { // Q, W, E (0, 1, 2)
				target = hero.Spells[id] ?? undefined
			}
			
			if (target && target.Level < target.MaxLevel && hero.Level >= target.RequiredLevel && !target.IsNotLearnable) {
				candidates.push(target)
			}
		}

		// 3. Таланты
		const availableTalents = allTalents.filter(s => {
			if (s.Level >= s.MaxLevel || hero.Level < s.RequiredLevel || s.IsNotLearnable) return false
			// Игнорируем талант, если в этом тире (уровне) уже что-то вкачано
			return !allTalents.some(other => other.RequiredLevel === s.RequiredLevel && other.Level > 0)
		})
		candidates.push(...availableTalents)

		// 4. Обычные способности (если еще остались)
		const regulars = spells.filter(s => 
			!s.IsUltimate && 
			!s.Name.startsWith("special_bonus_") && 
			!s.IsNotLearnable && 
			!s.IsAttributes &&
			s.Level < s.MaxLevel && 
			hero.Level >= s.RequiredLevel
		)
		candidates.push(...regulars)

		// Ищем первого кандидата, который еще не провалился в текущей сессии прокачки
		const bestCandidate = candidates.find(c => !this.failedAbilities.has(c.Name))

		if (bestCandidate) {
			bestCandidate.UpgradeAbility()
			this.Log(`Авто-прокачка: ${bestCandidate.Name}`)
			// Добавляем в список "подозрительных". Если очки не уменьшатся - в следующем тике попробуем другого.
			this.failedAbilities.add(bestCandidate.Name)
		}
	}

	constructor() {
		this.forceNeutralButton.OnValue(() => {
			const hero = LocalPlayer?.Hero
			if (hero) {
				this.Log("Принудительный выбор нейтралки...")
				this.HandlePanorama(hero)
			}
		})

		for (const spot of jungleSpots) {
			const node = this.spotsNode.AddNode(spot.name)
			this.spotToggles.set(spot.name, node.AddToggle("Включено", true))
			
			let defaultLvl = 5
			if (spot.name.includes("malenkiy")) {
				defaultLvl = 1
			} else if (spot.name.includes("sredniy")) {
				defaultLvl = 4
			}
			
			this.spotLevelSliders.set(spot.name, node.AddSlider("Мин. уровень", defaultLvl, 1, 30, 1))
		}

		this.toggleKey.OnPressed(() => {
			this.state.value = !this.state.value
		})

		this.setSmallCampsLvl.OnValue(() => {
			for (const spot of jungleSpots) {
				if (spot.name.includes("malenkiy")) {
					const slider = this.spotLevelSliders.get(spot.name)
					if (slider) slider.value = 1
				}
			}
			this.Log("Установлен 1 лвл для всех маленьких кемпов")
		})

		this.setMediumCampsLvl.OnValue(() => {
			for (const spot of jungleSpots) {
				if (spot.name.includes("sredniy")) {
					const slider = this.spotLevelSliders.get(spot.name)
					if (slider) slider.value = 4
				}
			}
			this.Log("Установлен 4 лвл для всех средних кемпов")
		})

		this.setLargeCampsLvl.OnValue(() => {
			for (const spot of jungleSpots) {
				if (!spot.name.includes("malenkiy") && !spot.name.includes("sredniy")) {
					const slider = this.spotLevelSliders.get(spot.name)
					if (slider) slider.value = 5
				}
			}
			this.Log("Установлен 5 лвл для всех больших и остальных кемпов")
		})

		this.testSayButton.OnValue(() => {
			this.SafeExecuteCommand("say hello world")
		})

		EventsSDK.on("Draw", this.OnDraw.bind(this))
		EventsSDK.on("GameStarted", () => {
			if (!this.disableResetBetweenGames.value) {
				this.ResetState()
			} else {
				this.Log("Сброс игры пропущен (Отладка)")
			}
		})
		EventsSDK.on("GameEvent", this.OnGameEvent.bind(this))
		EventsSDK.on("GameEnded", () => {
			this.SafeExecuteCommand("dota_camera_lock 0")
			this.lastCameraLock = false
			if (!this.disableResetBetweenGames.value) {
				this.ResetState()
			}
		})
	}

	private ResetState(): void {
		this.emptySpots.clear()
		this.currentJungleSpotName = null
		this.lastMinute = -1
		this.lastLaneCreepVisibleTime = 0
		this.lastOrderTime = 0
		this.lastLogicTime = 0
		this.lastTpTime = 0
		this.isEscapingTower = false
		this.lastOrderWasAttack = false
		this.isGoingToFountain = false
		this.isReturningAfterHeal = false
		this.lastPosBeforeHeal = undefined
		this.setStatus("Ожидание (Сброс)")
		this.targetPos = undefined
		this.lastCreepDeathPos = undefined
		this.lastRandomWalkPos = undefined
		this.lastRandomWalkPosUpdateTime = 0
		this.lastCameraLock = false
		this.lastDamageTime = 0
		
		// Clear hero settings to re-initialize nodes if menu was reset
		this.heroSettings.clear()
	}

	private OnGameEvent(eventName: string, obj: any): void {
		if (eventName === "entity_hurt") {
			const victim = EntityManager.EntityByIndex(obj.entindex_killed)
			const attacker = EntityManager.EntityByIndex(obj.entindex_attacker)
			const hero = LocalPlayer?.Hero
			
			if (hero && victim === hero && attacker instanceof Unit && attacker.IsEnemy(hero)) {
				if (attacker instanceof Creep && this.IsInTowerRange(attacker.Position, hero)) {
					this.lastDamageTime = GameState.RawGameTime
				}

				if (attacker.IsHero) {
					const name = attacker.Name.replace("npc_dota_hero_", "").replace(/_/g, " ").toUpperCase()
					this.lastHeroAttackerName = name
					this.lastHeroAttackerTime = GameState.RawGameTime

					// Отправка в чат при уроне
					if (this.chatOnHeroDamage.value && 
					    hero.Level >= this.chatOnHeroDamageLevel.value && 
					    GameState.RawGameTime > this.lastHeroChatTime + 10.0) { // Задержка 10 сек между сообщениями
						
						const displayName = name.charAt(0) + name.slice(1).toLowerCase()
						this.SafeExecuteCommand(`say "Mr ${displayName} не бей меня пожалуйста"`)
						this.lastHeroChatTime = GameState.RawGameTime
					}
				}
			}
		}

		if (eventName === "entity_killed") {
			const victim = EntityManager.EntityByIndex(obj.entindex_killed)
			const hero = LocalPlayer?.Hero
			if (hero && victim instanceof Creep && !victim.IsNeutral && victim.IsEnemy(hero) && hero.Distance2D(victim) < 1200) {
				const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
				const isAtBase = fountain && victim.Distance2D(fountain) < 3500

				if (!isAtBase && (!this.IsInTowerRange(victim.Position, hero) || !this.IsInAnyTowerRange(victim.Position, hero)) && (!this.ignoreMid.value || !this.IsMidLane(victim.Position))) {
					const pos = victim.Position
					this.lastCreepDeathPos = new Vector3(pos.x, pos.y, pos.z)
				}
				this.lastLaneCreepVisibleTime = GameState.RawGameTime
			}
		}
	}

	private OnDraw(): void {
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

			if (hero === undefined || !hero.IsAlive) return

			if (this.heroDamageWarning.value && GameState.RawGameTime - this.lastHeroAttackerTime < 2) {
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
			if (!this.state.value && this.autoEnable.value && GameState.RawGameTime >= this.autoEnableTime.value * 60) {
				this.state.value = true
				this.Log(`Скрипт включен автоматически (${this.autoEnableTime.value} мин)`)
			}

			if (!this.state.value) return

			// Skip logic if game hasn't truly started
			if (GameState.RawGameTime < 0.5) {
				if (this.autoNeutral.value && typeof Panorama !== 'undefined') {
					this.HandlePanorama(hero)
				}
				return
			}

			// Run logic on Draw frame but throttle it
			const throttle = this.fastLogic.value ? 0.06 : 0.1
			if (GameState.RawGameTime > this.lastLogicTime + throttle) {
				if (this.autoLeveling.value) {
					this.HandleAutoLeveling(hero)
				}

				const abilitySent = this.AutoAbilities(hero)
				const itemSent = this.AutoItems(hero)
				
				if (!abilitySent && !itemSent) {
					this.OnUpdate(hero)
				}
				
				this.lastLogicTime = GameState.RawGameTime
			}

			// Lock camera on hero using console command with active check
			if (this.lockCamera.value && typeof Camera !== 'undefined' && typeof IOBuffer !== 'undefined' && IOBuffer !== null) {
				const dummy = Camera.Position 
				if (typeof IOBuffer[0] === 'number') {
					const camPos = new Vector3(IOBuffer[0], IOBuffer[1], IOBuffer[2])
					if (hero.Distance2D(camPos) > 100 || !this.lastCameraLock) {
						this.SafeExecuteCommand("dota_camera_lock 1")
						this.lastCameraLock = true
					}
				}
			} else if (this.lastCameraLock) {
				this.SafeExecuteCommand("dota_camera_lock 0")
				this.lastCameraLock = false
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

						RendererSDK.FilledCircle(screenPos, new Vector2(10, 10), color)
						const text = `${spot.name}${!isLevelValid ? ` [Lvl ${minLevel}]` : ""}`
						RendererSDK.Text(text, screenPos.AddScalarY(15), color, "Roboto", 12)
					}
				}
			}

			if (this.drawRoute.value && this.targetPos) {
				const heroScreen = RendererSDK.WorldToScreen(hero.Position)
				const targetScreen = RendererSDK.WorldToScreen(this.targetPos)
				if (heroScreen && targetScreen) {
					RendererSDK.Line(heroScreen, targetScreen, Color.Yellow.SetA(150), 2)
					RendererSDK.OutlinedCircle(targetScreen, new Vector2(20, 20), Color.Red)
				}
			}

			const statusText = `Статус: ${this.currentStatus} | Пустые лагеря: ${this.emptySpots.size}/${jungleSpots.length}`
			const teamText = `Команда: ${hero.Team === Team.Radiant ? "Свет" : hero.Team === Team.Dire ? "Тьма" : "Неизвестно"} | Только свой лес: ${this.ownJungleOnly.value ? "Да" : "Нет"}`
			const targetEnt = hero.Target
			const targetText = `Цель: ${targetEnt?.Name ?? "Нет"} [ID: ${hero.TargetIndex_}] | Атакует: ${hero.IsAttacking ? "Да" : "Нет"}`
			const pointsText = `Очки способностей: ${hero.AbilityPoints} | Уровень: ${hero.Level}`
			const stateText = `Скрипт ${this.state.value ? "ВКЛЮЧЕН" : "ВЫКЛЮЧЕН"}`

			RendererSDK.Text(statusText, new Vector2(200, 200), Color.White, "Roboto", 20)
			RendererSDK.Text(teamText, new Vector2(200, 230), Color.White, "Roboto", 20)
			RendererSDK.Text(targetText, new Vector2(200, 260), Color.White, "Roboto", 20)
			RendererSDK.Text(pointsText, new Vector2(200, 290), Color.Yellow, "Roboto", 20)
			RendererSDK.Text(stateText, new Vector2(200, 320), this.state.value ? Color.Green : Color.Red, "Roboto", 20)
		} catch (e) {
			this.Log(`Draw Error: ${e}`)
		}
	}

	private OnUpdate(hero: Unit): void {
		try {
			if (typeof GameState === 'undefined') return

			// Cache entities
			this.cachedTowers = this.SafeGetEntities<Tower>(Tower)
			this.cachedCreeps = this.SafeGetEntities<Creep>(Creep)
			this.cachedHeroes = (this.skipIfAllyFarming.value || this.skipIfEnemyFarming.value) 
				? this.SafeGetEntities<Unit>(Unit).filter(u => u.IsHero && u.IsAlive && u.IsVisible && u !== hero)
				: []

			const rawTime = GameState.RawGameTime

			// Вызов HandlePanorama раз в 3 секунды
			if (rawTime > this.lastPanoramaTime + 3.0) {
				this.HandlePanorama(hero)
				this.lastPanoramaTime = rawTime
			}

			const currentMinute = Math.floor(rawTime / 60)
			
			if (this.lastMinute === -1) this.lastMinute = currentMinute
			if (currentMinute !== this.lastMinute) {
				this.emptySpots.clear()
				this.lastMinute = currentMinute
			}

			if (this.ignoreHeroes.value && hero.IsAttacking) {
				const target = hero.Target
				if (target instanceof Unit && target.IsHero && target.IsEnemy(hero)) {
					hero.OrderStop(false, true)
					this.setStatus("Остановка (Игнор героев)")
					this.lastOrderTime = rawTime
					return
				}
			}

			const delay = this.fastOrders.value ? 0.25 : 0.3
			if (rawTime < this.lastOrderTime + delay) return

			const nearbyCreep = this.cachedCreeps.find(c => 
				!c.IsNeutral && c.IsAlive && c.IsVisible && hero.Distance2D(c) < 2000 && !this.IsInTowerRange(c.Position, hero)
			)
			if (nearbyCreep) {
				this.lastCreepDeathPos = nearbyCreep.Position
			}

			const hpPercent = hero.HPPercentDecimal * 100
			if (hpPercent < this.hpThreshold.value) {
				if (!this.isGoingToFountain) {
					const pos = hero.Position
					this.lastPosBeforeHeal = new Vector3(pos.x, pos.y, pos.z)
					this.Log(`HP ниже порога (${hpPercent.toFixed(1)}%), запоминаю позицию: ${this.lastPosBeforeHeal.x.toFixed(0)}, ${this.lastPosBeforeHeal.y.toFixed(0)}`)
				}
				this.isGoingToFountain = true
				this.isReturningAfterHeal = false
				
				if (this.autoTpLowHp.value && rawTime > this.lastTpTime + 10) {
					const tp = hero.GetItemByName("item_tpscroll")
					if (tp && tp.IsReady) {
						const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
						if (fountain) {
							hero.CastPosition(tp, fountain.Position, false, true)
							this.lastTpTime = rawTime
							this.lastOrderTime = rawTime
							this.Log("Использую ТП на базу (Low HP)")
							return
						}
					}
				}
			} else if (hpPercent > 95) {
				const canFarmJungle = hero.Level >= this.laneOnlyUntilLevel.value
				if (this.isGoingToFountain && this.returnAfterHeal.value && this.lastPosBeforeHeal && !canFarmJungle) {
					this.isReturningAfterHeal = true
					this.Log(`Здоровье восстановлено, возвращаюсь на позицию: ${this.lastPosBeforeHeal.x.toFixed(0)}, ${this.lastPosBeforeHeal.y.toFixed(0)}`)
				} else if (this.isGoingToFountain && canFarmJungle) {
					this.Log(`Здоровье восстановлено, уровень ${hero.Level} позволяет фармить лес, возврат на линию пропущен`)
				}
				this.isGoingToFountain = false
			}

			if (this.isGoingToFountain) {
				this.setStatus("Возврат на базу")
				this.GoToFountain(hero)
				return
			}

			if (this.isReturningAfterHeal && this.lastPosBeforeHeal) {
				const canFarmJungle = hero.Level >= this.laneOnlyUntilLevel.value
				const dist = hero.Distance2D(this.lastPosBeforeHeal)
				
				if (canFarmJungle) {
					this.isReturningAfterHeal = false
					this.Log(`Возврат отменен: уровень ${hero.Level} позволяет фармить лес`)
				} else if (dist < 300) {
					this.isReturningAfterHeal = false
					this.Log("Вернулся на исходную позицию")
				}
			}

			if (this.fleeFromCreepsUnderTower.value && rawTime < this.lastDamageTime + 3.0) {
				const target = hero.Target
				const isSafeToHit = target instanceof Creep && target.HP < hero.AttackDamageMax * 2 // Можем убить за 1-2 удара
				
				if (!target || !target.IsAlive || (this.IsInTowerRange(target.Position, hero) && !isSafeToHit)) {
					this.Flee(hero, "Отход (Урон под башней)")
					return
				}
			}

			let mainOrderSent = this.Farm(hero)

			if (!mainOrderSent) {
				const target = hero.Target
				if (target && this.IsInTowerRange(target.Position, hero)) {
					hero.OrderStop(false, true)
					this.setStatus("Остановка (Цель под башней)")
					this.lastOrderTime = rawTime
					return
				}
			}
		} catch (e) {
			this.Log(`Update Error: ${e}`)
		}
	}

	private HandlePanorama(hero: Unit, forced: boolean = false): void {
		if (!forced && (!this.autoNeutral.value || hero.Team === Team.None)) return

		// Проверка нейтрального слота (16) строго через Inventory.GetItem
		const neutralItem = hero.Inventory.GetItem(16)
		
		// Если слот пуст (null), пробуем открыть меню или выбрать предмет
		if (!neutralItem) {
			if (typeof Panorama !== 'undefined') {
				const dotaHud = Panorama.FindRootPanel("DotaHud")
				if (dotaHud) {
					const playerID = hero.PlayerID
					const playerData = PlayerResource?.GetPlayerDataByPlayerID(playerID)
					if (playerData) {
						const hasNeutralTier = playerData.HasNeutralTier // Массив boolean для каждого тира
						const hasRedeemedNeutralTier = playerData.HasRedeemedNeutralTier // Массив boolean, был ли уже выбран предмет

						for (let tier = 0; tier < hasNeutralTier.length; tier++) {
							if (hasNeutralTier[tier] && !hasRedeemedNeutralTier[tier]) {
								const neutralPicker = dotaHud.FindChildTraverse("NeutralItemPicker")
								const isPickerVisible = neutralPicker && (this.visibleSymbol ? neutralPicker.BHasClass(this.visibleSymbol) : false || neutralPicker.GetActualLayoutWidth() > 0)
								
								if (!isPickerVisible) {
									this.Log(`Есть доступный жетон тира ${tier + 1}. Пытаюсь открыть меню.`)
									const neutralSlot = dotaHud.FindChildTraverse("neutral_item_slot") ?? dotaHud.FindChildTraverse("NeutralSlot")
									if (neutralSlot) {
										Panorama.DispatchEventAsync("Activated(program)", neutralSlot)
										this.lastOrderTime = GameState.RawGameTime
										return
									}
								} else {
									// Если меню открыто, пробуем отправить приказ на выбор первого предмета
									if (typeof (Player as any).PrepareUnitOrders === 'function') {
										(Player as any).PrepareUnitOrders({
											Order: 34,
											TargetIndex: 0,
											EntityIndex: hero.Index,
											Position: new Vector3(0, 0, 0),
											AbilityIndex: 0,
											Queue: false
										})
										this.Log("Меню открыто, отправлен приказ на выбор (Order 34)")
										return
									}
								}
							}
						}
					}
				}
			}

			// Резервный вариант: если Panorama недоступна, пробуем отправить приказ напрямую
			if (typeof (Player as any).PrepareUnitOrders === 'function') {
				(Player as any).PrepareUnitOrders({
					Order: 34,
					TargetIndex: 0,
					EntityIndex: hero.Index,
					Position: new Vector3(0, 0, 0),
					AbilityIndex: 0,
					Queue: false
				})
			}
		} else if (this.useNeutral.value && hero.IsAttacking) {
			// Авто-использование уже экипированного предмета
			if (neutralItem.IsReady) {
				const target = hero.Target
				if (target instanceof Creep && target.IsAlive && hero.Distance2D(target) < 600) {
					this.Log(`Использую нейтралку: ${neutralItem.Name}`)
					hero.CastNoTarget(neutralItem, false, true)
				}
			}
		}
	}

	private AutoItems(hero: Unit): boolean {
		if (this.currentStatus === "Возврат на базу" || this.currentStatus === "Побег от башни") return false

		if (this.usePhase.value && (hero.IsMoving || hero.IsAttacking)) {
			const phase = hero.GetItemByName("item_phase_boots")
			if (phase?.IsReady) {
				hero.CastNoTarget(phase, false, true)
				this.lastOrderTime = GameState.RawGameTime
				return true
			}
		}

		if (this.useMom.value && hero.IsAttacking && (this.currentStatus === "Фарм леса" || this.currentStatus === "Фарм линии")) {
			const mom = hero.GetItemByName("item_mask_of_madness")
			if (mom?.IsReady) {
				hero.CastNoTarget(mom, false, true)
				this.lastOrderTime = GameState.RawGameTime
				return true
			}
		}

		if (this.autoMidas.value) {
			const midas = hero.GetItemByName("item_hand_of_midas")
			if (midas?.IsReady) {
				const target = this.cachedCreeps.find(
					c => c.IsEnemy(hero) && c.IsNeutral && c.IsAlive && c.IsVisible && hero.Distance2D(c) < 600
				)
				if (target) {
					hero.CastTarget(midas, target, false, true)
					this.lastOrderTime = GameState.RawGameTime
					return true
				}
			}
		}

		if (this.useQuelling.value && hero.IsAttacking) {
			const quelling = hero.GetItemByName(/item_quelling_blade|item_bfury/)
			if (quelling?.IsReady) {
				const target = hero.Target
				if (target instanceof Creep && target.IsAlive && hero.Distance2D(target) < 600) {
					hero.CastTarget(quelling, target, false, true)
					this.lastOrderTime = GameState.RawGameTime
					return true
				}
			}
		}
		return false
	}

	private AutoAbilities(hero: Unit): boolean {
		if (hero.ManaPercent < this.manaThreshold.value) return false

		const target = hero.Target
		const hasTarget = target instanceof Creep && target.IsAlive && hero.Distance2D(target) < 800

		for (const s of hero.Spells) {
			if (s && s.Level > 0 && !s.IsPassive && !s.IsHidden && !s.IsInnate && !s.Name.includes("special_bonus") && !this.enabledSpells.has(s.Name)) {
				this.enabledSpells.set(s.Name, this.spellsWhitelistNode.AddToggle(s.Name, true))
			}
		}

		if (this.useMovementAbilities.value && this.targetPos && hero.Distance2D(this.targetPos) > 800) {
			const blink = hero.Spells.find((s): s is Ability => s !== undefined && s.Level > 0 && s.IsReady && (s.Name.includes("blink") || s.Name.includes("time_walk")))
			if (blink && this.enabledSpells.get(blink.Name)?.value) {
				hero.CastPosition(blink, this.targetPos, false, true)
				this.lastOrderTime = GameState.RawGameTime
				return true
			}
		}

		if (this.useDamageAbilities.value && hero.IsAttacking && hasTarget) {
			const spells = hero.Spells.filter((s): s is Ability => 
				s !== undefined && 
				s.Level > 0 && 
				s.IsReady && 
				!s.IsPassive &&
				!s.IsHidden &&
				!s.IsInnate &&
				!s.Name.includes("blink") && 
				!s.Name.includes("time_walk") &&
				!s.Name.includes("special_bonus") &&
				!s.Name.includes("guild_banner") &&
				!s.Name.includes("high_five") &&
				s.ManaCost <= hero.Mana && 
				this.enabledSpells.get(s.Name)?.value !== false
			)

			if (this.aggressiveAbilities.value) {
				let sent = false
				for (const damageSpell of spells) {
					hero.UseSmartAbility(damageSpell, target as Creep, false, false, false, true)
					this.lastOrderTime = GameState.RawGameTime
					sent = true
				}
				return sent
			} else if (spells.length > 0) {
				const damageSpell = spells[0]
				hero.UseSmartAbility(damageSpell, target as Creep, false, false, false, true)
				this.lastOrderTime = GameState.RawGameTime
				return true
			}
		}
		return false
	}

	private GoToFountain(hero: Unit): void {
		const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
		if (fountain) {
			this.targetPos = fountain.Position
			if (hero.Distance2D(fountain) > 200) {
				const movePos = this.GetSafeMovePos(hero.Position, fountain.Position, hero)
				hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
				this.lastOrderTime = GameState.RawGameTime
			}
		}
	}

	private Flee(hero: Unit, status: string): void {
		this.setStatus(status)
		const alliedTowers = this.cachedTowers.filter(t => t.IsAlive && !t.IsEnemy(hero))
		const nearestAllyTower = alliedTowers.sort((a, b) => hero.Distance2D(a) - hero.Distance2D(b))[0]
		
		const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
		const basePos = fountain?.Position ?? hero.Position

		// Приоритет - ближайшая союзная башня, если она не слишком далеко (на линии)
		// Если союзных башен нет или они далеко - отходим в сторону базы
		const fleeTarget = (nearestAllyTower && hero.Distance2D(nearestAllyTower) < 4000) 
			? nearestAllyTower.Position 
			: basePos

		const dir = fleeTarget.Subtract(hero.Position).Normalize()
		// Отходим на 600 единиц (достаточно чтобы выйти из-под агра, но не убежать в лес)
		const movePos = hero.Position.Add(dir.MultiplyScalar(600))
		
		// Используем GetSafeMovePos только если мы НЕ под башней, чтобы не было кругов
		// Если мы УЖЕ под башней, просто бежим по прямой от неё в безопасную сторону
		hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
		this.lastOrderTime = GameState.RawGameTime
	}

	private Farm(hero: Unit): boolean {
		try {
			const rawTime = GameState.RawGameTime
			
			const delay = this.fastOrders.value ? 0.25 : 0.3
			if (rawTime < this.lastOrderTime + delay) return false

			const inTowerRange = this.IsInTowerRange(hero.Position, hero)
			const isBypassing = rawTime < this.lastBypassTime + 10.0
			
			if (this.avoidTowers.value && (inTowerRange || this.isEscapingTower) && !isBypassing) {
				const safetyBuffer = this.isEscapingTower ? 300 : 0
				if (this.IsInTowerRange(hero.Position, hero, safetyBuffer)) {
					this.isEscapingTower = true
					this.Flee(hero, "Побег от башни")
					return true
				}
				this.isEscapingTower = false
			}

			let targetCreep = this.laneFarm.value ? this.GetNearestLaneCreep(hero) : undefined
			if (targetCreep) {
				targetCreep = this.GetRandomTargetInRadius(targetCreep, 100, hero)
			}
			
			const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
			const isAtBase = fountain && hero.Distance2D(fountain) < 3500

			const hasValidLaneCreep = targetCreep !== undefined
			const timeSinceLastCreep = rawTime - this.lastLaneCreepVisibleTime
			const withinWaitTime = timeSinceLastCreep < this.laneWaitTime.value
			const belowLevelThreshold = hero.Level < this.laneOnlyUntilLevel.value

			const waitingOnLane = this.laneFarm.value && 
			                      !hasValidLaneCreep && 
			                      withinWaitTime &&
			                      belowLevelThreshold &&
			                      !isAtBase &&
			                      !(this.lanePriorityUntil4.value && hero.Level < 4)

			if (this.detailedDebug.value && !hasValidLaneCreep && this.laneFarm.value && !isAtBase && belowLevelThreshold) {
				this.Log(`Ожидание на линии: Крип:${hasValidLaneCreep} Время:${timeSinceLastCreep.toFixed(1)}/${this.laneWaitTime.value} Lvl:${belowLevelThreshold}`)
			}

			const forceLanePriority = this.lanePriorityUntil4.value && hero.Level < 4
			const canFarmJungle = hero.Level >= this.laneOnlyUntilLevel.value || forceLanePriority
			const nearestSpot = (canFarmJungle && !waitingOnLane) ? this.GetNearestEnabledSpot(hero) : null

			if (targetCreep && (forceLanePriority || !nearestSpot || hero.Distance2D(targetCreep) < hero.Distance2D(nearestSpot.pos))) {
				const isCreepInEnemyTowerRange = this.IsInTowerRange(targetCreep.Position, hero)
				if (!isCreepInEnemyTowerRange) {
					this.setStatus("Фарм линии")
					this.targetPos = targetCreep.Position

					const isAttackingSame = hero.TargetIndex_ === targetCreep.Index
					const canOrbWalk = this.experimentalOrbWalk.value && hero.AttackAnimationPoint > 0 && (GameState.RawGameTime > hero.LastAttackTime + hero.AttackAnimationPoint)
					
					if (!isAttackingSame || this.spamClick.value || canOrbWalk) {
						let targetPos = targetCreep.Position
						if (this.jitterMove.value) {
							const angle = Math.random() * Math.PI * 2
							targetPos = targetPos.Add(new Vector3(Math.cos(angle) * 50, Math.sin(angle) * 50, 0))
						}

						const movePos = this.GetSafeMovePos(hero.Position, targetPos, hero)
						if (movePos.Distance2D(targetCreep.Position) > 100) {
							hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
						} else {
							if (canOrbWalk && hero.IsAttacking) {
								const stepBack = hero.Position.Subtract(targetCreep.Position).Normalize().MultiplyScalar(100)
								hero.MoveTo(this.GetRandomizedPosition(hero.Position.Add(stepBack)), false, true)
							} else {
								hero.AttackTarget(targetCreep, false, true)
							}
						}
						this.lastOrderTime = GameState.RawGameTime
						return true
					}
					return false
				}
			}

			if (waitingOnLane) {
				this.setStatus(`Ожидание крипов (${Math.ceil(this.laneWaitTime.value - (rawTime - this.lastLaneCreepVisibleTime))}сек)`)
				
				if (this.randomWalkWaiting.value || (this.chaoticMoveAroundLastCreep.value && this.lastCreepDeathPos)) {
					let centerPos = this.lastCreepDeathPos
					
					// Если нет точки смерти, выбираем позицию на линии принудительно
					if (!centerPos) {
						centerPos = this.GetDefaultLanePos(hero)
					}

					if (this.IsInTowerRange(centerPos, hero)) {
						centerPos = hero.Position
					}

					const distToCenter = hero.Distance2D(centerPos)

					if (distToCenter > 800) {
						const movePos = this.GetSafeMovePos(hero.Position, centerPos, hero)
						if (movePos.Distance2D(hero.Position) > 100) {
							hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
							this.lastOrderTime = rawTime
							return true
						}
					} 

					if (rawTime > this.lastRandomWalkPosUpdateTime + 0.5) {
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
							
							if (!this.IsInTowerRange(randomPos, hero)) {
								this.lastRandomWalkPos = randomPos
								foundValidPos = true
							}
							attempts++
						}

						if (!foundValidPos) {
							this.lastRandomWalkPos = centerPos
						}
						this.lastRandomWalkPosUpdateTime = rawTime
					}

					if (this.lastRandomWalkPos && rawTime > this.lastOrderTime + 0.25) {
						if (!this.IsInTowerRange(this.lastRandomWalkPos, hero)) {
							const movePos = this.GetSafeMovePos(hero.Position, this.lastRandomWalkPos, hero)
							hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
							this.lastOrderTime = rawTime
						} else {
							this.lastRandomWalkPosUpdateTime = 0
						}
					}
					return true
				}
				return false
			}

			if (nearestSpot) {
				this.targetPos = nearestSpot.pos

				const neutralsInSpot = this.cachedCreeps.filter(
					c =>
						c.IsEnemy(hero) &&
						c.IsNeutral &&
						c.IsAlive &&
						c.IsSpawned &&
						c.IsVisible &&
						c.Distance2D(nearestSpot.pos) < 600 &&
						!this.IsInTowerRange(c.Position, hero)
				)

				if (neutralsInSpot.length > 0) {
					const closestNeutral = neutralsInSpot.sort((a, b) => hero.Distance2D(a) - hero.Distance2D(b))[0]
					const neutral = this.GetRandomTargetInRadius(closestNeutral, 100, hero)
					
					this.setStatus("Фарм леса")
					this.targetPos = neutral.Position

					const isAttackingSame = hero.TargetIndex_ === neutral.Index
					if (!isAttackingSame || this.spamClick.value) {
						const movePos = this.GetSafeMovePos(hero.Position, neutral.Position, hero)
						if (movePos.Distance2D(neutral.Position) > 100) {
							hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
						} else {
							hero.AttackTarget(neutral, false, true)
						}
						this.lastOrderTime = GameState.RawGameTime
						return true
					}
					return false
				}

				const dist = hero.Distance2D(nearestSpot.pos)
				if (dist > 300) {
					this.setStatus(`Путь в лес: ${nearestSpot.name}`)
					this.lastSpotArrivalTime = 0 // Сбрасываем время прибытия, пока мы в пути
					const movePos = this.GetSafeMovePos(hero.Position, nearestSpot.pos, hero)

					if (this.moveOnlyBetweenCamps.value) {
						hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
					} else {
						if (this.lastOrderWasAttack) {
							hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
							this.lastOrderWasAttack = false
						} else {
							hero.AttackMove(this.GetRandomizedPosition(movePos), false, true)
							this.lastOrderWasAttack = true
						}
					}
					this.lastOrderTime = GameState.RawGameTime
					return true
				} else {
					// Мы в радиусе спота. Даем 1 секунду на "прогрузку" крипов
					if (this.lastSpotArrivalTime === 0) {
						this.lastSpotArrivalTime = rawTime
					}

					if (rawTime < this.lastSpotArrivalTime + 0.25) {
						this.setStatus(`Проверка спота: ${nearestSpot.name}`)
						return true
					}

					this.setStatus(`Спот пуст: ${nearestSpot.name}`)
					this.emptySpots.add(nearestSpot.name)
					this.currentJungleSpotName = null
					this.lastOrderTime = 0
					this.lastSpotArrivalTime = 0
					return true
				}
			} else {
				if (this.isReturningAfterHeal && this.lastPosBeforeHeal) {
					this.setStatus("Возврат после хила")
					const movePos = this.GetSafeMovePos(hero.Position, this.lastPosBeforeHeal, hero)
					if (hero.Distance2D(movePos) > 150) {
						hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
						this.lastOrderTime = rawTime
						return true
					}
				}

				if (this.laneFarm.value && this.lastCreepDeathPos) {
					this.setStatus("Возврат на линию")
					let target = this.lastCreepDeathPos
					
					// Если точка смерти крипа под ВРАЖЕСКОЙ башней, находим безопасную точку перед ней
					if (this.IsInTowerRange(target, hero)) {
						const tower = this.cachedTowers.find(t => t.IsAlive && t.IsEnemy(hero) && t.Distance2D(target) < 1000)
						if (tower) {
							const dirFromTower = target.Subtract(tower.Position).Normalize()
							target = tower.Position.Add(dirFromTower.MultiplyScalar(900)) // Граница башни 850 + запас
						}
					}

					const movePos = this.GetSafeMovePos(hero.Position, target, hero)
					if (hero.Distance2D(movePos) > 150) {
						hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
						this.lastOrderTime = GameState.RawGameTime
						return true
					}
				}
				this.setStatus("Нет доступных целей")
				this.targetPos = undefined
				
				const distToFountain = fountain ? hero.Distance2D(fountain) : 10000
				if (this.forcedBaseExit.value && distToFountain < 6000 && hero.Level < this.laneOnlyUntilLevel.value && !this.isReturningAfterHeal) {
					const furthestTower = this.GetFurthestAlliedTower(hero)
					if (furthestTower) {
						this.setStatus("Принудительный выход")
						const movePos = this.GetSafeMovePos(hero.Position, furthestTower.Position, hero)
						hero.MoveTo(this.GetRandomizedPosition(movePos), false, true)
						this.lastOrderTime = GameState.RawGameTime
						return true
					}
				}

				return false
			}
		} catch (e) {
			this.Log(`Farm Error: ${e}`)
			return false
		}
	}

	private GetNearestEnabledSpot(hero: Unit): JungleSpot | null {
		const isFarmed = (spot: JungleSpot) => {
			for (const h of this.cachedHeroes) {
				if (h.Distance2D(spot.pos) < 600) {
					const isAttackingCreep = h.IsAttacking && h.Target instanceof Creep
					const hasFarmBuff = h.Buffs.some(b => /mask_of_madness|hand_of_midas|battlefury/.test(b.Name))
					
					if (isAttackingCreep || hasFarmBuff) {
						if (this.skipIfAllyFarming.value && !h.IsEnemy(hero)) return true
						if (this.skipIfEnemyFarming.value && h.IsEnemy(hero)) return true
					}
				}
			}
			return false
		}

		if (this.currentJungleSpotName) {
			const current = jungleSpots.find(s => s.name === this.currentJungleSpotName)
			if (current) {
				const toggle = this.spotToggles.get(current.name)
				const minLevel = this.spotLevelSliders.get(current.name)?.value ?? 1
				const isTeamValid = !this.ownJungleOnly.value || current.team === hero.Team
				const isLevelValid = hero.Level >= minLevel
				const isNotInTowerRange = !this.avoidTowers.value || !this.IsInTowerRange(current.pos, hero)
				const isPathSafe = !this.avoidTowers.value || !this.IsPathBlockedByTower(hero.Position, current.pos, hero)
				const isBeingFarmed = isFarmed(current)
				const isRangeValid = !(this.lanePriorityUntil4.value && hero.Level < 4 && hero.Distance2D(current.pos) > 1000)

				if (toggle?.value && isTeamValid && isLevelValid && isNotInTowerRange && isPathSafe && !isBeingFarmed && !this.emptySpots.has(current.name) && isRangeValid) {
					return current
				}
			}
		}

		let nearest: JungleSpot | null = null
		let minDist = Infinity

		for (const spot of jungleSpots) {
			const toggle = this.spotToggles.get(spot.name)
			const minLevel = this.spotLevelSliders.get(spot.name)?.value ?? 1
			const isTeamValid = !this.ownJungleOnly.value || spot.team === hero.Team
			const isLevelValid = hero.Level >= minLevel
			const isNotInTowerRange = !this.avoidTowers.value || !this.IsInTowerRange(spot.pos, hero)
			const isPathSafe = !this.avoidTowers.value || !this.IsPathBlockedByTower(hero.Position, spot.pos, hero)
			const isBeingFarmed = isFarmed(spot)
			const isRangeValid = !(this.lanePriorityUntil4.value && hero.Level < 4 && hero.Distance2D(spot.pos) > 1000)

			if (toggle?.value && isTeamValid && isLevelValid && isNotInTowerRange && isPathSafe && !isBeingFarmed && !this.emptySpots.has(spot.name) && isRangeValid) {
				const dist = hero.Distance2D(spot.pos)
				if (dist < minDist) {
					minDist = dist
					nearest = spot
				}
			}
		}

		this.currentJungleSpotName = nearest?.name ?? null
		return nearest
	}

	private GetNearestLaneCreep(hero: Unit): Creep | undefined {
		const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
		const isAtBase = fountain && hero.Distance2D(fountain) < 3500
		const maxDist = (isAtBase || this.isReturningAfterHeal) ? 15000 : 6000

		if (this.detailedDebug.value && this.isReturningAfterHeal) {
			this.Log(`Поиск (HeroTeam:${hero.Team} Base:${isAtBase} Return:${this.isReturningAfterHeal})`)
		}

		const creeps = this.cachedCreeps.filter(
			c => {
				const isEnemy = c.IsEnemy(hero)
				const isNotNeutral = !c.IsNeutral
				const isAlive = c.IsAlive
				const isVisible = c.IsVisible
				const dist = hero.Distance2D(c)
				const distValid = dist < maxDist
				const midValid = !this.ignoreMid.value || !this.IsMidLane(c.Position)
				const notIgnored = !this.IsIgnoredUnit(c)

				const allValid = isEnemy && isNotNeutral && isAlive && isVisible && distValid && midValid && notIgnored

				if (this.detailedDebug.value && !allValid && dist < 3000) {
					this.Log(`Крип ${c.Name} [${c.Index}] [Team:${c.Team}] отклонен: E:${isEnemy} N:${isNotNeutral} A:${isAlive} V:${isVisible} D:${distValid} M:${midValid} I:${notIgnored}`)
				}

				return allValid
			}
		)

		if (creeps.length > 0) {
			this.lastLaneCreepVisibleTime = GameState.RawGameTime
		}

		return creeps.sort((a, b) => hero.Distance2D(a) - hero.Distance2D(b))[0]
	}

	private IsIgnoredUnit(unit: Unit): boolean {
		const name = unit.Name
		if (this.ignoreBroodlings.value && name.includes("_spider")) return true
		if (this.ignoreLoneBear.value && name.includes("_bear")) return true
		if (this.ignoreEidolons.value && name.includes("_eidolon")) return true
		if (this.ignoreTreants.value && name.includes("_treant")) return true
		if (this.ignoreWolves.value && name.includes("_wolf")) return true
		if (this.ignoreGolems.value && name.includes("_golem")) return true
		if (this.ignoreBeastmaster.value && (name.includes("beastmaster_hawk") || name.includes("beastmaster_boar"))) return true
		if (this.ignoreIllustions.value && unit.IsIllusion) return true
		return false
	}

	private IsMidLane(pos: Vector3): boolean {
		// Мид в Доте идет по диагонали от (~ -6000, -6000) до (~ 6000, 6000)
		// Упрощенная проверка: точка находится в центральном коридоре шириной ~3000 единиц
		return Math.abs(pos.x - pos.y) < 1500 && Math.abs(pos.x) < 6000 && Math.abs(pos.y) < 6000
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

	private GetFurthestAlliedTower(hero: Unit): Tower | undefined {
		const alliedTowers = this.cachedTowers.filter(t => t.IsAlive && !t.IsEnemy(hero))
		if (alliedTowers.length === 0) return undefined

		const isRadiant = hero.Team === Team.Radiant
		let priority = this.lanePriority.SelectedID
		
		if (priority === 0 || priority === 3) { // Авто или Меньше союзников
			const topAllies = this.cachedHeroes.filter(h => !h.IsEnemy(hero) && h.Position.y > h.Position.x && !this.IsMidLane(h.Position)).length
			const botAllies = this.cachedHeroes.filter(h => !h.IsEnemy(hero) && h.Position.y < h.Position.x && !this.IsMidLane(h.Position)).length
			priority = topAllies <= botAllies ? 1 : 2
		}

		const isTop = (t: Tower) => t.Position.y > t.Position.x
		const isBot = (t: Tower) => t.Position.y < t.Position.x

		const laneTowers = alliedTowers.filter(t => {
			if (priority === 1) return isTop(t) && !this.IsMidLane(t.Position)
			if (priority === 2) return isBot(t) && !this.IsMidLane(t.Position)
			return true
		})

		if (laneTowers.length === 0) return alliedTowers.sort((a, b) => hero.Distance2D(b.Position) - hero.Distance2D(a.Position))[0]

		const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
		if (!fountain) return laneTowers.sort((a, b) => hero.Distance2D(b.Position) - hero.Distance2D(a.Position))[0]

		// Сортируем по дистанции от фонтана, берем самую дальнюю
		return laneTowers.sort((a, b) => fountain.Distance2D(b.Position) - fountain.Distance2D(a.Position))[0]
	}

	private IsPathBlockedByTower(start: Vector3, end: Vector3, hero: Unit): boolean {
		if (!this.avoidTowers.value) return false
		const dir = end.Subtract(start).Normalize()
		const dist = start.Distance2D(end)
		// Проверяем точки на пути каждые 150 единиц
		for (let d = 150; d < dist - 150; d += 150) {
			const checkPos = start.Add(dir.MultiplyScalar(d))
			if (this.IsInTowerRange(checkPos, hero, 50)) return true
		}
		return false
	}

	private GetDefaultLanePos(hero: Unit): Vector3 {
		const isRadiant = hero.Team === Team.Radiant
		let priority = this.lanePriority.SelectedID
		
		if (priority === 0 || priority === 3) { // Авто или Меньше союзников
			const topAllies = this.cachedHeroes.filter(h => !h.IsEnemy(hero) && h.Position.y > h.Position.x && !this.IsMidLane(h.Position)).length
			const botAllies = this.cachedHeroes.filter(h => !h.IsEnemy(hero) && h.Position.y < h.Position.x && !this.IsMidLane(h.Position)).length
			priority = topAllies <= botAllies ? 1 : 2
		}

		if (priority === 1) { // Верх
			return isRadiant ? new Vector3(-6500, -1000, 256) : new Vector3(-1000, 6500, 256)
		} else { // Низ
			return isRadiant ? new Vector3(1000, -6500, 256) : new Vector3(6500, 1000, 256)
		}
	}

	private GetSafeMovePos(start: Vector3, end: Vector3, hero: Unit): Vector3 {
		if (!this.avoidTowers.value) return end

		const dir = end.Subtract(start).Normalize()
		const dist = start.Distance2D(end)
		
		for (let d = 100; d < dist; d += 150) {
			const checkPos = start.Add(dir.MultiplyScalar(d))
			if (this.IsInTowerRange(checkPos, hero)) {
				// Пытаемся найти путь в обход, проверяя разные углы
				for (let angle = 30; angle <= 120; angle += 30) {
					const rad = angle * Math.PI / 180
					const escapeDir1 = dir.Rotated(rad)
					const escapeDir2 = dir.Rotated(-rad)
					
					const escapePos1 = checkPos.Add(escapeDir1.MultiplyScalar(1000))
					const escapePos2 = checkPos.Add(escapeDir2.MultiplyScalar(1000))
					
					if (!this.IsInTowerRange(escapePos1, hero)) {
						this.lastBypassTime = GameState.RawGameTime
						return escapePos1
					}
					if (!this.IsInTowerRange(escapePos2, hero)) {
						this.lastBypassTime = GameState.RawGameTime
						return escapePos2
					}
				}
				
				// Если обход не найден, возвращаемся назад от башни
				this.lastBypassTime = GameState.RawGameTime
				return start.Subtract(dir.MultiplyScalar(300))
			}
		}
		
		return end
	}
})()
