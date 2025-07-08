class TrainerDashboard {
  constructor() {
    this.currentTrainer = null
    this.currentView = "month"
    this.currentDate = new Date()
    this.sessions = []

    this.init()
  }

  init() {
    this.bindEvents()
    this.checkAuthStatus()
    // Check for completed sessions every minute
    setInterval(() => this.checkAndRemoveCompletedSessions(), 60000)
  }

  bindEvents() {
    // Login form
    document.getElementById("loginForm").addEventListener("submit", (e) => this.handleLogin(e))

    // Logout
    document.getElementById("logoutBtn").addEventListener("click", () => this.handleLogout())

    // View controls
    document.querySelectorAll(".view-btn, .tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => this.changeView(e.target.dataset.view))
    })

    // Calendar navigation
    document.getElementById("prevBtn").addEventListener("click", () => this.navigateDate(-1))
    document.getElementById("nextBtn").addEventListener("click", () => this.navigateDate(1))

    // Create session modal
    document.getElementById("createSessionBtn").addEventListener("click", () => this.openCreateModal())
    document.getElementById("closeModal").addEventListener("click", () => this.closeCreateModal())
    document.getElementById("cancelBtn").addEventListener("click", () => this.closeCreateModal())
    document.getElementById("createSessionForm").addEventListener("submit", (e) => this.handleCreateSessions(e))

    // Close modal on outside click
    document.getElementById("createSessionModal").addEventListener("click", (e) => {
      if (e.target.id === "createSessionModal") {
        this.closeCreateModal()
      }
    })
  }

  async handleLogin(e) {
    e.preventDefault()

    const username = document.getElementById("username").value
    const password = document.getElementById("password").value
    const errorDiv = document.getElementById("loginError")
    const btnText = document.getElementById("loginBtnText")
    const spinner = document.getElementById("loginSpinner")

    btnText.style.display = "none"
    spinner.style.display = "block"
    errorDiv.style.display = "none"

    try {
      const response = await fetch("api/login.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (data.success) {
        this.currentTrainer = data.trainer
        localStorage.setItem("trainer", JSON.stringify(data.trainer))
        this.showDashboard()
        await this.loadSessions()
      } else {
        errorDiv.textContent = data.error || "Login failed"
        errorDiv.style.display = "block"
      }
    } catch (error) {
      errorDiv.textContent = "Connection error. Please try again."
      errorDiv.style.display = "block"
    }

    btnText.style.display = "block"
    spinner.style.display = "none"
  }

  handleLogout() {
    this.currentTrainer = null
    localStorage.removeItem("trainer")
    document.getElementById("dashboard").style.display = "none"
    document.getElementById("loginPage").style.display = "flex"
    document.getElementById("loginForm").reset()
  }

  checkAuthStatus() {
    const savedTrainer = localStorage.getItem("trainer")
    if (savedTrainer) {
      this.currentTrainer = JSON.parse(savedTrainer)
      this.showDashboard()
      this.loadSessions()
    }
  }

  showDashboard() {
    document.getElementById("loginPage").style.display = "none"
    document.getElementById("dashboard").style.display = "flex"
    document.getElementById("trainerName").textContent = this.currentTrainer.name
    this.updateCalendarView()
  }

  changeView(view) {
    this.currentView = view

    // Update active buttons
    document.querySelectorAll(".view-btn, .tab-btn").forEach((btn) => {
      btn.classList.remove("active")
      if (btn.dataset.view === view) {
        btn.classList.add("active")
      }
    })

    this.updateCalendarView()
  }

  navigateDate(direction) {
    const newDate = new Date(this.currentDate)

    if (this.currentView === "month") {
      newDate.setMonth(newDate.getMonth() + direction)
    } else if (this.currentView === "week") {
      newDate.setDate(newDate.getDate() + direction * 7)
    } else {
      newDate.setDate(newDate.getDate() + direction)
    }

    this.currentDate = newDate
    this.updateCalendarView()
  }

  updateCalendarView() {
    const currentDateEl = document.getElementById("currentDate")
    const calendarView = document.getElementById("calendarView")

    // Update date display
    if (this.currentView === "month") {
      currentDateEl.textContent = this.currentDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      })
      calendarView.innerHTML = this.renderMonthView()
    } else if (this.currentView === "week") {
      const weekStart = this.getWeekStart(this.currentDate)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      currentDateEl.textContent = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      calendarView.innerHTML = this.renderWeekView()
    } else {
      currentDateEl.textContent = this.currentDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      calendarView.innerHTML = this.renderDayView()
    }
  }

  renderMonthView() {
    const year = this.currentDate.getFullYear()
    const month = this.currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    let html = '<div class="month-grid">'

    // Header
    html += '<div class="month-header">'
    weekdays.forEach((day) => {
      html += `<div class="day-header">${day}</div>`
    })
    html += "</div>"

    // Days
    const current = new Date(startDate)
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        const isCurrentMonth = current.getMonth() === month

        // Fix today comparison
        const today = new Date()
        const isToday =
          current.getFullYear() === today.getFullYear() &&
          current.getMonth() === today.getMonth() &&
          current.getDate() === today.getDate()

        // Create date string in YYYY-MM-DD format to match database format
        const dateStr =
          current.getFullYear() +
          "-" +
          String(current.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(current.getDate()).padStart(2, "0")

        // Filter sessions for this date (only future/ongoing sessions)
        const daySessions = this.sessions.filter((session) => {
          return session.session_date === dateStr && !this.isSessionCompleted(session)
        })

        html += `<div class="day-cell ${!isCurrentMonth ? "other-month" : ""} ${isToday ? "today" : ""}">`
        html += `<div class="day-number">${current.getDate()}</div>`

        // Display sessions
        daySessions.forEach((session) => {
          const sessionStatus = this.getSessionStatus(session)
          const statusClass = sessionStatus === "ongoing" ? "session-ongoing" : ""

          html += `<div class="session-item ${statusClass}">
                    <span>${session.session_time} - ${session.title}</span>
                    <button class="delete-session" onclick="dashboard.deleteSession(${session.id})" title="Delete session">×</button>
                </div>`
        })

        html += "</div>"
        current.setDate(current.getDate() + 1)
      }
    }

    html += "</div>"
    return html
  }

  renderWeekView() {
    const weekStart = this.getWeekStart(this.currentDate)
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    let html = '<div class="week-view">'
    html += '<div class="week-grid">'

    // Header
    html += '<div class="time-slot"></div>'
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + i)

      // Create consistent date string format
      const dateStr =
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getDate()).padStart(2, "0")

      const daySessions = this.sessions.filter((session) => {
        return session.session_date === dateStr && !this.isSessionCompleted(session)
      })

      html += `<div class="day-column">
              <strong>${weekdays[i]}</strong><br>
              <small>${date.getDate()}</small>
              <div style="margin-top: 8px;">`

      daySessions.forEach((session) => {
        const sessionStatus = this.getSessionStatus(session)
        const statusClass = sessionStatus === "ongoing" ? "session-ongoing" : ""

        html += `<div class="session-item ${statusClass}" style="margin-bottom: 4px;">
                  <span>${session.session_time} - ${session.title}</span>
                  <button class="delete-session" onclick="dashboard.deleteSession(${session.id})" title="Delete session">×</button>
              </div>`
      })

      html += "</div></div>"
    }

    html += "</div></div>"
    return html
  }

  renderDayView() {
    // Create consistent date string format
    const dateStr =
      this.currentDate.getFullYear() +
      "-" +
      String(this.currentDate.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(this.currentDate.getDate()).padStart(2, "0")

    const daySessions = this.sessions
      .filter((session) => {
        return session.session_date === dateStr && !this.isSessionCompleted(session)
      })
      .sort((a, b) => a.session_time.localeCompare(b.session_time))

    let html = '<div class="day-view">'

    if (daySessions.length === 0) {
      html += '<div style="text-align: center; padding: 40px; color: #718096;">No sessions scheduled for this day</div>'
    } else {
      html += '<div class="day-sessions">'
      daySessions.forEach((session) => {
        const sessionStatus = this.getSessionStatus(session)
        const statusClass = sessionStatus === "ongoing" ? "session-card-ongoing" : ""
        const statusText = sessionStatus === "ongoing" ? " (Ongoing)" : ""

        html += `<div class="session-card ${statusClass}">
                  <div class="session-info">
                      <h4>${session.title}${statusText}</h4>
                      <div class="session-details">
                          <div>🕒 ${session.session_time} (${session.duration} min)</div>
                          <div>👤 ${session.client_name}</div>
                          <div>📋 ${session.session_type}</div>
                          ${session.description ? `<div>📝 ${session.description}</div>` : ""}
                      </div>
                  </div>
                  <div class="session-actions">
                      <button class="delete-btn" onclick="dashboard.deleteSession(${session.id})">Delete</button>
                  </div>
              </div>`
      })
      html += "</div>"
    }

    html += "</div>"
    return html
  }

  getWeekStart(date) {
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay())
    return start
  }

  // Check if a session is completed (past its end time)
  isSessionCompleted(session) {
    const now = new Date()
    const sessionDate = new Date(session.session_date + "T" + session.session_time)
    const sessionEndTime = new Date(sessionDate.getTime() + session.duration * 60000)

    return now > sessionEndTime
  }

  // Get session status (upcoming, ongoing, completed)
  getSessionStatus(session) {
    const now = new Date()
    const sessionDate = new Date(session.session_date + "T" + session.session_time)
    const sessionEndTime = new Date(sessionDate.getTime() + session.duration * 60000)

    if (now < sessionDate) {
      return "upcoming"
    } else if (now >= sessionDate && now <= sessionEndTime) {
      return "ongoing"
    } else {
      return "completed"
    }
  }

  // Check and remove completed sessions
  async checkAndRemoveCompletedSessions() {
    if (!this.currentTrainer) return

    const completedSessions = this.sessions.filter((session) => this.isSessionCompleted(session))

    if (completedSessions.length > 0) {
      console.log(`Found ${completedSessions.length} completed sessions to remove`)

      for (const session of completedSessions) {
        try {
          await this.removeCompletedSession(session.id)
        } catch (error) {
          console.error("Error removing completed session:", error)
        }
      }

      // Reload sessions and update display
      await this.loadSessions()
    }
  }

  // Remove completed session from database
  async removeCompletedSession(sessionId) {
    try {
      const response = await fetch("api/sessions.php", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: sessionId,
          auto_remove: true, // Flag to indicate this is automatic removal
        }),
      })

      const data = await response.json()

      if (!data.success) {
        console.error("Error auto-removing completed session:", data.error)
      }
    } catch (error) {
      console.error("Connection error while removing completed session:", error)
    }
  }

  async loadSessions() {
    try {
      const response = await fetch(`api/sessions.php?trainer_id=${this.currentTrainer.id}`)
      const data = await response.json()

      if (data.success) {
        this.sessions = data.sessions
        this.updateStats()
        this.updateCalendarView()
      }
    } catch (error) {
      console.error("Error loading sessions:", error)
    }
  }

  updateStats() {
    const totalSessions = this.sessions.length

    // Create consistent date string for today
    const today = new Date()
    const todayStr =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0")

    const upcomingSessions = this.sessions.filter((session) => {
      return session.session_date >= todayStr && !this.isSessionCompleted(session)
    }).length

    document.getElementById("totalSessions").textContent = totalSessions
    document.getElementById("upcomingSessions").textContent = upcomingSessions
  }

  openCreateModal() {
    document.getElementById("createSessionModal").style.display = "flex"
    // Set default dates
    const today = new Date()
    const nextWeek = new Date()
    nextWeek.setDate(today.getDate() + 7)

    document.getElementById("startDate").value = today.toISOString().split("T")[0]
    document.getElementById("endDate").value = nextWeek.toISOString().split("T")[0]
  }

  closeCreateModal() {
    document.getElementById("createSessionModal").style.display = "none"
    document.getElementById("createSessionForm").reset()
  }

  async handleCreateSessions(e) {
    e.preventDefault()

    const formData = new FormData(e.target)
    const submitBtn = document.getElementById("submitBtnText")
    const spinner = document.getElementById("submitSpinner")

    submitBtn.style.display = "none"
    spinner.style.display = "block"

    // Get selected weekdays
    const selectedDays = Array.from(document.querySelectorAll('input[name="weekdays"]:checked')).map((cb) =>
      Number.parseInt(cb.value),
    )

    if (selectedDays.length === 0) {
      alert("Please select at least one day of the week")
      submitBtn.style.display = "block"
      spinner.style.display = "none"
      return
    }

    // Generate sessions for date range
    const sessions = this.generateSessionsForDateRange(formData, selectedDays)

    try {
      const response = await fetch("api/sessions.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trainer_id: this.currentTrainer.id,
          sessions: sessions,
        }),
      })

      const data = await response.json()

      if (data.success) {
        await this.loadSessions()
        this.closeCreateModal()
        alert(`${sessions.length} sessions created successfully!`)
      } else {
        alert("Error creating sessions: " + (data.error || "Unknown error"))
      }
    } catch (error) {
      alert("Connection error. Please try again.")
    }

    submitBtn.style.display = "block"
    spinner.style.display = "none"
  }

  generateSessionsForDateRange(formData, selectedDays) {
    const sessions = []
    const startDate = new Date(formData.get("startDate"))
    const endDate = new Date(formData.get("endDate"))
    const startTime = formData.get("startTime")
    const endTime = formData.get("endTime")

    // Calculate session duration based on time range
    const [startHour, startMin] = startTime.split(":").map(Number)
    const [endHour, endMin] = endTime.split(":").map(Number)
    const duration = endHour * 60 + endMin - (startHour * 60 + startMin)

    const current = new Date(startDate)
    while (current <= endDate) {
      if (selectedDays.includes(current.getDay())) {
        sessions.push({
          title: formData.get("title"),
          client: formData.get("client"),
          date: current.toISOString().split("T")[0],
          time: startTime,
          duration: duration > 0 ? duration : 60, // Default to 60 minutes if invalid
          type: formData.get("type"),
          description: formData.get("description") || "",
        })
      }
      current.setDate(current.getDate() + 1)
    }

    return sessions
  }

  async deleteSession(sessionId) {
    if (!confirm("Are you sure you want to delete this session?")) {
      return
    }

    try {
      const response = await fetch("api/sessions.php", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: sessionId }),
      })

      const data = await response.json()

      if (data.success) {
        await this.loadSessions()
      } else {
        alert("Error deleting session: " + (data.error || "Unknown error"))
      }
    } catch (error) {
      alert("Connection error. Please try again.")
    }
  }
}

// Initialize dashboard
const dashboard = new TrainerDashboard()
