/**
 * ------------------------------------------------------------------
 * 設定エリア
 * ------------------------------------------------------------------
 */
const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
const SAVE_FOLDER_ID = "ここは個別に指定"; // 「02_処理済み」フォルダー

/**
 * 画面表示 (design_fr を指定)
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('design_fr') 
    .setTitle('Le Juge Suprême')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * JSONテキストから安全にJSONオブジェクトを抽出するヘルパー関数
 * ```json ... ``` フェンスや余計なテキストが混入しても正しく処理する
 */
function extractJson(text) {
  // ```json ... ``` や ``` ... ``` フェンスを除去
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSONが見つかりませんでした: " + text.substring(0, 200));
  return JSON.parse(match[0]);
}

/**
 * レシート解析と保存のメイン処理
 * ※ GASはasync/awaitに非対応のため、通常の同期関数として定義
 */
function processReceipt(base64Data, mimeType) {
  if (!API_KEY) throw new Error("APIキーが設定されていません。");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName("設定");
  let myDictionary = "";
  if (configSheet && configSheet.getLastRow() > 1) {
    const configData = configSheet.getDataRange().getValues();
    for (let i = 1; i < configData.length; i++) {
      myDictionary += `・${configData[i][0]}の${configData[i][1]}: ${configData[i][2]}kcal (${configData[i][3]})\n`;
    }
  }

  // プロンプト（AIへの指示）
  const promptText = `JSON形式でのみ回答してください。余計な説明 is 厳禁。
  {
    "store": "店名",
    "date": "YYYY-MM-DD",
    "total": 数値,
    "total_calories": 合計カロリー数値,
    "advice": "お奉行様風のアドバイス(フランス語で回答してください)",
    "items": [
      {
        "name": "品目(フランス語)", 
        "category": "詳細カテゴリー(フランス語)", 
        "color_group": "食品 or お菓子 or お酒 or その他", 
        "price": 金額数値, 
        "kcal": 推定カロリー, 
        "note": "計算根拠(日本語)"
      }
    ]
  }
  【重要】adviceは必ずフランス語（Affiché en français）でお奉行様のような威厳のある口調で回答すること。
  【color_groupの基準】食品(緑), お菓子(オレンジ), お酒(赤), その他(灰)
  【優先辞書】\n${myDictionary}`;

  // ↓ご自身の環境に合わせてモデル名を変更してください
  const modelName = "gemini-3-flash-preview"; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
  
  const payload = { 
    "contents": [{ 
      "parts": [
        { "text": promptText }, 
        { "inlineData": { "mimeType": mimeType, "data": base64Data } }
      ] 
    }] 
  };

  const response = UrlFetchApp.fetch(url, { 
    "method": "post", 
    "contentType": "application/json", 
    "payload": JSON.stringify(payload) 
  });
  
  const resJson = JSON.parse(response.getContentText());
  const aiText = resJson.candidates[0].content.parts[0].text;

  // 修正②: 強化されたJSONパース（```jsonフェンス対応 + nullクラッシュ防止）
  const data = extractJson(aiText);

  // 画像保存
  let fileUrl = "";
  try {
    const folder = DriveApp.getFolderById(SAVE_FOLDER_ID);
    const decodedData = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedData, mimeType);
    const fileName = `${data.date}_${data.store}.${mimeType.split('/')[1] || "jpg"}`;
    blob.setName(fileName);
    const file = folder.createFile(blob);
    fileUrl = file.getUrl();
  } catch (e) { console.error(e); }

  // スプレッドシート保存
  saveToSheet(data, fileUrl);

  return JSON.stringify({
    date: data.date, 
    store: data.store, 
    total: data.total,
    calories: data.total_calories || 0,
    advice: data.advice || "Enregistrement terminé."
  });
}

/**
 * シート保存処理
 */
function saveToSheet(data, fileUrl) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("家計簿");
  if (!sheet) return;

  (data.items || []).forEach((item, index) => {
    const lastRow = sheet.getLastRow();
    sheet.appendRow([
      index === 0 ? data.date : "", 
      index === 0 ? data.store : "",
      item.name, item.category, item.price, 
      index === 0 ? data.total : "",
      item.kcal, item.note,
      index === 0 ? fileUrl : ""
    ]);
    const categoryCell = sheet.getRange(lastRow + 1, 4);
    let bgColor = null;
    switch (item.color_group) {
      case "食品": bgColor = "#e2f3eb"; break;
      case "お菓子": bgColor = "#fff2e0"; break;
      case "お酒": bgColor = "#fde2e2"; break;
      case "その他": bgColor = "#f1f3f4"; break;
    }
    if (bgColor) categoryCell.setBackground(bgColor);
  });
}

/**
 * GAS特有の日付型バグを完璧に回避する、超安全な日付変換関数
 */
