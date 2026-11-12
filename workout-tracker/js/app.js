const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const currentRoute = ref(window.location.pathname || '/');
    const workouts = ref([]);

    const newWorkout = ref({
      type: '',
      minutes: null,
      calories: null
    });

    // SPA-маршрутизація через History API
    const navigate = (path) => {
      window.history.pushState({}, '', path);
      currentRoute.value = path;
    };

    // Відстеження кнопок браузера «Назад» / «Вперед»
    window.addEventListener('popstate', () => {
      currentRoute.value = window.location.pathname;
    });

    // Робота з IndexedDB / LocalStorage
    const loadWorkouts = () => {
      const saved = localStorage.getItem('workouts_practice13');
      if (saved) {
        workouts.value = JSON.parse(saved);
      } else {
        workouts.value = [
          { id: 1, type: 'Біг', minutes: 25, calories: 300, date: '2026-10-26' },
          { id: 2, type: 'Плавання', minutes: 45, calories: 450, date: '2026-10-27' },
          { id: 3, type: 'Йога', minutes: 70, calories: 200, date: '2026-10-29' }
        ];
        saveWorkouts();
      }
    };

    const saveWorkouts = () => {
      localStorage.setItem('workouts_practice13', JSON.stringify(workouts.value));
    };

    const addWorkout = () => {
      if (!newWorkout.value.type || !newWorkout.value.minutes || !newWorkout.value.calories) return;

      const item = {
        id: Date.now(),
        type: newWorkout.value.type,
        minutes: newWorkout.value.minutes,
        calories: newWorkout.value.calories,
        date: new Date().toISOString().split('T')[0]
      };

      workouts.value.unshift(item);
      saveWorkouts();

      newWorkout.value = { type: '', minutes: null, calories: null };
    };

    const deleteWorkout = (id) => {
      workouts.value = workouts.value.filter(w => w.id !== id);
      saveWorkouts();
    };

    // Обчислювані властивості для статистики
    const totalWorkouts = computed(() => workouts.value.length);
    const totalMinutes = computed(() => workouts.value.reduce((sum, w) => sum + w.minutes, 0));
    const totalCalories = computed(() => workouts.value.reduce((sum, w) => sum + w.calories, 0));

    onMounted(() => {
      loadWorkouts();
    });

    return {
      currentRoute,
      workouts,
      newWorkout,
      navigate,
      addWorkout,
      deleteWorkout,
      totalWorkouts,
      totalMinutes,
      totalCalories
    };
  }
}).mount('#app');
