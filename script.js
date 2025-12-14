const PRESETS = {
  size512: { width: 512, height: 512, label: '512 x 512 (Large)' },
  size256: { width: 256, height: 256, label: '256 x 256 (Small)' },
  size400: { width: 400, height: 400, label: '400 x 400 (Medium)' }
};

let currentImage = null;

/**
 * DOM構築後に初期化処理をセットアップする。
 */
document.addEventListener('DOMContentLoaded', () => {
  const elements = getElements();
  setupInitialState(elements);
  bindEvents(elements);
});

/**
 * 必要なDOM要素を取得してまとめる。
 * @returns {Object} DOM参照のセット
 */
function getElements() {
  return {
    fileInput: document.getElementById('fileInput'),
    presetSelect: document.getElementById('presetSelect'),
    customFields: document.getElementById('customSizeFields'),
    customWidth: document.getElementById('customWidth'),
    customHeight: document.getElementById('customHeight'),
    fitSelect: document.getElementById('fitSelect'),
    transparentToggle: document.getElementById('transparentToggle'),
    bgColorWrapper: document.getElementById('bgColorWrapper'),
    bgColor: document.getElementById('bgColor'),
    centerButton: document.getElementById('centerButton'),
    downloadButton: document.getElementById('downloadButton'),
    canvas: document.getElementById('previewCanvas'),
    sizeLabel: document.getElementById('sizeLabel')
  };
}

/**
 * 初期状態のUIを整える。
 * @param {Object} elements DOM参照
 */
function setupInitialState(elements) {
  elements.presetSelect.value = 'size512';
  elements.fitSelect.value = 'cover';
  toggleCustomFields(elements);
  toggleBackgroundPicker(elements);
  updateCanvasSize(elements);
}

/**
 * すべてのイベントリスナーを登録する。
 * @param {Object} elements DOM参照
 */
function bindEvents(elements) {
  elements.fileInput.addEventListener('change', (event) => handleFileChange(event, elements));
  elements.presetSelect.addEventListener('change', () => handlePresetChange(elements));
  elements.customWidth.addEventListener('input', () => handleCustomSizeChange(elements));
  elements.customHeight.addEventListener('input', () => handleCustomSizeChange(elements));
  elements.fitSelect.addEventListener('change', () => redrawCanvas(elements));
  elements.transparentToggle.addEventListener('change', () => handleBackgroundToggle(elements));
  elements.bgColor.addEventListener('input', () => redrawCanvas(elements));
  elements.centerButton.addEventListener('click', () => redrawCanvas(elements));
  elements.downloadButton.addEventListener('click', () => downloadImage(elements));
}

/**
 * プリセット変更時の処理を行う。
 * @param {Object} elements DOM参照
 */
function handlePresetChange(elements) {
  toggleCustomFields(elements);
  updateCanvasSize(elements);
  redrawCanvas(elements);
}

/**
 * カスタムサイズ入力時の処理を行う。
 * @param {Object} elements DOM参照
 */
function handleCustomSizeChange(elements) {
  if (elements.presetSelect.value === 'custom') {
    updateCanvasSize(elements);
    redrawCanvas(elements);
  }
}

/**
 * 背景の透過設定変更時の処理を行う。
 * @param {Object} elements DOM参照
 */
function handleBackgroundToggle(elements) {
  toggleBackgroundPicker(elements);
  redrawCanvas(elements);
}

/**
 * ファイルインプット変更時に画像を読み込む。
 * @param {Event} event changeイベント
 * @param {Object} elements DOM参照
 */
function handleFileChange(event, elements) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      currentImage = img;
      redrawCanvas(elements);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/**
 * プリセットに応じてカスタムサイズ入力欄を表示・非表示にする。
 * @param {Object} elements DOM参照
 */
function toggleCustomFields(elements) {
  const isCustom = elements.presetSelect.value === 'custom';
  elements.customFields.classList.toggle('hidden', !isCustom);
}

/**
 * 透過設定に応じて背景色ピッカーを切り替える。
 * @param {Object} elements DOM参照
 */
function toggleBackgroundPicker(elements) {
  const transparent = elements.transparentToggle.checked;
  elements.bgColorWrapper.classList.toggle('hidden', transparent);
}

/**
 * 現在のプリセットからキャンバスサイズを決定し更新する。
 * @param {Object} elements DOM参照
 */
function updateCanvasSize(elements) {
  const { width, height } = getTargetSize(elements);
  elements.canvas.width = width;
  elements.canvas.height = height;
  elements.sizeLabel.textContent = `Size: ${width} x ${height}`;
}

/**
 * フォーム状態からターゲットサイズを取得する。
 * @param {Object} elements DOM参照
 * @returns {{width: number, height: number}}
 */
function getTargetSize(elements) {
  if (elements.presetSelect.value === 'custom') {
    const width = parseInt(elements.customWidth.value, 10) || 1;
    const height = parseInt(elements.customHeight.value, 10) || 1;
    return { width, height };
  }
  return PRESETS[elements.presetSelect.value];
}

/**
 * 現在の設定に基づいてキャンバスを再描画する。
 * @param {Object} elements DOM参照
 */
function redrawCanvas(elements) {
  updateCanvasSize(elements);
  const ctx = elements.canvas.getContext('2d');
  ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);

  const transparent = elements.transparentToggle.checked;
  if (!transparent) {
    ctx.fillStyle = elements.bgColor.value;
    ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
  }

  if (!currentImage) return;

  const { drawWidth, drawHeight, offsetX, offsetY } = calculateDrawBox(elements);
  ctx.drawImage(currentImage, offsetX, offsetY, drawWidth, drawHeight);
}

/**
 * 画像の描画サイズとオフセットを計算する。
 * @param {Object} elements DOM参照
 * @returns {{drawWidth: number, drawHeight: number, offsetX: number, offsetY: number}}
 */
function calculateDrawBox(elements) {
  const fitMode = elements.fitSelect.value;
  const canvasWidth = elements.canvas.width;
  const canvasHeight = elements.canvas.height;
  const imgW = currentImage.width;
  const imgH = currentImage.height;

  const scale = fitMode === 'contain'
    ? Math.min(canvasWidth / imgW, canvasHeight / imgH)
    : Math.max(canvasWidth / imgW, canvasHeight / imgH);

  const drawWidth = imgW * scale;
  const drawHeight = imgH * scale;
  const offsetX = (canvasWidth - drawWidth) / 2;
  const offsetY = (canvasHeight - drawHeight) / 2;

  return { drawWidth, drawHeight, offsetX, offsetY };
}

/**
 * キャンバスをPNGとしてダウンロードする。
 * @param {Object} elements DOM参照
 */
function downloadImage(elements) {
  const link = document.createElement('a');
  const presetKey = elements.presetSelect.value;
  const presetName = presetKey === 'custom' ? 'custom' : `${presetKey}-icon`;
  link.download = `${presetName}.png`;
  link.href = elements.canvas.toDataURL('image/png');
  link.click();
}
