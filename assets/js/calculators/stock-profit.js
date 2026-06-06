/**
 * CompoundPro - Stock Profit / ROI Calculator Engine & UI Controller
 * Theme: Compound Interest (shared CSS, calc-inputs, calc-results)
 * Unique: Stacked bar chart (Cost → Capital Gain → Dividend → Total) + Year-by-year table
 */

const StockProfitCalc = {
  // ============== CORE CALCULATION ==============
  calculate(input) {
    const buyPrice = Math.max(0.01, input.buyPrice);
    const sellPrice = Math.max(0, input.sellPrice);
    const quantity = Math.max(1, input.quantity);
    const dividend = Math.max(0, input.dividend);
    const years = Math.max(0.1, input.years);
    const commission = Math.max(0, input.commission || 0);
    const taxRate = Math.max(0, Math.min(100, input.taxRate || 0)) / 100;
    const divTaxRate = Math.max(0, Math.min(100, input.dividendTax || 0)) / 100;

    // Cost basis: what you paid (including commission)
    const costBasis = buyPrice * quantity + commission;

    // Sale proceeds: what you got (net of commission)
    const saleProceeds = sellPrice * quantity - commission;

    // Capital gain (raw)
    const capitalGainGross = saleProceeds - costBasis;

    // Capital gain tax (only on positive gains, losses not taxed)
    const capGainsTax = Math.max(0, capitalGainGross) * taxRate;
    const capitalGainNet = capitalGainGross - capGainsTax;

    // Dividend income
    const dividendGross = dividend * quantity * years;
    const divTaxAmount = dividendGross * divTaxRate;
    const dividendNet = dividendGross - divTaxAmount;

    // Net profit (after taxes & fees)
    const netProfit = capitalGainNet + dividendNet;

    // Total return / final proceeds
    const totalReturn = costBasis + netProfit;

    // ROI %
    const roi = costBasis > 0 ? (netProfit / costBasis) * 100 : 0;

    // Annualized ROI
    const ratio = totalReturn / costBasis;
    const annualizedRoi = ratio > 0 ? (Math.pow(ratio, 1 / years) - 1) * 100 : 0;

    // Tax totals
    const totalTax = capGainsTax + divTaxAmount;

    // Stock price growth %
    const priceGrowth = buyPrice > 0 ? ((sellPrice - buyPrice) / buyPrice) * 100 : 0;

    // Dividend yield on cost (annualized)
    const divYieldOnCost = buyPrice > 0 ? (dividend / buyPrice) * 100 : 0;

    return {
      buyPrice, sellPrice, quantity, dividend, years, commission,
      costBasis, saleProceeds, capitalGainGross, capGainsTax, capitalGainNet,
      dividendGross, divTaxAmount, dividendNet, netProfit, totalReturn,
      roi, annualizedRoi, totalTax, priceGrowth, divYieldOnCost
    };
  },

  // ============== YEAR-BY-YEAR SCHEDULE ==============
  generateYearlySchedule(r) {
    const rows = [];
    let cumDividend = 0;
    for (let y = 1; y <= Math.ceil(r.years); y++) {
      const t = Math.min(y / r.years, 1);
      // Linear price interpolation
      const priceAtYear = r.buyPrice + (r.sellPrice - r.buyPrice) * t;
      const positionValue = priceAtYear * r.quantity;
      const divThisYear = r.dividend * r.quantity * (y <= r.years ? 1 : r.years - Math.floor(r.years));
      cumDividend += divThisYear;
      // Dividend net of tax
      const divThisYearNet = divThisYear * (1 - (r.dividendTax > 0 ? r.dividendTax / 100 : 0));
      rows.push({
        year: y,
        stockPrice: priceAtYear,
        positionValue,
        dividendThisYear: divThisYear,
        dividendThisYearNet: divThisYearNet,
        cumDividend,
        cumDividendNet: cumDividend * (1 - (r.dividendTax > 0 ? r.dividendTax / 100 : 0))
      });
    }
    return rows;
  },

  // ============== STATE ENCODE/DECODE ==============
  encodeState(input) {
    const p = new URLSearchParams();
    p.set('bp', input.buyPrice);
    p.set('sp', input.sellPrice);
    p.set('q', input.quantity);
    p.set('div', input.dividend);
    p.set('y', input.years);
    p.set('com', input.commission || 0);
    p.set('tr', input.taxRate || 0);
    p.set('dtr', input.dividendTax || 0);
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
      buyPrice: get('bp', 100),
      sellPrice: get('sp', 150),
      quantity: get('q', 50),
      dividend: get('div', 2),
      years: get('y', 3),
      commission: get('com', 0),
      taxRate: get('tr', 15),
      dividendTax: get('dtr', 15)
    };
  },

  formatCurrency(value) {
    if (window.CompoundPro?.formatCurrency) return window.CompoundPro.formatCurrency(value);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  },
  formatPct(value) {
    return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
  }
};


