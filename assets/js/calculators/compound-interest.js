/**
 * CompoundPro - Compound Interest Calculator Engine & UI Controller
 * v2.0 - Compare Mode, Contribution Escalator, Tax Account Type,
 *        Rate Preset Explainer, Slider Tooltips, Tier System
 */

const CompoundCalc = {
  // ============== CORE CALCULATION ==============
  // Desteği: Scenario A ve Scenario B, contribution escalator,
  //          tax account type, custom tax brackets
  calculate(principal, rate, years, n, pmt, pmtFreq, pmtTiming, inflationRate, taxRate, options = {}) {
    // Options:
    //  - escalatorPct: annual % increase in contributions (e.g. 3 = %3)
    //  - accountType: 'taxable' | 'taxAdvantaged' (affects tax application)
    
    // 1. Validation
    if (principal < 0) throw new Error("Initial investment cannot be negative.");
    if (rate < 0 || rate > 100) throw new Error("Annual interest rate must be between 0% and 100%.");
    if (years <= 0 || years > 50) throw new Error("Investment period must be between 1 and 50 years.");
    if (pmt < 0) throw new Error("Regular contribution cannot be negative.");
    if (inflationRate < 0 || inflationRate > 50) throw new Error("Inflation rate must be between 0% and 50%.");
    if (taxRate < 0 || taxRate > 100) throw new Error("Tax rate must be between 0% and 100%.");

    const escalatorPct = (options.escalatorPct || 0) / 100;
    const accountType = options.accountType || 'taxable';

    const totalMonths = Math.round(years * 12);
    const r = rate / 100;
    
    let currentBalance = principal;
    let totalContributions = principal;
    let totalInterest = 0;
    
    let accruedInterest = 0; 

    const monthlyRecords = [];
    let yearStartBalance = principal;
    let yearContributions = 0;
    let yearInterest = 0;
    let currentYearPmt = pmt; // Escalator için yıllık güncellenen pmt

    for (let month = 1; month <= totalMonths; month++) {
      // Yıl başı katkısı escalator uygulanmış hali
      const currentMonth = month;
      const yearNumber = Math.ceil(month / 12);
      
      // Her yılın başında escalation uygula (yıl 1 hariç, yıl 1 başında henüz escalation yok)
      if (yearNumber > 1 && (currentMonth - 1) % 12 === 0) {
        currentYearPmt = pmt * Math.pow(1 + escalatorPct, yearNumber - 1);
      }

      let isContributionMonth = false;
      let contributionAmount = 0;

      if (pmtFreq === 12) {
        isContributionMonth = true;
        contributionAmount = currentYearPmt;
      } else if (pmtFreq === 4 && month % 3 === 0) {
        isContributionMonth = true;
        contributionAmount = currentYearPmt;
      } else if (pmtFreq === 1 && month % 12 === 0) {
        isContributionMonth = true;
        contributionAmount = currentYearPmt;
      }

      if (isContributionMonth && pmtTiming === 'beginning') {
        currentBalance += contributionAmount;
        totalContributions += contributionAmount;
        yearContributions += contributionAmount;
      }

      let monthlyInterestRate = 0;
      let monthlyInterest = 0;

      if (n === 365) {
        const dailyRate = r / 365;
        const monthlyFactor = Math.pow(1 + dailyRate, 365 / 12);
        monthlyInterest = currentBalance * (monthlyFactor - 1);
      } else if (n === 12) {
        monthlyInterest = currentBalance * (r / 12);
      } else if (n === 4) {
        const simpleMonthlyRate = r / 12;
        monthlyInterest = currentBalance * simpleMonthlyRate;
      } else if (n === 1) {
        const simpleMonthlyRate = r / 12;
        monthlyInterest = currentBalance * simpleMonthlyRate;
      }

      if (n === 365 || n === 12) {
        currentBalance += monthlyInterest;
        totalInterest += monthlyInterest;
        yearInterest += monthlyInterest;
      } else {
        accruedInterest += monthlyInterest;
        
        if (n === 4 && month % 3 === 0) {
          currentBalance += accruedInterest;
          totalInterest += accruedInterest;
          yearInterest += accruedInterest;
          accruedInterest = 0;
        }
        else if (n === 1 && month % 12 === 0) {
          currentBalance += accruedInterest;
          totalInterest += accruedInterest;
          yearInterest += accruedInterest;
          accruedInterest = 0;
        }
      }

      if (isContributionMonth && pmtTiming === 'end') {
        currentBalance += contributionAmount;
        totalContributions += contributionAmount;
        yearContributions += contributionAmount;
      }

      // Tax-advantaged hesaplarda: yıllık faiz üzerinden değil, dönem sonunda toplam kazanç üzerinden
      // Bu yüzden tax application burada değil aşağıda yapılıyor

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

    const remainingMonths = totalMonths % 12;
    if (remainingMonths > 0) {
      const currentYear = Math.ceil(totalMonths / 12);
      if (accruedInterest > 0) {
        currentBalance += accruedInterest;
        totalInterest += accruedInterest;
        yearInterest += accruedInterest;
      }
      monthlyRecords.push({
        year: currentYear,
        startBalance: yearStartBalance,
        contributions: yearContributions,
        interest: yearInterest,
        endBalance: currentBalance
      });
    }

    // Tax uygulama
    const rawTotalInterest = totalInterest;
    let finalBalance = currentBalance;
    let taxDeduction = 0;
    let effectiveTaxRate = taxRate;
    
    if (taxRate > 0) {
      // Tax-advantaged: tax yok veya çok düşük (örn. 0)
      // Taxable: tam tax uygulanır
      if (accountType === 'taxAdvantaged') {
        effectiveTaxRate = 0; // Bu hesapta tax yok
        taxDeduction = 0;
      } else {
        taxDeduction = this.afterTaxDeduction(rawTotalInterest, taxRate);
        finalBalance = currentBalance - taxDeduction;
        totalInterest = rawTotalInterest - taxDeduction;
      }
    }

    const realBalance = this.realValue(finalBalance, inflationRate, years);

    // Yearly data mapping
    let cumulativeContrib = principal;
    let cumulativeInterest = 0;
    const yearlyData = monthlyRecords.map(record => {
      cumulativeContrib += record.contributions;
      
      let recordInterest = record.interest;
      if (taxRate > 0 && accountType !== 'taxAdvantaged') {
        recordInterest = record.interest * (1 - taxRate / 100);
      }
      cumulativeInterest += recordInterest;
      const recordEndBalance = cumulativeContrib + cumulativeInterest;

      return {
        year: record.year,
        // Start balance = end balance - (yılın faizi) - (yılın katkıları)
        // Yıl 1 dahil TÜM yıllar için contributions çıkarılmalı
        startBalance: recordEndBalance - recordInterest - record.contributions,
        contributions: record.contributions,
        interest: recordInterest,
        endBalance: recordEndBalance,
        cumulativeContributions: cumulativeContrib,
        cumulativeInterest: cumulativeInterest
      };
    });

    return {
      finalBalance: Math.max(0, finalBalance),
      totalContributions: Math.max(0, totalContributions),
      totalInterest: Math.max(0, totalInterest),
      realBalance: Math.max(0, realBalance),
      taxDeducted: taxDeduction,
      yearlyData
    };
  },

  // E.g. 15% tax on capital gains
  afterTaxDeduction(gains, taxRate) {
    return gains * (taxRate / 100);
  },

  // Adjust for inflation
  realValue(nominalValue, inflationRate, years) {
    return nominalValue / Math.pow(1 + inflationRate / 100, years);
  },

  // ============== RATE PRESETS (with educational notes) ==============
  RATE_PRESETS: {
    'savings': { rate: 0.5, label: 'High-yield savings', explainer: 'High-yield savings accounts (HYSA) currently yield around 0.4-0.6%. Rates are variable and depend on central bank policy. Historical average is 0.5%.' },
    'bonds': { rate: 4.0, label: 'Bond portfolio (avg)', explainer: 'A diversified bond portfolio (Treasuries + corporate) has historically yielded 3-5% annually. Bond returns are generally more stable but offer lower growth than stocks.' },
    'sp500': { rate: 10.7, label: 'S&P 500 (avg)', explainer: 'The S&P 500 has averaged ~10.7% annually since 1926 (including dividends, before inflation). However, individual years can swing from -43% to +52%. Past performance does not guarantee future results. Compounded over 30+ years, this is highly volatile short-term but historically upward long-term.' },
    'global': { rate: 8.5, label: 'Global index fund', explainer: 'A global diversified index (e.g. VT, ACWI) has averaged 8-9% annually. Slightly lower than S&P 500 historically due to international diversification.' },
    'reits': { rate: 9.5, label: 'REITs (avg)', explainer: 'Real Estate Investment Trusts (REITs) historically average 9-10% annually through a combination of appreciation and high dividend yields (3-4%). They offer diversification away from pure equity markets.' },
    'aggressive': { rate: 12.0, label: 'Aggressive growth', explainer: 'Aggressive growth portfolios (small-cap, emerging markets, individual stock picking) can deliver higher returns but with significantly more volatility. Not recommended for risk-averse investors.' }
  },

  // Format currency
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

  // URL state (encode/decode)
  encodeState(inputs, scenario = 'a') {
    const params = new URLSearchParams();
    const prefix = scenario === 'b' ? 'b_' : '';
    for (const key in inputs) {
      params.set(prefix + key, inputs[key]);
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
    inputs.n = parseField('n', 12);
    inputs.years = parseField('y', 30);
    inputs.periodType = params.get('pt') || 'years';
    inputs.contribution = parseField('c', 0);
    inputs.pmtFreq = parseField('pf', 12);
    inputs.pmtTiming = params.get('pmt') || 'beginning';
    inputs.inflationRate = parseField('i', 3.2, true);
    inputs.taxRate = parseField('t', 0.0, true);
    inputs.startYear = parseField('sy', new Date().getFullYear());
    inputs.escalatorPct = parseField('esc', 0, true);
    inputs.accountType = params.get('at') || 'taxable';
    inputs.compareMode = params.get('cmp') === '1';

    return inputs;
  }
};


const ChartManager = {
  growthChart: null,
  breakdownChart: null,
  scenarioBChart: null,

  renderGrowthChart(yearlyData, scenarioBData = null) {
    const ctx = document.getElementById('growthChartCanvas');
    if (!ctx) return;

    if (this.growthChart) {
      this.growthChart.destroy();
    }

    const labels = yearlyData.map(d => `Year ${d.year}`);
    const initialPrincipal = yearlyData[0]?.startBalance || 0;
    
    const principalSeries = yearlyData.map(() => initialPrincipal);
    const contributionsSeries = yearlyData.map(d => Math.max(0, d.cumulativeContributions - initialPrincipal));
    const interestSeries = yearlyData.map(d => d.cumulativeInterest);

    const datasets = [
      {
        label: 'Initial Principal',
        data: principalSeries,
        borderColor: '#F97316',
        backgroundColor: 'rgba(249, 115, 22, 0.20)',
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2
      },
      {
        label: 'Cumulative Contributions',
        data: contributionsSeries,
        borderColor: '#38BDF8',
        backgroundColor: 'rgba(56, 189, 248, 0.25)',
        fill: '-1',
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2
      },
      {
        label: 'Interest Earned',
        data: interestSeries,
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.30)',
        fill: '-1',
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2
      }
    ];

    // Compare Mode: Scenario B dashed line
    if (scenarioBData && scenarioBData.yearlyData) {
      const bLabels = scenarioBData.yearlyData.map(d => `Year ${d.year}`);
      const bEndBalances = scenarioBData.yearlyData.map(d => d.cumulativeContributions + d.cumulativeInterest);
      
      // Aynı canvas üzerinde dashed line
      datasets.push({
        label: 'Scenario B (Compare)',
        data: bEndBalances,
        borderColor: '#8B5CF6',
        backgroundColor: 'transparent',
        borderDash: [8, 4],
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2.5,
        yAxisID: 'y'
      });
    }

    this.growthChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            stacked: true,
            grid: {
              color: 'rgba(148, 163, 184, 0.08)'
            },
            ticks: {
              font: { family: 'DM Sans', color: '#94A3B8' },
              callback: function(val, index) {
                return index % 5 === 0 || index === yearlyData.length - 1 ? this.getLabelForValue(val) : '';
              }
            }
          },
          y: {
            stacked: true,
            grid: {
              color: 'rgba(148, 163, 184, 0.08)'
            },
            ticks: {
              font: { family: 'JetBrains Mono', color: '#94A3B8' },
              callback: function(value) {
                if (window.CompoundPro && window.CompoundPro.formatCurrency) {
                  return window.CompoundPro.formatCurrency(value, { compact: true });
                }
                return '$' + (value / 1000).toFixed(0) + 'K';
              }
            }
          }
        },
        plugins: {
          tooltip: {
            backgroundColor: '#161B2C',
            titleColor: '#F1F5F9',
            bodyColor: '#CBD5E1',
            borderColor: 'rgba(249, 115, 22, 0.4)',
            borderWidth: 1,
            padding: 12,
            titleFont: { family: 'DM Sans', weight: '600', size: 13 },
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  label += window.CompoundPro?.formatCurrency 
                    ? window.CompoundPro.formatCurrency(context.parsed.y)
                    : '$' + context.parsed.y.toLocaleString();
                }
                return label;
              }
            }
          },
          legend: {
            position: 'bottom',
            labels: {
              font: { family: 'DM Sans', weight: '500', color: '#CBD5E1' },
              boxWidth: 12,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16
            }
          }
        }
      }
    });
  },

  renderBreakdownChart(principal, contributions, interest) {
    const ctx = document.getElementById('breakdownChartCanvas');
    if (!ctx) return;

    if (this.breakdownChart) {
      this.breakdownChart.destroy();
    }

    const total = principal + contributions + interest;
    
    const pPct = total > 0 ? ((principal / total) * 100).toFixed(1) : 0;
    const cPct = total > 0 ? ((contributions / total) * 100).toFixed(1) : 0;
    const iPct = total > 0 ? ((interest / total) * 100).toFixed(1) : 0;

    this.breakdownChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [`Principal (${pPct}%)`, `Contributions (${cPct}%)`, `Interest (${iPct}%)`],
        datasets: [{
          data: [principal, contributions, interest],
          backgroundColor: ['#F97316', '#38BDF8', '#10B981'],
          borderWidth: 2,
          borderColor: '#0F1421',
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: 'DM Sans', weight: '500', color: '#CBD5E1' },
              boxWidth: 12,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 14
            }
          },
          tooltip: {
            backgroundColor: '#161B2C',
            titleColor: '#F1F5F9',
            bodyColor: '#CBD5E1',
            borderColor: 'rgba(249, 115, 22, 0.4)',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function(context) {
                const label = context.label.split(' ')[0] || '';
                const val = window.CompoundPro?.formatCurrency 
                  ? window.CompoundPro.formatCurrency(context.raw)
                  : '$' + context.raw.toLocaleString();
                return `${label}: ${val}`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }
};


