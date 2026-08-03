"use strict";

/* =========================================================
   WOS 行軍タイミングツール Ver.2.0
========================================================= */


/* =========================================================
   基本設定
========================================================= */

const STORAGE_KEY = "wos_march_timing_tool_v20";

/*
  実測データから作った座標→行軍時間の推定式

  王城・砦・要塞
  時間 ≒ 距離 × 4.279 + 1.71

  プレイヤー都市
  時間 ≒ 距離 × 2.255 + 2.864
*/
const COORDINATE_FORMULAS = {
  castle: {
    slope: 4.279,
    intercept: 1.71,
    minimum: 10,
    errorText: "±1～3秒程度"
  },

  city: {
    slope: 2.255,
    intercept: 2.864,
    minimum: 10,
    errorText: "±1～3秒程度"
  }
};


/*
  ユキヒョウ補正

  通常時間 ÷ 倍率 ＝ バフ適用後の時間

  Lv1・Lv6・Lv8は実測値を参考に設定。
  その他は段階的な推定値。
*/
const SNOW_LEOPARD_MULTIPLIERS = {
  0: 1,
  1: 1.119,
  2: 1.135,
  3: 1.151,
  4: 1.167,
  5: 1.184,
  6: 1.2,
  7: 1.22,
  8: 1.24
};


/* =========================================================
   DOM取得
========================================================= */

const currentTimeElement =
  document.getElementById("currentTime");


/* モード切り替え */

const insertModeButton =
  document.getElementById("insertModeButton");

const arrivalModeButton =
  document.getElementById("arrivalModeButton");

const insertModeSection =
  document.getElementById("insertModeSection");

const arrivalModeSection =
  document.getElementById("arrivalModeSection");


/* 防衛施設 */

const defenseCoordinateXInput =
  document.getElementById("defenseCoordinateX");

const defenseCoordinateYInput =
  document.getElementById("defenseCoordinateY");

const defenseTargetTypeSelect =
  document.getElementById("defenseTargetType");


/* 自分の行軍時間 */

const manualMarchModeButton =
  document.getElementById("manualMarchModeButton");

const coordinateMarchModeButton =
  document.getElementById("coordinateMarchModeButton");

const manualMarchSettings =
  document.getElementById("manualMarchSettings");

const coordinateMarchSettings =
  document.getElementById("coordinateMarchSettings");

const myMarchMinutesInput =
  document.getElementById("myMarchMinutes");

const myMarchSecondsInput =
  document.getElementById("myMarchSeconds");

const myCoordinateXInput =
  document.getElementById("myCoordinateX");

const myCoordinateYInput =
  document.getElementById("myCoordinateY");

const estimatedMarchTimeElement =
  document.getElementById("estimatedMarchTime");

const estimatedDistanceElement =
  document.getElementById("estimatedDistance");

const estimatedErrorElement =
  document.getElementById("estimatedError");

const applyEstimatedMarchButton =
  document.getElementById("applyEstimatedMarchButton");


/* 自分のユキヒョウ */

const snowLeopardActiveInput =
  document.getElementById("snowLeopardActive");

const snowLeopardLevelSelect =
  document.getElementById("snowLeopardLevel");

const normalMarchTimeDisplay =
  document.getElementById("normalMarchTimeDisplay");

const buffedMarchTimeDisplay =
  document.getElementById("buffedMarchTimeDisplay");


/* 補正 */

const insertDelayInput =
  document.getElementById("insertDelay");

const tapCorrectionInput =
  document.getElementById("tapCorrection");


/* 集結カード */

const addRallyButton =
  document.getElementById("addRallyButton");

const sortByArrivalButton =
  document.getElementById("sortByArrivalButton");

const clearResultsButton =
  document.getElementById("clearResultsButton");

const notificationTestButton =
  document.getElementById("notificationTestButton");

const rallyCardList =
  document.getElementById("rallyCardList");

const rallyCardTemplate =
  document.getElementById("rallyCardTemplate");

const analyzeGapsButton =
  document.getElementById("analyzeGapsButton");

const gapAnalysisResult =
  document.getElementById("gapAnalysisResult");


/* 着弾時刻計算 */

const targetArrivalHourInput =
  document.getElementById("targetArrivalHour");

const targetArrivalMinuteInput =
  document.getElementById("targetArrivalMinute");

const targetArrivalSecondInput =
  document.getElementById("targetArrivalSecond");

const calculateArrivalButton =
  document.getElementById("calculateArrivalButton");

const arrivalTargetResult =
  document.getElementById("arrivalTargetResult");

const arrivalDepartureResult =
  document.getElementById("arrivalDepartureResult");

const arrivalCountdownResult =
  document.getElementById("arrivalCountdownResult");


/* データ管理 */

const exportDataButton =
  document.getElementById("exportDataButton");

const importDataButton =
  document.getElementById("importDataButton");

const resetAllDataButton =
  document.getElementById("resetAllDataButton");

const importFileInput =
  document.getElementById("importFileInput");


/* 通知 */

const alertOverlay =
  document.getElementById("alertOverlay");

const alertRallyName =
  document.getElementById("alertRallyName");

const alertTime =
  document.getElementById("alertTime");

const closeAlertButton =
  document.getElementById("closeAlertButton");


/* =========================================================
   アプリ状態
========================================================= */

let currentAppMode = "insert";
let currentMarchInputMode = "manual";

let estimatedMyNormalMarchSeconds = null;

let arrivalDepartureTimestamp = null;

let cardIdCounter = 1;

let audioContext = null;
let alertIsOpen = false;


/* =========================================================
   共通関数
========================================================= */

function parseNumber(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue =
    value.replace(",", ".").trim();

  if (normalizedValue === "") {
    return null;
  }

  const result =
    Number.parseFloat(normalizedValue);

  return Number.isFinite(result)
    ? result
    : null;
}


function roundToTenths(value) {
  return Math.round(value * 10) / 10;
}


function formatClock(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return "--:--:--.-";
  }

  const date =
    new Date(timestamp);

  const hours =
    String(date.getHours()).padStart(2, "0");

  const minutes =
    String(date.getMinutes()).padStart(2, "0");

  const seconds =
    String(date.getSeconds()).padStart(2, "0");

  const tenths =
    Math.floor(
      date.getMilliseconds() / 100
    );

  return `${hours}:${minutes}:${seconds}.${tenths}`;
}


function formatDuration(
  seconds,
  showTenths = true
) {
  if (!Number.isFinite(seconds)) {
    return "--分--秒";
  }

  const safeSeconds =
    Math.max(0, seconds);

  const minutes =
    Math.floor(safeSeconds / 60);

  const remainingSeconds =
    safeSeconds - minutes * 60;

  const secondText =
    showTenths
      ? remainingSeconds.toFixed(1)
      : String(
          Math.round(remainingSeconds)
        );

  if (minutes > 0) {
    return `${minutes}分${secondText}秒`;
  }

  return `${secondText}秒`;
}


function formatCountdown(milliseconds) {
  if (!Number.isFinite(milliseconds)) {
    return "未計算";
  }

  const seconds =
    milliseconds / 1000;

  if (
    seconds <= 0 &&
    seconds >= -1
  ) {
    return "今です！";
  }

  if (seconds < -1) {
    const elapsed =
      Math.abs(seconds);

    if (elapsed >= 60) {
      const minutes =
        Math.floor(elapsed / 60);

      const remaining =
        elapsed - minutes * 60;

      return `${minutes}分${remaining.toFixed(1)}秒経過`;
    }

    return `${elapsed.toFixed(1)}秒経過`;
  }

  if (seconds >= 60) {
    const minutes =
      Math.floor(seconds / 60);

    const remaining =
      seconds - minutes * 60;

    return `${minutes}分${remaining.toFixed(1)}秒`;
  }

  return `${seconds.toFixed(1)}秒`;
}


function formatSignedSeconds(seconds) {
  if (!Number.isFinite(seconds)) {
    return "--";
  }

  if (Math.abs(seconds) < 0.05) {
    return "±0.0秒";
  }

  const sign =
    seconds > 0
      ? "+"
      : "-";

  return `${sign}${Math.abs(seconds).toFixed(1)}秒`;
}


