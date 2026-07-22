// 3-Term Multiplicative Middle Generator - Pure Black & White App with Lag Plot

class MultiplicativeMiddle3 {
    static extractMiddleDigits(product, digits) {
        const totalDigits = digits * 3;
        let str = product.toString();
        
        while (str.length < totalDigits) {
            str = '0' + str;
        }

        const start = Math.floor((str.length - digits) / 2);
        const middleSlice = str.substring(start, start + digits);
        return parseInt(middleSlice, 10) || 0;
    }

    static generateSequence(seed1, seed2, seed3, digits, count) {
        const divisor = Math.pow(10, digits);
        const sequence = [];
        const history = [seed1 % divisor, seed2 % divisor, seed3 % divisor];

        for (let i = 0; i < count; i++) {
            if (i < 3) {
                const val = history[i];
                sequence.push({
                    step: i + 1,
                    integerX: val,
                    productP: 'Seed',
                    floatU: val / divisor
                });
            } else {
                const p1 = BigInt(history[0]);
                const p2 = BigInt(history[1]);
                const p3 = BigInt(history[2]);
                const prod = p1 * p2 * p3;

                const nextVal = this.extractMiddleDigits(prod, digits);
                const floatU = nextVal / divisor;

                sequence.push({
                    step: i + 1,
                    integerX: nextVal,
                    productP: prod.toString(),
                    floatU: floatU
                });

                history[0] = history[1];
                history[1] = history[2];
                history[2] = nextVal;
            }
        }

        return sequence;
    }
}

class StatsEngine {
    static chiSquareTest(floats, bins = 10) {
        const n = floats.length;
        const expected = n / bins;
        const counts = new Array(bins).fill(0);

        floats.forEach(val => {
            let binIdx = Math.floor(val * bins);
            if (binIdx >= bins) binIdx = bins - 1;
            counts[binIdx]++;
        });

        let chiSq = 0;
        counts.forEach(obs => {
            const diff = obs - expected;
            chiSq += (diff * diff) / expected;
        });

        const df = bins - 1;
        const criticalValue = (df === 9) ? 16.919 : 30.144;

        return {
            chiSquare: chiSq,
            df,
            criticalValue,
            passed: chiSq <= criticalValue,
            counts,
            expected
        };
    }

    static analyzeDegeneracy(sequence) {
        const seenMap = new Map();
        let zeroStep = null;
        let cycleLength = null;

        for (let i = 0; i < sequence.length; i++) {
            const val = sequence[i].integerX;

            if (val === 0 && zeroStep === null) {
                zeroStep = i + 1;
            }

            if (seenMap.has(val) && cycleLength === null) {
                cycleLength = (i + 1) - seenMap.get(val);
            } else {
                seenMap.set(val, i + 1);
            }
        }

        return {
            degeneratedToZero: zeroStep !== null,
            zeroStep,
            cycleLength,
            uniqueCount: seenMap.size
        };
    }
}

class AppManager {
    constructor() {
        this.currentTheme = 'dark';
        this.lineChart = null;
        this.histChart = null;
        this.lagChart = null;

        this.initElements();
        this.initCharts();
        this.bindEvents();
        this.runSimulation();
    }

    initElements() {
        this.htmlTag = document.documentElement;
        this.btnThemeToggle = document.getElementById('theme-toggle');
        this.themeIcon = document.getElementById('theme-icon');

        this.inputSeed1 = document.getElementById('seed1');
        this.inputSeed2 = document.getElementById('seed2');
        this.inputSeed3 = document.getElementById('seed3');
        this.selectSampleSize = document.getElementById('sample-size');
        this.selectHistBins = document.getElementById('hist-bins');

        this.btnGenerate = document.getElementById('btn-generate');
        this.presetChips = document.querySelectorAll('.btn-chip');

        this.valChi = document.getElementById('val-chi');
        this.valChiCrit = document.getElementById('val-chi-crit');
        this.badgeChi = document.getElementById('badge-chi');
        this.badgeDegen = document.getElementById('badge-degen');

        this.tableBody = document.getElementById('table-body');
        this.tabLinks = document.querySelectorAll('.tab-link');
        this.tabPanes = document.querySelectorAll('.tab-pane');
    }

    getThemeColors() {
        const isDark = this.currentTheme === 'dark';
        return {
            lineColor: isDark ? '#ffffff' : '#000000',
            fillColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
            barColor: isDark ? '#ffffff' : '#000000',
            pointColor: isDark ? '#ffffff' : '#000000',
            expectedColor: isDark ? '#a3a3a3' : '#525252',
            gridColor: isDark ? '#262626' : '#e5e5e5',
            textColor: isDark ? '#a3a3a3' : '#525252'
        };
    }

