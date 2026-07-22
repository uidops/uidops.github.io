// Network Routing & Fastest Paths Simulator - Pure Black & White App with Multi-Path Race Engine

class NetworkGraph {
    constructor() {
        this.nodes = [];
        this.links = [];
        this.nodeCounter = 0;
    }

    addNode(x, y, customId = null) {
        let id = customId;
        if (!id) {
            const letter = String.fromCharCode(65 + (this.nodeCounter % 26));
            const suffix = Math.floor(this.nodeCounter / 26);
            id = suffix > 0 ? `${letter}${suffix}` : letter;
            this.nodeCounter++;
        }
        const node = { id, x, y, radius: 18 };
        this.nodes.push(node);
        return node;
    }

    removeNode(nodeId) {
        this.nodes = this.nodes.filter(n => n.id !== nodeId);
        this.links = this.links.filter(l => l.from !== nodeId && l.to !== nodeId);
    }

    addLink(fromId, toId, bwMbps = 100, delayMs = 10) {
        if (fromId === toId) return null;

        const existing = this.links.find(
            l => (l.from === fromId && l.to === toId) || (l.from === toId && l.to === fromId)
        );
        if (existing) {
            existing.bwMbps = bwMbps;
            existing.delayMs = delayMs;
            return existing;
        }

        const link = {
            id: `L_${fromId}_${toId}`,
            from: fromId,
            to: toId,
            bwMbps: parseFloat(bwMbps),
            delayMs: parseFloat(delayMs)
        };
        this.links.push(link);
        return link;
    }

    removeLink(linkId) {
        this.links = this.links.filter(l => l.id !== linkId);
    }

    findNodeAt(x, y) {
        return this.nodes.find(n => {
            const dx = n.x - x;
            const dy = n.y - y;
            return Math.sqrt(dx * dx + dy * dy) <= n.radius + 4;
        });
    }

    findLinkAt(x, y) {
        return this.links.find(l => {
            const n1 = this.nodes.find(n => n.id === l.from);
            const n2 = this.nodes.find(n => n.id === l.to);
            if (!n1 || !n2) return false;

            const A = x - n1.x;
            const B = y - n1.y;
            const C = n2.x - n1.x;
            const D = n2.y - n1.y;

            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = -1;
            if (lenSq !== 0) param = dot / lenSq;

            let xx, yy;
            if (param < 0) {
                xx = n1.x;
                yy = n1.y;
            } else if (param > 1) {
                xx = n2.x;
                yy = n2.y;
            } else {
                xx = n1.x + param * C;
                yy = n1.y + param * D;
            }

            const dx = x - xx;
            const dy = y - yy;
            return Math.sqrt(dx * dx + dy * dy) <= 8;
        });
    }

    calculateEdgeCost(link, packetSizeBytes) {
        const propDelay = link.delayMs;
        const packetBits = packetSizeBytes * 8;
        const bwBps = link.bwMbps * 1e6;
        const transDelay = (packetBits / bwBps) * 1000; // ms
        return propDelay + transDelay;
    }

    findAllPaths(srcId, destId, packetSizeBytes = 1500) {
        if (srcId === destId) return [];

        const adjacency = {};
        this.nodes.forEach(n => { adjacency[n.id] = []; });

        this.links.forEach(l => {
            const cost = this.calculateEdgeCost(l, packetSizeBytes);
            adjacency[l.from].push({ target: l.to, link: l, cost });
            adjacency[l.to].push({ target: l.from, link: l, cost });
        });

        const allPaths = [];
        const visited = new Set();

        const dfs = (currId, currentPath, totalDelay, minBw) => {
            visited.add(currId);
            currentPath.push(currId);

            if (currId === destId) {
                allPaths.push({
                    route: [...currentPath],
                    totalDelayMs: totalDelay,
                    bottleneckBw: minBw
                });
            } else {
                for (const edge of adjacency[currId]) {
                    if (!visited.has(edge.target)) {
                        dfs(
                            edge.target,
                            currentPath,
                            totalDelay + edge.cost,
                            Math.min(minBw, edge.link.bwMbps)
                        );
                    }
                }
            }

            currentPath.pop();
            visited.delete(currId);
        };

        dfs(srcId, [], 0, Infinity);

        allPaths.sort((a, b) => a.totalDelayMs - b.totalDelayMs);
        return allPaths;
    }
}

