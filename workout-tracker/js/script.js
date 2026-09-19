
console.log('script.js підключено');

//  Оголошення даних
const workouts = [
  { type: 'Біг', minutes: 25, calories: 300 },
  { type: 'Плавання', minutes: 45, calories: 450 },
  { type: 'Йога', minutes: 70, calories: 200 }
];

// Цикл for...of, який підсумовує загальну кількість спалених калорій
let totalCalories = 0;

for (const w of workouts) {
  totalCalories += w.calories;

  // Умовна класифікація тренування за тривалістю
  if (w.minutes < 30 && w.minutes > 0) {
    console.log(`${w.type}: Тренування є коротким`);
  } else if (w.minutes >= 30 && w.minutes <= 60) {
    console.log(`${w.type}: Тренування є довгим`);
  } else {
    console.log(`${w.type}: Тренування є дуже довгим`);
  }
}

console.log(`Загальна кількість спалених калорій: ${totalCalories}`);

// Стрілкова функція для обчислення спалених калорій за хвилину
// Функція приймає об'єкт тренування та повертає кількість калорій/хв
const caloriesPerMinute = w => Math.round(w.calories / w.minutes);

// Крок 7: Виклик стрілкової функції з реальними даними
console.log(`Калорій за хвилину (біг): ${caloriesPerMinute(workouts[0])}`);
console.log(`Калорій за хвилину (тестове): ${caloriesPerMinute({ calories: 500, minutes: 30 })}`);