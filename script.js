const PRESETS = {
  size512: { width: 512, height: 512, label: '512 x 512 (Large)' },
  size256: { width: 256, height: 256, label: '256 x 256 (Small)' },
  size400: { width: 400, height: 400, label: '400 x 400 (Medium)' }
};

const HANDLE_SIZE = 12;
const MIN_CROP_SIZE = 16;

let currentImage = null;
let cropRect = null;
let previewCropRect = null;
let isDraggingCrop = false;
let dragStart = null;
let dragMode = null;
let activeHandle = null;
let baseCropRect = null;

/**
 * 現在のプリセットに基づいて高さ:横幅のアスペクト比を返す。
 * @param {Object} elements DOM参照
 * @returns {number} 高さ/横幅の比率
 */
function getTargetAspect(elements) {
  const { width, height } = getTargetSize(elements);
  return height / width;
}

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

  const fullImageRect = getFullImageRect();
  const drawInfo = calculateDrawBox(elements, fullImageRect);
  ctx.drawImage(
    currentImage,
    fullImageRect.x,
    fullImageRect.y,
    fullImageRect.width,
    fullImageRect.height,
    drawInfo.offsetX,
    drawInfo.offsetY,
    drawInfo.drawWidth,
    drawInfo.drawHeight
  );

  if (elements.gridToggle.checked) {
    drawGridLines(ctx, elements.canvas);
  }

  drawCropOverlay(ctx, drawInfo, fullImageRect);
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
 * 選択領域をPNGとしてダウンロードする（選択がなければ全体）。
 * @param {Object} elements DOM参照
 */
