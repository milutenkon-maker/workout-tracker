console.log('app.js підключено (SPA Mode)');

const API_URL = '/api/workouts';

// Початкові дані
const initialWorkouts = [
  { id: 1, type: 'Біг', minutes: 25, calories: 300, date: '2026-10-26' },
  { id: 2, type: 'Плавання', minutes: 45, calories: 450, date: '2026-10-27' },
  { id: 3, type: 'Йога', minutes: 70, calories: 200, date: '2026-10-29' }
];

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];


function saveToLocalStorage(items) {
  localStorage.setItem('workouts', JSON.stringify(items));
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem('workouts');
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Пошкоджені дані в localStorage:', error);
    return [];
  }
}

function syncLocalStorage(items) {
  saveToLocalStorage(items);
}

const DB_NAME = 'WorkoutDB';
const DB_VERSION = 1;
const STORE_NAME = 'workouts';
const KEY_PATH = 'id';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('IndexedDB недоступна в цьому браузері.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: KEY_PATH, autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function addItemDB(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllItemsDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Пошук за ID
async function getItemByID(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const numericId = !isNaN(Number(id)) ? Number(id) : id;
    const request = tx.objectStore(STORE_NAME).get(numericId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteItemDB(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const numericId = !isNaN(Number(id)) ? Number(id) : id;
    tx.objectStore(STORE_NAME).delete(numericId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function migrateFromLocalStorage() {
  const isMigrated = localStorage.getItem('migratedWorkouts');
  if (isMigrated) return;

  const localData = loadFromLocalStorage();
  const dbData = await getAllItemsDB();

  if (dbData.length === 0 && localData.length > 0) {
    for (const item of localData) {
      await addItemDB(item);
    }
    console.log('Міграцію з localStorage в IndexedDB успішно виконано');
  }

  localStorage.setItem('migratedWorkouts', 'true');
}

let vm = null;
let appInstance = null; // Посилання на Vue App для розмонтування

const WorkoutRow = {
  props: ['id', 'type', 'minutes', 'calories', 'details'],
  computed: {
    caloriesPerMinute() {
      if (this.minutes > 0 && this.calories > 0) {
        return (this.calories / this.minutes).toFixed(1);
      }
      return null;
    },
    lengthClass() {
      return this.minutes > 45 ? 'long' : 'short';
    }
  },
  methods: {
    async removeSelf() {
      await deleteItemDB(this.id);
      await refreshUI();
    }
  },
  template: `
  <article :class="lengthClass" :data-calories="calories">
    <h3>{{ type }}</h3>
    <p v-if="details">{{ details }}</p>
    <p v-else>{{ minutes }} хв, {{ calories }} ккал</p>
    <p v-if="caloriesPerMinute">{{ caloriesPerMinute }} ккал/хв</p>
    <a :href="'/workouts/' + id" data-link class="btn-primary" style="display:inline-block; margin-top:5px; margin-right:8px; text-decoration:none; font-size:0.85em; padding:4px 8px;">Детальніше</a>
    <button type="button" class="btn-delete" @click="removeSelf">Видалити</button>
  </article>`
};

function mountVueApp() {
  const appEl = document.querySelector('#app');
  if (!appEl) return;

  if (appInstance) {
    appInstance.unmount();
    appInstance = null;
    vm = null;
  }

  appInstance = Vue.createApp({
    components: { WorkoutRow },
    data() {
      return { workouts: [] };
    },
    computed: {
      totalCalories() {
        return this.workouts.reduce((sum, w) => sum + (w.calories || 0), 0);
      }
    }
  });

  vm = appInstance.mount('#app');
}

function getWorkoutDate(w) {
  if (w.date) {
    return new Date(w.date + 'T00:00:00');
  }
  if (w.id > 1e12) {
    return new Date(w.id);
  }
  return null;
}

function getMinutesByWeekday(workouts) {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  workouts.forEach((w) => {
    const d = getWorkoutDate(w);
    if (!d || isNaN(d)) return;
    const index = (d.getDay() + 6) % 7;
    totals[index] += Number(w.minutes) || 0;
  });
  return totals;
}

function drawChart(workouts) {
  const chartCanvas = document.querySelector('#workoutChart');
  if (!chartCanvas) return; // Захист від помилок, якщо Canvas не в DOM
  const ctx = chartCanvas.getContext('2d');

  const totals = getMinutesByWeekday(workouts);
  const padding = { top: 30, right: 20, bottom: 40, left: 20 };
  const chartWidth = chartCanvas.width - padding.left - padding.right;
  const chartHeight = chartCanvas.height - padding.top - padding.bottom;

  ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);

  const maxValue = Math.max(...totals);
  if (maxValue === 0) {
    ctx.fillStyle = '#777';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Поки немає тренувань з датою', chartCanvas.width / 2, chartCanvas.height / 2);
    return;
  }

  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + chartHeight);
  ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
  ctx.stroke();

  const slotWidth = chartWidth / totals.length;
  const barWidth = slotWidth * 0.6;

  totals.forEach((minutes, i) => {
    const barHeight = (minutes / maxValue) * chartHeight;
    const x = padding.left + i * slotWidth + (slotWidth - barWidth) / 2;
    const y = padding.top + chartHeight - barHeight;

    ctx.fillStyle = '#2f7d32';
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = '#333';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(DAY_LABELS[i], x + barWidth / 2, padding.top + chartHeight + 22);

    if (minutes > 0) {
      ctx.fillText(minutes + ' хв', x + barWidth / 2, y - 6);
    }
  });
}

async function refreshUI() {
  const items = await getAllItemsDB();
  if (vm && document.querySelector('#app')) {
    vm.workouts = items;
  }
  syncLocalStorage(items);
  drawChart(items);
}

function showErrorMessage(message) {
  const errorEl = document.querySelector('#error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
}

function bindFormEvents() {
  const form = document.querySelector('.workout-form');
  const typeInput = document.querySelector('#workout-type');
  const dateInput = document.querySelector('#workout-date');
  const minutesInput = document.querySelector('#workout-minutes');
  const caloriesInput = document.querySelector('#workout-calories');
  const calcResultElem = document.querySelector('#calories-per-minute');

  if (dateInput) dateInput.valueAsDate = new Date();

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const newWorkout = {
        id: Date.now(),
        type: typeInput.value,
        minutes: Number(minutesInput.value),
        calories: Number(caloriesInput.value),
        date: dateInput.value
      };

      await addItemDB(newWorkout);
      await refreshUI();

      form.reset();
      if (dateInput) dateInput.valueAsDate = new Date();
      if (calcResultElem) calcResultElem.textContent = '0';
    });
  }

  const refreshBtn = document.querySelector('#refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadWorkouts);
  }
}

async function loadWorkouts() {
  const loadingEl = document.querySelector('#loading');
  const refreshBtn = document.querySelector('#refreshBtn');
  if (loadingEl) loadingEl.hidden = false;
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`Код: ${response.status}`);
    const data = await response.json();

    for (const item of data) {
      await addItemDB({
        id: item.id,
        type: item.type,
        minutes: item.minutes,
        calories: item.calories,
        details: item.details || 'З власного API',
        date: item.date
      });
    }
    await refreshUI();
  } catch (error) {
    showErrorMessage('Журнал тренувань недоступний офлайн');
  } finally {
    if (loadingEl) loadingEl.hidden = true;
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

// маршрутизація та рендеринг сторінок

let rootContainer = null;

// Пошук маршруту та параметрів
const routes = [
  { path: '/', view: renderWorkoutList },
  { path: '/workouts/:id', view: renderWorkoutDetail },
  { path: '/stats', view: renderStats }
];

function matchRoute(path) {
  const pathParts = path.split('/').filter(Boolean);

  for (const route of routes) {
    const routeParts = route.path.split('/').filter(Boolean);

    if (routeParts.length !== pathParts.length) continue;

    const params = {};
    const isMatch = routeParts.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = pathParts[i];
        return true;
      }
      return part === pathParts[i];
    });

    if (isMatch) return { view: route.view, params };
  }
  return null;
}

