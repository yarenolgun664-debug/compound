/**
 * CompoundPro - Emergency Fund Calculator Engine & UI Controller
 * Theme: Compound Interest (shared CSS, calc-inputs, calc-results)
 * Unique: Polar Area chart (4 coverage tiers) + Bar chart (progress to goal)
 */

const EmergencyFundCalc = {
  calculate(monthlyExpenses, recommendedMonths, currentSavings, monthlyContribution, rate, n, inflationRate = 0) {
    if (monthlyExpenses <= 0) throw new Error("Monthly expenses must be greater than zero.");
    if (recommendedMonths < 1 || recommendedMonths > 24) throw new Error("Coverage months must be 1-24.");
    if (currentSavings < 0) throw new Error("Current savings cannot be negative.");
    if (monthlyContribution < 0) throw new Error("Monthly contribution cannot be negative.");
    if (rate < 0 || rate > 100) throw new Error("Annual interest rate must be 0-100%.");
    if (n <= 0 || n > 365) throw new Error("Invalid compounding frequency.");
    if (inflationRate < 0 || inflationRate > 50) throw new Error("Inflation rate must be 0-50%.");

    // Compute all 4 tier targets
    const target3 = monthlyExpenses * 3;
    const target6 = monthlyExpenses * 6;
    const target9 = monthlyExpenses * 9;
    const target12 = monthlyExpenses * 12;
    const recommendedTarget = monthlyExpenses * recommendedMonths;

    const progressPct = recommendedTarget > 0 ? (currentSavings / recommendedTarget) * 100 : 0;
    const goalMet = currentSavings >= recommendedTarget;

    // Simulate monthly to find months-to-target
    let bal = currentSavings;
    let monthsToTarget = -1;
    const maxMonths = 120; // 10 years
    const monthlyRecords = [];
    const r = rate / 100;
    let yStart = currentSavings;
    let yContrib = 0;
    let yInt = 0;
    let accrued = 0;
    let totalContrib = currentSavings;
    let totalInterest = 0;

    for (let m = 1; m <= maxMonths; m++) {
      bal += monthlyContribution;
      totalContrib += monthlyContribution;
      yContrib += monthlyContribution;

      let mInt = 0;
      if (n === 365) {
        const dr = r / 365;
        const mf = Math.pow(1 + dr, 365 / 12);
        mInt = bal * (mf - 1);
        bal += mInt; totalInterest += mInt; yInt += mInt;
      } else if (n === 12) {
        mInt = bal * (r / 12);
        bal += mInt; totalInterest += mInt; yInt += mInt;
      } else if (n === 4) {
        mInt = bal * (r / 12);
        accrued += mInt;
        if (m % 3 === 0) { bal += accrued; totalInterest += accrued; yInt += accrued; accrued = 0; }
      } else if (n === 1) {
        mInt = bal * (r / 12);
        accrued += mInt;
        if (m % 12 === 0) { bal += accrued; totalInterest += accrued; yInt += accrued; accrued = 0; }
      }

      if (monthsToTarget === -1 && bal >= recommendedTarget) {
        monthsToTarget = m;
      }

      if (m % 12 === 0) {
        monthlyRecords.push({
          year: m / 12, startBalance: yStart, contributions: yContrib,
          interest: yInt, endBalance: bal
        });
        yStart = bal; yContrib = 0; yInt = 0;
        if (monthsToTarget !== -1 && m >= monthsToTarget + 12) break;
      }
    }

    const realTarget = inflationRate > 0 ? recommendedTarget / Math.pow(1 + inflationRate / 100, 1) : null;

    let cumC = currentSavings, cumI = 0;
    const yearlyData = monthlyRecords.map(record => {
      cumC += record.contributions;
      cumI += record.interest;
      const endBal = cumC + cumI;
      return {
        year: record.year, startBalance: endBal - record.interest - record.contributions,
        contributions: record.contributions, interest: record.interest, endBalance: endBal,
        cumulativeContributions: cumC, cumulativeInterest: cumI,
        progressPct: (endBal / recommendedTarget) * 100
      };
    });

    return {
      monthlyExpenses, recommendedMonths, recommendedTarget,
      target3, target6, target9, target12,
      currentSavings, currentBalance: Math.max(0, bal),
      progressPct: Math.min(progressPct, 100), goalMet,
      monthsToTarget, totalContributed: Math.max(0, totalContrib),
      totalInterest: Math.max(0, totalInterest),
      realTarget: realTarget !== null ? Math.max(0, realTarget) : null,
      yearlyData
    };
  },

  formatCurrency(value) {
    if (window.CompoundPro?.formatCurrency) return window.CompoundPro.formatCurrency(value);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
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
      monthlyExpenses: get('e', 3000),
      recommendedMonths: get('m', 6),
      currentSavings: get('p', 2000),
      monthlyContribution: get('c', 300),
      rate: get('r', 0.5),
      n: get('n', 12),
      inflationRate: get('i', 3.2),
      startYear: get('sy', new Date().getFullYear())
    };
  }
};


