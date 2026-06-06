/**
 * CompoundPro - DRIP (Dividend Reinvestment Plan) Calculator Engine & UI Controller
 * Theme: Compound Interest (shared CSS, calc-inputs, calc-results)
 * Unique: Line chart (DRIP vs Cash vs shares) + Share accumulation chart + Year-by-year
 */

const DRIPCalc = {
  // ============== STOCK PRESETS ==============
  STOCK_PRESETS: {
    ko: { name: 'Coca-Cola', yield: 3.0, growth: 7, price: 65 },
    jnj: { name: 'Johnson & Johnson', yield: 3.1, growth: 6, price: 160 },
    pg: { name: 'Procter & Gamble', yield: 2.4, growth: 7, price: 165 },
    vym: { name: 'Vanguard High Dividend Yield ETF', yield: 2.8, growth: 8, price: 125 },
    schd: { name: 'Schwab US Dividend Equity ETF', yield: 3.5, growth: 9, price: 80 }
  },

  // ============== CORE CALCULATION ==============
  // Simulates year-by-year share accumulation with DRIP and without DRIP
  calculate(input) {
    const principal = Math.max(0, input.principal);
    const sharePrice = Math.max(0.01, input.sharePrice);
    const divYield = Math.max(0, input.divYield) / 100;
    const priceGrowth = input.priceGrowth / 100; // can be negative
    const years = Math.max(1, Math.floor(input.years));
    const divGrowth = (input.dividendGrowth || 0) / 100;
    const divFreq = input.divFrequency || 4;

    const initialShares = principal / sharePrice;
    let currentPrice = sharePrice;
    let currentDivPerShare = sharePrice * divYield; // annual div per share at year 0

    // DRIP scenario
    let dripShares = initialShares;
    let dripPositionValue = principal;
    let dripCumDividends = 0;

    // Cash scenario: shares stay constant, dividends accumulate
    let cashShares = initialShares;
    let cashPositionValue = principal;
    let cashCumDividends = 0;
    let cashBalance = 0; // accumulated cash from dividends

    const dripSchedule = [];
    const cashSchedule = [];

    // Initial state
    dripSchedule.push({
      year: 0,
      sharePrice: currentPrice,
      shares: dripShares,
      positionValue: dripShares * currentPrice,
      cumDividends: 0,
      divThisYear: 0
    });
    cashSchedule.push({
      year: 0,
      sharePrice: currentPrice,
      shares: cashShares,
      positionValue: cashShares * currentPrice,
      cumDividends: 0,
      cashBalance: 0
    });

    for (let y = 1; y <= years; y++) {
      // Update share price and dividend per share for this year
      currentPrice = currentPrice * (1 + priceGrowth);
      currentDivPerShare = currentDivPerShare * (1 + divGrowth);

      // Total annual dividend (based on shares at start of year)
      const totalAnnualDivDrip = dripShares * currentDivPerShare;
      const totalAnnualDivCash = cashShares * currentDivPerShare;

      // Reinvest: buy more shares at current price
      const newSharesDrip = totalAnnualDivDrip / currentPrice;
      dripShares += newSharesDrip;
      dripCumDividends += totalAnnualDivDrip;
      dripPositionValue = dripShares * currentPrice;

      // Cash: dividends accumulate as cash
      cashCumDividends += totalAnnualDivCash;
      cashBalance += totalAnnualDivCash;
      cashPositionValue = cashShares * currentPrice + cashBalance;

      dripSchedule.push({
        year: y,
        sharePrice: currentPrice,
        shares: dripShares,
        positionValue: dripPositionValue,
        cumDividends: dripCumDividends,
        divThisYear: totalAnnualDivDrip
      });
      cashSchedule.push({
        year: y,
        sharePrice: currentPrice,
        shares: cashShares,
        positionValue: cashPositionValue,
        cumDividends: cashCumDividends,
        cashBalance: cashBalance,
        divThisYear: totalAnnualDivCash
      });
    }

    const finalPrice = currentPrice;
    const extraShares = dripShares - initialShares;
    const dripBoost = dripPositionValue - cashPositionValue;
    const dripBoostPct = cashPositionValue > 0 ? (dripBoost / cashPositionValue) * 100 : 0;
    const dripReturnPct = principal > 0 ? ((dripPositionValue - principal) / principal) * 100 : 0;
    const cashReturnPct = principal > 0 ? ((cashPositionValue - principal) / principal) * 100 : 0;
    // Yield on cost (final dividend yield on original investment)
    const finalAnnualDiv = dripShares * currentDivPerShare;
    const yieldOnCost = principal > 0 ? (finalAnnualDiv / principal) * 100 : 0;

    return {
      principal, sharePrice, divYield: input.divYield, priceGrowth: input.priceGrowth, years, divGrowth: input.dividendGrowth, divFreq,
      initialShares, finalPrice,
      dripShares, dripPositionValue, dripCumDividends, dripReturnPct, extraShares,
      cashShares, cashPositionValue, cashCumDividends, cashBalance, cashReturnPct,
      dripBoost, dripBoostPct,
      finalAnnualDiv, yieldOnCost,
      dripSchedule, cashSchedule
    };
  },

  formatCurrency(value) {
    if (window.CompoundPro?.formatCurrency) return window.CompoundPro.formatCurrency(value);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  },
  formatShares(value) {
    return value.toFixed(2);
  },

  // ============== STATE ENCODE/DECODE ==============
  encodeState(input) {
    const p = new URLSearchParams();
    p.set('p', input.principal);
    p.set('sp', input.sharePrice);
    p.set('y', input.divYield);
    p.set('g', input.priceGrowth);
    p.set('t', input.years);
    p.set('dg', input.dividendGrowth || 5);
    p.set('df', input.divFrequency || 4);
    return p.toString();
  },
  decodeState(hash) {
    const p = new URLSearchParams(hash);
    const get = (k, d) => {
      const v = p.get(k);
      if (v === null) return d;
      const n = parseFloat(v);
      return isNaN(n) ? d : n;
    };
    return {
      principal: get('p', 10000),
      sharePrice: get('sp', 100),
      divYield: get('y', 3),
      priceGrowth: get('g', 7),
      years: get('t', 20),
      dividendGrowth: get('dg', 5),
      divFrequency: get('df', 4)
    };
  }
};