const UIController = {
  calcDebounceTimer: null,
  isCompareMode: false,

  init() {
    this.bindEvents();
    this.bindPremiumEvents();
    
    // Initial state from URL/localStorage
    let inputs = null;
    const hash = window.location.hash.substring(1);
    
    if (hash) {
      inputs = CompoundCalc.decodeState(hash);
      if (inputs.compareMode) {
        this.toggleCompareMode(true);
      }
    } else {
      inputs = window.loadCalcInputs('compound-interest');
    }

    if (inputs) {
      this.applyInputsToForm(inputs);
    }

    this.triggerCalculation();
  },

  bindEvents() {
    const inputIds = [
      'principal', 'rate', 'years', 'contribution', 
      'inflationRate', 'taxRate', 'startYear', 'escalatorPct'
    ];

    const sliderIds = [
      'principalSlider', 'rateSlider', 'yearsSlider', 'contributionSlider',
      'inflationSlider', 'taxSlider', 'escalatorSlider'
    ];

    inputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          this.syncInputToSlider(id);
          this.debouncedCalculate();
        });
      }
    });

    sliderIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          this.syncSliderToInput(id);
          this.debouncedCalculate();
        });
      }
    });

    // Compounding Segmented Buttons
    const compButtons = document.querySelectorAll('[data-comp-freq]');
    compButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        compButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('compoundingFreq').value = btn.getAttribute('data-comp-freq');
        this.debouncedCalculate();
      });
    });

    // Contribution Segmented Buttons
    const contribButtons = document.querySelectorAll('[data-contrib-freq]');
    contribButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        contribButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('contributionFreq').value = btn.getAttribute('data-contrib-freq');
        this.debouncedCalculate();
      });
    });

    // Timing Radio Buttons
    const timingRadios = document.getElementsByName('contributionTiming');
    timingRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        this.debouncedCalculate();
      });
    });

    // Account Type Toggle
    document.querySelectorAll('.account-type-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.account-type-option').forEach(o => {
          o.classList.remove('active');
          o.setAttribute('aria-pressed', 'false');
        });
        opt.classList.add('active');
        opt.setAttribute('aria-pressed', 'true');
        const type = opt.dataset.accountType;
        document.getElementById('accountType').value = type;
        this.debouncedCalculate();
      });
      // Keyboard activation (Enter / Space) for accessibility
      opt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          opt.click();
        }
      });
    });

    // Rate Presets - with explainer
    const presets = document.querySelectorAll('.rate-preset-btn');
    presets.forEach(preset => {
      preset.addEventListener('click', (e) => {
        e.preventDefault();
        const rateKey = preset.dataset.rateKey;
        const presetData = CompoundCalc.RATE_PRESETS[rateKey];
        if (!presetData) return;
        
        const rateVal = presetData.rate;
        const rateInput = document.getElementById('rate');
        const rateSlider = document.getElementById('rateSlider');
        if (rateInput) rateInput.value = rateVal;
        if (rateSlider) rateSlider.value = rateVal;
        
        // Show explainer (premium feature)
        this.showPresetExplainer(presetData);
        
        this.triggerCalculation();
      });
    });

    // Advanced Options Collapsible
    const advancedTrigger = document.getElementById('advancedOptionsTrigger');
    const advancedContent = document.getElementById('advancedOptionsContent');
    if (advancedTrigger && advancedContent) {
      advancedTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = advancedTrigger.classList.toggle('open');
        advancedTrigger.setAttribute('aria-expanded', isOpen);
        advancedTrigger.innerHTML = isOpen ? "Advanced Options ▴" : "Advanced Options ▾";
        
        if (isOpen) {
          advancedContent.classList.add('open');
          advancedContent.style.maxHeight = advancedContent.scrollHeight + 'px';
        } else {
          advancedContent.classList.remove('open');
          advancedContent.style.maxHeight = '0px';
        }
      });
    }

    // Period Select Type
    const periodSelect = document.getElementById('periodType');
    if (periodSelect) {
      periodSelect.addEventListener('change', () => {
        const type = periodSelect.value;
        const slider = document.getElementById('yearsSlider');
        const numberInput = document.getElementById('years');
        const labelText = document.getElementById('periodLabelText');

        if (type === 'months') {
          labelText.textContent = 'Investment Period (Months)';
          numberInput.max = 600;
          slider.max = 600;
          slider.step = 1;
        } else {
          labelText.textContent = 'Investment Period (Years)';
          numberInput.max = 50;
          slider.max = 50;
          slider.step = 1;
        }
        this.debouncedCalculate();
      });
    }

    // Tabs
    const tabs = document.querySelectorAll('.calc-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const targetId = tab.getAttribute('data-tab-target');
        const contents = document.querySelectorAll('.calc-tab-content');
        contents.forEach(c => c.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
      });
    });

    // Action buttons
    const calcBtn = document.getElementById('calculateBtn');
    if (calcBtn) {
      calcBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.triggerCalculation();
      });
    }

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.resetToDefaults();
      });
    }

    const csvBtn = document.getElementById('downloadCsvBtn');
    if (csvBtn) {
      csvBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.generateCSV();
      });
    }

    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.shareResults();
      });
    }

    // Compare Mode Toggle
    const compareToggle = document.getElementById('compareModeToggle');
    if (compareToggle) {
      compareToggle.addEventListener('change', () => {
        this.toggleCompareMode(compareToggle.checked);
        this.debouncedCalculate();
      });
    }

    // Settings (tier) değişikliği recalc
    document.addEventListener('recalcAllCalculators', () => {
      this.triggerCalculation();
    });
  },

  bindPremiumEvents() {
    // Premium tier değişince Compare Mode otomatik aç/kapa
    document.addEventListener('tierChanged', (e) => {
      const isPremium = e.detail.tier === 'premium';
      const compareToggle = document.getElementById('compareModeToggle');
      const compareRow = document.getElementById('compareModeRow');
      const comparePanel = document.getElementById('compareScenarioBPanel');
      
      if (compareRow) {
        compareRow.style.display = '';
      }
      if (comparePanel) {
        comparePanel.style.display = '';
      }
      if (compareToggle) {
        compareToggle.disabled = false;
      }
      
      this.triggerCalculation();
    });
  },

  // ============== COMPARE MODE ==============
  toggleCompareMode(enable) {
    this.isCompareMode = enable;
    const panel = document.getElementById('compareScenarioBPanel');
    const compareGrid = document.getElementById('compareResultsGrid');
    const compareDelta = document.getElementById('compareDelta');
    
    if (panel) panel.style.display = enable ? 'block' : 'none';
    if (compareGrid) compareGrid.style.display = enable ? 'grid' : 'none';
    if (compareDelta) compareDelta.style.display = enable ? 'flex' : 'none';
    
    // B senaryosu inputlarını da dinle
    if (enable) {
      const bInputIds = ['principalB', 'rateB', 'contributionB', 'yearsB'];
      bInputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.bound) {
          el.dataset.bound = 'true';
          el.addEventListener('input', () => this.debouncedCalculate());
          const sliderId = id + 'Slider';
          const slider = document.getElementById(sliderId);
          if (slider && !slider.dataset.bound) {
            slider.dataset.bound = 'true';
            slider.addEventListener('input', () => {
              const val = slider.value;
              el.value = val;
              this.debouncedCalculate();
            });
          }
        }
      });
    }
  },

  // ============== RATE PRESET EXPLAINER ==============
  showPresetExplainer(presetData) {
    const explainer = document.getElementById('ratePresetExplainer');
    if (!explainer) return;
    
    // Premium feature check (set by PremiumUI based on tier)
    const isPremium = window.CompoundPro?.TierManager?.isPremium();
    const fullText = presetData.explainer;
    const previewText = fullText.substring(0, 100) + '...';
    
    if (isPremium) {
      explainer.innerHTML = `<strong>📊 ${presetData.label}:</strong> ${fullText}`;
    } else {
      explainer.innerHTML = `<strong>📊 ${presetData.label}:</strong> ${previewText} <a href="#" onclick="event.preventDefault(); window.CompoundPro.SettingsModal.open();" style="color: var(--color-violet); font-weight: 600;">🔒 Unlock full explainer (Premium)</a>`;
    }
    explainer.classList.add('show');
    
    // 8 saniye sonra otomatik gizle
    clearTimeout(this._explainerTimer);
    this._explainerTimer = setTimeout(() => {
      explainer.classList.remove('show');
    }, 8000);
  },

  // ============== SYNC INPUT <-> SLIDER ==============
  syncInputToSlider(inputId) {
    const input = document.getElementById(inputId);
    const slider = document.getElementById(inputId + 'Slider');
    if (input && slider) {
      slider.value = input.value;
      // Slider fill'i güncelle
      if (typeof window.updateSliderFill === 'function') {
        window.updateSliderFill(slider);
      }
    }
  },

  syncSliderToInput(sliderId) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(sliderId.replace('Slider', ''));
    if (slider && input) {
      input.value = slider.value;
      // Slider fill'i güncelle
      if (typeof window.updateSliderFill === 'function') {
        window.updateSliderFill(slider);
      }
    }
  },

  debouncedCalculate() {
    clearTimeout(this.calcDebounceTimer);
    this.calcDebounceTimer = setTimeout(() => {
      this.triggerCalculation();
    }, 250);
  },

  // ============== GET/SET FORM INPUTS ==============
  getCurrentFormInputs() {
    const principal = parseFloat(document.getElementById('principal').value) || 0;
    const rate = parseFloat(document.getElementById('rate').value) || 0;
    
    let years = parseFloat(document.getElementById('years').value) || 0;
    const periodType = document.getElementById('periodType').value;
    
    const rawYears = years;
    if (periodType === 'months') {
      years = years / 12;
    }

    const compoundingFreqVal = parseInt(document.getElementById('compoundingFreq').value, 10) || 12;
    const contribution = parseFloat(document.getElementById('contribution').value) || 0;
    const contributionFreqVal = parseInt(document.getElementById('contributionFreq').value, 10) || 12;
    
    let contributionTiming = 'beginning';
    const timingRadios = document.getElementsByName('contributionTiming');
    for (const radio of timingRadios) {
      if (radio.checked) {
        contributionTiming = radio.value;
        break;
      }
    }

    const inflationRate = parseFloat(document.getElementById('inflationRate').value) || 0;
    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const startYear = parseInt(document.getElementById('startYear').value, 10) || new Date().getFullYear();
    const escalatorPct = parseFloat(document.getElementById('escalatorPct')?.value) || 0;
    const accountType = document.getElementById('accountType')?.value || 'taxable';

    return {
      principal, rate, years, rawYears, periodType,
      n: compoundingFreqVal, contribution, pmtFreq: contributionFreqVal,
      pmtTiming: contributionTiming,
      inflationRate, taxRate, startYear, escalatorPct, accountType
    };
  },

  applyInputsToForm(inputs) {
    const setIfExists = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null) el.value = val;
    };

    setIfExists('principal', inputs.principal);
    this.syncInputToSlider('principal');

    setIfExists('rate', inputs.rate);
    this.syncInputToSlider('rate');

    setIfExists('periodType', inputs.periodType);
    document.getElementById('periodType').dispatchEvent(new Event('change'));
    setIfExists('years', inputs.years);
    this.syncInputToSlider('years');

    setIfExists('contribution', inputs.contribution);
    this.syncInputToSlider('contribution');

    // Compounding
    const compVal = inputs.n;
    setIfExists('compoundingFreq', compVal);
    const compBtns = document.querySelectorAll('[data-comp-freq]');
    compBtns.forEach(btn => {
      if (parseInt(btn.getAttribute('data-comp-freq'), 10) === compVal) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Contribution freq
    const contribVal = inputs.pmtFreq;
    setIfExists('contributionFreq', contribVal);
    const contribBtns = document.querySelectorAll('[data-contrib-freq]');
    contribBtns.forEach(btn => {
      if (parseInt(btn.getAttribute('data-contrib-freq'), 10) === contribVal) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const timingRadios = document.getElementsByName('contributionTiming');
    timingRadios.forEach(radio => {
      radio.checked = radio.value === inputs.pmtTiming;
    });

    setIfExists('inflationRate', inputs.inflationRate);
    setIfExists('taxRate', inputs.taxRate);
    setIfExists('startYear', inputs.startYear);
    setIfExists('escalatorPct', inputs.escalatorPct || 0);
    setIfExists('accountType', inputs.accountType || 'taxable');
    
    // Account type UI sync
    document.querySelectorAll('.account-type-option').forEach(opt => {
      const isActive = opt.dataset.accountType === (inputs.accountType || 'taxable');
      opt.classList.toggle('active', isActive);
      opt.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  },

  // ============== CALCULATION TRIGGER ==============
  triggerCalculation() {
    try {
      const inputs = this.getCurrentFormInputs();
      
      const calcOptions = {
        escalatorPct: inputs.escalatorPct,
        accountType: inputs.accountType
      };

      // Scenario A
      const results = CompoundCalc.calculate(
        inputs.principal, inputs.rate, inputs.years, inputs.n,
        inputs.contribution, inputs.pmtFreq, inputs.pmtTiming,
        inputs.inflationRate, inputs.taxRate, calcOptions
      );

      // Scenario B (compare mode)
      let resultsB = null;
      if (this.isCompareMode) {
        const principalB = parseFloat(document.getElementById('principalB')?.value) || inputs.principal;
        const rateB = parseFloat(document.getElementById('rateB')?.value) || inputs.rate;
        const contributionB = parseFloat(document.getElementById('contributionB')?.value) || inputs.contribution;
        const yearsB = parseFloat(document.getElementById('yearsB')?.value) || inputs.rawYears;
        
        resultsB = CompoundCalc.calculate(
          principalB, rateB, yearsB, inputs.n,
          contributionB, inputs.pmtFreq, inputs.pmtTiming,
          inputs.inflationRate, inputs.taxRate, calcOptions
        );
      }

      this.updateResults(results, inputs, resultsB);
      
      // Save state to URL hash
      const encodedState = CompoundCalc.encodeState({
        p: inputs.principal, r: inputs.rate, y: inputs.rawYears,
        pt: inputs.periodType, n: inputs.n, c: inputs.contribution,
        pf: inputs.pmtFreq, pmt: inputs.pmtTiming, i: inputs.inflationRate,
        t: inputs.taxRate, sy: inputs.startYear, esc: inputs.escalatorPct,
        at: inputs.accountType, cmp: this.isCompareMode ? '1' : '0'
      });

      history.replaceState(null, '', '#' + encodedState);
      window.saveCalcInputs('compound-interest', inputs);

    } catch (e) {
      console.error("Calculation Error:", e.message);
      if (window.showToast) window.showToast(e.message, "error");
    }
  },

  updateResults(results, inputs, resultsB = null) {
    const placeholder = document.getElementById('resultsPlaceholder');
    const resultsPanel = document.getElementById('resultsPanel');
    if (placeholder && resultsPanel) {
      placeholder.style.display = 'none';
      resultsPanel.style.display = 'flex';
    }

    // Counter animation
    const finalBalanceEl = document.getElementById('finalBalanceValue');
    const totalInvestedEl = document.getElementById('totalInvestedValue');
    const interestEarnedEl = document.getElementById('interestEarnedValue');
    const realBalanceEl = document.getElementById('realBalanceValue');

    if (window.CompoundPro && window.CompoundPro.CounterAnimation) {
      const Counter = window.CompoundPro.CounterAnimation;
      const currency = (window.CompoundPro && window.CompoundPro.getCurrencyPrefixSuffix)
        ? window.CompoundPro.getCurrencyPrefixSuffix()
        : { prefix: '$', suffix: '' };
      Counter.animateCounter(finalBalanceEl, results.finalBalance, 1000, currency.prefix, currency.suffix, 0);
      Counter.animateCounter(totalInvestedEl, results.totalContributions, 1000, currency.prefix, currency.suffix, 0);
      Counter.animateCounter(interestEarnedEl, results.totalInterest, 1000, currency.prefix, currency.suffix, 0);
      if (realBalanceEl) {
        Counter.animateCounter(realBalanceEl, results.realBalance, 1000, currency.prefix, currency.suffix, 0);
      }
    } else {
      finalBalanceEl.textContent = CompoundCalc.formatCurrency(results.finalBalance);
      totalInvestedEl.textContent = CompoundCalc.formatCurrency(results.totalContributions);
      interestEarnedEl.textContent = CompoundCalc.formatCurrency(results.totalInterest);
      if (realBalanceEl) realBalanceEl.textContent = CompoundCalc.formatCurrency(results.realBalance);
    }

    const realReturnCard = document.getElementById('realReturnCard');
    if (realReturnCard) {
      realReturnCard.style.display = inputs.inflationRate > 0 ? 'block' : 'none';
    }

    const finalBalanceGrowthEl = document.getElementById('finalBalanceGrowthPct');
    const interestPctEl = document.getElementById('interestEarnedPct');
    
    if (finalBalanceGrowthEl) {
      const growthPct = (((results.finalBalance - results.totalContributions) / results.totalContributions) * 100) || 0;
      finalBalanceGrowthEl.textContent = `+${growthPct.toFixed(0)}% total growth`;
    }

    if (interestPctEl) {
      const interestPct = ((results.totalInterest / results.finalBalance) * 100) || 0;
      interestPctEl.textContent = `${interestPct.toFixed(1)}% of final balance`;
    }

    // Charts (with optional B scenario)
    ChartManager.renderGrowthChart(results.yearlyData, resultsB);
    ChartManager.renderBreakdownChart(inputs.principal, (results.totalContributions - inputs.principal), results.totalInterest);

    // Compare mode results panel
    if (this.isCompareMode && resultsB) {
      this.renderCompareResults(results, resultsB, inputs);
    }

    // Table
    this.renderTable(results.yearlyData, inputs.startYear);

    // Insights
    this.generateInsights(results, inputs);
  },

  renderCompareResults(resultsA, resultsB, inputs) {
    const grid = document.getElementById('compareResultsGrid');
    const delta = document.getElementById('compareDelta');
    if (!grid) return;
    
    const fmt = CompoundCalc.formatCurrency;
    
    grid.innerHTML = `
      <div class="compare-card" data-scenario="a">
        <h4 class="heading-sm" style="margin-bottom: 12px;">Scenario A</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <span class="body-sm" style="color: var(--color-text-muted);">Final Balance:</span>
            <span class="mono-sm" style="color: var(--color-orange-2); font-weight: 600;">${fmt(resultsA.finalBalance)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span class="body-sm" style="color: var(--color-text-muted);">Contributions:</span>
            <span class="mono-sm">${fmt(resultsA.totalContributions)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span class="body-sm" style="color: var(--color-text-muted);">Interest:</span>
            <span class="mono-sm" style="color: var(--color-emerald-2);">${fmt(resultsA.totalInterest)}</span>
          </div>
        </div>
      </div>
      <div class="compare-card" data-scenario="b">
        <h4 class="heading-sm" style="margin-bottom: 12px;">Scenario B</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <span class="body-sm" style="color: var(--color-text-muted);">Final Balance:</span>
            <span class="mono-sm" style="color: #C4B5FD; font-weight: 600;">${fmt(resultsB.finalBalance)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span class="body-sm" style="color: var(--color-text-muted);">Contributions:</span>
            <span class="mono-sm">${fmt(resultsB.totalContributions)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span class="body-sm" style="color: var(--color-text-muted);">Interest:</span>
            <span class="mono-sm" style="color: var(--color-emerald-2);">${fmt(resultsB.totalInterest)}</span>
          </div>
        </div>
      </div>
    `;
    
    if (delta) {
      const diff = resultsB.finalBalance - resultsA.finalBalance;
      const pctDiff = resultsA.finalBalance > 0 ? ((diff / resultsA.finalBalance) * 100).toFixed(1) : 0;
      const sign = diff >= 0 ? '+' : '';
      const isPositive = diff >= 0;
      
      delta.innerHTML = `
        <span class="compare-delta-label">Difference (B − A):</span>
        <span class="compare-delta-value ${isPositive ? 'positive' : 'negative'}">
          ${sign}${fmt(diff)} (${sign}${pctDiff}%)
        </span>
      `;
      delta.style.display = 'flex';
    }
  },

  renderTable(yearlyData, startYear) {
    const tableBody = document.getElementById('yearlyTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    
    let lastCumulativeContributions = 0;
    yearlyData.forEach((row) => {
      const tr = document.createElement('tr');
      
      if (row.year % 5 === 0) {
        tr.style.backgroundColor = 'var(--color-bg-elevated-2)';
      }

      if (row.year === yearlyData.length) {
        tr.style.backgroundColor = 'var(--color-emerald-10)';
        tr.style.fontWeight = 'bold';
      }

      const calendarYear = startYear + Math.floor(row.year);
      const growthPct = (((row.endBalance - row.startBalance) / row.startBalance) * 100) || 0;
      // Bu yıl yapılan ek katkılar (principal HARİÇ)
      // Principal zaten "Initial Investment" olarak başlangıç bakiyesinde gösteriliyor
      const contributionsThisYear = row.contributions || 0;

      tr.innerHTML = `
        <td>${row.year}</td>
        <td>${calendarYear}</td>
        <td>${CompoundCalc.formatCurrency(row.startBalance)}</td>
        <td>${CompoundCalc.formatCurrency(contributionsThisYear)}</td>
        <td>${CompoundCalc.formatCurrency(row.interest)}</td>
        <td>${CompoundCalc.formatCurrency(row.endBalance)}</td>
        <td class="growth-positive">+${growthPct.toFixed(1)}%</td>
      `;

      tableBody.appendChild(tr);
    });

    const totalTr = document.createElement('tr');
    totalTr.innerHTML = `
      <td colspan="3"><strong>Totals</strong></td>
      <td><strong>${CompoundCalc.formatCurrency(yearlyData[yearlyData.length - 1].cumulativeContributions)}</strong></td>
      <td><strong>${CompoundCalc.formatCurrency(yearlyData[yearlyData.length - 1].cumulativeInterest)}</strong></td>
      <td><strong>${CompoundCalc.formatCurrency(yearlyData[yearlyData.length - 1].endBalance)}</strong></td>
      <td></td>
    `;
    tableBody.appendChild(totalTr);

    this.cachedYearlyData = yearlyData;
    this.cachedStartYear = startYear;
  },

  generateInsights(results, inputs) {
    const insightBox = document.getElementById('calcInsightBox');
    if (!insightBox) return;

    const insights = [];

    // 1. Rule of 72
    const doublingYears = inputs.rate > 0 ? (72 / inputs.rate).toFixed(1) : "∞";
    insights.push(`At this rate, your money doubles every <strong>${doublingYears} years</strong> (Rule of 72).`);

    // 2. Crossover point
    let crossoverYear = -1;
    for (let i = 0; i < results.yearlyData.length; i++) {
      const data = results.yearlyData[i];
      if (data.cumulativeInterest > data.cumulativeContributions) {
        crossoverYear = data.year;
        break;
      }
    }

    if (crossoverYear !== -1) {
      insights.push(`Your accumulated interest earnings will exceed your total contributions after year <strong>${crossoverYear}</strong>.`);
    } else {
      insights.push(`With these contributions, your principal + additions remain higher than interest accumulated over ${results.yearlyData.length} years.`);
    }

    // 3. Real return
    const nominalFinal = results.finalBalance;
    const realFinal = results.realBalance;
    const lossPct = (((nominalFinal - realFinal) / nominalFinal) * 100) || 0;
    
    if (inputs.inflationRate > 0) {
      insights.push(`Inflation reduces your purchasing power by <strong>${lossPct.toFixed(0)}%</strong>, making your real return equivalent to <strong>${CompoundCalc.formatCurrency(realFinal)}</strong> today.`);
    }

    // 4. Escalator benefit
    if (inputs.escalatorPct > 0) {
      insights.push(`Your contributions increase by <strong>${inputs.escalatorPct}% annually</strong>, modeling real income growth. Over the term, this significantly boosts your final balance.`);
    }

    // 5. Account type hint
    if (inputs.accountType === 'taxAdvantaged' && inputs.taxRate > 0) {
      insights.push(`<strong>Tax-advantaged account:</strong> your ${inputs.taxRate}% tax rate is ignored. In a taxable account, you'd lose <strong>${CompoundCalc.formatCurrency(results.taxDeducted || 0)}</strong> to taxes.`);
    }

    insightBox.innerHTML = `
      <div class="callout-icon">💡</div>
      <div class="callout-content">
        <div class="callout-title">Key Insights</div>
        <ul>
          ${insights.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>
    `;
  },

  generateCSV() {
    const data = this.cachedYearlyData;
    if (!data) return;

    const startYear = this.cachedStartYear;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Year,Calendar Year,Start Balance,Contributions,Interest Earned,End Balance,Cumulative Contributions,Cumulative Interest\n";

    let lastContributions = 0;
    data.forEach(row => {
      const calendarYear = startYear + Math.floor(row.year);
      // Bu yıl yapılan ek katkı (principal HARİÇ)
      const contribThisYear = row.contributions || 0;

      csvContent += `${row.year},${calendarYear},${row.startBalance.toFixed(2)},${contribThisYear.toFixed(2)},${row.interest.toFixed(2)},${row.endBalance.toFixed(2)},${row.cumulativeContributions.toFixed(2)},${row.cumulativeInterest.toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `compound_interest_breakdown_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (window.showToast) window.showToast('CSV downloaded', 'success');
  },

  shareResults() {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        if (window.showToast) window.showToast('Link copied! Share your results.', 'success');
      }).catch(() => {
        if (window.showToast) window.showToast('Copy failed. URL: ' + url, 'error');
      });
    } else {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        if (window.showToast) window.showToast('Link copied!', 'success');
      } catch (e) {
        if (window.showToast) window.showToast('Copy failed.', 'error');
      }
      document.body.removeChild(ta);
    }
  },

  resetToDefaults() {
    const defaults = {
      principal: 10000,
      rate: 7,
      periodType: 'years',
      years: 30,
      contribution: 500,
      n: 12,
      pmtFreq: 12,
      pmtTiming: 'beginning',
      inflationRate: 3.2,
      taxRate: 15,
      startYear: new Date().getFullYear(),
      escalatorPct: 0,
      accountType: 'taxable'
    };

    this.applyInputsToForm(defaults);
    this.triggerCalculation();
  }
};

// Init
document.addEventListener('DOMContentLoaded', () => UIController.init());

// Currency değişince recalc
document.addEventListener('currencyChanged', () => {
  if (typeof UIController !== 'undefined' && UIController.triggerCalculation) {
    UIController.triggerCalculation();
  }
});
