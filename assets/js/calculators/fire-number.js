/**
 * CompoundPro - FIRE Number Calculator Engine
 */

const FireCalc = {
  calculate(currentExpenses, retirementExpenses, swr, savings, monthlySavings, returnRate, currentAge, baristaIncome = 0) {
    if (currentExpenses < 0) throw new Error("Current expenses cannot be negative.");
    if (retirementExpenses < 0) throw new Error("Retirement expenses cannot be negative.");
    if (swr <= 0 || swr > 20) throw new Error("Safe withdrawal rate must be between 0.1% and 20%.");
    if (savings < 0) throw new Error("Current savings cannot be negative.");
    if (monthlySavings < 0) throw new Error("Monthly savings cannot be negative.");
    if (returnRate < 0 || returnRate > 100) throw new Error("Annual return must be between 0% and 100%.");
    if (currentAge < 0 || currentAge > 100) throw new Error("Age must be between 0 and 100.");
    if (baristaIncome < 0) throw new Error("Part-time income cannot be negative.");

    // Calculate FIRE Number
    const netRetirementExpenses = Math.max(0, retirementExpenses - baristaIncome);
    const fireNumber = netRetirementExpenses / (swr / 100);

    const r = returnRate / 100;
    const monthlyRate = r / 12;

    let balance = savings;
    let years = 0;
    let months = 0;
    let reached = false;

    const maxMonths = 1200; // 100 years limit
    const yearlyData = [];
    
    // Add Year 0 baseline
    yearlyData.push({
      year: 0,
      age: currentAge,
      balance: balance,
      target: fireNumber,
      contributions: 0,
      growth: 0
    });

    let totalContributed = 0;
    let currentYearContributed = 0;
    let currentYearInterest = 0;
    let yearStartBalance = savings;

    let m = 1;
    for (; m <= maxMonths; m++) {
      // Monthly savings added at start of month
      balance += monthlySavings;
      totalContributed += monthlySavings;
      currentYearContributed += monthlySavings;

      // Compound monthly interest
      const interest = balance * monthlyRate;
      balance += interest;
      currentYearInterest += interest;

      // Check if target reached
      if (!reached && balance >= fireNumber) {
        years = Math.floor(m / 12);
        months = m % 12;
        reached = true;
      }

      // Record year-end data
      if (m % 12 === 0) {
        const yearNum = m / 12;
        const cumulativeDeposits = totalContributed;
        const cumulativeGrowth = Math.max(0, balance - savings - cumulativeDeposits);

        yearlyData.push({
          year: yearNum,
          age: currentAge + yearNum,
          balance: balance,
          target: fireNumber,
          contributions: cumulativeDeposits,
          growth: cumulativeGrowth
        });

        // Reset yearly accumulators
        currentYearContributed = 0;
        currentYearInterest = 0;
        yearStartBalance = balance;
      }

      // Stop simulating if we reached the target and have at least 5 years of post-FIRE projections,
      // or if we hit the 100-year limit
      if (reached && (m / 12) >= (years + 5)) {
        break;
      }
    }

    // If target not reached within 100 years
    if (!reached) {
      years = 100;
      months = 0;
    }

    // Savings rate % of income (assuming income = currentExpenses + monthlySavings * 12)
    const annualSavings = monthlySavings * 12;
    const impliedIncome = currentExpenses + annualSavings;
    const savingsRatePct = impliedIncome > 0 ? (annualSavings / impliedIncome) * 100 : 0;

    // Estimate FIRE Date
    const today = new Date();
    const totalMonthsNeeded = years * 12 + months;
    const fireDateObj = new Date(today.getFullYear(), today.getMonth() + totalMonthsNeeded, 1);
    const fireDateStr = fireDateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Progress percentage
    const progressPct = fireNumber > 0 ? (savings / fireNumber) * 100 : 100;

    return {
      fireNumber,
      years,
      months,
      reached,
      totalMonthsNeeded,
      fireDate: fireDateStr,
      savingsRatePct,
      progressPct: Math.min(progressPct, 1000), // Cap for visual safety
      yearlyData,
      baristaIncome
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

    inputs.fireType = params.get('t') || 'regular';
    inputs.currentExpenses = parseField('ce', 50000);
    inputs.retirementExpenses = parseField('re', 50000);
    inputs.swr = parseField('sw', 4.0, true);
    inputs.savings = parseField('s', 0);
    inputs.monthlySavings = parseField('ms', 2000);
    inputs.returnRate = parseField('r', 7.0, true);
    inputs.currentAge = parseField('a', 30);
    inputs.baristaIncome = parseField('bi', 1500 * 12); // default part-time annual

    return inputs;
  }
};

const ChartManager = {
  progressChart: null,
  breakdownChart: null,

  renderProgressChart(yearlyData, fireNumber, fireIndex) {
    const ctx = document.getElementById('progressChartCanvas');
    if (!ctx) return;

    if (this.progressChart) {
      this.progressChart.destroy();
    }

    const labels = yearlyData.map(d => `Age ${d.age}`);
    const balancePoints = yearlyData.map(d => d.balance);
    const targetPoints = yearlyData.map(() => fireNumber);

    // Custom annotation plugin to draw the "🎯 FIRE DATE" label and vertical line
    const fireAnnotationPlugin = {
      id: 'fireAnnotation',
      afterDraw(chart) {
        if (fireIndex === undefined || fireIndex < 0 || fireIndex >= chart.data.labels.length) return;

        const ctxCanvas = chart.ctx;
        const xAxis = chart.scales.x;
        const yAxis = chart.scales.y;

        const xPos = xAxis.getPixelForTick(fireIndex);
        const yPos = yAxis.getPixelForValue(chart.data.datasets[0].data[fireIndex]);

        ctxCanvas.save();
        
        // Vertical dashed line
        ctxCanvas.strokeStyle = '#F97316'; // Orange accent
        ctxCanvas.lineWidth = 2;
        ctxCanvas.setLineDash([6, 4]);
        ctxCanvas.beginPath();
        ctxCanvas.moveTo(xPos, yAxis.top);
        ctxCanvas.lineTo(xPos, yAxis.bottom);
        ctxCanvas.stroke();

        // Intersection point node
        ctxCanvas.fillStyle = '#F97316';
        ctxCanvas.beginPath();
        ctxCanvas.arc(xPos, yPos, 7, 0, 2 * Math.PI);
        ctxCanvas.fill();
        ctxCanvas.strokeStyle = '#FFFFFF';
        ctxCanvas.lineWidth = 2;
        ctxCanvas.stroke();

        // Label box
        ctxCanvas.fillStyle = '#F97316';
        ctxCanvas.font = "bold 11px 'DM Sans', sans-serif";
        ctxCanvas.textAlign = 'center';
        ctxCanvas.fillText('🎯 FIRE TARGET MET', xPos, yAxis.top + 20);
        
        ctxCanvas.restore();
      }
    };

    this.progressChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Projected Net Worth',
            data: balancePoints,
            borderColor: '#10B981', // Emerald
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            fill: true,
            tension: 0.15,
            borderWidth: 3
          },
          {
            label: 'FIRE Target Number',
            data: targetPoints,
            borderColor: '#38BDF8', // Sea
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            borderWidth: 2
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
            },
            grid: {
              color: 'rgba(226, 232, 240, 0.15)'
            }
          },
          x: {
            grid: { display: false }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: 'DM Sans' }
            }
          },
          tooltip: {
            callbacks: {
              label: context => {
                const label = context.dataset.label || '';
                let val;
                if (window.CompoundPro && window.CompoundPro.formatCurrency) {
                  val = window.CompoundPro.formatCurrency(Math.round(context.parsed.y));
                } else {
                  val = '$' + Math.round(context.parsed.y).toLocaleString();
                }
                return `${label}: ${val}`;
              }
            }
          }
        }
      },
      plugins: [fireAnnotationPlugin]
    });
  },

  renderBreakdownChart(yearlyData) {
    const ctx = document.getElementById('breakdownChartCanvas');
    if (!ctx) return;

    if (this.breakdownChart) {
      this.breakdownChart.destroy();
    }

    // Filter year points (e.g. every 2-5 years to prevent overcrowding)
    const stride = Math.max(1, Math.floor(yearlyData.length / 10));
    const filteredData = yearlyData.filter((_, idx) => idx % stride === 0 || idx === yearlyData.length - 1);

    const labels = filteredData.map(d => `Age ${d.age}`);
    const initialSavingsPoints = filteredData.map(d => yearlyData[0].balance);
    const contributionsPoints = filteredData.map((d, i) => d.contributions);
    const growthPoints = filteredData.map(d => d.growth);

    this.breakdownChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Initial Capital',
            data: initialSavingsPoints,
            backgroundColor: '#38BDF8', // Sea
          },
          {
            label: 'Future Contributions',
            data: contributionsPoints,
            backgroundColor: '#F97316', // Orange
          },
          {
            label: 'Investment Growth (Compounding)',
            data: growthPoints,
            backgroundColor: '#10B981', // Emerald
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true },
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
  activeFireType: 'regular',

  init() {
    this.bindEvents();

    let inputs = null;
    const hash = window.location.hash.substring(1);
    if (hash) {
      inputs = FireCalc.decodeState(hash);
    } else {
      inputs = window.loadCalcInputs('fire-number');
    }

    if (inputs) {
      this.applyInputs(inputs);
    } else {
      // Default initialization
      this.selectFireType('regular');
    }

    this.calculate();
  },

  bindEvents() {
    // FIRE Type Cards Click
    const cards = document.querySelectorAll('.fire-type-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const type = card.getAttribute('data-type');
        this.selectFireType(type);
        this.calculate();
      });
      // Keyboard activation (Enter / Space) for accessibility
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          card.click();
        }
      });
    });

    // Sync input fields and sliders
    const fields = [
      'currentExpenses',
      'retirementExpenses',
      'swr',
      'savings',
      'monthlySavings',
      'returnRate',
      'currentAge',
      'baristaIncome'
    ];

    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          this.syncInputToSlider(id);
          // Sync expenses if matching
          if (id === 'currentExpenses' && !this.retirementExpensesEdited) {
            document.getElementById('retirementExpenses').value = el.value;
            this.syncInputToSlider('retirementExpenses');
          }
          this.debouncedCalculate();
        });
      }

      const slider = document.getElementById(id + 'Slider');
      if (slider) {
        slider.addEventListener('input', () => {
          this.syncSliderToInput(id);
          // Sync expenses if matching
          if (id === 'currentExpenses' && !this.retirementExpensesEdited) {
            document.getElementById('retirementExpenses').value = slider.value;
            this.syncInputToSlider('retirementExpenses');
          }
          this.debouncedCalculate();
        });
      }
    });

    // Detect manual retirement expense override
    document.getElementById('retirementExpenses')?.addEventListener('input', () => {
      this.retirementExpensesEdited = true;
    });
    document.getElementById('retirementExpensesSlider')?.addEventListener('input', () => {
      this.retirementExpensesEdited = true;
    });

    // Reset button
    document.getElementById('resetBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.reset();
    });

    // Tab buttons
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

    // What-If Sliders
    const whatIfSliders = ['wiSavings', 'wiReturn', 'wiExpenses'];
    whatIfSliders.forEach(id => {
      const slider = document.getElementById(id);
      if (slider) {
        slider.addEventListener('input', () => {
          this.updateWhatIfValues();
        });
      }
    });
  },

  selectFireType(type) {
    this.activeFireType = type;
    const cards = document.querySelectorAll('.fire-type-card');
    cards.forEach(c => {
      const isActive = c.getAttribute('data-type') === type;
      c.classList.toggle('active', isActive);
      c.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    const baristaBlock = document.getElementById('baristaIncomeBlock');
    const swrField = document.getElementById('swr');
    const swrSlider = document.getElementById('swrSlider');

    // Show/hide Barista Income input
    if (type === 'barista') {
      if (baristaBlock) baristaBlock.style.display = 'block';
    } else {
      if (baristaBlock) baristaBlock.style.display = 'none';
    }

    // Apply default multipliers / rules
    if (type === 'lean') {
      swrField.value = "4.0";
      this.syncInputToSlider('swr');
    } else if (type === 'regular') {
      swrField.value = "4.0";
      this.syncInputToSlider('swr');
    } else if (type === 'fat') {
      swrField.value = "3.3"; // 30x expenses SWR
      this.syncInputToSlider('swr');
    } else if (type === 'barista') {
      swrField.value = "4.0";
      this.syncInputToSlider('swr');
    }
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
    this.selectFireType(inputs.fireType);

    document.getElementById('currentExpenses').value = inputs.currentExpenses;
    this.syncInputToSlider('currentExpenses');

    document.getElementById('retirementExpenses').value = inputs.retirementExpenses;
    this.syncInputToSlider('retirementExpenses');

    document.getElementById('swr').value = inputs.swr;
    this.syncInputToSlider('swr');

    document.getElementById('savings').value = inputs.savings;
    this.syncInputToSlider('savings');

    document.getElementById('monthlySavings').value = inputs.monthlySavings;
    this.syncInputToSlider('monthlySavings');

    document.getElementById('returnRate').value = inputs.returnRate;
    this.syncInputToSlider('returnRate');

    document.getElementById('currentAge').value = inputs.currentAge;
    this.syncInputToSlider('currentAge');

    document.getElementById('baristaIncome').value = inputs.baristaIncome;
    this.syncInputToSlider('baristaIncome');

    // Keep track of edits
    if (inputs.retirementExpenses !== inputs.currentExpenses) {
      this.retirementExpensesEdited = true;
    } else {
      this.retirementExpensesEdited = false;
    }
  },

  getInputs() {
    return {
      fireType: this.activeFireType,
      currentExpenses: parseFloat(document.getElementById('currentExpenses').value) || 0,
      retirementExpenses: parseFloat(document.getElementById('retirementExpenses').value) || 0,
      swr: parseFloat(document.getElementById('swr').value) || 4.0,
      savings: parseFloat(document.getElementById('savings').value) || 0,
      monthlySavings: parseFloat(document.getElementById('monthlySavings').value) || 0,
      returnRate: parseFloat(document.getElementById('returnRate').value) || 0,
      currentAge: parseInt(document.getElementById('currentAge').value, 10) || 30,
      baristaIncome: this.activeFireType === 'barista' ? (parseFloat(document.getElementById('baristaIncome').value) || 0) : 0
    };
  },

  calculate() {
    try {
      const inputs = this.getInputs();

      const res = FireCalc.calculate(
        inputs.currentExpenses,
        inputs.retirementExpenses,
        inputs.swr,
        inputs.savings,
        inputs.monthlySavings,
        inputs.returnRate,
        inputs.currentAge,
        inputs.baristaIncome
      );

      // Display results panel
      document.getElementById('resultsPlaceholder').style.display = 'none';
      document.getElementById('resultsPanel').style.display = 'flex';

      // Animate Main Counters
      const Counter = window.CompoundPro?.CounterAnimation;
      const currency = (window.CompoundPro && window.CompoundPro.getCurrencyPrefixSuffix)
        ? window.CompoundPro.getCurrencyPrefixSuffix()
        : { prefix: '$', suffix: '' };
      if (Counter) {
        Counter.animateCounter(document.getElementById('fireNumberVal'), res.fireNumber, 1000, currency.prefix, currency.suffix, 0);
        Counter.animateCounter(document.getElementById('savingsRateVal'), res.savingsRatePct, 1000, "", "%", 1);
        Counter.animateCounter(document.getElementById('yearsToFireVal'), res.years, 1000, "", "", 0);
      } else {
        document.getElementById('fireNumberVal').textContent = FireCalc.formatCurrency(res.fireNumber);
        document.getElementById('savingsRateVal').textContent = res.savingsRatePct.toFixed(1) + "%";
        document.getElementById('yearsToFireVal').textContent = res.years;
      }

      document.getElementById('fireDateVal').textContent = res.reached ? res.fireDate : "Never (increase savings)";

      // Progress Circular Ring Animation
      const progressText = document.getElementById('progressCircleText');
      if (progressText) {
        progressText.textContent = `${res.progressPct.toFixed(0)}%`;
      }

      const circle = document.querySelector('.progress-ring__circle');
      if (circle) {
        const radius = circle.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        
        const safeProgress = Math.min(res.progressPct, 100);
        const offset = circumference - (safeProgress / 100 * circumference);
        circle.style.strokeDashoffset = offset;
      }

      // Find the FIRE intersection index in yearlyData (where balance >= target)
      let fireIndex = -1;
      for (let i = 0; i < res.yearlyData.length; i++) {
        if (res.yearlyData[i].balance >= res.fireNumber) {
          fireIndex = i;
          break;
        }
      }

      // Render Charts
      ChartManager.renderProgressChart(res.yearlyData, res.fireNumber, fireIndex);
      ChartManager.renderBreakdownChart(res.yearlyData);

      // Render What-If scenarios & baseline comparative values
      this.initWhatIfBaseline(inputs, res);
      this.updateWhatIfValues();

      // Encode state into hash
      const state = FireCalc.encodeState({
        t: inputs.fireType,
        ce: inputs.currentExpenses,
        re: inputs.retirementExpenses,
        sw: inputs.swr,
        s: inputs.savings,
        ms: inputs.monthlySavings,
        r: inputs.returnRate,
        a: inputs.currentAge,
        bi: inputs.baristaIncome
      });
      history.replaceState(null, '', '#' + state);
      window.saveCalcInputs('fire-number', inputs);

    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast(e.message, "error");
    }
  },

  // Save baseline inputs and results to compute delta values for What-If sliders
  initWhatIfBaseline(inputs, results) {
    this.baselineInputs = inputs;
    this.baselineResults = results;

    // Reset What-If sliders to zero changes
    const wiSavings = document.getElementById('wiSavings');
    if (wiSavings) wiSavings.value = 0;

    const wiReturn = document.getElementById('wiReturn');
    if (wiReturn) wiReturn.value = inputs.returnRate;

    const wiExpenses = document.getElementById('wiExpenses');
    if (wiExpenses) wiExpenses.value = 0;
  },

  updateWhatIfValues() {
    if (!this.baselineInputs || !this.baselineResults) return;

    // Get delta selections from what-if sliders
    const extraSavings = parseFloat(document.getElementById('wiSavings')?.value || 0);
    const newReturn = parseFloat(document.getElementById('wiReturn')?.value || this.baselineInputs.returnRate);
    const expenseReductionPct = parseFloat(document.getElementById('wiExpenses')?.value || 0);

    // Apply adjustments
    const adjustedSavingsRate = this.baselineInputs.monthlySavings + extraSavings;
    const adjustedReturnRate = newReturn;
    const adjustedRetExpenses = this.baselineInputs.retirementExpenses * (1 - expenseReductionPct / 100);

    // Run custom projection
    let altRes;
    try {
      altRes = FireCalc.calculate(
        this.baselineInputs.currentExpenses,
        adjustedRetExpenses,
        this.baselineInputs.swr,
        this.baselineInputs.savings,
        adjustedSavingsRate,
        adjustedReturnRate,
        this.baselineInputs.currentAge,
        this.baselineInputs.baristaIncome
      );
    } catch (e) {
      console.error(e);
      return;
    }

    // Render slider outputs adjacent to sliders
    const currency = (window.CompoundPro && window.CompoundPro.getCurrencyPrefixSuffix)
      ? window.CompoundPro.getCurrencyPrefixSuffix()
      : { prefix: '$', suffix: '' };
    document.getElementById('wiSavingsValue').textContent = `+${currency.prefix}${extraSavings.toLocaleString()}/mo${currency.suffix}`;
    document.getElementById('wiReturnValue').textContent = `${newReturn.toFixed(1)}%`;
    document.getElementById('wiExpensesValue').textContent = `-${expenseReductionPct}%`;

    // Render new projections summary text
    const newAge = this.baselineInputs.currentAge + altRes.years;
    const yearsDiff = this.baselineResults.years - altRes.years;

    let summaryText = "";
    if (altRes.reached) {
      summaryText = `New FIRE Age: <strong style="color: var(--color-emerald);">${newAge}</strong> (${altRes.fireDate})`;
      if (yearsDiff > 0) {
        summaryText += ` — <strong style="color: var(--color-orange);">Shaves off ${yearsDiff.toFixed(0)} years!</strong>`;
      } else if (yearsDiff < 0) {
        summaryText += ` — Adds ${Math.abs(yearsDiff).toFixed(0)} years.`;
      }
    } else {
      summaryText = `Alternative scenarios do not reach FIRE target portfolio within 100 years.`;
    }

    const outputEl = document.getElementById('whatIfResultSummary');
    if (outputEl) {
      outputEl.innerHTML = summaryText;
    }

    // Build/Render the What-If comparative scenario table (Tab 3)
    this.renderWhatIfTable(extraSavings, newReturn, expenseReductionPct, altRes);
  },

  renderWhatIfTable(wiExtraSavings, wiNewReturn, wiExpenseRedPct, wiAltRes) {
    const tbody = document.getElementById('whatIfTableBody');
    if (!tbody) return;

    const base = this.baselineInputs;
    const baseRes = this.baselineResults;

    // Helper to run quick scenarios
    const runScenario = (savingsAdd, returnRateVal, expenseRedRate) => {
      return FireCalc.calculate(
        base.currentExpenses,
        base.retirementExpenses * (1 - expenseRedRate / 100),
        base.swr,
        base.savings,
        base.monthlySavings + savingsAdd,
        returnRateVal,
        base.currentAge,
        base.baristaIncome
      );
    };

    // Scenarios list
    const scenarios = [
      {
        name: "Baseline Current Plan",
        savings: base.monthlySavings,
        rate: base.returnRate,
        expenses: base.retirementExpenses,
        res: baseRes
      },
      {
        name: "Save $500 more per month",
        savings: base.monthlySavings + 500,
        rate: base.returnRate,
        expenses: base.retirementExpenses,
        res: runScenario(500, base.returnRate, 0)
      },
      {
        name: "Save $1,000 more per month",
        savings: base.monthlySavings + 1000,
        rate: base.returnRate,
        expenses: base.retirementExpenses,
        res: runScenario(1000, base.returnRate, 0)
      },
      {
        name: "Investment returns +1% higher",
        savings: base.monthlySavings,
        rate: base.returnRate + 1.0,
        expenses: base.retirementExpenses,
        res: runScenario(0, base.returnRate + 1.0, 0)
      },
      {
        name: "Retirement Expenses 15% lower",
        savings: base.monthlySavings,
        rate: base.returnRate,
        expenses: base.retirementExpenses * 0.85,
        res: runScenario(0, base.returnRate, 15)
      },
      {
        name: "User Selected What-If Plan",
        savings: base.monthlySavings + wiExtraSavings,
        rate: wiNewReturn,
        expenses: base.retirementExpenses * (1 - wiExpenseRedPct / 100),
        res: wiAltRes,
        isCustom: true
      }
    ];

    tbody.innerHTML = '';
    scenarios.forEach(scen => {
      const tr = document.createElement('tr');
      if (scen.isCustom) {
        tr.style.backgroundColor = 'var(--color-orange-10)';
        tr.style.fontWeight = '600';
      }

      const diffYears = baseRes.years - scen.res.years;
      let diffStr = "";
      if (diffYears > 0) {
        diffStr = `<span style="color: var(--color-emerald); font-weight: 600;">-${diffYears} years</span>`;
      } else if (diffYears < 0) {
        diffStr = `<span style="color: red;">+${Math.abs(diffYears)} years</span>`;
      } else {
        diffStr = `<span class="text-muted">Baseline</span>`;
      }

      tr.innerHTML = `
        <td><strong>${scen.name}</strong></td>
        <td>$${scen.savings.toLocaleString()}/mo</td>
        <td>${scen.rate.toFixed(1)}%</td>
        <td>$${Math.round(scen.expenses).toLocaleString()}/yr</td>
        <td class="mono">${FireCalc.formatCurrency(scen.res.fireNumber)}</td>
        <td class="mono" style="font-weight: 600;">${scen.res.reached ? `${scen.res.years} yrs` : "Never"}</td>
        <td>${diffStr}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  reset() {
    this.retirementExpensesEdited = false;
    const defaults = {
      fireType: 'regular',
      currentExpenses: 50000,
      retirementExpenses: 50000,
      swr: 4.0,
      savings: 0,
      monthlySavings: 2000,
      returnRate: 7.0,
      currentAge: 30,
      baristaIncome: 1500 * 12
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
