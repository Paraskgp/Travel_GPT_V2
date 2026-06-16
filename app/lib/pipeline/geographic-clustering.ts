import { callLLM, Provider } from "../llm/client"
import {
  clusterAssignmentSystemPrompt,
  clusterAssignmentUserPrompt,
  clusterTravelSystemPrompt,
  clusterTravelUserPrompt,
} from "../claude/prompts"
import {
  ClusterAssignmentResult,
  ClusterResult,
  ClusterTravelPair,
  ClusterTravelResult,
  ExperienceCluster,
  Theme,
} from "../types"
import { parseJSON } from "../utils/parse-json"

export async function generateGeographicClusters(
  destination: string,
  themes: Theme[],
  provider: Provider = "openai"
): Promise<ClusterResult | undefined> {
  try {
    console.log("[pipeline/geographic-clustering] Stage A: cluster assignment...")
    const assignmentRaw = await callLLM(
      clusterAssignmentSystemPrompt(),
      clusterAssignmentUserPrompt({ destination, themes }),
      provider
    )
    const assignment = parseJSON<ClusterAssignmentResult>(assignmentRaw)
    logClusterAssignmentCoverage(themes, assignment.clusters)

    const pairRequests = buildClusterPairRequests(assignment.clusters)
    console.log(`[pipeline/geographic-clustering] Stage B: cluster travel estimates (${pairRequests.length} pairs)...`)
    const travelRaw = await callLLM(
      clusterTravelSystemPrompt(),
      clusterTravelUserPrompt(destination, assignment.clusters, pairRequests),
      provider
    )
    const travel = parseJSON<ClusterTravelResult>(travelRaw)
    if (travel.pairs.length !== pairRequests.length) {
      console.warn("[pipeline/geographic-clustering] pair count warning:", {
        expected: pairRequests.length,
        received: travel.pairs.length,
      })
    }

    console.log(`[pipeline/geographic-clustering] done: ${assignment.clusters.length} clusters, ${travel.pairs.length} pairs`)
    return { clusters: assignment.clusters, pairs: travel.pairs }
  } catch (err) {
    console.warn("[pipeline/geographic-clustering] failed — board will continue without clusters:", err)
    return undefined
  }
}

export function buildClusterPairRequests(
  clusters: ExperienceCluster[]
): Array<Pick<ClusterTravelPair, "from_cluster_id" | "to_cluster_id">> {
  const pairs: Array<Pick<ClusterTravelPair, "from_cluster_id" | "to_cluster_id">> = []
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      pairs.push({
        from_cluster_id: clusters[i].id,
        to_cluster_id: clusters[j].id,
      })
    }
  }
  return pairs
}

function logClusterAssignmentCoverage(
  themes: Theme[],
  clusters: ExperienceCluster[]
): void {
  const expected = themes.flatMap(theme => theme.experiences.map(exp => exp.id))
  const expectedSet = new Set(expected)
  const assigned = clusters.flatMap(cluster => cluster.experience_ids)
  const assignedSet = new Set(assigned)
  const missing = expected.filter(id => !assignedSet.has(id))
  const duplicates = assigned.filter((id, index) => assigned.indexOf(id) !== index)
  const unknown = assigned.filter(id => !expectedSet.has(id))

  if (missing.length || duplicates.length || unknown.length) {
    console.warn("[pipeline/geographic-clustering] coverage warning:", {
      expected: expected.length,
      assigned: assigned.length,
      uniqueAssigned: assignedSet.size,
      missing: missing.length,
      duplicates: duplicates.length,
      unknown: unknown.length,
      missing_ids: missing.slice(0, 20),
    })
  }
}
