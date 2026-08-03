"use strict";

/* =========================
   基本設定
========================= */

const STORAGE_KEY = "wos_insert_timer_v2";

const currentTimeElement =
  document.getElementById("currentTime");

const myMarchMinutesInput =
  document.getElementById("myMarchMinutes");

const myMarchSecondsInput =
  document.getElementById("myMarchSeconds");

const insertDelayInput =
  document.getElementById("insertDelay");

const tapCorrectionInput =
  document.getElementById("tapCorrection");

const addCardButton =
  document.getElementById("addCardButton");

const addCardBottomButton =
  document.getElementById("addCardBottomButton");

const sortButton =
  document.getElementById("sortButton");

const soundTestButton =
  document.getElementById("soundTestButton");

const rallyCardList =
  document.getElementById("rallyCardList");

const rallyCardTemplate =
  document.getElementById("rallyCardTemplate");

const alertOverlay =
  document.getElementById("alertOverlay");

const alertTime =
  document.getElementById("alertTime");

const closeAlertButton =
  document.getElementById("closeAlertButton");

let cardIdCounter = 1;
let audioContext = null;
let alertIsOpen = false;


/* =========================
   時刻表示
========================= */

function formatClock(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return "--:--:--.-";
  }

  const date = new Date(timestamp);

  const hours =
    String(date.getHours()).padStart(2, "0");

  const minutes =
    String(date.getMinutes()).padStart(2, "0");

  const seconds =
    String(date.getSeconds()).padStart(2, "0");

  const tenths =
    Math.floor(date.getMilliseconds() / 100);

  return `${hours}:${minutes}:${seconds}.${tenths}`;
}


function formatCountdown(milliseconds) {
  if (!Number.isFinite(milliseconds)) {
    return "未計算";
  }

  const absoluteMilliseconds =
    Math.abs(milliseconds);

  const totalSeconds =
    absoluteMilliseconds / 1000;

  if (milliseconds < -3000) {
    if (totalSeconds >= 60) {
      const minutes =
        Math.floor(totalSeconds / 60);

      const seconds =
        totalSeconds - minutes * 60;

      return `${minutes}分${seconds.toFixed(1)}秒経過`;
    }

    return `${totalSeconds.toFixed(1)}秒経過`;
  }

  if (milliseconds <= 0) {
    return "今です！";
  }

  if (totalSeconds >= 60) {
    const minutes =
      Math.floor(totalSeconds / 60);

    const seconds =
      totalSeconds - minutes * 60;

    return `${minutes}分${seconds.toFixed(1)}秒`;
  }

  return `${totalSeconds.toFixed(1)}秒`;
}


function updateCurrentClock() {
  currentTimeElement.textContent =
    formatClock(Date.now());
}


/* =========================
   数値・時間入力
========================= */

function getNumber(inputElement) {
  const value =
    Number.parseFloat(inputElement.value);

  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
}


function getMinuteSecondValue(
  minutesInput,
  secondsInput
) {
  const minutesText =
    minutesInput.value.trim();

  const secondsText =
    secondsInput.value.trim();

  const minutes =
    minutesText === ""
      ? 0
      : Number.parseFloat(minutesText);

  const seconds =
    secondsText === ""
      ? 0
      : Number.parseFloat(secondsText);

  if (
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return null;
  }

  if (
    minutes < 0 ||
    seconds < 0 ||
    seconds >= 60
  ) {
    return null;
  }

  return minutes * 60 + seconds;
}


function isValidPositiveTime(value) {
  return (
    Number.isFinite(value) &&
    value > 0
  );
}


function isValidRemainingTime(value) {
  return (
    Number.isFinite(value) &&
    value >= 0
  );
}


/* =========================
   秒入力の自動調整
========================= */

