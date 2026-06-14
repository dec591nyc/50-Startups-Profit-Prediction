// Constants
const BACKEND_URL = "https://50-startups-profit-prediction.up.railway.app";

// Global State
let currentSlide = 1;
const totalSlides = 8;
let modelData = null; // Stores response from /api/train

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const encodingSelect = document.getElementById('encoding-select');
const smoothingRow = document.getElementById('smoothing-row');
const smoothingSlider = document.getElementById('smoothing-slider');
const smoothingVal = document.getElementById('smoothing-val');
const trainRatioSlider = document.getElementById('train-ratio-slider');
const trainRatioVal = document.getElementById('train-ratio-val');
const refitBtn = document.getElementById('refit-btn');

// Predict Inputs
const rdSlider = document.getElementById('rd-slider');
const rdInput = document.getElementById('rd-input');
const rdVal = document.getElementById('rd-val');
const adminSlider = document.getElementById('admin-slider');
const adminInput = document.getElementById('admin-input');
const adminVal = document.getElementById('admin-val');
const marketingSlider = document.getElementById('marketing-slider');
const marketingInput = document.getElementById('marketing-input');
const marketingVal = document.getElementById('marketing-val');
const stateSelect = document.getElementById('state-select');
const predictBtn = document.getElementById('predict-btn');

// Output Elements
const predResultVal = document.getElementById('pred-result-value');
const predCiVal = document.getElementById('pred-ci-value');
const mR2 = document.getElementById('m-r2');
const mAdjR2 = document.getElementById('m-adj-r2');
const mMae = document.getElementById('m-mae');
const mRmse = document.getElementById('m-rmse');
const metricsCompText = document.getElementById('metrics-comp-text');
const regressionEquation = document.getElementById('regression-equation');
const olsTableBody = document.getElementById('ols-table-body');
const olsDetailDisplay = document.getElementById('ols-detail-display');
const olsDetailTitle = document.getElementById('ols-detail-title');
const olsDetailContent = document.getElementById('ols-detail-content');
const closeOlsDetail = document.getElementById('close-ols-detail');

// PPT Elements
const prevSlideBtn = document.getElementById('prev-slide-btn');
const nextSlideBtn = document.getElementById('next-slide-btn');
const slideIndicators = document.getElementById('slide-indicators');
const fullscreenPptBtn = document.getElementById('fullscreen-ppt-btn');
const slideDeckContainer = document.querySelector('.slide-deck-container');

// Whitepaper Elements
const whitepaperToc = document.getElementById('whitepaper-toc');
const whitepaperContentArea = document.getElementById('whitepaper-content-area');
const printWorkspaceBtn = document.getElementById('print-workspace-btn');

// ------------------ INITIALIZATION ------------------
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initSliders();
  initPredictSync();
  initPPT();
  initWhitepaper();

  // Initial model fit
  fitModel();
});

// ------------------ TAB SYSTEM ------------------
function initTabs() {
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      // Toggle active classes on buttons
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Toggle active classes on tab contents
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === targetTab) {
          content.classList.add('active');

          // Re-render canvas plots when tab becomes active (helps with sizing)
          if (targetTab === 'simulator-tab' && modelData) {
            renderPlots(modelData.plot_data);
          }
        }
      });
    });
  });
}

// ------------------ SLIDER INPUT SYNC ------------------
function initSliders() {
  // Encoding Select change handler (hide/show BTE smoothing)
  encodingSelect.addEventListener('change', () => {
    if (encodingSelect.value === 'ohe') {
      smoothingRow.classList.add('hidden');
    } else {
      smoothingRow.classList.remove('hidden');
    }
  });

  // BTE Smoothing slider sync
  smoothingSlider.addEventListener('input', () => {
    smoothingVal.textContent = smoothingSlider.value;
  });

  // Train Ratio slider sync
  trainRatioSlider.addEventListener('input', () => {
    trainRatioVal.textContent = `${Math.round(trainRatioSlider.value * 100)}%`;
  });

  // Refit model button click
  refitBtn.addEventListener('click', () => {
    fitModel();
  });
}

function initPredictSync() {
  // Sync sliders & input boxes for Predict parameters
  const syncGroup = [
    { slider: rdSlider, input: rdInput, display: rdVal, prefix: '$' },
    { slider: adminSlider, input: adminInput, display: adminVal, prefix: '$' },
    { slider: marketingSlider, input: marketingInput, display: marketingVal, prefix: '$' }
  ];

  syncGroup.forEach(group => {
    // Slider moves -> update input box & text display
    group.slider.addEventListener('input', () => {
      group.input.value = group.slider.value;
      group.display.textContent = group.prefix + Number(group.slider.value).toLocaleString('en-US');
    });

    // Input changes -> update slider & text display
    group.input.addEventListener('change', () => {
      let val = Math.max(Number(group.input.min), Math.min(Number(group.input.max), Number(group.input.value)));
      group.input.value = val;
      group.slider.value = val;
      group.display.textContent = group.prefix + val.toLocaleString('en-US');
    });
  });

  // Predict button event
  predictBtn.addEventListener('click', () => {
    predictProfit();
  });
}