const ChartManager = {
  growthChart: null,
  breakdownChart: null,

  // POLAR AREA CHART - 4 coverage tiers
  renderGrowthChart(results) {
    const ctx = document.getElementById('growthChartCanvas');
    if (!ctx) return;
    if (this.growthChart) this.growthChart.destroy();

    this.growthChart = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: ['3-Month', '6-Month (Standard)', '9-Month', '12-Month (Maximum)'],
        datasets: [{
          label: 'Emergency Fund Target ($)',
          data: [results.target3, results.target6, results.target9, results.target12],
          backgroundColor: [
            'rgba(14, 165, 233, 0.6)',   // sea blue
            'rgba(249, 115, 22, 0.7)',  // orange
            'rgba(16, 185, 129, 0.6)',  // emerald
            'rgba(225, 29, 72, 0.6)'    // rose
          ],
          borderColor: [
            '#0EA5E9', '#F97316', '#10B981', '#E11D48'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          r: {
            ticks: {
              font: { family: 'JetBrains Mono', size: 10, color: '#94A3B8' },
              backdropColor: 'transparent',
              callback: v => '$' + (v / 1000).toFixed(0) + 'K'
            },
            grid: { color: 'rgba(148, 163, 184, 0.15)' },
            angleLines: { color: 'rgba(148, 163, 184, 0.15)' }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { family: 'DM Sans', size: 11, weight: '500' }, boxWidth: 12, padding: 14, usePointStyle: true }
          },
          tooltip: {
            backgroundColor: '#161B2C', titleColor: '#F1F5F9', bodyColor: '#CBD5E1', padding: 10,
            titleFont: { family: 'DM Sans', weight: '600' }, bodyFont: { family: 'JetBrains Mono', size: 11 },
            callbacks: {
              label: ctx => `${ctx.label}: ${EmergencyFundCalc.formatCurrency(ctx.raw)}`
            }
          }
        }
      }
    });
  },

  // BAR CHART - progress over time
  renderBreakdownChart(yearlyData, recommendedTarget) {
    const ctx = document.getElementById('breakdownChartCanvas');
    if (!ctx) return;
    if (this.breakdownChart) this.breakdownChart.destroy();

    const labels = yearlyData.map(d => `Yr ${d.year}`);
    const initialBalance = yearlyData[0]?.startBalance || 0;
    const principalSeries = yearlyData.map(() => initialBalance);
    const contribSeries = yearlyData.map(d => Math.max(0, d.cumulativeContributions - initialBalance));
    const interestSeries = yearlyData.map(d => d.cumulativeInterest);
    const targetLine = yearlyData.map(() => recommendedTarget);

    this.breakdownChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Starting Savings', data: principalSeries, backgroundColor: '#F97316', stack: 's' },
          { label: 'Contributions', data: contribSeries, backgroundColor: '#38BDF8', stack: 's' },
          { label: 'Interest Earned', data: interestSeries, backgroundColor: '#10B981', stack: 's' },
          { type: 'line', label: 'Target', data: targetLine, borderColor: '#E11D48', borderDash: [8, 4], borderWidth: 2, fill: false, pointRadius: 0 }
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
            callbacks: { label: ctx => ctx.dataset.type === 'line' ? `Target: ${EmergencyFundCalc.formatCurrency(ctx.parsed.y)}` : `${ctx.dataset.label}: ${EmergencyFundCalc.formatCurrency(ctx.parsed.y)}` }
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
    const inputs = hash ? EmergencyFundCalc.decodeState(hash) : (window.loadCalcInputs?.('emergency-fund') || null);
    if (inputs) this.applyInputsToForm(inputs);
    this.triggerCalculation();
  },

  bindEvents() {
    const inputIds = ['monthlyExpenses', 'currentSavings', 'monthlyContribution', 'rate', 'inflationRate', 'startYear'];
    inputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { this.syncInputToSlider(id); this.debouncedCalculate(); });
    });
    const sliderIds = ['monthlyExpensesSlider', 'currentSavingsSlider', 'monthlyContributionSlider', 'rateSlider'];
    sliderIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { this.syncSliderToInput(id); this.debouncedCalculate(); });
    });

    // Coverage months segmented buttons
    document.querySelectorAll('[data-months]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-months]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('recommendedMonths').value = btn.getAttribute('data-months');
        this.debouncedCalculate();
      });
    });

    // Compounding
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

  syncInputToSlider(id) {
    const input = document.getElementById(id);
    const slider = document.getElementById(id + 'Slider');
    if (input && slider) { slider.value = input.value; if (window.updateSliderFill) window.updateSliderFill(slider); }
  },
  syncSliderToInput(sid) {
    const slider = document.getElementById(sid);
    const input = document.getElementById(sid.replace('Slider', ''));
    if (slider && input) { input.value = slider.value; if (window.updateSliderFill) window.updateSliderFill(slider); }
  },

  debouncedCalculate() {
    clearTimeout(this.calcDebounceTimer);
    this.calcDebounceTimer = setTimeout(() => this.triggerCalculation(), 250);
  },

  getCurrentFormInputs() {
    return {
      monthlyExpenses: parseFloat(document.getElementById('monthlyExpenses').value) || 0,
      recommendedMonths: parseInt(document.getElementById('recommendedMonths').value, 10) || 6,
      currentSavings: parseFloat(document.getElementById('currentSavings').value) || 0,
      monthlyContribution: parseFloat(document.getElementById('monthlyContribution').value) || 0,
      rate: parseFloat(document.getElementById('rate').value) || 0,
      n: parseInt(document.getElementById('compoundingFreq').value, 10) || 12,
      inflationRate: parseFloat(document.getElementById('inflationRate').value) || 0,
      startYear: parseInt(document.getElementById('startYear').value, 10) || new Date().getFullYear()
    };
  },

  applyInputsToForm(inputs) {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    set('monthlyExpenses', inputs.monthlyExpenses); this.syncInputToSlider('monthlyExpenses');
    set('currentSavings', inputs.currentSavings); this.syncInputToSlider('currentSavings');
    set('monthlyContribution', inputs.monthlyContribution); this.syncInputToSlider('monthlyContribution');
    set('rate', inputs.rate); this.syncInputToSlider('rate');
    set('recommendedMonths', inputs.recommendedMonths);
    set('inflationRate', inputs.inflationRate);
    set('startYear', inputs.startYear);

    document.getElementById('compoundingFreq').value = inputs.n || 12;
    document.querySelectorAll('[data-comp-freq]').forEach(btn => {
      if (parseInt(btn.getAttribute('data-comp-freq'), 10) === (inputs.n || 12)) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    document.querySelectorAll('[data-months]').forEach(btn => {
      if (parseInt(btn.getAttribute('data-months'), 10) === (inputs.recommendedMonths || 6)) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  },

  triggerCalculation() {
    try {
      const inputs = this.getCurrentFormInputs();
      const results = EmergencyFundCalc.calculate(
        inputs.monthlyExpenses, inputs.recommendedMonths, inputs.currentSavings,
        inputs.monthlyContribution, inputs.rate, inputs.n, inputs.inflationRate
      );
      this.updateResults(results, inputs);

      const enc = EmergencyFundCalc.encodeState({
        e: inputs.monthlyExpenses, m: inputs.recommendedMonths, p: inputs.currentSavings,
        c: inputs.monthlyContribution, r: inputs.rate, n: inputs.n, i: inputs.inflationRate, sy: inputs.startYear
      });
      history.replaceState(null, '', '#' + enc);
      window.saveCalcInputs?.('emergency-fund', inputs);
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

    const rec = document.getElementById('recommendedTargetValue');
    const prog = document.getElementById('currentProgressValue');
    const mo = document.getElementById('monthsToTargetValue');
    const rt = document.getElementById('realTargetValue');

    if (Counter) {
      Counter.animateCounter(rec, results.recommendedTarget, 1000, currency.prefix, currency.suffix, 0);
      Counter.animateCounter(prog, results.progressPct, 1000, '', '%', 1);
      if (results.monthsToTarget > 0) Counter.animateCounter(mo, results.monthsToTarget, 1000, '', '', 0);
      else mo.textContent = '10+';
      if (rt && results.realTarget !== null) Counter.animateCounter(rt, results.realTarget, 1000, currency.prefix, currency.suffix, 0);
    } else {
      rec.textContent = EmergencyFundCalc.formatCurrency(results.recommendedTarget);
      prog.textContent = results.progressPct.toFixed(1) + '%';
      mo.textContent = results.monthsToTarget > 0 ? results.monthsToTarget : '10+';
      if (rt && results.realTarget !== null) rt.textContent = EmergencyFundCalc.formatCurrency(results.realTarget);
    }

    // Labels
    const recLabel = document.getElementById('recommendedTargetLabel');
    if (recLabel) recLabel.textContent = `${results.recommendedMonths}-Month Emergency Fund`;
    const recSub = document.getElementById('recommendedTargetSubvalue');
    if (recSub) {
      if (results.goalMet) {
        recSub.textContent = 'Your safety net — fully funded!';
        recSub.style.color = 'var(--color-emerald-2)';
      } else {
        recSub.textContent = `Based on ${EmergencyFundCalc.formatCurrency(inputs.monthlyExpenses)}/month × ${results.recommendedMonths}`;
        recSub.style.color = 'var(--color-text-muted)';
      }
    }
    const progSub = document.getElementById('currentProgressSubvalue');
    if (progSub) progSub.textContent = `${EmergencyFundCalc.formatCurrency(inputs.currentSavings)} of ${EmergencyFundCalc.formatCurrency(results.recommendedTarget)} saved`;
    const moSub = document.getElementById('monthsToTargetSubvalue');
    if (moSub) {
      if (results.monthsToTarget > 0) {
        const years = Math.floor(results.monthsToTarget / 12);
        const months = results.monthsToTarget % 12;
        let s = '';
        if (years > 0) s += `${years} year${years > 1 ? 's' : ''} `;
        if (months > 0) s += `${months} month${months > 1 ? 's' : ''}`;
        moSub.textContent = `≈ ${s.trim()} at ${EmergencyFundCalc.formatCurrency(inputs.monthlyContribution)}/month`;
        moSub.style.color = 'var(--color-text-muted)';
      } else {
        moSub.textContent = 'Increase contribution to reach goal';
        moSub.style.color = 'var(--color-rose)';
      }
    }

    // Status card
    const stCard = document.getElementById('statusCard');
    const stTitle = document.getElementById('statusTitle');
    const stText = document.getElementById('statusText');
    if (stCard && stTitle && stText) {
      if (results.goalMet) {
        stCard.style.borderLeftColor = 'var(--color-emerald)';
        stTitle.textContent = '✅ Your emergency fund is fully funded';
        stTitle.style.color = 'var(--color-emerald-2)';
        stText.textContent = `You've saved ${EmergencyFundCalc.formatCurrency(inputs.currentSavings)}, exceeding your ${results.recommendedMonths}-month target of ${EmergencyFundCalc.formatCurrency(results.recommendedTarget)}.`;
      } else if (results.monthsToTarget === -1) {
        stCard.style.borderLeftColor = 'var(--color-rose)';
        stTitle.textContent = '❌ Goal not reachable with current contribution';
        stTitle.style.color = 'var(--color-rose)';
        stText.textContent = `At ${EmergencyFundCalc.formatCurrency(inputs.monthlyContribution)}/month, you'll fall short. Consider increasing it.`;
      } else {
        stCard.style.borderLeftColor = 'var(--color-orange)';
        stTitle.textContent = '🎯 On track — keep going!';
        stTitle.style.color = 'var(--color-orange)';
        stText.textContent = `You'll reach your ${results.recommendedMonths}-month target in approximately ${results.monthsToTarget} months.`;
      }
    }

    // Real return card
    const realCard = document.getElementById('realReturnCard');
    if (realCard) realCard.style.display = (inputs.inflationRate > 0 && results.realTarget !== null) ? 'block' : 'none';

    // Charts
    ChartManager.renderGrowthChart(results);
    ChartManager.renderBreakdownChart(results.yearlyData, results.recommendedTarget);

    // Table
    this.renderTable(results.yearlyData, inputs.startYear);
    this.generateInsights(results, inputs);
  },

  renderTable(yearlyData, startYear) {
    const tbody = document.getElementById('yearlyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    yearlyData.forEach((row) => {
      const tr = document.createElement('tr');
      if (row.year % Math.max(1, Math.ceil(yearlyData.length / 5)) === 0) tr.style.backgroundColor = 'var(--color-bg-elevated-2)';
      if (row.year === yearlyData.length) { tr.style.backgroundColor = 'var(--color-emerald-10)'; tr.style.fontWeight = 'bold'; }
      const cy = startYear + Math.floor(row.year);
      const pp = Math.min(row.progressPct, 100);
      tr.innerHTML = `
        <td>${row.year}</td>
        <td>${cy}</td>
        <td>${EmergencyFundCalc.formatCurrency(row.startBalance)}</td>
        <td>${EmergencyFundCalc.formatCurrency(row.contributions)}</td>
        <td>${EmergencyFundCalc.formatCurrency(row.interest)}</td>
        <td>${EmergencyFundCalc.formatCurrency(row.endBalance)}</td>
        <td class="growth-positive">${pp.toFixed(1)}%</td>
      `;
      tbody.appendChild(tr);
    });
    if (yearlyData.length > 0) {
      const last = yearlyData[yearlyData.length - 1];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="3"><strong>Totals</strong></td>
        <td><strong>${EmergencyFundCalc.formatCurrency(last.cumulativeContributions)}</strong></td>
        <td><strong>${EmergencyFundCalc.formatCurrency(last.cumulativeInterest)}</strong></td>
        <td><strong>${EmergencyFundCalc.formatCurrency(last.endBalance)}</strong></td>
        <td></td>
      `;
      tbody.appendChild(tr);
    }
    this.cachedYearlyData = yearlyData;
    this.cachedStartYear = startYear;
  },

  generateInsights(results, inputs) {
    const box = document.getElementById('calcInsightBox');
    if (!box) return;
    const insights = [];
    const sit = {
      3: 'You have a stable, dual-income household — 3 months is sufficient.',
      6: 'Standard recommendation: works for most working professionals.',
      9: 'Recommended for self-employed, contractors, or those with variable income.',
      12: 'Conservative target for single earners with dependents or unstable income.'
    };
    insights.push(`<strong>${results.recommendedMonths}-month target:</strong> ${sit[results.recommendedMonths] || 'Custom coverage period.'}`);
    if (results.goalMet) {
      insights.push(`You've already saved <strong>${EmergencyFundCalc.formatCurrency(inputs.currentSavings)}</strong>, which exceeds your <strong>${results.recommendedMonths}-month target of ${EmergencyFundCalc.formatCurrency(results.recommendedTarget)}</strong>.`);
    } else if (results.monthsToTarget > 0) {
      const short = results.recommendedTarget - inputs.currentSavings;
      insights.push(`You need <strong>${EmergencyFundCalc.formatCurrency(short)}</strong> more. At <strong>${EmergencyFundCalc.formatCurrency(inputs.monthlyContribution)}/month</strong>, you'll reach it in <strong>${results.monthsToTarget} months</strong> (≈ ${(results.monthsToTarget / 12).toFixed(1)} years).`);
    } else {
      insights.push(`At <strong>${EmergencyFundCalc.formatCurrency(inputs.monthlyContribution)}/month</strong>, your contribution isn't enough to reach the goal in 10 years. Try increasing it.`);
    }
    if (results.totalInterest > 0) {
      const pct = (results.totalInterest / (results.totalContributed + results.totalInterest)) * 100;
      insights.push(`Compound interest contributes <strong>${EmergencyFundCalc.formatCurrency(results.totalInterest)}</strong> (${pct.toFixed(1)}% of your final balance) — keep your fund in a HYSA.`);
    }
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
    const sy = this.cachedStartYear;
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Year,Calendar Year,Start Balance,Contributions,Interest Earned,End Balance,Progress %\n";
    data.forEach(row => {
      const cy = sy + Math.floor(row.year);
      csv += `${row.year},${cy},${row.startBalance.toFixed(2)},${row.contributions.toFixed(2)},${row.interest.toFixed(2)},${row.endBalance.toFixed(2)},${row.progressPct.toFixed(2)}\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `emergency_fund_projection_${new Date().getFullYear()}.csv`;
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
      monthlyExpenses: 3000, recommendedMonths: 6, currentSavings: 2000,
      monthlyContribution: 300, rate: 0.5, n: 12, inflationRate: 3.2,
      startYear: new Date().getFullYear()
    };
    this.applyInputsToForm(defaults);
    this.triggerCalculation();
  }
};

document.addEventListener('DOMContentLoaded', () => UIController.init());
document.addEventListener('currencyChanged', () => UIController.triggerCalculation?.());
