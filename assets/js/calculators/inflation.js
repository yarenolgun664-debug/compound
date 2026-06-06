/**
 * CompoundPro - Inflation Calculator Engine
 */

const InflationCalc = {
  calculate(amount, startYear, endYear, rate, investmentRate = 0) {
    if (amount < 0) throw new Error("Amount cannot be negative.");
    if (rate < 0 || rate > 100) throw new Error("Inflation rate must be between 0% and 100%.");
    
    const years = Math.abs(endYear - startYear);
    const r = rate / 100;
    
    // Future inflation equivalent or past purchasing power
    let equivalentAmount = amount;
    let powerLossPct = 0;
    let powerLossAmount = 0;

    if (endYear >= startYear) {
      // Forward calculation (Future Value of prices / degradation of money)
      equivalentAmount = amount * Math.pow(1 + r, years);
      // Purchasing power of $Amount today in target year:
      const futurePurchasingPower = amount / Math.pow(1 + r, years);
      powerLossAmount = amount - futurePurchasingPower;
      powerLossPct = (powerLossAmount / amount) * 100;
    } else {
      // Backward calculation (what today's amount was worth in the past)
      equivalentAmount = amount / Math.pow(1 + r, years);
      powerLossAmount = amount - equivalentAmount;
      powerLossPct = (powerLossAmount / amount) * 100;
    }

    // Real Return calculation
    // Adjusted Return = (1 + InvestmentRate) / (1 + InflationRate) - 1
    const ir = investmentRate / 100;
    const realReturnRate = ((1 + ir) / (1 + r) - 1) * 100;

    // Generate yearly erosion chart data
    const yearlyData = [];
    for (let t = 0; t <= years; t++) {
      const remainingPower = 100 / Math.pow(1 + r, t);
      yearlyData.push({
        year: startYear + (endYear >= startYear ? t : -t),
        relativeYear: t,
        purchasingPowerPct: remainingPower,
        value: amount / Math.pow(1 + r, t)
      });
    }

    return {
      equivalentAmount,
      powerLossAmount,
      powerLossPct,
      realReturnRate,
      years,
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

    inputs.mode = params.get('m') || 'future';
    inputs.amount = parseField('a', 1000);
    inputs.startYear = parseField('s', new Date().getFullYear());
    inputs.endYear = parseField('e', new Date().getFullYear() + 20);
    inputs.rate = parseField('r', 3.2, true);
    inputs.investmentRate = parseField('ir', 7.0, true);

    return inputs;
  }
};

const ChartManager = {
  erosionChart: null,

  renderErosionChart(yearlyData) {
    const ctx = document.getElementById('erosionChartCanvas');
    if (!ctx) return;

    if (this.erosionChart) {
      this.erosionChart.destroy();
    }

    const labels = yearlyData.map(d => `Yr ${d.relativeYear} (${d.year})`);
    const dataPoints = yearlyData.map(d => d.purchasingPowerPct);

    // Color interpolation: HSL Emerald (160, 84%, 39%) to Orange (24, 94%, 53%)
    const backgroundColors = yearlyData.map(d => {
      const fraction = d.relativeYear / (yearlyData.length - 1 || 1);
      const h = 160 - (fraction * 136); // 160 -> 24
      const s = 84 + (fraction * 10);   // 84 -> 94
      const l = 39 + (fraction * 14);   // 39 -> 53
      return `hsl(${h}, ${s}%, ${l}%)`;
    });

    this.erosionChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Purchasing Power Value (%)',
          data: dataPoints,
          backgroundColor: backgroundColors,
          borderWidth: 0,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              callback: val => val + '%'
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: context => {
                const val = context.raw.toFixed(1);
                return `Value: ${val}% of initial purchasing power`;
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
      inputs = InflationCalc.decodeState(hash);
    } else {
      inputs = window.loadCalcInputs('inflation');
    }

    if (inputs) {
      this.applyInputs(inputs);
    }

    this.calculate();
  },

  bindEvents() {
    const modeBtns = document.querySelectorAll('.mode-toggle-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const mode = btn.getAttribute('data-mode');
        document.getElementById('calcMode').value = mode;

        this.updateYearFields(mode);
        this.calculate();
      });
    });

    const fields = ['amount', 'startYear', 'endYear', 'rate', 'investmentRate'];
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

    // Preset buttons
    const presets = document.querySelectorAll('.preset-btn');
    presets.forEach(p => {
      p.addEventListener('click', (e) => {
        e.preventDefault();
        const rateVal = parseFloat(p.getAttribute('data-rate'));
        document.getElementById('rate').value = rateVal;
        this.syncInputToSlider('rate');
        this.calculate();
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
  },

  updateYearFields(mode) {
    const curYear = new Date().getFullYear();
    const startYearInput = document.getElementById('startYear');
    const startYearSlider = document.getElementById('startYearSlider');
    const endYearInput = document.getElementById('endYear');
    const endYearSlider = document.getElementById('endYearSlider');

    if (mode === 'past') {
      startYearInput.value = curYear - 20;
      startYearSlider.value = curYear - 20;
      endYearInput.value = curYear;
      endYearSlider.value = curYear;
    } else if (mode === 'future') {
      startYearInput.value = curYear;
      startYearSlider.value = curYear;
      endYearInput.value = curYear + 20;
      endYearSlider.value = curYear + 20;
    }
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
    document.getElementById('calcMode').value = inputs.mode;
    const modeBtns = document.querySelectorAll('.mode-toggle-btn');
    modeBtns.forEach(b => {
      if (b.getAttribute('data-mode') === inputs.mode) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    document.getElementById('amount').value = inputs.amount;
    this.syncInputToSlider('amount');

    document.getElementById('startYear').value = inputs.startYear;
    this.syncInputToSlider('startYear');

    document.getElementById('endYear').value = inputs.endYear;
    this.syncInputToSlider('endYear');

    document.getElementById('rate').value = inputs.rate;
    this.syncInputToSlider('rate');

    document.getElementById('investmentRate').value = inputs.investmentRate;
    this.syncInputToSlider('investmentRate');
  },

  getInputs() {
    return {
      mode: document.getElementById('calcMode').value || 'future',
      amount: parseFloat(document.getElementById('amount').value) || 0,
      startYear: parseInt(document.getElementById('startYear').value, 10) || 2026,
      endYear: parseInt(document.getElementById('endYear').value, 10) || 2046,
      rate: parseFloat(document.getElementById('rate').value) || 0,
      investmentRate: parseFloat(document.getElementById('investmentRate').value) || 0
    };
  },

  calculate() {
    try {
      const inputs = this.getInputs();
      
      const res = InflationCalc.calculate(
        inputs.amount,
        inputs.startYear,
        inputs.endYear,
        inputs.rate,
        inputs.investmentRate
      );

      // Show Results
      document.getElementById('resultsPlaceholder').style.display = 'none';
      document.getElementById('resultsPanel').style.display = 'flex';

      // Visual Comparison display
      const amountStr = InflationCalc.formatCurrency(inputs.amount);
      const equivStr = InflationCalc.formatCurrency(res.equivalentAmount);
      const comparisonText = document.getElementById('comparisonText');

      if (inputs.endYear >= inputs.startYear) {
        comparisonText.innerHTML = `<strong>${amountStr}</strong> in ${inputs.startYear} is equivalent to <strong style="color: var(--color-orange);">${equivStr}</strong> in ${inputs.endYear}.`;
      } else {
        comparisonText.innerHTML = `<strong>${amountStr}</strong> today has the same purchasing power as <strong style="color: var(--color-emerald);">${equivStr}</strong> in ${inputs.endYear}.`;
      }

      // Countups
      const Counter = window.CompoundPro?.CounterAnimation;
      const currency = (window.CompoundPro && window.CompoundPro.getCurrencyPrefixSuffix)
        ? window.CompoundPro.getCurrencyPrefixSuffix()
        : { prefix: '$', suffix: '' };
      if (Counter) {
        Counter.animateCounter(document.getElementById('powerLossAmount'), res.powerLossAmount, 1000, currency.prefix, currency.suffix, 0);
        Counter.animateCounter(document.getElementById('powerLossPct'), res.powerLossPct, 1000, "", "%", 1);
        Counter.animateCounter(document.getElementById('realReturnRate'), res.realReturnRate, 1000, "", "%", 1);
      } else {
        document.getElementById('powerLossAmount').textContent = InflationCalc.formatCurrency(res.powerLossAmount);
        document.getElementById('powerLossPct').textContent = res.powerLossPct.toFixed(1) + "%";
        document.getElementById('realReturnRate').textContent = res.realReturnRate.toFixed(1) + "%";
      }

      const realReturnLabel = document.getElementById('realReturnLabel');
      if (res.realReturnRate >= 0) {
        realReturnLabel.style.color = 'var(--color-emerald)';
        document.getElementById('realReturnCard').setAttribute('data-variant', 'emerald');
      } else {
        realReturnLabel.style.color = 'red';
        document.getElementById('realReturnCard').setAttribute('data-variant', 'orange');
      }

      // Render Bar Chart
      ChartManager.renderErosionChart(res.yearlyData);

      // URL Hash encoding
      const state = InflationCalc.encodeState({
        m: inputs.mode,
        a: inputs.amount,
        s: inputs.startYear,
        e: inputs.endYear,
        r: inputs.rate,
        ir: inputs.investmentRate
      });
      history.replaceState(null, '', '#' + state);
      window.saveCalcInputs('inflation', inputs);

    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast(e.message, "error");
    }
  },

  reset() {
    const defaults = {
      mode: 'future',
      amount: 1000,
      startYear: new Date().getFullYear(),
      endYear: new Date().getFullYear() + 20,
      rate: 3.2,
      investmentRate: 7.0
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