function normalizeMinuteSecondInputs(
  minutesInput,
  secondsInput
) {
  let minutes =
    Number.parseFloat(minutesInput.value || "0");

  let seconds =
    Number.parseFloat(secondsInput.value || "0");

  if (!Number.isFinite(minutes)) {
    minutes = 0;
  }

  if (!Number.isFinite(seconds)) {
    seconds = 0;
  }

  if (minutes < 0) {
    minutes = 0;
  }

  if (seconds < 0) {
    seconds = 0;
  }

  /*
    例：
    秒欄に90を入れた場合
    1分30秒へ自動変換
  */
  if (seconds >= 60) {
    const extraMinutes =
      Math.floor(seconds / 60);

    minutes += extraMinutes;
    seconds -= extraMinutes * 60;
  }

  minutesInput.value =
    String(Math.floor(minutes));

  if (seconds === 0) {
    secondsInput.value = "";
  } else {
    secondsInput.value =
      String(
        Math.round(seconds * 10) / 10
      );
  }
}


/* =========================
   音声・振動
========================= */

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

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {
      // 音声が使えなくても計算は続ける
    });
  }
}


function playBeep() {
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
        startTime + index * 0.22;

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
      gainNode.connect(audioContext.destination);

      oscillator.start(beepStart);
      oscillator.stop(beepEnd + 0.02);
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


/* =========================
   通知画面
========================= */

function showAlert(card) {
  if (alertIsOpen) {
    return;
  }

  alertIsOpen = true;

  const departureTimestamp =
    Number(card.dataset.myDeparture);

  alertTime.textContent =
    formatClock(departureTimestamp);

  alertOverlay.classList.add("show");

  alertOverlay.setAttribute(
    "aria-hidden",
    "false"
  );

  playBeep();
  vibrateDevice();
}


function closeAlert() {
  alertIsOpen = false;

  alertOverlay.classList.remove("show");

  alertOverlay.setAttribute(
    "aria-hidden",
    "true"
  );

  if ("vibrate" in navigator) {
    navigator.vibrate(0);
  }
}


/* =========================
   カード作成
========================= */

function createRallyCard(savedData = null) {
  const fragment =
    rallyCardTemplate.content.cloneNode(true);

  const card =
    fragment.querySelector(".rally-card");

  card.dataset.cardId =
    String(cardIdCounter);

  cardIdCounter += 1;

  card.dataset.enemyDeparture = "";
  card.dataset.enemyArrival = "";
  card.dataset.myDeparture = "";
  card.dataset.myArrival = "";
  card.dataset.capturedTimestamp = "";
  card.dataset.alerted = "false";

  rallyCardList.appendChild(fragment);

  const addedCard =
    rallyCardList.lastElementChild;

  setupCardEvents(addedCard);

  if (savedData) {
    applySavedData(
      addedCard,
      savedData
    );
  }

  updateCardNumbers();
  updateRemainingLabel(addedCard);

  return addedCard;
}


/* =========================
   カード内イベント
========================= */

function setupCardEvents(card) {
  const deleteButton =
    card.querySelector(
      ".delete-card-button"
    );

  const calculateButton =
    card.querySelector(
      ".calculate-button"
    );

  const clearButton =
    card.querySelector(
      ".clear-result-button"
    );

  const modeSelect =
    card.querySelector(
      ".timer-mode-select"
    );

  const enemyMinutesInput =
    card.querySelector(
      ".enemy-march-minutes-input"
    );

  const enemySecondsInput =
    card.querySelector(
      ".enemy-march-seconds-input"
    );

  const remainingMinutesInput =
    card.querySelector(
      ".remaining-minutes-input"
    );

  const remainingSecondsInput =
    card.querySelector(
      ".remaining-seconds-input"
    );

  const saveTargets =
    card.querySelectorAll(
      ".rally-name-input, " +
      ".enemy-march-minutes-input, " +
      ".enemy-march-seconds-input, " +
      ".timer-mode-select, " +
      ".remaining-minutes-input, " +
      ".remaining-seconds-input"
    );

  deleteButton.addEventListener(
    "click",
    () => {
      const cardCount =
        rallyCardList.querySelectorAll(
          ".rally-card"
        ).length;

      if (cardCount <= 1) {
        clearCardInputs(card);
        clearCardResult(card);
        saveAllData();
        return;
      }

      card.remove();

      updateCardNumbers();
      saveAllData();
    }
  );

  calculateButton.addEventListener(
    "click",
    () => {
      prepareAudio();

      normalizeMinuteSecondInputs(
        myMarchMinutesInput,
        myMarchSecondsInput
      );

      normalizeMinuteSecondInputs(
        enemyMinutesInput,
        enemySecondsInput
      );

      normalizeMinuteSecondInputs(
        remainingMinutesInput,
        remainingSecondsInput
      );

      calculateCard(card);
    }
  );

  clearButton.addEventListener(
    "click",
    () => {
      clearCardResult(card);
      saveAllData();
    }
  );

  modeSelect.addEventListener(
    "change",
    () => {
      updateRemainingLabel(card);
      clearCardResult(card);
      saveAllData();
    }
  );

  enemySecondsInput.addEventListener(
    "change",
    () => {
      normalizeMinuteSecondInputs(
        enemyMinutesInput,
        enemySecondsInput
      );

      saveAllData();
    }
  );

  remainingSecondsInput.addEventListener(
    "change",
    () => {
      normalizeMinuteSecondInputs(
        remainingMinutesInput,
        remainingSecondsInput
      );

      saveAllData();
    }
  );

  saveTargets.forEach((element) => {
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


/* =========================
   カード番号
========================= */

function updateCardNumbers() {
  const cards =
    rallyCardList.querySelectorAll(
      ".rally-card"
    );

  cards.forEach((card, index) => {
    const numberElement =
      card.querySelector(
        ".card-number"
      );

    numberElement.textContent =
      String(index + 1);
  });
}


/* =========================
   集結残り・行軍残り表示
========================= */

function updateRemainingLabel(card) {
  const modeSelect =
    card.querySelector(
      ".timer-mode-select"
    );

  const label =
    card.querySelector(
      ".remaining-time-label"
    );

  const secondsInput =
    card.querySelector(
      ".remaining-seconds-input"
    );

  if (modeSelect.value === "march") {
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


/* =========================
   計算処理
========================= */

function calculateCard(card) {
  const myMarchTime =
    getMinuteSecondValue(
      myMarchMinutesInput,
      myMarchSecondsInput
    );

  const insertDelay =
    getNumber(insertDelayInput);

  const tapCorrection =
    getNumber(tapCorrectionInput);

  const enemyMarchMinutesInput =
    card.querySelector(
      ".enemy-march-minutes-input"
    );

  const enemyMarchSecondsInput =
    card.querySelector(
      ".enemy-march-seconds-input"
    );

  const remainingMinutesInput =
    card.querySelector(
      ".remaining-minutes-input"
    );

  const remainingSecondsInput =
    card.querySelector(
      ".remaining-seconds-input"
    );

  const modeSelect =
    card.querySelector(
      ".timer-mode-select"
    );

  const enemyMarchTime =
    getMinuteSecondValue(
      enemyMarchMinutesInput,
      enemyMarchSecondsInput
    );

  const remainingTime =
    getMinuteSecondValue(
      remainingMinutesInput,
      remainingSecondsInput
    );

  if (!isValidPositiveTime(myMarchTime)) {
    showCardError(
      card,
      "自分の行軍時間を入力してください。"
    );

    myMarchSecondsInput.focus();
    return;
  }

  if (!isValidPositiveTime(enemyMarchTime)) {
    showCardError(
      card,
      "相手の行軍時間を入力してください。"
    );

    enemyMarchSecondsInput.focus();
    return;
  }

  if (!isValidRemainingTime(remainingTime)) {
    showCardError(
      card,
      "現在表示されている残り時間を入力してください。"
    );

    remainingSecondsInput.focus();
    return;
  }

  if (
    !Number.isFinite(insertDelay) ||
    insertDelay < 0
  ) {
    showCardError(
      card,
      "攻撃後の差し込み補正を0秒以上で入力してください。"
    );

    insertDelayInput.focus();
    return;
  }

  if (!Number.isFinite(tapCorrection)) {
    showCardError(
      card,
      "タップ・通信補正を入力してください。"
    );

    tapCorrectionInput.focus();
    return;
  }

  /*
    「この瞬間で計算」を押した時刻
  */
  const capturedTimestamp =
    Date.now();

  const enemyMarchMilliseconds =
    enemyMarchTime * 1000;

  const myMarchMilliseconds =
    myMarchTime * 1000;

  const remainingMilliseconds =
    remainingTime * 1000;

  const insertDelayMilliseconds =
    insertDelay * 1000;

  const correctionMilliseconds =
    tapCorrection * 1000;

  let enemyDepartureTimestamp;
  let enemyArrivalTimestamp;

  /*
    集結残りモード

    相手出発
    ＝ 現在時刻＋集結残り時間

    相手着弾
    ＝ 相手出発＋相手の行軍時間
  */
  if (modeSelect.value === "rally") {
    enemyDepartureTimestamp =
      capturedTimestamp +
      remainingMilliseconds;

    enemyArrivalTimestamp =
      enemyDepartureTimestamp +
      enemyMarchMilliseconds;
  }

  /*
    行軍残りモード

    相手着弾
    ＝ 現在時刻＋行軍残り時間

    相手出発
    ＝ 相手着弾－相手の行軍時間
  */
  if (modeSelect.value === "march") {
    enemyArrivalTimestamp =
      capturedTimestamp +
      remainingMilliseconds;

    enemyDepartureTimestamp =
      enemyArrivalTimestamp -
      enemyMarchMilliseconds;
  }

  /*
    自分の狙う着弾時刻

    相手着弾＋差し込み補正
  */
  const myArrivalTimestamp =
    enemyArrivalTimestamp +
    insertDelayMilliseconds;

  /*
    自分の出撃時刻

    自分の狙う着弾
    －自分の行軍時間
    ＋タップ・通信補正

    遅れて着弾する場合は、
    通信補正をマイナスにすると早めに出る。
  */
  const myDepartureTimestamp =
    myArrivalTimestamp -
    myMarchMilliseconds +
    correctionMilliseconds;

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

  card.dataset.alerted = "false";

  card.classList.remove(
    "card-fired"
  );

  card.classList.remove(
    "card-ready"
  );

  displayCardResult(
    card,
    capturedTimestamp
  );

  saveAllData();
}


/* =========================
   計算結果表示
========================= */

function displayCardResult(
  card,
  capturedTimestamp
) {
  const enemyDepartureTimestamp =
    Number(
      card.dataset.enemyDeparture
    );

  const enemyArrivalTimestamp =
    Number(
      card.dataset.enemyArrival
    );

  const myDepartureTimestamp =
    Number(
      card.dataset.myDeparture
    );

  const myArrivalTimestamp =
    Number(
      card.dataset.myArrival
    );

  card.querySelector(
    ".captured-time-result"
  ).textContent =
    formatClock(capturedTimestamp);

  card.querySelector(
    ".enemy-departure-result"
  ).textContent =
    formatClock(
      enemyDepartureTimestamp
    );

  card.querySelector(
    ".enemy-arrival-result"
  ).textContent =
    formatClock(
      enemyArrivalTimestamp
    );

  card.querySelector(
    ".my-departure-result"
  ).textContent =
    formatClock(
      myDepartureTimestamp
    );

  card.querySelector(
    ".my-arrival-result"
  ).textContent =
    formatClock(
      myArrivalTimestamp
    );

  updateCardCountdown(card);
}


/* =========================
   全カードのカウントダウン
========================= */

function updateAllCountdowns() {
  const cards =
    rallyCardList.querySelectorAll(
      ".rally-card"
    );

  cards.forEach((card) => {
    updateCardCountdown(card);
  });
}


/* =========================
   1カードのカウントダウン
========================= */

function updateCardCountdown(card) {
  const departureTimestamp =
    Number(
      card.dataset.myDeparture
    );

  if (
    card.dataset.myDeparture === "" ||
    !Number.isFinite(departureTimestamp)
  ) {
    return;
  }

  const countdownElement =
    card.querySelector(
      ".countdown-result"
    );

  const messageElement =
    card.querySelector(
      ".result-message"
    );

  const remainingMilliseconds =
    departureTimestamp -
    Date.now();

  countdownElement.textContent =
    formatCountdown(
      remainingMilliseconds
    );

  messageElement.classList.remove(
    "warning",
    "danger",
    "success"
  );

  /*
    出撃時刻を3秒以上過ぎた
  */
  if (remainingMilliseconds < -3000) {
    card.classList.remove(
      "card-ready"
    );

    card.classList.add(
      "card-fired"
    );

    messageElement.textContent =
      "出撃予定時刻を過ぎています。次の集結では残り時間を確認した瞬間に計算してください。";

    messageElement.classList.add(
      "danger"
    );

    return;
  }

  /*
    出撃時刻
  */
  if (remainingMilliseconds <= 0) {
    card.classList.remove(
      "card-ready"
    );

    card.classList.add(
      "card-fired"
    );

    messageElement.textContent =
      "今、行軍ボタンを押してください！";

    messageElement.classList.add(
      "success"
    );

    if (
      card.dataset.alerted !== "true"
    ) {
      card.dataset.alerted = "true";

      showAlert(card);
    }

    return;
  }

  /*
    残り5秒以内
  */
  if (remainingMilliseconds <= 5000) {
    card.classList.add(
      "card-ready"
    );

    card.classList.remove(
      "card-fired"
    );

    messageElement.textContent =
      "まもなく出撃です。ゲーム画面の行軍ボタンを押せる状態で待機してください。";

    messageElement.classList.add(
      "warning"
    );

    return;
  }

  const enemyDepartureTimestamp =
    Number(
      card.dataset.enemyDeparture
    );

  /*
    相手が出発する前に自分が出る場合
  */
  if (
    departureTimestamp <
    enemyDepartureTimestamp
  ) {
    messageElement.textContent =
      "自分の方が行軍時間が長いため、相手の集結が出発する前に出撃します。";

    messageElement.classList.add(
      "warning"
    );

    return;
  }

  /*
    相手が出発した後に自分が出る場合
  */
  messageElement.textContent =
    "相手が出発した後、表示された自分の出撃時刻に行軍してください。";
}


/* =========================
   エラー表示
========================= */

function showCardError(
  card,
  message
) {
  const messageElement =
    card.querySelector(
      ".result-message"
    );

  messageElement.textContent =
    message;

  messageElement.classList.remove(
    "warning",
    "success"
  );

  messageElement.classList.add(
    "danger"
  );
}


/* =========================
   計算結果クリア
========================= */

function clearCardResult(card) {
  card.dataset.capturedTimestamp = "";
  card.dataset.enemyDeparture = "";
  card.dataset.enemyArrival = "";
  card.dataset.myDeparture = "";
  card.dataset.myArrival = "";
  card.dataset.alerted = "false";

  card.classList.remove(
    "card-ready"
  );

  card.classList.remove(
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

  const messageElement =
    card.querySelector(
      ".result-message"
    );

  messageElement.textContent =
    "相手の残り時間を入力して計算してください。";

  messageElement.classList.remove(
    "warning",
    "danger",
    "success"
  );
}


/* =========================
   カード入力クリア
========================= */

function clearCardInputs(card) {
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
    ".timer-mode-select"
  ).value = "rally";

  card.querySelector(
    ".remaining-minutes-input"
  ).value = "0";

  card.querySelector(
    ".remaining-seconds-input"
  ).value = "";

  updateRemainingLabel(card);
}


/* =========================
   着弾順並び替え
========================= */

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

    const hasArrivalA =
      cardA.dataset.enemyArrival !== "" &&
      Number.isFinite(arrivalA);

    const hasArrivalB =
      cardB.dataset.enemyArrival !== "" &&
      Number.isFinite(arrivalB);

    if (
      hasArrivalA &&
      hasArrivalB
    ) {
      return arrivalA - arrivalB;
    }

    if (hasArrivalA) {
      return -1;
    }

    if (hasArrivalB) {
      return 1;
    }

    return 0;
  });

  cards.forEach((card) => {
    rallyCardList.appendChild(card);
  });

  updateCardNumbers();
  saveAllData();
}


/* =========================
   保存
========================= */

function saveAllData() {
  const cards =
    Array.from(
      rallyCardList.querySelectorAll(
        ".rally-card"
      )
    );

  const data = {
    myMarchMinutes:
      myMarchMinutesInput.value,

    myMarchSeconds:
      myMarchSecondsInput.value,

    insertDelay:
      insertDelayInput.value,

    tapCorrection:
      tapCorrectionInput.value,

    cards: cards.map((card) => {
      return {
        name:
          card.querySelector(
            ".rally-name-input"
          ).value,

        enemyMarchMinutes:
          card.querySelector(
            ".enemy-march-minutes-input"
          ).value,

        enemyMarchSeconds:
          card.querySelector(
            ".enemy-march-seconds-input"
          ).value,

        mode:
          card.querySelector(
            ".timer-mode-select"
          ).value,

        remainingMinutes:
          card.querySelector(
            ".remaining-minutes-input"
          ).value,

        remainingSeconds:
          card.querySelector(
            ".remaining-seconds-input"
          ).value
      };
    })
  };

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );
  } catch (error) {
    console.warn(
      "データを保存できませんでした。",
      error
    );
  }
}


/* =========================
   保存データ読込
========================= */

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
    return;
  }

  myMarchMinutesInput.value =
    savedData.myMarchMinutes ??
    "0";

  myMarchSecondsInput.value =
    savedData.myMarchSeconds ??
    "";

  insertDelayInput.value =
    savedData.insertDelay ??
    "0.5";

  tapCorrectionInput.value =
    savedData.tapCorrection ??
    "0";

  if (
    Array.isArray(savedData.cards) &&
    savedData.cards.length > 0
  ) {
    savedData.cards.forEach(
      (cardData) => {
        createRallyCard(cardData);
      }
    );
  } else {
    createRallyCard();
  }
}


