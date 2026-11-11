/**
 * ui/icons.js
 * Векторные SVG-иконки, названия месяцев, палитра цветов и иконки шаблонов смен.
 */

export const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export const MONTH_NAMES_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

export const TEMPLATE_COLORS = [
  { id: "#0a84ff", label: "Синий" },
  { id: "#8b7cff", label: "Индиго" },
  { id: "#bf5af2", label: "Фиолетовый" },
  { id: "#30beac", label: "Бирюзовый" },
  { id: "#30d158", label: "Зелёный" },
  { id: "#ffd60a", label: "Жёлтый" },
  { id: "#ff9f0a", label: "Оранжевый" },
  { id: "#ff453a", label: "Красный" },
];

export const TEMPLATE_ICONS = {
  sun: {
    label: "Солнце",
    body: '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>',
  },
  moon: {
    label: "Луна",
    body: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
  },
  flame: {
    label: "Огонь",
    body: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>',
  },
  bolt: {
    label: "Молния",
    body: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
  },
  star: {
    label: "Звезда",
    body: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
  },
  briefcase: {
    label: "Работа",
    body: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>',
  },
  coffee: {
    label: "Кофе",
    body: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path><line x1="6" y1="2" x2="6" y2="4"></line><line x1="10" y1="2" x2="10" y2="4"></line><line x1="14" y1="2" x2="14" y2="4"></line>',
  },
  clock: {
    label: "Часы",
    body: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
  },
};

export const DEFAULT_TEMPLATE_STYLE = {
  day: { icon: "sun", color: "#0a84ff" },
  night: { icon: "moon", color: "#bf5af2" },
  extra: { icon: "flame", color: "#ff9f0a" },
};

/**
 * Рендерит SVG-иконку шаблона без inline stroke-переопределения.
 * Валидный hex-цвет пробрасывается как CSS custom property --shift-color,
 * чтобы CSS мог корректно адаптировать контраст в светлой и тёмной темах.
 * @param {string} iconKey
 * @param {string} [className="shift-svg-icon"]
 * @param {string} [color=""]
 * @returns {string}
 */
export function renderIconSvgByKey(iconKey, className = "shift-svg-icon", color = "") {
  const def = TEMPLATE_ICONS[iconKey] || TEMPLATE_ICONS.sun;
  const safeClass = String(className || "shift-svg-icon").replace(/[^a-zA-Z0-9_\-\s]/g, "");
  const trimmedColor = typeof color === "string" ? color.trim() : "";
  const styleAttr = HEX_COLOR_RE.test(trimmedColor)
    ? ` style="--shift-color: ${trimmedColor}"`
    : "";
  return `<svg class="${safeClass}"${styleAttr} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${def.body}</svg>`;
}

/**
 * Возвращает SVG-иконку смены с учетом пользовательских настроек шаблона
 * @param {string} type "day" | "night" | "extra"
 * @param {Object|null} [settings=null]
 * @returns {string}
 */
export function getShiftIconSvg(type, settings = null) {
  const safeType = DEFAULT_TEMPLATE_STYLE[type] ? type : "day";
  const preset = settings?.presets?.[safeType];
  const fallback = DEFAULT_TEMPLATE_STYLE[safeType];
  const iconKey = preset?.icon && TEMPLATE_ICONS[preset.icon] ? preset.icon : fallback.icon;
  const color = preset?.color || fallback.color;
  return renderIconSvgByKey(iconKey, `shift-svg-icon shift-svg-icon--${safeType}`, color);
}
