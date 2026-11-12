console.log('app.js підключено');

const API_URL = 'https://jsonplaceholder.typicode.com/todos?userId=4';

const initialWorkouts = [
  { id: 1, type: 'Біг', minutes: 25, calories: 300, date: '2026-10-26' },
  { id: 2, type: 'Плавання', minutes: 45, calories: 450, date: '2026-10-27' },
  { id: 3, type: 'Йога', minutes: 70, calories: 200, date: '2026-10-29' }
];

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

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

async function getItemById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(Number(id));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteItemDB(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

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

async function migrateFromLocalStorage() {
  const isMigrated = localStorage.getItem('migratedWorkouts');
  if (isMigrated) return;

  const localData = loadFromLocalStorage();
  const dbData = await getAllItemsDB();

  if (dbData.length === 0 && localData.length > 0) {
    for (const item of localData) {
      await addItemDB(item);
    }
  }
  localStorage.setItem('migratedWorkouts', 'true');
}

function getWorkoutDate(w) {
  if (w.date) return new Date(w.date + 'T00:00:00');
  if (w.id > 1e12) return new Date(w.id);
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
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext('2d');

  const padding = { top: 30, right: 20, bottom: 40, left: 20 };
  const chartWidth = chartCanvas.width - padding.left - padding.right;
  const chartHeight = chartCanvas.height - padding.top - padding.bottom;

  ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
  const totals = getMinutesByWeekday(workouts);
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

let vueApp = null;
let vm = null;

const WorkoutRow = {
  props: ['id', 'type', 'minutes', 'calories', 'details'],
  computed: {
    caloriesPerMinute() {
      return (this.minutes > 0 && this.calories > 0) ? (this.calories / this.minutes).toFixed(1) : null;
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
      <h3>
        <a :href="'/workouts/' + id" data-link>{{ type }}</a>
      </h3>
      <p v-if="details">{{ details }}</p>
      <p v-else>{{ minutes }} хв, {{ calories }} ккал</p>
      <p v-if="caloriesPerMinute">{{ caloriesPerMinute }} ккал/хв</p>
      <button type="button" class="btn-delete" @click="removeSelf">Видалити</button>
    </article>`
};

function mountVueApp() {
  if (vueApp) {
    vueApp.unmount();
  }
  vueApp = Vue.createApp({
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
  vm = vueApp.mount('#app');
}

async function refreshUI() {
  const items = await getAllItemsDB();
  if (vm) vm.workouts = items;
  saveToLocalStorage(items);
  drawChart(items);
}

// --- SPA РОУТЕР (History API) ---
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

function navigate(path) {
  window.history.pushState(null, '', path);
  router();
}

async function router() {
  const rootContainer = document.querySelector('#app-root');
  if (!rootContainer) return;

  const path = window.location.pathname;
  const match = matchRoute(path);

  if (match) {
    await match.view(match.params);
  } else {
    renderNotFound();
  }
}

// --- VIEW ФУНКЦІЇ ---
async function renderWorkoutList() {
  const rootContainer = document.querySelector('#app-root');
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
              <input type="number" id="workout-minutes" name="workout-minutes" placeholder="Наприклад: 45" required>
            </div>
            <div class="form-group">
              <label for="workout-calories">Спалені калорії (ккал)</label>
              <input type="number" id="workout-calories" name="workout-calories" placeholder="Наприклад: 300" required>
            </div>
            <button type="submit" class="btn-primary">Додати тренування</button>
          </form>
        </section>

        <section id="workout-list">
          <h2>Історія тренувань</h2>
          <button id="refreshBtn" type="button" class="btn-primary">Оновити з API</button>
          <div id="loading" hidden>Завантаження...</div>
          <div id="error" hidden style="color: red;"></div>

          <div id="app">
            <workout-row
              v-for="item in workouts"
              :key="item.id"
              :id="item.id"
              :type="item.type"
              :minutes="item.minutes"
              :calories="item.calories"
              :details="item.details"
            ></workout-row>
            <p id="total-calories">Загалом спалено калорій: {{ totalCalories }}</p>
          </div>
        </section>

        <section id="chart-section">
          <h2>Тривалість тренувань за днями тижня</h2>
          <canvas id="workoutChart" width="600" height="300"></canvas>
        </section>
      </main>
    </div>`;

  mountVueApp();
  bindEvents();
  await refreshUI();
}

async function renderWorkoutDetail(params) {
  const rootContainer = document.querySelector('#app-root');
  const workout = await getItemById(params.id);

  if (!workout) {
    renderNotFound();
    return;
  }

  rootContainer.innerHTML = `
    <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ccc; border-radius: 8px; background: #fff;">
      <h2>Деталі тренування #${workout.id}</h2>
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
  const rootContainer = document.querySelector('#app-root');
  const workouts = await getAllItemsDB();

  const totalMinutes = workouts.reduce((sum, w) => sum + (Number(w.minutes) || 0), 0);
  const totalCalories = workouts.reduce((sum, w) => sum + (Number(w.calories) || 0), 0);

  rootContainer.innerHTML = `
    <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #2f7d32; border-radius: 8px;">
      <h2>Загальна статистика занять</h2>
      <p>Кількість тренувань: <strong>${workouts.length}</strong></p>
      <p>Сумарний час: <strong>${totalMinutes} хв</strong> (${(totalMinutes / 60).toFixed(1)} год)</p>
      <p>Спалено калорій: <strong>${totalCalories} ккал</strong></p>
      <br>
      <a href="/" data-link class="btn-primary" style="text-decoration:none;">← На головну</a>
    </div>`;
}

function renderNotFound() {
  const rootContainer = document.querySelector('#app-root');
  rootContainer.innerHTML = `
    <div style="text-align: center; margin-top: 50px;">
      <h1 style="color: red;">404 - Сторінку не знайдено</h1>
      <p>Зазначений шлях відсутній у застосунку.</p>
      <a href="/" data-link class="btn-primary" style="text-decoration:none;">Повернутися на головну</a>
    </div>`;
}

function bindEvents() {
  const form = document.querySelector('.workout-form');
  const dateInput = document.querySelector('#workout-date');
  if (dateInput) dateInput.valueAsDate = new Date();

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const newWorkout = {
        id: Date.now(),
        type: document.querySelector('#workout-type').value,
        minutes: Number(document.querySelector('#workout-minutes').value),
        calories: Number(document.querySelector('#workout-calories').value),
        date: dateInput.value
      };
      await addItemDB(newWorkout);
      await refreshUI();
      form.reset();
      if (dateInput) dateInput.valueAsDate = new Date();
    });
  }

  const refreshBtn = document.querySelector('#refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Код: ${response.status}`);
        const data = await response.json();
        for (const item of data) {
          await addItemDB({
            id: item.id,
            type: item.title,
            minutes: 30,
            calories: item.completed ? 300 : 150,
            details: item.completed ? 'Виконано' : 'Не виконано',
            date: new Date().toISOString().slice(0, 10)
          });
        }
        await refreshUI();
      } catch (error) {
        console.error('Помилка API:', error);
      }
    });
  }
}

// --- ГЛОБАЛЬНІ СЛУХАЧІ ІНІЦІАЛІЗАЦІЇ ---
window.addEventListener('popstate', router);

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-link]');
  if (link) {
    event.preventDefault();
    navigate(link.getAttribute('href'));
  }
});

async function initApp() {
  try {
    if (!localStorage.getItem('workouts')) {
      saveToLocalStorage(initialWorkouts);
    }
    await migrateFromLocalStorage();

    const items = await getAllItemsDB();
    if (items.length === 0) {
      await Promise.all(initialWorkouts.map(item => addItemDB(item)));
    }

    await router();
  } catch (error) {
    console.error('Помилка ініціалізації:', error);
  }
}

document.addEventListener('DOMContentLoaded', initApp);
