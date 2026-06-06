/**
 * CompoundPro - Lump Sum vs DCA Calculator Engine
 */

const LsdcaCalc = {
  calculate(totalAmount, periodMonths, rate, interval) {
    if (totalAmount < 0) throw new Error("Total amount cannot be negative.");
    if (periodMonths <= 0 || periodMonths > 120) throw new Error("Investment period must be between 1 and 120 months.");
    if (rate < 0 || rate > 100) throw new Error("Annual return must be between 0% and 100%.");

    const r = rate / 100;
    const monthlyRate = r / 12;

    // 1. Simulate Lump Sum
    let lsBalance = totalAmount;
    const lsHistory = [];
    for (let m = 1; m <= periodMonths; m++) {
      const start = lsBalance;
      const interest = lsBalance * monthlyRate;
      lsBalance += interest;
      lsHistory.push({
        month: m,
        balance: lsBalance,
        gains: lsBalance - totalAmount
      });
    }

    // 2. Simulate DCA
    let dcaBalance = 0;
    let cashBalance = totalAmount;
    const dcaHistory = [];
    
    // Determine payment frequency and intervals
    let steps = periodMonths;
    let ratePerStep = monthlyRate;
    let paymentsCount = periodMonths;
    
    if (interval === 'quarterly') {
      paymentsCount = Math.ceil(periodMonths / 3);
    } else if (interval === 'weekly') {
      paymentsCount = Math.round(periodMonths * 4.33);
      ratePerStep = r / 52;
      steps = paymentsCount;
    }

    const pmt = totalAmount / paymentsCount;

    if (interval === 'weekly') {
      // Weekly simulation
      let currentWeek = 0;
      let dcaWeeklyBalance = 0;
      for (let w = 1; w <= paymentsCount; w++) {
        // Add payment at start of week
        dcaWeeklyBalance += pmt;
        cashBalance -= pmt;

        // Interest compounding
        const interest = dcaWeeklyBalance * ratePerStep;
        dcaWeeklyBalance += interest;

        // Map back to monthly history (every 4.33 weeks roughly)
        if (w % 4 === 0 || w === paymentsCount) {
          const currentMonth = Math.round(w / 4.33) || 1;
          if (currentMonth <= periodMonths) {
            dcaHistory[currentMonth - 1] = {
              month: currentMonth,
              balance: dcaWeeklyBalance + Math.max(0, cashBalance),
              invested: totalAmount - Math.max(0, cashBalance)
            };
          }
        }
      }
      dcaBalance = dcaWeeklyBalance;
      
      // Clean up dcaHistory array gaps
      for (let i = 0; i < periodMonths; i++) {
        if (!dcaHistory[i]) {
          dcaHistory[i] = i > 0 ? { ...dcaHistory[i - 1], month: i + 1 } : { month: 1, balance: 0, invested: 0 };
        }
      }
    } else {
      // Monthly or Quarterly simulation
      for (let m = 1; m <= periodMonths; m++) {
        let isPaymentPeriod = false;
        if (interval === 'monthly') {
          isPaymentPeriod = true;
        } else if (interval === 'quarterly' && (m - 1) % 3 === 0) {
          isPaymentPeriod = true;
        }

        if (isPaymentPeriod && cashBalance > 0) {
          dcaBalance += pmt;
          cashBalance -= pmt;
        }

        const interest = dcaBalance * monthlyRate;
        dcaBalance += interest;

        dcaHistory.push({
          month: m,
          balance: dcaBalance + Math.max(0, cashBalance),
          invested: totalAmount - Math.max(0, cashBalance)
        });
      }
    }

    const lsGains = lsBalance - totalAmount;
    const dcaGains = dcaBalance - totalAmount;

    const lsReturnPct = (lsGains / totalAmount) * 100;
    const dcaReturnPct = (dcaGains / totalAmount) * 100;

    const difference = lsBalance - dcaBalance;
    const winner = difference >= 0 ? 'lump-sum' : 'dca';

    // Build monthly comparison data
    const monthlyData = [];
    for (let i = 0; i < periodMonths; i++) {
      monthlyData.push({
        month: i + 1,
        lsBalance: lsHistory[i].balance,
        dcaBalance: dcaHistory[i].balance,
        lsGains: lsHistory[i].gains,
        dcaGains: dcaHistory[i].balance - totalAmount
      });
    }

    return {
      lsFinalValue: lsBalance,
      lsGains,
      lsReturnPct,
      dcaFinalValue: dcaBalance,
      dcaGains,
      dcaReturnPct,
      difference: Math.abs(difference),
      winner,
      pmtAmount: pmt,
      monthlyData
    };
  },

  formatCurrency(value) {
    if (window.CompoundPro && window.CompoundPro.formatCurrency) {
      return window.CompoundPro.formatCurrency(value);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  },

  encodeState(inputs) {
    const params = new URLSearchParams();
    for (const key in inputs) {
      params.set(key, inputs[key]);
    }
    return params.toString();
  },

  decodeState(hash) {
    const params = new URLSearchParams(hash);
    const inputs = {};
    const parseField = (name, defaultValue, isFloat = false) => {
      const val = params.get(name);
      if (val === null) return defaultValue;
      const parsed = isFloat ? parseFloat(val) : parseInt(val, 10);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    inputs.totalAmount = parseField('a', 12000);
    inputs.periodMonths = parseField('p', 12);
    inputs.rate = parseField('r', 10.0, true);
    inputs.interval = params.get('i') || 'monthly';

    return inputs;
  }
};

const ChartManager = {
  comparisonChart: null,
  barChart: null,

  renderComparisonChart(monthlyData) {
    const ctx = document.getElementById('comparisonChartCanvas');
    if (!ctx) return;

    if (this.comparisonChart) {
      this.comparisonChart.destroy();
    }

    const labels = monthlyData.map(d => `Month ${d.month}`);
    const lsValues = monthlyData.map(d => d.lsBalance);
    const dcaValues = monthlyData.map(d => d.dcaBalance);

    this.comparisonChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Lump Sum Strategy',
            data: lsValues,
            borderColor: '#F97316',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            fill: true,
            tension: 0.1
          },
          {
            label: 'DCA Strategy',
            data: dcaValues,
            borderColor: '#38BDF8',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            fill: true,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            ticks: {
              callback: val => {
                if (window.CompoundPro && window.CompoundPro.formatCurrency) {
                  return window.CompoundPro.formatCurrency(val);
                }
                return '$' + val.toLocaleString();
              }
            }
          }
        }
      }
    });
  },

  renderBarChart(lsFinal, dcaFinal) {
    const ctx = document.getElementById('barChartCanvas');
    if (!ctx) return;

    if (this.barChart) {
      this.barChart.destroy();
    }

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Lump Sum', 'Dollar-Cost Averaging'],
        datasets: [{
          label: 'Final Value Comparison',
          data: [lsFinal, dcaFinal],
          backgroundColor: ['#F97316', '#38BDF8'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            ticks: {
              callback: val => {
                if (window.CompoundPro && window.CompoundPro.formatCurrency) {
                  return window.CompoundPro.formatCurrency(val);
                }
                return '$' + val.toLocaleString();
              }
            }
          }
        }
      }
    });
  }
};

