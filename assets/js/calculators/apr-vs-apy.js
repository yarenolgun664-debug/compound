/**
 * CompoundPro - APR vs APY Converter Engine & UI Controller
 * Theme: Compound Interest (shared CSS, calc-inputs, calc-results)
 * Unique: Bar chart (APR vs APY) + Line chart (compounding curve) + frequency comparison table
 */

const AprApyCalc = {
  // ============== CORE CALCULATION ==============
  // APY = (1 + APR/n)^n - 1
  calculate(apr, n) {
    if (apr < 0 || apr > 100) throw new Error("APR must be between 0% and 100%.");
    if (n <= 0 || n > 365) throw new Error("Invalid compounding frequency.");
    const r = apr / 100;
    const apy = (Math.pow(1 + r / n, n) - 1) * 100;
    const periodRate = (Math.pow(1 + r / n, 1) - 1) * 100;
    const diff = apy - apr;
    return { apr, n, apy, diff, periodRate };
  },

  formatCurrency(value) {
    if (window.CompoundPro?.formatCurrency) return window.CompoundPro.formatCurrency(value);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  },

  // Compare all frequencies for a given APR
  compareFrequencies(apr) {
    const freqs = [
      { name: 'Annually', n: 1, label: '1× / year' },
      { name: 'Semi-Annually', n: 2, label: '2× / year' },
      { name: 'Quarterly', n: 4, label: '4× / year' },
      { name: 'Monthly', n: 12, label: '12× / year' },
      { name: 'Daily', n: 365, label: '365× / year' }
    ];
    return freqs.map(f => {
      const r = apr / 100;
      const apy = (Math.pow(1 + r / f.n, f.n) - 1) * 100;
      return { ...f, apy, diff: apy - apr };
    });
  },

  // Generate compounding curve (yearly value for $1000 over 10 years)
  generateCompoundingCurve(apr) {
    const labels = [];
    const aprValues = [];
    const apyValues = [];
    for (let y = 0; y <= 10; y++) {
      labels.push(`Yr ${y}`);
      aprValues.push(1000 * Math.pow(1 + apr / 100, y));
      // Daily compounding (most realistic)
      const apy = (Math.pow(1 + apr / 100 / 365, 365) - 1);
      apyValues.push(1000 * Math.pow(1 + apy, y));
    }
    return { labels, aprValues, apyValues };
  },

  encodeState(inputs) {
    const p = new URLSearchParams();
    for (const k in inputs) p.set(k, inputs[k]);
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
      apr: get('apr', 5),
      n: get('n', 12),
      principal: get('p', 10000),
      horizon: get('h', 1)
    };
  }
};


