// Monte Carlo Pi Estimation - Web App matching reference diagram colors & plot style

class SeededRng {
    constructor(seed = 42) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    nextFloat() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
}

class MonteCarloEngine {
    static estimatePi(n, seed = 42, distribution = 'uniform') {
        const rng = new SeededRng(seed);
        let hits = 0;
        const points = [];
        const convergenceData = [];

        const stepSize = Math.max(1, Math.floor(n / 200));

        for (let i = 0; i < n; i++) {
            let x, y;
            if (distribution === 'uniform') {
                x = rng.nextFloat();
                y = rng.nextFloat();
            } else {
                // Skewed non-uniform distribution
                x = Math.sqrt(rng.nextFloat());
                y = Math.sqrt(rng.nextFloat());
            }

            const distSq = x * x + y * y;
            const inside = distSq <= 1.0;
            if (inside) hits++;

            if (i < 3000) {
                points.push({ index: i + 1, x, y, distSq, inside });
            }

            if ((i + 1) % stepSize === 0 || i === n - 1) {
                const currentPi = 4.0 * (hits / (i + 1));
                convergenceData.push({ step: i + 1, pi: currentPi });
            }
        }

        const piEstimate = 4.0 * (hits / n);
        const actualPi = Math.PI;
        const absError = Math.abs(piEstimate - actualPi);
        const relError = (absError / actualPi) * 100;

        return {
            n,
            hits,
            piEstimate,
            actualPi,
            absError,
            relError,
            points,
            convergenceData
        };
    }
}

class AppManager {
    constructor() {
        this.currentTheme = 'dark';
        this.scatterChart = null;
        this.convergenceChart = null;

        this.initElements();
        this.initCharts();
        this.bindEvents();
        this.runSimulation();
    }

    initElements() {
        this.htmlTag = document.documentElement;
        this.btnThemeToggle = document.getElementById('theme-toggle');
        this.themeIcon = document.getElementById('theme-icon');

        this.selectSampleSize = document.getElementById('sample-size');
        this.selectSamplingType = document.getElementById('sampling-type');
        this.chkRandomSeed = document.getElementById('chk-random-seed');
        this.inputSeed = document.getElementById('seed-value');
        this.inputSeed.value = Math.floor(10000 + Math.random() * 900000);
        this.inputSeed.disabled = this.chkRandomSeed.checked;
        this.btnRun = document.getElementById('btn-run');

        this.valPiEst = document.getElementById('val-pi-est');
        this.valAbsErr = document.getElementById('val-abs-err');
        this.valRelErr = document.getElementById('val-rel-err');
        this.valHits = document.getElementById('val-hits');

        this.tableBody = document.getElementById('table-body');
        this.tabLinks = document.querySelectorAll('.tab-link');
        this.tabPanes = document.querySelectorAll('.tab-pane');
    }

    getThemeColors() {
        const isDark = this.currentTheme === 'dark';
        return {
            insidePoint: isDark ? '#f87171' : '#ef4444', // Red inside quarter circle (matching diagram)
            outsidePoint: isDark ? '#60a5fa' : '#3b82f6', // Blue outside quarter circle (matching diagram)
            arcColor: isDark ? '#ffffff' : '#000000',
            lineColor: isDark ? '#ffffff' : '#000000',
            expectedColor: isDark ? '#a3a3a3' : '#525252',
            gridColor: isDark ? '#262626' : '#e5e5e5',
            textColor: isDark ? '#a3a3a3' : '#525252'
        };
    }

    initCharts() {
        const colors = this.getThemeColors();

        // Generate Arc points (X^2 + Y^2 = 1)
        const arcPoints = [];
        for (let i = 0; i <= 100; i++) {
            const theta = (i / 100) * (Math.PI / 2);
            arcPoints.push({ x: Math.cos(theta), y: Math.sin(theta) });
        }

        // 1. Scatter Chart (Quarter Circle Points - Red / Blue matching reference JPG)
        const ctxScatter = document.getElementById('scatterChart').getContext('2d');
        this.scatterChart = new Chart(ctxScatter, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Inside Quarter Circle (Hits)',
                        data: [],
                        backgroundColor: colors.insidePoint,
                        pointRadius: 2.2,
                        pointHoverRadius: 4
                    },
                    {
                        label: 'Outside Quarter Circle (Misses)',
                        data: [],
                        backgroundColor: colors.outsidePoint,
                        pointRadius: 2.2,
                        pointHoverRadius: 4
                    },
                    {
                        label: 'Quarter Circle Arc (X² + Y² = 1)',
                        data: arcPoints,
                        type: 'line',
                        borderColor: colors.arcColor,
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        min: 0,
                        max: 1.02,
                        grid: { color: colors.gridColor },
                        ticks: { color: colors.textColor, font: { family: 'JetBrains Mono', size: 10 } }
                    },
                    y: {
                        min: 0,
                        max: 1.02,
                        grid: { color: colors.gridColor },
                        ticks: { color: colors.textColor, font: { family: 'JetBrains Mono', size: 10 } }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });

