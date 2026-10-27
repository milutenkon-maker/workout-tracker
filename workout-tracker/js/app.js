
console.log('app.js підключено');

const API_URL = 'https://jsonplaceholder.typicode.com/todos?userId=4';


const initialWorkouts = [
  { id: 1, type: 'Біг', minutes: 25, calories: 300 },
  { id: 2, type: 'Плавання', minutes: 45, calories: 450 },
  { id: 3, type: 'Йога', minutes: 70, calories: 200 }
];


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

// Перевести рендер на дані з IndexedDB
async function refreshUI() {
  const items = await getAllItemsDB();
  vm.workouts = items;
  syncLocalStorage(items); // Синхронізація для Кроку 3
}

// Обробка помилки відкриття бази
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

// Виклик Кроку 8: міграція
    await migrateFromLocalStorage();

    let items = await getAllItemsDB();
    if (items.length === 0) {
      for (const item of initialWorkouts) {
        await addItemDB(item);
      }
    }

// Виклик Кроку 9: завантаження в DOM
    await refreshUI();

  } catch (error) {
    console.error('Помилка відкриття сховища:', error);
    showErrorMessage('Помилка сховища! Переконайтеся, що ви не перебуваєте в режимі приватного перегляду.');
  }
}

// Форма та обробники дій користувача
const form = document.querySelector('.workout-form');
const typeInput = document.querySelector('#workout-type');
const minutesInput = document.querySelector('#workout-minutes');
const caloriesInput = document.querySelector('#workout-calories');
const calcResultElem = document.querySelector('#calories-per-minute');

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const newWorkout = {
      id: Date.now(),
      type: typeInput.value,
      minutes: Number(minutesInput.value),
      calories: Number(caloriesInput.value)
    };

    await addItemDB(newWorkout);
    await refreshUI();

    form.reset();
    if (calcResultElem) calcResultElem.textContent = '0';
  });
}

// Завантаження з API
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
        details: item.completed ? 'Виконано' : 'Не виконано'
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