const ChartManager = {
  comparisonChart: null,
  shareChart: null,

  // DRIP vs Cash line chart
  renderComparison(canvasId, r) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (this.comparisonChart) this.comparisonChart.destroy();

    const labels = r.dripSchedule.map(s => 'Yr ' + s.year);
    const dripValues = r.dripSchedule.map(s => s.positionValue);
    const cashValues = r.cashSchedule.map(s => s.positionValue);

    this.comparisonChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'With DRIP',
            data: dripValues,
            borderColor: 'rgba(249, 115, 22, 1)',
            backgroundColor: 'rgba(249, 115, 22, 0.15)',
            fill: true,
            tension: 0.3,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: 'rgba(249, 115, 22, 1)',
            borderWidth: 3
          },
          {
            label: 'With Cash Dividends',
            data: cashValues,
            borderColor: 'rgba(14, 165, 233, 1)',
            backgroundColor: 'rgba(14, 165, 233, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: 'rgba(14, 165, 233, 1)',
            borderWidth: 3,
            borderDash: [6, 4]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'DM Sans', size: 12 }, usePointStyle: true, padding: 12 }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: 'DM Sans', size: 13, weight: '600' },
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ctx.dataset.label + ': ' + DRIPCalc.formatCurrency(ctx.parsed.y)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            ticks: {
              font: { family: 'JetBrains Mono', size: 11 },
              callback: (v) => DRIPCalc.formatCurrency(v)
            }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'DM Sans', size: 11 } }
          }
        }
      }
    });
  },

  // Share accumulation over time (line with markers)
  renderShares(canvasId, r) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (this.shareChart) this.shareChart.destroy();

    const labels = r.dripSchedule.map(s => 'Yr ' + s.year);
    const shares = r.dripSchedule.map(s => s.shares);
    const cumDiv = r.dripSchedule.map(s => s.cumDividends);

    this.shareChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total Shares Owned',
            data: shares,
            borderColor: 'rgba(124, 58, 237, 1)',
            backgroundColor: 'rgba(124, 58, 237, 0.12)',
            fill: true,
            tension: 0.3,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: 'rgba(124, 58, 237, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            borderWidth: 3,
            yAxisID: 'y'
          },
          {
            label: 'Cumulative Dividends',
            data: cumDiv,
            borderColor: 'rgba(16, 185, 129, 1)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: false,
            tension: 0.3,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 3,
            borderDash: [5, 3],
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
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
                if (ctx.datasetIndex === 0) return ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + ' shares';
                return ctx.dataset.label + ': ' + DRIPCalc.formatCurrency(ctx.parsed.y);
              }
            }
          }
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            ticks: {
              font: { family: 'JetBrains Mono', size: 11 },
              callback: (v) => v.toFixed(1)
            },
            title: { display: true, text: 'Shares', font: { family: 'DM Sans', size: 11, weight: '600' }, color: 'var(--color-violet-700)' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            grid: { display: false },
            ticks: {
              font: { family: 'JetBrains Mono', size: 11 },
              callback: (v) => DRIPCalc.formatCurrency(v)
            },
            title: { display: true, text: 'Dividends', font: { family: 'DM Sans', size: 11, weight: '600' }, color: 'var(--color-emerald-2)' }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'DM Sans', size: 11 } }
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
    this.elements = {
      principal: document.getElementById('principal'),
      sharePrice: document.getElementById('sharePrice'),
      divYield: document.getElementById('divYield'),
      priceGrowth: document.getElementById('priceGrowth'),
      years: document.getElementById('years'),
      dividendGrowth: document.getElementById('dividendGrowth'),
      divFrequency: document.getElementById('divFrequency'),
      principalSlider: document.getElementById('principalSlider'),
      divYieldSlider: document.getElementById('divYieldSlider'),
      priceGrowthSlider: document.getElementById('priceGrowthSlider'),
      yearsSlider: document.getElementById('yearsSlider'),
      advancedTrigger: document.getElementById('advancedOptionsTrigger'),
      advancedContent: document.getElementById('advancedOptionsContent'),
      // Result cards
      dripValue: document.getElementById('dripValue'),
      dripGainPct: document.getElementById('dripGainPct'),
      cashValue: document.getElementById('cashValue'),
      dripBoostValue: document.getElementById('dripBoostValue'),
      dripBoostPct: document.getElementById('dripBoostPct'),
      finalSharesValue: document.getElementById('finalSharesValue'),
      cumDividendsValue: document.getElementById('cumDividendsValue'),
      // Info bar
      initialSharesValue: document.getElementById('initialSharesValue'),
      extraSharesValue: document.getElementById('extraSharesValue'),
      finalPriceValue: document.getElementById('finalPriceValue'),
      cashDividendsValue: document.getElementById('cashDividendsValue'),
      yieldOnCostValue: document.getElementById('yieldOnCostValue'),
      // Table
      yearlyTableBody: document.getElementById('yearlyTableBody'),
      // Insight
      calcInsightBox: document.getElementById('calcInsightBox'),
      // Buttons
      calculateBtn: document.getElementById('calculateBtn'),
      resetBtn: document.getElementById('resetBtn'),
      shareBtn: document.getElementById('shareBtn'),
      // Tabs
      tabs: document.querySelectorAll('.calc-tab'),
      tabContents: document.querySelectorAll('.calc-tab-content'),
      // Preset
      presetBtns: document.querySelectorAll('[data-stock-preset]')
    };

    // Load state
    const hashState = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    if (hashState) {
      const decoded = DRIPCalc.decodeState(hashState);
      Object.entries(decoded).forEach(([k, v]) => {
        if (this.elements[k]) this.elements[k].value = v;
      });
    } else if (window.CompoundPro?.loadCalcInputs) {
      window.CompoundPro.loadCalcInputs('drip', {
        principal: 10000, sharePrice: 100, divYield: 3, priceGrowth: 7, years: 20,
        dividendGrowth: 5, divFrequency: 4
      }, (id, val) => {
        if (this.elements[id]) this.elements[id].value = val;
      });
    }

    this.bindEvents();
    this.syncSliders();
    this.calculate();
  },

  bindEvents() {
    if (this.elements.calculateBtn) this.elements.calculateBtn.addEventListener('click', () => this.calculate());
    if (this.elements.resetBtn) this.elements.resetBtn.addEventListener('click', () => this.reset());
    if (this.elements.shareBtn) this.elements.shareBtn.addEventListener('click', () => this.share());
    if (this.elements.advancedTrigger) {
      this.elements.advancedTrigger.addEventListener('click', () => {
        const expanded = this.elements.advancedTrigger.getAttribute('aria-expanded') === 'true';
        this.elements.advancedTrigger.setAttribute('aria-expanded', !expanded);
        if (this.elements.advancedContent) this.elements.advancedContent.classList.toggle('open');
      });
    }
    // Tabs
    this.elements.tabs.forEach(tab => tab.addEventListener('click', () => this.switchTab(tab)));
    // Sliders
    ['principal', 'divYield', 'priceGrowth', 'years'].forEach(field => {
      const slider = this.elements[field + 'Slider'];
      const input = this.elements[field];
      if (slider && input) {
        slider.addEventListener('input', () => {
          input.value = slider.value;
          this.syncSliders();
          this.calculate();
        });
        input.addEventListener('input', () => {
          slider.value = input.value;
          this.syncSliders();
          this.calculate();
        });
      }
    });
    // Other inputs without sliders
    ['sharePrice', 'dividendGrowth'].forEach(id => {
      const el = this.elements[id];
      if (el) el.addEventListener('input', () => this.calculate());
    });
    // Stock preset buttons
    this.elements.presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-stock-preset');
        const preset = DRIPCalc.STOCK_PRESETS[key];
        if (preset) {
          this.elements.divYield.value = preset.yield;
          if (this.elements.divYieldSlider) this.elements.divYieldSlider.value = preset.yield;
          this.elements.priceGrowth.value = preset.growth;
          if (this.elements.priceGrowthSlider) this.elements.priceGrowthSlider.value = preset.growth;
          this.elements.sharePrice.value = preset.price;
          this.syncSliders();
          this.calculate();
        }
      });
    });
    // Dividend frequency segment
    document.querySelectorAll('[data-div-freq]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-div-freq]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.elements.divFrequency) this.elements.divFrequency.value = btn.getAttribute('data-div-freq');
        this.calculate();
      });
    });
  },

  syncSliders() {
    if (window.CompoundPro?.updateSliderFill) {
      ['principalSlider', 'divYieldSlider', 'priceGrowthSlider', 'yearsSlider'].forEach(id => {
        const slider = document.getElementById(id);
        if (slider) window.CompoundPro.updateSliderFill(slider);
      });
    }
  },

  getInputs() {
    return {
      principal: parseFloat(this.elements.principal.value) || 0,
      sharePrice: parseFloat(this.elements.sharePrice.value) || 100,
      divYield: parseFloat(this.elements.divYield.value) || 0,
      priceGrowth: parseFloat(this.elements.priceGrowth.value) || 0,
      years: parseFloat(this.elements.years.value) || 1,
      dividendGrowth: parseFloat(this.elements.dividendGrowth?.value) || 0,
      divFrequency: parseInt(this.elements.divFrequency?.value) || 4
    };
  },

  calculate() {
    try {
      const inputs = this.getInputs();
      const result = DRIPCalc.calculate(inputs);
      this.currentResult = result;
      this.currentInputs = inputs;
      if (window.CompoundPro?.saveCalcInputs) window.CompoundPro.saveCalcInputs('drip', inputs);
      this.renderResult(result);
    } catch (err) {
      console.error('DRIP calculation error:', err);
      if (window.CompoundPro?.showToast) window.CompoundPro.showToast('Calculation error: ' + err.message, 'error');
    }
  },

  renderResult(r) {
    if (document.getElementById('resultsPlaceholder')) document.getElementById('resultsPlaceholder').style.display = 'none';
    if (document.getElementById('resultsPanel')) document.getElementById('resultsPanel').style.display = 'flex';

    // Primary
    this.animateValue(this.elements.dripValue, r.dripPositionValue, true);
    if (this.elements.dripGainPct) this.elements.dripGainPct.textContent = '+' + r.dripReturnPct.toFixed(1) + '% total return';
    // Cash
    this.animateValue(this.elements.cashValue, r.cashPositionValue, true);
    // DRIP Boost
    this.animateValue(this.elements.dripBoostValue, r.dripBoost, true);
    if (this.elements.dripBoostPct) {
      this.elements.dripBoostPct.textContent = '+' + r.dripBoostPct.toFixed(1) + '% vs cash';
    }
    // Final shares
    if (this.elements.finalSharesValue) this.elements.finalSharesValue.textContent = DRIPCalc.formatShares(r.dripShares);
    // Cum dividends
    this.animateValue(this.elements.cumDividendsValue, r.dripCumDividends, true);
    // Info bar
    if (this.elements.initialSharesValue) this.elements.initialSharesValue.textContent = DRIPCalc.formatShares(r.initialShares);
    if (this.elements.extraSharesValue) this.elements.extraSharesValue.textContent = '+' + DRIPCalc.formatShares(r.extraShares);
    if (this.elements.finalPriceValue) this.elements.finalPriceValue.textContent = DRIPCalc.formatCurrency(r.finalPrice);
    this.animateValue(this.elements.cashDividendsValue, r.cashCumDividends, true);
    if (this.elements.yieldOnCostValue) this.elements.yieldOnCostValue.textContent = r.yieldOnCost.toFixed(2) + '%';

    this.renderTable(r);
    this.renderInsight(r);

    ChartManager.renderComparison('comparisonChartCanvas', r);
    ChartManager.renderShares('shareChartCanvas', r);
  },

  renderTable(r) {
    if (!this.elements.yearlyTableBody) return;
    // Show every 2 years + final, or all if years <= 10
    const step = r.years <= 10 ? 1 : r.years <= 25 ? 2 : 5;
    let html = '';
    for (let i = 0; i <= r.years; i += step) {
      if (i === 0 && r.years > 0) continue;
      if (i > r.years) i = r.years;
      const s = r.dripSchedule[i];
      if (!s) continue;
      const yoc = r.principal > 0 ? (s.divThisYear / r.principal) * 100 : 0;
      html += `
        <tr>
          <td style="font-weight: 600; color: var(--color-dark);">Year ${s.year}</td>
          <td>${DRIPCalc.formatCurrency(s.sharePrice)}</td>
          <td style="color: var(--color-violet-700); font-weight: 600;">${DRIPCalc.formatShares(s.shares)}</td>
          <td>${DRIPCalc.formatCurrency(s.positionValue)}</td>
          <td>${DRIPCalc.formatCurrency(s.divThisYear)}</td>
          <td style="color: var(--color-emerald-2); font-weight: 600;">${yoc.toFixed(2)}%</td>
        </tr>
      `;
      if (i === r.years) break;
    }
    this.elements.yearlyTableBody.innerHTML = html;
  },

  renderInsight(r) {
    if (!this.elements.calcInsightBox) return;
    let msg = '';
    if (r.years >= 20 && r.dripBoostPct >= 20) {
      msg = `🚀 <strong>DRIP pays off over time.</strong> Over ${r.years} years, reinvesting dividends generated <strong>${DRIPCalc.formatCurrency(r.dripBoost)}</strong> in extra wealth — that's <strong>+${r.dripBoostPct.toFixed(1)}%</strong> more than taking cash. You accumulated <strong>${r.extraShares.toFixed(1)} extra shares</strong> (${((r.extraShares/r.initialShares)*100).toFixed(0)}% more than your starting position).`;
    } else if (r.years >= 10 && r.dripBoostPct >= 5) {
      msg = `✅ <strong>DRIP working.</strong> ${r.years} years of reinvestment added <strong>${DRIPCalc.formatCurrency(r.dripBoost)}</strong> to your position. The compounding effect will accelerate after year 20 as your share count grows.`;
    } else if (r.divYield === 0) {
      msg = `📊 <strong>Growth-only stock (no dividend).</strong> This calculator is most useful for dividend-paying stocks. Try a 2-4% yield to see the DRIP benefit. Some popular picks: KO (3%), JNJ (3.1%), SCHD (3.5%).`;
    } else {
      msg = `📈 <strong>Modest DRIP boost so far.</strong> The benefit grows exponentially with time. Try increasing the holding period to 20-30 years to see the gap widen dramatically.`;
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
      if (targetId === 'tabComparisonChart' && ChartManager.comparisonChart) ChartManager.comparisonChart.resize();
      if (targetId === 'tabShareChart' && ChartManager.shareChart) ChartManager.shareChart.resize();
    });
  },

  animateValue(element, target, isCurrency) {
    if (!element) return;
    if (window.CompoundPro?.CounterAnimation) {
      window.CompoundPro.CounterAnimation.animate(element, target, isCurrency, 800);
    } else {
      element.textContent = isCurrency ? DRIPCalc.formatCurrency(target) : target.toLocaleString();
    }
  },

  reset() {
    this.elements.principal.value = 10000;
    this.elements.sharePrice.value = 100;
    this.elements.divYield.value = 3;
    this.elements.priceGrowth.value = 7;
    this.elements.years.value = 20;
    if (this.elements.dividendGrowth) this.elements.dividendGrowth.value = 5;
    if (this.elements.divFrequency) this.elements.divFrequency.value = 4;
    if (this.elements.principalSlider) this.elements.principalSlider.value = 10000;
    if (this.elements.divYieldSlider) this.elements.divYieldSlider.value = 3;
    if (this.elements.priceGrowthSlider) this.elements.priceGrowthSlider.value = 7;
    if (this.elements.yearsSlider) this.elements.yearsSlider.value = 20;
    this.syncSliders();
    this.calculate();
  },

  share() {
    if (!this.currentInputs) return;
    const state = DRIPCalc.encodeState(this.currentInputs);
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
