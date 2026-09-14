// Элементы таймера и статуса
const startBtn = document.getElementById('start-shift');
const endBtn = document.getElementById('end-shift');
const statusMessage = document.getElementById('status-message');

// Элементы истории и расчета
const historyContainer = document.getElementById('history-container');
const rateInput = document.getElementById('hourly-rate');

// Элементы модального окна редактирования
const editModal = document.getElementById('edit-modal');
const editStartInput = document.getElementById('edit-start');
const editEndInput = document.getElementById('edit-end');
const saveEditBtn = document.getElementById('save-edit');
const cancelEditBtn = document.getElementById('cancel-edit');

// Элементы модального окна ручного добавления
const addManualBtn = document.getElementById('add-manual-shift');
const addModal = document.getElementById('add-modal');
const addStartInput = document.getElementById('add-start');
const addEndInput = document.getElementById('add-end');
const saveAddBtn = document.getElementById('save-add');
const cancelAddBtn = document.getElementById('cancel-add');

let currentShiftStart = localStorage.getItem('currentShiftStart');
let currentEditIndex = null;

// Настройки калькулятора (localStorage)
rateInput.value = localStorage.getItem('hourlyRate') || '';
rateInput.addEventListener('input', (e) => {
    localStorage.setItem('hourlyRate', e.target.value);
    renderHistory();
});

// Управление умными кнопками
startBtn.addEventListener('click', () => {
    const now = new Date(); 
    currentShiftStart = now.toISOString();
    localStorage.setItem('currentShiftStart', currentShiftStart);
    updateUI();
});

endBtn.addEventListener('click', () => {
    if (!currentShiftStart) return;

    const endTime = new Date(); 
    const startTime = new Date(currentShiftStart);
    
    const diffMs = endTime - startTime;
    const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(2);

    saveShiftToHistory(startTime, endTime, diffHours);

    localStorage.removeItem('currentShiftStart');
    currentShiftStart = null;
    
    updateUI();
    renderHistory();
    alert(`Смена завершена! Вы отработали: ${diffHours} ч.`);
});

// Ручное добавление смены
addManualBtn.addEventListener('click', () => {
    const now = new Date();
    addStartInput.value = toLocalISOString(now);
    const endNow = new Date(now.getTime() + 8 * 60 * 60 * 1000); 
    addEndInput.value = toLocalISOString(endNow);
    addModal.classList.remove('hidden');
});

cancelAddBtn.addEventListener('click', () => {
    addModal.classList.add('hidden');
});

saveAddBtn.addEventListener('click', () => {
    const start = new Date(addStartInput.value);
    const end = new Date(addEndInput.value);

    if (isNaN(start) || isNaN(end) || start >= end) {
        alert("Пожалуйста, проверьте правильность введенных дат.");
        return;
    }

    const diffMs = end - start;
    const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(2);

    saveShiftToHistory(start, end, diffHours);
    addModal.classList.add('hidden');
    renderHistory();
});

function updateUI() {
    if (currentShiftStart) {
        startBtn.disabled = true;
        endBtn.disabled = false;
        const timeStr = new Date(currentShiftStart).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        statusMessage.textContent = `Смена идет (Начало в ${timeStr})`;
    } else {
        startBtn.disabled = false;
        endBtn.disabled = true;
        statusMessage.textContent = 'Смена не начата';
    }
}

function saveShiftToHistory(start, end, hours) {
    let history = JSON.parse(localStorage.getItem('shiftsHistory')) || [];
    history.push({
        start: start.toISOString(),
        end: end.toISOString(),
        hours: parseFloat(hours)
    });
    localStorage.setItem('shiftsHistory', JSON.stringify(history));
}

