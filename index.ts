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

new (class JungleFarmScript {
	private readonly entry = Menu.AddEntry("Фарм Леса/Линии")
	private readonly state = this.entry.AddToggle("Включить скрипт", false, "Общий переключатель работы скрипта")
	private readonly toggleKey = this.entry.AddKeybind("Клавиша переключения", "F1", "Быстрое ВКЛ/ВЫКЛ")

	private readonly laneNode = this.entry.AddNode("Настройки Линии", "", "Все, что касается фарма крипов на линии")
	private readonly laneFarm = this.laneNode.AddToggle("Фарм линии", true, "Разрешить герою фармить крипов на линии")
	private readonly laneOnlyUntilLevel = this.laneNode.AddSlider("Фарм линии до уровня", 1, 1, 30, 1, "Герой будет игнорировать лес и фармить только линию до этого уровня")
	private readonly laneWaitTime = this.laneNode.AddSlider("Ожидание крипов (сек)", 30, 0, 120, 1, "Сколько секунд ждать новую пачку на линии")
	private readonly lanePriority = this.laneNode.AddDropdown("Приоритет линии", ["Автоматически", "Только Верх", "Только Низ", "Меньше союзников"], 0, "Какую линию фармить в первую очередь (до уровня леса)")
	private readonly randomWalkWaiting = this.laneNode.AddToggle("Случайная ходьба", true, "Активное движение в безопасной зоне при ожидании")
	private readonly chaoticMoveAroundLastCreep = this.laneNode.AddToggle("Мансы у места смерти", true, "Движение вокруг позиции последнего убитого крипа")
	private readonly laneTowerSafety = this.laneNode.AddToggle("Доп. радиус от башен", true, "Увеличивает безопасную дистанцию до башен на стадии линии")
	private readonly laneTowerRadius = this.laneNode.AddSlider("Радиус отступа (линия)", 150, 0, 500, 1, "На сколько единиц дальше держаться от радиуса атаки башни")
	private readonly fleeFromCreepsUnderTower = this.laneNode.AddToggle("Отход при уроне под башней", true, "Уходить, если крипы под башней бьют вас, а вы их нет")

	private readonly jungleNode = this.entry.AddNode("Настройки Леса", "", "Настройки фарма нейтральных крипов")
	private readonly ownJungleOnly = this.jungleNode.AddToggle("Только свой лес", true, "Не заходить на вражескую территорию")
	private readonly moveOnlyBetweenCamps = this.jungleNode.AddToggle("MoveTo между кемпами", true, "Не отвлекаться на героев при перебежках")
	private readonly skipIfAllyFarming = this.jungleNode.AddToggle("Пропускать занятые союзником", true, "Не мешать союзникам фармить")
	private readonly skipIfEnemyFarming = this.jungleNode.AddToggle("Пропускать занятые врагом", true, "Избегать стычек на спотах")
	private readonly spotsNode = this.jungleNode.AddNode("Лесные лагеря", "", "Включение/выключение конкретных точек фарма")

	private readonly safetyNode = this.entry.AddNode("Безопасность", "", "Настройки выживания и фильтры целей")
	private readonly avoidTowers = this.safetyNode.AddToggle("Обходить башни", true, "Автоматический поиск пути в обход радиуса атак башен")
	private readonly hpThreshold = this.safetyNode.AddSlider("Порог здоровья %", 30, 0, 100, 1, "При каком HP идти лечиться на базу")
	private readonly autoTpLowHp = this.safetyNode.AddToggle("Авто-ТП на базу", false, "Использовать свиток телепортации, если HP ниже порога")
	private readonly ignoreHeroes = this.safetyNode.AddToggle("Игнорировать героев", true, "Не атаковать героев при фарме")
	private readonly ignoreHeroesTime = this.safetyNode.AddSlider("Игнорировать с минуты", 1, 0, 60, 1, "С какой минуты начинать игнорировать героев")
	private readonly ignoreMid = this.safetyNode.AddToggle("Игнорировать мид", true, "Не ходить на центральную линию")

	private readonly ignoreUnitsNode = this.entry.AddNode("Игнор юнитов", "", "Список юнитов, которых скрипт будет игнорировать")
	private readonly ignoreBroodlings = this.ignoreUnitsNode.AddToggle("Паучки Бруды", true)
	private readonly ignoreLoneBear = this.ignoreUnitsNode.AddToggle("Медведь Друида", true)
	private readonly ignoreEidolons = this.ignoreUnitsNode.AddToggle("Энигма (Эйдолоны)", true)
	private readonly ignoreTreants = this.ignoreUnitsNode.AddToggle("Фурион (Пеньки)", true)
	private readonly ignoreWolves = this.ignoreUnitsNode.AddToggle("Волки Люкана", true)
	private readonly ignoreGolems = this.ignoreUnitsNode.AddToggle("Големы Варлока", true)
	private readonly ignoreIllustions = this.ignoreUnitsNode.AddToggle("Все иллюзии", true)

	private readonly autoNode = this.entry.AddNode("Автоматизация", "", "Авто-предметы и способности")
	private readonly itemsNode = this.autoNode.AddNode("Авто-предметы")
	private readonly usePhase = this.itemsNode.AddToggle("Phase Boots", true)
	private readonly useMom = this.itemsNode.AddToggle("Mask of Madness", true)
	private readonly useMidas = this.itemsNode.AddToggle("Hand of Midas", true)
	private readonly useQuelling = this.itemsNode.AddToggle("Quelling Blade", true)
	private readonly useNeutral = this.itemsNode.AddToggle("Авто-нейтралка", true)
	private readonly autoSelectNeutral = this.itemsNode.AddToggle("Авто-выбор аспекта/нейтралки", true)

	private readonly abilitiesNode = this.autoNode.AddNode("Авто-способности")
	private readonly useMovementAbilities = this.abilitiesNode.AddToggle("Передвижение", true)
	private readonly useDamageAbilities = this.abilitiesNode.AddToggle("Урон", true)
	private readonly aggressiveAbilities = this.abilitiesNode.AddToggle("Агрессивный режим", false)
	private readonly manaThreshold = this.abilitiesNode.AddSlider("Мин. мана %", 30, 0, 100, 1)
	private readonly enabledSpells: Map<string, Menu.Toggle> = new Map()
	private readonly spellsWhitelistNode = this.abilitiesNode.AddNode("Белый список")

	private readonly visualNode = this.entry.AddNode("Визуализация", "", "Отрисовка маршрутов и статусов")
	private readonly drawSpots = this.visualNode.AddToggle("Рисовать споты", true)
	private readonly drawRoute = this.visualNode.AddToggle("Рисовать маршрут", true)
	private readonly lockCamera = this.visualNode.AddToggle("Центрировать камеру", false)

	private readonly debugNode = this.entry.AddNode("Отладка", "", "Технические функции для тестирования")
	private readonly debugLogging = this.debugNode.AddToggle("Логирование в консоль", false, "Выводить подробную информацию о действиях скрипта в консоль лоадера")
	private readonly drawDebugLog = this.debugNode.AddToggle("Показывать лог на экране", false, "Отрисовка последних действий скрипта в углу экрана")
	private readonly disableResetBetweenGames = this.debugNode.AddToggle("Отключить сброс между играми", false, "Не очищать состояние скрипта при начале новой игры (может вызвать баги)")
	private readonly autoDisableInMenu = this.debugNode.AddToggle("Выключать в главном меню", true, "Автоматически выключать скрипт при выходе в главное меню")
	private readonly heroDamageWarning = this.debugNode.AddToggle("Тест урона героев", false, "Показывать уведомление при получении урона от вражеского героя")
	private readonly chatOnHeroDamage = this.debugNode.AddToggle("Чат при уроне", false, "Писать в чат просьбу не бить при получении урона от героя")
	private readonly chatOnHeroDamageLevel = this.debugNode.AddSlider("Уровень для чата", 1, 1, 30, 1, "С какого уровня героя начнет работать отправка сообщений в чат")
	private readonly autoEnable = this.debugNode.AddToggle("Авто-включение скрипта", true, "Автоматически включать скрипт, если он выключен, при достижении времени")
	private readonly autoEnableTime = this.debugNode.AddSlider("Минута включения", 2, 0, 60, 1, "На какой минуте игры автоматически включить скрипт")
	private readonly testSayButton = this.debugNode.AddButton("Тест консоли (say)", "Отправить 'Hello World' в чат")

	private readonly spotToggles: Map<string, Menu.Toggle> = new Map()
	private readonly spotLevelSliders: Map<string, Menu.Slider> = new Map()
	private readonly emptySpots: Set<string> = new Set()
	private readonly heroSettings: Map<string, {}> = new Map()

	private readonly visibleSymbol = typeof Panorama !== 'undefined' ? Panorama.MakeSymbol("Visible") : null
	private lastMinute = -1
	private lastLaneCreepVisibleTime = 0
	private lastOrderTime = 0
	private lastOrderWasAttack = false
	private isGoingToFountain = false
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
	private isEscapingTower = false
	private lastTpTime = 0
	private readonly logBuffer: string[] = []
	private readonly maxLogLines = 15
	private cachedTowers: Tower[] = []
	private cachedCreeps: Creep[] = []
	private cachedHeroes: Unit[] = []

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
		
		if (this.debugLogging.value) {
			console.log(`[JungleFarm] ${formatted}`)
		}

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

	constructor() {
		for (const spot of jungleSpots) {
			const node = this.spotsNode.AddNode(spot.name)
			this.spotToggles.set(spot.name, node.AddToggle("Включено", true))
			this.spotLevelSliders.set(spot.name, node.AddSlider("Мин. уровень", 1, 1, 30, 1))
		}

		this.toggleKey.OnPressed(() => {
			this.state.value = !this.state.value
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
				if (!this.IsInTowerRange(victim.Position, hero) && (!this.ignoreMid.value || !this.IsMidLane(victim.Position))) {
					this.lastCreepDeathPos = victim.Position
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
				this.heroSettings.set(heroKey, {})
			}

			// Auto-enable logic
			if (!this.state.value && this.autoEnable.value && GameState.RawGameTime >= this.autoEnableTime.value * 60) {
				this.state.value = true
				this.Log(`Скрипт включен автоматически (${this.autoEnableTime.value} мин)`)
			}

			if (!this.state.value) return

			// Skip logic if game hasn't truly started
			if (GameState.RawGameTime < 0.5) {
				if (this.autoSelectNeutral.value && typeof Panorama !== 'undefined') {
					this.HandlePanorama(hero)
				}
				return
			}

			// Run logic on Draw frame but throttle it (every 100ms)
			if (GameState.RawGameTime > this.lastLogicTime + 0.1) {
				this.OnUpdate(hero)
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
			const currentMinute = Math.floor(rawTime / 60)
			
			if (this.lastMinute === -1) this.lastMinute = currentMinute
			if (currentMinute !== this.lastMinute) {
				this.emptySpots.clear()
				this.lastMinute = currentMinute
			}

			if (this.ignoreHeroes.value && hero.IsAttacking && rawTime >= this.ignoreHeroesTime.value * 60) {
				const target = hero.Target
				if (target instanceof Unit && target.IsHero && target.IsEnemy(hero)) {
					hero.OrderStop(false, true)
					this.setStatus("Остановка (Игнор героев)")
					this.lastOrderTime = rawTime
					return
				}
			}

			if (rawTime < this.lastOrderTime + 0.3) return

			const nearbyCreep = this.cachedCreeps.find(c => 
				!c.IsNeutral && c.IsAlive && c.IsVisible && hero.Distance2D(c) < 2000 && !this.IsInTowerRange(c.Position, hero)
			)
			if (nearbyCreep) {
				this.lastCreepDeathPos = nearbyCreep.Position
			}

			const hpPercent = hero.HPPercentDecimal * 100
			if (hpPercent < this.hpThreshold.value) {
				this.isGoingToFountain = true
				
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
				this.isGoingToFountain = false
			}

			if (this.isGoingToFountain) {
				this.setStatus("Возврат на базу")
				this.GoToFountain(hero)
				return
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

				this.AutoAbilities(hero)
				this.AutoItems(hero)
				this.HandlePanorama(hero)
			}
		} catch (e) {
			this.Log(`Update Error: ${e}`)
		}
	}

	private HandlePanorama(hero: Unit): void {
		if (!this.autoSelectNeutral.value || hero.Team === Team.None || typeof Panorama === 'undefined') return

		if (GameState.RawGameTime < this.lastOrderTime + 1.0) return

		const dotaHud = Panorama.FindRootPanel("DotaHud")
		if (!dotaHud) return

		const token = hero.Items.find(i => i && i.Name.includes("item_tier") && i.Name.includes("token") && i.IsReady)
		if (token) {
			const neutralPicker = dotaHud.FindChildTraverse("NeutralItemPicker")
			const isPickerVisible = neutralPicker && (this.visibleSymbol ? neutralPicker.BHasClass(this.visibleSymbol) : false || neutralPicker.GetActualLayoutWidth() > 0)
			if (!isPickerVisible) {
				hero.CastNoTarget(token, false, true)
				this.lastOrderTime = GameState.RawGameTime
				return
			}
		}

		const neutralPicker = dotaHud.FindChildTraverse("NeutralItemPicker")
		if (neutralPicker && (this.visibleSymbol ? neutralPicker.BHasClass(this.visibleSymbol) : false || neutralPicker.GetActualLayoutWidth() > 0)) {
			const hammer = neutralPicker.FindChildTraverse("Hammer") ?? 
			               neutralPicker.FindChildTraverse("CraftButton") ?? 
			               neutralPicker.FindChildTraverse("UnlockButton") ??
			               neutralPicker.FindChildTraverse("RollButton")
			
			if (hammer && hammer.IsEnabled() && hammer.IsActivationEnabled()) {
				Panorama.DispatchEventAsync("Activated(program)", hammer)
				this.lastOrderTime = GameState.RawGameTime
				return
			}

			const itemsContainer = neutralPicker.FindChildTraverse("ItemsContainer") ??
			                       neutralPicker.FindChildTraverse("ArtifactsContainer")
			const itemsCount = itemsContainer?.GetChildCount() ?? 0
			if (itemsCount > 0 && itemsContainer) {
				const randomIndex = Math.floor(Math.random() * itemsCount)
				const item = itemsContainer.GetChild(randomIndex)
				if (item && item.IsEnabled() && item.IsActivationEnabled()) {
					Panorama.DispatchEventAsync("Activated(program)", item)
					this.lastOrderTime = GameState.RawGameTime
					return
				}
			}
		}

		const facetPicker = dotaHud.FindChildTraverse("FacetPicker")
		if (facetPicker && (this.visibleSymbol ? facetPicker.BHasClass(this.visibleSymbol) : false || facetPicker.GetActualLayoutWidth() > 0)) {
			const facetsContainer = facetPicker.FindChildTraverse("FacetsContainer")
			const facetsCount = facetsContainer?.GetChildCount() ?? 0
			if (facetsCount > 0 && facetsContainer) {
				const randomIndex = Math.floor(Math.random() * facetsCount)
				const facet = facetsContainer.GetChild(randomIndex)
				if (facet && facet.IsEnabled() && facet.IsActivationEnabled()) {
					Panorama.DispatchEventAsync("Activated(program)", facet)
					this.lastOrderTime = GameState.RawGameTime
					return
				}
			}
		}

		if (this.useNeutral.value && hero.IsAttacking) {
			const neutralItem = hero.Items.find(i => i && i.IsNeutral && i.IsReady)
			if (neutralItem) {
				const target = hero.Target
				if (target instanceof Creep && target.IsAlive && hero.Distance2D(target) < 600) {
					hero.CastNoTarget(neutralItem, false, true)
					this.lastOrderTime = GameState.RawGameTime
					return
				}
			}
		}
	}

	private AutoItems(hero: Unit): void {
		if (this.currentStatus === "Возврат на базу" || this.currentStatus === "Побег от башни") return

		if (this.usePhase.value && (hero.IsMoving || hero.IsAttacking)) {
			const phase = hero.GetItemByName("item_phase_boots")
			if (phase?.IsReady) {
				hero.CastNoTarget(phase, false, true)
				this.lastOrderTime = GameState.RawGameTime
				return
			}
		}

		if (this.useMom.value && hero.IsAttacking && (this.currentStatus === "Фарм леса" || this.currentStatus === "Фарм линии")) {
			const mom = hero.GetItemByName("item_mask_of_madness")
			if (mom?.IsReady) {
				hero.CastNoTarget(mom, false, true)
				this.lastOrderTime = GameState.RawGameTime
				return
			}
		}

		if (this.useMidas.value) {
			const midas = hero.GetItemByName("item_hand_of_midas")
			if (midas?.IsReady) {
				const target = this.cachedCreeps.find(
					c => c.IsEnemy(hero) && c.IsNeutral && c.IsAlive && c.IsVisible && hero.Distance2D(c) < 600
				)
				if (target) {
					hero.CastTarget(midas, target, false, true)
					this.lastOrderTime = GameState.RawGameTime
					return
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
					return
				}
			}
		}
	}

	private AutoAbilities(hero: Unit): void {
		if (hero.ManaPercent < this.manaThreshold.value) return

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
				return
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
				for (const damageSpell of spells) {
					hero.UseSmartAbility(damageSpell, target as Creep, false, false, false, true)
					this.lastOrderTime = GameState.RawGameTime
				}
			} else if (spells.length > 0) {
				const damageSpell = spells[0]
				hero.UseSmartAbility(damageSpell, target as Creep, false, false, false, true)
				this.lastOrderTime = GameState.RawGameTime
				return
			}
		}
	}

	private GoToFountain(hero: Unit): void {
		const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
		if (fountain) {
			this.targetPos = fountain.Position
			if (hero.Distance2D(fountain) > 200) {
				const movePos = this.GetSafeMovePos(hero.Position, fountain.Position, hero)
				hero.MoveTo(movePos, false, true)
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
		hero.MoveTo(movePos, false, true)
		this.lastOrderTime = GameState.RawGameTime
	}

	private Farm(hero: Unit): boolean {
		try {
			const rawTime = GameState.RawGameTime

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

			const targetCreep = this.laneFarm.value ? this.GetNearestLaneCreep(hero) : undefined
			
			const waitingOnLane = this.laneFarm.value && 
			                      targetCreep === undefined && 
			                      (rawTime - this.lastLaneCreepVisibleTime < this.laneWaitTime.value) &&
			                      hero.Level < this.laneOnlyUntilLevel.value

			const nearestSpot = (hero.Level >= this.laneOnlyUntilLevel.value && !waitingOnLane) ? this.GetNearestEnabledSpot(hero) : null

			if (targetCreep && (!nearestSpot || hero.Distance2D(targetCreep) < hero.Distance2D(nearestSpot.pos))) {
				const isCreepInTowerRange = this.IsInTowerRange(targetCreep.Position, hero)
				if (!isCreepInTowerRange) {
					this.setStatus("Фарм линии")
					this.targetPos = targetCreep.Position
					if (hero.TargetIndex_ !== targetCreep.Index || (!hero.IsAttacking && GameState.RawGameTime > this.lastOrderTime + 1.0)) {
						const movePos = this.GetSafeMovePos(hero.Position, targetCreep.Position, hero)
						if (movePos.Distance2D(targetCreep.Position) > 100) {
							hero.MoveTo(movePos, false, true)
						} else {
							hero.AttackTarget(targetCreep, false, true)
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
					const fountain = this.SafeGetEntities<Fountain>(Fountain).find(f => !f.IsEnemy(hero))
					const isAtBase = fountain && hero.Distance2D(fountain) < 2500

					let centerPos = this.lastCreepDeathPos
					
					// Если мы на базе или нет точки смерти, выбираем позицию на линии принудительно
					if (!centerPos || isAtBase) {
						centerPos = this.GetDefaultLanePos(hero)
					}

					if (this.IsInTowerRange(centerPos, hero)) {
						centerPos = hero.Position
					}

					const distToCenter = hero.Distance2D(centerPos)

					if (distToCenter > 800) {
						const movePos = this.GetSafeMovePos(hero.Position, centerPos, hero)
						if (movePos.Distance2D(hero.Position) > 100) {
							hero.MoveTo(movePos, false, true)
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
							hero.MoveTo(movePos, false, true)
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

				const neutral = this.cachedCreeps.find(
					c =>
						c.IsEnemy(hero) &&
						c.IsNeutral &&
						c.IsAlive &&
						c.IsSpawned &&
						c.IsVisible &&
						c.Distance2D(nearestSpot.pos) < 600 &&
						!this.IsInTowerRange(c.Position, hero)
				)

				if (neutral) {
					this.setStatus("Фарм леса")
					this.targetPos = neutral.Position
					if (hero.TargetIndex_ !== neutral.Index || (!hero.IsAttacking && GameState.RawGameTime > this.lastOrderTime + 1.0)) {
						const movePos = this.GetSafeMovePos(hero.Position, neutral.Position, hero)
						if (movePos.Distance2D(neutral.Position) > 100) {
							hero.MoveTo(movePos, false, true)
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
						hero.MoveTo(movePos, false, true)
					} else {
						if (this.lastOrderWasAttack) {
							hero.MoveTo(movePos, false, true)
							this.lastOrderWasAttack = false
						} else {
							hero.AttackMove(movePos, false, true)
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
				if (this.laneFarm.value && this.lastCreepDeathPos) {
					this.setStatus("Возврат на линию")
					let target = this.lastCreepDeathPos
					
					// Если точка смерти крипа под башней, находим безопасную точку перед ней
					if (this.IsInTowerRange(target, hero)) {
						const tower = this.cachedTowers.find(t => t.IsAlive && t.IsEnemy(hero) && t.Distance2D(target) < 1000)
						if (tower) {
							const dirFromTower = target.Subtract(tower.Position).Normalize()
							target = tower.Position.Add(dirFromTower.MultiplyScalar(900)) // Граница башни 850 + запас
						}
					}

					const movePos = this.GetSafeMovePos(hero.Position, target, hero)
					if (hero.Distance2D(movePos) > 150) {
						hero.MoveTo(movePos, false, true)
						this.lastOrderTime = GameState.RawGameTime
						return true
					}
				}
				this.setStatus("Нет доступных целей")
				this.targetPos = undefined
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
					if (this.skipIfAllyFarming.value && !h.IsEnemy(hero)) return true
					if (this.skipIfEnemyFarming.value && h.IsEnemy(hero)) return true
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

				if (toggle?.value && isTeamValid && isLevelValid && isNotInTowerRange && isPathSafe && !isBeingFarmed && !this.emptySpots.has(current.name)) {
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

			if (toggle?.value && isTeamValid && isLevelValid && isNotInTowerRange && isPathSafe && !isBeingFarmed && !this.emptySpots.has(spot.name)) {
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
		const isAtBase = fountain && hero.Distance2D(fountain) < 2000
		const maxDist = isAtBase ? 15000 : 5000

		// Доп. логика выбора линии
		const filterByLane = (c: Creep) => {
			if (hero.Level >= this.laneOnlyUntilLevel.value) return true // После нужного уровня фармим всё

			const pos = c.Position
			const isTop = pos.y > 2000 && pos.x < -2000
			const isBot = pos.y < -2000 && pos.x > 2000
			
			switch (this.lanePriority.SelectedID) {
				case 1: return isTop // Только верх
				case 2: return isBot // Только низ
				case 3: { // Меньше союзников
					const topAllies = this.cachedHeroes.filter(h => !h.IsEnemy(hero) && h.Position.y > 2000 && h.Position.x < -2000).length
					const botAllies = this.cachedHeroes.filter(h => !h.IsEnemy(hero) && h.Position.y < -2000 && h.Position.x > 2000).length
					if (topAllies < botAllies) return isTop
					if (botAllies < topAllies) return isBot
					return isTop || isBot // Только верх или низ, НИКОГДА мид
				}
				default: return true // Автоматически
			}
		}

		const creeps = this.cachedCreeps.filter(
			c =>
				c.IsEnemy(hero) &&
				!c.IsNeutral &&
				c.IsAlive &&
				c.IsVisible &&
				hero.Distance2D(c) < maxDist && // Игнорируем крипов на других линиях, если мы уже на линии
				(!this.ignoreMid.value || !this.IsMidLane(c.Position)) &&
				filterByLane(c) &&
				!this.IsIgnoredUnit(c)
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
			const topAllies = this.cachedHeroes.filter(h => !h.IsEnemy(hero) && h.Position.y > 2000 && h.Position.x < -2000).length
			const botAllies = this.cachedHeroes.filter(h => !h.IsEnemy(hero) && h.Position.y < -2000 && h.Position.x > 2000).length
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
