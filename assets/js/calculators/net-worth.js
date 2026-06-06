/**
 * CompoundPro - Net Worth Calculator Engine & UI Controller
 * Theme: Compound Interest (shared CSS, calc-inputs, calc-results)
 * Unique: Asset mix doughnut + Assets vs Debts bar + detail table
 */

const NetWorthCalc = {
  // ============== ASSET CATEGORIES ==============
  // liquidAssets: cash + savings + investments
  ASSET_FIELDS: [
    { id: 'cash', label: 'Cash & Checking', isLiquid: true, color: 'rgba(14, 165, 233, 0.9)' },
    { id: 'savings', label: 'Savings & HYSA', isLiquid: true, color: 'rgba(56, 189, 248, 0.9)' },
    { id: 'investments', label: 'Investments', isLiquid: true, color: 'rgba(99, 102, 241, 0.9)' },
    { id: 'retirement', label: 'Retirement', isLiquid: false, color: 'rgba(124, 58, 237, 0.9)' },
    { id: 'realEstate', label: 'Real Estate', isLiquid: false, color: 'rgba(16, 185, 129, 0.9)' },
    { id: 'vehicles', label: 'Vehicles', isLiquid: false, color: 'rgba(245, 158, 11, 0.9)' },
    { id: 'otherAssets', label: 'Other Assets', isLiquid: false, color: 'rgba(107, 114, 128, 0.9)' }
  ],
  LIABILITY_FIELDS: [
    { id: 'mortgage', label: 'Mortgage', color: 'rgba(225, 29, 72, 0.9)' },
    { id: 'studentLoans', label: 'Student Loans', color: 'rgba(244, 63, 94, 0.85)' },
    { id: 'creditCards', label: 'Credit Cards', color: 'rgba(220, 38, 38, 0.85)' },
    { id: 'autoLoans', label: 'Auto Loans', color: 'rgba(190, 18, 60, 0.85)' },
    { id: 'otherDebts', label: 'Other Debts', color: 'rgba(159, 18, 57, 0.85)' }
  ],

  // ============== CORE CALCULATION ==============
  calculate(input) {
    const totalAssets = this.ASSET_FIELDS.reduce((sum, f) => sum + Math.max(0, input[f.id] || 0), 0);
    const totalLiabilities = this.LIABILITY_FIELDS.reduce((sum, f) => sum + Math.max(0, input[f.id] || 0), 0);
    const netWorth = totalAssets - totalLiabilities;
    const liquidAssets = this.ASSET_FIELDS.filter(f => f.isLiquid).reduce((sum, f) => sum + Math.max(0, input[f.id] || 0), 0);
    const illiquidAssets = totalAssets - liquidAssets;
    const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
    const liquidRatio = totalAssets > 0 ? (liquidAssets / totalAssets) * 100 : 0;
    const equityRatio = totalAssets > 0 ? (netWorth / totalAssets) * 100 : 0;

    // Health score: weighted composite (0-100)
    let healthScore = 50; // baseline
    if (debtRatio < 20) healthScore += 25;
    else if (debtRatio < 40) healthScore += 15;
    else if (debtRatio < 60) healthScore += 5;
    else if (debtRatio >= 80) healthScore -= 20;
    if (liquidRatio >= 30) healthScore += 10;
    else if (liquidRatio >= 15) healthScore += 5;
    else if (liquidRatio < 5 && totalAssets > 0) healthScore -= 10;
    if (netWorth > 0) healthScore += 15;
    else if (netWorth < 0) healthScore -= 15;
    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      totalAssets, totalLiabilities, netWorth,
      liquidAssets, illiquidAssets,
      debtRatio, liquidRatio, equityRatio,
      healthScore
    };
  },

  formatCurrency(value) {
    if (window.CompoundPro?.formatCurrency) return window.CompoundPro.formatCurrency(value);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  },

  // ============== STATE ENCODE/DECODE ==============
  encodeState(input) {
    const p = new URLSearchParams();
    [...this.ASSET_FIELDS, ...this.LIABILITY_FIELDS].forEach(f => {
      p.set(f.id, input[f.id] || 0);
    });
    return p.toString();
  },
  decodeState(hash) {
    const p = new URLSearchParams(hash);
    const out = {};
    [...this.ASSET_FIELDS, ...this.LIABILITY_FIELDS].forEach(f => {
      const v = parseFloat(p.get(f.id));
      out[f.id] = isNaN(v) ? 0 : v;
    });
    return out;
  }
};


