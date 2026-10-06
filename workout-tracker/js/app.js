
// Обрано Vue 3: шаблон схожий на звичайний HTML, а дані можна змінювати напряму,
// тому код з практикуму 7 переносити легше, ніж у React (без JSX і Babel).

console.log('app.js підключено');

const API_URL = 'https://jsonplaceholder.typicode.com/todos?userId=4';

// Функцію renderWorkouts (практикум 7) видалено: список тепер малює
// компонент WorkoutRow через v-for, а сума калорій - це computed totalCalories.


const WorkoutRow = {
  props: ['type', 'minutes', 'calories', 'details'],
  computed: {
    // Похідне значення варіанта 19: калорії за хвилину
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
  template: `
    <article :class="lengthClass" :data-calories="calories">
      <h3>{{ type }}</h3>
      <p v-if="details">{{ details }}</p>
      <p v-else>{{ minutes }} хв, {{ calories }} ккал</p>
      <p v-if="caloriesPerMinute">{{ caloriesPerMinute }} ккал/хв</p>
    </article>`
};


const vm = Vue.createApp({
  components: { WorkoutRow },

  data() {
    return {
      workouts: [
        { id: 1, type: 'Біг',      minutes: 25, calories: 300 },
        { id: 2, type: 'Плавання', minutes: 45, calories: 450 },
        { id: 3, type: 'Йога',     minutes: 70, calories: 200 }
      ]
    };
  },

  computed: {
    totalCalories() {
      return this.workouts.reduce((sum, w) => sum + (w.calories || 0), 0);
    }
  }
}).mount('#app');


function showLoading(isLoading) {
  document.querySelector('#loading').hidden = !isLoading;
  document.querySelector('#refreshBtn').disabled = isLoading;
}

function showError(message) {
  const errorEl = document.querySelector('#error');
  errorEl.textContent = message;
  errorEl.hidden = false;
}

// Завантаження журналу тренувань з JSONPlaceholder:
// https://jsonplaceholder.typicode.com/
async function loadWorkouts() {
  showLoading(true);
  document.querySelector('#error').hidden = true;

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Сервер відповів кодом ${response.status}`);
    }

    const data = await response.json();
    console.log(data);

    // Присвоєння нового масиву реактивне: Vue сам перемалює список
    vm.workouts = data.map(item => ({
      id: item.id,
      type: item.title,
      details: item.completed ? 'Виконано' : 'Не виконано'
    }));
  } catch (error) {
    showError('Журнал тренувань недоступний офлайн');
    console.error(error);
  } finally {
    showLoading(false);
  }
}


const form = document.querySelector('.workout-form');
const typeInput = document.querySelector('#workout-type');
const minutesInput = document.querySelector('#workout-minutes');
const caloriesInput = document.querySelector('#workout-calories');
const calcResultElem = document.querySelector('#calories-per-minute');

form.addEventListener('submit', (event) => {
  // Скасування перезавантаження сторінки
  event.preventDefault();

  const type = typeInput.value;
  const minutes = Number(minutesInput.value);
  const calories = Number(caloriesInput.value);

  // Пряма зміна реактивного масиву: Vue сам додасть картку і перерахує суму
  vm.workouts.push({ id: Date.now(), type, minutes, calories });

  // Очистити форму
  form.reset();
  if (calcResultElem) {
    calcResultElem.textContent = '0'; // Скидаємо розраховані ккал/хв
  }
});

// Валідація калорій
caloriesInput.addEventListener('input', () => {
  const caloriesVal = Number(caloriesInput.value);

  if (caloriesInput.value !== '' && (caloriesVal <= 0 || caloriesVal > 2000)) {
    caloriesInput.setCustomValidity('Кількість калорій має бути від 1 до 2000 ккал!');
  } else {
    caloriesInput.setCustomValidity('');
  }
});

// Перерахунок ккал/хв під час введення в форму
function updateCaloriesPerMinute() {
  const minutes = Number(minutesInput.value);
  const calories = Number(caloriesInput.value);

  if (minutes > 0 && calories > 0) {
    calcResultElem.textContent = (calories / minutes).toFixed(1);
  } else {
    calcResultElem.textContent = '0';
  }
}

minutesInput.addEventListener('input', updateCaloriesPerMinute);
caloriesInput.addEventListener('input', updateCaloriesPerMinute);

// ---------- Запуск ----------
document.querySelector('#refreshBtn').addEventListener('click', loadWorkouts);
loadWorkouts();
