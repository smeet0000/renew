class AdminDashboard {
  constructor() {
    this.currentAdmin = null
    this.selectedTrainer = null
    this.currentView = "month"
    this.currentDate = new Date()
    this.sessions = []
    this.trainers = []
    this.searchTimeout = null

    this.init()
  }

  init() {
    this.bindEvents()
    this.checkAuthStatus()
    // Check for completed sessions every minute
    setInterval(() => this.checkAndUpdateSessionStatus(), 60000)
  }

  bindEvents() {
    // Admin login form
    document.getElementById("adminLoginForm").addEventListener("submit", (e) => this.handleLogin(e))

    // Logout
    document.getElementById("adminLogoutBtn").addEventListener("click", () => this.handleLogout())

    // Trainer search
    document.getElementById("trainerSearch").addEventListener("input", (e) => this.handleTrainerSearch(e))
    document.getElementById("clearSelection").addEventListener("click", () => this.clearTrainerSelection())

    // View controls
    document.querySelectorAll(".view-btn, .tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => this.changeView(e.target.dataset.view))
    })

    // Calendar navigation
    document.getElementById("prevBtn").addEventListener("click", () => this.navigateDate(-1))
    document.getElementById("nextBtn").addEventListener("click", () => this.navigateDate(1))

    // Click outside search results to close
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-container")) {
        document.getElementById("searchResults").style.display = "none"
      }
    })
  }

  async handleLogin(e) {
    e.preventDefault()

    const username = document.getElementById("adminUsername").value.trim()
    const password = document.getElementById("adminPassword").value.trim()
    const errorDiv = document.getElementById("adminLoginError")
    const btnText = document.getElementById("adminLoginBtnText")
    const spinner = document.getElementById("adminLoginSpinner")

    // Validation
    if (!username || !password) {
      errorDiv.textContent = "Please enter both username and password"
      errorDiv.style.display = "block"
      return
    }

    // Reset UI
    btnText.style.display = "none"
    spinner.style.display = "block"
    errorDiv.style.display = "none"

    try {
      console.log("Attempting admin login with:", { username, password: "***" })

      const response = await fetch("api/admin-login.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      })

      console.log("Response status:", response.status)
      console.log("Response headers:", response.headers)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const responseText = await response.text()
      console.log("Raw response:", responseText)

      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error("JSON parse error:", parseError)
        throw new Error("Invalid response format from server")
      }

      console.log("Parsed response:", data)

      if (data.success && data.admin) {
        this.currentAdmin = data.admin
        localStorage.setItem("admin", JSON.stringify(data.admin))
        console.log("Admin login successful:", data.admin)
        this.showDashboard()
        await this.loadTrainers()
      } else {
        const errorMessage = data.error || "Login failed. Please try again."
        console.error("Login failed:", errorMessage)
        errorDiv.textContent = errorMessage
        errorDiv.style.display = "block"
      }
    } catch (error) {
      console.error("Admin login error:", error)
      let errorMessage = "Connection error. Please check if the server is running and try again."

      if (error.message.includes("HTTP error")) {
        errorMessage = "Server error. Please try again later."
      } else if (error.message.includes("Invalid response")) {
        errorMessage = "Server response error. Please check server configuration."
      }

      errorDiv.textContent = errorMessage
      errorDiv.style.display = "block"
    }

    // Reset button state
    btnText.style.display = "block"
    spinner.style.display = "none"
  }

  handleLogout() {
    this.currentAdmin = null
    this.selectedTrainer = null
    localStorage.removeItem("admin")
    document.getElementById("adminDashboard").style.display = "none"
    document.getElementById("adminLoginPage").style.display = "flex"
    document.getElementById("adminLoginForm").reset()
    this.clearTrainerSelection()
  }

  checkAuthStatus() {
    const savedAdmin = localStorage.getItem("admin")
    if (savedAdmin) {
      try {
        this.currentAdmin = JSON.parse(savedAdmin)
        console.log("Restored admin session:", this.currentAdmin)
        this.showDashboard()
        this.loadTrainers()
      } catch (error) {
        console.error("Error parsing saved admin data:", error)
        localStorage.removeItem("admin")
      }
    }
  }

  showDashboard() {
    console.log("Showing admin dashboard for:", this.currentAdmin)
    document.getElementById("adminLoginPage").style.display = "none"
    document.getElementById("adminDashboard").style.display = "flex"
    document.getElementById("adminName").textContent = this.currentAdmin.name || this.currentAdmin.username
  }

  async loadTrainers() {
    try {
      const response = await fetch("api/trainers.php")
      const data = await response.json()

      if (data.success) {
        this.trainers = data.trainers
      }
    } catch (error) {
      console.error("Error loading trainers:", error)
    }
  }

  handleTrainerSearch(e) {
    const searchTerm = e.target.value.trim()
    const resultsDiv = document.getElementById("searchResults")

    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout)
    }

    if (searchTerm.length < 2) {
      resultsDiv.style.display = "none"
      return
    }

    // Debounce search
    this.searchTimeout = setTimeout(async () => {
      try {
        const response = await fetch(`api/trainers.php?search=${encodeURIComponent(searchTerm)}`)
        const data = await response.json()

        if (data.success) {
          this.displaySearchResults(data.trainers)
        }
      } catch (error) {
        console.error("Error searching trainers:", error)
      }
    }, 300)
  }

  displaySearchResults(trainers) {
    const resultsDiv = document.getElementById("searchResults")

    if (trainers.length === 0) {
      resultsDiv.innerHTML = '<div class="search-result-item no-results">No trainers found</div>'
      resultsDiv.style.display = "block"
      return
    }

    const html = trainers
      .map(
        (trainer) => `
      <div class="search-result-item" onclick="adminDashboard.selectTrainer(${trainer.id})">
        <div class="trainer-result">
          <div class="trainer-name">${trainer.name}</div>
          <div class="trainer-details">${trainer.username} • ${trainer.session_count} sessions</div>
        </div>
      </div>
    `,
      )
      .join("")

    resultsDiv.innerHTML = html
    resultsDiv.style.display = "block"
  }

  async selectTrainer(trainerId) {
    const trainer = this.trainers.find((t) => t.id == trainerId)
    if (!trainer) return

    this.selectedTrainer = trainer
    document.getElementById("searchResults").style.display = "none"
    document.getElementById("trainerSearch").value = trainer.name

    // Show selected trainer info
    document.getElementById("selectedTrainerName").textContent = trainer.name
    document.getElementById("selectedTrainerEmail").textContent = trainer.email
    document.getElementById("selectedTrainerSessions").textContent = `${trainer.session_count} total sessions`
    document.getElementById("selectedTrainer").style.display = "block"

    // Hide no trainer message and show calendar
    document.getElementById("noTrainerSelected").style.display = "none"
    document.getElementById("trainerCalendarView").style.display = "block"

    // Load trainer's sessions
    await this.loadTrainerSessions(trainerId)
    this.updateCalendarView()
  }

  clearTrainerSelection() {
    this.selectedTrainer = null
    this.sessions = []
    document.getElementById("trainerSearch").value = ""
    document.getElementById("selectedTrainer").style.display = "none"
    document.getElementById("searchResults").style.display = "none"
    document.getElementById("noTrainerSelected").style.display = "block"
    document.getElementById("trainerCalendarView").style.display = "none"
    this.updateStats()
  }

  async loadTrainerSessions(trainerId) {
    try {
      const response = await fetch(`api/sessions.php?trainer_id=${trainerId}`)
      const data = await response.json()

      if (data.success) {
        this.sessions = data.sessions
        this.updateStats()
      }
    } catch (error) {
      console.error("Error loading trainer sessions:", error)
    }
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

    if (this.selectedTrainer) {
      this.updateCalendarView()
    }
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
    if (!this.selectedTrainer) return

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
        const today = new Date()
        const isToday =
          current.getFullYear() === today.getFullYear() &&
          current.getMonth() === today.getMonth() &&
          current.getDate() === today.getDate()

        const dateStr =
          current.getFullYear() +
          "-" +
          String(current.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(current.getDate()).padStart(2, "0")

        const daySessions = this.sessions.filter((session) => session.session_date === dateStr)

        html += `<div class="day-cell ${!isCurrentMonth ? "other-month" : ""} ${isToday ? "today" : ""}">`
        html += `<div class="day-number">${current.getDate()}</div>`

        daySessions.forEach((session) => {
          const statusClass = this.getSessionStatusClass(session)
          html += `<div class="session-item ${statusClass}">
                    <span>${session.session_time} - ${session.title}</span>
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

    html += '<div class="time-slot"></div>'
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + i)

      const dateStr =
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getDate()).padStart(2, "0")

      const daySessions = this.sessions.filter((session) => session.session_date === dateStr)

      html += `<div class="day-column">
            <strong>${weekdays[i]}</strong><br>
            <small>${date.getDate()}</small>
            <div style="margin-top: 8px;">`

      daySessions.forEach((session) => {
        const statusClass = this.getSessionStatusClass(session)
        html += `<div class="session-item ${statusClass}" style="margin-bottom: 4px;">
                <span>${session.session_time} - ${session.title}</span>
            </div>`
      })

      html += "</div></div>"
    }

    html += "</div></div>"
    return html
  }

  renderDayView() {
    const dateStr =
      this.currentDate.getFullYear() +
      "-" +
      String(this.currentDate.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(this.currentDate.getDate()).padStart(2, "0")

    const daySessions = this.sessions
      .filter((session) => session.session_date === dateStr)
      .sort((a, b) => a.session_time.localeCompare(b.session_time))

    let html = '<div class="day-view">'

    if (daySessions.length === 0) {
      html += '<div style="text-align: center; padding: 40px; color: #718096;">No sessions scheduled for this day</div>'
    } else {
      html += '<div class="day-sessions">'
      daySessions.forEach((session) => {
        const statusClass = this.getSessionCardStatusClass(session)
        const statusText = this.getSessionStatusText(session)

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

  isSessionTimeCompleted(session) {
    const now = new Date()
    const sessionDate = new Date(session.session_date + "T" + session.session_time)
    const sessionEndTime = new Date(sessionDate.getTime() + session.duration * 60000)
    return now > sessionEndTime
  }

  getSessionStatusClass(session) {
    if (session.status === "started") {
      return "session-started"
    } else if (session.status === "completed") {
      return "session-completed"
    }

    if (this.isSessionTimeCompleted(session)) {
      return "session-time-completed"
    }

    return "session-scheduled"
  }

  getSessionCardStatusClass(session) {
    if (session.status === "started") {
      return "session-card-started"
    } else if (session.status === "completed") {
      return "session-card-completed"
    }

    if (this.isSessionTimeCompleted(session)) {
      return "session-card-time-completed"
    }

    return "session-card-scheduled"
  }

  getSessionStatusText(session) {
    if (session.status === "started") {
      return " (In Progress)"
    } else if (session.status === "completed") {
      return " (Completed)"
    }

    if (this.isSessionTimeCompleted(session)) {
      return " (Time Completed)"
    }

    return ""
  }

  updateStats() {
    if (!this.selectedTrainer) {
      document.getElementById("totalTrainerSessions").textContent = "0"
      document.getElementById("upcomingTrainerSessions").textContent = "0"
      document.getElementById("completedTrainerSessions").textContent = "0"
      return
    }

    const totalSessions = this.sessions.length
    const today = new Date().toISOString().split("T")[0]

    const upcomingSessions = this.sessions.filter((session) => {
      return session.session_date >= today && !this.isSessionTimeCompleted(session)
    }).length

    const completedSessions = this.sessions.filter((session) => {
      return session.status === "completed" || this.isSessionTimeCompleted(session)
    }).length

    document.getElementById("totalTrainerSessions").textContent = totalSessions
    document.getElementById("upcomingTrainerSessions").textContent = upcomingSessions
    document.getElementById("completedTrainerSessions").textContent = completedSessions
  }

  checkAndUpdateSessionStatus() {
    if (!this.selectedTrainer) return

    let hasUpdates = false

    for (const session of this.sessions) {
      if (this.isSessionTimeCompleted(session) && session.status !== "completed" && session.status !== "started") {
        hasUpdates = true
      }
    }

    if (hasUpdates) {
      this.updateCalendarView()
      this.updateStats()
    }
  }
}
