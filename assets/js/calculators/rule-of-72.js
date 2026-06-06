/**
 * CompoundPro - Rule of 72 Calculator Engine
 */

const Rule72Calc = {
  calculateDoublingTime(rate) {
    if (rate <= 0 || rate > 100) throw new Error("Annual return rate must be between 0.1% and 100%.");
    
    const doublingTimeYears = 72 / rate;
    const years = Math.floor(doublingTimeYears);
    const months = Math.round((doublingTimeYears - years) * 12);
    
    // Exact doubling calculation using compound interest formula:
    // 2 = (1 + r)^t => t = ln(2)/ln(1 + r)
    const exactYears = Math.log(2) / Math.log(1 + rate / 100);

    return {
      years,
      months,
      doublingTimeYears,
      exactYears
    };
  },

  calculateRequiredRate(years) {
    if (years <= 0 || years > 100) throw new Error("Desired doubling time must be between 1 and 100 years.");
    
    const requiredRate = 72 / years;
    
    // Exact rate calculation:
    // 2 = (1 + r)^t => r = 2^(1/t) - 1
    const exactRate = (Math.pow(2, 1 / years) - 1) * 100;

    return {
      requiredRate,
      exactRate
    };
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
    inputs.mode = params.get('m') || 'doubling';
    inputs.rate = parseFloat(params.get('r')) || 7.0;
    inputs.years = parseFloat(params.get('y')) || 10.0;
    return inputs;
  }
};

