
# PROTECTED FILES: DO NOT MODIFY OR DELETE
- `icon-192-v2.png`
- `icon-512-v2.png`
**IMPORTANT**: These are custom, user-provided icons. They are critical for the application's identity and must not be changed, replaced, or removed under any circumstances. All parts of the application must reference these files for icons.
---
# AI AGENT INSTRUCTIONS: READ AND FOLLOW THESE RULES BEFORE MODIFYING ANY CODE.

1.  **SOURCE CODE**: The primary source code is in the root directory and uses TypeScript (`.tsx`, `.ts` files).
2.  **BUILD DESTINATION**: The compiled, browser-ready code MUST be placed in the `/docs` directory. This is for GitHub Pages deployment.
3.  **BUILD PROCESS**:
    *   **MANDATORY**: After ANY modification to a source file (e.g., `App.tsx`, `services/firebase.ts`), you MUST regenerate the corresponding JavaScript file in the `/docs` directory (e.g., `docs/App.js`, `docs/services/firebase.js`).
    *   **TRANSPILE**: The code must be transpiled from TSX/JSX to plain JavaScript. Use `React.createElement` instead of JSX syntax.
    *   **IMPORTS**: Ensure imports in the `docs/` JS files allow for browser execution (ES Modules).
4.  **VERSIONING**:
    *   **MANDATORY**: On EVERY response that includes code changes, you MUST update `buildInfo.ts` (and `docs/buildInfo.js`).
    *   Update `buildDate` to the current date (DD.MM.YYYY). Do NOT include the time.
    *   Increment `version` if significant features are added (optional).
5.  **SINGLE SOURCE OF TRUTH**: This file, `INSTRUCTIONS.md`, contains the definitive workflow. Adhere to it strictly. Failure to update the `docs/` folder results in a broken app.

---

# הוראות לעדכון אפליקציית "רדיו דרכים"

מסמך זה נועד לתעד את תהליך העבודה בינינו לעדכון האפליקציה.

## סדר הפעולות

תהליך העדכון מורכב מ-3 שלבים פשוטים:

### שלב 1: בקשת שינוי (התפקיד שלך)

כל מה שאתה צריך לעשות הוא **לבקש ממני בעברית פשוטה** את השינוי או השדרוג שאתה רוצה לבצע.

**דוגמאות:**
*   "הוסף בבקשה כפתור חדש שעושה X."
*   "שנה את העיצוב של רשימת התחנות."
*   "תקן בבקשה את הבאג שקורה כשלוחצים על Y."

---

### שלב 2: ביצוע השינוי והבנייה (התפקיד שלי)

ברגע שאקבל ממך בקשה, אני אבצע באופן אוטומטי את הפעולות הבאות:

1.  **אעדכן את קוד המקור:** אשנה את הקבצים הרלוונטיים (קבצי `.tsx`, `.ts`, וכו').
2.  **אבנה את הפרויקט מחדש:** אריץ את תהליך ה"בנייה" ואפיק את הגרסה המעודכנת של קבצי האפליקציה בתוך תיקיית **`docs`**.
3.  **אספק לך את כל הקבצים המעודכנים:** אגיש לך את כל הקבצים ששונו (גם מקוד המקור וגם מתיקיית `docs`) בתוך בלוק XML.

---

### שלב 3: העלאת העדכון לאתר (התפקיד שלך)

לאחר שסיפקתי לך את הקבצים המעודכנים, כל מה שנותר לך לעשות הוא:

1.  **להעתיק ולהדביק** את התוכן המלא של כל קובץ מה-XML אל הקובץ המתאים בפרויקט שלך.
2.  **לשמור את השינויים**.
3.  **לבצע `commit` ו-`push`** למאגר שלך ב-GitHub.

ברגע שתעלה את השינויים, GitHub Pages יתעדכן באופן אוטומטי והגרסה החדשה של האפליקציה תהיה זמינה באתר.