function getMinuteSecondValue(
  minutesInput,
  secondsInput
) {
  const minutes =
    minutesInput.value.trim() === ""
      ? 0
      : parseNumber(
          minutesInput.value
        );

  const seconds =
    secondsInput.value.trim() === ""
      ? 0
      : parseNumber(
          secondsInput.value
        );

  if (
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return null;
  }

  if (
    minutes < 0 ||
    seconds < 0
  ) {
    return null;
  }

  return (
    Math.floor(minutes) * 60 +
    seconds
  );
}


function setMinuteSecondInputs(
  totalSeconds,
  minutesInput,
  secondsInput
) {
  if (!Number.isFinite(totalSeconds)) {
    minutesInput.value = "0";
    secondsInput.value = "";
    return;
  }

  const safeSeconds =
    Math.max(0, totalSeconds);

  const minutes =
    Math.floor(safeSeconds / 60);

  const seconds =
    roundToTenths(
      safeSeconds - minutes * 60
    );

  minutesInput.value =
    String(minutes);

  secondsInput.value =
    String(seconds);
}


function normalizeMinuteSecondInputs(
  minutesInput,
  secondsInput
) {
  let minutes =
    parseNumber(
      minutesInput.value
    );

  let seconds =
    parseNumber(
      secondsInput.value
    );

  if (!Number.isFinite(minutes)) {
    minutes = 0;
  }

  if (!Number.isFinite(seconds)) {
    seconds = 0;
  }

  minutes =
    Math.max(
      0,
      Math.floor(minutes)
    );

  seconds =
    Math.max(0, seconds);

  if (seconds >= 60) {
    const extraMinutes =
      Math.floor(seconds / 60);

    minutes += extraMinutes;

    seconds -=
      extraMinutes * 60;
  }

  minutesInput.value =
    String(minutes);

  secondsInput.value =
    String(
      roundToTenths(seconds)
    );
}


function sanitizeNumericInput(input) {
  const allowNegative =
    input.id === "tapCorrection";

  let value =
    input.value.replace(",", ".");

  value =
    value.replace(
      allowNegative
        ? /[^0-9.-]/g
        : /[^0-9.]/g,
      ""
    );

  const firstDecimal =
    value.indexOf(".");

  if (firstDecimal !== -1) {
    value =
      value.slice(
        0,
        firstDecimal + 1
      ) +
      value
        .slice(firstDecimal + 1)
        .replace(/\./g, "");
  }

  if (allowNegative) {
    const hasMinus =
      value.startsWith("-");

    value =
      value.replace(/-/g, "");

    if (hasMinus) {
      value =
        `-${value}`;
    }
  }

  input.value = value;
}


function moveCursorToEnd(input) {
  requestAnimationFrame(() => {
    try {
      const length =
        input.value.length;

      input.setSelectionRange(
        length,
        length
      );
    } catch (error) {
      /*
        対応していないブラウザでは無視
      */
    }
  });
}


function calculateDistance(
  startX,
  startY,
  targetX,
  targetY
) {
  if (
    !Number.isFinite(startX) ||
    !Number.isFinite(startY) ||
    !Number.isFinite(targetX) ||
    !Number.isFinite(targetY)
  ) {
    return null;
  }

  const differenceX =
    targetX - startX;

  const differenceY =
    targetY - startY;

  return Math.sqrt(
    differenceX ** 2 +
    differenceY ** 2
  );
}


function estimateNormalMarchSeconds(
  distance,
  targetType
) {
  if (!Number.isFinite(distance)) {
    return null;
  }

  const formula =
    COORDINATE_FORMULAS[
      targetType === "city"
        ? "city"
        : "castle"
    ];

  const rawSeconds =
    distance * formula.slope +
    formula.intercept;

  return Math.round(
    Math.max(
      formula.minimum,
      rawSeconds
    )
  );
}


function getSnowLeopardMultiplier(
  active,
  level
) {
  if (!active) {
    return 1;
  }

  return (
    SNOW_LEOPARD_MULTIPLIERS[
      Number(level)
    ] ?? 1
  );
}


function applySnowLeopardBuff(
  normalSeconds,
  active,
  level
) {
  if (
    !Number.isFinite(normalSeconds) ||
    normalSeconds <= 0
  ) {
    return null;
  }

  const multiplier =
    getSnowLeopardMultiplier(
      active,
      level
    );

  return normalSeconds / multiplier;
}


function setResultMessage(
  card,
  message,
  className = ""
) {
  const messageElement =
    card.querySelector(
      ".result-message"
    );

  messageElement.textContent =
    message;

  messageElement.classList.remove(
    "warning",
    "success",
    "danger"
  );

  if (className) {
    messageElement.classList.add(
      className
    );
  }
}


function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   入力補助
========================================================= */

function initializeInputHelpers(
  root = document
) {
  const cursorInputs =
    root.querySelectorAll(
      ".cursor-end-input"
    );

  cursorInputs.forEach((input) => {
    if (
      input.dataset.cursorReady ===
      "true"
    ) {
      return;
    }

    input.dataset.cursorReady =
      "true";

    input.addEventListener(
      "focus",
      () => {
        moveCursorToEnd(input);
      }
    );

    input.addEventListener(
      "click",
      () => {
        moveCursorToEnd(input);
      }
    );
  });

  const numericInputs =
    root.querySelectorAll(
      ".numeric-input"
    );

  numericInputs.forEach((input) => {
    if (
      input.dataset.numericReady ===
      "true"
    ) {
      return;
    }

    input.dataset.numericReady =
      "true";

    input.addEventListener(
      "input",
      () => {
        sanitizeNumericInput(input);
      }
    );
  });
}


/* =========================================================
   時計
========================================================= */

function updateCurrentClock() {
  currentTimeElement.textContent =
    formatClock(Date.now());
}


/* =========================================================
   表示モード
========================================================= */

function setAppMode(mode) {
  currentAppMode =
    mode === "arrival"
      ? "arrival"
      : "insert";

  const insertActive =
    currentAppMode === "insert";

  insertModeButton.classList.toggle(
    "active",
    insertActive
  );

  arrivalModeButton.classList.toggle(
    "active",
    !insertActive
  );

  insertModeSection.classList.toggle(
    "hidden",
    !insertActive
  );

  arrivalModeSection.classList.toggle(
    "hidden",
    insertActive
  );

  saveAllData();
}


function setMyMarchInputMode(mode) {
  currentMarchInputMode =
    mode === "coordinate"
      ? "coordinate"
      : "manual";

  const manualActive =
    currentMarchInputMode ===
    "manual";

  manualMarchModeButton.classList.toggle(
    "active",
    manualActive
  );

  coordinateMarchModeButton.classList.toggle(
    "active",
    !manualActive
  );

  manualMarchSettings.classList.toggle(
    "hidden",
    !manualActive
  );

  coordinateMarchSettings.classList.toggle(
    "hidden",
    manualActive
  );

  updateMyEstimatedMarch();
  updateMyMarchDisplays();
  saveAllData();
}


/* =========================================================
   防衛施設
========================================================= */

function getDefenseCoordinates() {
  const x =
    parseNumber(
      defenseCoordinateXInput.value
    );

  const y =
    parseNumber(
      defenseCoordinateYInput.value
    );

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return null;
  }

  return { x, y };
}


function updateAllCoordinateEstimates() {
  updateMyEstimatedMarch();

  const cards =
    rallyCardList.querySelectorAll(
      ".rally-card"
    );

  cards.forEach((card) => {
    updateEnemyCoordinateEstimate(card);
  });
}


/* =========================================================
   自分の座標計算
========================================================= */