    initCharts() {
        const colors = this.getThemeColors();

        // 1. Line Chart (Sequence U_n vs Step)
        const ctxLine = document.getElementById('lineChart').getContext('2d');
        this.lineChart = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'U_n',
                    data: [],
                    borderColor: colors.lineColor,
                    backgroundColor: colors.fillColor,
                    borderWidth: 1.5,
                    pointRadius: 1.5,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        grid: { color: colors.gridColor },
                        ticks: { color: colors.textColor, font: { family: 'JetBrains Mono', size: 10 } }
                    },
                    y: {
                        min: 0,
                        max: 1,
                        grid: { color: colors.gridColor },
                        ticks: { color: colors.textColor, font: { family: 'JetBrains Mono', size: 10 } }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });

        // 2. Histogram Chart (Observed Frequencies across Bins)
        const ctxHist = document.getElementById('histChart').getContext('2d');
        this.histChart = new Chart(ctxHist, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Observed Frequency',
                        data: [],
                        backgroundColor: colors.barColor,
                        borderRadius: 2
                    },
                    {
                        label: 'Expected Baseline',
                        data: [],
                        type: 'line',
                        borderColor: colors.expectedColor,
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        grid: { color: colors.gridColor },
                        ticks: { color: colors.textColor, font: { family: 'JetBrains Mono', size: 10 } }
                    },
                    y: {
                        grid: { color: colors.gridColor },
                        ticks: { color: colors.textColor, font: { family: 'JetBrains Mono', size: 10 } }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });

        // 3. Lag Plot (Scatter Plot of (X_n, X_{n+1}))
        const ctxLag = document.getElementById('lagChart').getContext('2d');
        this.lagChart = new Chart(ctxLag, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: '(X_n, X_n+1)',
                    data: [],
                    backgroundColor: colors.pointColor,
                    borderColor: colors.pointColor,
                    pointRadius: 2.5,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        min: 0,
                        max: 1,
                        title: { display: true, text: 'X_n (Current Term)', color: colors.textColor, font: { family: 'Inter', size: 11 } },
                        grid: { color: colors.gridColor },
                        ticks: { color: colors.textColor, font: { family: 'JetBrains Mono', size: 10 } }
                    },
                    y: {
                        min: 0,
                        max: 1,
                        title: { display: true, text: 'X_n+1 (Next Term)', color: colors.textColor, font: { family: 'Inter', size: 11 } },
                        grid: { color: colors.gridColor },
                        ticks: { color: colors.textColor, font: { family: 'JetBrains Mono', size: 10 } }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    bindEvents() {
        this.btnThemeToggle.addEventListener('click', () => {
            this.currentTheme = (this.currentTheme === 'dark') ? 'light' : 'dark';
            this.htmlTag.setAttribute('data-theme', this.currentTheme);
            this.themeIcon.textContent = (this.currentTheme === 'dark') ? '☀️ Light' : '🌙 Dark';
            this.updateChartTheme();
        });

        this.btnGenerate.addEventListener('click', () => this.runSimulation());

        this.presetChips.forEach(chip => {
            chip.addEventListener('click', () => {
                this.presetChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');

                const preset = chip.dataset.preset;
                this.applyPreset(preset);
                this.runSimulation();
            });
        });

        this.tabLinks.forEach(tab => {
            tab.addEventListener('click', () => {
                this.tabLinks.forEach(t => t.classList.remove('active'));
                this.tabPanes.forEach(p => p.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(tab.dataset.tab).classList.add('active');
            });
        });
    }

    applyPreset(preset) {
        if (preset === 'standard') {
            this.inputSeed1.value = 1234;
            this.inputSeed2.value = 5678;
            this.inputSeed3.value = 9012;
        } else if (preset === 'cycle') {
            this.inputSeed1.value = 5432;
            this.inputSeed2.value = 8765;
            this.inputSeed3.value = 2345;
        } else if (preset === 'zero') {
            this.inputSeed1.value = 1001;
            this.inputSeed2.value = 1002;
            this.inputSeed3.value = 1003;
        } else if (preset === 'random') {
            this.inputSeed1.value = Math.floor(1000 + Math.random() * 9000);
            this.inputSeed2.value = Math.floor(1000 + Math.random() * 9000);
            this.inputSeed3.value = Math.floor(1000 + Math.random() * 9000);
        }
    }

    updateChartTheme() {
        const colors = this.getThemeColors();

        // 1. Line Chart
        this.lineChart.data.datasets[0].borderColor = colors.lineColor;
        this.lineChart.data.datasets[0].backgroundColor = colors.fillColor;
        this.lineChart.options.scales.x.grid.color = colors.gridColor;
        this.lineChart.options.scales.x.ticks.color = colors.textColor;
        this.lineChart.options.scales.y.grid.color = colors.gridColor;
        this.lineChart.options.scales.y.ticks.color = colors.textColor;
        this.lineChart.update();

        // 2. Hist Chart
        this.histChart.data.datasets[0].backgroundColor = colors.barColor;
        this.histChart.data.datasets[1].borderColor = colors.expectedColor;
        this.histChart.options.scales.x.grid.color = colors.gridColor;
        this.histChart.options.scales.x.ticks.color = colors.textColor;
        this.histChart.options.scales.y.grid.color = colors.gridColor;
        this.histChart.options.scales.y.ticks.color = colors.textColor;
        this.histChart.update();

        // 3. Lag Chart
        this.lagChart.data.datasets[0].backgroundColor = colors.pointColor;
        this.lagChart.data.datasets[0].borderColor = colors.pointColor;
        this.lagChart.options.scales.x.grid.color = colors.gridColor;
        this.lagChart.options.scales.x.ticks.color = colors.textColor;
        this.lagChart.options.scales.x.title.color = colors.textColor;
        this.lagChart.options.scales.y.grid.color = colors.gridColor;
        this.lagChart.options.scales.y.ticks.color = colors.textColor;
        this.lagChart.options.scales.y.title.color = colors.textColor;
        this.lagChart.update();
    }

    runSimulation() {
        const s1 = parseInt(this.inputSeed1.value, 10) || 1234;
        const s2 = parseInt(this.inputSeed2.value, 10) || 5678;
        const s3 = parseInt(this.inputSeed3.value, 10) || 9012;
        const count = parseInt(this.selectSampleSize.value, 10) || 100;
        const histBins = parseInt(this.selectHistBins.value, 10) || 10;

        const seq = MultiplicativeMiddle3.generateSequence(s1, s2, s3, 4, count);
        const floats = seq.map(item => item.floatU);

        // Stats
        const chiRes = StatsEngine.chiSquareTest(floats, histBins);
        this.valChi.textContent = chiRes.chiSquare.toFixed(2);
        this.valChiCrit.textContent = chiRes.criticalValue.toFixed(2);

        if (chiRes.passed) {
            this.badgeChi.textContent = 'UNIFORM';
            this.badgeChi.className = 'badge badge-pass';
        } else {
            this.badgeChi.textContent = 'NOT UNIFORM';
            this.badgeChi.className = 'badge badge-fail';
        }

        const degen = StatsEngine.analyzeDegeneracy(seq);
        if (degen.degeneratedToZero) {
            this.badgeDegen.textContent = `ZERO (@ #${degen.zeroStep})`;
            this.badgeDegen.className = 'badge badge-fail';
        } else if (degen.cycleLength) {
            this.badgeDegen.textContent = `CYCLE (${degen.cycleLength})`;
            this.badgeDegen.className = 'badge badge-info';
        } else {
            this.badgeDegen.textContent = 'HEALTHY';
            this.badgeDegen.className = 'badge badge-pass';
        }

        // 1. Line Chart update
        this.lineChart.data.labels = seq.map(item => item.step);
        this.lineChart.data.datasets[0].data = floats;
        this.lineChart.update();

        // 2. Hist Chart update
        const binLabels = [];
        for (let b = 0; b < histBins; b++) {
            binLabels.push(`[${(b/histBins).toFixed(1)}-${((b+1)/histBins).toFixed(1)})`);
        }
        this.histChart.data.labels = binLabels;
        this.histChart.data.datasets[0].data = chiRes.counts;
        this.histChart.data.datasets[1].data = new Array(histBins).fill(chiRes.expected);
        this.histChart.update();

        // 3. Lag Plot update ((X_n, X_{n+1}) scatter points)
        const lagPoints = [];
        for (let i = 0; i < floats.length - 1; i++) {
            lagPoints.push({
                x: floats[i],
                y: floats[i + 1]
            });
        }
        this.lagChart.data.datasets[0].data = lagPoints;
        this.lagChart.update();

        // 4. Table update
        let html = '';
        seq.forEach(item => {
            html += `
                <tr>
                    <td>#${item.step}</td>
                    <td>${item.integerX.toString().padStart(4, '0')}</td>
                    <td>${item.productP}</td>
                    <td>${item.floatU.toFixed(4)}</td>
                </tr>
            `;
        });
        this.tableBody.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AppManager();
});
