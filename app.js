// Элементы таймера
const startBtn = document.getElementById('start-shift');
const endBtn = document.getElementById('end-shift');
const statusMessage = document.getElementById('status-message');

// Элементы истории и ставки
const historyContainer = document.getElementById('history-container');
const rateInput = document.getElementById('hourly-rate');

// Элементы редактирования
const editModal = document.getElementById('edit-modal');
const editStartInput = document.getElementById('edit-start');
const editEndInput = document.getElementById('edit-end');
const saveEditBtn = document.getElementById('save-edit');
const cancelEditBtn = document.getElementById('cancel-edit');

// Элементы ручного ввода с клавиатуры
const addManualBtn = document.getElementById('add-manual-shift');
const addModal = document.getElementById('add-modal');
const addDateInput = document.getElementById('add-date');
const addStartTimeInput = document.getElementById('add-start-time');
const addEndTimeInput = document.getElementById('add-end-time');
const saveAddBtn = document.getElementById('save-add');
const cancelAddBtn = document.getElementById('cancel-add');

let currentShiftStart = localStorage.getItem('currentShiftStart');
let currentEditIndex = null;

// Настройка калькулятора (сохранение в Local Storage)
rateInput.value = localStorage.getItem('hourlyRate') || '';
rateInput.addEventListener('input', (e) => {
    localStorage.setItem('hourlyRate', e.target.value);
    renderHistory();
});

// Логика умных кнопок
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

// Ручное добавление смены (текстовый ввод)
addManualBtn.addEventListener('click', () => {
    const now = new Date();
    addDateInput.value = now.toISOString().split('T')[0];
    addStartTimeInput.value = "";
    addEndTimeInput.value = "";
    addModal.classList.remove('hidden');
});

cancelAddBtn.addEventListener('click', () => {
    addModal.classList.add('hidden');
});

saveAddBtn.addEventListener('click', () => {
    const dateVal = addDateInput.value;
    const startVal = addStartTimeInput.value.trim();
    const endVal = addEndTimeInput.value.trim();

    const timeRegex = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!dateVal || !timeRegex.test(startVal) || !timeRegex.test(endVal)) {
        alert("Пожалуйста, введите время в правильном формате (например, 09:00 или 18:30).");
        return;
    }

    const start = new Date(`${dateVal}T${startVal.padStart(5, '0')}:00`);
    const end = new Date(`${dateVal}T${endVal.padStart(5, '0')}:00`);

    // Если конец меньше начала — смена ушла в следующий день
    if (end <= start) {
        end.setDate(end.getDate() + 1);
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

// Отрисовка истории с запоминанием состояния списков
function renderHistory() {
    const history = JSON.parse(localStorage.getItem('shiftsHistory')) || [];
    
    // Запоминаем открытые/закрытые месяцы
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
        
        // Восстанавливаем состояние сворачивания
        if (collapsedStates[month] !== undefined) {
            if (collapsedStates[month]) monthBlock.classList.add('collapsed');
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

// Удаление
window.deleteShift = function(index) {
    if (confirm("Вы уверены, что хотите удалить эту смену?")) {
        let history = JSON.parse(localStorage.getItem('shiftsHistory')) || [];
        history.splice(index, 1); 
        localStorage.setItem('shiftsHistory', JSON.stringify(history));
        renderHistory(); 
    }
}

// Редактирование
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

// --- НОВЫЙ ФУНКЦИОНАЛ: Выгрузка смен ---

// Элементы выгрузки
const exportBtn = document.getElementById('export-shifts-btn');
const exportModal = document.getElementById('export-modal');
const exportStartInput = document.getElementById('export-start');
const exportEndInput = document.getElementById('export-end');
const copyExportBtn = document.getElementById('copy-export');
const cancelExportBtn = document.getElementById('cancel-export');

// Открытие и закрытие окна выгрузки
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const now = new Date();
        // По умолчанию ставим текущий месяц
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        exportStartInput.value = firstDay.toISOString().split('T')[0];
        exportEndInput.value = now.toISOString().split('T')[0];
        exportModal.classList.remove('hidden');
    });
}

if (cancelExportBtn) {
    cancelExportBtn.addEventListener('click', () => {
        exportModal.classList.add('hidden');
    });
}

// Логика формирования и копирования списка
if (copyExportBtn) {
    copyExportBtn.addEventListener('click', () => {
        const startVal = exportStartInput.value;
        const endVal = exportEndInput.value;

        if (!startVal || !endVal) {
            alert("Пожалуйста, выберите обе даты.");
            return;
        }

        const startDate = new Date(startVal);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(endVal);
        endDate.setHours(23, 59, 59, 999);

        const history = JSON.parse(localStorage.getItem('shiftsHistory')) || [];

        // Фильтрация смен по выбранному периоду
        const filteredShifts = history.filter(shift => {
            const shiftDate = new Date(shift.start);
            return shiftDate >= startDate && shiftDate <= endDate;
        });

        if (filteredShifts.length === 0) {
            alert("За выбранный период нет смен.");
            return;
        }

        // Группировка часов по дням
        const groupedByDay = {};
        
        filteredShifts.forEach(shift => {
            const dateObj = new Date(shift.start);
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const formattedDate = `${day}.${month}`;

            if (!groupedByDay[formattedDate]) {
                groupedByDay[formattedDate] = 0;
            }
            groupedByDay[formattedDate] += parseFloat(shift.hours);
        });

        // Формирование текстового списка
        let exportText = "";
        Object.keys(groupedByDay)
            .sort((a, b) => {
                const [dayA, monthA] = a.split('.');
                const [dayB, monthB] = b.split('.');
                return new Date(2000, monthA - 1, dayA) - new Date(2000, monthB - 1, dayB);
            })
            .forEach(date => {
                const hours = groupedByDay[date];
                const displayHours = Number.isInteger(hours) ? hours : hours.toFixed(2);
                exportText += `${date} - ${displayHours}\n`;
            });

        // Копирование
        navigator.clipboard.writeText(exportText).then(() => {
            alert("Смены скопированы в буфер обмена!\n\n" + exportText);
            exportModal.classList.add('hidden');
        }).catch(err => {
            alert("Не удалось скопировать автоматически. Вот ваши данные:\n\n" + exportText);
        });
    });
}

// Инициализация при открытии приложения
updateUI();
renderHistory();