function updateMyEstimatedMarch() {
  const defense =
    getDefenseCoordinates();

  const myX =
    parseNumber(
      myCoordinateXInput.value
    );

  const myY =
    parseNumber(
      myCoordinateYInput.value
    );

  if (
    !defense ||
    !Number.isFinite(myX) ||
    !Number.isFinite(myY)
  ) {
    estimatedMyNormalMarchSeconds =
      null;

    estimatedMarchTimeElement.textContent =
      "未計算";

    estimatedDistanceElement.textContent =
      "--";

    estimatedErrorElement.textContent =
      "--";

    updateMyMarchDisplays();

    return null;
  }

  const distance =
    calculateDistance(
      myX,
      myY,
      defense.x,
      defense.y
    );

  const targetType =
    defenseTargetTypeSelect.value ===
    "city"
      ? "city"
      : "castle";

  const normalSeconds =
    estimateNormalMarchSeconds(
      distance,
      targetType
    );

  estimatedMyNormalMarchSeconds =
    normalSeconds;

  estimatedMarchTimeElement.textContent =
    formatDuration(
      normalSeconds,
      false
    );

  estimatedDistanceElement.textContent =
    `${distance.toFixed(2)}マス`;

  estimatedErrorElement.textContent =
    COORDINATE_FORMULAS[
      targetType
    ].errorText;

  updateMyMarchDisplays();

  return normalSeconds;
}


function applyMyEstimatedMarch() {
  const estimatedSeconds =
    updateMyEstimatedMarch();

  if (!Number.isFinite(estimatedSeconds)) {
    window.alert(
      "自分の座標と防衛施設の座標を入力してください。"
    );

    return;
  }

  setMinuteSecondInputs(
    estimatedSeconds,
    myMarchMinutesInput,
    myMarchSecondsInput
  );

  setMyMarchInputMode("manual");

  updateMyMarchDisplays();
  saveAllData();
}


/* =========================================================
   自分の行軍時間
========================================================= */

function getMyNormalMarchSeconds() {
  if (
    currentMarchInputMode ===
    "coordinate"
  ) {
    return updateMyEstimatedMarch();
  }

  return getMinuteSecondValue(
    myMarchMinutesInput,
    myMarchSecondsInput
  );
}


function getMyEffectiveMarchSeconds() {
  const normalSeconds =
    getMyNormalMarchSeconds();

  return applySnowLeopardBuff(
    normalSeconds,
    snowLeopardActiveInput.checked,
    snowLeopardLevelSelect.value
  );
}


function updateMyMarchDisplays() {
  let normalSeconds;

  if (
    currentMarchInputMode ===
    "coordinate"
  ) {
    normalSeconds =
      estimatedMyNormalMarchSeconds;
  } else {
    normalSeconds =
      getMinuteSecondValue(
        myMarchMinutesInput,
        myMarchSecondsInput
      );
  }

  if (
    !Number.isFinite(normalSeconds) ||
    normalSeconds <= 0
  ) {
    normalMarchTimeDisplay.textContent =
      "--分--秒";

    buffedMarchTimeDisplay.textContent =
      "--分--秒";

    return;
  }

  const buffedSeconds =
    applySnowLeopardBuff(
      normalSeconds,
      snowLeopardActiveInput.checked,
      snowLeopardLevelSelect.value
    );

  normalMarchTimeDisplay.textContent =
    formatDuration(normalSeconds);

  buffedMarchTimeDisplay.textContent =
    formatDuration(buffedSeconds);
}


function updateMySnowLeopardControls() {
  snowLeopardLevelSelect.disabled =
    !snowLeopardActiveInput.checked;

  if (
    snowLeopardActiveInput.checked &&
    snowLeopardLevelSelect.value ===
      "0"
  ) {
    snowLeopardLevelSelect.value =
      "1";
  }

  updateMyMarchDisplays();
  saveAllData();
}


/* =========================================================
   音・振動
========================================================= */

function prepareAudio() {
  const AudioContextClass =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  if (!audioContext) {
    audioContext =
      new AudioContextClass();
  }

  if (
    audioContext.state ===
    "suspended"
  ) {
    audioContext.resume().catch(
      () => {}
    );
  }
}


function playNotificationSound() {
  prepareAudio();

  if (!audioContext) {
    return;
  }

  const startTime =
    audioContext.currentTime;

  const frequencies = [
    880,
    1175,
    880
  ];

  frequencies.forEach(
    (frequency, index) => {
      const oscillator =
        audioContext.createOscillator();

      const gainNode =
        audioContext.createGain();

      const beepStart =
        startTime +
        index * 0.22;

      const beepEnd =
        beepStart + 0.16;

      oscillator.type = "sine";

      oscillator.frequency.setValueAtTime(
        frequency,
        beepStart
      );

      gainNode.gain.setValueAtTime(
        0.0001,
        beepStart
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.35,
        beepStart + 0.02
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        beepEnd
      );

      oscillator.connect(gainNode);

      gainNode.connect(
        audioContext.destination
      );

      oscillator.start(beepStart);

      oscillator.stop(
        beepEnd + 0.02
      );
    }
  );
}


function vibrateDevice() {
  if ("vibrate" in navigator) {
    navigator.vibrate([
      250,
      100,
      250,
      100,
      500
    ]);
  }
}


/* =========================================================
   通知
========================================================= */

function showDepartureAlert(
  rallyName,
  departureTimestamp
) {
  if (alertIsOpen) {
    return;
  }

  alertIsOpen = true;

  alertRallyName.textContent =
    rallyName || "集結主";

  alertTime.textContent =
    formatClock(
      departureTimestamp
    );

  alertOverlay.classList.add(
    "show"
  );

  alertOverlay.setAttribute(
    "aria-hidden",
    "false"
  );

  playNotificationSound();
  vibrateDevice();
}


function closeDepartureAlert() {
  alertIsOpen = false;

  alertOverlay.classList.remove(
    "show"
  );

  alertOverlay.setAttribute(
    "aria-hidden",
    "true"
  );

  if ("vibrate" in navigator) {
    navigator.vibrate(0);
  }
}


/* =========================================================
   集結カード作成
========================================================= */

function createRallyCard(
  savedData = null
) {
  const fragment =
    rallyCardTemplate.content.cloneNode(
      true
    );

  const card =
    fragment.querySelector(
      ".rally-card"
    );

  card.dataset.cardId =
    String(cardIdCounter);

  cardIdCounter += 1;

  resetRallyCardDatasets(card);

  rallyCardList.appendChild(
    fragment
  );

  const addedCard =
    rallyCardList.lastElementChild;

  setupRallyCardEvents(
    addedCard
  );

  if (savedData) {
    applySavedRallyCardData(
      addedCard,
      savedData
    );
  }

  initializeInputHelpers(
    addedCard
  );

  updateRallyCardNumbers();
  updateRallyCardModeDisplay(
    addedCard
  );

  updateEnemyMarchModeDisplay(
    addedCard
  );

  updateEnemyCoordinateEstimate(
    addedCard
  );

  return addedCard;
}


function resetRallyCardDatasets(card) {
  card.dataset.cardMode = "rally";

  card.dataset.enemyMarchMode =
    "manual";

  card.dataset.enemyEstimatedNormal =
    "";

  card.dataset.enemyEstimatedEffective =
    "";

  card.dataset.capturedTimestamp =
    "";

  card.dataset.enemyDeparture =
    "";

  card.dataset.enemyArrival =
    "";

  card.dataset.myDeparture =
    "";

  card.dataset.myArrival =
    "";

  card.dataset.actualDeparture =
    "";

  card.dataset.alerted =
    "false";
}


/* =========================================================
   集結カードイベント
========================================================= */

