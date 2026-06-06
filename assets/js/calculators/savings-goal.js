/**
 * CompoundPro - Savings Goal Calculator Engine & UI Controller
 * Theme: Compound Interest (shared CSS classes, calc-inputs/calc-results layout)
 * Unique: Radar chart (primary) + Stacked Bar (breakdown) + PMT solver
 */

const SavingsGoalCalc = {
  // ============== CORE CALCULATION (PMT Solver) ==============
  calculate(goal, currentSavings, rate, years, n, inflationRate = 0) {
    if (goal <= 0) throw new Error("Savings goal must be greater than zero.");
    if (currentSavings < 0) throw new Error("Current savings cannot be negative.");
    if (rate < 0 || rate > 100) throw new Error("Annual interest rate must be between 0% and 100%.");
    if (years <= 0 || years > 50) throw new Error("Time to reach goal must be between 1 and 50 years.");
    if (n <= 0 || n > 365) throw new Error("Invalid compounding frequency.");
    if (inflationRate < 0 || inflationRate > 50) throw new Error("Inflation rate must be between 0% and 50%.");

    const r = rate / 100;
    const totalMonths = Math.round(years * 12);
    const periodsPerYear = n;
    const totalPeriods = Math.round(years * periodsPerYear);
    const i = r / periodsPerYear;

    const growthFactor = Math.pow(1 + i, totalPeriods);
    const fvOfCurrent = currentSavings * growthFactor;

    let periodicPmt = 0;
    if (growthFactor > 1 && i > 0) {
      periodicPmt = (goal - fvOfCurrent) * i / (growthFactor - 1);
    } else if (growthFactor === 1) {
      const shortfall = goal - currentSavings;
      periodicPmt = shortfall > 0 ? shortfall / totalMonths : 0;
    }

    const annualContribution = periodicPmt * periodsPerYear;
    const monthlyPmt = annualContribution / 12;

    // Simulate monthly
    let currentBalance = currentSavings;
    let totalContributed = currentSavings;
    let totalInterest = 0;
    const monthlyRecords = [];
    let yearStartBalance = currentSavings;
    let yearContributions = 0;
    let yearInterest = 0;
    let accruedInterest = 0;

    for (let month = 1; month <= totalMonths; month++) {
      currentBalance += monthlyPmt;
      totalContributed += monthlyPmt;
      yearContributions += monthlyPmt;

      let monthlyInterest = 0;
      if (n === 365) {
        const dailyRate = r / 365;
        const monthlyFactor = Math.pow(1 + dailyRate, 365 / 12);
        monthlyInterest = currentBalance * (monthlyFactor - 1);
        currentBalance += monthlyInterest; totalInterest += monthlyInterest; yearInterest += monthlyInterest;
      } else if (n === 12) {
        monthlyInterest = currentBalance * (r / 12);
        currentBalance += monthlyInterest; totalInterest += monthlyInterest; yearInterest += monthlyInterest;
      } else if (n === 4) {
        monthlyInterest = currentBalance * (r / 12);
        accruedInterest += monthlyInterest;
        if (month % 3 === 0) { currentBalance += accruedInterest; totalInterest += accruedInterest; yearInterest += accruedInterest; accruedInterest = 0; }
      } else if (n === 1) {
        monthlyInterest = currentBalance * (r / 12);
        accruedInterest += monthlyInterest;
        if (month % 12 === 0) { currentBalance += accruedInterest; totalInterest += accruedInterest; yearInterest += accruedInterest; accruedInterest = 0; }
      }

      if (month % 12 === 0) {
        const currentYear = month / 12;
        monthlyRecords.push({
          year: currentYear,
          startBalance: yearStartBalance,
          contributions: yearContributions,
          interest: yearInterest,
          endBalance: currentBalance
        });
        yearStartBalance = currentBalance;
        yearContributions = 0;
        yearInterest = 0;
      }
    }

    const goalAlreadyMet = currentSavings >= goal;
    const realGoal = inflationRate > 0 ? goal / Math.pow(1 + inflationRate / 100, years) : null;

    // Cumulative mapping
    let cumulativeContrib = currentSavings;
    let cumulativeInterest = 0;
    const yearlyData = monthlyRecords.map(record => {
      cumulativeContrib += record.contributions;
      cumulativeInterest += record.interest;
      const recordEndBalance = cumulativeContrib + cumulativeInterest;
      return {
        year: record.year,
        startBalance: recordEndBalance - record.interest - record.contributions,
        contributions: record.contributions,
        interest: record.interest,
        endBalance: recordEndBalance,
        cumulativeContributions: cumulativeContrib,
        cumulativeInterest: cumulativeInterest,
        progressPct: (recordEndBalance / goal) * 100
      };
    });

    return {
      goal, currentSavings, monthlyPmt: Math.max(0, monthlyPmt),
      totalContributed: Math.max(0, totalContributed),
      totalInterest: Math.max(0, totalInterest),
      finalBalance: Math.max(0, currentBalance),
      realGoal: realGoal !== null ? Math.max(0, realGoal) : null,
      goalAlreadyMet, years, yearlyData
    };
  },

  formatCurrency(value) {
    if (window.CompoundPro && window.CompoundPro.formatCurrency) {
      return window.CompoundPro.formatCurrency(value);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  },

  encodeState(inputs) {
    const params = new URLSearchParams();
    for (const key in inputs) params.set(key, inputs[key]);
    return params.toString();
  },
  decodeState(hash) {
    const params = new URLSearchParams(hash);
    const inputs = {};
    const get = (name, def) => {
      const v = params.get(name);
      if (v === null) return def;
      const p = parseFloat(v);
      return isNaN(p) ? def : p;
    };
    inputs.goal = get('g', 50000);
    inputs.currentSavings = get('p', 5000);
    inputs.rate = get('r', 5.0);
    inputs.years = get('y', 5);
    inputs.n = get('n', 12);
    inputs.inflationRate = get('i', 3.2);
    inputs.startYear = get('sy', new Date().getFullYear());
    return inputs;
  }
};


const ChartManager = {
  growthChart: null,
  breakdownChart: null,

  renderGrowthChart(yearlyData, goal) {
    const ctx = document.getElementById('growthChartCanvas');
    if (!ctx) return;
    if (this.growthChart) this.growthChart.destroy();

    // RADAR CHART
    const stride = Math.max(1, Math.floor(yearlyData.length / 6));
    const sampled = yearlyData.filter((_, i) => i % stride === 0 || i === yearlyData.length - 1).slice(0, 6);
    while (sampled.length < 3) sampled.push(sampled[sampled.length - 1] || { year: sampled.length + 1, endBalance: 0 });

    const labels = sampled.map(d => `Yr ${d.year}`);
    const balancePct = sampled.map(d => Math.min(100, (d.endBalance / goal) * 100));
    const contribPct = sampled.map(d => Math.min(100, (d.cumulativeContributions / goal) * 100));
    const interestPct = sampled.map(d => Math.min(100, (d.cumulativeInterest / goal) * 100));

    this.growthChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          { label: 'Total Balance', data: balancePct, backgroundColor: 'rgba(249, 115, 22, 0.20)', borderColor: '#F97316', borderWidth: 2, pointBackgroundColor: '#F97316', pointRadius: 4 },
          { label: 'Contributions', data: contribPct, backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: '#38BDF8', borderWidth: 2, pointBackgroundColor: '#38BDF8', pointRadius: 4 },
          { label: 'Interest', data: interestPct, backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981', borderWidth: 2, pointBackgroundColor: '#10B981', pointRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          r: {
            min: 0, max: 100,
            ticks: { stepSize: 25, backdropColor: 'transparent', font: { family: 'JetBrains Mono', size: 10, color: '#94A3B8' }, callback: v => v + '%' },
            grid: { color: 'rgba(148, 163, 184, 0.15)' },
            angleLines: { color: 'rgba(148, 163, 184, 0.15)' },
            pointLabels: { font: { family: 'DM Sans', size: 11, weight: '600', color: '#475569' } }
          }
        },
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11, weight: '500' }, boxWidth: 10, padding: 12, usePointStyle: true } },
          tooltip: {
            backgroundColor: '#161B2C', titleColor: '#F1F5F9', bodyColor: '#CBD5E1', padding: 10,
            titleFont: { family: 'DM Sans', weight: '600' }, bodyFont: { family: 'JetBrains Mono', size: 11 },
            callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.r.toFixed(1)}% of goal` }
          }
        }
      }
    });
  },

  renderBreakdownChart(yearlyData, goal) {
    const ctx = document.getElementById('breakdownChartCanvas');
    if (!ctx) return;
    if (this.breakdownChart) this.breakdownChart.destroy();

    // STACKED BAR CHART
    const labels = yearlyData.map(d => `Yr ${d.year}`);
    const initialBalance = yearlyData[0]?.startBalance || 0;
    const principalSeries = yearlyData.map(() => initialBalance);
    const contribSeries = yearlyData.map(d => Math.max(0, d.cumulativeContributions - initialBalance));
    const interestSeries = yearlyData.map(d => d.cumulativeInterest);

    this.breakdownChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Starting Savings', data: principalSeries, backgroundColor: '#F97316', stack: 's' },
          { label: 'Contributions', data: contribSeries, backgroundColor: '#38BDF8', stack: 's' },
          { label: 'Interest Earned', data: interestSeries, backgroundColor: '#10B981', stack: 's' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 }, callback: function(val, i) { return i % Math.max(1, Math.floor(labels.length / 8)) === 0 || i === labels.length - 1 ? this.getLabelForValue(val) : ''; } } },
          y: { stacked: true, grid: { color: 'rgba(148, 163, 184, 0.08)' }, ticks: { font: { family: 'JetBrains Mono', size: 10, color: '#94A3B8' }, callback: v => '$' + (v / 1000).toFixed(0) + 'K' } }
        },
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11, weight: '500' }, boxWidth: 12, padding: 12, usePointStyle: true } },
          tooltip: {
            backgroundColor: '#161B2C', titleColor: '#F1F5F9', bodyColor: '#CBD5E1', padding: 10,
            titleFont: { family: 'DM Sans', weight: '600' }, bodyFont: { family: 'JetBrains Mono', size: 11 },
            callbacks: { label: ctx => `${ctx.dataset.label}: ${SavingsGoalCalc.formatCurrency(ctx.parsed.y)}` }
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

    let inputs = null;
    const hash = window.location.hash.substring(1);
    if (hash) {
      inputs = SavingsGoalCalc.decodeState(hash);
    } else {
      inputs = window.loadCalcInputs('savings-goal');
    }

    if (inputs) {
      this.applyInputsToForm(inputs);
    }

    this.triggerCalculation();
  },

  bindEvents() {
    const inputIds = ['goal', 'currentSavings', 'rate', 'years', 'inflationRate', 'startYear'];
    inputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          this.syncInputToSlider(id);
          this.debouncedCalculate();
        });
      }
    });

    const sliderIds = ['goalSlider', 'currentSavingsSlider', 'rateSlider', 'yearsSlider'];
    sliderIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          this.syncSliderToInput(id);
          this.debouncedCalculate();
        });
      }
    });

    // Goal presets
    document.querySelectorAll('[data-goal-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const v = parseFloat(btn.dataset.goalPreset);
        const goalInput = document.getElementById('goal');
        goalInput.value = v;
        this.syncInputToSlider('goal');
        this.triggerCalculation();
      });
    });

    // Compounding frequency
    const compButtons = document.querySelectorAll('[data-comp-freq]');
    compButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        compButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('compoundingFreq').value = btn.getAttribute('data-comp-freq');
        this.debouncedCalculate();
      });
    });

    // Advanced options collapsible
    const advTrigger = document.getElementById('advancedOptionsTrigger');
    const advContent = document.getElementById('advancedOptionsContent');
    if (advTrigger && advContent) {
      advTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = advTrigger.classList.toggle('open');
        advTrigger.setAttribute('aria-expanded', isOpen);
        advTrigger.innerHTML = isOpen ? "Advanced Options ▴" : "Advanced Options ▾";
        if (isOpen) {
          advContent.classList.add('open');
          advContent.style.maxHeight = advContent.scrollHeight + 'px';
        } else {
          advContent.classList.remove('open');
          advContent.style.maxHeight = '0px';
        }
      });
    }

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
    document.getElementById('downloadCsvBtn')?.addEventListener('click', (e) => { e.preventDefault(); this.generateCSV(); });
    document.getElementById('shareBtn')?.addEventListener('click', (e) => { e.preventDefault(); this.shareResults(); });
  },

  syncInputToSlider(inputId) {
    const input = document.getElementById(inputId);
    const slider = document.getElementById(inputId + 'Slider');
    if (input && slider) {
      slider.value = input.value;
      if (typeof window.updateSliderFill === 'function') window.updateSliderFill(slider);
    }
  },
  syncSliderToInput(sliderId) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(sliderId.replace('Slider', ''));
    if (slider && input) {
      input.value = slider.value;
      if (typeof window.updateSliderFill === 'function') window.updateSliderFill(slider);
    }
  },

  debouncedCalculate() {
    clearTimeout(this.calcDebounceTimer);
    this.calcDebounceTimer = setTimeout(() => this.triggerCalculation(), 250);
  },

  getCurrentFormInputs() {
    return {
      goal: parseFloat(document.getElementById('goal').value) || 0,
      currentSavings: parseFloat(document.getElementById('currentSavings').value) || 0,
      rate: parseFloat(document.getElementById('rate').value) || 0,
      years: parseFloat(document.getElementById('years').value) || 1,
      n: parseInt(document.getElementById('compoundingFreq').value, 10) || 12,
      inflationRate: parseFloat(document.getElementById('inflationRate').value) || 0,
      startYear: parseInt(document.getElementById('startYear').value, 10) || new Date().getFullYear()
    };
  },

  applyInputsToForm(inputs) {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    set('goal', inputs.goal); this.syncInputToSlider('goal');
    set('currentSavings', inputs.currentSavings); this.syncInputToSlider('currentSavings');
    set('rate', inputs.rate); this.syncInputToSlider('rate');
    set('years', inputs.years);
    set('inflationRate', inputs.inflationRate);
    set('startYear', inputs.startYear);

    document.getElementById('compoundingFreq').value = inputs.n || 12;
    document.querySelectorAll('[data-comp-freq]').forEach(btn => {
      if (parseInt(btn.getAttribute('data-comp-freq'), 10) === (inputs.n || 12)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  },

  triggerCalculation() {
    try {
      const inputs = this.getCurrentFormInputs();
      const results = SavingsGoalCalc.calculate(
        inputs.goal, inputs.currentSavings, inputs.rate, inputs.years,
        inputs.n, inputs.inflationRate
      );
      this.updateResults(results, inputs);

      const enc = SavingsGoalCalc.encodeState({
        g: inputs.goal, p: inputs.currentSavings, r: inputs.rate, y: inputs.years,
        n: inputs.n, i: inputs.inflationRate, sy: inputs.startYear
      });
      history.replaceState(null, '', '#' + enc);
      window.saveCalcInputs('savings-goal', inputs);
    } catch (e) {
      console.error(e);
      window.showToast?.(e.message, 'error');
    }
  },

  updateResults(results, inputs) {
    const placeholder = document.getElementById('resultsPlaceholder');
    const resultsPanel = document.getElementById('resultsPanel');
    if (placeholder && resultsPanel) {
      placeholder.style.display = 'none';
      resultsPanel.style.display = 'flex';
    }

    const Counter = window.CompoundPro?.CounterAnimation;
    const currency = (window.CompoundPro && window.CompoundPro.getCurrencyPrefixSuffix)
      ? window.CompoundPro.getCurrencyPrefixSuffix() : { prefix: '$', suffix: '' };

    const mv = document.getElementById('monthlyContributionValue');
    const tc = document.getElementById('totalContributionsValue');
    const ie = document.getElementById('interestEarnedValue');
    const rg = document.getElementById('realGoalValue');
    const ms = document.getElementById('monthlyContributionSubvalue');
    const ip = document.getElementById('interestEarnedPct');

    if (Counter) {
      Counter.animateCounter(mv, results.monthlyPmt, 1000, currency.prefix, currency.suffix, 0);
      Counter.animateCounter(tc, results.totalContributed, 1000, currency.prefix, currency.suffix, 0);
      Counter.animateCounter(ie, results.totalInterest, 1000, currency.prefix, currency.suffix, 0);
      if (rg && results.realGoal !== null) Counter.animateCounter(rg, results.realGoal, 1000, currency.prefix, currency.suffix, 0);
    } else {
      if (mv) mv.textContent = SavingsGoalCalc.formatCurrency(results.monthlyPmt);
      if (tc) tc.textContent = SavingsGoalCalc.formatCurrency(results.totalContributed);
      if (ie) ie.textContent = SavingsGoalCalc.formatCurrency(results.totalInterest);
      if (rg && results.realGoal !== null) rg.textContent = SavingsGoalCalc.formatCurrency(results.realGoal);
    }

    if (ms) {
      if (results.goalAlreadyMet) {
        ms.textContent = 'Goal already met by current savings';
        ms.style.color = 'var(--color-emerald-2)';
      } else {
        ms.textContent = `Over ${inputs.years * 12} months to reach ${SavingsGoalCalc.formatCurrency(inputs.goal)}`;
        ms.style.color = 'var(--color-text-muted)';
      }
    }

    if (ip) {
      const pct = results.finalBalance > 0 ? (results.totalInterest / results.finalBalance) * 100 : 0;
      ip.textContent = `${pct.toFixed(1)}% of final balance`;
    }

    // Real goal card
    const realCard = document.getElementById('realReturnCard');
    if (realCard) realCard.style.display = (inputs.inflationRate > 0 && results.realGoal !== null) ? 'block' : 'none';

    // Goal met card
    const metCard = document.getElementById('goalMetCard');
    if (metCard) metCard.style.display = results.goalAlreadyMet ? 'block' : 'none';

    // Charts
    ChartManager.renderGrowthChart(results.yearlyData, inputs.goal);
    ChartManager.renderBreakdownChart(results.yearlyData, inputs.goal);

    // Table + insights
    this.renderTable(results.yearlyData, inputs.startYear);
    this.generateInsights(results, inputs);
  },

  renderTable(yearlyData, startYear) {
    const tbody = document.getElementById('yearlyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    yearlyData.forEach((row) => {
      const tr = document.createElement('tr');
      if (row.year % Math.max(1, Math.ceil(yearlyData.length / 5)) === 0) {
        tr.style.backgroundColor = 'var(--color-bg-elevated-2)';
      }
      if (row.year === yearlyData.length) {
        tr.style.backgroundColor = 'var(--color-emerald-10)';
        tr.style.fontWeight = 'bold';
      }
      const calendarYear = startYear + Math.floor(row.year);
      const progressPct = Math.min(row.progressPct, 100);
      tr.innerHTML = `
        <td>${row.year}</td>
        <td>${calendarYear}</td>
        <td>${SavingsGoalCalc.formatCurrency(row.startBalance)}</td>
        <td>${SavingsGoalCalc.formatCurrency(row.contributions)}</td>
        <td>${SavingsGoalCalc.formatCurrency(row.interest)}</td>
        <td>${SavingsGoalCalc.formatCurrency(row.endBalance)}</td>
        <td class="growth-positive">${progressPct.toFixed(1)}%</td>
      `;
      tbody.appendChild(tr);
    });

    if (yearlyData.length > 0) {
      const last = yearlyData[yearlyData.length - 1];
      const totalTr = document.createElement('tr');
      totalTr.innerHTML = `
        <td colspan="3"><strong>Totals</strong></td>
        <td><strong>${SavingsGoalCalc.formatCurrency(last.cumulativeContributions)}</strong></td>
        <td><strong>${SavingsGoalCalc.formatCurrency(last.cumulativeInterest)}</strong></td>
        <td><strong>${SavingsGoalCalc.formatCurrency(last.endBalance)}</strong></td>
        <td></td>
      `;
      tbody.appendChild(totalTr);
    }

    this.cachedYearlyData = yearlyData;
    this.cachedStartYear = startYear;
  },

  generateInsights(results, inputs) {
    const box = document.getElementById('calcInsightBox');
    if (!box) return;

    const insights = [];
    if (results.goalAlreadyMet) {
      insights.push(`Your current savings of <strong>${SavingsGoalCalc.formatCurrency(inputs.currentSavings)}</strong> already meet or exceed the goal of <strong>${SavingsGoalCalc.formatCurrency(inputs.goal)}</strong>. No additional contributions needed.`);
    } else {
      insights.push(`To reach your goal of <strong>${SavingsGoalCalc.formatCurrency(inputs.goal)}</strong> in <strong>${inputs.years} year${inputs.years === 1 ? '' : 's'}</strong>, you need to save <strong>${SavingsGoalCalc.formatCurrency(results.monthlyPmt)} per month</strong>.`);
      const interestPct = (results.totalInterest / (results.totalContributed + results.totalInterest)) * 100;
      insights.push(`Compound interest contributes <strong>${SavingsGoalCalc.formatCurrency(results.totalInterest)}</strong> (${interestPct.toFixed(0)}% of your final balance), reducing the amount you need to save yourself.`);
    }
    if (inputs.inflationRate > 0 && results.realGoal !== null) {
      insights.push(`After accounting for ${inputs.inflationRate}% inflation, the real purchasing power of your goal is approximately <strong>${SavingsGoalCalc.formatCurrency(results.realGoal)}</strong> in today's dollars.`);
    }
    const doubling = inputs.rate > 0 ? (72 / inputs.rate).toFixed(1) : "∞";
    insights.push(`At ${inputs.rate}% annual return, your money doubles every <strong>${doubling} years</strong> (Rule of 72).`);

    box.innerHTML = `
      <div class="callout-icon">💡</div>
      <div class="callout-content">
        <div class="callout-title">Key Insights</div>
        <ul>${insights.map(i => `<li>${i}</li>`).join('')}</ul>
      </div>
    `;
  },

  generateCSV() {
    const data = this.cachedYearlyData;
    if (!data) return;
    const startYear = this.cachedStartYear;
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Year,Calendar Year,Start Balance,Contributions,Interest Earned,End Balance,Progress %\n";
    data.forEach(row => {
      const cy = startYear + Math.floor(row.year);
      csv += `${row.year},${cy},${row.startBalance.toFixed(2)},${row.contributions.toFixed(2)},${row.interest.toFixed(2)},${row.endBalance.toFixed(2)},${row.progressPct.toFixed(2)}\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `savings_goal_projection_${new Date().getFullYear()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.showToast?.('CSV downloaded', 'success');
  },

  shareResults() {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => window.showToast?.('Link copied!', 'success')).catch(() => window.showToast?.('Copy failed.', 'error'));
    }
  },

  resetToDefaults() {
    const defaults = {
      goal: 50000, currentSavings: 5000, rate: 5, years: 5,
      n: 12, inflationRate: 3.2, startYear: new Date().getFullYear()
    };
    this.applyInputsToForm(defaults);
    this.triggerCalculation();
  }
};

document.addEventListener('DOMContentLoaded', () => UIController.init());
document.addEventListener('currencyChanged', () => UIController.triggerCalculation?.());