        // 2. Convergence Chart (Estimated Pi vs N)
        const ctxConv = document.getElementById('convergenceChart').getContext('2d');
        this.convergenceChart = new Chart(ctxConv, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Estimated π',
                        data: [],
                        borderColor: colors.lineColor,
                        borderWidth: 1.5,
                        pointRadius: 0
                    },
                    {
                        label: 'Actual π (3.14159)',
                        data: [],
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
    }

    bindEvents() {
        this.btnThemeToggle.addEventListener('click', () => {
            this.currentTheme = (this.currentTheme === 'dark') ? 'light' : 'dark';
            this.htmlTag.setAttribute('data-theme', this.currentTheme);
            this.themeIcon.textContent = (this.currentTheme === 'dark') ? '☀️ Light' : '🌙 Dark';
            this.updateChartTheme();
        });

        this.chkRandomSeed.addEventListener('change', () => {
            this.inputSeed.disabled = this.chkRandomSeed.checked;
        });

        this.btnRun.addEventListener('click', () => this.runSimulation());

        this.tabLinks.forEach(tab => {
            tab.addEventListener('click', () => {
                this.tabLinks.forEach(t => t.classList.remove('active'));
                this.tabPanes.forEach(p => p.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(tab.dataset.tab).classList.add('active');
            });
        });
    }

    updateChartTheme() {
        const colors = this.getThemeColors();

        this.scatterChart.data.datasets[0].backgroundColor = colors.insidePoint;
        this.scatterChart.data.datasets[1].backgroundColor = colors.outsidePoint;
        this.scatterChart.data.datasets[2].borderColor = colors.arcColor;
        this.scatterChart.options.scales.x.grid.color = colors.gridColor;
        this.scatterChart.options.scales.x.ticks.color = colors.textColor;
        this.scatterChart.options.scales.y.grid.color = colors.gridColor;
        this.scatterChart.options.scales.y.ticks.color = colors.textColor;
        this.scatterChart.update();

        this.convergenceChart.data.datasets[0].borderColor = colors.lineColor;
        this.convergenceChart.data.datasets[1].borderColor = colors.expectedColor;
        this.convergenceChart.options.scales.x.grid.color = colors.gridColor;
        this.convergenceChart.options.scales.x.ticks.color = colors.textColor;
        this.convergenceChart.options.scales.y.grid.color = colors.gridColor;
        this.convergenceChart.options.scales.y.ticks.color = colors.textColor;
        this.convergenceChart.update();
    }

    runSimulation() {
        if (this.chkRandomSeed.checked) {
            this.inputSeed.value = Math.floor(10000 + Math.random() * 900000);
        }

        const n = parseInt(this.selectSampleSize.value, 10) || 1000;
        const seed = parseInt(this.inputSeed.value, 10) || 42;
        const dist = this.selectSamplingType.value;

        const res = MonteCarloEngine.estimatePi(n, seed, dist);

        // Update stats
        this.valPiEst.textContent = res.piEstimate.toFixed(4);
        this.valAbsErr.textContent = res.absError.toFixed(4);
        this.valRelErr.textContent = `${res.relError.toFixed(2)}%`;
        this.valHits.textContent = `${res.hits} / ${res.n}`;

        // Update scatter plot (Red inside, Blue outside)
        const insidePoints = res.points.filter(p => p.inside).map(p => ({ x: p.x, y: p.y }));
        const outsidePoints = res.points.filter(p => !p.inside).map(p => ({ x: p.x, y: p.y }));

        this.scatterChart.data.datasets[0].data = insidePoints;
        this.scatterChart.data.datasets[1].data = outsidePoints;
        this.scatterChart.update();

        // Update convergence curve
        this.convergenceChart.data.labels = res.convergenceData.map(d => d.step);
        this.convergenceChart.data.datasets[0].data = res.convergenceData.map(d => d.pi);
        this.convergenceChart.data.datasets[1].data = new Array(res.convergenceData.length).fill(Math.PI);
        this.convergenceChart.update();

        // Update table
        let html = '';
        res.points.slice(0, 100).forEach(p => {
            html += `
                <tr>
                    <td>#${p.index}</td>
                    <td>${p.x.toFixed(4)}</td>
                    <td>${p.y.toFixed(4)}</td>
                    <td>${p.distSq.toFixed(4)}</td>
                    <td>${p.inside ? 'INSIDE' : 'OUTSIDE'}</td>
                </tr>
            `;
        });
        this.tableBody.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AppManager();
});
