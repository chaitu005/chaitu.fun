// === CONFIGURATION ===
const SHEET_NAME_EXPENSES = "Expenses";
const SHEET_NAME_USERS = "Users";
const SHEET_NAME_POLICIES = "Policies";
const SHEET_NAME_FILES = "FILES";
const FOLDER_PATH_FILES = "https://drive.google.com/drive/folders/1Cri0EoFR-BdarDVdUAwvyr6q9yRUqIKv";
const FOLDER_ID_FILES = "1Cri0EoFR-BdarDVdUAwvyr6q9yRUqIKv";
const SHEET_NAME_UPCOMING = "Upcoming Expenses";
const SHEET_NAME_LIMITS = "Limits";
const EMAIL_RECIPIENT = "chaitanya.moganti@yahoo.com"; // Change this
const TWILIO_ACCOUNT_SID = "ACe9c895f8e4bce596ae43783ccc09a947";
const TWILIO_AUTH_TOKEN = "9c76d07eeaff5de08b7583e197e3ef39";
const TWILIO_API_URL = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
const TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
const WHATSAPP_TO = "whatsapp:+919704950085";

// --- CORS SETUP ---

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;

    switch (action) {
      case "addExpense":
        return jsonResponse(addExpense(request.data));
      case "validateUser":
          return jsonResponse(validateUser(request.data));
      case "savePolicy":
           return jsonResponse(savePolicy(request.data));
      case "saveFile":
           return jsonResponse(saveFile(request.data));
      default:
           return jsonResponse({ error: "Invalid action" });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doGet(e) {
  const action = e.parameter.action;

  switch (action) {
    case "getExpenses":
      return jsonResponse(getExpenses());
    case "getTotals":
      return jsonResponse(getTotals());    
    case "checkLimits":
      return jsonResponse(checkLimits());
    case "getUpcoming":
      return jsonResponse(getUpcomingExpenses());
    default:
      return ContentService.createTextOutput("✅ Expense Tracker API is running.");
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// --- FUNCTIONS ---
function addExpense(data) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME_EXPENSES);
  sheet.appendRow([data.date, data.category, data.amount, data.type, data.notes,data.person,data.updatedBy]);
  return { success: true };
}

function getExpenses() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME_EXPENSES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const expenses = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const expense = {};
    for (let j = 0; j < headers.length; j++) {
      expense[headers[j]] = headers[j]=="Date"? FormatDate(row[j]):row[j];
    }
    expenses.push(expense);
  }
  return { expenses };
}

function validateUser(data) {
  const userName = data.userName;
  const pwd = data.password;
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME_USERS);
  const excelData = sheet.getDataRange().getValues();
  var isUserValid = false;
  for (let i = 1; i < excelData.length; i++) {
    const row = excelData[i];
    if(userName == row[0] && pwd == row[1]){
      isUserValid = true;
      break;
    }
  }
  return { isValid: isUserValid };
}


function FormatDate(dateVal) {  
    return Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  

function getTotals() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME_EXPENSES);
  const data = sheet.getDataRange().getValues().slice(1);

  const monthlyTotals = {};
  const fyTotals = {};
  const categoryTotals = {};
  const personTotalsCurrentMonth={};
  const personTotalsCurrentYear={};
  const personTotalsToday={};
  const today = FormatDate(new Date());
  const todayParts = today.split("-");
  const currentYear = parseInt(todayParts[0], 10);
  const currentMonth = parseInt(todayParts[1], 10) - 1;
  const todayDateVal = parseInt(todayParts[2], 10)

  const currentMonthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
  const currentFyStart = (currentMonth >= 4) ? currentYear : currentYear - 1;
  const currentFyKey = `FY${currentFyStart}-${(currentFyStart + 1).toString().slice(-2)}`
  const todayKey = `${currentYear}-${currentMonth}-${todayDateVal}`

  data.forEach(([dateStr, category, amount, , type, person]) => {
    if (type === "Fixed") return;
    const date = FormatDate(dateStr);
    amount = Number(amount);
    const todayParts = date.split("-");
    const year = parseInt(todayParts[0], 10);
    const month = parseInt(todayParts[1], 10) - 1;
    const dateVal = parseInt(todayParts[2], 10)
    
    const dateKey = `${year}-${month}-${dateVal}`

    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + amount;

    const fyStart = (month >= 4) ? year : year - 1;
    const fyKey = `FY${fyStart}-${(fyStart + 1).toString().slice(-2)}`;
    fyTotals[fyKey] = (fyTotals[fyKey] || 0) + amount;

    categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    personTotalsCurrentMonth[person]= monthKey==currentMonthKey ? (personTotalsCurrentMonth[person]||0) + amount : (personTotalsToday[person]||0);
    personTotalsCurrentYear[person]= currentFyKey==fyKey ? (personTotalsCurrentYear[person]||0) + amount : (personTotalsToday[person]||0);
    personTotalsToday[person]= dateKey==todayKey ? (personTotalsToday[person]||0) + amount : (personTotalsToday[person]||0);
  });

  // Build alert message
  let alertMessage = "🧾 Expense Summary:\n";

  // Latest month (if any)
  const months = Object.keys(monthlyTotals).sort().reverse();
  if (months.length) {
    alertMessage += `• ${months[0]}: ₹${monthlyTotals[months[0]].toLocaleString()}\n`;
  }

  // Latest FY (if any)
  const fys = Object.keys(fyTotals).sort().reverse();
  if (fys.length) {
    alertMessage += `• ${fys[0]}: ₹${fyTotals[fys[0]].toLocaleString()}\n`;
  }

  // Category Breakdown
  alertMessage += "• By Category:\n";
  for (let [cat, amt] of Object.entries(categoryTotals)) {
    alertMessage += `  - ${cat}: ₹${amt.toLocaleString()}\n`;
  }

  return {
    monthlyTotals,
    fyTotals,
    categoryTotals,
    alertMessage,
    personTotalsCurrentMonth,
    personTotalsCurrentYear,
    personTotalsToday
  };
}    


