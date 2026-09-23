console.log('script.js підключено');

// Крок 1. Оголошення даних (масив тренувань)
const workouts = [
  { type: 'Біг', minutes: 25, calories: 300 },
  { type: 'Плавання', minutes: 45, calories: 450 },
  { type: 'Йога', minutes: 70, calories: 200 }
];


const staticCard = document.querySelector('#workouts-list article');
if (staticCard) {
  staticCard.remove();
}


const listContainer = document.querySelector('#workouts-list');


function renderWorkouts(items) { // Запускаємо малювання списку при завантаженні сторінки
  if (!listContainer) return;

  listContainer.innerHTML = ''; // Очищення контейнеру


  for (const w of items) {

    const card = document.createElement('article');

    const title = document.createElement('h3');
    title.textContent = w.type;

    const details = document.createElement('p');
    details.textContent = `\({w.minutes} хв,\){w.calories} ккал`;

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


renderWorkouts(workouts);


const totalCaloriesElem = document.querySelector('#total-calories');
if (totalCaloriesElem) {
  const totalCalories = workouts.reduce((sum, item) => sum + item.calories, 0);
  totalCaloriesElem.textContent = `Загалом спалено калорій: ${totalCalories}`;
}