class AppManager {
    constructor() {
        this.currentTheme = 'dark';
        this.graph = new NetworkGraph();
        this.currentTool = 'select';
        
        this.selectedNode = null;
        this.selectedLink = null;
        this.linkSourceNode = null;
        this.draggingNode = null;
        this.dragOffset = { x: 0, y: 0 };
        
        this.highlightedPath = null;
        this.calculatedPaths = [];
        this.activePackets = [];
        this.arrivalLeaderboard = [];
        this.animFrameId = null;

        this.initElements();
        this.initCanvas();
        this.bindEvents();
        this.loadDefaultUserTopology();
    }

    initElements() {
        this.htmlTag = document.documentElement;
        this.btnThemeToggle = document.getElementById('theme-toggle');
        this.themeIcon = document.getElementById('theme-icon');

        this.toolButtons = {
            select: document.getElementById('tool-select'),
            node: document.getElementById('tool-node'),
            link: document.getElementById('tool-link'),
            delete: document.getElementById('tool-delete')
        };

        this.btnPresetMesh = document.getElementById('btn-preset-mesh');
        this.btnPresetStar = document.getElementById('btn-preset-star');
        this.btnClearCanvas = document.getElementById('btn-clear-canvas');

        this.selectSource = document.getElementById('select-source');
        this.selectDest = document.getElementById('select-dest');
        this.inputPacketSize = document.getElementById('packet-size');
        this.btnFindPaths = document.getElementById('btn-find-paths');
        this.btnSimulatePacket = document.getElementById('btn-simulate-packet');
        this.btnSimulateAll = document.getElementById('btn-simulate-all');

        this.canvasStatus = document.getElementById('canvas-status');
        this.pathsTableBody = document.getElementById('paths-table-body');

        this.raceResultsBox = document.getElementById('race-results-box');
        this.raceResultsList = document.getElementById('race-results-list');

        this.linkEditorBox = document.getElementById('link-editor');
        this.linkEditorTitle = document.getElementById('link-editor-title');
        this.inputLinkBw = document.getElementById('link-bw');
        this.inputLinkDelay = document.getElementById('link-delay');
        this.btnSaveLink = document.getElementById('btn-save-link');
        this.btnCancelLink = document.getElementById('btn-cancel-link');
    }

    initCanvas() {
        this.canvas = document.getElementById('networkCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
    }

    resizeCanvas() {
        const wrapper = this.canvas.parentElement;
        const rect = wrapper.getBoundingClientRect();
        this.dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        this.ctx.scale(this.dpr, this.dpr);
        this.renderCanvas();
    }

    getThemeColors() {
        const isDark = this.currentTheme === 'dark';
        return {
            bg: isDark ? '#050505' : '#fcfcfc',
            nodeFill: isDark ? '#171717' : '#ffffff',
            nodeBorder: isDark ? '#ffffff' : '#000000',
            nodeText: isDark ? '#ffffff' : '#000000',
            nodeSelected: isDark ? '#ffffff' : '#000000',
            linkColor: isDark ? '#525252' : '#a3a3a3',
            linkHighlight: isDark ? '#ffffff' : '#000000',
            labelBg: isDark ? '#121212' : '#f5f5f5',
            labelText: isDark ? '#ffffff' : '#000000',
            gridColor: isDark ? '#171717' : '#f0f0f0',
            packetFill: isDark ? '#ffffff' : '#000000',
            packetHalo: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)'
        };
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resizeCanvas());

        this.btnThemeToggle.addEventListener('click', () => {
            this.currentTheme = (this.currentTheme === 'dark') ? 'light' : 'dark';
            this.htmlTag.setAttribute('data-theme', this.currentTheme);
            this.themeIcon.textContent = (this.currentTheme === 'dark') ? 'Light Mode' : 'Dark Mode';
            this.renderCanvas();
        });

        // Tools
        Object.keys(this.toolButtons).forEach(tool => {
            this.toolButtons[tool].addEventListener('click', () => {
                Object.values(this.toolButtons).forEach(b => b.classList.remove('active'));
                this.toolButtons[tool].classList.add('active');
                this.currentTool = tool;
                this.linkSourceNode = null;
                this.hideLinkEditor();
                this.updateStatusText();
                this.renderCanvas();
            });
        });