function setupRallyCardEvents(card) {
  const deleteButton =
    card.querySelector(
      ".delete-rally-button"
    );

  const enemyMarchModeButtons =
    card.querySelectorAll(
      "[data-enemy-march-mode]"
    );

  const cardModeButtons =
    card.querySelectorAll(
      "[data-card-mode]"
    );

  const calculateButton =
    card.querySelector(
      ".capture-calculate-button"
    );

  const actualDepartureButton =
    card.querySelector(
      ".record-actual-departure-button"
    );

  const applyEnemyEstimateButton =
    card.querySelector(
      ".apply-enemy-estimated-button"
    );

  const enemySnowActive =
    card.querySelector(
      ".enemy-snow-leopard-active"
    );

  const enemySnowLevel =
    card.querySelector(
      ".enemy-snow-leopard-level"
    );

  const enemyCoordinateX =
    card.querySelector(
      ".enemy-coordinate-x"
    );

  const enemyCoordinateY =
    card.querySelector(
      ".enemy-coordinate-y"
    );

  const enemyMinutes =
    card.querySelector(
      ".enemy-march-minutes-input"
    );

  const enemySeconds =
    card.querySelector(
      ".enemy-march-seconds-input"
    );

  const remainingMinutes =
    card.querySelector(
      ".remaining-minutes-input"
    );

  const remainingSeconds =
    card.querySelector(
      ".remaining-seconds-input"
    );


  deleteButton.addEventListener(
    "click",
    () => {
      const cards =
        rallyCardList.querySelectorAll(
          ".rally-card"
        );

      if (cards.length <= 1) {
        clearRallyCardInputs(card);
        clearRallyCardResult(card);
        saveAllData();
        return;
      }

      card.remove();

      updateRallyCardNumbers();
      analyzeArrivalGaps();
      saveAllData();
    }
  );


  enemyMarchModeButtons.forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          card.dataset.enemyMarchMode =
            button.dataset.enemyMarchMode;

          updateEnemyMarchModeDisplay(
            card
          );

          clearRallyCardResult(card);

          updateEnemyCoordinateEstimate(
            card
          );

          saveAllData();
        }
      );
    }
  );


  cardModeButtons.forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          card.dataset.cardMode =
            button.dataset.cardMode;

          updateRallyCardModeDisplay(
            card
          );

          clearRallyCardResult(card);
          saveAllData();
        }
      );
    }
  );


  enemySnowActive.addEventListener(
    "change",
    () => {
      enemySnowLevel.disabled =
        !enemySnowActive.checked;

      if (
        enemySnowActive.checked &&
        enemySnowLevel.value ===
          "0"
      ) {
        enemySnowLevel.value =
          "1";
      }

      updateEnemyCoordinateEstimate(
        card
      );

      saveAllData();
    }
  );


  enemySnowLevel.addEventListener(
    "change",
    () => {
      updateEnemyCoordinateEstimate(
        card
      );

      saveAllData();
    }
  );


  [
    enemyCoordinateX,
    enemyCoordinateY
  ].forEach((input) => {
    input.addEventListener(
      "input",
      () => {
        updateEnemyCoordinateEstimate(
          card
        );

        saveAllData();
      }
    );
  });


  applyEnemyEstimateButton.addEventListener(
    "click",
    () => {
      applyEnemyEstimatedMarch(
        card
      );
    }
  );


  calculateButton.addEventListener(
    "click",
    () => {
      prepareAudio();

      normalizeMinuteSecondInputs(
        enemyMinutes,
        enemySeconds
      );

      normalizeMinuteSecondInputs(
        remainingMinutes,
        remainingSeconds
      );

      calculateRallyCard(card);
    }
  );


  actualDepartureButton.addEventListener(
    "click",
    () => {
      recordActualDeparture(card);
    }
  );


  const saveInputs =
    card.querySelectorAll(
      "input, select"
    );

  saveInputs.forEach((element) => {
    element.addEventListener(
      "input",
      saveAllData
    );

    element.addEventListener(
      "change",
      saveAllData
    );
  });
}


/* =========================================================
   相手の行軍時間設定
========================================================= */

function updateEnemyMarchModeDisplay(
  card
) {
  const mode =
    card.dataset.enemyMarchMode ===
    "coordinate"
      ? "coordinate"
      : "manual";

  const buttons =
    card.querySelectorAll(
      "[data-enemy-march-mode]"
    );

  buttons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.enemyMarchMode ===
        mode
    );
  });

  const manualSettings =
    card.querySelector(
      ".enemy-manual-settings"
    );

  const coordinateSettings =
    card.querySelector(
      ".enemy-coordinate-settings"
    );

  manualSettings.classList.toggle(
    "hidden",
    mode !== "manual"
  );

  coordinateSettings.classList.toggle(
    "hidden",
    mode !== "coordinate"
  );
}


function updateEnemyCoordinateEstimate(
  card
) {
  const defense =
    getDefenseCoordinates();

  const enemyX =
    parseNumber(
      card.querySelector(
        ".enemy-coordinate-x"
      ).value
    );

  const enemyY =
    parseNumber(
      card.querySelector(
        ".enemy-coordinate-y"
      ).value
    );

  const estimatedTimeElement =
    card.querySelector(
      ".enemy-estimated-march-time"
    );

  const distanceElement =
    card.querySelector(
      ".enemy-estimated-distance"
    );

  const normalTimeElement =
    card.querySelector(
      ".enemy-normal-estimated-time"
    );

  if (
    !defense ||
    !Number.isFinite(enemyX) ||
    !Number.isFinite(enemyY)
  ) {
    card.dataset.enemyEstimatedNormal =
      "";

    card.dataset.enemyEstimatedEffective =
      "";

    estimatedTimeElement.textContent =
      "未計算";

    distanceElement.textContent =
      "--";

    normalTimeElement.textContent =
      "--";

    return null;
  }

  const distance =
    calculateDistance(
      enemyX,
      enemyY,
      defense.x,
      defense.y
    );

  const targetType =
    defenseTargetTypeSelect.value ===
    "city"
      ? "city"
      : "castle";

  const normalSeconds =
    estimateNormalMarchSeconds(
      distance,
      targetType
    );

  const enemySnowActive =
    card.querySelector(
      ".enemy-snow-leopard-active"
    ).checked;

  const enemySnowLevel =
    card.querySelector(
      ".enemy-snow-leopard-level"
    ).value;

  const effectiveSeconds =
    applySnowLeopardBuff(
      normalSeconds,
      enemySnowActive,
      enemySnowLevel
    );

  card.dataset.enemyEstimatedNormal =
    String(normalSeconds);

  card.dataset.enemyEstimatedEffective =
    String(effectiveSeconds);

  estimatedTimeElement.textContent =
    formatDuration(
      effectiveSeconds,
      true
    );

  distanceElement.textContent =
    `${distance.toFixed(2)}マス`;

  normalTimeElement.textContent =
    formatDuration(
      normalSeconds,
      false
    );

  return effectiveSeconds;
}


function applyEnemyEstimatedMarch(
  card
) {
  const effectiveSeconds =
    updateEnemyCoordinateEstimate(
      card
    );

  if (!Number.isFinite(effectiveSeconds)) {
    window.alert(
      "相手の座標と防衛施設の座標を入力してください。"
    );

    return;
  }

  setMinuteSecondInputs(
    effectiveSeconds,
    card.querySelector(
      ".enemy-march-minutes-input"
    ),
    card.querySelector(
      ".enemy-march-seconds-input"
    )
  );

  card.dataset.enemyMarchMode =
    "manual";

  updateEnemyMarchModeDisplay(
    card
  );

  saveAllData();
}


function getEnemyMarchSeconds(card) {
  if (
    card.dataset.enemyMarchMode ===
    "coordinate"
  ) {
    return updateEnemyCoordinateEstimate(
      card
    );
  }

  return getMinuteSecondValue(
    card.querySelector(
      ".enemy-march-minutes-input"
    ),
    card.querySelector(
      ".enemy-march-seconds-input"
    )
  );
}


/* =========================================================
   集結中・行軍中切り替え
========================================================= */

function updateRallyCardModeDisplay(
  card
) {
  const mode =
    card.dataset.cardMode ===
    "march"
      ? "march"
      : "rally";

  const buttons =
    card.querySelectorAll(
      "[data-card-mode]"
    );

  buttons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.cardMode ===
        mode
    );
  });

  const label =
    card.querySelector(
      ".remaining-time-label"
    );

  const secondsInput =
    card.querySelector(
      ".remaining-seconds-input"
    );

  if (mode === "march") {
    label.textContent =
      "行軍残り時間";

    secondsInput.placeholder =
      "例：30";
  } else {
    label.textContent =
      "集結残り時間";

    secondsInput.placeholder =
      "例：10";
  }
}


function updateRallyCardNumbers() {
  const cards =
    rallyCardList.querySelectorAll(
      ".rally-card"
    );

  cards.forEach((card, index) => {
    card.querySelector(
      ".rally-card-number"
    ).textContent =
      String(index + 1);
  });
}


