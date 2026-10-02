/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 9B: Formal Experiment Registry
 *
 * Implements:
 * - Formal registry of approved scientific experiments
 * - Deterministic hashing of experiment definitions
 * - Baseline experiments:
 *   1. EXP-001-UNIFORM-BASELINE (Uniform Random Baseline)
 *   2. EXP-002-EMPIRICAL-BASELINE (Empirical Marginal Baseline)
 *   3. EXP-003-MAJORITY-BASELINE (Majority-Class Baseline)
 * - Strict non-predictive scientific research boundaries
 */

import {
  canonicalJsonStringify,
  computeSha256Short,
  SCIENTIFIC_EXPERIMENT_DISCLAIMER,
  type RegisteredExperimentDefinition
} from "./types";

/**
 * Computes deterministic hash for an experiment definition.
 */
export function computeExperimentDefinitionHash(
  def: Omit<RegisteredExperimentDefinition, "deterministicHash">
): string {
  const payload = {
    experimentId: def.experimentId,
    name: def.name,
    version: def.version,
    description: def.description,
    methodology: def.methodology,
    targetId: def.targetId,
    targetName: def.targetName,
    populationScope: def.populationScope,
    modelType: def.modelType,
    parameters: def.parameters,
    metrics: [...def.metrics].sort(),
    temporalPolicy: def.temporalPolicy,
    researchBoundary: def.researchBoundary
  };
  return computeSha256Short(canonicalJsonStringify(payload));
}

function createRegisteredDefinition(
  raw: Omit<RegisteredExperimentDefinition, "deterministicHash">
): RegisteredExperimentDefinition {
  const deterministicHash = computeExperimentDefinitionHash(raw);
  return {
    ...raw,
    deterministicHash
  };
}

// ============================================================================
// Canonical 9B Baseline Experiments
// ============================================================================

export const EXP_001_UNIFORM_BASELINE: RegisteredExperimentDefinition =
  createRegisteredDefinition({
    experimentId: "EXP-001-UNIFORM-BASELINE",
    name: "Uniform Random Categorical Baseline",
    version: "1.0.0",
    description:
      "Evaluates theoretical uniform random expectation across all 10 terminal digit classes (0-9) using chronological holdout split.",
    methodology:
      "Theoretical discrete uniform distribution assigns equal probability 1/10 to each terminal digit. Evaluates expected baseline performance under pure chance.",
    targetId: "tgt_observed_last_digit",
    targetName: "observed_last_digit",
    populationScope: "ALL_POPULATION",
    modelType: "UNIFORM",
    parameters: {
      allowedValues: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
      seed: 42
    },
    metrics: ["ACCURACY", "BALANCED_ACCURACY", "LOG_LOSS", "SAMPLE_SIZE"],
    temporalPolicy: {
      strategy: "CHRONOLOGICAL_HOLDOUT",
      testRatio: 0.2
    },
    researchBoundary: SCIENTIFIC_EXPERIMENT_DISCLAIMER
  });

export const EXP_002_EMPIRICAL_BASELINE: RegisteredExperimentDefinition =
  createRegisteredDefinition({
    experimentId: "EXP-002-EMPIRICAL-BASELINE",
    name: "Empirical Marginal Frequency Baseline",
    version: "1.0.0",
    description:
      "Evaluates historical class frequency distribution learned exclusively from training draws, evaluated on future test draws.",
    methodology:
      "Estimates marginal probability P(class = c) from training partition only. Evaluates whether historical digit frequency drifts deviate from chance on subsequent draws.",
    targetId: "tgt_observed_last_digit",
    targetName: "observed_last_digit",
    populationScope: "ALL_POPULATION",
    modelType: "EMPIRICAL",
    parameters: {
      smoothing: "EPSILON_CLIPPED_1E_15",
      tieBreaking: "LEXICOGRAPHICAL_ASCENDING"
    },
    metrics: ["ACCURACY", "BALANCED_ACCURACY", "LOG_LOSS", "SAMPLE_SIZE"],
    temporalPolicy: {
      strategy: "CHRONOLOGICAL_HOLDOUT",
      testRatio: 0.2
    },
    researchBoundary: SCIENTIFIC_EXPERIMENT_DISCLAIMER
  });

export const EXP_003_MAJORITY_BASELINE: RegisteredExperimentDefinition =
  createRegisteredDefinition({
    experimentId: "EXP-003-MAJORITY-BASELINE",
    name: "Majority Class Baseline",
    version: "1.0.0",
    description:
      "Assigns all probability mass to the most frequent terminal digit class observed in the training partition.",
    methodology:
      "Deterministic argmax of training frequencies. Serves as minimal performance threshold for categorical accuracy.",
    targetId: "tgt_observed_last_digit",
    targetName: "observed_last_digit",
    populationScope: "ALL_POPULATION",
    modelType: "MAJORITY",
    parameters: {
      tieBreaking: "LEXICOGRAPHICAL_ASCENDING"
    },
    metrics: ["ACCURACY", "BALANCED_ACCURACY", "LOG_LOSS", "SAMPLE_SIZE"],
    temporalPolicy: {
      strategy: "CHRONOLOGICAL_HOLDOUT",
      testRatio: 0.2
    },
    researchBoundary: SCIENTIFIC_EXPERIMENT_DISCLAIMER
  });

/**
 * Immutable registry map of canonical baseline experiments.
 */
const CANONICAL_REGISTRY = new Map<string, RegisteredExperimentDefinition>([
  [EXP_001_UNIFORM_BASELINE.experimentId, EXP_001_UNIFORM_BASELINE],
  [EXP_002_EMPIRICAL_BASELINE.experimentId, EXP_002_EMPIRICAL_BASELINE],
  [EXP_003_MAJORITY_BASELINE.experimentId, EXP_003_MAJORITY_BASELINE]
]);

/**
 * Custom experiment registry instance allowing dynamic experiment registration.
 */
export class ExperimentRegistry {
  private readonly experiments = new Map<string, RegisteredExperimentDefinition>(
    CANONICAL_REGISTRY
  );

  public static list(): RegisteredExperimentDefinition[] {
    return defaultExperimentRegistry.getAll();
  }

  public static get(experimentId: string): RegisteredExperimentDefinition | undefined {
    return defaultExperimentRegistry.getById(experimentId);
  }

  public getAll(): RegisteredExperimentDefinition[] {
    return Array.from(this.experiments.values());
  }

  public getById(experimentId: string): RegisteredExperimentDefinition | undefined {
    return this.experiments.get(experimentId);
  }

  public register(
    def: Omit<RegisteredExperimentDefinition, "deterministicHash">
  ): RegisteredExperimentDefinition {
    const registered = createRegisteredDefinition(def);
    this.experiments.set(registered.experimentId, registered);
    return registered;
  }

  public reset(): void {
    this.experiments.clear();
    for (const [k, v] of CANONICAL_REGISTRY) {
      this.experiments.set(k, v);
    }
  }
}

export const defaultExperimentRegistry = new ExperimentRegistry();

export function getRegisteredExperiments(): RegisteredExperimentDefinition[] {
  return defaultExperimentRegistry.getAll();
}

export function getRegisteredExperimentById(
  experimentId: string
): RegisteredExperimentDefinition | undefined {
  return defaultExperimentRegistry.getById(experimentId);
}