        // Presets
        this.btnPresetMesh.addEventListener('click', () => this.loadDefaultUserTopology());
        this.btnPresetStar.addEventListener('click', () => this.loadPresetStar());
        this.btnClearCanvas.addEventListener('click', () => {
            this.graph = new NetworkGraph();
            this.updateNodeSelectors();
            this.calculatedPaths = [];
            this.highlightedPath = null;
            this.stopPacketSimulation();
            this.renderPathsTable();
            this.renderCanvas();
        });

        // Path Finder & Packet Simulations
        this.inputPacketSize.addEventListener('input', () => this.calculatePaths());
        this.btnFindPaths.addEventListener('click', () => this.calculatePaths());
        this.btnSimulatePacket.addEventListener('click', () => this.startSinglePacketSimulation());
        this.btnSimulateAll.addEventListener('click', () => this.startAllPathsPacketRace());

        // Link Editor
        this.btnSaveLink.addEventListener('click', () => this.saveLinkProperties());
        this.btnCancelLink.addEventListener('click', () => this.hideLinkEditor());

        // Canvas Mouse Events
        this.canvas.addEventListener('mousedown', e => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', e => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleCanvasMouseUp());
    }

    updateStatusText() {
        const modeTexts = {
            select: 'Mode: Select & Drag Routers. Click a link or node to edit properties.',
            node: 'Mode: Click anywhere on canvas to drop a new Router.',
            link: 'Mode: Click first Router, then click second Router to connect a Link.',
            delete: 'Mode: Click any Router or Link to delete it.'
        };
        this.canvasStatus.textContent = modeTexts[this.currentTool];
    }

    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    handleCanvasMouseDown(e) {
        const pos = this.getCanvasCoords(e);
        const clickedNode = this.graph.findNodeAt(pos.x, pos.y);
        const clickedLink = this.graph.findLinkAt(pos.x, pos.y);

        if (this.currentTool === 'node') {
            const newNode = this.graph.addNode(pos.x, pos.y);
            this.updateNodeSelectors();
            this.renderCanvas();
        } else if (this.currentTool === 'link') {
            if (clickedNode) {
                if (!this.linkSourceNode) {
                    this.linkSourceNode = clickedNode;
                    this.canvasStatus.textContent = `Linking from Router ${clickedNode.id}... Click target Router.`;
                } else if (this.linkSourceNode.id !== clickedNode.id) {
                    const newLink = this.graph.addLink(this.linkSourceNode.id, clickedNode.id, 100, 10);
                    this.linkSourceNode = null;
                    this.updateStatusText();
                    if (newLink) {
                        this.showLinkEditor(newLink);
                    }
                    this.renderCanvas();
                }
            }
        } else if (this.currentTool === 'delete') {
            if (clickedNode) {
                this.graph.removeNode(clickedNode.id);
                this.updateNodeSelectors();
                this.renderCanvas();
            } else if (clickedLink) {
                this.graph.removeLink(clickedLink.id);
                this.renderCanvas();
            }
        } else if (this.currentTool === 'select') {
            if (clickedNode) {
                this.selectedNode = clickedNode;
                this.selectedLink = null;
                this.draggingNode = clickedNode;
                this.dragOffset = { x: clickedNode.x - pos.x, y: clickedNode.y - pos.y };
                this.hideLinkEditor();
            } else if (clickedLink) {
                this.selectedLink = clickedLink;
                this.selectedNode = null;
                this.showLinkEditor(clickedLink);
            } else {
                this.selectedNode = null;
                this.selectedLink = null;
                this.hideLinkEditor();
            }
            this.renderCanvas();
        }
    }

    handleCanvasMouseMove(e) {
        if (this.currentTool === 'select' && this.draggingNode) {
            const pos = this.getCanvasCoords(e);
            this.draggingNode.x = pos.x + this.dragOffset.x;
            this.draggingNode.y = pos.y + this.dragOffset.y;
            this.renderCanvas();
        }
    }

    handleCanvasMouseUp() {
        this.draggingNode = null;
    }

    showLinkEditor(link) {
        this.editingLink = link;
        this.linkEditorTitle.textContent = `Link Properties (${link.from} ↔ ${link.to})`;
        this.inputLinkBw.value = link.bwMbps;
        this.inputLinkDelay.value = link.delayMs;
        this.linkEditorBox.style.display = 'flex';
    }