// ------------------ API CALLS ------------------
async function fitModel() {
  refitBtn.disabled = true;
  refitBtn.textContent = '擬合中...';

  const payload = {
    encoding_choice: encodingSelect.value,
    smoothing: parseFloat(smoothingSlider.value),
    train_ratio: parseFloat(trainRatioSlider.value)
  };

  try {
    const response = await fetch(`${BACKEND_URL}/api/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('API training response failed');

    modelData = await response.json();

    // Update dashboard metrics
    updateMetricsDisplay(modelData);

    // Update equation text
    regressionEquation.textContent = modelData.equation;

    // Render OLS summary table
    renderOlsTable(modelData.summary_table);

    // Draw scatter plots on canvas
    renderPlots(modelData.plot_data);

    // Call predict to update predicted card as well
    predictProfit();

  } catch (error) {
    console.error('Error fitting model:', error);
    alert('後端 API 通訊錯誤，請確認 FastAPI 服務是否在 http://127.0.0.1:8000 啟動中！');
  } finally {
    refitBtn.disabled = false;
    refitBtn.textContent = '重新擬合模型 (Refit)';
  }
}

async function predictProfit() {
  predictBtn.disabled = true;
  predictBtn.textContent = '估算中...';

  const payload = {
    rd_spend: parseFloat(rdSlider.value),
    admin_spend: parseFloat(adminSlider.value),
    marketing_spend: parseFloat(marketingSlider.value),
    state: stateSelect.value,
    encoding_choice: encodingSelect.value,
    smoothing: parseFloat(smoothingSlider.value),
    train_ratio: parseFloat(trainRatioSlider.value)
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('API prediction failed');

    const predData = await response.json();

    // Render outputs
    predResultVal.textContent = '$' + predData.predicted_profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    predCiVal.textContent = `[$${predData.lower_bound.toLocaleString('en-US', { maximumFractionDigits: 0 })}, $${predData.upper_bound.toLocaleString('en-US', { maximumFractionDigits: 0 })}]`;

  } catch (error) {
    console.error('Error predicting:', error);
  } finally {
    predictBtn.disabled = false;
    predictBtn.textContent = '估算利潤預期';
  }
}

// ------------------ METRICS DISPLAY ------------------
function updateMetricsDisplay(data) {
  mR2.textContent = data.test_metrics.R2.toFixed(4);
  mAdjR2.textContent = data.test_metrics.Adj_R2.toFixed(4);
  mMae.textContent = '$' + data.test_metrics.MAE.toLocaleString('en-US', { maximumFractionDigits: 2 });
  mRmse.textContent = '$' + data.test_metrics.RMSE.toLocaleString('en-US', { maximumFractionDigits: 2 });

  // Update comparison label
  const curChoice = encodingSelect.value;
  const currentMae = curChoice === 'ohe' ? data.comparison.ohe.MAE : data.comparison.bte.MAE;
  const altMae = curChoice === 'ohe' ? data.comparison.bte.MAE : data.comparison.ohe.MAE;
  const currentLabel = curChoice.toUpperCase();
  const altLabel = curChoice === 'ohe' ? 'BTE' : 'OHE';

  if (currentMae < altMae) {
    const diff = altMae - currentMae;
    metricsCompText.textContent = `🌟 ${currentLabel} 較對照 ${altLabel} 降低了 $${diff.toFixed(2)} 的測試集 MAE 誤差！`;
    metricsCompText.style.color = '#047857'; // Green
  } else {
    const diff = currentMae - altMae;
    metricsCompText.textContent = `💡 對照編碼 ${altLabel} 表現較優，降低了 $${diff.toFixed(2)} 的 MAE 誤差。`;
    metricsCompText.style.color = '#2563eb'; // Blue
  }
}

// ------------------ OLS COEFFICIENTS EXPLANATIONS ------------------
const OLS_EXPLANATIONS = {
  'Intercept': {
    chinese: '截距項 (常數項)',
    explanation: '模型基準利潤值。代表當 R&D、行政開銷、行銷支出均為 $0，且處於基準類別（One-Hot 編碼中為 California 加州）時的預期淨利潤。本項通常在統計上極顯著，代表企業營運所需的基本常態固定成本與利潤緩衝帶。'
  },
  'R&D Spend': {
    chinese: '研發經費投入 (自變數)',
    explanation: '<strong>邊際研發效益（核心驅動引擎）</strong>。係數約為 0.80，代表<strong>每向研發多配置 $1 美元，利潤平均將顯著提升 $0.80 美元</strong>。在統計上 p-value 恆為 0.0000（強烈拒絕 $\\beta=0$ 虛無假設），證明研發是推動該數據集中新創公司盈利的最核心決定性變數。應當優先提供預算。'
  },
  'Administration': {
    chinese: '行政管理支出 (自變數)',
    explanation: '行政開銷。係數一般極小甚至為負（如 -0.026），且 p-value 遠大於 0.05（通常約 0.60），這說明<strong>行政開銷對公司利潤的邊際貢獻在統計學上「完全不顯著」</strong>。此支出更偏向公司的營運白噪音，商業決策上應严格限額控制此固定成本，而非指望透過其產生利潤回報。'
  },
  'Marketing Spend': {
    chinese: '市場推廣支出 (自變數)',
    explanation: '行銷經費。係數一般在 0.027 左右，p-value 通常在 0.10 左右（未達 95% 信賴度的 0.05 顯著標準，但具備商業相關性）。這代表每增加 $1 行銷支出能邊際帶動約 $0.03 的利潤增長，但由於廣告獲客（CAC/LTV）效率在各新創公司間波動較大（變異數高），因此在小樣本下較難達成統計顯著，是一項有偏但正向的投入。'
  },
  'State_Florida': {
    chinese: 'Florida 地區效應 (One-Hot 虛擬變數)',
    explanation: '<strong>佛羅里達州對比基準加州（California）的溢價利潤效應</strong>。代表公司設立在佛羅里達州時，相較於加州產生的利潤差值。因為 p-value > 0.05，說明佛羅里達與加州的區位效應在統計上沒有顯著差異。'
  },
  'State_New York': {
    chinese: 'New York 地區效應 (One-Hot 虛擬變數)',
    explanation: '<strong>紐約州對比基準加州（California）的溢價利潤效應</strong>。代表公司設立在紐約州時，相較於加州產生的利潤差值。因為 p-value > 0.05，說明紐約州與加州之地區利潤落差並不顯著。'
  },
  'State_BTE_mean': {
    chinese: '地理區位利潤期望值 (BTE 特徵)',
    explanation: '<strong>貝氏目標編碼後驗期望特徵</strong>。代表該地區歷史利潤在經過 Beta 先驗平滑處理後的預期強度。該變數係數大小代表了模型對「地區歷史盈利預期」的吸收程度，將其以一個單一連續維度取代 OHE 多個維度。'
  },
  'State_BTE_var': {
    chinese: '地理區位利潤不確定性 (BTE 特徵)',
    explanation: '<strong>貝氏目標編碼後驗變異數特徵</strong>。代表該地區利潤分佈的『不確定性（不穩定性度量）』對模型最終預測的風險偏置修正。若某州歷史利潤變異係數高（波動大），該方差特徵有助於迴歸模型調節此維度的預測權重，起到降低估計風險的作用。'
  }
};

function renderOlsTable(summary) {
  olsTableBody.innerHTML = '';

  summary.forEach(row => {
    const featKey = row.Feature;
    const info = OLS_EXPLANATIONS[featKey] || { chinese: featKey, explanation: '自定義特徵參數。' };

    const tr = document.createElement('tr');
    if (featKey === 'R&D Spend') {
      tr.classList.add('highlight-row');
    }

    tr.innerHTML = `
      <td><strong>${row.Feature}</strong> <br><small style="color:var(--ink-light);">${info.chinese}</small></td>
      <td class="handwritten">${row.Coefficient.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
      <td class="handwritten">${row.Std_Error ? row.Std_Error.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : 'N/A'}</td>
      <td class="handwritten">${row.t_Statistic ? row.t_Statistic.toFixed(4) : 'N/A'}</td>
      <td class="handwritten" style="font-weight: ${row.p_Value < 0.05 ? 'bold' : 'normal'}; color: ${row.p_Value < 0.05 ? '#047857' : 'inherit'};">
        ${row.p_Value ? row.p_Value.toExponential(4) : 'N/A'}
      </td>
      <td>
        <button class="explain-btn" data-feature="${featKey}" title="查看商業與統計學解釋">
          💡 <span style="font-size:0.8rem; text-decoration:underline; color:var(--primary-color);">解讀</span>
        </button>
      </td>
    `;
    olsTableBody.appendChild(tr);
  });

  // Bind click events on explanation buttons
  document.querySelectorAll('.explain-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const feat = btn.getAttribute('data-feature');
      showOlsDetail(feat);
    });
  });
}

function showOlsDetail(featureKey) {
  const info = OLS_EXPLANATIONS[featureKey];
  if (!info) return;

  olsDetailTitle.innerHTML = `💡 參數解讀：${featureKey} (${info.chinese})`;
  olsDetailContent.innerHTML = info.explanation;
  olsDetailDisplay.classList.remove('hidden');
  olsDetailDisplay.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Close OLS Explanation card
closeOlsDetail.addEventListener('click', () => {
  olsDetailDisplay.classList.add('hidden');
});

// ------------------ CANVAS CHART PLOTTINGS ------------------
function renderPlots(plotData) {
  // Sort data points by R&D spend for the line plot
  const sortedByRD = [...plotData].sort((a, b) => a.rd_spend - b.rd_spend);

  // 1. Plot R&D Spend vs Profit
  plotRDvsProfit(sortedByRD);

  // 2. Plot Predicted vs Actual Profit
  plotActualvsPredicted(plotData);
}

function drawWhiteboardGrid(ctx, width, height) {
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.05)';
  ctx.lineWidth = 1;
  // Vertical lines
  for (let x = 20; x < width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  // Horizontal lines
  for (let y = 20; y < height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw sketchy outer border
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  // slightly offset border for sketchy look
  ctx.moveTo(2, 2);
  ctx.lineTo(width - 3, 4);
  ctx.lineTo(width - 2, height - 3);
  ctx.lineTo(3, height - 2);
  ctx.closePath();
  ctx.stroke();
}

function plotRDvsProfit(data) {
  const canvas = document.getElementById('rd-profit-plot');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  drawWhiteboardGrid(ctx, w, h);

  // Margins
  const mLeft = 50;
  const mRight = 20;
  const mTop = 30;
  const mBottom = 40;

  // Min Max values
  const minRD = 0;
  const maxRD = 180000;
  const minProfit = 0;
  const maxProfit = 210000;

  // Helper to map values to coordinates
  const mapX = (rd) => mLeft + ((rd - minRD) / (maxRD - minRD)) * (w - mLeft - mRight);
  const mapY = (profit) => h - mBottom - ((profit - minProfit) / (maxProfit - minProfit)) * (h - mTop - mBottom);

  // Draw Axes
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  // Y Axis
  ctx.moveTo(mLeft, mTop - 10);
  ctx.lineTo(mLeft, h - mBottom);
  // X Axis
  ctx.lineTo(w - mRight + 10, h - mBottom);
  ctx.stroke();

  // Y Axis Tick Marks & Labels
  ctx.font = '8px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  [50000, 100000, 150000, 200000].forEach(val => {
    const yCoord = mapY(val);
    ctx.beginPath();
    ctx.moveTo(mLeft - 4, yCoord);
    ctx.lineTo(mLeft, yCoord);
    ctx.stroke();
    ctx.fillText('$' + (val / 1000) + 'k', mLeft - 8, yCoord);
  });

  // X Axis Tick Marks & Labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  [50000, 100000, 150000].forEach(val => {
    const xCoord = mapX(val);
    ctx.beginPath();
    ctx.moveTo(xCoord, h - mBottom);
    ctx.lineTo(xCoord, h - mBottom + 4);
    ctx.stroke();
    ctx.fillText('$' + (val / 1000) + 'k', xCoord, h - mBottom + 8);
  });

  // Axis titles
  ctx.font = '10px Architects Daughter';
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';
  ctx.fillText('R&D Spend (研發支出)', w / 2 + 15, h - mBottom + 22);

  ctx.save();
  ctx.translate(15, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Profit (淨利潤)', 0, 0);
  ctx.restore();

  // 1. Draw actual profit scatter points (as hand-drawn circle marks)
  data.forEach(pt => {
    const cx = mapX(pt.rd_spend);
    const cy = mapY(pt.profit);

    ctx.strokeStyle = '#2563eb'; // blue ink
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // draw a sketchy small circle (not a perfect arc)
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 2. Draw predicted values fit line
  ctx.strokeStyle = '#dc2626'; // red sketchy line
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  data.forEach((pt, idx) => {
    const cx = mapX(pt.rd_spend);
    const cy = mapY(pt.predicted);
    if (idx === 0) {
      ctx.moveTo(cx, cy);
    } else {
      ctx.lineTo(cx, cy);
    }
  });
  ctx.stroke();

  // Draw Legend box
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.fillRect(w - 110, mTop, 85, 30);
  ctx.strokeRect(w - 110, mTop, 85, 30);

  ctx.font = '8px sans-serif';
  ctx.fillStyle = '#2563eb';
  ctx.fillText('○ 實際 Profit', w - 70, mTop + 10);
  ctx.fillStyle = '#dc2626';
  ctx.fillText('― 迴歸擬合線', w - 70, mTop + 22);
}

function plotActualvsPredicted(data) {
  const canvas = document.getElementById('pred-actual-plot');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  drawWhiteboardGrid(ctx, w, h);

  // Margins
  const mLeft = 55;
  const mRight = 20;
  const mTop = 30;
  const mBottom = 40;

  // Min Max values
  const minVal = 0;
  const maxVal = 210000;

  // Helper to map values to coordinates
  const mapX = (val) => mLeft + ((val - minVal) / (maxVal - minVal)) * (w - mLeft - mRight);
  const mapY = (val) => h - mBottom - ((val - minVal) / (maxVal - minVal)) * (h - mTop - mBottom);

  // Draw Axes
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  // Y Axis
  ctx.moveTo(mLeft, mTop - 10);
  ctx.lineTo(mLeft, h - mBottom);
  // X Axis
  ctx.lineTo(w - mRight + 10, h - mBottom);
  ctx.stroke();

  // Y Axis Tick Marks & Labels
  ctx.font = '8px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  [50000, 100000, 150000, 200000].forEach(val => {
    const yCoord = mapY(val);
    ctx.beginPath();
    ctx.moveTo(mLeft - 4, yCoord);
    ctx.lineTo(mLeft, yCoord);
    ctx.stroke();
    ctx.fillText('$' + (val / 1000) + 'k', mLeft - 8, yCoord);
  });

  // X Axis Tick Marks & Labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  [50000, 100000, 150000, 200000].forEach(val => {
    const xCoord = mapX(val);
    ctx.beginPath();
    ctx.moveTo(xCoord, h - mBottom);
    ctx.lineTo(xCoord, h - mBottom + 4);
    ctx.stroke();
    ctx.fillText('$' + (val / 1000) + 'k', xCoord, h - mBottom + 8);
  });

  // Axis titles
  ctx.font = '10px Architects Daughter';
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';
  ctx.fillText('Predicted Profit (預估利潤)', w / 2 + 15, h - mBottom + 22);

  ctx.save();
  ctx.translate(15, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Actual Profit (實際利潤)', 0, 0);
  ctx.restore();

  // Draw 45-degree y = x line (ideal prediction line)
  ctx.strokeStyle = '#94a3b8'; // grey dashed line
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(mapX(25000), mapY(25000));
  ctx.lineTo(mapX(195000), mapY(195000));
  ctx.stroke();
  ctx.setLineDash([]); // Reset line dash

  // Scatter points
  data.forEach(pt => {
    const cx = mapX(pt.predicted);
    const cy = mapY(pt.profit);

    ctx.strokeStyle = '#16a34a'; // green ink dots
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Legend
  ctx.font = '8px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText('--- y = x (理想線)', mLeft + 15, mTop + 10);
}

// ------------------ PPT SLIDES SYSTEM ------------------
function initPPT() {
  const slides = document.querySelectorAll('.presentation-slide');

  // Render dot indicators dynamically
  slideIndicators.innerHTML = '';
  for (let i = 1; i <= totalSlides; i++) {
    const dot = document.createElement('div');
    dot.className = `dot ${i === 1 ? 'active' : ''}`;
    dot.setAttribute('data-target-slide', i);
    dot.addEventListener('click', () => {
      goToSlide(i);
    });
    slideIndicators.appendChild(dot);
  }

  // Prev / Next Buttons
  prevSlideBtn.addEventListener('click', () => {
    goToSlide(currentSlide - 1);
  });
  nextSlideBtn.addEventListener('click', () => {
    goToSlide(currentSlide + 1);
  });

  // Keypress event for slides (when PPT tab is active)
  document.addEventListener('keydown', (e) => {
    const pptTabActive = document.getElementById('ppt-tab').classList.contains('active');
    if (!pptTabActive) return;

    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      goToSlide(currentSlide + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToSlide(currentSlide - 1);
    }
  });

  // Fullscreen toggle
  fullscreenPptBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      slideDeckContainer.requestFullscreen().catch(err => {
        alert(`無法進入全螢幕模式: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });
}

function goToSlide(slideNum) {
  if (slideNum < 1) slideNum = totalSlides; // loop back to end
  if (slideNum > totalSlides) slideNum = 1; // loop back to start

  currentSlide = slideNum;

  // Update slides visibility
  const slides = document.querySelectorAll('.presentation-slide');
  slides.forEach(slide => {
    slide.classList.remove('active');
    if (parseInt(slide.getAttribute('data-slide')) === currentSlide) {
      slide.classList.add('active');
    }
  });

  // Update active dot indicators
  const dots = document.querySelectorAll('.dot');
  dots.forEach((dot, idx) => {
    dot.classList.remove('active');
    if (idx + 1 === currentSlide) {
      dot.classList.add('active');
    }
  });
}

// ------------------ WHITEPAPER DOCUMENT READER ------------------
function renderMarkdownWhitepaper(markdownText) {
  if (typeof marked !== 'undefined') {
    // Customize marked header renderer to add anchors automatically
    const renderer = new marked.Renderer();
    const headingList = [];

    renderer.heading = function (data) {
      let text = typeof data === 'string' ? data : (data.text || '');
      let level = typeof data === 'string' ? arguments[1] : (data.depth || 1);
      // Create an ID clean of special symbols for scroll links
      const cleanText = text.replace(/<[^>]*>/g, '').trim();
      const id = 'section-' + cleanText.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-');

      headingList.push({ text: cleanText, level: level, id: id });

      return `<h${level} id="${id}">${text}</h${level}>`;
    };

    // Parse markdown to HTML
    const htmlContent = marked.parse(markdownText, { renderer: renderer });
    whitepaperContentArea.innerHTML = htmlContent;

    // Populate Table of Contents in sidebar
    populateToc(headingList);

    // Setup scroll active highlighting
    setupTocScrollSpy();
  } else {
    whitepaperContentArea.innerHTML = `<p style="color:red;">Marked.js 載入失敗，無法解析 Markdown 白皮書。</p>`;
  }
}

async function initWhitepaper() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/whitepaper`);
    if (!response.ok) throw new Error('Could not fetch whitepaper content');

    const data = await response.json();
    const markdownText = data.content;
    renderMarkdownWhitepaper(markdownText);
  } catch (error) {
    console.warn('Backend whitepaper API failed, trying to load static markdown file fallback...', error);
    try {
      const fallbackResponse = await fetch('whitepaper/technical_whitepaper.md');
      if (!fallbackResponse.ok) throw new Error('Could not fetch static whitepaper file fallback');
      const markdownText = await fallbackResponse.text();
      renderMarkdownWhitepaper(markdownText);
    } catch (fallbackError) {
      console.error('Both backend and static fallback failed:', fallbackError);
      whitepaperContentArea.innerHTML = `
        <div class="text-center" style="padding: 2rem;">
          <h4 style="color:#b91c1c;">📚 技術白皮書載入失敗</h4>
          <p style="margin-top:0.5rem;">無法取得後端 API 且無法載入靜態 Markdown 備份檔，請確認後端服務是否已啟動。</p>
        </div>
      `;
    }
  }

  // Workaround for workspace printing: triggers normal browser print dialog
  printWorkspaceBtn.addEventListener('click', () => {
    window.print();
  });
}

function populateToc(headings) {
  whitepaperToc.innerHTML = '';

  // We filter headings to level 1, 2 and 3 for a cleaner TOC
  const filteredHeadings = headings.filter(h => h.level <= 3);

  filteredHeadings.forEach(h => {
    const li = document.createElement('li');
    li.className = `toc-item toc-h${h.level}`;

    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = h.text;

    // Smooth scrolling event binding
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const targetElement = document.getElementById(h.id);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Highlight active link immediately
        document.querySelectorAll('#whitepaper-toc a').forEach(el => el.classList.remove('active'));
        a.classList.add('active');
      }
    });

    li.appendChild(a);
    whitepaperToc.appendChild(li);
  });
}

function setupTocScrollSpy() {
  const headings = Array.from(whitepaperContentArea.querySelectorAll('h1, h2, h3'));

  // Update TOC active state on scroll in whitepaper content block
  whitepaperContentArea.addEventListener('scroll', () => {
    let currentActiveId = '';
    const scrollContainerTop = whitepaperContentArea.getBoundingClientRect().top;

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const hTop = heading.getBoundingClientRect().top;

      // If the heading is scrolled close to the top of the viewing area
      if (hTop - scrollContainerTop < 100) {
        currentActiveId = heading.id;
      } else {
        break;
      }
    }

    if (currentActiveId) {
      document.querySelectorAll('#whitepaper-toc a').forEach(a => {
        if (a.getAttribute('href') === `#${currentActiveId}`) {
          a.classList.add('active');
        } else {
          a.classList.remove('active');
        }
      });
    }
  });
}