const ChartManager = {
  assetMixChart: null,
  balanceBarChart: null,

  // Asset mix doughnut - shows % breakdown of total assets
  renderAssetMix(canvasId, input) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (this.assetMixChart) this.assetMixChart.destroy();

    const segments = NetWorthCalc.ASSET_FIELDS
      .map(f => ({ ...f, value: Math.max(0, input[f.id] || 0) }))
      .filter(s => s.value > 0);

    this.assetMixChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: segments.map(s => s.label),
        datasets: [{
          data: segments.map(s => s.value),
          backgroundColor: segments.map(s => s.color),
          borderColor: '#fff',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: {
            position: 'right',
            labels: { font: { family: 'DM Sans', size: 12 }, usePointStyle: true, padding: 12 }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: 'DM Sans', size: 13, weight: '600' },
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return ctx.label + ': ' + NetWorthCalc.formatCurrency(ctx.parsed) + ' (' + pct + '%)';
              }
            }
          }
        }
      }
    });
  },

  // Assets vs Liabilities vs Net Worth bar chart
  renderBalanceBar(canvasId, r) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (this.balanceBarChart) this.balanceBarChart.destroy();

    // Horizontal bar chart with three bars
    this.balanceBarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Total Assets', 'Total Liabilities', 'Net Worth'],
        datasets: [{
          label: 'Amount',
          data: [r.totalAssets, r.totalLiabilities, Math.max(0, r.netWorth)],
          backgroundColor: [
            'rgba(16, 185, 129, 0.85)',  // emerald
            'rgba(225, 29, 72, 0.85)',   // rose
            r.netWorth >= 0 ? 'rgba(249, 115, 22, 0.95)' : 'rgba(225, 29, 72, 0.95)'  // orange or rose
          ],
          borderColor: [
            'rgba(16, 185, 129, 1)',
            'rgba(225, 29, 72, 1)',
            r.netWorth >= 0 ? 'rgba(249, 115, 22, 1)' : 'rgba(225, 29, 72, 1)'
          ],
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: 'DM Sans', size: 13, weight: '600' },
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => NetWorthCalc.formatCurrency(ctx.parsed.x)
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            ticks: {
              font: { family: 'JetBrains Mono', size: 11 },
              callback: (v) => NetWorthCalc.formatCurrency(v)
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { family: 'DM Sans', size: 13, weight: '500' }
            }
          }
        }
      }
    });
  }
};