/* =========================================================
   差し込み計算
========================================================= */

function calculateRallyCard(card) {
  const myMarchSeconds =
    getMyEffectiveMarchSeconds();

  if (
    !Number.isFinite(myMarchSeconds) ||
    myMarchSeconds <= 0
  ) {
    setResultMessage(
      card,
      "自分の行軍時間を入力してください。",
      "danger"
    );

    return;
  }

  const enemyMarchSeconds =
    getEnemyMarchSeconds(card);

  if (
    !Number.isFinite(enemyMarchSeconds) ||
    enemyMarchSeconds <= 0
  ) {
    setResultMessage(
      card,
      "相手の行軍時間を入力してください。",
      "danger"
    );

    return;
  }

  const remainingSeconds =
    getMinuteSecondValue(
      card.querySelector(
        ".remaining-minutes-input"
      ),
      card.querySelector(
        ".remaining-seconds-input"
      )
    );

  if (
    !Number.isFinite(remainingSeconds) ||
    remainingSeconds < 0
  ) {
    setResultMessage(
      card,
      "現在表示されている残り時間を入力してください。",
      "danger"
    );

    return;
  }

  const insertDelay =
    parseNumber(
      insertDelayInput.value
    );

  const tapCorrection =
    parseNumber(
      tapCorrectionInput.value
    );

  if (
    !Number.isFinite(insertDelay) ||
    insertDelay < 0
  ) {
    setResultMessage(
      card,
      "差し込み秒数を0以上で入力してください。",
      "danger"
    );

    return;
  }

  if (!Number.isFinite(tapCorrection)) {
    setResultMessage(
      card,
      "タップ・通信補正を入力してください。",
      "danger"
    );

    return;
  }

  const capturedTimestamp =
    Date.now();

  let enemyDepartureTimestamp;
  let enemyArrivalTimestamp;

  if (
    card.dataset.cardMode ===
    "march"
  ) {
    enemyArrivalTimestamp =
      capturedTimestamp +
      remainingSeconds * 1000;

    enemyDepartureTimestamp =
      enemyArrivalTimestamp -
      enemyMarchSeconds * 1000;
  } else {
    enemyDepartureTimestamp =
      capturedTimestamp +
      remainingSeconds * 1000;

    enemyArrivalTimestamp =
      enemyDepartureTimestamp +
      enemyMarchSeconds * 1000;
  }

  const myArrivalTimestamp =
    enemyArrivalTimestamp +
    insertDelay * 1000;

  const myDepartureTimestamp =
    myArrivalTimestamp -
    myMarchSeconds * 1000 +
    tapCorrection * 1000;

  card.dataset.capturedTimestamp =
    String(capturedTimestamp);

  card.dataset.enemyDeparture =
    String(enemyDepartureTimestamp);

  card.dataset.enemyArrival =
    String(enemyArrivalTimestamp);

  card.dataset.myDeparture =
    String(myDepartureTimestamp);

  card.dataset.myArrival =
    String(myArrivalTimestamp);

  card.dataset.actualDeparture =
    "";

  card.dataset.alerted =
    "false";

  card.classList.remove(
    "card-ready",
    "card-fired"
  );

  displayRallyCardResult(card);

  clearAccelerationResult(card);

  updateCardCountdown(card);

  saveAllData();
}


function displayRallyCardResult(card) {
  card.querySelector(
    ".captured-time-result"
  ).textContent =
    formatClock(
      Number(
        card.dataset.capturedTimestamp
      )
    );

  card.querySelector(
    ".enemy-departure-result"
  ).textContent =
    formatClock(
      Number(
        card.dataset.enemyDeparture
      )
    );

  card.querySelector(
    ".enemy-arrival-result"
  ).textContent =
    formatClock(
      Number(
        card.dataset.enemyArrival
      )
    );

  card.querySelector(
    ".my-departure-result"
  ).textContent =
    formatClock(
      Number(
        card.dataset.myDeparture
      )
    );

  card.querySelector(
    ".my-arrival-result"
  ).textContent =
    formatClock(
      Number(
        card.dataset.myArrival
      )
    );
}


/* =========================================================
   カウントダウン
========================================================= */

function updateAllCountdowns() {
  const cards =
    rallyCardList.querySelectorAll(
      ".rally-card"
    );

  cards.forEach((card) => {
    updateCardCountdown(card);
  });

  updateArrivalCountdown();
}


function updateCardCountdown(card) {
  if (
    card.dataset.myDeparture ===
    ""
  ) {
    return;
  }

  const departureTimestamp =
    Number(
      card.dataset.myDeparture
    );

  if (
    !Number.isFinite(
      departureTimestamp
    )
  ) {
    return;
  }

  const remainingMilliseconds =
    departureTimestamp -
    Date.now();

  card.querySelector(
    ".countdown-result"
  ).textContent =
    formatCountdown(
      remainingMilliseconds
    );

  if (
    remainingMilliseconds <
    -3000
  ) {
    card.classList.remove(
      "card-ready"
    );

    card.classList.add(
      "card-fired"
    );

    setResultMessage(
      card,
      "出撃予定時刻を過ぎています。",
      "danger"
    );

    return;
  }

  if (
    remainingMilliseconds <= 0
  ) {
    card.classList.remove(
      "card-ready"
    );

    card.classList.add(
      "card-fired"
    );

    setResultMessage(
      card,
      "今、行軍ボタンを押してください！",
      "success"
    );

    if (
      card.dataset.alerted !==
      "true"
    ) {
      card.dataset.alerted =
        "true";

      const rallyName =
        card.querySelector(
          ".rally-name-input"
        ).value.trim();

      showDepartureAlert(
        rallyName,
        departureTimestamp
      );
    }

    return;
  }

  if (
    remainingMilliseconds <=
    5000
  ) {
    card.classList.add(
      "card-ready"
    );

    card.classList.remove(
      "card-fired"
    );

    setResultMessage(
      card,
      "まもなく出撃です。行軍ボタンを押せる状態で待機してください。",
      "warning"
    );

    return;
  }

  card.classList.remove(
    "card-ready",
    "card-fired"
  );

  const enemyDepartureTimestamp =
    Number(
      card.dataset.enemyDeparture
    );

  if (
    departureTimestamp <
    enemyDepartureTimestamp
  ) {
    setResultMessage(
      card,
      "相手の集結が出発する前に、自分が先に出撃します。",
      "warning"
    );
  } else {
    setResultMessage(
      card,
      "表示された自分の出撃時刻に行軍してください。"
    );
  }
}


/* =========================================================
   加速計算
========================================================= */

function recordActualDeparture(card) {
  if (
    card.dataset.myArrival ===
    ""
  ) {
    window.alert(
      "先に差し込み計算をしてください。"
    );

    return;
  }

  card.dataset.actualDeparture =
    String(Date.now());

  calculateAccelerationOptions(
    card
  );
}


