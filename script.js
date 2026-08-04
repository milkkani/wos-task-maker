"use strict";

/* =========================================================
   WOS 行軍タイミングツール Ver.3.0
   JST / UTC 切り替え対応版
========================================================= */

const STORAGE_KEY = "wos_march_timing_tool_v30";

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

const SNOW_LEOPARD_MULTIPLIERS = {
  0: 1,
  1: 1.15,
  2: 1.17,
  3: 1.19,
  4: 1.21,
  5: 1.23,
  6: 1.25,
  7: 1.27,
  8: 1.30
};

const $ = (id) => {
  return document.getElementById(id);
};

const currentTimeElement =
  $("currentTime");

const insertModeButton =
  $("insertModeButton");

const arrivalModeButton =
  $("arrivalModeButton");

const insertModeSection =
  $("insertModeSection");

const arrivalModeSection =
  $("arrivalModeSection");

const defenseCoordinateXInput =
  $("defenseCoordinateX");

const defenseCoordinateYInput =
  $("defenseCoordinateY");

const defenseTargetTypeSelect =
  $("defenseTargetType");

const manualMarchModeButton =
  $("manualMarchModeButton");

const coordinateMarchModeButton =
  $("coordinateMarchModeButton");

const manualMarchSettings =
  $("manualMarchSettings");

const coordinateMarchSettings =
  $("coordinateMarchSettings");

const myMarchMinutesInput =
  $("myMarchMinutes");

const myMarchSecondsInput =
  $("myMarchSeconds");

const myCoordinateXInput =
  $("myCoordinateX");

const myCoordinateYInput =
  $("myCoordinateY");

const estimatedMarchTimeElement =
  $("estimatedMarchTime");

const estimatedDistanceElement =
  $("estimatedDistance");

const estimatedErrorElement =
  $("estimatedError");

const applyEstimatedMarchButton =
  $("applyEstimatedMarchButton");

const snowLeopardActiveInput =
  $("snowLeopardActive");

const snowLeopardLevelSelect =
  $("snowLeopardLevel");

const normalMarchTimeDisplay =
  $("normalMarchTimeDisplay");

const buffedMarchTimeDisplay =
  $("buffedMarchTimeDisplay");

const insertDelayInput =
  $("insertDelay");

const tapCorrectionInput =
  $("tapCorrection");

const addRallyButton =
  $("addRallyButton");

const sortByArrivalButton =
  $("sortByArrivalButton");

const clearResultsButton =
  $("clearResultsButton");

const notificationTestButton =
  $("notificationTestButton");

const rallyCardList =
  $("rallyCardList");

const rallyCardTemplate =
  $("rallyCardTemplate");

const analyzeGapsButton =
  $("analyzeGapsButton");

const gapAnalysisResult =
  $("gapAnalysisResult");

const targetArrivalHourInput =
  $("targetArrivalHour");

const targetArrivalMinuteInput =
  $("targetArrivalMinute");

const targetArrivalSecondInput =
  $("targetArrivalSecond");

const calculateArrivalButton =
  $("calculateArrivalButton");

const arrivalTargetResult =
  $("arrivalTargetResult");

const arrivalDepartureResult =
  $("arrivalDepartureResult");

const arrivalCountdownResult =
  $("arrivalCountdownResult");

const exportDataButton =
  $("exportDataButton");

const importDataButton =
  $("importDataButton");

const resetAllDataButton =
  $("resetAllDataButton");

const importFileInput =
  $("importFileInput");

const alertOverlay =
  $("alertOverlay");

const alertRallyName =
  $("alertRallyName");

const alertTime =
  $("alertTime");

const closeAlertButton =
  $("closeAlertButton");

const jstButton =
  $("jstButton");

const utcButton =
  $("utcButton");

let displayTimezone = "JST";

let currentAppMode = "insert";

let currentMarchInputMode = "manual";

let estimatedMyNormalMarchSeconds = null;

let arrivalDepartureTimestamp = null;

let audioContext = null;

let alertIsOpen = false;


/* =========================================================
   JST / UTC切り替え
========================================================= */

function updateTimezoneToggleAppearance() {
  if (!jstButton || !utcButton) {
    return;
  }

  const jstActive =
    displayTimezone === "JST";

  jstButton.classList.toggle(
    "active",
    jstActive
  );

  utcButton.classList.toggle(
    "active",
    !jstActive
  );
}


function setDisplayTimezone(timezone) {
  displayTimezone =
    timezone === "UTC"
      ? "UTC"
      : "JST";

  updateTimezoneToggleAppearance();

  refreshAllDisplayedTimes();

  saveAllData();
}


/* =========================================================
   共通関数
========================================================= */

