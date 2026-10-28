console.log('app.js підключено');

const API_URL = 'https://jsonplaceholder.typicode.com/todos?userId=4';

// Початкові дані 
const initialWorkouts = [
  { id: 1, type: 'Біг',      minutes: 25, calories: 300, date: '2026-10-26' },
  { id: 2, type: 'Плавання', minutes: 45, calories: 450, date: '2026-10-27' },
  { id: 3, type: 'Йога',     minutes: 70, calories: 200, date: '2026-10-29' }
];


const chartCanvas = document.querySelector('#workoutChart');
const ctx = chartCanvas.getContext('2d');
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

async function deleteItemDB(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
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
      <button type="button" class="btn-delete" @click="removeSelf">Видалити</button>
    </article>`
};

const vm = Vue.createApp({
  components: { WorkoutRow },
  data() {
    return {
      workouts: []
    };
  },
  computed: {
    totalCalories() {
      return this.workouts.reduce((sum, w) => sum + (w.calories || 0), 0);
    }
  }
}).mount('#app');



// Повертає дату тренування або null, якщо визначити її неможливо
function getWorkoutDate(w) {
  if (w.date) {
    // 'YYYY-MM-DD' + 'T00:00:00' -> північ за локальним часом (без зсуву дня)
    return new Date(w.date + 'T00:00:00');
  }
  if (w.id > 1e12) {
    return new Date(w.id);
  }
  return null;
}

// Сума хвилин для кожного дня тижня
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

// Малює стовпчикову діаграму за масивом тренувань
function drawChart(workouts) {
  const totals = getMinutesByWeekday(workouts);

  // Відступи від країв полотна (знизу під підписи, зверху під числа)
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

  // 3. Вісь X
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + chartHeight);
  ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
  ctx.stroke();

  // 4. Стовпчики: цикл по 7 днях
  const slotWidth = chartWidth / totals.length;
  const barWidth = slotWidth * 0.6;

  totals.forEach((minutes, i) => {
    const barHeight = (minutes / maxValue) * chartHeight;   // пропорційно до максимуму
    const x = padding.left + i * slotWidth + (slotWidth - barWidth) / 2;
    const y = padding.top + chartHeight - barHeight;        // y росте вниз

    // Стовпчик
    ctx.fillStyle = '#2f7d32';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Підпис дня
    ctx.fillStyle = '#333';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(DAY_LABELS[i], x + barWidth / 2, padding.top + chartHeight + 22);

    // Хвилини над стовпчиком
    if (minutes > 0) {
      ctx.fillText(minutes + ' хв', x + barWidth / 2, y - 6);
    }
  });
}



async function refreshUI() {
  const items = await getAllItemsDB();
  vm.workouts = items;
  syncLocalStorage(items);
  drawChart(items);   // діаграма перемальовується при кожній зміні даних
}

function showErrorMessage(message) {
  const errorEl = document.querySelector('#error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
}

async function initApp() {
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

    await refreshUI();

  } catch (error) {
    console.error('Помилка відкриття сховища:', error);
    showErrorMessage('Помилка сховища! Переконайтеся, що ви не перебуваєте в режимі приватного перегляду.');
  }
}


const form = document.querySelector('.workout-form');
const typeInput = document.querySelector('#workout-type');
const dateInput = document.querySelector('#workout-date');
const minutesInput = document.querySelector('#workout-minutes');
const caloriesInput = document.querySelector('#workout-calories');
const calcResultElem = document.querySelector('#calories-per-minute');

// Ставить у поле дати сьогоднішню дату
function setTodayInDateInput() {
  if (dateInput) dateInput.valueAsDate = new Date();
}
setTodayInDateInput();

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const newWorkout = {
      id: Date.now(),
      type: typeInput.value,
      minutes: Number(minutesInput.value),
      calories: Number(caloriesInput.value),
      date: dateInput.value            // формат 'YYYY-MM-DD'
    };

    await addItemDB(newWorkout);
    await refreshUI();

    form.reset();
    setTodayInDateInput();             // reset очищає дату, повертаємо сьогодні
    if (calcResultElem) calcResultElem.textContent = '0';
  });
}


function showLoading(isLoading) {
  const loadingEl = document.querySelector('#loading');
  const refreshBtn = document.querySelector('#refreshBtn');
  if (loadingEl) loadingEl.hidden = !isLoading;
  if (refreshBtn) refreshBtn.disabled = isLoading;
}

async function loadWorkouts() {
  showLoading(true);
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
        date: new Date().toISOString().slice(0, 10)   // сьогодні
      });
    }
    await refreshUI();
  } catch (error) {
    showErrorMessage('Журнал тренувань недоступний офлайн');
  } finally {
    showLoading(false);
  }
}

const refreshBtn = document.querySelector('#refreshBtn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', loadWorkouts);
}

document.addEventListener('DOMContentLoaded', initApp);