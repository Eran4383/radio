
const STATION_SCHEDULES = [
  {
    name: 'כאן ב',
    aliases: ['כאן ב', 'kan bet', 'כאן רשת ב'],
    schedule: [
      // Weekdays
      ...[0, 1, 2, 3, 4].flatMap(day => [
        { day, start: "06:00", end: "07:00", name: "הבוקר הזה" },
        { day, start: "07:00", end: "10:00", name: "קלמן וליברמן" },
        { day, start: "10:00", end: "11:00", name: "סדר יום עם קרן נויבך" },
        { day, start: "11:00", end: "12:00", name: "בחצי היום" },
        { day, start: "17:00", end: "19:00", name: "הפקק עם יואב קיץ" },
        { day, start: "19:00", end: "20:00", name: "יומן הערב" },
      ]),
      // Friday
      { day: 5, start: "07:00", end: "09:00", name: "יומן הבוקר" },
      { day: 5, start: "13:00", end: "14:00", name: "יומן השבוע" },
      // Saturday
      { day: 6, start: "08:00", end: "10:00", name: "הכל דיבורים" },
    ]
  },
  {
    name: 'גלגלצ',
    aliases: ['גלגלצ', 'glglz', 'galgalatz'],
    schedule: [
       // Weekdays
      ...[0, 1, 2, 3, 4].flatMap(day => [
        { day, start: "07:00", end: "10:00", name: "בוקר טוב ישראל עם הדר מרקס" },
        { day, start: "10:00", end: "12:00", name: "מדינה בדרך עם עומר גפן" },
        { day, start: "12:00", end: "14:00", name: "הנבחרת עם דלית רצ'שטר" },
        { day, start: "16:00", end: "18:00", name: "ארבע אחרי الظهر עם יואב צפיר" },
        { day, start: "21:00", end: "23:00", name: "הסיפור של... עם ערן אליאס" },
      ]),
       // Friday
      { day: 5, start: "10:00", end: "12:00", name: "קולות החיילים עם טייכר וזרחוביץ'" },
      { day: 5, start: "12:00", end: "14:00", name: "מצעד הפזמונים עם דורון מדלי" },
    ]
  },
  {
    name: '103fm',
    aliases: ['103fm', 'רדיו ללא הפסקה'],
    schedule: [
       // Weekdays
      ...[0, 1, 2, 3, 4].flatMap(day => [
        { day, start: "07:00", end: "09:00", name: "נתן זהבי ודידי הררי" },
        { day, start: "09:00", end: "11:00", name: "גולן יוכפז וענת דוידוב" },
        { day, start: "11:00", end: "12:00", name: "איריס קול" },
        { day, start: "15:00", end: "17:00", name: "ינון מגל ובן כספית" },
      ]),
    ]
  },
  {
    name: 'eco99fm',
    aliases: ['eco99fm', '99fm'],
    schedule: [
       // Weekdays
      ...[0, 1, 2, 3, 4].flatMap(day => [
        { day, start: "07:00", end: "09:30", name: "טל ואביעד" },
        { day, start: "17:00", end: "19:00", name: "ליעד ודידי" },
      ]),
    ]
  }
];

// A mapping from English weekday names (from Intl.DateTimeFormat) to JS getDay() numbers
const weekdayMap = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export const getCurrentProgram = (stationName) => {
  const lowerCaseStationName = stationName.toLowerCase();
  
  const stationSchedule = STATION_SCHEDULES.find(s => 
    s.aliases.some(alias => lowerCaseStationName.includes(alias.toLowerCase()))
  );

  if (!stationSchedule) {
    return null;
  }

  try {
    const now = new Date();
    
    // Use Intl.DateTimeFormat for robust timezone handling
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long',
    });
    
    const parts = formatter.formatToParts(now);
    const getPart = (type) => parts.find(p => p.type === type)?.value || '';

    const hour = getPart('hour');
    const minute = getPart('minute');
    const weekdayName = getPart('weekday').toLowerCase();
    
    const day = weekdayMap[weekdayName];
    const currentTime = `${hour}:${minute}`;

    const todaysSchedule = stationSchedule.schedule.filter(p => p.day === day);
    
    const currentProgram = todaysSchedule.find(p => {
      // Handle overnight programs correctly
      if (p.start > p.end) { // e.g., starts at 23:00, ends at 02:00
        return currentTime >= p.start || currentTime < p.end;
      }
      return currentTime >= p.start && currentTime < p.end;
    });

    return currentProgram ? currentProgram.name : null;
  } catch (error) {
    console.error("Error calculating current program:", error);
    // Fallback to a simpler method if Intl fails, though it's unlikely
    const fallbackNow = new Date();
    const day = fallbackNow.getDay();
    const currentTime = `${fallbackNow.getHours().toString().padStart(2, '0')}:${fallbackNow.getMinutes().toString().padStart(2, '0')}`;
    
    const fallbackProgram = stationSchedule.schedule.find(p => p.day === day && p.start <= currentTime && currentTime < p.end);
    return fallbackProgram ? fallbackProgram.name : null;
  }
};