// Отрисовка свернутой истории
function renderHistory() {
    const history = JSON.parse(localStorage.getItem('shiftsHistory')) || [];
    
    // 1. ЗАПОМИНАЕМ СОСТОЯНИЕ СПИСКОВ
    // Читаем текущие блоки на экране и сохраняем, какие из них были свернуты
    const collapsedStates = {};
    document.querySelectorAll('.month-block').forEach(block => {
        const monthName = block.querySelector('h3').textContent;
        collapsedStates[monthName] = block.classList.contains('collapsed');
    });

    historyContainer.innerHTML = '';
    
    if (history.length === 0) {
        historyContainer.innerHTML = '<p style="text-align:center; color:#7f8c8d; padding: 20px;">Нет записей</p>';
        return;
    }

    const rate = parseFloat(localStorage.getItem('hourlyRate')) || 0;

    const sortedHistory = history
        .map((shift, index) => ({ ...shift, originalIndex: index }))
        .sort((a, b) => new Date(b.start) - new Date(a.start));

    const groupedByMonth = {};
    
    sortedHistory.forEach(shift => {
        const date = new Date(shift.start);
        const monthYear = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        
        if (!groupedByMonth[monthYear]) {
            groupedByMonth[monthYear] = { shifts: [], totalHours: 0, totalShifts: 0 };
        }
        
        groupedByMonth[monthYear].shifts.push(shift);
        groupedByMonth[monthYear].totalHours += parseFloat(shift.hours);
        groupedByMonth[monthYear].totalShifts += 1;
    });

    let isFirstMonth = true; 

    for (const [month, data] of Object.entries(groupedByMonth)) {
        const totalMoney = (data.totalHours * rate).toFixed(2);
        const monthBlock = document.createElement('div');
        monthBlock.className = 'month-block';
        
        // 2. ВОССТАНАВЛИВАЕМ СОСТОЯНИЕ
        // Если мы помним состояние этого месяца из collapsedStates, применяем его.
        // Если не помним (например, при первом запуске), сворачиваем все кроме первого.
        if (collapsedStates[month] !== undefined) {
            if (collapsedStates[month]) {
                monthBlock.classList.add('collapsed');
            }
        } else if (!isFirstMonth) {
            monthBlock.classList.add('collapsed');
        }
        
        monthBlock.innerHTML = `
            <div class="month-header" onclick="this.parentElement.classList.toggle('collapsed')">
                <div class="month-header-content">
                    <h3>${month}</h3>
                    <div class="month-stats">
                        Отработано: ${data.totalShifts} смен / ${data.totalHours.toFixed(2)} ч.<br>
                        ${rate > 0 ? `<strong>Зарплата: ${totalMoney} ₽</strong>` : '<em>Введите ставку для расчета ЗП</em>'}
                    </div>
                </div>
                <div class="toggle-icon">▼</div>
            </div>
            <ul class="history-list"></ul>
        `;
        
        const ul = monthBlock.querySelector('.history-list');
        
        data.shifts.forEach(shift => {
            const startDate = new Date(shift.start).toLocaleDateString('ru-RU');
            const startTime = new Date(shift.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const endTime = new Date(shift.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const shiftMoney = rate > 0 ? `<br><span style="color:#2ecc71; font-size:12px;">+ ${(shift.hours * rate).toFixed(2)} ₽</span>` : '';

            const li = document.createElement('li');
            li.innerHTML = `
                <div class="shift-info">
                    <span><strong>${startDate}</strong> (${startTime} - ${endTime})</span>
                    <span style="text-align: right;"><strong>${shift.hours} ч.</strong> ${shiftMoney}</span>
                </div>
                <div class="shift-actions">
                    <button class="action-btn btn-edit" onclick="openEditModal(${shift.originalIndex})">Изменить</button>
                    <button class="action-btn btn-delete" onclick="deleteShift(${shift.originalIndex})">Удалить</button>
                </div>
            `;
            ul.appendChild(li);
        });
        
        historyContainer.appendChild(monthBlock);
        isFirstMonth = false;
    }
}

// Удаление смены
window.deleteShift = function(index) {
    if (confirm("Вы уверены, что хотите удалить эту смену?")) {
        let history = JSON.parse(localStorage.getItem('shiftsHistory')) || [];
        history.splice(index, 1); 
        localStorage.setItem('shiftsHistory', JSON.stringify(history));
        renderHistory(); 
    }
}

// Редактирование смены
window.openEditModal = function(index) {
    let history = JSON.parse(localStorage.getItem('shiftsHistory')) || [];
    const shift = history[index];
    currentEditIndex = index;

    editStartInput.value = toLocalISOString(new Date(shift.start));
    editEndInput.value = toLocalISOString(new Date(shift.end));
    editModal.classList.remove('hidden');
}

cancelEditBtn.addEventListener('click', () => {
    editModal.classList.add('hidden');
    currentEditIndex = null;
});

saveEditBtn.addEventListener('click', () => {
    if (currentEditIndex === null) return;
    let history = JSON.parse(localStorage.getItem('shiftsHistory')) || [];
    const newStart = new Date(editStartInput.value);
    const newEnd = new Date(editEndInput.value);

    const diffMs = newEnd - newStart;
    const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(2);

    history[currentEditIndex] = {
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
        hours: parseFloat(diffHours)
    };

    localStorage.setItem('shiftsHistory', JSON.stringify(history));
    editModal.classList.add('hidden');
    renderHistory();
});

function toLocalISOString(date) {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

// Инициализация
updateUI();
renderHistory();