function parseNumber(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized =
    value
      .replace(",", ".")
      .trim();

  if (normalized === "") {
    return null;
  }

  const number =
    Number.parseFloat(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}


function roundToTenths(value) {
  return Math.round(value * 10) / 10;
}


function pad2(value) {
  return String(value).padStart(2, "0");
}


function getDisplayDateParts(timestamp) {
  const date =
    new Date(timestamp);

  if (displayTimezone === "UTC") {
    return {
      hours:
        date.getUTCHours(),

      minutes:
        date.getUTCMinutes(),

      seconds:
        date.getUTCSeconds(),

      milliseconds:
        date.getUTCMilliseconds()
    };
  }

  return {
    hours:
      date.getHours(),

    minutes:
      date.getMinutes(),

    seconds:
      date.getSeconds(),

    milliseconds:
      date.getMilliseconds()
  };
}


function formatClock(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return "--:--:--.-";
  }

  const parts =
    getDisplayDateParts(timestamp);

  const tenths =
    Math.floor(
      parts.milliseconds / 100
    );

  return (
    `${pad2(parts.hours)}:` +
    `${pad2(parts.minutes)}:` +
    `${pad2(parts.seconds)}.` +
    `${tenths}`
  );
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
    Math.floor(
      safeSeconds / 60
    );

  const remainingSeconds =
    safeSeconds -
    minutes * 60;

  const secondsText =
    showTenths
      ? remainingSeconds.toFixed(1)
      : String(
          Math.round(
            remainingSeconds
          )
        );

  if (minutes > 0) {
    return (
      `${minutes}分` +
      `${secondsText}秒`
    );
  }

  return `${secondsText}秒`;
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
        Math.floor(
          elapsed / 60
        );

      return (
        `${minutes}分` +
        `${(elapsed % 60).toFixed(1)}秒経過`
      );
    }

    return (
      `${elapsed.toFixed(1)}秒経過`
    );
  }

  if (seconds >= 60) {
    const minutes =
      Math.floor(
        seconds / 60
      );

    return (
      `${minutes}分` +
      `${(seconds % 60).toFixed(1)}秒`
    );
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

  return (
    `${sign}` +
    `${Math.abs(seconds).toFixed(1)}秒`
  );
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
    !Number.isFinite(seconds) ||
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
    Math.max(
      0,
      totalSeconds
    );

  const minutes =
    Math.floor(
      safeSeconds / 60
    );

  const seconds =
    roundToTenths(
      safeSeconds -
      minutes * 60
    );

  minutesInput.value =
    String(minutes);

  secondsInput.value =
    String(seconds);
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

  const firstDot =
    value.indexOf(".");

  if (firstDot !== -1) {
    value =
      value.slice(
        0,
        firstDot + 1
      ) +
      value
        .slice(firstDot + 1)
        .replace(/\./g, "");
  }

  if (allowNegative) {
    const negative =
      value.startsWith("-");

    value =
      value.replace(/-/g, "");

    if (negative) {
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
    } catch {
      // 未対応ブラウザでは無視
    }
  });
}