// ============== UI CONTROLLER ==============
const UIController = {
  elements: {},
  currentResult: null,
  currentInputs: null,

  init() {
    // Cache all asset/liability inputs + result elements
    this.elements = {
      assetInputs: {},
      liabilityInputs: {},
      netWorthValue: document.getElementById('netWorthValue'),
      netWorthStatus: document.getElementById('netWorthStatus'),
      totalAssetsValue: document.getElementById('totalAssetsValue'),
      totalLiabilitiesValue: document.getElementById('totalLiabilitiesValue'),
      liquidAssetsValue: document.getElementById('liquidAssetsValue'),
      debtRatioValue: document.getElementById('debtRatioValue'),
      debtRatioStatus: document.getElementById('debtRatioStatus'),
      liquidRatioValue: document.getElementById('liquidRatioValue'),
      illiquidAssetsValue: document.getElementById('illiquidAssetsValue'),
      equityRatioValue: document.getElementById('equityRatioValue'),
      healthScoreValue: document.getElementById('healthScoreValue'),
      resultsPlaceholder: document.getElementById('resultsPlaceholder'),
      resultsPanel: document.getElementById('resultsPanel'),
      detailTableBody: document.getElementById('detailTableBody'),
      calcInsightBox: document.getElementById('calcInsightBox'),
      calculateBtn: document.getElementById('calculateBtn'),
      resetBtn: document.getElementById('resetBtn'),
      shareBtn: document.getElementById('shareBtn'),
      tabs: document.querySelectorAll('.calc-tab'),
      tabContents: document.querySelectorAll('.calc-tab-content')
    };

    // Cache field references
    NetWorthCalc.ASSET_FIELDS.forEach(f => { this.elements.assetInputs[f.id] = document.getElementById(f.id); });
    NetWorthCalc.LIABILITY_FIELDS.forEach(f => { this.elements.liabilityInputs[f.id] = document.getElementById(f.id); });

    // Load state: hash > localStorage > defaults
    const hashState = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    if (hashState) {
      const decoded = NetWorthCalc.decodeState(hashState);
      [...NetWorthCalc.ASSET_FIELDS, ...NetWorthCalc.LIABILITY_FIELDS].forEach(f => {
        const el = document.getElementById(f.id);
        if (el) el.value = decoded[f.id];
      });
    } else if (window.CompoundPro?.loadCalcInputs) {
      const defaults = {};
      NetWorthCalc.ASSET_FIELDS.forEach(f => defaults[f.id] = f.id === 'cash' ? 5000 : f.id === 'savings' ? 15000 : f.id === 'investments' ? 45000 : f.id === 'retirement' ? 80000 : f.id === 'realEstate' ? 350000 : f.id === 'vehicles' ? 15000 : f.id === 'otherAssets' ? 5000 : 0);
      NetWorthCalc.LIABILITY_FIELDS.forEach(f => defaults[f.id] = f.id === 'mortgage' ? 240000 : f.id === 'studentLoans' ? 12000 : f.id === 'creditCards' ? 2500 : f.id === 'autoLoans' ? 8000 : 0);
      window.CompoundPro.loadCalcInputs('net-worth', defaults, (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      });
    }

    this.bindEvents();
    this.calculate();
  },

  bindEvents() {
    if (this.elements.calculateBtn) this.elements.calculateBtn.addEventListener('click', () => this.calculate());
    if (this.elements.resetBtn) this.elements.resetBtn.addEventListener('click', () => this.reset());
    if (this.elements.shareBtn) this.elements.shareBtn.addEventListener('click', () => this.share());
    // Tabs
    this.elements.tabs.forEach(tab => tab.addEventListener('click', () => this.switchTab(tab)));
    // All numeric inputs auto-calculate
    [...NetWorthCalc.ASSET_FIELDS, ...NetWorthCalc.LIABILITY_FIELDS].forEach(f => {
      const el = document.getElementById(f.id);
      if (el) el.addEventListener('input', () => this.calculate());
    });
  },

  getInputs() {
    const out = {};
    NetWorthCalc.ASSET_FIELDS.forEach(f => { out[f.id] = parseFloat(this.elements.assetInputs[f.id]?.value) || 0; });
    NetWorthCalc.LIABILITY_FIELDS.forEach(f => { out[f.id] = parseFloat(this.elements.liabilityInputs[f.id]?.value) || 0; });
    return out;
  },

  calculate() {
    try {
      const inputs = this.getInputs();
      const result = NetWorthCalc.calculate(inputs);
      this.currentResult = result;
      this.currentInputs = inputs;
      if (window.CompoundPro?.saveCalcInputs) window.CompoundPro.saveCalcInputs('net-worth', inputs);
      this.renderResult(result, inputs);
    } catch (err) {
      console.error('Net worth calculation error:', err);
      if (window.CompoundPro?.showToast) window.CompoundPro.showToast('Calculation error: ' + err.message, 'error');
    }
  },

  renderResult(r, input) {
    if (this.elements.resultsPlaceholder) this.elements.resultsPlaceholder.style.display = 'none';
    if (this.elements.resultsPanel) this.elements.resultsPanel.style.display = 'flex';

    // Primary
    this.animateValue(this.elements.netWorthValue, r.netWorth, true);
    if (this.elements.netWorthStatus) {
      if (r.netWorth >= 0) {
        this.elements.netWorthStatus.textContent = r.healthScore >= 70 ? 'Strong Position' : r.healthScore >= 50 ? 'Healthy' : 'Building';
        this.elements.netWorthStatus.style.color = 'var(--color-emerald-2)';
      } else {
        this.elements.netWorthStatus.textContent = '⚠️ Negative — Action Needed';
        this.elements.netWorthStatus.style.color = 'var(--color-rose)';
      }
    }
    // Cards
    this.animateValue(this.elements.totalAssetsValue, r.totalAssets, true);
    this.animateValue(this.elements.totalLiabilitiesValue, r.totalLiabilities, true);
    this.animateValue(this.elements.liquidAssetsValue, r.liquidAssets, true);
    if (this.elements.debtRatioValue) this.elements.debtRatioValue.textContent = r.debtRatio.toFixed(1) + '%';
    if (this.elements.debtRatioStatus) {
      if (r.debtRatio < 30) { this.elements.debtRatioStatus.textContent = 'Excellent — minimal debt'; this.elements.debtRatioStatus.style.color = 'var(--color-emerald-2)'; }
      else if (r.debtRatio < 50) { this.elements.debtRatioStatus.textContent = 'Healthy — manageable'; this.elements.debtRatioStatus.style.color = 'var(--color-sea-2)'; }
      else if (r.debtRatio < 75) { this.elements.debtRatioStatus.textContent = 'High — consider paying down'; this.elements.debtRatioStatus.style.color = 'var(--color-amber)'; }
      else { this.elements.debtRatioStatus.textContent = 'Critical — debt relief advised'; this.elements.debtRatioStatus.style.color = 'var(--color-rose)'; }
    }
    // Health bar
    if (this.elements.liquidRatioValue) this.elements.liquidRatioValue.textContent = r.liquidRatio.toFixed(1) + '%';
    this.animateValue(this.elements.illiquidAssetsValue, r.illiquidAssets, true);
    if (this.elements.equityRatioValue) this.elements.equityRatioValue.textContent = r.equityRatio.toFixed(1) + '%';
    if (this.elements.healthScoreValue) this.elements.healthScoreValue.textContent = Math.round(r.healthScore) + ' / 100';

    this.renderDetailTable(input, r);
    this.renderInsight(r, input);

    ChartManager.renderAssetMix('assetMixChartCanvas', input);
    ChartManager.renderBalanceBar('balanceBarChartCanvas', r);
  },

  renderDetailTable(input, r) {
    if (!this.elements.detailTableBody) return;
    const rows = [];
    NetWorthCalc.ASSET_FIELDS.forEach(f => {
      const v = Math.max(0, input[f.id] || 0);
      if (v > 0) {
        const pct = r.totalAssets > 0 ? (v / r.totalAssets * 100).toFixed(1) : '0.0';
        const nwPct = r.netWorth !== 0 ? (v / Math.max(Math.abs(r.netWorth), r.totalAssets) * 100).toFixed(1) : '0.0';
        rows.push(`<tr>
          <td style="font-weight: 600; color: var(--color-dark);">${f.label}</td>
          <td><span class="badge badge-emerald" style="font-size: 0.7rem;">Asset</span></td>
          <td>${NetWorthCalc.formatCurrency(v)}</td>
          <td>${pct}%</td>
          <td>${nwPct}%</td>
        </tr>`);
      }
    });
    NetWorthCalc.LIABILITY_FIELDS.forEach(f => {
      const v = Math.max(0, input[f.id] || 0);
      if (v > 0) {
        const pct = r.totalLiabilities > 0 ? (v / r.totalLiabilities * 100).toFixed(1) : '0.0';
        rows.push(`<tr>
          <td style="font-weight: 600; color: var(--color-dark);">${f.label}</td>
          <td><span class="badge badge-rose" style="font-size: 0.7rem;">Liability</span></td>
          <td style="color: var(--color-rose);">${NetWorthCalc.formatCurrency(v)}</td>
          <td>${pct}%</td>
          <td>—</td>
        </tr>`);
      }
    });
    this.elements.detailTableBody.innerHTML = rows.join('');
  },

  renderInsight(r, input) {
    if (!this.elements.calcInsightBox) return;
    let msg = '';
    if (r.netWorth < 0) {
      msg = `⚠️ <strong>Negative net worth.</strong> You owe ${NetWorthCalc.formatCurrency(Math.abs(r.netWorth))} more than you own. Priority #1: build a small emergency fund ($1,000), then attack high-interest debt (credit cards first). Even $200/month extra on a 20% APR card saves you thousands.`;
    } else if (r.healthScore >= 80) {
      msg = `🌟 <strong>Excellent financial health.</strong> Net worth of ${NetWorthCalc.formatCurrency(r.netWorth)} with only ${r.debtRatio.toFixed(0)}% debt-to-asset ratio. You're in the top tier of households by wealth metrics. Consider maxing tax-advantaged accounts and exploring index investing.`;
    } else if (r.healthScore >= 60) {
      msg = `✅ <strong>Solid position.</strong> Net worth ${NetWorthCalc.formatCurrency(r.netWorth)}, ${r.liquidRatio.toFixed(0)}% in liquid assets. To strengthen: aim for 3-6 months expenses in cash, and target a debt-to-asset ratio under 30%.`;
    } else if (r.healthScore >= 40) {
      msg = `📊 <strong>Building wealth.</strong> Net worth ${NetWorthCalc.formatCurrency(r.netWorth)} is positive but debt levels (${r.debtRatio.toFixed(0)}%) or low liquidity (${r.liquidRatio.toFixed(0)}%) are limiting growth. Focus on one lever at a time — either pay down debt or build savings.`;
    } else {
      msg = `📈 <strong>Room to grow.</strong> Net worth is positive (${NetWorthCalc.formatCurrency(r.netWorth)}), but health score is low. The fastest fix: increase liquid savings to 3 months expenses, then redirect that same cash flow toward high-interest debt.`;
    }
    this.elements.calcInsightBox.innerHTML = `<div class="calc-insight-content">${msg}</div>`;
  },

  switchTab(tab) {
    this.elements.tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const targetId = tab.getAttribute('data-tab-target');
    this.elements.tabContents.forEach(c => c.classList.remove('active'));
    const target = document.getElementById(targetId);
    if (target) target.classList.add('active');
    requestAnimationFrame(() => {
      if (targetId === 'tabAssetMix' && ChartManager.assetMixChart) ChartManager.assetMixChart.resize();
      if (targetId === 'tabBalanceBar' && ChartManager.balanceBarChart) ChartManager.balanceBarChart.resize();
    });
  },

  animateValue(element, target, isCurrency) {
    if (!element) return;
    if (window.CompoundPro?.CounterAnimation) {
      window.CompoundPro.CounterAnimation.animate(element, target, isCurrency, 800);
    } else {
      element.textContent = isCurrency ? NetWorthCalc.formatCurrency(target) : target.toLocaleString();
    }
  },

  reset() {
    const defaults = {
      cash: 5000, savings: 15000, investments: 45000, retirement: 80000,
      realEstate: 350000, vehicles: 15000, otherAssets: 5000,
      mortgage: 240000, studentLoans: 12000, creditCards: 2500, autoLoans: 8000, otherDebts: 0
    };
    Object.entries(defaults).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
    this.calculate();
  },

  share() {
    if (!this.currentInputs) return;
    const state = NetWorthCalc.encodeState(this.currentInputs);
    const url = window.location.origin + window.location.pathname + '#' + state;
    navigator.clipboard.writeText(url).then(() => {
      if (window.CompoundPro?.showToast) window.CompoundPro.showToast('Link copied to clipboard!', 'success');
      else alert('Link copied!');
    }).catch(() => prompt('Copy this link:', url));
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.readyState === 'complete') UIController.init();
  else window.addEventListener('load', () => UIController.init());
});
