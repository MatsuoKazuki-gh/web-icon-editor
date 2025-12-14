const PRESETS = {
  size512: { width: 512, height: 512, label: '512 x 512 (Large)' },
  size256: { width: 256, height: 256, label: '256 x 256 (Small)' },
  size400: { width: 400, height: 400, label: '400 x 400 (Medium)' }
};

let currentImage = null;
let cropRect = null;
let previewCropRect = null;
let isDraggingCrop = false;
let dragStart = null;

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
    resetCropButton: document.getElementById('resetCropButton'),
    gridToggle: document.getElementById('gridToggle'),
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
  elements.gridToggle.addEventListener('change', () => redrawCanvas(elements));
  elements.resetCropButton.addEventListener('click', () => resetCrop(elements));
  elements.canvas.addEventListener('mousedown', (event) => handleCropStart(event, elements));
  elements.canvas.addEventListener('mousemove', (event) => handleCropMove(event, elements));
  elements.canvas.addEventListener('mouseup', () => handleCropEnd(elements));
  elements.canvas.addEventListener('mouseleave', () => handleCropEnd(elements));
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
      cropRect = null;
      previewCropRect = null;
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

  const sourceRect = getActiveCropRect();
  const drawInfo = calculateDrawBox(elements, sourceRect);
  ctx.drawImage(
    currentImage,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    drawInfo.offsetX,
    drawInfo.offsetY,
    drawInfo.drawWidth,
    drawInfo.drawHeight
  );

  if (elements.gridToggle.checked) {
    drawGridLines(ctx, elements.canvas);
  }

  drawCropOverlay(ctx, drawInfo, sourceRect);
}

/**
 * 画像の描画サイズとオフセットを計算する。
 * @param {Object} elements DOM参照
 * @returns {{drawWidth: number, drawHeight: number, offsetX: number, offsetY: number}}
 */
