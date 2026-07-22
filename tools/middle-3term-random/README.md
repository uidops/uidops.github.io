# 3-Term Multiplicative Middle Generator Web Application

An interactive web application for simulating and analyzing the **3-Term Multiplicative Middle Random Number Generator** (`random-3`).

## Features

- **Interactive Configuration**: Customize initial seeds ($Seed_1, Seed_2, Seed_3$), digit count ($D$), sequence length ($N$), and histogram bin count ($k$).
- **Live Visualizations**:
  - **Sequence Plot (U_n vs Step)**: Real-time line chart powered by Chart.js.
  - **Frequency Histogram**: Observed bin counts vs. expected uniform distribution.
- **Real-Time Analysis**:
  - **Chi-Square Goodness-of-Fit Test**: Live calculation of $\chi^2$, critical value, degrees of freedom, and Pass/Fail status.
  - **Degeneracy & Cycle Detector**: Live detection of zero collapses (`0000`) and repeating period lengths.
- **Presets**: Quick toggles for standard seeds, short cycle traps, zero decay seeds, and random seeds.
- **Live Playback / Animation**: Step-by-step sequence generation animation.

## Usage

Simply open [`index.html`](file:///Users/javad/projects/madani_university/heydarian_projects/simulation/execrice/random-3-webpage/index.html) in any modern web browser or serve it via a local web server (e.g. `npx serve ./random-3-webpage`).