function calculateAccelerationOptions(
  card
) {
  const actualDepartureTimestamp =
    Number(
      card.dataset.actualDeparture
    );

  const plannedDepartureTimestamp =
    Number(
      card.dataset.myDeparture
    );

  const targetArrivalTimestamp =
    Number(
      card.dataset.myArrival
    );

  const marchSeconds =
    getMyEffectiveMarchSeconds();

  if (
    !Number.isFinite(
      actualDepartureTimestamp
    ) ||
    !Number.isFinite(
      targetArrivalTimestamp
    ) ||
    !Number.isFinite(
      marchSeconds
    )
  ) {
    return;
  }

  const delaySeconds =
    (
      actualDepartureTimestamp -
      plannedDepartureTimestamp
    ) / 1000;

  card.querySelector(
    ".actual-departure-time"
  ).textContent =
    formatClock(
      actualDepartureTimestamp
    );

  card.querySelector(
    ".departure-delay-result"
  ).textContent =
    formatSignedSeconds(
      delaySeconds
    );

  const options = [
    {
      label: "加速なし",
      durationRate: 1,
      optionElement:
        card.querySelector(
          ".no-boost-option"
        ),
      arrivalElement:
        card.querySelector(
          ".no-boost-arrival"
        ),
      statusElement:
        card.querySelector(
          ".no-boost-status"
        )
    },

    {
      label: "25%加速",
      durationRate: 0.75,
      optionElement:
        card.querySelector(
          ".boost-25-option"
        ),
      arrivalElement:
        card.querySelector(
          ".boost-25-arrival"
        ),
      statusElement:
        card.querySelector(
          ".boost-25-status"
        )
    },

    {
      label: "50%加速",
      durationRate: 0.5,
      optionElement:
        card.querySelector(
          ".boost-50-option"
        ),
      arrivalElement:
        card.querySelector(
          ".boost-50-arrival"
        ),
      statusElement:
        card.querySelector(
          ".boost-50-status"
        )
    }
  ];

  const results =
    options.map((option) => {
      const arrivalTimestamp =
        actualDepartureTimestamp +
        marchSeconds *
        option.durationRate *
        1000;

      const differenceSeconds =
        (
          arrivalTimestamp -
          targetArrivalTimestamp
        ) / 1000;

      option.arrivalTimestamp =
        arrivalTimestamp;

      option.differenceSeconds =
        differenceSeconds;

      displayAccelerationOption(
        option
      );

      return option;
    });

  const bestOption =
    results.reduce(
      (best, current) => {
        if (!best) {
          return current;
        }

        return (
          Math.abs(
            current.differenceSeconds
          ) <
          Math.abs(
            best.differenceSeconds
          )
            ? current
            : best
        );
      },
      null
    );

  const bestText =
    card.querySelector(
      ".best-acceleration-text"
    );

  if (!bestOption) {
    bestText.textContent =
      "判定できません";

    return;
  }

  const difference =
    bestOption.differenceSeconds;

  if (
    Math.abs(difference) <=
    0.5
  ) {
    bestText.textContent =
      `${bestOption.label}が最適（ほぼ目標どおり）`;
  } else if (difference > 0) {
    bestText.textContent =
      `${bestOption.label}が最適（${difference.toFixed(1)}秒遅れ）`;
  } else {
    bestText.textContent =
      `${bestOption.label}が最適（${Math.abs(difference).toFixed(1)}秒早い）`;
  }

  saveAllData();
}


function displayAccelerationOption(
  option
) {
  option.optionElement.classList.remove(
    "success",
    "warning",
    "danger"
  );

  option.arrivalElement.textContent =
    formatClock(
      option.arrivalTimestamp
    );

  const difference =
    option.differenceSeconds;

  if (
    Math.abs(difference) <=
    0.5
  ) {
    option.statusElement.textContent =
      "ほぼ目標どおり";

    option.optionElement.classList.add(
      "success"
    );

    return;
  }

  if (difference > 0) {
    option.statusElement.textContent =
      `${difference.toFixed(1)}秒遅れ`;

    option.optionElement.classList.add(
      difference <= 1.5
        ? "warning"
        : "danger"
    );

    return;
  }

  option.statusElement.textContent =
    `${Math.abs(difference).toFixed(1)}秒早い`;

  option.optionElement.classList.add(
    Math.abs(difference) <= 1.5
      ? "warning"
      : "danger"
  );
}


function clearAccelerationResult(
  card
) {
  card.dataset.actualDeparture =
    "";

  card.querySelector(
    ".actual-departure-time"
  ).textContent =
    "未記録";

  card.querySelector(
    ".departure-delay-result"
  ).textContent =
    "--";

  const settings = [
    {
      option: ".no-boost-option",
      arrival: ".no-boost-arrival",
      status: ".no-boost-status"
    },

    {
      option: ".boost-25-option",
      arrival: ".boost-25-arrival",
      status: ".boost-25-status"
    },

    {
      option: ".boost-50-option",
      arrival: ".boost-50-arrival",
      status: ".boost-50-status"
    }
  ];

  settings.forEach((setting) => {
    const optionElement =
      card.querySelector(
        setting.option
      );

    optionElement.classList.remove(
      "success",
      "warning",
      "danger"
    );

    card.querySelector(
      setting.arrival
    ).textContent =
      "--";

    card.querySelector(
      setting.status
    ).textContent =
      "未計算";
  });

  card.querySelector(
    ".best-acceleration-text"
  ).textContent =
    "出撃後に計算できます";
}


/* =========================================================
   クリア
========================================================= */

function clearRallyCardResult(card) {
  card.dataset.capturedTimestamp =
    "";

  card.dataset.enemyDeparture =
    "";

  card.dataset.enemyArrival =
    "";

  card.dataset.myDeparture =
    "";

  card.dataset.myArrival =
    "";

  card.dataset.actualDeparture =
    "";

  card.dataset.alerted =
    "false";

  card.classList.remove(
    "card-ready",
    "card-fired"
  );

  [
    ".captured-time-result",
    ".enemy-departure-result",
    ".enemy-arrival-result",
    ".my-departure-result",
    ".my-arrival-result"
  ].forEach((selector) => {
    card.querySelector(
      selector
    ).textContent =
      "--:--:--.-";
  });

  card.querySelector(
    ".countdown-result"
  ).textContent =
    "未計算";

  setResultMessage(
    card,
    "残り時間を入力して計算してください。"
  );

  clearAccelerationResult(card);
}


function clearRallyCardInputs(card) {
  card.querySelector(
    ".rally-name-input"
  ).value = "";

  card.querySelector(
    ".enemy-march-minutes-input"
  ).value = "0";

  card.querySelector(
    ".enemy-march-seconds-input"
  ).value = "";

  card.querySelector(
    ".enemy-coordinate-x"
  ).value = "";

  card.querySelector(
    ".enemy-coordinate-y"
  ).value = "";

  card.querySelector(
    ".enemy-snow-leopard-active"
  ).checked = false;

  card.querySelector(
    ".enemy-snow-leopard-level"
  ).value = "0";

  card.querySelector(
    ".enemy-snow-leopard-level"
  ).disabled = true;

  card.querySelector(
    ".remaining-minutes-input"
  ).value = "0";

  card.querySelector(
    ".remaining-seconds-input"
  ).value = "";

  card.dataset.cardMode =
    "rally";

  card.dataset.enemyMarchMode =
    "manual";

  updateRallyCardModeDisplay(
    card
  );

  updateEnemyMarchModeDisplay(
    card
  );

  updateEnemyCoordinateEstimate(
    card
  );
}


function clearAllRallyResults() {
  const cards =
    rallyCardList.querySelectorAll(
      ".rally-card"
    );

  cards.forEach((card) => {
    clearRallyCardResult(card);
  });

  gapAnalysisResult.className =
    "empty-result";

  gapAnalysisResult.textContent =
    "2人以上の相手を計算すると着弾間隔を分析できます。";

  saveAllData();
}


/* =========================================================
   着弾順ソート
========================================================= */

function sortCardsByArrival() {
  const cards =
    Array.from(
      rallyCardList.querySelectorAll(
        ".rally-card"
      )
    );

  cards.sort((cardA, cardB) => {
    const arrivalA =
      Number(
        cardA.dataset.enemyArrival
      );

    const arrivalB =
      Number(
        cardB.dataset.enemyArrival
      );

    const validA =
      cardA.dataset.enemyArrival !==
        "" &&
      Number.isFinite(arrivalA);

    const validB =
      cardB.dataset.enemyArrival !==
        "" &&
      Number.isFinite(arrivalB);

    if (validA && validB) {
      return arrivalA - arrivalB;
    }

    if (validA) {
      return -1;
    }

    if (validB) {
      return 1;
    }

    return 0;
  });

  cards.forEach((card) => {
    rallyCardList.appendChild(card);
  });

  updateRallyCardNumbers();
  saveAllData();
}


/* =========================================================
   多段着弾分析
========================================================= */

