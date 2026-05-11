// ============================================================================
// Dixon-Coles Gradient Descent Optimizer
// ============================================================================
// Optimizes the Dixon-Coles model parameters (attack, defense, home advantage)
// using gradient descent over historical match data.
//
// The standard approach estimates these from simple ratios. Gradient descent
// fine-tunes them by minimizing the negative log-likelihood of observed scores,
// producing more accurate predictions.
//
// This is a non-invasive enhancement: same inputs, same outputs format.
// The optimized parameters are plugged into the existing xG formula.
// ============================================================================

/** Optimized Dixon-Coles parameters for a league */
export interface DixonColesParams {
  /** Team attack parameters (team name → attack strength) */
  attack: Map<string, number>;
  /** Team defense parameters (team name → defense strength conceded) */
  defense: Map<string, number>;
  /** Home advantage parameter (global for the league) */
  homeAdvantage: number;
  /** Dixon-Coles rho parameter (low-score correlation) */
  rho: number;
  /** Final negative log-likelihood (lower = better fit) */
  nll: number;
  /** Number of iterations run */
  iterations: number;
  /** Whether optimization converged */
  converged: boolean;
}

interface MatchData {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}

/**
 * Compute the Poisson probability for a scoreline with Dixon-Coles correction.
 *
 * P(h, a | alpha_i, beta_j, gamma) = tau(h, a, lambda_i, mu_j, rho)
 *   * Poisson(lambda_i, h) * Poisson(mu_j, a)
 *
 * where:
 *   lambda_i = alpha_i * beta_j * gamma  (home team expected goals)
 *   mu_j     = alpha_j * beta_i         (away team expected goals)
 *   alpha = attack, beta = defense, gamma = home advantage
 */
function dixonColesProb(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number
): number {
  // Poisson probabilities
  const pHome = poissonProb(lambdaHome, homeGoals);
  const pAway = poissonProb(lambdaAway, awayGoals);

  // Dixon-Coles tau correction (only for low scorelines)
  let tau = 1;
  if (homeGoals === 0 && awayGoals === 0) tau = 1 - lambdaHome * lambdaAway * rho;
  else if (homeGoals === 0 && awayGoals === 1) tau = 1 + lambdaHome * rho;
  else if (homeGoals === 1 && awayGoals === 0) tau = 1 + lambdaAway * rho;
  else if (homeGoals === 1 && awayGoals === 1) tau = 1 - rho;

  return pHome * pAway * tau;
}

/**
 * Log-gamma function (Lanczos approximation) for numerical stability.
 */
function lnGamma(n: number): number {
  if (n <= 0) return Infinity;

  const g = 7;
  const c: number[] = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (n < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * n)) - lnGamma(1 - n);
  }

  let x = n - 1;
  let a = c[0];
  const t = x + g + 0.5;

  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (x + i);
  }

  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Log of Poisson probability: log(P(X=k)) = k*log(lambda) - lambda - logGamma(k+1)
 */
function logPoissonProb(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 0 : -Infinity;
  return k * Math.log(lambda) - lambda - lnGamma(k + 1);
}

/**
 * Log of Dixon-Coles corrected probability for a scoreline.
 */
function logDixonColesProb(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number
): number {
  const logPoisson = logPoissonProb(lambdaHome, homeGoals) + logPoissonProb(lambdaAway, awayGoals);

  // Tau correction (only meaningful for low scorelines)
  let tau = 1;
  if (homeGoals === 0 && awayGoals === 0) tau = 1 - lambdaHome * lambdaAway * rho;
  else if (homeGoals === 0 && awayGoals === 1) tau = 1 + lambdaHome * rho;
  else if (homeGoals === 1 && awayGoals === 0) tau = 1 + lambdaAway * rho;
  else if (homeGoals === 1 && awayGoals === 1) tau = 1 - rho;

  return logPoisson + Math.log(Math.max(tau, 1e-10));
}

/**
 * Poisson PMF (simple version for initialization).
 */