// Inter-tab transition helper to trigger layout refresh if iframe is loaded
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');
    if (targetTab === 'infographic-tab') {
      const iframe = document.querySelector('#infographic-tab iframe');
      if (iframe) {
        iframe.src = iframe.src; // Force reload iframe content to ensure sizing and canvas redraw
      }
    }
  });
});

// ------------------ INTERACTIVE VOICE VIDEO TOUR PLAYER ------------------
let currentVideoScene = 0;
let videoElapsedTime = 0;
let isVideoPlaying = false;
let videoInterval = null;
let speechUtterance = null;
const totalVideoDuration = 115000; // 115s total

const videoScenes = [
  {
    tag: "CRISP-DM Phase 1",
    title: "50 Startups 利潤預測與分析",
    content: "<p style='font-size:1.15rem; line-height:1.6;'>量化三大支出與設立地區，構建多元線性迴歸白盒預估模型</p><p style='font-size:1.4rem; color:var(--primary-color); font-weight:bold; margin-top:1.5rem; font-family:var(--handwritten);'>量化預算邊際回報率，輔助 VC 科學化決策</p>",
    narration: "哈囉大家好！早期創投在評估新創公司時，常面臨財務數據稀疏、預算效益模糊的痛點。本專案透過建立白盒化的多元線性迴歸模型，實踐量化研發、行政與行銷投入的邊際利潤貢獻，輔助科學化投資決策！",
    duration: 1500
  },
  {
    tag: "CRISP-DM Phase 2",
    title: "數據探索與相關性分析",
    content: "<div style='text-align:left; display:inline-block; font-size:1.2rem; line-height:2.0; font-family:var(--handwritten);'>" +
      "📈 <span style='color:var(--primary-color); font-weight:bold;'>R&D Spend ↔ Profit</span> (r = 0.9729, 極強正相關)<br>" +
      "📢 <span style='color:var(--success-color); font-weight:bold;'>Marketing Spend ↔ Profit</span> (r = 0.7478, 中度相關)<br>" +
      "🏢 <span style='color:var(--ink-light);'>Administration ↔ Profit</span> (r = 0.2007, 無顯著關聯)" +
      "</div>",
    narration: "我們首先分析 50 家新創數據，從 Pearson 相關係數發現，研發支出與利潤的相關性高達 0.97，是獲利的最強引擎！而市場行銷中度相關，行政管理開銷則幾乎無顯著關聯，僅能列為固定成本控管。",
    duration: 20000
  },
  {
    tag: "CRISP-DM Phase 3",
    title: "特徵工程：OHE vs BTE 對決",
    content: "<div style='text-align:left; font-size:1rem; line-height:1.6; max-width:600px; margin:0 auto;'>" +
      "▪ <b>OHE (單熱編碼)</b>: 虛擬變數陷阱 (CA, FL, NY) &rarr; 丟棄首欄避免共線性: <span style='font-family:var(--handwritten); color:red; font-weight:bold;'>v_CA + v_FL + v_NY = 1</span><br>" +
      "▪ <b>BTE (貝氏目標編碼)</b>: 估算後驗均值與不確定方差。在低基數下屬於<b>數學冗餘</b>，但為高基數特徵提供了防過擬合與壓縮的 <b>PoC 概念驗證</b>。" +
      "</div>",
    narration: "面對州別類別，若用單熱編碼會面臨虛擬變數陷阱，造成矩陣不可逆，我們必須丟棄首欄基準。同時，我們也首創將貝氏目標編碼推廣到連續迴歸中。雖然在此 3 個州別上屬於過度設計，但這套 BTE 均值與方差特徵的壓縮方法，是高基數工業級特徵防過擬合的重要 PoC 驗證喔！",
    duration: 30000
  },
  {
    tag: "CRISP-DM Phase 4 & 5",
    title: "OLS 求解與假設檢定結果",
    content: "<div style='text-align:left; display:inline-block; font-size:1.1rem; line-height:1.8;'>" +
      "📐 OLS 解析閉式解: <span style='font-family:var(--handwritten); color:var(--primary-color); font-weight:bold;'>&beta; = (X<sup>T</sup>X)<sup>-1</sup>X<sup>T</sup>y</span><br>" +
      "✔ VIF 共線性指標 &lt; 5 | 殘差符合常態分佈<br>" +
      "🏆 BTE (m=2.0) 測試集 MAE: <b style='color:var(--success-color);'>$6,552.12</b> (優於 OHE 模型)" +
      "</div>",
    narration: "本專案採用最小平方法矩陣解析解直接求解，保證模型是最佳線性無偏估計。我們嚴緊檢定高斯-馬可夫五大假設。實驗顯示：當平滑係數 m 設定為 2.0 時，BTE 模型的測試集 R-square 達到了 0.948，MAE 誤差相比單熱編碼降低了將近 200 美元！",
    duration: 30000
  },
  {
    tag: "CRISP-DM Phase 6",
    title: "部署與白盒決策展望",
    content: "<p style='font-size:1.2rem;'>FastAPI 後端 + Vanilla JS 前端 (前後端分離)</p><p style='font-size:1.4rem; color:var(--success-color); margin-top:1rem; font-family:var(--handwritten); font-weight:bold;'>100% 移除了 Streamlit 雜訊，提供 95% 信賴預測區間安全決策帶</p>",
    narration: "最後，我們以 FastAPI 搭配手繪風 Vanilla JS 打造前後端分離系統，移除 Streamlit 的雜音，並即時提供 95% 信賴預測區間。歡迎點擊 GitHub 連結，一起開啟這趟白盒機器學習的獲利分析之旅吧！",
    duration: 20000
  }
];