function analyzeArrivalGaps() {
  const cards =
    Array.from(
      rallyCardList.querySelectorAll(
        ".rally-card"
      )
    )
      .filter((card) => {
        return (
          card.dataset.enemyArrival !==
            "" &&
          Number.isFinite(
            Number(
              card.dataset.enemyArrival
            )
          )
        );
      })
      .sort((cardA, cardB) => {
        return (
          Number(
            cardA.dataset.enemyArrival
          ) -
          Number(
            cardB.dataset.enemyArrival
          )
        );
      });

  if (cards.length < 2) {
    gapAnalysisResult.className =
      "empty-result";

    gapAnalysisResult.textContent =
      "2人以上の相手を計算すると着弾間隔を分析できます。";

    return;
  }

  const list =
    document.createElement("div");

  list.className =
    "gap-analysis-list";

  for (
    let index = 0;
    index < cards.length - 1;
    index += 1
  ) {
    const firstCard =
      cards[index];

    const secondCard =
      cards[index + 1];

    const firstArrival =
      Number(
        firstCard.dataset.enemyArrival
      );

    const secondArrival =
      Number(
        secondCard.dataset.enemyArrival
      );

    const gapSeconds =
      (
        secondArrival -
        firstArrival
      ) / 1000;

    const firstName =
      firstCard.querySelector(
        ".rally-name-input"
      ).value.trim() ||
      `集結${index + 1}`;

    const secondName =
      secondCard.querySelector(
        ".rally-name-input"
      ).value.trim() ||
      `集結${index + 2}`;

    const item =
      document.createElement("article");

    item.className =
      "gap-analysis-item";

    let evaluation;

    if (gapSeconds >= 1.5) {
      item.classList.add("good");

      evaluation =
        "差し込み候補";
    } else if (
      gapSeconds >= 0.8
    ) {
      item.classList.add("medium");

      evaluation =
        "成功率低め";
    } else {
      item.classList.add("bad");

      evaluation =
        "差し込み困難";
    }

    item.innerHTML = `
      <strong>
        ${escapeHtml(firstName)}
        →
        ${escapeHtml(secondName)}
      </strong>

      <p>
        着弾間隔：
        <strong>
          ${gapSeconds.toFixed(1)}秒
        </strong>
        ／
        ${evaluation}
      </p>

      <small>
        ${formatClock(firstArrival)}
        →
        ${formatClock(secondArrival)}
      </small>
    `;

    list.appendChild(item);
  }

  gapAnalysisResult.className =
    "";

  gapAnalysisResult.innerHTML =
    "";

  gapAnalysisResult.appendChild(
    list
  );
}


/* =========================================================
   指定時刻への着弾
========================================================= */

function calculateArrivalDeparture() {
  const marchSeconds =
    getMyEffectiveMarchSeconds();

  if (
    !Number.isFinite(marchSeconds) ||
    marchSeconds <= 0
  ) {
    window.alert(
      "自分の行軍時間を入力してください。"
    );

    return;
  }

  const hour =
    parseNumber(
      targetArrivalHourInput.value
    );

  const minute =
    parseNumber(
      targetArrivalMinuteInput.value
    );

  const second =
    parseNumber(
      targetArrivalSecondInput.value
    );

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    window.alert(
      "目標着弾時刻を入力してください。"
    );

    return;
  }

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second >= 60
  ) {
    window.alert(
      "正しい時刻を入力してください。"
    );

    return;
  }

  const now =
    new Date();

  const targetDate =
    new Date(now);

  const wholeSecond =
    Math.floor(second);

  const milliseconds =
    Math.round(
      (second - wholeSecond) *
      1000
    );

  targetDate.setHours(
    Math.floor(hour),
    Math.floor(minute),
    wholeSecond,
    milliseconds
  );

  if (
    targetDate.getTime() <
    Date.now() - 1000
  ) {
    targetDate.setDate(
      targetDate.getDate() + 1
    );
  }

  const tapCorrection =
    parseNumber(
      tapCorrectionInput.value
    ) ?? 0;

  const targetTimestamp =
    targetDate.getTime();

  arrivalDepartureTimestamp =
    targetTimestamp -
    marchSeconds * 1000 +
    tapCorrection * 1000;

  arrivalTargetResult.textContent =
    formatClock(
      targetTimestamp
    );

  arrivalDepartureResult.textContent =
    formatClock(
      arrivalDepartureTimestamp
    );

  updateArrivalCountdown();
}


function updateArrivalCountdown() {
  if (
    !Number.isFinite(
      arrivalDepartureTimestamp
    )
  ) {
    return;
  }

  arrivalCountdownResult.textContent =
    formatCountdown(
      arrivalDepartureTimestamp -
      Date.now()
    );
}


/* =========================================================
   保存
========================================================= */

function collectRallyCardData(card) {
  return {
    name:
      card.querySelector(
        ".rally-name-input"
      ).value,

    enemyMarchMode:
      card.dataset.enemyMarchMode,

    enemyMinutes:
      card.querySelector(
        ".enemy-march-minutes-input"
      ).value,

    enemySeconds:
      card.querySelector(
        ".enemy-march-seconds-input"
      ).value,

    enemyCoordinateX:
      card.querySelector(
        ".enemy-coordinate-x"
      ).value,

    enemyCoordinateY:
      card.querySelector(
        ".enemy-coordinate-y"
      ).value,

    enemySnowActive:
      card.querySelector(
        ".enemy-snow-leopard-active"
      ).checked,

    enemySnowLevel:
      card.querySelector(
        ".enemy-snow-leopard-level"
      ).value,

    cardMode:
      card.dataset.cardMode,

    remainingMinutes:
      card.querySelector(
        ".remaining-minutes-input"
      ).value,

    remainingSeconds:
      card.querySelector(
        ".remaining-seconds-input"
      ).value
  };
}


function createSaveData() {
  const cards =
    Array.from(
      rallyCardList.querySelectorAll(
        ".rally-card"
      )
    );

  return {
    version: 20,

    appMode:
      currentAppMode,

    myMarchInputMode:
      currentMarchInputMode,

    defense: {
      x:
        defenseCoordinateXInput.value,

      y:
        defenseCoordinateYInput.value,

      targetType:
        defenseTargetTypeSelect.value
    },

    myManualMarch: {
      minutes:
        myMarchMinutesInput.value,

      seconds:
        myMarchSecondsInput.value
    },

    myCoordinates: {
      x:
        myCoordinateXInput.value,

      y:
        myCoordinateYInput.value
    },

    mySnowLeopard: {
      active:
        snowLeopardActiveInput.checked,

      level:
        snowLeopardLevelSelect.value
    },

    corrections: {
      insertDelay:
        insertDelayInput.value,

      tapCorrection:
        tapCorrectionInput.value
    },

    targetArrival: {
      hour:
        targetArrivalHourInput.value,

      minute:
        targetArrivalMinuteInput.value,

      second:
        targetArrivalSecondInput.value
    },

    cards:
      cards.map(
        collectRallyCardData
      )
  };
}


function saveAllData() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        createSaveData()
      )
    );
  } catch (error) {
    console.warn(
      "保存できませんでした。",
      error
    );
  }
}


/* =========================================================
   読み込み
========================================================= */

function loadSavedData() {
  let savedData = null;

  try {
    const savedText =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (savedText) {
      savedData =
        JSON.parse(savedText);
    }
  } catch (error) {
    console.warn(
      "保存データを読み込めませんでした。",
      error
    );
  }

  if (!savedData) {
    createRallyCard();

    updateMyMarchDisplays();

    return;
  }

  applySaveData(savedData);
}