/* =========================
   保存カード反映
========================= */

function applySavedData(
  card,
  savedData
) {
  card.querySelector(
    ".rally-name-input"
  ).value =
    savedData.name ?? "";

  card.querySelector(
    ".enemy-march-minutes-input"
  ).value =
    savedData.enemyMarchMinutes ??
    "0";

  card.querySelector(
    ".enemy-march-seconds-input"
  ).value =
    savedData.enemyMarchSeconds ??
    "";

  card.querySelector(
    ".timer-mode-select"
  ).value =
    savedData.mode === "march"
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

  updateRemainingLabel(card);
}


/* =========================
   上の集結主追加
========================= */

addCardButton.addEventListener(
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


/* =========================
   下の集結主追加
========================= */

addCardBottomButton.addEventListener(
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


/* =========================
   着弾順ソート
========================= */

sortButton.addEventListener(
  "click",
  () => {
    sortCardsByArrival();
  }
);


/* =========================
   通知テスト
========================= */

soundTestButton.addEventListener(
  "click",
  () => {
    prepareAudio();
    playBeep();
    vibrateDevice();

    alertTime.textContent =
      formatClock(Date.now());

    alertOverlay.classList.add(
      "show"
    );

    alertOverlay.setAttribute(
      "aria-hidden",
      "false"
    );

    alertIsOpen = true;
  }
);


/* =========================
   通知を閉じる
========================= */

closeAlertButton.addEventListener(
  "click",
  closeAlert
);


alertOverlay.addEventListener(
  "click",
  (event) => {
    if (
      event.target === alertOverlay
    ) {
      closeAlert();
    }
  }
);


/* =========================
   自分の入力保存
========================= */

myMarchMinutesInput.addEventListener(
  "input",
  saveAllData
);


myMarchSecondsInput.addEventListener(
  "input",
  saveAllData
);


myMarchSecondsInput.addEventListener(
  "change",
  () => {
    normalizeMinuteSecondInputs(
      myMarchMinutesInput,
      myMarchSecondsInput
    );

    saveAllData();
  }
);


insertDelayInput.addEventListener(
  "input",
  saveAllData
);


tapCorrectionInput.addEventListener(
  "input",
  saveAllData
);


/* =========================
   初期起動
========================= */

loadSavedData();

updateCurrentClock();
updateAllCountdowns();


/*
  現在時刻とカウントダウンを
  0.1秒ごとに更新
*/
setInterval(() => {
  updateCurrentClock();
  updateAllCountdowns();
}, 100);
