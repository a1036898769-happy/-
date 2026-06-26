import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CornerDownRight,
  Copy,
  Download,
  FileText,
  GripVertical,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Target,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'
import './App.css'
import { exportPlannerData, importPlannerData, localApi } from './lib/localPlanner'

gsap.registerPlugin(useGSAP)

const ENABLE_AI_FEATURES = false
const ENABLE_PDF_EXPORT = false
const ENABLE_HISTORY_QA = false

function shanghaiDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function shanghaiTime() {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date())
}

function shanghaiWeekday(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    weekday: 'long',
  }).format(date)
}

function weekdayForDate(dateString) {
  return shanghaiWeekday(new Date(`${dateString}T00:00:00+08:00`))
}

function addDaysToDateString(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00+08:00`)
  date.setUTCDate(date.getUTCDate() + amount)

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function dateParts(dateString) {
  const date = new Date(`${dateString}T00:00:00+08:00`)

  return {
    day: new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      day: '2-digit',
    }).format(date),
    weekday: new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      weekday: 'short',
    }).format(date),
  }
}

function buildCalendarStrip(selectedDate, todayDate = shanghaiDate()) {
  const tomorrowDate = addDaysToDateString(todayDate, 1)

  return Array.from({ length: 10 }, (_, index) => {
    const date = addDaysToDateString(selectedDate, index)
    const parts = dateParts(date)

    return {
      date,
      day: parts.day,
      label: date === todayDate ? '今天' : date === tomorrowDate ? '明天' : parts.weekday,
      isSelected: date === selectedDate,
      isToday: date === todayDate,
    }
  })
}

async function api(path, options = {}) {
  return localApi(path, options)
}

function EmptyState({ icon: Icon, title }) {
  return (
    <div className="empty-state">
      <Icon size={20} aria-hidden="true" />
      <span>{title}</span>
    </div>
  )
}

const defaultTodoDraft = {
  text: '',
  priority: 'important_not_urgent',
  timeSlot: 'none',
  specificTime: '',
  targetDate: '',
}

const priorityLabels = {
  important_urgent: '重要且紧急',
  important_not_urgent: '重要不紧急',
  not_important_urgent: '不重要但紧急',
  not_important_not_urgent: '不重要不紧急',
  important: '重要且紧急',
  normal: '重要不紧急',
  low: '不重要不紧急',
}

const timeSlotLabels = {
  none: '无截止',
  morning: '上午截止',
  afternoon: '下午截止',
  evening: '今天结束前',
  specific: '截止时间',
}

const priorityOrder = {
  important_urgent: 0,
  not_important_urgent: 1,
  important_not_urgent: 2,
  not_important_not_urgent: 3,
  important: 0,
  normal: 2,
  low: 3,
}

const timeSlotOrder = {
  specific: 0,
  morning: 1,
  afternoon: 2,
  evening: 3,
  none: 4,
}

const suggestionActionLabels = {
  keep_today: '今天继续处理',
  postpone: '建议顺延',
  split: '建议拆分',
  lower_priority: '降低优先级',
  drop: '建议移除',
}

const todoNoteStatusLabels = {
  editing: '待保存',
  saving: '保存中...',
  saved: '已保存',
  error: '保存失败',
}

function goalLogKey(goalId, dateString) {
  return `${goalId}:${dateString}`
}

function goalLogForDate(goal, dateString) {
  return (goal.progressLogs ?? []).find((log) => log.date === dateString)
}

function sortedGoalProgressLogs(goal) {
  return [...(goal.progressLogs ?? [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

function todoDraftFromTodo(todo = {}) {
  const specificTime = todo.specificTime ?? ''

  return {
    text: todo.text ?? '',
    priority: todo.priority ?? defaultTodoDraft.priority,
    timeSlot: specificTime ? 'specific' : 'none',
    specificTime,
    targetDate: '',
  }
}

function todoTimeLabel(todo) {
  if (todo.timeSlot === 'specific' && todo.specificTime) {
    return `截止 ${todo.specificTime}`
  }

  return timeSlotLabels[todo.timeSlot] ?? timeSlotLabels.none
}

function serializeTodoDraft(draft) {
  const specificTime = String(draft.specificTime ?? '').trim()

  return {
    text: draft.text,
    priority: draft.priority,
    timeSlot: specificTime ? 'specific' : 'none',
    specificTime,
  }
}

function formatReportList(title, items, emptyText) {
  const values = items?.length ? items : [emptyText]
  return [`${title}：`, ...values.map((item) => `- ${item}`)].join('\n')
}

function formatReportForCopy(report) {
  if (report?.polishedContent?.trim()) {
    return report.polishedContent.trim()
  }

  return [
    report.headline,
    `生成时间：${new Date(report.generatedAt).toLocaleString('zh-CN')}`,
    `周期：${report.periodStart} 至 ${report.periodEnd}`,
    '',
    report.overview,
    '',
    formatReportList('完成事项', report.completedTodos, '本周暂无已完成待办'),
    '',
    formatReportList('未完成事项', report.unfinishedTodos, '本周暂无未完成待办'),
    '',
    formatReportList('关键产出', report.wins, '本周暂无关键产出'),
    '',
    formatReportList('阻碍风险', report.blockers, '本周暂无阻碍风险'),
    '',
    formatReportList('下周重点', report.nextWeekFocus, '保持每日计划、总结和长期目标更新。'),
  ].join('\n')
}

function writeClipboardTextFallback(text) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  const copied = document.execCommand('copy')
  textarea.remove()

  return copied
}

async function writeClipboardText(text) {
  if (writeClipboardTextFallback(text)) {
    return
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  throw new Error('copy failed')
}

function todoPriorityRank(todo = {}) {
  return (
    priorityOrder[todo.priority ?? defaultTodoDraft.priority] ??
    priorityOrder[defaultTodoDraft.priority]
  )
}

function isSamePriorityGroup(a, b) {
  return todoPriorityRank(a) === todoPriorityRank(b)
}

function compareTodos(a, b) {
  const priorityCompare = todoPriorityRank(a) - todoPriorityRank(b)
  if (priorityCompare) return priorityCompare

  const manualOrderCompare = Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
  if (manualOrderCompare) return manualOrderCompare

  const timeCompare =
    (timeSlotOrder[a.timeSlot ?? 'none'] ?? timeSlotOrder.none) -
    (timeSlotOrder[b.timeSlot ?? 'none'] ?? timeSlotOrder.none)

  if (timeCompare) return timeCompare

  const specificCompare = String(a.specificTime ?? '').localeCompare(String(b.specificTime ?? ''))
  if (specificCompare) return specificCompare

  return String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))
}

function TodoDraftFields({ draft, onChange, placeholder, showTargetDate = false }) {
  function updateField(field, value) {
    onChange((current) => {
      return { ...current, [field]: value }
    })
  }

  function updateDeadlineTime(value) {
    onChange((current) => ({
      ...current,
      timeSlot: value ? 'specific' : 'none',
      specificTime: value,
    }))
  }

  return (
    <>
      <label>
        <span>待办内容</span>
        <input
          type="text"
          value={draft.text}
          onChange={(event) => updateField('text', event.target.value)}
          placeholder={placeholder}
          autoFocus
        />
      </label>
      <div className="todo-form-grid">
        {showTargetDate ? (
          <label>
            <span>执行日期</span>
            <input
              type="date"
              value={draft.targetDate}
              onChange={(event) => updateField('targetDate', event.target.value)}
            />
          </label>
        ) : null}
        <label>
          <span>优先级</span>
          <select
            value={draft.priority}
            onChange={(event) => updateField('priority', event.target.value)}
          >
            <option value="important_urgent">重要且紧急</option>
            <option value="not_important_urgent">不重要但紧急</option>
            <option value="important_not_urgent">重要不紧急</option>
            <option value="not_important_not_urgent">不重要不紧急</option>
          </select>
        </label>
        <label>
          <span>截止时间（24小时制）</span>
          <input
            type="time"
            step="60"
            value={draft.specificTime}
            onChange={(event) => updateDeadlineTime(event.target.value)}
          />
        </label>
      </div>
    </>
  )
}

function App() {
  const appRootRef = useRef(null)
  const [selectedDate, setSelectedDate] = useState(shanghaiDate())
  const [currentTime, setCurrentTime] = useState(shanghaiTime())
  const [currentWeekday, setCurrentWeekday] = useState(shanghaiWeekday())
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeAddDialog, setActiveAddDialog] = useState(null)
  const [todoDraft, setTodoDraft] = useState(defaultTodoDraft)
  const [editingTodo, setEditingTodo] = useState(null)
  const [editTodoDraft, setEditTodoDraft] = useState(defaultTodoDraft)
  const [openTodoMenuId, setOpenTodoMenuId] = useState(null)
  const [expandedTodoNoteIds, setExpandedTodoNoteIds] = useState(() => new Set())
  const [todoNoteDrafts, setTodoNoteDrafts] = useState({})
  const [todoNoteSaveState, setTodoNoteSaveState] = useState({})
  const [draggedTodoId, setDraggedTodoId] = useState(null)
  const [summaryDraftLoading, setSummaryDraftLoading] = useState(false)
  const [postponeSuggestionLoading, setPostponeSuggestionLoading] = useState(false)
  const [postponeSuggestionResult, setPostponeSuggestionResult] = useState(null)
  const [postponeSuggestionCollapsed, setPostponeSuggestionCollapsed] = useState(false)
  const [knowledgeSuggestionLoading, setKnowledgeSuggestionLoading] = useState(false)
  const [knowledgeSuggestionResult, setKnowledgeSuggestionResult] = useState(null)
  const [knowledgeSuggestionCollapsed, setKnowledgeSuggestionCollapsed] = useState(false)
  const [historyQuestion, setHistoryQuestion] = useState('')
  const [historyAnswer, setHistoryAnswer] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [copyFallbackText, setCopyFallbackText] = useState('')
  const [monthExpanded, setMonthExpanded] = useState(true)
  const [upcomingExpanded, setUpcomingExpanded] = useState(true)
  const [expandedGoalLogIds, setExpandedGoalLogIds] = useState(() => new Set())
  const [goalLogDrafts, setGoalLogDrafts] = useState({})
  const [goalLogSaveState, setGoalLogSaveState] = useState({})
  const [goalDraft, setGoalDraft] = useState({ title: '', notes: '' })
  const [dayDraft, setDayDraft] = useState({
    focus: '',
    workSummary: '',
    wins: '',
    blockers: '',
  })
  const todoNoteSaveTimers = useRef(new Map())
  const todoNoteSaveTokens = useRef(new Map())
  const goalLogSaveTimers = useRef(new Map())
  const goalLogSaveTokens = useRef(new Map())
  const importFileInputRef = useRef(null)
  const hasPlayedIntro = useRef(false)

  const day = state?.day
  const completedCount = day?.todos.filter((todo) => todo.done).length ?? 0
  const totalCount = day?.todos.length ?? 0
  const visibleTodos = [...(day?.todos ?? [])].sort(compareTodos)
  const upcomingTodoGroups = state?.upcomingTodos ?? []
  const upcomingTodoCount = upcomingTodoGroups.reduce(
    (sum, group) => sum + (group.todos?.length ?? 0),
    0,
  )
  const monthlyGoalCount = state?.monthlyGoals.length ?? 0
  const monthlyGoalProgress = monthlyGoalCount
    ? Math.round(
        state.monthlyGoals.reduce((sum, goal) => sum + Number(goal.progress ?? 0), 0) /
          monthlyGoalCount,
      )
    : 0
  const latestReport = state?.weeklyReports[0]
  const todayDate = shanghaiDate()
  const calendarStripDays = buildCalendarStrip(selectedDate, todayDate)
  const openTodoCount = Math.max(totalCount - completedCount, 0)
  const timedTodoCount = visibleTodos.filter(
    (todo) => !todo.done && todo.timeSlot && todo.timeSlot !== 'none',
  ).length
  const todayFocusText = day?.focus?.trim() || `聚焦 ${openTodoCount || totalCount || 0} 个核心任务`

  useGSAP(
    () => {
      if (!state || hasPlayedIntro.current) {
        return undefined
      }

      hasPlayedIntro.current = true
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const timeline = gsap.timeline({
          defaults: { ease: 'power2.out' },
        })

        timeline
          .from('.topbar', { autoAlpha: 0, y: -10, duration: 0.32 })
          .from('.calendar-strip', { autoAlpha: 0, y: 12, duration: 0.32 }, '-=0.12')
          .from('.primary-todo-panel', { autoAlpha: 0, y: 16, duration: 0.38 }, '-=0.12')
          .from(
            '.monthly-plan, .summary-panel, .report-panel',
            { autoAlpha: 0, y: 14, duration: 0.34, stagger: 0.05 },
            '-=0.16',
          )
          .from(
            '.todo-row',
            { autoAlpha: 0, y: 8, duration: 0.22, stagger: 0.025 },
            '-=0.22',
          )

        return () => timeline.kill()
      })

      return () => mm.revert()
    },
    { dependencies: [Boolean(state)], scope: appRootRef },
  )

  useGSAP(
    () => {
      if (!activeAddDialog && !copyFallbackText) {
        return undefined
      }

      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const timeline = gsap.timeline({
          defaults: { ease: 'power2.out' },
        })

        timeline
          .from('.modal-backdrop', { autoAlpha: 0, duration: 0.14 })
          .from('.modal-panel', { autoAlpha: 0, y: 12, scale: 0.985, duration: 0.2 }, '-=0.06')

        return () => timeline.kill()
      })

      return () => mm.revert()
    },
    { dependencies: [activeAddDialog, copyFallbackText], scope: appRootRef },
  )

  const applyLoadedState = useCallback((payload) => {
    const loadedDate = payload.selectedDate ?? selectedDate

    setState(payload)
    setPostponeSuggestionResult(null)
    setKnowledgeSuggestionResult(null)
    setExpandedTodoNoteIds(new Set())
    setExpandedGoalLogIds(new Set())
    setTodoNoteDrafts(
      Object.fromEntries((payload.day.todos ?? []).map((todo) => [todo.id, todo.notes ?? ''])),
    )
    setTodoNoteSaveState({})
    setGoalLogDrafts(
      Object.fromEntries(
        (payload.monthlyGoals ?? []).map((goal) => [
          goal.id,
          goalLogForDate(goal, loadedDate)?.content ?? '',
        ]),
      ),
    )
    setGoalLogSaveState({})
    setDayDraft({
      focus: payload.day.focus ?? '',
      workSummary: payload.day.workSummary ?? '',
      wins: payload.day.wins ?? '',
      blockers: payload.day.blockers ?? '',
    })
  }, [selectedDate])

  async function load(date = selectedDate) {
    setLoading(true)
    setError('')
    try {
      const payload = await api(`/api/app?date=${date}`)
      applyLoadedState(payload)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false

    async function fetchSelectedDate() {
      try {
        const payload = await api(`/api/app?date=${selectedDate}`)
        if (!ignore) {
          applyLoadedState(payload)
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message)
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    fetchSelectedDate()

    return () => {
      ignore = true
    }
  }, [applyLoadedState, selectedDate])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(shanghaiTime())
      setCurrentWeekday(shanghaiWeekday())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timers = todoNoteSaveTimers.current

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    }
  }, [])

  async function saveDay() {
    setSaving(true)
    setError('')
    try {
      const updatedDay = await api(`/api/days/${selectedDate}`, {
        method: 'PUT',
        body: JSON.stringify(dayDraft),
      })
      setState((current) => ({ ...current, day: updatedDay }))
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  function importCompletedTodosToWins() {
    const completedTexts = [
      ...new Set(
        (day?.todos ?? [])
          .filter((todo) => todo.done)
          .map((todo) => todo.text.trim())
          .filter(Boolean),
      ),
    ]

    if (!completedTexts.length) return

    setDayDraft((current) => {
      const existingLines = current.wins
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
      const existing = new Set(existingLines)
      const additions = completedTexts.filter((text) => !existing.has(text))

      if (!additions.length) return current

      return {
        ...current,
        wins: [...existingLines, ...additions].join('\n'),
      }
    })
  }

  async function generateSummaryDraft() {
    setSummaryDraftLoading(true)
    setError('')
    try {
      const result = await api(`/api/days/${selectedDate}/summary/draft`, {
        method: 'POST',
        body: JSON.stringify({ currentDraft: dayDraft }),
      })
      setDayDraft(result.draft)
    } catch (draftError) {
      setError(draftError.message)
    } finally {
      setSummaryDraftLoading(false)
    }
  }

  function toggleTodoNote(todoId) {
    setExpandedTodoNoteIds((current) => {
      const next = new Set(current)

      if (next.has(todoId)) {
        next.delete(todoId)
      } else {
        next.add(todoId)
      }

      return next
    })
  }

  function setTodoNoteStatus(todoId, status) {
    setTodoNoteSaveState((current) => {
      if (!status) {
        const next = { ...current }
        delete next[todoId]
        return next
      }

      return { ...current, [todoId]: status }
    })
  }

  async function saveTodoNote(todo, notes) {
    const normalizedNotes = String(notes ?? '')

    if (normalizedNotes === (todo.notes ?? '')) {
      setTodoNoteStatus(todo.id, '')
      return
    }

    const token = (todoNoteSaveTokens.current.get(todo.id) ?? 0) + 1
    todoNoteSaveTokens.current.set(todo.id, token)
    setTodoNoteStatus(todo.id, 'saving')

    try {
      const updatedDay = await api(`/api/days/${selectedDate}/todos/${todo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: normalizedNotes }),
      })
      const updatedTodo = updatedDay.todos.find((item) => item.id === todo.id)

      if (todoNoteSaveTokens.current.get(todo.id) !== token) {
        return
      }

      setState((current) =>
        current?.selectedDate === selectedDate ? { ...current, day: updatedDay } : current,
      )
      setTodoNoteDrafts((current) => ({
        ...current,
        [todo.id]: updatedTodo?.notes ?? normalizedNotes,
      }))
      setTodoNoteStatus(todo.id, 'saved')
    } catch (noteError) {
      if (todoNoteSaveTokens.current.get(todo.id) === token) {
        setTodoNoteStatus(todo.id, 'error')
        setError(noteError.message)
      }
    }
  }

  function scheduleTodoNoteSave(todo, notes) {
    const existingTimer = todoNoteSaveTimers.current.get(todo.id)
    if (existingTimer) window.clearTimeout(existingTimer)

    setTodoNoteDrafts((current) => ({ ...current, [todo.id]: notes }))
    setTodoNoteStatus(todo.id, 'editing')
    todoNoteSaveTimers.current.set(
      todo.id,
      window.setTimeout(() => {
        todoNoteSaveTimers.current.delete(todo.id)
        saveTodoNote(todo, notes)
      }, 750),
    )
  }

  function flushTodoNoteSave(todo) {
    const existingTimer = todoNoteSaveTimers.current.get(todo.id)
    if (existingTimer) {
      window.clearTimeout(existingTimer)
      todoNoteSaveTimers.current.delete(todo.id)
    }

    saveTodoNote(todo, todoNoteDrafts[todo.id] ?? todo.notes ?? '')
  }

  function toggleGoalLog(goalId) {
    setExpandedGoalLogIds((current) => {
      const next = new Set(current)

      if (next.has(goalId)) {
        next.delete(goalId)
      } else {
        next.add(goalId)
      }

      return next
    })
  }

  function setGoalLogStatus(goalId, status) {
    setGoalLogSaveState((current) => {
      if (!status) {
        const next = { ...current }
        delete next[goalId]
        return next
      }

      return { ...current, [goalId]: status }
    })
  }

  async function saveGoalProgressLog(goal, content, dateString = selectedDate) {
    const normalizedContent = String(content ?? '').trim()
    const currentLog = goalLogForDate(goal, dateString)
    const timerKey = goalLogKey(goal.id, dateString)

    if (normalizedContent === (currentLog?.content ?? '')) {
      setGoalLogStatus(goal.id, '')
      return
    }

    const token = (goalLogSaveTokens.current.get(timerKey) ?? 0) + 1
    goalLogSaveTokens.current.set(timerKey, token)
    setGoalLogStatus(goal.id, 'saving')

    try {
      const updatedGoal = normalizedContent
        ? await api(`/api/monthly-goals/${goal.id}/progress-logs/${dateString}`, {
            method: 'PUT',
            body: JSON.stringify({ content: normalizedContent }),
          })
        : await api(`/api/monthly-goals/${goal.id}/progress-logs/${dateString}`, {
            method: 'DELETE',
          })

      if (goalLogSaveTokens.current.get(timerKey) !== token) {
        return
      }

      setState((current) =>
        current
          ? {
              ...current,
              monthlyGoals: current.monthlyGoals.map((item) =>
                item.id === goal.id ? updatedGoal : item,
              ),
            }
          : current,
      )
      setGoalLogDrafts((current) => ({
        ...current,
        [goal.id]: goalLogForDate(updatedGoal, dateString)?.content ?? '',
      }))
      setGoalLogStatus(goal.id, 'saved')
    } catch (logError) {
      if (goalLogSaveTokens.current.get(timerKey) === token) {
        setGoalLogStatus(goal.id, 'error')
        setError(logError.message)
      }
    }
  }

  function scheduleGoalLogSave(goal, content) {
    const timerKey = goalLogKey(goal.id, selectedDate)
    const existingTimer = goalLogSaveTimers.current.get(timerKey)
    if (existingTimer) window.clearTimeout(existingTimer)

    setGoalLogDrafts((current) => ({ ...current, [goal.id]: content }))
    setGoalLogStatus(goal.id, 'editing')
    goalLogSaveTimers.current.set(
      timerKey,
      window.setTimeout(() => {
        goalLogSaveTimers.current.delete(timerKey)
        saveGoalProgressLog(goal, content, selectedDate)
      }, 750),
    )
  }

  function flushGoalLogSave(goal) {
    const timerKey = goalLogKey(goal.id, selectedDate)
    const existingTimer = goalLogSaveTimers.current.get(timerKey)
    if (existingTimer) {
      window.clearTimeout(existingTimer)
      goalLogSaveTimers.current.delete(timerKey)
    }

    saveGoalProgressLog(goal, goalLogDrafts[goal.id] ?? goalLogForDate(goal, selectedDate)?.content ?? '')
  }

  async function addTodo(event) {
    event.preventDefault()
    if (!todoDraft.text.trim()) return

    const targetDate = todoDraft.targetDate || selectedDate
    setSaving(true)
    setError('')
    try {
      const updatedDay = await api(`/api/days/${targetDate}/todos`, {
        method: 'POST',
        body: JSON.stringify(serializeTodoDraft(todoDraft)),
      })

      if (targetDate === selectedDate) {
        setState((current) => ({ ...current, day: updatedDay }))
      } else {
        await load(selectedDate)
      }

      closeAddDialog()
    } catch (todoError) {
      setError(todoError.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleTodo(todo) {
    setOpenTodoMenuId(null)
    const updatedDay = await api(`/api/days/${selectedDate}/todos/${todo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ done: !todo.done }),
    })
    setState((current) => ({ ...current, day: updatedDay }))
  }

  async function removeTodo(todo) {
    setOpenTodoMenuId(null)
    const updatedDay = await api(`/api/days/${selectedDate}/todos/${todo.id}`, {
      method: 'DELETE',
    })
    setState((current) => ({ ...current, day: updatedDay }))
  }

  async function saveTodoOrder(orderedTodos) {
    const orderedTodoIds = orderedTodos.map((todo) => todo.id)

    setOpenTodoMenuId(null)
    setError('')
    setState((current) =>
      current
        ? {
            ...current,
            day: {
              ...current.day,
              todos: current.day.todos.map((todo) => {
                const nextIndex = orderedTodoIds.indexOf(todo.id)
                return nextIndex >= 0 ? { ...todo, sortOrder: nextIndex } : todo
              }),
            },
          }
        : current,
    )

    try {
      const updatedDay = await api(`/api/days/${selectedDate}/todos/order`, {
        method: 'PUT',
        body: JSON.stringify({ orderedTodoIds }),
      })
      setState((current) => ({ ...current, day: updatedDay }))
    } catch (orderError) {
      setError(orderError.message)
      load()
    }
  }

  function moveTodo(todoId, direction) {
    const currentIndex = visibleTodos.findIndex((todo) => todo.id === todoId)
    const targetIndex = currentIndex + direction

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= visibleTodos.length) {
      return
    }

    if (!isSamePriorityGroup(visibleTodos[currentIndex], visibleTodos[targetIndex])) {
      return
    }

    const nextTodos = [...visibleTodos]
    const [movedTodo] = nextTodos.splice(currentIndex, 1)
    nextTodos.splice(targetIndex, 0, movedTodo)
    saveTodoOrder(nextTodos)
  }

  function dropTodoOnTarget(targetTodoId) {
    if (!draggedTodoId || draggedTodoId === targetTodoId) {
      setDraggedTodoId(null)
      return
    }

    const sourceIndex = visibleTodos.findIndex((todo) => todo.id === draggedTodoId)
    const targetIndex = visibleTodos.findIndex((todo) => todo.id === targetTodoId)

    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggedTodoId(null)
      return
    }

    if (!isSamePriorityGroup(visibleTodos[sourceIndex], visibleTodos[targetIndex])) {
      setDraggedTodoId(null)
      return
    }

    const nextTodos = [...visibleTodos]
    const [movedTodo] = nextTodos.splice(sourceIndex, 1)
    nextTodos.splice(targetIndex, 0, movedTodo)
    setDraggedTodoId(null)
    saveTodoOrder(nextTodos)
  }

  async function editTodo(event) {
    event.preventDefault()
    if (!editingTodo || !editTodoDraft.text.trim()) return

    setSaving(true)
    setError('')
    try {
      const updatedDay = await api(`/api/days/${selectedDate}/todos/${editingTodo.id}`, {
        method: 'PATCH',
        body: JSON.stringify(serializeTodoDraft(editTodoDraft)),
      })
      setState((current) => ({ ...current, day: updatedDay }))
      closeAddDialog()
    } catch (editError) {
      setError(editError.message)
    } finally {
      setSaving(false)
    }
  }

  async function postponeTodo(todo) {
    setSaving(true)
    setError('')
    setOpenTodoMenuId(null)
    try {
      const result = await api(`/api/days/${selectedDate}/todos/${todo.id}/postpone`, {
        method: 'POST',
      })
      setState((current) => ({ ...current, day: result.day }))
    } catch (postponeError) {
      setError(postponeError.message)
    } finally {
      setSaving(false)
    }
  }

  async function cancelPostponeTodo(todo) {
    setSaving(true)
    setError('')
    setOpenTodoMenuId(null)
    try {
      const result = await api(`/api/days/${selectedDate}/todos/${todo.id}/postpone/cancel`, {
        method: 'POST',
      })
      setState((current) => ({ ...current, day: result.day }))
    } catch (cancelError) {
      setError(cancelError.message)
    } finally {
      setSaving(false)
    }
  }

  async function generatePostponeSuggestions() {
    setPostponeSuggestionLoading(true)
    setError('')
    try {
      const result = await api(`/api/days/${selectedDate}/todos/postpone-suggestions`, {
        method: 'POST',
      })
      setPostponeSuggestionResult(result)
      setPostponeSuggestionCollapsed(false)
    } catch (suggestionError) {
      setError(suggestionError.message)
    } finally {
      setPostponeSuggestionLoading(false)
    }
  }

  async function applyAllPostponeSuggestions() {
    const suggestions = postponeSuggestionResult?.suggestions ?? []
    if (!suggestions.length) return

    setSaving(true)
    setError('')
    try {
      let currentDay = day

      for (const suggestion of suggestions) {
        const relatedTodo = currentDay?.todos.find((todo) => todo.id === suggestion.todoId)

        if (!relatedTodo) continue

        if (suggestion.action === 'postpone' && !relatedTodo.done && !relatedTodo.postponedTo) {
          const result = await api(`/api/days/${selectedDate}/todos/${relatedTodo.id}/postpone`, {
            method: 'POST',
          })
          currentDay = result.day
          continue
        }

        if (suggestion.action === 'lower_priority' && suggestion.suggestedPriority) {
          currentDay = await api(`/api/days/${selectedDate}/todos/${relatedTodo.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ priority: suggestion.suggestedPriority }),
          })
          continue
        }

        if (suggestion.action === 'split' && suggestion.suggestedTasks.length) {
          for (const task of suggestion.suggestedTasks) {
            currentDay = await api(`/api/days/${selectedDate}/todos`, {
              method: 'POST',
              body: JSON.stringify({
                text: task,
                priority: suggestion.suggestedPriority || relatedTodo.priority,
                timeSlot: relatedTodo.timeSlot ?? 'none',
                specificTime: relatedTodo.specificTime ?? '',
              }),
            })
          }
          continue
        }

        if (suggestion.action === 'drop') {
          continue
        }
      }

      if (currentDay) {
        setState((current) => ({ ...current, day: currentDay }))
      }
      setPostponeSuggestionResult(null)
    } catch (applyError) {
      setError(applyError.message)
      load()
    } finally {
      setSaving(false)
    }
  }

  function ignoreAllPostponeSuggestions() {
    setPostponeSuggestionResult(null)
    setPostponeSuggestionCollapsed(false)
  }

  async function generateKnowledgeSuggestions() {
    setKnowledgeSuggestionLoading(true)
    setError('')
    try {
      const result = await api(`/api/days/${selectedDate}/todos/knowledge-suggestions`, {
        method: 'POST',
      })
      setKnowledgeSuggestionResult(result)
      setKnowledgeSuggestionCollapsed(false)
    } catch (suggestionError) {
      setError(suggestionError.message)
    } finally {
      setKnowledgeSuggestionLoading(false)
    }
  }

  async function applySuggestedPriority(suggestion) {
    if (!suggestion?.suggestedPriority) return

    setSaving(true)
    setError('')
    try {
      const updatedDay = await api(`/api/days/${selectedDate}/todos/${suggestion.todoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ priority: suggestion.suggestedPriority }),
      })
      setState((current) => ({ ...current, day: updatedDay }))
    } catch (priorityError) {
      setError(priorityError.message)
    } finally {
      setSaving(false)
    }
  }

  async function askWorkHistory(event) {
    event.preventDefault()
    if (!historyQuestion.trim()) return

    setHistoryLoading(true)
    setError('')
    try {
      const result = await api('/api/assistant/work-history', {
        method: 'POST',
        body: JSON.stringify({ question: historyQuestion, date: selectedDate }),
      })
      setHistoryAnswer(result)
    } catch (historyError) {
      setError(historyError.message)
    } finally {
      setHistoryLoading(false)
    }
  }

  async function addGoal(event) {
    event.preventDefault()
    if (!goalDraft.title.trim()) return

    setSaving(true)
    setError('')
    try {
      const goal = await api('/api/monthly-goals', {
        method: 'POST',
        body: JSON.stringify({
          month: state.month,
          title: goalDraft.title,
          notes: goalDraft.notes,
          progress: 0,
          status: 'active',
        }),
      })
      setState((current) => ({
        ...current,
        monthlyGoals: [...current.monthlyGoals, goal],
      }))
      closeAddDialog()
    } catch (goalError) {
      setError(goalError.message)
    } finally {
      setSaving(false)
    }
  }

  async function updateGoal(goal, patch) {
    const updatedGoal = await api(`/api/monthly-goals/${goal.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    setState((current) => ({
      ...current,
      monthlyGoals: current.monthlyGoals.map((item) =>
        item.id === goal.id ? updatedGoal : item,
      ),
    }))
  }

  async function removeGoal(goal) {
    await api(`/api/monthly-goals/${goal.id}`, { method: 'DELETE' })
    setState((current) => ({
      ...current,
      monthlyGoals: current.monthlyGoals.filter((item) => item.id !== goal.id),
    }))
  }

  async function generateReport() {
    setSaving(true)
    setError('')
    try {
      await saveDay()
      const report = await api('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate }),
      })
      setState((current) => ({
        ...current,
        weeklyReports: [
          report,
          ...current.weeklyReports.filter((item) => item.weekKey !== report.weekKey),
        ],
      }))
    } catch (reportError) {
      setError(reportError.message)
    } finally {
      setSaving(false)
    }
  }

  async function copyReport(report) {
    if (!report) return

    const reportText = formatReportForCopy(report)
    setError('')
    setCopyFallbackText('')
    try {
      await writeClipboardText(reportText)
    } catch {
      setCopyFallbackText(reportText)
      setError('自动复制被浏览器拦截，已打开周报文本。')
    }
  }

  async function polishReport(report) {
    if (!report) return

    setSaving(true)
    setError('')
    try {
      const updatedReport = await api(`/api/reports/${report.id}/polish`, {
        method: 'POST',
      })
      setState((current) =>
        current
          ? {
              ...current,
              weeklyReports: [
                updatedReport,
                ...current.weeklyReports.filter((item) => item.id !== updatedReport.id),
              ],
            }
          : current,
      )
    } catch (polishError) {
      setError(polishError.message)
    } finally {
      setSaving(false)
    }
  }

  function exportBackup() {
    const data = exportPlannerData()
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `daily-plan-lite-backup-${shanghaiDate()}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function importBackup(event) {
    const file = event.target.files?.[0]

    if (!file) return

    setSaving(true)
    setError('')

    try {
      const text = await file.text()
      importPlannerData(JSON.parse(text))
      await load(selectedDate)
    } catch (importError) {
      setError(`导入失败：${importError.message}`)
    } finally {
      setSaving(false)
      event.target.value = ''
    }
  }

  function openAddDialog(type) {
    if (type === 'todo') {
      setTodoDraft({ ...defaultTodoDraft, targetDate: selectedDate })
    }

    if (type === 'goal') {
      setGoalDraft({ title: '', notes: '' })
    }

    setEditingTodo(null)
    setEditTodoDraft({ ...defaultTodoDraft })
    setOpenTodoMenuId(null)
    setActiveAddDialog(type)
  }

  function openEditTodoDialog(todo) {
    setEditingTodo(todo)
    setEditTodoDraft(todoDraftFromTodo(todo))
    setOpenTodoMenuId(null)
    setActiveAddDialog('editTodo')
  }

  function closeAddDialog() {
    setActiveAddDialog(null)
    setTodoDraft({ ...defaultTodoDraft })
    setEditingTodo(null)
    setEditTodoDraft({ ...defaultTodoDraft })
    setGoalDraft({ title: '', notes: '' })
  }

  if (loading && !state) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" aria-hidden="true" />
        <span>正在读取每日计划...</span>
      </main>
    )
  }

  return (
    <div className="app-root" ref={appRootRef}>
      <main className="app-shell">
      <header className="topbar">
        <div className="brand-title">
          <span className="brand-mark">
            <ListChecks size={22} aria-hidden="true" />
          </span>
          <div>
            <h1>个人工作看板</h1>
            <p>每日计划 · 月度目标 · 周报</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => setSelectedDate(addDaysToDateString(selectedDate, -1))}
            title="前一天"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <label className="date-control">
            <CalendarDays size={18} aria-hidden="true" />
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
            <span className="selected-weekday">{weekdayForDate(selectedDate)}</span>
          </label>
          <button
            type="button"
            className="icon-button"
            onClick={() => setSelectedDate(addDaysToDateString(selectedDate, 1))}
            title="后一天"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" onClick={() => load()} title="刷新">
            <RefreshCw size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="today-button"
            onClick={() => setSelectedDate(todayDate)}
            disabled={selectedDate === todayDate}
            title="返回今天"
          >
            今天
          </button>
          <button
            type="button"
            className="ghost-button backup-button"
            onClick={exportBackup}
            title="导出本机数据备份"
          >
            <Download size={17} aria-hidden="true" />
            导出
          </button>
          <button
            type="button"
            className="ghost-button backup-button"
            onClick={() => importFileInputRef.current?.click()}
            disabled={saving}
            title="导入本机数据备份"
          >
            <Upload size={17} aria-hidden="true" />
            导入
          </button>
          <input
            ref={importFileInputRef}
            className="backup-input"
            type="file"
            accept="application/json,.json"
            onChange={importBackup}
          />
        </div>
        <div className="live-clock" aria-label="北京时间">
          <span>北京时间</span>
          <div className="clock-main">
            <strong>{currentTime}</strong>
            <em>{currentWeekday}</em>
          </div>
        </div>
      </header>

      <section className="calendar-strip" aria-label="日期导航">
        <div className="calendar-days">
          {calendarStripDays.map((item) => (
            <button
              type="button"
              className={`calendar-day ${item.isSelected ? 'is-selected' : ''} ${
                item.isToday ? 'is-today' : ''
              }`}
              key={item.date}
              onClick={() => setSelectedDate(item.date)}
            >
              <strong>{item.day}</strong>
              <span>{item.label}</span>
              <em aria-hidden="true" />
            </button>
          ))}
        </div>
        <aside className="focus-card" aria-label="今日焦点">
          <div>
            <Sparkles size={16} aria-hidden="true" />
            <strong>今日焦点</strong>
          </div>
          <p>{todayFocusText}</p>
          <span>
            未完成 {openTodoCount} 项 · 定时 {timedTodoCount} 项
          </span>
        </aside>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="panel todo-panel primary-todo-panel">
        <div className="panel-heading">
          <div>
            <ListChecks size={20} aria-hidden="true" />
            <h2>今日待办事项</h2>
          </div>
          <div className="section-actions">
            <span>{completedCount}/{totalCount}</span>
            {ENABLE_AI_FEATURES ? (
              <>
                <button
                  type="button"
                  className="ghost-button ai-button"
                  onClick={generatePostponeSuggestions}
                  disabled={postponeSuggestionLoading || saving}
                >
                  {postponeSuggestionLoading ? (
                    <Loader2 className="spin" size={17} aria-hidden="true" />
                  ) : (
                    <Lightbulb size={17} aria-hidden="true" />
                  )}
                  AI 顺延建议
                </button>
                <button
                  type="button"
                  className="ghost-button ai-button"
                  onClick={generateKnowledgeSuggestions}
                  disabled={knowledgeSuggestionLoading || saving}
                >
                  {knowledgeSuggestionLoading ? (
                    <Loader2 className="spin" size={17} aria-hidden="true" />
                  ) : (
                    <NotebookPen size={17} aria-hidden="true" />
                  )}
                  AI SOP/Skill
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="primary-button"
              onClick={() => openAddDialog('todo')}
            >
              <Plus size={17} aria-hidden="true" />
              添加
            </button>
          </div>
        </div>

        <div className="todo-list">
          {visibleTodos.length ? (
            visibleTodos.map((todo, index) => {
              const noteOpen = expandedTodoNoteIds.has(todo.id)
              const noteDraft = todoNoteDrafts[todo.id] ?? todo.notes ?? ''
              const noteStatus = todoNoteSaveState[todo.id]
              const previousTodo = visibleTodos[index - 1]
              const nextTodo = visibleTodos[index + 1]
              const canMoveUp = Boolean(previousTodo && isSamePriorityGroup(todo, previousTodo))
              const canMoveDown = Boolean(nextTodo && isSamePriorityGroup(todo, nextTodo))

              return (
                <div
                  className={`todo-row ${todo.done ? 'is-done' : ''} ${
                    todo.postponedFrom ? 'is-postponed' : ''
                  } ${
                    todo.postponedTo ? 'is-postponed-out' : ''
                  } priority-row-${
                    todo.priority ?? defaultTodoDraft.priority
                  } ${
                    todo.timeSlot && todo.timeSlot !== 'none' ? 'has-reminder' : ''
                  } ${
                    draggedTodoId === todo.id ? 'is-dragging' : ''
                  } ${
                    noteOpen ? 'has-open-note' : ''
                  }`}
                  key={todo.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropTodoOnTarget(todo.id)}
                >
                <button
                  type="button"
                  className="ghost-button icon-only drag-handle"
                  draggable
                  onDragStart={(event) => {
                    const todoRow = event.currentTarget.closest('.todo-row')
                    event.dataTransfer.effectAllowed = 'move'
                    if (todoRow) {
                      event.dataTransfer.setDragImage(
                        todoRow,
                        Math.min(32, todoRow.clientWidth / 2),
                        todoRow.clientHeight / 2,
                      )
                    }
                    setDraggedTodoId(todo.id)
                  }}
                  onDragEnd={() => setDraggedTodoId(null)}
                  aria-label="拖动排序"
                  title="拖动排序"
                >
                  <GripVertical size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="check-button"
                  onClick={() => toggleTodo(todo)}
                  disabled={Boolean(todo.postponedTo)}
                  aria-label={todo.done ? '标记为未完成' : '标记为已完成'}
                  title={todo.done ? '标记为未完成' : '标记为已完成'}
                >
                  {todo.done ? <Check size={16} aria-hidden="true" /> : null}
                </button>
                <div className="todo-main">
                  <span className="todo-text">{todo.text}</span>
                  <div className="todo-meta">
                    <span
                      className={`priority-tag priority-${
                        todo.priority ?? defaultTodoDraft.priority
                      }`}
                    >
                      {priorityLabels[todo.priority] ?? priorityLabels[defaultTodoDraft.priority]}
                    </span>
                    <span
                      className={`reminder-tag ${
                        todo.timeSlot && todo.timeSlot !== 'none'
                          ? 'reminder-active'
                          : 'reminder-none'
                      }`}
                    >
                      {todoTimeLabel(todo)}
                    </span>
                    {todo.postponedFrom ? <span>来自 {todo.postponedFrom}</span> : null}
                    {todo.postponedTo ? <span>已顺延至 {todo.postponedTo}</span> : null}
                    <button
                      type="button"
                      className={`todo-note-toggle ${noteOpen ? 'is-open' : ''} ${
                        noteDraft ? 'has-notes' : ''
                      }`}
                      onClick={() => toggleTodoNote(todo.id)}
                      aria-expanded={noteOpen}
                    >
                      <NotebookPen size={13} aria-hidden="true" />
                      {noteOpen ? '收起笔记' : '笔记'}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="ghost-button icon-only todo-menu-trigger"
                  onClick={() =>
                    setOpenTodoMenuId((current) => (current === todo.id ? null : todo.id))
                  }
                  aria-label="更多操作"
                  aria-expanded={openTodoMenuId === todo.id}
                  disabled={saving}
                >
                  <MoreHorizontal size={16} aria-hidden="true" />
                </button>
                <div className={`todo-actions ${openTodoMenuId === todo.id ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="ghost-button icon-only"
                    onClick={() => moveTodo(todo.id, -1)}
                    aria-label="上移待办"
                    title="上移"
                    disabled={saving || !canMoveUp}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="ghost-button icon-only"
                    onClick={() => moveTodo(todo.id, 1)}
                    aria-label="下移待办"
                    title="下移"
                    disabled={saving || !canMoveDown}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="ghost-button icon-only"
                    onClick={() => openEditTodoDialog(todo)}
                    aria-label="编辑待办"
                    title="编辑"
                    disabled={saving}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  {!todo.done && !todo.postponedTo ? (
                    <button
                      type="button"
                      className="ghost-button icon-only"
                      onClick={() => postponeTodo(todo)}
                      aria-label="顺延到明天"
                      title="顺延到明天"
                      disabled={saving}
                    >
                      <CornerDownRight size={16} aria-hidden="true" />
                    </button>
                  ) : null}
                  {todo.postponedTo ? (
                    <button
                      type="button"
                      className="ghost-button icon-only"
                      onClick={() => cancelPostponeTodo(todo)}
                      aria-label="取消顺延"
                      title="取消顺延"
                      disabled={saving}
                    >
                      <Undo2 size={16} aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ghost-button icon-only"
                    onClick={() => removeTodo(todo)}
                    aria-label="删除待办"
                    title="删除"
                    disabled={saving}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
                {noteOpen ? (
                  <div className="todo-note-panel">
                    <div className="todo-note-heading">
                      <span>任务笔记</span>
                      {noteStatus ? (
                        <em className={`todo-note-status status-${noteStatus}`}>
                          {todoNoteStatusLabels[noteStatus]}
                        </em>
                      ) : null}
                    </div>
                    <textarea
                      value={noteDraft}
                      onChange={(event) => scheduleTodoNoteSave(todo, event.target.value)}
                      onBlur={() => flushTodoNoteSave(todo)}
                      placeholder="记录执行过程、问题、沟通结论或可复用经验"
                      rows="4"
                    />
                  </div>
                ) : null}
              </div>
              )
            })
          ) : (
            <EmptyState icon={ListChecks} title="今天还没有待办事项" />
          )}
        </div>

        <section className="upcoming-todos" aria-label="未来待办">
          <button
            type="button"
            className="upcoming-toggle"
            onClick={() => setUpcomingExpanded((current) => !current)}
            aria-expanded={upcomingExpanded}
          >
            <span>
              <CalendarDays size={16} aria-hidden="true" />
              未来待办
            </span>
            <strong>{upcomingTodoCount} 项</strong>
            {upcomingExpanded ? (
              <ChevronUp size={16} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
          </button>

          {upcomingExpanded ? (
            <div className="upcoming-list">
              {upcomingTodoGroups.length ? (
                upcomingTodoGroups.map((group) => (
                  <article className="upcoming-group" key={group.date}>
                    <div className="upcoming-date">
                      <div>
                        <strong>{group.date}</strong>
                        <span>{weekdayForDate(group.date)}</span>
                      </div>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setSelectedDate(group.date)}
                      >
                        查看当天
                      </button>
                    </div>
                    <div className="upcoming-items">
                      {group.todos.map((todo) => (
                        <div className="upcoming-item" key={todo.id}>
                          <span>{todo.text}</span>
                          <div className="todo-meta">
                            <span
                              className={`priority-tag priority-${
                                todo.priority ?? defaultTodoDraft.priority
                              }`}
                            >
                              {priorityLabels[todo.priority] ??
                                priorityLabels[defaultTodoDraft.priority]}
                            </span>
                            <span
                              className={`reminder-tag ${
                                todo.timeSlot && todo.timeSlot !== 'none'
                                  ? 'reminder-active'
                                  : 'reminder-none'
                              }`}
                            >
                              {todoTimeLabel(todo)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <p className="upcoming-empty">未来 30 天暂无待办安排。</p>
              )}
            </div>
          ) : null}
        </section>

        {ENABLE_AI_FEATURES && postponeSuggestionResult ? (
          <div className="ai-insight-panel todo-insight-panel">
            <div className="ai-insight-heading">
              <div>
                <Lightbulb size={18} aria-hidden="true" />
                <h3>智能顺延建议</h3>
              </div>
              <div className="ai-insight-controls">
                {postponeSuggestionResult.generatedAt ? (
                  <span>{new Date(postponeSuggestionResult.generatedAt).toLocaleString('zh-CN')}</span>
                ) : null}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setPostponeSuggestionCollapsed((current) => !current)}
                >
                  {postponeSuggestionCollapsed ? (
                    <ChevronDown size={16} aria-hidden="true" />
                  ) : (
                    <ChevronUp size={16} aria-hidden="true" />
                  )}
                  {postponeSuggestionCollapsed ? '展开' : '折叠'}
                </button>
              </div>
            </div>
            {!postponeSuggestionCollapsed ? (
              <>
                <div className="suggestion-bulk-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={applyAllPostponeSuggestions}
                    disabled={saving || !postponeSuggestionResult.suggestions.length}
                  >
                    <Check size={16} aria-hidden="true" />
                    全部采用建议
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={ignoreAllPostponeSuggestions}
                    disabled={saving}
                  >
                    全部忽略建议
                  </button>
                </div>
                {postponeSuggestionResult.suggestions.length ? (
                  <div className="suggestion-list">
                    {postponeSuggestionResult.suggestions.map((suggestion) => {
                      const relatedTodo = day?.todos.find((todo) => todo.id === suggestion.todoId)

                      return (
                        <article
                          className={`suggestion-item action-${suggestion.action}`}
                          key={suggestion.todoId}
                        >
                          <div className="suggestion-topline">
                            <strong>{suggestion.todoText}</strong>
                            <span>{suggestionActionLabels[suggestion.action] ?? '建议处理'}</span>
                          </div>
                          <p>{suggestion.reason}</p>
                          {suggestion.suggestedTasks.length ? (
                            <ul>
                              {suggestion.suggestedTasks.map((task) => (
                                <li key={task}>{task}</li>
                              ))}
                            </ul>
                          ) : null}
                          <div className="suggestion-actions">
                            {suggestion.action === 'postpone' && relatedTodo && !relatedTodo.postponedTo ? (
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => postponeTodo(relatedTodo)}
                                disabled={saving}
                              >
                                <CornerDownRight size={16} aria-hidden="true" />
                                顺延
                              </button>
                            ) : null}
                            {suggestion.suggestedPriority ? (
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => applySuggestedPriority(suggestion)}
                                disabled={saving}
                              >
                                套用：{priorityLabels[suggestion.suggestedPriority]}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <p className="ai-empty-text">AI 暂时没有发现需要顺延、拆分或降级的待办。</p>
                )}
              </>
            ) : null}
          </div>
        ) : null}

        {ENABLE_AI_FEATURES && knowledgeSuggestionResult ? (
          <div className="ai-insight-panel knowledge-insight-panel">
            <div className="ai-insight-heading">
              <div>
                <NotebookPen size={18} aria-hidden="true" />
                <h3>SOP / Skill 沉淀建议</h3>
              </div>
              <div className="ai-insight-controls">
                {knowledgeSuggestionResult.generatedAt ? (
                  <span>{new Date(knowledgeSuggestionResult.generatedAt).toLocaleString('zh-CN')}</span>
                ) : null}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setKnowledgeSuggestionCollapsed((current) => !current)}
                >
                  {knowledgeSuggestionCollapsed ? (
                    <ChevronDown size={16} aria-hidden="true" />
                  ) : (
                    <ChevronUp size={16} aria-hidden="true" />
                  )}
                  {knowledgeSuggestionCollapsed ? '展开' : '折叠'}
                </button>
              </div>
            </div>
            {!knowledgeSuggestionCollapsed ? (
              knowledgeSuggestionResult.suggestions.length ? (
                <div className="knowledge-list">
                  {knowledgeSuggestionResult.suggestions.map((suggestion) => (
                    <article className="knowledge-item" key={suggestion.todoId}>
                      <div className="knowledge-topline">
                        <strong>{suggestion.todoText}</strong>
                        <span>{suggestion.reuseScenario}</span>
                      </div>
                      <div className="knowledge-grid">
                        <section>
                          <h4>SOP 方向</h4>
                          <p>{suggestion.sopDirection}</p>
                        </section>
                        <section>
                          <h4>Skill 方向</h4>
                          <p>{suggestion.skillDirection}</p>
                        </section>
                      </div>
                      <div className="knowledge-grid">
                        <section>
                          <h4>执行时记录</h4>
                          {suggestion.capturePoints.length ? (
                            <ul>
                              {suggestion.capturePoints.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>记录关键输入、判断标准、结果和遇到的问题。</p>
                          )}
                        </section>
                        <section>
                          <h4>质量检查</h4>
                          {suggestion.checklist.length ? (
                            <ul>
                              {suggestion.checklist.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>确认输入完整、过程可复用、输出可验收。</p>
                          )}
                        </section>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="ai-empty-text">当前没有可生成 SOP / Skill 方向的未完成待办。</p>
              )
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="monthly-plan" aria-label="本月计划">
        <div className="monthly-plan-header">
          <div>
            <Target size={19} aria-hidden="true" />
            <h2>本月计划</h2>
          </div>
          <div className="monthly-plan-status">
            <span>{state?.month}</span>
            <strong>{monthlyGoalCount} 项目标</strong>
            <span>平均进度 {monthlyGoalProgress}%</span>
            <div className="monthly-progress" aria-hidden="true">
              <span style={{ width: `${monthlyGoalProgress}%` }} />
            </div>
          </div>
          <div className="section-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setMonthExpanded((current) => !current)}
            >
              {monthExpanded ? '收起' : '展开'}
            </button>
            {monthExpanded ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => openAddDialog('goal')}
              >
                <Plus size={17} aria-hidden="true" />
                添加计划
              </button>
            ) : null}
          </div>
        </div>

        {monthExpanded ? (
          <div className="goal-list monthly-goal-list">
            {state?.monthlyGoals.length ? (
              state.monthlyGoals.map((goal) => {
                const logOpen = expandedGoalLogIds.has(goal.id)
                const currentLog = goalLogForDate(goal, selectedDate)
                const logDraft = goalLogDrafts[goal.id] ?? currentLog?.content ?? ''
                const logStatus = goalLogSaveState[goal.id]
                const progressLogs = sortedGoalProgressLogs(goal)

                return (
                  <article className={`goal-item ${logOpen ? 'has-open-log' : ''}`} key={goal.id}>
                    <div className="goal-topline">
                      <strong>{goal.title}</strong>
                      <div className="goal-actions">
                        <button
                          type="button"
                          className={`ghost-button goal-log-toggle ${logOpen ? 'is-open' : ''}`}
                          onClick={() => toggleGoalLog(goal.id)}
                          aria-expanded={logOpen}
                        >
                          <NotebookPen size={16} aria-hidden="true" />
                          {logOpen ? '收起进展' : '进展记录'}
                        </button>
                        <button
                          type="button"
                          className="ghost-button icon-only"
                          onClick={() => removeGoal(goal)}
                          aria-label="删除计划"
                          title="删除"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <p>{goal.notes || '暂无说明'}</p>
                    <div className="goal-controls">
                      <label>
                        <span>{goal.progress}%</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={goal.progress}
                          onChange={(event) =>
                            updateGoal(goal, { progress: Number(event.target.value) })
                          }
                        />
                      </label>
                      <select
                        value={goal.status}
                        onChange={(event) => updateGoal(goal, { status: event.target.value })}
                      >
                        <option value="active">推进中</option>
                        <option value="paused">暂缓</option>
                        <option value="done">已完成</option>
                      </select>
                    </div>
                    {logOpen ? (
                      <div className="goal-log-panel">
                        <div className="goal-log-editor-heading">
                          <span>
                            {selectedDate} · {weekdayForDate(selectedDate)}
                          </span>
                          {logStatus ? (
                            <em className={`goal-log-status status-${logStatus}`}>
                              {todoNoteStatusLabels[logStatus]}
                            </em>
                          ) : null}
                        </div>
                        <textarea
                          value={logDraft}
                          onChange={(event) => scheduleGoalLogSave(goal, event.target.value)}
                          onBlur={() => flushGoalLogSave(goal)}
                          placeholder="记录今天这个目标推进了什么、遇到什么问题、下一步准备做什么"
                          rows="4"
                        />
                        <div className="goal-log-history">
                          <div className="goal-log-history-heading">
                            <strong>历史进展</strong>
                            <span>{progressLogs.length} 条</span>
                          </div>
                          {progressLogs.length ? (
                            <div className="goal-log-list">
                              {progressLogs.map((log) => (
                                <article className="goal-log-entry" key={log.date}>
                                  <div>
                                    <strong>{log.date}</strong>
                                    <span>{weekdayForDate(log.date)}</span>
                                    <span>当日进度 {log.progress}%</span>
                                  </div>
                                  <p>{log.content}</p>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <p className="goal-log-empty">还没有进展记录。</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </article>
                )
              })
            ) : (
              <EmptyState icon={Target} title="本月还没有计划" />
            )}
          </div>
        ) : null}
      </section>

      <div className="workspace-grid">
        <section className="panel summary-panel">
          <div className="panel-heading">
            <div>
              <FileText size={20} aria-hidden="true" />
              <h2>今日工作总结</h2>
            </div>
            <div className="section-actions">
              {ENABLE_AI_FEATURES ? (
                <button
                  type="button"
                  className="ghost-button ai-button"
                  onClick={generateSummaryDraft}
                  disabled={summaryDraftLoading || saving}
                >
                  {summaryDraftLoading ? (
                    <Loader2 className="spin" size={17} aria-hidden="true" />
                  ) : (
                    <Sparkles size={17} aria-hidden="true" />
                  )}
                  AI 生成草稿
                </button>
              ) : null}
              <button
                type="button"
                className="ghost-button"
                onClick={importCompletedTodosToWins}
                disabled={saving}
              >
                <Check size={17} aria-hidden="true" />
                带入完成项
              </button>
              <button type="button" className="primary-button" onClick={saveDay} disabled={saving}>
                <Save size={17} aria-hidden="true" />
                保存
              </button>
            </div>
          </div>

          <div className="summary-fields">
            <label>
              <span>今日重点</span>
              <input
                type="text"
                value={dayDraft.focus}
                onChange={(event) => setDayDraft({ ...dayDraft, focus: event.target.value })}
                placeholder="今天最重要的一件事"
              />
            </label>
            <label>
              <span>工作总结</span>
              <textarea
                value={dayDraft.workSummary}
                onChange={(event) =>
                  setDayDraft({ ...dayDraft, workSummary: event.target.value })
                }
                placeholder="记录推进内容、决策和交付结果"
                rows="5"
              />
            </label>
            <div className="two-column">
              <label>
                <span>关键产出</span>
                <textarea
                  value={dayDraft.wins}
                  onChange={(event) => setDayDraft({ ...dayDraft, wins: event.target.value })}
                  placeholder="一行一个产出"
                  rows="4"
                />
              </label>
              <label>
                <span>阻碍风险</span>
                <textarea
                  value={dayDraft.blockers}
                  onChange={(event) => setDayDraft({ ...dayDraft, blockers: event.target.value })}
                  placeholder="一行一个阻碍"
                  rows="4"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="panel report-panel">
          <div className="panel-heading">
            <div>
              <BarChart3 size={20} aria-hidden="true" />
              <h2>周报</h2>
            </div>
            <div className="section-actions report-actions">
              <button
                type="button"
                className="primary-button"
                onClick={generateReport}
                disabled={saving}
              >
                <RefreshCw size={17} aria-hidden="true" />
                生成本周
              </button>
              {latestReport ? (
                <>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => copyReport(latestReport)}
                    disabled={saving}
                  >
                    <Copy size={17} aria-hidden="true" />
                    复制
                  </button>
                  {ENABLE_PDF_EXPORT ? (
                    <a
                      className="ghost-button export-button"
                      href={`/api/reports/${latestReport.id}/pdf`}
                      download={`weekly-report-${latestReport.periodStart}-${latestReport.periodEnd}.pdf`}
                    >
                      <Download size={17} aria-hidden="true" />
                      导出 PDF
                    </a>
                  ) : null}
                  {ENABLE_AI_FEATURES ? (
                    <button
                      type="button"
                      className="ghost-button ai-button"
                      onClick={() => polishReport(latestReport)}
                      disabled={saving}
                    >
                      <Sparkles size={17} aria-hidden="true" />
                      AI 润色
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          {latestReport ? (
            <article className="report-preview">
              <div className="report-title">
                <strong>{latestReport.headline}</strong>
                <span>{new Date(latestReport.generatedAt).toLocaleString('zh-CN')}</span>
              </div>
              <p>{latestReport.overview}</p>

              {ENABLE_AI_FEATURES && latestReport.polishedContent ? (
                <div className="report-section polished-report">
                  <div className="polished-heading">
                    <h3>AI 润色稿</h3>
                    {latestReport.polishedAt ? (
                      <span>{new Date(latestReport.polishedAt).toLocaleString('zh-CN')}</span>
                    ) : null}
                  </div>
                  <p>{latestReport.polishedContent}</p>
                </div>
              ) : null}

              <div className="report-section">
                <h3>完成事项</h3>
                <ul>
                  {(latestReport.completedTodos.length
                    ? latestReport.completedTodos
                    : ['本周暂无已完成待办']
                  ).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="report-section">
                <h3>下周重点</h3>
                <ul>
                  {latestReport.nextWeekFocus.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <details>
                <summary>查看历史周报</summary>
                <div className="history-list">
                  {state.weeklyReports.map((report) => (
                    <details
                      className="history-report-item"
                      key={report.id}
                    >
                      <summary className="history-report-summary">
                        <span>{report.headline}</span>
                        <ChevronDown
                          className="history-report-chevron"
                          size={18}
                          aria-hidden="true"
                        />
                      </summary>
                      <div className="history-report-body">
                        <div className="history-report-meta">
                          <span>{new Date(report.generatedAt).toLocaleString('zh-CN')}</span>
                          <span>
                            {report.periodStart} 至 {report.periodEnd}
                          </span>
                        </div>
                        <p>{report.overview}</p>
                        {ENABLE_AI_FEATURES && report.polishedContent ? (
                          <div className="history-report-polished">
                            <strong>AI 润色稿</strong>
                            <p>{report.polishedContent}</p>
                          </div>
                        ) : null}
                        <div className="history-report-grid">
                          <section>
                            <h3>完成事项</h3>
                            <ul>
                              {(report.completedTodos.length
                                ? report.completedTodos
                                : ['本周暂无已完成待办']
                              ).map((item, index) => (
                                <li key={`${item}-${index}`}>{item}</li>
                              ))}
                            </ul>
                          </section>
                          <section>
                            <h3>下周重点</h3>
                            <ul>
                              {report.nextWeekFocus.map((item, index) => (
                                <li key={`${item}-${index}`}>{item}</li>
                              ))}
                            </ul>
                          </section>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            </article>
          ) : (
            <EmptyState icon={BarChart3} title="还没有周报，周五 18:00 会自动生成" />
          )}
        </section>
      </div>

      {ENABLE_HISTORY_QA ? (
        <section className="panel history-ai-panel">
          <div className="panel-heading">
            <div>
              <MessageSquare size={20} aria-hidden="true" />
              <h2>历史工作问答</h2>
            </div>
          </div>
          <form className="history-qa-form" onSubmit={askWorkHistory}>
            <label>
              <span>询问你的历史工作记录</span>
              <textarea
                value={historyQuestion}
                onChange={(event) => setHistoryQuestion(event.target.value)}
                placeholder="例如：我上周主要做了什么？这个月哪些任务经常被顺延？"
                rows="3"
              />
            </label>
            <button
              type="submit"
              className="primary-button"
              disabled={historyLoading || !historyQuestion.trim()}
            >
              {historyLoading ? (
                <Loader2 className="spin" size={17} aria-hidden="true" />
              ) : (
                <Send size={17} aria-hidden="true" />
              )}
              提问
            </button>
          </form>
          {historyAnswer ? (
            <article className="history-answer">
              <div className="history-answer-meta">
                <strong>回答</strong>
                <span>{new Date(historyAnswer.generatedAt).toLocaleString('zh-CN')}</span>
              </div>
              <p>{historyAnswer.answer}</p>
            </article>
          ) : null}
        </section>
      ) : null}
      </main>

      {activeAddDialog ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-dialog-title"
          >
            {activeAddDialog === 'todo' ? (
              <form className="modal-form" onSubmit={addTodo}>
                <div className="modal-heading">
                  <h2 id="add-dialog-title">添加待办事项</h2>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={closeAddDialog}
                    disabled={saving}
                  >
                    取消
                  </button>
                </div>
                <TodoDraftFields
                  draft={todoDraft}
                  onChange={setTodoDraft}
                  placeholder="填写今天要完成的事项"
                  showTargetDate
                />
                <div className="modal-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={closeAddDialog}
                    disabled={saving}
                  >
                    取消
                  </button>
                  <button type="submit" className="primary-button" disabled={saving}>
                    <Plus size={17} aria-hidden="true" />
                    添加
                  </button>
                </div>
              </form>
            ) : null}

            {activeAddDialog === 'editTodo' ? (
              <form className="modal-form" onSubmit={editTodo}>
                <div className="modal-heading">
                  <h2 id="add-dialog-title">编辑待办事项</h2>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={closeAddDialog}
                    disabled={saving}
                  >
                    取消
                  </button>
                </div>
                <TodoDraftFields
                  draft={editTodoDraft}
                  onChange={setEditTodoDraft}
                  placeholder="修改待办事项"
                />
                <div className="modal-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={closeAddDialog}
                    disabled={saving}
                  >
                    取消
                  </button>
                  <button type="submit" className="primary-button" disabled={saving}>
                    <Save size={17} aria-hidden="true" />
                    保存
                  </button>
                </div>
              </form>
            ) : null}

            {activeAddDialog === 'goal' ? (
              <form className="modal-form" onSubmit={addGoal}>
                <div className="modal-heading">
                  <h2 id="add-dialog-title">添加本月计划</h2>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={closeAddDialog}
                    disabled={saving}
                  >
                    取消
                  </button>
                </div>
                <label>
                  <span>计划名称</span>
                  <input
                    type="text"
                    value={goalDraft.title}
                    onChange={(event) =>
                      setGoalDraft({ ...goalDraft, title: event.target.value })
                    }
                    placeholder="填写本月计划"
                    autoFocus
                  />
                </label>
                <label>
                  <span>计划说明</span>
                  <textarea
                    value={goalDraft.notes}
                    onChange={(event) =>
                      setGoalDraft({ ...goalDraft, notes: event.target.value })
                    }
                    placeholder="填写计划说明或衡量标准"
                    rows="4"
                  />
                </label>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={closeAddDialog}
                    disabled={saving}
                  >
                    取消
                  </button>
                  <button type="submit" className="primary-button" disabled={saving}>
                    <Plus size={17} aria-hidden="true" />
                    添加计划
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      {copyFallbackText ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-panel copy-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="copy-dialog-title"
          >
            <div className="modal-heading">
              <h2 id="copy-dialog-title">复制周报</h2>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setCopyFallbackText('')
                  setError('')
                }}
              >
                关闭
              </button>
            </div>
            <label>
              <span>周报文本</span>
              <textarea
                value={copyFallbackText}
                readOnly
                rows="12"
                onFocus={(event) => event.target.select()}
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setCopyFallbackText('')
                  setError('')
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