function applySaveData(savedData) {
  defenseCoordinateXInput.value =
    savedData.defense?.x ??
    "";

  defenseCoordinateYInput.value =
    savedData.defense?.y ??
    "";

  defenseTargetTypeSelect.value =
    savedData.defense?.targetType ===
    "city"
      ? "city"
      : "castle";

  myMarchMinutesInput.value =
    savedData.myManualMarch?.minutes ??
    "0";

  myMarchSecondsInput.value =
    savedData.myManualMarch?.seconds ??
    "";

  myCoordinateXInput.value =
    savedData.myCoordinates?.x ??
    "";

  myCoordinateYInput.value =
    savedData.myCoordinates?.y ??
    "";

  snowLeopardActiveInput.checked =
    Boolean(
      savedData.mySnowLeopard?.active
    );

  snowLeopardLevelSelect.value =
    String(
      savedData.mySnowLeopard?.level ??
      "0"
    );

  insertDelayInput.value =
    savedData.corrections?.insertDelay ??
    "0.5";

  tapCorrectionInput.value =
    savedData.corrections?.tapCorrection ??
    "0";

  targetArrivalHourInput.value =
    savedData.targetArrival?.hour ??
    "";

  targetArrivalMinuteInput.value =
    savedData.targetArrival?.minute ??
    "";

  targetArrivalSecondInput.value =
    savedData.targetArrival?.second ??
    "";

  rallyCardList.innerHTML =
    "";

  if (
    Array.isArray(savedData.cards) &&
    savedData.cards.length > 0
  ) {
    savedData.cards.forEach(
      (cardData) => {
        createRallyCard(
          cardData
        );
      }
    );
  } else {
    createRallyCard();
  }

  setAppMode(
    savedData.appMode
  );

  setMyMarchInputMode(
    savedData.myMarchInputMode
  );

  updateMySnowLeopardControls();

  updateAllCoordinateEstimates();

  updateMyMarchDisplays();
}


function applySavedRallyCardData(
  card,
  savedData
) {
  card.querySelector(
    ".rally-name-input"
  ).value =
    savedData.name ?? "";

  card.dataset.enemyMarchMode =
    savedData.enemyMarchMode ===
    "coordinate"
      ? "coordinate"
      : "manual";

  card.querySelector(
    ".enemy-march-minutes-input"
  ).value =
    savedData.enemyMinutes ??
    "0";

  card.querySelector(
    ".enemy-march-seconds-input"
  ).value =
    savedData.enemySeconds ??
    "";

  card.querySelector(
    ".enemy-coordinate-x"
  ).value =
    savedData.enemyCoordinateX ??
    "";

  card.querySelector(
    ".enemy-coordinate-y"
  ).value =
    savedData.enemyCoordinateY ??
    "";

  card.querySelector(
    ".enemy-snow-leopard-active"
  ).checked =
    Boolean(
      savedData.enemySnowActive
    );

  card.querySelector(
    ".enemy-snow-leopard-level"
  ).value =
    String(
      savedData.enemySnowLevel ??
      "0"
    );

  card.querySelector(
    ".enemy-snow-leopard-level"
  ).disabled =
    !card.querySelector(
      ".enemy-snow-leopard-active"
    ).checked;

  card.dataset.cardMode =
    savedData.cardMode ===
    "march"
      ? "march"
      : "rally";

  card.querySelector(
    ".remaining-minutes-input"
  ).value =
    savedData.remainingMinutes ??
    "0";

  card.querySelector(
    ".remaining-seconds-input"
  ).value =
    savedData.remainingSeconds ??
    "";

  updateEnemyMarchModeDisplay(
    card
  );

  updateRallyCardModeDisplay(
    card
  );

  updateEnemyCoordinateEstimate(
    card
  );
}


/* =========================================================
   JSON書き出し・読み込み
========================================================= */

function exportData() {
  const data =
    createSaveData();

  const json =
    JSON.stringify(
      data,
      null,
      2
    );

  const blob =
    new Blob(
      [json],
      {
        type: "application/json"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  const now =
    new Date();

  const dateText =
    [
      now.getFullYear(),
      String(
        now.getMonth() + 1
      ).padStart(2, "0"),
      String(
        now.getDate()
      ).padStart(2, "0")
    ].join("-");

  link.href = url;

  link.download =
    `wos-timing-${dateText}.json`;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}


function importDataFromFile(file) {
  const reader =
    new FileReader();

  reader.addEventListener(
    "load",
    () => {
      try {
        const importedData =
          JSON.parse(
            String(reader.result)
          );

        applySaveData(
          importedData
        );

        saveAllData();

        window.alert(
          "データを読み込みました。"
        );
      } catch (error) {
        window.alert(
          "JSONファイルを読み込めませんでした。"
        );
      }
    }
  );

  reader.readAsText(file);
}


function resetAllData() {
  const confirmed =
    window.confirm(
      "入力内容と保存データをすべて初期化しますか？"
    );

  if (!confirmed) {
    return;
  }

  localStorage.removeItem(
    STORAGE_KEY
  );

  window.location.reload();
}


/* =========================================================
   イベント登録
========================================================= */

insertModeButton.addEventListener(
  "click",
  () => {
    setAppMode("insert");
  }
);


arrivalModeButton.addEventListener(
  "click",
  () => {
    setAppMode("arrival");
  }
);


manualMarchModeButton.addEventListener(
  "click",
  () => {
    setMyMarchInputMode(
      "manual"
    );
  }
);


coordinateMarchModeButton.addEventListener(
  "click",
  () => {
    setMyMarchInputMode(
      "coordinate"
    );
  }
);


[
  defenseCoordinateXInput,
  defenseCoordinateYInput
].forEach((input) => {
  input.addEventListener(
    "input",
    () => {
      updateAllCoordinateEstimates();
      saveAllData();
    }
  );
});


defenseTargetTypeSelect.addEventListener(
  "change",
  () => {
    updateAllCoordinateEstimates();
    saveAllData();
  }
);


[
  myCoordinateXInput,
  myCoordinateYInput
].forEach((input) => {
  input.addEventListener(
    "input",
    () => {
      updateMyEstimatedMarch();
      saveAllData();
    }
  );
});


applyEstimatedMarchButton.addEventListener(
  "click",
  applyMyEstimatedMarch
);


snowLeopardActiveInput.addEventListener(
  "change",
  updateMySnowLeopardControls
);


snowLeopardLevelSelect.addEventListener(
  "change",
  () => {
    updateMyMarchDisplays();
    saveAllData();
  }
);


[
  myMarchMinutesInput,
  myMarchSecondsInput,
  insertDelayInput,
  tapCorrectionInput
].forEach((input) => {
  input.addEventListener(
    "input",
    () => {
      updateMyMarchDisplays();
      saveAllData();
    }
  );
});


myMarchSecondsInput.addEventListener(
  "change",
  () => {
    normalizeMinuteSecondInputs(
      myMarchMinutesInput,
      myMarchSecondsInput
    );

    updateMyMarchDisplays();
    saveAllData();
  }
);


addRallyButton.addEventListener(
  "click",
  () => {
    const card =
      createRallyCard();

    saveAllData();

    card.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    card.querySelector(
      ".rally-name-input"
    ).focus();
  }
);


sortByArrivalButton.addEventListener(
  "click",
  sortCardsByArrival
);


clearResultsButton.addEventListener(
  "click",
  clearAllRallyResults
);


notificationTestButton.addEventListener(
  "click",
  () => {
    prepareAudio();

    showDepartureAlert(
      "通知テスト",
      Date.now()
    );
  }
);


analyzeGapsButton.addEventListener(
  "click",
  analyzeArrivalGaps
);


calculateArrivalButton.addEventListener(
  "click",
  calculateArrivalDeparture
);


[
  targetArrivalHourInput,
  targetArrivalMinuteInput,
  targetArrivalSecondInput
].forEach((input) => {
  input.addEventListener(
    "input",
    saveAllData
  );
});


exportDataButton.addEventListener(
  "click",
  exportData
);


importDataButton.addEventListener(
  "click",
  () => {
    importFileInput.click();
  }
);


importFileInput.addEventListener(
  "change",
  () => {
    const file =
      importFileInput.files?.[0];

    if (file) {
      importDataFromFile(file);
    }

    importFileInput.value =
      "";
  }
);


resetAllDataButton.addEventListener(
  "click",
  resetAllData
);


closeAlertButton.addEventListener(
  "click",
  closeDepartureAlert
);


alertOverlay.addEventListener(
  "click",
  (event) => {
    if (
      event.target ===
      alertOverlay
    ) {
      closeDepartureAlert();
    }
  }
);


/* =========================================================
   初期起動
========================================================= */

initializeInputHelpers();

loadSavedData();

updateCurrentClock();

updateAllCountdowns();

updateMyMarchDisplays();


setInterval(() => {
  updateCurrentClock();
  updateAllCountdowns();
}, 100);