const ChartManager = {
  growthChart: null,
  breakdownChart: null,

  // BAR CHART: APR vs APY comparison
  renderGrowthChart(apr, apy, n) {
    const ctx = document.getElementById('growthChartCanvas');
    if (!ctx) return;
    if (this.growthChart) this.growthChart.destroy();

    const freqNames = { 1: 'Annual', 2: 'Semi-Annual', 4: 'Quarterly', 12: 'Monthly', 365: 'Daily' };
    this.growthChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['APR (Stated Rate)', `APY (${freqNames[n] || n + '×'} Compounding)`],
        datasets: [{
          label: 'Annual Rate (%)',
          data: [apr, apy],
          backgroundColor: ['rgba(56, 189, 248, 0.6)', 'rgba(249, 115, 22, 0.7)'],
          borderColor: ['#38BDF8', '#F97316'],
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { font: { family: 'JetBrains Mono', size: 11, color: '#94A3B8' }, callback: v => v + '%' },
            title: { display: true, text: 'Rate (%)', font: { family: 'DM Sans', size: 12, weight: '600' }, color: '#475569' }
          },
          y: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 12, weight: '600', color: '#0F172A' } } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#161B2C', titleColor: '#F1F5F9', bodyColor: '#CBD5E1', padding: 10,
            titleFont: { family: 'DM Sans', weight: '600' }, bodyFont: { family: 'JetBrains Mono', size: 11 },
            callbacks: { label: ctx => `Rate: ${ctx.parsed.x.toFixed(3)}%` }
          }
        }
      }
    });
  },

  // LINE CHART: Compounding curve
  renderBreakdownChart(apr, n) {
    const ctx = document.getElementById('breakdownChartCanvas');
    if (!ctx) return;
    if (this.breakdownChart) this.breakdownChart.destroy();

    const curve = AprApyCalc.generateCompoundingCurve(apr);

    this.breakdownChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: curve.labels,
        datasets: [
          {
            label: `With APR (${apr}% simple)`,
            data: curve.aprValues,
            borderColor: '#38BDF8',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            fill: true,
            tension: 0.1,
            borderWidth: 2,
            pointRadius: 3
          },
          {
            label: 'With APY (compounded)',
            data: curve.apyValues,
            borderColor: '#F97316',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            fill: true,
            tension: 0.1,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { color: 'rgba(148, 163, 184, 0.08)' }, ticks: { font: { family: 'DM Sans', size: 10 } } },
          y: { grid: { color: 'rgba(148, 163, 184, 0.08)' }, ticks: { font: { family: 'JetBrains Mono', size: 10, color: '#94A3B8' }, callback: v => '$' + v.toLocaleString() } }
        },
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11, weight: '500' }, boxWidth: 12, padding: 12, usePointStyle: true } },
          tooltip: {
            backgroundColor: '#161B2C', titleColor: '#F1F5F9', bodyColor: '#CBD5E1', padding: 10,
            titleFont: { family: 'DM Sans', weight: '600' }, bodyFont: { family: 'JetBrains Mono', size: 11 },
            callbacks: { label: ctx => `${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}` }
          }
        }
      }
    });
  }
};