// Очищення перед зміною сторінки
function clearCurrentView() {
  if (appInstance) {
    appInstance.unmount();
    appInstance = null;
    vm = null;
  }
}

async function renderWorkoutList() {
  clearCurrentView();

  rootContainer.innerHTML = `
    <div class="layout">
        <main>
            <section id="workout-form">
                <h2>Форма додавання тренування</h2>
                <form class="workout-form">
                    <div class="form-group">
                        <label for="workout-type">Тип тренування</label>
                        <select id="workout-type" name="workout-type" required>
                            <option value="">-- Оберіть тип --</option>
                            <option value="Силове">Силове</option>
                            <option value="Кардіо">Кардіо</option>
                            <option value="Біг">Біг</option>
                            <option value="Йога">Йога</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="workout-date">Дата</label>
                        <input type="date" id="workout-date" name="workout-date" required>
                    </div>

                    <div class="form-group">
                        <label for="workout-minutes">Тривалість (хвилин)</label>
                        <input type="number" id="workout-minutes" name="workout-minutes" min="1" required placeholder="Наприклад: 45">
                    </div>

                    <div class="form-group">
                        <label for="workout-calories">Спалені калорії (ккал)</label>
                        <input type="number" id="workout-calories" name="workout-calories" min="1" required placeholder="Наприклад: 300">
                    </div>

                    <button type="submit" class="btn-primary">Додати тренування</button>
                </form>
            </section>

            <section id="list-of-workouts">
                <h2>Історія тренувань</h2>
                <button id="refreshBtn" type="button" class="btn-primary">Оновити з API</button>
                <p id="loading" hidden>Завантаження…</p>
                <p id="error" hidden></p>

                <section id="chart-section">
                    <h2>Тривалість тренувань за днями тижня</h2>
                    <canvas id="workoutChart" width="600" height="300"></canvas>
                </section>

                <div id="app">
                    <div class="cards">
                        <workout-row
                            v-for="w in workouts"
                            :key="w.id"
                            :id="w.id"
                            :type="w.type"
                            :minutes="w.minutes"
                            :calories="w.calories"
                            :details="w.details">
                        </workout-row>
                    </div>
                    <p id="total-calories">Загалом спалено калорій: {{ totalCalories }}</p>
                </div>
            </section>
        </main>
    </div>`;

  mountVueApp();
  bindFormEvents();
  await refreshUI();
}