const videoModal = document.getElementById('video-tour-modal');
const playVideoBtn = document.getElementById('play-video-tour-btn');
const closeVideoBtn = document.getElementById('close-video-tour');
const playerPlayBtn = document.getElementById('player-play-btn');
const progressFill = document.getElementById('player-progress-fill');
const timeDisplay = document.getElementById('player-time-display');
const subtitlesText = document.getElementById('player-subtitles-text');

const videoSlideTag = document.getElementById('video-slide-tag');
const videoSlideTitle = document.getElementById('video-slide-title');
const videoSlideContent = document.getElementById('video-slide-content');
const progressBar = document.getElementById('player-progress-bar');

// Initialize video events
if (playVideoBtn) {
  playVideoBtn.addEventListener('click', openVideoTour);
}
if (closeVideoBtn) {
  closeVideoBtn.addEventListener('click', closeVideoTour);
}
if (playerPlayBtn) {
  playerPlayBtn.addEventListener('click', toggleVideoPlay);
}
if (progressBar) {
  progressBar.addEventListener('click', seekVideo);
}

function openVideoTour() {
  videoModal.classList.remove('hidden');
  resetVideoState();
  loadScene(0);
}

function closeVideoTour() {
  videoModal.classList.add('hidden');
  pauseVideo();
  window.speechSynthesis.cancel();
}

