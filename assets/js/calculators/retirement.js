/**
 * CompoundPro - Retirement Savings Calculator Engine
 */

const RetirementCalc = {
  calculate(age, retireAge, savings, contribution, rate, desiredIncome, ssEstimate, swr) {
    if (age < 18 || age > 70) throw new Error("Current age must be between 18 and 70.");
    if (retireAge <= age || retireAge > 80) throw new Error("Target retirement age must be between your current age and 80.");
    if (savings < 0) throw new Error("Current savings cannot be negative.");
    if (contribution < 0) throw new Error("Monthly contribution cannot be negative.");
    if (rate < 0 || rate > 100) throw new Error("Annual return must be between 0% and 100%.");
    if (desiredIncome < 0) throw new Error("Desired income cannot be negative.");
    if (ssEstimate < 0) throw new Error("Social security estimate cannot be negative.");
    if (swr <= 0 || swr > 20) throw new Error("Safe withdrawal rate must be between 0.1% and 20%.");

    const years = retireAge - age;
    const r = rate / 100;
    const monthlyRate = r / 12;
    const totalMonths = years * 12;

    // Simulate growth month-by-month
    let balance = savings;
    let totalContributed = savings;
    const yearlyData = [];
    let yearStartBalance = savings;
    let yearContributed = 0;
    let yearInterest = 0;

    for (let m = 1; m <= totalMonths; m++) {
      // Contribution added at start of month
      balance += contribution;
      totalContributed += contribution;
      yearContributed += contribution;

      // Compound monthly
      const interest = balance * monthlyRate;
      balance += interest;
      yearInterest += interest;

      if (m % 12 === 0) {
        const currentYear = m / 12;
        yearlyData.push({
          year: currentYear,
          age: age + currentYear,
          startBalance: yearStartBalance,
          contributions: yearContributed,
          interest: yearInterest,
          endBalance: balance
        });
        yearStartBalance = balance;
        yearContributed = 0;
        yearInterest = 0;
      }
    }

    // Safe Withdrawal Income Calculation
    // Required portfolio size based on net income needed:
    const netIncomeNeeded = Math.max(0, desiredIncome - ssEstimate);
    const annualIncomeNeeded = netIncomeNeeded * 12;
    const requiredSavings = annualIncomeNeeded / (swr / 100);

    // Monthly income you can draw from final balance
    const monthlyDraw = (balance * (swr / 100)) / 12;
    const totalRetirementMonthlyIncome = monthlyDraw + ssEstimate;

    const surplusOrGap = totalRetirementMonthlyIncome - desiredIncome;
    const progressPct = requiredSavings > 0 ? (balance / requiredSavings) * 100 : 100;

    // Suggestions for closing the gap
    let suggestions = null;
    if (progressPct < 100 && requiredSavings > 0) {
      // 1. Extra contribution needed
      const fvPrincipal = savings * Math.pow(1 + r, years);
      const remainingTarget = Math.max(0, requiredSavings - fvPrincipal);
      let requiredMonthlyPmt = 0;
      
      if (remainingTarget > 0 && totalMonths > 0) {
        requiredMonthlyPmt = (remainingTarget * monthlyRate) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
      }
      const extraContribution = Math.max(0, requiredMonthlyPmt - contribution);

      // 2. Extra years needed (delay retirement)
      let extraYears = 0;
      let tempBalance = balance;
      while (tempBalance < requiredSavings && extraYears < 50) {
        extraYears++;
        // Compound another year
        for (let j = 0; j < 12; j++) {
          tempBalance += contribution;
          tempBalance += tempBalance * monthlyRate;
        }
      }

      suggestions = {
        extraContribution: Math.round(extraContribution),
        extraYears: extraYears
      };
    }

    // FIRE Date
    const today = new Date();
    const fireYear = today.getFullYear() + years;
    const fireMonth = today.toLocaleString('default', { month: 'long' });

    return {
      savingsAtRetirement: balance,
      monthlyDraw,
      totalRetirementMonthlyIncome,
      surplusOrGap,
      onTrack: progressPct >= 100,
      progressPct: Math.min(progressPct, 1000), // Cap visual percentage display safely
      requiredSavings,
      yearsToRetirement: years,
      fireDate: `${fireMonth} ${fireYear}`,
      suggestions,
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

    inputs.age = parseField('a', 30);
    inputs.retireAge = parseField('ra', 65);
    inputs.savings = parseField('s', 20000);
    inputs.contribution = parseField('c', 500);
    inputs.rate = parseField('r', 7.0, true);
    inputs.desiredIncome = parseField('d', 4000);
    inputs.ssEstimate = parseField('ss', 1500);
    inputs.swr = parseField('sw', 4.0, true);

    return inputs;
  }
};

const ChartManager = {
  timelineChart: null,
  incomePieChart: null,

  renderTimelineChart(yearlyData, targetSavings, age) {
    const ctx = document.getElementById('timelineChartCanvas');
    if (!ctx) return;

    if (this.timelineChart) {
      this.timelineChart.destroy();
    }

    const labels = yearlyData.map(d => `Age ${d.age}`);
    const dataPoints = yearlyData.map(d => d.endBalance);
    const targetPoints = yearlyData.map(() => targetSavings);

    this.timelineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Savings Timeline',
            data: dataPoints,
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            fill: true,
            tension: 0.1
          },
          {
            label: 'Required Target',
            data: targetPoints,
            borderColor: '#64748B',
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
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

  renderIncomePieChart(withdrawals, ssEstimate) {
    const ctx = document.getElementById('incomePieCanvas');
    if (!ctx) return;

    if (this.incomePieChart) {
      this.incomePieChart.destroy();
    }

    this.incomePieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Portfolio Withdrawals', 'Social Security'],
        datasets: [{
          data: [withdrawals, ssEstimate],
          backgroundColor: ['#F97316', '#38BDF8'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
      inputs = RetirementCalc.decodeState(hash);
    } else {
      inputs = window.loadCalcInputs('retirement');
    }

    if (inputs) {
      this.applyInputs(inputs);
    }

    this.calculate();
  },

  bindEvents() {
    const fields = ['age', 'retireAge', 'savings', 'contribution', 'rate', 'desiredIncome', 'ssEstimate', 'swr'];
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
      age: parseInt(document.getElementById('age').value, 10) || 30,
      retireAge: parseInt(document.getElementById('retireAge').value, 10) || 65,
      savings: parseFloat(document.getElementById('savings').value) || 0,
      contribution: parseFloat(document.getElementById('contribution').value) || 0,
      rate: parseFloat(document.getElementById('rate').value) || 0,
      desiredIncome: parseFloat(document.getElementById('desiredIncome').value) || 0,
      ssEstimate: parseFloat(document.getElementById('ssEstimate').value) || 0,
      swr: parseFloat(document.getElementById('swr').value) || 4.0
    };
  },

  calculate() {
    try {
      const inputs = this.getInputs();
      
      // Dynamic slider constraints (Target age must be > Current age)
      const targetAgeSlider = document.getElementById('retireAgeSlider');
      if (targetAgeSlider) {
        targetAgeSlider.min = inputs.age + 1;
        if (inputs.retireAge <= inputs.age) {
          document.getElementById('retireAge').value = inputs.age + 1;
          targetAgeSlider.value = inputs.age + 1;
          inputs.retireAge = inputs.age + 1;
        }
      }

      const res = RetirementCalc.calculate(
        inputs.age,
        inputs.retireAge,
        inputs.savings,
        inputs.contribution,
        inputs.rate,
        inputs.desiredIncome,
        inputs.ssEstimate,
        inputs.swr
      );

      // Show Results
      document.getElementById('resultsPlaceholder').style.display = 'none';
      document.getElementById('resultsPanel').style.display = 'flex';

      // Countups
      const Counter = window.CompoundPro?.CounterAnimation;
      const currency = (window.CompoundPro && window.CompoundPro.getCurrencyPrefixSuffix)
        ? window.CompoundPro.getCurrencyPrefixSuffix()
        : { prefix: '$', suffix: '' };
      if (Counter) {
        Counter.animateCounter(document.getElementById('savingsAtRetirement'), res.savingsAtRetirement, 1000, currency.prefix, currency.suffix, 0);
        Counter.animateCounter(document.getElementById('monthlyDraw'), res.monthlyDraw, 1000, currency.prefix, currency.suffix, 0);
        Counter.animateCounter(document.getElementById('yearsToRetire'), res.yearsToRetirement, 1000, "", "", 0);
      } else {
        document.getElementById('savingsAtRetirement').textContent = RetirementCalc.formatCurrency(res.savingsAtRetirement);
        document.getElementById('monthlyDraw').textContent = RetirementCalc.formatCurrency(res.monthlyDraw);
        document.getElementById('yearsToRetire').textContent = res.yearsToRetirement;
      }

      document.getElementById('fireDate').textContent = res.fireDate;

      // On-Track Indicator Rendering
      const indicatorBlock = document.getElementById('onTrackIndicatorBlock');
      const progressFill = document.getElementById('onTrackProgressFill');
      const suggestionBox = document.getElementById('suggestionBox');

      if (progressFill) {
        progressFill.style.width = `${Math.min(res.progressPct, 100)}%`;
      }

      let emoji = "";
      let message = "";
      let classType = "";

      if (res.progressPct >= 100) {
        emoji = "✅";
        message = "You're on track to hit your retirement goals!";
        classType = "callout-emerald";
        if (suggestionBox) suggestionBox.style.display = 'none';
      } else if (res.progressPct >= 80) {
        emoji = "⚠️";
        message = `Close! Your nest egg meets ${res.progressPct.toFixed(0)}% of your target. Increase contributions slightly.`;
        classType = "callout-orange";
      } else {
        emoji = "❌";
        message = `You are behind target. Your savings cover only ${res.progressPct.toFixed(0)}% of the needed portfolio size (${RetirementCalc.formatCurrency(res.requiredSavings)}).`;
        classType = "callout-orange"; // custom container styling
      }

      if (indicatorBlock) {
        indicatorBlock.className = `callout ${classType}`;
        indicatorBlock.innerHTML = `
          <div class="callout-icon">${emoji}</div>
          <div class="callout-content">
            <div class="callout-title">${message}</div>
            <div class="callout-text">Target Nest Egg Needed: <strong>${RetirementCalc.formatCurrency(res.requiredSavings)}</strong>. Projected savings: <strong>${RetirementCalc.formatCurrency(res.savingsAtRetirement)}</strong>.</div>
          </div>
        `;
      }

      // Suggestions rendering
      if (res.progressPct < 100 && res.suggestions && suggestionBox) {
        suggestionBox.style.display = 'block';
        const currency = (window.CompoundPro && window.CompoundPro.getCurrencyPrefixSuffix)
          ? window.CompoundPro.getCurrencyPrefixSuffix()
          : { prefix: '$', suffix: '' };
        document.getElementById('suggestExtraContribution').textContent = `${currency.prefix}${res.suggestions.extraContribution.toLocaleString()}${currency.suffix}`;
        document.getElementById('suggestExtraYears').textContent = `${res.suggestions.extraYears} years`;
      }

      // Render Charts & Tables
      ChartManager.renderTimelineChart(res.yearlyData, res.requiredSavings, inputs.age);
      ChartManager.renderIncomePieChart(res.monthlyDraw, inputs.ssEstimate);
      this.renderTable(res.yearlyData);

      // URL Hash encoding
      const state = RetirementCalc.encodeState({
        a: inputs.age,
        ra: inputs.retireAge,
        s: inputs.savings,
        c: inputs.contribution,
        r: inputs.rate,
        d: inputs.desiredIncome,
        ss: inputs.ssEstimate,
        sw: inputs.swr
      });
      history.replaceState(null, '', '#' + state);
      window.saveCalcInputs('retirement', inputs);

    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast(e.message, "error");
    }
  },

  renderTable(yearlyData) {
    const tbody = document.getElementById('yearlyTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    yearlyData.forEach(row => {
      const tr = document.createElement('tr');
      if (row.year % 5 === 0) tr.style.backgroundColor = 'var(--color-surface-2)';
      if (row.year === yearlyData.length) {
        tr.style.backgroundColor = 'var(--color-emerald-10)';
        tr.style.fontWeight = 'bold';
      }

      tr.innerHTML = `
        <td>Age ${row.age}</td>
        <td>${row.year}</td>
        <td>${RetirementCalc.formatCurrency(row.startBalance)}</td>
        <td>${RetirementCalc.formatCurrency(row.contributions)}</td>
        <td>${RetirementCalc.formatCurrency(row.interest)}</td>
        <td>${RetirementCalc.formatCurrency(row.endBalance)}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  reset() {
    const defaults = {
      age: 30,
      retireAge: 65,
      savings: 20000,
      contribution: 500,
      rate: 7.0,
      desiredIncome: 4000,
      ssEstimate: 1500,
      swr: 4.0
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