function parseGASDate(val) {
  if (!val) return null;

  // 1. セル自体に「getFullYear」や「getMonth」という関数が直接備わっているか確認 (最上位のDate判定)
  if (typeof val.getFullYear === 'function' && typeof val.getMonth === 'function') {
    return {
      year: val.getFullYear(),
      month: val.getMonth() + 1
    };
  }

  // 2. 文字列として格納されている場合、またはDateオブジェクトの文字化
  let strDate = val.toString().trim();
  
  // 標準的な日付解釈ができるか試す
  const testDate = new Date(strDate);
  if (!isNaN(testDate.getTime())) {
    return {
      year: testDate.getFullYear(),
      month: testDate.getMonth() + 1
    };
  }

  // 3. 特殊な文字（スラッシュ、ハイフン、アポストロフィなど）の置換解析
  strDate = strDate.replace(/['`"\s\-]/g, '/');
  const parts = strDate.split('/');
  if (parts.length >= 2) {
    const cleanYear = parts[0].replace(/[^0-9]/g, '');
    const cleanMonth = parts[1].replace(/[^0-9]/g, '');
    const parsedYear = parseInt(cleanYear, 10);
    const parsedMonth = parseInt(cleanMonth, 10);
    if (!isNaN(parsedYear) && !isNaN(parsedMonth)) {
      return {
        year: parsedYear,
        month: parsedMonth
      };
    }
  }
  return null;
}

/**
 * 月間解析処理
 * ※ GASはasync/awaitに非対応のため、通常の同期関数として定義
 */
function analyzeMonthlyReport(monthOffset) {
  // デフォルト値を明示的に設定（undefinedが渡された場合の保険）
  if (monthOffset === undefined || monthOffset === null) monthOffset = 0;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("家計簿");
    if (!sheet) return JSON.stringify({ rating: 1, advice: "Feuille '家計簿' introuvable.", monthLabel: "N/A" });

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return JSON.stringify({ 
        rating: 3, 
        advice: "Votre carnet de comptes est vide pour le moment.", 
        monthLabel: "N/A" 
      });
    }

    // A2からG列（カロリー）までのデータをまとめて取得
    const allData = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    
    const parsedRows = [];
    let currentYear = null;
    let currentMonth = null;
    let currentStore = "Inconnu";

    for (let i = 0; i < allData.length; i++) {
      const row = allData[i];
      const rawDateValue = row[0];
      const rawStoreValue = row[1];
      const rawItemName = row[2];
      const rawCategoryValue = row[3];
      const rawPriceValue = parseFloat(row[4]) || 0;
      // G列（index=6）がカロリー
      const rawCalorieValue = parseFloat(row[6]) || 0;

      if (!rawItemName) continue;

      if (rawDateValue !== "" && rawDateValue !== null && rawDateValue !== undefined) {
        const dateInfo = parseGASDate(rawDateValue);
        if (dateInfo) {
          currentYear = dateInfo.year;
          currentMonth = dateInfo.month;
          currentStore = rawStoreValue || "Inconnu";
        }
      }

      if (currentYear === null || currentMonth === null) continue;

      parsedRows.push({
        year: currentYear,
        month: currentMonth,
        store: currentStore,
        category: rawCategoryValue || "Autre",
        price: rawPriceValue,
        calories: rawCalorieValue
      });
    }

    if (parsedRows.length === 0) {
      return JSON.stringify({
        rating: 3,
        advice: "Aucune dépense valide n'a été trouvée.",
        monthLabel: "N/A"
      });
    }

    // 最新の活動期（年・月）を自動検出
    let latestYear = 0;
    let latestMonth = 0;
    parsedRows.forEach(item => {
      if (item.year > latestYear) {
        latestYear = item.year;
        latestMonth = item.month;
      } else if (item.year === latestYear && item.month > latestMonth) {
        latestMonth = item.month;
      }
    });

    const targetDate = new Date(latestYear, latestMonth - 1, 1);
    targetDate.setMonth(targetDate.getMonth() + monthOffset);
    const targetMonth = targetDate.getMonth() + 1;
    const targetYear = targetDate.getFullYear();
    const monthLabel = `${targetYear}-${targetMonth}`;

    let monthlyExpenses = [];
    let totalCalories = 0;
    parsedRows.forEach(item => {
      if (item.year === targetYear && item.month === targetMonth) {
        monthlyExpenses.push({
          store: item.store,
          category: item.category,
          price: item.price
        });
        totalCalories += item.calories;
      }
    });
    // 小数点以下を四捨五入
    totalCalories = Math.round(totalCalories);

    if (monthlyExpenses.length === 0) {
      return JSON.stringify({
        rating: 3,
        advice: "Il n'y a pas encore de dépenses enregistrées dans votre carnet pour cette période. Commençons à scanner des reçus !",
        monthLabel: monthLabel
      });
    }

    const prompt = `Analyse ce budget de dépenses: ${JSON.stringify(monthlyExpenses)}. Réponds uniquement au format JSON suivant : { "rating": 1-5, "advice": "Ton conseil d'analyse en français, style juge d'alimentation sévère mais juste" }`;
    // ↓ご自身の環境に合わせてモデル名を変更してください
    const modelName = "gemini-3-flash-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
    
    const response = UrlFetchApp.fetch(url, { 
      "method": "post", 
      "contentType": "application/json", 
      "payload": JSON.stringify({ "contents": [{ "parts": [{ "text": prompt }] }] }) 
    });
    
    const result = JSON.parse(response.getContentText());
    const aiText = result.candidates[0].content.parts[0].text;

    // 修正②: 強化されたJSONパース（```jsonフェンス対応 + nullクラッシュ防止）
    const finalData = extractJson(aiText);
    finalData.monthLabel = monthLabel;
    finalData.totalCalories = totalCalories;
    return JSON.stringify(finalData);

  } catch (error) {
    console.error("Erreur analyzeMonthlyReport: " + error.toString());
    return JSON.stringify({
      rating: 3,
      advice: "Le Juge n'a pas pu rendre son verdict. [Erreur de lecture: " + error.toString() + "]",
      monthLabel: "N/A"
    });
  }
}
