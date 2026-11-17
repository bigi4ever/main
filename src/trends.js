// מפת הטרנדים: ז'אנרים של משחקים קלילים (web / mobile) והפופולריות היחסית שלהם.
// הציון (0-100) הוא הערכה משוקללת: נוכחות בטבלאות ההורדות של חנויות האפליקציות,
// משחקי דפדפן נצפים ותוכן ויראלי ברשתות. אפשר לעדכן אותו ידנית, או לדרוס אותו
// בקובץ trends.override.json בשורש הפרויקט (אותו מבנה: { "<id>": <score> }).

export const TRENDS_UPDATED = '2026-11';

export const GENRES = [
  {
    id: 'match3',
    name: 'התאמת שלוש (Match-3)',
    template: 'match3',
    score: 89,
    why: 'מחליפים פריטים צמודים ויוצרים שורות של 3. ז\'אנר הפאזל המכניס ביותר במובייל, ובעליה גם בפורטלי דפדפן (מרץ 2026).',
    tags: ['puzzle', 'casual'],
  },
  {
    id: 'arrows',
    name: 'פאזל חצים',
    template: 'arrows',
    score: 87,
    why: 'מוציאים חצים מהלוח בסדר הנכון בלי להיתקע. מכניקה ויראלית: משחק כזה הגיע למקום הראשון בהורדות במאי 2026.',
    tags: ['puzzle', 'hypercasual'],
  },
  {
    id: 'survivors',
    name: 'הישרדות מול גלים',
    template: 'survivors',
    score: 90,
    why: 'ז\'אנר ה-"survivors-like": שליטה פשוטה, ירי אוטומטי ובחירת שדרוגים. אחד הז\'אנרים הלוהטים ב-PC ובמובייל.',
    tags: ['action', 'roguelite'],
  },
  {
    id: 'blockpuzzle',
    name: 'פאזל בלוקים',
    template: 'blockpuzzle',
    score: 95,
    why: 'הנחת צורות על לוח 8×8 וניקוי שורות. נמצא דרך קבע בטופ ההורדות, לכל הגילאים.',
    tags: ['puzzle', 'casual'],
  },
  {
    id: 'merge',
    name: 'מיזוג שלישיות',
    template: 'merge',
    score: 86,
    why: 'מכניקת merge: מחברים שלושה פריטים זהים לפריט משודרג. התקדמות מספקת שמחזיקה לאורך זמן.',
    tags: ['puzzle', 'merge'],
  },
  {
    id: 'idle',
    name: 'קליקר / איידל',
    template: 'idle',
    score: 80,
    why: 'משחקים אינקרמנטליים: לוחצים, קונים מחוללי הכנסה וצופים במספרים גדלים. ממשיכים להתקדם גם כשלא משחקים.',
    tags: ['idle', 'incremental'],
  },
  {
    id: 'runner',
    name: 'ריצה אינסופית',
    template: 'runner',
    score: 72,
    why: 'שליטה בלחיצה אחת, תוצאה אחרי כמה שניות, תחרות על שיא. קלאסיקה היפר-קז\'ואלית.',
    tags: ['arcade', 'hypercasual'],
  },
];
