const STORAGE_KEY = 'daily-plan-lite:v1'
const DAY_MS = 24 * 60 * 60 * 1000
const TIME_ZONE = 'Asia/Shanghai'
const DEFAULT_TODO_PRIORITY = 'important_not_urgent'
const TODO_PRIORITIES = new Set([
  'important_urgent',
  'important_not_urgent',
  'not_important_urgent',
  'not_important_not_urgent',
])
const TODO_TIME_SLOTS = new Set(['none', 'morning', 'afternoon', 'evening', 'specific'])
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const UPCOMING_TODO_DAYS = 30

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const shanghaiPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
})

const baseData = {
  days: [],
  monthlyGoals: [],
  weeklyReports: [],
  settings: {
    timezone: TIME_ZONE,
    weeklyReportDay: 'Friday',
    weeklyReportTime: '18:00',
    lastAutoRunWeekKey: null,
  },
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function newId() {
  return crypto.randomUUID()
}

export function todayString() {
  return dateFormatter.format(new Date())
}

function utcDate(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`)
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(dateString, days) {
  return formatDate(new Date(utcDate(dateString).getTime() + days * DAY_MS))
}

function monthKey(dateString) {
  return dateString.slice(0, 7)
}

function addMonths(monthString, months) {
  const date = new Date(`${monthString}-01T00:00:00.000Z`)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString().slice(0, 7)
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function normalizePriority(value) {
  if (TODO_PRIORITIES.has(value)) return value

  const legacyPriorityMap = {
    important: 'important_urgent',
    normal: DEFAULT_TODO_PRIORITY,
    low: 'not_important_not_urgent',
  }

  return legacyPriorityMap[value] ?? DEFAULT_TODO_PRIORITY
}

function normalizeTimeSlot(value) {
  return TODO_TIME_SLOTS.has(value) ? value : 'none'
}

function normalizeSpecificTime(value, timeSlot) {
  const cleanValue = cleanText(value)
  return timeSlot === 'specific' && TIME_PATTERN.test(cleanValue) ? cleanValue : ''
}

function normalizeSortOrder(value, fallback = 0) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

function normalizeTodoFields(payload = {}) {
  const timeSlot = normalizeTimeSlot(payload.timeSlot)

  return {
    priority: normalizePriority(payload.priority),
    timeSlot,
    specificTime: normalizeSpecificTime(payload.specificTime, timeSlot),
    notes: cleanText(payload.notes),
  }
}

function normalizeTodo(todo = {}, index = 0) {
  return {
    id: cleanText(todo.id) || newId(),
    text: cleanText(todo.text),
    done: Boolean(todo.done),
    createdAt: cleanText(todo.createdAt) || new Date().toISOString(),
    completedAt: todo.completedAt ?? null,
    sortOrder: normalizeSortOrder(todo.sortOrder, index),
    postponedFrom: cleanText(todo.postponedFrom) || undefined,
    postponedTo: cleanText(todo.postponedTo) || undefined,
    postponedAt: cleanText(todo.postponedAt) || undefined,
    postponedOutAt: cleanText(todo.postponedOutAt) || undefined,
    postponedTargetTodoId: cleanText(todo.postponedTargetTodoId) || undefined,
    autoPostponed: Boolean(todo.autoPostponed),
    autoPostponedOut: Boolean(todo.autoPostponedOut),
    sourceTodoId: cleanText(todo.sourceTodoId) || undefined,
    ...normalizeTodoFields(todo),
  }
}

function normalizeDay(day = {}) {
  return {
    id: cleanText(day.id) || newId(),
    date: DATE_PATTERN.test(day.date) ? day.date : todayString(),
    focus: cleanText(day.focus),
    workSummary: cleanText(day.workSummary),
    wins: cleanText(day.wins),
    blockers: cleanText(day.blockers),
    todos: Array.isArray(day.todos)
      ? day.todos.map((todo, index) => normalizeTodo(todo, index)).filter((todo) => todo.text)
      : [],
    completedTodoArchive: Array.isArray(day.completedTodoArchive)
      ? day.completedTodoArchive
          .map((todo, index) => normalizeTodo(todo, index))
          .filter((todo) => todo.text)
      : [],
    updatedAt: cleanText(day.updatedAt) || new Date().toISOString(),
  }
}

function normalizeGoalProgressLog(log = {}, fallbackProgress = 0) {
  const date = cleanText(log.date)
  if (!DATE_PATTERN.test(date)) return null

  return {
    date,
    content: cleanText(log.content),
    progress: Math.max(0, Math.min(100, Number(log.progress ?? fallbackProgress) || 0)),
    createdAt: cleanText(log.createdAt) || cleanText(log.updatedAt) || new Date().toISOString(),
    updatedAt: cleanText(log.updatedAt) || cleanText(log.createdAt) || new Date().toISOString(),
  }
}

function normalizeMonthlyGoal(goal = {}) {
  const progress = Math.max(0, Math.min(100, Number(goal.progress ?? 0) || 0))

  return {
    id: cleanText(goal.id) || newId(),
    month: /^\d{4}-\d{2}$/.test(goal.month) ? goal.month : monthKey(todayString()),
    title: cleanText(goal.title),
    status: cleanText(goal.status) || 'active',
    progress,
    notes: cleanText(goal.notes),
    progressLogs: Array.isArray(goal.progressLogs)
      ? goal.progressLogs
          .map((log) => normalizeGoalProgressLog(log, progress))
          .filter(Boolean)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      : [],
    rolledFrom: cleanText(goal.rolledFrom) || undefined,
    rolledTo: cleanText(goal.rolledTo) || undefined,
    sourceGoalId: cleanText(goal.sourceGoalId) || undefined,
    createdAt: cleanText(goal.createdAt) || new Date().toISOString(),
    updatedAt: cleanText(goal.updatedAt) || new Date().toISOString(),
  }
}

function normalizeReport(report = {}) {
  return {
    id: cleanText(report.id) || newId(),
    weekKey: cleanText(report.weekKey),
    periodStart: cleanText(report.periodStart),
    periodEnd: cleanText(report.periodEnd),
    generatedAt: cleanText(report.generatedAt) || new Date().toISOString(),
    sourceEntryDates: Array.isArray(report.sourceEntryDates) ? report.sourceEntryDates : [],
    autoGenerated: Boolean(report.autoGenerated),
    headline: cleanText(report.headline),
    overview: cleanText(report.overview),
    completedTodos: Array.isArray(report.completedTodos) ? report.completedTodos.map(cleanText) : [],
    unfinishedTodos: Array.isArray(report.unfinishedTodos)
      ? report.unfinishedTodos.map(cleanText)
      : [],
    wins: Array.isArray(report.wins) ? report.wins.map(cleanText) : [],
    dailyNotes: Array.isArray(report.dailyNotes) ? report.dailyNotes : [],
    goalProgress: Array.isArray(report.goalProgress) ? report.goalProgress : [],
    blockers: Array.isArray(report.blockers) ? report.blockers.map(cleanText) : [],
    nextWeekFocus: Array.isArray(report.nextWeekFocus) ? report.nextWeekFocus.map(cleanText) : [],
  }
}

function normalizeData(data = {}) {
  return {
    days: Array.isArray(data.days)
      ? data.days.map(normalizeDay).sort((a, b) => a.date.localeCompare(b.date))
      : [],
    monthlyGoals: Array.isArray(data.monthlyGoals)
      ? data.monthlyGoals.map(normalizeMonthlyGoal).filter((goal) => goal.title)
      : [],
    weeklyReports: Array.isArray(data.weeklyReports)
      ? data.weeklyReports.map(normalizeReport).filter((report) => report.weekKey)
      : [],
    settings: {
      ...baseData.settings,
      ...(typeof data.settings === 'object' && data.settings ? data.settings : {}),
    },
  }
}

function readPlanner() {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return normalizeData(clone(baseData))

  try {
    return normalizeData(JSON.parse(raw))
  } catch {
    const backupKey = `${STORAGE_KEY}:corrupt:${Date.now()}`
    window.localStorage.setItem(backupKey, raw)
    return normalizeData(clone(baseData))
  }
}

function writePlanner(data) {
  window.localStorage.setItem(STORAGE_KEY, `${JSON.stringify(normalizeData(data), null, 2)}\n`)
}

function ensureDay(data, dateString) {
  let day = data.days.find((item) => item.date === dateString)

  if (!day) {
    day = normalizeDay({ date: dateString })
    data.days.push(day)
    data.days.sort((a, b) => a.date.localeCompare(b.date))
  }

  return day
}

function nextTodoSortOrder(day) {
  return day.todos.reduce((max, todo, index) => {
    return Math.max(max, normalizeSortOrder(todo.sortOrder, index))
  }, -1) + 1
}

function assignTodoSortOrders(todos) {
  todos.forEach((todo, index) => {
    todo.sortOrder = index
  })
}

function todoSourceId(todo) {
  return todo.sourceTodoId || todo.id
}

function createPostponedTodo(todo, sourceDate, options = {}) {
  const now = new Date().toISOString()

  return normalizeTodo({
    id: newId(),
    text: todo.text,
    done: false,
    createdAt: now,
    completedAt: null,
    sortOrder: normalizeSortOrder(options.sortOrder),
    ...normalizeTodoFields(todo),
    postponedFrom: sourceDate,
    postponedAt: now,
    autoPostponed: Boolean(options.autoPostponed),
    sourceTodoId: todoSourceId(todo),
  })
}

function syncPostponedTargetTodo(data, dateString, todo, now) {
  if (!todo.postponedTo) return

  const targetDay = data.days.find((item) => item.date === todo.postponedTo)
  const targetTodo = targetDay?.todos?.find(
    (item) =>
      item.id === todo.postponedTargetTodoId ||
      (todoSourceId(item) === todoSourceId(todo) && item.postponedFrom === dateString),
  )

  if (!targetTodo || targetTodo.done) return

  targetTodo.text = todo.text
  Object.assign(targetTodo, normalizeTodoFields(todo))
  targetDay.updatedAt = now
}

function autoPostponePreviousDayTodos(data, dateString) {
  if (dateString > todayString()) return false

  const sourceDate = addDays(dateString, -1)
  const sourceDay = data.days.find((item) => item.date === sourceDate)
  const openTodos = sourceDay?.todos?.filter((todo) => !todo.done && !todo.postponedTo) ?? []

  if (!openTodos.length) return false

  const now = new Date().toISOString()
  const targetDay = ensureDay(data, dateString)
  let changed = false

  openTodos.forEach((todo) => {
    const sourceTodoId = todoSourceId(todo)
    let targetTodo = targetDay.todos.find((item) => todoSourceId(item) === sourceTodoId)

    if (!targetTodo) {
      targetTodo = createPostponedTodo(todo, sourceDate, {
        autoPostponed: true,
        sortOrder: nextTodoSortOrder(targetDay),
      })
      targetDay.todos.push(targetTodo)
    }

    todo.postponedTo = dateString
    todo.postponedOutAt = now
    todo.postponedTargetTodoId = targetTodo.id
    todo.autoPostponedOut = true
    sourceDay.updatedAt = now
    targetDay.updatedAt = now
    changed = true
  })

  return changed
}

function autoPostponeOpenTodosInDataThroughDate(data, targetDateString = todayString()) {
  const today = todayString()
  const targetDate = targetDateString > today ? today : targetDateString
  const firstOpenSourceDate = data.days
    .filter(
      (day) =>
        day.date < targetDate &&
        Array.isArray(day.todos) &&
        day.todos.some((todo) => !todo.done && !todo.postponedTo),
    )
    .map((day) => day.date)
    .sort((a, b) => a.localeCompare(b))[0]

  if (!firstOpenSourceDate) return false

  let cursorDate = addDays(firstOpenSourceDate, 1)
  let changed = false

  while (cursorDate <= targetDate) {
    changed = autoPostponePreviousDayTodos(data, cursorDate) || changed
    cursorDate = addDays(cursorDate, 1)
  }

  return changed
}

function autoRollIncompleteMonthlyGoalsInDataThroughMonth(data, targetMonthString) {
  const firstSourceMonth = data.monthlyGoals
    .filter(
      (goal) =>
        goal.month < targetMonthString &&
        goal.status !== 'done' &&
        Number(goal.progress ?? 0) < 100 &&
        !goal.rolledTo,
    )
    .map((goal) => goal.month)
    .sort((a, b) => a.localeCompare(b))[0]

  if (!firstSourceMonth) return false

  let sourceMonth = firstSourceMonth
  let changed = false

  while (sourceMonth < targetMonthString) {
    const targetMonth = addMonths(sourceMonth, 1)
    const sourceGoals = data.monthlyGoals.filter(
      (goal) =>
        goal.month === sourceMonth &&
        goal.status !== 'done' &&
        Number(goal.progress ?? 0) < 100 &&
        !goal.rolledTo,
    )

    sourceGoals.forEach((goal) => {
      const sourceGoalId = goal.sourceGoalId || goal.id
      let targetGoal = data.monthlyGoals.find(
        (item) => item.month === targetMonth && (item.sourceGoalId || item.id) === sourceGoalId,
      )

      if (!targetGoal) {
        targetGoal = normalizeMonthlyGoal({
          ...goal,
          id: newId(),
          month: targetMonth,
          rolledFrom: sourceMonth,
          rolledTo: undefined,
          sourceGoalId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        data.monthlyGoals.push(targetGoal)
      }

      goal.rolledTo = targetMonth
      goal.updatedAt = new Date().toISOString()
      changed = true
    })

    sourceMonth = targetMonth
  }

  return changed
}

function getUpcomingTodos(data, dateString, days = UPCOMING_TODO_DAYS) {
  const startDate = addDays(dateString, 1)
  const endDate = addDays(dateString, days)

  return data.days
    .filter((day) => day.date >= startDate && day.date <= endDate)
    .map((day) => ({
      date: day.date,
      todos: day.todos
        .filter((todo) => !todo.done && !todo.postponedTo)
        .sort((a, b) => normalizeSortOrder(a.sortOrder) - normalizeSortOrder(b.sortOrder)),
    }))
    .filter((group) => group.todos.length)
    .sort((a, b) => a.date.localeCompare(b.date))
}

function cleanupCompletedTodosBefore(data, beforeDateString) {
  const now = new Date().toISOString()
  let changed = false

  data.days.forEach((day) => {
    if (day.date >= beforeDateString || !Array.isArray(day.todos)) return

    const completedTodos = day.todos.filter((todo) => todo.done)
    if (!completedTodos.length) return

    day.completedTodoArchive = Array.isArray(day.completedTodoArchive)
      ? day.completedTodoArchive
      : []
    completedTodos.forEach((todo) => {
      day.completedTodoArchive.push({ ...todo, archivedAt: now })
    })
    day.todos = day.todos.filter((todo) => !todo.done)
    day.updatedAt = now
    changed = true
  })

  return changed
}

function splitLines(value) {
  return cleanText(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function allTodosForReport(day) {
  const activeTodos = day.todos.map((todo) => ({
    ...todo,
    date: day.date,
  }))
  const archivedTodos = (day.completedTodoArchive ?? []).map((todo) => ({
    ...todo,
    done: true,
    date: day.date,
  }))

  return [...activeTodos, ...archivedTodos]
}

function summarizeDailyNotes(days) {
  return days
    .map((day) => ({
      date: day.date,
      focus: cleanText(day.focus),
      workSummary: cleanText(day.workSummary),
      wins: splitLines(day.wins),
      blockers: splitLines(day.blockers),
    }))
    .filter(
      (note) =>
        note.focus ||
        note.workSummary ||
        note.wins.length ||
        note.blockers.length,
    )
}

function makeOverview({ days, completedTodos, openTodos, goals }) {
  const activeDays = days.filter(
    (day) =>
      day.todos.length ||
      day.focus ||
      day.workSummary ||
      day.wins ||
      day.blockers,
  ).length
  const goalCount = goals.length
  const goalProgress = goalCount
    ? Math.round(
        goals.reduce((sum, goal) => sum + Number(goal.progress ?? 0), 0) / goalCount,
      )
    : 0

  return [
    `本周记录了 ${activeDays} 天工作内容，完成 ${completedTodos.length} 项待办，仍有 ${openTodos.length} 项待推进。`,
    goalCount
      ? `本月长期目标 ${goalCount} 项，平均进度约 ${goalProgress}%。`
      : '本周尚未登记本月长期目标。',
  ].join('')
}

function buildNextWeekFocus(openTodos, goals, blockers) {
  const focusItems = []

  openTodos.slice(0, 5).forEach((todo) => {
    focusItems.push(`继续推进：${todo.text}`)
  })

  goals
    .filter((goal) => goal.status !== 'done' && Number(goal.progress ?? 0) < 100)
    .slice(0, 3)
    .forEach((goal) => {
      focusItems.push(`目标跟进：${goal.title}`)
    })

  blockers.slice(0, 3).forEach((blocker) => {
    focusItems.push(`处理阻碍：${blocker}`)
  })

  return focusItems.length ? focusItems : ['保持每日计划、总结和长期目标更新。']
}

function getWeekRange(baseDateString) {
  const date = utcDate(baseDateString)
  const day = date.getUTCDay() || 7
  const monday = new Date(date.getTime())
  monday.setUTCDate(date.getUTCDate() - day + 1)
  const friday = new Date(monday.getTime())
  friday.setUTCDate(monday.getUTCDate() + 4)

  const start = formatDate(monday)
  const end = formatDate(friday)

  return {
    start,
    end,
    weekKey: `${start}_${end}`,
  }
}

function generateWeeklyReportInData(data, baseDateString = todayString(), options = {}) {
  const range = getWeekRange(baseDateString)
  const days = data.days
    .filter((day) => day.date >= range.start && day.date <= range.end)
    .sort((a, b) => a.date.localeCompare(b.date))
  const months = new Set([monthKey(range.start), monthKey(range.end)])
  const goals = data.monthlyGoals
    .filter((goal) => months.has(goal.month))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  const todos = days.flatMap((day) => allTodosForReport(day))
  const completedTodos = todos.filter((todo) => todo.done)
  const openTodos = todos.filter((todo) => !todo.done && !todo.postponedTo)
  const dailyNotes = summarizeDailyNotes(days)
  const blockers = dailyNotes.flatMap((note) => note.blockers)
  const wins = dailyNotes.flatMap((note) => note.wins)
  const generatedAt = new Date().toISOString()

  const report = normalizeReport({
    id: newId(),
    weekKey: range.weekKey,
    periodStart: range.start,
    periodEnd: range.end,
    generatedAt,
    sourceEntryDates: days.map((day) => day.date),
    autoGenerated: Boolean(options.autoGenerated),
    headline: `${range.start} 至 ${range.end} 周报`,
    overview: makeOverview({ days, completedTodos, openTodos, goals }),
    completedTodos: completedTodos.map((todo) => `${todo.date} ${todo.text}`),
    unfinishedTodos: openTodos.map((todo) => `${todo.date} ${todo.text}`),
    wins: wins.length ? wins : completedTodos.slice(0, 5).map((todo) => todo.text),
    dailyNotes,
    goalProgress: goals.map((goal) => ({
      title: goal.title,
      progress: Number(goal.progress ?? 0),
      status: goal.status,
      notes: goal.notes,
    })),
    blockers,
    nextWeekFocus: buildNextWeekFocus(openTodos, goals, blockers),
  })

  const existingIndex = data.weeklyReports.findIndex((item) => item.weekKey === range.weekKey)
  if (existingIndex >= 0) {
    report.id = data.weeklyReports[existingIndex].id
    data.weeklyReports[existingIndex] = report
  } else {
    data.weeklyReports.push(report)
  }

  if (options.autoGenerated) {
    data.settings.lastAutoRunWeekKey = range.weekKey
  }

  return report
}

function maybeGenerateDueReport(data) {
  const today = todayString()
  const parts = Object.fromEntries(
    shanghaiPartsFormatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  )
  const weekdayOrder = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  const weekday = weekdayOrder[parts.weekday] ?? 0
  const hour = Number(parts.hour)
  const minute = Number(parts.minute)
  const passedFridayCutoff = weekday > 5 || (weekday === 5 && (hour > 18 || (hour === 18 && minute >= 0)))

  if (!passedFridayCutoff) return null

  const range = getWeekRange(today)
  if (data.settings.lastAutoRunWeekKey === range.weekKey) return null

  return generateWeeklyReportInData(data, today, { autoGenerated: true })
}

function getAppState(dateString = todayString()) {
  const data = readPlanner()
  cleanupCompletedTodosBefore(data, todayString())
  autoPostponeOpenTodosInDataThroughDate(data, dateString)
  autoRollIncompleteMonthlyGoalsInDataThroughMonth(data, monthKey(dateString))
  maybeGenerateDueReport(data)

  const day = ensureDay(data, dateString)
  const month = monthKey(dateString)
  const reports = data.weeklyReports
    .slice()
    .sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)))

  writePlanner(data)

  return {
    today: todayString(),
    selectedDate: dateString,
    month,
    day,
    monthlyGoals: data.monthlyGoals
      .filter((goal) => goal.month === month)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    upcomingTodos: getUpcomingTodos(data, dateString),
    weeklyReports: reports,
    settings: data.settings,
  }
}

function updateDay(dateString, patch) {
  const data = readPlanner()
  const day = ensureDay(data, dateString)
  ;['focus', 'workSummary', 'wins', 'blockers'].forEach((key) => {
    if (Object.hasOwn(patch, key)) day[key] = cleanText(patch[key])
  })
  day.updatedAt = new Date().toISOString()
  writePlanner(data)
  return day
}

function addTodo(dateString, payload) {
  const data = readPlanner()
  const day = ensureDay(data, dateString)
  const todoText = typeof payload === 'string' ? payload : payload?.text
  const todo = normalizeTodo({
    id: newId(),
    text: cleanText(todoText),
    done: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    sortOrder: nextTodoSortOrder(day),
    ...normalizeTodoFields(typeof payload === 'object' ? payload : {}),
  })

  if (!todo.text) throw new Error('待办事项不能为空。')

  day.todos.push(todo)
  day.updatedAt = new Date().toISOString()
  writePlanner(data)
  return day
}

function updateTodo(dateString, todoId, patch) {
  const data = readPlanner()
  const day = ensureDay(data, dateString)
  const todo = day.todos.find((item) => item.id === todoId)
  const now = new Date().toISOString()

  if (!todo) throw new Error('未找到待办事项。')

  if (Object.hasOwn(patch, 'text')) {
    const text = cleanText(patch.text)
    if (!text) throw new Error('待办事项不能为空。')
    todo.text = text
  }

  if (
    Object.hasOwn(patch, 'priority') ||
    Object.hasOwn(patch, 'timeSlot') ||
    Object.hasOwn(patch, 'specificTime') ||
    Object.hasOwn(patch, 'notes')
  ) {
    Object.assign(todo, normalizeTodoFields({ ...todo, ...patch }))
  }

  if (Object.hasOwn(patch, 'done')) {
    todo.done = Boolean(patch.done)
    todo.completedAt = todo.done ? now : null
  }

  syncPostponedTargetTodo(data, dateString, todo, now)
  day.updatedAt = now
  writePlanner(data)
  return day
}

function deleteTodo(dateString, todoId) {
  const data = readPlanner()
  const day = ensureDay(data, dateString)
  day.todos = day.todos.filter((item) => item.id !== todoId)
  assignTodoSortOrders(day.todos)
  day.updatedAt = new Date().toISOString()
  writePlanner(data)
  return day
}

function reorderTodos(dateString, orderedTodoIds) {
  const data = readPlanner()
  const day = ensureDay(data, dateString)
  const orderedIds = [...new Set((orderedTodoIds ?? []).map((id) => cleanText(id)).filter(Boolean))]
  const todoById = new Map(day.todos.map((todo) => [todo.id, todo]))
  const orderedTodos = orderedIds.map((id) => todoById.get(id)).filter(Boolean)
  const orderedSet = new Set(orderedTodos.map((todo) => todo.id))
  const remainingTodos = day.todos
    .filter((todo) => !orderedSet.has(todo.id))
    .sort((a, b) => normalizeSortOrder(a.sortOrder) - normalizeSortOrder(b.sortOrder))

  day.todos = [...orderedTodos, ...remainingTodos]
  assignTodoSortOrders(day.todos)
  day.updatedAt = new Date().toISOString()
  writePlanner(data)
  return day
}

function postponeTodo(dateString, todoId) {
  const data = readPlanner()
  const day = ensureDay(data, dateString)
  const todo = day.todos.find((item) => item.id === todoId)

  if (!todo) throw new Error('未找到待办事项。')
  if (todo.done) throw new Error('已完成的待办不需要顺延。')

  const targetDate = addDays(dateString, 1)
  const targetDay = ensureDay(data, targetDate)
  const now = new Date().toISOString()
  const sourceTodoId = todoSourceId(todo)
  let postponedTodo = targetDay.todos.find((item) => todoSourceId(item) === sourceTodoId)

  if (!postponedTodo) {
    postponedTodo = createPostponedTodo(todo, dateString, {
      sortOrder: nextTodoSortOrder(targetDay),
    })
    targetDay.todos.push(postponedTodo)
  }

  todo.postponedTo = targetDate
  todo.postponedOutAt = now
  todo.postponedTargetTodoId = postponedTodo.id
  todo.autoPostponedOut = false
  todo.completedAt = null
  day.updatedAt = now
  targetDay.updatedAt = now
  writePlanner(data)

  return { day, targetDate, targetTodo: postponedTodo }
}

function cancelPostponeTodo(dateString, todoId) {
  const data = readPlanner()
  const day = ensureDay(data, dateString)
  const todo = day.todos.find((item) => item.id === todoId)

  if (!todo) throw new Error('未找到待办事项。')
  if (!todo.postponedTo) return { day, targetDate: null, removedTargetTodoId: null }

  const now = new Date().toISOString()
  const targetDate = todo.postponedTo
  const targetDay = data.days.find((item) => item.date === targetDate)
  const sourceTodoId = todoSourceId(todo)
  const targetTodoId = todo.postponedTargetTodoId
  let removedTargetTodoId = null

  if (targetDay?.todos?.length) {
    targetDay.todos = targetDay.todos.filter((item) => {
      const isTargetTodo = targetTodoId
        ? item.id === targetTodoId
        : todoSourceId(item) === sourceTodoId && item.postponedFrom === dateString

      if (isTargetTodo && !item.done) {
        removedTargetTodoId = item.id
        return false
      }

      return true
    })
    targetDay.updatedAt = now
  }

  delete todo.postponedTo
  delete todo.postponedOutAt
  delete todo.postponedTargetTodoId
  delete todo.autoPostponedOut
  if (!todo.postponedFrom) delete todo.postponedAt
  day.updatedAt = now
  writePlanner(data)

  return { day, targetDate, removedTargetTodoId }
}

function addMonthlyGoal(payload) {
  const data = readPlanner()
  const goal = normalizeMonthlyGoal({
    id: newId(),
    month: cleanText(payload.month),
    title: cleanText(payload.title),
    status: payload.status || 'active',
    progress: Number(payload.progress ?? 0),
    notes: cleanText(payload.notes),
    progressLogs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  if (!goal.title) throw new Error('长期目标不能为空。')

  data.monthlyGoals.push(goal)
  writePlanner(data)
  return goal
}

function updateMonthlyGoal(goalId, patch) {
  const data = readPlanner()
  const goal = data.monthlyGoals.find((item) => item.id === goalId)

  if (!goal) throw new Error('未找到长期目标。')

  if (Object.hasOwn(patch, 'title')) goal.title = cleanText(patch.title)
  if (Object.hasOwn(patch, 'notes')) goal.notes = cleanText(patch.notes)
  if (Object.hasOwn(patch, 'status')) goal.status = patch.status
  if (Object.hasOwn(patch, 'progress')) {
    goal.progress = Math.max(0, Math.min(100, Number(patch.progress) || 0))
  }
  goal.updatedAt = new Date().toISOString()

  writePlanner(data)
  return normalizeMonthlyGoal(goal)
}

function deleteMonthlyGoal(goalId) {
  const data = readPlanner()
  data.monthlyGoals = data.monthlyGoals.filter((item) => item.id !== goalId)
  writePlanner(data)
  return null
}

function upsertMonthlyGoalProgressLog(goalId, dateString, payload = {}) {
  const data = readPlanner()
  const goal = data.monthlyGoals.find((item) => item.id === goalId)

  if (!goal) throw new Error('未找到长期目标。')
  if (!DATE_PATTERN.test(dateString)) throw new Error('进展日期格式不正确。')

  const content = cleanText(payload.content)
  goal.progressLogs = Array.isArray(goal.progressLogs) ? goal.progressLogs : []

  if (!content) {
    goal.progressLogs = goal.progressLogs.filter((log) => log.date !== dateString)
    goal.updatedAt = new Date().toISOString()
    writePlanner(data)
    return normalizeMonthlyGoal(goal)
  }

  const now = new Date().toISOString()
  const existingLog = goal.progressLogs.find((log) => log.date === dateString)
  const progress = Math.max(0, Math.min(100, Number(goal.progress ?? 0) || 0))

  if (existingLog) {
    existingLog.content = content
    existingLog.progress = progress
    existingLog.updatedAt = now
    existingLog.createdAt = existingLog.createdAt || now
  } else {
    goal.progressLogs.push({
      date: dateString,
      content,
      progress,
      createdAt: now,
      updatedAt: now,
    })
  }

  goal.progressLogs.sort((a, b) => String(b.date).localeCompare(String(a.date)))
  goal.updatedAt = now
  writePlanner(data)
  return normalizeMonthlyGoal(goal)
}

function deleteMonthlyGoalProgressLog(goalId, dateString) {
  const data = readPlanner()
  const goal = data.monthlyGoals.find((item) => item.id === goalId)

  if (!goal) throw new Error('未找到长期目标。')
  if (!DATE_PATTERN.test(dateString)) throw new Error('进展日期格式不正确。')

  goal.progressLogs = Array.isArray(goal.progressLogs)
    ? goal.progressLogs.filter((log) => log.date !== dateString)
    : []
  goal.updatedAt = new Date().toISOString()
  writePlanner(data)
  return normalizeMonthlyGoal(goal)
}

function generateWeeklyReport(baseDateString) {
  const data = readPlanner()
  const report = generateWeeklyReportInData(data, baseDateString)
  writePlanner(data)
  return report
}

function parseJsonBody(options) {
  if (!options?.body) return {}
  return typeof options.body === 'string' ? JSON.parse(options.body) : options.body
}

function routeNotAvailable() {
  throw new Error('Lite 版不包含 AI、PDF 或后端服务功能。')
}

export async function localApi(path, options = {}) {
  const url = new URL(path, window.location.origin)
  const method = (options.method || 'GET').toUpperCase()
  const body = parseJsonBody(options)
  const segments = url.pathname.split('/').filter(Boolean)

  await Promise.resolve()

  if (method === 'GET' && url.pathname === '/api/app') {
    return getAppState(url.searchParams.get('date') || todayString())
  }

  if (segments[0] === 'api' && segments[1] === 'days') {
    const dateString = segments[2]

    if (segments.length === 3 && method === 'PUT') return updateDay(dateString, body)
    if (segments.length === 4 && segments[3] === 'todos' && method === 'POST') {
      return addTodo(dateString, body)
    }
    if (
      segments.length === 5 &&
      segments[3] === 'todos' &&
      segments[4] === 'order' &&
      method === 'PUT'
    ) {
      return reorderTodos(dateString, body.orderedTodoIds)
    }
    if (segments.length === 5 && segments[3] === 'todos') {
      if (method === 'PATCH') return updateTodo(dateString, segments[4], body)
      if (method === 'DELETE') return deleteTodo(dateString, segments[4])
    }
    if (segments.length === 6 && segments[3] === 'todos' && segments[5] === 'postpone') {
      return postponeTodo(dateString, segments[4])
    }
    if (
      segments.length === 7 &&
      segments[3] === 'todos' &&
      segments[5] === 'postpone' &&
      segments[6] === 'cancel'
    ) {
      return cancelPostponeTodo(dateString, segments[4])
    }

    return routeNotAvailable()
  }

  if (segments[0] === 'api' && segments[1] === 'monthly-goals') {
    if (segments.length === 2 && method === 'POST') return addMonthlyGoal(body)
    if (segments.length === 3 && method === 'PATCH') return updateMonthlyGoal(segments[2], body)
    if (segments.length === 3 && method === 'DELETE') return deleteMonthlyGoal(segments[2])
    if (segments.length === 5 && segments[3] === 'progress-logs' && method === 'PUT') {
      return upsertMonthlyGoalProgressLog(segments[2], segments[4], body)
    }
    if (segments.length === 5 && segments[3] === 'progress-logs' && method === 'DELETE') {
      return deleteMonthlyGoalProgressLog(segments[2], segments[4])
    }
  }

  if (url.pathname === '/api/reports/generate' && method === 'POST') {
    return generateWeeklyReport(body.date || todayString())
  }

  return routeNotAvailable()
}

export function exportPlannerData() {
  return normalizeData(readPlanner())
}

export function importPlannerData(rawData) {
  const data = normalizeData(rawData)
  writePlanner(data)
  return data
}