const UIController = {
  init() {
    this.bindEvents();

    let inputs = null;
    const hash = window.location.hash.substring(1);
    if (hash) {
      inputs = Rule72Calc.decodeState(hash);
    } else {
      inputs = window.loadCalcInputs('rule-of-72');
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

        if (mode === 'doubling') {
          document.getElementById('fieldRate').style.display = 'block';
          document.getElementById('fieldYears').style.display = 'none';
        } else {
          document.getElementById('fieldRate').style.display = 'none';
          document.getElementById('fieldYears').style.display = 'block';
        }

        this.calculate();
      });
    });

    const inputs = ['rate', 'years'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          this.syncInputToSlider(id);
          this.calculate();
        });
      }
      const slider = document.getElementById(id + 'Slider');
      if (slider) {
        slider.addEventListener('input', () => {
          this.syncSliderToInput(id);
          this.calculate();
        });
      }
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

    if (inputs.mode === 'doubling') {
      document.getElementById('fieldRate').style.display = 'block';
      document.getElementById('fieldYears').style.display = 'none';
    } else {
      document.getElementById('fieldRate').style.display = 'none';
      document.getElementById('fieldYears').style.display = 'block';
    }

    document.getElementById('rate').value = inputs.rate;
    this.syncInputToSlider('rate');

    document.getElementById('years').value = inputs.years;
    this.syncInputToSlider('years');
  },

  getInputs() {
    return {
      mode: document.getElementById('calcMode').value || 'doubling',
      rate: parseFloat(document.getElementById('rate').value) || 7.0,
      years: parseFloat(document.getElementById('years').value) || 10.0
    };
  },

  calculate() {
    try {
      const inputs = this.getInputs();
      
      // Show Results Panel
      document.getElementById('resultsPlaceholder').style.display = 'none';
      document.getElementById('resultsPanel').style.display = 'flex';

      const resultsText = document.getElementById('resultsText');
      const timelineContainer = document.getElementById('timelineContainer');
      
      let doubleYears = 0;
      let displayRate = 0;

      if (inputs.mode === 'doubling') {
        const res = Rule72Calc.calculateDoublingTime(inputs.rate);
        doubleYears = res.doublingTimeYears;
        displayRate = inputs.rate;

        resultsText.innerHTML = `
          Your money doubles in <strong style="color: var(--color-orange);">${res.years} years</strong> and <strong style="color: var(--color-orange);">${res.months} months</strong>.
          <div style="font-size: 0.8125rem; color: var(--color-muted); margin-top: 8px;">
            Exact compounding doubling time is <strong>${res.exactYears.toFixed(2)} years</strong>.
          </div>
        `;
        
        this.highlightTableRows(inputs.rate);
      } else {
        const res = Rule72Calc.calculateRequiredRate(inputs.years);
        doubleYears = inputs.years;
        displayRate = res.requiredRate;

        resultsText.innerHTML = `
          You need an annual return rate of <strong style="color: var(--color-emerald);">${res.requiredRate.toFixed(2)}%</strong>.
          <div style="font-size: 0.8125rem; color: var(--color-muted); margin-top: 8px;">
            Exact required rate is <strong>${res.exactRate.toFixed(2)}%</strong> (including compound cycles).
          </div>
        `;

        this.highlightTableRows(res.requiredRate);
      }

      // Render Visual Timeline
      this.renderTimeline(doubleYears);

      // URL Hash encoding
      const state = Rule72Calc.encodeState({
        m: inputs.mode,
        r: inputs.rate,
        y: inputs.years
      });
      history.replaceState(null, '', '#' + state);
      window.saveCalcInputs('rule-of-72', inputs);

    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast(e.message, "error");
    }
  },

  renderTimeline(doubleYears) {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    container.innerHTML = '';
    
    // We want 5 milestones: $10k -> $20k -> $40k -> $80k -> $160k
    const milestones = [
      { balance: 10000, year: 0 },
      { balance: 20000, year: doubleYears },
      { balance: 40000, year: doubleYears * 2 },
      { balance: 80000, year: doubleYears * 3 },
      { balance: 160000, year: doubleYears * 4 }
    ];

    const ul = document.createElement('ul');
    ul.style.display = 'flex';
    ul.style.justifyContent = 'space-between';
    ul.style.alignItems = 'center';
    ul.style.listStyle = 'none';
    ul.style.padding = '20px 0';
    ul.style.position = 'relative';
    ul.style.width = '100%';
    ul.style.overflowX = 'auto';

    // Connecting horizontal line
    const progressLine = document.createElement('div');
    progressLine.style.position = 'absolute';
    progressLine.style.top = '50%';
    progressLine.style.left = '10px';
    progressLine.style.right = '10px';
    progressLine.style.height = '4px';
    progressLine.style.backgroundColor = 'var(--color-border)';
    progressLine.style.zIndex = '1';
    progressLine.style.transform = 'translateY(-50%)';
    ul.appendChild(progressLine);

    milestones.forEach((m, idx) => {
      const li = document.createElement('li');
      li.style.position = 'relative';
      li.style.zIndex = '2';
      li.style.textAlign = 'center';
      li.style.display = 'flex';
      li.style.flexDirection = 'column';
      li.style.alignItems = 'center';
      li.style.gap = '8px';

      const dot = document.createElement('div');
      dot.style.width = '20px';
      dot.style.height = '20px';
      dot.style.borderRadius = '50%';
      dot.style.backgroundColor = idx === 0 ? 'var(--color-orange)' : 'var(--color-emerald)';
      dot.style.border = '4px solid var(--color-white)';
      dot.style.boxShadow = 'var(--shadow-sm)';

      const balanceLabel = document.createElement('span');
      balanceLabel.style.fontFamily = 'var(--font-mono)';
      balanceLabel.style.fontWeight = 'bold';
      balanceLabel.style.fontSize = '0.875rem';
      const currency = (window.CompoundPro && window.CompoundPro.getCurrencyPrefixSuffix) 
        ? window.CompoundPro.getCurrencyPrefixSuffix() 
        : { prefix: '$', suffix: '' };
      balanceLabel.textContent = `${currency.prefix}${(m.balance / 1000)}k${currency.suffix}`;

      const yearLabel = document.createElement('span');
      yearLabel.style.fontFamily = 'var(--font-body)';
      yearLabel.style.fontSize = '0.75rem';
      yearLabel.style.color = 'var(--color-muted)';
      yearLabel.textContent = idx === 0 ? 'Start' : `Yr ${m.year.toFixed(1)}`;

      li.appendChild(balanceLabel);
      li.appendChild(dot);
      li.appendChild(yearLabel);

      ul.appendChild(li);
    });

    container.appendChild(ul);
  },

  highlightTableRows(currentRate) {
    const rows = document.querySelectorAll('.reference-table-row');
    rows.forEach(row => {
      const rowRate = parseFloat(row.getAttribute('data-rate'));
      if (Math.round(currentRate) === rowRate) {
        row.style.backgroundColor = 'var(--color-orange-10)';
        row.style.fontWeight = 'bold';
      } else {
        row.style.backgroundColor = '';
        row.style.fontWeight = 'normal';
      }
    });
  },

  reset() {
    const defaults = {
      mode: 'doubling',
      rate: 7.0,
      years: 10.0
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