function resetVideoState() {
  currentVideoScene = 0;
  videoElapsedTime = 0;
  isVideoPlaying = false;
  playerPlayBtn.textContent = 'Play';
  playerPlayBtn.style.backgroundColor = 'var(--highlight-green)';
  progressFill.style.width = '0%';
  updateTimeDisplay();
  subtitlesText.textContent = '點擊下方播放鈕開始導覽影片之旅...';

  if (videoInterval) {
    clearInterval(videoInterval);
    videoInterval = null;
  }
}

function toggleVideoPlay() {
  if (isVideoPlaying) {
    pauseVideo();
  } else {
    playVideo();
  }
}

function playVideo() {
  isVideoPlaying = true;
  playerPlayBtn.textContent = 'Pause';
  playerPlayBtn.style.backgroundColor = 'var(--highlight-yellow)';

  // Start or resume TTS
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  } else {
    speakScene(currentVideoScene);
  }

  // Timer for progress bar & scene switching
  const startTime = Date.now() - videoElapsedTime;
  videoInterval = setInterval(() => {
    videoElapsedTime = Date.now() - startTime;
    if (videoElapsedTime >= totalVideoDuration) {
      videoElapsedTime = totalVideoDuration;
      pauseVideo();
      subtitlesText.textContent = '導覽影片播放完畢，感謝收看！';
      return;
    }

    // Check if we need to switch scene
    let cumulativeTime = 0;
    let sceneIndex = 0;
    for (let i = 0; i < videoScenes.length; i++) {
      cumulativeTime += videoScenes[i].duration;
      if (videoElapsedTime < cumulativeTime) {
        sceneIndex = i;
        break;
      }
    }

    if (sceneIndex !== currentVideoScene) {
      currentVideoScene = sceneIndex;
      loadScene(currentVideoScene);
      speakScene(currentVideoScene);
    }

    // Update progress bar
    const pct = (videoElapsedTime / totalVideoDuration) * 100;
    progressFill.style.width = `${pct}%`;
    updateTimeDisplay();
  }, 100);
}