function poissonProb(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = k * Math.log(lambda) - lambda;
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/**
 * Compute negative log-likelihood of all matches given current parameters.
 */
function computeNLL(
  matches: MatchData[],
  attack: Map<string, number>,
  defense: Map<string, number>,
  homeAdv: number,
  rho: number,
  homeAvg: number,
  awayAvg: number
): number {
  let nll = 0;

  for (const match of matches) {
    const alphaHome = attack.get(match.homeTeam) ?? 1;
    const betaHome = defense.get(match.homeTeam) ?? 1;
    const alphaAway = attack.get(match.awayTeam) ?? 1;
    const betaAway = defense.get(match.awayTeam) ?? 1;

    const lambdaHome = alphaHome * betaAway * homeAvg * homeAdv;
    const lambdaAway = alphaAway * betaHome * awayAvg;

    const logP = logDixonColesProb(
      match.homeGoals,
      match.awayGoals,
      lambdaHome,
      lambdaAway,
      rho
    );

    nll -= logP;
  }

  return nll;
}

/**
 * Compute numerical gradients via finite differences.
 * For each parameter, perturb by epsilon and measure NLL change.
 */
function computeGradients(
  matches: MatchData[],
  attack: Map<string, number>,
  defense: Map<string, number>,
  homeAdv: number,
  rho: number,
  homeAvg: number,
  awayAvg: number,
  epsilon: number,
  teams: string[]
): {
  attackGrad: Map<string, number>;
  defenseGrad: Map<string, number>;
  homeAdvGrad: number;
  rhoGrad: number;
} {
  const baseNLL = computeNLL(matches, attack, defense, homeAdv, rho, homeAvg, awayAvg);

  const attackGrad = new Map<string, number>();
  const defenseGrad = new Map<string, number>();

  for (const team of teams) {
    // Attack gradient
    const newAttack = new Map(attack);
    newAttack.set(team, (attack.get(team) ?? 1) + epsilon);
    const nllPlus = computeNLL(matches, newAttack, defense, homeAdv, rho, homeAvg, awayAvg);
    attackGrad.set(team, (nllPlus - baseNLL) / epsilon);

    // Defense gradient
    const newDefense = new Map(defense);
    newDefense.set(team, (defense.get(team) ?? 1) + epsilon);
    const nllDefPlus = computeNLL(matches, attack, newDefense, homeAdv, rho, homeAvg, awayAvg);
    defenseGrad.set(team, (nllDefPlus - baseNLL) / epsilon);
  }

  // Home advantage gradient
  const nllHomeAdv = computeNLL(matches, attack, defense, homeAdv + epsilon, rho, homeAvg, awayAvg);
  const homeAdvGrad = (nllHomeAdv - baseNLL) / epsilon;

  // Rho gradient
  const clampedRho = Math.max(-0.2, Math.min(0.2, rho + epsilon));
  const nllRho = computeNLL(matches, attack, defense, homeAdv, clampedRho, homeAvg, awayAvg);
  const rhoGrad = (nllRho - baseNLL) / epsilon;

  return { attackGrad, defenseGrad, homeAdvGrad, rhoGrad };
}

/**
 * Initialize parameters from simple ratio estimates.
 */
function initializeParams(
  matches: MatchData[],
  homeAvg: number,
  awayAvg: number
): { attack: Map<string, number>; defense: Map<string, number>; homeAdv: number } {
  const teams = new Set<string>();
  for (const m of matches) {
    teams.add(m.homeTeam);
    teams.add(m.awayTeam);
  }

  // Calculate per-team goals
  const teamData = new Map<string, { scored: number; conceded: number; homeScored: number; homeConceded: number; games: number; homeGames: number }>();

  for (const team of teams) {
    teamData.set(team, { scored: 0, conceded: 0, homeScored: 0, homeConceded: 0, games: 0, homeGames: 0 });
  }

  for (const m of matches) {
    const home = teamData.get(m.homeTeam)!;
    const away = teamData.get(m.awayTeam)!;

    home.scored += m.homeGoals;
    home.conceded += m.awayGoals;
    home.homeScored += m.homeGoals;
    home.homeConceded += m.awayGoals;
    home.games++;
    home.homeGames++;

    away.scored += m.awayGoals;
    away.conceded += m.homeGoals;
    away.games++;
  }

  const avgGoals = (homeAvg + awayAvg) / 2;
  const attack = new Map<string, number>();
  const defense = new Map<string, number>();

  for (const [team, data] of teamData) {
    attack.set(team, data.games > 0 ? (data.scored / data.games) / (avgGoals / 2) : 1);
    defense.set(team, data.games > 0 ? (data.conceded / data.games) / (avgGoals / 2) : 1);
  }

  // Home advantage from ratio of home scoring to overall
  const totalHomeGoals = matches.reduce((s, m) => s + m.homeGoals, 0);
  const totalAwayGoals = matches.reduce((s, m) => s + m.awayGoals, 0);
  const totalHomeGames = matches.length;
  const homeAdv = homeAvg > 0 ? (totalHomeGoals / totalHomeGames) / homeAvg : 1.0;

  return { attack, defense, homeAdv: Math.min(Math.max(homeAdv, 0.8), 1.3) };
}

/**
 * Optimize Dixon-Coles parameters using gradient descent.
 *
 * This is the core gradient descent optimization:
 *   1. Initialize attack/defense/homeAdv from ratio estimates
 *   2. Iteratively compute gradients (direction of improvement)
 *   3. Update parameters in the direction that reduces NLL
 *   4. Apply momentum and learning rate decay for stability
 *
 * The optimization uses:
 *   - Adam-like momentum (exponential moving average of gradients)
 *   - Learning rate decay (reduce step size over time)
 *   - Parameter clamping (prevent unrealistic values)
 *   - Early stopping (converged when NLL change is tiny)
 *
 * @param matches    - Historical match results
 * @param homeAvg    - League average home goals
 * @param awayAvg    - League average away goals
 * @param options    - Optimization settings
 * @returns Optimized Dixon-Coles parameters
 */
export function optimizeDixonColes(
  matches: MatchData[],
  homeAvg: number,
  awayAvg: number,
  options: {
    maxIterations?: number;
    learningRate?: number;
    convergenceThreshold?: number;
    verbose?: boolean;
  } = {}
): DixonColesParams {
  const {
    maxIterations = 200,
    learningRate = 0.01,
    convergenceThreshold = 1e-4,
    verbose = false,
  } = options;

  if (matches.length < 20) {
    // Not enough data for meaningful optimization
    const { attack, defense, homeAdv } = initializeParams(matches, homeAvg, awayAvg);
    return {
      attack,
      defense,
      homeAdvantage: homeAdv,
      rho: 0,
      nll: computeNLL(matches, attack, defense, homeAdv, 0, homeAvg, awayAvg),
      iterations: 0,
      converged: false,
    };
  }

  // Collect unique teams
  const teamsSet = new Set<string>();
  for (const m of matches) {
    teamsSet.add(m.homeTeam);
    teamsSet.add(m.awayTeam);
  }
  const teams = Array.from(teamsSet);

  // Initialize parameters
  const { attack, defense, homeAdv } = initializeParams(matches, homeAvg, awayAvg);

  // Working copies
  let currentAttack = new Map(attack);
  let currentDefense = new Map(defense);
  let currentHomeAdv = homeAdv;
  let currentRho = 0.1; // start with typical Dixon-Coles rho

  // Momentum accumulators (Adam-like)
  const attackVelocity = new Map<string, number>();
  const defenseVelocity = new Map<string, number>();
  for (const team of teams) {
    attackVelocity.set(team, 0);
    defenseVelocity.set(team, 0);
  }
  let homeAdvVelocity = 0;
  let rhoVelocity = 0;

  const beta1 = 0.9; // momentum
  const beta2 = 0.999; // RMSProp
  const epsilon = 1e-8;

  // RMS accumulators
  const attackRMS = new Map<string, number>();
  const defenseRMS = new Map<string, number>();
  for (const team of teams) {
    attackRMS.set(team, 0);
    defenseRMS.set(team, 0);
  }
  let homeAdvRMS = 0;
  let rhoRMS = 0;

  let prevNLL = computeNLL(matches, currentAttack, currentDefense, currentHomeAdv, currentRho, homeAvg, awayAvg);
  let converged = false;
  let iterations = 0;

  const gradEpsilon = 1e-5; // finite difference step

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;

    // Compute gradients
    const grads = computeGradients(
      matches, currentAttack, currentDefense,
      currentHomeAdv, currentRho, homeAvg, awayAvg,
      gradEpsilon, teams
    );

    // Learning rate with warmup and decay
    const lr = learningRate * Math.min(1, (iter + 1) / 50) / Math.sqrt(1 + iter * 0.001);

    // Update each team's attack and defense using Adam optimizer
    for (const team of teams) {
      // Attack
      const aGrad = grads.attackGrad.get(team) ?? 0;
      const aV = beta1 * (attackVelocity.get(team) ?? 0) + (1 - beta1) * aGrad;
      attackVelocity.set(team, aV);
      const aR = beta2 * (attackRMS.get(team) ?? 0) + (1 - beta2) * aGrad * aGrad;
      attackRMS.set(team, aR);
      const aUpdate = lr * (aV / (Math.sqrt(aR) + epsilon));
      const newAttack = (currentAttack.get(team) ?? 1) - aUpdate;
      currentAttack.set(team, Math.min(Math.max(newAttack, 0.3), 3.0));

      // Defense
      const dGrad = grads.defenseGrad.get(team) ?? 0;
      const dV = beta1 * (defenseVelocity.get(team) ?? 0) + (1 - beta1) * dGrad;
      defenseVelocity.set(team, dV);
      const dR = beta2 * (defenseRMS.get(team) ?? 0) + (1 - beta2) * dGrad * dGrad;
      defenseRMS.set(team, dR);
      const dUpdate = lr * (dV / (Math.sqrt(dR) + epsilon));
      const newDefense = (currentDefense.get(team) ?? 1) - dUpdate;
      currentDefense.set(team, Math.min(Math.max(newDefense, 0.3), 3.0));
    }

    // Home advantage update
    const hV = beta1 * homeAdvVelocity + (1 - beta1) * grads.homeAdvGrad;
    homeAdvVelocity = hV;
    const hR = beta2 * homeAdvRMS + (1 - beta2) * grads.homeAdvGrad ** 2;
    homeAdvRMS = hR;
    const hUpdate = lr * (hV / (Math.sqrt(hR) + epsilon));
    currentHomeAdv = Math.min(Math.max(currentHomeAdv - hUpdate, 0.8), 1.3);

    // Rho update (clamped to [-0.2, 0.2])
    const rV = beta1 * rhoVelocity + (1 - beta1) * grads.rhoGrad;
    rhoVelocity = rV;
    const rR = beta2 * rhoRMS + (1 - beta2) * grads.rhoGrad ** 2;
    rhoRMS = rR;
    const rUpdate = lr * (rV / (Math.sqrt(rR) + epsilon));
    currentRho = Math.max(-0.2, Math.min(0.2, currentRho - rUpdate));

    // Compute new NLL
    const newNLL = computeNLL(matches, currentAttack, currentDefense, currentHomeAdv, currentRho, homeAvg, awayAvg);

    // Check convergence
    if (Math.abs(prevNLL - newNLL) < convergenceThreshold) {
      converged = true;
      if (verbose) {
        console.log(`[DixonColes] Converged at iteration ${iter + 1}: NLL=${newNLL.toFixed(2)}, rho=${currentRho.toFixed(4)}, homeAdv=${currentHomeAdv.toFixed(4)}`);
      }
      break;
    }

    prevNLL = newNLL;
  }

  if (verbose && !converged) {
    console.log(`[DixonColes] Max iterations reached (${maxIterations}): NLL=${prevNLL.toFixed(2)}, rho=${currentRho.toFixed(4)}, homeAdv=${currentHomeAdv.toFixed(4)}`);
  }

  return {
    attack: currentAttack,
    defense: currentDefense,
    homeAdvantage: currentHomeAdv,
    rho: currentRho,
    nll: prevNLL,
    iterations,
    converged,
  };
}
