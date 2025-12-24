/**
 * useRecommendation Hook (Step 10) - DUMMY VERSION
 * Returns hardcoded process recommendations for UI testing/development.
 */

"use client";

import { useState, useEffect } from "react";

export interface ProcessRecommendation {
  process: string;
  confidence: number;
  reasons: string[];
  decision_vector: {
    rules_fired: string[];
    scores: {
      geometry_fit: number;
      feature_match: number;
      constraint_penalty: number;
      user_intent_bonus: number;
    };
  };
  blocking_constraints: string[];
  metadata: Record<string, any>;
}

export interface ProcessRecommendationResponse {
  recommendations: ProcessRecommendation[];
  version: string;
  generated_at: string;
}

interface UseRecommendationOptions {
  quoteId: string;
  partId: string;
  enabled?: boolean;
}

interface UseRecommendationResult {
  data: ProcessRecommendationResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const DUMMY_DATA: ProcessRecommendationResponse = {
  recommendations: [
    {
      process: "CNC Machining",
      confidence: 0.92,
      reasons: [
        "Optimal for Aluminum 6061-T6",
        "Meets tight tolerance requirements (+/- 0.05mm)",
        "Solid geometry detected",
      ],
      decision_vector: {
        rules_fired: [
          "rule_precision_v1",
          "rule_material_match_03",
          "rule_volume_threshold",
        ],
        scores: {
          geometry_fit: 0.95,
          feature_match: 0.9,
          constraint_penalty: 0,
          user_intent_bonus: 0.05,
        },
      },
      blocking_constraints: [],
      metadata: { machine_class: "3-axis" },
    },
    {
      process: "3D Printing (SLA)",
      confidence: 0.65,
      reasons: [
        "Good for rapid prototyping",
        "Complex internal channels supported",
      ],
      decision_vector: {
        rules_fired: ["rule_internal_voids", "rule_proto_speed"],
        scores: {
          geometry_fit: 0.85,
          feature_match: 0.5,
          constraint_penalty: 0.1,
          user_intent_bonus: 0,
        },
      },
      blocking_constraints: [
        "Material property mismatch (Standard Resin vs Aluminum)",
      ],
      metadata: { printer_type: "Formlabs 3L" },
    },
  ],
  version: "1.0.0-dummy",
  generated_at: new Date().toISOString(),
};

export function useRecommendation(
  options: UseRecommendationOptions,
): UseRecommendationResult {
  const [data, setData] = useState<ProcessRecommendationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDummy = async () => {
    setIsLoading(true);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    setData({
      ...DUMMY_DATA,
      generated_at: new Date().toISOString(),
    });
    setIsLoading(false);
  };

  useEffect(() => {
    if (options.enabled !== false && options.quoteId && options.partId) {
      fetchDummy();
    }
  }, [options.quoteId, options.partId, options.enabled]);

  return {
    data,
    isLoading,
    error: null,
    refetch: fetchDummy,
  };
}