function downloadImage(elements) {
  if (!currentImage) return;

  const exportSourceRect = cropRect || getFullImageRect();
  const { width, height } = getTargetSize(elements);
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const ctx = exportCanvas.getContext('2d');

  if (!elements.transparentToggle.checked) {
    ctx.fillStyle = elements.bgColor.value;
    ctx.fillRect(0, 0, width, height);
  }

  const drawInfo = calculateDrawBox({ canvas: exportCanvas, fitSelect: elements.fitSelect }, exportSourceRect);
  ctx.drawImage(
    currentImage,
    exportSourceRect.x,
    exportSourceRect.y,
    exportSourceRect.width,
    exportSourceRect.height,
    drawInfo.offsetX,
    drawInfo.offsetY,
    drawInfo.drawWidth,
    drawInfo.drawHeight
  );

  const link = document.createElement('a');
  const presetKey = elements.presetSelect.value;
  const presetName = presetKey === 'custom' ? 'custom' : `${presetKey}-icon`;
  link.download = `${presetName}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
}

/**
 * 現在選択されている切り取り領域を返す。未指定の場合は画像全体を返す。
 * @returns {{x: number, y: number, width: number, height: number} | null}
 */
function getActiveCropRect() {
  if (!currentImage) return null;
  if (cropRect) return cropRect;
  return getFullImageRect();
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

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.rect(projected.x, projected.y, projected.width, projected.height);
  ctx.fill('evenodd');

  ctx.strokeStyle = 'rgba(37, 99, 235, 0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(projected.x, projected.y, projected.width, projected.height);
  drawResizeHandles(ctx, projected);
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
 * リサイズ用のハンドルを描画する。
 * @param {CanvasRenderingContext2D} ctx 描画コンテキスト
 * @param {{x:number, y:number, width:number, height:number}} projectedRect キャンバス上の矩形
 */
function drawResizeHandles(ctx, projectedRect) {
  const handles = getHandlePositions(projectedRect);
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.9)';
  ctx.lineWidth = 2;

  handles.forEach((handle) => {
    ctx.beginPath();
    ctx.rect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fill();
    ctx.stroke();
  });
}

/**
 * ハンドルの座標セットを生成する。
 * @param {{x:number, y:number, width:number, height:number}} rect 基準矩形（キャンバス座標）
 * @returns {{name:string, x:number, y:number}[]} ハンドル情報の配列
 */
function getHandlePositions(rect) {
  const midX = rect.x + rect.width / 2;
  const midY = rect.y + rect.height / 2;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  return [
    { name: 'nw', x: rect.x, y: rect.y },
    { name: 'n', x: midX, y: rect.y },
    { name: 'ne', x: right, y: rect.y },
    { name: 'e', x: right, y: midY },
    { name: 'se', x: right, y: bottom },
    { name: 's', x: midX, y: bottom },
    { name: 'sw', x: rect.x, y: bottom },
    { name: 'w', x: rect.x, y: midY }
  ];
}

/**
 * キャンバス上でのドラッグ開始を処理する。
 * @param {MouseEvent} event mousedownイベント
 * @param {Object} elements DOM参照
 */
function handleCropStart(event, elements) {
  if (!currentImage) return;
  const canvasPoint = getCanvasPointFromEvent(event, elements);
  if (!canvasPoint) return;

  const imagePoint = getImagePointFromCanvasPoint(canvasPoint, elements);
  if (!imagePoint) return;

  const sourceRect = getFullImageRect();
  const drawInfo = calculateDrawBox(elements, sourceRect);
  const hasExistingSelection = Boolean(cropRect);
  const handle = hasExistingSelection
    ? detectHandleHit(canvasPoint, cropRect, sourceRect, drawInfo)
    : null;

  isDraggingCrop = true;
  dragStart = imagePoint;
  baseCropRect = cropRect ? { ...cropRect } : null;

  if (handle) {
    dragMode = 'resize';
    activeHandle = handle;
  } else if (hasExistingSelection && isPointInsideSelection(canvasPoint, cropRect, sourceRect, drawInfo)) {
    dragMode = 'move';
  } else {
    dragMode = 'create';
    previewCropRect = { x: imagePoint.x, y: imagePoint.y, width: 0, height: 0 };
  }
}

/**
 * ドラッグ中のポインタ移動を処理する。
 * @param {MouseEvent} event mousemoveイベント
 * @param {Object} elements DOM参照
 */
function handleCropMove(event, elements) {
  if (!isDraggingCrop || !currentImage) return;

  const imagePoint = getImagePointFromEvent(event, elements);
  if (!imagePoint) return;

  if (dragMode === 'create') {
    const baseRect = getFullImageRect();
    const constrained = constrainPointToRect(imagePoint, baseRect);
    const aspect = getTargetAspect(elements);
    previewCropRect = createAspectRect(dragStart, constrained, aspect, baseRect);
  }

  if (dragMode === 'move' && baseCropRect) {
    const deltaX = imagePoint.x - dragStart.x;
    const deltaY = imagePoint.y - dragStart.y;
    const moved = {
      x: baseCropRect.x + deltaX,
      y: baseCropRect.y + deltaY,
      width: baseCropRect.width,
      height: baseCropRect.height
    };
    cropRect = clampRectToImage(moved);
    previewCropRect = { ...cropRect };
  }

  if (dragMode === 'resize' && baseCropRect && activeHandle) {
    const aspect = getTargetAspect(elements);
    const resized = resizeRectWithHandle(baseCropRect, activeHandle, imagePoint, aspect);
    cropRect = clampRectToImage(resized);
    previewCropRect = { ...cropRect };
  }

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
  dragMode = null;
  activeHandle = null;
  baseCropRect = null;

  if (previewCropRect && previewCropRect.width >= MIN_CROP_SIZE && previewCropRect.height >= MIN_CROP_SIZE) {
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
  const canvasPoint = getCanvasPointFromEvent(event, elements);
  if (!canvasPoint) return null;
  return getImagePointFromCanvasPoint(canvasPoint, elements);
}

/**
 * イベントからキャンバス座標系の点を取得する。
 * @param {MouseEvent} event マウスイベント
 * @param {Object} elements DOM参照
 * @returns {{x:number, y:number} | null}
 */
function getCanvasPointFromEvent(event, elements) {
  const rect = elements.canvas.getBoundingClientRect();
  const scaleX = elements.canvas.width / rect.width;
  const scaleY = elements.canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

/**
 * キャンバス座標の点を画像座標に変換する。
 * @param {{x:number, y:number}} canvasPoint キャンバス座標の点
 * @param {Object} elements DOM参照
 * @returns {{x:number, y:number} | null}
 */
function getImagePointFromCanvasPoint(canvasPoint, elements) {
  const sourceRect = getFullImageRect();
  if (!sourceRect) return null;
  const drawInfo = calculateDrawBox(elements, sourceRect);

  const insideX = canvasPoint.x >= drawInfo.offsetX && canvasPoint.x <= drawInfo.offsetX + drawInfo.drawWidth;
  const insideY = canvasPoint.y >= drawInfo.offsetY && canvasPoint.y <= drawInfo.offsetY + drawInfo.drawHeight;
  if (!insideX || !insideY) return null;

  const normalizedX = (canvasPoint.x - drawInfo.offsetX) / drawInfo.drawWidth;
  const normalizedY = (canvasPoint.y - drawInfo.offsetY) / drawInfo.drawHeight;

  return {
    x: sourceRect.x + normalizedX * sourceRect.width,
    y: sourceRect.y + normalizedY * sourceRect.height
  };
}

/**
 * 選択領域上に存在するかを判定する。
 * @param {{x:number, y:number}} canvasPoint キャンバス座標の点
 * @param {{x:number, y:number, width:number, height:number}} rect 対象矩形（画像座標）
 * @param {{x:number, y:number, width:number, height:number}} sourceRect 描画元矩形
 * @param {{drawWidth:number, drawHeight:number, offsetX:number, offsetY:number}} drawInfo 描画情報
 * @returns {boolean}
 */
function isPointInsideSelection(canvasPoint, rect, sourceRect, drawInfo) {
  const projected = projectRectToCanvas(rect, sourceRect, drawInfo);
  return (
    canvasPoint.x >= projected.x &&
    canvasPoint.x <= projected.x + projected.width &&
    canvasPoint.y >= projected.y &&
    canvasPoint.y <= projected.y + projected.height
  );
}

/**
 * ハンドル上をクリックしたかどうかを判定する。
 * @param {{x:number, y:number}} canvasPoint キャンバス座標の点
 * @param {{x:number, y:number, width:number, height:number}} rect 対象矩形（画像座標）
 * @param {{x:number, y:number, width:number, height:number}} sourceRect 描画元矩形
 * @param {{drawWidth:number, drawHeight:number, offsetX:number, offsetY:number}} drawInfo 描画情報
 * @returns {string|null} ヒットしたハンドル名
 */
function detectHandleHit(canvasPoint, rect, sourceRect, drawInfo) {
  const projected = projectRectToCanvas(rect, sourceRect, drawInfo);
  const handles = getHandlePositions(projected);

  for (const handle of handles) {
    const dx = canvasPoint.x - handle.x;
    const dy = canvasPoint.y - handle.y;
    const half = HANDLE_SIZE / 2;
    if (Math.abs(dx) <= half && Math.abs(dy) <= half) {
      return handle.name;
    }
  }

  return null;
}

/**
 * ハンドル操作に応じて矩形をリサイズする。
 * @param {{x:number, y:number, width:number, height:number}} startRect 操作開始時の矩形
 * @param {string} handleName ハンドル名
 * @param {{x:number, y:number}} currentPoint 現在の画像座標点
 * @returns {{x:number, y:number, width:number, height:number}}
 */
function resizeRectWithHandle(startRect, handleName, currentPoint, aspect) {
  const anchor = getHandleAnchorPoint(startRect, handleName);
  const bounds = getFullImageRect();
  return createAspectRect(anchor, currentPoint, aspect, bounds);
}

/**
 * 矩形を画像内に収め、最小サイズを維持する。
 * @param {{x:number, y:number, width:number, height:number}} rect 対象矩形
 * @returns {{x:number, y:number, width:number, height:number}}
 */
function clampRectToImage(rect) {
  const maxX = currentImage.width;
  const maxY = currentImage.height;

  const width = Math.max(rect.width, MIN_CROP_SIZE);
  const height = Math.max(rect.height, MIN_CROP_SIZE);

  const clampedX = Math.min(Math.max(rect.x, 0), maxX - width);
  const clampedY = Math.min(Math.max(rect.y, 0), maxY - height);

  return {
    x: clampedX,
    y: clampedY,
    width,
    height
  };
}

/**
 * 画像全体を表す矩形を返す。
 * @returns {{x:number, y:number, width:number, height:number}}
 */
function getFullImageRect() {
  return { x: 0, y: 0, width: currentImage?.width || 0, height: currentImage?.height || 0 };
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
 * 2点とアスペクト比から矩形を生成する。開始点側を基準にしつつ、矩形が画像の範囲からはみ出さないよう制限する。
 * @param {{x:number, y:number}} start 基準点
 * @param {{x:number, y:number}} end 現在位置
 * @param {number} aspect 高さ/横幅の比率
 * @param {{x:number, y:number, width:number, height:number}} bounds 制限範囲
 * @returns {{x:number, y:number, width:number, height:number}}
 */
function createAspectRect(start, end, aspect, bounds) {
  const directionX = end.x >= start.x ? 1 : -1;
  const directionY = end.y >= start.y ? 1 : -1;

  const maxWidth = directionX === 1
    ? bounds.x + bounds.width - start.x
    : start.x - bounds.x;
  const maxHeight = directionY === 1
    ? bounds.y + bounds.height - start.y
    : start.y - bounds.y;

  const suggestedWidth = Math.abs(end.x - start.x);
  const suggestedHeight = Math.abs(end.y - start.y);

  let targetWidth = suggestedWidth;
  let targetHeight = targetWidth * aspect;

  if (targetHeight > suggestedHeight) {
    targetHeight = suggestedHeight;
    targetWidth = targetHeight / aspect;
  }

  targetWidth = Math.min(Math.max(targetWidth, MIN_CROP_SIZE), maxWidth);
  targetHeight = targetWidth * aspect;

  if (targetHeight > maxHeight) {
    targetHeight = maxHeight;
    targetWidth = targetHeight / aspect;
  }

  targetHeight = Math.max(targetHeight, MIN_CROP_SIZE);
  targetWidth = targetHeight / aspect;

  if (targetWidth > maxWidth) {
    targetWidth = maxWidth;
    targetHeight = targetWidth * aspect;
  }

  if (targetHeight > maxHeight) {
    targetHeight = maxHeight;
    targetWidth = targetHeight / aspect;
  }

  const x = start.x + (directionX === 1 ? 0 : -targetWidth);
  const y = start.y + (directionY === 1 ? 0 : -targetHeight);

  return {
    x: Math.min(Math.max(x, bounds.x), bounds.x + bounds.width - targetWidth),
    y: Math.min(Math.max(y, bounds.y), bounds.y + bounds.height - targetHeight),
    width: targetWidth,
    height: targetHeight
  };
}

/**
 * ハンドル位置に応じて固定する基準点を返す。
 * @param {{x:number, y:number, width:number, height:number}} rect 基準矩形
 * @param {string} handleName ハンドル名
 * @returns {{x:number, y:number}}
 */
function getHandleAnchorPoint(rect, handleName) {
  switch (handleName) {
    case 'nw':
      return { x: rect.x + rect.width, y: rect.y + rect.height };
    case 'ne':
      return { x: rect.x, y: rect.y + rect.height };
    case 'sw':
      return { x: rect.x + rect.width, y: rect.y };
    case 'se':
      return { x: rect.x, y: rect.y };
    case 'n':
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case 's':
      return { x: rect.x + rect.width / 2, y: rect.y };
    case 'w':
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    case 'e':
      return { x: rect.x, y: rect.y + rect.height / 2 };
    default:
      return { x: rect.x, y: rect.y };
  }
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