    hideLinkEditor() {
        this.linkEditorBox.style.display = 'none';
        this.editingLink = null;
    }

    saveLinkProperties() {
        if (this.editingLink) {
            this.editingLink.bwMbps = parseFloat(this.inputLinkBw.value) || 100;
            this.editingLink.delayMs = parseFloat(this.inputLinkDelay.value) || 10;
            this.hideLinkEditor();
            this.calculatePaths();
            this.renderCanvas();
        }
    }

    updateNodeSelectors() {
        const nodes = this.graph.nodes;
        const currentSrc = this.selectSource.value;
        const currentDst = this.selectDest.value;

        this.selectSource.innerHTML = '';
        this.selectDest.innerHTML = '';

        nodes.forEach(n => {
            const opt1 = document.createElement('option');
            opt1.value = n.id;
            opt1.textContent = `Router ${n.id}`;
            this.selectSource.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = n.id;
            opt2.textContent = `Router ${n.id}`;
            this.selectDest.appendChild(opt2);
        });

        if (nodes.length >= 1) {
            this.selectSource.value = currentSrc && nodes.some(n => n.id === currentSrc) ? currentSrc : nodes[0].id;
        }
        if (nodes.length >= 2) {
            this.selectDest.value = currentDst && nodes.some(n => n.id === currentDst) ? currentDst : nodes[nodes.length - 1].id;
        }
    }

    loadDefaultUserTopology() {
        this.graph = new NetworkGraph();

        const nodeA = this.graph.addNode(80, 140, 'A');
        const nodeB = this.graph.addNode(250, 70, 'B');
        const nodeC = this.graph.addNode(420, 70, 'C');
        const nodeD = this.graph.addNode(250, 210, 'D');
        const nodeE = this.graph.addNode(520, 140, 'E');

        // A ↔ B | 10 Mbps, 2 ms
        this.graph.addLink(nodeA.id, nodeB.id, 10, 2);

        // B ↔ C | 5 Mbps, 3 ms
        this.graph.addLink(nodeB.id, nodeC.id, 5, 3);

        // C ↔ E | 12 Mbps, 4 ms
        this.graph.addLink(nodeC.id, nodeE.id, 12, 4);

        // A ↔ D | 3 Mbps, 3 ms
        this.graph.addLink(nodeA.id, nodeD.id, 3, 3);

        // B ↔ D | 7 Mbps, 2 ms
        this.graph.addLink(nodeB.id, nodeD.id, 7, 2);

        // D ↔ E | 7 Mbps, 3 ms
        this.graph.addLink(nodeD.id, nodeE.id, 7, 3);

        this.updateNodeSelectors();
        this.selectSource.value = 'A';
        this.selectDest.value = 'E';
        this.calculatePaths();
        this.renderCanvas();
    }

    loadPresetStar() {
        this.graph = new NetworkGraph();
        const center = this.graph.addNode(300, 140, 'Center');
        const r1 = this.graph.addNode(100, 60, 'Node1');
        const r2 = this.graph.addNode(100, 220, 'Node2');
        const r3 = this.graph.addNode(500, 60, 'Node3');
        const r4 = this.graph.addNode(500, 220, 'Node4');

        this.graph.addLink(center.id, r1.id, 100, 10);
        this.graph.addLink(center.id, r2.id, 100, 20);
        this.graph.addLink(center.id, r3.id, 1000, 5);
        this.graph.addLink(center.id, r4.id, 100, 15);
        this.graph.addLink(r1.id, r2.id, 100, 5);
        this.graph.addLink(r3.id, r4.id, 100, 5);

        this.updateNodeSelectors();
        this.calculatePaths();
        this.renderCanvas();
    }

    calculatePaths() {
        const srcId = this.selectSource.value;
        const destId = this.selectDest.value;
        const packetSize = parseInt(this.inputPacketSize.value, 10) || 1500;

        if (!srcId || !destId || srcId === destId) {
            this.calculatedPaths = [];
            this.highlightedPath = null;
            this.stopPacketSimulation();
            this.renderPathsTable();
            this.renderCanvas();
            return;
        }

        this.calculatedPaths = this.graph.findAllPaths(srcId, destId, packetSize);
        this.highlightedPath = this.calculatedPaths.length > 0 ? this.calculatedPaths[0] : null;
        this.renderPathsTable();
        this.renderCanvas();
    }