function pauseVideo() {
  isVideoPlaying = false;
  playerPlayBtn.textContent = 'Play';
  playerPlayBtn.style.backgroundColor = 'var(--highlight-green)';
  if (videoInterval) {
    clearInterval(videoInterval);
    videoInterval = null;
  }
  window.speechSynthesis.pause();
}

function seekVideo(e) {
  const rect = progressBar.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const width = rect.width;
  const pct = clickX / width;

  videoElapsedTime = pct * totalVideoDuration;
  progressFill.style.width = `${pct * 100}%`;
  updateTimeDisplay();

  // Find matching scene
  let cumulativeTime = 0;
  let sceneIndex = 0;
  for (let i = 0; i < videoScenes.length; i++) {
    cumulativeTime += videoScenes[i].duration;
    if (videoElapsedTime < cumulativeTime) {
      sceneIndex = i;
      break;
    }
  }

  currentVideoScene = sceneIndex;
  loadScene(currentVideoScene);

  if (isVideoPlaying) {
    window.speechSynthesis.cancel();
    speakScene(currentVideoScene);
  }
}

function loadScene(index) {
  const scene = videoScenes[index];

  // Element separation transitions
  videoSlideTag.style.opacity = '0';
  videoSlideTag.style.transform = 'translateY(-20px)';
  videoSlideTitle.style.opacity = '0';
  videoSlideTitle.style.transform = 'scale(0.9)';
  videoSlideContent.style.opacity = '0';
  videoSlideContent.style.transform = 'translateY(20px)';

  // Force layout reflow
  void videoSlideTag.offsetWidth;

  // Set content
  videoSlideTag.textContent = scene.tag;
  videoSlideTitle.textContent = scene.title;
  videoSlideContent.innerHTML = scene.content;
  subtitlesText.textContent = scene.narration;

  // Apply staggered segmentation animations
  setTimeout(() => {
    videoSlideTag.style.opacity = '1';
    videoSlideTag.style.transform = 'translateY(0)';
  }, 100);

  setTimeout(() => {
    videoSlideTitle.style.opacity = '1';
    videoSlideTitle.style.transform = 'scale(1)';
  }, 500);

  setTimeout(() => {
    videoSlideContent.style.opacity = '1';
    videoSlideContent.style.transform = 'translateY(0)';
  }, 900);
}

