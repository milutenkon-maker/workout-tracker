const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Масив тренувань
const workouts = [
  { id: 1, type: 'Біг', minutes: 25, calories: 300, date: '2026-10-26' },
  { id: 2, type: 'Плавання', minutes: 45, calories: 450, date: '2026-10-27' },
  { id: 3, type: 'Йога', minutes: 70, calories: 200, date: '2026-10-29' },
  { id: 4, type: 'Силове тренування', minutes: 60, calories: 500, date: '2026-11-02' },
  { id: 5, type: 'Кардіо', minutes: 30, calories: 250, date: '2026-11-05' }
];

// Реалізація ендпоінту списку
app.get('/api/workouts', (req, res) => {
  const weekQuery = req.query.week;
  if (weekQuery) {
    const filtered = workouts.filter(w => w.date && w.date.startsWith(weekQuery));
    return res.json(filtered);
  }
  res.json(workouts);
});


// Повертаємо конкретне тренування за ID (або 404, якщо не знайдено)
app.get('/api/workouts/:id', (req, res) => {
  const numericId = Number(req.params.id);
  const workout = workouts.find(w => w.id === numericId);

  if (!workout) {
    return res.status(404).json({ error: 'Тренування з таким ID не знайдено' });
  }

  res.json(workout);
});

// Роздача HTML/CSS/JS з поточної папки
app.use(express.static(__dirname));

// Підтримка SPA History API (перенаправлення всіх інших маршрутів на index.html)
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});



// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущено на http://localhost:${PORT}`);
});
