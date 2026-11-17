// מפת הטרנדים: ז'אנרים של משחקים קלילים (web / mobile) והפופולריות היחסית שלהם.
// הציון (0-100) הוא הערכה משוקללת: נוכחות בטבלאות ההורדות של חנויות האפליקציות,
// משחקי דפדפן נצפים ותוכן ויראלי ברשתות. אפשר לעדכן אותו ידנית, או לדרוס אותו
// בקובץ trends.override.json בשורש הפרויקט (אותו מבנה: { "<id>": <score> }).

export const TRENDS_UPDATED = '2026-11';

export const GENRES = [
  {
    id: 'survivors',
    name: 'הישרדות מול גלים',
    template: 'survivors',
    score: 96,
    why: 'ז\'אנר ה-"survivors-like": שליטה פשוטה, ירי אוטומטי ובחירת שדרוגים. אחד הז\'אנרים הלוהטים ב-PC ובמובייל.',
    tags: ['action', 'roguelite'],
  },
  {
    id: 'blockpuzzle',
    name: 'פאזל בלוקים',
    template: 'blockpuzzle',
    score: 93,
    why: 'הנחת צורות על לוח 8×8 וניקוי שורות. נמצא דרך קבע בטופ ההורדות, לכל הגילאים.',
    tags: ['puzzle', 'casual'],
  },
  {
    id: 'merge',
    name: 'מיזוג שלישיות',
    template: 'merge',
    score: 88,
    why: 'מכניקת merge: מחברים שלושה פריטים זהים לפריט משודרג. התקדמות מספקת שמחזיקה לאורך זמן.',
    tags: ['puzzle', 'merge'],
  },
  {
    id: 'idle',
    name: 'קליקר / איידל',
    template: 'idle',
    score: 84,
    why: 'משחקים אינקרמנטליים: לוחצים, קונים מחוללי הכנסה וצופים במספרים גדלים. ממשיכים להתקדם גם כשלא משחקים.',
    tags: ['idle', 'incremental'],
  },
  {
    id: 'runner',
    name: 'ריצה אינסופית',
    template: 'runner',
    score: 79,
    why: 'שליטה בלחיצה אחת, תוצאה אחרי כמה שניות, תחרות על שיא. קלאסיקה היפר-קז\'ואלית.',
    tags: ['arcade', 'hypercasual'],
  },
];