async function renderWorkoutDetail(params) {
  clearCurrentView();
  const workout = await getItemByID(params.id);

  if (!workout) {
    renderNotFound();
    return;
  }

  rootContainer.innerHTML = `
    <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ccc; border-radius: 8px; background: #fff;">
      <h2> Деталі тренування #${workout.id}</h2>
      <hr>
      <p><strong>Вид тренування:</strong> ${workout.type}</p>
      <p><strong>Тривалість:</strong> ${workout.minutes} хвилин</p>
      <p><strong>Спалено калорій:</strong> ${workout.calories} ккал</p>
      <p><strong>Дата:</strong> ${workout.date || 'Не вказана'}</p>
      <p><strong>Нотатки/Деталі:</strong> ${workout.details || 'Відсутні'}</p>
      <br>
      <a href="/" data-link class="btn-primary" style="text-decoration:none; padding:8px 15px;">← Повернутися до журналу</a>
    </div>`;
}

async function renderStats() {
  clearCurrentView();
  const workouts = await getAllItemsDB();
  const totalMinutes = workouts.reduce((sum, w) => sum + (Number(w.minutes) || 0), 0);
  const totalCalories = workouts.reduce((sum, w) => sum + (Number(w.calories) || 0), 0);

  rootContainer.innerHTML = `
    <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #2f7d32; border-radius: 8px; background: #f9f9f9;">
      <h2> Загальна статистика занять</h2>
      <p>Кількість тренувань: <strong>${workouts.length}</strong></p>
      <p>Сумарний час: <strong>${totalMinutes} хв</strong> (${(totalMinutes / 60).toFixed(1)} год)</p>
      <p>Спалено калорій: <strong>${totalCalories} ккал</strong></p>
      <br>
      <a href="/" data-link class="btn-primary" style="text-decoration:none; padding:8px 15px;">← На головну</a>
    </div>`;
}

function renderNotFound() {
  clearCurrentView();
  rootContainer.innerHTML = `
    <div style="max-width: 600px; margin: 50px auto; text-align: center; width: 100%;">
      <h1 style="color: red;">404 - Сторінку не знайдено</h1>
      <p>Зазначений шлях відсутній у застосунку.</p>
      <a href="/" data-link class="btn-primary" style="text-decoration:none; display:inline-block; margin-top:10px;">Повернутися на головну</a>
    </div>`;
}

async function router() {
  let path = window.location.pathname;

  if (path.endsWith('index.html') || path === '') {
    path = '/';
  }

  const match = matchRoute(path);

  if (match) {
    await match.view(match.params);
  } else {
    renderNotFound();
  }
}

// Перехід без перезавантаження
function navigate(path) {
  window.history.pushState(null, '', path);
  router();
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-link]');
  if (link) {
    event.preventDefault(); // скасування перезавантаження сторінки
    navigate(link.getAttribute('href'));
  }
});

window.addEventListener('popstate', router);

async function initApp() {
  rootContainer = document.getElementById('app-root');
  try {
    if (!localStorage.getItem('workouts')) {
      saveToLocalStorage(initialWorkouts);
    }
    await migrateFromLocalStorage();

    let items = await getAllItemsDB();
    if (items.length === 0) {
      for (const item of initialWorkouts) {
        await addItemDB(item);
      }
    }

    await router();
  } catch (error) {
    console.error('Помилка ініціалізації:', error);
  }
}

document.addEventListener('DOMContentLoaded', initApp);