function initializeInputHelpers(
  root = document
) {
  root
    .querySelectorAll(
      ".cursor-end-input"
    )
    .forEach((input) => {
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

  root
    .querySelectorAll(
      ".numeric-input"
    )
    .forEach((input) => {
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

  return Math.hypot(
    targetX - startX,
    targetY - startY
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

  return Math.round(
    Math.max(
      formula.minimum,
      distance * formula.slope +
      formula.intercept
    )
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
    active
      ? (
          SNOW_LEOPARD_MULTIPLIERS[
            Number(level)
          ] || 1
        )
      : 1;

  return normalSeconds / multiplier;
}


function setResultMessage(
  card,
  message,
  className = ""
) {
  const element =
    card.querySelector(
      ".result-message"
    );

  element.textContent =
    message;

  element.classList.remove(
    "warning",
    "success",
    "danger"
  );

  if (className) {
    element.classList.add(
      className
    );
  }
}


function escapeHtml(text) {
  return String(text)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================================
   表示更新
========================================================= */

function updateCurrentClock() {
  if (!currentTimeElement) {
    return;
  }

  currentTimeElement.textContent =
    formatClock(
      Date.now()
    );
}


function refreshAllDisplayedTimes() {
  updateCurrentClock();

  rallyCardList
    .querySelectorAll(
      ".rally-card"
    )
    .forEach((card) => {
      if (
        card.dataset
          .capturedTimestamp
      ) {
        displayRallyCardResult(
          card
        );
      }

      if (
        card.dataset
          .actualDeparture
      ) {
        displayAccelerationOptions(
          card
        );
      }
    });

  if (
    Number.isFinite(
      arrivalDepartureTimestamp
    )
  ) {
    arrivalDepartureResult.textContent =
      formatClock(
        arrivalDepartureTimestamp
      );
  }
}


/* =========================================================
   画面モード
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

  manualMarchModeButton
    .classList.toggle(
      "active",
      manualActive
    );

  coordinateMarchModeButton
    .classList.toggle(
      "active",
      !manualActive
    );

  manualMarchSettings
    .classList.toggle(
      "hidden",
      !manualActive
    );

  coordinateMarchSettings
    .classList.toggle(
      "hidden",
      manualActive
    );

  updateMyEstimatedMarch();

  updateMyMarchDisplays();

  saveAllData();
}


/* =========================================================
   防衛施設と自分の行軍時間
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

  return {
    x,
    y
  };
}


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

    estimatedMarchTimeElement
      .textContent =
      "未計算";

    estimatedDistanceElement
      .textContent =
      "--";

    estimatedErrorElement
      .textContent =
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

  estimatedMarchTimeElement
    .textContent =
    formatDuration(
      normalSeconds,
      false
    );

  estimatedDistanceElement
    .textContent =
    `${distance.toFixed(2)}マス`;

  estimatedErrorElement
    .textContent =
    COORDINATE_FORMULAS[
      targetType
    ].errorText;

  updateMyMarchDisplays();

  return normalSeconds;
}


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
  return applySnowLeopardBuff(
    getMyNormalMarchSeconds(),
    snowLeopardActiveInput.checked,
    snowLeopardLevelSelect.value
  );
}


function updateMyMarchDisplays() {
  const normalSeconds =
    currentMarchInputMode ===
    "coordinate"
      ? estimatedMyNormalMarchSeconds
      : getMinuteSecondValue(
          myMarchMinutesInput,
          myMarchSecondsInput
        );

  if (
    !Number.isFinite(normalSeconds) ||
    normalSeconds <= 0
  ) {
    normalMarchTimeDisplay
      .textContent =
      "--分--秒";

    buffedMarchTimeDisplay
      .textContent =
      "--分--秒";

    return;
  }

  normalMarchTimeDisplay
    .textContent =
    formatDuration(
      normalSeconds
    );

  buffedMarchTimeDisplay
    .textContent =
    formatDuration(
      applySnowLeopardBuff(
        normalSeconds,
        snowLeopardActiveInput.checked,
        snowLeopardLevelSelect.value
      )
    );
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
   通知
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
    audioContext
      .resume()
      .catch(() => {
        // 音声が使えなくても続行
      });
  }
}


function playNotificationSound() {
  prepareAudio();

  if (!audioContext) {
    return;
  }

  [
    880,
    1175,
    880
  ].forEach(
    (frequency, index) => {
      const oscillator =
        audioContext
          .createOscillator();

      const gain =
        audioContext
          .createGain();

      const start =
        audioContext.currentTime +
        index * 0.22;

      const end =
        start + 0.16;

      oscillator.frequency
        .setValueAtTime(
          frequency,
          start
        );

      gain.gain
        .setValueAtTime(
          0.0001,
          start
        );

      gain.gain
        .exponentialRampToValueAtTime(
          0.35,
          start + 0.02
        );

      gain.gain
        .exponentialRampToValueAtTime(
          0.0001,
          end
        );

      oscillator.connect(
        gain
      );

      gain.connect(
        audioContext.destination
      );

      oscillator.start(
        start
      );

      oscillator.stop(
        end + 0.02
      );
    }
  );
}


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

  playNotificationSound();

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


function closeDepartureAlert() {
  alertIsOpen = false;

  alertOverlay.classList.remove(
    "show"
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

  Object.assign(
    card.dataset,
    {
      cardMode: "rally",

      enemyMarchMode:
        "manual",

      capturedTimestamp:
        "",

      enemyDeparture:
        "",

      enemyArrival:
        "",

      myDeparture:
        "",

      myArrival:
        "",

      actualDeparture:
        "",

      alerted:
        "false"
    }
  );

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


/* =========================================================
   集結カードのイベント
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

  const enemySnowActive =
    card.querySelector(
      ".enemy-snow-leopard-active"
    );

  const enemySnowLevel =
    card.querySelector(
      ".enemy-snow-leopard-level"
    );

  const enemyCoordinateInputs =
    card.querySelectorAll(
      ".enemy-coordinate-x, " +
      ".enemy-coordinate-y"
    );

  const applyEstimateButton =
    card.querySelector(
      ".apply-enemy-estimated-button"
    );

  const calculateButton =
    card.querySelector(
      ".capture-calculate-button"
    );

  const actualDepartureButton =
    card.querySelector(
      ".record-actual-departure-button"
    );


  deleteButton.addEventListener(
    "click",
    () => {
      const cards =
        rallyCardList.querySelectorAll(
          ".rally-card"
        );

      if (cards.length <= 1) {
        clearRallyCardInputs(
          card
        );

        clearRallyCardResult(
          card
        );
      } else {
        card.remove();
      }

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
          card.dataset
            .enemyMarchMode =
            button.dataset
              .enemyMarchMode;

          updateEnemyMarchModeDisplay(
            card
          );

          clearRallyCardResult(
            card
          );

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

          clearRallyCardResult(
            card
          );

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


  enemyCoordinateInputs.forEach(
    (input) => {
      input.addEventListener(
        "input",
        () => {
          updateEnemyCoordinateEstimate(
            card
          );

          saveAllData();
        }
      );
    }
  );


  applyEstimateButton.addEventListener(
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

      calculateRallyCard(
        card
      );
    }
  );


  actualDepartureButton.addEventListener(
    "click",
    () => {
      recordActualDeparture(
        card
      );
    }
  );


  card
    .querySelectorAll(
      "input, select"
    )
    .forEach((element) => {
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
   集結カード番号
========================================================= */

function updateRallyCardNumbers() {
  rallyCardList
    .querySelectorAll(
      ".rally-card"
    )
    .forEach(
      (card, index) => {
        card.querySelector(
          ".rally-card-number"
        ).textContent =
          String(index + 1);
      }
    );
}


/* =========================================================
   相手の行軍時間入力モード
========================================================= */

function updateEnemyMarchModeDisplay(
  card
) {
  const mode =
    card.dataset.enemyMarchMode ===
    "coordinate"
      ? "coordinate"
      : "manual";

  card
    .querySelectorAll(
      "[data-enemy-march-mode]"
    )
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset
          .enemyMarchMode ===
          mode
      );
    });

  card
    .querySelector(
      ".enemy-manual-settings"
    )
    .classList.toggle(
      "hidden",
      mode !== "manual"
    );

  card
    .querySelector(
      ".enemy-coordinate-settings"
    )
    .classList.toggle(
      "hidden",
      mode !== "coordinate"
    );
}


/* =========================================================
   集結中 / 行軍中切り替え
========================================================= */

function updateRallyCardModeDisplay(
  card
) {
  const mode =
    card.dataset.cardMode ===
    "march"
      ? "march"
      : "rally";

  card
    .querySelectorAll(
      "[data-card-mode]"
    )
    .forEach((button) => {
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


/* =========================================================
   相手座標から行軍時間を推定
========================================================= */

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
    estimatedTimeElement
      .textContent =
      "未計算";

    distanceElement
      .textContent =
      "--";

    normalTimeElement
      .textContent =
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

  estimatedTimeElement
    .textContent =
    formatDuration(
      effectiveSeconds
    );

  distanceElement
    .textContent =
    `${distance.toFixed(2)}マス`;

  normalTimeElement
    .textContent =
    formatDuration(
      normalSeconds,
      false
    );

  return effectiveSeconds;
}


/* =========================================================
   相手推定時間を手入力欄へ反映
========================================================= */

function applyEnemyEstimatedMarch(
  card
) {
  const seconds =
    updateEnemyCoordinateEstimate(
      card
    );

  if (!Number.isFinite(seconds)) {
    window.alert(
      "相手と防衛施設の座標を入力してください。"
    );

    return;
  }

  setMinuteSecondInputs(
    seconds,
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


/* =========================================================
   相手の実際の行軍時間を取得
========================================================= */

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
   差し込み計算
========================================================= */

function calculateRallyCard(card) {
  const myMarchSeconds =
    getMyEffectiveMarchSeconds();

  const enemyMarchSeconds =
    getEnemyMarchSeconds(
      card
    );

  const remainingSeconds =
    getMinuteSecondValue(
      card.querySelector(
        ".remaining-minutes-input"
      ),
      card.querySelector(
        ".remaining-seconds-input"
      )
    );

  const insertDelay =
    parseNumber(
      insertDelayInput.value
    );

  const tapCorrection =
    parseNumber(
      tapCorrectionInput.value
    );

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

  if (
    !Number.isFinite(tapCorrection)
  ) {
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

  card.dataset
    .capturedTimestamp =
    String(
      capturedTimestamp
    );

  card.dataset
    .enemyDeparture =
    String(
      enemyDepartureTimestamp
    );

  card.dataset
    .enemyArrival =
    String(
      enemyArrivalTimestamp
    );

  card.dataset
    .myDeparture =
    String(
      myDepartureTimestamp
    );

  card.dataset
    .myArrival =
    String(
      myArrivalTimestamp
    );

  card.dataset
    .actualDeparture =
    "";

  card.dataset.alerted =
    "false";

  card.classList.remove(
    "card-ready",
    "card-fired"
  );

  displayRallyCardResult(
    card
  );

  clearAccelerationResult(
    card
  );

  updateCardCountdown(
    card
  );

  saveAllData();
}


/* =========================================================
   計算結果を表示
========================================================= */

function displayRallyCardResult(card) {
  card.querySelector(
    ".captured-time-result"
  ).textContent =
    formatClock(
      Number(
        card.dataset
          .capturedTimestamp
      )
    );

  card.querySelector(
    ".enemy-departure-result"
  ).textContent =
    formatClock(
      Number(
        card.dataset
          .enemyDeparture
      )
    );

  card.querySelector(
    ".enemy-arrival-result"
  ).textContent =
    formatClock(
      Number(
        card.dataset
          .enemyArrival
      )
    );

  card.querySelector(
    ".my-departure-result"
  ).textContent =
    formatClock(
      Number(
        card.dataset
          .myDeparture
      )
    );

  card.querySelector(
    ".my-arrival-result"
  ).textContent =
    formatClock(
      Number(
        card.dataset
          .myArrival
      )
    );
}


/* =========================================================
   カウントダウン
========================================================= */

function updateAllCountdowns() {
  rallyCardList
    .querySelectorAll(
      ".rally-card"
    )
    .forEach((card) => {
      updateCardCountdown(
        card
      );
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
    Number.isFinite(
      enemyDepartureTimestamp
    ) &&
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
    String(
      Date.now()
    );

  displayAccelerationOptions(
    card
  );

  saveAllData();
}


function displayAccelerationOptions(
  card
) {
  const actualDepartureTimestamp =
    Number(
      card.dataset
        .actualDeparture
    );

  const plannedDepartureTimestamp =
    Number(
      card.dataset
        .myDeparture
    );

  const targetArrivalTimestamp =
    Number(
      card.dataset
        .myArrival
    );

  const marchSeconds =
    getMyEffectiveMarchSeconds();

  if (
    !Number.isFinite(
      actualDepartureTimestamp
    ) ||
    !Number.isFinite(
      plannedDepartureTimestamp
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
      label:
        "加速なし",

      durationRate:
        1,

      optionSelector:
        ".no-boost-option",

      arrivalSelector:
        ".no-boost-arrival",

      statusSelector:
        ".no-boost-status"
    },

    {
      label:
        "25%加速",

      durationRate:
        0.75,

      optionSelector:
        ".boost-25-option",

      arrivalSelector:
        ".boost-25-arrival",

      statusSelector:
        ".boost-25-status"
    },

    {
      label:
        "50%加速",

      durationRate:
        0.5,

      optionSelector:
        ".boost-50-option",

      arrivalSelector:
        ".boost-50-arrival",

      statusSelector:
        ".boost-50-status"
    }
  ];

  let bestOption = null;

  options.forEach((option) => {
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

    const optionElement =
      card.querySelector(
        option.optionSelector
      );

    const arrivalElement =
      card.querySelector(
        option.arrivalSelector
      );

    const statusElement =
      card.querySelector(
        option.statusSelector
      );

    optionElement.classList.remove(
      "success",
      "warning",
      "danger"
    );

    arrivalElement.textContent =
      formatClock(
        arrivalTimestamp
      );

    if (
      Math.abs(
        differenceSeconds
      ) <= 0.5
    ) {
      statusElement.textContent =
        "ほぼ目標どおり";

      optionElement.classList.add(
        "success"
      );
    } else if (
      differenceSeconds > 0
    ) {
      statusElement.textContent =
        `${differenceSeconds.toFixed(1)}秒遅れ`;

      optionElement.classList.add(
        differenceSeconds <= 1.5
          ? "warning"
          : "danger"
      );
    } else {
      statusElement.textContent =
        `${Math.abs(differenceSeconds).toFixed(1)}秒早い`;

      optionElement.classList.add(
        Math.abs(
          differenceSeconds
        ) <= 1.5
          ? "warning"
          : "danger"
      );
    }

    if (
      !bestOption ||
      Math.abs(
        differenceSeconds
      ) <
      Math.abs(
        bestOption.differenceSeconds
      )
    ) {
      bestOption = {
        label:
          option.label,

        differenceSeconds
      };
    }
  });

  const bestResultElement =
    card.querySelector(
      ".best-acceleration-text"
    );

  if (!bestOption) {
    bestResultElement.textContent =
      "判定できません";

    return;
  }

  const difference =
    bestOption.differenceSeconds;

  if (
    Math.abs(difference) <=
    0.5
  ) {
    bestResultElement.textContent =
      `${bestOption.label}が最適（ほぼ目標どおり）`;
  } else if (
    difference > 0
  ) {
    bestResultElement.textContent =
      `${bestOption.label}が最適（${difference.toFixed(1)}秒遅れ）`;
  } else {
    bestResultElement.textContent =
      `${bestOption.label}が最適（${Math.abs(difference).toFixed(1)}秒早い）`;
  }
}


/* =========================================================
   加速結果を初期化
========================================================= */

function clearAccelerationResult(card) {
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

  const optionSettings = [
    {
      option:
        ".no-boost-option",

      arrival:
        ".no-boost-arrival",

      status:
        ".no-boost-status"
    },

    {
      option:
        ".boost-25-option",

      arrival:
        ".boost-25-arrival",

      status:
        ".boost-25-status"
    },

    {
      option:
        ".boost-50-option",

      arrival:
        ".boost-50-arrival",

      status:
        ".boost-50-status"
    }
  ];

  optionSettings.forEach(
    (setting) => {
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
    }
  );

  card.querySelector(
    ".best-acceleration-text"
  ).textContent =
    "出撃後に計算できます";
}

/* =========================================================
   集結カードの計算結果を初期化
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

  card.querySelector(
    ".captured-time-result"
  ).textContent =
    "--:--:--.-";

  card.querySelector(
    ".enemy-departure-result"
  ).textContent =
    "--:--:--.-";

  card.querySelector(
    ".enemy-arrival-result"
  ).textContent =
    "--:--:--.-";

  card.querySelector(
    ".my-departure-result"
  ).textContent =
    "--:--:--.-";

  card.querySelector(
    ".my-arrival-result"
  ).textContent =
    "--:--:--.-";

  card.querySelector(
    ".countdown-result"
  ).textContent =
    "未計算";

  setResultMessage(
    card,
    "残り時間を入力して計算してください。"
  );

  clearAccelerationResult(
    card
  );
}


/* =========================================================
   集結カードの入力内容を初期化
========================================================= */

function clearRallyCardInputs(card) {
  card.querySelector(
    ".rally-name-input"
  ).value =
    "";

  card.querySelector(
    ".enemy-march-minutes-input"
  ).value =
    "0";

  card.querySelector(
    ".enemy-march-seconds-input"
  ).value =
    "";

  card.querySelector(
    ".enemy-coordinate-x"
  ).value =
    "";

  card.querySelector(
    ".enemy-coordinate-y"
  ).value =
    "";

  card.querySelector(
    ".enemy-snow-leopard-active"
  ).checked =
    false;

  card.querySelector(
    ".enemy-snow-leopard-level"
  ).value =
    "0";

  card.querySelector(
    ".enemy-snow-leopard-level"
  ).disabled =
    true;

  card.querySelector(
    ".remaining-minutes-input"
  ).value =
    "0";

  card.querySelector(
    ".remaining-seconds-input"
  ).value =
    "";

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


/* =========================================================
   全カードの結果を初期化
========================================================= */

function clearAllRallyResults() {
  rallyCardList
    .querySelectorAll(
      ".rally-card"
    )
    .forEach((card) => {
      clearRallyCardResult(
        card
      );
    });

  gapAnalysisResult.className =
    "empty-result";

  gapAnalysisResult.textContent =
    "2人以上の相手を計算すると着弾間隔を分析できます。";

  saveAllData();
}


/* =========================================================
   着弾順に並び替え
========================================================= */

function sortCardsByArrival() {
  const cards =
    Array.from(
      rallyCardList.querySelectorAll(
        ".rally-card"
      )
    );

  cards.sort(
    (cardA, cardB) => {
      const arrivalA =
        cardA.dataset.enemyArrival !==
        ""
          ? Number(
              cardA.dataset.enemyArrival
            )
          : Number.POSITIVE_INFINITY;

      const arrivalB =
        cardB.dataset.enemyArrival !==
        ""
          ? Number(
              cardB.dataset.enemyArrival
            )
          : Number.POSITIVE_INFINITY;

      return arrivalA - arrivalB;
    }
  );

  cards.forEach((card) => {
    rallyCardList.appendChild(
      card
    );
  });

  updateRallyCardNumbers();

  saveAllData();
}


/* =========================================================
   多段着弾分析
========================================================= */

function analyzeArrivalGaps() {
  const calculatedCards =
    Array.from(
      rallyCardList.querySelectorAll(
        ".rally-card"
      )
    )
      .filter((card) => {
        return (
          card.dataset.enemyArrival !==
          ""
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

  if (
    calculatedCards.length < 2
  ) {
    gapAnalysisResult.className =
      "empty-result";

    gapAnalysisResult.textContent =
      "2人以上の相手を計算すると着弾間隔を分析できます。";

    return;
  }

  const list =
    document.createElement(
      "div"
    );

  list.className =
    "gap-analysis-list";

  for (
    let index = 0;
    index <
    calculatedCards.length - 1;
    index += 1
  ) {
    const firstCard =
      calculatedCards[index];

    const secondCard =
      calculatedCards[
        index + 1
      ];

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
      document.createElement(
        "article"
      );

    item.className =
      "gap-analysis-item";

    let evaluation;

    if (gapSeconds >= 1.5) {
      item.classList.add(
        "good"
      );

      evaluation =
        "差し込み候補";
    } else if (
      gapSeconds >= 0.8
    ) {
      item.classList.add(
        "medium"
      );

      evaluation =
        "成功率低め";
    } else {
      item.classList.add(
        "bad"
      );

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

    list.appendChild(
      item
    );
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
   指定時刻への着弾計算
========================================================= */

function calculateArrivalDeparture() {
  const marchSeconds =
    getMyEffectiveMarchSeconds();

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
    !Number.isFinite(
      marchSeconds
    ) ||
    marchSeconds <= 0
  ) {
    window.alert(
      "自分の行軍時間を入力してください。"
    );

    return;
  }

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second >= 60
  ) {
    window.alert(
      "正しい着弾時刻を入力してください。"
    );

    return;
  }

  const targetDate =
    new Date();

  const wholeSecond =
    Math.floor(
      second
    );

  const milliseconds =
    Math.round(
      (
        second -
        wholeSecond
      ) * 1000
    );

  if (
    displayTimezone === "UTC"
  ) {
    targetDate.setUTCHours(
      Math.floor(hour),
      Math.floor(minute),
      wholeSecond,
      milliseconds
    );
  } else {
    targetDate.setHours(
      Math.floor(hour),
      Math.floor(minute),
      wholeSecond,
      milliseconds
    );
  }

  /*
    入力時刻がすでに過ぎている場合は
    翌日の同時刻として扱う
  */

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
    ) || 0;

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


/* =========================================================
   指定着弾のカウントダウン
========================================================= */

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
   カード保存データ作成
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


/* =========================================================
   全保存データ作成
========================================================= */

function createSaveData() {
  const cards =
    Array.from(
      rallyCardList.querySelectorAll(
        ".rally-card"
      )
    );

  return {
    version:
      30,

    displayTimezone,

    currentAppMode,

    currentMarchInputMode,

    defense: {
      x:
        defenseCoordinateXInput.value,

      y:
        defenseCoordinateYInput.value,

      targetType:
        defenseTargetTypeSelect.value
    },

    myMarch: {
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


/* =========================================================
   ローカル保存
========================================================= */

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
      "データを保存できませんでした。",
      error
    );
  }
}


/* =========================================================
   カード保存データを反映
========================================================= */

function applySavedRallyCardData(
  card,
  savedData
) {
  card.querySelector(
    ".rally-name-input"
  ).value =
    savedData.name || "";

  card.dataset.enemyMarchMode =
    savedData.enemyMarchMode ===
    "coordinate"
      ? "coordinate"
      : "manual";

  card.querySelector(
    ".enemy-march-minutes-input"
  ).value =
    savedData.enemyMinutes ||
    "0";

  card.querySelector(
    ".enemy-march-seconds-input"
  ).value =
    savedData.enemySeconds ||
    "";

  card.querySelector(
    ".enemy-coordinate-x"
  ).value =
    savedData.enemyCoordinateX ||
    "";

  card.querySelector(
    ".enemy-coordinate-y"
  ).value =
    savedData.enemyCoordinateY ||
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
    savedData.enemySnowLevel ||
    "0";

  card.querySelector(
    ".enemy-snow-leopard-level"
  ).disabled =
    !savedData.enemySnowActive;

  card.dataset.cardMode =
    savedData.cardMode ===
    "march"
      ? "march"
      : "rally";

  card.querySelector(
    ".remaining-minutes-input"
  ).value =
    savedData.remainingMinutes ||
    "0";

  card.querySelector(
    ".remaining-seconds-input"
  ).value =
    savedData.remainingSeconds ||
    "";
}


/* =========================================================
   保存データ読み込み
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
        JSON.parse(
          savedText
        );
    }
  } catch (error) {
    console.warn(
      "保存データを読み込めませんでした。",
      error
    );
  }

  if (!savedData) {
    createRallyCard();

    updateTimezoneToggleAppearance();

    return;
  }

  displayTimezone =
    savedData.displayTimezone ===
    "UTC"
      ? "UTC"
      : "JST";

  defenseCoordinateXInput.value =
    savedData.defense?.x ||
    "";

  defenseCoordinateYInput.value =
    savedData.defense?.y ||
    "";

  defenseTargetTypeSelect.value =
    savedData.defense?.targetType ===
    "city"
      ? "city"
      : "castle";

  myMarchMinutesInput.value =
    savedData.myMarch?.minutes ||
    "0";

  myMarchSecondsInput.value =
    savedData.myMarch?.seconds ||
    "";

  myCoordinateXInput.value =
    savedData.myCoordinates?.x ||
    "";

  myCoordinateYInput.value =
    savedData.myCoordinates?.y ||
    "";

  snowLeopardActiveInput.checked =
    Boolean(
      savedData
        .mySnowLeopard
        ?.active
    );

  snowLeopardLevelSelect.value =
    savedData
      .mySnowLeopard
      ?.level ||
    "0";

  insertDelayInput.value =
    savedData.corrections
      ?.insertDelay ||
    "0.5";

  tapCorrectionInput.value =
    savedData.corrections
      ?.tapCorrection ||
    "0";

  targetArrivalHourInput.value =
    savedData.targetArrival
      ?.hour ||
    "";

  targetArrivalMinuteInput.value =
    savedData.targetArrival
      ?.minute ||
    "";

  targetArrivalSecondInput.value =
    savedData.targetArrival
      ?.second ||
    "";

  rallyCardList.innerHTML =
    "";

  if (
    Array.isArray(
      savedData.cards
    ) &&
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
    savedData.currentAppMode
  );

  setMyMarchInputMode(
    savedData.currentMarchInputMode
  );

  updateMySnowLeopardControls();

  updateTimezoneToggleAppearance();

  updateMyEstimatedMarch();

  updateMyMarchDisplays();
}


/* =========================================================
   JSON書き出し
========================================================= */

function exportData() {
  const data =
    createSaveData();

  const jsonText =
    JSON.stringify(
      data,
      null,
      2
    );

  const blob =
    new Blob(
      [jsonText],
      {
        type:
          "application/json"
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    url;

  link.download =
    "wos-timing-data.json";

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(
    url
  );
}


/* =========================================================
   JSON読み込み
========================================================= */

function importDataFromFile(file) {
  const reader =
    new FileReader();

  reader.addEventListener(
    "load",
    () => {
      try {
        const importedData =
          JSON.parse(
            String(
              reader.result
            )
          );

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            importedData
          )
        );

        window.location.reload();
      } catch (error) {
        window.alert(
          "JSONファイルを読み込めませんでした。"
        );
      }
    }
  );

  reader.readAsText(
    file
  );
}


/* =========================================================
   イベント登録：タイムゾーン
========================================================= */

jstButton.addEventListener(
  "click",
  () => {
    setDisplayTimezone(
      "JST"
    );
  }
);

utcButton.addEventListener(
  "click",
  () => {
    setDisplayTimezone(
      "UTC"
    );
  }
);


/* =========================================================
   イベント登録：画面切り替え
========================================================= */

insertModeButton.addEventListener(
  "click",
  () => {
    setAppMode(
      "insert"
    );
  }
);

arrivalModeButton.addEventListener(
  "click",
  () => {
    setAppMode(
      "arrival"
    );
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


/* =========================================================
   イベント登録：座標
========================================================= */

[
  defenseCoordinateXInput,
  defenseCoordinateYInput
].forEach((input) => {
  input.addEventListener(
    "input",
    () => {
      updateMyEstimatedMarch();

      rallyCardList
        .querySelectorAll(
          ".rally-card"
        )
        .forEach(
          updateEnemyCoordinateEstimate
        );

      saveAllData();
    }
  );
});

defenseTargetTypeSelect.addEventListener(
  "change",
  () => {
    updateMyEstimatedMarch();

    rallyCardList
      .querySelectorAll(
        ".rally-card"
      )
      .forEach(
        updateEnemyCoordinateEstimate
      );

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
  () => {
    const estimatedSeconds =
      updateMyEstimatedMarch();

    if (
      !Number.isFinite(
        estimatedSeconds
      )
    ) {
      window.alert(
        "自分と防衛施設の座標を入力してください。"
      );

      return;
    }

    setMinuteSecondInputs(
      estimatedSeconds,
      myMarchMinutesInput,
      myMarchSecondsInput
    );

    setMyMarchInputMode(
      "manual"
    );

    updateMyMarchDisplays();

    saveAllData();
  }
);


/* =========================================================
   イベント登録：ユキヒョウ
========================================================= */

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


/* =========================================================
   イベント登録：共通入力
========================================================= */

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


/* =========================================================
   イベント登録：集結カード
========================================================= */

addRallyButton.addEventListener(
  "click",
  () => {
    const card =
      createRallyCard();

    saveAllData();

    card.scrollIntoView({
      behavior:
        "smooth",

      block:
        "center"
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


/* =========================================================
   イベント登録：着弾時刻
========================================================= */

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


/* =========================================================
   イベント登録：データ管理
========================================================= */

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
      importFileInput
        .files?.[0];

    if (file) {
      importDataFromFile(
        file
      );
    }

    importFileInput.value =
      "";
  }
);

resetAllDataButton.addEventListener(
  "click",
  () => {
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
);


/* =========================================================
   イベント登録：通知
========================================================= */

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

updateTimezoneToggleAppearance();

updateCurrentClock();

updateAllCountdowns();

updateMyMarchDisplays();


setInterval(
  () => {
    updateCurrentClock();

    updateAllCountdowns();
  },
  100
);