function getUpcomingExpenses() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_UPCOMING);
  const data = sheet.getDataRange().getValues();
  const today = new Date();
  const upcoming = [];

  data.slice(1).forEach(row => {
    const dueDate = new Date(row[1]);
    const diff = Math.floor((dueDate - today) / (1000 * 3600 * 24));
    if (diff >= 0 && diff <= 7 && row[4]) {
      upcoming.push(row);
    }
  });

  return upcoming;
}

function checkLimits() {
  const expenseSheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME_EXPENSES);
  const limitSheet = SpreadsheetApp.getActive().getSheetByName(SHEET_LIMITS);

  const expenses = expenseSheet.getDataRange().getValues().slice(1);
  const limits = Object.fromEntries(limitSheet.getDataRange().getValues().slice(1));
  const totals = {};
  let overallTotal = 0;

  expenses.forEach(([date, category, amount, desc, type]) => {
    if (type !== "Fixed") {
      totals[category] = (totals[category] || 0) + Number(amount);
      overallTotal += Number(amount);
    }
  });

  let warnings = [];
  for (let cat in limits) {
    if (cat === "Overall" && overallTotal > limits[cat]) {
      warnings.push(`Overall limit exceeded: ${overallTotal}/${limits[cat]}`);
      sendWarning(`Overall limit exceeded: ${overallTotal}/${limits[cat]}`);
    } else if (cat !== "Overall" && totals[cat] > limits[cat]) {
      warnings.push(`Category "${cat}" limit exceeded: ${totals[cat]}/${limits[cat]}`);
      sendWarning(`Category "${cat}" limit exceeded: ${totals[cat]}/${limits[cat]}`);
    }
  }

  return warnings;
}

// --- SEND ALERTS ---
function sendWarning(message) {
  MailApp.sendEmail(USER_EMAIL, "Expense Limit Warning", message);
  sendWhatsApp(message);
}

function sendWhatsApp(message) {
  const payload = {
    to: USER_WHATSAPP_NUMBER,
    from: TWILIO_NUMBER,
    body: message
  };

  const options = {
    method: "post",
    headers: {
      Authorization: "Basic " + Utilities.base64Encode(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN)
    },
    payload: payload
  };

  UrlFetchApp.fetch("https://api.twilio.com/2010-04-01/Accounts/" + TWILIO_ACCOUNT_SID + "/Messages.json", options);
}

// --- DAILY REMINDER ---
function dailyReminder() {
  const upcoming = getUpcomingExpenses();
  if (upcoming.length > 0) {
    let msg = "Upcoming Expenses:\n";
    upcoming.forEach(row => {
      msg += `${row[0]} on ${row[1]}: ₹${row[2]}\n`;
    });
    MailApp.sendEmail(USER_EMAIL, "Upcoming Expenses Reminder", msg);
    sendWhatsApp(msg);
  }
}

function savePolicy(data) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_POLICIES);
    if (!sheet) throw new Error("Policies sheet not found.");
  
    sheet.appendRow([
      new Date(data.dueDate),
      data.policyNumber,
      data.tenure,
      data.repeat,
      data.category,
      data.person,
      data.notes,
      new Date()
    ]);
  }
  
  function saveFile(data) {
    const folder = DriveApp.getFolderById(FOLDER_ID_FILES);
    const blob = Utilities.newBlob(Utilities.base64Decode(data.fileBase64), data.fileMimeType, data.fileOriginalName);
    const file = folder.createFile(blob);
  
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_FILES);
    if (!sheet) throw new Error("Files sheet not found.");
  
    sheet.appendRow([
      data.fileName,
      data.description,
      data.fileType,
      data.person,
      new Date(),
      file.getUrl()
    ]);
  }
  