    renderPathsTable() {
        if (this.calculatedPaths.length === 0) {
            this.pathsTableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted);">
                        No path found between selected routers.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        this.calculatedPaths.forEach((p, idx) => {
            const isHighlight = this.highlightedPath === p;
            const routeStr = p.route.join(' → ');
            html += `
                <tr class="${isHighlight ? 'active-path' : ''}" data-idx="${idx}">
                    <td>#${idx + 1}</td>
                    <td>${routeStr}</td>
                    <td>${p.totalDelayMs.toFixed(2)} ms</td>
                    <td>${p.bottleneckBw} Mbps</td>
                </tr>
            `;
        });
        this.pathsTableBody.innerHTML = html;

        const rows = this.pathsTableBody.querySelectorAll('tr[data-idx]');
        rows.forEach(row => {
            const idx = parseInt(row.dataset.idx, 10);
            row.addEventListener('mouseenter', () => {
                this.highlightedPath = this.calculatedPaths[idx];
                rows.forEach(r => r.classList.remove('active-path'));
                row.classList.add('active-path');
                this.renderCanvas();
            });
            row.addEventListener('click', () => {
                this.highlightedPath = this.calculatedPaths[idx];
                rows.forEach(r => r.classList.remove('active-path'));
                row.classList.add('active-path');
                this.renderCanvas();
            });
        });
    }

    buildSegmentsForPath(pathObj) {
        const route = pathObj.route;
        const packetSize = parseInt(this.inputPacketSize.value, 10) || 1500;
        const segments = [];

        for (let i = 0; i < route.length - 1; i++) {
            const fromId = route[i];
            const toId = route[i + 1];
            const n1 = this.graph.nodes.find(n => n.id === fromId);
            const n2 = this.graph.nodes.find(n => n.id === toId);
            const link = this.graph.links.find(
                l => (l.from === fromId && l.to === toId) || (l.from === toId && l.to === fromId)
            );
            const segCostMs = this.graph.calculateEdgeCost(link, packetSize);
            const durationMs = Math.max(300, segCostMs * 180);

            segments.push({ n1, n2, segCostMs, durationMs });
        }
        return segments;
    }

    startSinglePacketSimulation() {
        this.calculatePaths();

        if (!this.highlightedPath || this.highlightedPath.route.length < 2) {
            this.canvasStatus.textContent = 'Please select Source and Destination routers with a valid path.';
            return;
        }

        this.stopPacketSimulation();

        const segments = this.buildSegmentsForPath(this.highlightedPath);
        const route = this.highlightedPath.route;

        this.activePackets = [{
            rank: 1,
            label: 'Path #1',
            segments,
            currentSegIdx: 0,
            segStartTime: performance.now(),
            totalDelayMs: this.highlightedPath.totalDelayMs,
            targetNodeId: route[route.length - 1],
            x: segments[0].n1.x,
            y: segments[0].n1.y,
            finished: false
        }];

        this.arrivalLeaderboard = [];
        this.canvasStatus.textContent = `Transmitting packet along path: ${route.join(' → ')}...`;
        this.animateRaceLoop();
    }

    startAllPathsPacketRace() {
        this.calculatePaths();

        if (!this.calculatedPaths || this.calculatedPaths.length === 0) {
            this.canvasStatus.textContent = 'No valid paths found between selected routers.';
            return;
        }

        this.stopPacketSimulation();
        this.arrivalLeaderboard = [];

        this.activePackets = this.calculatedPaths.map((p, idx) => {
            const segments = this.buildSegmentsForPath(p);
            return {
                rank: idx + 1,
                label: `Path #${idx + 1} (${p.totalDelayMs.toFixed(1)}ms)`,
                segments,
                currentSegIdx: 0,
                segStartTime: performance.now(),
                totalDelayMs: p.totalDelayMs,
                targetNodeId: p.route[p.route.length - 1],
                x: segments[0].n1.x,
                y: segments[0].n1.y,
                finished: false
            };
        });

        this.canvasStatus.textContent = `Racing ${this.activePackets.length} packets concurrently across all paths...`;
        this.animateRaceLoop();
    }

