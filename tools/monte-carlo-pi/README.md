# Monte Carlo 3 - Pi Estimation Web Application

An interactive web application for estimating the value of $\pi$ using Monte Carlo sampling inside a unit square ($r=1$).

## Features

- **Interactive Settings**: Customize total points ($N$), sampling distribution (Uniform vs Non-Uniform), and seed values.
- **Pure Black & White Theme**: Pure monochrome design with an instant **Light / Dark** theme switcher.
- **Single-Screen Layout**: `100vh` layout with zero main-page scrolling on desktop + full mobile responsiveness.
- **Visualizations**:
  - **Scatter Plot**: Real-time plot of points inside vs. outside the quarter circle arc ($X^2 + Y^2 \le 1$).
  - **Convergence Curve**: Live plot showing estimated $\pi$ converging to $3.14159...$ over step count $N$.
- **Error Metrics**: Real-time Absolute Error and Relative Error (%) calculation.

## How to Run

Simply open [`index.html`](file:///Users/javad/projects/madani_university/heydarian_projects/simulation/execrice/monte-carlo-3-webpage/index.html) in your browser or run:

```bash
npx serve ./monte-carlo-3-webpage
```
