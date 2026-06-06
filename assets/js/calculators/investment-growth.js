/**
 * CompoundPro - Investment Growth Calculator Engine
 */

const InvestmentCalc = {
  calculate(principal, rate, years, pmt, benchmarkRate) {
    if (principal < 0) throw new Error("Initial portfolio value cannot be negative.");
    if (rate < 0 || rate > 100) throw new Error("Annual return rate must be between 0% and 100%.");
    if (years <= 0 || years > 100) throw new Error("Investment horizon must be between 1 and 100 years.");
    if (pmt < 0) throw new Error("Annual contribution cannot be negative.");
    if (benchmarkRate < 0 || benchmarkRate > 100) throw new Error("Benchmark rate must be between 0% and 100%.");

    const r = rate / 100;
    const br = benchmarkRate / 100;

    let yourBalance = principal;
    let benchBalance = principal;
    let yourTotalContributions = principal;
    let benchTotalContributions = principal;

    const yearlyData = [];

    for (let year = 1; year <= years; year++) {
      const yourStart = yourBalance;
      const benchStart = benchBalance;

      // Contribution added at the start of each year
      yourBalance += pmt;
      benchBalance += pmt;
      yourTotalContributions += pmt;
      benchTotalContributions += pmt;

      // Calculate growth for the year
      const yourGrowth = yourBalance * r;
      const benchGrowth = benchBalance * br;

      yourBalance += yourGrowth;
      benchBalance += benchGrowth;

      yearlyData.push({
        year,
        yourStartBalance: yourStart,
        yourContributions: pmt,
        yourInterest: yourGrowth,
        yourEndBalance: yourBalance,
        benchStartBalance: benchStart,
        benchInterest: benchGrowth,
        benchEndBalance: benchBalance
      });
    }

    // CAGR = (End / Start)^(1 / n) - 1
    // Safe guard: if principal + total contributions == 0, CAGR is 0
    let cagr = 0;
    if (principal > 0) {
      cagr = (Math.pow(yourBalance / principal, 1 / years) - 1) * 100;
    }

    const difference = yourBalance - benchBalance;

    return {
      yourFinalValue: yourBalance,
      benchFinalValue: benchBalance,
      yourTotalContributions,
      cagr: cagr || rate, // fallback to expected rate if cagr calculation is mathematically invalid
      difference,
      yearlyData
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

    inputs.principal = parseField('p', 10000);
    inputs.rate = parseField('r', 7.0, true);
    inputs.years = parseField('y', 30);
    inputs.pmt = parseField('c', 1000);
    inputs.benchmarkRate = parseField('b', 10.7, true);

    return inputs;
  }
};

const ChartManager = {
  dualLineChart: null,
  breakdownChart: null,

  renderDualLineChart(yearlyData) {
    const ctx = document.getElementById('growthChartCanvas');
    if (!ctx) return;

    if (this.dualLineChart) {
      this.dualLineChart.destroy();
    }

    const labels = yearlyData.map(d => `Year ${d.year}`);
    const yourData = yearlyData.map(d => d.yourEndBalance);
    const benchData = yearlyData.map(d => d.benchEndBalance);

    this.dualLineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Your Portfolio',
            data: yourData,
            borderColor: '#F97316',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 5
          },
          {
            label: 'S&P 500 Benchmark',
            data: benchData,
            borderColor: '#38BDF8',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            grid: { color: 'rgba(226, 232, 240, 0.4)' },
            ticks: {
              font: { family: 'DM Sans' },
              callback: function(val, idx) {
                return idx % 5 === 0 || idx === yearlyData.length - 1 ? this.getLabelForValue(val) : '';
              }
            }
          },
          y: {
            grid: { color: 'rgba(226, 232, 240, 0.8)' },
            ticks: {
              font: { family: 'JetBrains Mono' },
              callback: val => {
                if (window.CompoundPro && window.CompoundPro.formatCurrency) {
                  return window.CompoundPro.formatCurrency(val);
                }
                return '$' + val.toLocaleString();
              }
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { family: 'DM Sans', weight: '500' } }
          },
          tooltip: {
            callbacks: {
              label: context => {
                const label = context.dataset.label || '';
                return `${label}: ${InvestmentCalc.formatCurrency(context.raw)}`;
              }
            }
          }
        }
      }
    });
  },

  renderBreakdownChart(yearlyData) {
    const ctx = document.getElementById('breakdownChartCanvas');
    if (!ctx) return;

    if (this.breakdownChart) {
      this.breakdownChart.destroy();
    }

    const labels = yearlyData.map(d => `Year ${d.year}`);
    const contribs = yearlyData.map(d => {
      // Cumulative contributions
      let total = 0;
      for (let i = 0; i < d.year; i++) {
        total += yearlyData[i].yourContributions;
      }
      return total + yearlyData[0].yourStartBalance;
    });
    const balances = yearlyData.map(d => d.yourEndBalance);
    const growth = balances.map((bal, idx) => Math.max(0, bal - contribs[idx]));

    this.breakdownChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Total Contributed',
            data: contribs,
            backgroundColor: '#38BDF8'
          },
          {
            label: 'Investment Growth',
            data: growth,
            backgroundColor: '#10B981'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            ticks: {
              callback: function(val, idx) {
                return idx % 5 === 0 || idx === yearlyData.length - 1 ? this.getLabelForValue(val) : '';
              }
            }
          },
          y: {
            stacked: true,
            ticks: {
              callback: val => {
                if (window.CompoundPro && window.CompoundPro.formatCurrency) {
                  return window.CompoundPro.formatCurrency(val);
                }
                return '$' + val.toLocaleString();
              }
            }
          }
        },
        plugins: {
          legend: { position: 'bottom' }
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
      inputs = InvestmentCalc.decodeState(hash);
    } else {
      inputs = window.loadCalcInputs('investment-growth');
    }

    if (inputs) {
      this.applyInputs(inputs);
    }

    this.calculate();
  },

  bindEvents() {
    const ids = ['principal', 'rate', 'years', 'pmt', 'benchmarkRate'];
    ids.forEach(id => {
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

    const presets = document.querySelectorAll('.rate-preset-btn');
    presets.forEach(p => {
      p.addEventListener('click', (e) => {
        e.preventDefault();
        const val = parseFloat(p.getAttribute('data-rate'));
        document.getElementById('rate').value = val;
        this.syncInputToSlider('rate');
        this.calculate();
      });
    });

    // Reset, Calculate, Tabs
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

    document.getElementById('downloadCsvBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.downloadCSV();
    });
  },

  syncInputToSlider(id) {
    const val = document.getElementById(id).value;
    const slider = document.getElementById(id + 'Slider');
    if (slider) {
      slider.value = val;
      if (typeof window.updateSliderFill === 'function') {
        window.updateSliderFill(slider);
      }
    }
  },

  syncSliderToInput(id) {
    const slider = document.getElementById(id + 'Slider');
    const input = document.getElementById(id);
    if (input) {
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
    for (const key in inputs) {
      const input = document.getElementById(key);
      if (input) {
        input.value = inputs[key];
        this.syncInputToSlider(key);
      }
    }
  },

  getInputs() {
    return {
      principal: parseFloat(document.getElementById('principal').value) || 0,
      rate: parseFloat(document.getElementById('rate').value) || 0,
      years: parseInt(document.getElementById('years').value, 10) || 1,
      pmt: parseFloat(document.getElementById('pmt').value) || 0,
      benchmarkRate: parseFloat(document.getElementById('benchmarkRate').value) || 0
    };
  },

  calculate() {
    try {
      const inputs = this.getInputs();
      const res = InvestmentCalc.calculate(
        inputs.principal,
        inputs.rate,
        inputs.years,
        inputs.pmt,
        inputs.benchmarkRate
      );

      // Show Results
      document.getElementById('resultsPlaceholder').style.display = 'none';
      document.getElementById('resultsPanel').style.display = 'flex';

      // Values count-up (or immediate fallback)
      const Counter = window.CompoundPro?.CounterAnimation;
      const currency = (window.CompoundPro && window.CompoundPro.getCurrencyPrefixSuffix)
        ? window.CompoundPro.getCurrencyPrefixSuffix()
        : { prefix: '$', suffix: '' };
      if (Counter) {
        Counter.animateCounter(document.getElementById('yourFinalValue'), res.yourFinalValue, 1000, currency.prefix, currency.suffix, 0);
        Counter.animateCounter(document.getElementById('benchFinalValue'), res.benchFinalValue, 1000, currency.prefix, currency.suffix, 0);
        Counter.animateCounter(document.getElementById('cagrValue'), res.cagr, 1000, "", "%", 1);
        
        // Difference
        const diffEl = document.getElementById('diffValue');
        const prefix = (res.difference >= 0 ? "+" : "-") + currency.prefix;
        const suffix = currency.suffix;
        Counter.animateCounter(diffEl, Math.abs(res.difference), 1000, prefix, suffix, 0);
      } else {
        document.getElementById('yourFinalValue').textContent = InvestmentCalc.formatCurrency(res.yourFinalValue);
        document.getElementById('benchFinalValue').textContent = InvestmentCalc.formatCurrency(res.benchFinalValue);
        document.getElementById('cagrValue').textContent = res.cagr.toFixed(1) + "%";
        
        const diffEl = document.getElementById('diffValue');
        diffEl.textContent = (res.difference >= 0 ? "+" : "") + InvestmentCalc.formatCurrency(res.difference);
      }

      const diffLabel = document.getElementById('diffLabel');
      if (res.difference >= 0) {
        diffLabel.style.color = 'var(--color-emerald)';
        document.getElementById('diffCard').setAttribute('data-variant', 'emerald');
      } else {
        diffLabel.style.color = 'red';
        document.getElementById('diffCard').setAttribute('data-variant', 'orange');
      }

      // Render Charts & Tables
      ChartManager.renderDualLineChart(res.yearlyData);
      ChartManager.renderBreakdownChart(res.yearlyData);
      this.renderTable(res.yearlyData);

      // Dynamic Insights
      this.renderInsights(res, inputs);

      // URL Hash encoding
      const state = InvestmentCalc.encodeState({
        p: inputs.principal,
        r: inputs.rate,
        y: inputs.years,
        c: inputs.pmt,
        b: inputs.benchmarkRate
      });
      history.replaceState(null, '', '#' + state);
      window.saveCalcInputs('investment-growth', inputs);

    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast(e.message, "error");
    }
  },

  renderTable(yearlyData) {
    const tbody = document.getElementById('yearlyTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    let totalContributed = yearlyData[0].yourStartBalance;

    yearlyData.forEach(row => {
      const tr = document.createElement('tr');
      if (row.year % 5 === 0) tr.style.backgroundColor = 'var(--color-surface-2)';
      if (row.year === yearlyData.length) {
        tr.style.backgroundColor = 'var(--color-emerald-10)';
        tr.style.fontWeight = 'bold';
      }

      totalContributed += row.yourContributions;

      tr.innerHTML = `
        <td>${row.year}</td>
        <td>${InvestmentCalc.formatCurrency(row.yourStartBalance)}</td>
        <td>${InvestmentCalc.formatCurrency(row.yourContributions)}</td>
        <td>${InvestmentCalc.formatCurrency(row.yourInterest)}</td>
        <td>${InvestmentCalc.formatCurrency(row.yourEndBalance)}</td>
        <td>${InvestmentCalc.formatCurrency(row.benchEndBalance)}</td>
      `;
      tbody.appendChild(tr);
    });

    this.cachedYearlyData = yearlyData;
  },

  renderInsights(res, inputs) {
    const box = document.getElementById('calcInsightBox');
    if (!box) return;

    const beating = res.difference >= 0;
    const diffStr = InvestmentCalc.formatCurrency(Math.abs(res.difference));
    const doubleYears = inputs.rate > 0 ? (72 / inputs.rate).toFixed(1) : '∞';

    box.innerHTML = `
      <div class="callout-icon">💡</div>
      <div class="callout-content">
        <div class="callout-title" style="margin-bottom: 8px;">Investment Growth Insights</div>
        <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 0.875rem;">
          <li>Your portfolio is projected to reach <strong>${InvestmentCalc.formatCurrency(res.yourFinalValue)}</strong> over ${inputs.years} years.</li>
          <li>At this rate, your capital doubles approximately every <strong>${doubleYears} years</strong>.</li>
          <li>You are ${beating ? '<strong>outperforming</strong>' : '<strong>underperforming</strong>'} the S&P 500 benchmark (${inputs.benchmarkRate}%) by <strong>${diffStr}</strong>.</li>
        </ul>
      </div>
    `;
  },

  downloadCSV() {
    const data = this.cachedYearlyData;
    if (!data) return;

    let csv = "data:text/csv;charset=utf-8,";
    csv += "Year,Your Start Balance,Contributions,Your Interest,Your End Balance,Benchmark End Balance\n";

    data.forEach(row => {
      csv += `${row.year},${row.yourStartBalance.toFixed(2)},${row.yourContributions.toFixed(2)},${row.yourInterest.toFixed(2)},${row.yourEndBalance.toFixed(2)},${row.benchEndBalance.toFixed(2)}\n`;
    });

    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = "portfolio_growth_projection.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  reset() {
    const defaults = {
      principal: 10000,
      rate: 7.0,
      years: 30,
      pmt: 1000,
      benchmarkRate: 10.7
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