    stopPacketSimulation() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        this.activePackets = [];
    }

    animateRaceLoop() {
        if (this.activePackets.length === 0) return;

        const now = performance.now();
        let allFinished = true;

        this.activePackets.forEach(pkt => {
            if (pkt.finished) return;

            allFinished = false;
            const seg = pkt.segments[pkt.currentSegIdx];
            const elapsed = now - pkt.segStartTime;
            let progress = elapsed / seg.durationMs;

            if (progress >= 1.0) {
                progress = 1.0;
                pkt.currentSegIdx++;
                if (pkt.currentSegIdx >= pkt.segments.length) {
                    pkt.finished = true;
                    pkt.x = seg.n2.x;
                    pkt.y = seg.n2.y;
                    this.arrivalLeaderboard.push(pkt);
                    this.updateRaceResultsList();
                } else {
                    pkt.segStartTime = now;
                }
            }

            if (!pkt.finished) {
                const currentSeg = pkt.segments[pkt.currentSegIdx];
                pkt.x = currentSeg.n1.x + (currentSeg.n2.x - currentSeg.n1.x) * progress;
                pkt.y = currentSeg.n1.y + (currentSeg.n2.y - currentSeg.n1.y) * progress;
            }
        });

        if (allFinished) {
            const winner = this.arrivalLeaderboard[0];
            let summary = `RACE FINISHED! 1st: Path #${winner.rank} (${winner.totalDelayMs.toFixed(2)} ms)`;
            if (this.arrivalLeaderboard.length > 1) {
                const runnerUp = this.arrivalLeaderboard[1];
                summary += ` | 2nd: Path #${runnerUp.rank} (${runnerUp.totalDelayMs.toFixed(2)} ms)`;
            }
            this.canvasStatus.textContent = summary;
            this.updateRaceResultsList();
            this.renderCanvas();
            return;
        }

        this.renderCanvas();
        this.animFrameId = requestAnimationFrame(() => this.animateRaceLoop());
    }

    updateRaceResultsList() {
        if (!this.raceResultsBox || !this.raceResultsList) return;
        if (this.arrivalLeaderboard.length === 0) {
            this.raceResultsBox.style.display = 'none';
            return;
        }

        this.raceResultsBox.style.display = 'block';
        let html = '';
        this.arrivalLeaderboard.forEach((pkt, idx) => {
            const rankStr = idx === 0 ? '1st Place' : idx === 1 ? '2nd Place' : idx === 2 ? '3rd Place' : `${idx + 1}th Place`;
            const routeStr = pkt.segments.map(s => s.n1.id).concat(pkt.targetNodeId).join(' → ');
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-subtle); padding: 0.25rem 0;">
                    <span><strong style="color: var(--text-primary);">[${rankStr}]</strong> Path #${pkt.rank} (${routeStr})</span>
                    <span style="font-weight: 600; color: var(--text-primary);">${pkt.totalDelayMs.toFixed(2)} ms</span>
                </div>
            `;
        });
        this.raceResultsList.innerHTML = html;
    }

    renderCanvas() {
        const colors = this.getThemeColors();
        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;

        // Clear background
        this.ctx.fillStyle = colors.bg;
        this.ctx.fillRect(0, 0, w, h);

        // Draw grid lines
        this.ctx.strokeStyle = colors.gridColor;
        this.ctx.lineWidth = 1;
        const gridSize = 25;
        for (let x = 0; x < w; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, h);
            this.ctx.stroke();
        }
        for (let y = 0; y < h; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(w, y);
            this.ctx.stroke();
        }

        const isEdgeHighlighted = (fromId, toId) => {
            if (!this.highlightedPath) return false;
            const route = this.highlightedPath.route;
            for (let i = 0; i < route.length - 1; i++) {
                if ((route[i] === fromId && route[i + 1] === toId) || (route[i] === toId && route[i + 1] === fromId)) {
                    return true;
                }
            }
            return false;
        };

        // Draw Links
        this.graph.links.forEach(l => {
            const n1 = this.graph.nodes.find(n => n.id === l.from);
            const n2 = this.graph.nodes.find(n => n.id === l.to);
            if (!n1 || !n2) return;

            const highlighted = isEdgeHighlighted(l.from, l.to);
            const isSelected = this.selectedLink === l;

            this.ctx.beginPath();
            this.ctx.moveTo(n1.x, n1.y);
            this.ctx.lineTo(n2.x, n2.y);
            
            if (highlighted) {
                this.ctx.strokeStyle = colors.linkHighlight;
                this.ctx.lineWidth = 3.5;
            } else if (isSelected) {
                this.ctx.strokeStyle = colors.linkHighlight;
                this.ctx.lineWidth = 2.5;
            } else {
                this.ctx.strokeStyle = colors.linkColor;
                this.ctx.lineWidth = 1.5;
            }
            this.ctx.stroke();

            // Draw Link Property Label (BW & Delay)
            const midX = (n1.x + n2.x) / 2;
            const midY = (n1.y + n2.y) / 2;
            const labelText = `${l.bwMbps}M / ${l.delayMs}ms`;

            this.ctx.font = '10px "JetBrains Mono", monospace';
            const metrics = this.ctx.measureText(labelText);
            const padding = 3;

            this.ctx.fillStyle = colors.labelBg;
            this.ctx.fillRect(
                midX - metrics.width / 2 - padding,
                midY - 6 - padding,
                metrics.width + padding * 2,
                12 + padding * 2
            );

            this.ctx.strokeStyle = colors.nodeBorder;
            this.ctx.strokeRect(
                midX - metrics.width / 2 - padding,
                midY - 6 - padding,
                metrics.width + padding * 2,
                12 + padding * 2
            );

            this.ctx.fillStyle = colors.labelText;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(labelText, midX, midY);
        });

        // Draw Router Nodes
        this.graph.nodes.forEach(n => {
            const isSelected = this.selectedNode === n || (this.linkSourceNode && this.linkSourceNode.id === n.id);
            const inPath = this.highlightedPath && this.highlightedPath.route.includes(n.id);

            this.ctx.beginPath();
            this.ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = colors.nodeFill;
            this.ctx.fill();

            this.ctx.lineWidth = (isSelected || inPath) ? 3 : 1.5;
            this.ctx.strokeStyle = colors.nodeBorder;
            this.ctx.stroke();

            this.ctx.fillStyle = colors.nodeText;
            this.ctx.font = 'bold 11px "Inter", sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(n.id, n.x, n.y);
        });

        // Draw Active Packets
        this.activePackets.forEach((pkt, i) => {
            const px = pkt.x;
            const py = pkt.y;
            const offset = (i - (this.activePackets.length - 1) / 2) * 12;

            // Outer Pulse Halo
            this.ctx.beginPath();
            this.ctx.arc(px, py + offset, 10, 0, Math.PI * 2);
            this.ctx.fillStyle = colors.packetHalo;
            this.ctx.fill();

            // Inner Packet Dot
            this.ctx.beginPath();
            this.ctx.arc(px, py + offset, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = colors.packetFill;
            this.ctx.fill();
            this.ctx.strokeStyle = colors.nodeBorder;
            this.ctx.lineWidth = 1.2;
            this.ctx.stroke();

            // Packet Label
            this.ctx.font = 'bold 9px "JetBrains Mono", monospace';
            this.ctx.fillStyle = colors.labelText;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`Path #${pkt.rank}`, px, py + offset - 12);
        });

        // Draw Arrival Leaderboard Badges at Destination Node
        if (this.arrivalLeaderboard.length > 0) {
            const destNodeId = this.selectDest.value;
            const destNode = this.graph.nodes.find(n => n.id === destNodeId);
            if (destNode) {
                this.arrivalLeaderboard.forEach((pkt, idx) => {
                    const rankStr = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`;
                    const badgeText = `[${rankStr}] Path #${pkt.rank}: ${pkt.totalDelayMs.toFixed(2)} ms`;
                    const bx = destNode.x + 30;
                    const by = destNode.y - 20 + idx * 16;

                    this.ctx.font = 'bold 10px "JetBrains Mono", monospace';
                    this.ctx.fillStyle = colors.labelBg;
                    const m = this.ctx.measureText(badgeText);
                    this.ctx.fillRect(bx - 2, by - 6, m.width + 4, 12);
                    this.ctx.strokeStyle = colors.nodeBorder;
                    this.ctx.strokeRect(bx - 2, by - 6, m.width + 4, 12);

                    this.ctx.fillStyle = colors.labelText;
                    this.ctx.textAlign = 'left';
                    this.ctx.fillText(badgeText, bx, by + 3);
                });
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AppManager();
});
