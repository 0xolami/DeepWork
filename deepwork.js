  // ─── STATE ───────────────────────────────────────────────────────────────
        let tasks = JSON.parse(localStorage.getItem('dw-tasks') || '[]');
        let sessions = parseInt(localStorage.getItem('dw-sessions') || '0');
        let focusTaskId = null;
        let currentFilter = 'all';

        // ─── GREETING ────────────────────────────────────────────────────────────
        function setGreeting() {
            const h = new Date().getHours();
            const greet = h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.';
            document.getElementById('greeting').textContent = greet;
            document.getElementById('page-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }
        setGreeting();

        // ─── TASKS ───────────────────────────────────────────────────────────────
        document.getElementById('task-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

        function addTask() {
            const input = document.getElementById('task-input');
            const name = input.value.trim();
            if (!name) return showToast('Enter a task name');
            const cat = document.getElementById('task-cat').value;
            const dl = document.getElementById('task-deadline').value;
            const task = { id: Date.now(), name, cat, deadline: dl || null, done: false, created: new Date().toISOString() };
            tasks.unshift(task);
            save();
            input.value = '';
            renderTasks();
            renderDeadlines();
            showToast('Task added');
        }

        function toggleTask(id) {
            const t = tasks.find(t => t.id === id);
            if (t) { t.done = !t.done; save(); renderTasks(); renderDeadlines(); updateStats(); }
        }

        function deleteTask(id) {
            tasks = tasks.filter(t => t.id !== id);
            if (focusTaskId === id) { focusTaskId = null; document.getElementById('focus-task-name').textContent = 'None selected'; }
            save();
            renderTasks();
            renderDeadlines();
            updateStats();
            showToast('Task removed');
        }

        function focusTask(id) {
            focusTaskId = focusTaskId === id ? null : id;
            const t = tasks.find(t => t.id === id);
            document.getElementById('focus-task-name').textContent = focusTaskId ? t.name : 'None selected';
            renderTasks();
            showToast(focusTaskId ? '🎯 Focus set' : 'Focus cleared');
        }

        function filterTasks(f, btn) {
            currentFilter = f;
            document.querySelectorAll('.mode-btn').forEach(b => {
                if (['f-all', 'f-active', 'f-done'].includes(b.id)) b.classList.remove('active');
            });
            btn.classList.add('active');
            renderTasks();
        }

        function daysUntil(dl) {
            if (!dl) return null;
            const diff = new Date(dl) - new Date(new Date().toDateString());
            return Math.ceil(diff / 86400000);
        }

        function deadlineBadge(deadline, done) {
            if (!deadline) return '';
            const d = daysUntil(deadline);
            if (done) return `<span class="deadline-badge deadline-ok">✓ Done</span>`;
            if (d < 0) return `<span class="deadline-badge deadline-late">⚠ ${Math.abs(d)}d overdue</span>`;
            if (d === 0) return `<span class="deadline-badge deadline-late">⚠ Due today</span>`;
            if (d <= 3) return `<span class="deadline-badge deadline-soon">⏰ ${d}d left</span>`;
            return `<span class="deadline-badge deadline-ok">📅 ${d}d left</span>`;
        }

        function renderTasks() {
            const el = document.getElementById('tasks-list');
            let filtered = tasks;
            if (currentFilter === 'active') filtered = tasks.filter(t => !t.done);
            if (currentFilter === 'done') filtered = tasks.filter(t => t.done);

            if (!filtered.length) {
                el.innerHTML = `<div class="empty-state"><p>${currentFilter === 'done' ? 'No completed tasks yet. Keep going!' : 'Nothing here. Add your first task above ↑'}</p></div>`;
                updateProgress();
                updateStats();
                return;
            }

            el.innerHTML = filtered.map(t => `
    <div class="task-card ${t.done ? 'done' : ''} ${focusTaskId === t.id ? 'focus-active' : ''}" data-id="${t.id}">
      <button class="task-check ${t.done ? 'checked' : ''}" onclick="toggleTask(${t.id})"></button>
      <div class="task-body">
        <div class="task-name">${t.name}</div>
        <div class="task-meta">
          <span class="tag tag-${t.cat}">${t.cat}</span>
          ${deadlineBadge(t.deadline, t.done)}
        </div>
      </div>
      <div class="task-actions">
        <button class="task-act" title="Focus on this" onclick="focusTask(${t.id})">🎯</button>
        <button class="task-act del" title="Delete" onclick="deleteTask(${t.id})">✕</button>
      </div>
    </div>
  `).join('');

            updateProgress();
            updateStats();
        }

        function updateProgress() {
            const total = tasks.length;
            const done = tasks.filter(t => t.done).length;
            const pct = total ? Math.round(done / total * 100) : 0;
            document.getElementById('progress-label').textContent = `${done} of ${total} tasks complete`;
            document.getElementById('progress-pct').textContent = pct + '%';
            document.getElementById('progress-fill').style.width = pct + '%';
        }

        function updateStats() {
            const today = new Date().toDateString();
            const done = tasks.filter(t => t.done && new Date(t.created).toDateString() === today).length;
            const overdue = tasks.filter(t => !t.done && t.deadline && daysUntil(t.deadline) < 0).length;
            document.getElementById('stat-done').textContent = done;
            document.getElementById('stat-sessions').textContent = sessions;
            document.getElementById('stat-total').textContent = tasks.length;
            document.getElementById('stat-overdue').textContent = overdue;
        }

        function renderDeadlines() {
            const withDL = tasks.filter(t => t.deadline && !t.done).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
            const grid = document.getElementById('deadline-grid');
            const dlEmpty = document.getElementById('dl-empty');
            document.getElementById('dl-count').textContent = withDL.length + ' upcoming';

            if (!withDL.length) { grid.innerHTML = ''; dlEmpty.style.display = 'block'; return; }
            dlEmpty.style.display = 'none';

            grid.innerHTML = withDL.map(t => {
                const d = daysUntil(t.deadline);
                const cls = d < 0 ? 'red' : d <= 3 ? 'amber' : 'green';
                const label = d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Due today' : `${d} days left`;
                const barPct = Math.max(0, Math.min(100, 100 - (d / 30 * 100)));
                const barColor = cls === 'red' ? 'var(--red)' : cls === 'amber' ? 'var(--amber)' : 'var(--green)';
                return `
      <div class="dl-card ${d <= 2 ? 'urgent' : ''}">
        <div class="dl-name">${t.name}</div>
        <div class="dl-days ${cls}">${d < 0 ? '-' + Math.abs(d) : d}</div>
        <div class="dl-days-label">${label}</div>
        <span class="tag tag-${t.cat}" style="margin-top:8px;display:inline-block;">${t.cat}</span>
        <div class="dl-bar"><div class="dl-bar-fill" style="width:${barPct}%;background:${barColor};"></div></div>
      </div>
    `;
            }).join('');
        }

        function switchTab(tab, btn) {
            document.getElementById('tab-tasks').style.display = tab === 'tasks' ? '' : 'none';
            document.getElementById('tab-deadlines').style.display = tab === 'deadlines' ? '' : 'none';
            document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (tab === 'deadlines') renderDeadlines();
        }

        function save() { localStorage.setItem('dw-tasks', JSON.stringify(tasks)); }

        // ─── POMODORO ─────────────────────────────────────────────────────────────
        const MODES = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
        let currentMode = 'focus';
        let timeLeft = MODES.focus;
        let timerRunning = false;
        let timerInterval = null;
        let completedSessions = 0;
        const CIRCUMFERENCE = 2 * Math.PI * 54;

        function setMode(mode, btn) {
            if (timerRunning) return showToast('Stop timer first');
            currentMode = mode;
            timeLeft = MODES[mode];
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('timer-mode-label').textContent = mode === 'short' ? 'short break' : mode === 'long' ? 'long break' : 'focus';
            updateTimerDisplay();
            updateRing(1);
        }

        function toggleTimer() {
            timerRunning ? stopTimer() : startTimer();
        }

        function startTimer() {
            timerRunning = true;
            document.getElementById('timer-start').textContent = '⏸ Pause';
            timerInterval = setInterval(() => {
                timeLeft--;
                updateTimerDisplay();
                updateRing(timeLeft / MODES[currentMode]);
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    timerRunning = false;
                    document.getElementById('timer-start').textContent = '▶ Start';
                    if (currentMode === 'focus') {
                        completedSessions++;
                        sessions++;
                        localStorage.setItem('dw-sessions', sessions);
                        updateStats();
                        updateSessionDots();
                        showToast('🎉 Focus session complete!');
                        try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA...').play(); } catch (e) { }
                    } else {
                        showToast('☕ Break over! Back to work.');
                    }
                    timeLeft = MODES[currentMode];
                    updateTimerDisplay();
                    updateRing(1);
                }
            }, 1000);
        }

        function stopTimer() {
            clearInterval(timerInterval);
            timerRunning = false;
            document.getElementById('timer-start').textContent = '▶ Start';
        }

        function resetTimer() {
            stopTimer();
            timeLeft = MODES[currentMode];
            updateTimerDisplay();
            updateRing(1);
        }

        function updateTimerDisplay() {
            const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
            const s = String(timeLeft % 60).padStart(2, '0');
            document.getElementById('timer-display').textContent = `${m}:${s}`;
            document.title = timerRunning ? `${m}:${s} — DeepWork` : 'DeepWork — Focus Planner';
        }

        function updateRing(frac) {
            const offset = CIRCUMFERENCE * (1 - frac);
            document.getElementById('timer-progress').style.strokeDashoffset = offset;
        }

        function updateSessionDots() {
            const el = document.getElementById('session-dots');
            const total = 4;
            el.innerHTML = Array.from({ length: total }, (_, i) =>
                `<div class="sdot ${i < completedSessions % total ? 'done' : ''}"></div>`
            ).join('');
            const cycle = Math.floor(completedSessions / total) + 1;
            document.getElementById('session-text').textContent = `Session ${completedSessions % total + 1} of 4`;
        }

        updateTimerDisplay();
        updateRing(1);
        updateSessionDots();
        renderTasks();
        updateStats();

        // ─── TOAST ───────────────────────────────────────────────────────────────
        function showToast(msg) {
            const t = document.getElementById('toast');
            t.textContent = msg;
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 2400);
        }