const ChartManager = {
  waterfallChart: null,
  growthChart: null,
  breakdownChart: null,

  // Waterfall-style stacked bar (single point in time: cost basis → +capital gain → +dividend → total)
  renderWaterfall(canvasId, r) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (this.waterfallChart) this.waterfallChart.destroy();

    const capGainPositive = r.capitalGainNet >= 0;
    const divPositive = r.dividendNet >= 0;

    this.waterfallChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Cost Basis', '+ Capital Gain', '+ Dividends', 'Total Proceeds'],
        datasets: [{
          label: 'Amount',
          data: [r.costBasis, r.capitalGainNet, r.dividendNet, r.totalReturn],
          backgroundColor: [
            'rgba(100, 116, 139, 0.85)',                       // Cost basis (slate)
            capGainPositive ? 'rgba(16, 185, 129, 0.85)' : 'rgba(225, 29, 72, 0.85)',  // Capital gain
            divPositive ? 'rgba(14, 165, 233, 0.85)' : 'rgba(225, 29, 72, 0.85)',      // Dividend
            'rgba(249, 115, 22, 0.95)'                        // Total (orange - hero)
          ],
          borderColor: [
            'rgba(100, 116, 139, 1)',
            capGainPositive ? 'rgba(16, 185, 129, 1)' : 'rgba(225, 29, 72, 1)',
            divPositive ? 'rgba(14, 165, 233, 1)' : 'rgba(225, 29, 72, 1)',
            'rgba(249, 115, 22, 1)'
          ],
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
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
              label: (ctx) => {
                const v = ctx.parsed.y;
                const sign = v >= 0 ? '' : '';
                return ctx.label + ': ' + StockProfitCalc.formatCurrency(v);
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            ticks: {
              font: { family: 'JetBrains Mono', size: 11 },
              callback: (v) => StockProfitCalc.formatCurrency(v)
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { family: 'DM Sans', size: 12, weight: '500' }
            }
          }
        }
      }
    });
  },

  // Growth line chart: position value + cumulative dividends over time
  renderGrowth(canvasId, r, schedule) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (this.growthChart) this.growthChart.destroy();

    const labels = ['Start', ...schedule.map(s => 'Yr ' + s.year)];
    const positionValues = [r.buyPrice * r.quantity, ...schedule.map(s => s.positionValue)];
    const cumDiv = [0, ...schedule.map(s => s.cumDividendNet)];

    this.growthChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Stock Position Value',
            data: positionValues,
            borderColor: 'rgba(249, 115, 22, 1)',
            backgroundColor: 'rgba(249, 115, 22, 0.15)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 3
          },
          {
            label: 'Cumulative Dividends (net)',
            data: cumDiv,
            borderColor: 'rgba(14, 165, 233, 1)',
            backgroundColor: 'rgba(14, 165, 233, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
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
              label: (ctx) => ctx.dataset.label + ': ' + StockProfitCalc.formatCurrency(ctx.parsed.y)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            ticks: {
              font: { family: 'JetBrains Mono', size: 11 },
              callback: (v) => StockProfitCalc.formatCurrency(v)
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

  // Doughnut: where did your profit come from?
  renderBreakdown(canvasId, r) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (this.breakdownChart) this.breakdownChart.destroy();

    const segments = [];
    const colors = [];
    if (r.costBasis > 0) { segments.push({ label: 'Cost Recovered', value: r.costBasis, color: 'rgba(100, 116, 139, 0.9)' }); colors.push('rgba(100, 116, 139, 0.9)'); }
    if (r.capitalGainNet > 0) { segments.push({ label: 'Capital Gain', value: r.capitalGainNet, color: 'rgba(16, 185, 129, 0.9)' }); colors.push('rgba(16, 185, 129, 0.9)'); }
    if (r.dividendNet > 0) { segments.push({ label: 'Dividends', value: r.dividendNet, color: 'rgba(14, 165, 233, 0.9)' }); colors.push('rgba(14, 165, 233, 0.9)'); }
    if (r.capitalGainNet < 0) { segments.push({ label: 'Capital Loss', value: Math.abs(r.capitalGainNet), color: 'rgba(225, 29, 72, 0.9)' }); colors.push('rgba(225, 29, 72, 0.9)'); }
    if (r.totalTax > 0) { segments.push({ label: 'Tax Paid', value: r.totalTax, color: 'rgba(124, 58, 237, 0.9)' }); colors.push('rgba(124, 58, 237, 0.9)'); }

    this.breakdownChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: segments.map(s => s.label),
        datasets: [{
          data: segments.map(s => s.value),
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
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
                return ctx.label + ': ' + StockProfitCalc.formatCurrency(ctx.parsed) + ' (' + pct + '%)';
              }
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
  currentSchedule: null,
  currentInputs: null,

  init() {
    // Cache elements
    this.elements = {
      buyPrice: document.getElementById('buyPrice'),
      sellPrice: document.getElementById('sellPrice'),
      quantity: document.getElementById('quantity'),
      dividend: document.getElementById('dividend'),
      years: document.getElementById('years'),
      commission: document.getElementById('commission'),
      taxRate: document.getElementById('taxRate'),
      dividendTax: document.getElementById('dividendTax'),
      sellPriceSlider: document.getElementById('sellPriceSlider'),
      quantitySlider: document.getElementById('quantitySlider'),
      dividendSlider: document.getElementById('dividendSlider'),
      yearsSlider: document.getElementById('yearsSlider'),
      resultsPlaceholder: document.getElementById('resultsPlaceholder'),
      resultsPanel: document.getElementById('resultsPanel'),
      // Cards
      totalReturnValue: document.getElementById('totalReturnValue'),
      totalReturnLabel: document.getElementById('totalReturnLabel'),
      netProfitValue: document.getElementById('netProfitValue'),
      netProfitPct: document.getElementById('netProfitPct'),
      capitalGainValue: document.getElementById('capitalGainValue'),
      dividendIncomeValue: document.getElementById('dividendIncomeValue'),
      annualizedRoiValue: document.getElementById('annualizedRoiValue'),
      // Cost basis card
      costBasisValue: document.getElementById('costBasisValue'),
      saleProceedsValue: document.getElementById('saleProceedsValue'),
      totalTaxValue: document.getElementById('totalTaxValue'),
      // Stock info bar
      priceGrowthValue: document.getElementById('priceGrowthValue'),
      divYieldValue: document.getElementById('divYieldValue'),
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
      // Advanced trigger
      advancedTrigger: document.getElementById('advancedOptionsTrigger'),
      advancedContent: document.getElementById('advancedOptionsContent'),
      // Preset buttons
      presetBtns: document.querySelectorAll('[data-scenario]')
    };

    // Check for shareable state
    const hashState = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    if (hashState) {
      const decoded = StockProfitCalc.decodeState(hashState);
      this.elements.buyPrice.value = decoded.buyPrice;
      this.elements.sellPrice.value = decoded.sellPrice;
      this.elements.quantity.value = decoded.quantity;
      this.elements.dividend.value = decoded.dividend;
      this.elements.years.value = decoded.years;
      if (this.elements.commission) this.elements.commission.value = decoded.commission;
      if (this.elements.taxRate) this.elements.taxRate.value = decoded.taxRate;
      if (this.elements.dividendTax) this.elements.dividendTax.value = decoded.dividendTax;
    } else {
      // Try to load from localStorage
      if (window.CompoundPro?.loadCalcInputs) {
        window.CompoundPro.loadCalcInputs('stock-profit', {
          buyPrice: 100, sellPrice: 150, quantity: 50, dividend: 2, years: 3,
          commission: 0, taxRate: 15, dividendTax: 15
        }, (id, val) => {
          const el = document.getElementById(id);
          if (el) el.value = val;
        });
      }
    }

    this.bindEvents();
    this.syncSliders();
    // Auto-calculate on load
    this.calculate();
  },

  bindEvents() {
    // Calculate button
    if (this.elements.calculateBtn) {
      this.elements.calculateBtn.addEventListener('click', () => this.calculate());
    }
    // Reset button
    if (this.elements.resetBtn) {
      this.elements.resetBtn.addEventListener('click', () => this.reset());
    }
    // Share button
    if (this.elements.shareBtn) {
      this.elements.shareBtn.addEventListener('click', () => this.share());
    }
    // Advanced toggle
    if (this.elements.advancedTrigger) {
      this.elements.advancedTrigger.addEventListener('click', () => {
        const expanded = this.elements.advancedTrigger.getAttribute('aria-expanded') === 'true';
        this.elements.advancedTrigger.setAttribute('aria-expanded', !expanded);
        if (this.elements.advancedContent) {
          this.elements.advancedContent.classList.toggle('open');
        }
      });
    }
    // Tabs
    this.elements.tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab));
    });
    // Sliders
    ['sellPrice', 'quantity', 'dividend', 'years'].forEach(field => {
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
    // Other text inputs (no slider)
    ['buyPrice', 'commission', 'taxRate', 'dividendTax'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.calculate());
    });
    // Preset scenario buttons
    this.elements.presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const scenario = btn.getAttribute('data-scenario');
        const buyPrice = parseFloat(this.elements.buyPrice.value) || 100;
        let sellPrice = buyPrice;
        switch (scenario) {
          case 'loss50': sellPrice = buyPrice * 0.5; break;
          case 'loss20': sellPrice = buyPrice * 0.8; break;
          case 'flat': sellPrice = buyPrice; break;
          case 'gain20': sellPrice = buyPrice * 1.2; break;
          case 'gain50': sellPrice = buyPrice * 1.5; break;
          case 'double': sellPrice = buyPrice * 2; break;
        }
        this.elements.sellPrice.value = sellPrice.toFixed(2);
        if (this.elements.sellPriceSlider) {
          this.elements.sellPriceSlider.value = Math.min(1000, sellPrice);
        }
        this.syncSliders();
        this.calculate();
      });
    });
  },

  syncSliders() {
    if (window.CompoundPro?.updateSliderFill) {
      ['sellPriceSlider', 'quantitySlider', 'dividendSlider', 'yearsSlider'].forEach(id => {
        const slider = document.getElementById(id);
        if (slider) window.CompoundPro.updateSliderFill(slider);
      });
    }
  },

  getInputs() {
    return {
      buyPrice: parseFloat(this.elements.buyPrice.value) || 100,
      sellPrice: parseFloat(this.elements.sellPrice.value) || 150,
      quantity: parseFloat(this.elements.quantity.value) || 50,
      dividend: parseFloat(this.elements.dividend.value) || 0,
      years: parseFloat(this.elements.years.value) || 1,
      commission: parseFloat(this.elements.commission?.value) || 0,
      taxRate: parseFloat(this.elements.taxRate?.value) || 0,
      dividendTax: parseFloat(this.elements.dividendTax?.value) || 0
    };
  },

  calculate() {
    try {
      const inputs = this.getInputs();
      const result = StockProfitCalc.calculate(inputs);
      const schedule = StockProfitCalc.generateYearlySchedule(result);

      this.currentResult = result;
      this.currentSchedule = schedule;
      this.currentInputs = inputs;

      // Save to localStorage
      if (window.CompoundPro?.saveCalcInputs) {
        window.CompoundPro.saveCalcInputs('stock-profit', inputs);
      }

      this.renderResult(result, schedule);
    } catch (err) {
      console.error('Stock profit calculation error:', err);
      if (window.CompoundPro?.showToast) {
        window.CompoundPro.showToast('Calculation error: ' + err.message, 'error');
      }
    }
  },

  renderResult(r, schedule) {
    // Show results, hide placeholder
    if (this.elements.resultsPlaceholder) this.elements.resultsPlaceholder.style.display = 'none';
    if (this.elements.resultsPanel) this.elements.resultsPanel.style.display = 'flex';

    // PRIMARY: Total Return (net proceeds)
    this.animateValue(this.elements.totalReturnValue, r.totalReturn, true);
    if (this.elements.netProfitPct) {
      this.elements.netProfitPct.textContent = StockProfitCalc.formatPct(r.roi) + ' ROI';
      this.elements.netProfitPct.style.color = r.netProfit >= 0 ? 'var(--color-emerald-2)' : 'var(--color-rose)';
    }
    // Card 2: Net Profit
    this.animateValue(this.elements.netProfitValue, r.netProfit, true);
    // Card 3: Annualized ROI
    if (this.elements.annualizedRoiValue) {
      this.elements.annualizedRoiValue.textContent = StockProfitCalc.formatPct(r.annualizedRoi);
      this.elements.annualizedRoiValue.style.color = r.annualizedRoi >= 0 ? 'var(--color-emerald-2)' : 'var(--color-rose)';
    }
    // Secondary cards
    this.animateValue(this.elements.capitalGainValue, r.capitalGainNet, true);
    this.animateValue(this.elements.dividendIncomeValue, r.dividendNet, true);
    // Cost summary
    this.animateValue(this.elements.costBasisValue, r.costBasis, true);
    this.animateValue(this.elements.saleProceedsValue, r.saleProceeds, true);
    this.animateValue(this.elements.totalTaxValue, r.totalTax, true);
    // Stock info bar
    if (this.elements.priceGrowthValue) {
      this.elements.priceGrowthValue.textContent = StockProfitCalc.formatPct(r.priceGrowth);
      this.elements.priceGrowthValue.style.color = r.priceGrowth >= 0 ? 'var(--color-emerald-2)' : 'var(--color-rose)';
    }
    if (this.elements.divYieldValue) {
      this.elements.divYieldValue.textContent = r.divYieldOnCost.toFixed(2) + '% / yr';
    }

    // Render table
    this.renderTable(schedule, r);

    // Render insight
    this.renderInsight(r);

    // Render charts
    ChartManager.renderWaterfall('waterfallChartCanvas', r);
    ChartManager.renderGrowth('growthChartCanvas', r, schedule);
    ChartManager.renderBreakdown('breakdownChartCanvas', r);
  },

  renderTable(schedule, r) {
    if (!this.elements.yearlyTableBody) return;
    let html = '';
    schedule.forEach((s, i) => {
      const prev = i === 0 ? r.buyPrice * r.quantity : schedule[i - 1].positionValue;
      const changePct = ((s.positionValue - prev) / prev) * 100;
      const changeColor = changePct >= 0 ? 'color: var(--color-emerald-2);' : 'color: var(--color-rose);';
      html += `
        <tr>
          <td style="font-weight: 600; color: var(--color-dark);">Year ${s.year}</td>
          <td>${StockProfitCalc.formatCurrency(s.stockPrice)}</td>
          <td>${StockProfitCalc.formatCurrency(s.positionValue)}</td>
          <td>${StockProfitCalc.formatCurrency(s.dividendThisYear)}</td>
          <td style="color: var(--color-sea-2); font-weight: 600;">${StockProfitCalc.formatCurrency(s.cumDividendNet)}</td>
          <td style="${changeColor} font-weight: 600;">${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%</td>
        </tr>
      `;
    });
    this.elements.yearlyTableBody.innerHTML = html;
  },

  renderInsight(r) {
    if (!this.elements.calcInsightBox) return;
    const positive = r.netProfit >= 0;
    const yearlyAvgDiv = r.dividendNet / r.years;
    let msg = '';
    if (positive) {
      const capShare = r.netProfit > 0 ? (r.capitalGainNet / r.netProfit) * 100 : 0;
      const divShare = r.netProfit > 0 ? 100 - capShare : 0;
      if (r.annualizedRoi >= 15) {
        msg = `🚀 <strong>Outstanding performance.</strong> Your annualized ROI of <strong>${r.annualizedRoi.toFixed(1)}%</strong> beats the S&P 500's historical average. Capital gain contributed ${capShare.toFixed(0)}% of profit, dividends ${divShare.toFixed(0)}%.`;
      } else if (r.annualizedRoi >= 7) {
        msg = `✅ <strong>Solid returns.</strong> ${r.annualizedRoi.toFixed(1)}% annualized over ${r.years} years is healthy. Capital gain: ${StockProfitCalc.formatCurrency(r.capitalGainNet)}, dividends: ${StockProfitCalc.formatCurrency(r.dividendNet)}.`;
      } else {
        msg = `📊 <strong>Modest gains.</strong> Your ${r.annualizedRoi.toFixed(1)}% annualized return is below market average. Consider longer holds or higher-yield positions.`;
      }
    } else {
      msg = `📉 <strong>Loss detected.</strong> You lost <strong>${StockProfitCalc.formatCurrency(Math.abs(r.netProfit))}</strong> (${r.roi.toFixed(1)}% of cost basis). If held &lt;1 year this is a short-term loss (fully deductible). If &gt;1 year, you can offset up to $3,000/yr against ordinary income.`;
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
    // Force Chart.js to re-measure canvas now that tab is visible
    requestAnimationFrame(() => {
      if (targetId === 'tabWaterfallChart' && ChartManager.waterfallChart) ChartManager.waterfallChart.resize();
      if (targetId === 'tabGrowthChart' && ChartManager.growthChart) ChartManager.growthChart.resize();
      if (targetId === 'tabBreakdownChart' && ChartManager.breakdownChart) ChartManager.breakdownChart.resize();
    });
  },

  animateValue(element, target, isCurrency) {
    if (!element) return;
    if (window.CompoundPro?.CounterAnimation) {
      window.CompoundPro.CounterAnimation.animate(element, target, isCurrency, 800);
    } else {
      element.textContent = isCurrency ? StockProfitCalc.formatCurrency(target) : target.toLocaleString();
    }
  },

  reset() {
    const defaults = {
      buyPrice: 100, sellPrice: 150, quantity: 50, dividend: 2, years: 3,
      commission: 0, taxRate: 15, dividendTax: 15
    };
    this.elements.buyPrice.value = defaults.buyPrice;
    this.elements.sellPrice.value = defaults.sellPrice;
    this.elements.quantity.value = defaults.quantity;
    this.elements.dividend.value = defaults.dividend;
    this.elements.years.value = defaults.years;
    if (this.elements.commission) this.elements.commission.value = defaults.commission;
    if (this.elements.taxRate) this.elements.taxRate.value = defaults.taxRate;
    if (this.elements.dividendTax) this.elements.dividendTax.value = defaults.dividendTax;
    if (this.elements.sellPriceSlider) this.elements.sellPriceSlider.value = 150;
    if (this.elements.quantitySlider) this.elements.quantitySlider.value = 50;
    if (this.elements.dividendSlider) this.elements.dividendSlider.value = 2;
    if (this.elements.yearsSlider) this.elements.yearsSlider.value = 3;
    this.syncSliders();
    this.calculate();
  },

  share() {
    if (!this.currentInputs) return;
    const state = StockProfitCalc.encodeState(this.currentInputs);
    const url = window.location.origin + window.location.pathname + '#' + state;
    navigator.clipboard.writeText(url).then(() => {
      if (window.CompoundPro?.showToast) {
        window.CompoundPro.showToast('Link copied to clipboard!', 'success');
      } else {
        alert('Link copied!');
      }
    }).catch(() => {
      prompt('Copy this link:', url);
    });
  }
};


// ============== INIT ==============
document.addEventListener('DOMContentLoaded', () => {
  // Wait for layout-loader and core.js to finish
  if (document.readyState === 'complete') {
    UIController.init();
  } else {
    window.addEventListener('load', () => UIController.init());
  }
});