const UIController = {
  debounceTimer: null,

  init() {
    this.bindEvents();

    let inputs = null;
    const hash = window.location.hash.substring(1);
    if (hash) {
      inputs = LsdcaCalc.decodeState(hash);
    } else {
      inputs = window.loadCalcInputs('lump-sum-dca');
    }

    if (inputs) {
      this.applyInputs(inputs);
    }

    this.calculate();
  },

  bindEvents() {
    const fields = ['totalAmount', 'periodMonths', 'rate'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          this.syncInputToSlider(id);
          this.debouncedCalculate();
        });
      }
      const slider = document.getElementById(id + 'Slider');
      if (slider) {
        slider.addEventListener('input', () => {
          this.syncSliderToInput(id);
          this.debouncedCalculate();
        });
      }
    });

    const intervals = document.querySelectorAll('[data-interval]');
    intervals.forEach(btn => {
      btn.addEventListener('click', () => {
        intervals.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('interval').value = btn.getAttribute('data-interval');
        this.debouncedCalculate();
      });
    });

    document.getElementById('calculateBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.calculate();
    });

    document.getElementById('resetBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.reset();
    });

    const tabs = document.querySelectorAll('.calc-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab-target');
        document.querySelectorAll('.calc-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
      });
    });
  },

  syncInputToSlider(id) {
    const input = document.getElementById(id);
    const slider = document.getElementById(id + 'Slider');
    if (input && slider) {
      slider.value = input.value;
      if (typeof window.updateSliderFill === 'function') {
        window.updateSliderFill(slider);
      }
    }
  },

  syncSliderToInput(id) {
    const slider = document.getElementById(id + 'Slider');
    const input = document.getElementById(id);
    if (slider && input) {
      input.value = slider.value;
      if (typeof window.updateSliderFill === 'function') {
        window.updateSliderFill(slider);
      }
    }
  },

  debouncedCalculate() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.calculate(), 250);
  },

  applyInputs(inputs) {
    document.getElementById('totalAmount').value = inputs.totalAmount;
    this.syncInputToSlider('totalAmount');

    document.getElementById('periodMonths').value = inputs.periodMonths;
    this.syncInputToSlider('periodMonths');

    document.getElementById('rate').value = inputs.rate;
    this.syncInputToSlider('rate');

    document.getElementById('interval').value = inputs.interval;
    const btns = document.querySelectorAll('[data-interval]');
    btns.forEach(b => {
      if (b.getAttribute('data-interval') === inputs.interval) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  },

  getInputs() {
    return {
      totalAmount: parseFloat(document.getElementById('totalAmount').value) || 0,
      periodMonths: parseInt(document.getElementById('periodMonths').value, 10) || 1,
      rate: parseFloat(document.getElementById('rate').value) || 0,
      interval: document.getElementById('interval').value || 'monthly'
    };
  },

  calculate() {
    try {
      const inputs = this.getInputs();
      const res = LsdcaCalc.calculate(
        inputs.totalAmount,
        inputs.periodMonths,
        inputs.rate,
        inputs.interval
      );

      // Display Amount per interval hints
      const freqLabel = inputs.interval === 'monthly' ? 'month' : inputs.interval === 'quarterly' ? 'quarter' : 'week';
      document.getElementById('dcaHintText').innerHTML = `This means <strong>${LsdcaCalc.formatCurrency(res.pmtAmount)}</strong> per ${freqLabel}.`;

      // Results Panel
      document.getElementById('resultsPlaceholder').style.display = 'none';
      document.getElementById('resultsPanel').style.display = 'flex';

      // Countups
      const Counter = window.CompoundPro?.CounterAnimation;
      const currency = (window.CompoundPro && window.CompoundPro.getCurrencyPrefixSuffix)
        ? window.CompoundPro.getCurrencyPrefixSuffix()
        : { prefix: '$', suffix: '' };
      if (Counter) {
        Counter.animateCounter(document.getElementById('lsFinalValue'), res.lsFinalValue, 1000, currency.prefix, currency.suffix, 0);
        Counter.animateCounter(document.getElementById('lsGains'), res.lsGains, 1000, currency.prefix, currency.suffix, 0);
        Counter.animateCounter(document.getElementById('lsReturnPct'), res.lsReturnPct, 1000, "", "%", 1);

        Counter.animateCounter(document.getElementById('dcaFinalValue'), res.dcaFinalValue, 1000, currency.prefix, currency.suffix, 0);
        Counter.animateCounter(document.getElementById('dcaGains'), res.dcaGains, 1000, currency.prefix, currency.suffix, 0);
        Counter.animateCounter(document.getElementById('dcaReturnPct'), res.dcaReturnPct, 1000, "", "%", 1);
      } else {
        document.getElementById('lsFinalValue').textContent = LsdcaCalc.formatCurrency(res.lsFinalValue);
        document.getElementById('lsGains').textContent = LsdcaCalc.formatCurrency(res.lsGains);
        document.getElementById('lsReturnPct').textContent = res.lsReturnPct.toFixed(1) + "%";

        document.getElementById('dcaFinalValue').textContent = LsdcaCalc.formatCurrency(res.dcaFinalValue);
        document.getElementById('dcaGains').textContent = LsdcaCalc.formatCurrency(res.dcaGains);
        document.getElementById('dcaReturnPct').textContent = res.dcaReturnPct.toFixed(1) + "%";
      }

      // Winner Badge
      const winnerBadge = document.getElementById('winnerBadge');
      const diffStr = LsdcaCalc.formatCurrency(res.difference);
      if (res.winner === 'lump-sum') {
        winnerBadge.className = 'callout callout-orange';
        winnerBadge.innerHTML = `
          <div class="callout-icon">🏆</div>
          <div class="callout-content">
            <div class="callout-title">Lump Sum Wins by ${diffStr}!</div>
            <div class="callout-text">Investing your capital today gains more compound cycles. Lump sum outperforms DCA roughly 66% of the time.</div>
          </div>
        `;
      } else {
        winnerBadge.className = 'callout callout-emerald';
        winnerBadge.innerHTML = `
          <div class="callout-icon">🏆</div>
          <div class="callout-content">
            <div class="callout-title">DCA Wins by ${diffStr}!</div>
            <div class="callout-text">DCA outperformed lump sum in this scenario, mitigating downside exposure during compounding phases.</div>
          </div>
        `;
      }

      // Render Charts & Tables
      ChartManager.renderComparisonChart(res.monthlyData);
      ChartManager.renderBarChart(res.lsFinalValue, res.dcaFinalValue);
      this.renderTable(res.monthlyData, inputs.totalAmount);

      // URL Hash encoding
      const state = LsdcaCalc.encodeState({
        a: inputs.totalAmount,
        p: inputs.periodMonths,
        r: inputs.rate,
        i: inputs.interval
      });
      history.replaceState(null, '', '#' + state);
      window.saveCalcInputs('lump-sum-dca', inputs);

    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast(e.message, "error");
    }
  },

  renderTable(monthlyData, totalAmount) {
    const tbody = document.getElementById('yearlyTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    monthlyData.forEach(row => {
      const tr = document.createElement('tr');
      if (row.month % 3 === 0) tr.style.backgroundColor = 'var(--color-surface-2)';
      if (row.month === monthlyData.length) {
        tr.style.backgroundColor = 'var(--color-emerald-10)';
        tr.style.fontWeight = 'bold';
      }

      tr.innerHTML = `
        <td>Month ${row.month}</td>
        <td>${LsdcaCalc.formatCurrency(row.lsBalance)}</td>
        <td>${LsdcaCalc.formatCurrency(row.lsGains)}</td>
        <td>${LsdcaCalc.formatCurrency(row.dcaBalance)}</td>
        <td>${LsdcaCalc.formatCurrency(row.dcaGains)}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  reset() {
    const defaults = {
      totalAmount: 12000,
      periodMonths: 12,
      rate: 10.0,
      interval: 'monthly'
    };
    this.applyInputs(defaults);
    this.calculate();
  }
};

document.addEventListener('DOMContentLoaded', () => UIController.init());

document.addEventListener('currencyChanged', () => {
  if (typeof UIController !== 'undefined' && UIController.calculate) {
    UIController.calculate();
  }
});
