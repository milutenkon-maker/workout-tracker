console.log('script.js підключено');

// Крок 1. Оголошення даних (масив тренувань)
const workouts = [
  { type: 'Біг', minutes: 25, calories: 300 },
  { type: 'Плавання', minutes: 45, calories: 450 },
  { type: 'Йога', minutes: 70, calories: 200 }
];

// Видалення статичного прикладу
const staticCard = document.querySelector('#list-of-workouts article');
if (staticCard) {
  staticCard.remove();
}

// Пошук контейнера для виводу карток тренувань
const listContainer = document.querySelector('#list-of-workouts .cards');

// Функція рендеру
function renderWorkouts(items) {
  if (!listContainer) return;

  listContainer.innerHTML = ''; // Очищення контейнеру

  for (const w of items) {
    const card = document.createElement('article');

    const title = document.createElement('h3');
    title.textContent = w.type;

    const details = document.createElement('p');
    details.textContent = `${w.minutes} хв, ${w.calories} ккал`;

    card.append(title, details);

    card.dataset.calories = w.calories;

    if (w.minutes > 45) {
      card.classList.add('long');
    } else {
      card.classList.add('short');
    }

    listContainer.append(card);
  }
}

// Початковий рендер списку
renderWorkouts(workouts);

// Підсумковий елемент калорій
const totalCaloriesElem = document.querySelector('#total-calories');
if (totalCaloriesElem) {
  const totalCalories = workouts.reduce((sum, item) => sum + item.calories, 0);
  totalCaloriesElem.textContent = `Загалом спалено калорій: ${totalCalories}`;
}


// Вибір елементів форми
const form = document.querySelector('.workout-form');
const typeInput = document.querySelector('#workout-type');
const minutesInput = document.querySelector('#workout-minutes');
const caloriesInput = document.querySelector('#workout-calories');
const calcResultElem = document.querySelector('#calories-per-minute');


// Обробка сабміту форми
form.addEventListener('submit', (event) => {
  // Скасування перезавантаження
  event.preventDefault();

  // Зчитати значення полів
  const type = typeInput.value;
  const minutes = Number(minutesInput.value);
  const calories = Number(caloriesInput.value);

  // Створити об'єкт та додати в масив
  const newWorkout = {
    type: type,
    minutes: minutes,
    calories: calories
  };
  workouts.push(newWorkout);

  // Перемалювати список та оновити підсумок
  renderWorkouts(workouts);

  if (totalCaloriesElem) {
    const totalCalories = workouts.reduce((sum, item) => sum + item.calories, 0);
    totalCaloriesElem.textContent = `Загалом спалено калорій: ${totalCalories}`;
  }

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
    caloriesInput.setCustomValidity(''); // Порожній рядок скидає помилку!
  }
});


// перерахунок ккал/хв
function updateCaloriesPerMinute() {
  const minutes = Number(minutesInput.value);
  const calories = Number(caloriesInput.value);

  if (minutes > 0 && calories > 0) {
    const rate = (calories / minutes).toFixed(1);
    calcResultElem.textContent = rate;
  } else {
    calcResultElem.textContent = '0';
  }
}

minutesInput.addEventListener('input', updateCaloriesPerMinute);
caloriesInput.addEventListener('input', updateCaloriesPerMinute);