function speakScene(index) {
  window.speechSynthesis.cancel(); // cancel any active speech

  const scene = videoScenes[index];
  speechUtterance = new SpeechSynthesisUtterance(scene.narration);

  // Find appropriate Chinese female voice
  const voices = window.speechSynthesis.getVoices();
  let selectedVoice = null;

  // Try to find a Traditional Chinese or generic Chinese female voice
  for (let i = 0; i < voices.length; i++) {
    const v = voices[i];
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase();

    if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk') || lang.startsWith('zh-cn') || lang.startsWith('zh_')) {
      // Prefer female names/markers in typical OS voices
      if (name.includes('hanhan') || name.includes('yating') || name.includes('xiaoyu') || name.includes('google 國語') || name.includes('female') || name.includes('szu-chuan')) {
        selectedVoice = v;
        break;
      }
      if (!selectedVoice) {
        selectedVoice = v; // fallback to any Chinese voice
      }
    }
  }

  if (selectedVoice) {
    speechUtterance.voice = selectedVoice;
  }

  // Settings for upbeat female narration
  speechUtterance.rate = 1.15; // slightly faster for upbeat tempo
  speechUtterance.pitch = 1.1; // slightly higher pitch for female feel

  window.speechSynthesis.speak(speechUtterance);
}

function updateTimeDisplay() {
  const currentSec = Math.floor(videoElapsedTime / 1000);
  const totalSec = Math.floor(totalVideoDuration / 1000);

  const curMinStr = String(Math.floor(currentSec / 60)).padStart(2, '0');
  const curSecStr = String(currentSec % 60).padStart(2, '0');

  const totMinStr = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const totSecStr = String(totalSec % 60).padStart(2, '0');

  timeDisplay.textContent = `${curMinStr}:${curSecStr} / ${totMinStr}:${totSecStr}`;
}

// Pre-load voices for speech synthesis (essential for some browsers)
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
}