function calculateDrawBox(elements, sourceRect) {
  const fitMode = elements.fitSelect.value;
  const canvasWidth = elements.canvas.width;
  const canvasHeight = elements.canvas.height;
  const imgW = sourceRect.width;
  const imgH = sourceRect.height;

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

/**
 * 現在選択されている切り取り領域を返す。未指定の場合は画像全体を返す。
 * @returns {{x: number, y: number, width: number, height: number} | null}
 */
function getActiveCropRect() {
  if (!currentImage) return null;
  if (cropRect) return cropRect;
  return { x: 0, y: 0, width: currentImage.width, height: currentImage.height };
}

/**
 * グリッド線を描画する。
 * @param {CanvasRenderingContext2D} ctx 描画コンテキスト
 * @param {HTMLCanvasElement} canvas 対象キャンバス
 */
function drawGridLines(ctx, canvas) {
  const spacing = 32;
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 1;

  for (let x = spacing; x < canvas.width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = spacing; y < canvas.height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 切り取り範囲のオーバーレイを描画する。
 * @param {CanvasRenderingContext2D} ctx 描画コンテキスト
 * @param {{drawWidth:number, drawHeight:number, offsetX:number, offsetY:number}} drawInfo 描画サイズ情報
 * @param {{x:number, y:number, width:number, height:number}} sourceRect 元画像上の描画領域
 */
function drawCropOverlay(ctx, drawInfo, sourceRect) {
  const activeRect = previewCropRect || cropRect;
  if (!activeRect) return;

  const projected = projectRectToCanvas(activeRect, sourceRect, drawInfo);
  ctx.save();
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.9)';
  ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
  ctx.lineWidth = 2;
  ctx.fillRect(projected.x, projected.y, projected.width, projected.height);
  ctx.strokeRect(projected.x, projected.y, projected.width, projected.height);
  ctx.restore();
}

/**
 * 元画像座標系の矩形をキャンバス座標に投影する。
 * @param {{x:number, y:number, width:number, height:number}} rect 対象矩形
 * @param {{x:number, y:number, width:number, height:number}} sourceRect 描画元矩形
 * @param {{drawWidth:number, drawHeight:number, offsetX:number, offsetY:number}} drawInfo 描画サイズ情報
 * @returns {{x:number, y:number, width:number, height:number}}
 */
function projectRectToCanvas(rect, sourceRect, drawInfo) {
  const scaleX = drawInfo.drawWidth / sourceRect.width;
  const scaleY = drawInfo.drawHeight / sourceRect.height;

  return {
    x: drawInfo.offsetX + (rect.x - sourceRect.x) * scaleX,
    y: drawInfo.offsetY + (rect.y - sourceRect.y) * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY
  };
}

/**
 * キャンバス上でのドラッグ開始を処理する。
 * @param {MouseEvent} event mousedownイベント
 * @param {Object} elements DOM参照
 */
function handleCropStart(event, elements) {
  if (!currentImage) return;
  const point = getImagePointFromEvent(event, elements);
  if (!point) return;

  isDraggingCrop = true;
  dragStart = point;
  previewCropRect = { x: point.x, y: point.y, width: 0, height: 0 };
}

/**
 * ドラッグ中のポインタ移動を処理する。
 * @param {MouseEvent} event mousemoveイベント
 * @param {Object} elements DOM参照
 */
function handleCropMove(event, elements) {
  if (!isDraggingCrop || !currentImage) return;

  const point = getImagePointFromEvent(event, elements);
  if (!point) return;

  const baseRect = getActiveCropRect();
  const constrained = constrainPointToRect(point, baseRect);
  previewCropRect = createRectFromPoints(dragStart, constrained);
  redrawCanvas(elements);
}

/**
 * ドラッグ終了時の処理を行う。
 * @param {Object} elements DOM参照
 */
function handleCropEnd(elements) {
  if (!isDraggingCrop) return;

  isDraggingCrop = false;
  dragStart = null;

  if (previewCropRect && previewCropRect.width > 0 && previewCropRect.height > 0) {
    cropRect = previewCropRect;
  }

  previewCropRect = null;
  redrawCanvas(elements);
}

/**
 * キャンバスイベントから画像座標を算出する。
 * @param {MouseEvent} event マウスイベント
 * @param {Object} elements DOM参照
 * @returns {{x:number, y:number} | null}
 */
function getImagePointFromEvent(event, elements) {
  const rect = elements.canvas.getBoundingClientRect();
  const scaleX = elements.canvas.width / rect.width;
  const scaleY = elements.canvas.height / rect.height;
  const canvasX = (event.clientX - rect.left) * scaleX;
  const canvasY = (event.clientY - rect.top) * scaleY;

  const sourceRect = getActiveCropRect();
  if (!sourceRect) return null;
  const drawInfo = calculateDrawBox(elements, sourceRect);

  const insideX = canvasX >= drawInfo.offsetX && canvasX <= drawInfo.offsetX + drawInfo.drawWidth;
  const insideY = canvasY >= drawInfo.offsetY && canvasY <= drawInfo.offsetY + drawInfo.drawHeight;
  if (!insideX || !insideY) return null;

  const normalizedX = (canvasX - drawInfo.offsetX) / drawInfo.drawWidth;
  const normalizedY = (canvasY - drawInfo.offsetY) / drawInfo.drawHeight;

  return {
    x: sourceRect.x + normalizedX * sourceRect.width,
    y: sourceRect.y + normalizedY * sourceRect.height
  };
}

/**
 * 2点から矩形を生成する。
 * @param {{x:number, y:number}} start 開始点
 * @param {{x:number, y:number}} end 終了点
 * @returns {{x:number, y:number, width:number, height:number}}
 */
function createRectFromPoints(start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
}

/**
 * 点を矩形内に収めるよう制限する。
 * @param {{x:number, y:number}} point 対象点
 * @param {{x:number, y:number, width:number, height:number}} rect 基準矩形
 * @returns {{x:number, y:number}}
 */
function constrainPointToRect(point, rect) {
  return {
    x: Math.min(Math.max(point.x, rect.x), rect.x + rect.width),
    y: Math.min(Math.max(point.y, rect.y), rect.y + rect.height)
  };
}

/**
 * 切り取り範囲を初期化し再描画する。
 * @param {Object} elements DOM参照
 */
function resetCrop(elements) {
  cropRect = null;
  previewCropRect = null;
  redrawCanvas(elements);
}