const UIController = {
  calcDebounceTimer: null,

  init() {
    this.bindEvents();
    const hash = location.hash.substring(1);
    const inputs = hash ? AprApyCalc.decodeState(hash) : (window.loadCalcInputs?.('apr-vs-apy') || null);
    if (inputs) this.applyInputsToForm(inputs);
    this.triggerCalculation();
  },

  bindEvents() {
    // APR input
    const apr = document.getElementById('apr');
    if (apr) apr.addEventListener('input', () => { this.syncSlider('apr'); this.debouncedCalculate(); });
    const aprSlider = document.getElementById('aprSlider');
    if (aprSlider) aprSlider.addEventListener('input', () => { this.syncInput('aprSlider', 'apr'); this.debouncedCalculate(); });

    // APR presets
    document.querySelectorAll('[data-apr-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = parseFloat(btn.dataset.aprPreset);
        document.getElementById('apr').value = v;
        this.syncSlider('apr');
        this.triggerCalculation();
      });
    });

    // Compounding frequency
    document.querySelectorAll('[data-comp-freq]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-comp-freq]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('compoundingFreq').value = btn.getAttribute('data-comp-freq');
        this.debouncedCalculate();
      });
    });

    // Advanced options
    const advTrigger = document.getElementById('advancedOptionsTrigger');
    const advContent = document.getElementById('advancedOptionsContent');
    if (advTrigger && advContent) {
      advTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = advTrigger.classList.toggle('open');
        advTrigger.setAttribute('aria-expanded', isOpen);
        advTrigger.innerHTML = isOpen ? "Advanced Options ▴" : "Advanced Options ▾";
        if (isOpen) { advContent.classList.add('open'); advContent.style.maxHeight = advContent.scrollHeight + 'px'; }
        else { advContent.classList.remove('open'); advContent.style.maxHeight = '0px'; }
      });
    }

    // Principal & horizon (in advanced)
    ['principal', 'horizon'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.debouncedCalculate());
    });

    // Tabs
    document.querySelectorAll('.calc-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.calc-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab-target');
        document.querySelectorAll('.calc-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
      });
    });

    // Buttons
    document.getElementById('calculateBtn')?.addEventListener('click', (e) => { e.preventDefault(); this.triggerCalculation(); });
    document.getElementById('resetBtn')?.addEventListener('click', (e) => { e.preventDefault(); this.resetToDefaults(); });
    document.getElementById('shareBtn')?.addEventListener('click', (e) => { e.preventDefault(); this.shareResults(); });
  },

  syncSlider(id) {
    const input = document.getElementById(id);
    const slider = document.getElementById(id + 'Slider');
    if (input && slider) { slider.value = input.value; if (window.updateSliderFill) window.updateSliderFill(slider); }
  },
  syncInput(sid, iid) {
    const slider = document.getElementById(sid);
    const input = document.getElementById(iid);
    if (slider && input) { input.value = slider.value; if (window.updateSliderFill) window.updateSliderFill(slider); }
  },

  debouncedCalculate() {
    clearTimeout(this.calcDebounceTimer);
    this.calcDebounceTimer = setTimeout(() => this.triggerCalculation(), 250);
  },

  getCurrentFormInputs() {
    return {
      apr: parseFloat(document.getElementById('apr').value) || 0,
      n: parseInt(document.getElementById('compoundingFreq').value, 10) || 12,
      principal: parseFloat(document.getElementById('principal').value) || 10000,
      horizon: parseFloat(document.getElementById('horizon').value) || 1
    };
  },

  applyInputsToForm(inputs) {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    set('apr', inputs.apr); this.syncSlider('apr');
    set('principal', inputs.principal);
    set('horizon', inputs.horizon);
    document.getElementById('compoundingFreq').value = inputs.n || 12;
    document.querySelectorAll('[data-comp-freq]').forEach(btn => {
      if (parseInt(btn.getAttribute('data-comp-freq'), 10) === (inputs.n || 12)) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  },

  triggerCalculation() {
    try {
      const inputs = this.getCurrentFormInputs();
      const results = AprApyCalc.calculate(inputs.apr, inputs.n);
      this.updateResults(results, inputs);

      const enc = AprApyCalc.encodeState({ apr: inputs.apr, n: inputs.n, p: inputs.principal, h: inputs.horizon });
      history.replaceState(null, '', '#' + enc);
      window.saveCalcInputs?.('apr-vs-apy', inputs);
    } catch (e) {
      console.error(e);
      window.showToast?.(e.message, 'error');
    }
  },

  updateResults(results, inputs) {
    const placeholder = document.getElementById('resultsPlaceholder');
    const resultsPanel = document.getElementById('resultsPanel');
    if (placeholder && resultsPanel) { placeholder.style.display = 'none'; resultsPanel.style.display = 'flex'; }

    const Counter = window.CompoundPro?.CounterAnimation;
    const currency = (window.CompoundPro && window.CompoundPro.getCurrencyPrefixSuffix)
      ? window.CompoundPro.getCurrencyPrefixSuffix() : { prefix: '$', suffix: '' };

    const apyEl = document.getElementById('apyValue');
    const aprEl = document.getElementById('aprValue');
    const diffEl = document.getElementById('diffValue');
    const periodEl = document.getElementById('periodRateValue');

    if (Counter) {
      Counter.animateCounter(apyEl, results.apy, 1000, '', '%', 3);
      Counter.animateCounter(aprEl, results.apr, 1000, '', '%', 3);
      Counter.animateCounter(diffEl, results.diff, 1000, '', '%', 3);
      Counter.animateCounter(periodEl, results.periodRate, 1000, '', '%', 4);
    } else {
      apyEl.textContent = results.apy.toFixed(3) + '%';
      aprEl.textContent = results.apr.toFixed(3) + '%';
      diffEl.textContent = (results.diff >= 0 ? '+' : '') + results.diff.toFixed(3) + '%';
      periodEl.textContent = results.periodRate.toFixed(4) + '%';
    }

    const diffSub = document.getElementById('diffSubvalue');
    if (diffSub) {
      if (results.diff > 0) {
        diffSub.textContent = `+${results.diff.toFixed(3)}% extra from ${results.n}× compounding`;
        diffSub.style.color = 'var(--color-emerald-2)';
      } else {
        diffSub.textContent = 'No difference for this frequency';
        diffSub.style.color = 'var(--color-text-muted)';
      }
    }

    // Dollar bonus
    const aprYear = inputs.principal * (results.apr / 100);
    const apyYear = inputs.principal * (results.apy / 100);
    const dollarBonus = (apyYear - aprYear) * inputs.horizon;
    const dollarBonusEl = document.getElementById('dollarBonusValue');
    if (dollarBonusEl) {
      if (Counter) {
        Counter.animateCounter(dollarBonusEl, dollarBonus, 1000, currency.prefix, currency.suffix, 2);
      } else {
        dollarBonusEl.textContent = AprApyCalc.formatCurrency(dollarBonus);
      }
    }
    const dollarBonusText = document.getElementById('dollarBonusText');
    if (dollarBonusText) {
      dollarBonusText.innerHTML = `Over <strong>${inputs.horizon} year${inputs.horizon !== 1 ? 's' : ''}</strong>, on a <strong>${AprApyCalc.formatCurrency(inputs.principal)}</strong> principal, APY gives you <strong>${AprApyCalc.formatCurrency(dollarBonus)}</strong> more than APR.`;
    }

    // Charts
    ChartManager.renderGrowthChart(results.apr, results.apy, results.n);
    ChartManager.renderBreakdownChart(results.apr, results.n);

    // Frequency comparison table
    this.renderFrequencyTable(results.apr);

    // Insights
    this.generateInsights(results, inputs);
  },

  renderFrequencyTable(apr) {
    const tbody = document.getElementById('yearlyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const freqs = AprApyCalc.compareFrequencies(apr);
    freqs.forEach((f, idx) => {
      const tr = document.createElement('tr');
      if (idx === freqs.length - 1) { tr.style.backgroundColor = 'var(--color-emerald-10)'; tr.style.fontWeight = 'bold'; }
      tr.innerHTML = `
        <td>${f.name}</td>
        <td>${f.label}</td>
        <td>${f.apy.toFixed(3)}%</td>
        <td style="color: ${f.diff >= 0 ? 'var(--color-emerald-2)' : 'var(--color-rose)'}; font-weight: 600;">${f.diff >= 0 ? '+' : ''}${f.diff.toFixed(3)}%</td>
      `;
      tbody.appendChild(tr);
    });
  },

  generateInsights(results, inputs) {
    const box = document.getElementById('calcInsightBox');
    if (!box) return;
    const insights = [];
    insights.push(`Your <strong>${results.apr}% APR</strong> with <strong>${results.n}× yearly compounding</strong> equals an effective <strong>${results.apy.toFixed(3)}% APY</strong>.`);
    if (results.diff > 0) {
      insights.push(`Compounding gives you <strong>+${results.diff.toFixed(3)}%</strong> extra annual return compared to simple interest.`);
    }
    const aprYear = inputs.principal * (results.apr / 100);
    const apyYear = inputs.principal * (results.apy / 100);
    const dollarBonus = (apyYear - aprYear) * inputs.horizon;
    insights.push(`On a <strong>${AprApyCalc.formatCurrency(inputs.principal)}</strong> balance over <strong>${inputs.horizon} year${inputs.horizon !== 1 ? 's' : ''}</strong>, that's <strong>${AprApyCalc.formatCurrency(dollarBonus)}</strong> in extra earnings.`);
    if (results.n >= 365) {
      insights.push(`You're already at <strong>daily compounding</strong> — the highest practical frequency. Continuous compounding would only add 0.005% more.`);
    } else if (results.n < 12) {
      insights.push(`Increasing compounding to <strong>monthly or daily</strong> would boost your APY further.`);
    }
    box.innerHTML = `
      <div class="callout-icon">💡</div>
      <div class="callout-content">
        <div class="callout-title">Key Insights</div>
        <ul>${insights.map(i => `<li>${i}</li>`).join('')}</ul>
      </div>
    `;
  },

  shareResults() {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => window.showToast?.('Link copied!', 'success')).catch(() => window.showToast?.('Copy failed.', 'error'));
    }
  },

  resetToDefaults() {
    const defaults = { apr: 5, n: 12, principal: 10000, horizon: 1 };
    this.applyInputsToForm(defaults);
    this.triggerCalculation();
  }
};

document.addEventListener('DOMContentLoaded', () => UIController.init());
document.addEventListener('currencyChanged', () => UIController.triggerCalculation?.());
